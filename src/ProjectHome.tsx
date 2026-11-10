import {useEffect,useState} from 'react'
import {api} from './api'
import type {ExecutionActivity,ExecutionProfile} from './executionTypes'
import {StatusBadge,statusText,timeLabel,showRun} from './executionUi'
import {ProjectActions} from './ProjectActions'

export type ProjectRun={id:string;session_id:string;status:string;completed_at:string;sha:string;summary?:{total:number;passed:number;failed:number;blocked:number;skipped:number;not_run:number}|null}
export type ProjectSummary={repo:string;suite_count:number;test_count:number;run_count:number;latest_run:ProjectRun|null;suites:{id:string;function:string;path:string;test_count:number;created_at:string}[];runs:ProjectRun[]}

export function ProjectNavigation({repo,active}:{repo:string;active:'overview'|'tests'|'runs'|'ai-review'}){
  const encoded=encodeURIComponent(repo)
  return <div className="project-toolbar"><nav className="project-tabs" aria-label="Project navigation">{[['overview','Overview','project'],['tests','Tests','tests'],['runs','Runs','runs'],['ai-review','AI Review','ai-review']].map(([key,label,route])=><a key={key} href={'#'+route+'/'+encoded} aria-current={active===key?'page':undefined}>{label}</a>)}</nav><ProjectActions repo={repo}/></div>
}

type ModuleTarget={id:string;label:string;description:string}

