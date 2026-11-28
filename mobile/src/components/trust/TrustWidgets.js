import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Feather } from '../native/Icon';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { claimsApi, trustApi } from '../../api/client';
import { Button, Copy, fonts, LIME, usePalette } from '../native/Kit';

const errorText = (e, fallback) => e?.response?.data?.error || e?.response?.data?.message || fallback;

const REASONS = [
  ['SCAM', 'Scam or fraud'],
  ['COUNTERFEIT', 'Counterfeit or replica'],
  ['PROHIBITED_ITEM', 'Prohibited or illegal item'],
  ['MISLEADING', 'Misleading description or photos'],
  ['OFF_PLATFORM_PAYMENT', 'Asked to pay outside HustleSpace'],
  ['NOT_RECEIVED_PATTERN', 'Seller does not deliver'],
  ['OFFENSIVE', 'Offensive content'],
  ['OTHER', 'Something else'],
];

/** Full-screen sheet with a close button, used by the report and claim dialogs. */
function Sheet({ visible, title, onClose, children }) {
  const c = usePalette();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
              <Feather name="x" size={18} color={c.text} />
            </Pressable>
            <Copy heading style={{ flex: 1, fontSize: 18 }}>{title}</Copy>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

/** A small "Report" control that opens the report sheet for a listing, shop or seller. */
export function ReportButton({ targetType, targetId, children }) {
  const c = usePalette();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('SCAM');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const { data } = await trustApi.report(targetType, targetId, reason, detail.trim());
      setOpen(false); setDetail('');
      Alert.alert('Report sent', data?.message || 'Thanks — our team will review this and tell you the outcome.');
    } catch (e) {
      Alert.alert('Could not send', errorText(e, 'Please try again.'));
    } finally { setBusy(false); }
  };
  return (
    <>
      {children ? children(() => setOpen(true)) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Report" onPress={() => setOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8 }}>
          <Feather name="flag" size={14} color={c.muted} />
          <Copy muted style={{ fontSize: 12.5 }}>Report {targetType === 'LISTING' ? 'this listing' : targetType === 'SHOP' ? 'this shop' : 'this seller'}</Copy>
        </Pressable>
      )}
      <Sheet visible={open} title="Report" onClose={() => !busy && setOpen(false)}>
        <View style={{ gap: 8 }}>
          {REASONS.map(([value, label]) => {
            const on = reason === value;
            return (
              <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setReason(value)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: on ? LIME : c.line, backgroundColor: on ? (c.light ? '#52640012' : '#CDFF0012') : c.card }}>
                <Feather name={on ? 'check-circle' : 'circle'} size={18} color={on ? c.accent : c.muted} />
                <Copy style={{ fontSize: 14 }}>{label}</Copy>
              </Pressable>
            );
          })}
        </View>
        <TextInput value={detail} onChangeText={setDetail} multiline maxLength={2000} placeholder="Anything that helps us check (optional)" placeholderTextColor={c.muted}
          style={{ minHeight: 100, textAlignVertical: 'top', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.text, fontFamily: fonts.body, fontSize: 14 }} />
        <Copy muted style={{ fontSize: 12 }}>Reports are confidential. We will tell you what we decided.</Copy>
        <Button icon="send" busy={busy} onPress={send}>Send report</Button>
      </Sheet>
    </>
  );
}

/** Business or private seller, and what that means for the buyer's rights (DSA / Omnibus). */
export function TraderNotice({ sellerId }) {
  const c = usePalette();
  const [t, setT] = useState(null);
  useEffect(() => {
    if (!sellerId) return;
    trustApi.trader(sellerId).then(r => setT(r.data)).catch(() => setT(null));
  }, [sellerId]);
  if (!t) return null;
  const business = t.sellerType === 'BUSINESS';
  const details = [t.businessName, t.registrationNo && `Reg. ${t.registrationNo}`, t.vatNumber && `VAT ${t.vatNumber}`, t.address, t.contactEmail].filter(Boolean).join(' · ');
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
      <Feather name={business ? 'briefcase' : 'user'} size={17} color={business ? c.accent : c.muted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Copy style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.6 }}>{business ? 'BUSINESS SELLER' : 'PRIVATE SELLER'}</Copy>
        {business && !!details && <Copy style={{ fontSize: 12 }}>{details}</Copy>}
        <Copy muted style={{ fontSize: 12 }}>{t.consumerRights}</Copy>
      </View>
    </View>
  );
}

