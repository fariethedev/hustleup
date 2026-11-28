import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '../../src/components/native/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { datingApi } from '../../src/api/client';
import { mediaUrl, pickCroppedPhoto, uploadAsset } from '../../src/utils/media';
import { errorMessage } from '../../src/utils/marketplace';

// Same option sets as the web app (frontend/src/pages/Dating.jsx) so a profile edited on
// one platform reads identically on the other.
const LOOKING_FOR_OPTIONS = ['Networking', 'Collaboration', 'Partnership', 'Mentorship', 'Friends', 'Dating'];
const GENDER_OPTIONS = ['Male', 'Female'];
const SHOW_ME_OPTIONS = ['Everyone', 'Men', 'Women'];
const INTEREST_OPTIONS = ['Music', 'Fitness', 'Tech', 'Fashion', 'Food', 'Travel', 'Art', 'Business', 'Gaming', 'Sports', 'Film', 'Photography', 'Books', 'Dance', 'Crypto', 'Cooking'];
const MAX_INTERESTS = 5;
const MAX_PHOTOS = 6;
const FILTER_KEY = 'hustlespace_bond_filters_v1';

// Light, matching the website: #F5F6F3 page, white cards. Lime stays as a fill and on photos;
// accentInk is the readable green for icons and spinners on white.
const C = {
  bg: '#F5F6F3', card: '#FFFFFF', line: '#E4E4E7', text: '#18181B', muted: '#52525B',
  accent: '#CDFF00', accentInk: '#6D28D9', like: '#16A34A', nope: '#E11D48', superLike: '#0284C7', gold: '#D97706',
};

const parsePhotos = (profile) => {
  let list = [];
  try { list = profile?.photos ? JSON.parse(profile.photos) : []; } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  if (!list.length && profile?.imageUrl) list = [profile.imageUrl];
  return list.filter(Boolean);
};
const interestsOf = (profile) => (profile?.interests || '').split(',').map(i => i.trim()).filter(Boolean);
const ageLabel = (age) => (age && age > 0 ? `, ${age}` : '');
const haptic = (kind = 'light') => {
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
  } catch { /* haptics are a nicety */ }
};