export function ProjectHome({repo}:{repo:string}){
  const [activity,setActivity]=useState<ExecutionActivity>()
  const [profiles,setProfiles]=useState<ExecutionProfile[]>([])
  const [profile,setProfile]=useState<ExecutionProfile>()
  const [targets,setTargets]=useState<ModuleTarget[]>([])
  const [loading,setLoading]=useState(true)
  const [actionBusy,setActionBusy]=useState('')
  const [actionMessage,setActionMessage]=useState('')
  const [actionError,setActionError]=useState('')
  const [ghToken,setGhToken]=useState('')
  const [showGhPrompt,setShowGhPrompt]=useState(false)
  const [prUrl,setPrUrl]=useState('')
  const [version,setVersion]=useState(0)

  useEffect(()=>{
    let active=true;setLoading(true);setActionError('')
    async function load(){
      try{
        const [actRes,profRes]=await Promise.allSettled([
          api<ExecutionActivity[]>('executions/activity?repo='+encodeURIComponent(repo)),
          api<ExecutionProfile[]>('executions/profiles?repo='+encodeURIComponent(repo))
        ])
        if(!active)return
        if(actRes.status==='fulfilled'&&actRes.value.length)setActivity(actRes.value[0])
        if(profRes.status==='fulfilled'&&profRes.value.length){
          const list=profRes.value
          setProfiles([...list].reverse())
          const latest=list[list.length-1]
          setProfile(latest)
          if(latest){
            api<{targets:ModuleTarget[]}>('executions/profiles/'+latest.id+'/generation-context').then(ctx=>{
              if(active&&ctx.targets)setTargets(ctx.targets)
            }).catch(()=>null)
          }
        }
      }catch(f){if(active)setActionError(f instanceof Error?f.message:String(f))}
      finally{if(active)setLoading(false)}
    }
    void load();return()=>{active=false}
  },[repo,version])

  const encoded=encodeURIComponent(repo)
  const latestRun=profile?.runs.at(-1)
  const latestSummary=latestRun?.summary
  const totalVerified=latestSummary?.passed??(activity?.latest_run?.summary?.passed??0)
  const hasFailures=Boolean(latestSummary?.failed&&latestSummary.failed>0)
  const passRate=latestSummary?.total?Math.round((latestSummary.passed/latestSummary.total)*100):(latestRun?.status==='passed'?100:0)

  async function handleAutoPipeline(){
    if(!profile)return
    setActionBusy('Running automated project pipeline in Docker…')
    setActionError('');setActionMessage('')
    try{
      const updated=await api<ExecutionProfile>('executions/profiles/'+profile.id+'/auto-pipeline',{profile_hash:profile.profile_hash},'POST')
      setProfile(updated)
      setActionMessage('Pipeline completed successfully in Docker. All generated tests verified.')
      const r=updated.runs.at(-1)
      if(r)showRun(updated.id,r.id)
    }catch(e){setActionError(e instanceof Error?e.message:String(e))}
    finally{setActionBusy('');setVersion(v=>v+1)}
  }

  async function handleExportLocal(){
    if(!latestRun?.suite_id)return
    setActionBusy('Exporting test suite to local repository…')
    setActionError('');setActionMessage('')
    try{
      const res=await api<{success:boolean;target_dir:string;message:string}>('executions/suites/'+latestRun.suite_id+'/export-local',{},'POST')
      setActionMessage(res.message||('Saved to '+res.target_dir))
    }catch(e){setActionError(e instanceof Error?e.message:String(e))}
    finally{setActionBusy('')}
  }

  async function handlePushGitHub(){
    if(!latestRun?.suite_id)return
    setActionBusy('Pushing to GitHub branch and opening Pull Request…')
    setActionError('');setActionMessage('')
    try{
      const res=await api<{success:boolean;pr_url:string;pr_number:number;message:string}>('executions/suites/'+latestRun.suite_id+'/export-github',{token:ghToken.trim()||undefined},'POST')
      if(res.pr_url){
        setPrUrl(res.pr_url)
        setActionMessage(res.message||'Pull request opened successfully on GitHub!')
        setShowGhPrompt(false)
      }
    }catch(e){
      const msg=e instanceof Error?e.message:String(e)
      if(msg.includes('token')||msg.includes('Token'))setShowGhPrompt(true)
      setActionError(msg)
    }finally{setActionBusy('')}
  }

  return <div className="project-home">
    <div className="project-identity">
      <span className="eyebrow">Repository Workspace</span>
      <h2>{repo}</h2>
      <p>Universal verification platform · Python / pytest execution environment</p>
    </div>
    
    <ProjectNavigation repo={repo} active="overview"/>

    {loading&&<p role="status">Loading repository telemetry…</p>}
    {actionBusy&&<p className="progress" role="status">{actionBusy}</p>}
    {actionMessage&&<div className="notice" style={{color:'#166534',background:'rgba(22,101,52,0.08)',padding:'12px 16px',borderRadius:'6px',margin:'14px 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span>{actionMessage}</span>
      {prUrl&&<a className="button secondary" href={prUrl} target="_blank" rel="noreferrer" style={{fontWeight:700}}>Open PR on GitHub ↗</a>}
    </div>}
    {actionError&&<div className="error" role="alert" style={{margin:'14px 0'}}>
      <p style={{margin:0}}>{actionError}</p>
    </div>}

    {showGhPrompt&&!prUrl&&<div className="surface" style={{margin:'14px 0',padding:'14px',border:'1px solid var(--border)'}}>
      <label htmlFor="overview-gh-token" style={{display:'block',fontSize:'13px',fontWeight:600,marginBottom:'6px'}}>GitHub Personal Access Token (repo scope)</label>
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
        <input id="overview-gh-token" type="password" placeholder="ghp_..." value={ghToken} onChange={e=>setGhToken(e.target.value)} style={{flex:1,minWidth:'220px'}}/>
        <button className="button" disabled={!!actionBusy||!ghToken.trim()} onClick={handlePushGitHub}>Submit & Open PR</button>
        <button className="button secondary" onClick={()=>setShowGhPrompt(false)}>Cancel</button>
      </div>
      <p className="field-help" style={{marginTop:'6px',fontSize:'12px',color:'var(--muted)'}}>Token is used only to create the branch and PR on {repo}.</p>
    </div>}

    <section className="project-metrics" style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:'12px',margin:'18px 0'}}>
      <article className="surface" style={{padding:'14px',borderRadius:'8px',border:'1px solid var(--border)',textAlign:'center'}}>
        <p style={{margin:0,fontSize:'12px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Test Health</p>
        <strong style={{fontSize:'24px',display:'block',marginTop:'4px',color:hasFailures?'#991b1b':'#166534'}}>
          {latestRun?`${passRate}% Pass Rate`:'No Runs'}
        </strong>
        <span style={{fontSize:'12px',color:'var(--muted)'}}>
          {latestRun?statusText(latestRun.status).toUpperCase():'Awaiting baseline'}
        </span>
      </article>

      <article className="surface" style={{padding:'14px',borderRadius:'8px',border:'1px solid var(--border)',textAlign:'center'}}>
        <p style={{margin:0,fontSize:'12px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Verified Cases</p>
        <strong style={{fontSize:'24px',display:'block',marginTop:'4px'}}>
          {totalVerified}
        </strong>
        <span style={{fontSize:'12px',color:'var(--muted)'}}>
          {latestRun?.suite_id?'Approved suite cases':'Baseline cases'}
        </span>
      </article>

      <article className="surface" style={{padding:'14px',borderRadius:'8px',border:'1px solid var(--border)',textAlign:'center'}}>
        <p style={{margin:0,fontSize:'12px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Coverage Baseline</p>
        <strong style={{fontSize:'24px',display:'block',marginTop:'4px'}}>
          {targets.length?`${targets.length} Modules`:'Scanning'}
        </strong>
        <span style={{fontSize:'12px',color:'var(--muted)'}}>
          Candidate target sources
        </span>
      </article>

      <article className="surface" style={{padding:'14px',borderRadius:'8px',border:'1px solid var(--border)',textAlign:'center'}}>
        <p style={{margin:0,fontSize:'12px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Environment</p>
        <strong style={{fontSize:'24px',display:'block',marginTop:'4px'}}>
          {profile?.state==='ready'?'Ready':profile?.state||'Unprepared'}
        </strong>
        <span style={{fontSize:'12px',color:'var(--muted)'}}>
          Docker isolated container
        </span>
      </article>
    </section>

    <section className="surface" style={{padding:'18px',marginBottom:'18px',border:'1px solid var(--border)'}}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Execution control</p>
          <h2 style={{margin:0}}>Autonomous Test Pipeline</h2>
        </div>
        <span className="badge">Linux / pytest runtime</span>
      </div>
      <p style={{margin:'8px 0 16px 0',color:'var(--muted)'}}>
        Scans source tree, synthesizes unit and integration tests across project modules, and executes them in an isolated container.
      </p>
      
      <div className="action-group" style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
        <button className="button" disabled={!!actionBusy||!profile} onClick={handleAutoPipeline}>
          Run Full Automated Pipeline
        </button>
        {latestRun?.suite_id&&<button className="button secondary" disabled={!!actionBusy} onClick={handlePushGitHub}>
          Push Tests to GitHub (PR)
        </button>}
        {latestRun?.suite_id&&<button className="button secondary" disabled={!!actionBusy} onClick={handleExportLocal}>
          Save to Local Project
        </button>}
        {profile&&<a className="button secondary" href={'#execution/'+profile.id}>
          Open Test Inspector →
        </a>}
        {profile&&<a className="button secondary" href={'#execution/'+profile.id+'/generate'}>
          Custom Test Designer
        </a>}
        {!profile&&<a className="button" href={'#tests/'+encoded}>
          Set up execution environment →
        </a>}
      </div>
    </section>

    {targets.length>0&&<section className="surface" style={{padding:'18px',marginBottom:'18px',border:'1px solid var(--border)'}}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Static AST Analysis</p>
          <h2 style={{margin:0}}>Candidate Project Modules</h2>
        </div>
        <span>{targets.length} eligible modules</span>
      </div>
      <p style={{margin:'6px 0 14px 0',color:'var(--muted)'}}>
        Source modules identified for test synthesis, behavioral assertions, and coverage tracking.
      </p>

      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',fontSize:'14px'}}>
          <thead>
            <tr style={{borderBottom:'1px solid var(--border)',color:'var(--muted)'}}>
              <th style={{padding:'10px 8px'}}>Module File</th>
              <th style={{padding:'10px 8px'}}>Target Types / Functions</th>
              <th style={{padding:'10px 8px'}}>Status</th>
              <th style={{padding:'10px 8px',textAlign:'right'}}>Action</th>
            </tr>
          </thead>
          <tbody>
            {targets.map(target=><tr key={target.id} style={{borderBottom:'1px solid var(--border)'}}>
              <td style={{padding:'12px 8px',fontWeight:600,fontFamily:'monospace'}}>{target.id}</td>
              <td style={{padding:'12px 8px',color:'var(--muted)'}}>{target.description||target.label}</td>
              <td style={{padding:'12px 8px'}}>
                <span className="badge" style={{background:'rgba(22,101,52,0.1)',color:'#166534',fontWeight:600}}>
                  Active Candidate
                </span>
              </td>
              <td style={{padding:'12px 8px',textAlign:'right'}}>
                {profile&&<a className="button secondary" style={{padding:'4px 10px',fontSize:'12px'}} href={'#execution/'+profile.id+'/generate'}>
                  Target in designer →
                </a>}
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>}

    {profile&&profile.runs.length>0&&<section className="surface" style={{padding:'18px',border:'1px solid var(--border)'}}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Audit History</p>
          <h2 style={{margin:0}}>Recent Executions</h2>
        </div>
        <span>{profile.runs.length} saved runs</span>
      </div>

      <div style={{overflowX:'auto',marginTop:'12px'}}>
        <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',fontSize:'14px'}}>
          <thead>
            <tr style={{borderBottom:'1px solid var(--border)',color:'var(--muted)'}}>
              <th style={{padding:'10px 8px'}}>Run ID</th>
              <th style={{padding:'10px 8px'}}>Timestamp</th>
              <th style={{padding:'10px 8px'}}>Outcome</th>
              <th style={{padding:'10px 8px'}}>Inventory</th>
              <th style={{padding:'10px 8px',textAlign:'right'}}>Report</th>
            </tr>
          </thead>
          <tbody>
            {[...profile.runs].reverse().slice(0,5).map((r,idx)=><tr key={r.id} style={{borderBottom:'1px solid var(--border)'}}>
              <td style={{padding:'12px 8px',fontFamily:'monospace'}}>Run #{profile.runs.length-idx} · {r.id.slice(0,8)}</td>
              <td style={{padding:'12px 8px',color:'var(--muted)'}}>{timeLabel(r.completed_at)}</td>
              <td style={{padding:'12px 8px'}}><StatusBadge status={r.status}/></td>
              <td style={{padding:'12px 8px'}}>
                {r.summary?`${r.summary.passed} passed · ${r.summary.failed} failed`:r.suite_id?'Suite executed':'Baseline tests'}
              </td>
              <td style={{padding:'12px 8px',textAlign:'right'}}>
                <a className="button secondary" style={{padding:'4px 10px',fontSize:'12px'}} href={'#execution/'+profile.id+'/'+r.id}>
                  Open Report →
                </a>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>}
  </div>
}
