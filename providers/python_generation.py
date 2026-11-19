"""Bounded repository-context generation. Source inspection never imports project code."""
import ast
import hashlib
import json
import keyword
import os
from pathlib import Path
from time import monotonic
from urllib.request import Request,ProxyHandler,build_opener
from urllib.error import URLError

from pydantic import BaseModel,ConfigDict,Field

from execution_core.contracts import ProviderError


class Case(BaseModel):
    model_config=ConfigDict(extra='forbid',strict=True)
    name:str=Field(pattern=r'^test_[A-Za-z0-9_]+$',max_length=150)
    description:str=Field(min_length=1,max_length=500)


class Plan(BaseModel):
    model_config=ConfigDict(extra='forbid',strict=True)
    title:str=Field(min_length=1,max_length=200)
    scenarios:list[Case]=Field(min_length=1)
    test_code:str=Field(min_length=20,max_length=150000)


def catalog(snapshot,config):
    root=snapshot.path/config['component_root']
    modules={}
    for path in sorted(root.rglob('*.py')):
        relative=path.relative_to(root).as_posix()
        if any(part in {'.venv','venv','node_modules','tests','test','__pycache__'} for part in Path(relative).parts) or path.name.startswith('test_') or path.name in {'setup.py','conftest.py'}:
            continue
        if path.stat().st_size>200000:
            continue
        parts=relative.removesuffix('.py').split('/')
        if parts[0]=='src':
            parts=parts[1:]
        if parts[-1]=='__init__':
            parts=parts[:-1]
        if not parts or any(not p.isidentifier() or keyword.iskeyword(p) for p in parts):
            continue
        try:
            source=path.read_text(encoding='utf-8-sig')
            tree=ast.parse(source)
        except (UnicodeError,SyntaxError):
            continue
        symbols=[node.name for node in tree.body if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and not node.name.startswith('_')]
        if not symbols:
            symbols=[target.id for node in tree.body if isinstance(node, ast.Assign) for target in node.targets if isinstance(target, ast.Name) and not target.id.startswith('_')][:8]
        modules['.'.join(parts)]={'id':relative,'module':'.'.join(parts),'symbols':symbols,'source':source,'tree':tree}
    return root,modules


def generation_context(snapshot,config,environment):
    root,modules=catalog(snapshot,config)
    directories={'.'}
    for file in root.rglob('test_*.py'):
        directory=file.parent.relative_to(root).as_posix()
        if len(directory)<200:
            directories.add(directory)
    if (root/'tests').is_dir():
        directories.add('tests')
    return {'targets':[{'id':m['id'],'label':m['module'],'description':', '.join(m['symbols'][:12]) if m['symbols'] else 'Configuration & Constants'} for m in modules.values()],
            'max_selection':10,'options':{'test_directories':sorted(directories),'default_test_directory':'tests' if (root/'tests').is_dir() else '.'},
            'environment_ready':bool(environment.get('manifest',{}).get('suite_execution_version',0)>=1),
            'limits':['Select up to ten modules per batch; full bounded module context is retained.',
                      'Generation infers or verifies expected behavior and human review; it does not certify the selected modules.',
                      'Generated execution uses the project configuration and explicit generated file; baseline selection arguments apply to existing tests.']}


