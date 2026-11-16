import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { listingsApi, subscriptionsApi } from '../../api/client';
import { isPremiumActive } from '../../utils/subscriptions';
import { LISTING_CATEGORIES, categoryLabel, errorMessage } from '../../utils/marketplace';
import { pickCroppedPhoto, uploadAsset } from '../../utils/media';

import { usePalette } from '../native/Kit';

const LIME = '#CDFF00';
const SELLER_CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP', 'ZAR', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'CZK', 'HUF', 'JPY'];
const blank = { title: '', description: '', price: '', currency: 'PLN', city: '', listingType: '', negotiable: false, agentFee: false, agentFeeAmount: '' };

export default function CreateListingModal({ visible, onClose, onCreated }) {
  const colors = usePalette();
  const [step, setStep] = useState(0);
  const scroll = useRef(null);
  const s = { ...baseStyles,
    screen: [baseStyles.screen, { backgroundColor: colors.bg }],
    heading: [baseStyles.heading, { color: colors.text }],
    label: [baseStyles.label, { color: colors.text }],
    muted: [baseStyles.muted, { color: colors.muted }],
    text: [baseStyles.text, { color: colors.text }],
    categoryText: [baseStyles.categoryText, { color: colors.text }],
    category: [baseStyles.category, { backgroundColor: colors.card, borderColor: colors.line, width: '48%', flexDirection: 'column', justifyContent: 'center', paddingVertical: 16 }],
    input: [baseStyles.input, { backgroundColor: colors.card, borderColor: colors.line, color: colors.text }],
    selection: [baseStyles.selection, { color: colors.accent }],
  };
  const move = value => { setStep(value); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const [draft, setDraft] = useState(blank);
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const submitting = useRef(false);
  const field = (name, value) => setDraft(old => ({ ...old, [name]: value }));
  const close = () => {
    if (submitting.current || picking) return;
    if (draft.title || draft.description || draft.price || draft.city || draft.listingType || images.length) {
      Alert.alert('Discard listing?', 'Your draft has not been published.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { setDraft(blank); setImages([]); setStep(0); onClose(); } },
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
    const price = draft.price.trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(price)) return Alert.alert('Check the price', `Enter a price in ${draft.currency}, with up to two decimal places. Use 0 for free.`);
    if (!Number.isFinite(Number(price))) return Alert.alert('Check the price', 'Enter a valid amount.');
    const agentFeeAmount = draft.agentFeeAmount.trim().replace(',', '.');
    if (draft.listingType === 'RENTAL' && draft.agentFee && (!/^\d+(\.\d{1,2})?$/.test(agentFeeAmount) || !Number.isFinite(Number(agentFeeAmount)))) return Alert.alert('Check the agent fee', `Enter the agent fee in ${draft.currency}, with up to two decimal places.`);
    if (step < 2) { move(2); return; }
    submitting.current = true;
    setBusy(true);
    try {
      const membership = await subscriptionsApi.my();
      if (!isPremiumActive(membership.data)) {
        Alert.alert('Plus membership required', 'Selling is included with Plus and All Access. Your draft is saved here. View Membership plans in the More menu.');
        return;
      }
      const form = new FormData();
      form.append('title', draft.title.trim());
      form.append('description', draft.description.trim());
      form.append('listingType', draft.listingType);
      form.append('price', price);
      form.append('currency', draft.currency);
      form.append('city', draft.city.trim());
      form.append('negotiable', String(draft.negotiable));
      if (draft.listingType === 'RENTAL') form.append('agentFeeAmount', draft.agentFee ? agentFeeAmount : '0');
      images.forEach(image => form.append('images', uploadAsset(image)));
      const { data } = await listingsApi.create(form);
      setDraft(blank); setImages([]); setStep(0); onClose(); onCreated?.(data);
    } catch (error) { Alert.alert('Could not publish', errorMessage(error, 'Your draft is still here. Please try again.')); }
    finally { submitting.current = false; setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={s.screen}>
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
                return <TouchableOpacity key={category.key} style={[s.category, selected && s.selected]} disabled={busy} onPress={() => field('listingType', category.key)} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                  <Feather name={selected ? 'check-circle' : category.icon} size={18} color={selected ? '#050505' : colors.text} />
                  <Text style={[s.categoryText, selected && { color: '#050505' }]}>{category.label}</Text>
                </TouchableOpacity>;
              })}
            </View>
            <Text style={s.selection} accessibilityLiveRegion="polite">{draft.listingType ? `Selected: ${categoryLabel(draft.listingType)}` : 'No category selected'}</Text>
            </>}
            {step === 1 && <>
            <Text style={s.label}>Add the essentials</Text>
            <Text style={s.muted}>Title *</Text>
            <TextInput accessibilityLabel="Listing title" style={s.input} value={draft.title} onChangeText={value => field('title', value)} placeholder="What are you offering?" placeholderTextColor="#777" maxLength={120} editable={!busy} />
            <Text style={s.muted}>Currency *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
              {SELLER_CURRENCIES.map(code => <TouchableOpacity key={code} onPress={() => field('currency', code)} accessibilityRole="radio" accessibilityState={{ checked: draft.currency === code }} style={{ minHeight: 42, paddingHorizontal: 13, borderRadius: 12, justifyContent: 'center', backgroundColor: draft.currency === code ? colors.accent : colors.card, borderWidth: 1, borderColor: draft.currency === code ? colors.accent : colors.line }}><Text style={{ color: draft.currency === code ? '#050505' : colors.text, fontWeight: '700' }}>{code}</Text></TouchableOpacity>)}
            </ScrollView>
            <Text style={s.muted}>Price in {draft.currency} *</Text>
            <TextInput accessibilityLabel={`Price in ${draft.currency}`} style={s.input} value={draft.price} onChangeText={value => field('price', value)} placeholder="0.00" placeholderTextColor="#777" keyboardType="decimal-pad" editable={!busy} />
            <TouchableOpacity style={s.toggle} accessibilityRole="switch" accessibilityState={{ checked: draft.negotiable }} onPress={() => field('negotiable', !draft.negotiable)} disabled={busy}>
              <Feather name={draft.negotiable ? 'check-square' : 'square'} size={22} color={colors.accent} /><Text style={s.text}>Open to offers</Text>
            </TouchableOpacity>
            <Text style={s.muted}>Description (optional)</Text>
            <TextInput accessibilityLabel="Description" style={[s.input, { minHeight: 100, textAlignVertical: 'top' }]} value={draft.description} onChangeText={value => field('description', value)} multiline placeholder="Condition, details, or what is included" placeholderTextColor="#777" editable={!busy} />
            <Text style={s.muted}>City (optional)</Text>
            <TextInput accessibilityLabel="City" style={s.input} value={draft.city} onChangeText={value => field('city', value)} placeholder="e.g. Warsaw or Remote" placeholderTextColor="#777" editable={!busy} />
            {draft.listingType === 'RENTAL' && <TouchableOpacity style={s.toggle} accessibilityRole="switch" accessibilityState={{ checked: draft.agentFee }} onPress={() => field('agentFee', !draft.agentFee)} disabled={busy}>
              <Feather name={draft.agentFee ? 'check-square' : 'square'} size={22} color={colors.accent} /><Text style={s.text}>Agent fee applies</Text>
            </TouchableOpacity>}
            {draft.listingType === 'RENTAL' && draft.agentFee && <><Text style={s.muted}>Agent fee in {draft.currency} *</Text><TextInput accessibilityLabel={`Agent fee in ${draft.currency}`} style={s.input} value={draft.agentFeeAmount} onChangeText={value => field('agentFeeAmount', value)} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#777" editable={!busy} /></>}
            </>}
            {step === 2 && <>
            <Text style={s.label}>{draft.title}</Text>
            <Text style={s.muted}>{categoryLabel(draft.listingType)} · {draft.price} {draft.currency}{draft.city ? ` · ${draft.city}` : ''}</Text>
            <Text style={s.label}>Add photos (optional)</Text>
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
      </SafeAreaView>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0A' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  icon: { minWidth: 48, minHeight: 48, justifyContent: 'center' }, heading: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 40, gap: 12 }, label: { color: '#FFF', fontSize: 17, fontWeight: '700', marginTop: 12 },
  muted: { color: '#AAA', fontSize: 14 }, text: { color: '#EEE', fontSize: 14 }, selection: { color: LIME, fontSize: 14 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, category: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 14, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: '#444' },
  selected: { backgroundColor: LIME, borderColor: LIME }, categoryText: { color: '#EEE', fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: '#181818', borderWidth: 1, borderColor: '#383838', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 16, minHeight: 48 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }, photo: { width: 100, height: 110, borderRadius: 12 },
  add: { borderWidth: 1, borderColor: '#555', alignItems: 'center', justifyContent: 'center', gap: 8 }, remove: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, borderRadius: 12, backgroundColor: '#000A', alignItems: 'center', justifyContent: 'center' },
  publish: { minHeight: 52, borderRadius: 16, backgroundColor: LIME, justifyContent: 'center', alignItems: 'center', marginTop: 16 }, publishText: { color: '#050505', fontSize: 16, fontWeight: '700' },
});
