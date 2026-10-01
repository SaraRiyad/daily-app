import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyStore, seed, type Store } from '../state/model';
import { cacheKey, DailySync, freshEnvelope, readEnvelope, type SaveRequest, type Snapshot } from '../state/sync';
import { acquireAccountCacheLock, type CacheLocks } from '../state/cacheLock';

const snap = (workspace = emptyStore('Real account'), revision = 0): Snapshot => ({ workspace, revision, updatedAt: new Date().toISOString() });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const tick = () => new Promise<void>(done => setTimeout(done, 0));
function fixture(options: {
  remote?: Snapshot; save?: (input: SaveRequest) => Promise<unknown>;
  fetch?: () => Promise<unknown>; initial?: string;
} = {}) {
  const records = new Map<string, string>();
  let failStorage = false;
  let remote = options.remote ?? snap();
  const calls: SaveRequest[] = [];
  let unauthorized = 0;
  const storage = {
    getItem: async (key: string) => records.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (failStorage) throw new Error('Storage full');
      records.set(key, value);
    },
  };
  const engine = new DailySync(options.initial ? readEnvelope('account-a', options.initial) : freshEnvelope('account-a', remote), {
    storage, changed: () => {}, unauthorized: () => { unauthorized++; },
    fetch: options.fetch ?? (async () => remote),
    save: async input => {
      // Every attempt must have the precise immutable request durably stored.
      const disk = JSON.parse(records.get(cacheKey('account-a'))!);
      assert.deepEqual(disk.pending, input);
      calls.push(input);
      if (options.save) return options.save(input);
      remote = snap(input.workspace, input.revision + 1);
      return remote;
    },
  });
  return {
    engine, records, calls, storage, setFailure: (value: boolean) => { failStorage = value; },
    setRemote: (value: Snapshot) => { remote = value; }, unauthorized: () => unauthorized,
  };
}

test('new accounts contain no seed and cannot read another account outbox', () => {
  const fresh = freshEnvelope('account-a', snap());
  assert.deepEqual(fresh.draft.jobs, []);
  assert.deepEqual(fresh.draft.tasks, []);
  assert.deepEqual(fresh.draft.transactions, []);
  assert.equal(fresh.draft.active, null);
  assert.throws(() => readEnvelope('account-b', JSON.stringify(fresh)), /another account/);
  assert.throws(() => readEnvelope('account-a', JSON.stringify({ ...fresh, draft: { ...fresh.draft, name: 'Untracked edit' } })));
});

test('response loss retries the same mutationId/revision after restart', async () => {
  let committed: Snapshot | null = null;
  const first = fixture({ save: async input => {
    committed = snap(input.workspace, 1);
    throw new Error('Response lost after commit');
  } });
  first.engine.update(s => ({ ...s, name: 'A real edit' }));
  await first.engine.flush();
  assert.equal(first.engine.status, 'Error');
  assert.equal(first.engine.pending, true);
  const before = first.calls[0];
  const second = fixture({
    initial: first.records.get(cacheKey('account-a')),
    save: async input => { assert.deepEqual(input, before); return committed; },
  });
  await second.engine.flush();
  assert.equal(second.calls[0].mutationId, before.mutationId);
  assert.equal(second.calls[0].revision, 0);
  assert.equal(second.engine.status, 'Saved');
  assert.equal(second.engine.envelope.server.revision, 1);
  assert.equal(second.engine.envelope.draft.name, 'A real edit');
});

test('edits made during a request are serialized as a new acknowledged revision', async () => {
  const response = deferred<Snapshot>();
  const started = deferred<void>();
  let calls = 0;
  const f = fixture({ save: async input => {
    calls++;
    if (calls === 1) { started.resolve(); return response.promise; }
    return snap(input.workspace, input.revision + 1);
  } });
  f.engine.update(s => ({ ...s, name: 'First edit' }));
  const work = f.engine.flush();
  await started.promise;
  f.engine.update(s => ({ ...s, name: 'Second edit', tasks: [{ id: 'real-task', title: 'A real task', due: '2026-01-20', priority: 'High', done: false }] }));
  assert.equal(f.calls.length, 1);
  response.resolve(snap(f.calls[0].workspace, 1));
  await work;
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].revision, 1);
  assert.notEqual(f.calls[1].mutationId, f.calls[0].mutationId);
  assert.equal(f.engine.envelope.draft.name, 'Second edit');
  assert.equal(f.engine.envelope.draft.tasks.length, 1);
  assert.equal(f.engine.status, 'Saved');
});

