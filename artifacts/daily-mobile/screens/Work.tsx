import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { fonts } from '@/constants/colors';
import { useDailyUI } from '@/hooks/useDailyUI';
import { useDaily } from '@/state/DailyContext';
import { balance, dateLabel, dayKey, duration, money, parseDay, segments, timeLabel, timer, totals, withActive, type DayStatus, type Job } from '@/state/model';
import { DeleteJob, JobForm, JobPicker } from '@/components/daily/Jobs';
import { Button, Card, Choices, DetailRow, Empty, Icon, IconButton, JobIcon, Metric, MonthGrid, Note, Page, Section, Title, Txt, go } from '@/components/daily/UI';
import { TaskRow } from './TasksMoney';

export function WorkCard() {
  const { c, s } = useDailyUI();
  const { data, now, clockIn, clockOut } = useDaily();
  const total = totals(segments(withActive(data, now)).filter(v => v.date === dayKey(now)));
  return <Card style={{ backgroundColor: c.charcoal, borderColor: c.charcoal, padding: 18, gap: 17 }}><JobPicker dark />
    <View style={{ gap: 4 }}><Txt style={{ color: c.onCharcoal, fontSize: data.active ? 34 : 27, fontFamily: fonts.medium, letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>{data.active ? timer(now - data.active.start) : 'Not clocked in'}</Txt><Txt style={{ color: c.subtleOnCharcoal, fontSize: 12 }}>{data.active ? `Started at ${timeLabel(data.active.start)} · job locked` : 'Ready whenever you are.'}</Txt></View>
    <Button icon={data.active ? 'square' : 'play'} onPress={() => { if (data.active) { const session = clockOut(); if (session) go('summary', session.id); } else if (clockIn()) go('timer'); }} testID={data.active ? 'clock-out' : 'clock-in'}>{data.active ? 'Clock out' : 'Clock in'}</Button>
    <View style={[s.row, { paddingTop: 14, borderTopWidth: 1, borderTopColor: c.mutedForeground }]}><Metric dark label="Today's hours · all jobs" value={duration(total.total)} /><Metric dark label="Estimated earnings" value={money(total.earnings)} /></View>
    {data.active && <Pressable onPress={() => go('timer')} accessibilityRole="button" style={{ paddingVertical: 8 }}><Txt style={{ color: c.primary, textAlign: 'center', fontSize: 13 }}>Open live timer →</Txt></Pressable>}
  </Card>;
}
export function NoJobs() {
  const [adding, setAdding] = useState(false);
  return <><Empty title="A little room for what’s next." text="Add a role to track your shifts and plan your calendar. Your tasks and money are still here." icon="briefcase" action={() => setAdding(true)} label="Add your first job" />{adding && <JobForm onClose={() => setAdding(false)} />}</>;
}
export function HomeScreen() {
  const { c, s } = useDailyUI();
  const { data, now } = useDaily(), today = dayKey(now), h = new Date(now).getHours();
  const tasks = data.tasks.filter(t => t.due === today || (!t.done && t.due < today)), done = tasks.filter(t => t.done).length;
  return <Page home><View style={{ gap: 8 }}><Txt muted style={{ fontSize: 11, letterSpacing: 1.4 }}>{new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Txt><Title sub="A little order. A little more breathing room.">{`Good ${h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'}, ${data.name.split(' ')[0]}.`}</Title></View>
    {data.jobs.length ? <WorkCard /> : <NoJobs />}
    <Pressable onPress={() => router.push('/(tabs)/money')} accessibilityRole="button" accessibilityLabel={data.preferences.hideHomeBalance ? 'Balance hidden. Open Money to view.' : 'View your balance'} style={[s.card, s.row, { padding: 17 }]}><View style={s.jobIcon}><Icon name={data.preferences.hideHomeBalance ? 'eye-off' : 'credit-card'} color={c.accentForeground} /></View><View style={{ flex: 1, gap: 3 }}><Txt muted style={{ fontSize: 12 }}>Your balance</Txt><Txt style={{ fontSize: 25, fontFamily: fonts.medium }}>{data.preferences.hideHomeBalance ? 'Hidden' : money(balance(data).remaining)}</Txt></View><Icon name="chevron-right" size={18} /></Pressable>
    <View><Section title="Today’s little list" action={() => router.push('/(tabs)/tasks')} /><View style={[s.between, { marginTop: 4 }]}><Txt muted style={{ fontSize: 12 }}>{done} of {tasks.length} completed</Txt><Txt muted style={{ fontSize: 11 }}>One step at a time</Txt></View><View accessibilityRole="progressbar" accessibilityLabel="Today's task completion" accessibilityValue={{ min: 0, max: Math.max(1, tasks.length), now: done }} style={{ height: 5, borderRadius: 3, backgroundColor: c.border, marginVertical: 13 }}><View style={{ width: `${tasks.length ? done / tasks.length * 100 : 0}%`, backgroundColor: c.primary, borderRadius: 3, height: 5 }} /></View>
      {tasks.length ? [...tasks].sort((a, b) => Number(a.done) - Number(b.done)).slice(0, 3).map(t => <TaskRow key={t.id} task={t} />) : <Empty title="Your day has a little space." text="A fresh list, a fresh start." label="Add a task" action={() => go('task-form')} />}
    </View>
  </Page>;
}
export function WorkScreen() {
  const { c, s } = useDailyUI();
  const { data, selectJob } = useDaily();
  const [adding, setAdding] = useState(false), [editing, setEditing] = useState<Job | undefined>(), [deleting, setDeleting] = useState(false);
  return <Page title="Work & jobs" right={<IconButton name="trash-2" label="Manage and delete jobs" onPress={() => setDeleting(true)} />}><Title sub="Different jobs. One place to keep track.">Your time, well spent.</Title>
    {data.jobs.length ? <><WorkCard /><Section title={`Your jobs · ${data.jobs.length}`} label="+ Add job" action={() => setAdding(true)} />
      {data.jobs.map(j => <Card key={j.id} style={{ backgroundColor: data.selectedJob === j.id ? c.peach : c.card, borderColor: data.selectedJob === j.id ? c.primary : c.border }}><Pressable accessibilityRole="button" accessibilityLabel={`Open ${j.name}`} onPress={() => { if (!data.active) selectJob(j.id); go('job', j.id); }} style={s.row}><JobIcon job={j} /><View style={{ flex: 1, gap: 3 }}><Txt style={{ fontFamily: fonts.medium, fontSize: 18 }}>{j.name}</Txt><Txt muted style={{ fontSize: 12 }}>{j.description}</Txt></View><Icon name="chevron-right" size={17} /></Pressable>
        <View style={[s.row, { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 15 }]}><Metric label="Normal / hour" value={money(j.normal)} /><Metric label="Overtime / hour" value={money(j.overtime)} /></View>
        <View style={s.between}><Txt style={{ color: c.accentForeground, fontSize: 11, flex: 1 }}>{data.selectedJob === j.id ? data.active ? 'Currently working' : 'Selected for your next shift' : `${data.sessions.filter(v => v.jobId === j.id).length} shifts recorded`}</Txt><Pressable onPress={() => setEditing(j)} accessibilityLabel={`Edit ${j.name}`} accessibilityRole="button" style={[s.row, { minHeight: 44 }]}><Icon name="edit-2" size={13} /><Txt style={{ fontSize: 12 }}>Edit</Txt></Pressable></View>
      </Card>)}
      <Button secondary icon="plus" onPress={() => setAdding(true)}>Another job? Make it yours.</Button><Button secondary icon="trash-2" onPress={() => setDeleting(true)}>Manage & delete jobs</Button><Note>Each job keeps its own hours, earnings and calendar. Only one shift can run at a time.</Note>
    </> : <NoJobs />}
    {(adding || editing) && <JobForm job={editing} onClose={() => { setAdding(false); setEditing(undefined); }} />}{deleting && <DeleteJob onClose={() => setDeleting(false)} />}
  </Page>;
}
function JobStats({ job, start, end }: { job: Job; start: string; end: string }) {
  const { c, s } = useDailyUI();
  const { data, now } = useDaily();
  const rows = segments(withActive(data, now)).filter(v => v.jobId === job.id && v.date >= start && v.date < end), total = totals(rows);
  const days = data.days.filter(v => v.jobId === job.id && v.date >= start && v.date < end);
  const worked = new Set([...rows.map(v => v.date), ...days.filter(v => v.status === 'Work' && v.date <= dayKey(now)).map(v => v.date)]);
  return <Card><View style={s.row}><Metric label="Working hours" value={duration(total.total)} /><Metric label="Estimated earnings" value={money(total.earnings)} /></View><View style={[s.row, { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 14 }]}><Metric label="Days worked" value={String(worked.size)} /><Metric label="Days off · planned & taken" value={String(days.filter(v => v.status === 'Day off').length)} /></View><View style={s.between}><Txt muted style={{ fontSize: 12 }}>Vacation · {days.filter(v => v.status === 'Vacation').length}</Txt><Txt muted style={{ fontSize: 12 }}>Sick · {days.filter(v => v.status === 'Sick').length}</Txt></View></Card>;
}
export function JobDetailScreen({ id }: { id?: string }) {
  const { s } = useDailyUI();
  const { data, now, selectJob, clockIn, clockOut } = useDaily(), job = data.jobs.find(j => j.id === (id || data.selectedJob));
  const [editing, setEditing] = useState(false), [deleting, setDeleting] = useState(false);
  if (!job) return <Page title="Job details" back><NoJobs /></Page>;
  const start = dayKey(now).slice(0, 7) + '-01', next = parseDay(start); next.setMonth(next.getMonth() + 1);
  const locked = !!data.active && data.active.jobId !== job.id;
  return <Page title="Job details" back><View style={s.row}><JobIcon job={job} /><View style={{ flex: 1 }}><Title sub={job.description}>{job.name}</Title></View></View>
    <Card><DetailRow label="Normal hourly rate" value={money(job.normal)} /><DetailRow label="Overtime hourly rate" value={money(job.overtime)} /><Button secondary icon="edit-2" onPress={() => setEditing(true)}>Edit job details</Button></Card>
    <Note>Overtime starts after 8 hours per job, per local day. Multiple sessions count together. Past rates are preserved.</Note><Section title="This month" /><JobStats job={job} start={start} end={dayKey(next)} />
    {locked && <Note>Another job has a running shift. Clock out there before starting this job.</Note>}
    <Button disabled={locked} icon={data.active ? 'square' : 'play'} onPress={() => { if (data.active?.jobId === job.id) { const v = clockOut(); if (v) go('summary', v.id); } else { selectJob(job.id); if (clockIn()) go('timer'); } }}>{data.active?.jobId === job.id ? 'Clock out' : 'Clock in at this job'}</Button>
    <Button secondary icon="clock" onPress={() => go('history', job.id)}>Work history</Button>
    <Button secondary icon="calendar" onPress={() => go('job-calendar', job.id)}>Plan work & time off</Button><Button secondary icon="trash-2" onPress={() => setDeleting(true)}>Export or delete this job</Button>
    {editing && <JobForm job={job} onClose={() => setEditing(false)} />}{deleting && <DeleteJob initialId={job.id} onClose={() => { setDeleting(false); }} onDeleted={() => router.replace('/(tabs)/work')} />}
  </Page>;
}
export function TimerScreen() {
  const { c, s } = useDailyUI();
  const { data, now, clockOut } = useDaily(), job = data.jobs.find(j => j.id === data.active?.jobId);
  if (!data.active || !job) return <Page title="Working now" back><Empty title="You’re off the clock." text="Choose a job to start your next shift." action={() => router.replace('/(tabs)/work')} label="Go to Work" /></Page>;
  const total = totals(segments(withActive(data, now)).filter(v => v.sessionId === 'active'));
  return <Page title="Working now" back><JobPicker /><View style={{ alignItems: 'center', gap: 16, paddingVertical: 16 }}><View style={{ backgroundColor: c.accent, paddingVertical: 7, paddingHorizontal: 15, borderRadius: 20 }}><Txt style={{ color: c.accentForeground, fontSize: 12 }}>You’re on the clock</Txt></View><Txt style={s.title}>{job.name}</Txt><View style={{ width: 256, height: 256, borderRadius: 128, borderWidth: 6, borderColor: c.accent, alignItems: 'center', justifyContent: 'center', gap: 12 }}><Icon name="clock" color={c.accentForeground} size={25} /><Txt muted style={{ fontSize: 12 }}>Time working</Txt><Txt style={{ fontSize: 43, letterSpacing: -1, fontFamily: fonts.medium, fontVariant: ['tabular-nums'] }}>{timer(now - data.active.start)}</Txt><Txt muted style={{ fontSize: 12 }}>Started at {timeLabel(data.active.start)}</Txt></View></View><Card><View style={s.row}><Metric label="Session estimate" value={money(total.earnings)} /><Metric label="Session overtime" value={duration(total.overtime)} /></View></Card>
    <Button icon="square" testID="timer-clock-out" onPress={() => { const v = clockOut(); if (v) router.replace({ pathname: '/detail', params: { view: 'summary', id: v.id } }); }}>Clock out</Button><Note>Your timestamp-based timer keeps going between screens and restarts. Clock out before switching jobs.</Note><Button secondary onPress={() => router.replace('/(tabs)')}>Back to my day</Button>
  </Page>;
}
export function SummaryScreen({ id }: { id?: string }) {
  const { c, s } = useDailyUI();
  const { data, error } = useDaily(), session = data.sessions.find(v => v.id === id);
  if (!session) return <Page title="Session summary" back><Empty title="No session here just yet." text="Your next completed shift will have its own summary." action={() => router.replace('/(tabs)/work')} label="Go to Work" /></Page>;
  const total = totals(segments(data.sessions).filter(v => v.sessionId === session.id)), job = data.jobs.find(j => j.id === session.jobId);
  return <Page title="Session summary" back><View style={{ alignItems: 'center', gap: 10, marginVertical: 14 }}><View style={[s.jobIcon, { width: 58, height: 58, borderRadius: 20 }]}><Icon name="check" color={c.accentForeground} size={26} /></View><Txt muted style={{ fontSize: 11, letterSpacing: 1.5 }}>{error ? 'SHIFT RECORDED · SAVE PENDING' : 'SHIFT RECORDED'}</Txt><Txt style={s.title}>That’s time well spent.</Txt><Txt muted>{job?.name} · {dateLabel(dayKey(session.start))}</Txt></View>
    <Card><DetailRow label="Clock in" value={`${dateLabel(dayKey(session.start))} · ${timeLabel(session.start)}`} /><DetailRow label="Clock out" value={`${dateLabel(dayKey(session.end))} · ${timeLabel(session.end)}`} /><DetailRow label="Total time" value={duration(total.total)} /><DetailRow label={`Normal · ${money(session.normal)}/hr`} value={duration(total.normal)} /><DetailRow label={`Overtime · ${money(session.overtime)}/hr`} value={duration(total.overtime)} /></Card>
    <Card style={{ backgroundColor: c.accent, borderColor: c.accent, alignItems: 'center', paddingVertical: 24 }}><Txt style={{ color: c.accentForeground, fontSize: 13 }}>Estimated session earnings</Txt><Txt style={{ fontSize: 43, fontFamily: fonts.medium }}>{money(total.earnings)}</Txt><Txt style={{ fontSize: 12, color: c.accentForeground }}>Every minute counts.</Txt></Card>
    <Note>Recorded in work history, not in your Money balance. Add income when you get paid.</Note><Button onPress={() => router.replace('/(tabs)')}>Back to my day</Button><Button secondary onPress={() => go('history', session.jobId)}>View work history</Button>
  </Page>;
}
export function HistoryScreen({ id }: { id?: string }) {
  const { c, s } = useDailyUI();
  const { data } = useDaily(), job = data.jobs.find(j => j.id === (id || data.selectedJob));
  const [filter, setFilter] = useState<'Day' | 'Week' | 'Month'>('Week'), [anchor, setAnchor] = useState(dayKey());
  if (!job) return <Page title="Work history" back><NoJobs /></Page>;
  const start = parseDay(anchor);
  if (filter === 'Week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (filter === 'Month') start.setDate(1);
  const end = new Date(start);
  if (filter === 'Month') end.setMonth(end.getMonth() + 1); else end.setDate(end.getDate() + (filter === 'Week' ? 7 : 1));
  const last = new Date(end); last.setDate(last.getDate() - 1);
  const rows = segments(data.sessions).filter(v => v.jobId === job.id && v.date >= dayKey(start) && v.date < dayKey(end)).sort((a, b) => b.start - a.start);
  const move = (dir: number) => { const d = new Date(start); if (filter === 'Month') d.setMonth(d.getMonth() + dir); else d.setDate(d.getDate() + dir * (filter === 'Week' ? 7 : 1)); setAnchor(dayKey(d)); };
  return <Page title="Work history" back><Title sub="A record of the time you’ve put in.">{job.name}</Title><Choices values={['Day', 'Week', 'Month']} value={filter} onChange={setFilter} />
    <View style={s.between}><IconButton name="chevron-left" label="Previous period" onPress={() => move(-1)} /><Txt style={{ fontFamily: fonts.medium, flex: 1, textAlign: 'center', fontSize: 14 }}>{filter === 'Month' ? start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `${dateLabel(dayKey(start))}${filter === 'Week' ? ` – ${dateLabel(dayKey(last))}` : ''} · ${start.getFullYear()}`}</Txt><IconButton name="chevron-right" label="Next period" onPress={() => move(1)} /></View>
    <JobStats job={job} start={dayKey(start)} end={dayKey(end)} />
    {rows.length ? rows.map(row => <Card key={`${row.sessionId}:${row.date}`}><View style={s.between}><Txt style={{ fontFamily: fonts.medium }}>{dateLabel(row.date)}</Txt><Txt style={{ backgroundColor: c.accent, color: c.accentForeground, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8 }}>{money(row.earnings)}</Txt></View><DetailRow label="Clock in → out" value={`${timeLabel(row.start)} → ${timeLabel(row.end)}`} /><DetailRow label="Total hours" value={duration(row.total)} /><DetailRow label="Normal / overtime" value={`${duration(row.normal)} / ${duration(row.overtime)}`} /><Txt muted style={{ fontSize: 11 }}>Recorded rates · {money(row.normalRate)} / {money(row.overtimeRate)} per hour</Txt></Card>) : <Empty title="A fresh chapter." text="Completed shifts for this job will appear here." action={() => { setFilter('Month'); setAnchor(dayKey()); }} label="View this month" />}
    <Note>Summaries include a running shift; records below are completed shifts. Overnight sessions split at local midnight. Estimates are before tax.</Note>
  </Page>;
}
export function CalendarScreen({ id, back = false }: { id?: string; back?: boolean }) {
  const { c, s, statusColor } = useDailyUI();
  const { data, now, update } = useDaily(), job = data.jobs.find(j => j.id === (id || data.selectedJob));
  const [selected, setSelected] = useState(dayKey()), [month, setMonth] = useState(dayKey().slice(0, 7) + '-01'), [saved, setSaved] = useState(false);
  if (!job) return <Page title="Your calendar" back={back}><NoJobs /></Page>;
  const worked = segments(withActive(data, now)).filter(v => v.jobId === job.id).map(v => v.date), marks: Record<string, string> = Object.fromEntries(worked.map(v => [v, 'Work']));
  data.days.filter(v => v.jobId === job.id).forEach(v => { marks[v.date] = v.status; });
  const statuses: DayStatus[] = ['Work', 'Day off', 'Vacation', 'Sick'];
  const next = parseDay(month); next.setMonth(next.getMonth() + 1);
  return <Page title="Your calendar" back={back}><Title sub="See your rhythm, one month at a time.">Room for work. And life.</Title>{id ? <View style={s.row}><JobIcon job={job} /><Txt style={s.section}>{job.name}</Txt></View> : <JobPicker />}
    <Card style={{ padding: 10 }}><MonthGrid selected={selected} marks={marks} onSelect={v => { setSelected(v); setSaved(false); }} onMonth={v => { setMonth(v); setSelected(v); setSaved(false); }} /></Card>
    <View style={[s.row, { flexWrap: 'wrap', justifyContent: 'space-between' }]}>{statuses.map(status => <View key={status} style={[s.row, { gap: 5 }]}><View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: statusColor(status) }} /><Txt muted style={{ fontSize: 11 }}>{status}</Txt></View>)}</View>
    <Card><Txt style={{ fontSize: 11, letterSpacing: 1, color: c.accentForeground }}>{job.name.toUpperCase()}</Txt><Txt style={s.section}>{parseDay(selected).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Txt><Txt muted style={{ fontSize: 13 }}>How does this day look?</Txt><Choices values={statuses} value={marks[selected] as DayStatus} onChange={status => { setSaved(update(d => ({ ...d, days: [...d.days.filter(v => !(v.jobId === job.id && v.date === selected)), { jobId: job.id, date: selected, status }] }))); }} />
      {data.days.some(v => v.jobId === job.id && v.date === selected) && <Button secondary onPress={() => { setSaved(update(d => ({ ...d, days: d.days.filter(v => !(v.jobId === job.id && v.date === selected)) }))); }}>Clear planned status</Button>}{saved && <Txt style={{ fontSize: 12, color: c.accentForeground }}>Day updated for {job.name}</Txt>}
    </Card><Section title="This month at a glance" /><JobStats job={job} start={month} end={dayKey(next)} /><Note>Your calendar plan never changes recorded shifts or earnings. A recorded shift still counts as a day worked, even if its plan says time off.</Note>
  </Page>;
}