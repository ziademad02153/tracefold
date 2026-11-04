import type { ComponentType } from 'react'

export type Source = {repository:string;revision:string;content_hash:string;file_count:number}
export type ExecutionActivity = {repo:string;profile_count:number;run_count:number;latest_run:{id:string;profile_id:string;status:string;completed_at:string;summary?:Record<string,number>}|null}
export type NativeTest = {id:string;status:string;detail:string;seconds?:number}
export type ExecutionRun = {id:string;status:string;started_at:string;completed_at:string;environment_id:string;profile_hash:string;
  summary?:Record<string,number>;tests:NativeTest[];collected:string[];log?:string;error?:string;
  effective_config?:unknown;collection_errors?:unknown[];collection_skips?:unknown[];artifacts?:{name:string;media_type:string;sha256:string;content:string}[]}
export type ExecutionProfile = {id:string;repo:string;state:string;provider_id:string;provider_version:string;source:Source;
  profile_hash:string;config:Record<string,unknown>;error?:string;created_at:string;
  environment?:{id:string;target?:string;manifest?:unknown;log?:string};runs:ExecutionRun[]}
export type Discovery = {source:Source;provider_id:string;provider_version:string;discovery:Record<string,unknown>}
export type EditorProps = {value:Record<string,unknown>;onChange:(value:Record<string,unknown>)=>void;disabled:boolean;discovery:Record<string,unknown>}
export type ProviderView = {label:string;defaults:(discovery:Record<string,unknown>)=>Record<string,unknown>;Editor:ComponentType<EditorProps>}
