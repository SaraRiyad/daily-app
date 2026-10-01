import { useCallback, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useDailyInsets } from '@/hooks/useDailyInsets';
import { fonts } from '@/constants/colors';
import { useDailyUI } from '@/hooks/useDailyUI';
import { useDaily } from '@/state/DailyContext';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Brand, Button, Field, Icon, IconButton, Note, Txt } from '@/components/daily/UI';

type Step = 'welcome' | 'signin' | 'signup';
export default function EntranceScreen() {
  const { c, s } = useDailyUI();
  const { authenticated, authenticate, authError, busy } = useDaily(), insets = useDailyInsets();
  const { step: requestedStep } = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState<Step>(requestedStep === 'signin' || authError ? 'signin' : 'welcome'), [name, setName] = useState('');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false), [showConfirm, setShowConfirm] = useState(false), [error, setError] = useState('');
  const clearSecrets = () => { setPassword(''); setConfirmation(''); setEmail(''); setShow(false); setShowConfirm(false); };
  const move = (next: Step) => { if (busy) return; clearSecrets(); setError(''); setStep(next); };
  useFocusEffect(useCallback(() => () => { setPassword(''); setConfirmation(''); setEmail(''); setShow(false); setShowConfirm(false); }, []));
  useFocusEffect(useCallback(() => {
    if (requestedStep === 'signin') setStep('signin');
  }, [requestedStep]));
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      if (step !== 'welcome') { move('welcome'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [step, busy]));
  if (authenticated) return <Redirect href="/(tabs)" />;
  const submit = async () => {
    if (busy || step === 'welcome') return;
    if (step === 'signup' && !name.trim()) { setError('What should we call you? Add your name to continue.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address for your Daily account.'); return; }
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (step === 'signup' && password !== confirmation) { setError('Your passwords do not match. Try again.'); return; }
    setError('');
    try { await authenticate(step, email, password, name); }
    finally { setPassword(''); setConfirmation(''); setShow(false); setShowConfirm(false); }
  };
  return <View style={[s.page, { paddingTop: insets.top }]}><View style={[s.header, { paddingHorizontal: 25 }]}><Brand />{step !== 'welcome' && <IconButton name="arrow-left" label="Back to welcome" onPress={() => move('welcome')} />}</View>
    <KeyboardAwareScrollViewCompat bottomOffset={24} keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 25, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 22 }}>
      {Boolean(authError) && <Note error>{authError}</Note>}
      {step === 'welcome' ? <>
        <View style={{ backgroundColor: c.charcoal, borderRadius: 28, minHeight: 230, overflow: 'hidden', padding: 27, justifyContent: 'space-between' }}>
          <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 30, borderColor: c.primary, right: -78, top: -75, opacity: 0.25 }} />
          <Txt style={{ color: c.subtleOnCharcoal, fontSize: 10, letterSpacing: 1.8 }}>YOUR EVERYDAY COMPANION</Txt>
          <Txt style={{ color: c.onCharcoal, fontFamily: fonts.medium, fontSize: 33, lineHeight: 39, letterSpacing: -0.9 }}>A little order.{'\n'}A lot more living.</Txt>
          <View style={[s.row, { gap: 9, flexWrap: 'wrap' }]}><Icon name="briefcase" color={c.primary} size={16} /><Txt style={{ color: c.subtleOnCharcoal, fontSize: 12 }}>Your work.</Txt><Icon name="credit-card" color={c.primary} size={16} /><Txt style={{ color: c.subtleOnCharcoal, fontSize: 12 }}>Your money.</Txt><Icon name="heart" color={c.primary} size={16} /></View>
        </View>
        <View style={{ gap: 10, paddingTop: 2 }}><Txt style={{ fontSize: 38, lineHeight: 43, letterSpacing: -1.2, fontFamily: fonts.medium }}>Make room{'\n'}for your day.</Txt><Txt muted style={{ lineHeight: 24 }}>Your jobs, little to-dos and money.{'\n'}Together, without the overwhelm.</Txt></View>
        <View style={{ gap: 11 }}><Button onPress={() => move('signup')} icon="arrow-right" testID="get-started">Get started · Sign up</Button><Button secondary onPress={() => move('signin')} testID="open-signin">I already have an account</Button></View>
      </> : <>
        {step === 'signup' && <View style={s.row}><View style={{ height: 4, width: 33, backgroundColor: c.primary, borderRadius: 3 }} /><View style={{ height: 4, width: 33, backgroundColor: c.border, borderRadius: 3 }} /></View>}
        <View style={{ gap: 10 }}><Txt style={[s.title, { fontSize: 36, lineHeight: 41 }]}>{step === 'signin' ? 'Good to have\nyou back.' : 'Let’s start\nwith you.'}</Txt><Txt muted style={{ lineHeight: 23 }}>{step === 'signin' ? 'Sign in to your work, tasks and money — safely saved to your account.' : 'A fresh space for your day. Add your first job from Home when you’re ready.'}</Txt></View>
        {step === 'signup' && <Field label="Your name" value={name} onChangeText={setName} placeholder="What should we call you?" maxLength={60} autoComplete="name" editable={!busy} />}
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={200} editable={!busy} />
        <View style={{ position: 'relative' }}><Field label="Password · 8+ characters" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry={!show} autoCorrect={false} autoCapitalize="none" autoComplete={step === 'signup' ? 'new-password' : 'current-password'} maxLength={128} editable={!busy} style={{ paddingRight: 56 }} /><View style={{ position: 'absolute', right: 4, bottom: 4 }}><IconButton name={show ? 'eye-off' : 'eye'} label={show ? 'Hide password' : 'Show password'} onPress={() => setShow(!show)} /></View></View>
        {step === 'signup' && <View style={{ position: 'relative' }}><Field label="Confirm password" value={confirmation} onChangeText={setConfirmation} placeholder="Same password" secureTextEntry={!showConfirm} autoCorrect={false} autoCapitalize="none" autoComplete="new-password" maxLength={128} editable={!busy} style={{ paddingRight: 56 }} /><View style={{ position: 'absolute', right: 4, bottom: 4 }}><IconButton name={showConfirm ? 'eye-off' : 'eye'} label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'} onPress={() => setShowConfirm(!showConfirm)} /></View></View>}
        {Boolean(error) && <Note error>{error}</Note>}<Button icon="arrow-right" disabled={busy} onPress={() => void submit()} testID="submit-account">{busy ? 'Connecting securely…' : step === 'signin' ? 'Sign in' : 'Create my account'}</Button><Button secondary disabled={busy} onPress={() => move(step === 'signin' ? 'signup' : 'signin')}>{step === 'signin' ? 'New here? Set up your space' : 'Already set up? Sign in'}</Button>
        <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>Existing device data is never uploaded automatically. After sign in, you can choose to import it from Account information if this account is empty.</Txt>
      </>}
    </KeyboardAwareScrollViewCompat>
  </View>;
}