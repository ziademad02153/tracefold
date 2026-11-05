import {useEffect,useRef,useState} from 'react'
import {api} from './api'
import type {ExecutionProfile,GenerationCatalog,ProviderView,RepositorySuite} from './executionTypes'
import {clearDraft,draftKey,keepDraft,readDraft} from './draftStorage'
import {StatusBadge,statusText,timeLabel} from './executionUi'
import {downloadText} from './download'

export function RepositorySuiteFlow({profile,view,onProfile,focusSuiteId,disabled=false,onBusyChange}:{profile:ExecutionProfile;view?:ProviderView;onProfile:(p:ExecutionProfile)=>void;focusSuiteId?:string;disabled?:boolean;onBusyChange:(value:string)=>void}){
  const [catalog,setCatalog]=useState<GenerationCatalog>(),[suites,setSuites]=useState<RepositorySuite[]>([])
  const [selected,setSelected]=useState<string[]>([]),[intent,setIntent]=useState(''),[search,setSearch]=useState('')
  const [options,setOptions]=useState<Record<string,unknown>>({}),[suite,setSuite]=useState<RepositorySuite>()
  const [code,setCode]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('')
  const [loadErrors,setLoadErrors]=useState<string[]>([]),[loading,setLoading]=useState(true),[fixedRef,setFixedRef]=useState('')
  const [storageFailed,setStorageFailed]=useState(false),[restored,setRestored]=useState(false)
  const mounted=useRef(true),loadVersion=useRef(0),operation=useRef(false),initialFocus=useRef(false)
  const Options=view?.GenerationOptions
  const edited=!!suite&&suite.state==='draft'&&code!==suite.files[0]?.content
  const locked=disabled||!!busy||['generating','running','preparing'].includes(profile.state)
  const max=catalog?.max_selection||3
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  async function load(){
    const version=++loadVersion.current;setLoading(true)
    const [history,context]=await Promise.allSettled([api<RepositorySuite[]>('executions/suites?repo='+encodeURIComponent(profile.repo)),api<GenerationCatalog>('executions/profiles/'+profile.id+'/generation-context')])
    if(!mounted.current||version!==loadVersion.current)return
    const errors=[]
    if(history.status==='fulfilled')setSuites(history.value.filter(s=>s.provider_id===profile.provider_id));else errors.push('Saved suites could not be loaded. Retry to reconnect to their records.')
    if(context.status==='fulfilled')setCatalog(context.value);else{setCatalog(undefined);errors.push(context.reason instanceof Error?context.reason.message:'Source modules could not be loaded.')}
    setLoadErrors(errors);setLoading(false)
  }
  useEffect(()=>{void load()},[profile.id,profile.environment?.id,profile.state])
  function adopt(item:RepositorySuite){
    const key=draftKey(item.repo,item.id,item.suite_hash)
    const local=item.state==='draft'?readDraft(key):undefined
    if(item.state!=='draft')clearDraft(key)
    setSuite(item);setCode(local??item.files[0]?.content??'');setRestored(local!==undefined&&local!==item.files[0]?.content);setStorageFailed(false);setError('')
  }
  useEffect(()=>{if(!initialFocus.current&&!suite&&focusSuiteId){const item=suites.find(s=>s.id===focusSuiteId);if(item){initialFocus.current=true;adopt(item)}}},[suites,focusSuiteId,suite?.id])
  useEffect(()=>{
    if(!edited)return
    function unload(event:BeforeUnloadEvent){event.preventDefault();event.returnValue=''}
    function navigation(event:MouseEvent){
      const anchor=event.target instanceof Element?event.target.closest('a'):null
      if(!anchor||anchor.target==='_blank'||!anchor.hash||anchor.hash==='#main-content'||anchor.hash===location.hash)return
      if(!window.confirm(storageFailed?'Browser storage is unavailable. Leaving will discard unsaved edits. Leave anyway?':'Leave this view with unsaved test edits? A local copy is kept in this tab.')){event.preventDefault();event.stopPropagation()}
    }
    window.addEventListener('beforeunload',unload);document.addEventListener('click',navigation,true)
    return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',navigation,true)}
  },[edited,storageFailed])
  function changeCode(next:string){
    setCode(next);setRestored(false)
    if(suite){const key=draftKey(suite.repo,suite.id,suite.suite_hash);if(next===suite.files[0]?.content)clearDraft(key);else setStorageFailed(!keepDraft(key,next))}
  }
  function choose(id:string){
    if(edited&&!window.confirm(storageFailed?'Browser storage is unavailable. Switching will discard unsaved edits. Switch anyway?':'Switch suites? Your unsaved edits will stay in this tab.'))return
    initialFocus.current=true
    const item=suites.find(s=>s.id===id);if(item)adopt(item);else{setSuite(undefined);setCode('')}
  }
  async function action(label:string,work:()=>Promise<void>){
    if(operation.current||disabled)return
    operation.current=true;setBusy(label);onBusyChange(label);setError('')
    try{await work()}catch(f){if(mounted.current)setError(f instanceof Error?f.message:String(f))}finally{operation.current=false;if(mounted.current)setBusy('');onBusyChange('')}
  }
  const scenarios=Array.isArray(suite?.metadata.scenarios)?suite.metadata.scenarios as {name:string;description:string}[]:[]
  const targets=catalog?.targets.filter(t=>(t.id+' '+t.label+' '+t.description).toLowerCase().includes(search.toLowerCase()))||[]
  const generationForm=<form onSubmit={e=>{e.preventDefault();if(!selected.length||selected.length>max||intent.trim().length<10)return;if(edited&&!window.confirm('Create another suite while these edits are unsaved? A local copy remains in this tab when storage is available.'))return;void action('Generating test suite',async()=>{const item=await api<RepositorySuite>('executions/profiles/'+profile.id+'/suites',{profile_hash:profile.profile_hash,request:{selection:selected,intent,options}});if(mounted.current)adopt(item);await load()})}}>
    <fieldset disabled={locked||loading||!catalog?.environment_ready}><legend>1. Select source modules</legend>
      <p>Choose up to {max} related modules. Tests import the real project code.</p>
      {catalog?.targets.length?<>
        <label htmlFor="module-search">Find a source module</label><input id="module-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by path, module or symbol"/>
        <p className="selection-count" role="status">{selected.length} of {max} modules selected{selected.length===max?' · Selection limit reached':''}</p>
        <div className="module-options">{targets.map(t=><label className="module-choice" key={t.id}><input type="checkbox" aria-label={'Select '+t.id} checked={selected.includes(t.id)} disabled={!selected.includes(t.id)&&selected.length>=max} onChange={e=>setSelected(old=>e.target.checked?[...old,t.id]:old.filter(id=>id!==t.id))}/><span><strong>{t.id}</strong><small>{t.description||t.label}</small></span></label>)}{!targets.length&&<p>No modules match this search. Clear the search to see available source.</p>}</div>
        {!!selected.length&&<div className="selected-modules" aria-label="Selected modules">{selected.map(id=><button type="button" key={id} onClick={()=>setSelected(old=>old.filter(v=>v!==id))} aria-label={'Remove '+id}>{id}<span aria-hidden="true"> ×</span></button>)}</div>}
      </>:<div className="empty-state"><strong>No eligible source modules</strong><p>Check the component root and provider support. This generator needs supported source modules; it cannot generate tests from an empty or unsupported component.</p><a href={'#tests/'+encodeURIComponent(profile.repo)}>Inspect another revision or component →</a></div>}
      <label htmlFor="suite-intent">2. Expected behavior</label><textarea id="suite-intent" required minLength={10} maxLength={5000} rows={5} value={intent} onChange={e=>setIntent(e.target.value)} placeholder="For a price of 10000 cents and discount of 20%, return 8000 cents. Include boundaries and expected exceptions."/>
      <p className="field-help">Describe correct outputs, not just what the implementation does. Use 10–5,000 characters.</p>
      {catalog&&Options&&<Options catalog={catalog} value={options} onChange={setOptions} disabled={locked}/>}
      <button className="button" disabled={!selected.length||selected.length>max||intent.trim().length<10}>Generate test suite</button>
    </fieldset>
  </form>
  return <section className="surface suite-workspace" id="repository-generation" aria-busy={locked}>
    <div className="section-heading"><div><p className="eyebrow">AI-assisted test design</p><h2>Generate and review tests</h2></div>{suite&&<StatusBadge status={suite.state}/>}</div>
    <p>Define the behavior, review the assertions, then approve the exact tests you want to execute.</p>
    {loading&&<p role="status">Loading source modules and saved suites…</p>}
    {!!loadErrors.length&&<div className="error" role="alert">{loadErrors.map(t=><p key={t}>{t}</p>)}<button className="button secondary" disabled={locked||loading} onClick={()=>void load()}>Retry loading tests</button></div>}
    {error&&<p role="alert" className="error">{error} Your saved suite and local edits have not been discarded.</p>}
    {busy&&<p className="progress" aria-live="polite">{busy}… The operation is saved on the server; returning to this environment reconnects to its state.</p>}
    {catalog&&!catalog.environment_ready&&<p className="notice">This environment needs a runner update before generation. Open Environment recovery to rebuild the approved environment; previous results remain saved.</p>}
    {focusSuiteId&&!initialFocus.current&&!loading&&!suite&&!loadErrors.length&&<p role="alert" className="error">The linked suite is not available for this project and provider. Choose a saved suite below.</p>}
    {suites.length>0&&<><label htmlFor="saved-suite-picker">Saved repository suites</label><select id="saved-suite-picker" value={suite?.id||''} disabled={locked} onChange={e=>choose(e.target.value)}><option value="">Create a new suite</option>{[...suites].reverse().map(s=><option key={s.id} value={s.id}>{statusText(s.state)} · {String(s.metadata.title||'Test suite')} · {timeLabel(s.created_at)}</option>)}</select></>}
    {suite?<details className="new-suite-options"><summary>Create another suite</summary>{generationForm}</details>:generationForm}
    {suite&&<div className="suite-review"><div className="section-heading"><div><p className="eyebrow">3. Developer review</p><h3>{String(suite.metadata.title||'Repository test suite')}</h3></div><span>{scenarios.length} test functions</span></div>
      <p>Generated from {suite.origin_source.revision.slice(0,12)} · Execution target {profile.source.revision.slice(0,12)} · {String(suite.metadata.model||'Provider generated')}</p>
      <details><summary>Review the proposed scenarios</summary><ol className="suite-plan">{scenarios.map(s=><li key={s.name}><strong>{s.name}</strong><p>{s.description}</p></li>)}</ol></details>
      <label htmlFor="repository-suite-code">Test source</label><p className="field-help">Verify imports and every expected value against your requirements. {suite.files[0]?.path}</p><textarea id="repository-suite-code" className="test-code" rows={18} maxLength={25000} spellCheck={false} value={code} readOnly={suite.state!=='draft'} disabled={locked} onChange={e=>changeCode(e.target.value)}/>
      <div className="action-group"><button className="button secondary" disabled={locked} onClick={()=>downloadText(suite.files[0].path.split('/').at(-1)||'tests.py',suite.files[0].content)}>Download saved tests</button>{edited&&<button className="button secondary" disabled={locked} onClick={()=>{if(window.confirm('Discard your unsaved edits and restore the last saved draft?')){clearDraft(draftKey(suite.repo,suite.id,suite.suite_hash));setCode(suite.files[0].content);setRestored(false);setStorageFailed(false)}}}>Discard unsaved edits</button>}</div>
      {edited&&<p className="field-help">Download uses the saved version. Save your edits first to include them.</p>}
      {edited&&<p className={storageFailed?'error':'draft-state'} role="status">{storageFailed?'Unsaved changes. Browser storage is unavailable: save the draft before leaving.':restored?'Local edits restored. Save this draft to update the server record.':'Unsaved changes · a local copy is kept in this tab. Save before approval.'}</p>}
      {suite.state==='draft'?<div className="review-actions"><div className="action-group"><button className="button secondary" disabled={locked||!edited} onClick={()=>void action('Saving reviewed draft',async()=>{const oldKey=draftKey(suite.repo,suite.id,suite.suite_hash);const item=await api<RepositorySuite>('executions/suites/'+suite.id+'/revise',{suite_hash:suite.suite_hash,files:suite.files.map((f,i)=>({path:f.path,content:i===0?code:f.content}))});clearDraft(oldKey);if(mounted.current)adopt(item);await load()})}>Save edited draft</button><button className="button" disabled={locked||edited} onClick={()=>void action('Approving reviewed suite',async()=>{const item=await api<RepositorySuite>('executions/suites/'+suite.id+'/approve',{suite_hash:suite.suite_hash});clearDraft(draftKey(suite.repo,suite.id,suite.suite_hash));if(mounted.current)adopt(item);await load()})}>Approve these exact tests</button></div><p className="field-help">Approval locks the saved code. Save any changes first.</p></div>:<>
        <div className="approved-action"><div><h3>4. Run the approved suite</h3><p>Existing and generated cases are reported separately. The source repository is not modified.</p></div><button className="button" disabled={locked} onClick={()=>void action('Running existing and approved tests',async()=>{const updated=await api<ExecutionProfile>('executions/profiles/'+profile.id+'/runs',{profile_hash:profile.profile_hash,suite_id:suite.id,suite_hash:suite.suite_hash});if(mounted.current)onProfile(updated)})}>Run existing + approved tests</button></div>
        <details className="repair-options"><summary>Verify this suite on a repaired revision</summary><form onSubmit={e=>{e.preventDefault();void action('Opening repaired revision',async()=>{const p=await api<ExecutionProfile>('executions/profiles/'+profile.id+'/revision',{profile_hash:profile.profile_hash,ref:fixedRef.trim()});if(mounted.current)location.hash='#execution/'+p.id+'/generate/'+suite.id})}}><label htmlFor="repair-ref">Repaired branch, tag or commit</label><input id="repair-ref" required value={fixedRef} disabled={locked} onChange={e=>setFixedRef(e.target.value)}/><p>Prepare the repaired revision and run these same approved tests unchanged.</p><button className="button secondary" disabled={locked||!fixedRef.trim()}>Open repaired revision</button></form></details>
      </>}
      <details className="suite-metadata"><summary>Suite identity and generation context</summary><p className="hash">Suite SHA256 {suite.suite_hash}</p><pre>{JSON.stringify(suite.metadata,null,2)}</pre></details>
    </div>}
    {catalog&&<details><summary>Generation scope and limitations</summary>{catalog.limits.map(t=><p key={t}>{t}</p>)}</details>}
  </section>
}
