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
export function ProjectNavigation({repo,active}:{repo:string;active:'overview'|'tests'|'runs'|'ai-review'}) {
  const encoded=encodeURIComponent(repo)
  return <nav className="project-tabs" aria-label="Project navigation">
    <a href={'#project/'+encoded} aria-current={active==='overview'?'page':undefined}>Overview</a>
    <a href={'#tests/'+encoded} aria-current={active==='tests'?'page':undefined}>Tests</a>
    <a href={'#runs/'+encoded} aria-current={active==='runs'?'page':undefined}>Runs</a>
    <a href={'#ai-review/'+encoded} aria-current={active==='ai-review'?'page':undefined}>AI Review</a>
  </nav>
}
export function ProjectTestNavigation({repo,active}:{repo:string;active:'existing'|'generated'}){
  const encoded=encodeURIComponent(repo)
  return <nav className="test-tabs" aria-label="Test type">
    <a href={'#tests/'+encoded} aria-current={active==='existing'?'page':undefined}>Existing tests</a>
    <a href={'#generated/'+encoded} aria-current={active==='generated'?'page':undefined}>Generated tests</a>
  </nav>
}
export function ProjectHome({repo}:{repo:string}) {
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
    <ProjectNavigation repo={repo} active="overview"/>
    {error&&<p className="error" role="alert">{error}</p>}
    {!data&&!error&&<p role="status">Loading project activity…</p>}
    {data&&<>
      <>
        <section className="surface row"><div><p className="eyebrow">Your project workspace</p><h2>Test this project and keep the evidence</h2><p>Inside Tests, run the project's existing tests or generate a focused suite for a supported source file. Open Runs to inspect saved results and verify a repair.</p></div><a className="button" href={'#tests/'+encodeURIComponent(repo)}>Open Tests →</a></section>
        <div className="project-metrics">
          <article className="surface"><p>Earlier file suites</p><strong>{data.suite_count}</strong></article>
          <article className="surface"><p>Tests in earlier file suites</p><strong>{data.test_count}</strong></article>
          <article className="surface"><p>Earlier file test runs</p><strong>{data.run_count}</strong></article>
        </div>
        {repositoryActivity&&<section className="surface"><div className="row"><h2>Repository test activity</h2><a href={'#tests/'+encodeURIComponent(repo)}>Open test environments →</a></div><p>{repositoryActivity.suite_count??0} repository suites · {repositoryActivity.profile_count} saved configurations · {repositoryActivity.run_count} saved runs</p>{repositoryActivity.latest_run&&<p><strong>{repositoryActivity.latest_run.status.toUpperCase()}</strong> · {repositoryActivity.latest_run.summary?.passed??0} passed · {repositoryActivity.latest_run.summary?.failed??0} failed · <a href={'#execution/'+repositoryActivity.latest_run.profile_id}>Open latest repository report →</a></p>}</section>}
        <section className="surface"><div className="row"><h2>Latest file execution</h2>{data.latest_run&&<a href={'#test-session/'+data.latest_run.session_id}>Open execution evidence →</a>}</div>
          {data.latest_run?<><p><strong className={data.latest_run.status==='passed'?'passed':data.latest_run.status==='failed'?'failed':''}>{data.latest_run.status.toUpperCase()}</strong> · {new Date(data.latest_run.completed_at).toLocaleString()}</p>
            {data.latest_run.summary&&<p>{data.latest_run.summary.passed} passed · {data.latest_run.summary.failed} failed · {data.latest_run.summary.blocked+data.latest_run.summary.skipped+data.latest_run.summary.not_run} incomplete</p>}</>
            :<p>No file test suites have been executed yet. Repository execution appears separately above.</p>}
        </section>
      </>
    </>}
  </div>
}
