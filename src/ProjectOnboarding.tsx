import {useEffect,useState} from 'react'
import {api} from './api'
import type {ExecutionProfile,RepositorySuite} from './executionTypes'

const stages=['Repository','Prepare environment','Run existing tests','Generate tests','Review tests','Run approved tests','Evidence','Re-run after fix']
const explanations=[
  'Your repository is connected. Adding it does not run or analyse its code.',
  'Review the project requirements and approve an isolated environment for this version of the code.',
  'Run the tests already written in the project. If none exist, continue to generation after preparation.',
  'Choose source files and describe correct behavior. Gemma proposes tests; it does not decide your requirements.',
  'Check imports and expected values. Edit and save the draft, then approve the exact tests.',
  'Execute the existing and approved generated tests against the real project code.',
  'Inspect each result and failure assertion. Results are saved automatically with their source and test identities.',
  'Fix the code outside Tracefold, open the repaired revision from the approved suite and run the same tests again.',
]
type Next={stage:number;title:string;detail:string;label:string;href:string;alternate?:{label:string;href:string}}
export function nextProjectStep(repo:string,profiles:ExecutionProfile[],suites:RepositorySuite[]):Next{
  const tests='#tests/'+encodeURIComponent(repo)
  const p=[...profiles].sort((a,b)=>b.created_at.localeCompare(a.created_at))[0]
  if(!p)return {stage:1,title:'Prepare your project for its first test',detail:'Choose a code revision and project folder. Review the detected dependencies, then approve preparation. Nothing has been tested yet.',label:'Prepare environment →',href:tests}
  const target='#execution/'+p.id
  if(['preparing','running','generating'].includes(p.state))return {stage:p.state==='preparing'?1:p.state==='generating'?3:5,title:'An operation is in progress',detail:'Open the environment to follow its progress. Wait for completion before starting another operation.',label:'View progress →',href:target}
  if(p.error||['blocked','error','interrupted'].includes(p.state))return {stage:1,title:'Resolve the execution blocker',detail:p.error||'The last operation did not complete. Review the saved error and recovery options before continuing.',label:'Inspect environment →',href:target}
  if(!p.environment)return {stage:1,title:'Review and prepare the saved configuration',detail:'Your project configuration is saved, but its execution environment is not prepared. Review it before approving preparation.',label:'Review environment →',href:target}
  const relevant=suites.filter(s=>s.provider_id===p.provider_id&&s.origin_profile_id===p.id).sort((a,b)=>b.created_at.localeCompare(a.created_at))
  const draft=relevant.find(s=>s.state==='draft')
  if(draft)return {stage:4,title:'Review your generated tests',detail:'A saved draft is waiting. Verify each expected result, save any changes and approve the exact code before running it.',label:'Review test draft →',href:target+'/generate/'+draft.id}
  const approved=relevant.find(s=>s.state==='approved'&&!p.runs.some(r=>r.suite_id===s.id&&r.suite_hash===s.suite_hash))
  if(approved)return {stage:5,title:'Run your approved tests',detail:'The test code is approved, but this exact suite has not been executed in this environment. Run it to obtain evidence.',label:'Run approved suite →',href:target+'/generate/'+approved.id}
  const latest=p.runs.at(-1)
  if(!latest)return {stage:2,title:'Run the tests already in your project',detail:'Your environment is ready. Establish a baseline with existing tests, or generate the first tests if the project has none.',label:'Run existing tests →',href:target,alternate:{label:'My project has no tests →',href:target+'/generate'}}
  if(latest.status!=='passed')return {stage:6,title:'Understand the latest result',detail:'Open the saved assertions and diagnostics. A failed test can indicate a code defect or an incorrect test; review it before changing the code.',label:'Inspect latest evidence →',href:target+'/'+latest.id,alternate:latest.suite_id?{label:'Verify after a code fix →',href:target+'/generate/'+latest.suite_id}:undefined}
  if(latest.suite_id)return {stage:7,title:'Your test evidence is saved',detail:'Review what passed. To verify another code revision, open this approved suite and use “Verify this suite on a repaired revision”. Passing cases do not prove all code is correct.',label:'View saved evidence →',href:target+'/'+latest.id,alternate:{label:'Re-run the same suite after a fix →',href:target+'/generate/'+latest.suite_id}}
  return {stage:3,title:'Add tests for behavior that matters',detail:'Your baseline is saved. Select a few source modules, describe the required behavior and ask Gemma for a draft you can review.',label:'Generate additional tests →',href:target+'/generate',alternate:{label:'View baseline evidence →',href:target+'/'+latest.id}}
}

