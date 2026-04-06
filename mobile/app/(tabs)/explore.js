import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../../src/store/authSlice';
import { listingsApi } from '../../src/api/client';
import { useRouter } from 'expo-router';

const LIME = '#CDFF00';
const BG   = '#050505';
const { width } = Dimensions.get('window');

const CATEGORIES = [
  { key: null,           label: 'ALL',        icon: 'grid' },
  { key: 'GOODS',        label: 'GOODS',      icon: 'package' },
  { key: 'FOOD',         label: 'FOOD',       icon: 'coffee' },
  { key: 'EVENT',        label: 'EVENTS',     icon: 'calendar' },
  { key: 'JOB',          label: 'JOBS',       icon: 'briefcase' },
  { key: 'RENTAL',       label: 'RENTALS',    icon: 'home' },
  { key: 'FASHION',      label: 'FASHION',    icon: 'tag' },
  { key: 'SKILL',        label: 'SKILLS',     icon: 'cpu' },
  { key: 'HAIR_BEAUTY',  label: 'BEAUTY',     icon: 'scissors' },
];

const TYPE_COLORS = {
  SKILL: '#60A5FA', HAIR_BEAUTY: '#F472B6', FOOD: '#FB923C',
  FASHION: LIME,    GOODS: '#A78BFA',       EVENT: '#34D399',
  JOB: '#FBBF24',   RENTAL: '#38BDF8',
};

const TYPE_LABELS = {
  SKILL: 'SKILL', HAIR_BEAUTY: 'BEAUTY', FOOD: 'FOOD',
  FASHION: 'FASHION', GOODS: 'GOODS', EVENT: 'EVENT',
  JOB: 'JOB', RENTAL: 'RENTAL',
};

const TYPE_ICONS = {
  SKILL: 'cpu', HAIR_BEAUTY: 'scissors', FOOD: 'coffee',
  FASHION: 'tag', GOODS: 'package', EVENT: 'calendar',
  JOB: 'briefcase', RENTAL: 'home',
};

