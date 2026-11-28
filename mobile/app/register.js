import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, EyeClosed } from 'lucide-react-native';
import { registerUser, clearError } from '../src/store/authSlice';
import { authApi } from '../src/api/client';
import { passwordError, PASSWORD_RULES } from '../src/utils/password';
import { DottedBackground, useAuthStyles } from '../src/components/native/AuthForm';

function Field({ label, value, onChangeText, password, ...props }) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.fieldGroup}><Text style={styles.label}>{label}</Text><View style={styles.passwordWrap}>
    <TextInput accessibilityLabel={label} style={[styles.input, password && styles.passwordInput]} value={value} onChangeText={onChangeText} secureTextEntry={password && !visible} autoCapitalize="none" autoCorrect={false} placeholderTextColor="#737373" {...props} />
    {password && <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={() => setVisible(!visible)} style={styles.eyeButton}>{visible ? <EyeClosed size={18} color="#999" /> : <Eye size={18} color="#999" />}</Pressable>}
  </View></View>;
}

export default function RegisterScreen() {
  const styles = useAuthStyles();
  const router = useRouter(), dispatch = useDispatch();
  const { loading, error } = useSelector(s => s.auth);
  const busy = useRef(false);
  const [checking, setChecking] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: '', password: '', fullName: '', username: '', city: '', phone: '', role: 'BUYER' });
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [problem, setProblem] = useState('');
  const update = key => value => { setForm(f => ({ ...f, [key]: value })); setProblem(''); dispatch(clearError()); };
  const accountError = () => !/^\S+@\S+\.\S+$/.test(form.email.trim()) ? 'Enter a valid email address.' : passwordError(form.password) || (form.password !== confirm ? 'Both passwords must match' : !terms ? 'Accept the Terms & Conditions to sign up.' : '');
  const profileError = () => form.fullName.trim().length < 2 ? 'Enter your full name.' : !/^[A-Za-z0-9._]{3,20}$/.test(form.username.trim()) ? 'Username must be 3–20 characters: letters, numbers, dots or underscores.' : '';
  const advance = async () => {
    if (busy.current || loading) return;
    setProblem(''); dispatch(clearError());
    const issue = step === 1 ? accountError() : profileError();
    if (issue) { setProblem(issue); return; }
    if (step === 1) { setStep(2); return; }
    busy.current = true; setChecking(true);
    try {
      if (step === 2) {
        const response = await authApi.usernameAvailable(form.username.trim());
        if (!response.data?.available) { setProblem('That username is unavailable. Try another.'); return; }
        setStep(3); return;
      }
      if (accountError()) { setProblem(accountError()); setStep(1); return; }
      const result = await dispatch(registerUser({ ...form, email: form.email.trim(), fullName: form.fullName.trim(), username: form.username.trim(), city: form.city.trim(), phone: form.phone.trim(), termsAccepted: terms }));
      if (registerUser.fulfilled.match(result)) router.replace(result.payload.verificationRequired ? { pathname: '/verify-code', params: { email: result.payload.email } } : '/(tabs)/feed');
    } catch (e) { setProblem(e.response?.data?.error || 'Could not check your username. Please try again.'); }
    finally { busy.current = false; setChecking(false); }
  };
  return <SafeAreaView style={styles.screen}><DottedBackground /><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.content}><Text style={styles.title}>Create your account</Text><Text style={styles.subtitle}>{step} of 3 · {['Account', 'Profile', 'Finish'][step - 1]}</Text>
        <View style={styles.card}>
          {!!(problem || error) && <Text accessibilityRole="alert" style={styles.errorText}>{problem || error}</Text>}
          {step === 1 && <>
            <Field label="Email" value={form.email} onChangeText={update('email')} keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
            <Field label="Password" value={form.password} onChangeText={update('password')} password autoComplete="new-password" />
            {PASSWORD_RULES.map(rule => <Text key={rule.id} style={[styles.label, { color: rule.test(form.password) ? '#CDFF00' : '#999' }]}>{rule.test(form.password) ? '✓' : '○'} {rule.label}</Text>)}
            <Field label="Confirm password" value={confirm} onChangeText={setConfirm} password autoComplete="new-password" />
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: terms }} onPress={() => setTerms(!terms)} style={{ paddingVertical: 12 }}><Text style={styles.label}>{terms ? '☑' : '☐'} I accept the Terms & Conditions and Privacy Policy.</Text></Pressable>
            <View style={{ flexDirection: 'row', gap: 18, marginBottom: 16 }}>{[['Terms & Conditions', 'terms'], ['Privacy Policy', 'privacy']].map(([label, path]) => <Pressable key={path} accessibilityRole="link" onPress={() => Linking.openURL('https://hustlespace.space/' + path).catch(() => setProblem('Could not open this page.'))}><Text style={styles.signupLink}>{label}</Text></Pressable>)}</View>
          </>}
          {step === 2 && <>
            <Field label="Full name" value={form.fullName} onChangeText={update('fullName')} autoCapitalize="words" autoComplete="name" />
            <Field label="Username" value={form.username} onChangeText={update('username')} maxLength={20} />
            <Field label="City (optional)" value={form.city} onChangeText={update('city')} autoCapitalize="words" />
            <Field label="Phone (optional)" value={form.phone} onChangeText={update('phone')} keyboardType="phone-pad" autoComplete="tel" />
          </>}
          {step === 3 && ['email', 'fullName', 'username', 'city', 'phone'].map(key => <View key={key} style={styles.fieldGroup}><Text style={styles.label}>{({ email: 'Email', fullName: 'Name', username: 'Username', city: 'City', phone: 'Phone' })[key]}</Text><Text style={{ color: '#FFF' }}>{form[key] || 'Not set'}</Text></View>)}
          {step > 1 && <Pressable disabled={checking || loading} onPress={() => { setStep(step - 1); setProblem(''); }} style={{ paddingVertical: 14 }}><Text style={styles.signupLink}>Back</Text></Pressable>}
          <Pressable accessibilityRole="button" disabled={checking || loading} onPress={advance} style={styles.loginButton}>{checking || loading ? <ActivityIndicator color="#050505" /> : <Text style={styles.loginButtonText}>{step === 3 ? 'Create account' : 'Continue'}</Text>}</Pressable>
          <Pressable onPress={() => { dispatch(clearError()); router.replace('/login'); }}><Text style={styles.signupText}>Already have an account? <Text style={styles.signupLink}>Log in</Text></Text></Pressable>
        </View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
