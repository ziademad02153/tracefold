import {useId,useRef,useState} from 'react'
import {api} from './api'

type Preview={repo:string;inventory:string;busy:boolean;counts:Record<string,number>}
export function ProjectActions({repo}:{repo:string}){
  const dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null),submitting=useRef(false)
  const id=useId(),[preview,setPreview]=useState<Preview>(),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  async function load(){setBusy(true);setError('');setPreview(undefined);setConfirmation('');try{setPreview(await api<Preview>('projects/deletion-preview?repo='+encodeURIComponent(repo)))}catch(f){setError(f instanceof Error?f.message:String(f))}finally{setBusy(false)}}
  function open(){dialog.current?.showModal();cancel.current?.focus();void load()}
  async function remove(){if(!preview||confirmation!==repo||preview.busy||submitting.current)return;submitting.current=true;setBusy(true);setError('');try{await api('projects?repo='+encodeURIComponent(repo),{confirmation,inventory:preview.inventory},'DELETE');try{for(const key of Object.keys(sessionStorage))if(key.startsWith('tracefold:suite-draft:'+repo+':'))sessionStorage.removeItem(key)}catch{}dialog.current?.close();location.hash='#projects';window.dispatchEvent(new CustomEvent('tracefold:projects-changed',{detail:repo}))}catch(f){setError(f instanceof Error?f.message:String(f))}finally{submitting.current=false;setBusy(false)}}
  return <div className="project-actions"><a href={'https://github.com/'+repo} target="_blank" rel="noreferrer">View on GitHub ↗</a><button className="button danger-outline" onClick={open} aria-label={'Delete project '+repo}>Delete project</button>
    <dialog ref={dialog} className="project-delete-dialog" aria-labelledby={id+'-title'} aria-describedby={id+'-description'} onCancel={e=>{if(submitting.current)e.preventDefault()}}>
      <h2 id={id+'-title'}>Delete project from Tracefold?</h2><p className="location">{repo}</p><p id={id+'-description'}>This permanently deletes this project's saved tests, run results and AI review reports from Tracefold. Your GitHub repository and its code are not changed.</p>
      <p className="field-help">Downloaded copies of code and prepared test environments stay on this computer. Deleting the project does not free that storage.</p>
      {busy&&!preview&&<p role="status">Loading saved activity before deletion…</p>}
      {error&&<div role="alert" className="error"><p>{error}</p><button className="button secondary" disabled={busy} onClick={()=>void load()}>Reload deletion summary</button></div>}
      {preview&&<><dl className="deletion-counts"><div><dt>Repository suites</dt><dd>{preview.counts.execution_suites}</dd></div><div><dt>Repository runs</dt><dd>{preview.counts.execution_runs}</dd></div><div><dt>Environments</dt><dd>{preview.counts.execution_profiles}</dd></div><div><dt>AI change reports</dt><dd>{preview.counts.reports}</dd></div><div><dt>Focused-file sessions / runs</dt><dd>{preview.counts.test_sessions} / {preview.counts.test_runs}</dd></div></dl>{preview.busy?<p className="notice" role="alert">An unfinished operation blocks deletion. Return to the project and review its status first.</p>:<><label htmlFor={id+'-confirm'}>Type {repo} to confirm</label><input id={id+'-confirm'} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} autoComplete="off" spellCheck={false}/></>}</>}
      <div className="action-group"><button ref={cancel} className="button secondary" disabled={submitting.current} onClick={()=>dialog.current?.close()}>Cancel</button><button className="button danger" disabled={busy||!preview||preview.busy||confirmation!==repo} onClick={()=>void remove()}>{submitting.current?'Deleting project…':'Delete saved project data'}</button></div>
    </dialog>
  </div>
}
