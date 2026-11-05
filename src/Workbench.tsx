import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { ProjectNavigation, ProjectTestNavigation } from './ProjectHome'

type TestEvidence = {name:string; status:'passed'|'failed'|'blocked'|'skipped'|'not_run'; detail:string; seconds:number}
type TestCase = {name:string;scenario:string}
type Run = {
  id:string; exit_code:number|null; status:'passed'|'failed'|'blocked'; sha:string; ref:string;
  tests?:TestEvidence[]; summary?:{total:number;passed:number;failed:number;blocked:number;skipped:number;not_run:number};
  log:string; source:string; seconds?:number; test_hash:string; completed_at:string;
}
type Session = {
  id:string; repo:string; state:string; path:string; function:string; expected:string;
  source:string; sha:string; test_code:string; test_hash:string; scenario:string;
  approved_at:string|null; runs:Run[]; model:string; tests?:TestCase[];
  mode?:'file'|'function'; functions?:string[]; module_name?:string;
}
type History = {test_count?:number; id:string; path:string; function:string; created_at:string}
type Files = {sha:string; files:string[]}
type Functions = {sha:string; source:string; functions:string[]; module_name:string}

export function Workbench({repo,sessionId,focusRunId}:{repo?:string;sessionId?:string;focusRunId?:string}) {
  const [session,setSession] = useState<Session>()
  const [history,setHistory] = useState<History[]>([])
  const [branches,setBranches] = useState<string[]>([])
  const [ref,setRef] = useState('')
  const [files,setFiles] = useState<Files>()
  const [path,setPath] = useState('')
  const [functions,setFunctions] = useState<Functions>()
  const [fn,setFn] = useState('')
  const [selected,setSelected] = useState<string[]>([])
  const [expected,setExpected] = useState('')
  const [runRef,setRunRef] = useState('')
  const [busy,setBusy] = useState('')
  const [error,setError] = useState('')
  const [runner,setRunner] = useState<{ready:boolean;message:string}>()
  const [initializing,setInitializing] = useState(true)
  const [loadVersion,setLoadVersion]=useState(0)
  const operation=useRef(false)
  useEffect(()=>{
    if(!focusRunId||!session?.runs.some(run=>run.id===focusRunId))return
    const timer=setTimeout(()=>document.getElementById('run-'+focusRunId)?.scrollIntoView({block:'start'}),0)
    return()=>clearTimeout(timer)
  },[focusRunId,session?.id])

  useEffect(() => {
    let active=true
    setInitializing(true);setError('')
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
            else setError(current=>(current?current+' ':'')+'Saved focused-file sessions could not be loaded. Retry to restore the complete history.')
          }
        }
        const status=await api<{ready:boolean;message:string}>('testing/runner')
        if(active)setRunner(status)
      }catch(failure){if(active)setError(failure instanceof Error?failure.message:String(failure))}
      finally{if(active)setInitializing(false)}
    }
    void load()
    return()=>{active=false}
  },[repo,sessionId,loadVersion])

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
    if(operation.current)return
    operation.current=true
    setBusy(name);setError('')
    try{await work()}catch(failure){setError(failure instanceof Error?failure.message:String(failure))}
    finally{operation.current=false;setBusy('')}
  }

  if(initializing)return <p role="status">Loading testing workspace…</p>
  const activeRepo=repo||session?.repo
  const testCount=session?.tests?.length||1
  const isSuite=testCount>1
  const latest=session?.runs.at(-1)
  return <div className="testing-workspace">
    <p className="page-help">{session?(session.mode!=='file'?'This saved session uses the earlier standalone-function runner. Its approved tests and evidence are preserved.':'Review this saved file test suite, run it against a selected revision, then rerun the same tests after your fix. Results are saved below.'):'Test a Python file in context: choose up to five public functions, define expected behavior, review 3–5 generated tests and run them against the original module.'}</p>
    {activeRepo&&<><a href={'#project/'+encodeURIComponent(activeRepo)}>{activeRepo}</a><ProjectNavigation repo={activeRepo} active={session?.runs.length?'runs':'tests'}/>{!session&&<><ProjectTestNavigation repo={activeRepo} active="generated"/><p className="muted">Focused file suites use a separate limited environment. Use repository testing for project imports and dependencies.</p></>}</>}
    {error&&<p className="error" role="alert">{error}</p>}
    {error&&<button className="button secondary" disabled={!!busy} onClick={()=>setLoadVersion(v=>v+1)}>Retry focused workspace</button>}
    {busy&&<p className="progress" role="status">{busy==='generate'?'Gemma is generating your test. This may take a few minutes.':busy==='run'?'Running the approved test in Docker…':'Loading…'}</p>}
    {!session&&repo&&<>
      <form className="surface" onSubmit={event=>{event.preventDefault();void action('files',async()=>{
        setFunctions(undefined);setFn('');setPath('')
        setFiles(await api<Files>('testing/files?repo='+encodeURIComponent(repo)+'&ref='+encodeURIComponent(ref)))
      })}}>
        <h2>1. Select code</h2>
        <p>The full file is executed with its helpers, constants and supported standard-library imports. For cross-file imports, package initializers and external dependencies, use the repository environment under Existing tests.</p>
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
          setFunctions(data);setFn(data.functions[0]||'');setSelected(data.functions.slice(0,5))
        })}>Inspect file</button>
        {functions&&<>
          <fieldset disabled={!!busy}><legend>Functions to cover · {selected.length}/5 selected</legend>
            {functions.functions.map(name=><label className="function-choice" key={name}><input type="checkbox" checked={selected.includes(name)}
              disabled={!selected.includes(name)&&selected.length>=5}
              onChange={event=>setSelected(current=>event.target.checked?[...current,name]:current.filter(item=>item!==name))}/>{name}</label>)}
          </fieldset>
          <p className="muted">Module: {functions.module_name}. Helpers and constants remain in the source file. The suite covers your selected functions, not every possible behavior in the file.</p>
          {!functions.functions.length&&<p>No public synchronous functions without decorators are available in this file.</p>}
          <details><summary>View source file</summary><pre>{functions.source}</pre></details>
        </>}
      </section>}
      {functions&&fn&&selected.length>0&&<form className="surface" onSubmit={event=>{event.preventDefault();void action('generate',async()=>{
        const origin=location.hash
        const data=await api<Session>('testing/sessions',{repo,ref:functions.sha,path,function:selected[0],functions:selected,mode:'file',expected})
        if(location.hash===origin)location.hash='#test-session/'+data.id
      })}}>
        <h2>2. Define the expected behavior</h2>
        <p>Describe the expected behavior of every selected function, including supported inputs and boundary values. Gemma will propose 3–5 tests across this selection.</p>
        <label htmlFor="test-expected">Expected behavior</label>
        <textarea id="test-expected" value={expected} minLength={10} maxLength={3000} required disabled={!!busy}
          placeholder="For price 10000 cents and discount 20%, return 8000 cents."
          onChange={event=>setExpected(event.target.value)}/>
        <button className="button" disabled={!!busy||expected.trim().length<10}>Generate 3–5 pytest tests</button>
      </form>}
      <section className="surface"><h2>Saved test sessions</h2>
        {!history.length&&<p>No saved sessions for this repository yet.</p>}
        {history.map(item=><div className="row history-row" key={item.id}><div><strong>{item.function}</strong><p>{item.path} · {item.test_count??1} tests · {new Date(item.created_at).toLocaleString()}</p></div>
          <a className="button secondary" href={'#test-session/'+item.id}>Open test session →</a></div>)}
      </section>
    </>}
    {session&&<>
      <section className="surface"><p className="eyebrow">Saved test session</p><h2>{session.function}</h2>
        <p>{session.path} · {session.mode==='file'?'Original file context':'Legacy standalone function'} · Initial revision {session.sha.slice(0,12)}</p>
        {session.runs.length > 0 && <p className="session-verdict"><strong>Latest result: {session.runs[session.runs.length-1].status.toUpperCase()}</strong> · {session.runs.length} saved runs using the same approved {isSuite?'suite':'test'}</p>}
        {latest?.summary&&<div className="suite-counts"><strong>Latest run</strong><span className="passed">{latest.summary.passed} passed</span><span className="failed">{latest.summary.failed} failed</span><span>{latest.summary.blocked+latest.summary.skipped+latest.summary.not_run} incomplete</span>
          <button className="button secondary" onClick={()=>document.getElementById('run-'+(session.runs.at(-1)?.id||''))?.scrollIntoView({block:'start'})}>View per-test results ↓</button></div>}
        <h3>Expected behavior</h3><p>{session.expected}</p>
        <details><summary>Source used to generate the test</summary><pre>{session.source}</pre></details>
      </section>
      <section className="surface">
        <h2>3. Review generated {isSuite?'tests':'test'} · {testCount} {testCount===1?'test':'tests'}</h2>
        <p>Check the scenarios below and verify each expected result before approving the code.</p>
        <details><summary>Model's suite summary</summary><p>{session.scenario}</p></details>
        {isSuite&&<ol className="suite-plan">{session.tests?.map(test=><li key={test.name}><strong>{test.name}</strong><p>{test.scenario}</p></li>)}</ol>}
        <h3>Code to approve</h3>
        <pre>{session.test_code}</pre>
        <p className="muted">Generated by {session.model}. Check that every assertion matches your intended behavior before approving the saved code.</p>
        {!session.approved_at?<button className="button" disabled={!!busy} onClick={()=>void action('approve',async()=>{
          setSession(await api<Session>('testing/sessions/'+session.id+'/approve',{test_hash:session.test_hash}))
        })}>{isSuite?'Approve all '+testCount+' tests':'Approve this test'}</button>:<p className="passed"><strong>{isSuite?'Test suite approved':'Test approved'}</strong> · {new Date(session.approved_at).toLocaleString()}</p>}
        <details><summary>Saved {isSuite?'suite':'test'} identity</summary><p className="hash">{session.test_hash}</p></details>
      </section>
      <form className="surface" onSubmit={event=>{event.preventDefault();void action('run',async()=>{
        const updated=await api<Session>('testing/sessions/'+session.id+'/run',{ref:runRef,test_hash:session.test_hash})
        setSession(updated)
        const latest=updated.runs.at(-1);if(latest)location.hash='#test-session/'+updated.id+'/'+latest.id
      })}}>
        <h2>4. Run the same {isSuite?'test suite':'test'}</h2>
        <p>Run against the initial revision, then enter the branch or commit containing your fix. The approved code stays unchanged across runs.</p>
        <label htmlFor="run-ref">Version to run — branch or commit ID</label>
        <div className="row"><input id="run-ref" value={runRef} required disabled={!!busy||session.state==='running'} onChange={event=>setRunRef(event.target.value)}/>
          <button className="button" disabled={!!busy||!session.approved_at||session.state==='running'}>{isSuite?'Run all tests':'Run approved test'}</button></div>
        {!session.approved_at&&<p>Review and approve all generated tests above to enable execution.</p>}
        {session.state==='running'&&<p role="status">Run in progress. This page will refresh the saved result automatically.</p>}
        {session.state==='interrupted'&&<p className="error">The last run was interrupted. Retry the same saved test code.</p>}
        {runner&&!runner.ready&&<p className="error">{runner.message}</p>}
      </form>
      <section className="surface" id="execution-evidence">
        <h2>5. Saved execution evidence</h2>
        <p>Passed means the test's assertions held. A failed test may indicate a product bug or an incorrect expectation. Blocked means execution could not complete.</p>
        {!session.runs.length&&<p>No execution evidence yet.</p>}
        {session.runs.map((run,index)=><article className="run-evidence" id={'run-'+run.id} key={run.id}>
          <div className="row"><h3>Run {index+1} · <span className={run.status==='passed'?'passed':run.status==='failed'?'failed':''}>{run.status.toUpperCase()}</span></h3><span>{run.seconds!==undefined?run.seconds+'s':''}</span></div>
          <p>{run.ref} → <code>{run.sha.slice(0,12)}</code> · {new Date(run.completed_at).toLocaleString()}</p>
          <p className="muted">{run.test_hash===session.test_hash?'Same saved '+(isSuite?'suite':'test'):'Different test identity'} · Exit code {run.exit_code??'unavailable'}</p>
          {run.summary&&<p className="suite-counts"><strong>{run.summary.total} tests</strong><span className="passed">{run.summary.passed} passed</span><span className="failed">{run.summary.failed} failed</span><span>{run.summary.blocked} blocked · {run.summary.skipped} skipped · {run.summary.not_run} not run</span></p>}
          {run.tests?.map(test=><details className="test-result" key={test.name} open={test.status!=='passed'}>
            <summary><strong className={test.status==='passed'?'passed':test.status==='failed'?'failed':''}>{test.status.replace('_',' ').toUpperCase()}</strong> · {test.name} · {test.seconds}s</summary>
            <p>{session.tests?.find(item=>item.name===test.name)?.scenario}</p>
            <pre>{test.detail}</pre>
          </details>)}
          {!run.tests&&<p className="muted">Per-test evidence was not recorded for this earlier run. The original output is preserved below.</p>}
          <details><summary>Full pytest output</summary><pre>{run.log}</pre></details>
          <details><summary>Source executed in this run</summary><pre>{run.source}</pre></details>
        </article>)}
      </section>
    </>}
  </div>
}
