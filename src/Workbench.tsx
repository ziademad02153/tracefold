import { useEffect, useState } from 'react'
import { api } from './api'

type Run = {
  id:string; exit_code:number|null; status:'passed'|'failed'|'blocked'; sha:string; ref:string;
  log:string; source:string; seconds?:number; test_hash:string; completed_at:string;
}
type Session = {
  id:string; repo:string; state:string; path:string; function:string; expected:string;
  source:string; sha:string; test_code:string; test_hash:string; scenario:string;
  approved_at:string|null; runs:Run[]; model:string;
}
type History = {id:string; path:string; function:string; created_at:string}
type Files = {sha:string; files:string[]}
type Functions = {sha:string; source:string; functions:string[]}

export function Workbench({repo,sessionId}:{repo?:string;sessionId?:string}) {
  const [session,setSession] = useState<Session>()
  const [history,setHistory] = useState<History[]>([])
  const [branches,setBranches] = useState<string[]>([])
  const [ref,setRef] = useState('')
  const [files,setFiles] = useState<Files>()
  const [path,setPath] = useState('')
  const [functions,setFunctions] = useState<Functions>()
  const [fn,setFn] = useState('')
  const [expected,setExpected] = useState('')
  const [runRef,setRunRef] = useState('')
  const [busy,setBusy] = useState('')
  const [error,setError] = useState('')
  const [runner,setRunner] = useState<{ready:boolean;message:string}>()
  const [initializing,setInitializing] = useState(true)

  useEffect(() => {
    let active=true
    async function load() {
      try {
        if (sessionId) {
          const data=await api<Session>('testing/sessions/'+sessionId)
          if(active){setSession(data);setRunRef(data.runs.at(-1)?.ref||data.sha)}
        } else if (repo) {
          const results=await Promise.allSettled([
            api<{name:string}[]>('testing/branches?repo='+encodeURIComponent(repo)),
            api<History[]>('testing/sessions?repo='+encodeURIComponent(repo)),
          ])
          if(active){
            if(results[0].status==='fulfilled'){
              const names=results[0].value.map(item=>item.name)
              setBranches(names);setRef(names.includes('main')?'main':names[0]||'')
            } else setError('Could not load branch names. Enter a branch name or commit ID to continue.')
            if(results[1].status==='fulfilled')setHistory(results[1].value)
          }
        }
        const status=await api<{ready:boolean;message:string}>('testing/runner')
        if(active)setRunner(status)
      }catch(failure){if(active)setError(failure instanceof Error?failure.message:String(failure))}
      finally{if(active)setInitializing(false)}
    }
    void load()
    return()=>{active=false}
  },[repo,sessionId])

  useEffect(()=>{
    if(!sessionId||session?.state!=='running')return
    let active=true
    const timer=setInterval(()=>{
      api<Session>('testing/sessions/'+sessionId).then(data=>{
        if(active)setSession(data)
      }).catch(()=>{if(active)setError('Could not refresh this run. Reload the session to reconnect.')})
    },2000)
    return()=>{active=false;clearInterval(timer)}
  },[sessionId,session?.state])

  async function action(name:string, work:()=>Promise<void>){
    setBusy(name);setError('')
    try{await work()}catch(failure){setError(failure instanceof Error?failure.message:String(failure))}
    finally{setBusy('')}
  }

  if(initializing)return <p role="status">Loading testing workspace…</p>
  const activeRepo=repo||session?.repo
  return <div className="testing-workspace">
    <p className="page-help">Choose one standalone Python function. Define its expected behavior, review the generated test, then run and save the evidence.</p>
    {activeRepo&&<p><a href={'#testing/'+encodeURIComponent(activeRepo)}>{activeRepo}</a></p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {busy&&<p className="progress" role="status">{busy==='generate'?'Gemma is generating your test. This may take a few minutes.':busy==='run'?'Running the approved test in Docker…':'Loading…'}</p>}
    {!session&&repo&&<>
      <form className="surface" onSubmit={event=>{event.preventDefault();void action('files',async()=>{
        setFunctions(undefined);setFn('');setPath('')
        setFiles(await api<Files>('testing/files?repo='+encodeURIComponent(repo)+'&ref='+encodeURIComponent(ref)))
      })}}>
        <h2>1. Select code</h2>
        <p>Standalone Python functions with built-ins or supported standard-library imports. Classes, project helpers and external dependencies are outside this first workflow.</p>
        <label htmlFor="test-ref">Branch or commit ID</label>
        <div className="row"><input id="test-ref" list="test-branches" value={ref} required disabled={!!busy}
          onChange={event=>{setRef(event.target.value);setFiles(undefined);setFunctions(undefined);setFn('')}}/>
          <datalist id="test-branches">{branches.map(branch=><option key={branch} value={branch}/>)}</datalist>
          <button className="button secondary" disabled={!!busy}>Load Python files</button></div>
        {files&&<p className="muted">Selected revision {files.sha.slice(0,12)} · {files.files.length} Python files</p>}
      </form>
      {files&&<section className="surface">
        <label htmlFor="test-file">Python file</label>
        <select id="test-file" value={path} disabled={!!busy} onChange={event=>{setPath(event.target.value);setFunctions(undefined);setFn('')}}>
          <option value="">Select a file</option>{files.files.map(file=><option key={file} value={file}>{file}</option>)}
        </select>
        {!files.files.length&&<p>No supported Python files in this revision.</p>}
        <button className="button secondary" disabled={!!busy||!path} onClick={()=>void action('functions',async()=>{
          const data=await api<Functions>('testing/functions?repo='+encodeURIComponent(repo)+'&ref='+files.sha+'&path='+encodeURIComponent(path))
          setFunctions(data);setFn(data.functions[0]||'')
        })}>Load functions</button>
        {functions&&<>
          <label htmlFor="test-function">Function</label>
          <select id="test-function" value={fn} onChange={event=>setFn(event.target.value)} disabled={!!busy}>
            {functions.functions.map(name=><option key={name} value={name}>{name}</option>)}
          </select>
          {!functions.functions.length&&<p>No standalone synchronous functions supported in this file.</p>}
          <details><summary>View source file</summary><pre>{functions.source}</pre></details>
        </>}
      </section>}
      {functions&&fn&&<form className="surface" onSubmit={event=>{event.preventDefault();void action('generate',async()=>{
        const origin=location.hash
        const data=await api<Session>('testing/sessions',{repo,ref:functions.sha,path,function:fn,expected})
        if(location.hash===origin)location.hash='#test-session/'+data.id
      })}}>
        <h2>2. Define the expected behavior</h2>
        <p>Describe the supported inputs and expected result. Include a concrete example for the assertion.</p>
        <label htmlFor="test-expected">Expected behavior</label>
        <textarea id="test-expected" value={expected} minLength={10} maxLength={3000} required disabled={!!busy}
          placeholder="For price 10000 cents and discount 20%, return 8000 cents."
          onChange={event=>setExpected(event.target.value)}/>
        <button className="button" disabled={!!busy||expected.trim().length<10}>Generate pytest test</button>
      </form>}
      <section className="surface"><h2>Saved test sessions</h2>
        {!history.length&&<p>No saved sessions for this repository yet.</p>}
        {history.map(item=><div className="row history-row" key={item.id}><div><strong>{item.function}</strong><p>{item.path} · {new Date(item.created_at).toLocaleString()}</p></div>
          <a className="button secondary" href={'#test-session/'+item.id}>Open test session →</a></div>)}
      </section>
    </>}
    {session&&<>
      <section className="surface"><p className="eyebrow">Saved test session</p><h2>{session.function}</h2>
        <p>{session.path} · Initial revision {session.sha.slice(0,12)}</p>
        {session.runs.length > 0 && <p className="session-verdict"><strong>Latest result: {session.runs[session.runs.length-1].status.toUpperCase()}</strong> · {session.runs.length} saved runs using the same approved test</p>}
        <h3>Expected behavior</h3><p>{session.expected}</p>
        <details><summary>Source used to generate the test</summary><pre>{session.source}</pre></details>
      </section>
      <section className="surface">
        <h2>3. Review generated test</h2><p>{session.scenario}</p>
        <pre>{session.test_code}</pre>
        <p className="muted">Generated by {session.model}. Check that the assertion matches your intended behavior before approving it.</p>
        {!session.approved_at?<button className="button" disabled={!!busy} onClick={()=>void action('approve',async()=>{
          setSession(await api<Session>('testing/sessions/'+session.id+'/approve',{test_hash:session.test_hash}))
        })}>Approve this test</button>:<p className="passed"><strong>Test approved</strong> · {new Date(session.approved_at).toLocaleString()}</p>}
        <details><summary>Saved test identity</summary><p className="hash">{session.test_hash}</p></details>
      </section>
      <form className="surface" onSubmit={event=>{event.preventDefault();void action('run',async()=>{
        setSession(await api<Session>('testing/sessions/'+session.id+'/run',{ref:runRef,test_hash:session.test_hash}))
        window.setTimeout(()=>document.getElementById('execution-evidence')?.scrollIntoView({behavior:'smooth'}),0)
      })}}>
        <h2>4. Run the same test</h2>
        <p>Run against the initial revision, then enter the branch or commit containing your fix. The approved test stays unchanged.</p>
        <label htmlFor="run-ref">Version to run — branch or commit ID</label>
        <div className="row"><input id="run-ref" value={runRef} required disabled={!!busy||session.state==='running'} onChange={event=>setRunRef(event.target.value)}/>
          <button className="button" disabled={!!busy||!session.approved_at||session.state==='running'}>Run approved test</button></div>
        {!session.approved_at&&<p>Review and approve the test above to enable execution.</p>}
        {session.state==='running'&&<p role="status">Run in progress. This page will refresh the saved result automatically.</p>}
        {session.state==='interrupted'&&<p className="error">The last run was interrupted. Retry the same test.</p>}
        {runner&&!runner.ready&&<p className="error">{runner.message}</p>}
      </form>
      <section className="surface" id="execution-evidence">
        <h2>5. Saved execution evidence</h2>
        <p>Passed means the test's assertions held. A failed test may indicate a product bug or an incorrect expectation. Blocked means execution could not complete.</p>
        {!session.runs.length&&<p>No execution evidence yet.</p>}
        {session.runs.map((run,index)=><article className="run-evidence" key={run.id}>
          <div className="row"><h3>Run {index+1} · <span className={run.status==='passed'?'passed':run.status==='failed'?'failed':''}>{run.status.toUpperCase()}</span></h3><span>{run.seconds!==undefined?run.seconds+'s':''}</span></div>
          <p>{run.ref} → <code>{run.sha.slice(0,12)}</code> · {new Date(run.completed_at).toLocaleString()}</p>
          <p className="muted">{run.test_hash===session.test_hash?'Same saved test':'Different test identity'} · Exit code {run.exit_code??'unavailable'}</p>
          <pre>{run.log}</pre>
          <details><summary>Source executed in this run</summary><pre>{run.source}</pre></details>
        </article>)}
      </section>
    </>}
  </div>
}
