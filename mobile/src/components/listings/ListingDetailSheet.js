import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { bookingsApi, directMessagesApi, API_URL } from '../../api/client';
import { selectIsAuthenticated } from '../../store/authSlice';

const { width, height } = Dimensions.get('window');
const LIME = '#CDFF00';
const BG   = '#050505';

const TYPE_COLORS = {
  PRODUCT: '#60A5FA', SERVICE: '#A78BFA', JOB: '#FB923C',
  SKILL: '#34D399', RENTAL: '#F472B6', EVENT: '#FBBF24',
};

const resolveUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const base = (typeof API_URL !== 'undefined' && API_URL
    ? API_URL
    : 'http://localhost:8000/api/v1'
  ).replace('/api/v1', '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function ListingDetailSheet({ listing, visible, onClose }) {
  const [activeImg, setActiveImg] = useState(0);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [showPolicy, setShowPolicy] = useState(false);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const router = useRouter();

  const reset = () => { setActiveImg(0); setBooked(false); setBookingError(''); setShowPolicy(false); };
  const handleClose = () => { reset(); onClose?.(); };

  const goToShop  = () => { handleClose(); router.push(`/shop/${listing.sellerId}`); };
  const goToChat  = () => { handleClose(); router.push({ pathname: '/(tabs)/messages', params: { partnerId: listing.sellerId, partnerName: listing.sellerName } }); };

  const handleBuyNow = async () => {
    if (!isAuthenticated) { setBookingError('Please sign in to place an order.'); return; }
    setBooking(true);
    setBookingError('');
    try {
      await bookingsApi.create({ listingId: listing.id, offeredPrice: listing.price });
      await directMessagesApi.sendMessage(
        listing.sellerId,
        `Hi! I just placed an order for "${listing.title}" (${currency}${listing.price}). Looking forward to hearing from you! 🛒`
      );
      setBooked(true);
    } catch (e) {
      setBookingError(e.response?.data?.message || 'Could not place order. Try messaging the seller directly.');
    } finally {
      setBooking(false);
    }
  };

  if (!listing) return null;
  const media    = (listing.mediaUrls || []).map(resolveUrl).filter(Boolean);
  const currency = listing.currency || '£';
  const typeColor = TYPE_COLORS[listing.listingType] || LIME;

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

            {/* ── Images ── */}
            {media.length > 0 ? (
              <View>
                <ScrollView
                  horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => setActiveImg(Math.round(e.nativeEvent.contentOffset.x / width))}
                >
                  {media.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={[s.image, { width }]} resizeMode="cover" />
                  ))}
                </ScrollView>
                {media.length > 1 && (
                  <View style={s.dots}>
                    {media.map((_, i) => <View key={i} style={[s.dot, i === activeImg && s.dotActive]} />)}
                  </View>
                )}
              </View>
            ) : (
              <View style={s.noImg}>
                <Feather name="package" size={52} color="rgba(255,255,255,0.08)" />
              </View>
            )}

            <View style={s.body}>
              {/* Badges */}
              <View style={s.badgeRow}>
                <View style={[s.typeBadge, { backgroundColor: typeColor + '22', borderColor: typeColor + '55' }]}>
                  <Text style={[s.typeBadgeText, { color: typeColor }]}>{listing.listingType || 'PRODUCT'}</Text>
                </View>
                {listing.condition ? (
                  <View style={s.condBadge}><Text style={s.condBadgeText}>{listing.condition}</Text></View>
                ) : null}
                {listing.listingType === 'RENTAL' && (
                  <View style={[s.condBadge, listing.agentFee
                    ? { backgroundColor: '#EF444420', borderColor: '#EF444455' }
                    : { backgroundColor: '#22C55E20', borderColor: '#22C55E55' }]}>
                    <Text style={[s.condBadgeText, { color: listing.agentFee ? '#EF4444' : '#22C55E' }]}>
                      {listing.agentFee ? 'Agent Fee' : 'No Agent Fee'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Price */}
              <View style={s.priceRow}>
                <Text style={s.price}>{currency}{Number(listing.price).toLocaleString()}</Text>
                {listing.negotiable ? (
                  <View style={s.negBadge}><Text style={s.negText}>NEGOTIABLE</Text></View>
                ) : null}
              </View>

              <Text style={s.title}>{listing.title}</Text>
              {listing.description ? <Text style={s.desc}>{listing.description}</Text> : null}

              {listing.locationCity ? (
                <View style={s.locRow}>
                  <Feather name="map-pin" size={13} color="rgba(255,255,255,0.3)" />
                  <Text style={s.locText}>{listing.locationCity}{listing.locationCountry ? `, ${listing.locationCountry}` : ''}</Text>
                </View>
              ) : null}

              {/* ── Seller card ── */}
              {listing.sellerName ? (
                <TouchableOpacity style={s.sellerCard} onPress={goToShop} activeOpacity={0.85}>
                  <View style={s.sellerAvatar}>
                    {listing.sellerAvatarUrl ? (
                      <Image source={{ uri: resolveUrl(listing.sellerAvatarUrl) }} style={s.sellerAvatarImg} />
                    ) : (
                      <Text style={s.sellerInitial}>{(listing.sellerName || '?')[0].toUpperCase()}</Text>
                    )}
                    <View style={s.onlineDot} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sellerName}>{listing.sellerName}</Text>
                    <Text style={s.sellerSub}>Tap to view their shop →</Text>
                  </View>
                  <View style={s.shopPill}>
                    <Feather name="shopping-bag" size={12} color={LIME} />
                    <Text style={s.shopPillText}>SHOP</Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {/* ── Payment policy ── */}
              <TouchableOpacity style={s.policyBox} onPress={() => setShowPolicy(v => !v)} activeOpacity={0.85}>
                <View style={s.policyRow}>
                  <Feather name="shield" size={14} color={LIME} />
                  <Text style={s.policyTitle}>HustleUp Buyer Policy</Text>
                  <Feather name={showPolicy ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.35)" />
                </View>
                {showPolicy ? (
                  <Text style={s.policyBody}>
                    {'• Payment is arranged directly between buyer and seller.\n• Agree on method (bank transfer, cash, Blik, etc.) via chat before paying.\n• Always verify item condition before completing payment.\n• Card & Blik in-app payments coming soon.\n• For disputes, contact HustleUp support via Help.'}
                  </Text>
                ) : null}
              </TouchableOpacity>

              {/* Error */}
              {bookingError ? (
                <View style={s.errorBox}>
                  <Feather name="alert-circle" size={13} color="#EF4444" />
                  <Text style={s.errorText}>{bookingError}</Text>
                </View>
              ) : null}

              {/* Actions */}
              {booked ? (
                <View style={s.successBox}>
                  <Feather name="check-circle" size={24} color={LIME} />
                  <Text style={s.successTitle}>Order Placed! 🎉</Text>
                  <Text style={s.successSub}>
                    A message has been sent to the seller. Continue the chat to arrange payment and delivery.
                  </Text>
                  <TouchableOpacity style={s.goToChatBtn} onPress={goToChat}>
                    <Feather name="message-circle" size={16} color={BG} />
                    <Text style={s.goToChatText}>Continue in Chat</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.actionRow}>
                  <TouchableOpacity style={s.buyBtn} onPress={handleBuyNow} disabled={booking} activeOpacity={0.88}>
                    {booking ? (
                      <ActivityIndicator size="small" color={BG} />
                    ) : (
                      <>
                        <Feather name="shopping-cart" size={18} color={BG} />
                        <Text style={s.buyBtnText}>Buy Now · {currency}{Number(listing.price).toLocaleString()}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.msgBtn} onPress={goToChat} activeOpacity={0.85}>
                    <Feather name="message-circle" size={20} color={LIME} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  sheet: { backgroundColor: '#0E0E0E', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: height * 0.92, overflow: 'hidden' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginVertical: 12 },
  image: { height: 300 },
  noImg: { height: 180, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, position: 'absolute', bottom: 12, width: '100%' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: LIME, width: 18 },
  body: { padding: 22, paddingBottom: 48, gap: 14 },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  typeBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  condBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  condBadgeText: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  price: { color: LIME, fontSize: 30, fontWeight: '900' },
  negBadge: { backgroundColor: 'rgba(205,255,0,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(205,255,0,0.25)' },
  negText: { color: LIME, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF', fontSize: 20, fontWeight: '900', lineHeight: 26 },
  desc: { color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 22 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locText: { color: 'rgba(255,255,255,0.35)', fontSize: 13 },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sellerAvatar: { width: 48, height: 48, borderRadius: 15, backgroundColor: 'rgba(205,255,0,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(205,255,0,0.25)', position: 'relative' },
  sellerAvatarImg: { width: 48, height: 48, borderRadius: 15 },
  sellerInitial: { color: LIME, fontSize: 20, fontWeight: '900' },
  onlineDot: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#0E0E0E' },
  sellerName: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  sellerSub: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 },
  shopPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(205,255,0,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(205,255,0,0.2)' },
  shopPillText: { color: LIME, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  policyBox: { backgroundColor: 'rgba(205,255,0,0.04)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(205,255,0,0.1)' },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  policyTitle: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '800', flex: 1 },
  policyBody: { color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 20, marginTop: 10 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '700', flex: 1 },
  successBox: { alignItems: 'center', gap: 10, backgroundColor: 'rgba(205,255,0,0.06)', borderRadius: 18, padding: 22, borderWidth: 1, borderColor: 'rgba(205,255,0,0.2)' },
  successTitle: { color: LIME, fontSize: 18, fontWeight: '900' },
  successSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  goToChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: LIME, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, marginTop: 4 },
  goToChatText: { color: BG, fontWeight: '900', fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 12 },
  buyBtn: { flex: 1, backgroundColor: LIME, borderRadius: 16, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buyBtnText: { color: BG, fontWeight: '900', fontSize: 14 },
  msgBtn: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(205,255,0,0.08)', borderWidth: 1.5, borderColor: 'rgba(205,255,0,0.25)', alignItems: 'center', justifyContent: 'center' },
});
