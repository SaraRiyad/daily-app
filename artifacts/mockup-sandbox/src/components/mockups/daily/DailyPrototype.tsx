import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BatteryFull, BriefcaseBusiness, CalendarDays, CheckCheck, House, Plus, Signal, Sun, Wallet, Wifi, Trash2, LogOut } from "lucide-react";
import { uid } from "./_shared/model";
import type { JobId, Screen, Session, Task } from "./_shared/model";
import { JobsProvider, JobsHome as Home, JobsWork as Work, JobsDetail as JobDetail, JobsTimer as Timer, JobsSummary as Summary, JobsHistory as WorkHistory, JobsCalendar as Calendar } from "./_shared/WorkChoices";
import { Entrance, JobDeletion, useLifecycle } from "./_shared/DailyLifecycle";
import { Tasks, TaskForm } from "./_shared/tasks";
import { MoneyForm, MoneyList, MoneyOverview } from "./_shared/money";
import { Settings } from "./_shared/settings";
import "./_group.css";
import "./DailyPrototype.css";

const navItems = [
  { screen: "home", name: "Home", icon: House },
  { screen: "tasks", name: "Tasks", icon: CheckCheck },
  { screen: "work", name: "Work", icon: BriefcaseBusiness },
  { screen: "money", name: "Money", icon: Wallet },
  { screen: "calendar", name: "Calendar", icon: CalendarDays },
] as const;
const titles: Record<Screen, string> = { home: "Daily", tasks: "Your tasks", "task-form": "Add task", work: "Work & jobs", job: "Job details", timer: "Working now", summary: "Session summary", history: "Work history", calendar: "Your calendar", money: "Your money", income: "Income", expense: "Expenses", "income-form": "Add income", "expense-form": "Add expense", settings: "Your profile" };
const parents: Partial<Record<Screen, Screen>> = { "task-form": "tasks", job: "work", timer: "work", summary: "work", history: "job", income: "money", expense: "money", "income-form": "income", "expense-form": "expense", settings: "home" };
export function DailyPrototype() {
  const { data, setData, jobs, saveJob, deleteJob, now, storageError, retryStorage } = useLifecycle();
  const [entered, setEntered] = useState(() => { if (new URLSearchParams(window.location.search).get("preview") === "delete") return true; try { return sessionStorage.getItem("daily-entry-preview") === "entered"; } catch { return false; } });
  const [entryStep, setEntryStep] = useState<"welcome" | "jobs" | "signup" | "signin">(() => { const preview = new URLSearchParams(window.location.search).get("preview"); return preview === "signup" || preview === "signin" || preview === "jobs" ? preview : "welcome"; });
  const [manage, setManage] = useState(() => new URLSearchParams(window.location.search).get("preview") === "delete");
  const [deletingId, setDeletingId] = useState<JobId | undefined>(() => new URLSearchParams(window.location.search).get("preview") === "delete" ? data.selectedJob : undefined);
  const [notice, setNotice] = useState("");
  const [screen, setScreen] = useState<Screen>(() => new URLSearchParams(window.location.search).get("view") === "work" ? "work" : "home");
  const [editing, setEditing] = useState<Task | null>(null);
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const go = (next: Screen) => { if (next === "task-form") setEditing(null); setScreen(next); };
  const selectJob = (id: JobId) => setData(d => d.active ? d : { ...d, selectedJob: id });
  const editTask = (task: Task) => { setEditing(task); setScreen("task-form"); };
  const toggleTask = (id: string) => setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
  const clockIn = () => { if (!jobs.length) return; setData(d => d.active ? d : { ...d, active: { jobId: d.selectedJob, start: Date.now() } }); setScreen("timer"); };
  const clockOut = () => {
    if (!data.active) return;
    const session: Session = { id: uid(), ...data.active, end: Math.max(Date.now(), data.active.start) };
    setData(d => d.active ? { ...d, selectedJob: d.active.jobId, sessions: [...d.sessions, session], active: null } : d);
    setLastSession(session); setScreen("summary");
  };
  useEffect(() => { scroll.current?.scrollTo({ top: 0, behavior: "instant" }); }, [screen]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(""), 5000); return () => clearTimeout(t); }, [notice]);
  const activeTab = ["tasks", "task-form"].includes(screen) ? "tasks" : ["work", "job", "timer", "summary", "history"].includes(screen) ? "work" : ["money", "income", "expense", "income-form", "expense-form"].includes(screen) ? "money" : screen === "calendar" ? "calendar" : "home";
  const workProps = { data, now, go, selectJob, clockIn, clockOut };
  const initials = data.name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const enter = () => { setEntered(true); setScreen("home"); try { sessionStorage.setItem("daily-entry-preview", "entered"); } catch { setNotice("Entry preference is saved for this visit only."); } };
  const leave = () => { setEntryStep("welcome"); setEntered(false); try { sessionStorage.removeItem("daily-entry-preview"); } catch { /* Entry is still reset for this visit. */ } };
  const missingJob = !jobs.length && ["home", "work", "job", "history", "calendar", "timer", "summary"].includes(screen);
  if (!entered) return <div className="dy-root"><div className="dy-phone">
    {storageError && <div className="dy-error" role="alert">{storageError}<button onClick={retryStorage}>Retry saving</button></div>}
    <Entrance initialStep={entryStep} name={data.name} jobs={jobs} onFinish={enter} onJob={saveJob} onName={name => setData(d => ({ ...d, name }))} />
  </div></div>;
  return <div className="dy-root"><div className="dy-phone"><JobsProvider jobs={jobs} data={data} saveJob={saveJob} selectJob={selectJob}>
    <div className="dy-status" aria-hidden="true"><span>{new Date(now).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false })}</span><span><Signal /><Wifi /><BatteryFull /></span></div>
    <header className="dy-top">
      {screen === "home" ? <div className="dy-brand"><Sun strokeWidth={1.8} />daily<span style={{ color: "#f58f6c" }}>.</span></div> : <><button aria-label={`Back to ${titles[parents[screen] || "home"]}`} className="dy-icon-button" onClick={() => go(parents[screen] || "home")}><ArrowLeft /></button><h1>{screen === "task-form" && editing ? "Edit task" : titles[screen]}</h1></>}
      {screen === "home" ? <button className="dy-avatar" aria-label="Open profile and settings" onClick={() => go("settings")}>{initials}</button> : screen === "tasks" ? <button className="dy-icon-button coral" aria-label="Add task" onClick={() => go("task-form")}><Plus /></button> : screen === "work" ? <button className="dy-icon-button" aria-label="Manage and delete jobs" onClick={() => { setDeletingId(undefined); setManage(true); }}><Trash2 /></button> : <span className="dy-top-space" />}
    </header>
    {storageError && <div className="dy-error dy-storage-error" role="alert">{storageError}<br /><button onClick={retryStorage}>Retry saving</button></div>}
    <main className="dy-scroll" ref={scroll} aria-label={titles[screen]}><div className="dy-page" key={screen}>
      {notice && <div className="dl-notice" role="status">{notice}</div>}
      {missingJob && <div className="dl-empty"><BriefcaseBusiness size={32} /><h2>A little room for what's next.</h2><p>You have no jobs yet. Add a role to track your shifts and plan your calendar. Your tasks and money are still here.</p><button className="dl-primary" onClick={() => { setEntryStep("jobs"); setEntered(false); }}><Plus size={17} />Add your first job</button><button className="dl-text" onClick={() => go("tasks")}>Go to your tasks</button></div>}
      {screen === "home" && !missingJob && <Home {...workProps} editTask={editTask} toggleTask={toggleTask} />}
      {screen === "tasks" && <Tasks data={data} toggle={toggleTask} edit={editTask} add={() => go("task-form")} />}
      {screen === "task-form" && <TaskForm key={editing?.id || "new-task"} task={editing} setData={setData} go={go} />}
      {screen === "work" && !missingJob && <><Work {...workProps} /><button className="dl-manage-trigger" onClick={() => { setDeletingId(undefined); setManage(true); }}><Trash2 />Manage & delete jobs</button></>}
      {screen === "job" && !missingJob && <><JobDetail {...workProps} /><button className="dl-manage-trigger" onClick={() => { setDeletingId(data.selectedJob); setManage(true); }}><Trash2 />Download or delete this job</button></>}
      {screen === "timer" && !missingJob && <Timer {...workProps} />}
      {screen === "summary" && !missingJob && <Summary session={lastSession} data={data} go={go} />}
      {screen === "history" && !missingJob && <WorkHistory data={data} />}
      {screen === "calendar" && !missingJob && <Calendar data={data} setData={setData} selectJob={selectJob} />}
      {screen === "money" && <MoneyOverview data={data} go={go} />}
      {(screen === "income" || screen === "expense") && <MoneyList kind={screen} data={data} go={go} />}
      {(screen === "income-form" || screen === "expense-form") && <MoneyForm kind={screen === "income-form" ? "income" : "expense"} setData={setData} go={go} />}
      {screen === "settings" && <><Settings data={data} setData={setData} /><button className="dl-manage-trigger" onClick={() => { setDeletingId(undefined); setManage(true); }}><Trash2 />Manage & delete jobs</button><button className="dl-secondary" onClick={leave}><LogOut />Return to welcome</button><p className="dl-note" style={{ marginTop: 12 }}>Prototype only: returning to welcome is not secure sign-out. Local data and any running shift are kept.</p></>}
    </div></main>
    <nav className="dy-nav" aria-label="Main navigation">{navItems.map(({ screen: next, name, icon: Icon }) => <button key={next} className={activeTab === next ? "active" : ""} aria-current={activeTab === next ? "page" : undefined} onClick={() => go(next)}><span className="dy-nav-icon"><Icon /></span>{name}</button>)}</nav>
    {manage && <JobDeletion jobs={jobs} data={data} initialId={deletingId} onClose={() => setManage(false)} onDelete={id => { if (deleteJob(id)) { setManage(false); setLastSession(null); setScreen("work"); setNotice("Job deleted. Your tasks and money are unchanged."); } }} />}
  </JobsProvider></div></div>;
}