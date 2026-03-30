import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import StoryBar from '../../src/components/stories/StoryBar';

const partners = [
  { id: '1', name: 'Marcus Reed', lastMsg: 'Can you do pickup tomorrow?', online: true, verified: true },
  { id: '2', name: 'HustleUp Admin', lastMsg: 'Welcome to the marketplace.', online: false, verified: true },
];

const MEDIA_LABELS = {
  photos: 'photo',
  videos: 'video',
};

function formatBytes(fileSize) {
  if (!fileSize) return null;
  if (fileSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(fileSize / 1024))} KB`;
  }

  return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(durationMs) {
  if (!durationMs) return null;
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function MessagesScreen() {
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [pickerMode, setPickerMode] = useState('photos');
  const [isPicking, setIsPicking] = useState(false);

  const openPicker = async (mode) => {
    if (isPicking) return;

    setPickerMode(mode);
    setIsPicking(true);

    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Permission needed',
            'Allow photo library access to attach photos or videos in messages.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mode === 'photos' ? ['images'] : ['videos'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 1,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setSelectedMedia((current) => {
        const next = [...current];

        result.assets.forEach((asset, index) => {
          const id = asset.assetId || `${asset.uri}-${Date.now()}-${index}`;
          const alreadyAdded = next.some((item) => item.id === id || item.uri === asset.uri);

          if (!alreadyAdded) {
            next.push({
              id,
              uri: asset.uri,
              type: asset.type === 'video' ? 'video' : 'image',
              fileName: asset.fileName || `${MEDIA_LABELS[mode]}-${next.length + 1}`,
              fileSize: asset.fileSize || null,
              duration: asset.duration || null,
              mimeType: asset.mimeType || null,
            });
          }
        });

        return next;
      });
    } catch (_error) {
      Alert.alert('Picker error', 'The media picker could not open. Please try again.');
    } finally {
      setIsPicking(false);
    }
  };

  const removeMedia = (id) => {
    setSelectedMedia((current) => current.filter((item) => item.id !== id));
  };

  const renderComposer = () => (
    <View style={styles.composerSection}>
      <View style={styles.composerCard}>
        <View style={styles.composerTopRow}>
          <View style={styles.composerCopy}>
            <Text style={styles.composerTitle}>Share in DM</Text>
            <Text style={styles.composerBody}>
              Choose photos or videos first, then attach what you want before opening a chat.
            </Text>
          </View>

          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeValue}>{selectedMedia.length}</Text>
            <Text style={styles.queueBadgeLabel}>Queued</Text>
          </View>
        </View>

        <View style={styles.mediaActionsRow}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.mediaAction,
              pickerMode === 'photos' && styles.mediaActionActive,
            ]}
            onPress={() => openPicker('photos')}
          >
            <Feather
              name="image"
              size={20}
              color={pickerMode === 'photos' ? '#CDFF00' : '#FFFFFF'}
            />
            <Text style={styles.mediaActionTitle}>Photos</Text>
            <Text style={styles.mediaActionText}>Tap to choose from gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.mediaAction,
              pickerMode === 'videos' && styles.mediaActionActive,
            ]}
            onPress={() => openPicker('videos')}
          >
            <Feather
              name="film"
              size={20}
              color={pickerMode === 'videos' ? '#CDFF00' : '#FFFFFF'}
            />
            <Text style={styles.mediaActionTitle}>Videos</Text>
            <Text style={styles.mediaActionText}>Pick clips and updates</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.selectionCard}>
          <View style={styles.selectionHeader}>
            <Text style={styles.selectionTitle}>Selected media</Text>
            {selectedMedia.length ? (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedMedia([])}>
                <Text style={styles.clearText}>Clear all</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {selectedMedia.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectionScroller}
            >
              {selectedMedia.map((item) => (
                <View key={item.id} style={styles.mediaPreviewCard}>
                  <View style={styles.mediaPreview}>
                    {item.type === 'image' ? (
                      <Image source={{ uri: item.uri }} style={styles.mediaPreviewImage} />
                    ) : (
                      <View style={styles.videoFallback}>
                        <Feather name="play-circle" size={28} color="#CDFF00" />
                        <Text style={styles.videoFallbackText}>
                          {formatDuration(item.duration) || 'Video'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.removeButton}
                    onPress={() => removeMedia(item.id)}
                  >
                    <Feather name="x" size={12} color="#050505" />
                  </TouchableOpacity>

                  <Text numberOfLines={1} style={styles.mediaPreviewName}>
                    {item.fileName}
                  </Text>
                  <Text numberOfLines={1} style={styles.mediaPreviewMeta}>
                    {item.type === 'video' ? 'Video' : 'Photo'}
                    {formatBytes(item.fileSize) ? `  •  ${formatBytes(item.fileSize)}` : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptySelection}>
              <Feather name="paperclip" size={18} color="#71717A" />
              <Text style={styles.emptySelectionText}>
                No media selected yet. Use Photos or Videos above.
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.storyBarWrap}>
        <StoryBar />
      </View>
    </View>
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity activeOpacity={0.85} style={styles.threadCard}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name[0]}</Text>
        </View>
        {item.online ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.threadMeta}>
        <View style={styles.threadTitleRow}>
          <Text style={styles.threadTitle}>{item.name}</Text>
          {item.verified ? <Feather name="check-circle" size={14} color="#CDFF00" /> : null}
        </View>
        <Text style={styles.threadSubtitle}>{item.lastMsg}</Text>
      </View>

      <Feather name="chevron-right" size={16} color="#3F3F46" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <FlatList
        data={partners}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderComposer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="message-circle" size={44} color="#CDFF00" />
            <Text style={styles.emptyText}>No conversations yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 84,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: '#CDFF00',
    fontSize: 30,
    fontWeight: '900',
  },
  listContent: {
    paddingBottom: 24,
  },
  composerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },
  composerCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#101010',
    padding: 18,
  },
  composerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  composerCopy: {
    flex: 1,
  },
  composerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  composerBody: {
    marginTop: 10,
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  queueBadge: {
    minWidth: 74,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.18)',
    alignItems: 'center',
  },
  queueBadgeValue: {
    color: '#CDFF00',
    fontSize: 22,
    fontWeight: '900',
  },
  queueBadgeLabel: {
    marginTop: 2,
    color: '#71717A',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mediaActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  mediaAction: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mediaActionActive: {
    borderColor: 'rgba(205,255,0,0.5)',
    backgroundColor: 'rgba(205,255,0,0.08)',
  },
  mediaActionTitle: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  mediaActionText: {
    marginTop: 6,
    color: '#71717A',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  selectionCard: {
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectionTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clearText: {
    color: '#CDFF00',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  selectionScroller: {
    paddingTop: 14,
    paddingRight: 6,
  },
  mediaPreviewCard: {
    width: 132,
    marginRight: 12,
  },
  mediaPreview: {
    height: 120,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  mediaPreviewImage: {
    width: '100%',
    height: '100%',
  },
  videoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  videoFallbackText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#CDFF00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPreviewName: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  mediaPreviewMeta: {
    marginTop: 4,
    color: '#71717A',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  emptySelection: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 10,
  },
  emptySelectionText: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  storyBarWrap: {
    marginTop: -14,
    marginHorizontal: 8,
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    top: -1,
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#050505',
  },
  threadMeta: {
    flex: 1,
    gap: 4,
  },
  threadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  threadTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  threadSubtitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyState: {
    marginTop: 48,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
