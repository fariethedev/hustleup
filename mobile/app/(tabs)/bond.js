import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { datingApi } from '../../src/api/client';

const { width, height } = Dimensions.get('window');
const LIME = '#CDFF00';
const BG = '#050505';
const SKY = '#007AFF';
const SWIPE_THRESHOLD = width * 0.3;

const COLORS = {
  PASS: '#FF3B30',
  SUPER: '#A78BFA',
  LIKE: '#34C759',
};

const TAGS = {
  FRIENDSHIP: { label: 'Friendship', color: '#60A5FA' },
  ROMANCE: { label: 'Romance', color: '#F472B6' },
  NETWORKING: { label: 'Network', color: LIME },
  CASUAL: { label: 'Casual', color: '#A78BFA' },
};

const LOOKING_FOR_OPTIONS = ['ROMANCE', 'FRIENDSHIP', 'NETWORKING', 'CASUAL'];

// ─── Interest sets per profile ────────────────────────────────────────────────
const INTEREST_SETS = [
  ['Photography', 'Travel', 'Coffee', 'Hiking', 'Music'],
  ['Cooking', 'Yoga', 'Art', 'Reading', 'Wine'],
  ['Fitness', 'Tech', 'Gaming', 'Movies', 'Crypto'],
  ['Fashion', 'Dance', 'Surfing', 'Food', 'Dogs'],
  ['Meditation', 'Writing', 'Cycling', 'Plants', 'Jazz'],
  ['Basketball', 'Sneakers', 'Brunch', 'Cats', 'Netflix'],
  ['Running', 'Tattoos', 'Vinyl', 'Camping', 'Sushi'],
  ['Skating', 'Poetry', 'Film', 'Thrifting', 'Brunch'],
  ['Boxing', 'Street Food', 'Books', 'Beach', 'Concerts'],
  ['Pilates', 'Interior Design', 'Travel', 'Tea', 'Sunsets'],
  ['DJ', 'Nightlife', 'Fashion', 'Cars', 'Gym'],
  ['Baking', 'Anime', 'Board Games', 'Coding', 'Astronomy'],
];

