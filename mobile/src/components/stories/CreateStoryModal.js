import React, { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { storiesApi } from '../../api/client';
import { Copy, fonts, LIME, usePalette } from '../native/Kit';

/** Backgrounds for text stories: bright brand colours that read well with white text. */
export const STORY_BACKGROUNDS = [
  ['#7C3AED', '#4C1D95'],
  ['#111827', '#374151'],
  ['#EC4899', '#9D174D'],
  ['#0EA5E9', '#075985'],
  ['#F97316', '#9A3412'],
];

const TYPES = [['TEXT', 'type', 'Text'], ['IMAGE', 'image', 'Photo'], ['VIDEO', 'film', 'Video']];

/** Plays the picked clip silently on a loop so the author sees exactly what they post. */
function VideoPreview({ uri }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />;
}

export default function CreateStoryModal({ visible, onClose, onCreated }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const [type, setType] = useState('TEXT');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState(null); // { uri, mimeType, fileName }
  const [bgIndex, setBgIndex] = useState(0);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setType('TEXT'); setContent(''); setMedia(null); setBgIndex(0); setError(''); };
  const close = () => { if (posting) return; reset(); onClose(); };

  const fromAsset = (asset, kind) => ({
    uri: asset.uri,
    mimeType: asset.mimeType || (kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
    fileName: asset.fileName || `story_${Date.now()}.${kind === 'VIDEO' ? 'mp4' : 'jpg'}`,
  });

  const pick = async (kind) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted && permission.accessPrivileges !== 'limited') {
      setError('Allow photo access in your phone settings to add a story.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'VIDEO' ? ['videos'] : ['images'],
      quality: 0.85,
      allowsEditing: kind !== 'VIDEO',
      aspect: [9, 16],
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets?.[0]) { setMedia(fromAsset(result.assets[0], kind)); setError(''); }
  };

  const camera = async (kind) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setError('Allow camera access in your phone settings to take a story.'); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: kind === 'VIDEO' ? ['videos'] : ['images'],
      quality: 0.85,
      allowsEditing: kind !== 'VIDEO',
      aspect: [9, 16],
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets?.[0]) { setMedia(fromAsset(result.assets[0], kind)); setError(''); }
  };

  const post = async () => {
    setError('');
    if (type === 'TEXT' && !content.trim()) { setError('Write something for your story.'); return; }
    if (type !== 'TEXT' && !media) { setError(`Choose a ${type === 'VIDEO' ? 'video' : 'photo'} first.`); return; }
    setPosting(true);
    try {
      const form = new FormData();
      form.append('type', type);
      if (content.trim()) form.append('content', content.trim());
      if (type === 'TEXT') form.append('background', STORY_BACKGROUNDS[bgIndex].join(','));
      if (media) form.append('media', { uri: media.uri, type: media.mimeType, name: media.fileName });
      await storiesApi.create(form);
      reset();
      onCreated?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.error || 'Your story could not be posted. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const canPost = type === 'TEXT' ? content.trim().length > 0 : !!media;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
              <Feather name="x" size={20} color={c.text} />
            </Pressable>
            <Copy heading style={{ flex: 1, fontSize: 20 }}>New story</Copy>
            <Pressable accessibilityRole="button" accessibilityLabel="Share story" accessibilityState={{ disabled: !canPost || posting }} disabled={!canPost || posting} onPress={post}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: LIME, opacity: !canPost || posting ? 0.45 : pressed ? 0.85 : 1 })}>
              {posting ? <ActivityIndicator color="#1A2405" /> : <><Feather name="send" size={16} color="#1A2405" /><Copy style={{ color: '#111111', fontFamily: fonts.medium, fontSize: 15 }}>Share</Copy></>}
            </Pressable>
          </View>

          {/* Type switch */}
          <View style={{ flexDirection: 'row', marginHorizontal: 16, padding: 4, gap: 4, borderRadius: 16, backgroundColor: c.soft }}>
            {TYPES.map(([key, icon, label]) => {
              const on = type === key;
              return (
                <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setType(key); setMedia(null); setError(''); }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12, backgroundColor: on ? c.card : 'transparent', borderWidth: on ? 1 : 0, borderColor: c.line }}>
                  <Feather name={icon} size={16} color={on ? c.accent : c.muted} />
                  <Copy style={{ fontSize: 15, fontFamily: on ? fonts.medium : fonts.body, color: on ? c.text : c.muted }}>{label}</Copy>
                </Pressable>
              );
            })}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {!!error && (
              <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: '#FDECEE', borderWidth: 1, borderColor: '#F5C2C7' }}>
                <Feather name="alert-circle" size={16} color={c.danger || '#B42332'} />
                <Copy style={{ flex: 1, color: c.danger || '#B42332', fontSize: 14 }}>{error}</Copy>
              </View>
            )}

            {type === 'TEXT' && (
              <>
                <LinearGradient colors={STORY_BACKGROUNDS[bgIndex]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ aspectRatio: 9 / 14, maxHeight: 460, borderRadius: 28, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <TextInput value={content} onChangeText={setContent} multiline maxLength={300} autoFocus textAlign="center"
                    placeholder="What's on your mind?" placeholderTextColor="#FFFFFFAA" accessibilityLabel="Story text"
                    style={{ width: '100%', color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 26, lineHeight: 34 }} />
                </LinearGradient>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {STORY_BACKGROUNDS.map((bg, i) => (
                      <Pressable key={bg[0]} accessibilityRole="radio" accessibilityLabel={`Background ${i + 1}`} accessibilityState={{ selected: bgIndex === i }} onPress={() => setBgIndex(i)}
                        style={{ width: 36, height: 36, borderRadius: 18, padding: 3, borderWidth: 2, borderColor: bgIndex === i ? c.text : 'transparent' }}>
                        <LinearGradient colors={bg} style={{ flex: 1, borderRadius: 15 }} />
                      </Pressable>
                    ))}
                  </View>
                  <Copy muted style={{ fontSize: 13 }}>{content.length}/300</Copy>
                </View>
              </>
            )}

            {type !== 'TEXT' && (
              media ? (
                <View style={{ gap: 12 }}>
                  <View style={{ aspectRatio: 9 / 14, maxHeight: 460, borderRadius: 28, overflow: 'hidden', backgroundColor: c.soft }}>
                    {type === 'VIDEO' ? <VideoPreview uri={media.uri} /> : <Image source={{ uri: media.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />}
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => setMedia(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
                    <Feather name="refresh-cw" size={15} color={c.text} /><Copy style={{ fontSize: 14 }}>Choose another</Copy>
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[['library', type === 'VIDEO' ? 'film' : 'image', 'From gallery', () => pick(type)],
                    ['camera', type === 'VIDEO' ? 'video' : 'camera', type === 'VIDEO' ? 'Record' : 'Take photo', () => camera(type)]].map(([key, icon, label, onPress]) => (
                    <Pressable key={key} accessibilityRole="button" onPress={onPress}
                      style={({ pressed }) => ({ flex: 1, aspectRatio: 0.9, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: pressed ? c.soft : c.card, borderWidth: 1, borderColor: c.line })}>
                      <View style={{ width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft }}>
                        <Feather name={icon} size={26} color={c.accent} />
                      </View>
                      <Copy style={{ fontFamily: fonts.medium, fontSize: 15 }}>{label}</Copy>
                    </Pressable>
                  ))}
                </View>
              )
            )}

            {type !== 'TEXT' && (
              <View style={{ gap: 8 }}>
                <Copy style={{ color: c.muted, fontFamily: fonts.medium, fontSize: 13 }}>Caption (optional)</Copy>
                <TextInput value={content} onChangeText={setContent} multiline maxLength={200} placeholder="Say something about it…" placeholderTextColor={c.muted}
                  style={{ minHeight: 80, textAlignVertical: 'top', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.text, fontFamily: fonts.body, fontSize: 16 }} />
              </View>
            )}
            <Copy muted style={{ fontSize: 13, textAlign: 'center' }}>Stories disappear after 24 hours.</Copy>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
