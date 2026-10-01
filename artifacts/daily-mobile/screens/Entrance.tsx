import { useCallback, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useDailyInsets } from '@/hooks/useDailyInsets';
import { fonts } from '@/constants/colors';
import { useDailyUI } from '@/hooks/useDailyUI';
import { useDaily } from '@/state/DailyContext';
import { money } from '@/state/model';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { JobForm } from '@/components/daily/Jobs';
import { Brand, Button, Card, Field, Icon, IconButton, JobIcon, Note, Txt } from '@/components/daily/UI';

type Step = 'welcome' | 'signin' | 'signup' | 'jobs';
export default function EntranceScreen() {
  const { c, s } = useDailyUI();
  const { data, update, error: storageError, retry } = useDaily(), insets = useDailyInsets();
  const { step: requestedStep } = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState<Step>(requestedStep === 'signin' ? 'signin' : 'welcome'), [name, setName] = useState(data.name === 'Alex' ? '' : data.name);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false), [showConfirm, setShowConfirm] = useState(false), [error, setError] = useState(''), [adding, setAdding] = useState(false);
  const clearSecrets = () => { setPassword(''); setConfirmation(''); setEmail(''); setShow(false); setShowConfirm(false); };
  const move = (next: Step) => { clearSecrets(); setError(''); setStep(next); };
  const enter = () => { clearSecrets(); update(d => ({ ...d, entered: true })); };
  useFocusEffect(useCallback(() => () => { setPassword(''); setConfirmation(''); setEmail(''); setShow(false); setShowConfirm(false); }, []));
  useFocusEffect(useCallback(() => {
    if (requestedStep === 'signin') setStep('signin');
  }, [requestedStep]));
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step !== 'welcome') { move(step === 'jobs' ? 'signup' : 'welcome'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [step]));
  if (data.entered) return <Redirect href="/(tabs)" />;
  const submit = () => {
    if (step === 'signup' && !name.trim()) { setError('What should we call you? Add your name to continue.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter an email-shaped address for this demo. It is not saved or verified.'); return; }
    if (password.length < 8) { setError('Use a made-up password with at least 8 characters. Do not use a real password.'); return; }
    if (step === 'signup' && password !== confirmation) { setError('The demo passwords do not match. Try again.'); return; }
    clearSecrets();
    if (step === 'signup') { update(d => ({ ...d, name: name.trim() })); setStep('jobs'); setError(''); } else enter();
  };
  return <View style={[s.page, { paddingTop: insets.top }]}><View style={[s.header, { paddingHorizontal: 25 }]}><Brand />{step !== 'welcome' && <IconButton name="arrow-left" label="Back to welcome" onPress={() => move('welcome')} />}</View>
    <KeyboardAwareScrollViewCompat bottomOffset={24} keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 25, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 22 }}>
      {Boolean(storageError) && <><Note error>{storageError}</Note><Button secondary onPress={retry}>Retry saving</Button></>}
      {step === 'welcome' ? <>
        <View style={{ backgroundColor: c.charcoal, borderRadius: 28, minHeight: 230, overflow: 'hidden', padding: 27, justifyContent: 'space-between' }}>
          <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 30, borderColor: c.primary, right: -78, top: -75, opacity: 0.25 }} />
          <Txt style={{ color: c.subtleOnCharcoal, fontSize: 10, letterSpacing: 1.8 }}>YOUR EVERYDAY COMPANION</Txt>
          <Txt style={{ color: c.onCharcoal, fontFamily: fonts.medium, fontSize: 33, lineHeight: 39, letterSpacing: -0.9 }}>A little order.{'\n'}A lot more living.</Txt>
          <View style={[s.row, { gap: 9, flexWrap: 'wrap' }]}><Icon name="briefcase" color={c.primary} size={16} /><Txt style={{ color: c.subtleOnCharcoal, fontSize: 12 }}>Your work.</Txt><Icon name="credit-card" color={c.primary} size={16} /><Txt style={{ color: c.subtleOnCharcoal, fontSize: 12 }}>Your money.</Txt><Icon name="heart" color={c.primary} size={16} /></View>
        </View>
        <View style={{ gap: 10, paddingTop: 2 }}><Txt style={{ fontSize: 38, lineHeight: 43, letterSpacing: -1.2, fontFamily: fonts.medium }}>Make room{'\n'}for your day.</Txt><Txt muted style={{ lineHeight: 24 }}>Your jobs, little to-dos and money.{'\n'}Together, without the overwhelm.</Txt></View>
        <View style={{ gap: 11 }}><Button onPress={() => move('signup')} icon="arrow-right" testID="get-started">Get started · Sign up</Button><Button secondary onPress={() => move('signin')} testID="open-signin">I already have an account</Button></View>
      </> : step === 'jobs' ? <>
        <View style={s.row}><View style={{ height: 4, width: 33, backgroundColor: c.primary, borderRadius: 3 }} /><View style={{ height: 4, width: 33, backgroundColor: c.primary, borderRadius: 3 }} /></View>
        <View style={{ gap: 10 }}><Txt style={[s.title, { fontSize: 36, lineHeight: 40 }]}>Different hats.{'\n'}One place.</Txt><Txt muted style={{ lineHeight: 23 }}>Add the work you do. You can add more, edit or delete jobs later.</Txt></View>
        {data.jobs.map(j => <Card key={j.id}><View style={s.row}><JobIcon job={j} /><View style={{ flex: 1 }}><Txt style={{ fontFamily: fonts.medium }}>{j.name}</Txt><Txt muted style={{ fontSize: 12 }}>{money(j.normal)}/hr · {money(j.overtime)}/hr overtime</Txt></View><Icon name="check" color={c.accentForeground} /></View></Card>)}
        <Button secondary icon="plus" onPress={() => setAdding(true)}>Add another job</Button><Note>We included sample jobs to help you explore. Existing local tasks, money and shifts are kept; setup never clears them.</Note><Button icon="arrow-right" onPress={enter}>{data.jobs.length ? 'Let’s make today yours' : 'I’ll add a job later'}</Button>
      </> : <>
        {step === 'signup' && <View style={s.row}><View style={{ height: 4, width: 33, backgroundColor: c.primary, borderRadius: 3 }} /><View style={{ height: 4, width: 33, backgroundColor: c.border, borderRadius: 3 }} /></View>}
        <View style={{ gap: 10 }}><Txt style={[s.title, { fontSize: 36, lineHeight: 41 }]}>{step === 'signin' ? 'Good to have\nyou back.' : 'Let’s start\nwith you.'}</Txt><Txt muted style={{ lineHeight: 23 }}>{step === 'signin' ? 'Try the sign-in flow, then return to this device’s saved workspace.' : 'A name to make this space feel yours. Your jobs come next.'}</Txt></View>
        {step === 'signup' && <Field label="Your name" value={name} onChangeText={setName} placeholder="What should we call you?" maxLength={60} autoComplete="off" />}
        <Field label="Email · demo only, not saved" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={200} />
        <View style={{ position: 'relative' }}><Field label="Made-up password · 8+ characters" value={password} onChangeText={setPassword} placeholder="Use a demo password" secureTextEntry={!show} autoCorrect={false} autoCapitalize="none" autoComplete="off" textContentType="none" importantForAutofill="no" maxLength={128} style={{ paddingRight: 56 }} /><View style={{ position: 'absolute', right: 4, bottom: 4 }}><IconButton name={show ? 'eye-off' : 'eye'} label={show ? 'Hide password' : 'Show password'} onPress={() => setShow(!show)} /></View></View>
        {step === 'signup' && <View style={{ position: 'relative' }}><Field label="Confirm made-up password" value={confirmation} onChangeText={setConfirmation} placeholder="Same made-up password" secureTextEntry={!showConfirm} autoCorrect={false} autoCapitalize="none" autoComplete="off" textContentType="none" importantForAutofill="no" maxLength={128} style={{ paddingRight: 56 }} /><View style={{ position: 'absolute', right: 4, bottom: 4 }}><IconButton name={showConfirm ? 'eye-off' : 'eye'} label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'} onPress={() => setShowConfirm(!showConfirm)} /></View></View>}
        {Boolean(error) && <Note error>{error}</Note>}<Button icon="arrow-right" onPress={submit} testID="submit-demo-account">{step === 'signin' ? 'Preview sign in' : 'Continue to your jobs'}</Button><Button secondary onPress={() => move(step === 'signin' ? 'signup' : 'signin')}>{step === 'signin' ? 'New here? Set up your space' : 'Already set up? Preview sign in'}</Button>
      </>}
    </KeyboardAwareScrollViewCompat>
    {adding && <JobForm onClose={() => setAdding(false)} />}
  </View>;
}