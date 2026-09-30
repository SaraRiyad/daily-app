import { ChevronRight, Wallet } from "lucide-react";
import { dayKey } from "./model";
import type { Data, JobId, Navigate, Task } from "./model";
import { money } from "./model";
import { balance } from "./money";
import { Empty, SectionHead, TaskRow } from "./ui";
import { WorkCard } from "./work";

export function Home({ data, now, go, selectJob, clockIn, clockOut, editTask, toggleTask }: { data: Data; now: number; go: Navigate; selectJob: (id: JobId) => void; clockIn: () => void; clockOut: () => void; editTask: (task: Task) => void; toggleTask: (id: string) => void }) {
  const today = dayKey(now), tasks = data.tasks.filter(t => t.due === today || (!t.done && t.due < today));
  const completed = tasks.filter(t => t.done).length;
  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done));
  const greeting = new Date(now).getHours() < 12 ? "Good morning" : new Date(now).getHours() < 17 ? "Good afternoon" : "Good evening";
  return <div className="dy-home"><div className="dy-kicker">{new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div><h1 className="dy-heading" style={{ overflowWrap: "anywhere" }}>{greeting}, {data.name.split(" ")[0]}.</h1><p className="dy-subtitle" style={{ marginBottom: 15 }}>A little order. A little more breathing room.</p><WorkCard data={data} now={now} go={go} selectJob={selectJob} clockIn={clockIn} clockOut={clockOut} compact /><button className="dy-balance-link" onClick={() => go("money")}><span className="dy-symbol"><Wallet /></span><div><div className="dy-small dy-muted">Your balance</div><div className="dy-money-value">{money(balance(data).remaining)}</div></div><ChevronRight /></button><section className="dy-section" style={{ marginTop: 15 }}><SectionHead title="Today's little list" action={() => go("tasks")} label="See all" /><div className="dy-row dy-small dy-muted"><span>{completed} of {tasks.length} completed</span><span>{tasks.some(t => t.due < today) ? "Includes overdue" : "One step at a time"}</span></div><div className="dy-progress" role="progressbar" aria-label="Today's task completion" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={Math.max(1, tasks.length)}><div style={{ width: `${tasks.length ? completed / tasks.length * 100 : 0}%` }} /></div>{sorted.slice(0, 3).map(t => <TaskRow key={t.id} task={t} toggle={() => toggleTask(t.id)} edit={() => editTask(t)} />)}{!tasks.length && <Empty title="Your day has a little space." text="Add a task, or enjoy the breathing room." action={() => go("task-form")} label="Add a task" />}</section></div>;
}