// ─── Small UI pieces ──────────────────────────────────────────────────────────
function Chip({ label, selected, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[s.chip, selected && s.chipOn, disabled && { opacity: 0.35 }]}
    >
      <Text style={[s.chipText, selected && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function RoundButton({ icon, color, size = 56, onPress, label, disabled }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[s.round, { width: size, height: size, borderRadius: size / 2, borderColor: `${color}55`, opacity: disabled ? 0.35 : 1 }]}
    >
      <Feather name={icon} size={size * 0.42} color={color} />
    </TouchableOpacity>
  );
}

// ─── Swipe card ───────────────────────────────────────────────────────────────
function SwipeCard({ profile, width, height, onOpenDetail, stamps }) {
  const photos = useMemo(() => parsePhotos(profile), [profile]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const tags = interestsOf(profile).slice(0, 3);
  const photo = photos[photoIdx];

  return (
    <View style={[s.card, { width, height }]}>
      {photo
        ? <Image source={{ uri: mediaUrl(photo) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : <View style={[StyleSheet.absoluteFill, s.noPhoto]}><Text style={s.noPhotoInitial}>{(profile.fullName || '?')[0]}</Text></View>}

      {/* Tap left/right to flip photos, like Tinder */}
      {photos.length > 1 && (
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          <Pressable accessibilityLabel="Previous photo" style={{ flex: 1 }} onPress={() => setPhotoIdx(i => Math.max(0, i - 1))} />
          <Pressable accessibilityLabel="Next photo" style={{ flex: 1 }} onPress={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))} />
        </View>
      )}
      {photos.length > 1 && (
        <View style={s.photoBars} pointerEvents="none">
          {photos.map((_, i) => <View key={i} style={[s.photoBar, i === photoIdx && s.photoBarOn]} />)}
        </View>
      )}

      {profile.superLikedYou ? (
        <View style={[s.badge, { backgroundColor: C.superLike }]} pointerEvents="none"><Feather name="star" size={12} color="#FFF" /><Text style={s.badgeText}>Super liked you</Text></View>
      ) : profile.likedYou ? (
        <View style={[s.badge, { backgroundColor: C.gold }]} pointerEvents="none"><Feather name="heart" size={12} color="#111" /><Text style={[s.badgeText, { color: '#111' }]}>Likes you</Text></View>
      ) : null}

      {stamps}

      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.95)']} style={s.cardShade} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={s.cardName} numberOfLines={1}>{profile.fullName || 'Member'}<Text style={s.cardAge}>{ageLabel(profile.age)}</Text></Text>
            {!!profile.location && <View style={s.metaRow}><Feather name="map-pin" size={13} color="#DDD" /><Text style={s.metaText}>{profile.location}</Text></View>}
            {!!profile.lookingFor && <View style={s.metaRow}><Feather name="search" size={13} color={C.accent} /><Text style={[s.metaText, { color: C.accent }]}>Looking for {profile.lookingFor.toLowerCase()}</Text></View>}
            {!!profile.bio && <Text style={s.cardBio} numberOfLines={2}>{profile.bio}</Text>}
            {tags.length > 0 && <View style={s.tagRow}>{tags.map(t => <View key={t} style={s.tag}><Text style={s.tagText}>{t}</Text></View>)}</View>}
          </View>
          <TouchableOpacity accessibilityLabel={`More about ${profile.fullName}`} onPress={onOpenDetail} style={s.infoBtn}>
            <Feather name="info" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

// ─── Profile detail sheet ─────────────────────────────────────────────────────
function ProfileDetail({ profile, onClose, onPass, onLike, onSuperLike }) {
  const { width } = useWindowDimensions();
  const photos = useMemo(() => parsePhotos(profile), [profile]);
  if (!profile) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {(photos.length ? photos : [null]).map((p, i) => p
              ? <Image key={i} source={{ uri: mediaUrl(p) }} style={{ width, height: width * 1.25 }} resizeMode="cover" />
              : <View key={i} style={[{ width, height: width * 1.1 }, s.noPhoto]}><Text style={s.noPhotoInitial}>{(profile.fullName || '?')[0]}</Text></View>)}
          </ScrollView>
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 8, right: 12 }}>
            <TouchableOpacity accessibilityLabel="Close profile" onPress={onClose} style={s.closeFloat}><Feather name="chevron-down" size={24} color="#FFF" /></TouchableOpacity>
          </SafeAreaView>
          <View style={{ padding: 20, gap: 14 }}>
            <Text style={[s.cardName, { fontSize: 30 }]}>{profile.fullName}<Text style={s.cardAge}>{ageLabel(profile.age)}</Text></Text>
            {!!profile.location && <View style={s.metaRow}><Feather name="map-pin" size={15} color={C.muted} /><Text style={[s.metaText, { color: C.muted, fontSize: 15 }]}>{profile.location}</Text></View>}
            {!!profile.lookingFor && <View style={s.section}><Text style={s.sectionLabel}>Looking for</Text><Text style={s.sectionBody}>{profile.lookingFor}</Text></View>}
            {!!profile.bio && <View style={s.section}><Text style={s.sectionLabel}>About</Text><Text style={s.sectionBody}>{profile.bio}</Text></View>}
            {interestsOf(profile).length > 0 && <View style={s.section}><Text style={s.sectionLabel}>Interests</Text><View style={s.tagRow}>{interestsOf(profile).map(t => <View key={t} style={[s.tag, { borderColor: C.line }]}><Text style={s.tagText}>{t}</Text></View>)}</View></View>}
          </View>
        </ScrollView>
        {(onPass || onLike) && (
          <SafeAreaView edges={['bottom']} style={s.detailActions}>
            <RoundButton icon="x" color={C.nope} size={60} label="Pass" onPress={onPass} />
            <RoundButton icon="star" color={C.superLike} size={52} label="Super like" onPress={onSuperLike} />
            <RoundButton icon="heart" color={C.like} size={60} label="Like" onPress={onLike} />
          </SafeAreaView>
        )}
      </View>
    </Modal>
  );
}

// ─── Match celebration ────────────────────────────────────────────────────────
function MatchModal({ match, me, onClose, onMessage }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (!match) return;
    scale.setValue(0.6);
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [match, scale]);
  if (!match) return null;
  const them = parsePhotos(match)[0];
  const mine = parsePhotos(me)[0];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <LinearGradient colors={['rgba(5,5,5,0.92)', 'rgba(20,30,0,0.97)']} style={s.matchWrap}>
        <Animated.Text style={[s.matchTitle, { transform: [{ scale }] }]}>It’s a Match!</Animated.Text>
        <Text style={s.matchSub}>You and {match.fullName} liked each other.</Text>
        <View style={s.matchPhotos}>
          {[mine, them].map((p, i) => (
            <View key={i} style={[s.matchPhoto, { transform: [{ rotate: i ? '8deg' : '-8deg' }] }]}>
              {p ? <Image source={{ uri: mediaUrl(p) }} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, s.noPhoto]} />}
            </View>
          ))}
        </View>
        <TouchableOpacity style={s.primaryBtn} onPress={onMessage} accessibilityRole="button"><Feather name="message-circle" size={18} color="#111" /><Text style={s.primaryBtnText}>Send a message</Text></TouchableOpacity>
        <TouchableOpacity style={s.ghostBtn} onPress={onClose} accessibilityRole="button"><Text style={s.ghostBtnText}>Keep swiping</Text></TouchableOpacity>
      </LinearGradient>
    </Modal>
  );
}