export function ProjectOnboarding({repo}:{repo:string}){
  const [data,setData]=useState<{profiles:ExecutionProfile[];suites:RepositorySuite[]}>(),[error,setError]=useState(false),[version,setVersion]=useState(0)
  useEffect(()=>{let active=true;setError(false);setData(undefined);Promise.all([api<ExecutionProfile[]>('executions/profiles?repo='+encodeURIComponent(repo)),api<RepositorySuite[]>('executions/suites?repo='+encodeURIComponent(repo))]).then(([profiles,suites])=>{if(active)setData({profiles,suites})}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[repo,version])
  const next=data?nextProjectStep(repo,data.profiles,data.suites):undefined
  const latestSetup=data?[...data.profiles].sort((a,b)=>b.created_at.localeCompare(a.created_at))[0]:undefined
  return <section className="surface project-onboarding" aria-labelledby="project-purpose">
    <p className="eyebrow">Your testing workspace</p><h2 id="project-purpose">Test your Python project. Verify your fixes.</h2>
    <p className="onboarding-purpose">Run your Python project's tests, create additional tests with AI, review them and verify the same tests after a code fix. Keep the results together in this project.</p>
    <p className="field-help">Available today: public GitHub repositories · Python 3.11 / Linux / pytest · generation for selected files. No pull request is needed for testing.</p>
    {!data&&!error&&<p role="status">Finding your next step…</p>}
    {error&&<div className="notice" role="alert"><p>Your progress could not be loaded. No completion is assumed. Saved work is still available in Tests and Runs.</p><button className="button secondary" onClick={()=>setVersion(v=>v+1)}>Retry project guidance</button></div>}
    {next&&<div className="onboarding-next"><div><p className="eyebrow">Recommended next step · {next.stage+1} of 8</p><h3>{next.title}</h3><p>{next.detail}</p></div><div className="action-group"><a className="button" href={next.href}>{next.label}</a>{next.alternate&&<a className="onboarding-alternate" href={next.alternate.href}>{next.alternate.label}</a>}</div></div>}
    {latestSetup&&<p className="field-help">Recommendation for your latest saved setup: {/^[0-9a-f]{40}$/.test(latestSetup.requested_ref||'')?latestSetup.requested_ref?.slice(0,12):latestSetup.requested_ref||latestSetup.source.revision.slice(0,12)}. Other saved versions remain in Tests and Runs.</p>}
    <ol className="guide-route" aria-label="Testing journey">{stages.map((title,i)=><li key={title} aria-current={next?.stage===i?'step':undefined}><span>{i+1}</span> {title}</li>)}</ol>
    <details className="journey-guide"><summary>What happens at each step?</summary><p>This is a guide, not a completion checklist. Existing tests are optional; review and approval are required for generated tests.</p><ol className="onboarding-stages">{stages.map((title,i)=><li key={title} aria-current={next?.stage===i?'step':undefined}><span className="stage-number" aria-hidden="true">{i+1}</span><div><strong>{title}</strong>{i===0&&<span className="stage-note">Connected</span>}{next?.stage===i&&<span className="stage-note">Recommended next</span>}<p>{explanations[i]}</p></div></li>)}</ol></details>
    <ProjectAreaGuide repo={repo}/>
  </section>
}

export function ProjectAreaGuide({repo}:{repo:string}){
  const path=encodeURIComponent(repo)
  return <div className="project-area-guide" aria-label="Choose the right project area"><h3>Where do I go?</h3><div className="area-guide-grid">
    <div><a href={'#tests/'+path}>Existing tests</a><p>Run tests already in the repository. Start here to prepare the project. No AI required.</p></div>
    <div><a href={'#generated/'+path}>Generated tests</a><p>Ask AI for new tests for selected files. Review, approve and run them here. No existing tests? Use this after preparation. Tests stay in Tracefold; your repository is not changed.</p></div>
    <div><a href={'#runs/'+path}>Runs & evidence</a><p>Reopen saved executions, inspect failures and review repair comparisons. This is your history, not a separate testing tool.</p></div>
    <div><a href={'#ai-review/'+path}>AI Review · optional</a><p>Ask Gemma to comment on a pull request change. These are suggestions; this action does not run tests.</p></div>
  </div></div>
}

export function ProjectOrientation({repo,area}:{repo:string;area:'tests'|'runs'|'ai-review'}){
  const help={tests:'Work here: prepare the project, run existing tests or generate and review new tests. Each execution creates saved evidence.',runs:'Return here: each run is a saved execution. Open its report for per-test results and any same-suite repair comparison.', 'ai-review':'Optional code review: Gemma reviews a saved pull request change. This is separate from test generation and does not execute tests.'}
  return <aside className="project-orientation" aria-label="Project help"><p>{help[area]} <a href={'#project/'+encodeURIComponent(repo)}>Open project guide →</a></p><details><summary>Which area should I use?</summary><ProjectAreaGuide repo={repo}/></details></aside>
}