test('local storage failure prevents all upload and logout, retry keeps draft', async () => {
  const f = fixture();
  f.setFailure(true);
  f.engine.update(s => ({ ...s, name: 'Memory-only edit' }));
  await f.engine.flush();
  assert.equal(f.calls.length, 0);
  assert.equal(f.engine.status, 'Error');
  await assert.rejects(f.engine.prepareLogout());
  assert.equal(f.engine.locked, false);
  assert.equal(f.engine.envelope.draft.name, 'Memory-only edit');
  f.setFailure(false);
  await f.engine.retry();
  assert.equal(f.engine.status, 'Saved');
  assert.equal(f.engine.envelope.draft.name, 'Memory-only edit');
});

test('409 survives restart, blocks retries, and reload preserves complete draft backup', async () => {
  const local = seed();
  local.entered = true;
  local.active = { jobId: local.selectedJob, start: Date.now(), normal: 5, overtime: 7 };
  const f = fixture({ save: async () => { throw { status: 409, data: { error: 'Conflict' } }; } });
  f.engine.update(() => local);
  await f.engine.flush();
  assert.equal(f.engine.status, 'Conflict');
  await f.engine.retry();
  assert.equal(f.calls.length, 1);
  await assert.rejects(f.engine.prepareLogout());
  const restored = fixture({ initial: f.records.get(cacheKey('account-a')), remote: snap(emptyStore('Remote account'), 3) });
  assert.equal(restored.engine.status, 'Conflict');
  assert.ok(restored.engine.error); // Conflict controls remain visible on restart.
  await restored.engine.flush();
  assert.equal(restored.calls.length, 0);
  await restored.engine.reloadServer();
  assert.equal(restored.engine.status, 'Saved');
  assert.equal(restored.engine.envelope.draft.name, 'Remote account');
  const backup = JSON.parse(restored.records.get(restored.engine.envelope.backupKey!)!);
  assert.deepEqual(backup.draft, local);
  assert.deepEqual(backup.pending.workspace, local);
});

test('reload cannot discard conflict draft when backup storage fails', async () => {
  const f = fixture({ save: async () => { throw { status: 409 }; } });
  f.engine.update(s => ({ ...s, name: 'Keep this draft' }));
  await f.engine.flush();
  f.setFailure(true);
  await f.engine.reloadServer();
  assert.equal(f.engine.envelope.draft.name, 'Keep this draft');
  assert.equal(f.engine.envelope.conflict, true);
});

test('a late refresh response cannot overwrite an edit', async () => {
  const response = deferred<Snapshot>();
  const f = fixture({ fetch: () => response.promise, save: async () => { throw new Error('Offline'); } });
  const refresh = f.engine.refresh();
  f.engine.update(s => ({ ...s, name: 'Unsent local change' }));
  response.resolve(snap(emptyStore('Late server copy'), 4));
  await refresh;
  await f.engine.flush();
  assert.equal(f.engine.envelope.draft.name, 'Unsent local change');
  assert.equal(f.engine.pending, true);
});

test('auth expiration retains exact pending request, and disposal ignores late acknowledgements', async () => {
  const f = fixture({ save: async () => { throw { status: 401 }; } });
  f.engine.update(s => ({ ...s, name: 'Pending same-owner edit' }));
  await f.engine.flush();
  assert.equal(f.unauthorized(), 1);
  assert.equal(f.engine.locked, true);
  assert.ok(JSON.parse(f.records.get(cacheKey('account-a'))!).pending);
  const response = deferred<Snapshot>(), started = deferred<void>();
  const second = fixture({ save: async () => { started.resolve(); return response.promise; } });
  second.engine.update(s => ({ ...s, name: 'Before account switch' }));
  const work = second.engine.flush();
  await started.promise;
  second.engine.dispose();
  response.resolve(snap(emptyStore('Wrong late result'), 1));
  await work;
  assert.equal(second.engine.envelope.draft.name, 'Before account switch');
  assert.ok(second.engine.envelope.pending);
});

test('legacy import is explicit, exact, empty-account-only, and leaves source untouched', async () => {
  const legacy: Store = seed();
  legacy.active = { jobId: legacy.selectedJob, start: Date.now(), normal: 5, overtime: 7 };
  const original = JSON.stringify(legacy);
  const f = fixture();
  await tick();
  assert.equal(f.calls.length, 0); // Auth/cache construction never imports.
  await f.engine.importLegacy(legacy);
  assert.equal(f.engine.envelope.imported, true);
  assert.deepEqual(f.calls[0].workspace, { ...legacy, entered: true });
  assert.equal(JSON.stringify(legacy), original);
  assert.equal(f.engine.status, 'Saved');
  await assert.rejects(f.engine.importLegacy(legacy), /empty/);
  const populated = fixture({ remote: snap(seed()) });
  await assert.rejects(populated.engine.importLegacy(legacy), /empty/);
  assert.equal(populated.calls.length, 0);
});

