import { useEffect, useState } from "react";
import { z } from "zod";

export const JOBS = [
  { id: "coffee", name: "Coffee Shop", subtitle: "Your neighborhood shift", normal: 5, overtime: 7 },
  { id: "freelance", name: "Freelance", subtitle: "A little more on your terms", normal: 8, overtime: 10 },
] as const;
export type JobId = typeof JOBS[number]["id"];
export type DayStatus = "Work" | "Day off" | "Vacation" | "Sick";
export type Task = { id: string; title: string; due: string; priority: "Low" | "Medium" | "High"; done: boolean };
export type Transaction = { id: string; kind: "income" | "expense"; amount: number; title: string; category: string; date: string; note: string };
export type Session = { id: string; jobId: JobId; start: number; end: number };
export type Data = { version: 1; name: string; tasks: Task[]; transactions: Transaction[]; sessions: Session[]; selectedJob: JobId; active: { jobId: JobId; start: number } | null; days: Record<string, DayStatus> };
export const dayKey = (d: Date | number = new Date()) => { const t = new Date(d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
export const parseDay = (d: string) => new Date(`${d}T12:00:00`);
export const relativeDay = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return dayKey(d); };
export const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
export const dateLabel = (d: string, full = false) => parseDay(d).toLocaleDateString("en-US", { month: full ? "long" : "short", day: "numeric", ...(full ? { weekday: "long" as const } : {}) });
export const timeLabel = (n: number) => new Date(n).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const duration = (ms: number) => { const minutes = Math.floor(Math.max(0, ms) / 60000); return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`; };
export const timerLabel = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(parseDay(s).getTime()) && dayKey(parseDay(s)) === s);
const jobSchema = z.enum(["coffee", "freelance"]);
const stamp = z.number().finite().nonnegative().max(8640000000000000);
const schema = z.object({
  version: z.literal(1), name: z.string().trim().min(1).max(60), selectedJob: jobSchema,
  active: z.object({ jobId: jobSchema, start: stamp }).nullable(),
  tasks: z.array(z.object({ id: z.string(), title: z.string().trim().min(1).max(120), due: dateSchema, priority: z.enum(["Low", "Medium", "High"]), done: z.boolean() })),
  transactions: z.array(z.object({ id: z.string(), kind: z.enum(["income", "expense"]), amount: z.number().finite().positive().max(1e9), title: z.string().trim().min(1).max(100), category: z.string(), date: dateSchema, note: z.string() })),
  sessions: z.array(z.object({ id: z.string(), jobId: jobSchema, start: stamp, end: stamp }).refine(s => s.end >= s.start)),
  days: z.record(z.string(), z.enum(["Work", "Day off", "Vacation", "Sick"])),
});
function seed(): Data {
  const session = (offset: number, jobId: JobId, hour: number, minutes: number): Session => { const d = parseDay(relativeDay(offset)); d.setHours(hour, 0, 0, 0); return { id: uid(), jobId, start: +d, end: +d + minutes * 60000 }; };
  return { version: 1, name: "Alex", selectedJob: "coffee", active: null,
    tasks: [
      { id: uid(), title: "Pick up groceries", due: relativeDay(0), priority: "Medium", done: false },
      { id: uid(), title: "Send the website proposal", due: relativeDay(0), priority: "High", done: false },
      { id: uid(), title: "Water the balcony plants", due: relativeDay(0), priority: "Low", done: true },
      { id: uid(), title: "Book a dentist appointment", due: relativeDay(1), priority: "Medium", done: false },
      { id: uid(), title: "Pay the electricity bill", due: relativeDay(3), priority: "High", done: false },
      { id: uid(), title: "Send last week's invoice", due: relativeDay(-1), priority: "High", done: true },
    ],
    sessions: [session(-1, "coffee", 8, 495), session(-2, "coffee", 9, 370), session(-3, "freelance", 13, 195), session(-4, "coffee", 8, 455), session(-6, "freelance", 10, 265), session(-8, "coffee", 9, 420), session(-15, "coffee", 8, 510), session(-20, "freelance", 12, 210), session(-35, "coffee", 8, 465)],
    transactions: [
      { id: uid(), kind: "income", amount: 286.5, title: "Coffee Shop paycheck", category: "Salary", date: relativeDay(-2), note: "Last week's shifts" },
      { id: uid(), kind: "income", amount: 148, title: "Website deposit", category: "Freelance", date: relativeDay(-4), note: "Mia's ceramics studio" },
      { id: uid(), kind: "expense", amount: 12.8, title: "Lunch at the deli", category: "Food", date: relativeDay(0), note: "" },
      { id: uid(), kind: "expense", amount: 24, title: "Weekly bus pass", category: "Transportation", date: relativeDay(-1), note: "" },
      { id: uid(), kind: "expense", amount: 38.65, title: "A few things for home", category: "Shopping", date: relativeDay(-3), note: "" },
    ],
    days: { [`coffee:${relativeDay(1)}`]: "Day off", [`coffee:${relativeDay(4)}`]: "Work", [`freelance:${relativeDay(2)}`]: "Work", [`coffee:${relativeDay(9)}`]: "Vacation" },
  };
}
const STORAGE_KEY = "daily-prototype-v1";
function load(): { data: Data; error: string } {
  try { const raw = localStorage.getItem(STORAGE_KEY); return { data: raw ? schema.parse(JSON.parse(raw)) as Data : seed(), error: "" }; }
  catch { return { data: seed(), error: "Your saved data couldn't be read. You're using temporary sample data. Retry saving to replace unreadable data." }; }
}
export function useDaily() {
  const [initial] = useState(load);
  const [data, setData] = useState(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const [blocked, setBlocked] = useState(Boolean(initial.error));
  const [now, setNow] = useState(Date.now());
  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); setStorageError(""); setBlocked(false); } catch { setStorageError("Changes are only in memory. Browser storage is unavailable; keep this tab open or retry saving."); } };
  useEffect(() => { if (!blocked) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); setStorageError(""); } catch { setStorageError("Changes are only in memory. Browser storage is unavailable; keep this tab open or retry saving."); } } }, [data, blocked]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  return { data, setData, now, storageError, retryStorage: save };
}
export type Segment = { sessionId: string; jobId: JobId; date: string; start: number; end: number; normal: number; overtime: number; earnings: number; total: number };
export function segments(sessions: Session[]): Segment[] {
  const used: Record<string, number> = {};
  const result: Segment[] = [];
  [...sessions].sort((a, b) => a.start - b.start).forEach(s => {
    let cursor = s.start;
    // Split at local midnight; each job gets an independent eight-hour daily allowance.
    while (cursor < s.end) {
      const midnight = new Date(cursor); midnight.setHours(24, 0, 0, 0);
      const end = Math.min(s.end, +midnight), date = dayKey(cursor), key = `${s.jobId}:${date}`;
      const total = end - cursor, normal = Math.min(total, Math.max(0, 8 * 3600000 - (used[key] || 0))), overtime = total - normal;
      const job = JOBS.find(j => j.id === s.jobId)!;
      result.push({ sessionId: s.id, jobId: s.jobId, date, start: cursor, end, normal, overtime, total, earnings: (normal * job.normal + overtime * job.overtime) / 3600000 });
      used[key] = (used[key] || 0) + total; cursor = end;
    }
  });
  return result;
}
export function totalSegments(items: Segment[]) { return items.reduce((acc, s) => ({ total: acc.total + s.total, normal: acc.normal + s.normal, overtime: acc.overtime + s.overtime, earnings: acc.earnings + s.earnings }), { total: 0, normal: 0, overtime: 0, earnings: 0 }); }
export const withActive = (data: Data, now: number) => [...data.sessions, ...(data.active ? [{ ...data.active, id: "active", end: Math.max(now, data.active.start) }] : [])];
export function statusFor(data: Data, jobId: JobId, date: string): DayStatus | undefined {
  return data.days[`${jobId}:${date}`] ?? (segments(data.sessions.filter(s => s.jobId === jobId)).some(s => s.date === date) || (data.active?.jobId === jobId && dayKey(data.active.start) === date) ? "Work" : undefined);
}
export type Screen = "home" | "tasks" | "task-form" | "work" | "job" | "timer" | "summary" | "history" | "calendar" | "money" | "income" | "expense" | "income-form" | "expense-form" | "settings";
export type Navigate = (screen: Screen) => void;