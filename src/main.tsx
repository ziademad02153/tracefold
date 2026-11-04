import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import { api } from './api'
import { Workbench } from './Workbench'

type Repo = {name:string; description:string}
type Pull = {number:number; title:string; base:string; head:string}
type Saved = Pick<Pull,'number'|'title'> & {id:string; head?:string}
type AIReview = {status:'running'|'completed'|'failed'; error?:string; result?:{
  model:string; completed_at:string; seconds:number; scope:string;
  findings:{file:string;line:number;title:string;explanation:string;suggestion:string}[]
}}
type Report = Pull & {id:string; repo:string; diff:string; ai_review?:AIReview; source:string; checks:{version:string; status:string; log:string}[]}


function App() {
  const [repoInput,setRepoInput] = useState('')
  const [hash,setHash] = useState(location.hash.slice(1))
  const [repos,setRepos] = useState<Repo[]>([])
  const [pulls,setPulls] = useState<Pull[]>([])
  const [saved,setSaved] = useState<Saved[]>([])
  const [report,setReport] = useState<Report>()
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(true)
  const [pending,setPending] = useState(false)
  const [reviewing,setReviewing] = useState(false)
  const [rawPage, id=''] = hash.split('/')
  const page = rawPage === '' ? 'projects' : rawPage
  let project = ''
  let invalidRoute = !['projects','connect','project','history','report','testing','test-session'].includes(page)
  if (page === 'project' || page === 'history' || page === 'testing') {
    try { project = decodeURIComponent(id) } catch { invalidRoute = true }
    if (!project) invalidRoute = true
  }
  if ((page === 'report' || page === 'test-session') && !id) invalidRoute = true
  const heading = useRef<HTMLHeadingElement>(null)
  const [refreshVersion,setRefreshVersion] = useState(0)
  const [pullError,setPullError] = useState('')
  const [pendingKey,setPendingKey] = useState('')
  const repoPath = 'repo=' + encodeURIComponent(project)

  useEffect(() => {
    const change = () => setHash(location.hash.slice(1))
    window.addEventListener('hashchange',change)
    return () => window.removeEventListener('hashchange',change)
  },[])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setReport(undefined)
    setRepos([])
    setPulls([])
    setSaved([])
    setPullError('')
    if (invalidRoute) { setLoading(false); return }
    async function load() {
      try {
        if (page === 'report') {
          const data = await api<Report>('reports/' + encodeURIComponent(id))
          if (active) setReport(data)
        } else if (page === 'history') {
          const data = await api<Saved[]>('reports?' + repoPath)
          if (active) setSaved(data)
        } else if (page === 'project') {
          const results = await Promise.allSettled([
            api<Pull[]>('pulls?' + repoPath),api<Saved[]>('reports?' + repoPath),
          ])
          if (active) {
            const [pullResult,savedResult] = results
            if (pullResult.status === 'fulfilled') setPulls(pullResult.value)
            else setPullError(pullResult.reason instanceof Error ? pullResult.reason.message : 'Could not load pull requests.')
            if (savedResult.status === 'fulfilled') setSaved(savedResult.value)
            else setError('Could not load saved reports. Try refreshing the list.')
          }
        } else if (page === 'projects') {
          const data = await api<Repo[]>('projects')
          if (active) setRepos(data.filter(repo => repo.name !== 'tracefold-demo/retry-service'))
        }
      } catch (failure) {
        if (active) setError(String(failure instanceof Error ? failure.message : failure))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  },[page,id,repoPath,invalidRoute,refreshVersion])

  useEffect(() => {
    document.title = page === 'testing' || page === 'test-session' ? 'Function testing · Tracefold' : page === 'history' ? 'Saved reports · Tracefold' : page === 'report' ? 'Review report · Tracefold' : page === 'project' ? 'Pull requests · Tracefold' : page === 'connect' ? 'Add repository · Tracefold' : 'Repositories · Tracefold'
    heading.current?.focus()
    window.scrollTo(0, 0)
  },[hash,page])

  useEffect(() => {
    if (page !== 'report' || report?.ai_review?.status !== 'running') return
    let active = true
    const timer = window.setInterval(() => {
      api<Report>('reports/' + encodeURIComponent(id))
        .then(data => { if (active && location.hash === '#report/' + id) setReport(data) })
        .catch(() => { if (active) setError('Could not refresh review status. Reload this report to reconnect.') })
    }, 2500)
    return () => { active = false; window.clearInterval(timer) }
  },[page,id,report?.ai_review?.status])

  async function reviewWithAI() {
    if (!report) return
    const reportId = report.id
    setReviewing(true)
    setError('')
    setReport({...report, ai_review:{...report.ai_review, status:'running', error:undefined}})
    try {
      const updated = await api<Report>('reports/' + reportId + '/ai', {})
      if (location.hash === '#report/' + reportId) setReport(updated)
    } catch (failure) {
      if (location.hash === '#report/' + reportId) {
        setError(failure instanceof Error ? failure.message : String(failure))
        // Re-fetch the durable status. A network failure may occur after the review was saved.
        try {
          const updated = await api<Report>('reports/' + reportId)
          if (location.hash === '#report/' + reportId) setReport(updated)
        } catch {}
      }
    } finally {
      setReviewing(false)
    }
  }

  async function mutate(action: () => Promise<string>, key = 'connect') {
    const origin = location.hash
    setPendingKey(key)
    setPending(true)
    setError('')
    try {
      const destination = await action()
      if (location.hash === origin) location.hash = destination
    } catch (failure) {
      if (location.hash === origin) setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setPending(false)
    }
  }

  const projectLink = (repo:string) => '#project/' + encodeURIComponent(repo)
  const title = page === 'testing' || page === 'test-session' ? 'Function testing' : page === 'connect' ? 'Add repository' :
    page === 'history' ? 'Saved reports' : page === 'project' ? 'Select a pull request' : page === 'report' ? 'Review report' : 'Projects'

  return <>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById("main-content")?.focus() }}>Skip to content</a>
    <header><a className="brand" href="#projects"><span className="mark" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 5h15l-5 5H9v4h5l-5 5H4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><circle cx="18" cy="17" r="2" fill="currentColor"/></svg></span>Tracefold</a><nav aria-label="Main navigation"><a href="#projects" aria-current={page === "projects" ? "page" : undefined}>Repositories</a><a href="#connect" aria-current={page === "connect" ? "page" : undefined}>Add repository</a></nav><span className="workspace">Local AI workspace</span></header>
    <main id="main-content" tabIndex={-1}>
      <p className="eyebrow"><a href="#projects">Workspace</a> / {title}</p>
      <div className="row hero"><h1 tabIndex={-1} ref={heading}>{invalidRoute ? "Page not found" : title}</h1>{(page === '' || page === 'projects') && <a className="button" href="#connect">Add repository →</a>}</div>
      {!invalidRoute && page !== 'testing' && page !== 'test-session' && <ol className="steps" aria-label="Review workflow">
        {['Add repository','Select a pull request','Review with AI'].map((step,index) => <li key={step} className={page === ['connect','project','report'][index] ? 'current' : ''}><span>{index + 1}</span>{step}</li>)}
      </ol>}
      {invalidRoute && <p className="error">This page address is invalid. <a href="#projects">Return to repositories</a>.</p>}
      {!invalidRoute && page !== 'testing' && page !== 'test-session' && <p className="page-help">{page === 'connect' ? 'Paste your public GitHub repository URL, choose a pull request, then run an AI review.' : page === 'history' ? 'Open a saved report to read its AI findings, suggested next steps and code diff.' : page === 'project' ? 'Open a report for the change you want Gemma to review. Previously saved reports are listed below.' : page === 'report' ? 'Inspect the saved change, then request a review from Gemma on the company server.' : 'Choose a connected repository to review one of its pull requests.'}</p>}
      {pending && <p role="status">Working… Your repository or report is being prepared.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p role="status">Loading…</p>}
      {!loading && !error && (page === '' || page === 'projects' ) && repos.length === 0 && <p>No repositories connected. Use Connect repository to get started.</p>}
      {page === 'connect' && !invalidRoute && <form className="surface" onSubmit={event => {
        event.preventDefault()
        void mutate(async () => {
          const repo = await api<Repo>('projects', {repo:repoInput.trim()})
          return projectLink(repo.name)
        })
      }}>
        <h2>Connect a public GitHub repository</h2>
        <p>Paste a repository URL or enter owner/repository. Private repository access requires a GitHub App.</p>
        <label htmlFor="repo-url">GitHub repository</label>
        <div className="row"><input id="repo-url" disabled={pending} required placeholder="https://github.com/owner/repo" value={repoInput} onChange={event => setRepoInput(event.target.value)} />
        <button className="button" disabled={pending}>{pending ? 'Connecting…' : 'Add repository'}</button></div>
      </form>}
      {!invalidRoute && (page === 'testing' || page === 'test-session') && <Workbench key={hash} repo={page === 'testing' ? project : undefined} sessionId={page === 'test-session' ? id : undefined}/>}
      {repos.map(repo => <article className="surface row" key={repo.name}><div><h2>{repo.name}</h2><p>{repo.description}</p></div>
        <div className="row"><a className="button" href={'#testing/' + encodeURIComponent(repo.name)}>Test a function →</a><a className="button secondary" href={'#history/' + encodeURIComponent(repo.name)}>Saved reports →</a><a className="button" href={projectLink(repo.name)}>View pull requests →</a></div>
      </article>)}
      {page === 'history' && !invalidRoute && <>
        <div className="row section"><h2>{project}</h2><a className="button secondary" href={projectLink(project)}>Review another pull request →</a></div>
        {!loading && !error && saved.length === 0 && <p>No saved reports yet. Select a pull request to create your first report.</p>}
        {saved.map(item => <article className="surface row" key={item.id}>
          <div><h2>PR #{item.number} · {item.title}</h2><p>Saved change {item.head?.slice(0,7) || item.id.slice(0,8)} · Report {item.id.slice(0,8)}</p></div>
          <a className="button" href={'#report/' + item.id}>Open review →</a>
        </article>)}
      </>}
      {page === 'project' && !invalidRoute && <>
        <p className="section"><a className="button secondary" href={'#testing/' + encodeURIComponent(project)}>Test a function without a pull request →</a></p>
        <div className="row section"><div><h2>{project}</h2><p>Up to 30 recently updated pull requests, including closed changes.</p></div><button className="button secondary" disabled={pending || loading} onClick={() => setRefreshVersion(value => value + 1)}>Refresh list</button></div>
        {pullError && <p className="error" role="alert">{pullError} Saved reports remain available below.</p>}
        {!loading && !error && !pullError && pulls.length === 0 && <div className="surface empty"><h2>No pull requests to review yet</h2><p>Create a pull request on GitHub and return here, or use another repository with an existing PR.</p><a className="button secondary" href={"https://github.com/" + project + "/pulls"} target="_blank" rel="noreferrer">View pull requests on GitHub ↗</a></div>}
        {pulls.map(pull => <article className="surface row" key={pull.number}><div><h2>#{pull.number} · {pull.title}</h2><p>Base {pull.base.slice(0,7)} / Head {pull.head.slice(0,7)}</p></div>
          <button className="button" disabled={pending} onClick={() => void mutate(async () => {
            const created = await api<Report>('reports',{repo:project,number:pull.number})
            return '#report/' + created.id
          }, String(pull.number))}>{pending && pendingKey === String(pull.number) ? 'Preparing report…' : 'Open change report →'}</button>
        </article>)}
        <h2 className="section">Saved reports</h2>
        {!loading && saved.length === 0 && <p>No saved reports for this repository yet.</p>}
        {saved.map(item => <article className="surface row" key={item.id}><div><h2>#{item.number} · {item.title}</h2><p>Snapshot {item.head?.slice(0,7) || item.id.slice(0,8)} · Report {item.id.slice(0,8)}</p></div><a href={'#report/' + item.id}>Open report →</a></article>)}
      </>}
      {report && <>
        <p className="section"><a href={projectLink(report.repo)}>{report.repo}</a> / PR #{report.number}</p>
        <div className="row"><h2 className="report-title">{report.title}</h2><span className="badge">Saved · {report.source}</span></div>

        <section className="surface ai-section" aria-labelledby="ai-title">
          <div className="row result-header"><div>
            <p className="eyebrow">AI review result</p>
            <h2 id="ai-title" className="result-title">
              {report.ai_review?.result
                ? report.ai_review.result.findings.length + ' potential issue' + (report.ai_review.result.findings.length === 1 ? '' : 's') + ' found'
                : report.ai_review?.status === 'running' ? 'Review in progress'
                : report.ai_review?.status === 'failed' ? 'Review could not finish'
                : 'Ready to review this change'}
            </h2>
          </div>
            <button className="button" disabled={reviewing || report.ai_review?.status === 'running' || report.diff.length > 28000 || !report.diff.trim()}
              onClick={() => void reviewWithAI()}>
              {reviewing || report.ai_review?.status === 'running' ? 'Reviewing with Gemma…' : report.ai_review?.status === 'failed' ? 'Retry AI review' : report.ai_review?.result ? 'Run AI review again' : 'Review with AI'}
            </button>
          </div>
          {!report.ai_review?.result && <p>Ask Gemma to identify potential bugs, explain their impact and suggest fixes. Uses the company network.</p>}
          {!report.diff.trim() && <p className="muted">This report has no text diff for AI review.</p>}
          {report.diff.length > 28000 && <p className="error">This change exceeds the current 28,000-character review limit. Choose a smaller PR.</p>}
          {report.ai_review?.status === 'running' && <p className="progress" role="status">Gemma is reviewing this change. You can refresh this page to check its saved status.</p>}
          {report.ai_review?.status === 'failed' && <p className="error" role="alert">{report.ai_review.error}</p>}
          {report.ai_review?.result && <>
            {report.ai_review.status !== 'completed' && <p className="previous-result">Showing the previous saved result{report.ai_review.status === 'running' ? ' while a new review runs.' : '. The latest attempt failed.'}</p>}
            <p className="result-guidance">{report.ai_review.result.findings.length > 0
              ? 'Check each issue below before merging this change. Each card shows the location, impact and suggested fix.'
              : 'Gemma did not identify a concrete problem in this change. This does not verify that the change is correct.'}</p>
            <p className="review-meta">{report.ai_review.result.model} · Saved {new Date(report.ai_review.result.completed_at).toLocaleString()} · {report.ai_review.result.seconds}s</p>
            {report.ai_review.result.findings.length === 0 && <p className="empty-result">Next step — run your tests and complete a human review before merging.</p>}
            {report.ai_review.result.findings.map((finding,index) => <article className="finding" key={index}>
              <p className="issue-number">Potential issue {index + 1}</p>
              <h3>{finding.title}</h3>
              <dl className="issue-details">
                <div><dt>Where is it?</dt><dd className="location"><code>{finding.file}</code> · Line {finding.line}</dd></div>
                <div><dt>Impact and cause</dt><dd>{finding.explanation}</dd></div>
                <div className="suggestion"><dt>Suggested fix or verification</dt><dd>{finding.suggestion}</dd></div>
              </dl>
            </article>)}
          </>}
          {!report.ai_review && <p className="muted">No AI review saved yet.</p>}
          {report.ai_review?.result && <p className="result-scope">Reviewed the saved code changes only. These are AI suggestions; tests were not run by this review.</p>}
        </section>
        <details className="surface commits"><summary>Compared versions</summary><p>Base <code>{report.base}</code></p><p>Head <code>{report.head}</code></p></details>
        <div className="grid">
          <article className="surface code-panel"><h2>Changed code</h2><p className="muted">Removed lines are red. Added lines are green.</p><pre className="diff-view">{report.diff.split('\n').map((line,index) => <span className={line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('@@') ? 'diff-header' : line.startsWith('+') ? 'diff-added' : line.startsWith('-') ? 'diff-removed' : ''} key={index}>{line || ' '}</span>)}</pre></article>
          <article className="surface"><h2>Test and CI evidence</h2>{report.checks.map(check => <details key={check.version} open={check.status === 'Failed'}>
            <summary>{check.version} · <strong className={check.status.toLowerCase()}>{check.status}</strong></summary><pre>{check.log}</pre>
          </details>)}<p className="muted">{report.checks.length ? "Sample evidence from the GitHub demo fixture." : "Check results have not been imported. This report contains the GitHub diff and commits."}</p></article>
        </div>
      </>}
    </main>
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
