import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { seed, storeSchema, uid, type Store, type Session, type Job } from './model';

const KEY = 'daily-native-workspace-v1';
type Context = {
  data: Store; now: number; hydrated: boolean; error: string; retry: () => void;
  update: (fn: (s: Store) => Store) => void; clockIn: () => boolean; clockOut: () => Session | null;
  selectJob: (id: string) => void; saveJob: (job: Job) => void; deleteJob: (id: string) => boolean;
};
const DailyContext = createContext<Context | null>(null);
export function DailyProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Store>(() => seed());
  const current = useRef(data);
  const [hydrated, setHydrated] = useState(false);
  const ready = useRef(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const queue = useRef(Promise.resolve());
  const save = (value: Store) => {
    queue.current = queue.current.then(async () => {
      try { await AsyncStorage.setItem(KEY, JSON.stringify(value)); setError(''); }
      catch { setError('Your latest changes are only in memory. Device storage could not save them. Keep Daily open and retry.'); }
    });
  };
  const hydrate = async () => {
    setError('');
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const value = raw ? storeSchema.parse(JSON.parse(raw)) : seed();
      current.current = value; setData(value); ready.current = true; setHydrated(true);
      if (!raw) save(value);
    } catch {
      setError('Your saved workspace could not be read. It has not been replaced. Retry to load it safely.');
    }
  };
  useEffect(() => { void hydrate(); }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') setNow(Date.now()); });
    return () => { clearInterval(timer); sub.remove(); };
  }, []);
  const update = (fn: (s: Store) => Store) => {
    if (!ready.current) return;
    const next = storeSchema.parse(fn(current.current));
    current.current = next; setData(next); save(next);
  };
  const selectJob = (id: string) => update(s => !s.active && s.jobs.some(j => j.id === id) ? { ...s, selectedJob: id } : s);
  const saveJob = (job: Job) => update(s => {
    const previous = s.jobs.find(j => j.id === job.id);
    const safe = s.active?.jobId === job.id && previous ? { ...job, normal: previous.normal, overtime: previous.overtime } : job;
    return { ...s, jobs: previous ? s.jobs.map(j => j.id === job.id ? safe : j) : [...s.jobs, safe], selectedJob: s.active?.jobId || job.id };
  });
  const clockIn = () => {
    const s = current.current, job = s.jobs.find(j => j.id === s.selectedJob);
    if (s.active || !job || !ready.current) return false;
    update(v => ({ ...v, active: { jobId: job.id, start: Date.now(), normal: job.normal, overtime: job.overtime } }));
    return true;
  };
  const clockOut = () => {
    const active = current.current.active;
    if (!active || !ready.current) return null;
    const session: Session = { ...active, id: uid(), end: Math.max(active.start, Date.now()) };
    update(s => ({ ...s, active: null, selectedJob: active.jobId, sessions: [...s.sessions, session] }));
    return session;
  };
  const deleteJob = (id: string) => {
    if (current.current.active?.jobId === id || !ready.current) return false;
    update(s => {
      const jobs = s.jobs.filter(j => j.id !== id);
      return { ...s, jobs, selectedJob: s.selectedJob === id ? jobs[0]?.id || '' : s.selectedJob, sessions: s.sessions.filter(v => v.jobId !== id), days: s.days.filter(v => v.jobId !== id) };
    });
    return true;
  };
  return <DailyContext.Provider value={{ data, now, hydrated, error, retry: () => { if (ready.current) save(current.current); else void hydrate(); }, update, clockIn, clockOut, selectJob, saveJob, deleteJob }}>{children}</DailyContext.Provider>;
}
export function useDaily() { const ctx = useContext(DailyContext); if (!ctx) throw new Error('DailyProvider is required'); return ctx; }