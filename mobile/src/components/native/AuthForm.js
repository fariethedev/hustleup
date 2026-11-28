import { StyleSheet } from 'react-native';
import { useSocialStyles } from './socialStyles';

const LIME = '#CDFF00';
const BG = '#050505';

export function DottedBackground() { return null; }
export const useAuthStyles = () => useSocialStyles(styles);

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG }, flex: { flex: 1 },
  dimmer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,5,5,0.64)' },
  dot: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(211,255,55,0.13)' },
  scroll: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 46, paddingBottom: 42 },
  content: { width: '100%', maxWidth: 430, alignSelf: 'center' },
  title: { color: '#FFF', fontSize: 27, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: '#9A9A9A', fontSize: 17, textAlign: 'center', marginTop: 6, marginBottom: 22 },
  card: { backgroundColor: 'rgba(0,0,0,0.66)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 24, padding: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginBottom: 16, borderRadius: 12, backgroundColor: 'rgba(255,75,75,0.1)', borderWidth: 1, borderColor: 'rgba(255,75,75,0.2)' },
  errorText: { flex: 1, color: '#FF8A8A', fontSize: 16, textAlign: 'center' },
  fieldGroup: { marginBottom: 16 }, passwordHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  label: { color: '#D6D6D6', fontSize: 16, fontWeight: '700', marginBottom: 7 }, forgot: { color: LIME, fontSize: 12, fontWeight: '700' },
  input: { width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', color: '#FFF', fontSize: 17, paddingHorizontal: 15, paddingVertical: 13 },
  passwordWrap: { position: 'relative' }, passwordInput: { paddingRight: 46 }, eyeButton: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', minWidth: 48, alignItems: 'center' },
  loginButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: LIME, borderRadius: 12, marginTop: 2 }, disabled: { opacity: 0.5 }, loginButtonText: { color: BG, fontSize: 17, fontWeight: '900' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 }, dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }, dividerText: { color: '#737373', fontSize: 11 },
  socialRow: { flexDirection: 'row', gap: 10 }, socialButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  signupText: { color: '#9A9A9A', fontSize: 16, textAlign: 'center', marginTop: 20 }, signupLink: { color: LIME, fontWeight: '800' },
});
