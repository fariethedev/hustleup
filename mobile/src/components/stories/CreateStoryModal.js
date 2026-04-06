import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { storiesApi } from '../../api/client';

const LIME = '#CDFF00';
const BG   = '#050505';

const TEXT_BACKGROUNDS = [
  ['#0F0F0F', '#1A1A1A'],
  ['#0D1F0D', '#1A3A1A'],
  ['#0D1527', '#1A2E4F'],
  ['#1F0D0D', '#3A1A1A'],
  ['#1A1A0D', '#2E2E1A'],
];

export default function CreateStoryModal({ visible, onClose, onCreated }) {
  const insets = useSafeAreaInsets();
  const [type, setType]         = useState('TEXT');
  const [content, setContent]   = useState('');
  const [media, setMedia]       = useState(null);   // { uri, mimeType, fileName }
  const [bgIndex, setBgIndex]   = useState(0);
  const [posting, setPosting]   = useState(false);
  const [error, setError]       = useState('');

  const reset = () => {
    setType('TEXT');
    setContent('');
    setMedia(null);
    setBgIndex(0);
    setError('');
  };

  const handleClose = () => { reset(); onClose(); };

  // ── pick image / video ───────────────────────────────────────────────────
  const pickMedia = async (mediaType) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted && permission.status !== 'limited') {
      setError('Gallery permission required. Enable it in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType === 'VIDEO'
        ? 'videos'
        : 'images',
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        mimeType: asset.mimeType || (mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
        fileName: asset.fileName || `story_${Date.now()}.${mediaType === 'VIDEO' ? 'mp4' : 'jpg'}`,
      });
      setError('');
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission required. Enable it in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName || `story_${Date.now()}.jpg`,
      });
      setError('');
    }
  };

  // ── post story ───────────────────────────────────────────────────────────
  const handlePost = async () => {
    setError('');
    if (type === 'TEXT' && !content.trim()) {
      setError('Please write something for your story.');
      return;
    }
    if ((type === 'IMAGE' || type === 'VIDEO') && !media) {
      setError(`Please select a ${type.toLowerCase()} first.`);
      return;
    }
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('type', type);
      if (content.trim()) formData.append('content', content.trim());
      if (media) {
        formData.append('media', {
          uri: media.uri,
          type: media.mimeType,
          name: media.fileName,
        });
      }
      await storiesApi.create(formData);
      reset();
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post story. Try again.');
    } finally {
      setPosting(false);
    }
  };

  const canPost = type === 'TEXT' ? content.trim().length > 0 : !!media;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Story</Text>
            <TouchableOpacity
              style={[styles.postBtn, (!canPost || posting) && styles.postBtnDisabled]}
              onPress={handlePost}
              disabled={!canPost || posting}
              activeOpacity={0.8}
            >
              {posting
                ? <ActivityIndicator size="small" color={BG} />
                : <Text style={styles.postBtnText}>POST</Text>}
            </TouchableOpacity>
          </View>

          {/* ── Type Tabs ── */}
          <View style={styles.typeTabs}>
            {['TEXT', 'IMAGE', 'VIDEO'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeTab, type === t && styles.typeTabActive]}
                onPress={() => { setType(t); setMedia(null); setError(''); }}
                activeOpacity={0.8}
              >
                <Feather
                  name={t === 'TEXT' ? 'type' : t === 'IMAGE' ? 'image' : 'film'}
                  size={14}
                  color={type === t ? BG : '#555'}
                />
                <Text style={[styles.typeTabText, type === t && styles.typeTabTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Error ── */}
            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={13} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* ── TEXT ── */}
            {type === 'TEXT' && (
              <>
                {/* Background picker */}
                <View style={styles.bgRow}>
                  <Text style={styles.bgLabel}>BACKGROUND</Text>
                  <View style={styles.bgSwatch}>
                    {TEXT_BACKGROUNDS.map((bg, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.bgDot,
                          { backgroundColor: bg[1] },
                          bgIndex === i && styles.bgDotActive,
                        ]}
                        onPress={() => setBgIndex(i)}
                      />
                    ))}
                  </View>
                </View>

                {/* Preview card */}
                <View style={[styles.textPreview, {
                  backgroundColor: TEXT_BACKGROUNDS[bgIndex][0],
                  borderColor: TEXT_BACKGROUNDS[bgIndex][1],
                }]}>
                  <TextInput
                    style={styles.textStoryInput}
                    placeholder="What's on your mind?"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={content}
                    onChangeText={setContent}
                    multiline
                    maxLength={300}
                    textAlign="center"
                    autoFocus
                  />
                </View>
                <Text style={styles.charCount}>{content.length}/300</Text>
              </>
            )}

            {/* ── IMAGE ── */}
            {type === 'IMAGE' && (
              <>
                {media ? (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: media.uri }} style={styles.mediaPreview} resizeMode="cover" />
                    <TouchableOpacity style={styles.replaceBtn} onPress={() => setMedia(null)}>
                      <Feather name="x" size={14} color="#FFF" />
                      <Text style={styles.replaceBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.pickerArea}>
                    <TouchableOpacity style={styles.pickerOption} onPress={() => pickMedia('IMAGE')} activeOpacity={0.8}>
                      <View style={styles.pickerIcon}>
                        <Feather name="image" size={24} color={LIME} />
                      </View>
                      <Text style={styles.pickerOptionTitle}>Choose from Gallery</Text>
                      <Text style={styles.pickerOptionSub}>JPG, PNG, WEBP</Text>
                    </TouchableOpacity>

                    <View style={styles.pickerDivider} />

                    <TouchableOpacity style={styles.pickerOption} onPress={takePhoto} activeOpacity={0.8}>
                      <View style={styles.pickerIcon}>
                        <Feather name="camera" size={24} color={LIME} />
                      </View>
                      <Text style={styles.pickerOptionTitle}>Take a Photo</Text>
                      <Text style={styles.pickerOptionSub}>Use your camera</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Optional caption */}
                <View style={styles.captionWrap}>
                  <Text style={styles.captionLabel}>CAPTION (optional)</Text>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Add a caption..."
                    placeholderTextColor="#444"
                    value={content}
                    onChangeText={setContent}
                    maxLength={200}
                    multiline
                  />
                </View>
              </>
            )}

            {/* ── VIDEO ── */}
            {type === 'VIDEO' && (
              <>
                {media ? (
                  <View style={styles.previewWrap}>
                    <View style={styles.videoPreviewBox}>
                      <Feather name="video" size={36} color={LIME} />
                      <Text style={styles.videoFileName} numberOfLines={1}>{media.fileName}</Text>
                      <Text style={styles.videoReady}>Video ready to post</Text>
                    </View>
                    <TouchableOpacity style={styles.replaceBtn} onPress={() => setMedia(null)}>
                      <Feather name="x" size={14} color="#FFF" />
                      <Text style={styles.replaceBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.pickerArea} onPress={() => pickMedia('VIDEO')} activeOpacity={0.8}>
                    <View style={styles.pickerIcon}>
                      <Feather name="film" size={32} color={LIME} />
                    </View>
                    <Text style={styles.pickerOptionTitle}>Choose a Video</Text>
                    <Text style={styles.pickerOptionSub}>MP4, MOV — max 60s recommended</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.captionWrap}>
                  <Text style={styles.captionLabel}>CAPTION (optional)</Text>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Add a caption..."
                    placeholderTextColor="#444"
                    value={content}
                    onChangeText={setContent}
                    maxLength={200}
                    multiline
                  />
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  postBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: LIME, borderRadius: 12,
  },
  postBtnDisabled: { opacity: 0.35 },
  postBtnText: { color: BG, fontWeight: '900', fontSize: 12, letterSpacing: 1 },

  typeTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 4,
    gap: 4,
  },
  typeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  typeTabActive: { backgroundColor: LIME },
  typeTabText: { color: '#555', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  typeTabTextActive: { color: BG },

  body: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)', borderRadius: 12, padding: 12,
  },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '700', flex: 1 },

  // TEXT styles
  bgLabel: { color: '#444', fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  bgRow: {},
  bgSwatch: { flexDirection: 'row', gap: 10 },
  bgDot: {
    width: 28, height: 28, borderRadius: 999,
    borderWidth: 2, borderColor: 'transparent',
  },
  bgDotActive: { borderColor: LIME },
  textPreview: {
    minHeight: 220, borderRadius: 20,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  textStoryInput: {
    color: '#FFF', fontSize: 22, fontWeight: '700',
    lineHeight: 30, width: '100%',
  },
  charCount: { color: '#333', fontSize: 10, fontWeight: '700', textAlign: 'right' },

  // IMAGE/VIDEO picker
  pickerArea: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, padding: 28,
    alignItems: 'center', gap: 10,
  },
  pickerOption: { width: '100%', alignItems: 'center', gap: 8 },
  pickerDivider: {
    width: '100%', height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 8,
  },
  pickerIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(205,255,0,0.08)',
    borderWidth: 1, borderColor: 'rgba(205,255,0,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  pickerOptionTitle: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  pickerOptionSub: { color: '#444', fontSize: 11, fontWeight: '600' },

  // Preview
  previewWrap: { gap: 12 },
  mediaPreview: {
    width: '100%', aspectRatio: 9 / 16,
    borderRadius: 20, backgroundColor: '#111',
    maxHeight: 360,
  },
  videoPreviewBox: {
    height: 180, borderRadius: 20,
    backgroundColor: 'rgba(205,255,0,0.06)',
    borderWidth: 1, borderColor: 'rgba(205,255,0,0.2)',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  videoFileName: { color: '#FFF', fontSize: 12, fontWeight: '700', maxWidth: 240 },
  videoReady: { color: LIME, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  replaceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  replaceBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Caption
  captionWrap: { gap: 8 },
  captionLabel: { color: '#444', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    color: '#FFF', fontSize: 14, minHeight: 80,
    textAlignVertical: 'top',
  },
});
