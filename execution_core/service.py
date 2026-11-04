"""Own profiles, dispatch and persistence; concrete providers are injected."""
from datetime import datetime, timezone
from dataclasses import asdict
from time import time
from uuid import uuid4

from sqlalchemy import Column, JSON, MetaData, String, Table, select, update

from .contracts import Policy, ProviderError, identity, reconcile, checked_payload


def now():
    return datetime.now(timezone.utc).isoformat()


class ExecutionService:
    def __init__(self, engine, providers, snapshots, policy=None):
        self.engine, self.providers, self.snapshots = engine, providers, snapshots
        self.policy = policy or Policy()
        metadata = MetaData()
        self.profiles = Table("execution_profiles", metadata,
                              Column("id", String, primary_key=True), Column("repo", String),
                              Column("payload", JSON), Column("state", String), Column("token", String))
        self.runs = Table("execution_runs", metadata, Column("id", String, primary_key=True),
                          Column("profile_id", String), Column("payload", JSON))
        metadata.create_all(engine)

    def provider(self, key):
        if key not in self.providers:
            raise ProviderError("This provider is not installed. No execution was attempted.")
        return self.providers[key]

    def discover(self, repo, ref, provider_id, component):
        provider = self.provider(provider_id)
        snapshot = self.snapshots(repo, ref)
        return {"source": snapshot.public(), "provider_id": provider.id, "provider_version": provider.version,
                "capabilities": list(provider.capabilities), "discovery": provider.discover(snapshot, component)}

    def create(self, repo, ref, provider_id, config):
        provider = self.provider(provider_id)
        snapshot = self.snapshots(repo, ref)
        validated = checked_payload(provider.validate(snapshot, config), self.policy.output_bytes)
        profile_id = uuid4().hex
        definition = {"contract_version": 1, "provider_id": provider.id, "provider_version": provider.version,
                      "source": snapshot.public(), "config": validated, "policy": asdict(self.policy)}
        payload = {**definition, "profile_hash": identity(definition), "created_at": now(), "environment": None}
        with self.engine.begin() as connection:
            connection.execute(self.profiles.insert().values(id=profile_id, repo=repo, payload=payload, state="draft"))
        return self.get(profile_id)

    def get(self, profile_id):
        with self.engine.connect() as connection:
            row = connection.execute(select(self.profiles).where(self.profiles.c.id == profile_id)).first()
            if row is None:
                raise ProviderError("Execution profile was not found.")
            runs = [{"id": r.id, **r.payload} for r in connection.execute(select(self.runs).where(self.runs.c.profile_id == profile_id))]
        runs.sort(key=lambda r: r["started_at"])
        state = row.state
        if state in ("preparing", "running") and time() - row.payload.get("started_epoch", 0) > self.policy.prepare_seconds + self.policy.run_seconds + 120:
            state = "interrupted"
        return {"id": row.id, "repo": row.repo, "state": state, **row.payload, "runs": runs}

    def list(self, repo):
        with self.engine.connect() as connection:
            ids = list(connection.scalars(select(self.profiles.c.id).where(self.profiles.c.repo == repo)))
        return sorted((self.get(key) for key in ids), key=lambda item:item['created_at'])

    def activity(self, repo=None):
        with self.engine.connect() as connection:
            profiles = connection.execute(select(self.profiles)).all()
            runs = connection.execute(select(self.runs)).all()
        selected = {row.id:row for row in profiles if repo is None or row.repo==repo}
        summaries = {}
        for row in selected.values():
            item=summaries.setdefault(row.repo,{'repo':row.repo,'profile_count':0,'run_count':0,'latest_run':None})
            item['profile_count']+=1
        for row in runs:
            if row.profile_id not in selected:
                continue
            item=summaries[selected[row.profile_id].repo]
            run={key:row.payload.get(key) for key in ['status','completed_at','summary']}
            run.update({'id':row.id,'profile_id':row.profile_id})
            item['run_count']+=1
            if item['latest_run'] is None or run['completed_at']>item['latest_run']['completed_at']:
                item['latest_run']=run
        return list(summaries.values())

    def _claim(self, profile_id, profile_hash, state):
        profile = self.get(profile_id)
        if profile_hash != profile["profile_hash"]:
            raise ProviderError("Profile changed. Reload and approve the exact saved configuration.")
        if profile["state"] in ("preparing", "running"):
            raise ProviderError("An operation is already running for this profile.")
        token = uuid4().hex
        with self.engine.begin() as connection:
            row = connection.execute(select(self.profiles).where(self.profiles.c.id == profile_id)).one()
            if row.state in ("preparing", "running") and time() - row.payload.get("started_epoch", 0) <= self.policy.prepare_seconds + self.policy.run_seconds + 120:
                raise ProviderError("An operation is already running for this profile.")
            changed = connection.execute(update(self.profiles).where(self.profiles.c.id == profile_id,
                self.profiles.c.state == row.state, self.profiles.c.token == row.token).values(
                    state=state, token=token, payload={**row.payload, "started_epoch": time(), "approved_at": now()}))
            if changed.rowcount != 1:
                raise ProviderError("Another operation claimed this profile. Reload it.")
        return profile, token

    def _provider_for(self, profile):
        provider = self.provider(profile["provider_id"])
        if provider.version != profile["provider_version"]:
            raise ProviderError("Provider version changed. Create and approve a new profile.")
        return provider

    def _policy_for(self, profile):
        return Policy(**profile.get('policy', asdict(self.policy)))

    def prepare(self, profile_id, profile_hash):
        if 'prepare-environment' not in self._provider_for(self.get(profile_id)).capabilities:
            raise ProviderError('This provider does not support environment preparation.')
        profile, token = self._claim(profile_id, profile_hash, "preparing")
        try:
            provider = self._provider_for(profile)
            source = self.snapshots(profile["repo"], profile["source"]["revision"])
            if source.public() != profile["source"]:
                raise ProviderError("Saved source identity changed; environment preparation was blocked.")
            environment = checked_payload(provider.prepare(source, profile["config"], self._policy_for(profile)), self.policy.output_bytes)
            if environment.get("status") != "ready" or not environment.get("id"):
                raise ProviderError("Provider did not return a ready environment identity.")
            error = None
        except Exception as failure:
            environment, error = None, str(failure) if isinstance(failure, ProviderError) else "Environment preparation failed. Check the runner and retry."
        with self.engine.begin() as connection:
            row = connection.execute(select(self.profiles).where(self.profiles.c.id == profile_id)).one()
            connection.execute(update(self.profiles).where(self.profiles.c.id == profile_id, self.profiles.c.token == token).values(
                state="ready" if environment else "blocked", payload={**row.payload, "environment": environment, "error": error}))
        return self.get(profile_id)

    def run(self, profile_id, profile_hash):
        existing = self.get(profile_id)
        provider=self._provider_for(existing)
        if not {'collect-existing','run-existing'}.issubset(provider.capabilities):
            raise ProviderError('This provider does not support collecting and running existing tests.')
        if not existing.get("environment"):
            raise ProviderError("Prepare the approved environment before running existing tests.")
        profile, token = self._claim(profile_id, profile_hash, "running")
        started = now()
        try:
            source = self.snapshots(profile["repo"], profile["source"]["revision"])
            if source.public() != profile["source"]:
                raise ProviderError("Source identity changed. Execution was blocked.")
            policy = self._policy_for(profile)
            result = reconcile(self._provider_for(profile).execute(source, profile["config"], profile["environment"], policy), policy)
        except Exception as failure:
            result = {"status": "blocked", "error": str(failure) if isinstance(failure, ProviderError) else "Execution could not complete. Check the runner.",
                      "collected": [], "tests": [], "exit_code": None}
        payload = {**result, "source": profile["source"], "profile_hash": profile_hash,
                   "environment_id": profile["environment"]["id"], "provider_id": profile["provider_id"],
                   "environment_snapshot": profile["environment"],
                   "provider_version": profile["provider_version"], "started_at": started, "completed_at": now()}
        with self.engine.begin() as connection:
            connection.execute(self.runs.insert().values(id=uuid4().hex, profile_id=profile_id, payload=payload))
            connection.execute(update(self.profiles).where(self.profiles.c.id == profile_id, self.profiles.c.token == token).values(state="ready"))
        return self.get(profile_id)
