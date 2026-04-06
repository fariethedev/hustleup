import React, { useState, useEffect } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/authSlice';
import { storiesApi, API_URL } from '../../api/client';
import StoryViewer from './StoryViewer';
import CreateStoryModal from './CreateStoryModal';

const LIME = '#CDFF00';
const BG = '#050505';
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W * 0.28;   // ~28% of screen width per card
const CARD_H = CARD_W * 1.55;     // tall rectangle ratio

const getServerBase = () =>
  (typeof API_URL !== 'undefined' && API_URL ? API_URL : 'http://localhost:8000/api/v1').replace('/api/v1', '');

const resolveUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:')) return url;
  const base = getServerBase();
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

// ── Mock background images for stories (used when no real image exists) ───────
const STORY_BACKGROUNDS = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=500&fit=crop',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&h=500&fit=crop',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=300&h=500&fit=crop',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&h=500&fit=crop',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=500&fit=crop',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&h=500&fit=crop',
];

// ─── Add Story Card (WhatsApp-style tall rectangle) ───────────────────────────
function AddStoryCard({ avatar, myStories, onPress, onAddPress }) {
  const latestMyStory = myStories?.stories?.[myStories.stories.length - 1];
  const myStoryImg = latestMyStory?.mediaUrl ? resolveUrl(latestMyStory.mediaUrl) : null;
  const hasMyStory = !!myStories?.stories?.length;

  return (
    <TouchableOpacity activeOpacity={0.85} style={s.card} onPress={onPress}>
      <View style={[s.cardInner, hasMyStory && s.cardUnviewed]}>
        {/* Background — own story preview or avatar blur */}
        {myStoryImg ? (
          <Image source={{ uri: myStoryImg }} style={s.cardBg} resizeMode="cover" />
        ) : avatar ? (
          <Image source={{ uri: resolveUrl(avatar) }} style={s.cardBg} blurRadius={3} />
        ) : (
          <LinearGradient colors={['#1A1A1A', '#0A0A0A']} style={s.cardBg} />
        )}

        {/* Dark overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.75)']}
          style={s.cardOverlay}
        />

        {/* Plus icon — tapping it always opens create modal */}
        <TouchableOpacity style={s.addIconWrap} onPress={onAddPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <LinearGradient colors={[LIME, '#A8E600']} style={s.addIconCircle}>
            <Feather name="plus" size={22} color={BG} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Label */}
        <View style={s.cardBottom}>
          <Text style={s.addText}>{hasMyStory ? 'My\nStory' : 'Add\nStory'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Story Card (WhatsApp-style tall rectangle) ──────────────────────────────
function StoryCard({ item, onPress, index }) {
  const initials = item.name?.[0] || '?';
  const hasUnviewed = !item.allViewed && item.stories?.length > 0;
  const latestStory = item.stories?.[item.stories.length - 1];
  const storyImageUrl = latestStory?.mediaUrl ? resolveUrl(latestStory.mediaUrl) : null;
  const fallbackBg = STORY_BACKGROUNDS[index % STORY_BACKGROUNDS.length];
  const storyCount = item.stories?.length || 0;
  const timeAgo = latestStory?.createdAt ? getTimeAgo(latestStory.createdAt) : '';

  return (
    <TouchableOpacity activeOpacity={0.85} style={s.card} onPress={onPress}>
      <View style={[s.cardInner, hasUnviewed && s.cardUnviewed]}>
        {/* Background image */}
        <Image
          source={{ uri: storyImageUrl || fallbackBg }}
          style={s.cardBg}
          resizeMode="cover"
        />

        {/* Gradient overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.75)']}
          style={s.cardOverlay}
        />

        {/* Unviewed ring indicator (top-left) */}
        {hasUnviewed && (
          <View style={s.unviewedDot} />
        )}

        {/* Story count badge */}
        {storyCount > 1 && (
          <View style={s.countBadge}>
            <Text style={s.countText}>{storyCount}</Text>
          </View>
        )}

        {/* Bottom: avatar + name + time */}
        <View style={s.cardBottom}>
          <View style={[s.avatarMini, hasUnviewed && s.avatarMiniActive]}>
            {item.avatar ? (
              <Image source={{ uri: resolveUrl(item.avatar) }} style={s.avatarMiniImg} />
            ) : (
              <Text style={s.avatarMiniText}>{initials}</Text>
            )}
          </View>
          <Text style={[s.cardName, !hasUnviewed && s.cardNameViewed]} numberOfLines={1}>
            {item.name?.split(' ')[0] || 'User'}
          </Text>
          {!!timeAgo && (
            <Text style={s.cardTime}>{timeAgo}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getTimeAgo(dateStr) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  } catch {
    return '';
  }
}

// ─── Main StoryBar ────────────────────────────────────────────────────────────
export default function StoryBar({ triggerCreate = false, onTriggerHandled }) {
  const [groupedStories, setGroupedStories] = useState([]);
  const [myStories, setMyStories] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedStories, setSelectedStories] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [createVisible, setCreateVisible] = useState(false);
  const currentUser = useSelector(selectUser);

  useEffect(() => {
    fetchStories();
  }, []);

  useEffect(() => {
    if (triggerCreate) {
      setCreateVisible(true);
      onTriggerHandled?.();
    }
  }, [triggerCreate]);

  const fetchStories = async () => {
    try {
      setLoading(true);
      const res = await storiesApi.getAll();
      const allStories = res.data;

      const groups = allStories.reduce((acc, story) => {
        if (!acc[story.authorId]) {
          acc[story.authorId] = {
            id: story.authorId,
            name: story.authorName,
            avatar: story.authorAvatarUrl,
            stories: [],
            isMine: story.authorId === currentUser?.id,
          };
        }
        acc[story.authorId].stories.push(story);
        return acc;
      }, {});

      Object.values(groups).forEach(g => {
        g.allViewed = g.isMine
          ? false
          : g.stories.length > 0 && g.stories.every(s => s.viewedByCurrentUser);
        g.hasStory = g.stories.length > 0;
      });

      let sortedGroups = Object.values(groups)
        .filter(g => !g.isMine)
        .sort((a, b) => (a.allViewed === b.allViewed ? 0 : a.allViewed ? 1 : -1));

      const myGroup = Object.values(groups).find(g => g.isMine) || null;

      setMyStories(myGroup);
      setGroupedStories(sortedGroups);
    } catch (error) {
      console.error('Failed to fetch stories:', error);
      setGroupedStories([]);
    } finally {
      setLoading(false);
    }
  };

  const openViewer = (group) => {
    if (group.stories.length > 0) {
      setSelectedStories(group.stories);
      setSelectedGroupId(group.id);
      setViewerVisible(true);
    }
  };

  const handleViewerClose = () => {
    setViewerVisible(false);
    if (selectedGroupId) {
      setGroupedStories(prev =>
        prev.map(g => g.id === selectedGroupId && !g.isMine ? { ...g, allViewed: true } : g)
      );
    }
  };

  if (loading && groupedStories.length === 0) {
    return (
      <View style={[s.container, s.loadingCenter]}>
        <ActivityIndicator color={LIME} size="small" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Section header */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Stories</Text>
        {groupedStories.length > 0 && (
          <Text style={s.sectionCount}>{groupedStories.length} new</Text>
        )}
      </View>

      <FlatList
        data={groupedStories}
        renderItem={({ item, index }) => (
          <StoryCard
            item={item}
            index={index}
            onPress={() => openViewer(item)}
          />
        )}
        keyExtractor={(item) => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        ListHeaderComponent={
          <AddStoryCard
            avatar={currentUser?.avatarUrl}
            myStories={myStories}
            onPress={() => myStories ? openViewer(myStories) : setCreateVisible(true)}
            onAddPress={() => setCreateVisible(true)}
          />
        }
        snapToInterval={CARD_W + 10}
        decelerationRate="fast"
      />

      <StoryViewer
        visible={viewerVisible}
        stories={selectedStories}
        onClose={handleViewerClose}
      />

      <CreateStoryModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={fetchStories}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 14,
  },
  loadingCenter: {
    height: CARD_H + 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  sectionCount: {
    color: LIME,
    fontSize: 12,
    fontWeight: '700',
  },

  listContent: {
    paddingHorizontal: 14,
    gap: 10,
  },

  // Card shared
  card: {
    width: CARD_W,
    height: CARD_H,
  },
  cardInner: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardUnviewed: {
    borderColor: LIME,
    borderWidth: 2,
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // Unviewed dot
  unviewedDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LIME,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.5)',
  },

  // Count badge
  countBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },

  // Bottom section (avatar + name)
  cardBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
  },
  avatarMini: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarMiniActive: {
    borderColor: LIME,
  },
  avatarMiniImg: {
    width: '100%',
    height: '100%',
  },
  avatarMiniText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  cardName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
  },
  cardNameViewed: {
    color: 'rgba(255,255,255,0.45)',
  },
  cardTime: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },

  // Add story card
  addIconWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  addText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
  },
});
