export const repo='qa/example',encoded=encodeURIComponent(repo),stamp='2026-11-05T10:00:00Z'
export const source={repository:repo,revision:'a'.repeat(40),content_hash:'source-content',file_count:12}
const testcase=(id,status)=>({id:'tests/test_price.py::'+id,status,origin:'generated',detail:status==='passed'?'Assertions passed.':'assert 12000 == 8000',seconds:0.01})
export const run1={id:'run-one',status:'passed',started_at:stamp,completed_at:stamp,environment_id:'image-one',profile_hash:'profile-hash',collected:['tests/test_old.py::test_old'],tests:[{id:'tests/test_old.py::test_old',status:'passed',origin:'existing',detail:'Assertions passed.'}],summary:{total:1,passed:1,failed:0,error:0,skipped:0,xfailed:0,xpassed:0,not_run:0}}
export const run2={...run1,id:'run-two',status:'failed',completed_at:'2026-11-05T11:00:00Z',suite_id:'approved',suite_hash:'approved-hash',tests:[testcase('test_price','failed'),testcase('test_zero','passed')],collected:['tests/test_price.py::test_price','tests/test_price.py::test_zero'],summary:{...run1.summary,total:2,passed:1,failed:1}}
export const profile={id:'environment-one',repo,state:'ready',provider_id:'python-pytest',provider_version:'1',requested_ref:'feature/discount',source,profile_hash:'profile-hash',config:{component_root:'.'},created_at:stamp,environment:{id:'image-one',manifest:{suite_execution_version:1},log:'Prepared'},runs:[run1,run2]}
const suite=id=>({id,repo,state:'draft',origin_profile_id:profile.id,origin_source:source,provider_id:'python-pytest',suite_hash:id+'-hash',created_at:stamp,files:[{path:'tests/test_'+id+'.py',content:'from app import price\ndef test_price(): assert price(100,20)==80\n'}],metadata:{title:'Discount '+id,model:'gemma4:e4b',scenarios:[{name:'test_price',description:'The price is reduced by the required percentage.'}]}})
export const suites=[suite('draft-one'),suite('draft-two'),{...suite('approved'),state:'approved'}]
export const catalog={targets:Array.from({length:5},(_,i)=>({id:'src/module'+i+'.py',label:'module'+i,description:'price calculation '+i})),max_selection:3,options:{test_directories:['tests'],default_test_directory:'tests'},environment_ready:true,limits:['Select up to three modules.']}
export const discovery={source,provider_id:'python-pytest',provider_version:'1',discovery:{component_root:'.',project_name:'Example package',runtime_profiles:['3.11'],requires_python:'>=3.11',installable:true,layout:'src',requirements_files:['requirements-tests.txt'],pytest_dependency_files:['requirements-tests.txt'],python_files:4,test_files:1,limits:[]}}
export const report={id:'review-one',repo,number:1,title:'Adjust discount',base:'a'.repeat(40),head:'b'.repeat(40),diff:'- return price + percent\n+ return price - percent',source:'GitHub public repository',checks:[]}
export function clone(v){return structuredClone(v)}
export async function fixture(page,override){
  const state={profile:clone(profile),suites:clone(suites),catalog:clone(catalog),discovery:clone(discovery),posts:[],activityFails:false}
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/api/',''),method=req.method()
    const body=['POST','DELETE'].includes(method)?req.postDataJSON():undefined
    if(['POST','DELETE'].includes(method))state.posts.push({path,body,method})
    const custom=await override?.({path,method,body,state,page})
    if(custom){await route.fulfill(custom);return}
    let data
    if(path==='projects/deletion-preview')data={repo,inventory:'delete-inventory',busy:false,counts:{execution_profiles:1,execution_suites:3,execution_runs:2,reports:1,test_sessions:0,test_runs:0,ai_reviews:1}}
    else if(path==='projects'&&method==='DELETE'){state.deleted=true;data={deleted:repo}}
    else if(path==='projects'&&method==='POST')data={name:repo,description:'Example project'}
    else if(path==='projects')data=state.deleted?[]:[{name:repo,description:'Example project'},{name:'tracefold-demo/retry-service',description:'Hidden fixture'}]
    else if(path==='executions/providers')data=[{id:'python-pytest',version:'1'}]
    else if(path==='executions/activity')data=[{repo,profile_count:1,run_count:2,suite_count:3,latest_run:{...run2,profile_id:profile.id}}]
    else if(path==='testing/overview')data=[{repo,suite_count:200,test_count:500,run_count:100,suites:[],runs:[],latest_run:null}]
    else if(path==='executions/discover')data=state.discovery
    else if(path==='executions/profiles'&&method==='POST'){state.profile={...state.profile,requested_ref:body.requested_ref,environment:undefined,runs:[],state:'draft'};data=state.profile}
    else if(path==='executions/profiles')data=[state.profile]
    else if(path===`executions/profiles/${profile.id}`)data=state.profile
    else if(path.endsWith('/generation-context'))data=state.catalog
    else if(path==='executions/suites')data=state.suites
    else if(path.startsWith('executions/suites/')){
      const [, ,id,action]=path.split('/'),item=state.suites.find(s=>s.id===id)
      if(action==='revise'){item.files=body.files;item.suite_hash='saved-hash'}
      if(action==='approve')item.state='approved'
      data=item
    }else if(path.endsWith('/prepare'))data=state.profile
    else if(path.endsWith('/runs')){state.profile.runs.push({...run2,id:'run-three',status:'passed',summary:{...run2.summary,passed:2,failed:0},tests:run2.tests.map(t=>({...t,status:'passed'}))});data=state.profile}
    else if(path==='reports'||path==='pulls'||path==='testing/sessions'||path==='testing/branches')data=[]
    else if(path==='testing/runner')data={ready:true,message:'Ready'}
    else if(path==='reports/review-one')data=report
    else{await route.fulfill({status:404,json:{detail:'Controlled fixture: route not found'}});return}
    await route.fulfill({json:data})
  })
  return state
}
