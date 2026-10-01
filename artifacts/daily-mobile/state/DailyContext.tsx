import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import {
  getDailyAccount, getDailyWorkspace, logoutDailyAccount, saveDailyWorkspace,
  useLoginDailyAccount, useRegisterDailyAccount,
} from '@workspace/api-client-react';
import { emptyStore, storeSchema, uid, type Store, type Session, type Job } from './model';
import {
  DailySync, LEGACY_KEY, cacheKey, errorMessage, freshEnvelope, isEmptyWorkspace,
  readEnvelope, statusCode, type Snapshot, type SyncStatus,
} from './sync';
import { getBearer, readSession, setBearer, writeSession } from './session';
import { exportJson } from './export';
import { acquireAccountCacheLock, type CacheLease } from './cacheLock';

type Account = { id: string; email: string; createdAt: string };
type Context = {
  data: Store; account: Account | null; authenticated: boolean; now: number; hydrated: boolean;
  error: string; authError: string; busy: boolean; syncStatus: SyncStatus; locked: boolean;
  conflict: boolean; rejected: boolean; legacy: Store | null; legacyError: string; canImport: boolean; backupKey: string | null;
  recoveryAvailable: boolean; exportRecovery: () => Promise<string>;
  canRecoverServer: boolean; recoverServerCache: () => Promise<void>;
  holdRefresh: () => () => void;
  retry: () => void; reloadServer: () => Promise<void>; retryCorrectedDraft: () => Promise<void>; importLegacy: () => Promise<void>;
  authenticate: (mode: 'signin' | 'signup', email: string, password: string, name?: string) => Promise<boolean>;
  logout: () => Promise<void>; update: (fn: (s: Store) => Store) => boolean;
  clockIn: () => boolean; clockOut: () => Session | null; selectJob: (id: string) => void;
  saveJob: (job: Job) => boolean; deleteJob: (id: string) => boolean;
};
const DailyContext = createContext<Context | null>(null);
const blank = () => emptyStore('Daily');
const fallback = 'Daily could not connect. Check your connection and try again. Your stored data has not been replaced.';
// Bound each request to the captured session, including during auth transitions.
// Timeout preserves the immutable outbox for idempotent retries.
async function request<T>(token: string, fn: (options: RequestInit) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try { return await fn({ headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

export function DailyProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const authRequest = useRef<RequestInit>({});
  const login = useLoginDailyAccount({ request: authRequest.current, mutation: { retry: false, gcTime: 0 } });
  const register = useRegisterDailyAccount({ request: authRequest.current, mutation: { retry: false, gcTime: 0 } });
  const [data, setData] = useState<Store>(blank);
  const [account, setAccount] = useState<Account | null>(null);
  const owner = useRef<Account | null>(null);
  const engine = useRef<DailySync | null>(null);
  const cacheLease = useRef<CacheLease | null>(null);
  const recoveryWrites = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);
  const authBusy = useRef(false);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [gateError, setGateError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [, redraw] = useState(0);
  const [legacy, setLegacy] = useState<Store | null>(null);
  const [legacyError, setLegacyError] = useState('');
  const [recoveryOwner, setRecoveryOwner] = useState<Account | null>(null);
  const recoveryWrite = async (who: Account, gen: number, key: string, text: string) => {
    if (gen !== generation.current) throw new Error('The recovery writer is closed.');
    const queued = recoveryWrites.current.catch(() => {}).then(async () => {
      if (gen !== generation.current || (Platform.OS === 'web' && cacheLease.current?.owner !== who.id)) throw new Error('The recovery writer no longer owns this account cache.');
      await AsyncStorage.setItem(key, text);
    });
    recoveryWrites.current = queued;
    await queued;
  };

  const publish = (source: DailySync) => {
    if (engine.current !== source || owner.current?.id !== source.envelope.owner) return;
    setData(source.envelope.draft); redraw(n => n + 1);
  };
  const expire = (source: DailySync, gen: number) => {
    if (engine.current !== source || generation.current !== gen) return;
    generation.current++;
    source.locked = true;
    authBusy.current = false; setBusy(false);
    // Retain the in-memory engine as well as its account-scoped durable outbox.
    // Reauthentication must persist it before replacing it.
    owner.current = null; setAccount(null); setData(blank());
    setBearer(null); queryClient.clear();
    setAuthError('Your session expired. Sign in to the same account to resume pending changes. Other accounts cannot access this draft.');
    setHydrated(true);
  };
  const activate = async (who: Account, snapshot: Snapshot | undefined, token: string, gen: number) => {
    if (gen !== generation.current) return;
    setRecoveryOwner(who);
    const previous = engine.current;
    // Never replace an engine containing memory-only edits until they are safe.
    if (previous && !previous.disposed) {
      try { await previous.persist(); }
      catch { throw new Error('This account’s pending device data could not be stored. Keep Daily open and free device storage before retrying. No draft has been discarded.'); }
    }
    if (gen !== generation.current) return;
    if (previous) {
      previous.dispose();
      await previous.settledWrites();
      if (engine.current === previous) engine.current = null;
    }
    if (gen !== generation.current) return;
    if (cacheLease.current && cacheLease.current.owner !== who.id) {
      const oldLease = cacheLease.current; cacheLease.current = null;
      await oldLease.release();
    }
    if (gen !== generation.current) return;
    if (Platform.OS === 'web' && !cacheLease.current) {
      const acquired = await acquireAccountCacheLock(who.id, typeof navigator !== 'undefined' ? navigator.locks : undefined);
      if (gen !== generation.current) { await acquired.release(); return; }
      cacheLease.current = acquired;
    }
    if (gen !== generation.current) return;
    let raw: string | null;
    try { raw = await AsyncStorage.getItem(cacheKey(who.id)); }
    catch { throw new Error('This account’s device storage could not be accessed. Keep the existing cache and retry; do not clear app storage.'); }
    if (gen !== generation.current) return;
    let envelope;
    if (raw) {
      try { envelope = readEnvelope(who.id, raw); }
      catch { throw new Error('This account’s device workspace could not be read. It has not been replaced. Export a recovery copy or retry restoring your session; do not clear app storage.'); }
    } else {
      const value = snapshot ?? await request(token, options => getDailyWorkspace(options));
      try { envelope = freshEnvelope(who.id, value); }
      catch { throw new Error('This account’s server workspace was not a valid Daily workspace. Nothing has been replaced. Retry after the server is available.'); }
    }
    if (gen !== generation.current) return;
    queryClient.clear();
    const next = new DailySync(envelope, {
      storage: AsyncStorage,
      save: input => request(token, options => saveDailyWorkspace(input, options)),
      fetch: () => request(token, options => getDailyWorkspace(options)),
      changed: () => publish(next),
      unauthorized: () => expire(next, gen),
    });
    engine.current = next; owner.current = who;
    setAccount(who); setData(envelope.draft); setGateError(''); setHydrated(true);
    // Pending caches are restored verbatim. No auth effect can upload a seed or
    // replace a pending draft with the AuthResult snapshot.
    if (next.pending && !next.envelope.conflict) void next.flush();
    else if (!next.envelope.conflict) void next.refresh();
  };
  const restore = async () => {
    if (authBusy.current) return;
    authBusy.current = true; setBusy(true); setGateError(''); setHydrated(false);
    const gen = ++generation.current;
    try {
      let token: string | null;
      try { token = await readSession(); }
      catch { throw new Error('Secure session storage could not be accessed. Daily has not opened or uploaded any workspace. Check device storage or browser session access, then retry.'); }
      if (gen !== generation.current) return;
      setBearer(token);
      if (!token) { setHydrated(true); return; }
      const who = await request(token, options => getDailyAccount(options));
      await activate(who, undefined, token, gen);
    } catch (error) {
      if (gen !== generation.current) return;
      if (statusCode(error) === 401) {
        try { await writeSession(null); }
        catch { setGateError('Your expired session could not be removed from secure storage. Retry safely.'); return; }
        setAuthError('Your session expired. Sign in again; any account-scoped pending data is kept.');
        setHydrated(true);
      } else setGateError(error instanceof Error && !statusCode(error) && (error.message.startsWith('This account') || error.message.startsWith('Secure session')) ? error.message : fallback);
    } finally { if (gen === generation.current) { authBusy.current = false; setBusy(false); } }
  };

  useEffect(() => {
    void restore();
    void AsyncStorage.getItem(LEGACY_KEY).then(raw => {
      if (raw) {
        try { setLegacy(storeSchema.parse(JSON.parse(raw))); }
        catch { setLegacyError('Legacy device data exists but could not be validated. The original backup is untouched. Export or recover it before importing.'); }
      }
    }).catch(() => setLegacyError('Legacy device storage could not be read. The original backup is untouched.'));
    return () => {
      generation.current++; authBusy.current = false;
      const source = engine.current, lease = cacheLease.current;
      source?.dispose(); engine.current = null; cacheLease.current = null;
      // No later async callback may write after this exclusive lease is freed.
      const pendingRecovery = recoveryWrites.current;
      void (async () => { await source?.settledWrites(); await pendingRecovery.catch(() => {}); await lease?.release(); })().catch(() => {});
    };
  }, []);
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const refresh = () => {
      const source = engine.current;
      if (owner.current && source && !source.error) void source.refresh();
    };
    const poll = setInterval(refresh, 30000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') { setNow(Date.now()); refresh(); } });
    return () => { clearInterval(clock); clearInterval(poll); sub.remove(); };
  }, []);

  const authenticate: Context['authenticate'] = async (mode, email, password, name) => {
    if (authBusy.current || owner.current) return false;
    authBusy.current = true; setBusy(true); setAuthError('');
    const gen = ++generation.current;
    const controller = new AbortController();
    authRequest.current.signal = controller.signal;
    const timeout = setTimeout(() => controller.abort(), 20000);
    let accepted = false;
    try {
      const result = mode === 'signup'
        ? await register.mutateAsync({ data: { email: email.trim(), password, name: (name ?? '').trim() } })
        : await login.mutateAsync({ data: { email: email.trim(), password } });
      if (gen !== generation.current) return false;
      accepted = true;
      await writeSession(result.token);
      await activate(result.account, result.snapshot, result.token, gen);
      return gen === generation.current && !!owner.current;
    } catch (error) {
      if (gen === generation.current) {
        if (getBearer()) {
          // Token accepted but activation/storage failed: force restore instead
          // of issuing another login that could hide a corrupt cache.
          setHydrated(false); setGateError(error instanceof Error && error.message.startsWith('This account') ? error.message : 'Your account was authenticated, but its secure session or device workspace could not be opened. Retry restoring it safely. No data has been replaced.');
        } else setAuthError(accepted
          ? 'Your account was verified, but secure session storage could not save this sign-in. No workspace was opened or uploaded. Check device storage or browser session access, then retry.'
          : errorMessage(error, 'Sign in could not complete. Check your connection and account details, then try again.'));
      }
      return false;
    } finally {
      clearTimeout(timeout);
      // Auth mutation caches must not retain submitted passwords.
      queryClient.getMutationCache().clear();
      login.reset(); register.reset();
      if (gen === generation.current) { authBusy.current = false; setBusy(false); }
    }
  };
  const logout = async () => {
    const source = engine.current, token = getBearer(), gen = generation.current;
    if (!source || !owner.current || !token || authBusy.current) throw new Error('Sign in again before logging out safely.');
    authBusy.current = true; setBusy(true);
    try {
      await source.prepareLogout();
      if (gen !== generation.current) throw new Error('Your session changed. Sign in again to finish safely.');
      try { await request(token, options => logoutDailyAccount(options)); }
      catch (error) { if (statusCode(error) !== 401) throw new Error(errorMessage(error, 'The server could not confirm logout. Your session and saved workspace are kept. Try again.')); }
      if (gen !== generation.current) throw new Error('Your session changed before logout completed. The old response will not change the current device session.');
      let removalError = '';
      try { await writeSession(null); }
      catch { setBearer(null); removalError = 'You are logged out and the server session is revoked, but secure storage could not remove the old token. It will be rejected on next launch.'; }
      generation.current++; source.dispose();
      await source.settledWrites();
      const lease = cacheLease.current; cacheLease.current = null;
      await lease?.release().catch(() => {});
      engine.current = null; owner.current = null;
      setAccount(null); setData(blank()); queryClient.clear(); setAuthError(removalError); setHydrated(true);
    } finally {
      authBusy.current = false; setBusy(false);
      if (engine.current === source && !source.disposed) { source.locked = false; publish(source); }
    }
  };
  const update = (fn: (s: Store) => Store) => owner.current ? engine.current?.update(fn) ?? false : false;
  const current = () => engine.current?.envelope.draft ?? data;
  const writable = () => !!owner.current && !!engine.current && !engine.current.locked && !engine.current.disposed;
  const selectJob = (id: string) => update(s => !s.active && s.jobs.some(j => j.id === id) ? { ...s, selectedJob: id } : s);
  const saveJob = (job: Job) => update(s => {
    const previous = s.jobs.find(j => j.id === job.id);
    const safe = s.active?.jobId === job.id && previous ? { ...job, normal: previous.normal, overtime: previous.overtime } : job;
    return { ...s, jobs: previous ? s.jobs.map(j => j.id === job.id ? safe : j) : [...s.jobs, safe], selectedJob: s.active?.jobId || job.id };
  });
  const clockIn = () => {
    const s = current(), job = s.jobs.find(j => j.id === s.selectedJob);
    if (!writable() || s.active || !job) return false;
    return update(v => ({ ...v, active: { jobId: job.id, start: Date.now(), normal: job.normal, overtime: job.overtime } }));
  };
  const clockOut = () => {
    const active = current().active;
    if (!active || !writable()) return null;
    const session: Session = { ...active, id: uid(), end: Math.max(active.start, Date.now()) };
    if (!update(s => ({ ...s, active: null, selectedJob: active.jobId, sessions: [...s.sessions, session] }))) return null;
    return session;
  };
  const deleteJob = (id: string) => {
    if (!writable() || current().active?.jobId === id) return false;
    return update(s => {
      const jobs = s.jobs.filter(j => j.id !== id);
      return { ...s, jobs, selectedJob: s.selectedJob === id ? jobs[0]?.id || '' : s.selectedJob, sessions: s.sessions.filter(v => v.jobId !== id), days: s.days.filter(v => v.jobId !== id) };
    });
  };
  const recoverServerCache = async () => {
    const who = recoveryOwner, token = getBearer(), previous = engine.current;
    if (!who || !token || authBusy.current || (previous && previous.envelope.owner !== who.id) ||
      (Platform.OS === 'web' && cacheLease.current?.owner !== who.id)) throw new Error('Verify this account and acquire its exclusive device-cache lock before recovery.');
    authBusy.current = true; setBusy(true);
    const gen = ++generation.current;
    try {
      if (previous && !previous.disposed) await previous.persist();
      previous?.dispose(); await previous?.settledWrites();
      if (engine.current === previous) engine.current = null;
      const raw = await AsyncStorage.getItem(cacheKey(who.id));
      if (gen !== generation.current) return;
      const backupKey = raw ? `${cacheKey(who.id)}:backup:${uid()}` : null;
      if (backupKey) await recoveryWrite(who, gen, backupKey, raw!);
      if (gen !== generation.current) return;
      const server = await request(token, options => getDailyWorkspace(options));
      if (gen !== generation.current) return;
      const replacement = { ...freshEnvelope(who.id, server), backupKey };
      await recoveryWrite(who, gen, cacheKey(who.id), JSON.stringify(replacement));
      if (gen !== generation.current) return;
      await activate(who, replacement.server, token, gen);
    } catch {
      if (gen !== generation.current) return;
      setGateError('Device-cache recovery could not finish. The previous device copy has not been silently discarded. Check storage, connection and session, then retry.');
      throw new Error('Recovery failed. Keep the device cache and any preserved backup; do not clear app storage.');
    } finally { if (gen === generation.current) { authBusy.current = false; setBusy(false); } }
  };
  const source = account ? engine.current : null;
  const holdRefresh = useCallback(() => engine.current?.holdRefresh() ?? (() => {}), []);
  return <DailyContext.Provider value={{
    data, account, authenticated: !!account && hydrated, now, hydrated, authError, busy,
    error: gateError || source?.error || '', syncStatus: source?.status ?? 'Pending', locked: source?.locked ?? false,
    conflict: source?.envelope.conflict ?? false, rejected: !!source?.envelope.rejected, legacy, legacyError,
    canImport: !!source && !!legacy && !source.pending && !source.envelope.imported && isEmptyWorkspace(source.envelope.server.workspace) && isEmptyWorkspace(data),
    backupKey: source?.envelope.backupKey ?? null,
    holdRefresh,
    recoveryAvailable: !!recoveryOwner && !hydrated,
    canRecoverServer: !!recoveryOwner && !hydrated && (!engine.current || engine.current.envelope.owner === recoveryOwner.id) && (Platform.OS !== 'web' || cacheLease.current?.owner === recoveryOwner.id),
    recoverServerCache,
    exportRecovery: async () => {
      if (!recoveryOwner) throw new Error('Sign in to verify the account before exporting its recovery copy.');
      const cached = engine.current?.envelope.owner === recoveryOwner.id ? JSON.stringify(engine.current.envelope) : await AsyncStorage.getItem(cacheKey(recoveryOwner.id));
      if (!cached) throw new Error('There is no account device cache to export. Your server workspace has not been changed.');
      return exportJson(cached, 'daily-account-device-recovery.json');
    },
    retry: () => { if (!hydrated || !owner.current) void restore(); else void engine.current?.retry(); },
    reloadServer: async () => { await engine.current?.reloadServer(); },
    retryCorrectedDraft: async () => { await engine.current?.retryCorrectedDraft(); },
    importLegacy: async () => { if (!legacy || !source) throw new Error('No valid legacy backup is available.'); await source.importLegacy(legacy); },
    authenticate, logout, update, clockIn, clockOut, selectJob, saveJob, deleteJob,
  }}>{children}</DailyContext.Provider>;
}
export function useDaily() { const ctx = useContext(DailyContext); if (!ctx) throw new Error('DailyProvider is required'); return ctx; }
// A staged form must retain the revision it was opened against. Otherwise an
// automatic refresh could advance the revision underneath stale text fields and
// make their save overwrite another device's edits without a CAS conflict.
export function useDailyEdit() {
  const { holdRefresh } = useDaily();
  useLayoutEffect(holdRefresh, [holdRefresh]);
}