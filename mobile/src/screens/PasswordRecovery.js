import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authApi } from '../api/client';
import { Button, Copy, Dots, Panel, Section, k, usePalette } from '../components/native/Kit';
import { PASSWORD_RULES, passwordError } from '../utils/password';
import { errorMessage } from '../utils/marketplace';

export default function PasswordRecovery({ reset = false }) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const c = usePalette();
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const submit = async () => {
    if (locked.current) return;
    setError('');
    let token = typeof params.token === 'string' ? params.token : '';
    if (reset) {
      if (!token) {
        try { const url = new URL(link.trim()); if (!['https:', 'http:', 'hustlespace:'].includes(url.protocol)) throw new Error(); token = url.searchParams.get('token') || ''; }
        catch { setError('Paste the complete password-reset link from your email.'); return; }
      }
      if (!token) { setError('This link is missing its reset token. Request a new link.'); return; }
      const validation = passwordError(password);
      if (validation) { setError(validation); return; }
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    locked.current = true; setBusy(true);
    try {
      if (reset) await authApi.resetPassword(token, password);
      else await authApi.forgotPassword(email.trim());
      setDone(true); setPassword(''); setLink('');
    } catch (failure) { setError(errorMessage(failure, reset ? 'Could not reset your password. The link may have expired; request a new one.' : 'Could not send your request. Check your connection and try again.')); }
    finally { locked.current = false; setBusy(false); }
  };
  const input = [k.input, { color: c.text, borderColor: c.line, backgroundColor: c.soft }];
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><Dots /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}><View style={{ maxWidth: 430, width: '100%', alignSelf: 'center', gap: 18 }}>
    <Section title={reset ? 'Set a new password' : 'Reset your password'} subtitle={reset ? 'Choose a password to keep your account secure.' : 'We’ll email you a reset link.'} />
    <Panel>{done ? <><Copy heading>{reset ? 'Password updated' : 'Check your inbox'}</Copy><Copy muted>{reset ? 'Your new password is ready. Log in to continue.' : 'If that email is registered, a reset link is on its way.'}</Copy>{!reset && <Button secondary onPress={() => router.push('/reset-password')}>I have my reset link</Button>}</> : <>
      {reset ? <>{!params.token && <><Copy>Reset link from your email</Copy><TextInput accessibilityLabel="Password reset link" value={link} onChangeText={setLink} style={input} placeholderTextColor={c.muted} placeholder="Paste your reset link" autoCapitalize="none" autoCorrect={false} secureTextEntry /></>}<Copy>New password</Copy><TextInput accessibilityLabel="New password" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} textContentType="newPassword" style={input} /><Button secondary onPress={() => setShow(value => !value)}>{show ? 'Hide password' : 'Show password'}</Button>{PASSWORD_RULES.map(rule => <Copy key={rule.id} style={{ color: rule.test(password) ? c.accent : c.muted, fontSize: 12 }}>{rule.test(password) ? '✓' : '○'} {rule.label}</Copy>)}</> : <><Copy>Email</Copy><TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" placeholder="you@example.com" placeholderTextColor={c.muted} style={input} /></>}
      {!!error && <Copy accessibilityRole="alert" style={{ color: '#D55656' }}>{error}</Copy>}<Button busy={busy} onPress={submit}>{reset ? 'Save new password' : 'Send reset link'}</Button>
    </>}<Button secondary disabled={busy} onPress={() => router.replace('/login')}>Back to log in</Button>{reset && !done && <Button secondary disabled={busy} onPress={() => router.replace('/forgot-password')}>Request a new reset link</Button>}</Panel>
  </View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
