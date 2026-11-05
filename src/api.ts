export async function api<T>(path:string, body?:object, method='POST'):Promise<T> {
  const response = await fetch('/api/' + path, body && {
    method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(typeof detail?.detail === 'string' ? detail.detail : 'Request failed. Check the backend and try again.')
  }
  return response.json()
}
