import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { authApi, feedApi, listingsApi } from '../../api/client';
import ListingTypeFields, { TYPE_COPY, defaultExtra, toSubmission, validateExtra } from './ListingTypeFields';
import { LISTING_CATEGORIES, categoryLabel, errorMessage } from '../../utils/marketplace';
import { pickCroppedPhoto, uploadAsset } from '../../utils/media';

import { usePalette } from '../native/Kit';

const LIME = '#CDFF00';
const PURPLE = '#8B5CF6';
const SELLER_CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP', 'ZAR', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'CZK', 'HUF', 'JPY'];
const blank = { title: '', description: '', price: '', currency: 'PLN', city: '', listingType: '', negotiable: false, swapEnabled: false, agentFee: false, agentFeeAmount: '' };

export default function CreateListingModal({ visible, onClose, onCreated }) {
  const colors = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const scroll = useRef(null);
  const s = { ...baseStyles,
    screen: [baseStyles.screen, { backgroundColor: colors.bg }],
    heading: [baseStyles.heading, { color: colors.text }],
    label: [baseStyles.label, { color: colors.text }],
    muted: [baseStyles.muted, { color: colors.muted }],
    text: [baseStyles.text, { color: colors.text }],
    categoryText: [baseStyles.categoryText, { color: colors.text }],
    category: [baseStyles.category, { backgroundColor: colors.card, borderColor: colors.line, width: '48%', flexDirection: 'column', justifyContent: 'center', paddingVertical: 16 }],
    input: [baseStyles.input, { backgroundColor: colors.light ? '#FBFAFF' : '#111018', borderColor: colors.light ? '#DDD6FE' : '#382A4C', color: colors.text }],
    selection: [baseStyles.selection, { color: PURPLE }],
    fieldLabel: [baseStyles.fieldLabel, { color: colors.light ? '#6D28D9' : '#C4B5FD' }],
    currencySelect: [baseStyles.currencySelect, { backgroundColor: colors.light ? '#FBFAFF' : '#111018', borderColor: currencyOpen ? PURPLE : (colors.light ? '#DDD6FE' : '#382A4C') }],
    currencyMenu: [baseStyles.currencyMenu, { backgroundColor: colors.light ? '#FFFFFF' : '#17141F', borderColor: colors.light ? '#DDD6FE' : '#382A4C' }],
  };
  const move = value => { setStep(value); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const [draft, setDraft] = useState(blank);
  const [images, setImages] = useState([]);
  const [extra, setExtra] = useState({});
  const [shareToFeed, setShareToFeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const submitting = useRef(false);
  const field = (name, value) => setDraft(old => ({ ...old, [name]: value }));
  const close = () => {
    if (submitting.current || picking) return;
    if (draft.title || draft.description || draft.price || draft.city || draft.listingType || images.length) {
      Alert.alert('Discard listing?', 'Your draft has not been published.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { setDraft(blank); setImages([]); setExtra({}); setStep(0); onClose(); } },
      ]);
    } else onClose();
  };
  const pick = async () => {
    if (picking || busy) return;
    setPicking(true);
    try {
      const image = await pickCroppedPhoto([1, 1]);
      if (image) setImages(old => [...old, image].slice(0, 6));
    } catch (error) { Alert.alert('Could not add photo', error.message); }
    finally { setPicking(false); }
  };
  const submit = async () => {
    if (submitting.current || picking) return;
    if (!draft.listingType) return Alert.alert('Choose a category', 'Select the category that best describes your listing.');
    if (!draft.title.trim()) return Alert.alert('Add a title', 'Give your listing a short, clear title.');
    const tailored = validateExtra(draft.listingType, extra);
    if (step >= 1 && tailored) return Alert.alert('A few more details', tailored);
    const submission = toSubmission(draft.listingType, extra);
    const price = submission.price ?? draft.price.trim().replace(',', '.');
    if (step >= 1 && !/^\d+(\.\d{1,2})?$/.test(price)) return Alert.alert('Check the price', `Enter a price in ${draft.currency}, with up to two decimal places. Use 0 for free.`);
    if (!Number.isFinite(Number(price))) return Alert.alert('Check the price', 'Enter a valid amount.');
    const agentFeeAmount = draft.agentFeeAmount.trim().replace(',', '.');
    if (draft.listingType === 'RENTAL' && draft.agentFee && (!/^\d+(\.\d{1,2})?$/.test(agentFeeAmount) || !Number.isFinite(Number(agentFeeAmount)))) return Alert.alert('Check the agent fee', `Enter the agent fee in ${draft.currency}, with up to two decimal places.`);
    if (step < 2) { move(2); return; }
    submitting.current = true;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('title', draft.title.trim());
      form.append('description', draft.description.trim());
      form.append('listingType', draft.listingType);
      form.append('price', price);
      form.append('currency', draft.currency);
      form.append('city', draft.city.trim());
      form.append('negotiable', String(draft.negotiable));
      form.append('swapEnabled', String(!!draft.swapEnabled));
      if (draft.listingType === 'RENTAL') form.append('agentFeeAmount', draft.agentFee ? agentFeeAmount : '0');
      Object.entries(submission.fields).forEach(([key, value]) => form.append(key, String(value)));
      if (Object.keys(submission.meta).length) form.append('meta', JSON.stringify(submission.meta));
      images.forEach(image => form.append('images', uploadAsset(image)));
      const { data } = await listingsApi.create(form);
      if (shareToFeed && data?.id) {
        // Announce it on the feed with the listing attached; a failure here must not undo the listing.
        const post = new FormData();
        post.append('content', `🆕 ${draft.title.trim()} — ${Number(price) === 0 ? 'Free' : `${price} ${draft.currency}`}${draft.city ? ` · ${draft.city.trim()}` : ''}`);
        post.append('linkedListingId', data.id);
        if (images[0]) post.append('media', uploadAsset(images[0]));
        await feedApi.createPost(post).catch(() => Alert.alert('Listing published', 'It could not be shared to the feed — you can post it from your profile.'));
      }
      setDraft(blank); setImages([]); setExtra({}); setStep(0); onClose(); onCreated?.(data);
    } catch (error) {
      const body = error?.response?.data;
      if (body?.emailVerificationRequired) {
        // Selling needs a verified email. Send a fresh code and take them straight to the
        // code screen instead of a dead-end error; the draft stays in the editor.
        Alert.alert('Verify your email first', `We need to confirm ${body.email || 'your email'} before you can publish. Your draft is saved.`, [
          { text: 'Later', style: 'cancel' },
          { text: 'Verify now', onPress: () => { authApi.resendCode(body.email).catch(() => {}); onClose(); router.push({ pathname: '/verify-code', params: { email: body.email } }); } },
        ]);
      } else Alert.alert('Could not publish', errorMessage(error, 'Your draft is still here. Please try again.'));
    }
    finally { submitting.current = false; setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.header}>
          <TouchableOpacity style={s.icon} onPress={close} disabled={busy || picking} accessibilityLabel="Close listing editor"><Feather name="x" size={24} color={colors.text} /></TouchableOpacity>
          <Text style={s.heading}>Add listing</Text>
          <Text style={s.muted}>{step + 1}/3</Text>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Text style={s.muted}>{['Category · What are you offering?', 'Details · Tell buyers more', 'Photos · Review and publish'][step]}</Text>
            {step === 0 && <>
            <Text style={s.label}>Choose a category</Text>
            <View style={s.categories}>
              {LISTING_CATEGORIES.map(category => {
                const selected = draft.listingType === category.key;
                return <TouchableOpacity key={category.key} style={[s.category, selected && s.selected]} disabled={busy} onPress={() => { if (draft.listingType !== category.key) setExtra(defaultExtra(category.key)); field('listingType', category.key); }} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                  <Feather name={selected ? 'check-circle' : category.icon} size={18} color={selected ? '#FFFFFF' : colors.text} />
                  <Text style={[s.categoryText, selected && { color: '#FFFFFF' }]}>{category.label}</Text>
                </TouchableOpacity>;
              })}
            </View>
            <Text style={s.selection} accessibilityLiveRegion="polite">{draft.listingType ? `Selected: ${categoryLabel(draft.listingType)}` : 'No category selected'}</Text>
            </>}
            {step === 1 && <>
            <Text style={s.label}>Add the essentials</Text>
            <Text style={s.fieldLabel}>{(TYPE_COPY[draft.listingType]?.title || 'TITLE *').toUpperCase()}</Text>
            <TextInput accessibilityLabel="Listing title" style={s.input} value={draft.title} onChangeText={value => field('title', value)} placeholder={TYPE_COPY[draft.listingType]?.titleHint || 'What are you offering?'} placeholderTextColor="#777" maxLength={120} editable={!busy} />
            <Text style={s.fieldLabel}>CURRENCY *</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Currency, ${draft.currency}`} accessibilityState={{ expanded: currencyOpen }} style={s.currencySelect} onPress={() => setCurrencyOpen(open => !open)} disabled={busy}>
              <Text style={[s.currencyValue, { color: colors.text }]}>{draft.currency}</Text>
              <Feather name={currencyOpen ? 'chevron-up' : 'chevron-down'} size={20} color={PURPLE} />
            </TouchableOpacity>
            {currencyOpen && <View style={s.currencyMenu}>
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 220 }}>
                {SELLER_CURRENCIES.map(code => {
                  const selected = draft.currency === code;
                  return <TouchableOpacity key={code} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { field('currency', code); setCurrencyOpen(false); }} style={[baseStyles.currencyOption, selected && baseStyles.currencyOptionSelected]}>
                    <Text style={{ color: selected ? '#FFFFFF' : colors.text, fontSize: 15, fontWeight: selected ? '700' : '500' }}>{code}</Text>
                    {selected && <Feather name="check" size={18} color="#FFFFFF" />}
                  </TouchableOpacity>;
                })}
              </ScrollView>
            </View>}
            {draft.listingType !== 'EVENT' && <>
            <Text style={s.fieldLabel}>{(TYPE_COPY[draft.listingType]?.price || 'Price').toUpperCase()} IN {draft.currency} *</Text>
            <TextInput accessibilityLabel={`Price in ${draft.currency}`} style={s.input} value={draft.price} onChangeText={value => field('price', value)} placeholder={TYPE_COPY[draft.listingType]?.priceHint || '0.00'} placeholderTextColor="#777" keyboardType="decimal-pad" editable={!busy} />
            </>}
            <TouchableOpacity style={s.toggle} accessibilityRole="switch" accessibilityState={{ checked: draft.negotiable }} onPress={() => field('negotiable', !draft.negotiable)} disabled={busy}>
              <Feather name={draft.negotiable ? 'check-square' : 'square'} size={22} color={PURPLE} /><Text style={s.text}>Open to offers</Text>
            </TouchableOpacity>
            {['GOODS', 'FASHION', 'SKILL', 'HAIR_BEAUTY'].includes(draft.listingType) && <TouchableOpacity style={s.toggle} accessibilityRole="switch" accessibilityState={{ checked: draft.swapEnabled }} onPress={() => field('swapEnabled', !draft.swapEnabled)} disabled={busy}>
              <Feather name={draft.swapEnabled ? 'check-square' : 'square'} size={22} color={PURPLE} /><View style={{ flex: 1 }}><Text style={s.text}>Open to swaps</Text><Text style={s.muted}>Let people offer an item (plus a cash top-up) instead of paying in full.</Text></View>
            </TouchableOpacity>}
            <Text style={s.fieldLabel}>DESCRIPTION (OPTIONAL)</Text>
            <TextInput accessibilityLabel="Description" style={[s.input, { minHeight: 100, textAlignVertical: 'top' }]} value={draft.description} onChangeText={value => field('description', value)} multiline placeholder="Condition, details, or what is included" placeholderTextColor="#777" editable={!busy} />
            <ListingTypeFields type={draft.listingType} extra={extra} setExtra={setExtra} inputStyle={s.input} fieldLabelStyle={s.fieldLabel} colors={colors} currency={draft.currency} />
            <Text style={s.fieldLabel}>{draft.listingType === 'LUGGAGE' ? 'DEPARTING FROM' : 'CITY (OPTIONAL)'}</Text>
            <TextInput accessibilityLabel="City" style={s.input} value={draft.city} onChangeText={value => field('city', value)} placeholder="e.g. Warsaw or Remote" placeholderTextColor="#777" editable={!busy} />
            {draft.listingType === 'RENTAL' && <TouchableOpacity style={s.toggle} accessibilityRole="switch" accessibilityState={{ checked: draft.agentFee }} onPress={() => field('agentFee', !draft.agentFee)} disabled={busy}>
              <Feather name={draft.agentFee ? 'check-square' : 'square'} size={22} color={PURPLE} /><Text style={s.text}>Agent fee applies</Text>
            </TouchableOpacity>}
            {draft.listingType === 'RENTAL' && draft.agentFee && <><Text style={s.fieldLabel}>AGENT FEE IN {draft.currency} *</Text><TextInput accessibilityLabel={`Agent fee in ${draft.currency}`} style={s.input} value={draft.agentFeeAmount} onChangeText={value => field('agentFeeAmount', value)} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#777" editable={!busy} /></>}
            </>}
            {step === 2 && <>
            <Text style={s.label}>{draft.title}</Text>
            <Text style={s.muted}>{categoryLabel(draft.listingType)} · {draft.price} {draft.currency}{draft.city ? ` · ${draft.city}` : ''}</Text>
            <Text style={s.label}>{TYPE_COPY[draft.listingType]?.photos || 'Add photos (optional)'}</Text>
            <Text style={s.muted}>Choose and crop each photo before adding it. {images.length}/6</Text>
            <View style={s.categories}>
              {images.map((image, index) => <View key={`${image.uri}:${index}`}>
                <Image source={{ uri: image.uri }} style={s.photo} />
                <TouchableOpacity style={s.remove} disabled={busy} onPress={() => setImages(old => old.filter((_, i) => i !== index))} accessibilityLabel={`Remove photo ${index + 1}`}><Feather name="x" size={20} color="#FFF" /></TouchableOpacity>
              </View>)}
              {images.length < 6 && <TouchableOpacity style={[s.photo, s.add]} onPress={pick} disabled={busy || picking} accessibilityLabel="Choose and crop photo">
                {picking ? <ActivityIndicator color={colors.accent} /> : <><Feather name="crop" size={24} color={colors.accent} /><Text style={s.text}>Add photo</Text></>}
              </TouchableOpacity>}
            </View>
            <TouchableOpacity style={[s.toggle, { marginTop: 8 }]} accessibilityRole="switch" accessibilityState={{ checked: shareToFeed }} onPress={() => setShareToFeed(v => !v)} disabled={busy}>
              <Feather name={shareToFeed ? 'check-square' : 'square'} size={22} color={PURPLE} />
              <View style={{ flex: 1 }}><Text style={s.text}>Also share to the feed</Text><Text style={s.muted}>Posts your listing with its first photo so followers see it.</Text></View>
            </TouchableOpacity>
            </>}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.bg }}>
            {step > 0 && <TouchableOpacity accessibilityRole="button" disabled={busy || picking} onPress={() => move(step - 1)} style={{ minWidth: 64, minHeight: 52, justifyContent: 'center' }}><Text style={s.text}>Back</Text></TouchableOpacity>}
            <TouchableOpacity accessibilityRole="button" style={[s.publish, { flex: 1, marginTop: 0 }, (busy || picking) && { opacity: 0.5 }]} disabled={busy || picking} onPress={() => {
              if (step === 0) {
                if (!draft.listingType) { Alert.alert('Choose a category', 'Select what you are offering to continue.'); return; }
                move(1);
              } else submit();
            }}>
              {busy ? <ActivityIndicator color="#050505" /> : <Text style={s.publishText}>{step === 2 ? 'Publish listing' : 'Continue'}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0A' }, header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#292432' },
  icon: { minWidth: 48, minHeight: 48, justifyContent: 'center' }, heading: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 40, gap: 12 }, label: { color: '#FFF', fontSize: 17, fontWeight: '700', marginTop: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 4 },
  currencySelect: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currencyValue: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  currencyMenu: { borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginTop: -5 },
  currencyOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#30293A' },
  currencyOptionSelected: { backgroundColor: PURPLE },
  muted: { color: '#AAA', fontSize: 14 }, text: { color: '#EEE', fontSize: 14 }, selection: { color: LIME, fontSize: 14 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, category: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 14, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: '#444' },
  selected: { backgroundColor: PURPLE, borderColor: PURPLE }, categoryText: { color: '#EEE', fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: '#111018', borderWidth: 1, borderColor: '#382A4C', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#FFF', fontSize: 16, minHeight: 52 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }, photo: { width: 100, height: 110, borderRadius: 12 },
  add: { borderWidth: 1, borderColor: '#555', alignItems: 'center', justifyContent: 'center', gap: 8 }, remove: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, borderRadius: 12, backgroundColor: '#000A', alignItems: 'center', justifyContent: 'center' },
  publish: { minHeight: 52, borderRadius: 15, backgroundColor: LIME, justifyContent: 'center', alignItems: 'center', marginTop: 16 }, publishText: { color: '#050505', fontSize: 15, fontWeight: '700' },
});