test('logout freezes edits and only proceeds after a durable server acknowledgement', async () => {
  const started = deferred<void>(), response = deferred<Snapshot>();
  const f = fixture({ save: async input => { started.resolve(); return response.promise; } });
  f.engine.update(s => ({ ...s, name: 'Save before logout' }));
  const logout = f.engine.prepareLogout();
  await started.promise;
  assert.equal(f.engine.update(s => ({ ...s, name: 'Too late' })), false);
  response.resolve(snap(f.calls[0].workspace, 1));
  await logout;
  assert.equal(f.engine.pending, false);
  assert.equal(f.engine.status, 'Saved');
  assert.equal(JSON.parse(f.records.get(cacheKey('account-a'))!).dirty, false);
});

test('staged forms pause refresh, including responses that were already in flight', async () => {
  const response = deferred<Snapshot>();
  const f = fixture({ fetch: () => response.promise });
  const refresh = f.engine.refresh();
  const release = f.engine.holdRefresh();
  response.resolve(snap(emptyStore('Changed by another device'), 5));
  await refresh;
  assert.equal(f.engine.envelope.server.revision, 0);
  await f.engine.refresh();
  assert.equal(f.engine.envelope.draft.name, 'Real account');
  release();
  await tick();
  assert.equal(f.engine.envelope.server.revision, 5);
});

test('a failed import is not marked imported until server acknowledgement', async () => {
  let offline = true;
  const f = fixture({ save: async input => {
    if (offline) throw new Error('Offline');
    return snap(input.workspace, 1);
  } });
  await f.engine.importLegacy(seed());
  assert.equal(f.engine.envelope.imported, false);
  assert.equal(f.engine.envelope.importPending, true);
  assert.equal(f.engine.status, 'Error');
  offline = false;
  await f.engine.retry();
  assert.equal(f.engine.envelope.imported, true);
  assert.equal(f.engine.envelope.importPending, false);
  assert.equal(f.engine.status, 'Saved');
});

for (const code of [400, 413]) {
  test(`definitive ${code} blocks obsolete retries, preserves a newer draft, and permits an explicit corrected save`, async () => {
    const acknowledged = deferred<Snapshot>(), started = deferred<void>();
    let count = 0;
    const f = fixture({ save: async input => {
      if (++count === 1) throw { status: code, data: { error: 'Request rejected without committing' } };
      started.resolve();
      return acknowledged.promise;
    } });
    f.engine.update(s => ({ ...s, name: 'Rejected original' }));
    await f.engine.flush();
    const old = f.calls[0];
    assert.ok(f.engine.envelope.rejected);
    f.engine.update(s => ({ ...s, name: 'Corrected latest', tasks: [{ id: 'latest-task', title: 'Keep this newer task', due: '2026-01-20', priority: 'High', done: false }] }));
    await f.engine.persist();
    await f.engine.retry();
    assert.equal(f.calls.length, 1);
    assert.equal(f.engine.envelope.pending!.mutationId, old.mutationId);
    assert.ok(readEnvelope('account-a', f.records.get(cacheKey('account-a'))!).rejected);
    await assert.rejects(f.engine.prepareLogout());
    const recovery = f.engine.retryCorrectedDraft();
    await started.promise;
    assert.equal(f.engine.status, 'Error'); // Never clear merely by correcting.
    assert.notEqual(f.calls[1].mutationId, old.mutationId);
    assert.equal(f.calls[1].revision, 0);
    assert.equal(f.calls[1].workspace.name, 'Corrected latest');
    const backup = JSON.parse(f.records.get(f.engine.envelope.backupKey!)!);
    assert.deepEqual(backup.pending, old);
    assert.deepEqual(backup.draft, f.calls[1].workspace);
    acknowledged.resolve(snap(f.calls[1].workspace, 1));
    await recovery;
    assert.equal(f.engine.status, 'Saved');
    assert.equal(f.engine.envelope.draft.tasks[0].id, 'latest-task');
    await f.engine.prepareLogout();
  });
}

test('correction recovery cannot replace an uncertain network request', async () => {
  const f = fixture({ save: async () => { throw { status: 503 }; } });
  f.engine.update(s => ({ ...s, name: 'Uncertain candidate' }));
  await f.engine.flush();
  const id = f.engine.envelope.pending!.mutationId;
  await assert.rejects(f.engine.retryCorrectedDraft(), /Uncertain requests/);
  assert.equal(f.engine.envelope.pending!.mutationId, id);
  await f.engine.retry();
  assert.equal(f.calls[1].mutationId, id);
});