// ─── Profile editor (photos, gender, show me, …) ─────────────────────────────
function ProfileEditor({ visible, existing, onClose, onSaved }) {
  const [photos, setPhotos] = useState([]); // { uri, remote } — remote = stored URL
  const [bio, setBio] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [gender, setGender] = useState('');
  const [showMe, setShowMe] = useState('Everyone');
  const [lookingFor, setLookingFor] = useState('Networking');
  const [interests, setInterests] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPhotos(parsePhotos(existing).map(url => ({ uri: mediaUrl(url), remote: url })));
    setBio(existing?.bio || '');
    setAge(existing?.age ? String(existing.age) : '');
    setLocation(existing?.location || '');
    setGender(GENDER_OPTIONS.includes(existing?.gender) ? existing.gender : '');
    setShowMe(existing?.showMe || 'Everyone');
    setLookingFor(existing?.lookingFor || 'Networking');
    setInterests(interestsOf(existing));
  }, [visible, existing]);

  const addPhoto = async () => {
    try {
      const asset = await pickCroppedPhoto([4, 5]);
      if (asset) setPhotos(list => [...list, { uri: asset.uri, asset }].slice(0, MAX_PHOTOS));
    } catch (e) { Alert.alert('Photo access', e.message); }
  };

  const save = async () => {
    if (!gender) return Alert.alert('Choose your gender', 'Bond matches on Male or Female.');
    const n = Number(age);
    if (!Number.isInteger(n) || n < 18 || n > 100) return Alert.alert('Check your age', 'You must be 18 or over to use Bond.');
    if (!bio.trim()) return Alert.alert('Add a bio', 'A line or two helps people say hello.');
    if (!photos.length) return Alert.alert('Add a photo', 'Profiles with photos get far more matches.');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('bio', bio.trim());
      fd.append('age', String(n));
      fd.append('location', location.trim());
      fd.append('gender', gender);
      fd.append('showMe', showMe);
      fd.append('lookingFor', lookingFor);
      fd.append('interests', interests.join(','));
      fd.append('keepPhotos', JSON.stringify(photos.filter(p => p.remote).map(p => p.remote)));
      photos.filter(p => p.asset).forEach(p => fd.append('photos', uploadAsset(p.asset)));
      const { data } = await datingApi.saveProfile(fd);
      onSaved(data);
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e, 'Please try again.'));
    } finally { setSaving(false); }
  };

  const toggleInterest = (tag) => setInterests(list => list.includes(tag)
    ? list.filter(t => t !== tag) : list.length >= MAX_INTERESTS ? list : [...list, tag]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.sheetHeader}>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close"><Feather name="x" size={24} color={C.text} /></TouchableOpacity>
            <Text style={s.sheetTitle}>Edit Bond profile</Text>
            <TouchableOpacity onPress={save} disabled={saving} accessibilityLabel="Save profile">
              {saving ? <ActivityIndicator color={C.accentInk} /> : <Text style={{ color: C.accentInk, fontWeight: '800', fontSize: 16 }}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 22, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <View>
              <Text style={s.label}>Photos <Text style={{ color: C.muted }}>({photos.length}/{MAX_PHOTOS}) · first is your cover</Text></Text>
              <View style={s.photoGrid}>
                {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
                  const p = photos[i];
                  return p ? (
                    <View key={i} style={s.photoSlot}>
                      <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} />
                      <TouchableOpacity accessibilityLabel={`Remove photo ${i + 1}`} style={s.photoRemove} onPress={() => setPhotos(list => list.filter((_, j) => j !== i))}><Feather name="x" size={14} color="#FFF" /></TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity key={i} style={[s.photoSlot, s.photoEmpty]} onPress={addPhoto} disabled={i !== photos.length} accessibilityLabel="Add photo">
                      {i === photos.length && <Feather name="plus" size={24} color={C.accentInk} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View><Text style={s.label}>I am</Text><View style={s.chipRow}>{GENDER_OPTIONS.map(o => <Chip key={o} label={o} selected={gender === o} onPress={() => setGender(o)} />)}</View></View>
            <View><Text style={s.label}>Show me</Text><View style={s.chipRow}>{SHOW_ME_OPTIONS.map(o => <Chip key={o} label={o} selected={showMe === o} onPress={() => setShowMe(o)} />)}</View></View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Text style={s.label}>Age</Text><TextInput style={s.input} value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={3} placeholder="25" placeholderTextColor="#555" /></View>
              <View style={{ flex: 2 }}><Text style={s.label}>City</Text><TextInput style={s.input} value={location} onChangeText={setLocation} placeholder="Warsaw" placeholderTextColor="#555" /></View>
            </View>
            <View><Text style={s.label}>About me</Text><TextInput style={[s.input, { minHeight: 90, textAlignVertical: 'top' }]} value={bio} onChangeText={setBio} multiline maxLength={300} placeholder="What are you building? What do you love?" placeholderTextColor="#555" /></View>
            <View><Text style={s.label}>Looking for</Text><View style={s.chipRow}>{LOOKING_FOR_OPTIONS.map(o => <Chip key={o} label={o} selected={lookingFor === o} onPress={() => setLookingFor(o)} />)}</View></View>
            <View><Text style={s.label}>Interests <Text style={{ color: C.muted }}>({interests.length}/{MAX_INTERESTS})</Text></Text><View style={s.chipRow}>{INTEREST_OPTIONS.map(o => <Chip key={o} label={o} selected={interests.includes(o)} disabled={!interests.includes(o) && interests.length >= MAX_INTERESTS} onPress={() => toggleInterest(o)} />)}</View></View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Discovery filters ────────────────────────────────────────────────────────
function Stepper({ value, onChange, min, max }) {
  return (
    <View style={s.stepper}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - 1))} style={s.stepBtn} accessibilityLabel="Decrease"><Feather name="minus" size={18} color={C.text} /></TouchableOpacity>
      <Text style={s.stepValue}>{value}</Text>
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + 1))} style={s.stepBtn} accessibilityLabel="Increase"><Feather name="plus" size={18} color={C.text} /></TouchableOpacity>
    </View>
  );
}

