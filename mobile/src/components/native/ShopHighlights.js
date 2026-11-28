import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from './Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { shopsApi } from '../../api/client';
import { mediaUrl, uploadAsset } from '../../utils/media';
import { errorMessage, money } from '../../utils/marketplace';
import { usePalette } from './Kit';

const PURPLE = '#8B5CF6';
const LIME = '#CDFF00';
const SLIDE_MS = 5000;

/** Gradient story ring (lime → purple), Instagram-style. */
function Ring({ size = 72, children, seen }) {
  return (
    <LinearGradient colors={seen ? ['#3F3F46', '#3F3F46'] : [LIME, PURPLE]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
      style={{ width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size + 2, height: size + 2, borderRadius: (size + 2) / 2, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {children}
      </View>
    </LinearGradient>
  );
}

function VideoSlide({ url, paused }) {
  const player = useVideoPlayer(mediaUrl(url), p => { p.loop = true; p.muted = false; p.play(); });
  useEffect(() => { if (paused) player.pause(); else player.play(); }, [paused, player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

/** Full-screen viewer: tap right/left to move, hold to pause, auto-advances like Instagram. */
function StoryViewer({ collection, products, onClose, onOpenProduct, isOwner, onEdit, onDelete }) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const item = collection.items[index];
  const product = item?.productId ? products.find(p => String(p.id) === String(item.productId)) : null;

  useEffect(() => {
    progress.setValue(0);
    if (paused) return undefined;
    const anim = Animated.timing(progress, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (!finished) return;
      if (index < collection.items.length - 1) setIndex(i => i + 1); else onClose();
    });
    return () => anim.stop();
  }, [index, paused, collection.items.length, onClose, progress]);

  if (!item) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {item.type === 'video'
          ? <VideoSlide key={item.url + index} url={item.url} paused={paused} />
          : <Image source={{ uri: mediaUrl(item.url) }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
        <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140 }} pointerEvents="none" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.35 }} pointerEvents="none" />

        {/* Tap zones: left third goes back, the rest goes forward; holding pauses. */}
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          <Pressable style={{ width: width / 3 }} onPress={() => setIndex(i => Math.max(0, i - 1))} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityLabel="Previous" />
          <Pressable style={{ flex: 1 }} onPress={() => (index < collection.items.length - 1 ? setIndex(i => i + 1) : onClose())} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityLabel="Next" />
        </View>

        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 10 }} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
            {collection.items.map((_, i) => (
              <View key={i} style={s.track}>
                <Animated.View style={[s.fill, { width: i < index ? '100%' : i === index ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%' }]} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 }}>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15, flex: 1 }} numberOfLines={1}>{collection.title}</Text>
            {isOwner && <TouchableOpacity accessibilityLabel="Edit highlight" onPress={onEdit} style={s.topBtn}><Feather name="edit-2" size={18} color="#FFF" /></TouchableOpacity>}
            {isOwner && <TouchableOpacity accessibilityLabel="Delete highlight" onPress={onDelete} style={s.topBtn}><Feather name="trash-2" size={18} color="#FFF" /></TouchableOpacity>}
            <TouchableOpacity accessibilityLabel="Close" onPress={onClose} style={s.topBtn}><Feather name="x" size={24} color="#FFF" /></TouchableOpacity>
          </View>
        </SafeAreaView>

        <SafeAreaView edges={['bottom']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, gap: 12 }} pointerEvents="box-none">
          {!!item.caption && <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>{item.caption}</Text>}
          {product && (
            <TouchableOpacity onPress={() => onOpenProduct(product)} style={s.productCard} accessibilityRole="button" accessibilityLabel={`View ${product.name}`}>
              {!!product.imageUrl && <Image source={{ uri: mediaUrl(product.imageUrl) }} style={{ width: 48, height: 48, borderRadius: 10 }} />}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFF', fontWeight: '800' }} numberOfLines={1}>{product.name}</Text>
                <Text style={{ color: LIME, fontWeight: '800' }}>{money(product.price, product.currency)}</Text>
              </View>
              <View style={s.shopBtn}><Feather name="shopping-bag" size={16} color="#111" /><Text style={{ color: '#111', fontWeight: '800' }}>View</Text></View>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** Owner editor: build a collection from shop products and/or uploaded photos and videos. */
function HighlightEditor({ draft, setDraft, products, shopId, onSave, onClose, busy }) {
  const c = usePalette();
  const [uploading, setUploading] = useState(false);
  const has = id => draft.items.some(m => String(m.productId) === String(id));
  const toggleProduct = p => setDraft(d => ({
    ...d,
    items: has(p.id) ? d.items.filter(m => String(m.productId) !== String(p.id))
      : [...d.items, { url: p.imageUrl, type: 'image', productId: String(p.id), caption: '' }].slice(0, 20),
  }));
  const upload = async () => {
    setUploading(true);
    try {
      if (draft.items.length >= 20) throw new Error('A highlight can hold up to 20 slides.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize > 50 * 1024 * 1024) throw new Error('Choose a photo or video under 50 MB.');
      const form = new FormData();
      form.append('file', Platform.OS === 'web' ? asset.file : uploadAsset(asset));
      const { data } = await shopsApi.uploadMedia(shopId, form);
      setDraft(d => ({ ...d, items: [...d.items, { url: data.url, type: asset.type === 'video' ? 'video' : 'image', caption: '' }] }));
    } catch (e) { Alert.alert('Upload failed', errorMessage(e, e.message)); }
    finally { setUploading(false); }
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={s.editorHeader}>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Cancel"><Text style={{ color: c.muted, fontSize: 16 }}>Cancel</Text></TouchableOpacity>
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 17 }}>Highlight</Text>
          <TouchableOpacity onPress={onSave} disabled={busy || !draft.title.trim() || !draft.items.length} accessibilityLabel="Save highlight">
            {busy ? <ActivityIndicator color={PURPLE} /> : <Text style={{ color: !draft.title.trim() || !draft.items.length ? c.muted : PURPLE, fontWeight: '800', fontSize: 16 }}>Save</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
          <TextInput placeholder="Name (e.g. New in, Best sellers)" placeholderTextColor={c.muted} value={draft.title} maxLength={40} onChangeText={title => setDraft(d => ({ ...d, title }))}
            style={[s.input, { color: c.text, borderColor: c.line, backgroundColor: c.card }]} />

          <Text style={[s.label, { color: c.text }]}>Slides ({draft.items.length}/20)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {draft.items.map((m, i) => (
              <View key={m.url + i} style={s.slideThumb}>
                {m.type === 'video' ? <View style={[StyleSheet.absoluteFill, { backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }]}><Feather name="play" size={24} color="#FFF" /></View>
                  : <Image source={{ uri: mediaUrl(m.url) }} style={StyleSheet.absoluteFill} />}
                <TouchableOpacity accessibilityLabel={`Remove slide ${i + 1}`} onPress={() => setDraft(d => ({ ...d, items: d.items.filter((_, j) => j !== i) }))} style={s.removeBtn}><Feather name="x" size={14} color="#FFF" /></TouchableOpacity>
                {m.productId && <View style={s.tag}><Feather name="shopping-bag" size={10} color="#111" /></View>}
              </View>
            ))}
            <TouchableOpacity onPress={upload} disabled={uploading} style={[s.slideThumb, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: PURPLE, alignItems: 'center', justifyContent: 'center' }]}>
              {uploading ? <ActivityIndicator color={PURPLE} /> : <><Feather name="upload" size={22} color={PURPLE} /><Text style={{ color: PURPLE, fontSize: 11, marginTop: 4 }}>Photo/video</Text></>}
            </TouchableOpacity>
          </ScrollView>

          {products.length > 0 && <>
            <Text style={[s.label, { color: c.text }]}>Add from your products</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {products.filter(p => p.imageUrl).map(p => (
                <TouchableOpacity key={p.id} onPress={() => toggleProduct(p)} style={[s.productPick, { borderColor: has(p.id) ? PURPLE : c.line }]} accessibilityRole="checkbox" accessibilityState={{ checked: has(p.id) }}>
                  <Image source={{ uri: mediaUrl(p.imageUrl) }} style={{ width: '100%', aspectRatio: 1, borderRadius: 10 }} />
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{p.name}</Text>
                  {has(p.id) && <View style={s.check}><Feather name="check" size={14} color="#FFF" /></View>}
                </TouchableOpacity>
              ))}
            </View>
          </>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function ShopHighlights({ shop, isOwner, onSaved, onOpenProduct }) {
  const c = usePalette();
  const [viewing, setViewing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState({});
  const locked = useRef(false);
  const products = useMemo(() => shop.products || [], [shop.products]);
  const saved = useMemo(() => shop.highlights || [], [shop.highlights]);
  // Every shop showcases something: without saved highlights, its products become one.
  const collections = useMemo(() => {
    if (saved.length || isOwner) return saved;
    const items = products.filter(p => p.imageUrl).slice(0, 12).map(p => ({ url: p.imageUrl, type: 'image', productId: String(p.id) }));
    return items.length ? [{ id: 'auto-products', title: 'Shop', items }] : [];
  }, [saved, products, isOwner]);

  const save = async next => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try { const { data } = await shopsApi.update(shop.id, { highlights: next }); onSaved(data); setDraft(null); }
    catch (e) { Alert.alert('Could not save', errorMessage(e, 'Your edits are kept. Please try again.')); }
    finally { locked.current = false; setBusy(false); }
  };
  const openProduct = p => { setViewing(null); onOpenProduct?.(p); };

  if (!collections.length && !isOwner) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Highlights</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 8 }}>
        {isOwner && (
          <Pressable accessibilityRole="button" accessibilityLabel="New highlight" onPress={() => setDraft({ id: 'highlight-' + Date.now().toString(36), title: '', items: [] })} style={s.bubble}>
            <View style={[s.newRing, { borderColor: c.line }]}><Feather name="plus" size={26} color={PURPLE} /></View>
            <Text style={[s.bubbleText, { color: c.text }]}>New</Text>
          </Pressable>
        )}
        {collections.map(h => (
          <Pressable key={h.id} accessibilityRole="button" accessibilityLabel={`View ${h.title} highlight`} onPress={() => { setViewing(h); setSeen(v => ({ ...v, [h.id]: true })); }} style={s.bubble}>
            <Ring seen={seen[h.id]}>
              {h.items[0]?.type === 'video'
                ? <Feather name="play" size={24} color="#FFF" />
                : <Image source={{ uri: mediaUrl(h.items[0]?.url) }} style={{ width: 72, height: 72 }} />}
            </Ring>
            <Text style={[s.bubbleText, { color: c.text }]} numberOfLines={1}>{h.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {isOwner && !saved.length && <Text style={{ color: c.muted, fontSize: 12 }}>Showcase products, new arrivals or behind-the-scenes clips — they appear here for every visitor.</Text>}

      {viewing && (
        <StoryViewer
          collection={viewing}
          products={products}
          isOwner={isOwner && viewing.id !== 'auto-products'}
          onClose={() => setViewing(null)}
          onOpenProduct={openProduct}
          onEdit={() => { const h = viewing; setViewing(null); setDraft({ ...h, items: [...h.items] }); }}
          onDelete={() => Alert.alert('Delete highlight?', 'It will be removed from your shop.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { const h = viewing; setViewing(null); save(saved.filter(x => x.id !== h.id)); } },
          ])}
        />
      )}
      {draft && (
        <HighlightEditor
          draft={draft}
          setDraft={setDraft}
          products={products}
          shopId={shop.id}
          busy={busy}
          onClose={() => setDraft(null)}
          onSave={() => save([...saved.filter(x => x.id !== draft.id), { ...draft, title: draft.title.trim() }])}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bubble: { width: 84, alignItems: 'center', gap: 6 },
  bubbleText: { fontSize: 12, fontWeight: '600', maxWidth: 84 },
  newRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  fill: { height: 3, backgroundColor: '#FFF' },
  topBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: 'rgba(20,20,24,0.85)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.6)' },
  shopBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: LIME, paddingHorizontal: 14, minHeight: 38, borderRadius: 19 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 50, fontSize: 16 },
  label: { fontSize: 14, fontWeight: '800' },
  slideThumb: { width: 72, height: 108, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A1A1A' },
  removeBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  tag: { position: 'absolute', bottom: 4, left: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' },
  productPick: { width: '30%', borderWidth: 2, borderRadius: 14, padding: 6, gap: 4 },
  check: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
});
