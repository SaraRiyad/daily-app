import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useDaily } from '@/state/DailyContext';
import { theme as c, fonts } from '@/constants/colors';
import { DeleteJob } from '@/components/daily/Jobs';
import { Button, Card, DetailRow, Field, Note, Page, Section, Txt, s } from '@/components/daily/UI';

export default function ProfileScreen() {
  const { data, update } = useDaily();
  const [name, setName] = useState(data.name), [message, setMessage] = useState(''), [error, setError] = useState(''), [manage, setManage] = useState(false);
  return <Page title="Your profile" back><View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}><View style={[s.avatar, { width: 76, height: 76, borderRadius: 26 }]}><Txt style={{ fontSize: 27, fontFamily: fonts.medium }}>{data.name.split(' ').filter(Boolean).slice(0, 2).map(v => v[0]).join('').toUpperCase()}</Txt></View><Txt style={s.title}>Your own little space.</Txt><Txt muted>Make Daily feel like you.</Txt></View>
    <Card><Field label="Your name" value={name} onChangeText={v => { setName(v); setMessage(''); }} maxLength={60} /><Button icon="check" onPress={() => { if (!name.trim()) { setError('Add a name so we know what to call you.'); return; } update(d => ({ ...d, name: name.trim() })); setError(''); setMessage('Your name has been updated.'); }}>Save name</Button>{Boolean(message) && <Txt style={{ fontSize: 13, color: c.accentForeground }}>{message}</Txt>}{Boolean(error) && <Note error>{error}</Note>}</Card>
    <Section title="A few things to know" /><Card><DetailRow label="Currency" value="USD" /><DetailRow label="Overtime starts" value="After 8h / job / local day" /><DetailRow label="Storage" value="This device only" /><DetailRow label="Account" value="Prototype only" /></Card>
    <Button secondary icon="trash-2" onPress={() => setManage(true)}>Manage & delete jobs</Button><Button secondary icon="log-out" testID="return-welcome" onPress={() => { update(d => ({ ...d, entered: false })); router.replace('/'); }}>Return to welcome</Button>
    <Note>Returning to welcome is not secure sign-out. Your local data and any running shift are kept. No account is created, and local data is not protected.</Note>
    <Note>Daily is an interactive local demo. Earnings are estimates, not payroll or tax advice. Record income separately when paid.</Note>
    {manage && <DeleteJob onClose={() => setManage(false)} />}
  </Page>;
}