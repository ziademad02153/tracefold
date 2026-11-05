"""HTTP adapter for generic execution services. Providers are injected."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from execution_core.contracts import ProviderError


class Discover(BaseModel):
    repo: str
    ref: str = Field(min_length=1, max_length=200)
    provider_id: str
    component: str = '.'


class CreateProfile(BaseModel):
    repo: str
    ref: str = Field(min_length=1, max_length=200)
    provider_id: str
    config: dict
    requested_ref: str|None = Field(default=None,min_length=1,max_length=200)


class ApproveProfile(BaseModel):
    profile_hash: str


class RunProfile(ApproveProfile):
    suite_id: str|None = None
    suite_hash: str|None = None


class GenerateSuite(ApproveProfile):
    request: dict


class RevisionProfile(ApproveProfile):
    ref: str = Field(min_length=1,max_length=200)


class SuiteApproval(BaseModel):
    suite_hash: str


class SuiteRevision(SuiteApproval):
    files: list[dict]


def create_execution_router(service, connected):
    router=APIRouter(prefix='/api/executions')

    def perform(work):
        try:
            return work()
        except ProviderError as failure:
            raise HTTPException(422,str(failure)) from failure

    def profile(key):
        item=perform(lambda:service.get(key))
        connected(item['repo'])
        return item

    def suite(key):
        item=perform(lambda:service.get_suite(key))
        connected(item['repo'])
        return item

    @router.get('/suites')
    def suites(repo:str):
        connected(repo)
        return service.list_suites(repo)

    @router.get('/suites/{key}')
    def read_suite(key:str):
        return suite(key)

    @router.post('/suites/{key}/approve')
    def approve_suite(key:str,request:SuiteApproval):
        suite(key)
        return perform(lambda:service.approve_suite(key,request.suite_hash))

    @router.post('/suites/{key}/revise')
    def revise_suite(key:str,request:SuiteRevision):
        suite(key)
        return perform(lambda:service.revise_suite(key,request.suite_hash,request.files))

    @router.get('/profiles/{key}/generation-context')
    def generation_context(key:str):
        profile(key)
        return perform(lambda:service.generation_context(key))

    @router.post('/profiles/{key}/revision',status_code=201)
    def revision_profile(key:str,request:RevisionProfile):
        item=profile(key)
        if request.profile_hash!=item['profile_hash']:
            raise HTTPException(422,'The reviewed profile changed. Reload before selecting a revision.')
        return perform(lambda:service.create(item['repo'],request.ref,item['provider_id'],item['config']))

    @router.post('/profiles/{key}/suites',status_code=201)
    def generate_suite(key:str,request:GenerateSuite):
        profile(key)
        return perform(lambda:service.generate_suite(key,request.profile_hash,request.request))

    @router.get('/providers')
    def providers():
        return [{'id':p.id,'version':p.version,'capabilities':list(p.capabilities)} for p in service.providers.values()]

    @router.get('/activity')
    def activity(repo:str|None=None):
        if repo is not None:
            connected(repo)
        return service.activity(repo)

    @router.post('/discover')
    def discover(request:Discover):
        connected(request.repo)
        return perform(lambda:service.discover(request.repo,request.ref,request.provider_id,request.component))

    @router.post('/profiles',status_code=201)
    def create(request:CreateProfile):
        connected(request.repo)
        return perform(lambda:service.create(request.repo,request.ref,request.provider_id,request.config,requested_ref=request.requested_ref))

    @router.get('/profiles')
    def list_profiles(repo:str):
        connected(repo)
        return service.list(repo)

    @router.get('/profiles/{key}')
    def read_profile(key:str):
        return profile(key)

    @router.post('/profiles/{key}/prepare')
    def prepare(key:str,request:ApproveProfile):
        profile(key)
        return perform(lambda:service.prepare(key,request.profile_hash))

    @router.post('/profiles/{key}/runs')
    def run(key:str,request:RunProfile):
        profile(key)
        return perform(lambda:service.run(key,request.profile_hash,request.suite_id,request.suite_hash))

    return router
