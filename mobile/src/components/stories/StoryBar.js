import React, { useState, useEffect } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/authSlice';
import { storiesApi } from '../../api/client';
import StoryViewer from './StoryViewer';

function StoryCard({ item, onPress }) {
  const initials = item.name?.[0] || '?';
  
  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.storyItem} onPress={onPress}>
      <View style={[styles.storyRing, item.isMine && !item.hasStory && styles.storyRingMuted]}>
        <View style={styles.storyAvatar}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.storyImage} />
          ) : (
            <View style={styles.initialsAvatar}>
              <Text style={styles.initialsText}>{initials}</Text>
            </View>
          )}
        </View>
      </View>

      {item.isMine && !item.hasStory ? (
        <View style={styles.addBadge}>
          <Feather name="plus" size={10} color="#050505" />
        </View>
      ) : null}

      <Text style={[styles.storyText, item.isMine && !item.hasStory && styles.storyTextMuted]} numberOfLines={1}>
        {item.isMine ? 'Your Story' : item.name.split(' ')[0]}
      </Text>
    </TouchableOpacity>
  );
}

export default function StoryBar() {
  const [groupedStories, setGroupedStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedStories, setSelectedStories] = useState([]);
  const currentUser = useSelector(selectUser);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      setLoading(true);
      const res = await storiesApi.getAll();
      const allStories = res.data;

      // Group stories by authorId
      const groups = allStories.reduce((acc, story) => {
        if (!acc[story.authorId]) {
          acc[story.authorId] = {
            id: story.authorId,
            name: story.authorName,
            avatar: story.authorAvatar, // Assuming this exists or null
            stories: [],
            isMine: story.authorId === currentUser?.id,
          };
        }
        acc[story.authorId].stories.push(story);
        return acc;
      }, {});

      let sortedGroups = Object.values(groups).sort((a, b) => {
        if (a.isMine) return -1;
        if (b.isMine) return 1;
        return 0;
      });

      // If current user has no stories, add a placeholder for "Your Story"
      if (!groups[currentUser?.id]) {
        sortedGroups.unshift({
          id: 'me',
          name: currentUser?.fullName || 'You',
          avatar: null,
          stories: [],
          isMine: true,
          hasStory: false,
        });
      } else {
        groups[currentUser.id].hasStory = true;
      }

      setGroupedStories(sortedGroups);
    } catch (error) {
      console.error('Failed to fetch stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const openViewer = (group) => {
    if (group.stories.length > 0) {
      setSelectedStories(group.stories);
      setViewerVisible(true);
    } else {
      // Handle creating a new story
      console.log('Create new story');
    }
  };

  if (loading && groupedStories.length === 0) {
    return (
      <View style={[styles.wrap, styles.loadingCenter]}>
        <ActivityIndicator color="#C6FF33" size="small" />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headlineRow}>
        <Text style={styles.headline}>Stories</Text>
        <TouchableOpacity onPress={fetchStories}>
          <Text style={styles.headlineMeta}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={groupedStories}
        renderItem={({ item }) => (
          <StoryCard 
            item={item} 
            onPress={() => openViewer(item)} 
          />
        )}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      />

      <StoryViewer 
        visible={viewerVisible}
        stories={selectedStories}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0C0C0C',
    paddingVertical: 14,
  },
  loadingCenter: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headlineMeta: {
    color: '#CDFF00',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  content: {
    paddingHorizontal: 20,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 18,
    width: 76,
  },
  storyRing: {
    width: 72,
    height: 72,
    borderRadius: 999,
    padding: 3,
    backgroundColor: '#CDFF00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingMuted: {
    backgroundColor: '#2A2A2A',
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initialsAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  addBadge: {
    position: 'absolute',
    right: 10,
    top: 52,
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#CDFF00',
    borderWidth: 2,
    borderColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyText: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  storyTextMuted: {
    color: '#A1A1AA',
  },
});
