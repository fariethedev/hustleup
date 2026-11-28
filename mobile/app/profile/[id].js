import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { CircleUser, MessageCircleMore, Cog, CirclePlus } from 'lucide-react-native';
import { usersApi, listingsApi, reviewsApi, followsApi } from '../../src/api/client';
import { selectUser } from '../../src/store/authSlice';
import { Screen, Copy, Button, Panel, Notice, usePalette } from '../../src/components/native/Kit';
import { ListingCard } from '../../src/components/native/DiscoveryCards';
import PremiumBadge from '../../src/components/PremiumBadge';
import CreateListingModal from '../../src/components/listings/CreateListingModal';
import { mediaUrl } from '../../src/utils/media';

export default function UserProfileScreen() {
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams();
  const router = useRouter(), colors = usePalette();
  const me = useSelector(selectUser);
  const own = String(me?.id) === String(id);
  const [profile, setProfile] = useState(null), [rel, setRel] = useState(null);
  const [followsYou, setFollowsYou] = useState(false);
  const [listings, setListings] = useState([]), [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [tab, setTab] = useState('Listings');
  const [creating, setCreating] = useState(false);
  const [people, setPeople] = useState(null), [peopleLoading, setPeopleLoading] = useState(false), [peopleError, setPeopleError] = useState('');
  const generation = useRef(0), followLock = useRef(false), peopleGeneration = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(''); setRel(null); setFollowsYou(false);
    try {
      const user = (await usersApi.getProfile(id)).data;
      const [relationship, followers, goods, ratings] = await Promise.allSettled([
        followsApi.relationship(id),
        me?.id && !own ? followsApi.getMyFollowers() : Promise.resolve({ data: [] }),
        listingsApi.getByUser(id), reviewsApi.forUser(id),
      ]);
      if (request !== generation.current) return;
      setProfile(user);
      setRel(relationship.status === 'fulfilled' ? relationship.value.data : null);
      setFollowsYou(followers.status === 'fulfilled' && Array.isArray(followers.value.data) && followers.value.data.some(p => String(p.id || p.userId || p) === String(id)));
      setListings(goods.status === 'fulfilled' && Array.isArray(goods.value.data) ? goods.value.data : []);
      setReviews(ratings.status === 'fulfilled' && Array.isArray(ratings.value.data) ? ratings.value.data : []);
      if (relationship.status === 'rejected' || goods.status === 'rejected' || ratings.status === 'rejected') setError('Some profile information could not be loaded. Please retry.');
    } catch { if (request === generation.current) { setProfile(null); setError('Could not load this profile. Please retry.'); } }
    finally { if (request === generation.current) setLoading(false); }
  }, [id, me, own]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) load(); });
    return () => { active = false; generation.current++; };
  }, [load]);
  const follow = async () => {
    if (!me) { router.push('/login'); return; }
    if (followLock.current || !rel || own || rel.blocked || rel.blockedBy) return;
    followLock.current = true; setBusy(true);
    const request = generation.current;
    try {
      if (rel.isFollowing || rel.followRequested) await followsApi.unfollow(id);
      else await followsApi.follow(id);
      const result = await followsApi.relationship(id);
      if (request === generation.current) {
        setRel(result.data);
        if (profile.privateAccount && result.data.isFollowing && !rel.isFollowing) await load();
      }
    } catch (e) { Alert.alert('Could not update follow status', e.response?.data?.error || 'Please retry.'); }
    finally { followLock.current = false; setBusy(false); }
  };
  const openPeople = async kind => {
    const request = ++peopleGeneration.current;
    setPeople({ kind, rows: [] }); setPeopleLoading(true); setPeopleError('');
    try {
      const { data } = await (kind === 'Followers' ? followsApi.getMyFollowers() : followsApi.getMyFollowing());
      if (request === peopleGeneration.current) setPeople({ kind, rows: Array.isArray(data) ? data : [] });
    } catch { if (request === peopleGeneration.current) setPeopleError('Could not load this list.'); }
    finally { if (request === peopleGeneration.current) setPeopleLoading(false); }
  };
  const closePeople = () => { peopleGeneration.current++; setPeople(null); };
  const restricted = !own && (profile?.privateAccount && !rel?.isFollowing || rel?.blocked || rel?.blockedBy);
  const followLabel = rel?.isFollowing ? 'Following' : rel?.followRequested ? 'Requested · Cancel' : followsYou ? 'Follow back' : profile?.privateAccount ? 'Request to follow' : 'Follow';
  return <Screen back title="Profile">
    {loading ? <Notice loading message="Loading profile…" /> : <>
      {!!error && <Notice message={error} onRetry={load} />}
      {profile && <>
        <Panel style={{ padding: 0, overflow: 'hidden', gap: 0, marginHorizontal: -20, borderRadius: 0, borderWidth: 0 }}>
          <View style={{ height: Math.round(width * 0.56), backgroundColor: colors.soft }}>{profile.shopBannerUrl && <Image source={{ uri: mediaUrl(profile.shopBannerUrl) }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />}</View>
          <View style={{ padding: 18, gap: 12 }}>
            <View style={{ width: 88, height: 88, marginTop: -58, borderRadius: 44, borderWidth: 4, borderColor: colors.card, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {profile.avatarUrl ? <Image source={{ uri: mediaUrl(profile.avatarUrl) }} style={{ width: '100%', height: '100%' }} /> : <CircleUser size={44} color={colors.muted} />}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Copy heading style={{ fontSize: 24, flexShrink: 1 }}>{profile.username ? '@' + profile.username : profile.fullName || 'User'}</Copy><PremiumBadge active={profile.premium} /></View>
            {!!profile.username && !!profile.fullName && <Copy muted>{profile.fullName}</Copy>}
            {followsYou && <Copy style={{ color: colors.accent }}>Follows you</Copy>}
            {!!profile.bio && <Copy>{profile.bio}</Copy>}
            {!!profile.city && <Copy muted>{profile.city}</Copy>}
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {own ? <><Button icon={<CirclePlus size={18} color="#050505" />} onPress={() => setCreating(true)}>Add listing</Button><Button secondary icon={<Cog size={18} color={colors.text} />} onPress={() => router.push('/profile/edit')}>Edit profile</Button></> :
                rel?.blocked || rel?.blockedBy ? <Copy muted>This connection is unavailable.</Copy> :
                <><Button secondary={!!(rel?.isFollowing || rel?.followRequested)} busy={busy} disabled={!!me && !rel} onPress={follow}>{followLabel}</Button><Button secondary icon={<MessageCircleMore size={18} color={colors.text} />} onPress={() => me ? router.push({ pathname: '/(tabs)/messages', params: { partnerId: id, partnerName: profile.fullName || profile.username, partnerAvatar: profile.avatarUrl || '' } }) : router.push('/login')}>Message</Button></>}
            </View>
            <View style={{ flexDirection: 'row', gap: 24, paddingTop: 8 }}>
              {['Followers', 'Following'].map(kind => <Pressable key={kind} accessibilityRole={own ? 'button' : 'text'} accessibilityLabel={kind} disabled={!own || restricted || !rel} onPress={() => openPeople(kind)}><Copy heading>{rel?.[kind.toLowerCase()] ?? '—'}</Copy><Copy muted>{kind}</Copy></Pressable>)}
              <View><Copy heading>{profile.avgRating != null ? Number(profile.avgRating).toFixed(1) : '—'}</Copy><Copy muted>Rating</Copy></View>
            </View>
          </View>
        </Panel>
        {restricted ? <Notice message={profile.privateAccount ? 'This account is private. Follow to see their profile content once approved.' : 'Profile content is unavailable.'} /> : <>
          <View style={{ flexDirection: 'row', gap: 10 }}>{['Listings', 'Reviews'].map(value => <Button key={value} secondary={tab !== value} onPress={() => setTab(value)}>{value}</Button>)}</View>
          {tab === 'Listings' ? listings.length ? listings.map(item => <ListingCard key={item.id} item={item} onOpen={() => router.push('/listing/' + item.id)} />) : <Notice message="No listings yet." /> :
            reviews.length ? reviews.map((review, index) => <Panel key={review.id || index}><Copy heading>{review.reviewerName || review.authorName || 'Review'} · {review.rating}/5</Copy><Copy>{review.comment || review.content || ''}</Copy></Panel>) : <Notice message="No reviews yet." />}
        </>}
      </>}
    </>}
    <CreateListingModal visible={creating} onClose={() => setCreating(false)} onCreated={load} />
    <Modal visible={!!people} animationType="slide" onRequestClose={closePeople}><SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><View style={{ padding: 20, gap: 16, flex: 1 }}><Button secondary onPress={closePeople}>Back to profile</Button><Copy heading>{people?.kind}</Copy><ScrollView>
      {peopleLoading ? <Notice loading message="Loading…" /> : peopleError ? <Notice message={peopleError} onRetry={() => openPeople(people.kind)} /> : !people?.rows.length ? <Notice message="No accounts yet." /> : people.rows.map(person => <Pressable key={person.id || person.userId} accessibilityRole="button" style={{ paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line }} onPress={() => { closePeople(); router.push('/profile/' + (person.id || person.userId)); }}><Copy>{person.username ? '@' + person.username : person.fullName || 'User'}</Copy></Pressable>)}
    </ScrollView></View></SafeAreaView></Modal>
  </Screen>;
}