def context_for(snapshot,config,request):
    from .python_repository import relative
    root,modules=catalog(snapshot,config)
    selection=request.get('selection')
    intent=request.get('intent')
    if not isinstance(intent, str) or not intent.strip():
        intent = "Verify expected functional behavior, edge cases, state transitions and boundary exceptions for all public symbols."
        request['intent'] = intent
    elif len(intent.strip()) > 5000:
        raise ProviderError('Expected behavior must be under 5000 characters.')
    if (not isinstance(selection,list) or not 1<=len(selection)<=50 or not all(isinstance(key,str) for key in selection) or len(set(selection))!=len(selection)):
        raise ProviderError('Choose between one and fifty modules to generate tests.')
    indexed={module['id']:module for module in modules.values() if module['symbols']}
    if any(key not in indexed for key in selection):
        raise ProviderError('A selected source module is unavailable or outside the generation limits.')
    options=request.get('options',{})
    if not isinstance(options,dict) or set(options)-{'test_directory'}:
        raise ProviderError('Unsupported generation options.')
    directory=relative(options.get('test_directory','tests' if (root/'tests').is_dir() else '.'))
    if not (root/directory).is_dir():
        raise ProviderError('Choose an existing test directory so fixture/configuration scope is explicit.')
    chosen=[indexed[key] for key in selection]
    included={m['module']:m for m in chosen}
    # One hop of local imports; never import code into the API interpreter.
    for module in chosen:
        for node in ast.walk(module['tree']):
            names=[]
            if isinstance(node,ast.Import):
                names=[alias.name for alias in node.names]
            elif isinstance(node,ast.ImportFrom):
                prefix=module['module'].split('.')[:-node.level] if node.level else []
                name='.'.join(prefix+([node.module] if node.module else []))
                names=[name]+[name+'.'+alias.name for alias in node.names]
            for name in names:
                if name in modules:
                    included[name]=modules[name]
    total=sum(len(m['source']) for m in included.values())
    if total>250000:
        raise ProviderError('Selected modules and direct local imports exceed the context budget. Select a smaller batch.')
    fixtures=[]
    current=root/directory
    while current.is_relative_to(root):
        file=current/'conftest.py'
        if file.is_file():
            text=file.read_text(encoding='utf-8')
            if len(text)>12000:
                raise ProviderError('Fixture context is too large for this generation profile.')
            fixtures.append({'path':file.relative_to(root).as_posix(),'source':text})
        if current==root:
            break
        current=current.parent
    examples=[]
    for target in chosen:
        for file in list(root.rglob('test_'+Path(target['id']).stem+'.py'))[:1]:
            text=file.read_text(encoding='utf-8')
            examples.append({'path':file.relative_to(root).as_posix(),'source':text[:1500],'truncated':len(text)>1500})
    context={'selected':[{'path':m['id'],'module':m['module'],'public_symbols':m['symbols']} for m in chosen],
             'sources':[{'path':m['id'],'module':m['module'],'source':m['source'],'sha256':hashlib.sha256(m['source'].encode()).hexdigest()} for m in included.values()],
             'fixtures':fixtures,'existing_test_examples':examples,'scope':'selected modules, one-hop local imports and bounded test examples'}
    if len(json.dumps(context))>350000:
        raise ProviderError('Combined source/fixture context exceeds the generation budget.')
    return directory,context


