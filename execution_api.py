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


class ApproveProfile(BaseModel):
    profile_hash: str


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
        return perform(lambda:service.create(request.repo,request.ref,request.provider_id,request.config))

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
    def run(key:str,request:ApproveProfile):
        profile(key)
        return perform(lambda:service.run(key,request.profile_hash))

    return router
