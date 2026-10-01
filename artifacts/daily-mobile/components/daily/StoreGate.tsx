import React from 'react';
import { View } from 'react-native';
import { useDailyInsets } from '@/hooks/useDailyInsets';
import { useDaily } from '@/state/DailyContext';
import { theme as c } from '@/constants/colors';
import { Brand, Button, Note, Txt, s } from './UI';

export function StoreGate({ children }: { children: React.ReactNode }) {
  const { hydrated, error, retry } = useDaily(), insets = useDailyInsets();
  if (hydrated) return <>{children}</>;
  return <View style={[s.page, { paddingTop: insets.top + 30, paddingHorizontal: 24, gap: 24 }]}><Brand />{error ? <><Txt style={s.title}>Let’s keep your data safe.</Txt><Note error>{error}</Note><Button onPress={retry} icon="refresh-cw">Retry loading workspace</Button></> : <><Txt muted>Making a little room for your day…</Txt><View style={{ width: '74%', height: 30, backgroundColor: c.border, borderRadius: 12 }} /><View style={{ height: 244, borderRadius: 23, backgroundColor: c.secondary }} /><View style={{ height: 90, borderRadius: 20, backgroundColor: c.secondary }} /><View style={{ height: 130, borderRadius: 20, backgroundColor: c.secondary }} /></>}</View>;
}