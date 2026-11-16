import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LISTING_CATEGORIES } from '../../utils/marketplace';
import { Button, Copy, fonts, k, usePalette } from './Kit';

export const SORT_OPTIONS = [['latest', 'Newest'], ['price-low', 'Price: low to high'], ['price-high', 'Price: high to low'], ['rating', 'Top rated']];
export default function ExploreFilters({ category, city, sort, listingFilters, onApply, onClose }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState({ category, city, sort });
  const set = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  return <Modal transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
    <Pressable accessibilityLabel="Dismiss filters without applying" onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: '#0008' }} />
    <View accessibilityViewIsModal style={{ maxHeight: '88%', paddingBottom: Math.max(insets.bottom, 16), backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: c.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 }}><Copy heading style={{ flex: 1, fontSize: 22 }}>Filters</Copy><Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={onClose} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Feather name="x" size={23} color={c.text} /></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
        {listingFilters && <><Copy heading>Category</Copy><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[{ key: '', label: 'All categories' }, ...LISTING_CATEGORIES].map(item => <Pressable key={item.key} accessibilityRole="radio" accessibilityState={{ checked: draft.category === item.key }} onPress={() => set('category', item.key)} style={{ minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: draft.category === item.key ? c.accent : c.line, backgroundColor: draft.category === item.key ? c.soft : c.card, borderRadius: 12, paddingHorizontal: 14 }}><Copy style={{ color: draft.category === item.key ? c.accent : c.text, fontSize: 13, fontFamily: fonts.medium }}>{item.label}</Copy></Pressable>)}</View></>}
        <Copy heading>Location</Copy><TextInput accessibilityLabel="Filter by city" placeholder="Any city" placeholderTextColor={c.muted} style={[k.input, { color: c.text, borderColor: c.line }]} value={draft.city} onChangeText={value => set('city', value)} returnKeyType="done" />
        {listingFilters && <><Copy heading>Sort listings</Copy>{SORT_OPTIONS.map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: draft.sort === value }} onPress={() => set('sort', value)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 12 }}><Feather name={draft.sort === value ? 'check-circle' : 'circle'} size={21} color={draft.sort === value ? c.accent : c.muted} /><Copy>{label}</Copy></Pressable>)}{draft.sort.startsWith('price') && <Copy muted style={{ fontSize: 12 }}>Prices are grouped by currency.</Copy>}</>}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: c.line }}><Button secondary onPress={() => setDraft({ category: '', city: '', sort: 'latest' })}>Reset</Button><Button style={{ flex: 1 }} onPress={() => onApply({ ...draft, city: draft.city.trim() })}>Apply filters</Button></View>
    </View>
  </KeyboardAvoidingView></Modal>;
}
