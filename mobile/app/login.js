import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, clearError } from '../src/store/authSlice';
import { fonts } from '../src/components/native/Kit';
import BrandLogo from '../src/components/native/BrandLogo';

const BG = '#050605';
const LIME = '#CDFF00';
const TEXT = '#F7F8F5';
const MUTED = '#9CA096';

/** Input with an icon, a lime focus ring and an optional trailing control. */
function Field({ icon, label, focused, onFocus, onBlur, trailing, inputRef, ...input }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrap, focused && s.inputFocused]}>
        <Feather name={icon} size={18} color={focused ? LIME : '#7D827A'} />
        <TextInput
          ref={inputRef}
          {...input}
          accessibilityLabel={label}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholderTextColor="#62665F"
          selectionColor={LIME}
          style={s.input}
        />
        {trailing}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);
  const { height } = useWindowDimensions();
  const [localError, setLocalError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focus, setFocus] = useState('');
  const passwordRef = useRef(null);

  // Entrance: logo drops in, card rises — subtle, under half a second.
  const [enter] = useState(() => new Animated.Value(0));
  const [shake] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  const message = localError || error;
  useEffect(() => {
    if (!message) return;
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch { /* optional */ }
    shake.setValue(0);
    Animated.sequence([10, -10, 7, -7, 0].map(x => Animated.timing(shake, { toValue: x, duration: 55, useNativeDriver: true }))).start();
  }, [message, shake]);

  const canSubmit = !!email.trim() && !!password && !loading;
  const handleLogin = async () => {
    if (!canSubmit) return;
    setLocalError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setLocalError('Enter a valid email address.'); return; }
    dispatch(clearError());
    const result = await dispatch(loginUser({ email: email.trim(), password }));
    if (loginUser.fulfilled.match(result)) router.replace(returnTo === '/bond' ? '/bond' : '/(tabs)/feed');
  };

  const rise = (distance) => ({
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  });

  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      {/* Ambient brand glow behind everything */}
      <LinearGradient colors={['rgba(205,255,0,0.20)', 'rgba(205,255,0,0)']} style={[s.glow, { top: -height * 0.18 }]} />
      <LinearGradient colors={['rgba(205,255,0,0)', 'rgba(205,255,0,0.07)']} style={[s.glow, { bottom: -height * 0.25, left: -120 }]} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.content}>
              <Animated.View style={[s.hero, rise(-16)]}>
                <BrandLogo size={76} glow />
                <Text style={s.wordmark}>Hustle<Text style={{ color: LIME }}>Space</Text></Text>
                <Text style={s.title}>Welcome back</Text>
                <Text style={s.subtitle}>Sign in to your community, your shop and your chats.</Text>
              </Animated.View>

              <Animated.View style={[s.card, rise(28), { transform: [...rise(28).transform, { translateX: shake }] }]}>
                {message ? (
                  <View style={s.errorBox}>
                    <Feather name="alert-circle" size={17} color="#FF8A8A" />
                    <Text accessibilityRole="alert" style={s.errorText}>{message}</Text>
                  </View>
                ) : null}

                <Field
                  icon="mail" label="Email" value={email} onChangeText={setEmail}
                  placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none"
                  autoCorrect={false} autoComplete="email" textContentType="username" returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()} submitBehavior="submit"
                  focused={focus === 'email'} onFocus={() => setFocus('email')} onBlur={() => setFocus('')}
                />

                <View style={{ gap: 8 }}>
                  <Field
                    inputRef={passwordRef}
                    icon="lock" label="Password" value={password} onChangeText={setPassword}
                    placeholder="Your password" secureTextEntry={!showPassword} autoCapitalize="none"
                    autoCorrect={false} autoComplete="password" textContentType="password" returnKeyType="go"
                    onSubmitEditing={handleLogin}
                    focused={focus === 'password'} onFocus={() => setFocus('password')} onBlur={() => setFocus('')}
                    trailing={
                      <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(v => !v)} hitSlop={10}>
                        <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#A7AAA4" />
                      </Pressable>
                    }
                  />
                  <Pressable accessibilityRole="link" onPress={() => router.push('/forgot-password')} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
                    <Text style={s.forgot}>Forgot password?</Text>
                  </Pressable>
                </View>

                <Pressable
                  accessibilityRole="button" accessibilityLabel="Log in" accessibilityState={{ disabled: !canSubmit, busy: loading }}
                  onPress={handleLogin} disabled={!canSubmit}
                  style={({ pressed }) => [s.primary, !canSubmit && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.98 }] }]}
                >
                  {loading ? <ActivityIndicator color={BG} /> : <><Text style={s.primaryText}>Log in</Text><Feather name="arrow-right" size={19} color={BG} /></>}
                </Pressable>

                <View style={s.divider}><View style={s.dividerLine} /><Text style={s.dividerText}>New here?</Text><View style={s.dividerLine} /></View>

                <Pressable accessibilityRole="button" onPress={() => router.push('/register')} style={({ pressed }) => [s.secondary, pressed && { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
                  <Feather name="user-plus" size={17} color={TEXT} />
                  <Text style={s.secondaryText}>Create a free account</Text>
                </Pressable>
              </Animated.View>

              <Animated.View style={[s.perks, rise(36)]}>
                {[['shopping-bag', 'Buy & sell'], ['message-circle', 'Chat'], ['heart', 'Bond']].map(([icon, label]) => (
                  <View key={label} style={s.perk}><Feather name={icon} size={14} color={LIME} /><Text style={s.perkText}>{label}</Text></View>
                ))}
              </Animated.View>
              <Text style={s.footnote}>Free to join. Payments are secured by Stripe.</Text>
              <Pressable accessibilityRole="link" onPress={() => router.push('/welcome')} hitSlop={8} style={{ alignSelf: 'center', marginTop: 10, minHeight: 36, justifyContent: 'center' }}>
                <Text style={[s.forgot, { color: '#A78BFA' }]}>New to HustleSpace? See how it works</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = {
  screen: { flex: 1, backgroundColor: BG },
  glow: { position: 'absolute', alignSelf: 'center', width: 520, height: 520, borderRadius: 260 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 28 },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  hero: { alignItems: 'center', marginBottom: 26 },
  wordmark: { color: TEXT, fontFamily: fonts.heading, fontSize: 17, marginTop: 14, letterSpacing: -0.2 },
  title: { color: TEXT, fontFamily: fonts.heading, fontSize: 32, marginTop: 22, letterSpacing: -0.6, textAlign: 'center' },
  subtitle: { color: MUTED, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginTop: 6, textAlign: 'center', maxWidth: 300 },
  card: {
    backgroundColor: 'rgba(17,19,16,0.86)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 28,
    padding: 20, gap: 18,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 10,
  },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,75,75,0.10)', borderWidth: 1, borderColor: 'rgba(255,90,90,0.28)' },
  errorText: { color: '#FFB1B1', fontFamily: fonts.body, fontSize: 13, flex: 1 },
  label: { color: '#DADDD5', fontFamily: fonts.medium, fontSize: 12.5, letterSpacing: 0.2 },
  inputWrap: {
    minHeight: 56, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  inputFocused: { borderColor: LIME, backgroundColor: 'rgba(205,255,0,0.05)' },
  input: { flex: 1, minWidth: 0, color: TEXT, fontFamily: fonts.body, fontSize: 15.5, paddingVertical: 14 },
  forgot: { color: LIME, fontFamily: fonts.medium, fontSize: 12.5 },
  primary: {
    minHeight: 56, borderRadius: 18, backgroundColor: LIME, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: LIME, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  primaryText: { color: BG, fontFamily: fonts.heading, fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { color: '#71756D', fontFamily: fonts.body, fontSize: 12 },
  secondary: { minHeight: 54, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  secondaryText: { color: TEXT, fontFamily: fonts.medium, fontSize: 14.5 },
  perks: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 24 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(205,255,0,0.07)', borderWidth: 1, borderColor: 'rgba(205,255,0,0.16)' },
  perkText: { color: '#D9DDD2', fontFamily: fonts.medium, fontSize: 12 },
  footnote: { color: '#5F635B', fontFamily: fonts.body, fontSize: 11.5, textAlign: 'center', marginTop: 16 },
};
