import { useEffect, useState } from 'react'
import { api } from './api'

export type ProjectRun = {
  id:string; session_id:string; status:string; completed_at:string; sha:string;
  summary?:{total:number;passed:number;failed:number;blocked:number;skipped:number;not_run:number}|null;
}
export type ProjectSummary = {
  repo:string; suite_count:number; test_count:number; run_count:number; latest_run:ProjectRun|null;
  suites:{id:string;function:string;path:string;test_count:number;created_at:string}[];
  runs:ProjectRun[];
}
export function ProjectNavigation({repo,active}:{repo:string;active:'overview'|'tests'|'results'}) {
  const encoded=encodeURIComponent(repo)
  return <nav className="project-tabs" aria-label="Project navigation">
    <a href={'#project/'+encoded} aria-current={active==='overview'?'page':undefined}>Overview</a>
    <a href={'#testing/'+encoded} aria-current={active==='tests'?'page':undefined}>Tests</a>
    <a href={'#results/'+encoded} aria-current={active==='results'?'page':undefined}>Results</a>
  </nav>
}
export function ProjectHome({repo,results=false}:{repo:string;results?:boolean}) {
  const [data,setData]=useState<ProjectSummary>()
  const [error,setError]=useState('')
  useEffect(()=>{
    let active=true
    setData(undefined);setError('')
    api<ProjectSummary[]>('testing/overview?repo='+encodeURIComponent(repo))
      .then(items=>{if(active)setData(items[0])})
      .catch(failure=>{if(active)setError(failure instanceof Error?failure.message:String(failure))})
    return()=>{active=false}
  },[repo])
  return <div>
    <h2 className="section">{repo}</h2>
    <ProjectNavigation repo={repo} active={results?'results':'overview'}/>
    {error&&<p className="error" role="alert">{error}</p>}
    {!data&&!error&&<p role="status">Loading project activity…</p>}
    {data&&<>
      {!results&&<>
        <section className="surface row"><div><p className="eyebrow">Your next step</p><h2>{data.suite_count?'Create or rerun a test suite':'Create your first test suite'}</h2>
          <p>Choose Python code, describe its expected behavior, review generated tests and run them.</p>
          <p className="muted">Available now: Python file testing with same-file helpers and constants. Select up to five public functions per suite. Cross-file dependencies and repository environments are planned.</p></div>
          <a className="button" href={'#testing/'+encodeURIComponent(repo)}>Create test suite →</a>
        </section>
        <div className="project-metrics">
          <article className="surface"><p>Saved suites</p><strong>{data.suite_count}</strong></article>
          <article className="surface"><p>Tests in saved suites</p><strong>{data.test_count}</strong></article>
          <article className="surface"><p>Recorded runs</p><strong>{data.run_count}</strong></article>
        </div>
        <section className="surface"><div className="row"><h2>Latest execution</h2>{data.latest_run&&<a href={'#test-session/'+data.latest_run.session_id}>Open execution evidence →</a>}</div>
          {data.latest_run?<><p><strong className={data.latest_run.status==='passed'?'passed':data.latest_run.status==='failed'?'failed':''}>{data.latest_run.status.toUpperCase()}</strong> · {new Date(data.latest_run.completed_at).toLocaleString()}</p>
            {data.latest_run.summary&&<p>{data.latest_run.summary.passed} passed · {data.latest_run.summary.failed} failed · {data.latest_run.summary.blocked+data.latest_run.summary.skipped+data.latest_run.summary.not_run} incomplete</p>}</>
            :<p>No tests have been executed yet. Create and approve a suite to record evidence.</p>}
        </section>
        <section className="surface"><h2>Saved test suites</h2>
          {!data.suites.length&&<p>No saved suites yet.</p>}
          {data.suites.map(suite=><div className="row history-row" key={suite.id}><div><strong>{suite.function}</strong><p>{suite.path} · {suite.test_count} tests · {new Date(suite.created_at).toLocaleString()}</p></div>
            <a className="button secondary" href={'#test-session/'+suite.id}>Open suite →</a></div>)}
        </section>
        <details className="surface"><summary>Additional tool: AI code review</summary><p>Review a pull request for potential issues. Code review findings are separate from executed test evidence.</p>
          <div className="row"><a href={'#pulls/'+encodeURIComponent(repo)}>Choose a pull request →</a><a href={'#history/'+encodeURIComponent(repo)}>Saved code reviews →</a></div>
        </details>
      </>}
      {results&&<section className="surface"><h2>Execution history</h2><p>Every row is a saved run against a specific code revision. Open evidence to inspect each test.</p>
        {!data.runs.length&&<p>No recorded runs yet. <a href={'#testing/'+encodeURIComponent(repo)}>Create your first test suite</a>.</p>}
        {data.runs.map(run=><article className="row history-row" key={run.id}><div><strong className={run.status==='passed'?'passed':run.status==='failed'?'failed':''}>{run.status.toUpperCase()}</strong>
          <p>{new Date(run.completed_at).toLocaleString()} · Revision {run.sha.slice(0,12)}</p>
          {run.summary&&<p>{run.summary.passed} passed · {run.summary.failed} failed · {run.summary.total} tests</p>}</div>
          <a className="button secondary" href={'#test-session/'+run.session_id}>Open execution evidence →</a></article>)}
      </section>}
    </>}
  </div>
}
