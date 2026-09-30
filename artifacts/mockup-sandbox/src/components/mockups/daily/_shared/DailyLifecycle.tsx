import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, Download, Heart, LockKeyhole, Plus, ShieldCheck, Sun, Trash2, Wallet, X } from "lucide-react";
import { JOBS, dayKey, uid, useDaily } from "./model";
import type { Data, JobId, Session } from "./model";
import "../DailyLifecycle.css";

export type LifeJob = { id: JobId; name: string; subtitle: string; normal: number; overtime: number; icon: "coffee" | "laptop" | "store" | "briefcase" };
type Workspace = { jobs: LifeJob[]; data: Data };
const KEY = "daily-lifecycle-workspace-v3";
function validWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") return false;
  const w = value as Workspace;
  return Array.isArray(w.jobs) && w.jobs.every(j => typeof j.id === "string" && typeof j.name === "string" && Number.isFinite(j.normal) && Number.isFinite(j.overtime) && ["coffee", "laptop", "store", "briefcase"].includes(j.icon)) &&
    !!w.data && typeof w.data.name === "string" && Array.isArray(w.data.tasks) && Array.isArray(w.data.sessions) && Array.isArray(w.data.transactions) && !!w.data.days &&
    (!w.jobs.length || w.jobs.some(j => j.id === w.data.selectedJob)) &&
    (!w.data.active || w.jobs.some(j => j.id === w.data.active?.jobId));
}
export function useLifecycle() {
  const legacy = useDaily();
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY) || localStorage.getItem("daily-jobs-workspace-v2");
      const value = raw ? JSON.parse(raw) : { jobs: JOBS.map(j => ({ ...j, icon: j.id === "coffee" ? "coffee" : "laptop" })), data: legacy.data };
      if (!validWorkspace(value)) throw new Error();
      return { value, error: "" };
    } catch {
      return { value: { jobs: JOBS.map(j => ({ ...j, icon: j.id === "coffee" ? "coffee" as const : "laptop" as const })), data: legacy.data }, error: "Saved data could not be read. Existing storage is unchanged. Retry saving to replace it with this view." };
    }
  });
  const [workspace, setWorkspace] = useState<Workspace>(initial.value);
  const [storageError, setStorageError] = useState(initial.error);
  const [blocked, setBlocked] = useState(!!initial.error);
  const setData: Dispatch<SetStateAction<Data>> = update => setWorkspace(w => ({ ...w, data: typeof update === "function" ? update(w.data) : update }));
  const saveJob = (job: LifeJob) => setWorkspace(w => ({ jobs: w.jobs.some(j => j.id === job.id) ? w.jobs.map(j => j.id === job.id ? job : j) : [...w.jobs, job], data: { ...w.data, selectedJob: w.data.active?.jobId || job.id } }));
  const deleteJob = (id: JobId) => {
    if (workspace.data.active?.jobId === id) return false;
    setWorkspace(w => {
      if (w.data.active?.jobId === id) return w;
      const jobs = w.jobs.filter(j => j.id !== id);
      return { jobs, data: { ...w.data, selectedJob: w.data.selectedJob === id ? (jobs[0]?.id || "" as JobId) : w.data.selectedJob, sessions: w.data.sessions.filter(s => s.jobId !== id), days: Object.fromEntries(Object.entries(w.data.days).filter(([k]) => !k.startsWith(`${id}:`))) } };
    });
    return true;
  };
  const retryStorage = () => {
    try { localStorage.setItem(KEY, JSON.stringify(workspace)); setBlocked(false); setStorageError(""); }
    catch { setStorageError("Changes are in this tab only. Browser storage is unavailable. Retry saving."); }
  };
  useEffect(() => {
    if (blocked) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(workspace));
      // Migration is complete: remove superseded copies so deleted shifts cannot reappear.
      localStorage.removeItem("daily-jobs-workspace-v2");
    } catch { setStorageError("Changes are in this tab only. Browser storage is unavailable. Retry saving."); }
  }, [workspace, blocked]);
  return { ...workspace, setData, saveJob, deleteJob, now: legacy.now, storageError, retryStorage };
}

