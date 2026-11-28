import React, { useCallback, useEffect, useState } from 'react';
import { CropHost } from '../native/ImageCropper';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '../native/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { communitiesApi } from '../../api/client';
import { usePalette } from '../native/Kit';
import { errorMessage } from '../../utils/marketplace';
import { mediaUrl, pickCroppedPhoto, uploadAsset } from '../../utils/media';

const CATEGORIES = ['Business', 'Creators', 'Students', 'Food', 'Fashion', 'Tech', 'Music', 'Sports', 'Local'];

/**
 * Discover, join, leave and create communities. `onChanged` fires whenever membership changes
 * so the feed and the composer's "Post to" picker can refresh.
 */
export default function CommunitiesSheet({ visible, onClose, onChanged, onOpenCommunity }) {
  const theme = usePalette();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('discover');
  const [all, setAll] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', city: '', category: '' });
  const [banner, setBanner] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, m] = await Promise.all([communitiesApi.browse(), communitiesApi.mine().catch(() => ({ data: [] }))]);
      setAll(Array.isArray(a.data) ? a.data : a.data?.content || []);
      setMine(Array.isArray(m.data) ? m.data : []);
    } catch (e) { Alert.alert('Communities unavailable', errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (visible) load(); }, [visible, load]);

  const memberOf = id => mine.some(c => String(c.id) === String(id));
  const toggle = async (c) => {
    setBusyId(c.id);
    try {
      if (memberOf(c.id)) await communitiesApi.leave(c.slug || c.id); else await communitiesApi.join(c.slug || c.id);
      await load(); onChanged?.();
    } catch (e) { Alert.alert('Could not update', errorMessage(e)); }
    finally { setBusyId(null); }
  };

  const create = async () => {
    if (form.name.trim().length < 3) return Alert.alert('Name your community', 'Use at least 3 characters.');
    setCreating(true);
    try {
      await communitiesApi.create({ ...form, name: form.name.trim(), description: form.description.trim(), city: form.city.trim(), image: banner ? uploadAsset(banner) : null });
      setForm({ name: '', description: '', city: '', category: '' }); setBanner(null);
      await load(); onChanged?.(); setTab('mine');
    } catch (e) { Alert.alert('Could not create', errorMessage(e)); }
    finally { setCreating(false); }
  };

  const list = tab === 'mine' ? mine : all;
  const row = ({ item: c }) => (
    <Pressable onPress={() => onOpenCommunity?.(c)} style={[s.row, { borderColor: theme.line, backgroundColor: theme.card }]}>
      {c.imageUrl || c.bannerUrl
        ? <Image source={{ uri: mediaUrl(c.imageUrl || c.bannerUrl) }} style={s.thumb} />
        : <View style={[s.thumb, { backgroundColor: theme.soft, alignItems: 'center', justifyContent: 'center' }]}><Feather name="users" size={20} color={theme.accent} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{c.name}</Text>
        <Text style={{ color: theme.muted, fontSize: 12 }} numberOfLines={1}>{[c.category, c.city, c.memberCount != null && `${c.memberCount} members`].filter(Boolean).join(' · ') || c.description}</Text>
      </View>
      <TouchableOpacity onPress={() => toggle(c)} disabled={busyId === c.id} style={[s.join, memberOf(c.id) ? { borderColor: theme.line } : { backgroundColor: theme.lime, borderColor: theme.accent }]}>
        {busyId === c.id ? <ActivityIndicator size="small" color={theme.text} /> : <Text style={{ color: memberOf(c.id) ? theme.text : '#111', fontWeight: '800', fontSize: 12 }}>{memberOf(c.id) ? 'Joined' : 'Join'}</Text>}
      </TouchableOpacity>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
        <View style={s.header}>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900', flex: 1 }}>Communities</Text>
          <TouchableOpacity accessibilityLabel="Close" onPress={onClose} style={s.icon}><Feather name="x" size={22} color={theme.text} /></TouchableOpacity>
        </View>
        <View style={[s.tabs, { backgroundColor: theme.card, borderColor: theme.line }]}>
          {[['discover', 'Discover'], ['mine', `Mine${mine.length ? ` ${mine.length}` : ''}`], ['create', 'Create']].map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && { backgroundColor: theme.lime }]}><Text style={{ color: tab === k ? '#111' : theme.muted, fontWeight: '800' }}>{l}</Text></Pressable>
          ))}
        </View>
        {tab === 'create' ? (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity onPress={async () => { try { const a = await pickCroppedPhoto([16, 9]); if (a) setBanner(a); } catch (e) { Alert.alert('Photo access', e.message); } }} style={[s.banner, { borderColor: theme.line, backgroundColor: theme.card }]}>
                {banner ? <Image source={{ uri: banner.uri }} style={StyleSheet.absoluteFill} /> : <><Feather name="image" size={24} color={theme.accent} /><Text style={{ color: theme.muted, marginTop: 6 }}>Add a cover photo</Text></>}
              </TouchableOpacity>
              {[['name', 'Community name *'], ['description', 'What is it about?'], ['city', 'City (optional)']].map(([k, label]) => (
                <TextInput key={k} placeholder={label} placeholderTextColor={theme.muted} value={form[k]} onChangeText={v => setForm(f => ({ ...f, [k]: v }))} multiline={k === 'description'} maxLength={k === 'description' ? 400 : 60}
                  style={[s.input, { color: theme.text, borderColor: theme.line, backgroundColor: theme.card }, k === 'description' && { minHeight: 90, textAlignVertical: 'top' }]} />
              ))}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map(c => <Pressable key={c} onPress={() => setForm(f => ({ ...f, category: f.category === c ? '' : c }))} style={[s.chip, { borderColor: form.category === c ? theme.accent : theme.line, backgroundColor: form.category === c ? `${theme.accent}22` : 'transparent' }]}><Text style={{ color: form.category === c ? theme.accent : theme.text, fontWeight: '700', fontSize: 13 }}>{c}</Text></Pressable>)}
              </View>
              <TouchableOpacity onPress={create} disabled={creating} style={[s.cta, { backgroundColor: theme.lime }]}>{creating ? <ActivityIndicator color="#151A00" /> : <Text style={{ color: '#151A00', fontWeight: '900' }}>Create community</Text>}</TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 30 }} /> : (
          <FlatList
            data={list}
            keyExtractor={c => String(c.id)}
            renderItem={row}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
            ListEmptyComponent={<View style={{ alignItems: 'center', padding: 30, gap: 10 }}>
              <Feather name="users" size={30} color={theme.accent} />
              <Text style={{ color: theme.text, fontWeight: '800' }}>{tab === 'mine' ? 'You haven’t joined any communities yet' : 'No communities yet'}</Text>
              <TouchableOpacity onPress={() => setTab('create')} style={[s.cta, { backgroundColor: theme.lime, paddingHorizontal: 20 }]}><Text style={{ color: '#151A00', fontWeight: '900' }}>Start one</Text></TouchableOpacity>
            </View>}
          />
        )}
      </View>
    <CropHost /></Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 14, padding: 3, borderWidth: 1 },
  tab: { flex: 1, minHeight: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
  thumb: { width: 52, height: 52, borderRadius: 14 },
  join: { minWidth: 72, minHeight: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  banner: { height: 150, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  input: { fontSize: 15, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 50 },
  chip: { paddingHorizontal: 14, minHeight: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center' },
  cta: { minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
});
