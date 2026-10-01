import { useState } from 'react';
import { Keyboard, Linking, Platform, Pressable, Switch, View } from 'react-native';
import { fonts } from '@/constants/colors';
import { useDailyUI } from '@/hooks/useDailyUI';
import { useDailyTheme } from '@/hooks/useColors';
import { useDaily } from '@/state/DailyContext';
import type { Preferences } from '@/state/model';
import { Button, Card, Choices, DetailRow, Field, Icon, Note, Sheet, Txt, type IconName } from './UI';

export function SettingsRow({ icon, title, description, onPress }: { icon: IconName; title: string; description: string; onPress: () => void }) {
  const { c, s } = useDailyUI();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${description}`} onPress={onPress}
    style={({ pressed }) => [s.row, { minHeight: 70, paddingVertical: 10, opacity: pressed ? 0.6 : 1 }]}>
    <View style={s.jobIcon}><Icon name={icon} color={c.accentForeground} /></View>
    <View style={{ flex: 1, gap: 3 }}><Txt style={{ fontFamily: fonts.medium }}>{title}</Txt><Txt muted style={{ fontSize: 12, lineHeight: 18 }}>{description}</Txt></View>
    <Icon name="chevron-right" size={18} color={c.mutedForeground} />
  </Pressable>;
}

export function ProfileAvatar({ color, size = 80 }: { color?: Preferences['avatarColor']; size?: number }) {
  const { data } = useDaily();
  const { c, s } = useDailyUI();
  const selected = color ?? data.preferences.avatarColor;
  const backgroundColor = selected === 'Charcoal' ? c.charcoal : selected === 'Stone' ? c.secondary : c.accent;
  const textColor = selected === 'Charcoal' ? c.onCharcoal : selected === 'Stone' ? c.foreground : c.accentForeground;
  const initials = data.name.split(/\s+/).filter(Boolean).slice(0, 2).map(v => Array.from(v)[0]).join('').toUpperCase();
  return <View accessible accessibilityLabel={`${data.name}, ${selected.toLowerCase()} initials avatar`} style={[s.avatar, { backgroundColor, width: size, height: size, borderRadius: size * 0.33 }]}>
    <Txt style={{ color: textColor, fontSize: size * 0.34, fontFamily: fonts.medium }}>{initials}</Txt>
  </View>;
}

export function EditNameSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data, update } = useDaily();
  const [name, setName] = useState(data.name);
  const [error, setError] = useState('');
  const close = () => { Keyboard.dismiss(); onClose(); };
  const save = () => {
    const value = name.trim();
    if (!value || value.length > 60) { setError('Use a name between 1 and 60 characters, not just spaces.'); return; }
    update(d => ({ ...d, name: value }));
    Keyboard.dismiss();
    onSaved();
  };
  return <Sheet title="Edit your name" onClose={close}>
    <Txt muted>A familiar name for your own little space.</Txt>
    <Field label="Your name" value={name} onChangeText={v => { setName(v); setError(''); }} autoFocus autoCapitalize="words" autoCorrect={false} maxLength={60} returnKeyType="done" onSubmitEditing={save} />
    <Txt muted style={{ fontSize: 12 }}>{name.length} / 60 characters</Txt>
    {Boolean(error) && <Note error>{error}</Note>}
    <Button icon="check" onPress={save} testID="save-profile-name">Save</Button>
    <Button secondary onPress={close}>Cancel</Button>
  </Sheet>;
}

export function AvatarSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data, update } = useDaily();
  const [color, setColor] = useState(data.preferences.avatarColor);
  const { s } = useDailyUI();
  return <Sheet title="Your profile picture" onClose={onClose}>
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 18 }}>
      <ProfileAvatar color={color} size={100} />
      <Txt style={s.section}>{data.name}</Txt>
      <Txt muted style={{ fontSize: 12 }}>Initials avatar preview</Txt>
    </View>
    <Txt muted style={{ lineHeight: 22 }}>Photos aren’t connected yet. For now, choose a color for your initials — no camera or photo upload needed.</Txt>
    <Choices values={['Coral', 'Stone', 'Charcoal'] as const} value={color} onChange={setColor} />
    <Button icon="check" onPress={() => { update(d => ({ ...d, preferences: { ...d.preferences, avatarColor: color } })); onSaved(); }}>Save avatar</Button>
    <Button secondary onPress={onClose}>Cancel</Button>
  </Sheet>;
}

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { data } = useDaily();
  return <Sheet title="Account information" onClose={onClose}>
    <Card><DetailRow label="Name" value={data.name} /><DetailRow label="Storage" value="This device only" /><DetailRow label="Account connection" value="Not connected" /><DetailRow label="Email" value="Not saved" /></Card>
    <Txt muted style={{ lineHeight: 22 }}>Daily currently uses a local workspace, not a connected account. Sign in is a local entry flow; it doesn’t verify an identity. Your workspace is not synced or backed up to a server.</Txt>
    <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>Clearing app data or uninstalling can remove what’s saved here. Logging out keeps it.</Txt>
    <Button secondary onPress={onClose}>Done</Button>
  </Sheet>;
}

export function AppSettingsSheet({ onClose, onManage }: { onClose: () => void; onManage: () => void }) {
  const { data, update } = useDaily();
  const { c, s } = useDailyUI();
  return <Sheet title="App settings" onClose={onClose}>
    <Card><View style={s.between}>
      <View style={{ flex: 1, gap: 5, paddingRight: 14 }}><Txt style={{ fontFamily: fonts.medium }}>Hide Home balance</Txt><Txt muted style={{ fontSize: 12, lineHeight: 18 }}>Keep the amount off Home. It’s still visible in Money.</Txt></View>
      <Switch accessibilityLabel="Hide Home balance" testID="hide-home-balance" value={data.preferences.hideHomeBalance}
        onValueChange={hideHomeBalance => update(d => ({ ...d, preferences: { ...d.preferences, hideHomeBalance } }))}
        trackColor={{ false: c.border, true: c.primary }} thumbColor={c.card} />
    </View></Card>
    <Card><DetailRow label="Currency" value="Israeli shekel · ₪ (ILS)" /><DetailRow label="Overtime starts" value="After 8h / job / local day" /></Card>
    <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>Earnings are estimates, not payroll or tax advice. Record income separately when paid.</Txt>
    <Button secondary icon="trash-2" onPress={onManage}>Manage & delete jobs</Button>
    <Button secondary onPress={onClose}>Done</Button>
  </Sheet>;
}

export function NotificationsSheet({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const native = Platform.OS === 'ios' || Platform.OS === 'android';
  const openSettings = async () => {
    if (!native) return;
    setError(''); setOpening(true);
    try { await Linking.openSettings(); }
    catch { setError('Device settings couldn’t open. Try again, or open your phone’s Settings app and find Daily.'); }
    finally { setOpening(false); }
  };
  return <Sheet title="Notifications" onClose={onClose}>
    <Card><DetailRow label="Daily notifications" value="Not connected" /><Txt muted style={{ lineHeight: 22 }}>Daily isn’t sending push notifications or scheduled reminders yet. Device permissions alone won’t turn on reminders.</Txt></Card>
    <Txt muted style={{ lineHeight: 22 }}>{native ? 'Open your phone’s app settings to review any device-level options available for Daily. This preview doesn’t read your notification permission status.' : 'Device notification settings are available in the phone app. They can’t be opened from this web preview.'}</Txt>
    {Boolean(error) && <Note error>{error}</Note>}
    {native && <Button secondary icon="external-link" disabled={opening} onPress={() => void openSettings()}>{opening ? 'Opening device settings…' : error ? 'Try device settings again' : 'Open device settings'}</Button>}
    <Button secondary onPress={onClose}>Done</Button>
  </Sheet>;
}

export function AppearanceSheet({ onClose }: { onClose: () => void }) {
  const { data, update } = useDaily();
  const { isDark } = useDailyTheme();
  return <Sheet title="Appearance" onClose={onClose}>
    <Txt muted style={{ lineHeight: 22 }}>A familiar space, in the light that suits you.</Txt>
    <Choices values={['Light', 'Dark', 'System'] as const} value={data.preferences.theme} onChange={theme => update(d => ({ ...d, preferences: { ...d.preferences, theme } }))} />
    <Card><DetailRow label="Current appearance" value={isDark ? 'Dark' : 'Light'} /><Txt muted style={{ fontSize: 13, lineHeight: 20 }}>System follows your device’s appearance. Your choice applies across Daily and is saved on this device.</Txt></Card>
    <Button secondary onPress={onClose}>Done</Button>
  </Sheet>;
}