import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { listingsApi } from '../../api/client';
import { LISTING_CATEGORIES, categoryLabel, errorMessage } from '../../utils/marketplace';
import { pickCroppedPhoto, uploadAsset } from '../../utils/media';

const LIME = '#CDFF00';
const blank = { title: '', description: '', price: '', city: '', listingType: '', negotiable: false, agentFee: false };

export default function CreateListingModal({ visible, onClose, onCreated }) {
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
        { text: 'Discard', style: 'destructive', onPress: () => { setDraft(blank); setImages([]); onClose(); } },
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
    if (submitting.current) return;
    if (!draft.listingType) return Alert.alert('Choose a category', 'Select the category that best describes your listing.');
    if (!draft.title.trim()) return Alert.alert('Add a title', 'Give your listing a short, clear title.');
    const price = draft.price.trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(price)) return Alert.alert('Check the price', 'Enter a price in PLN, with up to two decimal places. Use 0 for free.');
    submitting.current = true;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('title', draft.title.trim());
      form.append('description', draft.description.trim());
      form.append('listingType', draft.listingType);
      form.append('price', price);
      form.append('currency', 'PLN');
      form.append('city', draft.city.trim());
      form.append('negotiable', String(draft.negotiable));
      form.append('agentFee', String(draft.listingType === 'RENTAL' && draft.agentFee));
      images.forEach(image => form.append('images', uploadAsset(image)));
      const { data } = await listingsApi.create(form);
      setDraft(blank); setImages([]); onClose(); onCreated?.(data);
    } catch (error) { Alert.alert('Could not publish', errorMessage(error, 'Your draft is still here. Please try again.')); }
    finally { submitting.current = false; setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={s.screen}>
        <View style={s.header}>
          <TouchableOpacity style={s.icon} onPress={close} disabled={busy || picking} accessibilityLabel="Close listing editor"><Feather name="x" size={24} color="#FFF" /></TouchableOpacity>
          <Text style={s.heading}>New listing</Text>
          <Text style={s.muted}>PLN</Text>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>1. Choose a category *</Text>
            <View style={s.categories}>
              {LISTING_CATEGORIES.map(category => {
                const selected = draft.listingType === category.key;
                return <TouchableOpacity key={category.key} style={[s.category, selected && s.selected]} disabled={busy} onPress={() => field('listingType', category.key)} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                  <Feather name={selected ? 'check-circle' : category.icon} size={18} color={selected ? '#050505' : '#CCC'} />
                  <Text style={[s.categoryText, selected && { color: '#050505' }]}>{category.label}</Text>
                </TouchableOpacity>;
              })}
            </View>
            <Text style={s.selection} accessibilityLiveRegion="polite">{draft.listingType ? `Selected: ${categoryLabel(draft.listingType)}` : 'No category selected'}</Text>
            <Text style={s.label}>2. Add the essentials</Text>
            <Text style={s.muted}>Title *</Text>
            <TextInput accessibilityLabel="Listing title" style={s.input} value={draft.title} onChangeText={value => field('title', value)} placeholder="What are you offering?" placeholderTextColor="#777" maxLength={120} editable={!busy} />
            <Text style={s.muted}>Price in PLN *</Text>
            <TextInput accessibilityLabel="Price in PLN" style={s.input} value={draft.price} onChangeText={value => field('price', value)} placeholder="0.00" placeholderTextColor="#777" keyboardType="decimal-pad" editable={!busy} />
            <TouchableOpacity style={s.toggle} accessibilityRole="switch" accessibilityState={{ checked: draft.negotiable }} onPress={() => field('negotiable', !draft.negotiable)} disabled={busy}>
              <Feather name={draft.negotiable ? 'check-square' : 'square'} size={22} color={LIME} /><Text style={s.text}>Open to offers</Text>
            </TouchableOpacity>
            <Text style={s.muted}>Description (optional)</Text>
            <TextInput accessibilityLabel="Description" style={[s.input, { minHeight: 100, textAlignVertical: 'top' }]} value={draft.description} onChangeText={value => field('description', value)} multiline placeholder="Condition, details, or what is included" placeholderTextColor="#777" editable={!busy} />
            <Text style={s.muted}>City (optional)</Text>
            <TextInput accessibilityLabel="City" style={s.input} value={draft.city} onChangeText={value => field('city', value)} placeholder="e.g. Warsaw or Remote" placeholderTextColor="#777" editable={!busy} />
            {draft.listingType === 'RENTAL' && <TouchableOpacity style={s.toggle} accessibilityRole="switch" accessibilityState={{ checked: draft.agentFee }} onPress={() => field('agentFee', !draft.agentFee)} disabled={busy}>
              <Feather name={draft.agentFee ? 'check-square' : 'square'} size={22} color={LIME} /><Text style={s.text}>Agent fee applies</Text>
            </TouchableOpacity>}
            <Text style={s.label}>3. Add photos (optional)</Text>
            <Text style={s.muted}>Choose and crop each photo before adding it. {images.length}/6</Text>
            <View style={s.categories}>
              {images.map((image, index) => <View key={`${image.uri}:${index}`}>
                <Image source={{ uri: image.uri }} style={s.photo} />
                <TouchableOpacity style={s.remove} disabled={busy} onPress={() => setImages(old => old.filter((_, i) => i !== index))} accessibilityLabel={`Remove photo ${index + 1}`}><Feather name="x" size={20} color="#FFF" /></TouchableOpacity>
              </View>)}
              {images.length < 6 && <TouchableOpacity style={[s.photo, s.add]} onPress={pick} disabled={busy || picking} accessibilityLabel="Choose and crop photo">
                {picking ? <ActivityIndicator color={LIME} /> : <><Feather name="crop" size={24} color={LIME} /><Text style={s.text}>Add photo</Text></>}
              </TouchableOpacity>}
            </View>
            <TouchableOpacity style={[s.publish, (busy || picking) && { opacity: 0.5 }]} onPress={submit} disabled={busy || picking}>
              {busy ? <ActivityIndicator color="#050505" /> : <Text style={s.publishText}>Publish {draft.listingType ? categoryLabel(draft.listingType).toLowerCase() : 'listing'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
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
