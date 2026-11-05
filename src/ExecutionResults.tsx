import {useEffect,useState} from 'react'
import type {ExecutionProfile} from './executionTypes'
import {StatusBadge,statusText,timeLabel,showRun} from './executionUi'
import {downloadText} from './download'

function caseName(id:string){return (id.split('::').at(-1)||id).replace(/^test_/,'').replaceAll('_',' ')}
export function ExecutionResults({profile,runId}:{profile:ExecutionProfile;runId?:string}){
  const run=runId?profile.runs.find(r=>r.id===runId):profile.runs.at(-1)
  const [filter,setFilter]=useState('all')
  const [search,setSearch]=useState(''),[limit,setLimit]=useState(50)
  useEffect(()=>{setLimit(50)},[search,filter,run?.id])
  useEffect(()=>{setFilter(run?.tests.some(t=>t.status!=='passed')?'attention':'all');if(runId&&run)document.getElementById('run-'+run.id)?.scrollIntoView({block:'start'})},[run?.id,runId])
  if(!run)return <section className="surface empty-state"><h2>{runId?'Execution not found':'No execution results yet'}</h2><p>{runId?'This execution does not belong to this environment. Open its latest saved result or return to tests.':'Run the existing tests or an approved generated suite to create evidence.'}</p>{profile.runs.length>0&&<a href={'#execution/'+profile.id+'/'+profile.runs.at(-1)!.id}>Open latest result →</a>} <a href={'#execution/'+profile.id}>Return to existing tests →</a></section>
  const summary=run.summary,attention=run.tests.filter(t=>t.status!=='passed')
  const filtered=run.tests.filter(t=>(filter==='all'||(filter==='attention'?t.status!=='passed':t.status==='passed'))&&t.id.toLowerCase().includes(search.toLowerCase()))
  const visible=filtered.slice(0,limit)
  const index=profile.runs.findIndex(r=>r.id===run.id)+1
  return <section id="repository-evidence" className="results-workspace">
    <article className="surface run-evidence result-overview" id={'run-'+run.id}>
      <div className="section-heading"><div><p className="eyebrow">{run.id===profile.runs.at(-1)?.id?'Latest execution':'Saved execution'} · {run.suite_id?'Existing + approved tests':'Existing tests'}</p><h2>Repository run {index} · {statusText(run.status).toUpperCase()}</h2></div><StatusBadge status={run.status}/></div>
      <p className="verdict">{run.status==='passed'?(run.tests.every(t=>t.status==='passed')?`All ${summary?.total??run.tests.length} collected tests passed.`:`Execution succeeded with ${summary?.passed??run.tests.filter(t=>t.status==='passed').length} passed cases and other outcomes. Review skipped and expected-failure cases below.`):run.status==='failed'?((summary?.failed??0)>0?`${summary!.failed} tests failed. Inspect the assertions below.`:'Execution failed without a recorded failed assertion. Inspect errors, other outcomes and diagnostics below.'):run.status==='blocked'?'Execution could not complete. Review the diagnostics below.':'Execution completed with cases that need review.'}</p>
      <p>{timeLabel(run.completed_at)} · Source {profile.source.revision.slice(0,12)}</p>
      {summary&&<div className="result-metrics"><div><strong>{summary.total}</strong><span>collected cases</span></div><div className="passed"><strong>{summary.passed}</strong><span>passed</span></div><div className={summary.failed?'failed':''}><strong>{summary.failed}</strong><span>failed</span></div><div><strong>{(summary.error||0)+(summary.not_run||0)+(summary.skipped||0)+(summary.xfailed||0)+(summary.xpassed||0)}</strong><span>other outcomes</span></div></div>}
      {run.error&&<p className="error" role="alert">{run.error}</p>}
      {run.baseline_empty&&<p className="notice">No existing tests were collected. This run verifies only the approved generated cases.</p>}
      {run.suite_id&&<p className="provenance">{run.tests.filter(t=>t.origin==='existing').length} existing cases · {run.tests.filter(t=>t.origin==='generated').length} generated cases · separate phases in the recorded environment</p>}
      <p className="muted">These are test outcomes, not a count of independent defects or a guarantee about untested code.</p>
      <div className="action-group"><button className="button secondary" onClick={()=>downloadText('tracefold-run-'+run.id+'.json',JSON.stringify({repo:profile.repo,source:profile.source,run},null,2),'application/json')}>Download execution report</button>{run.suite_id?<a className="button secondary" href={'#execution/'+profile.id+'/generate/'+run.suite_id}>Open approved tests & verify a fix →</a>:<a className="button secondary" href={'#execution/'+profile.id}>Back to existing tests →</a>}</div>
    </article>
    {run.comparison&&<section className="surface comparison-panel"><div className="section-heading"><div><p className="eyebrow">Repair verification</p><h2>Same-suite comparison</h2></div><span className="badge">Unchanged approved tests</span></div><p>{run.comparison.complete?'Both executions completed':'Comparison includes an incomplete execution'} · {run.comparison.source_changed?'Source revision changed':'Same source revision'} · {run.comparison.same_environment?'Same environment':'Environment changed'}</p>
      {run.comparison.changes.length?<div className="comparison-list">{run.comparison.changes.map(c=><div key={c.id}><strong>{caseName(c.id)}</strong><span><StatusBadge status={c.before}/> → <StatusBadge status={c.after}/></span></div>)}</div>:<p>No generated case outcomes changed.</p>}
      <p>{run.comparison.added.length} generated cases added · {run.comparison.removed.length} removed{run.comparison.existing_inventory&&` · Existing inventory: ${run.comparison.existing_inventory.added.length} added / ${run.comparison.existing_inventory.removed.length} removed`}</p>
    </section>}
    <section className="surface"><div className="section-heading"><div><p className="eyebrow">Per-test evidence</p><h2>Test results</h2></div><label className="compact-label">Show cases<select aria-label="Filter test results" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All cases ({run.tests.length})</option><option value="attention">Needs review ({attention.length})</option><option value="passed">Passed ({run.tests.length-attention.length})</option></select></label></div>
      <label htmlFor="case-search">Find a test</label><input id="case-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search case name or file path"/><p className="field-help" role="status">Showing {visible.length} of {filtered.length} matching cases</p>
      {!visible.length&&<p className="empty-state">No cases match this filter. Choose All cases to view the execution inventory.</p>}
      {visible.map(test=><details className="test-result" key={test.id} open={test.status!=='passed'}><summary><StatusBadge status={test.status}/><strong>{caseName(test.id)}</strong><span className="case-origin">{test.origin||'existing'} · {test.seconds??0}s</span></summary><p className="location">{test.id}</p><pre>{test.detail||'Assertions completed.'}</pre></details>)}
      {visible.length<filtered.length&&<button className="button secondary" onClick={()=>setLimit(v=>v+50)}>Show more test cases</button>}
    </section>
    {profile.runs.length>1&&<section className="surface"><label htmlFor="saved-run-picker">Saved execution</label><select id="saved-run-picker" value={run.id} onChange={e=>showRun(profile.id,e.target.value)}>{[...profile.runs].reverse().map(r=><option key={r.id} value={r.id}>{timeLabel(r.completed_at)} · {statusText(r.status)} · {r.suite_id?'Existing + generated':'Existing tests'} · {r.id.slice(0,8)}</option>)}</select></section>}
    <details className="surface execution-diagnostics"><summary>Execution details and native artifacts</summary><p className="hash">Source {profile.source.revision}</p><p className="hash">Profile {run.profile_hash}</p><p className="hash">Environment {run.environment_id}</p>{run.suite_hash&&<p className="hash">Approved suite SHA256 {run.suite_hash}</p>}<p>{run.environment_id===profile.environment?.id?'Matches the prepared environment':'A different environment is now prepared; this report retains its original identity.'}</p>
      <details><summary>Effective test configuration</summary><pre>{JSON.stringify(run.effective_config,null,2)}</pre></details>
      {!!run.collection_errors?.length&&<details open><summary>Collection errors</summary><pre>{JSON.stringify(run.collection_errors,null,2)}</pre></details>}
      {!!run.collection_skips?.length&&<details><summary>Collection skips</summary><pre>{JSON.stringify(run.collection_skips,null,2)}</pre></details>}
      <details><summary>Execution output</summary><pre>{run.log||'No additional output.'}</pre></details>
      {run.artifacts?.map(a=><details key={a.name}><summary>{a.name} · {a.media_type}</summary><p className="hash">SHA256 {a.sha256}</p><pre>{a.content}</pre></details>)}
    </details>
  </section>
}
