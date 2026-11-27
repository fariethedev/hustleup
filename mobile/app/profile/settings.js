import React, { useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, Share, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser, selectUser } from '../../src/store/authSlice';
import { authApi } from '../../src/api/client';
import PrivacyScreen from '../../src/components/PrivacyScreen';
import { Button, Copy, fonts, LIME, Screen, usePalette } from '../../src/components/native/Kit';
import { Group, Row } from '../../src/components/native/GroupedList';
import BrandLogo from '../../src/components/native/BrandLogo';
import { mediaUrl } from '../../src/utils/media';

const SITE = 'https://hustlespace.space';
const SUPPORT_EMAIL = 'support@hustlespace.space';
const VERSION = Constants.expoConfig?.version || '1.0.0';

const mail = (subject, body = '') =>
  Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
    .catch(() => Alert.alert('No email app', `Write to us at ${SUPPORT_EMAIL}.`));

// ── Full-screen sheet used by Help, Report and About ────────────────────────
function Sheet({ visible, onClose, title, children }) {
  const c = usePalette();
  if (!visible) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
              <Feather name="x" size={18} color={c.text} />
            </Pressable>
            <Copy heading style={{ flex: 1, fontSize: 18 }}>{title}</Copy>
          </View>
        </SafeAreaView>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
}

const FAQ = [
  ['How do I create a listing?', 'Open your Dashboard and tap “Add listing”, or use the + on the Home screen. Add photos, a price and a description, then publish.'],
  ['How does negotiating work?', 'On a listing marked negotiable, tap “Make an offer”. The seller can accept, decline or counter, and you will see every turn in your orders.'],
  ['How do I contact a seller?', 'Tap “Message” on any listing or profile to start a direct conversation.'],
  ['How do I get paid?', 'Set up payouts under Settings → Payments & payouts. Money from completed sales is sent to your bank after the holding period.'],
  ['Is my payment information safe?', 'Card payments are handled by Stripe. HustleSpace never sees or stores your full card details.'],
  ['How do I report a user or listing?', 'Use the ⋯ menu on the listing or profile and choose Report. Our team reviews every report.'],
];

function HelpSheet({ visible, onClose }) {
  const c = usePalette();
  const [open, setOpen] = useState(-1);
  return (
    <Sheet visible={visible} onClose={onClose} title="Help centre">
      <Group title="Frequently asked">
        {FAQ.map(([q, a], i) => (
          <Pressable key={q} accessibilityRole="button" accessibilityState={{ expanded: open === i }} onPress={() => setOpen(open === i ? -1 : i)} style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Copy style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14 }}>{q}</Copy>
              <Feather name={open === i ? 'minus' : 'plus'} size={16} color={c.purple} />
            </View>
            {open === i && <Copy muted style={{ fontSize: 13 }}>{a}</Copy>}
          </Pressable>
        ))}
      </Group>
      <Group title="Still stuck?">
        <Row icon="mail" label="Email support" subtitle={SUPPORT_EMAIL} onPress={() => mail('HustleSpace support')} />
        <Row icon="globe" label="Visit hustlespace.space" tone="purple" onPress={() => Linking.openURL(SITE)} />
      </Group>
    </Sheet>
  );
}

const REPORT_TYPES = [['Bug or crash', 'alert-triangle'], ['Listing issue', 'shopping-bag'], ['Payment issue', 'credit-card'], ['A user', 'user-x'], ['Idea', 'star'], ['Something else', 'help-circle']];