def validate_proposal(snapshot,config,proposal,key):
    from .python_repository import relative
    metadata=proposal.get('metadata',{})
    directory=relative(metadata.get('test_directory','.' ))
    files=proposal.get('files')
    if not isinstance(files,list) or len(files)==0:
        raise ProviderError('Proposal must contain at least one generated test file.')
    root=snapshot.path/config['component_root']
    all_names=[]
    validated_files=[]

    def call_root(node):
        function=node.func
        while isinstance(function,ast.Attribute):
            function=function.value
        return function.id if isinstance(function,ast.Name) else None

    selected=metadata.get('context',{}).get('selected',[])
    all_imported={item['module']:set() for item in selected}
    all_calls=set()

    for f in files:
        file_path=f.get('path','')
        if not file_path:
            raise ProviderError('Each test file must specify a valid path.')
        if (root/file_path).exists():
            raise ProviderError(f'The generated test path {file_path} already exists in this source revision; no file was overwritten.')
        code=f.get('content','')
        if not isinstance(code,str) or len(code)>250000:
            raise ProviderError(f'Generated code for {file_path} exceeds the supported test-file limit.')
        try:
            tree=ast.parse(code)
        except SyntaxError as failure:
            raise ProviderError(f'Generated tests in {file_path} are not valid Python: {failure}.') from failure
        functions=[node for node in tree.body if isinstance(node,ast.FunctionDef)]
        test_functions=[node for node in functions if node.name.startswith('test_')]
        file_names=[node.name for node in test_functions]
        if len(file_names)<1:
            raise ProviderError(f'File {file_path} must contain at least one test_ function.')
        duplicates=sorted(set(n for n in file_names if file_names.count(n)>1))
        if duplicates:
            raise ProviderError(f'File {file_path} contains duplicate test names: {", ".join(duplicates)}.')
        allowed=(ast.Import,ast.ImportFrom,ast.FunctionDef,ast.ClassDef,ast.Assign)
        invalid=[node for node in tree.body if not isinstance(node,allowed) and not (isinstance(node,ast.Expr) and isinstance(node.value,ast.Constant) and isinstance(node.value.value,str))]
        if invalid:
            raise ProviderError(f'Generated file {file_path} contains invalid top-level node: {type(invalid[0]).__name__}')
        for function in test_functions:
            if any(isinstance(n,ast.Attribute) and n.attr in {'skip','skipif','xfail'} for d in function.decorator_list for n in ast.walk(d)):
                raise ProviderError('Generated tests cannot hide execution with skip/xfail decorators.')
            assertions=[node for node in ast.walk(function) if isinstance(node,ast.Assert) and not isinstance(node.test,ast.Constant)]
            raises=any(isinstance(node,ast.Call) and (isinstance(node.func,ast.Attribute) and node.func.attr=='raises' or isinstance(node.func,ast.Name) and node.func.id=='raises') for node in ast.walk(function))
            if not assertions and not raises:
                raise ProviderError(f'Every generated test must assert behavior or check an expected exception ({function.name} in {file_path}).')
        
        for node in tree.body:
            if isinstance(node,ast.ImportFrom) and node.level==0 and node.module in all_imported:
                all_imported[node.module].update(alias.asname or alias.name for alias in node.names if alias.name!='*')
            elif isinstance(node,ast.Import):
                for alias in node.names:
                    if alias.name in all_imported:
                        all_imported[alias.name].add(alias.asname or alias.name.split('.')[0])
        for f_node in functions:
            for node in ast.walk(f_node):
                if isinstance(node,ast.Call):
                    c=call_root(node)
                    if c: all_calls.add(c)
                elif isinstance(node,ast.Attribute):
                    all_calls.add(node.attr)
                elif isinstance(node,ast.Name):
                    all_calls.add(node.id)
        all_names.extend(file_names)
        content=code.rstrip()+'\n'
        validated_files.append({
            'path':file_path,
            'content':content,
            'sha256':hashlib.sha256(content.encode()).hexdigest()
        })
    if selected and any(not names or not names.intersection(all_calls) for names in all_imported.values()):
        raise ProviderError('Tests must import and exercise public APIs from every selected module, using their real import paths.')
    old={item['name']:item for item in metadata.get('scenarios',[])}
    scenarios=[old.get(name,{'name':name,'description':'Verified behavioral test '+name}) for name in all_names]
    return {'files':validated_files,
            'metadata':{**metadata,'scenarios':scenarios,'component_root':config['component_root']}}


