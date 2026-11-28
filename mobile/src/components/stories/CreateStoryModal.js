import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableWithoutFeedback, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { storiesApi } from '../../api/client';
import { mediaUrl } from '../../utils/media';
import { CropHost, cropImage } from '../native/ImageCropper';

/** Backgrounds for text stories: bright brand colours that read well with white text. */
export const STORY_BACKGROUNDS = [
  ['#7C3AED', '#4C1D95'],
  ['#EC4899', '#9D174D'],
  ['#0EA5E9', '#075985'],
  ['#F97316', '#9A3412'],
  ['#10B981', '#065F46'],
  ['#111827', '#374151'],
];

const LIME = '#CDFF00';
const MODES = [['TEXT', 'type', 'Text'], ['IMAGE', 'image', 'Photo'], ['VIDEO', 'video', 'Video']];
const MAX_VIDEO_SECONDS = 60;
const MAX_BYTES = 95 * 1024 * 1024; // stays under the 100 MB edge upload limit

/** Plays the picked clip silently on a loop so the author sees exactly what they post. */
function VideoPreview({ uri }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />;
}

function GlassButton({ icon, label, onPress, disabled }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} hitSlop={8}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? '#00000080' : '#00000055', opacity: disabled ? 0.4 : 1 })}>
      <Feather name={icon} size={20} color="#FFF" />
    </Pressable>
  );
}

/**
 * Full-screen story composer. The canvas is the story exactly as people will see it
 * (9:16, edge to edge): type straight onto a gradient, or pick / shoot a photo or a clip
 * and caption it in place. Stories are immersive, so this screen stays dark in both themes.
 */
