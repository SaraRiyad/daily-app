import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { ArrowRight, BriefcaseBusiness, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Coffee, History, Laptop, LockKeyhole, Pencil, Play, Plus, ShieldCheck, Square, Store, Wallet, X } from "lucide-react";
import { z } from "zod";
import { JOBS, dateLabel, dayKey, duration, money, parseDay, timeLabel, timerLabel, totalSegments, uid, useDaily as useLegacyDaily, withActive } from "./model";
import type { Data, DayStatus, JobId, Navigate, Segment, Session, Task } from "./model";
import { Button, Empty, InfoNote, SectionHead, Tabs, TaskRow } from "./ui";
import { balance } from "./money";

type Job = { id: JobId; name: string; subtitle: string; normal: number; overtime: number; icon: "coffee" | "laptop" | "store" | "briefcase" };
const defaults: Job[] = JOBS.map(j => ({ ...j, icon: j.id === "coffee" ? "coffee" : "laptop" }));
const KEY = "daily-jobs-workspace-v2";
const jobSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(50), subtitle: z.string().max(70), normal: z.number().finite().positive().max(100000), overtime: z.number().finite().positive().max(100000), icon: z.enum(["coffee", "laptop", "store", "briefcase"]) });
const savedSchema = z.object({
  jobs: z.array(jobSchema).min(1),
  data: z.object({
    version: z.literal(1), name: z.string().min(1), selectedJob: z.string(), active: z.object({ jobId: z.string(), start: z.number().finite() }).nullable(),
    tasks: z.array(z.object({ id: z.string(), title: z.string(), due: z.string(), priority: z.enum(["Low", "Medium", "High"]), done: z.boolean() })),
    transactions: z.array(z.object({ id: z.string(), kind: z.enum(["income", "expense"]), amount: z.number().finite().positive(), title: z.string(), category: z.string(), date: z.string(), note: z.string() })),
    sessions: z.array(z.object({ id: z.string(), jobId: z.string(), start: z.number().finite(), end: z.number().finite() })),
    days: z.record(z.string(), z.enum(["Work", "Day off", "Vacation", "Sick"])),
  }),
}).refine(s => [s.data.selectedJob, ...s.data.sessions.map(v => v.jobId), ...(s.data.active ? [s.data.active.jobId] : [])].every(id => s.jobs.some(j => j.id === id)), "Unknown job");

// The previous prototype remains untouched; migrate its state into this independent,
// extensible workspace only once. Old tasks, money entries and shifts are retained.
export function useJobsDaily() {
  const legacy = useLegacyDaily();
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const value = raw ? savedSchema.parse(JSON.parse(raw)) : { jobs: defaults, data: legacy.data };
      return { value: value as { jobs: Job[]; data: Data }, error: "" };
    } catch { return { value: { jobs: defaults, data: legacy.data }, error: "Saved jobs could not be read. Your earlier data is safe. Retry saving to replace the unreadable workspace." }; }
  });
  const [workspace, setWorkspace] = useState(initial.value);
  const [storageError, setStorageError] = useState(initial.error || legacy.storageError);
  const [blocked, setBlocked] = useState(Boolean(initial.error || legacy.storageError));
  const setData: Dispatch<SetStateAction<Data>> = update => setWorkspace(w => ({ ...w, data: typeof update === "function" ? update(w.data) : update }));
  const saveJob = (job: Job) => setWorkspace(w => ({ jobs: w.jobs.some(j => j.id === job.id) ? w.jobs.map(j => j.id === job.id ? job : j) : [...w.jobs, job], data: { ...w.data, selectedJob: w.data.active?.jobId || job.id } }));
  const retryStorage = () => {
    try { localStorage.setItem(KEY, JSON.stringify(workspace)); setBlocked(false); setStorageError(""); }
    catch { setStorageError("Browser storage is unavailable. Your changes are in this tab only. Retry saving."); }
  };
  useEffect(() => {
    if (blocked) return;
    try { localStorage.setItem(KEY, JSON.stringify(workspace)); setStorageError(""); }
    catch { setStorageError("Browser storage is unavailable. Your changes are in this tab only. Retry saving."); }
  }, [workspace, blocked]);
  return { ...workspace, setData, saveJob, now: legacy.now, storageError, retryStorage };
}

