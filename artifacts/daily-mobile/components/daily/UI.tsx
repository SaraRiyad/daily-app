import React, { useState, type ComponentProps } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Modal, Keyboard, type TextStyle, type ViewStyle, type TextInputProps } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useDailyInsets } from '@/hooks/useDailyInsets';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { fonts } from '@/constants/colors';
import { useDailyUI } from '@/hooks/useDailyUI';
import { useColors, useDailyTheme } from '@/hooks/useColors';
import { useDaily } from '@/state/DailyContext';
import { dateLabel, dayKey, parseDay, type Job } from '@/state/model';

export type IconName = ComponentProps<typeof Feather>['name'];
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) { const c = useColors(); return <Feather name={name} size={size} color={color ?? c.foreground} />; }
export function Txt({ children, style, muted = false }: { children: React.ReactNode; style?: TextStyle | TextStyle[]; muted?: boolean }) { const { c, s } = useDailyUI(); return <Text style={[s.text, muted && { color: c.mutedForeground }, style]}>{children}</Text>; }
export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) { const { s } = useDailyUI(); return <View style={{ gap: 6, marginBottom: 8 }}><Txt style={s.title}>{children}</Txt>{Boolean(sub) && <Txt muted style={{ lineHeight: 22 }}>{sub}</Txt>}</View>; }
export function Brand() { const { c, s } = useDailyUI(); return <View style={s.row}><Icon name="sun" color={c.primary} size={29} /><Txt style={{ fontSize: 31, fontFamily: fonts.semibold, letterSpacing: -1.4 }}>daily<Text style={{ color: c.primary }}>.</Text></Txt></View>; }
export function Button({ children, onPress, secondary = false, danger = false, disabled = false, icon, testID }: { children: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean; icon?: IconName; testID?: string }) {
  const { c, s } = useDailyUI();
  const foreground = danger ? c.destructiveForeground : secondary ? c.foreground : c.primaryForeground;
  return <Pressable accessibilityRole="button" accessibilityLabel={children} accessibilityState={{ disabled }} testID={testID || children.toLowerCase().replace(/\W+/g, '-')} onPress={onPress} disabled={disabled} style={({ pressed }) => [s.button, secondary && s.secondary, danger && { backgroundColor: c.destructive }, disabled && { opacity: 0.4 }, pressed && { opacity: 0.76, transform: [{ scale: 0.985 }] }]}>
    {icon ? <Icon name={icon} size={18} color={foreground} /> : null}<Txt style={{ fontFamily: fonts.medium, color: foreground, textAlign: 'center', flexShrink: 1 }}>{children}</Txt>
  </Pressable>;
}
export function IconButton({ name, label, onPress, color }: { name: IconName; label: string; onPress: () => void; color?: string }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} testID={label.toLowerCase().replace(/\W+/g, '-')} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}><Icon name={name} color={color} /></Pressable>; }
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) { const { s } = useDailyUI(); return <View style={[s.card, style]}>{children}</View>; }
export function Note({ children, error = false }: { children: React.ReactNode; error?: boolean }) { const { c, s } = useDailyUI(); return <View accessibilityRole={error ? 'alert' : 'text'} style={[s.note, error && { backgroundColor: c.accent }]}><Icon name={error ? 'alert-circle' : 'info'} size={16} color={error ? c.destructive : c.mutedForeground} /><Txt style={{ flex: 1, fontSize: 12, lineHeight: 18, color: error ? c.destructive : c.mutedForeground }}>{children}</Txt></View>; }
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { c, s } = useDailyUI();
  const { isDark } = useDailyTheme();
  return <View style={{ gap: 7 }}><Txt style={s.label}>{label}</Txt><TextInput accessibilityLabel={label} testID={label.toLowerCase().replace(/\W+/g, '-')} placeholderTextColor={c.mutedForeground} selectionColor={c.primary} keyboardAppearance={isDark ? 'dark' : 'light'} {...props} style={[s.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, props.editable === false && { opacity: 0.5 }, props.style]} /></View>;
}
export function Choices<T extends string>({ values, value, onChange }: { values: readonly T[]; value: T; onChange: (v: T) => void }) { const { c, s } = useDailyUI(); return <View style={s.choices}>{values.map(v => <Pressable key={v} accessibilityRole="button" accessibilityLabel={v} accessibilityState={{ selected: value === v }} testID={`choice-${v}`} onPress={() => onChange(v)} style={[s.choice, value === v && s.choiceSelected]}><Txt style={{ fontSize: 13, textAlign: 'center', fontFamily: value === v ? fonts.medium : fonts.regular, color: value === v ? c.accentForeground : c.mutedForeground }}>{v}</Txt></Pressable>)}</View>; }
export function Section({ title, action, label = 'See all' }: { title: string; action?: () => void; label?: string }) { const { c, s } = useDailyUI(); return <View style={[s.between, { marginTop: 6 }]}><Txt style={s.section}>{title}</Txt>{action && <Pressable onPress={action} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><Txt style={{ color: c.accentForeground, fontSize: 13 }}>{label}</Txt></Pressable>}</View>; }
export function Empty({ title, text, action, label = 'Add a job', icon = 'sun' }: { title: string; text: string; action?: () => void; label?: string; icon?: IconName }) { const { c, s } = useDailyUI(); return <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}><Icon name={icon} size={32} color={c.primary} /><Txt style={[s.section, { textAlign: 'center' }]}>{title}</Txt><Txt muted style={{ textAlign: 'center', lineHeight: 22 }}>{text}</Txt>{action && <Button onPress={action} secondary>{label}</Button>}</Card>; }
export function Metric({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) { const c = useColors(); return <View style={{ flex: 1, gap: 5, minWidth: 0 }}><Txt style={{ fontSize: 12, color: dark ? c.subtleOnCharcoal : c.mutedForeground }}>{label}</Txt><Txt style={{ fontSize: 23, fontFamily: fonts.medium, color: dark ? c.onCharcoal : c.foreground }}>{value}</Txt></View>; }
export function DetailRow({ label, value }: { label: string; value: string }) { const { c, s } = useDailyUI(); return <View style={[s.between, { gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.border }]}><Txt muted style={{ fontSize: 13, flex: 1 }}>{label}</Txt><Txt style={{ fontSize: 14, fontFamily: fonts.medium, flexShrink: 1, textAlign: 'right' }}>{value}</Txt></View>; }
export function JobIcon({ job }: { job: Pick<Job, 'icon'> }) { const { c, s } = useDailyUI(); return <View style={[s.jobIcon, job.icon === 'laptop' && { backgroundColor: c.secondary }]}>{job.icon === 'store' || job.icon === 'laptop' ? <MaterialCommunityIcons name={job.icon === 'store' ? 'storefront-outline' : 'laptop'} size={23} color={c.foreground} /> : <Icon name={job.icon} color={c.accentForeground} size={22} />}</View>; }
export function Page({ title, children, home = false, back = false, right, hideExit = false }: { title?: string; children: React.ReactNode; home?: boolean; back?: boolean; right?: React.ReactNode; hideExit?: boolean }) {
  const { s } = useDailyUI();
  const [logout, setLogout] = useState(false);
  const insets = useDailyInsets(), { error, retry } = useDaily();
  return <View style={[s.page, { paddingTop: insets.top }]}>
    <View style={s.header}>{home ? <Brand /> : <View style={[s.row, { flex: 1 }]}>{back && <IconButton name="arrow-left" label="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} />}<Txt style={s.section}>{title}</Txt></View>}
      {right || (home ? <IconButton name="user" label="Open profile" onPress={() => go('profile')} /> : null)}
    </View>
    {!hideExit && <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
      <Button secondary icon="arrow-left" testID="back-to-signin" onPress={() => setLogout(true)}>Back to sign in</Button>
    </View>}
    {Boolean(error) && <View style={{ paddingHorizontal: 20 }}><Note error>{error}</Note><Button secondary onPress={retry}>Retry saving</Button></View>}
    <KeyboardAwareScrollViewCompat bottomOffset={24} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" contentContainerStyle={[s.content, { paddingBottom: 28 + (back ? insets.bottom : 0) }]}>{children}</KeyboardAwareScrollViewCompat>
    {logout && <LogoutSheet onClose={() => setLogout(false)} />}
  </View>;
}
// `screen` is reserved for nested navigation by Expo Router / React Navigation.
// Use an ordinary query parameter so the detail route receives its discriminator.
export const go = (view: string, id?: string) => router.push({ pathname: '/detail', params: { view, ...(id ? { id } : {}) } });
export function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const { s } = useDailyUI();
  const insets = useDailyInsets();
  const close = () => { Keyboard.dismiss(); onClose(); };
  return <Modal transparent animationType="slide" statusBarTranslucent visible onRequestClose={close}><View style={s.overlay}><Pressable accessibilityLabel="Dismiss sheet" accessibilityRole="button" onPress={close} style={StyleSheet.absoluteFill} /><View accessibilityViewIsModal onAccessibilityEscape={close} style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16), maxHeight: '92%' }]}><View style={s.handle} /><View style={[s.between, { paddingHorizontal: 20 }]}><Txt style={[s.section, { flex: 1 }]}>{title}</Txt><IconButton name="x" label="Close sheet" onPress={close} /></View><KeyboardAwareScrollViewCompat bottomOffset={24} keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14 }} keyboardShouldPersistTaps="handled">{children}</KeyboardAwareScrollViewCompat></View></View></Modal>;
}
export function Confirm({ title, message, onConfirm, onClose }: { title: string; message: string; onConfirm: () => void; onClose: () => void }) { return <Sheet title={title} onClose={onClose}><Note error>{message}</Note><Button danger onPress={onConfirm} icon="trash-2">Delete permanently</Button><Button secondary onPress={onClose}>Keep it</Button></Sheet>; }
export function LogoutSheet({ onClose }: { onClose: () => void }) {
  const { data, update } = useDaily();
  return <Sheet title="Log out of Daily?" onClose={onClose}>
    <Txt>Your jobs, tasks, money and preferences stay on this device. You can return to them from sign in.</Txt>
    {data.active && <Note>Your running shift will keep going while you’re logged out. Come back to clock out.</Note>}
    <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>This leaves your local workspace. There is no connected account or server session to sign out of.</Txt>
    <Button icon="log-out" testID="confirm-logout" onPress={() => {
      onClose();
      // Protected stack screens are removed when the entry flag becomes false.
      update(d => ({ ...d, entered: false }));
      router.replace({ pathname: '/', params: { step: 'signin' } });
    }}>Log out</Button>
    <Button secondary onPress={onClose}>Cancel</Button>
  </Sheet>;
}
export function DateField({ value, onChange, label = 'Date' }: { value: string; onChange: (s: string) => void; label?: string }) {
  const { s } = useDailyUI();
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 7 }}><Txt style={s.label}>{label}</Txt><Pressable onPress={() => setOpen(true)} accessibilityLabel={`${label}, ${value}`} accessibilityRole="button" testID="date-picker" style={[s.input, s.between]}><Txt>{dateLabel(value)} · {parseDay(value).getFullYear()}</Txt><Icon name="calendar" size={18} /></Pressable>{open && <Sheet title={`Choose ${label.toLowerCase()}`} onClose={() => setOpen(false)}><MonthGrid initial={value} selected={value} onSelect={v => { onChange(v); setOpen(false); }} /><Button secondary onPress={() => { onChange(dayKey()); setOpen(false); }}>Use today</Button></Sheet>}</View>;
}
export function MonthGrid({ selected, initial = dayKey(), onSelect, marks = {}, onMonth }: { selected: string; initial?: string; onSelect: (d: string) => void; marks?: Record<string, string>; onMonth?: (v: string) => void }) {
  const { c, s, statusColor } = useDailyUI();
  const [month, setMonth] = useState(initial.slice(0, 7) + '-01');
  const first = parseDay(month), offset = (first.getDay() + 6) % 7, count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const move = (dir: number) => { const d = parseDay(month); d.setMonth(d.getMonth() + dir); const key = dayKey(d); setMonth(key); onMonth?.(key); };
  return <View><View style={s.between}><IconButton name="chevron-left" label="Previous month" onPress={() => move(-1)} /><Txt style={{ fontFamily: fonts.medium }}>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Txt><IconButton name="chevron-right" label="Next month" onPress={() => move(1)} /></View><View style={s.calendarGrid}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <View key={`w${i}`} style={s.day}><Txt muted style={{ fontSize: 12 }}>{d}</Txt></View>)}{Array.from({ length: offset }, (_, i) => <View key={`b${i}`} style={s.day} />)}{Array.from({ length: count }, (_, i) => { const key = dayKey(new Date(first.getFullYear(), first.getMonth(), i + 1)); return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${key}, ${marks[key] || 'not planned'}`} accessibilityState={{ selected: selected === key }} onPress={() => onSelect(key)} style={[s.day, selected === key && { backgroundColor: c.primary }, key === dayKey() && selected !== key && { backgroundColor: c.peach }]}><Txt style={{ color: selected === key ? c.primaryForeground : c.foreground, fontFamily: key === selected ? fonts.semibold : fonts.regular }}>{i + 1}</Txt>{Boolean(marks[key]) && <View style={{ height: 4, width: 4, borderRadius: 2, backgroundColor: selected === key ? c.primaryForeground : statusColor(marks[key]), marginTop: 3 }} />}</Pressable>; })}</View></View>;
}