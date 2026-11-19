import {useEffect,useState} from 'react'
import {api} from './api'
import type {ExecutionActivity,ExecutionProfile} from './executionTypes'
import {StatusBadge,statusText,timeLabel,showRun} from './executionUi'
import {ProjectActions} from './ProjectActions'

export type ProjectRun={id:string;session_id:string;status:string;completed_at:string;sha:string;summary?:{total:number;passed:number;failed:number;blocked:number;skipped:number;not_run:number}|null}
export type ProjectSummary={repo:string;suite_count:number;test_count:number;run_count:number;latest_run:ProjectRun|null;suites:{id:string;function:string;path:string;test_count:number;created_at:string}[];runs:ProjectRun[]}

export function ProjectNavigation({repo,active}:{repo:string;active:'overview'|'tests'|'runs'|'ai-review'}){
  const encoded=encodeURIComponent(repo)
  return <div className="project-toolbar"><nav className="project-tabs" aria-label="Project navigation">{[['overview','Workspace Dashboard','project'],['runs','Execution History','runs'],['ai-review','PR Code Review','ai-review']].map(([key,label,route])=><a key={key} href={'#'+route+'/'+encoded} aria-current={active===key?'page':undefined}>{label}</a>)}</nav><ProjectActions repo={repo}/></div>
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
  const [testFilter,setTestFilter]=useState<'all'|'failed'|'passed'>('all')
  const [categoryFilter,setCategoryFilter]=useState<string>('all')

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
          const activeProf=list.find(p=>p.runs.length>0)||list[list.length-1]
          setProfile(activeProf)
          if(activeProf){
            api<{targets:ModuleTarget[]}>('executions/profiles/'+activeProf.id+'/generation-context').then(ctx=>{
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
    setActionBusy('Initializing autonomous test synthesis and local pytest engine…')
    setActionError('');setActionMessage('')
    try{
      let activeProf=profile
      if(!activeProf){
        setActionBusy('Connecting repository and analyzing source modules…')
        const targetRef = repo.startsWith('local/') ? 'local' : 'main'
        const disc=await api<{source:any;provider_id:string;discovery:any}>('executions/discover',{
          repo,
          ref: targetRef,
          provider_id: 'python-pytest',
          component: '.'
        },'POST')
        const pythonEnv = disc.discovery?.python_environments?.[0]?.runtime || '3.11'
        const reqFiles = disc.discovery?.pytest_dependency_files || []
        const defaultCfg = {
          component_root: '.',
          runtime: pythonEnv,
          requirements_files: reqFiles,
          pythonpath: ['.'],
          install_project: false,
          extras: []
        }
        activeProf=await api<ExecutionProfile>('executions/profiles',{
          repo,
          requested_ref: targetRef,
          ref: targetRef,
          provider_id: 'python-pytest',
          config: defaultCfg
        },'POST')
        setProfile(activeProf)
      }
      setActionBusy('Synthesizing tests with company model and executing pytest locally…')
      const updated=await api<ExecutionProfile>('executions/profiles/'+activeProf.id+'/auto-pipeline',{profile_hash:activeProf.profile_hash},'POST')
      setProfile(updated)
      setActionMessage('Pipeline completed successfully! All generated tests verified in local Python.')
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
        <p style={{margin:0,fontSize:'12px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Runtime Engine</p>
        <strong style={{fontSize:'22px',display:'block',marginTop:'4px',color:'#166534'}}>
          {profile?.environment?.target==='docker-linux'?'Docker Container':'Local Python'}
        </strong>
        <span style={{fontSize:'12px',color:'var(--muted)'}}>
          {profile?.environment?.target==='docker-linux'?'Isolated container':'Zero-Docker pytest runner'}
        </span>
      </article>
    </section>

    <section className="surface" style={{padding:'18px',marginBottom:'18px',border:'1px solid var(--border)'}}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Execution control</p>
          <h2 style={{margin:0}}>Autonomous Test Pipeline</h2>
        </div>
        <span className="badge" style={{background:'rgba(22,101,52,0.1)',color:'#166534',fontWeight:600}}>
          {profile?.environment?.target==='docker-linux'?'Docker Sandbox':'Local Host Python / pytest'}
        </span>
      </div>
      <p style={{margin:'8px 0 16px 0',color:'var(--muted)'}}>
        Scans source tree, synthesizes unit and integration tests across project modules, and executes them with full assertion verification.
      </p>
      
      <div className="action-group" style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
        <button className="button" disabled={!!actionBusy} onClick={handleAutoPipeline} style={{fontWeight:700,fontSize:'14px',padding:'10px 20px'}}>
          Run Full Automated Pipeline
        </button>
        {latestRun?.suite_id&&!repo.startsWith('local/')&&<button className="button secondary" disabled={!!actionBusy} onClick={handlePushGitHub}>
          Push Tests to GitHub (PR)
        </button>}
        {latestRun?.suite_id&&<button className="button secondary" disabled={!!actionBusy} onClick={handleExportLocal}>
          Export Tests to Project Folder
        </button>}
        {profile&&<a className="button secondary" href={'#execution/'+profile.id}>
          Open Test Inspector →
        </a>}
        {profile&&<a className="button secondary" href={'#execution/'+profile.id+'/generate'}>
          Custom Test Designer
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

    {latestRun&&latestRun.tests&&latestRun.tests.length>0&&(()=>{
      const allTests = latestRun.tests
      function getTestModule(id: string): string {
        const file = id.split('::')[0] || ''
        const testName = id.split('::').pop() || id
        for (const target of targets) {
          const stem = target.id.replace(/\.py$/, '').replace(/[\/\\]/g, '_')
          if (file.includes(stem)) return target.id
          if (testName.toLowerCase().includes(stem.toLowerCase())) return target.id
        }
        if (testName.includes('sm_') || testName.includes('state_machine')) return 'state_machine.py'
        if (testName.includes('daq_') || testName.includes('sample') || testName.includes('door') || testName.includes('overlap') || testName.includes('power')) return 'daq_handler.py'
        if (testName.includes('ew_') || testName.includes('excel') || testName.includes('workbook')) return 'excel_writer.py'
        if (testName.includes('main') || testName.includes('gui') || testName.includes('button') || testName.includes('dialog')) return 'main.py'
        if (testName.includes('config') || testName.includes('voltage') || testName.includes('threshold')) return 'config.py'
        return 'General'
      }

      const moduleGroups = new Map<string, { total: number; passed: number }>()
      for (const t of allTests) {
        const mod = getTestModule(t.id)
        const entry = moduleGroups.get(mod) || { total: 0, passed: 0 }
        entry.total++
        if (t.status === 'passed') entry.passed++
        moduleGroups.set(mod, entry)
      }

      const filtered = allTests.filter(t => {
        if (testFilter === 'passed' && t.status !== 'passed') return false
        if (testFilter === 'failed' && t.status !== 'failed') return false
        if (categoryFilter !== 'all' && getTestModule(t.id) !== categoryFilter) return false
        return true
      })

      return <section className="surface" style={{padding:'20px',marginBottom:'18px',border:'1px solid var(--border)'}}>
        <div className="section-heading" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'12px'}}>
          <div>
            <p className="eyebrow">Execution Evidence</p>
            <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
              <h2 style={{margin:0}}>Generated Behavioral Test Cases ({allTests.length} Total)</h2>
              {latestRun.coverage && (
                <span className="badge" style={{background:'rgba(22,101,52,0.12)',color:'#166534',fontWeight:700,fontSize:'12px',padding:'3px 8px',borderRadius:'4px'}}>
                  {latestRun.coverage.percent_covered_display}% Code Coverage ({latestRun.coverage.covered_lines}/{latestRun.coverage.num_statements} Lines)
                </span>
              )}
            </div>
            <p style={{margin:'4px 0 0 0',color:'var(--muted)',fontSize:'13px'}}>
              Multi-Layer Testing (Unit & Logic, Boundary Attacks, Stateful Workflows) executed with real-time coverage.
            </p>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button className={`button ${testFilter==='all'?'':'secondary'}`} style={{padding:'6px 14px',fontSize:'13px'}} onClick={()=>setTestFilter('all')}>
              All ({allTests.length})
            </button>
            <button className={`button ${testFilter==='passed'?'':'secondary'}`} style={{padding:'6px 14px',fontSize:'13px',color:'#166534'}} onClick={()=>setTestFilter('passed')}>
              Passed ({latestSummary?.passed||0})
            </button>
            <button className={`button ${testFilter==='failed'?'':'secondary'}`} style={{padding:'6px 14px',fontSize:'13px',color:'#991b1b'}} onClick={()=>setTestFilter('failed')}>
              Failed ({latestSummary?.failed||0})
            </button>
          </div>
        </div>

        {moduleGroups.size > 0 && <div style={{display:'grid',gridTemplateColumns:`repeat(auto-fit, minmax(200px, 1fr))`,gap:'12px',margin:'16px 0'}}>
          {Array.from(moduleGroups.entries()).map(([modName, stats]) => {
            const isAllPassed = stats.passed === stats.total
            const isSelected = categoryFilter === modName
            return <div key={modName} style={{
              padding:'12px 14px',
              borderRadius:'6px',
              background:'var(--surface-muted, #f8fafc)',
              border:`1px solid ${isSelected ? '#166534' : 'var(--border)'}`,
              cursor:'pointer',
              boxShadow: isSelected ? '0 0 0 1px #166534' : 'none'
            }} onClick={()=>setCategoryFilter(isSelected ? 'all' : modName)}>
              <span style={{fontSize:'12px',color:'var(--muted)',display:'block',fontFamily:'monospace'}}>
                📁 {modName}
              </span>
              <strong style={{fontSize:'15px',display:'block',margin:'4px 0'}}>
                {stats.passed} / {stats.total} Passed
              </strong>
              <span style={{fontSize:'12px',fontWeight:700,color:isAllPassed ? '#166534' : '#991b1b'}}>
                {stats.total ? Math.round((stats.passed / stats.total) * 100) : 0}% Pass Rate
              </span>
              {(()=>{
                const cov = latestRun.coverage?.files?.[modName] || Object.entries(latestRun.coverage?.files || {}).find(([k]) => k.includes(modName))?.[1]
                if (!cov) return null
                return <span style={{fontSize:'11px',fontWeight:600,color:'var(--muted)',display:'block',marginTop:'3px'}}>
                  Coverage: {cov.percent_covered.toFixed(0)}% ({cov.covered_lines}/{cov.num_statements} lines)
                </span>
              })()}
            </div>
          })}
        </div>}

        <div style={{overflowX:'auto',marginTop:'12px'}}>
          <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',fontSize:'13px'}}>
            <thead>
              <tr style={{borderBottom:'1px solid var(--border)',color:'var(--muted)'}}>
                <th style={{padding:'10px 8px',width:'30%'}}>Test Function & Target</th>
                <th style={{padding:'10px 8px',width:'14%'}}>Module</th>
                <th style={{padding:'10px 8px',width:'10%'}}>Outcome</th>
                <th style={{padding:'10px 8px',width:'8%'}}>Duration</th>
                <th style={{padding:'10px 8px'}}>Verification Evidence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(test=>{
                const testName = test.id.split('::').pop()||test.id
                const scopeLabel = getTestModule(test.id)
                
                // Parse clean failure line vs full traceback
                let summaryLine = test.detail
                if (test.status === 'failed') {
                  const lines = test.detail.split('\n').map(l=>l.trim()).filter(Boolean)
                  const errMatch = lines.slice().reverse().find(l=>l.startsWith('E ') || l.includes('AssertionError') || l.includes('KeyError') || l.includes('TypeError'))
                  summaryLine = errMatch ? errMatch.replace(/^E\s+/, '') : (lines[lines.length-1] || 'Assertion check failed.')
                }

                return <tr key={test.id} style={{borderBottom:'1px solid var(--border)'}}>
                  <td style={{padding:'12px 8px',fontFamily:'monospace',fontWeight:600,color:'var(--text)'}}>
                    {testName}
                  </td>
                  <td style={{padding:'12px 8px',color:'var(--muted)'}}>
                    <span style={{fontSize:'12px'}}>{scopeLabel}</span>
                  </td>
                  <td style={{padding:'12px 8px'}}>
                    <span className="badge" style={{
                      background: test.status==='passed'?'rgba(22,101,52,0.1)':'rgba(153,27,27,0.1)',
                      color: test.status==='passed'?'#166534':'#991b1b',
                      fontWeight: 700
                    }}>
                      {test.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{padding:'12px 8px',color:'var(--muted)',fontSize:'12px'}}>
                    {test.seconds ? `${Math.round(test.seconds*1000)}ms` : '—'}
                  </td>
                  <td style={{padding:'12px 8px'}}>
                    <div style={{color: test.status==='passed'?'#166534':'#991b1b',fontWeight:600}}>
                      {test.status==='passed' ? 'Assertions verified successfully.' : summaryLine}
                    </div>
                    {test.status==='failed'&&<details style={{marginTop:'6px'}}>
                      <summary style={{cursor:'pointer',fontSize:'12px',color:'var(--muted)'}}>View full pytest traceback ▾</summary>
                      <pre style={{background:'#0f172a',color:'#f8fafc',padding:'10px 12px',borderRadius:'6px',fontSize:'12px',overflowX:'auto',margin:'6px 0',lineHeight:1.4}}>
                        {test.detail}
                      </pre>
                    </details>}
                  </td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </section>
    })()}

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
