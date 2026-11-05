export async function api<T>(path:string, body?:object, method='POST'):Promise<T> {
  let response:Response
  try {response = await fetch('/api/' + path, body && {
    method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
  })}catch{throw new Error('Could not reach the local Tracefold service. Make sure Tracefold is running, then retry. Your saved work has not been deleted.')}
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    const validation=Array.isArray(detail?.detail)?detail.detail.map((issue:{loc?:string[];msg?:string})=>[issue.loc?.filter(v=>v!=='body').join(' → '),issue.msg].filter(Boolean).join(': ')).join('; '):''
    throw new Error(typeof detail?.detail === 'string' ? detail.detail : validation||'Request failed. Check the local service and try again.')
  }
  return response.json()
}
