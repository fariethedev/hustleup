import React, { useState, useEffect } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/authSlice';
import { storiesApi, API_URL } from '../../api/client';
import StoryViewer from './StoryViewer';
import CreateStoryModal from './CreateStoryModal';

const LIME = '#CDFF00';
const BG = '#050505';

const getServerBase = () =>
  (typeof API_URL !== 'undefined' && API_URL ? API_URL : 'http://localhost:8000/api/v1').replace('/api/v1', '');

const resolveUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:')) return url;
  const base = getServerBase();
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

// ─── Add Story Card ───────────────────────────────────────────────────────────
function AddStoryCard({ avatar, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.8} style={s.storyItem} onPress={onPress}>
      <View style={s.addCardOuter}>
        <View style={s.addCardInner}>
          {avatar ? (
            <Image source={{ uri: resolveUrl(avatar) }} style={s.addCardImage} />
          ) : (
            <View style={s.addCardFallback}>
              <Feather name="user" size={22} color="rgba(255,255,255,0.3)" />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={s.addCardGradient}
          />
        </View>
        <View style={s.addBtnWrap}>
          <LinearGradient colors={[LIME, '#A8E600']} style={s.addBtn}>
            <Feather name="plus" size={14} color={BG} />
          </LinearGradient>
        </View>
      </View>
      <Text style={s.addLabel}>Add Story</Text>
    </TouchableOpacity>
  );
}

// ─── Story Card ───────────────────────────────────────────────────────────────
function StoryCard({ item, onPress, isLive }) {
  const initials = item.name?.[0] || '?';
  const hasUnviewed = !item.allViewed && item.stories?.length > 0;
  const ringColors = hasUnviewed
    ? [LIME, '#60A5FA', LIME]
    : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.15)'];

  return (
    <TouchableOpacity activeOpacity={0.85} style={s.storyItem} onPress={onPress}>
      <LinearGradient colors={ringColors} style={s.storyRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={s.storyAvatarWrap}>
          {item.avatar ? (
            <Image source={{ uri: resolveUrl(item.avatar) }} style={s.storyAvatar} />
          ) : (
            <View style={[s.storyAvatar, s.storyInitials]}>
              <Text style={s.storyInitialsText}>{initials}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
      {isLive && (
        <View style={s.liveBadge}>
          <Text style={s.liveText}>LIVE</Text>
        </View>
      )}
      <Text style={[s.storyName, !hasUnviewed && s.storyNameViewed]} numberOfLines={1}>
        {item.name?.split(' ')[0] || 'User'}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main StoryBar ────────────────────────────────────────────────────────────
export default function StoryBar() {
  const [groupedStories, setGroupedStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedStories, setSelectedStories] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [createVisible, setCreateVisible] = useState(false);
  const currentUser = useSelector(selectUser);

  useEffect(() => {
    fetchStories();
  }, []);

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
        .filter(g => !g.isMine) // separate own stories
        .sort((a, b) => (a.allViewed === b.allViewed ? 0 : a.allViewed ? 1 : -1));

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
      <FlatList
        data={groupedStories}
        renderItem={({ item, index }) => (
          <StoryCard
            item={item}
            onPress={() => openViewer(item)}
            isLive={index === 0 && !item.allViewed}
          />
        )}
        keyExtractor={(item) => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        ListHeaderComponent={
          <AddStoryCard
            avatar={currentUser?.avatarUrl}
            onPress={() => setCreateVisible(true)}
          />
        }
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
    paddingVertical: 12,
  },
  loadingCenter: {
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
  },

  // Story item wrapper
  storyItem: {
    alignItems: 'center',
    width: 72,
  },

  // Add Story card
  addCardOuter: {
    width: 68, height: 68,
    borderRadius: 22,
    overflow: 'visible',
    position: 'relative',
  },
  addCardInner: {
    width: 68, height: 68,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  addCardImage: { width: '100%', height: '100%' },
  addCardFallback: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  addCardGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 30,
  },
  addBtnWrap: {
    position: 'absolute', bottom: -6, alignSelf: 'center',
  },
  addBtn: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: BG,
  },
  addLabel: {
    color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700',
    marginTop: 8, textAlign: 'center',
  },

  // Story ring
  storyRing: {
    width: 68, height: 68,
    borderRadius: 22,
    padding: 2.5,
  },
  storyAvatarWrap: {
    width: '100%', height: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  storyAvatar: {
    width: '100%', height: '100%',
  },
  storyInitials: {
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  storyInitialsText: {
    color: '#FFF', fontSize: 20, fontWeight: '900',
  },

  // Live badge
  liveBadge: {
    position: 'absolute', bottom: 18, alignSelf: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1.5, borderColor: BG,
  },
  liveText: {
    color: '#FFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.8,
  },

  // Name
  storyName: {
    color: '#FFF', fontSize: 10, fontWeight: '700',
    marginTop: 6, textAlign: 'center',
  },
  storyNameViewed: {
    color: 'rgba(255,255,255,0.35)',
  },
});
