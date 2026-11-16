import React, { useRef, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { shopsApi } from '../../api/client';
import { mediaUrl, uploadAsset } from '../../utils/media';
import { errorMessage } from '../../utils/marketplace';
import { Button, Copy, Panel, k, usePalette } from './Kit';

function HighlightMedia({ item }) {
  const video = item.type === 'video';
  const player = useVideoPlayer(video ? mediaUrl(item.url) : null, p => { p.loop = false; p.play(); });
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  if (failed) return <Panel><Copy>Could not load this photo.</Copy><Button secondary onPress={() => { setRetry(n => n + 1); setFailed(false); }}>Retry</Button></Panel>;
  return video ? <VideoView player={player} style={{ width: '100%', aspectRatio: 9 / 14 }} contentFit="contain" nativeControls /> : <Image key={retry} source={{ uri: mediaUrl(item.url) }} resizeMode="contain" onError={() => setFailed(true)} style={{ width: '100%', aspectRatio: 9 / 14 }} />;
}
export default function ShopHighlights({ shop, isOwner, onSaved }) {
  const c = usePalette();
  const [active, setActive] = useState(null);
  const [slide, setSlide] = useState(0);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const collections = shop.highlights || [];
  const collection = collections.find(item => item.id === active);
  const close = () => { if (locked.current) return; setActive(null); setDraft(null); setError(''); };
  const edit = value => { setActive(null); setDraft(value ? { ...value, items: [...value.items] } : { id: 'highlight-' + Date.now().toString(36), title: '', items: [] }); setError(''); };
  const save = async next => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { const response = await shopsApi.update(shop.id, { highlights: next }); onSaved(response.data); setActive(null); setDraft(null); }
    catch (e) { setError(errorMessage(e, 'Could not save highlights. Your edits are kept.')); }
    finally { locked.current = false; setBusy(false); }
  };
  const upload = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      if (draft.items.length >= 20) throw new Error('Use at most 20 photos or videos per collection.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: false, quality: 0.85 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize > 20 * 1024 * 1024) throw new Error('Choose a photo or video under 20 MB.');
      const form = new FormData();
      form.append('file', Platform.OS === 'web' ? asset.file : uploadAsset(asset));
      const { data } = await shopsApi.uploadMedia(shop.id, form);
      if (!data.url) throw new Error('Upload did not return a media URL.');
      setDraft(previous => ({ ...previous, items: [...previous.items, { url: data.url, type: asset.type === 'video' ? 'video' : 'image' }] }));
    } catch (e) { setError(errorMessage(e, e.message || 'Could not upload media.')); }
    finally { locked.current = false; setBusy(false); }
  };
  return <View style={{ gap: 12 }}>{(isOwner || collections.length > 0) && <Copy heading style={{ fontSize: 20 }}>Highlights</Copy>}<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>{collections.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'View ' + item.title + ' highlight'} onPress={() => { setActive(item.id); setSlide(0); }} style={{ width: 80, alignItems: 'center', gap: 6 }}><View style={{ width: 76, height: 76, borderRadius: 38, padding: 4, borderWidth: 2, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>{item.items?.[0]?.type === 'image' ? <Image source={{ uri: mediaUrl(item.items[0].url) }} style={{ width: 64, height: 64, borderRadius: 32 }} /> : <Feather name="play" size={26} color={c.accent} />}</View><Copy numberOfLines={1} style={{ fontSize: 11 }}>{item.title}</Copy></Pressable>)}{isOwner && <Pressable accessibilityRole="button" accessibilityLabel="New highlight" onPress={() => edit(null)} style={{ width: 80, alignItems: 'center', gap: 6 }}><View style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}><Feather name="plus" size={26} color={c.text} /></View><Copy style={{ fontSize: 11 }}>New</Copy></Pressable>}</ScrollView>
    <Modal visible={!!collection || !!draft} animationType="slide" onRequestClose={close}><SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Copy heading style={{ flex: 1, fontSize: 20 }}>{draft ? 'Edit highlight' : collection?.title}</Copy><Button secondary disabled={busy} onPress={close}>Close</Button></View>
      {!!error && <Copy style={{ color: '#D55656' }}>{error}</Copy>}
      {draft ? <><TextInput accessibilityLabel="Highlight title" placeholder="Collection name" maxLength={60} value={draft.title} onChangeText={title => setDraft(value => ({ ...value, title }))} placeholderTextColor={c.muted} style={[k.input, { color: c.text, borderColor: c.line }]} />{draft.items.map((item, index) => <Panel key={item.url + index}><Copy>{item.type === 'video' ? 'Video' : 'Photo'} {index + 1}</Copy><Button secondary disabled={busy} onPress={() => setDraft(value => ({ ...value, items: value.items.filter((_, i) => i !== index) }))}>Remove</Button></Panel>)}<Button secondary busy={busy} onPress={upload}>Add photo or video</Button><Button busy={busy} disabled={!draft.title.trim() || !draft.items.length} onPress={() => save([...collections.filter(item => item.id !== draft.id), { ...draft, title: draft.title.trim() }])}>Save collection</Button></> : collection && <><View style={{ flexDirection: 'row', gap: 4 }}>{collection.items.map((_, index) => <View key={index} style={{ height: 3, flex: 1, backgroundColor: index <= slide ? c.accent : c.line }} />)}</View>{collection.items[slide] && <HighlightMedia key={collection.items[slide].url + slide} item={collection.items[slide]} />}<View style={{ flexDirection: 'row', gap: 12 }}><Button secondary disabled={slide === 0} onPress={() => setSlide(n => n - 1)}>Previous</Button><Button secondary onPress={() => slide < collection.items.length - 1 ? setSlide(n => n + 1) : close()}>{slide < collection.items.length - 1 ? 'Next' : 'Done'}</Button></View>{isOwner && <><Button secondary onPress={() => edit(collection)}>Edit collection</Button><Button secondary disabled={busy} onPress={() => Alert.alert('Delete highlight?', 'This removes the collection from your storefront.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => save(collections.filter(item => item.id !== collection.id)) }])}>Delete collection</Button></>}</>}
    </ScrollView></SafeAreaView></Modal>
  </View>;
}
