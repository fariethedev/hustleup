import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { authApi } from '../src/api/client';
import { setUser } from '../src/store/authSlice';
import { DottedBackground, styles } from '../src/components/native/AuthForm';

export default function VerifyCode() {
  const { email } = useLocalSearchParams();
  const router = useRouter(), dispatch = useDispatch();
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const locked = useRef(false), resendAfter = useRef(0);
  const run = async (resend = false) => {
    if (locked.current || !email) return;
    if (resend && Date.now() < resendAfter.current) { setMessage('Please wait a minute before requesting another code.'); return; }
    if (!resend && !/^\d{6}$/.test(code)) { setMessage('Enter the six-digit code from your email.'); return; }
    locked.current = true; setBusy(true); setMessage('');
    try {
      if (resend) { await authApi.resendCode(email); resendAfter.current = Date.now() + 60000; setMessage('A new code has been requested. Check your inbox.'); return; }
      const { data } = await authApi.verifyCode(email, code);
      if (!data.accessToken) { router.replace('/login'); return; }
      await AsyncStorage.setItem('hustleup_token', data.accessToken);
      if (data.refreshToken) await AsyncStorage.setItem('hustleup_refresh', data.refreshToken);
      let user = { id: data.userId, email, fullName: data.fullName, role: data.role, emailVerified: true };
      try { user = { ...(await authApi.me()).data, emailVerified: true }; } catch { /* The verified session is still valid if the profile service is unavailable. */ }
      await AsyncStorage.setItem('hustleup_user', JSON.stringify(user));
      dispatch(setUser(user)); router.replace('/(tabs)/feed');
    } catch (e) { setMessage(e.response?.data?.error || e.response?.data?.message || 'Verification failed. Please try again.'); }
    finally { locked.current = false; setBusy(false); }
  };
  return <SafeAreaView style={styles.screen}><DottedBackground /><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.content}>
    <Text style={styles.title}>Check your email</Text><Text style={styles.subtitle}>Enter the six-digit code sent to {email}.</Text>
    <View style={styles.card}>
      {!!message && <Text accessibilityRole="alert" style={styles.errorText}>{message}</Text>}
      <TextInput accessibilityLabel="Verification code" value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} style={[styles.input, { marginVertical: 16, letterSpacing: 8, textAlign: 'center' }]} />
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => run()} style={styles.loginButton}>{busy ? <ActivityIndicator color="#050505" /> : <Text style={styles.loginButtonText}>Verify email</Text>}</Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => run(true)}><Text style={styles.signupText}>Resend code</Text></Pressable>
      <Pressable onPress={() => router.replace('/login')}><Text style={styles.signupText}>Back to login</Text></Pressable>
    </View>
  </View></ScrollView></SafeAreaView>;
}
