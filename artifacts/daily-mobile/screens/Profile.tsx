import { useState } from 'react';
import { View } from 'react-native';
import { useDaily } from '@/state/DailyContext';
import { useDailyUI } from '@/hooks/useDailyUI';
import { DeleteJob } from '@/components/daily/Jobs';
import { Button, Card, LogoutSheet, Page, Section, Txt } from '@/components/daily/UI';
import { AccountSheet, AppSettingsSheet, AppearanceSheet, AvatarSheet, EditNameSheet, NotificationsSheet, ProfileAvatar, SettingsRow } from '@/components/daily/ProfileSettings';

type Panel = 'name' | 'avatar' | 'account' | 'settings' | 'notifications' | 'appearance' | 'logout' | 'jobs' | null;

export default function ProfileScreen() {
  const { data, error } = useDaily();
  const { c, s } = useDailyUI();
  const [panel, setPanel] = useState<Panel>(null);
  const [message, setMessage] = useState('');
  const open = (value: Panel) => { setMessage(''); setPanel(value); };
  const close = () => setPanel(null);
  return <Page title="Profile / Account" back hideExit>
    <View style={{ alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 16 }}>
      <ProfileAvatar />
      <Txt style={[s.title, { textAlign: 'center' }]}>{data.name}</Txt>
      <Txt muted>Your own little space.</Txt>
    </View>
    {Boolean(message) && !error && <View accessibilityLiveRegion="polite"><Txt style={{ color: c.accentForeground, textAlign: 'center', fontSize: 13 }}>{message}</Txt></View>}
    <Card style={{ paddingVertical: 4 }}>
      <SettingsRow icon="edit-2" title="Edit name" description="What Daily calls you" onPress={() => open('name')} />
      <SettingsRow icon="image" title="Change profile picture" description="Personalize your initials avatar" onPress={() => open('avatar')} />
    </Card>
    <Section title="Make yourself at home" />
    <Card style={{ paddingVertical: 4 }}>
      <SettingsRow icon="user" title="Account information" description="Your local workspace details" onPress={() => open('account')} />
      <SettingsRow icon="sliders" title="App settings" description="Balance privacy & manage jobs" onPress={() => open('settings')} />
      <SettingsRow icon="bell" title="Notifications" description="Device settings & availability" onPress={() => open('notifications')} />
      <SettingsRow icon="sun" title="Appearance" description={`${data.preferences.theme} theme`} onPress={() => open('appearance')} />
    </Card>
    <Button secondary icon="log-out" testID="logout" onPress={() => open('logout')}>Log out</Button>
    <Txt muted style={{ fontSize: 12, lineHeight: 18, textAlign: 'center' }}>A little space for your work, tasks and money.</Txt>
    {panel === 'name' && <EditNameSheet onClose={close} onSaved={() => { close(); setMessage('Your name has been updated.'); }} />}
    {panel === 'avatar' && <AvatarSheet onClose={close} onSaved={() => { close(); setMessage('Your avatar has been updated.'); }} />}
    {panel === 'account' && <AccountSheet onClose={close} />}
    {panel === 'settings' && <AppSettingsSheet onClose={close} onManage={() => setPanel('jobs')} />}
    {panel === 'notifications' && <NotificationsSheet onClose={close} />}
    {panel === 'appearance' && <AppearanceSheet onClose={close} />}
    {panel === 'logout' && <LogoutSheet onClose={close} />}
    {panel === 'jobs' && <DeleteJob onClose={close} />}
  </Page>;
}