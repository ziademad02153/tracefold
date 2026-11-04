import {useEffect,useState} from 'react'
import {api} from './api'
import {ProjectNavigation,type ProjectSummary} from './ProjectHome'
import type {ExecutionProfile} from './executionTypes'

type Row={key:string;kind:string;status:string;date:string;revision:string;passed?:number;failed?:number;total?:number;href:string}

export function ProjectRuns({repo}:{repo:string}){
  const [rows,setRows]=useState<Row[]>([])
  const [errors,setErrors]=useState<string[]>([])
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    let active=true
    async function load(){
      const results=await Promise.allSettled([
        api<ProjectSummary[]>('testing/overview?repo='+encodeURIComponent(repo)),
        api<ExecutionProfile[]>('executions/profiles?repo='+encodeURIComponent(repo)),
      ])
      if(!active)return
      const merged:Row[]=[];const failures:string[]=[]
      if(results[0].status==='fulfilled'){
        for(const run of results[0].value[0]?.runs||[])merged.push({key:'generated:'+run.id,kind:'Generated suite',status:run.status,date:run.completed_at,revision:run.sha,passed:run.summary?.passed,failed:run.summary?.failed,total:run.summary?.total,href:'#test-session/'+run.session_id+'/'+run.id})
      }else failures.push('Generated-suite history could not be loaded. The list below may be incomplete.')
      if(results[1].status==='fulfilled'){
        for(const profile of results[1].value)for(const run of profile.runs)merged.push({key:'repository:'+run.id,kind:'Existing repository tests',status:run.status,date:run.completed_at,revision:profile.source.revision,passed:run.summary?.passed,failed:run.summary?.failed,total:run.summary?.total,href:'#execution/'+profile.id+'/'+run.id})
      }else failures.push('Repository execution history could not be loaded. The list below may be incomplete.')
      merged.sort((a,b)=>b.date.localeCompare(a.date))
      setRows(merged);setErrors(failures);setLoading(false)
    }
    void load();return()=>{active=false}
  },[repo])
  return <div><h2 className="section">{repo}</h2><ProjectNavigation repo={repo} active="runs"/>
    <p className="page-help">Every row is one saved execution. Open its report to inspect the tests and evidence. Repeated runs can execute the same tests; the row count is not a count of unique tests.</p>
    {loading&&<p role="status">Loading saved runs…</p>}{errors.map(message=><p className="error" role="alert" key={message}>{message}</p>)}
    {!loading&&!rows.length&&!errors.length&&<section className="surface"><h2>No runs yet</h2><p>Open Tests to prepare an environment or review a generated suite before running it.</p><a className="button" href={'#tests/'+encodeURIComponent(repo)}>Open Tests →</a></section>}
    {rows.map(run=><article className="surface row" key={run.key}><div><p className="eyebrow">{run.kind}</p><h2 className={run.status==='passed'?'passed':run.status==='failed'?'failed':''}>{run.status.replaceAll('_',' ').toUpperCase()}</h2><p>{new Date(run.date).toLocaleString()} · Revision {run.revision.slice(0,12)}</p>{run.total!==undefined?<p>{run.total} tests · {run.passed??0} passed · {run.failed??0} failed</p>:<p>Test counts were not recorded for this run.</p>}</div><a className="button secondary" href={run.href}>Open run report →</a></article>)}
  </div>
}
