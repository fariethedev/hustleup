import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, RefreshControl, Share, View, useWindowDimensions } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { authApi, feedApi, followsApi, listingsApi, usersApi } from '../../src/api/client';
import { logoutUser, selectUser, setUser } from '../../src/store/authSlice';
import { useRemote } from '../../src/hooks/useRemote';
import { Button, Copy, Notice, Panel, Screen, Section, fonts, usePalette } from '../../src/components/native/Kit';
import { ListingCard } from '../../src/components/native/DiscoveryCards';
import { mediaUrl } from '../../src/utils/media';
import { cropImage } from '../../src/components/native/ImageCropper';
import { errorMessage } from '../../src/utils/marketplace';

async function loadProfile() {
  const meRes = await authApi.me();
  const current = meRes.data;
  const results = await Promise.allSettled([
    listingsApi.getMyListings(), feedApi.getPosts(), current.id ? followsApi.getCounts(current.id) : Promise.resolve({ data: {} }),
  ]);
  const value = index => results[index].status === 'fulfilled' ? results[index].value.data : null;
  const allPosts = value(1) || [];
  return {
    user: current,
    listings: value(0) || [],
    posts: allPosts.filter(post => post.authorId === current.id?.toString() || post.authorId === current.id || post.userId === current.id),
    counts: value(2) || { followers: 0, following: 0 },
    partial: results.some(result => result.status === 'rejected'),
  };
}

