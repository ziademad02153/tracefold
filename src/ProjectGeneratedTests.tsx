import {useEffect,useState} from 'react'
import {api} from './api'
import {ProjectNavigation,ProjectTestNavigation} from './ProjectHome'
import type {ExecutionProfile,RepositorySuite} from './executionTypes'
export function ProjectGeneratedTests({repo}:{repo:string}){
  const [profiles,setProfiles]=useState<ExecutionProfile[]>()
  const [suites,setSuites]=useState<RepositorySuite[]>([])
  const [error,setError]=useState('')
  useEffect(()=>{let active=true;Promise.all([api<ExecutionProfile[]>('executions/profiles?repo='+encodeURIComponent(repo)),api<RepositorySuite[]>('executions/suites?repo='+encodeURIComponent(repo))]).then(([p,s])=>{if(active){setProfiles(p.reverse());setSuites(s.reverse())}}).catch(f=>{if(active)setError(String(f))});return()=>{active=false}},[repo])
  return <><h2>{repo}</h2><ProjectNavigation repo={repo} active="tests"/><ProjectTestNavigation repo={repo} active="generated"/>
    <p className="page-help">Generate tests using the real project's source, imports and installed dependencies. Review and approve a saved suite before executing it. Re-use that same suite after a repair.</p>
    {error&&<p role="alert" className="error">{error}</p>}{!profiles&&!error&&<p role="status">Loading environments and suites…</p>}
    <section className="surface"><h2>Choose an execution environment</h2><p>Every generated suite belongs to a recorded repository revision. The environment must be prepared before generation.</p>
      {profiles?.map(p=><article className="row history-row" key={p.id}><div><strong>{p.source.revision.slice(0,12)} · {p.provider_id}</strong><p>{p.state} · {p.runs.length} saved runs</p></div><a className="button" href={'#execution/'+p.id+'/generate'}>{p.environment?'Generate or run saved tests':'Prepare environment'} →</a></article>)}
      {!profiles?.length&&profiles&&<a className="button" href={'#tests/'+encodeURIComponent(repo)}>Set up repository environment →</a>}
    </section>
    <section className="surface"><h2>Saved repository suites · {suites.length}</h2>{!suites.length&&<p>No repository suites generated yet.</p>}{suites.map(s=><article className="row history-row" key={s.id}><div><strong>{String(s.metadata.title||'Repository test suite')}</strong><p>{s.state} · {s.origin_source.revision.slice(0,12)} · {new Date(s.created_at).toLocaleString()}</p></div><a className="button secondary" href={'#execution/'+s.origin_profile_id+'/generate/'+s.id}>Review suite →</a></article>)}</section>
    <details><summary>Earlier focused file and function tools</summary><p>These use a separate, limited execution environment and are retained for earlier saved work.</p><a href={'#testing/'+encodeURIComponent(repo)}>Open focused file testing →</a></details>
  </>
}
