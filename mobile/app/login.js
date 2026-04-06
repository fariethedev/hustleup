import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Image, Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons, FontAwesome, AntDesign } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { loginUser, clearError } from '../src/store/authSlice';

const { width, height } = Dimensions.get('window');
const LIME = '#CDFF00';

const AVATARS = [
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&q=80',
];

export default function LoginScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { loading, error } = useSelector((s) => s.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const handleLogin = async () => {
    dispatch(clearError());
    const result = await dispatch(loginUser({ email, password }));
    if (loginUser.fulfilled.match(result)) {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      
      {/* Cinematic Background Mosaic */}
      <View style={styles.backgroundContainer}>
          <View style={styles.mosaicRow}>
             {AVATARS.slice(0, 3).map((uri, i) => (
               <View key={i} style={[styles.avatarCard, { transform: [{ rotate: i % 2 === 0 ? '-4deg' : '4deg' }] }]}>
                  <Image source={{ uri }} style={styles.avatarImg} />
               </View>
             ))}
          </View>
          <View style={[styles.mosaicRow, { marginTop: -20 }]}>
             {AVATARS.slice(3, 6).map((uri, i) => (
               <View key={i} style={[styles.avatarCard, { transform: [{ rotate: i % 2 === 0 ? '6deg' : '-6deg' }] }]}>
                  <Image source={{ uri }} style={styles.avatarImg} />
               </View>
             ))}
          </View>
          <LinearGradient colors={['transparent', 'rgba(5,5,5,0.7)', '#050505']} style={styles.backgroundOverlay} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
             
             {/* Brand Sparkle */}
             <View style={styles.sparkleContainer}>
                <View style={styles.sparkleBg}>
                   <MaterialCommunityIcons name="shimmer" size={24} color="#050505" />
                </View>
             </View>

             <Text style={styles.headline}>Access Syndicate</Text>
             <Text style={styles.subheadline}>Enter the elite marketplace and join the global hustle ecosystem.</Text>

             <View style={styles.formContainer}>
                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.field}>
                   <TextInput
                     style={styles.input}
                     value={email}
                     onChangeText={setEmail}
                     placeholder="Enter your email"
                     placeholderTextColor="rgba(255,255,255,0.4)"
                     keyboardType="email-address"
                     autoCapitalize="none"
                   />
                </View>

                <View style={styles.field}>
                   <View style={styles.inputWrapper}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Your password"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        secureTextEntry={!showPw}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(!showPw)}>
                         <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color="rgba(255,255,255,0.3)" />
                      </TouchableOpacity>
                   </View>
                </View>

                <TouchableOpacity
                  style={[styles.mainBtn, (!email || !password || loading) && styles.btnDisabled]}
                  onPress={handleLogin}
                  disabled={!email || !password || loading}
                  activeOpacity={0.9}
                >
                  <View style={styles.btnContent}>
                     {loading ? (
                       <ActivityIndicator color="#050505" />
                     ) : (
                       <>
                         <Text style={styles.mainBtnText}>Sign into Account</Text>
                         <Feather name="chevron-right" size={18} color="#050505" />
                       </>
                     )}
                  </View>
                </TouchableOpacity>

                <View style={styles.divider}>
                   <View style={styles.dividerLine} />
                   <Text style={styles.dividerText}>OR LOGIN WITH</Text>
                   <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialRow}>
                   <TouchableOpacity style={styles.socialBtn}>
                      <AntDesign name="apple1" size={20} color="#FFF" />
                   </TouchableOpacity>
                   <TouchableOpacity style={styles.socialBtn}>
                      <FontAwesome name="google" size={20} color="#FFF" />
                   </TouchableOpacity>
                   <TouchableOpacity style={styles.socialBtn}>
                      <FontAwesome name="facebook" size={20} color="#FFF" />
                   </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                   <Text style={styles.footerInfo}>
                      By continuing, you agree to the Syndicate{' '}
                      <Text style={styles.linkText}>Terms</Text> and{' '}
                      <Text style={styles.linkText}>Privacy Policy</Text>
                   </Text>
                   
                   <TouchableOpacity 
                     style={styles.switchMode}
                     onPress={() => router.push('/register')}
                   >
                      <Text style={styles.switchText}>Need an access key? <Text style={{ color: LIME }}>Join Now</Text></Text>
                   </TouchableOpacity>
                </View>
             </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505' },
  scroll: { flexGrow: 1 },
  backgroundContainer: {
    paddingTop: 60,
    height: 380,
    width: '100%',
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    overflow: 'hidden',
  },
  mosaicRow: {
    flexDirection: 'row',
    gap: 15,
  },
  avatarCard: {
    width: width * 0.35,
    height: 180,
    borderRadius: 20,
    backgroundColor: '#111',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarImg: { width: '100%', height: '100%', opacity: 0.8 },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    paddingTop: 340,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  sparkleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sparkleBg: {
    width: 48,
    height: 48,
    backgroundColor: LIME,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: LIME,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  headline: {
    color: '#FFF',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
  },
  subheadline: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  formContainer: {
    marginTop: 40,
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', fontWeight: '700' },
  field: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  eyeBtn: {
    paddingHorizontal: 15,
  },
  mainBtn: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginTop: 10,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  mainBtnText: {
    color: '#050505',
    fontWeight: '900',
    fontSize: 15,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 9,
    fontWeight: '900',
    marginHorizontal: 15,
    letterSpacing: 2,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 15,
    justifyContent: 'center',
  },
  socialBtn: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerInfo: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  linkText: {
    color: '#FFF',
    fontWeight: '800',
  },
  switchMode: {
    marginTop: 25,
  },
  switchText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '700',
  },
});