function ActionTile({ icon, label, onPress }) {
  const c = usePalette();
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ flex: 1, minWidth: '21%', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 5, borderRadius: 18, borderColor: c.line, borderWidth: 1, backgroundColor: c.card }}>
    <Feather name={icon} size={19} color={c.accent} /><Copy style={{ fontSize: 10, textAlign: 'center' }}>{label}</Copy>
  </Pressable>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const storeUser = useSelector(selectUser);
  const { width } = useWindowDimensions();
  const c = usePalette();
  const [tab, setTab] = useState('posts');
  const [followModal, setFollowModal] = useState(null);
  const [followList, setFollowList] = useState([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [uploading, setUploading] = useState(null);
  const fetcher = useCallback(() => loadProfile(storeUser), [storeUser]);
  const { data, loading, error, reload } = useRemote(fetcher);
  const user = data?.user || storeUser;
  const listings = data?.listings || [];
  const posts = data?.posts || [];

  const pickImage = async type => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted && permission.accessPrivileges !== 'limited') {
        Alert.alert('Photo access needed', 'Allow photo library access in your device settings to change your profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
      if (!result.canceled && result.assets?.[0]) { const cropped = await cropImage(result.assets[0], type === 'avatar' ? [1, 1] : [16, 9]); if (!cropped) return; result.assets[0] = cropped; }
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop()?.split('?')[0] || 'photo.jpg';
      const extension = filename.split('.').pop()?.toLowerCase() || 'jpg';
      const form = new FormData();
      form.append('file', { uri: asset.uri, name: filename, type: asset.mimeType || (extension === 'jpg' ? 'image/jpeg' : `image/${extension}`) });
      setUploading(type);
      const response = type === 'avatar' ? await usersApi.uploadAvatar(form) : await usersApi.uploadBanner(form);
      dispatch(setUser({ ...storeUser, ...response.data }));
      await reload();
    } catch (e) { Alert.alert('Photo update failed', errorMessage(e, 'Your photo could not be updated. Please try again.')); }
    finally { setUploading(null); }
  };

  const openFollowModal = async type => {
    setFollowModal(type); setFollowLoading(true); setFollowList([]);
    try { const response = type === 'followers' ? await followsApi.getFollowers() : await followsApi.getFollowing(); setFollowList(response.data || []); }
    catch (e) { Alert.alert('Could not load list', errorMessage(e, 'Please try again.')); }
    finally { setFollowLoading(false); }
  };

  const shareProfile = async () => {
    try { await Share.share({ title: 'HustleSpace profile', message: `Check out ${user?.fullName || 'my'} profile on HustleSpace: https://hustleup.app/profile/${user?.id}` }); }
    catch (e) { /* The native share sheet may be dismissed. */ }
  };

  const handleLogout = () => Alert.alert('Log out', 'Are you sure you want to log out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: async () => { await dispatch(logoutUser()); router.replace('/login'); } },
  ]);

  const openListing = item => router.push({ pathname: '/listing/[id]', params: { id: item.id } });
  if (loading && !data && !user) return <Screen><Notice loading message="Loading your profile…" /></Screen>;

  return <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}>
    <View style={{ gap: 22, paddingTop: 4 }}>
      {(error || data?.partial) && <Notice message={error || 'Some profile details could not load. Pull down to try again.'} onRetry={reload} />}

      <Panel style={{ padding: 0, overflow: 'hidden', gap: 0, marginHorizontal: -20, marginTop: -24, borderRadius: 0, borderWidth: 0 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change profile cover photo" onPress={() => pickImage('banner')} style={{ height: Math.round(width * 0.62), justifyContent: 'flex-end', alignItems: 'flex-end', backgroundColor: c.soft }}>
          {user?.shopBannerUrl ? <Image source={{ uri: mediaUrl(user.shopBannerUrl) }} resizeMode="cover" style={{ width: '100%', height: '100%', position: 'absolute' }} /> : <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Feather name="aperture" size={42} color={c.accent} /></View>}
          <View style={{ margin: 12, width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0009' }}>{uploading === 'banner' ? <ActivityIndicator color="#FFF" /> : <Feather name="camera" size={16} color="#FFF" />}</View>
        </Pressable>
        <View style={{ padding: 18, paddingTop: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -38 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={() => pickImage('avatar')} style={{ width: 82, height: 82, borderRadius: 29, borderWidth: 4, borderColor: c.card, backgroundColor: c.soft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {user?.avatarUrl ? <Image source={{ uri: mediaUrl(user.avatarUrl) }} style={{ width: '100%', height: '100%' }} /> : <Feather name="user" size={32} color={c.muted} />}
              {uploading === 'avatar' && <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.accent} /></View>}
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 5 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={shareProfile} style={{ width: 42, height: 42, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.line, backgroundColor: c.card }}><Feather name="share" size={17} color={c.text} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Profile settings" onPress={() => router.push('/profile/settings')} style={{ width: 42, height: 42, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.line, backgroundColor: c.card }}><Feather name="settings" size={17} color={c.text} /></Pressable>
            </View>
          </View>
          <View style={{ marginTop: 14, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Copy heading style={{ fontSize: 23, lineHeight: 29 }}>{user?.fullName || 'Your profile'}</Copy>{user?.idVerified && <MaterialCommunityIcons name="check-decagram" size={19} color={c.accent} />}</View>
            <Copy muted style={{ fontSize: 12 }}>@{user?.username || user?.email?.split('@')[0] || 'user'} · {user?.role || 'Community member'}</Copy>
            {(user?.city || user?.country) && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}><Feather name="map-pin" size={13} color={c.muted} /><Copy muted style={{ fontSize: 12 }}>{[user.city, user.country].filter(Boolean).join(', ')}</Copy></View>}
            <Copy muted style={{ marginTop: 6 }}>{user?.bio || 'Add a short bio to tell your community about yourself.'}</Copy>
          </View>
          <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}><Button icon="edit-3" onPress={() => router.push('/profile/edit')} style={{ flex: 1 }}>Edit profile</Button><Button secondary icon="log-out" onPress={handleLogout} /></View>
        </View>
      </Panel>

      <Panel style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        {[
          { label: 'Followers', value: data?.counts?.followers ?? 0, onPress: () => openFollowModal('followers') },
          { label: 'Following', value: data?.counts?.following ?? 0, onPress: () => openFollowModal('following') },
          { label: 'Listings', value: listings.length, onPress: () => setTab('inventory') },
        ].map((stat, index) => <React.Fragment key={stat.label}>{index > 0 && <View style={{ width: 1, height: 32, backgroundColor: c.line }} />}<Pressable accessibilityRole="button" onPress={stat.onPress} style={{ flex: 1, alignItems: 'center', gap: 2, minHeight: 44, justifyContent: 'center' }}><Copy heading style={{ fontSize: 19 }}>{stat.value}</Copy><Copy muted style={{ fontSize: 10 }}>{stat.label}</Copy></Pressable></React.Fragment>)}
      </Panel>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        <ActionTile icon="shopping-bag" label="My shop" onPress={() => user?.id && router.push({ pathname: '/shop/[userId]', params: { userId: user.id } })} />
        <ActionTile icon="package" label="Orders" onPress={() => router.push('/profile/orders')} />
        <ActionTile icon="star" label="Reviews" onPress={() => router.push('/profile/reviews')} />
        <ActionTile icon="bar-chart-2" label="Dashboard" onPress={() => router.push('/dashboard')} />
      </View>

      <View>
        <Section eyebrow="YOUR ACTIVITY" title="Your profile" />
        <View style={{ flexDirection: 'row', padding: 4, borderRadius: 17, backgroundColor: c.soft, gap: 4 }}>
          {[['posts', `Posts ${posts.length}`], ['inventory', `Listings ${listings.length}`]].map(([key, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)} style={{ flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: tab === key ? c.card : 'transparent' }}><Copy style={{ fontSize: 12, color: tab === key ? c.text : c.muted, fontFamily: tab === key ? fonts.medium : fonts.body }}>{label}</Copy></Pressable>)}
        </View>
      </View>

      {tab === 'posts' && (posts.length ? posts.map(post => <Panel key={post.id} style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
        {post.media?.[0]?.url && <Image source={{ uri: mediaUrl(post.media[0].url) }} style={{ width: '100%', aspectRatio: 1.35, backgroundColor: c.soft }} resizeMode="cover" />}
        <View style={{ padding: 16, gap: 12 }}><Copy>{post.content || 'Shared a moment with the community.'}</Copy><View style={{ flexDirection: 'row', alignItems: 'center', gap: 17 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Feather name="heart" size={15} color={c.muted} /><Copy muted style={{ fontSize: 11 }}>{post.likesCount || 0}</Copy></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Feather name="message-circle" size={15} color={c.muted} /><Copy muted style={{ fontSize: 11 }}>{post.commentsCount || 0}</Copy></View>
          <Copy muted style={{ marginLeft: 'auto', fontSize: 10 }}>{post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ''}</Copy>
        </View></View>
      </Panel>) : <Notice message="Your posts will show up here when you share with the community." />)}

      {tab === 'inventory' && <><Button icon="plus" onPress={() => router.push('/profile/listings')}>Manage or add listings</Button>{listings.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{listings.map(item => <ListingCard key={item.id} item={item} onOpen={() => router.push(`/profile/listings?id=${item.id}`)} style={{ width: '47%' }} />)}</View> : <Notice message="You have not posted any listings yet. Create one to start selling." />}</>}
    </View>

    <Modal visible={followModal !== null} transparent animationType="slide" onRequestClose={() => setFollowModal(null)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
        <Pressable accessibilityLabel="Close followers dialog" onPress={() => setFollowModal(null)} style={{ flex: 1 }} />
        <View style={{ maxHeight: '72%', minHeight: 280, backgroundColor: c.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 12 }}>
          <View style={{ width: 38, height: 4, borderRadius: 4, backgroundColor: c.line, alignSelf: 'center', marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderColor: c.line }}><Copy heading style={{ fontSize: 19 }}>{followModal === 'followers' ? 'Followers' : 'Following'}</Copy><Pressable accessibilityLabel="Close" onPress={() => setFollowModal(null)} hitSlop={10}><Feather name="x" size={21} color={c.text} /></Pressable></View>
          {followLoading ? <ActivityIndicator color={c.accent} style={{ marginTop: 30 }} /> : <FlatList data={followList} keyExtractor={item => String(item.id)} ListEmptyComponent={<View style={{ padding: 30 }}><Notice message={followModal === 'followers' ? 'No followers to show yet.' : 'You are not following anyone yet.'} /></View>} renderItem={({ item }) => <Pressable onPress={() => { setFollowModal(null); router.push(`/profile/${item.id}`); }} style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: c.line }}>
            {item.avatarUrl ? <Image source={{ uri: mediaUrl(item.avatarUrl) }} style={{ width: 42, height: 42, borderRadius: 16 }} /> : <View style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Feather name="user" size={18} color={c.muted} /></View>}
            <View style={{ flex: 1 }}><Copy style={{ fontFamily: fonts.medium }}>{item.fullName || 'Community member'}</Copy><Copy muted style={{ fontSize: 11 }}>@{item.username || item.email?.split('@')[0] || 'member'}</Copy></View><Feather name="chevron-right" size={18} color={c.muted} />
          </Pressable>} />}
        </View>
      </View>
    </Modal>
  </Screen>;
}
