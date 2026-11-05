import {useEffect,useState} from 'react'
import {api} from './api'
import type {ExecutionActivity} from './executionTypes'
import {StatusBadge,timeLabel} from './executionUi'
import {ProjectOnboarding,ProjectOrientation} from './ProjectOnboarding'

export type ProjectRun={id:string;session_id:string;status:string;completed_at:string;sha:string;summary?:{total:number;passed:number;failed:number;blocked:number;skipped:number;not_run:number}|null}
export type ProjectSummary={repo:string;suite_count:number;test_count:number;run_count:number;latest_run:ProjectRun|null;suites:{id:string;function:string;path:string;test_count:number;created_at:string}[];runs:ProjectRun[]}
export function ProjectNavigation({repo,active}:{repo:string;active:'overview'|'tests'|'runs'|'ai-review'}){
  const encoded=encodeURIComponent(repo)
  return <><nav className="project-tabs" aria-label="Project navigation">{[['overview','Overview','project'],['tests','Tests','tests'],['runs','Runs','runs'],['ai-review','AI Review','ai-review']].map(([key,label,route])=><a key={key} href={'#'+route+'/'+encoded} aria-current={active===key?'page':undefined}>{label}</a>)}</nav>{active!=='overview'&&<ProjectOrientation repo={repo} area={active}/>}</>
}
export function ProjectTestNavigation({repo,active}:{repo:string;active:'existing'|'generated'}){
  return <nav className="test-tabs" aria-label="Test type"><a href={'#tests/'+encodeURIComponent(repo)} aria-current={active==='existing'?'page':undefined}>Existing tests</a><a href={'#generated/'+encodeURIComponent(repo)} aria-current={active==='generated'?'page':undefined}>Generated tests</a></nav>
}
export function ProjectHome({repo}:{repo:string}){
  const [activity,setActivity]=useState<ExecutionActivity>()
  const [legacy,setLegacy]=useState<ProjectSummary>()
  const [loading,setLoading]=useState(true)
  const [errors,setErrors]=useState<string[]>([])
  const [version,setVersion]=useState(0)
  useEffect(()=>{
    let active=true;setLoading(true);setErrors([])
    Promise.allSettled([api<ExecutionActivity[]>('executions/activity?repo='+encodeURIComponent(repo)),api<ProjectSummary[]>('testing/overview?repo='+encodeURIComponent(repo))]).then(([current,earlier])=>{
      if(!active)return
      const messages=[]
      if(current.status==='fulfilled')setActivity(current.value[0]||{repo,profile_count:0,run_count:0,suite_count:0,latest_run:null})
      else{setActivity(undefined);messages.push('Repository activity could not be loaded. Counts and the latest result are unavailable.')}
      if(earlier.status==='fulfilled')setLegacy(earlier.value[0]);else{setLegacy(undefined);messages.push('Focused-file history could not be loaded. Repository activity is shown separately.')}
      setErrors(messages);setLoading(false)
    });return()=>{active=false}
  },[repo,version])
  const encoded=encodeURIComponent(repo),latest=activity?.latest_run
  return <div className="project-home">
    <div className="project-identity"><span className="eyebrow">Project</span><h2>{repo}</h2><p>Repository testing · Python / pytest execution</p></div>
    <ProjectNavigation repo={repo} active="overview"/>
    {loading&&<p role="status">Loading project activity…</p>}
    {!!errors.length&&<div className="error" role="alert">{errors.map(e=><p key={e}>{e}</p>)}<button className="button secondary" disabled={loading} onClick={()=>setVersion(v=>v+1)}>Retry activity</button></div>}
    <ProjectOnboarding repo={repo}/>
    {activity&&<>
      <div className="project-metrics"><article><p>Saved repository suites</p><strong>{activity.suite_count??0}</strong></article><article><p>Test runs</p><strong>{activity.run_count}</strong></article><article><p>Environments</p><strong>{activity.profile_count}</strong></article></div>
      <section className="surface latest-project-result"><div className="section-heading"><div><p className="eyebrow">Repository test activity</p><h2>Latest execution</h2></div>{latest&&<StatusBadge status={latest.status}/>}</div>
        {latest?<><p className="result-numbers"><strong>{latest.summary?.passed??'—'}</strong> passed <span>·</span> <strong>{latest.summary?.failed??'—'}</strong> failed</p><p>{timeLabel(latest.completed_at)} · Results apply to collected cases, not all code.</p><a className="button secondary" href={'#execution/'+latest.profile_id+'/'+latest.id}>Open latest repository report →</a></>:<div className="empty-state"><p>No repository tests have been run yet. Prepare an environment in Tests to create the first baseline.</p><a href={'#tests/'+encoded}>Set up repository tests →</a></div>}
      </section>
    </>}
    <details className="surface legacy-tools"><summary>Focused file tools and earlier history</summary><p>These limited file-only tools use a separate environment. Their results are not part of repository runs.</p>{legacy&&<p>{legacy.suite_count} file suites · {legacy.run_count} file runs</p>}<div className="action-group"><a href={'#testing/'+encoded}>Open focused file testing →</a>{legacy?.latest_run&&<a href={'#test-session/'+legacy.latest_run.session_id+'/'+legacy.latest_run.id}>Open latest focused-file result →</a>}</div></details>
  </div>
}
