import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/authSlice';
import { storiesApi } from '../../api/client';

const { width, height } = Dimensions.get('window');

export default function StoryViewer({ visible, stories, initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const currentUser = useSelector(selectUser);
  
  const currentStory = stories[currentIndex];
  const isOwner = currentStory?.authorId === currentUser?.id;

  useEffect(() => {
    if (visible && currentStory) {
      setIsLiked(currentStory.likedByCurrentUser || false);
      setLikesCount(currentStory.likesCount || 0);
      setViewsCount(currentStory.viewsCount || 0);
      
      recordView();
      startProgress();
    }
  }, [visible, currentIndex]);

  const recordView = async () => {
    if (!visible || !currentStory || isOwner) return;
    try {
      await storiesApi.view(currentStory.id);
    } catch (error) {
      console.log('View tracking error or already viewed');
    }
  };

  const startProgress = () => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 5000, // 5 seconds per story
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        nextStory();
      }
    });
  };

  const nextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const prevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const toggleLike = async () => {
    const newLikedState = !isLiked;
    const newCount = newLikedState ? likesCount + 1 : Math.max(0, likesCount - 1);

    // Optimistic UI update
    setIsLiked(newLikedState);
    setLikesCount(newCount);

    try {
      if (newLikedState) {
        await storiesApi.like(currentStory.id);
      } else {
        await storiesApi.unlike(currentStory.id);
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      // Rollback on error
      setIsLiked(!newLikedState);
      setLikesCount(likesCount);
    }
  };

  if (!visible || !currentStory) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={styles.container}>
        {/* Background Image/Content */}
        {currentStory.type === 'IMAGE' ? (
          <Image source={{ uri: currentStory.mediaUrl }} style={styles.backgroundMedia} resizeMode="cover" />
        ) : (
          <View style={[styles.backgroundMedia, styles.textBackground]}>
            <Text style={styles.textContent}>{currentStory.content}</Text>
          </View>
        )}

        {/* Overlay Gradients (Simulated with View) */}
        <View style={styles.topOverlay} />
        <View style={styles.bottomOverlay} />

        <SafeAreaView style={styles.content}>
          {/* Header: Progress & User Info */}
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              {stories.map((item, index) => (
                <View key={item.id} style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressBar,
                      {
                        width:
                          index < currentIndex
                            ? '100%'
                            : index === currentIndex
                            ? progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                              })
                            : '0%',
                      },
                    ]}
                  />
                </View>
              ))}
            </View>

            <View style={styles.userRow}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{currentStory.authorName?.[0]}</Text>
                </View>
                <View>
                  <Text style={styles.username}>{currentStory.authorName}</Text>
                  <Text style={styles.timestamp}>Active now</Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                {isOwner && (
                  <View style={styles.ownerViews}>
                    <Feather name="eye" size={14} color="#C6FF33" />
                    <Text style={styles.ownerViewsText}>{viewsCount}</Text>
                  </View>
                )}
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Feather name="x" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Interaction Layers */}
          <View style={styles.gestureContainer}>
            <TouchableOpacity style={styles.leftTap} onPress={prevStory} activeOpacity={1} />
            <TouchableOpacity style={styles.rightTap} onPress={nextStory} activeOpacity={1} />
          </View>

          {/* Footer: Like Action */}
          <View style={styles.footer}>
            <View style={styles.replyBox}>
              <Text style={styles.replyPlaceholder}>Send message...</Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.likeButton, isLiked && styles.likeButtonActive]} 
              onPress={toggleLike}
              activeOpacity={0.7}
            >
              <Feather 
                name="heart" 
                size={22} 
                color={isLiked ? "#050505" : "#FFF"} 
                fill={isLiked ? "#050505" : "transparent"}
              />
              {likesCount > 0 && (
                <Text style={[styles.likeCount, isLiked && styles.likeCountActive]}>
                  {likesCount}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundMedia: {
    ...StyleSheet.absoluteFillObject,
    width,
    height,
  },
  textBackground: {
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  textContent: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 38,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    width,
    height: 140,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    width,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
  },
  progressContainer: {
    flexDirection: 'row',
    height: 3,
    gap: 4,
    marginBottom: 16,
  },
  progressTrack: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFF',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#C6FF33',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  avatarText: {
    color: '#050505',
    fontWeight: '800',
    fontSize: 16,
  },
  username: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ownerViews: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  ownerViewsText: {
    color: '#C6FF33',
    fontSize: 12,
    fontWeight: '900',
  },
  closeButton: {
    padding: 8,
  },
  gestureContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  leftTap: {
    flex: 1,
  },
  rightTap: {
    flex: 3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  replyBox: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  replyPlaceholder: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  likeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  likeButtonActive: {
    backgroundColor: '#C6FF33',
    borderColor: '#C6FF33',
  },
  likeCount: {
    marginLeft: 4,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  likeCountActive: {
    color: '#050505',
  },
});