/** Seller's response before a decision, and one appeal per side after it. */
export function ClaimActions({ claim: initial, colors }) {
  const me = useSelector(s => s.auth.user);
  const c = usePalette();
  // A response or appeal returns the updated claim; show that until the parent reloads.
  const [updated, setClaim] = useState(null);
  const claim = updated && updated.id === initial?.id ? updated : initial;
  const [now] = useState(() => Date.now());
  const [mode, setMode] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (!claim || !me?.id) return null;
  const isSeller = claim.sellerId === me.id;
  const decided = ['REFUNDED', 'PARTIALLY_REFUNDED', 'REJECTED'].includes(claim.status);
  const appealOpen = decided && !claim.appealedAt && claim.resolvedAt && now - new Date(claim.resolvedAt).getTime() < 7 * 86400000;
  const canRespond = isSeller && claim.status === 'OPEN' && !claim.sellerResponse;
  const accent = colors?.accent || c.accent;

  const send = async () => {
    setBusy(true);
    try {
      const { data } = mode === 'respond' ? await claimsApi.respond(claim.id, text.trim()) : await claimsApi.appeal(claim.id, text.trim());
      setClaim(data); setMode(null); setText('');
      Alert.alert(mode === 'respond' ? 'Response sent' : 'Appeal sent', mode === 'respond' ? 'Our team now has both sides.' : 'A different team member will review it.');
    } catch (e) { Alert.alert('Could not send', errorText(e, 'Please try again.')); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 6 }}>
      {canRespond && !!claim.respondBy && <Copy style={{ color: '#F59E0B', fontSize: 12.5 }}>A buyer reported a problem. {`Respond by ${new Date(claim.respondBy).toLocaleDateString()} — after that we decide on the buyer’s evidence.`}</Copy>}
      {!!claim.sellerResponse && <Copy muted style={{ fontSize: 12.5 }}>{`Seller’s response: ${claim.sellerResponse}`}</Copy>}
      {claim.status === 'APPEALED' && <Copy style={{ color: '#F59E0B', fontSize: 12.5 }}>Appeal under review by a different team member.</Copy>}
      {!!claim.appealNote && <Copy muted style={{ fontSize: 12.5 }}>Appeal decision (final): {claim.appealNote}</Copy>}
      {(canRespond || appealOpen) && (
        <Pressable accessibilityRole="button" onPress={() => setMode(canRespond ? 'respond' : 'appeal')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 14, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: accent }}>
          <Feather name="message-square" size={15} color={accent} />
          <Copy style={{ color: accent, fontFamily: fonts.medium, fontSize: 13 }}>{canRespond ? 'Respond to claim' : 'Appeal decision'}</Copy>
        </Pressable>
      )}
      <Sheet visible={!!mode} title={mode === 'respond' ? 'Respond to the claim' : 'Appeal the decision'} onClose={() => !busy && setMode(null)}>
        <Copy muted>{mode === 'respond'
          ? 'Explain what you sent and when, the tracking number, and anything you agreed with the buyer. Our team reads both sides before deciding.'
          : 'Explain what the decision got wrong and add any new information. You can appeal once, and the appeal decision is final within HustleSpace.'}</Copy>
        <TextInput value={text} onChangeText={setText} multiline maxLength={2000} placeholder="At least 10 characters" placeholderTextColor={c.muted}
          style={{ minHeight: 140, textAlignVertical: 'top', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.text, fontFamily: fonts.body, fontSize: 14 }} />
        <Button icon="send" busy={busy} disabled={text.trim().length < 10} onPress={send}>Send</Button>
      </Sheet>
    </View>
  );
}

/** Warning under chat messages that try to take payment or contact off HustleSpace. */
export function SafetyNotice({ flag, mine }) {
  if (!flag) return null;
  const payment = flag === 'OFF_PLATFORM_PAYMENT';
  const text = mine
    ? 'Keep payment in HustleSpace — deals paid outside the app have no buyer protection.'
    : payment
      ? 'Careful: paying outside HustleSpace (BLIK, bank transfer, PayPal, crypto) has no buyer protection and is how most scams work.'
      : 'Careful: moving the chat elsewhere removes HustleSpace protection. Never pay or share codes outside the app.';
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, padding: 8, borderRadius: 10, backgroundColor: '#F59E0B22', borderWidth: 1, borderColor: '#F59E0B55' }}>
      <Feather name="alert-triangle" size={13} color="#F59E0B" style={{ marginTop: 1 }} />
      <Copy style={{ flex: 1, color: '#F59E0B', fontSize: 11.5, lineHeight: 16 }}>{text}</Copy>
    </View>
  );
}
