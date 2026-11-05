export function draftKey(repo:string,id:string,hash:string){return 'tracefold:suite-draft:'+repo+':'+id+':'+hash}
export function readDraft(key:string):string|undefined{
  try{const value=sessionStorage.getItem(key);return value!==null&&value.length<=25000?value:undefined}catch{return undefined}
}
export function keepDraft(key:string,code:string){try{sessionStorage.setItem(key,code);return true}catch{return false}}
export function clearDraft(key:string){try{sessionStorage.removeItem(key)}catch{/* Browser storage can be unavailable. */}}