export default function CreateStoryModal({ visible, onClose, onCreated }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const user = useSelector(s => s.auth.user);
  const [mode, setMode] = useState('TEXT');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState(null); // { uri, mimeType, fileName }
  const [bgIndex, setBgIndex] = useState(0);
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  // The canvas keeps a 9:16 story shape and shrinks to leave room for the bars.
  const available = height - insets.top - insets.bottom - 92;
  const canvasW = Math.min(width, available * 9 / 16);
  const canvasH = canvasW * 16 / 9;

  const dirty = !!content.trim() || !!media;
  const reset = () => { setMode('TEXT'); setContent(''); setMedia(null); setBgIndex(0); setError(''); setProgress(0); };
  const close = () => {
    if (posting) return;
    if (!dirty) { reset(); onClose(); return; }
    Alert.alert('Discard this story?', 'What you have made so far will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { reset(); onClose(); } },
    ]);
  };

  const accept = async (result, kind) => {
    let asset = !result.canceled && result.assets?.[0];
    if (!asset) return;
    if (kind === 'IMAGE') { asset = await cropImage(asset, [9, 16]); if (!asset) return; }
    if (kind === 'VIDEO' && asset.duration && asset.duration / 1000 > MAX_VIDEO_SECONDS + 0.5) {
      setError(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds. Trim it and try again.`); return;
    }
    if (asset.fileSize && asset.fileSize > MAX_BYTES) { setError('That file is too large. Pick one under 95 MB.'); return; }
    setMedia({
      uri: asset.uri,
      mimeType: asset.mimeType || (kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
      fileName: asset.fileName || `story_${Date.now()}.${kind === 'VIDEO' ? 'mp4' : 'jpg'}`,
    });
    setError('');
  };

  const options = kind => ({
    mediaTypes: kind === 'VIDEO' ? ['videos'] : ['images'],
    quality: 0.85,
    allowsEditing: kind === 'VIDEO', // photos use the in-app cropper; videos keep the native trimmer
    videoMaxDuration: MAX_VIDEO_SECONDS,
  });

  const fromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted && permission.accessPrivileges !== 'limited') { setError('Allow photo access in your phone settings to add a story.'); return; }
    accept(await ImagePicker.launchImageLibraryAsync(options(mode)), mode);
  };
  const fromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setError('Allow camera access in your phone settings to take a story.'); return; }
    accept(await ImagePicker.launchCameraAsync(options(mode)), mode);
  };

  const switchMode = next => {
    if (next === mode) return;
    setMode(next); setMedia(null); setError('');
  };

  const canPost = mode === 'TEXT' ? content.trim().length > 0 : !!media;

  const post = async () => {
    if (!canPost || posting) return;
    Keyboard.dismiss();
    setError(''); setPosting(true); setProgress(0);
    try {
      const form = new FormData();
      form.append('type', mode);
      if (content.trim()) form.append('content', content.trim());
      if (mode === 'TEXT') form.append('background', STORY_BACKGROUNDS[bgIndex].join(','));
      if (media) form.append('media', { uri: media.uri, type: media.mimeType, name: media.fileName });
      await storiesApi.create(form, media ? setProgress : undefined);
      reset();
      onCreated?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.error || (e.code === 'ECONNABORTED' ? 'The upload took too long. Try a shorter clip or a better connection.' : 'Your story could not be posted. Please try again.'));
    } finally {
      setPosting(false);
    }
  };

  const avatar = mediaUrl(user?.avatarUrl);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#000' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 10), alignItems: 'center' }}>

          {/* ── Canvas: the story as it will look ── */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ width: canvasW, height: canvasH, borderRadius: 22, overflow: 'hidden', backgroundColor: '#111' }}>
              {mode === 'TEXT' && (
                <LinearGradient colors={STORY_BACKGROUNDS[bgIndex]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, justifyContent: 'center', padding: 28 }}>
                  <TextInput value={content} onChangeText={setContent} multiline maxLength={300} autoFocus textAlign="center"
                    placeholder="Type something…" placeholderTextColor="#FFFFFFA0" accessibilityLabel="Story text" selectionColor="#FFF"
                    style={{ color: '#FFF', fontSize: content.length > 120 ? 22 : content.length > 50 ? 27 : 32, lineHeight: content.length > 120 ? 30 : content.length > 50 ? 36 : 42, fontWeight: '700', textAlignVertical: 'center' }} />
                </LinearGradient>
              )}

              {mode !== 'TEXT' && media && (
                <>
                  {mode === 'VIDEO' ? <VideoPreview uri={media.uri} /> : <Image source={{ uri: media.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />}
                  <LinearGradient colors={['transparent', '#000000B0']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 60, paddingHorizontal: 16, paddingBottom: 16 }}>
                    <TextInput value={content} onChangeText={setContent} multiline maxLength={200} placeholder="Add a caption…" placeholderTextColor="#FFFFFFB0"
                      accessibilityLabel="Caption" selectionColor="#FFF"
                      style={{ color: '#FFF', fontSize: 17, lineHeight: 23, fontWeight: '600', maxHeight: 110 }} />
                  </LinearGradient>
                </>
              )}

              {mode !== 'TEXT' && !media && (
                <LinearGradient colors={['#1F1B2E', '#0B0B10']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 }}>
                  <View style={{ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF14' }}>
                    <Feather name={mode === 'VIDEO' ? 'film' : 'image'} size={32} color="#FFF" />
                  </View>
                  <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>{mode === 'VIDEO' ? 'Share a clip' : 'Share a photo'}</Text>
                  <Text style={{ color: '#FFFFFFA0', fontSize: 14, textAlign: 'center' }}>{mode === 'VIDEO' ? `Up to ${MAX_VIDEO_SECONDS} seconds.` : 'Crop it to fit the story.'}</Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                    <Pressable accessibilityRole="button" onPress={fromGallery} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 20, borderRadius: 24, backgroundColor: '#FFF', opacity: pressed ? 0.85 : 1 })}>
                      <Feather name="grid" size={17} color="#111" /><Text style={{ color: '#111', fontWeight: '800', fontSize: 15 }}>Gallery</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={fromCamera} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 20, borderRadius: 24, borderWidth: 1.5, borderColor: '#FFFFFF80', opacity: pressed ? 0.7 : 1 })}>
                      <Feather name={mode === 'VIDEO' ? 'video' : 'camera'} size={17} color="#FFF" /><Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>{mode === 'VIDEO' ? 'Record' : 'Camera'}</Text>
                    </Pressable>
                  </View>
                </LinearGradient>
              )}

              {/* Top controls over the canvas */}
              <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <GlassButton icon="x" label="Close" onPress={close} disabled={posting} />
                <View style={{ flex: 1 }} />
                {mode !== 'TEXT' && media && <GlassButton icon="refresh-cw" label="Choose another" onPress={fromGallery} disabled={posting} />}
                {mode !== 'TEXT' && media && <GlassButton icon="trash-2" label="Remove" onPress={() => setMedia(null)} disabled={posting} />}
                {mode === 'TEXT' && <Text style={{ color: '#FFFFFFC0', fontSize: 13, fontWeight: '700' }}>{content.length}/300</Text>}
              </View>

              {/* Background swatches sit on the canvas for text stories */}
              {mode === 'TEXT' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always"
                  style={{ position: 'absolute', bottom: 14, left: 0, right: 0 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 14, alignItems: 'center' }}>
                  {STORY_BACKGROUNDS.map((bg, i) => (
                    <Pressable key={bg[0]} accessibilityRole="radio" accessibilityLabel={`Background ${i + 1}`} accessibilityState={{ selected: bgIndex === i }} onPress={() => setBgIndex(i)}
                      style={{ width: bgIndex === i ? 38 : 32, height: bgIndex === i ? 38 : 32, borderRadius: 19, borderWidth: 2.5, borderColor: '#FFF', overflow: 'hidden' }}>
                      <LinearGradient colors={bg} style={{ flex: 1 }} />
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* Upload progress */}
              {posting && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000080', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <ActivityIndicator color="#FFF" size="large" />
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>{media && progress > 0 && progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : 'Sharing…'}</Text>
                  {!!media && <View style={{ width: '60%', height: 4, borderRadius: 2, backgroundColor: '#FFFFFF30', overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: LIME }} />
                  </View>}
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>

          {!!error && (
            <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ position: 'absolute', top: insets.top + 70, left: 24, right: 24, flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: '#B42332' }}>
              <Feather name="alert-circle" size={16} color="#FFF" />
              <Text style={{ flex: 1, color: '#FFF', fontSize: 14, fontWeight: '600' }}>{error}</Text>
              <Pressable onPress={() => setError('')} hitSlop={8} accessibilityLabel="Dismiss"><Feather name="x" size={16} color="#FFF" /></Pressable>
            </View>
          )}

          {/* ── Bottom bar: mode switch + share ── */}
          <View style={{ width: canvasW, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 4 }}>
            <View style={{ flex: 1, flexDirection: 'row', padding: 4, gap: 2, borderRadius: 24, backgroundColor: '#FFFFFF14' }}>
              {MODES.map(([key, icon, label]) => {
                const on = mode === key;
                return (
                  <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={() => switchMode(key)} disabled={posting}
                    style={{ flex: 1, height: 40, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: on ? '#FFF' : 'transparent' }}>
                    <Feather name={icon} size={15} color={on ? '#111' : '#FFFFFFB0'} />
                    <Text style={{ color: on ? '#111' : '#FFFFFFB0', fontWeight: '800', fontSize: 13 }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Share to your story" accessibilityState={{ disabled: !canPost || posting }} disabled={!canPost || posting} onPress={post}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingLeft: 6, paddingRight: 16, borderRadius: 24, backgroundColor: LIME, opacity: !canPost || posting ? 0.4 : pressed ? 0.85 : 1 })}>
              <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
                {avatar ? <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} /> : <Feather name="user" size={16} color={LIME} />}
              </View>
              <Text style={{ color: '#111', fontWeight: '900', fontSize: 14 }}>Your story</Text>
              <Feather name="chevron-right" size={16} color="#111" />
            </Pressable>
          </View>
          <Text style={{ color: '#FFFFFF70', fontSize: 11, marginTop: 6 }}>Disappears after 24 hours</Text>
        </View>
      </KeyboardAvoidingView>
      <CropHost />
    </Modal>
  );
}
