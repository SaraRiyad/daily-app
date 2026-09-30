import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BatteryFull, BriefcaseBusiness, CalendarDays, CheckCheck, House, Plus, Signal, Sun, Wallet, Wifi } from "lucide-react";
import { useDaily, uid } from "./_shared/model";
import type { JobId, Screen, Session, Task } from "./_shared/model";
import { Home } from "./_shared/home";
import { Tasks, TaskForm } from "./_shared/tasks";
import { JobDetail, Summary, Timer, Work, WorkHistory } from "./_shared/work";
import { MoneyForm, MoneyList, MoneyOverview } from "./_shared/money";
import { Calendar } from "./_shared/calendar";
import { Settings } from "./_shared/settings";
import "./_group.css";

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
  const { data, setData, now, storageError, retryStorage } = useDaily();
  const [screen, setScreen] = useState<Screen>("home");
  const [editing, setEditing] = useState<Task | null>(null);
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const go = (next: Screen) => { if (next === "task-form") setEditing(null); setScreen(next); };
  const selectJob = (id: JobId) => setData(d => d.active ? d : { ...d, selectedJob: id });
  const editTask = (task: Task) => { setEditing(task); setScreen("task-form"); };
  const toggleTask = (id: string) => setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
  const clockIn = () => { setData(d => d.active ? d : { ...d, active: { jobId: d.selectedJob, start: Date.now() } }); setScreen("timer"); };
  const clockOut = () => {
    if (!data.active) return;
    const session: Session = { id: uid(), ...data.active, end: Math.max(Date.now(), data.active.start) };
    setData(d => d.active ? { ...d, selectedJob: d.active.jobId, sessions: [...d.sessions, session], active: null } : d);
    setLastSession(session); setScreen("summary");
  };
  useEffect(() => { scroll.current?.scrollTo({ top: 0, behavior: "instant" }); }, [screen]);
  const activeTab = ["tasks", "task-form"].includes(screen) ? "tasks" : ["work", "job", "timer", "summary", "history"].includes(screen) ? "work" : ["money", "income", "expense", "income-form", "expense-form"].includes(screen) ? "money" : screen === "calendar" ? "calendar" : "home";
  const workProps = { data, now, go, selectJob, clockIn, clockOut };
  const initials = data.name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
  return <div className="dy-root"><div className="dy-phone">
    <div className="dy-status" aria-hidden="true"><span>{new Date(now).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false })}</span><span><Signal /><Wifi /><BatteryFull /></span></div>
    <header className="dy-top">
      {screen === "home" ? <div className="dy-brand"><Sun strokeWidth={1.8} />daily<span style={{ color: "#f58f6c" }}>.</span></div> : <><button aria-label={`Back to ${titles[parents[screen] || "home"]}`} className="dy-icon-button" onClick={() => go(parents[screen] || "home")}><ArrowLeft /></button><h1>{screen === "task-form" && editing ? "Edit task" : titles[screen]}</h1></>}
      {screen === "home" ? <button className="dy-avatar" aria-label="Open profile and settings" onClick={() => go("settings")}>{initials}</button> : screen === "tasks" ? <button className="dy-icon-button coral" aria-label="Add task" onClick={() => go("task-form")}><Plus /></button> : <span className="dy-top-space" />}
    </header>
    {storageError && <div className="dy-error dy-storage-error" role="alert">{storageError}<br /><button onClick={retryStorage}>Retry saving</button></div>}
    <main className="dy-scroll" ref={scroll} aria-label={titles[screen]}><div className="dy-page" key={screen}>
      {screen === "home" && <Home {...workProps} editTask={editTask} toggleTask={toggleTask} />}
      {screen === "tasks" && <Tasks data={data} toggle={toggleTask} edit={editTask} add={() => go("task-form")} />}
      {screen === "task-form" && <TaskForm key={editing?.id || "new-task"} task={editing} setData={setData} go={go} />}
      {screen === "work" && <Work {...workProps} />}
      {screen === "job" && <JobDetail {...workProps} />}
      {screen === "timer" && <Timer {...workProps} />}
      {screen === "summary" && <Summary session={lastSession} data={data} go={go} />}
      {screen === "history" && <WorkHistory data={data} />}
      {screen === "calendar" && <Calendar data={data} setData={setData} selectJob={selectJob} />}
      {screen === "money" && <MoneyOverview data={data} go={go} />}
      {(screen === "income" || screen === "expense") && <MoneyList kind={screen} data={data} go={go} />}
      {(screen === "income-form" || screen === "expense-form") && <MoneyForm kind={screen === "income-form" ? "income" : "expense"} setData={setData} go={go} />}
      {screen === "settings" && <Settings data={data} setData={setData} />}
    </div></main>
    <nav className="dy-nav" aria-label="Main navigation">{navItems.map(({ screen: next, name, icon: Icon }) => <button key={next} className={activeTab === next ? "active" : ""} aria-current={activeTab === next ? "page" : undefined} onClick={() => go(next)}><span className="dy-nav-icon"><Icon /></span>{name}</button>)}</nav>
  </div></div>;
}