// ─── Demo profiles (shown when API returns empty) ─────────────────────────────
const DEMO_PROFILES = [
  {
    id: 'demo-1', fullName: 'Maya Johnson', age: 24, city: 'London, UK',
    location: 'London, UK', lookingFor: 'ROMANCE', gender: 'Woman',
    bio: "Creative soul with a camera 📸 Love exploring hidden coffee spots and weekend road trips ✨",
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&crop=face',
    _matchPct: 92, _interests: 0,
  },
  {
    id: 'demo-2', fullName: 'Jamal Carter', age: 27, city: 'Atlanta, GA',
    location: 'Atlanta, GA', lookingFor: 'NETWORKING', gender: 'Man',
    bio: "Tech entrepreneur & fitness lover 💪 Building the future one line of code at a time 🚀",
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop&crop=face',
    _matchPct: 87, _interests: 2,
  },
  {
    id: 'demo-3', fullName: 'Sofia Martinez', age: 22, city: 'Miami, FL',
    location: 'Miami, FL', lookingFor: 'CASUAL', gender: 'Woman',
    bio: "Beach vibes & good energy only 🌊 Salsa dancer, sunset chaser, dog mom 🐕",
    photoUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=800&fit=crop&crop=face',
    _matchPct: 95, _interests: 3,
  },
  {
    id: 'demo-4', fullName: 'Andre Williams', age: 28, city: 'New York, NY',
    location: 'New York, NY', lookingFor: 'ROMANCE', gender: 'Man',
    bio: "Basketball, sneakers, and Saturday brunch 🏀 Looking for someone who matches my energy",
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=800&fit=crop&crop=face',
    _matchPct: 78, _interests: 5,
  },
  {
    id: 'demo-5', fullName: 'Aisha Patel', age: 25, city: 'Toronto, CA',
    location: 'Toronto, CA', lookingFor: 'FRIENDSHIP', gender: 'Woman',
    bio: "Yoga instructor by day, bookworm by night 📚 Always up for a deep conversation over chai ☕",
    photoUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=800&fit=crop&crop=face',
    _matchPct: 91, _interests: 4,
  },
  {
    id: 'demo-6', fullName: 'Marcus Chen', age: 26, city: 'San Francisco, CA',
    location: 'San Francisco, CA', lookingFor: 'NETWORKING', gender: 'Man',
    bio: "Product designer @ a startup 🎨 Vinyl collector, ramen enthusiast, and weekend hiker 🏔️",
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=800&fit=crop&crop=face',
    _matchPct: 84, _interests: 6,
  },
  {
    id: 'demo-7', fullName: 'Zara Thompson', age: 23, city: 'Los Angeles, CA',
    location: 'Los Angeles, CA', lookingFor: 'ROMANCE', gender: 'Woman',
    bio: "Aspiring actress & content creator 🎬 If you can make me laugh, you've already won 😂",
    photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=800&fit=crop&crop=face',
    _matchPct: 89, _interests: 7,
  },
  {
    id: 'demo-8', fullName: 'David Okonkwo', age: 30, city: 'Lagos, NG',
    location: 'Lagos, Nigeria', lookingFor: 'CASUAL', gender: 'Man',
    bio: "DJ & music producer 🎧 Living life loud. If the aux cord scares you, we won't work out 🎵",
    photoUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&h=800&fit=crop&crop=face',
    _matchPct: 76, _interests: 10,
  },
  {
    id: 'demo-9', fullName: 'Luna Ramirez', age: 21, city: 'Barcelona, ES',
    location: 'Barcelona, Spain', lookingFor: 'FRIENDSHIP', gender: 'Woman',
    bio: "Art student 🎨 Fluent in 3 languages, still learning the language of love 💕",
    photoUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=800&fit=crop&crop=face',
    _matchPct: 93, _interests: 1,
  },
  {
    id: 'demo-10', fullName: 'Tyler Brooks', age: 29, city: 'Chicago, IL',
    location: 'Chicago, IL', lookingFor: 'ROMANCE', gender: 'Man',
    bio: "Former athlete turned entrepreneur 🏈 Great cook, better listener. Let's grab dinner? 🍝",
    photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&h=800&fit=crop&crop=face',
    _matchPct: 82, _interests: 8,
  },
  {
    id: 'demo-11', fullName: 'Priya Sharma', age: 26, city: 'Dubai, UAE',
    location: 'Dubai, UAE', lookingFor: 'NETWORKING', gender: 'Woman',
    bio: "Interior designer with a thing for minimalism ✨ Tea > Coffee, fight me 🍵",
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=800&fit=crop&crop=face',
    _matchPct: 88, _interests: 9,
  },
  {
    id: 'demo-12', fullName: 'Kai Nakamura', age: 24, city: 'Tokyo, JP',
    location: 'Tokyo, Japan', lookingFor: 'CASUAL', gender: 'Man',
    bio: "Anime lover & hobbyist coder 🖥️ Board game champion 🏆 Looking for my Player 2 🎮",
    photoUrl: 'https://images.unsplash.com/photo-1488161628813-04466f0016e4?w=600&h=800&fit=crop&crop=face',
    _matchPct: 79, _interests: 11,
  },
];