def _generate_single_shard(snapshot,config,environment,request,sub_key,policy,start_time,file_path):
    directory,context=context_for(snapshot,config,request)
    model=os.getenv('TRACEFOLD_TEST_MODEL','gemma4:e4b')
    packages=environment['manifest'].get('packages',[])[:60]
    is_gui=any('gui' in str(t).lower() or 'main' in str(t).lower() or 'dialog' in str(t).lower() for t in request.get('selection',[]))
    gui_tip=' For PyQt/GUI code, mock the UI event loop or ensure QApplication is headless (os.environ["QT_QPA_PLATFORM"] = "offscreen") so tests never hang.' if is_gui else ''
    messages=[{'role':'system','content':
        'You are an expert Principal QA & Test Automation Architect. Generate rigorous, comprehensive pytest suites for selected modules in a real project. '
        'Organize your tests across 3 COMPREHENSIVE TESTING TIERS: '
        '1. LAYER 1 (Unit & Functional Logic): Complete happy-path coverage of class initialization, public methods, properties, calculations, and expected return types. '
        '2. LAYER 2 (Boundary, Negative & Fault Injection): Deliberately attack the code with edge cases (None, 0, negative values, extreme floats, empty strings/lists/dicts, wrong types). Verify with pytest.raises that invalid inputs trigger expected exceptions. Use unittest.mock.patch inside test bodies to simulate hardware disconnection, missing files, or I/O failures. '
        '3. LAYER 3 (Stateful Integration & Sequential Workflows): Multi-step end-to-end operation sequences exercising component lifecycles (e.g. init -> configure -> process batch -> handle state transition -> persist output -> cleanup). '
        'CRITICAL TOP-LEVEL SYNTAX RULE: The test file must ONLY contain import statements, an optional module docstring, and def test_...() functions. '
        'NEVER define any class (NO class statements anywhere in the file). NEVER declare module-level variables or constants outside functions. '
        'If a mock, dummy object, or test data is needed, define it INSIDE the test function body or use unittest.mock.MagicMock / unittest.mock.patch. '
        'Use the actual import paths and project APIs, never copy or replace production code. '
        'Every selected module must be imported and exercised thoroughly. '
        'Each test MUST have a strictly UNIQUE descriptive name (e.g. test_01_unit_..., test_02_edge_..., test_03_workflow_...). NEVER reuse the same function name. '
        'Keep tests concise and focused; avoid verbose repetitive boilerplate so the complete suite finishes cleanly within token limits. '
        'No module-level assignments/helpers; no skip/xfail decorators, network, processes, environment access or dependency installation. '
        'Use only installed packages, pytest and standard library. Do not mock the APIs being tested. '
        'Tests must reveal actual bugs rather than change expectations to match broken code. '
        f'{gui_tip}'
        'title is one concise sentence; scenarios names exactly match test functions. Return schema-valid JSON.'},
        {'role':'user','content':json.dumps({'intent':request['intent'],'context':context,'installed_packages':packages,'python':environment['manifest'].get('python')})}]
    for attempt in range(2):
        payload={'model':model,'stream':False,'think':False,'format':Plan.model_json_schema(),
                 'options':{'temperature':0,'num_ctx':32768,'num_predict':8192},'keep_alive':'5m','messages':messages}
        remaining=policy.generation_seconds-(monotonic()-start_time)
        if remaining<=0:
            raise ProviderError('Test generation exceeded its deadline.')
        call=Request(os.getenv('OLLAMA_BASE_URL','http://10.11.3.181:11434').rstrip('/')+'/api/chat',
                     data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
        try:
            with build_opener(ProxyHandler({})).open(call,timeout=min(150,remaining)) as response:
                raw=response.read(500001)
            if len(raw)>500000:
                raise ValueError('Model response exceeded output size limit.')
            data=json.loads(raw)
            if not data.get('done') or data.get('done_reason')=='length':
                raise ValueError('Model response was truncated or did not finish.')
            plan=Plan.model_validate_json(data['message']['content'])
            tree=ast.parse(plan.test_code)
            names=[node.name for node in tree.body if isinstance(node,ast.FunctionDef)]
            duplicates=sorted(set(n for n in names if names.count(n)>1))
            if duplicates:
                raise ValueError(f"Functions must have unique test_ names. Duplicate definitions found: {', '.join(duplicates)}")
            if names!=[case.name for case in plan.scenarios]:
                raise ValueError('Scenario names and generated test definitions differ.')
            return plan,context,directory,attempt+1
        except (URLError,OSError,TimeoutError) as network_failure:
            raise ProviderError('Repository test generation did not complete. Check the company model and try again; existing evidence is preserved.') from network_failure
        except (ValueError,KeyError,TypeError) as parse_failure:
            if attempt==0:
                is_truncation='truncated' in str(parse_failure).lower() or (
                    'data' in locals() and isinstance(data,dict) and data.get('done_reason')=='length'
                )
                if is_truncation:
                    messages+=[
                        {'role':'user','content':(
                            "Generation alert: Your previous attempt was too verbose and got truncated by the token limit. "
                            "Please generate a more concise, compact suite of high-impact test functions. "
                            "Keep test logic direct and avoid repetitive boilerplate so the entire JSON finishes completely within limits."
                        )}
                    ]
                else:
                    raw_content=''
                    if 'data' in locals() and isinstance(data,dict) and isinstance(data.get('message'),dict):
                        raw_content=str(data['message'].get('content',''))
                    messages+=[
                        {'role':'assistant','content':raw_content},
                        {'role':'user','content':(
                            f"Validation failed: {parse_failure}. "
                            "Explicit structural requirements: "
                            "1. Generate distinct test functions starting with 'test_'. "
                            "2. Every function must have a completely UNIQUE name. Never reuse or duplicate any test function name. "
                            "3. The scenarios list must have the exact same unique names in the exact same order. "
                            "Return a corrected JSON suite adhering strictly to these structural requirements; preserve the original expected behavior."
                        )}
                    ]
                continue
            raise ProviderError(
                f"Test generation failed structural validation after retry: {parse_failure}. "
                "No invalid suite was saved; your module selections and expected behavior are preserved."
            ) from parse_failure


def generate(snapshot,config,environment,request,key,policy):
    from .python_repository import relative
    selection=request.get('selection',[])
    start=monotonic()
    root=snapshot.path/config['component_root']
    directory=relative(request.get('options',{}).get('test_directory','tests' if (root/'tests').is_dir() else '.'))

    if len(selection)<=1:
        file_path=(directory+'/' if directory!='.' else '')+'test_tracefold_'+key+'.py'
        plan,context,directory,attempts=_generate_single_shard(snapshot,config,environment,request,key,policy,start,file_path)
        metadata={'title':plan.title,'scenarios':[case.model_dump() for case in plan.scenarios],
                  'context':context,'test_directory':directory,'component_root':config['component_root'],
                  'model':os.getenv('TRACEFOLD_TEST_MODEL','gemma4:e4b'),'attempts':attempts,'seconds':round(monotonic()-start,2)}
        proposal={'files':[{'path':file_path,'content':plan.test_code}],'metadata':metadata}
        return validate_proposal(snapshot,config,proposal,key)

    generated_files=[]
    combined_scenarios=[]
    combined_selected=[]
    max_attempts=1

    for mod_id in selection:
        remaining=policy.generation_seconds-(monotonic()-start)
        if remaining<=10 and generated_files:
            break
        safe_name=mod_id.replace('/','_').replace('\\','_').removesuffix('.py')
        file_path=(directory+'/' if directory!='.' else '')+f'test_tracefold_{safe_name}_{key[:6]}.py'
        shard_req={
            'selection':[mod_id],
            'intent':request.get('intent','Verify expected functional behavior, edge cases, and boundary exceptions.'),
            'options':request.get('options',{})
        }
        try:
            plan,context,_,shard_attempts=_generate_single_shard(snapshot,config,environment,shard_req,key,policy,start,file_path)
            generated_files.append({'path':file_path,'content':plan.test_code})
            combined_scenarios.extend([case.model_dump() for case in plan.scenarios])
            combined_selected.extend(context.get('selected',[]))
            max_attempts=max(max_attempts,shard_attempts)
        except Exception as e:
            print(f"Warning: Shard generation for {mod_id} failed: {e}")
            continue

    if not generated_files:
        raise ProviderError("Failed to generate test files for any selected module.")

    metadata={
        'title':f'Sharded automated verification suite ({len(generated_files)} modules)',
        'scenarios':combined_scenarios,
        'context':{'selected':combined_selected,'scope':'Multi-module sharded synthesis'},
        'test_directory':directory,
        'component_root':config['component_root'],
        'model':os.getenv('TRACEFOLD_TEST_MODEL','gemma4:e4b'),
        'attempts':max_attempts,
        'seconds':round(monotonic()-start,2)
    }
    proposal={'files':generated_files,'metadata':metadata}
    return validate_proposal(snapshot,config,proposal,key)
