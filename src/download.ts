export function downloadText(name:string,text:string,type='text/plain;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([text],{type}))
  const link=document.createElement('a');link.href=url;link.download=name.replace(/[^a-zA-Z0-9._-]/g,'_');document.body.append(link);link.click();link.remove()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
