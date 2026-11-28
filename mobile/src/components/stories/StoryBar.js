import React, { useState, useEffect } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Dimensions } from 'react-native';
import { Feather } from '../native/Icon';
import { usePalette } from '../native/Kit';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/authSlice';
import { storiesApi, API_URL } from '../../api/client';
import StoryViewer from './StoryViewer';
import CreateStoryModal from './CreateStoryModal';

const LIME = '#CDFF00';
const BG = '#050505';
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = 80;   // ~28% of screen width per card
const CARD_H = 94;     // tall rectangle ratio

const getServerBase = () =>
  (typeof API_URL !== 'undefined' && API_URL ? API_URL : 'http://localhost:8000/api/v1').replace('/api/v1', '');

const resolveUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:')) return url;
  const base = getServerBase();
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

function StoryCircle({ image, name, active, onPress, onAddPress }) {
  const c = usePalette();
  return <View style={{ width: 80, alignItems: 'center', gap: 6 }}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={name} onPress={onPress} style={{ width: 76, height: 76, borderRadius: 38, padding: 4, borderWidth: 2, borderColor: active ? LIME : c.line }}>
      <View style={{ flex: 1, borderRadius: 34, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft }}>
        {image ? <Image source={{ uri: resolveUrl(image) }} style={{ width: '100%', height: '100%' }} /> : <Feather name="user" size={28} color={c.muted} />}
      </View>
    </TouchableOpacity>
    {onAddPress && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add story" onPress={onAddPress} style={{ position: 'absolute', right: 0, top: 48, width: 28, height: 28, borderRadius: 14, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}><Feather name="plus" size={18} color={BG} /></TouchableOpacity>}
    <Text numberOfLines={1} style={{ color: c.text, fontSize: 11 }}>{name}</Text>
  </View>;
}
function AddStoryCard({ avatar, myStories, onPress, onAddPress }) {
  return <StoryCircle image={avatar} name="Your story" active={!!myStories?.stories?.length} onPress={onPress} onAddPress={onAddPress} />;
}
function StoryCard({ item, onPress }) {
  return <StoryCircle image={item.avatar} name={item.name || 'User'} active={!item.allViewed} onPress={onPress} />;
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
    fetchStories();
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
    ...StyleSheet.absoluteFillObject,
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