test('definitively rejected legacy import can be abandoned only with an intact full backup', async () => {
  const original = seed(), rawOriginal = JSON.stringify(original);
  const f = fixture({ save: async () => { throw { status: 413 }; } });
  await f.engine.importLegacy(original);
  assert.ok(f.engine.envelope.rejected);
  assert.equal(f.engine.envelope.imported, false);
  f.setFailure(true);
  await f.engine.reloadServer();
  assert.deepEqual(f.engine.envelope.draft, { ...original, entered: true });
  f.setFailure(false);
  await f.engine.reloadServer();
  assert.deepEqual(f.engine.envelope.draft.jobs, []);
  assert.equal(f.engine.envelope.rejected, null);
  const backup = JSON.parse(f.records.get(f.engine.envelope.backupKey!)!);
  assert.deepEqual(backup.draft, { ...original, entered: true });
  assert.equal(JSON.stringify(original), rawOriginal);
  await f.engine.prepareLogout();
});

test('central validation rejects oversized or invalid mutating edits without throwing or changing data', async () => {
  const f = fixture();
  const original = JSON.stringify(f.engine.envelope);
  let accepted = true;
  assert.doesNotThrow(() => { accepted = f.engine.update(s => {
    s.jobs = Array.from({ length: 101 }, (_, i) => ({ id: `job-${i}`, name: `Job ${i}`, description: '', icon: 'briefcase', normal: 10, overtime: 15 }));
    s.selectedJob = 'job-0';
    return s;
  }); });
  assert.equal(accepted, false);
  assert.equal(JSON.stringify(f.engine.envelope), original);
  assert.ok(f.engine.error);
  assert.equal(f.calls.length, 0);
  assert.equal(f.engine.update(s => ({ ...s, name: '' })), false);
  assert.equal(f.engine.envelope.draft.name, 'Real account');
});

function fakeLocks(): CacheLocks {
  const held = new Set<string>();
  return { request: async (name, options, callback) => {
    assert.equal(options.mode, 'exclusive');
    assert.equal(options.ifAvailable, true);
    await tick();
    if (held.has(name)) { await callback(null); return; }
    held.add(name);
    try { await callback({ name }); } finally { held.delete(name); }
  } };
}

test('exclusive Web Locks prevent a clean second tab overwriting an offline same-account outbox', async () => {
  const locks = fakeLocks(), shared = new Map<string, string>();
  let writes = 0;
  const storage = {
    getItem: async (key: string) => shared.get(key) ?? null,
    setItem: async (key: string, text: string) => { writes++; shared.set(key, text); },
  };
  const open = async () => {
    const lease = await acquireAccountCacheLock('account-a', locks);
    const raw = await storage.getItem(cacheKey('account-a'));
    const engine = new DailySync(raw ? readEnvelope('account-a', raw) : freshEnvelope('account-a', snap()), {
      storage, changed: () => {}, unauthorized: () => {},
      save: async () => { throw new Error('Offline'); },
      fetch: async () => snap(emptyStore('A clean tab could overwrite offline edits'), 8),
    });
    return { engine, close: async () => { engine.dispose(); await engine.settledWrites(); await lease.release(); } };
  };
  const first = await open();
  first.engine.update(s => ({ ...s, name: 'Keep this offline tab edit' }));
  await first.engine.flush();
  const pending = shared.get(cacheKey('account-a'))!, beforeWrites = writes;
  await assert.rejects(open(), /another Daily tab/);
  assert.equal(writes, beforeWrites);
  assert.equal(shared.get(cacheKey('account-a')), pending);
  // An unrelated owner has a different exclusive cache, never pseudo-locks.
  const other = await acquireAccountCacheLock('account-b', locks);
  await other.release();
  await first.close();
  const next = await open();
  assert.equal(next.engine.envelope.draft.name, 'Keep this offline tab edit');
  assert.deepEqual(next.engine.envelope.pending, JSON.parse(pending).pending);
  await next.close();
});

test('browsers without real Web Locks fail explicitly rather than using unsafe shared cache writes', async () => {
  await assert.rejects(acquireAccountCacheLock('account-a'), /Web Locks are unavailable/);
});

test('a disposed cache writer cannot enqueue late writes after releasing its browser lease', async () => {
  const started = deferred<void>(), response = deferred<Snapshot>();
  const f = fixture({ save: async input => { started.resolve(); return response.promise; } });
  f.engine.update(s => ({ ...s, name: 'Pending before tab closes' }));
  const work = f.engine.flush();
  await started.promise;
  f.engine.dispose(); await f.engine.settledWrites();
  const disk = f.records.get(cacheKey('account-a'));
  await assert.rejects(f.engine.persist(), /writer is closed/);
  response.resolve(snap(f.calls[0].workspace, 1));
  await work;
  assert.equal(f.records.get(cacheKey('account-a')), disk);
});