import React, { useEffect, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../store/CartProvider';
import { canPurchaseListing, cartGroup, cartKey, categoryLabel, money } from '../../utils/marketplace';
import { mediaUrl } from '../../utils/media';

export default function ListingDetailSheet({ listing, visible, onClose }) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { items, add, ready, sessions, storageError } = useCart();
  const userId = useSelector(state => state.auth.user?.id);
  const [added, setAdded] = useState(false);
  useEffect(() => { setAdded(false); }, [listing?.id, visible]);
  if (!listing) return null;
  const own = listing.sellerId === userId;
  const inCart = items.some(item => cartKey(item) === cartKey(listing));
  const pending = !!sessions[cartGroup(listing)];
  const unavailable = listing.status && listing.status !== 'ACTIVE';
  const media = (listing.mediaUrls?.length ? listing.mediaUrls : [listing.imageUrl]).map(mediaUrl).filter(Boolean);
  const navigate = (path) => { onClose(); router.push(path); };
  const chat = () => navigate({ pathname: '/(tabs)/messages', params: { partnerId: listing.sellerId, partnerName: listing.sellerName } });
  const addToCart = () => { if (!ready || own || inCart || pending || unavailable) return; add({ ...listing, kind: 'listing' }); setAdded(true); };

  return <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={s.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close listing" />
      <View style={[s.sheet, { maxHeight: height - insets.top - 16 }]}>
        <View style={s.header}><Text style={s.subtitle}>{categoryLabel(listing.listingType)}</Text><TouchableOpacity style={s.icon} onPress={onClose} accessibilityLabel="Close listing"><Feather name="x" size={23} color="#FFF" /></TouchableOpacity></View>
        <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}>
          {!!media.length && <ScrollView key={listing.id} horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {media.map((uri, index) => <Image key={`${uri}:${index}`} source={{ uri }} style={{ width, height: Math.min(width, 340) }} resizeMode="contain" accessibilityLabel={`Listing photo ${index + 1} of ${media.length}`} />)}
          </ScrollView>}
          <View style={s.content}>
            {media.length > 1 && <Text style={s.subtitle}>Swipe to see all {media.length} photos</Text>}
            <Text style={s.title}>{listing.title}</Text>
            <Text style={s.price}>{money(listing.price, listing.currency)}</Text>
            {listing.negotiable && <Text style={s.subtitle}>Seller is open to offers. Use Message seller to discuss a price.</Text>}
            {!!listing.description && <Text style={s.description}>{listing.description}</Text>}
            {!!listing.locationCity && <Text style={s.subtitle}>{listing.locationCity}</Text>}
            {listing.listingType === 'RENTAL' && <Text style={s.subtitle}>{listing.agentFee ? 'Agent fee applies' : 'No agent fee'}</Text>}
            {!!listing.sellerId && <TouchableOpacity style={s.seller} onPress={() => navigate(`/shop/${listing.sellerId}`)}>
              <Feather name="shopping-bag" size={22} color="#CDFF00" /><View style={{ flex: 1 }}><Text style={s.text}>{listing.sellerName || 'Seller'}</Text><Text style={s.subtitle}>View shop</Text></View><Feather name="chevron-right" size={20} color="#AAA" />
            </TouchableOpacity>}
            {!!storageError && <Text style={s.error}>{storageError}</Text>}
            {own ? <Text style={s.subtitle}>This is your listing.</Text> : <>
              {canPurchaseListing(listing) && <>
                <TouchableOpacity style={[s.primary, (!ready || unavailable || pending) && s.disabled]} onPress={addToCart} disabled={!ready || own || inCart || pending || !!unavailable} accessibilityRole="button">
                  <Feather name={inCart ? 'check' : 'shopping-cart'} size={20} color="#050505" /><Text style={s.primaryText}>{unavailable ? 'Listing unavailable' : inCart ? 'Added to cart' : pending ? 'Checkout in progress' : 'Add to cart'}</Text>
                </TouchableOpacity>
                {(inCart || pending) && <TouchableOpacity style={s.secondary} onPress={() => navigate('/cart')}><Text style={s.text}>View cart</Text><Feather name="arrow-right" size={18} color="#FFF" /></TouchableOpacity>}
                {added && <Text style={s.confirmation} accessibilityLiveRegion="polite">Added. Continue browsing or review your cart.</Text>}
                <Text style={s.subtitle}>Review quantities and details in your cart before checkout. No payment is taken when you add an item.</Text>
              </>}
              {!!listing.sellerId && <TouchableOpacity style={s.secondary} onPress={chat}><Feather name="message-circle" size={20} color="#FFF" /><Text style={s.text}>{listing.listingType === 'JOB' ? 'Contact employer' : 'Message seller'}</Text></TouchableOpacity>}
            </>}
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000B', justifyContent: 'flex-end' }, sheet: { backgroundColor: '#101010', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, header: { paddingLeft: 20, paddingRight: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, icon: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, gap: 16 }, title: { color: '#FFF', fontSize: 24, fontWeight: '700' }, price: { color: '#CDFF00', fontSize: 25, fontWeight: '700' }, text: { color: '#FFF', fontSize: 15, fontWeight: '600' }, subtitle: { color: '#AAA', fontSize: 13, lineHeight: 20 }, description: { color: '#DDD', fontSize: 15, lineHeight: 23 }, seller: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16, backgroundColor: '#202020', borderRadius: 16 }, primary: { flexDirection: 'row', minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, backgroundColor: '#CDFF00' }, primaryText: { fontSize: 16, fontWeight: '700', color: '#050505' }, secondary: { flexDirection: 'row', minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: '#555', borderRadius: 14 }, disabled: { opacity: 0.5 }, error: { color: '#FCA5A5' }, confirmation: { color: '#CDFF00', fontSize: 13 },
});