function ProfileSetupModal({ visible, existing, onClose, onSaved }) {
  const [bio, setBio] = useState(existing?.bio || '');
  const [age, setAge] = useState(existing?.age ? String(existing.age) : '');
  const [location, setLocation] = useState(existing?.location || '');
  const [lookingFor, setLookingFor] = useState(existing?.lookingFor || 'NETWORKING');
  const [gender, setGender] = useState(existing?.gender || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && existing) {
      setBio(existing.bio || '');
      setAge(existing.age ? String(existing.age) : '');
      setLocation(existing.location || '');
      setLookingFor(existing.lookingFor || 'NETWORKING');
      setGender(existing.gender || '');
    }
  }, [visible, existing]);

  const handleSave = async () => {
    if (!bio.trim()) { Alert.alert('Required', 'Please add a bio'); return; }
    if (!age || isNaN(Number(age)) || Number(age) < 18) {
      Alert.alert('Invalid age', 'Please enter a valid age (18+)');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('bio', bio.trim());
      fd.append('age', age);
      if (location.trim()) fd.append('location', location.trim());
      fd.append('lookingFor', lookingFor);
      if (gender.trim()) fd.append('gender', gender.trim());
      await datingApi.saveProfile(fd);
      onSaved();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <View style={modal.header}>
              <Text style={modal.title}>Bond Profile</Text>
              <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
                <Feather name="x" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
              <View style={modal.field}>
                <Text style={modal.label}>Bio *</Text>
                <TextInput
                  style={[modal.input, { minHeight: 80 }]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell people about yourself..."
                  placeholderTextColor="#444"
                  multiline
                  maxLength={200}
                />
                <Text style={modal.charCount}>{bio.length}/200</Text>
              </View>
              <View style={modal.row}>
                <View style={[modal.field, { flex: 1 }]}>
                  <Text style={modal.label}>Age *</Text>
                  <TextInput
                    style={modal.input}
                    value={age}
                    onChangeText={setAge}
                    placeholder="25"
                    placeholderTextColor="#444"
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
                <View style={[modal.field, { flex: 2 }]}>
                  <Text style={modal.label}>Location</Text>
                  <TextInput
                    style={modal.input}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="City, Country"
                    placeholderTextColor="#444"
                  />
                </View>
              </View>
              <View style={modal.field}>
                <Text style={modal.label}>Gender</Text>
                <TextInput
                  style={modal.input}
                  value={gender}
                  onChangeText={setGender}
                  placeholder="e.g. Man, Woman, Non-binary..."
                  placeholderTextColor="#444"
                />
              </View>
              <View style={modal.field}>
                <Text style={modal.label}>Looking for</Text>
                <View style={modal.chips}>
                  {LOOKING_FOR_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[modal.chip, lookingFor === opt && modal.chipActive]}
                      onPress={() => setLookingFor(opt)}
                    >
                      <Text style={[modal.chipText, lookingFor === opt && modal.chipTextActive]}>
                        {TAGS[opt]?.label || opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity style={[modal.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={BG} size="small" />
                  : <Text style={modal.saveBtnText}>Save Profile</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function BondScreen() {
  const [profiles, setProfiles] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastAction, setLastAction] = useState(null); // 'like' | 'pass'
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [myProfile, setMyProfile] = useState(null);

  const position = useRef(new Animated.ValueXY()).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadProfiles();
    loadMyProfile();
  }, []);

  const loadMyProfile = async () => {
    try {
      const res = await datingApi.getMyProfile();
      setMyProfile(res.data || null);
    } catch {
      setMyProfile(null);
    }
  };

  const loadProfiles = async () => {
    try {
      const res = await datingApi.getProfiles();
      const apiProfiles = Array.isArray(res.data) ? res.data : [];
      if (apiProfiles.length > 0) {
        // Assign match % and interest set index if not present
        setProfiles(apiProfiles.map((p, i) => ({
          ...p,
          _matchPct: p._matchPct || Math.floor(70 + Math.random() * 25),
          _interests: p._interests ?? (i % INTEREST_SETS.length),
        })));
      } else {
        // Fallback: use demo profiles
        setProfiles([...DEMO_PROFILES].sort(() => Math.random() - 0.5));
      }
    } catch {
      // API error: use demo profiles
      setProfiles([...DEMO_PROFILES].sort(() => Math.random() - 0.5));
    } finally {
      setLoading(false);
    }
  };

  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD / 2],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD / 2, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gesture) => {
      position.setValue({ x: gesture.dx, y: gesture.dy * 0.3 });
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > SWIPE_THRESHOLD) {
        swipeRight();
      } else if (gesture.dx < -SWIPE_THRESHOLD) {
        swipeLeft();
      } else {
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          useNativeDriver: false,
        }).start();
      }
    },
  });

  const swipeRight = () => {
    const profile = profiles[currentIdx];
    setLastAction('like');
    if (profile?.id) {
      datingApi.likeProfile(profile.id).catch(() => {});
    }
    Animated.timing(position, {
      toValue: { x: width + 100, y: 0 },
      duration: 280,
      useNativeDriver: false,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setCurrentIdx(i => i + 1);
      setTimeout(() => setLastAction(null), 800);
    });
  };

  const swipeLeft = () => {
    const profile = profiles[currentIdx];
    setLastAction('pass');
    if (profile?.id) {
      datingApi.passProfile(profile.id).catch(() => {});
    }
    Animated.timing(position, {
      toValue: { x: -width - 100, y: 0 },
      duration: 280,
      useNativeDriver: false,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setCurrentIdx(i => i + 1);
      setTimeout(() => setLastAction(null), 800);
    });
  };

  const currentProfile = profiles[currentIdx];

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.headerAvatarWrap} onPress={() => setShowProfileModal(true)}>
            {myProfile?.photoUrl ? (
              <Image source={{ uri: myProfile.photoUrl }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
                <Feather name="user" size={14} color="rgba(255,255,255,0.4)" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Discover</Text>
            <Text style={styles.headerHello}>{myProfile?.location || 'Set your location'}</Text>
          </View>
          <TouchableOpacity style={styles.headerSearchBtn} onPress={() => setShowProfileModal(true)}>
            <Feather name={myProfile ? 'sliders' : 'user-plus'} size={18} color={myProfile ? LIME : 'rgba(255,255,255,0.4)'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerSearchBtn} onPress={() => { setCurrentIdx(0); loadProfiles(); }}>
            <Feather name="refresh-cw" size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Profile counter */}
      {!loading && profiles.length > 0 && currentProfile && (
        <View style={styles.counterRow}>
          <View style={styles.counterPill}>
            <Feather name="layers" size={12} color={LIME} />
            <Text style={styles.counterText}>{currentIdx + 1} / {profiles.length}</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={LIME} size="large" />
          <Text style={styles.loadingText}>Finding your matches...</Text>
        </View>
      ) : !currentProfile ? (
        <View style={styles.emptyState}>
          <LinearGradient
            colors={['rgba(205,255,0,0.06)', 'transparent']}
            style={styles.emptyGlow}
          />
          <View style={styles.emptyIconWrap}>
            <Feather name="heart" size={40} color={LIME} />
          </View>
          <Text style={styles.emptyTitle}>You're all caught up</Text>
          <Text style={styles.emptySub}>Check back later for new profiles</Text>
          <TouchableOpacity style={styles.reloadBtn} onPress={() => { setCurrentIdx(0); loadProfiles(); }}>
            <Feather name="refresh-cw" size={16} color={BG} />
            <Text style={styles.reloadBtnText}>Reload Profiles</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cardArea}>
          {/* Next card preview */}
          {profiles[currentIdx + 1] && (
            <View style={[styles.profileCard, styles.nextCard]}>
              <ProfileCardContent profile={profiles[currentIdx + 1]} />
            </View>
          )}

          {/* Current card */}
          <Animated.View
            style={[
              styles.profileCard,
              {
                transform: [
                  { translateX: position.x },
                  { translateY: position.y },
                  { rotate },
                ],
              },
            ]}
            {...panResponder.panHandlers}
          >
            {/* Like / Pass overlays */}
            <Animated.View style={[styles.swipeLabel, styles.swipeLike, { opacity: likeOpacity }]}>
              <LinearGradient
                colors={[`${LIME}33`, `${LIME}11`]}
                style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' }]}
              />
              <Feather name="heart" size={36} color={LIME} />
              <Text style={[styles.swipeLabelText, { color: LIME }]}>LIKE</Text>
            </Animated.View>

            <Animated.View style={[styles.swipeLabel, styles.swipePass, { opacity: passOpacity }]}>
              <LinearGradient
                colors={['rgba(255,60,80,0.2)', 'rgba(255,60,80,0.05)']}
                style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' }]}
              />
              <Feather name="x" size={36} color="#FF3C50" />
              <Text style={[styles.swipeLabelText, { color: '#FF3C50' }]}>PASS</Text>
            </Animated.View>

            <TouchableOpacity 
              activeOpacity={0.9} 
              style={{ flex: 1 }} 
              onPress={() => setSelectedProfile(currentProfile)}
            >
              <ProfileCardContent profile={currentProfile} />
            </TouchableOpacity>
          </Animated.View>

          {/* Action toast */}
          {lastAction && (
            <View style={[styles.actionToast, lastAction === 'like' ? styles.toastLike : styles.toastPass]}>
              <Feather name={lastAction === 'like' ? 'heart' : 'x'} size={16} color={lastAction === 'like' ? BG : '#FFF'} />
              <Text style={[styles.toastText, { color: lastAction === 'like' ? BG : '#FFF' }]}>
                {lastAction === 'like' ? 'Liked!' : 'Passed'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Action buttons */}
      {!loading && currentProfile && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={swipeLeft} activeOpacity={0.8}>
            <View style={[styles.actionIconWrap, { backgroundColor: COLORS.PASS }]}>
              <Feather name="x" size={28} color="#FFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('⭐ Super Like', `You super-liked ${currentProfile.fullName || 'this profile'}!`)} activeOpacity={0.8}>
            <View style={[styles.actionIconWrap, { backgroundColor: COLORS.SUPER }]}>
              <Feather name="star" size={24} color="#FFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={swipeRight} activeOpacity={0.8}>
            <View style={[styles.actionIconWrap, { backgroundColor: COLORS.LIKE }]}>
              <Feather name="heart" size={28} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      <ProfileSetupModal
        visible={showProfileModal}
        existing={myProfile}
        onClose={() => setShowProfileModal(false)}
        onSaved={() => { loadMyProfile(); loadProfiles(); }}
      />

      <BondProfileDetail 
        profile={selectedProfile}
        onClose={() => setSelectedProfile(null)}
        onLike={() => { if (selectedProfile?.id) datingApi.likeProfile(selectedProfile.id).catch(() => {}); setCurrentIdx(i => i + 1); }}
        onPass={() => { if (selectedProfile?.id) datingApi.passProfile(selectedProfile.id).catch(() => {}); setCurrentIdx(i => i + 1); }}
      />
    </View>
  );
}

function BondProfileDetail({ profile, onClose, onLike, onPass }) {
  if (!profile) return null;
  const initials = profile.fullName?.[0]?.toUpperCase() || '?';
  const interests = INTEREST_SETS[profile._interests ?? 0] || INTEREST_SETS[0];
  const tag = profile.lookingFor ? TAGS[profile.lookingFor] : null;
  const INTEREST_ICONS = ['zap', 'book-open', 'send', 'pen-tool', 'sun', 'headphones', 'coffee', 'camera', 'heart', 'star', 'globe', 'music'];

  return (
    <Modal visible={!!profile} animationType="slide" transparent onRequestClose={onClose}>
      <View style={detail.overlay}>
        <View style={detail.sheet}>
          <View style={detail.handle} />
          
          <View style={detail.header}>
             <TouchableOpacity style={detail.closeBtn} onPress={onClose}>
               <Feather name="x" size={20} color="#FFF" />
             </TouchableOpacity>
             <View style={detail.headerText}>
               <View style={detail.nameRow}>
                 <Text style={detail.name}>{profile.fullName || 'Anonymous'}, {profile.age || '25'}</Text>
                 <View style={detail.verified}>
                    <Feather name="check" size={10} color={BG} />
                 </View>
               </View>
               <Text style={detail.location}>{profile.location || profile.city || 'Unknown'}</Text>
             </View>
             <TouchableOpacity style={detail.iconBtn} onPress={() => Alert.alert('Share', `Share ${profile.fullName || 'this profile'}?`)}>
               <Feather name="share-2" size={18} color="rgba(255,255,255,0.5)" />
             </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
            {/* Main Photo */}
            <View style={detail.photoWrap}>
              {profile.photoUrl ? (
                <Image source={{ uri: profile.photoUrl }} style={detail.photo} />
              ) : (
                <View style={[detail.photo, { backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: LIME, fontSize: 48, fontWeight: '900' }}>{initials}</Text>
                </View>
              )}
            </View>

            {/* Looking for badge */}
            {tag && (
              <View style={[detail.lookingForBadge, { borderColor: tag.color }]}>
                <Feather name="target" size={12} color={tag.color} />
                <Text style={[detail.lookingForText, { color: tag.color }]}>Looking for {tag.label}</Text>
              </View>
            )}

            {/* About */}
            <View style={detail.section}>
              <Text style={detail.sectionLabel}>ABOUT</Text>
              <Text style={detail.sectionText}>
                {profile.bio || "Hi there! 👋 I'm into coffee ☕, travel ✈️, and late-night talks ✨. Always open to new people and good vibes 🌎."}
              </Text>
            </View>

            {/* Interests */}
            <View style={detail.section}>
              <Text style={detail.sectionLabel}>INTERESTS</Text>
              <View style={detail.interests}>
                {interests.map((it, i) => (
                  <TouchableOpacity key={i} style={detail.tag} activeOpacity={0.7}>
                    <Feather 
                      name={INTEREST_ICONS[i % INTEREST_ICONS.length]} 
                      size={12} color="#FFF" 
                    />
                    <Text style={detail.tagText}>{it}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Sticky action bar */}
          <View style={detail.actionBar}>
            <TouchableOpacity style={[detail.actionCircle, { backgroundColor: COLORS.PASS }]} onPress={() => { onPass?.(); onClose(); }} activeOpacity={0.8}>
              <Feather name="x" size={26} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[detail.actionCircle, { backgroundColor: COLORS.SUPER }]} onPress={() => Alert.alert('⭐ Super Like', `You super-liked ${profile.fullName}!`)} activeOpacity={0.8}>
              <Feather name="star" size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[detail.actionCircle, { backgroundColor: COLORS.LIKE }]} onPress={() => { onLike?.(); onClose(); }} activeOpacity={0.8}>
              <Feather name="heart" size={26} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[detail.actionCircle, { backgroundColor: '#007AFF' }]} onPress={() => Alert.alert('💬 Message', `Start chatting with ${profile.fullName}?`)} activeOpacity={0.8}>
              <Feather name="message-circle" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const detail = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: { 
    backgroundColor: '#050505', borderTopLeftRadius: 40, borderTopRightRadius: 40, 
    flex: 1, marginTop: 60, paddingHorizontal: 24, paddingVertical: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 },
  headerText: { alignItems: 'center', flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  verified: { width: 16, height: 16, borderRadius: 8, backgroundColor: SKY, alignItems: 'center', justifyContent: 'center' },
  location: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  photoWrap: { width: '100%', aspectRatio: 1, borderRadius: 35, overflow: 'hidden', marginBottom: 20 },
  photo: { width: '100%', height: '100%' },
  lookingForBadge: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)', marginBottom: 20,
  },
  lookingForText: { fontSize: 12, fontWeight: '800' },
  section: { marginBottom: 24 },
  sectionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  sectionText: { color: '#FFF', fontSize: 14, lineHeight: 22, fontWeight: '500' },
  interests: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { 
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  tagText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  actionBar: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 16, paddingHorizontal: 24,
  },
  actionCircle: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
});

function ProfileCardContent({ profile }) {
  const initials = profile.fullName?.[0]?.toUpperCase() || '?';
  const matchPct = profile._matchPct || 85;
  const tag = profile.lookingFor ? TAGS[profile.lookingFor] : null;

  return (
    <View style={styles.cardContent}>
      {/* Photo / avatar */}
      {profile.photoUrl ? (
        <Image source={{ uri: profile.photoUrl }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={['rgba(205,255,0,0.15)', 'rgba(0,0,0,0.9)']}
          style={[styles.cardImage, { alignItems: 'center', justifyContent: 'center' }]}
        >
          <Text style={styles.cardInitial}>{initials}</Text>
        </LinearGradient>
      )}

      {/* Top badges row */}
      <View style={styles.cardBadgeRow}>
        <View style={styles.matchBadge}>
          <Text style={styles.matchText}>Match {matchPct}%</Text>
        </View>
        {tag && (
          <View style={[styles.matchBadge, { borderColor: `${tag.color}40` }]}>
            <Text style={[styles.matchText, { color: tag.color }]}>{tag.label}</Text>
          </View>
        )}
      </View>

      {/* Bottom gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.92)']}
        style={[styles.cardOverlay, { pointerEvents: 'none' }]}
      />

      {/* Card info */}
      <View style={styles.cardInfo}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName}>
            {profile.fullName || 'Anonymous'}{profile.age ? `, ${profile.age}` : ''}
          </Text>
          <View style={styles.onlineStatusDot} />
        </View>
        <Text style={styles.cardInfoLocation}>
          {profile.city || profile.location || 'Nearby'}
        </Text>
        {profile.bio && (
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 6 }} numberOfLines={2}>
            {profile.bio}
          </Text>
        )}
      </View>
    </View>
  );
}

const CARD_HEIGHT = height * 0.6;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  safe: { backgroundColor: BG },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  headerAvatarWrap: {
    width: 38, height: 38, borderRadius: 19,
    overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerAvatar: { width: '100%', height: '100%' },
  headerAvatarFallback: { justifyContent: 'center', alignItems: 'center' },
  headerTitleWrap: { flex: 1 },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  headerHello: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  headerLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  headerLocText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  headerSearchBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },

  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#555', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  counterRow: {
    flexDirection: 'row', justifyContent: 'center', paddingBottom: 4,
  },
  counterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  counterText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' },
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 5 },
  profileCard: {
    width: width - 40,
    height: CARD_HEIGHT,
    borderRadius: 45,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 0,
    position: 'absolute',
    elevation: 8,
  },
  nextCard: {
    transform: [{ scale: 0.94 }, { translateY: 15 }],
    opacity: 0.4,
  },
  cardContent: { flex: 1, position: 'relative' },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardInitial: { color: LIME, fontSize: 72, fontWeight: '900' },
  cardOverlay: { ...StyleSheet.absoluteFillObject },
  
  cardBadgeRow: {
    position: 'absolute', top: 24, left: 24, right: 24,
    flexDirection: 'row', gap: 8, zIndex: 10,
  },
  matchBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  matchText: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  cardSideProgress: {
    position: 'absolute', right: 24, top: '40%', height: 80, width: 3,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, zIndex: 10,
  },
  cardSideIndicator: {
    width: 3, backgroundColor: '#FFF', borderRadius: 2,
  },

  cardInfo: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 30, gap: 4,
  },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { color: '#FFF', fontSize: 28, fontWeight: '900' },
  onlineStatusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#34C759', marginTop: 4 },
  cardInfoLocation: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },

  swipeLabel: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 10, borderRadius: 45,
  },
  swipeLike: { borderWidth: 0 },
  swipePass: { borderWidth: 0 },
  swipeLabelText: { fontSize: 32, fontWeight: '900', letterSpacing: 3 },
  actionToast: {
    position: 'absolute', top: 20, flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  toastLike: { backgroundColor: '#CDFF00' },
  toastPass: { backgroundColor: 'rgba(255,60,80,0.9)' },
  toastText: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 10,
  },
  actionBtn: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  actionIconWrap: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  emptyGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: '30%',
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: 'rgba(205,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  emptySub: { color: '#555', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 22 },
  reloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#CDFF00',
    marginTop: 8,
  },
  reloadBtnText: { color: BG, fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
  },
  charCount: { color: '#444', fontSize: 11, fontWeight: '600', textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: {
    borderColor: LIME,
    backgroundColor: 'rgba(205,255,0,0.1)',
  },
  chipText: { color: '#777', fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: LIME },
  saveBtn: {
    backgroundColor: LIME,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: BG, fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
});

