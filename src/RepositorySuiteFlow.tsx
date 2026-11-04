import {useEffect,useState} from 'react'
import {api} from './api'
import type {ExecutionProfile,GenerationCatalog,ProviderView,RepositorySuite} from './executionTypes'

export function RepositorySuiteFlow({profile,view,onProfile,focusSuiteId}:{profile:ExecutionProfile;view?:ProviderView;onProfile:(p:ExecutionProfile)=>void;focusSuiteId?:string}){
  const [catalog,setCatalog]=useState<GenerationCatalog>()
  const [suites,setSuites]=useState<RepositorySuite[]>([])
  const [selected,setSelected]=useState<string[]>([])
  const [intent,setIntent]=useState('')
  const [options,setOptions]=useState<Record<string,unknown>>({})
  const [suite,setSuite]=useState<RepositorySuite>()
  const [code,setCode]=useState('')
  const [busy,setBusy]=useState('')
  const [error,setError]=useState('')
  const [fixedRef,setFixedRef]=useState('')
  const Options=view?.GenerationOptions
  async function load(){
    const items=await api<RepositorySuite[]>('executions/suites?repo='+encodeURIComponent(profile.repo))
    setSuites(items.filter(s=>s.provider_id===profile.provider_id))
    const context=await api<GenerationCatalog>('executions/profiles/'+profile.id+'/generation-context')
    setCatalog(context)
  }
  useEffect(()=>{void load().catch(f=>setError(String(f)))},[profile.id,profile.environment?.id,profile.state])
  useEffect(()=>{if(!suite&&focusSuiteId){const item=suites.find(s=>s.id===focusSuiteId);if(item)open(item)}},[suites,focusSuiteId,suite?.id])
  async function action(label:string,work:()=>Promise<void>){setBusy(label);setError('');try{await work()}catch(f){setError(f instanceof Error?f.message:String(f))}finally{setBusy('')}}
  function open(item:RepositorySuite){setSuite(item);setCode(item.files[0]?.content||'')}
  const locked=!!busy||['generating','running','preparing'].includes(profile.state)
  const edited=!!suite&&code!==suite.files[0]?.content
  const scenarios=Array.isArray(suite?.metadata.scenarios)?suite.metadata.scenarios as {name:string;description:string}[]:[]
  return <section className="surface" id="repository-generation"><h2>Generate additional repository tests</h2>
    <p>Describe expected behavior, review the generated code, then approve and run it alongside the existing tests. Generation never changes the repository.</p>
    {error&&<p role="alert" className="error">{error}</p>}
    {busy&&<p role="status" className="progress">{busy} — keep this page open. Saved drafts and reports remain available after refresh.</p>}
    {catalog&&!catalog.environment_ready&&<p className="error">Rebuild this environment below to install the repository suite runner. Earlier results remain saved.</p>}
    {catalog&&<details><summary>Generation scope and limitations</summary>{catalog.limits.map(t=><p key={t}>{t}</p>)}</details>}
    <form onSubmit={e=>{e.preventDefault();void action('Generating test suite',async()=>{
      const item=await api<RepositorySuite>('executions/profiles/'+profile.id+'/suites',{profile_hash:profile.profile_hash,request:{selection:selected,intent,options}})
      open(item);await load()
    })}}>
      <fieldset disabled={locked||!catalog?.environment_ready}><legend>1. Choose source modules</legend>
        <p>Hold Ctrl (Windows) or Cmd (Mac) to select multiple modules. Choose a small related group for one focused suite.</p>
        <label>Source modules (up to {catalog?.max_selection||3})<select multiple size={Math.min(7,Math.max(3,catalog?.targets.length||3))} value={selected} onChange={e=>setSelected(Array.from(e.target.selectedOptions,o=>o.value))}>{catalog?.targets.map(t=><option key={t.id} value={t.id}>{t.id} — {t.description}</option>)}</select></label>
        <label>2. Expected behavior<textarea required minLength={10} maxLength={5000} rows={5} value={intent} onChange={e=>setIntent(e.target.value)} placeholder="Describe correct outputs, boundary cases and expected exceptions. These expectations guide the tests; review every assertion."/></label>
        {catalog&&Options&&<Options catalog={catalog} value={options} onChange={setOptions} disabled={locked}/>}
        <button className="button" disabled={!selected.length||selected.length>(catalog?.max_selection||3)}>Generate test suite</button>
      </fieldset>
    </form>
    <label>Saved repository suites<select value={suite?.id||''} disabled={locked} onChange={e=>{const item=suites.find(s=>s.id===e.target.value);if(item)open(item)}}><option value="">Choose a saved suite</option>{suites.map(s=><option key={s.id} value={s.id}>{s.state} · {s.origin_source.revision.slice(0,8)} · {new Date(s.created_at).toLocaleString()} · {s.id.slice(0,8)}</option>)}</select></label>
    {suite&&<div><h3>3. Review generated tests · {suite.state.toUpperCase()}</h3>
      <p><strong>{String(suite.metadata.title||'Repository test suite')}</strong> · {scenarios.length} test functions · {String(suite.metadata.model||'Provider generated')}</p>
      <p>Generated for revision {suite.origin_source.revision.slice(0,12)}. Current execution target: {profile.source.revision.slice(0,12)}.</p>
      <ol className="suite-plan">{scenarios.map(s=><li key={s.name}><strong>{s.name}</strong><p>{s.description}</p></li>)}</ol>
      <p>Check that expected values come from your requirements, imports use the real project, and tests do not replace production logic.</p>
      <p className="hash">Suite SHA256 {suite.suite_hash}</p><p>{suite.files[0]?.path}</p>
      <label htmlFor="repository-suite-code">Test source</label><textarea id="repository-suite-code" className="test-code" rows={18} spellCheck={false} value={code} readOnly={suite.state!=='draft'} disabled={locked} onChange={e=>setCode(e.target.value)}/>
      <details><summary>Generation context and model record</summary><pre>{JSON.stringify(suite.metadata,null,2)}</pre></details>
      {suite.state==='draft'?<>
        {edited&&<button className="button secondary" disabled={locked} onClick={()=>void action('Saving reviewed draft',async()=>{const item=await api<RepositorySuite>('executions/suites/'+suite.id+'/revise',{suite_hash:suite.suite_hash,files:suite.files.map((f,i)=>({path:f.path,content:i===0?code:f.content}))});open(item);await load()})}>Save edited draft</button>}
        <button className="button" disabled={locked||edited} onClick={()=>void action('Approving reviewed suite',async()=>{open(await api<RepositorySuite>('executions/suites/'+suite.id+'/approve',{suite_hash:suite.suite_hash}));await load()})}>Approve these exact tests</button>
      </>:<><p>Approved tests are locked. Re-use this suite on a repaired revision to compare the same assertions.</p>
        <button className="button" disabled={locked} onClick={()=>void action('Running existing and approved tests',async()=>{onProfile(await api<ExecutionProfile>('executions/profiles/'+profile.id+'/runs',{profile_hash:profile.profile_hash,suite_id:suite.id,suite_hash:suite.suite_hash}));setTimeout(()=>document.getElementById('repository-evidence')?.scrollIntoView({behavior:'smooth'}),0)})}>Run existing + approved tests</button>
        <form onSubmit={e=>{e.preventDefault();void action('Saving repaired revision profile',async()=>{const p=await api<ExecutionProfile>('executions/profiles/'+profile.id+'/revision',{profile_hash:profile.profile_hash,ref:fixedRef});location.hash='#execution/'+p.id+'/generate/'+suite.id})}}><label>Repaired branch, tag or commit<input required value={fixedRef} disabled={locked} onChange={e=>setFixedRef(e.target.value)}/></label><p>Prepare the new revision and run this same suite unchanged. Environment changes are recorded separately.</p><button className="button secondary" disabled={locked}>Open repaired revision</button></form>
      </>}
    </div>}
  </section>
}