type ContextValue = { jobs: Job[]; data: Data; openPicker: () => void; addJob: () => void; editJob: (j: Job) => void };
const JobContext = createContext<ContextValue | null>(null);
function useJobs() { const value = useContext(JobContext); if (!value) throw new Error("Job controls need JobsProvider"); return value; }
function Icon({ job }: { job: Job }) {
  const Component = { coffee: Coffee, laptop: Laptop, store: Store, briefcase: BriefcaseBusiness }[job.icon];
  return <span className={`dj-job-icon ${job.icon === "laptop" ? "charcoal" : job.icon === "store" ? "sand" : ""}`}><Component /></span>;
}
export function JobsProvider({ jobs, data, saveJob, selectJob, children }: { jobs: Job[]; data: Data; saveJob: (job: Job) => void; selectJob: (id: JobId) => void; children: ReactNode }) {
  const [mode, setMode] = useState<"picker" | "form" | null>(() => new URLSearchParams(window.location.search).get("panel") === "jobs" ? "picker" : new URLSearchParams(window.location.search).get("panel") === "add-job" ? "form" : null);
  const [editing, setEditing] = useState<Job | null>(null);
  const [notice, setNotice] = useState("");
  const sheet = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const open = (next: "picker" | "form", job: Job | null = null) => { returnFocus.current = document.activeElement as HTMLElement; setEditing(job); setMode(next); };
  const close = () => { setMode(null); returnFocus.current?.focus(); };
  useEffect(() => {
    if (!mode) return;
    const el = sheet.current;
    el?.querySelector<HTMLElement>("button, input")?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMode(null); returnFocus.current?.focus(); }
      if (event.key !== "Tab" || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [mode]);
  useEffect(() => { if (!notice) return; const t = window.setTimeout(() => setNotice(""), 3500); return () => clearTimeout(t); }, [notice]);
  return <JobContext.Provider value={{ jobs, data, openPicker: () => open("picker"), addJob: () => open("form"), editJob: job => open("form", job) }}>
    {children}
    {mode && <div className="dj-overlay" onClick={event => { if (event.target === event.currentTarget) close(); }}><div className="dj-sheet" role="dialog" aria-modal="true" aria-labelledby="dj-sheet-title" ref={sheet}><div className="dj-handle" />
      {mode === "picker" ? <><div className="dj-sheet-header"><div><span className="dj-eyebrow">One day. Different hats.</span><h2 id="dj-sheet-title">Where are you working?</h2><p>Choose the job you want to track.</p></div><button className="dj-close" aria-label="Close job picker" onClick={close}><X /></button></div>
        {data.active && <div className="dy-error"><LockKeyhole size={14} /> Your shift is running. Clock out before switching jobs.</div>}
        <div role="group" aria-label="Your jobs">{jobs.map(job => <button key={job.id} className={`dj-option ${job.id === data.selectedJob ? "selected" : ""}`} aria-pressed={job.id === data.selectedJob} disabled={!!data.active && job.id !== data.active.jobId} onClick={() => { selectJob(job.id); close(); }}><Icon job={job} /><div><strong>{job.name}</strong><small>{money(job.normal)}/hr <span aria-hidden> · </span> {money(job.overtime)}/hr overtime</small></div><span className="dj-radio">{job.id === data.selectedJob && <Check />}</span></button>)}</div>
        <div className="dj-sheet-divider" /><button className="dj-add-card" onClick={() => { setEditing(null); setMode("form"); }}><Plus /><div><strong>Add another job</strong><small>A new role, a side gig, your next chapter.</small></div></button><p className="dj-footnote"><ShieldCheck />Each job keeps its own hours and history.</p>
      </> : <JobForm job={editing} jobs={jobs} active={!!data.active} close={close} save={job => { saveJob(job); close(); setNotice(`${job.name} ${editing ? "updated" : data.active ? "added to your jobs" : "added and selected"}.`); }} />}
    </div></div>}
    {notice && <div className="dj-success" role="status"><Check />{notice}</div>}
  </JobContext.Provider>;
}
function JobForm({ job, jobs, active, save, close }: { job: Job | null; jobs: Job[]; active: boolean; save: (job: Job) => void; close: () => void }) {
  const [name, setName] = useState(job?.name || "");
  const [subtitle, setSubtitle] = useState(job?.subtitle || "");
  const [normal, setNormal] = useState(job?.normal.toString() || "");
  const [overtime, setOvertime] = useState(job?.overtime.toString() || "");
  const [icon, setIcon] = useState<Job["icon"]>(job?.icon || "briefcase");
  const [error, setError] = useState("");
  const hasHistory = useJobs().data.sessions.some(s => s.jobId === job?.id);
  const ratesLocked = !!job && (hasHistory || active);
  const preview: Job = { id: job?.id || "coffee", name: name.trim() || "Your next chapter", subtitle, normal: Number(normal), overtime: Number(overtime), icon };
  return <><div className="dj-sheet-header"><div><span className="dj-eyebrow">Make room for a new role</span><h2 id="dj-sheet-title">{job ? "Edit your job" : "Add a job"}</h2><p>Your hours and earnings, kept together.</p></div><button className="dj-close" aria-label="Close job form" onClick={close}><X /></button></div><form onSubmit={e => {
    e.preventDefault();
    if (!name.trim()) { setError("Give your job a name."); return; }
    if (jobs.some(j => j.id !== job?.id && j.name.toLowerCase() === name.trim().toLowerCase())) { setError("You already have a job with this name."); return; }
    if (![normal, overtime].every(n => n.trim() !== "" && Number.isFinite(Number(n)) && Number(n) > 0 && Number(n) <= 100000)) { setError("Enter hourly rates between $0.01 and $100,000."); return; }
    if (Number(overtime) < Number(normal)) { setError("Overtime rate should be at least your normal rate."); return; }
    save({ ...preview, id: job?.id || uid() as JobId, name: name.trim(), subtitle: subtitle.trim() || "Your own kind of work" });
  }}>
    <div className="dj-preview"><Icon job={preview} /><div><strong>{preview.name}</strong><small>{subtitle.trim() || "A little more on your terms."}</small></div></div>
    <span className="dy-small">Choose an icon</span><div className="dj-icon-options">{(["briefcase", "coffee", "laptop", "store"] as const).map(value => <button type="button" key={value} className={icon === value ? "active" : ""} aria-label={`${value} icon`} aria-pressed={icon === value} onClick={() => setIcon(value)}><Icon job={{ ...preview, icon: value }} /></button>)}</div>
    <label className="dy-field">Job name<input autoComplete="organization" maxLength={50} placeholder="e.g. Weekend at the bookstore" value={name} onChange={e => setName(e.target.value)} required /></label>
    <label className="dy-field">A little description <span className="dy-muted" style={{ fontSize: 10 }}>Optional</span><input maxLength={70} placeholder="e.g. My weekend shifts" value={subtitle} onChange={e => setSubtitle(e.target.value)} /></label>
    <div className="dj-form-grid"><label className="dy-field">Normal / hour<div className="dj-input-wrap"><span>$</span><input aria-label="Normal hourly rate" type="number" inputMode="decimal" step=".01" min=".01" max="100000" placeholder="0.00" value={normal} onChange={e => setNormal(e.target.value)} required disabled={ratesLocked} /></div></label><label className="dy-field">Overtime / hour<div className="dj-input-wrap"><span>$</span><input aria-label="Overtime hourly rate" type="number" inputMode="decimal" step=".01" min=".01" max="100000" placeholder="0.00" value={overtime} onChange={e => setOvertime(e.target.value)} required disabled={ratesLocked} /></div></label></div>
    <p className="dj-field-note">{ratesLocked ? "Rates are locked after a shift is recorded, so your past earnings stay accurate." : "Overtime begins after 8 hours per day at this job. Rates are in USD."}</p>
    {error && <div className="dy-error" role="alert">{error}</div>}<Button type="submit">{job ? <Check /> : <Plus />}{job ? "Save changes" : "Add job"}<ArrowRight /></Button><p className="dj-footnote"><ShieldCheck />Saved on this browser, just for you.</p>
  </form></>;
}
function JobPicker({ light = false }: { light?: boolean }) {
  const { jobs, data, openPicker } = useJobs();
  const job = jobs.find(j => j.id === (data.active?.jobId || data.selectedJob))!;
  return <button className={`dj-picker${light ? " light" : ""}`} onClick={openPicker} aria-label={`Choose job, currently ${job.name}`} aria-haspopup="dialog"><Icon job={job} /><div><small>{data.active ? "On the clock" : "Your selected job"}</small><strong>{job.name}</strong></div>{data.active ? <LockKeyhole /> : <ChevronDown />}</button>;
}
function jobSegments(sessions: Session[], jobs: Job[]): Segment[] {
  const used: Record<string, number> = {};
  return [...sessions].sort((a, b) => a.start - b.start).flatMap(session => {
    const job = jobs.find(j => j.id === session.jobId);
    if (!job) return [];
    const rows: Segment[] = [];
    let cursor = session.start;
    while (cursor < session.end) {
      const midnight = new Date(cursor); midnight.setHours(24, 0, 0, 0);
      const end = Math.min(session.end, +midnight), date = dayKey(cursor), key = `${job.id}:${date}`, total = end - cursor;
      const normal = Math.min(total, Math.max(0, 28800000 - (used[key] || 0))), overtime = total - normal;
      rows.push({ sessionId: session.id, jobId: job.id, date, start: cursor, end, total, normal, overtime, earnings: (normal * job.normal + overtime * job.overtime) / 3600000 });
      used[key] = (used[key] || 0) + total; cursor = end;
    }
    return rows;
  });
}
type WorkProps = { data: Data; now: number; go: Navigate; selectJob: (id: JobId) => void; clockIn: () => void; clockOut: () => void };
function WorkCard({ data, now, go, clockIn, clockOut }: WorkProps) {
  const { jobs } = useJobs();
  const total = totalSegments(jobSegments(withActive(data, now), jobs).filter(s => s.date === dayKey(now)));
  return <div className="dy-work-card"><JobPicker /><div className="dy-work-title">{data.active ? timerLabel(now - data.active.start) : "Not clocked in"}</div>{data.active && <p className="dy-small" style={{ color: "#c6c5cc" }}>Started at {timeLabel(data.active.start)} · job locked</p>}<Button onClick={data.active ? clockOut : clockIn}>{data.active ? <Square size={16} /> : <Play size={16} />}{data.active ? "Clock out" : "Clock in"}<ArrowRight /></Button><div className="dy-work-metrics"><div><span>Today's hours · all jobs</span><strong>{duration(total.total)}</strong></div><div><span>Estimated earnings</span><strong>{money(total.earnings)}</strong></div></div>{data.active && <button className="dy-text-btn" style={{ color: "#f58f6c" }} onClick={() => go("timer")}>Open live timer<ChevronRight /></button>}</div>;
}
export function JobsHome(props: WorkProps & { editTask: (task: Task) => void; toggleTask: (id: string) => void }) {
  const { data, now, go, editTask, toggleTask } = props;
  const today = dayKey(now), tasks = data.tasks.filter(t => t.due === today || (!t.done && t.due < today)), completed = tasks.filter(t => t.done).length;
  const greeting = new Date(now).getHours() < 12 ? "Good morning" : new Date(now).getHours() < 17 ? "Good afternoon" : "Good evening";
  return <div className="dy-home"><div className="dy-kicker">{new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div><h1 className="dy-heading">{greeting}, {data.name.split(" ")[0]}.</h1><p className="dy-subtitle" style={{ marginBottom: 15 }}>A little order. A little more breathing room.</p><WorkCard {...props} /><button className="dy-balance-link" onClick={() => go("money")}><span className="dy-symbol"><Wallet /></span><div><div className="dy-small dy-muted">Your balance</div><div className="dy-money-value">{money(balance(data).remaining)}</div></div><ChevronRight /></button><section className="dy-section" style={{ marginTop: 15 }}><SectionHead title="Today's little list" action={() => go("tasks")} label="See all" /><div className="dy-row dy-small dy-muted"><span>{completed} of {tasks.length} completed</span><span>One step at a time</span></div><div className="dy-progress" role="progressbar" aria-label="Today's task completion" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={Math.max(1, tasks.length)}><div style={{ width: `${tasks.length ? completed / tasks.length * 100 : 0}%` }} /></div>{[...tasks].sort((a, b) => Number(a.done) - Number(b.done)).slice(0, 3).map(t => <TaskRow key={t.id} task={t} toggle={() => toggleTask(t.id)} edit={() => editTask(t)} />)}{!tasks.length && <Empty title="Your day has a little space." text="Add a task, or enjoy the breathing room." action={() => go("task-form")} label="Add a task" />}</section></div>;
}
export function JobsWork(props: WorkProps) {
  const { data, go, selectJob } = props;
  const { jobs, addJob, editJob } = useJobs();
  return <><h2 className="dy-heading">Your time, well spent.</h2><p className="dy-subtitle">Different jobs. One place to keep track.</p><WorkCard {...props} /><div className="dj-management-head"><div><h2>Your jobs <span className="dy-muted" style={{ fontSize: 12 }}>· {jobs.length}</span></h2><p>A place for every hat you wear.</p></div><button className="dj-add-small" onClick={addJob}><Plus />Add job</button></div>{jobs.map(job => <article key={job.id} className={`dj-job-card ${data.selectedJob === job.id ? "selected" : ""}`}><button className="dj-card-main" disabled={!!data.active && data.active.jobId !== job.id} onClick={() => { selectJob(job.id); go("job"); }} aria-label={`Open ${job.name}`}><Icon job={job} /><div><h3>{job.name}</h3><p>{job.subtitle}</p></div><ChevronRight /></button><div className="dj-rates"><div><span>Normal rate</span><strong>{money(job.normal)}<small> / hr</small></strong></div><div><span>Overtime rate</span><strong>{money(job.overtime)}<small> / hr</small></strong></div></div><div className="dj-card-bottom">{data.selectedJob === job.id ? <span className="dj-selected-tag"><Check />{data.active ? "Currently working" : "Selected for your next shift"}</span> : <span>{data.sessions.filter(s => s.jobId === job.id).length} shifts recorded</span>}<button onClick={() => editJob(job)} aria-label={`Edit ${job.name}`}><Pencil />Edit</button></div></article>)}<button className="dj-add-card" onClick={addJob}><Plus /><div><strong>Another job? Make it yours.</strong><small>Add a role and set your hourly rates.</small></div></button><InfoNote>{data.active ? "Clock out before switching jobs. You can still add a new job while working." : "Each job has its own hours, earnings, and calendar. Your next shift starts with the selected job."}</InfoNote></>;
}
export function JobsDetail(props: WorkProps) {
  const { data, now, go, clockIn, clockOut } = props;
  const { jobs, editJob } = useJobs();
  const job = jobs.find(j => j.id === data.selectedJob)!;
  const month = dayKey(now).slice(0, 7);
  const rows = jobSegments(withActive(data, now), jobs).filter(s => s.jobId === job.id && s.date.startsWith(month)), total = totalSegments(rows);
  const worked = new Set(rows.map(s => s.date));
  Object.entries(data.days).forEach(([key, status]) => { if (key.startsWith(`${job.id}:${month}`) && key.slice(job.id.length + 1) <= dayKey(now) && status === "Work") worked.add(key.slice(job.id.length + 1)); });
  const count = (status: DayStatus) => Object.entries(data.days).filter(([k, v]) => k.startsWith(`${job.id}:${month}`) && v === status).length;
  return <><div className="dj-details-hero"><Icon job={job} /><div><h2>{job.name}</h2><p>{job.subtitle}</p></div></div><div className="dy-card"><div className="dy-detail-row"><span>Normal hourly rate</span><strong>{money(job.normal)}</strong></div><div className="dy-detail-row"><span>Overtime hourly rate</span><strong>{money(job.overtime)}</strong></div><button className="dy-text-btn" onClick={() => editJob(job)}><Pencil size={14} />Edit job details</button></div><InfoNote>Overtime starts after 8 hours per job, per local day. Multiple sessions count together.</InfoNote><SectionHead title="This month" /><div className="dy-stats"><div className="dy-stat"><span>Working hours</span><strong>{duration(total.total)}</strong></div><div className="dy-stat"><span>Estimated earnings</span><strong>{money(total.earnings)}</strong></div><div className="dy-stat"><span>Days worked</span><strong>{worked.size}</strong></div><div className="dy-stat"><span>Days off · planned & taken</span><strong>{count("Day off")}</strong></div></div><div className="dy-row dy-small dy-muted"><span>Vacation · {count("Vacation")} days</span><span>Sick · {count("Sick")} days</span></div><div className="dy-stack" style={{ marginTop: 20 }}><Button onClick={data.active ? clockOut : clockIn}>{data.active ? <Square /> : <Play />}{data.active ? "Clock out" : "Clock in"}</Button><button className="dy-link-card" onClick={() => go("history")}><History /><strong>Work history</strong><ChevronRight /></button><button className="dy-link-card" onClick={() => go("calendar")}><Clock3 /><strong>Plan work & time off</strong><ChevronRight /></button></div></>;
}
export function JobsTimer({ data, now, go, clockOut }: Pick<WorkProps, "data" | "now" | "go" | "clockOut">) {
  const { jobs } = useJobs();
  if (!data.active) return <Empty title="You're off the clock." text="Choose a job to start your next shift." action={() => go("work")} label="Go to Work" />;
  const job = jobs.find(j => j.id === data.active!.jobId)!;
  const total = totalSegments(jobSegments(withActive(data, now), jobs).filter(s => s.sessionId === "active"));
  return <><JobPicker light /><div className="dy-timer"><span className="dy-pill"><i className="dy-dot" />You're on the clock</span><h2 className="dy-heading">{job.name}</h2><div className="dy-timer-ring"><Clock3 size={22} color="#e8764f" /><p>Time working</p><div className="dy-timer-number">{timerLabel(now - data.active.start)}</div><p>Started at {timeLabel(data.active.start)}</p></div></div><div className="dy-stats"><div className="dy-stat"><span>Session estimate</span><strong>{money(total.earnings)}</strong></div><div className="dy-stat"><span>Session overtime</span><strong>{duration(total.overtime)}</strong></div></div><Button onClick={clockOut}><Square />Clock out</Button><InfoNote>Your timer keeps going between screens and reloads. Clock out before switching jobs.</InfoNote><Button secondary onClick={() => go("home")}>Back to my day</Button></>;
}
export function JobsSummary({ session, data, go }: { session: Session | null; data: Data; go: Navigate }) {
  const { jobs } = useJobs();
  if (!session) return <Empty title="No session just yet." text="Your next summary will appear here." action={() => go("work")} label="Go to Work" />;
  const job = jobs.find(j => j.id === session.jobId)!;
  const total = totalSegments(jobSegments(data.sessions, jobs).filter(s => s.sessionId === session.id));
  return <><div className="dy-summary-head"><span className="dy-symbol peach"><Check /></span><span className="dy-kicker">Shift saved</span><h2>That's time well spent.</h2><p>{job.name} · {dateLabel(dayKey(session.start))}</p></div><div className="dy-card">{[["Clock in", `${timeLabel(session.start)} · ${dateLabel(dayKey(session.start))}`], ["Clock out", `${timeLabel(session.end)} · ${dateLabel(dayKey(session.end))}`], ["Total time", duration(total.total)], [`Normal · ${money(job.normal)}/hr`, duration(total.normal)], [`Overtime · ${money(job.overtime)}/hr`, duration(total.overtime)]].map(([label, value]) => <div className="dy-detail-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="dy-summary-earn"><span>Estimated session earnings</span><strong>{money(total.earnings)}</strong><span>Every minute counts.</span></div><InfoNote>Saved to your work history, not your Money balance. Add income when you get paid.</InfoNote><div className="dy-stack"><Button onClick={() => go("home")}>Back to my day<ArrowRight /></Button><Button secondary onClick={() => go("history")}>View work history</Button></div></>;
}
export function JobsHistory({ data }: { data: Data }) {
  const { jobs } = useJobs();
  const [filter, setFilterState] = useState<"Day" | "Week" | "Month">("Week"), [anchor, setAnchor] = useState(dayKey());
  const setFilter = (value: string) => { if (value === "Day" || value === "Week" || value === "Month") setFilterState(value); };
  const job = jobs.find(j => j.id === data.selectedJob)!;
  const start = parseDay(anchor); start.setHours(0, 0, 0, 0);
  if (filter === "Week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (filter === "Month") start.setDate(1);
  const end = new Date(start); if (filter === "Month") end.setMonth(end.getMonth() + 1); else end.setDate(end.getDate() + (filter === "Week" ? 7 : 1));
  const rows = jobSegments(data.sessions, jobs).filter(s => s.jobId === job.id && s.date >= dayKey(start) && s.date < dayKey(end)).sort((a, b) => b.start - a.start), total = totalSegments(rows);
  const move = (dir: number) => { const d = new Date(start); if (filter === "Month") d.setMonth(d.getMonth() + dir); else d.setDate(d.getDate() + dir * (filter === "Week" ? 7 : 1)); setAnchor(dayKey(d)); };
  const last = new Date(end); last.setDate(last.getDate() - 1);
  return <><h2 className="dy-heading">{job.name}</h2><p className="dy-subtitle">A record of the time you've put in.</p><Tabs values={["Day", "Week", "Month"] as const} value={filter} change={setFilter} /><div className="dy-period"><button className="dy-icon-button" aria-label="Previous period" onClick={() => move(-1)}><ChevronLeft /></button><span>{filter === "Month" ? start.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : `${dateLabel(dayKey(start))}${filter === "Week" ? ` – ${dateLabel(dayKey(last))}` : ""}`}</span><button className="dy-icon-button" aria-label="Next period" onClick={() => move(1)}><ChevronRight /></button></div><div className="dy-stats"><div className="dy-stat"><span>{filter} working hours</span><strong>{duration(total.total)}</strong></div><div className="dy-stat"><span>Estimated earnings</span><strong>{money(total.earnings)}</strong></div></div>{rows.map(row => <div className="dy-card dy-history" key={`${row.sessionId}:${row.date}`}><div className="dy-row"><h3>{dateLabel(row.date, true)}</h3><span className="dy-pill">{money(row.earnings)}</span></div><div className="dy-detail-row"><span>Clock in → out</span><strong>{timeLabel(row.start)} → {timeLabel(row.end)}</strong></div><div className="dy-detail-row"><span>Total hours</span><strong>{duration(row.total)}</strong></div><div className="dy-detail-row"><span>Normal / overtime</span><strong>{duration(row.normal)} / {duration(row.overtime)}</strong></div></div>)}{!rows.length && <Empty title="A fresh chapter." text="Completed shifts for this job will appear here." action={() => { setFilter("Month"); setAnchor(dayKey()); }} label="View this month" />}<InfoNote>Overnight shifts are split at local midnight. Earnings are estimates before tax.</InfoNote></>;
}
export function JobsCalendar({ data, setData }: { data: Data; setData: Dispatch<SetStateAction<Data>>; selectJob: (id: JobId) => void }) {
  const { jobs } = useJobs();
  const [selected, setSelected] = useState(dayKey()), [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return dayKey(d); }), [saved, setSaved] = useState(false);
  const first = parseDay(month), year = first.getFullYear(), mi = first.getMonth(), count = new Date(year, mi + 1, 0).getDate(), offset = (first.getDay() + 6) % 7;
  const job = jobs.find(j => j.id === data.selectedJob)!;
  const worked = new Set(jobSegments(withActive(data, Date.now()), jobs).filter(s => s.jobId === job.id).map(s => s.date));
  const status = (date: string): DayStatus | undefined => data.days[`${job.id}:${date}`] || (worked.has(date) ? "Work" : undefined);
  const statuses: DayStatus[] = ["Work", "Day off", "Vacation", "Sick"], cls = { Work: "work", "Day off": "off", Vacation: "vacation", Sick: "sick" };
  const move = (dir: number) => { const d = parseDay(month); d.setMonth(d.getMonth() + dir); setMonth(dayKey(d)); setSelected(dayKey(d)); setSaved(false); };
  return <><h2 className="dy-heading">Room for work. And life.</h2><p className="dy-subtitle">See your rhythm, one month at a time.</p><JobPicker light /><div className="dy-calendar"><div className="dy-period"><button className="dy-icon-button" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft /></button><strong>{first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong><button className="dy-icon-button" aria-label="Next month" onClick={() => move(1)}><ChevronRight /></button></div><div className="dy-calendar-grid">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span className="dy-weekday" key={i}>{d}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`space${i}`} />)}{Array.from({ length: count }, (_, i) => { const date = dayKey(new Date(year, mi, i + 1)), mark = status(date); return <button key={date} className={`dy-day${date === dayKey() ? " today" : ""}${date === selected ? " selected" : ""}`} aria-pressed={selected === date} aria-label={`${dateLabel(date, true)}, ${mark || "not planned"}`} onClick={() => { setSelected(date); setSaved(false); }}>{i + 1}{mark && <span className={`dy-mark ${cls[mark]}`} />}</button>; })}</div></div><div className="dy-legend">{statuses.map(s => <span key={s}><i className={`dy-mark ${cls[s]}`} />{s}</span>)}</div><div className="dy-card"><div className="dy-kicker">{job.name}</div><h3>{dateLabel(selected, true)}</h3><p className="dy-small dy-muted">How does this day look?</p><div className="dy-status-options">{statuses.map(s => <button key={s} className={status(selected) === s ? "active" : ""} aria-pressed={status(selected) === s} onClick={() => { setData(d => ({ ...d, days: { ...d.days, [`${job.id}:${selected}`]: s } })); setSaved(true); }}>{s}</button>)}</div>{saved && <div className="dy-save-status" role="status"><Check />Day updated for {job.name}</div>}</div><InfoNote>Each job has its own calendar. Your plan never changes recorded shifts or earnings.</InfoNote></>;
}