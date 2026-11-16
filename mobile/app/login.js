import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, clearError } from '../src/store/authSlice';
import { fonts } from '../src/components/native/Kit';

const BG = '#080908';
const LIME = '#CDFF00';

export default function LoginScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);
  const [localError, setLocalError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (loading || !email.trim() || !password) return;
    setLocalError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setLocalError('Enter a valid email address.'); return; }
    dispatch(clearError());
    const result = await dispatch(loginUser({ email: email.trim(), password }));
    if (loginUser.fulfilled.match(result)) router.replace('/(tabs)/feed');
  };

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.content}>
            <View style={s.brandMark}><Feather name="zap" size={21} color={BG} /></View>
            <Text style={s.brand}>Hustle<Text style={{ color: LIME }}>Space</Text></Text>
            <Text style={s.title}>Welcome back</Text>
            <Text style={s.subtitle}>Sign in to pick up where you left off.</Text>

            <View style={s.card}>
              {(localError || error) ? <View style={s.errorBox}>
                <Feather name="alert-circle" size={17} color="#FF8585" />
                <Text accessibilityRole="alert" style={s.errorText}>{localError || error}</Text>
              </View> : null}

              <View style={s.fieldGroup}>
                <Text style={s.label}>Email address</Text>
                <View style={s.inputWrap}>
                  <Feather name="mail" size={17} color="#858A83" />
                  <TextInput
                    accessibilityLabel="Email address" style={s.input} value={email} onChangeText={setEmail}
                    placeholder="you@example.com" placeholderTextColor="#777B75" keyboardType="email-address"
                    autoCapitalize="none" autoCorrect={false} textContentType="username" returnKeyType="next"
                  />
                </View>
              </View>

              <View style={s.fieldGroup}>
                <View style={s.passwordHeader}>
                  <Text style={s.label}>Password</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Forgot password" onPress={() => router.push('/forgot-password')} hitSlop={8}>
                    <Text style={s.forgot}>Forgot password?</Text>
                  </Pressable>
                </View>
                <View style={s.inputWrap}>
                  <Feather name="lock" size={17} color="#858A83" />
                  <TextInput
                    accessibilityLabel="Password" style={s.input} value={password} onChangeText={setPassword}
                    placeholder="Enter your password" placeholderTextColor="#777B75"
                    secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false}
                    textContentType="password" returnKeyType="go" onSubmitEditing={handleLogin}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(value => !value)} hitSlop={8}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#A7AAA4" />
                  </Pressable>
                </View>
              </View>

              <Pressable accessibilityRole="button" accessibilityLabel="Log in" style={[s.loginButton, (!email.trim() || !password || loading) && { opacity: 0.55 }]} onPress={handleLogin} disabled={!email.trim() || !password || loading}>
                {loading ? <ActivityIndicator color={BG} /> : <><Text style={s.loginButtonText}>Log in</Text><Feather name="arrow-right" size={18} color={BG} /></>}
              </Pressable>
            </View>

            <View style={s.signupRow}>
              <Text style={s.signupText}>New to HustleSpace?</Text>
              <Pressable accessibilityRole="link" onPress={() => router.push('/register')} hitSlop={8}><Text style={s.signupLink}>Create an account</Text></Pressable>
            </View>
            <Text style={s.footnote}>Your community for ideas, work and independent business.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = {
  screen: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 36 },
  content: { width: '100%', maxWidth: 430, alignSelf: 'center', alignItems: 'center' },
  brandMark: { width: 46, height: 46, borderRadius: 16, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  brand: { color: '#F7F8F5', fontFamily: fonts.heading, fontSize: 19, marginBottom: 34 },
  title: { color: '#F7F8F5', fontFamily: fonts.heading, fontSize: 28, textAlign: 'center' },
  subtitle: { color: '#A4A79F', fontFamily: fonts.body, fontSize: 14, marginTop: 7, marginBottom: 24, textAlign: 'center' },
  card: { width: '100%', backgroundColor: '#111310', borderColor: '#292C26', borderWidth: 1, borderRadius: 24, padding: 20, gap: 18 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 13, backgroundColor: '#301819', borderWidth: 1, borderColor: '#683437' },
  errorText: { color: '#FFB1B1', fontFamily: fonts.body, fontSize: 12, flex: 1 },
  fieldGroup: { gap: 8 },
  label: { color: '#E4E6DF', fontFamily: fonts.medium, fontSize: 12 },
  passwordHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  forgot: { color: LIME, fontFamily: fonts.medium, fontSize: 12 },
  inputWrap: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#343830', backgroundColor: '#0B0D0A', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  input: { flex: 1, minWidth: 0, color: '#F7F8F5', fontFamily: fonts.body, fontSize: 14, paddingVertical: 12 },
  loginButton: { minHeight: 52, borderRadius: 15, backgroundColor: LIME, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 2 },
  loginButtonText: { color: BG, fontFamily: fonts.medium, fontSize: 14 },
  signupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 22 },
  signupText: { color: '#A4A79F', fontFamily: fonts.body, fontSize: 13 },
  signupLink: { color: LIME, fontFamily: fonts.medium, fontSize: 13 },
  footnote: { color: '#666B62', fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: 28 },
};
