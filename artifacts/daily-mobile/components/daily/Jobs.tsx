import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { fonts } from '@/constants/colors';
import { useDailyUI } from '@/hooks/useDailyUI';
import { useDaily } from '@/state/DailyContext';
import { exportJob } from '@/state/export';
import { jobSchema, money, uid, type Job } from '@/state/model';
import { Button, Card, DetailRow, Field, Icon, JobIcon, Note, Sheet, Txt } from './UI';

export function JobForm({ job, onClose, onSaved }: { job?: Job; onClose: () => void; onSaved?: () => void }) {
  const { c, s } = useDailyUI();
  const { data, saveJob } = useDaily();
  const [name, setName] = useState(job?.name || ''), [description, setDescription] = useState(job?.description || '');
  const [normal, setNormal] = useState(job?.normal.toString() || ''), [overtime, setOvertime] = useState(job?.overtime.toString() || '');
  const [icon, setIcon] = useState<Job['icon']>(job?.icon || 'briefcase'), [error, setError] = useState('');
  const locked = !!job && data.active?.jobId === job.id;
  const save = () => {
    const result = jobSchema.safeParse({ id: job?.id || uid(), name: name.trim(), description: description.trim(), normal: Number(normal), overtime: Number(overtime), icon });
    if (!result.success) { setError('Add a name and rates from ₪0.01 to ₪100,000. Overtime must be at least the normal rate.'); return; }
    if (data.jobs.some(j => j.id !== job?.id && j.name.toLowerCase() === name.trim().toLowerCase())) { setError('You already have a job with this name. Try another.'); return; }
    saveJob(result.data); onClose(); onSaved?.();
  };
  return <Sheet title={job ? 'Edit your job' : 'Make room for a new role'} onClose={onClose}>
    <Card style={{ backgroundColor: c.charcoal, borderColor: c.charcoal }}><View style={s.row}><JobIcon job={{ icon }} /><View style={{ flex: 1 }}><Txt style={{ color: c.onCharcoal, fontSize: 18, fontFamily: fonts.medium }}>{name.trim() || 'Your next chapter'}</Txt><Txt style={{ color: c.subtleOnCharcoal, fontSize: 12 }}>{description || 'Your hours and earnings, together.'}</Txt></View></View></Card>
    <Txt style={s.label}>Choose an icon</Txt><View style={s.row}>{(['briefcase', 'coffee', 'laptop', 'store'] as const).map(v => <Pressable key={v} accessibilityRole="button" accessibilityLabel={`${v} icon`} accessibilityState={{ selected: icon === v }} onPress={() => setIcon(v)} style={{ padding: 4, borderWidth: 1, borderColor: icon === v ? c.primary : c.transparent, borderRadius: 18 }}><JobIcon job={{ icon: v }} /></Pressable>)}</View>
    <Field label="Job name" value={name} onChangeText={setName} maxLength={50} placeholder="e.g. Weekend bookstore" />
    <Field label="Description · optional" value={description} onChangeText={setDescription} maxLength={100} placeholder="A little about this role" />
    <View style={[s.row, { alignItems: 'flex-start' }]}><View style={{ flex: 1 }}><Field label="Normal / hour · ₪" keyboardType="decimal-pad" value={normal} onChangeText={setNormal} editable={!locked} placeholder="8.00" /></View><View style={{ flex: 1 }}><Field label="Overtime / hour · ₪" keyboardType="decimal-pad" value={overtime} onChangeText={setOvertime} editable={!locked} placeholder="10.00" /></View></View>
    <Note>{locked ? 'Rates are locked during a running shift. Clock out before changing them.' : 'Overtime starts after 8 hours per job, per local day. Changes apply only to new shifts; past rates are preserved.'}</Note>
    {Boolean(error) && <Note error>{error}</Note>}<Button onPress={save} icon={job ? 'check' : 'plus'} testID="save-job">{job ? 'Save changes' : 'Add job'}</Button>
  </Sheet>;
}
export function JobPicker({ dark = false }: { dark?: boolean }) {
  const { c, s } = useDailyUI();
  const { data, selectJob } = useDaily();
  const [open, setOpen] = useState(false), [adding, setAdding] = useState(false);
  const job = data.jobs.find(j => j.id === data.selectedJob);
  return <>
    <Pressable accessibilityLabel={`Choose job, currently ${job?.name || 'none'}`} accessibilityRole="button" testID="job-picker" onPress={() => setOpen(true)} style={[s.row, { backgroundColor: dark ? c.charcoal : c.card, borderColor: dark ? c.mutedForeground : c.border, borderWidth: 1, padding: 12, borderRadius: 15 }]}>
      {job ? <JobIcon job={job} /> : <Icon name="briefcase" color={c.primary} />}
      <View style={{ flex: 1 }}><Txt style={{ fontSize: 10, letterSpacing: 1, color: dark ? c.subtleOnCharcoal : c.mutedForeground }}>{data.active ? 'ON THE CLOCK' : 'YOUR SELECTED JOB'}</Txt><Txt style={{ color: dark ? c.onCharcoal : c.foreground, fontFamily: fonts.medium, fontSize: 16 }}>{job?.name || 'Add your first job'}</Txt></View>
      <Icon name={data.active ? 'lock' : 'chevron-down'} color={c.primary} size={18} />
    </Pressable>
    {open && <Sheet title="Where are you working?" onClose={() => setOpen(false)}><Txt muted>One day. Different hats. Choose the job you want to track.</Txt>{data.active && <Note>Clock out before switching jobs. Your running shift stays with its original job.</Note>}
      {data.jobs.map(j => <Pressable key={j.id} accessibilityRole="button" accessibilityLabel={`Select ${j.name}`} accessibilityState={{ selected: data.selectedJob === j.id, disabled: !!data.active && data.active.jobId !== j.id }} disabled={!!data.active && data.active.jobId !== j.id} onPress={() => { selectJob(j.id); setOpen(false); }} style={[s.card, s.row, { padding: 14, backgroundColor: data.selectedJob === j.id ? c.peach : c.card, borderColor: data.selectedJob === j.id ? c.primary : c.border, opacity: data.active && data.active.jobId !== j.id ? 0.45 : 1 }]}>
        <JobIcon job={j} /><View style={{ flex: 1, gap: 4 }}><Txt style={{ fontFamily: fonts.medium }}>{j.name}</Txt><Txt muted style={{ fontSize: 12 }}>{money(j.normal)}/hr · {money(j.overtime)}/hr overtime</Txt></View><Icon name={data.selectedJob === j.id ? 'check-circle' : 'circle'} color={c.accentForeground} size={19} />
      </Pressable>)}
      <Button secondary icon="plus" onPress={() => { setOpen(false); setAdding(true); }}>Add another job</Button><Note>Each job keeps its own hours, rates and calendar.</Note>
    </Sheet>}
    {adding && <JobForm onClose={() => setAdding(false)} />}
  </>;
}
export function DeleteJob({ initialId, onClose, onDeleted }: { initialId?: string; onClose: () => void; onDeleted?: () => void }) {
  const { c, s } = useDailyUI();
  const { data, deleteJob } = useDaily();
  const [target, setTarget] = useState(initialId || ''), [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const job = data.jobs.find(j => j.id === target), locked = data.active?.jobId === target;
  const download = async () => {
    if (!job || locked) return;
    setBusy(true); setError(''); setNotice('');
    try { setNotice(await exportJob(job, data)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not export this job. Nothing was deleted. Please retry.'); } finally { setBusy(false); }
  };
  return <Sheet title={job ? 'Before you say goodbye.' : 'Manage & delete jobs'} onClose={onClose}>
    {!job ? <><Txt muted>Keep what matters. Save a copy before removing a job.</Txt>{data.jobs.map(j => <Pressable key={j.id} onPress={() => { setTarget(j.id); setAccepted(false); setNotice(''); setError(''); }} accessibilityRole="button" accessibilityLabel={`Delete ${j.name}`} style={[s.card, s.row]}><JobIcon job={j} /><View style={{ flex: 1 }}><Txt style={{ fontFamily: fonts.medium }}>{j.name}</Txt><Txt muted style={{ fontSize: 12 }}>{data.sessions.filter(v => v.jobId === j.id).length} recorded shifts</Txt></View><Icon name="trash-2" color={c.destructive} /></Pressable>)}{!data.jobs.length && <Txt muted>There are no jobs to delete.</Txt>}</> : <>
      <View style={{ alignSelf: 'flex-start', backgroundColor: c.accent, padding: 16, borderRadius: 18 }}><Icon name="trash-2" color={c.destructive} size={28} /></View>
      <Txt style={{ fontSize: 17, lineHeight: 25 }}>Delete {job.name}? Its rates, shifts and calendar entries will be permanently removed from this device.</Txt>
      <Card><DetailRow label="Recorded shifts" value={String(data.sessions.filter(v => v.jobId === job.id).length)} /><DetailRow label="Calendar entries" value={String(data.days.filter(v => v.jobId === job.id).length)} /><DetailRow label="Tasks, money & other jobs" value="Kept unchanged" /></Card>
      {locked ? <><Note error>This job has a running shift. Clock out before exporting a complete record or deleting it.</Note><Button secondary onPress={onClose}>Keep job & return</Button></> : <>
        <Txt style={s.section}>A copy, just in case.</Txt><Txt muted style={{ lineHeight: 21 }}>Export all details, rates, raw sessions, daily hours, estimated earnings and calendar entries as JSON.</Txt>
        <Button secondary icon="download" disabled={busy} onPress={() => void download()}>{busy ? 'Preparing export…' : 'Export job details'}</Button>
        {Boolean(notice) && <Note>{notice}</Note>}{Boolean(error) && <Note error>{error} You can try the export again. Your job is unchanged.</Note>}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} accessibilityLabel="I understand this is permanent and have saved a copy or do not need one" testID="delete-job-acknowledgment" onPress={() => setAccepted(!accepted)} style={[s.row, { alignItems: 'flex-start', paddingVertical: 12 }]}><Icon name={accepted ? 'check-square' : 'square'} color={c.accentForeground} /><Txt style={{ flex: 1, lineHeight: 22, fontSize: 14 }}>I understand this is permanent. I have saved a copy, or I do not need one.</Txt></Pressable>
        <Button danger icon="trash-2" disabled={!accepted || busy} testID="confirm-delete-job" onPress={() => { if (accepted && deleteJob(job.id)) { onClose(); onDeleted?.(); } }}>Delete this job permanently</Button><Button secondary onPress={onClose}>Keep this job</Button>
      </>}
    </>}
  </Sheet>;
}