/** Reports go out as an email to support, so nothing is ever "submitted" into a void. */
function ReportSheet({ visible, onClose, user }) {
  const c = usePalette();
  const [type, setType] = useState('');
  const [text, setText] = useState('');
  const close = () => { setType(''); setText(''); onClose(); };
  const send = () => {
    if (!type || !text.trim()) { Alert.alert('Almost there', 'Pick what it is about and describe what happened.'); return; }
    mail(`[${type}] HustleSpace app report`, `${text.trim()}\n\n—\nAccount: ${user?.email || 'not signed in'}\nApp version: ${VERSION}`);
    close();
  };
  return (
    <Sheet visible={visible} onClose={close} title="Report a problem">
      <View style={{ gap: 10 }}>
        <Copy style={{ color: c.muted, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1, marginLeft: 6 }}>WHAT IS IT ABOUT?</Copy>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {REPORT_TYPES.map(([label, icon]) => {
            const on = type === label;
            return (
              <Pressable key={label} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setType(label)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, height: 40, borderRadius: 20, backgroundColor: on ? LIME : c.card, borderWidth: 1, borderColor: on ? LIME : c.line }}>
                <Feather name={icon} size={14} color={on ? '#111' : c.muted} />
                <Copy style={{ fontSize: 12.5, fontFamily: fonts.medium, color: on ? '#111' : c.text }}>{label}</Copy>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Copy style={{ color: c.muted, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1, marginLeft: 6 }}>WHAT HAPPENED?</Copy>
        <TextInput
          value={text} onChangeText={setText} multiline
          placeholder="What you did, what you expected, and what happened instead."
          placeholderTextColor={c.muted}
          style={{ minHeight: 140, textAlignVertical: 'top', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.text, fontFamily: fonts.body, fontSize: 14 }}
        />
        <Copy muted style={{ fontSize: 11.5, marginHorizontal: 6 }}>This opens your email app with the report filled in, addressed to {SUPPORT_EMAIL}.</Copy>
      </View>
      <Button icon="send" onPress={send}>Send report</Button>
    </Sheet>
  );
}

function AboutSheet({ visible, onClose }) {
  const c = usePalette();
  return (
    <Sheet visible={visible} onClose={onClose} title="About">
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
        <BrandLogo size={64} glow />
        <Copy heading style={{ fontSize: 22 }}>Hustle<Copy heading style={{ fontSize: 22, color: c.accent }}>Space</Copy></Copy>
        <Copy muted style={{ fontSize: 12.5 }}>Version {VERSION}</Copy>
        <Copy muted style={{ fontSize: 13.5, textAlign: 'center', marginTop: 6 }}>Find work, sell, swap and connect with people near you — all in one place.</Copy>
      </View>
      <Group title="Legal">
        <Row icon="file-text" label="Terms of service" onPress={() => Linking.openURL(`${SITE}/terms`)} />
        <Row icon="shield" label="Privacy policy" tone="purple" onPress={() => Linking.openURL(`${SITE}/privacy`)} />
      </Group>
      <Copy muted style={{ textAlign: 'center', fontSize: 11.5 }}>© {new Date().getFullYear()} HustleSpace · Made in Poland</Copy>
    </Sheet>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const c = usePalette();
  const [sheet, setSheet] = useState(null);
  const avatar = user?.avatarUrl ? mediaUrl(user.avatarUrl) : null;
  const initial = (user?.fullName || user?.username || 'U').trim()[0]?.toUpperCase();

  const resetPassword = () => {
    if (!user?.email) return;
    Alert.alert('Reset your password?', `We'll email a secure reset link to ${user.email}. It expires in one hour.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send link', onPress: async () => {
        try {
          await authApi.forgotPassword(user.email);
          Alert.alert('Check your inbox', `A reset link is on its way to ${user.email}.`);
        } catch {
          Alert.alert('Could not send', 'Please check your connection and try again.');
        }
      } },
    ]);
  };

  const logOut = () => Alert.alert('Log out?', 'You can sign back in any time.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: async () => { await dispatch(logoutUser()); router.replace('/login'); } },
  ]);

  // There is no self-serve deletion endpoint, so the request goes to support, who confirm it.
  const deleteAccount = () => Alert.alert(
    'Delete your account?',
    'Deleting is permanent: your profile, listings, messages and history are removed. We confirm deletion requests by email so nobody can delete your account but you.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Request deletion', style: 'destructive', onPress: () => mail('Account deletion request', `Please delete my HustleSpace account.\n\nAccount email: ${user?.email || ''}`) },
    ],
  );

  return (
    <Screen back title="Settings">
      {/* Profile */}
      <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => router.push('/profile/edit')}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, opacity: pressed ? 0.85 : 1 })}>
        {avatar
          ? <Image source={{ uri: avatar }} style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: LIME }} />
          : <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}><Copy heading style={{ fontSize: 22, color: '#111' }}>{initial}</Copy></View>}
        <View style={{ flex: 1, gap: 1 }}>
          <Copy heading style={{ fontSize: 17 }} numberOfLines={1}>{user?.fullName || 'Your profile'}</Copy>
          {!!user?.username && <Copy style={{ color: c.purple, fontSize: 12.5, fontFamily: fonts.medium }} numberOfLines={1}>@{user.username}</Copy>}
          {!!user?.email && <Copy muted style={{ fontSize: 12 }} numberOfLines={1}>{user.email}</Copy>}
        </View>
        <View style={{ paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
          <Copy style={{ fontSize: 12, fontFamily: fonts.medium }}>Edit</Copy>
        </View>
      </Pressable>

      <Group title="Account">
        <Row icon="user" label="Edit profile" subtitle="Name, photo, bio and city" onPress={() => router.push('/profile/edit')} />
        <Row icon="lock" label="Privacy" subtitle="Who can see you and message you" tone="purple" onPress={() => setSheet('privacy')} />
        <Row icon="credit-card" label="Payments & payouts" subtitle="Where your earnings are sent" onPress={() => router.push('/profile/bank')} />
        <Row icon="briefcase" label="Wallet" tone="purple" onPress={() => router.push('/profile/wallet')} />
      </Group>

      <Group title="Security">
        <Row icon="key" label="Reset password" subtitle="Get a secure reset link by email" onPress={resetPassword} />
      </Group>

      <Group title="Preferences" footer="Notification sounds and alerts are controlled in your phone's settings, and the app follows your phone's light or dark mode.">
        <Row icon="bell" label="Notifications" subtitle="Open your phone's settings for HustleSpace" onPress={() => Linking.openSettings()} />
        <Row icon={c.light ? 'sun' : 'moon'} label="Appearance" value={c.light ? 'Light' : 'Dark'} tone="purple" chevron={false} />
      </Group>

      <Group title="Support">
        <Row icon="help-circle" label="Help centre" subtitle="Answers and contact" onPress={() => setSheet('help')} />
        <Row icon="flag" label="Report a problem" tone="purple" onPress={() => setSheet('report')} />
        <Row icon="share-2" label="Invite friends" onPress={() => Share.share({ message: `Join me on HustleSpace — find work, sell and connect locally. ${SITE}` })} />
        <Row icon="info" label="About HustleSpace" value={`v${VERSION}`} tone="purple" onPress={() => setSheet('about')} />
      </Group>

      <View style={{ gap: 6, marginTop: 4 }}>
        <Pressable accessibilityRole="button" onPress={logOut}
          style={({ pressed }) => ({ height: 52, borderRadius: 18, borderWidth: 1, borderColor: '#EF444466', backgroundColor: pressed ? '#EF44441F' : '#EF444412', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 })}>
          <Feather name="log-out" size={17} color="#EF4444" />
          <Copy style={{ color: '#EF4444', fontFamily: fonts.medium, fontSize: 14 }}>Log out</Copy>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={deleteAccount} style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
          <Copy muted style={{ fontSize: 12.5, textDecorationLine: 'underline' }}>Delete account</Copy>
        </Pressable>
      </View>

      <PrivacyScreen visible={sheet === 'privacy'} onClose={() => setSheet(null)} />
      <HelpSheet visible={sheet === 'help'} onClose={() => setSheet(null)} />
      <ReportSheet visible={sheet === 'report'} onClose={() => setSheet(null)} user={user} />
      <AboutSheet visible={sheet === 'about'} onClose={() => setSheet(null)} />
    </Screen>
  );
}
