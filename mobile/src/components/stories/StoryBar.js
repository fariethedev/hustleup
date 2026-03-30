import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

const stories = [
  { id: 'me', name: 'Your Story', avatar: null, isMine: true },
  { id: '1', name: 'Marcus', avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=Marcus' },
  { id: '2', name: 'Linda', avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=Linda' },
  { id: '3', name: 'Grace', avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=Grace' },
];

function StoryCard({ item }) {
  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.storyItem}>
      <View style={[styles.storyRing, item.isMine && styles.storyRingMuted]}>
        <View style={styles.storyAvatar}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.storyImage} />
          ) : (
            <Feather name="plus" size={24} color="#CDFF00" />
          )}
        </View>
      </View>

      {item.isMine ? (
        <View style={styles.addBadge}>
          <Feather name="plus" size={10} color="#050505" />
        </View>
      ) : null}

      <Text style={[styles.storyText, item.isMine && styles.storyTextMuted]} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );
}

export default function StoryBar() {
  return (
    <View style={styles.wrap}>
      <View style={styles.headlineRow}>
        <Text style={styles.headline}>Stories</Text>
        <Text style={styles.headlineMeta}>Fast updates</Text>
      </View>

      <FlatList
        data={stories}
        renderItem={({ item }) => <StoryCard item={item} />}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
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
    color: '#71717A',
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
