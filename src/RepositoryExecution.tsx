import {useEffect,useState} from 'react'
import {api} from './api'
import {ProjectNavigation} from './ProjectHome'
import type {Discovery,ExecutionProfile,ProviderView} from './executionTypes'

export function RepositoryExecution({repo,profileId,views}:{repo?:string;profileId?:string;views:Record<string,ProviderView>}){
  const [providers,setProviders]=useState<{id:string;version:string}[]>([])
  const [provider,setProvider]=useState('')
  const [ref,setRef]=useState('main')
  const [component,setComponent]=useState('.')
  const [discovery,setDiscovery]=useState<Discovery>()
  const [config,setConfig]=useState<Record<string,unknown>>({})
  const [profiles,setProfiles]=useState<ExecutionProfile[]>([])
  const [profile,setProfile]=useState<ExecutionProfile>()
  const [busy,setBusy]=useState('')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  useEffect(()=>{
    let active=true
    async function load(){try{
      if(profileId){const item=await api<ExecutionProfile>('executions/profiles/'+profileId);if(active)setProfile(item)}
      else if(repo){
        const [items,history]=await Promise.all([api<{id:string;version:string}[]>('executions/providers'),api<ExecutionProfile[]>('executions/profiles?repo='+encodeURIComponent(repo))])
        if(active){setProviders(items);setProvider(items[0]?.id||'');setProfiles(history.reverse())}
      }
    }catch(failure){if(active)setError(failure instanceof Error?failure.message:String(failure))}finally{if(active)setLoading(false)}}
    void load();return()=>{active=false}
  },[repo,profileId])
  useEffect(()=>{
    if(!profileId||!profile||!['running','preparing'].includes(profile.state))return
    let active=true
    const timer=setInterval(()=>{void api<ExecutionProfile>('executions/profiles/'+profileId).then(item=>{if(active)setProfile(item)}).catch(()=>{if(active)setError('Could not refresh the saved operation. Reload this page to reconnect.')})},2500)
    return()=>{active=false;clearInterval(timer)}
  },[profileId,profile?.state])
  async function action(name:string,work:()=>Promise<void>){setBusy(name);setError('');try{await work()}catch(failure){setError(failure instanceof Error?failure.message:String(failure))}finally{setBusy('')}}
  const activeRepo=profile?.repo||repo
  const view=views[provider]
  const Editor=view?.Editor
  const latest=profile?.runs.at(-1)
  const labels:Record<string,string>={total:'tests',passed:'passed',failed:'failed',error:'execution errors',skipped:'skipped',xfailed:'expected failures',xpassed:'unexpected passes',not_run:'not run'}
  const running=!!busy||!!profile&&['running','preparing'].includes(profile.state)
  return <div className="repository-execution">
    <p className="page-help">Run this repository's existing tests in an approved environment. No AI generation is required. Results apply to the recorded revision and supported execution profile.</p>
    {activeRepo&&<><a href={'#project/'+encodeURIComponent(activeRepo)}>{activeRepo}</a><ProjectNavigation repo={activeRepo} active="repository"/></>}
    {loading&&<p role="status">Loading execution workspace…</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {busy&&<p className="progress" role="status">{busy==='prepare'?'Preparing approved dependencies and installing the project. This can take several minutes.':busy==='run'?'Collecting and running existing tests…':'Preparing the repository snapshot…'}</p>}
    {!loading&&!profile&&repo&&<>
      <form className="surface" onSubmit={event=>{event.preventDefault();void action('discover',async()=>{
        setDiscovery(undefined)
        const result=await api<Discovery>('executions/discover',{repo,ref,provider_id:provider,component})
        setDiscovery(result);setConfig(views[provider]?.defaults(result.discovery)||{})
      })}}><h2>1. Inspect repository</h2>
        <label htmlFor="repository-runtime-provider">Execution provider</label><select id="repository-runtime-provider" value={provider} disabled={running} onChange={e=>{setProvider(e.target.value);setDiscovery(undefined)}}>{providers.map(item=><option key={item.id} value={item.id}>{views[item.id]?.label||item.id} · v{item.version}</option>)}</select>
        <label htmlFor="repository-revision">Branch, tag or commit</label><input id="repository-revision" required value={ref} disabled={running} onChange={e=>{setRef(e.target.value);setDiscovery(undefined)}}/>
        <label htmlFor="repository-component">Component root</label><input id="repository-component" required value={component} disabled={running} onChange={e=>{setComponent(e.target.value);setDiscovery(undefined)}}/>
        <p className="muted">Use . for the repository root. Separately packaged components need separate profiles.</p>
        <button className="button" disabled={running||!provider}>Inspect repository</button>
      </form>
      {discovery&&<form className="surface" onSubmit={event=>{event.preventDefault();void action('save',async()=>{
        const item=await api<ExecutionProfile>('executions/profiles',{repo,ref:discovery.source.revision,provider_id:discovery.provider_id,config})
        location.hash='#execution/'+item.id
      })}}><h2>2. Configure environment</h2><p>Snapshot {discovery.source.revision.slice(0,12)} · {discovery.source.file_count} files retained.</p>
        {Editor?<Editor value={config} onChange={setConfig} disabled={running} discovery={discovery.discovery}/>:<p>This provider requires a registered configuration view.</p>}
        <button className="button" disabled={running||!Editor}>Save configuration for review</button>
      </form>}
      <section className="surface"><h2>Saved repository environments</h2>{!profiles.length&&<p>No repository execution profiles yet.</p>}
        {profiles.map(item=><article className="row history-row" key={item.id}><div><strong>{item.provider_id} · {item.state}</strong><p>{item.source.revision.slice(0,12)} · {item.runs.length} saved runs · {new Date(item.created_at).toLocaleString()}</p></div><a className="button secondary" href={'#execution/'+item.id}>Open environment and results →</a></article>)}
      </section>
    </>}
    {profile&&<>
      <section className="surface"><h2>Execution profile</h2>
        {latest&&<div className="suite-counts"><strong>Latest run: {latest.status.replaceAll('_',' ').toUpperCase()}</strong><span>{latest.summary?.passed??0} passed</span><span>{latest.summary?.failed??0} failed</span><button className="button secondary" onClick={()=>document.getElementById('repository-evidence')?.scrollIntoView({behavior:'smooth'})}>View test results ↓</button></div>}
        <p>{profile.provider_id} · v{profile.provider_version} · <strong>{profile.state.toUpperCase()}</strong></p>
        <p className="hash">Revision {profile.source.revision}</p><p className="muted">Source content hash: {profile.source.content_hash}</p>
        <details open={!profile.environment}><summary>Review environment configuration</summary><pre>{JSON.stringify(profile.config,null,2)}</pre></details>
        <p>Review the exact provider configuration before preparing this environment. Runs retain the source, profile and environment identities shown here.</p>
        {profile.error&&<pre className="error" role="alert">{profile.error}</pre>}
        {!profile.environment&&<button className="button" disabled={running} onClick={()=>void action('prepare',async()=>{setProfile(await api<ExecutionProfile>('executions/profiles/'+profile.id+'/prepare',{profile_hash:profile.profile_hash}))})}>Approve environment and prepare</button>}
        {profile.environment&&<><p className="passed"><strong>Environment ready</strong></p><p className="hash">{profile.environment.id}</p>
          <details><summary>Recorded environment manifest</summary><pre>{JSON.stringify(profile.environment.manifest,null,2)}</pre></details>
          <details><summary>Environment preparation log</summary><pre>{profile.environment.log}</pre></details>
          <button className="button" disabled={running} onClick={()=>void action('run',async()=>{setProfile(await api<ExecutionProfile>('executions/profiles/'+profile.id+'/runs',{profile_hash:profile.profile_hash}));setTimeout(()=>document.getElementById('repository-evidence')?.scrollIntoView({behavior:'smooth'}),0)})}>{profile.runs.length?'Re-run existing tests':'Run existing tests'}</button>
          <details><summary>Environment recovery</summary><p>Rebuild the approved environment if its worker image is unavailable or preparation needs to be repeated. Earlier runs retain their original environment manifest.</p><button className="button secondary" disabled={running} onClick={()=>void action('prepare',async()=>{setProfile(await api<ExecutionProfile>('executions/profiles/'+profile.id+'/prepare',{profile_hash:profile.profile_hash}))})}>Rebuild approved environment</button></details>
        </>}
        {['preparing','running'].includes(profile.state)&&<p role="status">Operation in progress. Saved state refreshes automatically.</p>}
        {profile.state==='interrupted'&&<p className="error">The earlier operation was interrupted. Retry preparation or execution; previous evidence is retained.</p>}
      </section>
      <section className="surface" id="repository-evidence"><h2>Saved repository test reports</h2>{!profile.runs.length&&<p>No tests have been executed for this environment yet.</p>}
        {profile.runs.map((run,index)=><article className="run-evidence" key={run.id}>
          <h3>Repository run {index+1} · <span className={run.status==='passed'?'passed':run.status==='failed'?'failed':''}>{run.status.replaceAll('_',' ').toUpperCase()}</span></h3>
          <p>{new Date(run.completed_at).toLocaleString()} · {run.profile_hash===profile.profile_hash?'Same approved profile':'Different profile'} · {run.environment_id===profile.environment?.id?'Same prepared environment':'Different environment'}</p>
          {run.summary&&<div className="suite-counts">{Object.entries(run.summary).map(([key,value])=><span key={key} className={key==='passed'?'passed':key==='failed'?'failed':''}><strong>{value}</strong> {labels[key]||key.replaceAll('_',' ')}</span>)}</div>}
          {run.error&&<p className="error">{run.error}</p>}
          <p className="muted">This result covers collected tests. Skips, expected failures and incomplete execution are shown separately; success does not certify untested code.</p>
          {run.tests.filter(test=>test.status!=='passed').map(test=><details className="test-result" key={test.id} open><summary><strong>{test.status.toUpperCase()}</strong> · {test.id}</summary><pre>{test.detail}</pre></details>)}
          <details><summary>Passed cases · {run.tests.filter(test=>test.status==='passed').length}</summary>{run.tests.filter(test=>test.status==='passed').map(test=><p className="location" key={test.id}>{test.id} · {test.seconds??0}s</p>)}</details>
          <details><summary>Effective provider configuration</summary><pre>{JSON.stringify(run.effective_config,null,2)}</pre></details>
          {!!run.collection_errors?.length&&<details open><summary>Collection errors</summary><pre>{JSON.stringify(run.collection_errors,null,2)}</pre></details>}
          {!!run.collection_skips?.length&&<details><summary>Modules skipped during collection</summary><pre>{JSON.stringify(run.collection_skips,null,2)}</pre></details>}
          <details><summary>Execution output</summary><pre>{run.log}</pre></details>
          {run.artifacts?.map(artifact=><details key={artifact.name}><summary>{artifact.name} · {artifact.media_type}</summary><p className="hash">SHA256 {artifact.sha256}</p><pre>{artifact.content}</pre></details>)}
        </article>)}
      </section>
    </>}
  </div>
}