// ── Small grid card (used in Hot Now + See More) ──────────────────────────
function ListingCard({ item, onPress }) {
  const typeColor = TYPE_COLORS[item.type] || '#888';
  const imageSource = item.mediaUrls?.[0] || item.imageUrl;
  const sellerInitial = item.sellerName?.[0]?.toUpperCase() || '?';

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(item)} activeOpacity={0.85}>
      {/* Full-bleed image */}
      {imageSource ? (
        <Image source={{ uri: imageSource }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <LinearGradient colors={[`${typeColor}30`, `${typeColor}08`]} style={StyleSheet.absoluteFillObject}>
          <View style={styles.cardFallbackIcon}>
            <Feather name={TYPE_ICONS[item.type] || 'tag'} size={36} color={typeColor} />
          </View>
        </LinearGradient>
      )}

      {/* Gradient overlay */}
      <LinearGradient
        colors={['transparent', 'transparent', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.95)']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Seller avatar — top left */}
      {item.sellerName && (
        <View style={styles.cardSellerPill}>
          <View style={styles.cardSellerAvatar}>
            <Text style={styles.cardSellerAvatarText}>{sellerInitial}</Text>
          </View>
          <Text style={styles.cardSellerName} numberOfLines={1}>{item.sellerName}</Text>
        </View>
      )}

      {/* Negotiable badge — top right */}
      {item.negotiable && (
        <View style={styles.cardDealBadge}>
          <Text style={styles.cardDealText}>DEAL</Text>
        </View>
      )}

      {/* Bottom overlay content */}
      <View style={styles.cardOverlay}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

        {/* Bottom row: type badge + price + location */}
        <View style={styles.cardBottomRow}>
          <View style={[styles.cardTypePill, { backgroundColor: `${typeColor}25`, borderColor: `${typeColor}50` }]}>
            <Feather name={TYPE_ICONS[item.type] || 'tag'} size={8} color={typeColor} />
            <Text style={[styles.cardTypeText, { color: typeColor }]}>{TYPE_LABELS[item.type] || item.type}</Text>
          </View>
          {item.price != null && (
            <View style={styles.cardPricePill}>
              <Text style={styles.cardPriceText}>{Number(item.price).toFixed(0)} zł</Text>
            </View>
          )}
          {item.locationCity && (
            <View style={styles.cardLocPill}>
              <Feather name="map-pin" size={8} color="rgba(255,255,255,0.6)" />
              <Text style={styles.cardLocText} numberOfLines={1}>{item.locationCity}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Wide featured card (horizontal scroll) ────────────────────────────────
function FeaturedCard({ item, onPress }) {
  const typeColor = TYPE_COLORS[item.type] || '#888';
  const imageSource = item.mediaUrls?.[0] || item.imageUrl;
  const sellerInitial = item.sellerName?.[0]?.toUpperCase() || '?';

  return (
    <TouchableOpacity style={styles.featCard} onPress={() => onPress?.(item)} activeOpacity={0.85}>
      {/* Full-bleed image */}
      {imageSource ? (
        <Image source={{ uri: imageSource }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <LinearGradient colors={[`${typeColor}44`, `${typeColor}11`]} style={StyleSheet.absoluteFillObject}>
          <View style={styles.featInitialWrap}>
            <Text style={[styles.featInitial, { color: typeColor }]}>{item.title?.[0] || '?'}</Text>
          </View>
        </LinearGradient>
      )}

      {/* Gradient overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
        locations={[0, 0.25, 0.65, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Seller pill — top */}
      {item.sellerName && (
        <View style={styles.featSellerPill}>
          <View style={styles.featSellerAvatar}>
            <Text style={styles.featSellerAvatarText}>{sellerInitial}</Text>
          </View>
          <Text style={styles.featSellerName} numberOfLines={1}>{item.sellerName}</Text>
        </View>
      )}

      {/* Bottom overlay */}
      <View style={styles.featOverlay}>
        <Text style={styles.featTitle} numberOfLines={2}>{item.title}</Text>

        <View style={styles.featBottomRow}>
          <View style={[styles.cardTypePill, { backgroundColor: `${typeColor}25`, borderColor: `${typeColor}50` }]}>
            <Feather name={TYPE_ICONS[item.type] || 'tag'} size={8} color={typeColor} />
            <Text style={[styles.cardTypeText, { color: typeColor }]}>{TYPE_LABELS[item.type] || item.type}</Text>
          </View>
          {item.price != null && (
            <View style={styles.cardPricePill}>
              <Text style={styles.cardPriceText}>{Number(item.price).toFixed(0)} zł</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Listing Detail Bottom Sheet with Negotiate + Purchase ─────────────────
function ListingDetailSheet({ item, visible, onClose }) {
  const router = useRouter();
  const [negotiateVisible, setNegotiateVisible] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [negotiationState, setNegotiationState] = useState('idle'); // idle | offered | accepted | declined
  const [shopVisible, setShopVisible] = useState(false);

  if (!item) return null;
  const typeColor  = TYPE_COLORS[item.type] || '#888';
  const initials   = item.sellerName?.[0]?.toUpperCase() || item.title?.[0]?.toUpperCase() || '?';
  const sellerInit = item.sellerName?.[0]?.toUpperCase() || '?';

  const handleMakeOffer = () => {
    if (!offerAmount || isNaN(parseFloat(offerAmount)) || parseFloat(offerAmount) <= 0) {
      Alert.alert('Invalid offer', 'Please enter a valid amount.');
      return;
    }
    setNegotiationState('offered');
    // Simulate seller response after 2s
    setTimeout(() => {
      const accepted = Math.random() > 0.3; // 70% chance of acceptance
      setNegotiationState(accepted ? 'accepted' : 'declined');
    }, 2000);
  };

  const handleBuy = () => {
    const price = negotiationState === 'accepted' ? offerAmount : item.price;
    Alert.alert(
      '💳 Confirm Purchase',
      `Buy "${item.title}" for PLN ${Number(price).toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay Now', onPress: () => {
          Alert.alert('✅ Order Placed!', `Your order for "${item.title}" has been confirmed.\n\nThe seller will be notified.`, [
            { text: 'OK', onPress: () => { setNegotiationState('idle'); setOfferAmount(''); setNegotiateVisible(false); onClose(); } }
          ]);
        }},
      ]
    );
  };

  const handleClose = () => {
    setNegotiationState('idle');
    setOfferAmount('');
    setNegotiateVisible(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheetContainer}>
          {/* Drag handle */}
          <View style={styles.sheetHandle} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
            {/* Hero image */}
            <View style={styles.detailHero}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.detailHeroImage} resizeMode="cover" />
              ) : (
                <LinearGradient colors={[`${typeColor}44`, `${typeColor}11`]} style={styles.detailHeroImage}>
                  <Text style={[styles.detailHeroInitial, { color: typeColor }]}>{initials}</Text>
                </LinearGradient>
              )}
              {/* Type badge overlay */}
              <View style={[styles.typeBadge, styles.detailTypeBadge, { borderColor: `${typeColor}60`, backgroundColor: `${typeColor}28` }]}>
                <Feather name={TYPE_ICONS[item.type] || 'tag'} size={10} color={typeColor} />
                <Text style={[styles.typeBadgeText, { color: typeColor }]}>{TYPE_LABELS[item.type] || item.type || 'OTHER'}</Text>
              </View>
            </View>

            {/* Title + price */}
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{item.title}</Text>
              {item.price != null && (
                <View style={styles.detailPriceRow}>
                  <Text style={styles.detailPrice}>{Number(item.price).toFixed(2)} PLN</Text>
                  {item.negotiable && (
                    <View style={styles.negotiableBadge}>
                      <Text style={styles.negotiableText}>NEGOTIABLE</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Seller row */}
            <TouchableOpacity style={styles.detailSellerRow} onPress={() => { handleClose(); router.push(`/shop/${item.sellerId}?name=${encodeURIComponent(item.sellerName || 'Seller')}`); }} activeOpacity={0.75}>
              <View style={styles.detailAvatar}>
                <Text style={styles.detailAvatarText}>{sellerInit}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailSellerLabel}>Sold by</Text>
                <Text style={styles.detailSellerName}>{item.sellerName || 'Unknown Seller'}</Text>
              </View>
              <View style={styles.viewShopBtn}>
                <Feather name="shopping-bag" size={12} color={BG} />
                <Text style={styles.viewShopBtnText}>View Shop</Text>
              </View>
            </TouchableOpacity>

            {/* Description */}
            {!!item.description && (
              <View style={styles.detailDescWrap}>
                <Text style={styles.detailDescLabel}>About this listing</Text>
                <Text style={styles.detailDescText}>{item.description}</Text>
              </View>
            )}

            {/* Location */}
            {item.locationCity && (
              <View style={styles.detailLocRow}>
                <Feather name="map-pin" size={14} color="rgba(255,255,255,0.4)" />
                <Text style={styles.detailLocText}>{item.locationCity}</Text>
              </View>
            )}

            {/* Negotiate Section */}
            {negotiateVisible && (
              <View style={styles.negotiateSection}>
                <Text style={styles.negotiateTitle}>Make an Offer</Text>
                {negotiationState === 'idle' && (
                  <View style={styles.negotiateInputRow}>
                    <Text style={styles.currencyLabel}>PLN</Text>
                    <TextInput
                      style={styles.negotiateInput}
                      placeholder={`Suggest a price (listed: PLN ${Number(item.price).toFixed(2)})`}
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      keyboardType="numeric"
                      value={offerAmount}
                      onChangeText={setOfferAmount}
                    />
                    <TouchableOpacity style={styles.offerBtn} onPress={handleMakeOffer}>
                      <Text style={styles.offerBtnText}>Send Offer</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {negotiationState === 'offered' && (
                  <View style={styles.negotiateStatus}>
                    <ActivityIndicator color={LIME} size="small" />
                    <Text style={styles.negotiateStatusText}>Waiting for seller to respond...</Text>
                  </View>
                )}
                {negotiationState === 'accepted' && (
                  <View style={styles.negotiateStatus}>
                    <Feather name="check-circle" size={20} color="#34C759" />
                    <Text style={[styles.negotiateStatusText, { color: '#34C759' }]}>
                      Offer of PLN {Number(offerAmount).toFixed(2)} accepted!
                    </Text>
                  </View>
                )}
                {negotiationState === 'declined' && (
                  <View style={styles.negotiateStatus}>
                    <Feather name="x-circle" size={20} color="#FF3B30" />
                    <View>
                      <Text style={[styles.negotiateStatusText, { color: '#FF3B30' }]}>Offer declined</Text>
                      <TouchableOpacity onPress={() => { setNegotiationState('idle'); setOfferAmount(''); }}>
                        <Text style={styles.tryAgainText}>Try a different amount →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Actions */}
            <View style={styles.detailActions}>
              <TouchableOpacity style={styles.buyBtn} onPress={handleBuy} activeOpacity={0.85}>
                <Feather name="shopping-cart" size={16} color="#FFF" />
                <Text style={styles.buyBtnText}>
                  {negotiationState === 'accepted' ? `Buy for PLN ${Number(offerAmount).toFixed(2)}` : `Buy for PLN ${Number(item.price || 0).toFixed(2)}`}
                </Text>
              </TouchableOpacity>
              
              {item.negotiable && !negotiateVisible && (
                <TouchableOpacity style={styles.negotiateBtn} onPress={() => setNegotiateVisible(true)} activeOpacity={0.85}>
                  <Feather name="message-circle" size={16} color={LIME} />
                  <Text style={styles.negotiateBtnText}>Negotiate Price</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.contactBtn} activeOpacity={0.85}>
                <Feather name="send" size={16} color={BG} />
                <Text style={styles.contactBtnText}>Message Seller</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Create Listing Bottom Sheet ───────────────────────────────────────────
const LISTING_TYPES = [
  { key: 'GOODS',       label: 'Goods',         icon: 'package' },
  { key: 'FOOD',        label: 'Food',          icon: 'coffee' },
  { key: 'EVENT',       label: 'Events',        icon: 'calendar' },
  { key: 'JOB',         label: 'Jobs',          icon: 'briefcase' },
  { key: 'RENTAL',      label: 'Rental',        icon: 'home' },
  { key: 'FASHION',     label: 'Fashion',       icon: 'tag' },
  { key: 'SKILL',       label: 'Skills',        icon: 'cpu' },
  { key: 'HAIR_BEAUTY', label: 'Hair & Beauty', icon: 'scissors' },
];

function CreateListingModal({ visible, onClose, onCreated }) {
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [price,       setPrice]       = useState('');
  const [city,        setCity]        = useState('');
  const [listingType, setListingType] = useState('SKILL');
  const [negotiable,  setNegotiable]  = useState(false);
  const [agentFee,    setAgentFee]    = useState(false);
  const [images,      setImages]      = useState([]);
  const [submitting,  setSubmitting]  = useState(false);

  const reset = () => {
    setTitle(''); setDescription(''); setPrice(''); setCity('');
    setListingType('SKILL'); setNegotiable(false); setAgentFee(false); setImages([]);
  };

  const handleClose = () => { reset(); onClose(); };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted' && status !== 'limited') {
      Alert.alert('Permission needed', 'Allow photo library access to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.length) {
      setImages(prev => [...prev, ...result.assets].slice(0, 6));
    }
  };

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a listing title.');
      return;
    }
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      Alert.alert('Price required', 'Please enter a valid price (e.g. 25.00).');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title',       title.trim());
      formData.append('description', description.trim());
      formData.append('listingType', listingType);
      formData.append('price',       parseFloat(price).toFixed(2));
      formData.append('currency',    'GBP');
      formData.append('negotiable',  negotiable ? 'true' : 'false');
      formData.append('agentFee',    agentFee ? 'true' : 'false');
      formData.append('city',        city.trim());
      images.forEach((img, i) => {
        const uri      = img.uri;
        const filename = uri.split('/').pop() || `image_${i}.jpg`;
        const match    = /\.(\w+)$/.exec(filename);
        const mimeType = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
        formData.append('images', { uri, name: filename, type: mimeType });
      });
      await listingsApi.create(formData);
      reset();
      onCreated?.();
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to create listing.';
      Alert.alert('Could not create listing', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.sheetOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.sheetContainer, { maxHeight: '92%' }]}>
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.createHeader}>
            <View>
              <Text style={styles.createTitle}>New Listing</Text>
              <Text style={styles.createSubtitle}>Fill in the details below</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={18} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.createScroll} keyboardShouldPersistTaps="handled">

            {/* Category / Type */}
            <Text style={styles.inputLabel}>Category <Text style={{ color: LIME }}>*</Text></Text>
            <View style={styles.typeGrid}>
              {LISTING_TYPES.map(({ key, label, icon }) => {
                const active    = listingType === key;
                const typeColor = TYPE_COLORS[key] || '#888';
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.typeGridItem, active && { backgroundColor: `${typeColor}20`, borderColor: typeColor }]}
                    onPress={() => setListingType(key)}
                    activeOpacity={0.7}
                  >
                    <Feather name={icon} size={16} color={active ? typeColor : '#555'} />
                    <Text style={[styles.typeGridText, active && { color: typeColor }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Title */}
            <Text style={styles.inputLabel}>Title <Text style={{ color: LIME }}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="What are you offering?"
              placeholderTextColor="#444"
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />

            {/* Description */}
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Describe your listing in detail..."
              placeholderTextColor="#444"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Price + Negotiable */}
            <Text style={styles.inputLabel}>Price (GBP) <Text style={{ color: LIME }}>*</Text></Text>
            <View style={styles.priceRow}>
              <View style={[styles.input, styles.priceInput, { flexDirection: 'row', alignItems: 'center' }]}>
                <Text style={{ color: '#666', fontSize: 16, marginRight: 6 }}>PLN </Text>
                <TextInput
                  style={{ flex: 1, color: '#FFF', fontSize: 16 }}
                  placeholder="0.00"
                  placeholderTextColor="#444"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />
              </View>
              <TouchableOpacity
                style={[styles.negotiableToggle, negotiable && styles.negotiableActive]}
                onPress={() => setNegotiable(!negotiable)}
                activeOpacity={0.8}
              >
                <Feather name={negotiable ? 'check-circle' : 'circle'} size={14} color={negotiable ? LIME : '#555'} />
                <Text style={[styles.negotiableText, negotiable && { color: LIME }]}>Negotiable</Text>
              </TouchableOpacity>
            </View>

            {/* City */}
            <Text style={styles.inputLabel}>City / Location</Text>
            <View style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}>
              <Feather name="map-pin" size={14} color="#555" style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, color: '#FFF', fontSize: 14 }}
                placeholder="e.g. London, Manchester, Remote"
                placeholderTextColor="#444"
                value={city}
                onChangeText={setCity}
              />
            </View>

            {/* Agent Fee — only for RENTAL listings */}
            {listingType === 'RENTAL' && (
              <View style={styles.agentFeeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Agent Fee</Text>
                  <Text style={styles.agentFeeSubtitle}>Does this listing include a letting-agent fee?</Text>
                </View>
                <TouchableOpacity
                  style={[styles.agentFeeToggle, agentFee && styles.agentFeeToggleActive]}
                  onPress={() => setAgentFee(v => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.agentFeeToggleText, agentFee && styles.agentFeeToggleTextActive]}>
                    {agentFee ? 'Yes' : 'No'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Images */}
            <Text style={styles.inputLabel}>Photos <Text style={{ color: '#555', fontWeight: '400' }}>(up to 6)</Text></Text>
            <View style={styles.imageGrid}>
              {images.map((img, idx) => (
                <View key={idx} style={styles.imageThumbWrap}>
                  <Image source={{ uri: img.uri }} style={styles.imageThumb} resizeMode="cover" />
                  <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => removeImage(idx)}>
                    <Feather name="x" size={10} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 6 && (
                <TouchableOpacity style={styles.imageAddBtn} onPress={pickImages} activeOpacity={0.8}>
                  <Feather name="plus" size={22} color="#555" />
                  <Text style={styles.imageAddText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={BG} />
              ) : (
                <>
                  <Feather name="zap" size={16} color={BG} />
                  <Text style={styles.submitBtnText}>Post Listing</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={[styles.cardImageWrap, styles.skeleton]} />
      <View style={styles.cardBody}>
        <View style={[styles.skeleton, { height: 12, borderRadius: 6, marginBottom: 8 }]} />
        <View style={[styles.skeleton, { height: 10, width: '60%', borderRadius: 6 }]} />
      </View>
    </View>
  );
}

function SectionHeader({ title, icon, count, onSeeMore }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <Feather name={icon} size={14} color={LIME} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {count > 0 && <Text style={styles.sectionCount}>{count}</Text>}
      </View>
      {onSeeMore && (
        <TouchableOpacity onPress={onSeeMore} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.seeMore}>See more →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ExploreScreen() {
  const insets         = useSafeAreaInsets();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [allListings,  setAllListings]  = useState([]);
  const [moreItems,    setMoreItems]    = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search,       setSearch]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [page,         setPage]         = useState(0);
  const [hasMore,      setHasMore]      = useState(true);

  const [selectedListing, setSelectedListing] = useState(null);
  const [detailVisible,   setDetailVisible]   = useState(false);
  const [createVisible,   setCreateVisible]   = useState(false);

  const isFiltering = search.trim().length > 0 || activeCategory !== null;

// ── Demo Listings (shown when API returns empty) ─────────────────────────
const DEMO_LISTINGS = [
  { id: 'd1', title: 'Nike Air Max 90 - Barely Used', type: 'GOODS', price: 85, currency: 'PLN ', negotiable: true, sellerName: 'Tyler B.', sellerId: 'u1', description: 'Size 10 UK. Only worn 3 times. Comes with original box.', locationCity: 'London', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop' },
  { id: 'd2', title: 'Homemade Jerk Chicken Platter', type: 'FOOD', price: 15, currency: 'PLN ', negotiable: false, sellerName: 'Priya S.', sellerId: 'u2', description: 'Authentic Jamaican-style jerk chicken with rice & peas, plantain. Delivery available.', locationCity: 'Manchester', imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400&h=400&fit=crop' },
  { id: 'd3', title: 'Rooftop Afrobeats Summer Party', type: 'EVENT', price: 25, currency: 'PLN ', negotiable: false, sellerName: 'Zara T.', sellerId: 'u3', description: 'Join us for the hottest rooftop party this summer! DJ lineup, food vendors, and good vibes.', locationCity: 'Birmingham', imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=400&fit=crop' },
  { id: 'd4', title: 'Freelance Web Developer Needed', type: 'JOB', price: 50, currency: 'PLN /hr', negotiable: true, sellerName: 'Marcus C.', sellerId: 'u4', description: 'Looking for a React/Next.js dev for a 3-month contract. Remote work OK.', locationCity: 'Remote', imageUrl: null },
  { id: 'd5', title: 'Double Room in Zone 2 Flat', type: 'RENTAL', price: 850, currency: 'PLN /mo', negotiable: true, sellerName: 'Andre W.', sellerId: 'u5', description: 'Fully furnished double room in a modern 2-bed flat. Bills included. 5 min walk to station.', locationCity: 'London, Zone 2', imageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=400&fit=crop' },
  { id: 'd6', title: 'Custom Tie-Dye T-Shirts', type: 'FASHION', price: 22, currency: 'PLN ', negotiable: false, sellerName: 'Luna R.', sellerId: 'u6', description: 'Handmade tie-dye tees. Choose your colors and pattern. 100% organic cotton.', locationCity: 'Bristol', imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop' },
  { id: 'd7', title: 'Photography Lessons - Beginner', type: 'SKILL', price: 35, currency: 'PLN ', negotiable: true, sellerName: 'Maya J.', sellerId: 'u7', description: '2-hour session covering camera basics, composition, and lighting. Bring your own camera.', locationCity: 'London', imageUrl: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=400&h=400&fit=crop' },
  { id: 'd8', title: 'Box Braids & Cornrows', type: 'HAIR_BEAUTY', price: 60, currency: 'PLN ', negotiable: false, sellerName: 'Aisha P.', sellerId: 'u8', description: 'Professional braiding. All hair types welcome. Hair included in price.', locationCity: 'Croydon', imageUrl: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=400&h=400&fit=crop' },
  { id: 'd9', title: 'PS5 + 3 Games Bundle', type: 'GOODS', price: 380, currency: 'PLN ', negotiable: true, sellerName: 'Kai N.', sellerId: 'u9', description: 'PS5 Disc edition with 2 controllers and FIFA, GTA V, Spider-Man. Fully working.', locationCity: 'Leeds', imageUrl: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=400&fit=crop' },
  { id: 'd10', title: 'Gourmet Burger Pop-Up', type: 'FOOD', price: 12, currency: 'PLN ', negotiable: false, sellerName: 'David O.', sellerId: 'u10', description: 'Smash burgers, loaded fries, milkshakes. Find us every Saturday at Camden Market.', locationCity: 'Camden, London', imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop' },
  { id: 'd11', title: 'Tech Networking Mixer', type: 'EVENT', price: 0, currency: 'PLN ', negotiable: false, sellerName: 'Jamal C.', sellerId: 'u11', description: 'FREE Tech & Startup networking event. Meet founders, investors, and engineers.', locationCity: 'Shoreditch, London', imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=400&fit=crop' },
  { id: 'd12', title: 'Social Media Manager', type: 'JOB', price: 30, currency: 'PLN /hr', negotiable: true, sellerName: 'Sofia M.', sellerId: 'u12', description: 'Part-time social media management for small brands. Content creation, scheduling, analytics.', locationCity: 'Remote', imageUrl: null },
  { id: 'd13', title: 'Studio Flat - Canary Wharf', type: 'RENTAL', price: 1200, currency: 'PLN /mo', negotiable: false, sellerName: 'Tyler B.', sellerId: 'u1', description: 'Modern studio with a river view. Fully furnished. Gym and concierge included.', locationCity: 'Canary Wharf, London', imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=400&fit=crop' },
  { id: 'd14', title: 'Vintage Denim Jacket', type: 'FASHION', price: 45, currency: 'PLN ', negotiable: true, sellerName: 'Zara T.', sellerId: 'u3', description: 'Authentic 90s Levi\'s denim jacket. Size M. Perfect condition.', locationCity: 'London', imageUrl: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=400&h=400&fit=crop' },
  { id: 'd15', title: 'Guitar Lessons - All Levels', type: 'SKILL', price: 25, currency: 'PLN ', negotiable: false, sellerName: 'Marcus C.', sellerId: 'u4', description: '1-hour guitar lessons. Acoustic or electric. In person or online.', locationCity: 'Manchester', imageUrl: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&h=400&fit=crop' },
  { id: 'd16', title: 'Natural Hair Treatments', type: 'HAIR_BEAUTY', price: 40, currency: 'PLN ', negotiable: false, sellerName: 'Priya S.', sellerId: 'u2', description: 'Deep conditioning, hot oil treatments, and protective styles for natural hair.', locationCity: 'Brixton, London', imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=400&fit=crop' },
];

  const loadInitial = useCallback(async (category, q) => {
    setLoading(true);
    setMoreItems([]);
    setPage(0);
    setHasMore(true);
    try {
      const params = {};
      if (category) params.type = category;
      if (q)        params.search = q;
      const res  = await listingsApi.browse(params);
      const data = Array.isArray(res.data) ? res.data : (res.data?.content || []);
      // Fallback to demo data when API returns empty
      if (data.length === 0 && !q) {
        const filtered = category
          ? DEMO_LISTINGS.filter(l => l.type === category)
          : DEMO_LISTINGS;
        setAllListings(filtered);
      } else {
        setAllListings(data);
      }
    } catch {
      // API error — use demo data
      const filtered = category
        ? DEMO_LISTINGS.filter(l => l.type === category)
        : DEMO_LISTINGS;
      setAllListings(filtered);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInitial(activeCategory, search);
  }, [activeCategory]);  // only re-fetch on category change; search uses debounce below

  const handleSearch = (text) => {
    setSearch(text);
    if (text.length === 0 || text.length > 2) loadInitial(activeCategory, text);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const params = { page: nextPage, size: 10 };
      if (activeCategory) params.type   = activeCategory;
      if (search)         params.search = search;
      const res  = await listingsApi.browse(params);
      const data = Array.isArray(res.data) ? res.data : (res.data?.content || []);
      if (data.length === 0) {
        setHasMore(false);
      } else {
        setMoreItems(prev => [...prev, ...data]);
        setPage(nextPage);
      }
    } catch {} finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadInitial(activeCategory, search);
  };

  // Fix for react-native-web Modal scroll lock bug
  useEffect(() => {
    if (Platform.OS === 'web') {
      const isAnyModalOpen = detailVisible || createVisible || false;
      if (!isAnyModalOpen) {
        document.body.style.overflow = 'unset';
      }
    }
  }, [detailVisible, createVisible]);

  const openDetail = (item) => { setSelectedListing(item); setDetailVisible(true); };
  const closeDetail = () => setDetailVisible(false);

  const handleCreated = () => loadInitial(activeCategory, search);

  // Split into sections (only when not filtering)
  const featured = allListings.slice(0, 4);
  const hotNow   = allListings.slice(4, 10);
  const seeMore  = [...allListings.slice(10), ...moreItems];

  // ── Header + filter bar (rendered as FlatList ListHeaderComponent) ──────
  const FilterHeader = (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.screenTitle}>Explore</Text>
          <Text style={styles.screenSub}>{allListings.length} listings</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={onRefresh}>
          <Feather name="refresh-cw" size={16} color={LIME} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={15} color="#555" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search listings..."
          placeholderTextColor="#444"
          value={search}
          onChangeText={handleSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); loadInitial(activeCategory, ''); }}>
            <Feather name="x" size={15} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {CATEGORIES.map(cat => {
          const active = activeCategory === cat.key;
          return (
            <TouchableOpacity
              key={String(cat.key)}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.7}
            >
              <Feather name={cat.icon} size={12} color={active ? LIME : '#71717A'} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        {FilterHeader}
        <FlatList
          data={[1,2,3,4,5,6]}
          renderItem={() => <SkeletonCard />}
          keyExtractor={i => String(i)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.listContent, { paddingBottom: 4 }]}
        />
      </View>
    );
  }

  if (isFiltering) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        {FilterHeader}
        <FlatList
          data={allListings}
          renderItem={({ item }) => <ListingCard item={item} onPress={openDetail} />}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.listContent, { paddingBottom: 4 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState />}
        />
        {isAuthenticated && (
          <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 100 }]} onPress={() => setCreateVisible(true)} activeOpacity={0.85}>
            <Feather name="plus" size={26} color={BG} />
          </TouchableOpacity>
        )}
        <ListingDetailSheet item={selectedListing} visible={detailVisible} onClose={closeDetail} />
        <CreateListingModal visible={createVisible} onClose={() => setCreateVisible(false)} onCreated={handleCreated} />
      </View>
    );
  }

  // ── Sectioned view (default, no filter) ──────────────────────────────────
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} />}
        contentContainerStyle={{ paddingBottom: 4 }}
      >
        {FilterHeader}

        {allListings.length === 0 ? <EmptyState /> : (
          <>
            {/* ── Featured ── */}
            {featured.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Featured" icon="star" count={featured.length} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.featRow}
                >
                  {featured.map(item => <FeaturedCard key={item.id} item={item} onPress={openDetail} />)}
                </ScrollView>
              </View>
            )}

            {/* ── Hot Now ── */}
            {hotNow.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Hot Now" icon="trending-up" count={hotNow.length} />
                <View style={styles.gridWrap}>
                  {hotNow.map((item) => (
                    <View key={item.id} style={styles.gridItem}>
                      <ListingCard item={item} onPress={openDetail} />
                      {/* Fire badge */}
                      <View style={styles.hotBadge}>
                        <Text style={styles.hotBadgeText}>🔥</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── See More (paginated) ── */}
            <View style={styles.section}>
              <SectionHeader
                title="See More"
                icon="grid"
                count={seeMore.length}
              />
              {seeMore.length > 0 ? (
                <View style={styles.gridWrap}>
                  {seeMore.map(item => (
                    <View key={item.id} style={styles.gridItem}>
                      <ListingCard item={item} onPress={openDetail} />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.seeMoreEmpty}>
                  <Text style={styles.seeMoreEmptyText}>Tap "Load more" to see additional listings</Text>
                </View>
              )}

              {/* Pagination button */}
              <TouchableOpacity
                style={[styles.loadMoreBtn, (!hasMore || loadingMore) && styles.loadMoreBtnDisabled]}
                onPress={loadMore}
                disabled={!hasMore || loadingMore}
                activeOpacity={0.8}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={BG} />
                ) : (
                  <>
                    <Feather name={hasMore ? 'chevrons-down' : 'check'} size={16} color={hasMore ? BG : '#444'} />
                    <Text style={[styles.loadMoreText, !hasMore && styles.loadMoreTextDone]}>
                      {hasMore ? 'Load more' : 'All caught up'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* FAB */}
      {isAuthenticated && (
        <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 100 }]} onPress={() => setCreateVisible(true)} activeOpacity={0.85}>
          <Feather name="plus" size={26} color={BG} />
        </TouchableOpacity>
      )}

      <ListingDetailSheet item={selectedListing} visible={detailVisible} onClose={closeDetail} />
      <CreateListingModal visible={createVisible} onClose={() => setCreateVisible(false)} onCreated={handleCreated} />
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Feather name="search" size={30} color={LIME} />
      </View>
      <Text style={styles.emptyTitle}>No listings found</Text>
      <Text style={styles.emptySub}>Try a different category or search term</Text>
    </View>
  );
}

const CARD_W = (width - 24 * 2 - 10) / 2;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  safe: { backgroundColor: BG },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12,
  },
  screenTitle: { color: '#FFF', fontSize: 26, fontWeight: '900' },
  screenSub:   { color: '#555', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12, height: 44,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },
  chipsRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive:     { backgroundColor: 'rgba(205,255,0,0.08)', borderColor: 'rgba(205,255,0,0.4)' },
  chipText:       { color: '#71717A', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  chipTextActive: { color: LIME },

  // Section layout
  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  sectionCount: {
    color: LIME, fontSize: 10, fontWeight: '900',
    backgroundColor: 'rgba(205,255,0,0.1)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20,
  },
  seeMore: { color: LIME, fontSize: 11, fontWeight: '800' },

  // Featured horizontal cards
  featRow: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  featCard: {
    width: 200, height: 300, borderRadius: 22, overflow: 'hidden',
    backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  featInitialWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  featInitial: { fontSize: 56, fontWeight: '900' },
  featSellerPill: {
    position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingRight: 10, paddingVertical: 3, paddingLeft: 3,
  },
  featSellerAvatar: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(205,255,0,0.15)',
    borderWidth: 1.5, borderColor: LIME, justifyContent: 'center', alignItems: 'center',
  },
  featSellerAvatarText: { color: LIME, fontSize: 10, fontWeight: '900' },
  featSellerName: { color: '#FFF', fontSize: 11, fontWeight: '700', maxWidth: 100 },
  featOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, gap: 8 },
  featTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', lineHeight: 20, textTransform: 'uppercase' },
  featBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },

  // Grid (2-col)
  gridWrap: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 10,
  },
  gridItem: { width: CARD_W, position: 'relative' },
  hotBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  hotBadgeText: { fontSize: 12 },

  // Small grid card — full-bleed overlay design
  card: {
    flex: 1, borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    height: 240,
  },
  cardFallbackIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Seller pill — top left of card
  cardSellerPill: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, paddingRight: 8, paddingVertical: 2, paddingLeft: 2,
  },
  cardSellerAvatar: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(205,255,0,0.15)',
    borderWidth: 1.5, borderColor: LIME, justifyContent: 'center', alignItems: 'center',
  },
  cardSellerAvatarText: { color: LIME, fontSize: 9, fontWeight: '900' },
  cardSellerName: { color: '#FFF', fontSize: 10, fontWeight: '700', maxWidth: 80 },

  // Deal badge — top right
  cardDealBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(52,199,89,0.2)', borderWidth: 1, borderColor: 'rgba(52,199,89,0.5)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  cardDealText: { color: '#34C759', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },

  // Bottom overlay content
  cardOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, gap: 8 },
  cardTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', lineHeight: 18, textTransform: 'uppercase' },

  // Bottom row with pill badges
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },

  // Shared type pill
  cardTypePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  cardTypeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },

  // Price pill
  cardPricePill: {
    backgroundColor: 'rgba(205,255,0,0.15)', borderWidth: 1, borderColor: 'rgba(205,255,0,0.35)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  cardPriceText: { color: LIME, fontSize: 10, fontWeight: '900' },

  // Location pill
  cardLocPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8,
  },
  cardLocText: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '600', maxWidth: 60 },

  // Legacy compat
  typeBadge: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  typeBadgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Flat list layout (filtering mode)
  listContent: { paddingHorizontal: 12 },
  row: { gap: 10, marginBottom: 10 },

  // Load more
  seeMoreEmpty: { paddingHorizontal: 20, paddingVertical: 8 },
  seeMoreEmptyText: { color: '#444', fontSize: 12, fontWeight: '600' },
  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 16, marginBottom: 4,
    paddingVertical: 14, borderRadius: 16,
    backgroundColor: LIME,
  },
  loadMoreBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },
  loadMoreText: { color: BG, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  loadMoreTextDone: { color: '#444' },

  emptyState: { paddingTop: 80, alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(205,255,0,0.08)',
    borderWidth: 1, borderColor: 'rgba(205,255,0,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  emptySub:   { color: '#555', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  skeleton:   { backgroundColor: 'rgba(255,255,255,0.06)' },

  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 30, zIndex: 200,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: LIME,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: LIME, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  // Bottom sheet shared
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: {
    backgroundColor: '#0F0F0F',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 12,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetScroll: { paddingHorizontal: 20, paddingBottom: 40 },

  // Detail sheet
  detailHero: {
    width: '100%', height: 240, borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#1A1A1A', marginBottom: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  detailHeroImage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  detailHeroInitial: { fontSize: 72, fontWeight: '900' },
  detailTypeBadge: { position: 'absolute', top: 12, left: 12 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  detailTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', flex: 1, marginRight: 12, lineHeight: 26 },
  detailPrice: { color: LIME, fontSize: 22, fontWeight: '900' },
  detailSellerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  detailAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(205,255,0,0.12)',
    borderWidth: 1, borderColor: 'rgba(205,255,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  detailAvatarText: { color: LIME, fontSize: 18, fontWeight: '900' },
  detailSellerLabel: { color: '#555', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  detailSellerName:  { color: '#FFF', fontSize: 15, fontWeight: '800', marginTop: 2 },
  detailDescWrap: { marginBottom: 20 },
  detailDescLabel: { color: '#555', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  detailDescText:  { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 22 },
  shopSection: { marginBottom: 24 },
  shopBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  shopBannerName: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  shopBannerSub:  { color: '#555', fontSize: 11, fontWeight: '600' },
  detailPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  negotiableBadge: { backgroundColor: 'rgba(52,199,89,0.1)', borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  negotiableText: { color: '#34C759', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  detailLocRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  detailLocText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  viewShopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: LIME,
  },
  viewShopBtnText: { color: BG, fontSize: 11, fontWeight: '800' },
  detailActions: { gap: 10, marginTop: 8 },
  buyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#34C759', borderRadius: 16, paddingVertical: 16,
  },
  buyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  negotiateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(205,255,0,0.08)', borderWidth: 1, borderColor: 'rgba(205,255,0,0.3)',
    borderRadius: 16, paddingVertical: 14,
  },
  negotiateBtnText: { color: LIME, fontSize: 14, fontWeight: '800' },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: LIME, borderRadius: 16, paddingVertical: 14,
  },
  contactBtnText: { color: BG, fontSize: 14, fontWeight: '900' },
  negotiateSection: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  negotiateTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', marginBottom: 12 },
  negotiateInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencyLabel: { color: LIME, fontSize: 20, fontWeight: '900' },
  negotiateInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: '#FFF', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  offerBtn: { backgroundColor: LIME, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  offerBtnText: { color: BG, fontSize: 12, fontWeight: '900' },
  negotiateStatus: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  negotiateStatusText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' },
  tryAgainText: { color: LIME, fontSize: 12, fontWeight: '700', marginTop: 4 },
  closeSheetBtn: {
    paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  closeSheetBtnText: { color: '#888', fontSize: 14, fontWeight: '700' },

  // Create listing sheet
  createHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 4,
  },
  createTitle: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  createSubtitle: { color: '#555', fontSize: 12, fontWeight: '600', marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  createScroll: { paddingHorizontal: 20, paddingBottom: 40 },
  inputLabel: { color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: '#FFF', fontSize: 15,
  },
  inputMultiline: { minHeight: 100, paddingTop: 14 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeGridItem: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  typeGridText: { color: '#555', fontSize: 12, fontWeight: '800' },
  priceRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  priceInput: { flex: 1 },
  negotiableToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  negotiableActive: { borderColor: `${LIME}60`, backgroundColor: `${LIME}10` },
  negotiableText: { color: '#555', fontSize: 12, fontWeight: '700' },
  agentFeeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  agentFeeSubtitle: { color: '#555', fontSize: 11, marginTop: 2 },
  agentFeeToggle: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', minWidth: 60, alignItems: 'center' },
  agentFeeToggleActive: { backgroundColor: '#38BDF820', borderColor: '#38BDF8' },
  agentFeeToggleText: { color: '#555', fontSize: 13, fontWeight: '900' },
  agentFeeToggleTextActive: { color: '#38BDF8' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageThumbWrap: { width: 80, height: 80, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  imageThumb: { width: '100%', height: '100%' },
  imageRemoveBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  imageAddBtn: {
    width: 80, height: 80, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  imageAddText: { color: '#555', fontSize: 10, fontWeight: '700' },
  typeChipsRow: { gap: 8, paddingVertical: 2 },
  typeChip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  typeChipText: { color: '#71717A', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  imagePicker: {
    height: 120, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerText: { color: '#555', fontSize: 13, fontWeight: '600' },
  removeImageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end', marginTop: 6,
  },
  removeImageText: { color: '#666', fontSize: 12, fontWeight: '600' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: LIME, borderRadius: 16, paddingVertical: 16, marginTop: 24,
  },
  submitBtnText: { color: BG, fontSize: 15, fontWeight: '900' },
});

