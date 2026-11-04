import type {EditorProps} from '../executionTypes'

export function pythonDefaults(discovery:Record<string,unknown>):Record<string,unknown>{
  return {component_root:discovery.component_root||'.',runtime:'3.11',install_project:!!discovery.installable,
    requirements_files:[],packages:['pytest==8.3.5'],extras:[],plugins:[],pytest_args:['-q'],pythonpath:[]}
}

export function PythonEnvironmentForm({value,onChange,disabled,discovery}:EditorProps){
  function field(key:string,next:unknown){onChange({...value,[key]:next})}
  const available=(discovery.requirements_files||[]) as string[]
  const chosen=(value.requirements_files||[]) as string[]
  const list=(key:string)=>((value[key]||[]) as string[]).join('\n')
  const inputList=(text:string)=>text.split('\n')
  return <fieldset disabled={disabled} className="environment-fields">
    <legend>Python environment · explicit configuration</legend>
    <p>Dependency downloads use registry wheels without project source. Project installation and tests run offline in isolated containers.</p>
    <p>Layout: {String(discovery.layout)} · Declared Python: {String(discovery.requires_python||'not specified')} · {String(discovery.test_files)} test files detected. Test cases are discovered during execution.</p>
    <label htmlFor="environment-runtime">Runtime</label><select id="environment-runtime" value={String(value.runtime)} onChange={e=>field('runtime',e.target.value)}><option value="3.11">Python 3.11 · Linux</option></select>
    <label htmlFor="environment-install">Project installation</label><select id="environment-install" value={String(value.install_project)} onChange={e=>field('install_project',e.target.value==='true')}>
      <option value="true">Build and install this project</option><option value="false">Source path mode — declare import paths below</option></select>
    <fieldset><legend>Dependency files to approve</legend>{available.length?available.map(path=><label key={path} className="function-choice"><input type="checkbox" checked={chosen.includes(path)} onChange={e=>field('requirements_files',e.target.checked?[...chosen,path]:chosen.filter(item=>item!==path))}/>{path}</label>):<p>No requirements files detected. Declare packages below.</p>}</fieldset>
    <label htmlFor="environment-packages">Additional packages · one requirement per line</label>
    <textarea id="environment-packages" value={list('packages')} onChange={e=>field('packages',inputList(e.target.value))}/>
    <p className="muted">If a dependency file already pins pytest, remove the default line to avoid conflicting versions. Only registry dependencies with available wheels are supported.</p>
    <label htmlFor="environment-extras">Project extras · one per line</label><textarea id="environment-extras" value={list('extras')} onChange={e=>field('extras',inputList(e.target.value))}/>
    <label htmlFor="environment-plugins">Approved pytest plugin import names · one per line</label><textarea id="environment-plugins" value={list('plugins')} onChange={e=>field('plugins',inputList(e.target.value))}/>
    <label htmlFor="environment-args">pytest arguments · one argument per line</label><textarea id="environment-args" value={list('pytest_args')} onChange={e=>field('pytest_args',inputList(e.target.value))}/>
    <p className="muted">Keep the project's own configuration. Each line is one argument, not a shell command. Example: -q, then tests on another line.</p>
    <label htmlFor="environment-paths">Explicit import directories · relative to component root, one per line</label><textarea id="environment-paths" value={list('pythonpath')} onChange={e=>field('pythonpath',inputList(e.target.value))}/>
    <details><summary>Supported profile limits</summary><ul>{((discovery.limits||[]) as string[]).map(limit=><li key={limit}>{limit}</li>)}</ul></details>
  </fieldset>
}
