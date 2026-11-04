import { useEffect, useState } from 'react'
import { api } from './api'
import type {ExecutionActivity} from './executionTypes'

export type ProjectRun = {
  id:string; session_id:string; status:string; completed_at:string; sha:string;
  summary?:{total:number;passed:number;failed:number;blocked:number;skipped:number;not_run:number}|null;
}
export type ProjectSummary = {
  repo:string; suite_count:number; test_count:number; run_count:number; latest_run:ProjectRun|null;
  suites:{id:string;function:string;path:string;test_count:number;created_at:string}[];
  runs:ProjectRun[];
}
export function ProjectNavigation({repo,active}:{repo:string;active:'overview'|'tests'|'results'|'repository'}) {
  const encoded=encodeURIComponent(repo)
  return <nav className="project-tabs" aria-label="Project navigation">
    <a href={'#project/'+encoded} aria-current={active==='overview'?'page':undefined}>Overview</a>
    <a href={'#testing/'+encoded} aria-current={active==='tests'?'page':undefined}>Tests</a>
    <a href={'#repository-tests/'+encoded} aria-current={active==='repository'?'page':undefined}>Repository tests</a>
    <a href={'#results/'+encoded} aria-current={active==='results'?'page':undefined}>Results</a>
  </nav>
}
export function ProjectHome({repo,results=false}:{repo:string;results?:boolean}) {
  const [data,setData]=useState<ProjectSummary>()
  const [error,setError]=useState('')
  const [repositoryActivity,setRepositoryActivity]=useState<ExecutionActivity>()
  useEffect(()=>{
    let active=true
    setData(undefined);setError('')
    api<ExecutionActivity[]>('executions/activity?repo='+encodeURIComponent(repo)).then(items=>{if(active)setRepositoryActivity(items[0])}).catch(()=>{if(active)setRepositoryActivity(undefined)})
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
        <section className="surface row"><div><p className="eyebrow">Existing project tests</p><h2>Run repository tests</h2><p>Prepare an approved environment and run this project's existing tests. AI generation is not required.</p><p className="muted">First supported profile: Python 3.11 / Linux / pytest. Configure dependencies and inspect saved execution evidence.</p></div><a className="button" href={'#repository-tests/'+encodeURIComponent(repo)}>Run repository tests →</a></section>
        <section className="surface row"><div><p className="eyebrow">Your next step</p><h2>{data.suite_count?'Create or rerun a test suite':'Create your first test suite'}</h2>
          <p>Choose Python code, describe its expected behavior, review generated tests and run them.</p>
          <p className="muted">File suites cover selected functions with same-file helpers and constants. For project imports, dependencies and existing tests, use Repository tests.</p></div>
          <a className="button" href={'#testing/'+encodeURIComponent(repo)}>Create test suite →</a>
        </section>
        <div className="project-metrics">
          <article className="surface"><p>Saved suites</p><strong>{data.suite_count}</strong></article>
          <article className="surface"><p>Tests in saved suites</p><strong>{data.test_count}</strong></article>
          <article className="surface"><p>File test runs</p><strong>{data.run_count}</strong></article>
        </div>
        {repositoryActivity&&<section className="surface"><div className="row"><h2>Repository test activity</h2><a href={'#repository-tests/'+encodeURIComponent(repo)}>Open repository environments →</a></div><p>{repositoryActivity.profile_count} environments · {repositoryActivity.run_count} saved runs</p>{repositoryActivity.latest_run&&<p><strong>{repositoryActivity.latest_run.status.toUpperCase()}</strong> · {repositoryActivity.latest_run.summary?.passed??0} passed · {repositoryActivity.latest_run.summary?.failed??0} failed · <a href={'#execution/'+repositoryActivity.latest_run.profile_id}>Open latest repository report →</a></p>}</section>}
        <section className="surface"><div className="row"><h2>Latest file execution</h2>{data.latest_run&&<a href={'#test-session/'+data.latest_run.session_id}>Open execution evidence →</a>}</div>
          {data.latest_run?<><p><strong className={data.latest_run.status==='passed'?'passed':data.latest_run.status==='failed'?'failed':''}>{data.latest_run.status.toUpperCase()}</strong> · {new Date(data.latest_run.completed_at).toLocaleString()}</p>
            {data.latest_run.summary&&<p>{data.latest_run.summary.passed} passed · {data.latest_run.summary.failed} failed · {data.latest_run.summary.blocked+data.latest_run.summary.skipped+data.latest_run.summary.not_run} incomplete</p>}</>
            :<p>No file test suites have been executed yet. Repository execution appears separately above.</p>}
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
      {results&&<section className="surface"><h2>Execution history</h2><p>Repository tests: {repositoryActivity?.run_count??0} saved runs. <a href={'#repository-tests/'+encodeURIComponent(repo)}>Open repository environments and reports →</a></p><p>Every row is a saved run against a specific code revision. Open evidence to inspect each test.</p>
        {!data.runs.length&&<p>No recorded file test runs yet. <a href={'#testing/'+encodeURIComponent(repo)}>Create a file test suite</a>.</p>}
        {data.runs.map(run=><article className="row history-row" key={run.id}><div><strong className={run.status==='passed'?'passed':run.status==='failed'?'failed':''}>{run.status.toUpperCase()}</strong>
          <p>{new Date(run.completed_at).toLocaleString()} · Revision {run.sha.slice(0,12)}</p>
          {run.summary&&<p>{run.summary.passed} passed · {run.summary.failed} failed · {run.summary.total} tests</p>}</div>
          <a className="button secondary" href={'#test-session/'+run.session_id}>Open execution evidence →</a></article>)}
      </section>}
    </>}
  </div>
}
