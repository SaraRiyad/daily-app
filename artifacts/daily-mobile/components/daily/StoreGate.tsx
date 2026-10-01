import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useDailyInsets } from '@/hooks/useDailyInsets';
import { useDaily } from '@/state/DailyContext';
import { useDailyUI } from '@/hooks/useDailyUI';
import { Brand, Button, Note, Sheet, Txt } from './UI';

export function StoreGate({ children }: { children: React.ReactNode }) {
  const { c, s } = useDailyUI();
  const { hydrated, error, retry, busy, recoveryAvailable, exportRecovery, canRecoverServer, recoverServerCache } = useDaily(), insets = useDailyInsets();
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const recovery = async () => {
    try { setMessage(await exportRecovery()); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Recovery export failed. The device cache remains untouched.'); }
  };
  const restoreServer = async () => {
    try { await recoverServerCache(); setConfirm(false); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Recovery failed. The device copy is kept.'); }
  };
  if (hydrated) return <>{children}</>;
  return <View style={[s.page, { paddingTop: insets.top + 30 }]}><ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 24 }}><Brand />{error ? <><Txt style={s.title}>Let’s keep your data safe.</Txt><Note error>{error}</Note><Button disabled={busy} onPress={retry} icon="refresh-cw">Retry loading workspace</Button>{recoveryAvailable && <Button secondary disabled={busy} icon="download" onPress={() => void recovery()}>Export device recovery copy</Button>}{canRecoverServer && <Button secondary disabled={busy} onPress={() => { setMessage(''); setConfirm(true); }}>Recover from server with backup</Button>}{Boolean(message) && <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>{message}</Txt>}</> : <><Txt muted>Making a little room for your day…</Txt><View style={{ width: '74%', height: 30, backgroundColor: c.border, borderRadius: 12 }} /><View style={{ height: 244, borderRadius: 23, backgroundColor: c.secondary }} /><View style={{ height: 90, borderRadius: 20, backgroundColor: c.secondary }} /><View style={{ height: 130, borderRadius: 20, backgroundColor: c.secondary }} /></>}</ScrollView>
    {confirm && <Sheet title="Preserve device data & recover?" onClose={() => setConfirm(false)}><Note error>This replaces an unreadable or over-limit device cache with the server workspace. Daily must first keep the complete original cache in a separate account-scoped backup. It will not merge it or upload it. The legacy device backup remains untouched.</Note><Button disabled={busy} icon="download" secondary onPress={() => void recovery()}>Export recovery copy first</Button>{Boolean(message) && <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>{message}</Txt>}<Button disabled={busy} testID="confirm-recover-cache" onPress={() => void restoreServer()}>Keep backup & recover server copy</Button><Button secondary disabled={busy} onPress={() => setConfirm(false)}>Keep device cache</Button></Sheet>}
  </View>;
}