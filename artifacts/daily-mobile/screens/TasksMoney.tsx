import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { fonts } from '@/constants/colors';
import { useDailyUI } from '@/hooks/useDailyUI';
import { useDaily, useDailyEdit } from '@/state/DailyContext';
import { balance, dateLabel, dayKey, money, taskSchema, transactionSchema, uid, type Task, type Transaction } from '@/state/model';
import { Button, Card, Choices, Confirm, DateField, Empty, Field, Icon, IconButton, Metric, Note, Page, Section, Title, Txt, go } from '@/components/daily/UI';

export function TaskRow({ task }: { task: Task }) {
  const { c, s } = useDailyUI();
  const { update } = useDaily();
  return <View style={[s.row, { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }]}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.done }} accessibilityLabel={`Complete ${task.title}`} testID={`toggle-task-${task.id}`} onPress={() => update(d => ({ ...d, tasks: d.tasks.map(t => t.id === task.id ? { ...t, done: !t.done } : t) }))} style={{ width: 42, height: 46, justifyContent: 'center', alignItems: 'center' }}><Icon name={task.done ? 'check-circle' : 'circle'} color={task.done ? c.primary : c.mutedForeground} size={23} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${task.title}`} onPress={() => go('task-form', task.id)} style={{ flex: 1, minHeight: 44, justifyContent: 'center', gap: 5 }}><Txt style={{ fontSize: 15, color: task.done ? c.mutedForeground : c.foreground, textDecorationLine: task.done ? 'line-through' : 'none' }}>{task.title}</Txt><View style={s.row}><Txt muted style={{ fontSize: 11 }}>{task.due < dayKey() && !task.done ? 'Overdue · ' : ''}{dateLabel(task.due)}</Txt><View style={{ backgroundColor: task.priority === 'High' ? c.accent : c.secondary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 }}><Txt style={{ fontSize: 10, color: task.priority === 'High' ? c.accentForeground : c.mutedForeground }}>{task.priority}</Txt></View></View></Pressable><Icon name="chevron-right" size={15} color={c.mutedForeground} />
  </View>;
}
export function TasksScreen() {
  const { c, s } = useDailyUI();
  const { data, now } = useDaily(), [filter, setFilter] = useState<'Today' | 'Upcoming' | 'Completed'>('Today');
  const today = dayKey(now);
  const tasks = data.tasks.filter(t => filter === 'Completed' ? t.done : !t.done && (filter === 'Today' ? t.due <= today : t.due > today)).sort((a, b) => a.due.localeCompare(b.due));
  return <Page title="Your tasks" right={<IconButton name="plus" label="Add task" color={c.accentForeground} onPress={() => go('task-form')} />}><Title sub="One small thing at a time.">A little less on your mind.</Title><Choices values={['Today', 'Upcoming', 'Completed']} value={filter} onChange={setFilter} /><View style={s.between}><Txt muted style={{ fontSize: 12 }}>{tasks.length} {filter === 'Completed' ? 'completed' : 'things to do'}</Txt><Txt muted style={{ fontSize: 12 }}>{filter === 'Today' ? 'Includes overdue tasks' : 'Make a little space'}</Txt></View>
    {tasks.length ? <Card style={{ paddingVertical: 3, paddingHorizontal: 10 }}>{tasks.map(t => <TaskRow key={t.id} task={t} />)}</Card> : <Empty title={filter === 'Completed' ? 'Your small wins live here.' : 'Your day has a little space.'} text={filter === 'Completed' ? 'Check off a task to celebrate a little progress.' : 'Add something to your list, or enjoy the breathing room.'} action={() => go('task-form')} label="Add a task" icon="check-circle" />}
    <Button onPress={() => go('task-form')} icon="plus">Add a little to-do</Button>
  </Page>;
}
export function TaskFormScreen({ id }: { id?: string }) {
  useDailyEdit();
  const { s } = useDailyUI();
  const { data, update } = useDaily(), task = data.tasks.find(t => t.id === id);
  const [title, setTitle] = useState(task?.title || ''), [due, setDue] = useState(task?.due || dayKey()), [priority, setPriority] = useState<Task['priority']>(task?.priority || 'Medium');
  const [error, setError] = useState(''), [confirm, setConfirm] = useState(false);
  if (id && !task) return <Page title="Task" back><Empty title="This task is no longer here." text="It may have been deleted." action={() => router.back()} label="Go back" /></Page>;
  const save = () => {
    const value = taskSchema.safeParse({ id: task?.id || uid(), title: title.trim(), due, priority, done: task?.done || false });
    if (!value.success) { setError('Give your task a name and a valid due date.'); return; }
    if (update(d => ({ ...d, tasks: task ? d.tasks.map(t => t.id === task.id ? value.data : t) : [...d.tasks, value.data] }))) router.back();
  };
  return <Page title={task ? 'Edit task' : 'Add task'} back><Title sub="Small plans make a little more room.">{task ? 'Make it work for you.' : 'What’s on your mind?'}</Title>
    <Field label="Task name" placeholder="e.g. Pick up a few groceries" value={title} onChangeText={setTitle} maxLength={160} autoFocus />
    <DateField label="Due date" value={due} onChange={setDue} /><Txt style={s.label}>Priority</Txt><Choices values={['Low', 'Medium', 'High']} value={priority} onChange={setPriority} />
    {Boolean(error) && <Note error>{error}</Note>}<Button onPress={save} icon="check" testID="save-task">Save task</Button>
    {task && <><Button secondary icon={task.done ? 'rotate-ccw' : 'check-circle'} onPress={() => { if (update(d => ({ ...d, tasks: d.tasks.map(t => t.id === task.id ? { ...t, done: !t.done } : t) }))) router.back(); }}>{task.done ? 'Mark as incomplete' : 'Mark as completed'}</Button><Button danger icon="trash-2" onPress={() => setConfirm(true)}>Delete task</Button></>}
    {confirm && <Confirm title="Let this task go?" message={`“${task?.title}” will be removed permanently.`} onClose={() => setConfirm(false)} onConfirm={() => { if (update(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== id) }))) { setConfirm(false); router.back(); } }} />}
  </Page>;
}
export function TransactionRow({ item }: { item: Transaction }) {
  const { c, s } = useDailyUI();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.title}, ${money(item.amount)}`} onPress={() => go(`${item.kind}-form`, item.id)} style={[s.row, { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.border }]}>
    <View style={[s.jobIcon, { backgroundColor: item.kind === 'income' ? c.peach : c.secondary }]}><Icon name={item.kind === 'income' ? 'arrow-down-left' : 'arrow-up-right'} color={item.kind === 'income' ? c.accentForeground : c.foreground} /></View>
    <View style={{ flex: 1, gap: 4 }}><Txt style={{ fontFamily: fonts.medium, fontSize: 14 }}>{item.title}</Txt><Txt muted style={{ fontSize: 11 }}>{item.category} · {dateLabel(item.date)}</Txt></View><Txt style={{ fontFamily: fonts.medium, fontSize: 16 }}>{item.kind === 'income' ? '+' : '−'}{money(item.amount)}</Txt>
  </Pressable>;
}
export function MoneyScreen() {
  const { c, s } = useDailyUI();
  const { data } = useDaily(), b = balance(data);
  return <Page title="Your money"><Title sub="A clear picture. A little peace of mind.">Know where you stand.</Title>
    <Card style={{ backgroundColor: c.charcoal, borderColor: c.charcoal, padding: 24, gap: 22 }}><View style={s.between}><Txt style={{ color: c.subtleOnCharcoal }}>Your remaining balance</Txt><Icon name="credit-card" color={c.primary} /></View><Txt style={{ fontSize: 42, fontFamily: fonts.medium, color: c.onCharcoal, letterSpacing: -1.5 }}>{money(b.remaining)}</Txt><View style={[s.row, { paddingTop: 18, borderTopWidth: 1, borderTopColor: c.mutedForeground }]}><Metric dark label="Total received" value={money(b.income)} /><Metric dark label="Total spent" value={money(b.expense)} /></View></Card>
    <View style={s.row}><View style={{ flex: 1 }}><Button icon="plus" onPress={() => go('income-form')}>Income</Button></View><View style={{ flex: 1 }}><Button secondary icon="minus" onPress={() => go('expense-form')}>Expense</Button></View></View>
    <View style={s.row}><View style={{ flex: 1 }}><Button secondary onPress={() => go('income')}>View income</Button></View><View style={{ flex: 1 }}><Button secondary onPress={() => go('expense')}>View expenses</Button></View></View>
    <Section title="The latest ins & outs" />{data.transactions.length ? <Card style={{ paddingHorizontal: 13, paddingVertical: 2 }}>{[...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(t => <TransactionRow key={t.id} item={t} />)}</Card> : <Empty title="A fresh start for your money." text="Add income when it arrives and expenses as they happen." icon="credit-card" />}
    <Note>Work earnings are estimates, not money received. Add income when you get paid. All amounts are in shekels (₪).</Note>
  </Page>;
}
export function MoneyListScreen({ kind }: { kind: Transaction['kind'] }) {
  const { data } = useDaily(), rows = data.transactions.filter(t => t.kind === kind).sort((a, b) => b.date.localeCompare(a.date));
  return <Page title={kind === 'income' ? 'Income' : 'Expenses'} back right={<IconButton name="plus" label={`Add ${kind}`} onPress={() => go(`${kind}-form`)} />}><Title sub={kind === 'income' ? 'The money that actually came your way.' : 'The everyday things, kept in view.'}>{kind === 'income' ? 'A little coming in.' : 'A little going out.'}</Title>
    <Card><Metric label={kind === 'income' ? 'Total received · all time' : 'Total spent · all time'} value={money(rows.reduce((a, t) => a + t.amount, 0))} /></Card>
    {rows.length ? <Card style={{ paddingVertical: 2, paddingHorizontal: 13 }}>{rows.map(t => <TransactionRow key={t.id} item={t} />)}</Card> : <Empty title="Nothing here just yet." text={`Your ${kind === 'income' ? 'received income' : 'expenses'} will appear here.`} icon="credit-card" />}
    <Button onPress={() => go(`${kind}-form`)} icon="plus">{kind === 'income' ? 'Add income' : 'Add expense'}</Button>
  </Page>;
}
export function MoneyFormScreen({ kind, id }: { kind: Transaction['kind']; id?: string }) {
  useDailyEdit();
  const { s } = useDailyUI();
  const { data, update } = useDaily(), item = data.transactions.find(t => t.id === id);
  const categories = kind === 'income' ? ['Salary', 'Freelance', 'Gift', 'Other'] : ['Food', 'Transportation', 'Shopping', 'Bills', 'Other'];
  const [amount, setAmount] = useState(item?.amount.toString() || ''), [title, setTitle] = useState(item?.title || ''), [category, setCategory] = useState(item?.category || categories[0]), [date, setDate] = useState(item?.date || dayKey()), [note, setNote] = useState(item?.note || '');
  const [error, setError] = useState(''), [confirm, setConfirm] = useState(false);
  if (id && !item) return <Page title="Money entry" back><Empty title="This entry is no longer here." text="It may have been deleted. Your unsaved text has not been added as a new entry." action={() => router.back()} label="Go back" /></Page>;
  const save = () => {
    const value = transactionSchema.safeParse({ id: item?.id || uid(), kind, title: title.trim(), amount: Number(amount), category, date, note: note.trim() });
    if (!value.success) { setError('Enter a positive amount (up to ₪1 trillion), a source or description, and a valid date.'); return; }
    if (update(d => ({ ...d, transactions: item ? d.transactions.map(t => t.id === item.id ? value.data : t) : [...d.transactions, value.data] }))) router.back();
  };
  return <Page title={`${item ? 'Edit' : 'Add'} ${kind}`} back><Title sub={kind === 'income' ? 'Only record money you have received.' : 'Keep the little things in view.'}>{kind === 'income' ? 'Something coming in.' : 'Where did it go?'}</Title>
    <Field label="Amount · ₪" placeholder="0.00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} maxLength={16} style={{ fontSize: 32, minHeight: 76 }} />
    <Field label={kind === 'income' ? 'Source' : 'What was it for?'} value={title} onChangeText={setTitle} placeholder={kind === 'income' ? 'e.g. Coffee Shop paycheck' : 'e.g. Weekly groceries'} maxLength={120} />
    <Txt style={s.label}>Category</Txt><Choices values={categories} value={category} onChange={setCategory} /><DateField value={date} onChange={setDate} /><Field label="Note · optional" multiline value={note} onChangeText={setNote} placeholder="Anything you want to remember" maxLength={500} />
    {Boolean(error) && <Note error>{error}</Note>}<Button onPress={save} icon="check" testID="save-transaction">{`Save ${kind}`}</Button>
    {item && <Button danger icon="trash-2" onPress={() => setConfirm(true)}>Delete entry</Button>}
    {confirm && <Confirm title="Delete this entry?" message="This changes your balance. The entry will be permanently removed." onClose={() => setConfirm(false)} onConfirm={() => { if (update(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== id) }))) { setConfirm(false); router.back(); } }} />}
  </Page>;
}