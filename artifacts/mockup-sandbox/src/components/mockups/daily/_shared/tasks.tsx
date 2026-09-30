import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { dayKey, uid } from "./model";
import type { Data, Navigate, Task } from "./model";
import { Button, Empty, Tabs, TaskRow } from "./ui";

export function Tasks({ data, toggle, edit, add }: { data: Data; toggle: (id: string) => void; edit: (task: Task) => void; add: () => void }) {
  const [filter, setFilter] = useState<"Today" | "Upcoming" | "Completed">("Today");
  const today = dayKey();
  const list = data.tasks.filter(t => filter === "Completed" ? t.done : !t.done && (filter === "Today" ? t.due <= today : t.due > today)).sort((a, b) => a.due.localeCompare(b.due));
  return <><h2 className="dy-heading">A little more done.</h2><p className="dy-subtitle">Make room for what matters, one thing at a time.</p><Button onClick={add}><Plus />Add a task</Button><Tabs values={["Today", "Upcoming", "Completed"] as const} value={filter} change={setFilter} /><p className="dy-count">{list.length} {filter === "Completed" ? "things taken care of" : `task${list.length === 1 ? "" : "s"}${filter === "Today" ? " · includes overdue" : " ahead"}`}</p>{list.map(t => <TaskRow key={t.id} task={t} toggle={() => toggle(t.id)} edit={() => edit(t)} />)}{!list.length && <Empty title={filter === "Completed" ? "Small wins live here." : "A little breathing room."} text={filter === "Completed" ? "Check off a task and celebrate a little progress." : "Nothing on this list. Add something when you're ready."} action={add} label="Add a task" />}</>;
}
export function TaskForm({ task, setData, go }: { task: Task | null; setData: Dispatch<SetStateAction<Data>>; go: Navigate }) {
  const [title, setTitle] = useState(task?.title || "");
  const [due, setDue] = useState(task?.due || dayKey());
  const [priority, setPriority] = useState<Task["priority"]>(task?.priority || "Medium");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirm) cancelRef.current?.focus(); }, [confirm]);
  const save = () => {
    if (!title.trim() || !due) { setError("Give your task a name and choose a due date."); return; }
    const next: Task = { id: task?.id || uid(), title: title.trim(), due, priority, done: task?.done || false };
    setData(d => ({ ...d, tasks: task ? d.tasks.map(t => t.id === task.id ? next : t) : [...d.tasks, next] })); go("tasks");
  };
  return <><h2 className="dy-heading">{task ? "Make it yours." : "One thing at a time."}</h2><p className="dy-subtitle">{task ? "Plans change. Your list can too." : "Get it out of your head and onto your list."}</p><form onSubmit={e => { e.preventDefault(); save(); }}><label className="dy-field">Task name<input autoFocus required maxLength={120} placeholder="What would you like to get done?" value={title} onChange={e => setTitle(e.target.value)} /></label><label className="dy-field">Due date<input required type="date" value={due} onChange={e => setDue(e.target.value)} /></label><label className="dy-field">Priority<select value={priority} onChange={e => setPriority(e.target.value as Task["priority"])}><option>Low</option><option>Medium</option><option>High</option></select></label><p className="dy-form-help">Due today? It'll show up on Home, too.</p>{error && <div className="dy-error" role="alert">{error}</div>}<Button type="submit">{task ? "Save changes" : "Add task"}</Button></form>{task && <button className="dy-delete" onClick={() => setConfirm(true)}><Trash2 />Delete task</button>}{confirm && <div className="dy-modal-backdrop"><div className="dy-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description" onKeyDown={e => { if (e.key === "Escape") setConfirm(false); if (e.key === "Tab") { e.preventDefault(); (document.activeElement === cancelRef.current ? deleteRef : cancelRef).current?.focus(); } }}><h2 id="delete-title">Let this one go?</h2><p id="delete-description">“{task?.title}” will be deleted. This can't be undone.</p><button ref={deleteRef} className="dy-button danger" onClick={() => { setData(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== task?.id) })); go("tasks"); }}>Delete task</button><button ref={cancelRef} className="dy-button secondary" onClick={() => setConfirm(false)}>Keep task</button></div></div>}</>;
}