export function Entrance({ name: currentName, jobs, onFinish, onJob, onName, initialStep = "welcome" }: { name: string; jobs: LifeJob[]; onFinish: () => void; onJob: (j: LifeJob) => void; onName: (name: string) => void; initialStep?: "welcome" | "jobs" | "signup" | "signin" }) {
  const [step, setStep] = useState<"welcome" | "signin" | "signup" | "jobs">(initialStep);
  const [name, setName] = useState(currentName === "Alex" ? "" : currentName);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [rate, setRate] = useState("");
  const [overtime, setOvertime] = useState("");
  const [added, setAdded] = useState<LifeJob[]>([]);
  const [error, setError] = useState("");
  const move = (next: typeof step) => { setError(""); setStep(next); };
  return <div className="dl-welcome">
    <div className="dl-brand"><Sun />daily<em>.</em></div>
    {step === "welcome" ? <>
      <div className="dl-hero"><small>YOUR EVERYDAY COMPANION</small><h2>A little order.<br />A lot more living.</h2><div className="dl-mini"><BriefcaseBusiness /><span>Your work.</span><Wallet /><span>Your money.</span><Heart /></div></div>
      <div><h1>Make room<br />for your day.</h1><p>Your jobs, little to-dos and money.<br />Together, without the overwhelm.</p></div>
      <div className="dl-actions"><button className="dl-primary" onClick={() => move("signup")}>Get started · Sign up<ArrowRight /></button><button className="dl-secondary" onClick={() => move("signin")}>I already have an account</button><button className="dl-text" onClick={onFinish}>Explore the demo instead</button></div>
    </> : <>
      <button className="dl-back" aria-label="Go back" onClick={() => move(step === "jobs" ? "signup" : "welcome")}><ArrowLeft /></button>
      {step === "jobs" ? <>
        <div className="dl-step"><span className="on" /><span className="on" /></div>
        <div><h1>Different hats.<br />One place.</h1><p>Add the work you do. You can add more, edit or delete jobs later.</p></div>
        <form onSubmit={e => {
          e.preventDefault();
          const n = Number(rate), o = Number(overtime);
          if (!role.trim() || !Number.isFinite(n) || !Number.isFinite(o) || n < .01 || o < n || o > 100000) { setError("Add a job name and valid hourly rates. Overtime must be at least the normal rate."); return; }
          if (jobs.some(j => j.name.toLowerCase() === role.trim().toLowerCase())) { setError("That job is already in your workspace. Choose another name."); return; }
          const job: LifeJob = { id: uid() as JobId, name: role.trim(), subtitle: "Your own kind of work", normal: n, overtime: o, icon: "briefcase" };
          onJob(job); setAdded(a => [...a, job]); setRole(""); setRate(""); setOvertime(""); setError("");
        }}>
          <label className="dl-field">Job name<input required maxLength={50} value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Weekend bookstore" /></label>
          <div className="dl-columns"><label className="dl-field">Normal / hour · USD<input required type="number" min=".01" max="100000" step=".01" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="8.00" /></label><label className="dl-field">Overtime / hour · USD<input required type="number" min=".01" max="100000" step=".01" inputMode="decimal" value={overtime} onChange={e => setOvertime(e.target.value)} placeholder="10.00" /></label></div>
          {error && <div className="dl-error" role="alert">{error}</div>}
          <button className="dl-secondary" type="submit"><Plus />Add this job</button>
        </form>
        {added.map(j => <div className="dl-role" key={j.id}><Check /><div>{j.name}<small>${j.normal.toFixed(2)}/hr · ${j.overtime.toFixed(2)}/hr overtime</small></div></div>)}
        <p className="dl-note">USD · overtime after 8 hours per job, per local day. Existing tasks and jobs are kept; setup never clears your workspace.</p>
        <div className="dl-actions"><button className="dl-primary" onClick={() => { if (role.trim()) { setError("Tap “Add this job” to save your draft, or clear the job name to continue without it."); return; } onFinish(); }}>{added.length ? "Let's make today yours" : jobs.length ? "Continue with existing jobs" : "I'll add a job later"}<ArrowRight /></button></div>
      </> : <>
        {step === "signup" && <div className="dl-step"><span className="on" /><span /></div>}
        <div><h1>{step === "signin" ? "Good to have\nyou back." : "Let's start\nwith you."}</h1><p>{step === "signin" ? "Preview signing in, then return to this browser's saved workspace." : "A name to make this space feel yours. Your jobs come next."}</p></div>
        <form onSubmit={e => { e.preventDefault(); if (step === "signup") { if (!name.trim()) return; onName(name.trim()); move("jobs"); } else onFinish(); }}>
          {step === "signup" && <label className="dl-field">Your name<input required maxLength={60} autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" /></label>}
          <label className="dl-field">Email address <span className="dy-muted">Preview only · not saved</span><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <div className="dl-notice"><LockKeyhole size={15} /> No password needed for this prototype. No account is created and this email does not identify or protect your saved data.</div>
          <button className="dl-primary" type="submit">{step === "signin" ? "Preview sign in" : "Continue to your jobs"}<ArrowRight /></button>
        </form>
        <button className="dl-text" onClick={() => move(step === "signin" ? "signup" : "signin")}>{step === "signin" ? "New here? Set up your space" : "Already set up? Preview sign in"}</button>
      </>}
    </>}
    <p className="dl-note"><ShieldCheck />Interactive prototype. Data stays in this browser. Real sign-in and cross-device sync are not connected.</p>
  </div>;
}

function exportDetails(job: LifeJob, data: Data) {
  const sessions = data.sessions.filter(s => s.jobId === job.id).sort((a, b) => a.start - b.start);
  const daily: Record<string, number> = {};
  const detailed = sessions.map((session: Session) => {
    let cursor = session.start;
    const portions = [];
    while (cursor < session.end) {
      const midnight = new Date(cursor); midnight.setHours(24, 0, 0, 0);
      const end = Math.min(session.end, +midnight), date = dayKey(cursor), total = end - cursor;
      const normal = Math.min(total, Math.max(0, 28800000 - (daily[date] || 0))), overtime = total - normal;
      daily[date] = (daily[date] || 0) + total;
      portions.push({ localDate: date, totalHours: total / 3600000, normalHours: normal / 3600000, overtimeHours: overtime / 3600000, estimatedEarningsUSD: (normal * job.normal + overtime * job.overtime) / 3600000 }); cursor = end;
    }
    return { ...session, clockInISO: new Date(session.start).toISOString(), clockOutISO: new Date(session.end).toISOString(), portions };
  });
  return { format: "Daily job export", version: 1, exportedAt: new Date().toISOString(), displayName: data.name, currency: "USD", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, job, sessions: detailed, calendar: Object.entries(data.days).filter(([k]) => k.startsWith(`${job.id}:`)).map(([k, status]) => ({ date: k.slice(job.id.length + 1), status })), note: "Estimates before tax. Eight normal hours per job per local day. Income and expenses are independent records and are not deleted with a job." };
}
export function JobDeletion({ jobs, data, onDelete, onClose, initialId }: { jobs: LifeJob[]; data: Data; onDelete: (id: JobId) => void; onClose: () => void; initialId?: JobId }) {
  const [target, setTarget] = useState<LifeJob | null>(() => jobs.find(j => j.id === initialId) || null);
  const [accepted, setAccepted] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); panel.current?.querySelector<HTMLButtonElement>("[data-close]")?.click(); }
      if (e.key === "Tab") {
        const items = [...(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled)") || [])];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", handle);
    return () => { document.removeEventListener("keydown", handle); previous?.focus(); };
  }, []);
  const locked = !!target && data.active?.jobId === target.id;
  const shiftCount = data.sessions.filter(s => s.jobId === target?.id).length;
  const days = Object.keys(data.days).filter(k => k.startsWith(`${target?.id}:`)).length;
  const download = () => {
    if (!target) return;
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(exportDetails(target, data), null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = `daily-${target.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${dayKey()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); setDownloaded(true); setError("");
    } catch { setError("The download could not start. Your job has not been deleted. Please try again."); }
  };
  return <div className="dl-overlay"><div ref={panel} className="dl-sheet" role="dialog" aria-modal="true" aria-labelledby="dl-delete-title"><div className="dl-handle" />
    <div className="dl-sheet-head"><div><small>YOUR WORK, YOUR CHOICE</small><h2 id="dl-delete-title">{target ? "Before you say goodbye." : "Manage your jobs"}</h2></div><button data-close className="dl-close" aria-label="Close job management" onClick={onClose}><X /></button></div>
    {!target ? <><p>Keep what matters. Download a job's details before removing it.</p>{jobs.length ? jobs.map(j => <div className="dl-role" key={j.id}><BriefcaseBusiness /><div><strong>{j.name}</strong><small>{data.sessions.filter(s => s.jobId === j.id).length} recorded shifts</small></div><button aria-label={`Delete ${j.name}`} onClick={() => { setTarget(j); setAccepted(false); setDownloaded(false); }}><Trash2 size={18} /></button></div>) : <p>There are no jobs to delete.</p>}</> : <>
      <div className="dl-warning-icon"><Trash2 /></div><p>Delete <strong>{target.name}</strong>? Its rates, recorded shifts and calendar entries will be removed from this prototype. This cannot be undone.</p>
      <div className="dl-recap"><div><span>Recorded shifts</span><strong>{shiftCount}</strong></div><div><span>Calendar entries</span><strong>{days}</strong></div><div><span>Tasks & money</span><strong>Kept unchanged</strong></div></div>
      {locked ? <><div className="dl-error" role="alert">This job has a running shift. Clock out before downloading a complete record or deleting it.</div><button className="dl-secondary" onClick={onClose}>Keep job & return</button></> : <>
        <div className="dl-download"><h3>A copy, just in case.</h3><p>Download all job details, rates, shifts, hours, estimated earnings and calendar entries as a JSON file.</p><button className="dl-secondary" onClick={download}><Download />{downloaded ? "Download again" : "Download job details"}</button>{downloaded && <p role="status">Download requested. Check your Downloads folder before deleting.</p>}</div>
        {error && <div className="dl-error" role="alert">{error}</div>}
        <label className="dl-check"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>I understand this is permanent. I have saved a copy, or I do not need one.</span></label>
        <div className="dl-confirm-actions"><button className="dl-danger" disabled={!accepted} onClick={() => onDelete(target.id)}><Trash2 />Delete {target.name}</button><button className="dl-secondary" onClick={onClose}>Keep this job</button></div>
      </>}
    </>}
  </div></div>;
}