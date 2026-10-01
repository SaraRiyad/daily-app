import { z } from 'zod';

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
export function dayKey(value: number | Date = Date.now()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const parseDay = (v: string) => new Date(`${v}T12:00:00`);
export const validDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(+parseDay(v)) && dayKey(parseDay(v)) === v;
export const dateLabel = (v: string) => parseDay(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const timeLabel = (v: number) => new Date(v).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const money = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
export function duration(ms: number) { const m = Math.floor(Math.max(0, ms) / 60000); return `${Math.floor(m / 60)}h ${m % 60}m`; }
export function timer(ms: number) { const s = Math.floor(Math.max(0, ms) / 1000); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
const id = z.string().min(1);
const day = z.string().refine(validDay);
const rate = z.number().finite().min(0.01).max(100000);
const rates = { normal: rate, overtime: rate };
export const jobSchema = z.object({ id, name: z.string().trim().min(1).max(50), description: z.string().max(100), icon: z.enum(['coffee', 'laptop', 'store', 'briefcase']), ...rates }).refine(v => v.overtime >= v.normal);
export const taskSchema = z.object({ id, title: z.string().trim().min(1).max(160), due: day, priority: z.enum(['Low', 'Medium', 'High']), done: z.boolean() });
export const transactionSchema = z.object({ id, kind: z.enum(['income', 'expense']), title: z.string().trim().min(1).max(120), amount: z.number().finite().positive().max(1e12), category: z.string().min(1), date: day, note: z.string().max(500) });
const timestamp = z.number().finite().nonnegative().max(8640000000000000);
const activeSchema = z.object({ jobId: id, start: timestamp, ...rates });
export const sessionSchema = activeSchema.extend({ id, end: timestamp }).refine(v => v.end >= v.start);
const statuses = z.enum(['Work', 'Day off', 'Vacation', 'Sick']);
export const preferencesSchema = z.object({
  theme: z.enum(['Light', 'Dark', 'System']).default('Light'),
  hideHomeBalance: z.boolean().default(false),
  avatarColor: z.enum(['Coral', 'Stone', 'Charcoal']).default('Coral'),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const storeSchema = z.object({
  version: z.literal(1), name: z.string().trim().min(1).max(60), entered: z.boolean(),
  preferences: preferencesSchema.default({ theme: 'Light', hideHomeBalance: false, avatarColor: 'Coral' }),
  jobs: z.array(jobSchema), selectedJob: z.string(), active: activeSchema.nullable(),
  tasks: z.array(taskSchema), transactions: z.array(transactionSchema), sessions: z.array(sessionSchema),
  days: z.array(z.object({ jobId: id, date: day, status: statuses })),
}).superRefine((s, ctx) => {
  const jobs = new Set(s.jobs.map(j => j.id));
  const refs = [...s.sessions.map(v => v.jobId), ...s.days.map(v => v.jobId), ...(s.active ? [s.active.jobId] : [])];
  if ((s.jobs.length ? !jobs.has(s.selectedJob) : s.selectedJob !== '') || refs.some(v => !jobs.has(v)) || (s.active && s.active.jobId !== s.selectedJob)) ctx.addIssue({ code: 'custom', message: 'Inconsistent job references' });
  for (const list of [s.jobs, s.tasks, s.transactions, s.sessions]) if (new Set(list.map(v => v.id)).size !== list.length) ctx.addIssue({ code: 'custom', message: 'Duplicate IDs' });
  if (new Set(s.days.map(d => `${d.jobId}:${d.date}`)).size !== s.days.length) ctx.addIssue({ code: 'custom', message: 'Duplicate calendar entries' });
});
export type Job = z.infer<typeof jobSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Store = z.infer<typeof storeSchema>;
export type DayStatus = z.infer<typeof statuses>;
export type Segment = { sessionId: string; jobId: string; date: string; start: number; end: number; total: number; normal: number; overtime: number; earnings: number; normalRate: number; overtimeRate: number };

// Chronological, cumulative per-job/per-local-day allowance. Rates are snapshotted
// at clock-in so editing a job can never rewrite past earnings.
export function segments(sessions: Session[]): Segment[] {
  const used: Record<string, number> = {};
  return [...sessions].sort((a, b) => a.start - b.start).flatMap(s => {
    const rows: Segment[] = [];
    let cursor = s.start;
    while (cursor < s.end) {
      const midnight = new Date(cursor); midnight.setHours(24, 0, 0, 0);
      const end = Math.min(s.end, +midnight);
      if (end <= cursor) break;
      const date = dayKey(cursor), key = `${s.jobId}:${date}`, total = end - cursor;
      const normal = Math.min(total, Math.max(0, 8 * 3600000 - (used[key] || 0))), overtime = total - normal;
      rows.push({ sessionId: s.id, jobId: s.jobId, date, start: cursor, end, total, normal, overtime, earnings: (normal * s.normal + overtime * s.overtime) / 3600000, normalRate: s.normal, overtimeRate: s.overtime });
      used[key] = (used[key] || 0) + total;
      cursor = end;
    }
    return rows;
  });
}
export function withActive(s: Store, now: number): Session[] {
  return s.active ? [...s.sessions, { ...s.active, id: 'active', end: Math.max(s.active.start, now) }] : s.sessions;
}
export const totals = (rows: Segment[]) => rows.reduce((a, s) => ({ total: a.total + s.total, normal: a.normal + s.normal, overtime: a.overtime + s.overtime, earnings: a.earnings + s.earnings }), { total: 0, normal: 0, overtime: 0, earnings: 0 });
export function balance(s: Store) {
  const income = s.transactions.filter(t => t.kind === 'income').reduce((a, t) => a + t.amount, 0);
  const expense = s.transactions.filter(t => t.kind === 'expense').reduce((a, t) => a + t.amount, 0);
  return { income, expense, remaining: income - expense };
}
export function seed(): Store {
  const today = new Date(), at = (offset: number, hour = 12, minute = 0) => { const d = new Date(today); d.setDate(d.getDate() + offset); d.setHours(hour, minute, 0, 0); return +d; };
  const jobs: Job[] = [
    { id: 'coffee', name: 'Coffee Shop', description: 'Good coffee. Familiar faces.', icon: 'coffee', normal: 5, overtime: 7 },
    { id: 'freelance', name: 'Freelance', description: 'My own kind of work', icon: 'laptop', normal: 8, overtime: 10 },
  ];
  return { version: 1, name: 'Alex', entered: false, preferences: preferencesSchema.parse({}), jobs, selectedJob: 'coffee', active: null,
    tasks: [
      { id: uid(), title: 'Plan the week ahead', due: dayKey(), priority: 'High', done: false },
      { id: uid(), title: 'Pick up a few groceries', due: dayKey(), priority: 'Medium', done: false },
      { id: uid(), title: 'A little morning stretch', due: dayKey(), priority: 'Low', done: true },
      { id: uid(), title: 'Send the design proposal', due: dayKey(at(1)), priority: 'High', done: false },
      { id: uid(), title: 'Book a dentist appointment', due: dayKey(at(3)), priority: 'Low', done: false },
    ],
    transactions: [
      { id: uid(), kind: 'income', title: 'Coffee Shop paycheck', amount: 326.5, category: 'Salary', date: dayKey(at(-3)), note: 'Last week’s shifts' },
      { id: uid(), kind: 'income', title: 'Poster design', amount: 185, category: 'Freelance', date: dayKey(at(-2)), note: '' },
      { id: uid(), kind: 'expense', title: 'Weekly groceries', amount: 47.8, category: 'Food', date: dayKey(at(-1)), note: '' },
      { id: uid(), kind: 'expense', title: 'Bus pass', amount: 28, category: 'Transportation', date: dayKey(at(-2)), note: '' },
      { id: uid(), kind: 'expense', title: 'Lunch with Maya', amount: 18.5, category: 'Food', date: dayKey(), note: '' },
    ],
    sessions: [-1, -2, -4, -5].map((d, i) => ({ id: uid(), jobId: 'coffee', start: at(d, 9, 2 + i), end: at(d, i === 1 ? 18 : 16, 17), normal: 5, overtime: 7 })).concat([{ id: uid(), jobId: 'freelance', start: at(-3, 10), end: at(-3, 13, 35), normal: 8, overtime: 10 }]),
    days: [{ jobId: 'coffee', date: dayKey(at(-3)), status: 'Day off' }, { jobId: 'coffee', date: dayKey(at(2)), status: 'Day off' }, { jobId: 'coffee', date: dayKey(at(6)), status: 'Vacation' }],
  };
}