function FiltersSheet({ visible, filters, onClose, onApply }) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => { if (visible) setDraft(filters); }, [visible, filters]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.bottomSheet}>
        <Text style={s.sheetTitle}>Discovery settings</Text>
        <Text style={s.label}>Age range</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stepper value={draft.minAge} min={18} max={draft.maxAge} onChange={v => setDraft(d => ({ ...d, minAge: v }))} />
          <Text style={{ color: C.muted }}>to</Text>
          <Stepper value={draft.maxAge} min={draft.minAge} max={80} onChange={v => setDraft(d => ({ ...d, maxAge: v }))} />
        </View>
        <Text style={s.label}>Looking for</Text>
        <View style={s.chipRow}>
          <Chip label="Anything" selected={!draft.lookingFor} onPress={() => setDraft(d => ({ ...d, lookingFor: '' }))} />
          {LOOKING_FOR_OPTIONS.map(o => <Chip key={o} label={o} selected={draft.lookingFor === o} onPress={() => setDraft(d => ({ ...d, lookingFor: o }))} />)}
        </View>
        <TouchableOpacity style={[s.primaryBtn, { alignSelf: 'stretch', marginTop: 8 }]} onPress={() => onApply(draft)}><Text style={s.primaryBtnText}>Apply</Text></TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BondScreen() {
  const router = useRouter();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const cardW = screenW - 24;
  const cardH = Math.min(screenH * 0.62, cardW * 1.45);

  const [tab, setTab] = useState('discover');
  const [me, setMe] = useState(undefined); // undefined = loading, null = no profile
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ minAge: 18, maxAge: 60, lookingFor: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState(null);
  const [match, setMatch] = useState(null);
  const [likes, setLikes] = useState([]);
  const [matches, setMatches] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [lastSwipe, setLastSwipe] = useState(null);

  const position = useRef(new Animated.ValueXY()).current;
  const swiping = useRef(false);

  // Restore saved filters once.
  useEffect(() => {
    AsyncStorage.getItem(FILTER_KEY).then(raw => { if (raw) setFilters(f => ({ ...f, ...JSON.parse(raw) })); }).catch(() => {});
  }, []);

  const loadDeck = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [mine, profiles] = await Promise.all([
        datingApi.getMyProfile().then(r => r.data || null),
        datingApi.getProfiles({ minAge: filters.minAge, maxAge: filters.maxAge, lookingFor: filters.lookingFor || undefined }).then(r => (Array.isArray(r.data) ? r.data : [])),
      ]);
      setMe(mine);
      setDeck(profiles);
      setIndex(0);
    } catch (e) {
      setError(errorMessage(e, 'Could not load Bond.'));
      setMe(m => (m === undefined ? null : m));
    } finally { setLoading(false); }
  }, [filters]);

  const loadLists = useCallback(async () => {
    setListLoading(true);
    try {
      const [l, m] = await Promise.all([datingApi.likesYou(), datingApi.matches()]);
      setLikes(Array.isArray(l.data) ? l.data : []);
      setMatches(Array.isArray(m.data) ? m.data : []);
    } catch { /* lists are secondary; the deck still works */ } finally { setListLoading(false); }
  }, []);

  useEffect(() => { loadDeck(); }, [loadDeck]);
  useFocusEffect(useCallback(() => { loadLists(); }, [loadLists]));

  // Reset the drag before paint so the next card never flashes in the old position.
  useLayoutEffect(() => { position.setValue({ x: 0, y: 0 }); }, [index, position]);

  const current = deck[index];
  const next = deck[index + 1];

  const openChat = (profile) => {
    setMatch(null);
    router.push({ pathname: '/(tabs)/messages', params: { partnerId: profile.id, partnerName: profile.fullName || 'Match', partnerAvatar: parsePhotos(profile)[0] || '' } });
  };

  const commit = useCallback(async (profile, action) => {
    setLastSwipe({ profile, action });
    try {
      if (action === 'pass') { await datingApi.passProfile(profile.id); return; }
      const { data } = action === 'super' ? await datingApi.superLikeProfile(profile.id) : await datingApi.likeProfile(profile.id);
      if (data?.matched) {
        haptic('success');
        setMatch(profile);
        loadLists();
      }
    } catch (e) {
      Alert.alert('Swipe not saved', errorMessage(e, 'Please try again.'));
    }
  }, [loadLists]);

  const swipe = useCallback((action) => {
    const profile = deck[index];
    if (!profile || swiping.current) return;
    swiping.current = true;
    haptic(action === 'super' ? 'heavy' : 'light');
    const to = action === 'like' ? { x: screenW * 1.5, y: 40 } : action === 'pass' ? { x: -screenW * 1.5, y: 40 } : { x: 0, y: -screenH };
    Animated.timing(position, { toValue: to, duration: 230, useNativeDriver: false }).start(() => {
      swiping.current = false;
      setIndex(i => i + 1);
      setDetail(null);
      commit(profile, action);
    });
  }, [deck, index, position, screenW, screenH, commit]);

  const swipeRef = useRef(swipe);
  swipeRef.current = swipe;

  const pan = useMemo(() => PanResponder.create({
    // Let taps through (photo flipping, info button); claim only real drags.
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
    onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > 110 || g.vx > 0.8) swipeRef.current('like');
      else if (g.dx < -110 || g.vx < -0.8) swipeRef.current('pass');
      else if (g.dy < -140 || g.vy < -1) swipeRef.current('super');
      else Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }).start();
    },
  }), [position]);

  const rewind = async () => {
    if (!lastSwipe) return;
    try {
      const { data } = await datingApi.rewind();
      if (!data?.rewound) {
        Alert.alert('Can’t rewind', data?.reason === 'matched' ? 'You already matched with them — find them in Matches.' : 'Nothing to undo.');
        return;
      }
      const back = data.profile || lastSwipe.profile;
      haptic();
      setDeck(d => [...d.slice(0, index), back, ...d.slice(index)]);
      setLastSwipe(null);
    } catch (e) { Alert.alert('Can’t rewind', errorMessage(e, 'Please try again.')); }
  };

  const applyFilters = (f) => {
    setShowFilters(false);
    setFilters(f);
    AsyncStorage.setItem(FILTER_KEY, JSON.stringify(f)).catch(() => {});
  };

  const respondToLike = async (profile, like) => {
    setLikes(list => list.filter(p => p.id !== profile.id));
    setDeck(d => d.filter((p, i) => i < index || p.id !== profile.id));
    try {
      if (!like) { await datingApi.passProfile(profile.id); return; }
      const { data } = await datingApi.likeProfile(profile.id);
      if (data?.matched) { haptic('success'); setMatch(profile); loadLists(); }
    } catch (e) { Alert.alert('Not saved', errorMessage(e, 'Please try again.')); loadLists(); }
  };

  const unmatch = (m) => Alert.alert(`Unmatch ${m.fullName}?`, 'They will disappear from your matches and won’t be shown to you again.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Unmatch', style: 'destructive', onPress: async () => {
      try { await datingApi.unmatch(m.id); setMatches(list => list.filter(x => x.id !== m.id)); }
      catch (e) { Alert.alert('Could not unmatch', errorMessage(e, 'Please try again.')); }
    } },
  ]);

  // Card motion
  const rotate = position.x.interpolate({ inputRange: [-screenW, 0, screenW], outputRange: ['-14deg', '0deg', '14deg'] });
  const likeOpacity = position.x.interpolate({ inputRange: [20, 120], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = position.x.interpolate({ inputRange: [-120, -20], outputRange: [1, 0], extrapolate: 'clamp' });
  const superOpacity = position.y.interpolate({ inputRange: [-150, -40], outputRange: [1, 0], extrapolate: 'clamp' });
  const nextScale = position.x.interpolate({ inputRange: [-screenW, 0, screenW], outputRange: [1, 0.94, 1], extrapolate: 'clamp' });

  const needsSetup = me === null || (me && !GENDER_OPTIONS.includes(me.gender));

  const header = (
    <View style={s.header}>
      <TouchableOpacity onPress={() => setEditing(true)} accessibilityLabel="Edit your Bond profile" style={s.headerIcon}>
        {parsePhotos(me)[0] ? <Image source={{ uri: mediaUrl(parsePhotos(me)[0]) }} style={s.headerAvatar} /> : <Feather name="user" size={20} color={C.text} />}
      </TouchableOpacity>
      <View style={s.tabs}>
        {[['discover', 'Discover'], ['likes', `Likes${likes.length ? ` ${likes.length}` : ''}`], ['matches', `Matches${matches.length ? ` ${matches.length}` : ''}`]].map(([key, label]) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)} style={[s.tab, tab === key && s.tabOn]}>
            <Text style={[s.tabText, tab === key && s.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <TouchableOpacity onPress={() => setShowFilters(true)} accessibilityLabel="Discovery settings" style={s.headerIcon}><Feather name="sliders" size={20} color={C.text} /></TouchableOpacity>
    </View>
  );

  let body;
  if (loading && me === undefined) {
    body = <View style={s.center}><ActivityIndicator color={C.accentInk} size="large" /><Text style={s.muted}>Finding people near you…</Text></View>;
  } else if (needsSetup) {
    body = (
      <View style={s.center}>
        <View style={s.emptyIcon}><Feather name="heart" size={34} color={C.accentInk} /></View>
        <Text style={s.emptyTitle}>Create your Bond profile</Text>
        <Text style={s.muted}>Add photos, say who you are and who you want to meet. Bond is free for everyone.</Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => setEditing(true)}><Text style={s.primaryBtnText}>Get started</Text></TouchableOpacity>
      </View>
    );
  } else if (tab === 'likes') {
    body = (
      <FlatList
        data={likes}
        numColumns={2}
        keyExtractor={p => String(p.id)}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 12 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 120, paddingTop: 4 }}
        refreshing={listLoading}
        onRefresh={loadLists}
        ListHeaderComponent={<Text style={[s.muted, { paddingHorizontal: 16, paddingBottom: 6 }]}>{likes.length ? 'Like them back to match instantly.' : ''}</Text>}
        ListEmptyComponent={<View style={s.center}><Feather name="heart" size={32} color={C.muted} /><Text style={s.emptyTitle}>No new likes yet</Text><Text style={s.muted}>Keep swiping — people who like you show up here.</Text></View>}
        renderItem={({ item }) => (
          <View style={[s.likeCard, { width: (screenW - 34) / 2 }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetail({ profile: item, fromLikes: true })}>
              {parsePhotos(item)[0] ? <Image source={{ uri: mediaUrl(parsePhotos(item)[0]) }} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, s.noPhoto]} />}
            </Pressable>
            {item.superLikedYou && <View style={[s.badge, { backgroundColor: C.superLike, top: 8, left: 8 }]}><Feather name="star" size={11} color="#FFF" /></View>}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={s.likeShade} pointerEvents="box-none">
              <Text style={s.likeName} numberOfLines={1}>{item.fullName}{ageLabel(item.age)}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <RoundButton icon="x" color={C.nope} size={38} label={`Pass on ${item.fullName}`} onPress={() => respondToLike(item, false)} />
                <RoundButton icon="heart" color={C.like} size={38} label={`Like ${item.fullName} back`} onPress={() => respondToLike(item, true)} />
              </View>
            </LinearGradient>
          </View>
        )}
      />
    );
  } else if (tab === 'matches') {
    body = (
      <FlatList
        data={matches}
        keyExtractor={m => String(m.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        refreshing={listLoading}
        onRefresh={loadLists}
        ListEmptyComponent={<View style={s.center}><Feather name="message-circle" size={32} color={C.muted} /><Text style={s.emptyTitle}>No matches yet</Text><Text style={s.muted}>When you both swipe right, you’ll be able to chat here.</Text></View>}
        renderItem={({ item }) => (
          <Pressable style={s.matchRow} onPress={() => openChat(item)} onLongPress={() => unmatch(item)} accessibilityHint="Long press to unmatch">
            {item.imageUrl ? <Image source={{ uri: mediaUrl(item.imageUrl) }} style={s.matchAvatar} /> : <View style={[s.matchAvatar, s.noPhoto]} />}
            <View style={{ flex: 1 }}>
              <Text style={s.matchName}>{item.fullName}{ageLabel(item.age)}</Text>
              <Text style={s.muted} numberOfLines={1}>{item.matchedAt ? `Matched ${new Date(item.matchedAt).toLocaleDateString()}` : 'Matched'} · Say hi 👋</Text>
            </View>
            <TouchableOpacity onPress={() => unmatch(item)} accessibilityLabel={`Unmatch ${item.fullName}`} style={{ padding: 8 }}><Feather name="more-vertical" size={20} color={C.muted} /></TouchableOpacity>
          </Pressable>
        )}
      />
    );
  } else {
    body = (
      <View style={{ flex: 1 }}>
        <View style={[s.deck, { height: cardH + 10 }]}>
          {error ? (
            <View style={s.center}><Text style={s.emptyTitle}>Something went wrong</Text><Text style={s.muted}>{error}</Text><TouchableOpacity style={s.primaryBtn} onPress={loadDeck}><Text style={s.primaryBtnText}>Retry</Text></TouchableOpacity></View>
          ) : loading ? (
            <ActivityIndicator color={C.accentInk} size="large" />
          ) : !current ? (
            <View style={s.center}>
              <View style={s.emptyIcon}><Feather name="compass" size={32} color={C.accentInk} /></View>
              <Text style={s.emptyTitle}>You’ve seen everyone</Text>
              <Text style={s.muted}>Widen your age range or check back soon for new people.</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={s.ghostBtnBox} onPress={() => setShowFilters(true)}><Text style={s.ghostBtnText}>Discovery settings</Text></TouchableOpacity>
                <TouchableOpacity style={s.primaryBtn} onPress={loadDeck}><Text style={s.primaryBtnText}>Refresh</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {next && (
                <Animated.View style={[s.cardSlot, { transform: [{ scale: nextScale }] }]} pointerEvents="none">
                  <SwipeCard key={next.id} profile={next} width={cardW} height={cardH} />
                </Animated.View>
              )}
              <Animated.View
                {...pan.panHandlers}
                style={[s.cardSlot, { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }]}
              >
                <SwipeCard
                  key={current.id}
                  profile={current}
                  width={cardW}
                  height={cardH}
                  onOpenDetail={() => setDetail({ profile: current })}
                  stamps={<>
                    <Animated.View style={[s.stamp, s.stampLike, { opacity: likeOpacity }]} pointerEvents="none"><Text style={[s.stampText, { color: C.like }]}>LIKE</Text></Animated.View>
                    <Animated.View style={[s.stamp, s.stampNope, { opacity: nopeOpacity }]} pointerEvents="none"><Text style={[s.stampText, { color: C.nope }]}>NOPE</Text></Animated.View>
                    <Animated.View style={[s.stamp, s.stampSuper, { opacity: superOpacity }]} pointerEvents="none"><Text style={[s.stampText, { color: C.superLike }]}>SUPER LIKE</Text></Animated.View>
                  </>}
                />
              </Animated.View>
            </>
          )}
        </View>
        <View style={s.actions}>
          <RoundButton icon="rotate-ccw" color={C.gold} size={46} label="Rewind last swipe" onPress={rewind} disabled={!lastSwipe} />
          <RoundButton icon="x" color={C.nope} size={64} label="Pass" onPress={() => swipe('pass')} disabled={!current} />
          <RoundButton icon="star" color={C.superLike} size={50} label="Super like" onPress={() => swipe('super')} disabled={!current} />
          <RoundButton icon="heart" color={C.like} size={64} label="Like" onPress={() => swipe('like')} disabled={!current} />
          <RoundButton icon="message-circle" color={C.accentInk} size={46} label="Matches" onPress={() => setTab('matches')} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {header}
      {body}
      <ProfileEditor visible={editing} existing={me} onClose={() => setEditing(false)} onSaved={(saved) => { setEditing(false); setMe(saved); loadDeck(); }} />
      <FiltersSheet visible={showFilters} filters={filters} onClose={() => setShowFilters(false)} onApply={applyFilters} />
      {detail && (
        <ProfileDetail
          profile={detail.profile}
          onClose={() => setDetail(null)}
          onPass={() => { const p = detail.profile; setDetail(null); if (detail.fromLikes) respondToLike(p, false); else swipe('pass'); }}
          onLike={() => { const p = detail.profile; setDetail(null); if (detail.fromLikes) respondToLike(p, true); else swipe('like'); }}
          onSuperLike={() => { const p = detail.profile; setDetail(null); if (detail.fromLikes) respondToLike(p, true); else swipe('super'); }}
        />
      )}
      <MatchModal match={match} me={me} onClose={() => setMatch(null)} onMessage={() => openChat(match)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  headerIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  headerAvatar: { width: 42, height: 42 },
  tabs: { flex: 1, flexDirection: 'row', backgroundColor: C.card, borderRadius: 22, padding: 3, borderWidth: 1, borderColor: C.line },
  tab: { flex: 1, minHeight: 36, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: '#8B5CF6' },
  tabText: { color: C.muted, fontWeight: '700', fontSize: 12 },
  tabTextOn: { color: '#FFF' },
  deck: { alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  cardSlot: { position: 'absolute' },
  card: { borderRadius: 22, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  noPhoto: { backgroundColor: '#F0EEF4', alignItems: 'center', justifyContent: 'center' },
  noPhotoInitial: { color: C.accentInk, fontSize: 72, fontWeight: '900' },
  photoBars: { position: 'absolute', top: 8, left: 10, right: 10, flexDirection: 'row', gap: 4 },
  photoBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  photoBarOn: { backgroundColor: '#FFF' },
  badge: { position: 'absolute', top: 20, left: 14, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  cardShade: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingBottom: 18, paddingTop: 80 },
  cardName: { color: '#FFF', fontSize: 28, fontWeight: '900' },
  cardAge: { fontWeight: '400' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { color: '#E5E5E5', fontSize: 14, fontWeight: '600' },
  cardBio: { color: '#DDD', fontSize: 14, lineHeight: 20, marginTop: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(0,0,0,0.25)' },
  tagText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  infoBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  stamp: { position: 'absolute', top: 50, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 4, borderRadius: 10 },
  stampLike: { left: 24, borderColor: C.like, transform: [{ rotate: '-18deg' }] },
  stampNope: { right: 24, borderColor: C.nope, transform: [{ rotate: '18deg' }] },
  stampSuper: { alignSelf: 'center', left: '22%', top: '45%', borderColor: C.superLike },
  stampText: { fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 14 },
  round: { backgroundColor: C.card, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  muted: { color: C.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: `${C.accent}18`, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  primaryBtn: { flexDirection: 'row', gap: 8, minHeight: 50, paddingHorizontal: 24, borderRadius: 25, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#111', fontWeight: '800', fontSize: 15 },
  ghostBtn: { minHeight: 48, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  ghostBtnBox: { minHeight: 50, paddingHorizontal: 18, borderRadius: 25, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { color: C.text, fontWeight: '700', fontSize: 15 },
  closeFloat: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  section: { gap: 6, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line },
  sectionLabel: { color: C.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionBody: { color: C.text, fontSize: 15, lineHeight: 22 },
  detailActions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 22, paddingVertical: 14, backgroundColor: 'rgba(5,5,5,0.9)' },
  matchWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  matchTitle: { color: C.accent, fontSize: 44, fontWeight: '900', fontStyle: 'italic' },
  matchSub: { color: C.text, fontSize: 16, textAlign: 'center' },
  matchPhotos: { flexDirection: 'row', gap: -20, marginVertical: 24 },
  matchPhoto: { width: 130, height: 170, borderRadius: 18, overflow: 'hidden', borderWidth: 3, borderColor: '#FFF', backgroundColor: '#222' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  label: { color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  input: { color: C.text, fontSize: 16, minHeight: 50, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.card },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, justifyContent: 'center' },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.text, fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: '#111' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoSlot: { width: '30%', aspectRatio: 0.8, borderRadius: 14, overflow: 'hidden', backgroundColor: C.card },
  photoEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  photoRemove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  bottomSheet: { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14, paddingBottom: 36, borderTopWidth: 1, borderColor: C.line },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 16, padding: 6, borderWidth: 1, borderColor: C.line },
  stepBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D1D1D' },
  stepValue: { color: C.text, fontSize: 18, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  likeCard: { aspectRatio: 0.75, borderRadius: 18, overflow: 'hidden', backgroundColor: C.card },
  likeShade: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, paddingTop: 40, gap: 8 },
  likeName: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  matchAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.card },
  matchName: { color: C.text, fontSize: 16, fontWeight: '800' },
});
