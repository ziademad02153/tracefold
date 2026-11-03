import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

type Repo = {name:string; description:string}
type Pull = {number:number; title:string; base:string; head:string}
type Saved = Pick<Pull,'number'|'title'> & {id:string}
type Report = Pull & {id:string; repo:string; diff:string; source:string; checks:{version:string; status:string; log:string}[]}

async function api<T>(path:string, body?:object):Promise<T> {
  const response = await fetch('/api/' + path, body && {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(typeof detail?.detail === 'string' ? detail.detail : 'Request failed. Check the backend and try again.')
  }
  return response.json()
}

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
  const [page, id=''] = hash.split('/')
  const project = page === 'project' ? decodeURIComponent(id) : ''
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
    async function load() {
      try {
        if (page === 'report') {
          const data = await api<Report>('reports/' + encodeURIComponent(id))
          if (active) setReport(data)
        } else if (page === 'project') {
          const [pullData,savedData] = await Promise.all([
            api<Pull[]>('pulls?' + repoPath),api<Saved[]>('reports?' + repoPath),
          ])
          if (active) { setPulls(pullData); setSaved(savedData) }
        } else {
          const data = await api<Repo[]>(page === 'connect' ? 'repositories' : 'projects')
          if (active) setRepos(data)
        }
      } catch (failure) {
        if (active) setError(String(failure instanceof Error ? failure.message : failure))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  },[page,id,repoPath])

  async function mutate(action: () => Promise<string>) {
    setPending(true)
    setError('')
    try {
      location.hash = await action()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setPending(false)
    }
  }

  const projectLink = (repo:string) => '#project/' + encodeURIComponent(repo)
  const title = page === 'connect' ? 'Connect repository' :
    page === 'project' ? 'Pull requests' : page === 'report' ? 'Review report' : 'Projects'

  return <>
    <header><a className="brand" href="#projects"><span className="mark" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 5h15l-5 5H9v4h5l-5 5H4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><circle cx="18" cy="17" r="2" fill="currentColor"/></svg></span>Tracefold</a><span className="workspace">Engineering workspace</span></header>
    <main>
      <p className="eyebrow"><a href="#projects">Workspace</a> / {title}</p>
      <div className="row hero"><h1>{title}</h1>{(page === '' || page === 'projects') && <a className="button" href="#connect">Connect repository →</a>}</div>
      <p className="muted">GitHub workspace · public repositories and a separate demo</p>
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p role="status">Loading…</p>}
      {!loading && !error && (page === '' || page === 'projects' || page === 'connect') && repos.length === 0 && <p>No repositories connected. Use Connect repository to get started.</p>}
      {page === 'connect' && <form className="surface" onSubmit={event => {
        event.preventDefault()
        void mutate(async () => {
          const repo = await api<Repo>('projects', {repo:repoInput.trim()})
          return projectLink(repo.name)
        })
      }}>
        <h2>Connect a public GitHub repository</h2>
        <p>Paste a repository URL or enter owner/repository. Private repository access requires a GitHub App.</p>
        <label htmlFor="repo-url">GitHub repository</label>
        <div className="row"><input id="repo-url" required placeholder="https://github.com/owner/repo" value={repoInput} onChange={event => setRepoInput(event.target.value)} />
        <button className="button" disabled={pending}>Connect repository</button></div>
      </form>}
      {repos.map(repo => <article className="surface row" key={repo.name}><div><h2>{repo.name}</h2><p>{repo.description}</p></div>
        {page === 'connect' ? <button className="button" disabled={pending} onClick={() => void mutate(async () => {
          await api<Repo>('projects',{repo:repo.name})
          return projectLink(repo.name)
        })}>Try demo</button> : <a className="button" href={projectLink(repo.name)}>View pull requests →</a>}
      </article>)}
      {page === 'project' && <>
        <h2 className="section">{project}</h2>
        {!loading && !error && pulls.length === 0 && <p>No pull requests found for this repository.</p>}
        {pulls.map(pull => <article className="surface row" key={pull.number}><div><h2>#{pull.number} · {pull.title}</h2><p>Base {pull.base.slice(0,7)} / Head {pull.head.slice(0,7)}</p></div>
          <button className="button" disabled={pending} onClick={() => void mutate(async () => {
            const created = await api<Report>('reports',{repo:project,number:pull.number})
            return '#report/' + created.id
          })}>Create review report →</button>
        </article>)}
        <h2 className="section">Saved reports</h2>
        {!loading && saved.length === 0 && <p>No saved reports for this repository yet.</p>}
        {saved.map(item => <article className="surface row" key={item.id}><h2>#{item.number} · {item.title}</h2><a href={'#report/' + item.id}>Open report →</a></article>)}
      </>}
      {report && <>
        <p className="section"><a href={projectLink(report.repo)}>{report.repo}</a> / PR #{report.number}</p>
        <div className="row"><h2 className="report-title">{report.title}</h2><span className="badge">Saved · {report.source}</span></div>
        <div className="surface commits"><p>Base <code>{report.base}</code></p><p>Head <code>{report.head}</code></p><p>Model review <strong>Unavailable</strong></p></div>
        <div className="grid">
          <article className="surface"><h2>Changed code</h2><pre>{report.diff}</pre></article>
          <article className="surface"><h2>Check evidence</h2>{report.checks.map(check => <details key={check.version} open={check.status === 'Failed'}>
            <summary>{check.version} · <strong className={check.status.toLowerCase()}>{check.status}</strong></summary><pre>{check.log}</pre>
          </details>)}<p className="muted">{report.checks.length ? "Sample evidence from the GitHub demo fixture." : "Check results have not been imported. This report contains the GitHub diff and commits."}</p></article>
        </div>
      </>}
    </main>
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
