import React, { useState, type ComponentProps } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Modal, type TextStyle, type ViewStyle, type TextInputProps } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useDailyInsets } from '@/hooks/useDailyInsets';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { theme as c, fonts } from '@/constants/colors';
import { useDaily } from '@/state/DailyContext';
import { dateLabel, dayKey, parseDay, type Job } from '@/state/model';

export type IconName = ComponentProps<typeof Feather>['name'];
export const Icon = ({ name, size = 20, color = c.foreground }: { name: IconName; size?: number; color?: string }) => <Feather name={name} size={size} color={color} />;
export function Txt({ children, style, muted = false }: { children: React.ReactNode; style?: TextStyle | TextStyle[]; muted?: boolean }) { return <Text style={[s.text, muted && { color: c.mutedForeground }, style]}>{children}</Text>; }
export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) { return <View style={{ gap: 6, marginBottom: 8 }}><Txt style={s.title}>{children}</Txt>{Boolean(sub) && <Txt muted style={{ lineHeight: 22 }}>{sub}</Txt>}</View>; }
export function Brand() { return <View style={s.row}><Icon name="sun" color={c.primary} size={29} /><Txt style={{ fontSize: 31, fontFamily: fonts.semibold, letterSpacing: -1.4 }}>daily<Text style={{ color: c.primary }}>.</Text></Txt></View>; }
export function Button({ children, onPress, secondary = false, danger = false, disabled = false, icon, testID }: { children: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean; icon?: IconName; testID?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={children} accessibilityState={{ disabled }} testID={testID || children.toLowerCase().replace(/\W+/g, '-')} onPress={onPress} disabled={disabled} style={({ pressed }) => [s.button, secondary && s.secondary, danger && { backgroundColor: c.destructive }, disabled && { opacity: 0.4 }, pressed && { opacity: 0.76, transform: [{ scale: 0.985 }] }]}>
    {icon ? <Icon name={icon} size={18} color={danger ? c.destructiveForeground : c.foreground} /> : null}<Txt style={{ fontFamily: fonts.medium, color: danger ? c.destructiveForeground : c.foreground, textAlign: 'center', flexShrink: 1 }}>{children}</Txt>
  </Pressable>;
}
export function IconButton({ name, label, onPress, color = c.foreground }: { name: IconName; label: string; onPress: () => void; color?: string }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} testID={label.toLowerCase().replace(/\W+/g, '-')} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}><Icon name={name} color={color} /></Pressable>; }
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) { return <View style={[s.card, style]}>{children}</View>; }
export function Note({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <View accessibilityRole={error ? 'alert' : 'text'} style={[s.note, error && { backgroundColor: c.accent }]}><Icon name={error ? 'alert-circle' : 'info'} size={16} color={error ? c.destructive : c.mutedForeground} /><Txt style={{ flex: 1, fontSize: 12, lineHeight: 18, color: error ? c.destructive : c.mutedForeground }}>{children}</Txt></View>; }
export function Field({ label, ...props }: TextInputProps & { label: string }) { return <View style={{ gap: 7 }}><Txt style={s.label}>{label}</Txt><TextInput accessibilityLabel={label} testID={label.toLowerCase().replace(/\W+/g, '-')} placeholderTextColor={c.mutedForeground} {...props} style={[s.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, props.editable === false && { opacity: 0.5 }, props.style]} /></View>; }
export function Choices<T extends string>({ values, value, onChange }: { values: readonly T[]; value: T; onChange: (v: T) => void }) { return <View style={s.choices}>{values.map(v => <Pressable key={v} accessibilityRole="button" accessibilityLabel={v} accessibilityState={{ selected: value === v }} testID={`choice-${v}`} onPress={() => onChange(v)} style={[s.choice, value === v && s.choiceSelected]}><Txt style={{ fontSize: 13, textAlign: 'center', fontFamily: value === v ? fonts.medium : fonts.regular, color: value === v ? c.accentForeground : c.mutedForeground }}>{v}</Txt></Pressable>)}</View>; }
export function Section({ title, action, label = 'See all' }: { title: string; action?: () => void; label?: string }) { return <View style={[s.between, { marginTop: 6 }]}><Txt style={s.section}>{title}</Txt>{action && <Pressable onPress={action} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><Txt style={{ color: c.accentForeground, fontSize: 13 }}>{label}</Txt></Pressable>}</View>; }
export function Empty({ title, text, action, label = 'Add a job', icon = 'sun' }: { title: string; text: string; action?: () => void; label?: string; icon?: IconName }) { return <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}><Icon name={icon} size={32} color={c.primary} /><Txt style={[s.section, { textAlign: 'center' }]}>{title}</Txt><Txt muted style={{ textAlign: 'center', lineHeight: 22 }}>{text}</Txt>{action && <Button onPress={action} secondary>{label}</Button>}</Card>; }
export function Metric({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) { return <View style={{ flex: 1, gap: 5, minWidth: 0 }}><Txt style={{ fontSize: 12, color: dark ? c.subtleOnCharcoal : c.mutedForeground }}>{label}</Txt><Txt style={{ fontSize: 23, fontFamily: fonts.medium, color: dark ? c.onCharcoal : c.foreground }}>{value}</Txt></View>; }
export function DetailRow({ label, value }: { label: string; value: string }) { return <View style={[s.between, { gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.border }]}><Txt muted style={{ fontSize: 13, flex: 1 }}>{label}</Txt><Txt style={{ fontSize: 14, fontFamily: fonts.medium, flexShrink: 1, textAlign: 'right' }}>{value}</Txt></View>; }
export function JobIcon({ job }: { job: Pick<Job, 'icon'> }) { return <View style={[s.jobIcon, job.icon === 'laptop' && { backgroundColor: c.secondary }]}>{job.icon === 'store' || job.icon === 'laptop' ? <MaterialCommunityIcons name={job.icon === 'store' ? 'storefront-outline' : 'laptop'} size={23} color={c.foreground} /> : <Icon name={job.icon} color={c.accentForeground} size={22} />}</View>; }
export function Page({ title, children, home = false, back = false, right }: { title?: string; children: React.ReactNode; home?: boolean; back?: boolean; right?: React.ReactNode }) {
  const insets = useDailyInsets(), { data, error, retry } = useDaily();
  return <View style={[s.page, { paddingTop: insets.top }]}>
    <View style={s.header}>{home ? <Brand /> : <View style={[s.row, { flex: 1 }]}>{back && <IconButton name="arrow-left" label="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} />}<Txt style={s.section}>{title}</Txt></View>}
      {right || (home ? <Pressable onPress={() => go('profile')} accessibilityRole="button" accessibilityLabel="Open profile" testID="open-profile" style={s.avatar}><Txt style={{ fontFamily: fonts.medium }}>{data.name.split(' ').filter(Boolean).slice(0, 2).map(v => v[0]).join('').toUpperCase()}</Txt></Pressable> : null)}
    </View>
    {Boolean(error) && <View style={{ paddingHorizontal: 20 }}><Note error>{error}</Note><Button secondary onPress={retry}>Retry saving</Button></View>}
    <KeyboardAwareScrollViewCompat bottomOffset={24} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" contentContainerStyle={[s.content, { paddingBottom: 28 + (back ? insets.bottom : 0) }]}>{children}</KeyboardAwareScrollViewCompat>
  </View>;
}
export const go = (screen: string, id?: string) => router.push({ pathname: '/detail', params: { screen, ...(id ? { id } : {}) } });
export function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const insets = useDailyInsets();
  return <Modal transparent animationType="slide" statusBarTranslucent visible onRequestClose={onClose}><View style={s.overlay}><Pressable accessibilityLabel="Dismiss sheet" accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill} /><View accessibilityViewIsModal style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16), maxHeight: '92%' }]}><View style={s.handle} /><View style={[s.between, { paddingHorizontal: 20 }]}><Txt style={[s.section, { flex: 1 }]}>{title}</Txt><IconButton name="x" label="Close sheet" onPress={onClose} /></View><KeyboardAwareScrollViewCompat bottomOffset={24} contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14 }} keyboardShouldPersistTaps="handled">{children}</KeyboardAwareScrollViewCompat></View></View></Modal>;
}
export function Confirm({ title, message, onConfirm, onClose }: { title: string; message: string; onConfirm: () => void; onClose: () => void }) { return <Sheet title={title} onClose={onClose}><Note error>{message}</Note><Button danger onPress={onConfirm} icon="trash-2">Delete permanently</Button><Button secondary onPress={onClose}>Keep it</Button></Sheet>; }
export function DateField({ value, onChange, label = 'Date' }: { value: string; onChange: (s: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 7 }}><Txt style={s.label}>{label}</Txt><Pressable onPress={() => setOpen(true)} accessibilityLabel={`${label}, ${value}`} accessibilityRole="button" testID="date-picker" style={[s.input, s.between]}><Txt>{dateLabel(value)} · {parseDay(value).getFullYear()}</Txt><Icon name="calendar" size={18} /></Pressable>{open && <Sheet title={`Choose ${label.toLowerCase()}`} onClose={() => setOpen(false)}><MonthGrid initial={value} selected={value} onSelect={v => { onChange(v); setOpen(false); }} /><Button secondary onPress={() => { onChange(dayKey()); setOpen(false); }}>Use today</Button></Sheet>}</View>;
}
export function MonthGrid({ selected, initial = dayKey(), onSelect, marks = {}, onMonth }: { selected: string; initial?: string; onSelect: (d: string) => void; marks?: Record<string, string>; onMonth?: (v: string) => void }) {
  const [month, setMonth] = useState(initial.slice(0, 7) + '-01');
  const first = parseDay(month), offset = (first.getDay() + 6) % 7, count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const move = (dir: number) => { const d = parseDay(month); d.setMonth(d.getMonth() + dir); const key = dayKey(d); setMonth(key); onMonth?.(key); };
  return <View><View style={s.between}><IconButton name="chevron-left" label="Previous month" onPress={() => move(-1)} /><Txt style={{ fontFamily: fonts.medium }}>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Txt><IconButton name="chevron-right" label="Next month" onPress={() => move(1)} /></View><View style={s.calendarGrid}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <View key={`w${i}`} style={s.day}><Txt muted style={{ fontSize: 12 }}>{d}</Txt></View>)}{Array.from({ length: offset }, (_, i) => <View key={`b${i}`} style={s.day} />)}{Array.from({ length: count }, (_, i) => { const key = dayKey(new Date(first.getFullYear(), first.getMonth(), i + 1)); return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${key}, ${marks[key] || 'not planned'}`} accessibilityState={{ selected: selected === key }} onPress={() => onSelect(key)} style={[s.day, selected === key && { backgroundColor: c.primary }, key === dayKey() && selected !== key && { backgroundColor: c.peach }]}><Txt style={{ fontFamily: key === selected ? fonts.semibold : fonts.regular }}>{i + 1}</Txt>{Boolean(marks[key]) && <View style={{ height: 4, width: 4, borderRadius: 2, backgroundColor: statusColor(marks[key]), marginTop: 3 }} />}</Pressable>; })}</View></View>;
}
export const statusColor = (status: string) => ({ Work: c.primary, 'Day off': c.charcoal, Vacation: c.vacation, Sick: c.sick }[status] || c.border);
export const s = StyleSheet.create({
  text: { fontFamily: fonts.regular, fontSize: 15, color: c.foreground },
  page: { flex: 1, backgroundColor: c.background }, content: { paddingHorizontal: 21, paddingTop: 8, gap: 16 },
  header: { minHeight: 74, paddingHorizontal: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 28, fontFamily: fonts.medium, letterSpacing: -0.7, lineHeight: 34 },
  section: { fontSize: 19, fontFamily: fonts.medium, letterSpacing: -0.3 }, label: { fontFamily: fonts.medium, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { backgroundColor: c.card, borderRadius: 21, borderWidth: 1, borderColor: c.border, padding: 18, gap: 12 },
  button: { backgroundColor: c.primary, minHeight: 52, borderRadius: 15, paddingHorizontal: 18, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  secondary: { backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border },
  note: { backgroundColor: c.secondary, borderRadius: 13, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  input: { minHeight: 52, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 13, fontFamily: fonts.regular, fontSize: 15, color: c.foreground },
  choices: { flexDirection: 'row', backgroundColor: c.secondary, padding: 4, borderRadius: 13, flexWrap: 'wrap', gap: 4 },
  choice: { flex: 1, minWidth: 64, minHeight: 42, padding: 10, borderRadius: 10, justifyContent: 'center' },
  choiceSelected: { backgroundColor: c.accent },
  jobIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 16, backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }, sheet: { backgroundColor: c.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginVertical: 12 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' }, day: { width: '14.2857%', height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});