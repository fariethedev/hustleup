import React, { useEffect, useState } from 'react';
import { CropHost } from '../native/ImageCropper';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '../native/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listingsApi, swapsApi } from '../../api/client';
import { errorMessage, money } from '../../utils/marketplace';
import { mediaUrl, pickCroppedPhoto, uploadAsset } from '../../utils/media';
import { usePalette } from '../native/Kit';

/**
 * Swap & top-up: offer one of your listings — or describe an item and add a photo — for this
 * listing, optionally adding cash (or asking for some) to even out the values.
 */
export default function SwapOfferSheet({ visible, target, onClose, onSent }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('listing'); // listing | describe
  const [offeredId, setOfferedId] = useState(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [cash, setCash] = useState('NONE'); // NONE | PROPOSER_PAYS | OWNER_PAYS
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    listingsApi.getMyListings()
      .then(r => {
        const list = (Array.isArray(r.data) ? r.data : []).filter(l => (!l.status || l.status === 'ACTIVE') && l.id !== target?.id);
        setMine(list); setMode(list.length ? 'listing' : 'describe');
      })
      .catch(() => setMine([]))
      .finally(() => setLoading(false));
  }, [visible, target?.id]);

  const send = async () => {
    if (mode === 'listing' && !offeredId) return Alert.alert('Choose an item', 'Pick one of your listings to offer.');
    if (mode === 'describe' && text.trim().length < 3) return Alert.alert('Describe your item', 'Say what you’re offering in a few words.');
    const cashValue = amount.trim().replace(',', '.');
    if (cash !== 'NONE' && !(/^\d+(\.\d{1,2})?$/.test(cashValue) && Number(cashValue) > 0)) return Alert.alert('Check the amount', 'Enter the top-up amount.');
    setSending(true);
    try {
      await swapsApi.create({
        targetListingId: target.id,
        offeredListingId: mode === 'listing' ? offeredId : undefined,
        offeredText: mode === 'describe' ? text.trim() : undefined,
        cashAmount: cash !== 'NONE' ? cashValue : undefined,
        cashDirection: cash !== 'NONE' ? cash : undefined,
        message: message.trim() || undefined,
      }, mode === 'describe' && photo ? uploadAsset(photo) : null);
      onSent?.();
      onClose();
      Alert.alert('Swap offer sent', 'The seller will be notified. Track it in Swaps from the menu.');
    } catch (e) { Alert.alert('Could not send offer', errorMessage(e, 'Please try again.')); }
    finally { setSending(false); }
  };

  const chip = (value, label, icon) => {
    const on = cash === value;
    return <Pressable key={value} onPress={() => setCash(value)} accessibilityRole="radio" accessibilityState={{ checked: on }}
      style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: on ? c.purple : c.line, backgroundColor: on ? c.purpleSoft : 'transparent' }}>
      <Feather name={icon} size={16} color={on ? c.purple : c.muted} />
      <Text style={{ color: on ? c.purple : c.text, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </Pressable>;
  };

  if (!target) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
        <View style={{ maxHeight: '90%', backgroundColor: c.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: Math.max(insets.bottom, 12) }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.line, marginTop: 10 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 }}>
            <Feather name="repeat" size={20} color={c.purple} />
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', flex: 1 }}>Offer a swap</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close" hitSlop={10}><Feather name="x" size={22} color={c.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 10 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
              {!!target.mediaUrls?.[0] && <Image source={{ uri: mediaUrl(target.mediaUrls[0]) }} style={{ width: 44, height: 44, borderRadius: 10 }} />}
              <View style={{ flex: 1 }}><Text style={{ color: c.muted, fontSize: 11 }}>YOU WANT</Text><Text style={{ color: c.text, fontWeight: '800' }} numberOfLines={1}>{target.title}</Text></View>
              <Text style={{ color: c.accent, fontWeight: '800' }}>{money(target.price, target.currency)}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[['listing', 'One of my listings'], ['describe', 'Describe an item']].map(([value, label]) => (
                <Pressable key={value} onPress={() => setMode(value)} style={{ flex: 1, minHeight: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: mode === value ? c.accent : c.card, borderWidth: 1, borderColor: mode === value ? c.accent : c.line }}>
                  <Text style={{ color: mode === value ? (c.light ? '#FFF' : '#111') : c.muted, fontWeight: '700', fontSize: 12 }}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {mode === 'listing' ? (loading ? <ActivityIndicator color={c.purple} /> : mine.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {mine.map(l => {
                  const on = offeredId === l.id;
                  return <Pressable key={l.id} onPress={() => setOfferedId(l.id)} style={{ width: 120, borderRadius: 14, borderWidth: 2, borderColor: on ? c.purple : c.line, overflow: 'hidden', backgroundColor: c.card }}>
                    {l.mediaUrls?.[0] ? <Image source={{ uri: mediaUrl(l.mediaUrls[0]) }} style={{ width: '100%', height: 90 }} /> : <View style={{ height: 90, backgroundColor: c.soft }} />}
                    <View style={{ padding: 8 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{l.title}</Text><Text style={{ color: c.muted, fontSize: 11 }}>{money(l.price, l.currency)}</Text></View>
                    {on && <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: c.purple, alignItems: 'center', justifyContent: 'center' }}><Feather name="check" size={13} color="#FFF" /></View>}
                  </Pressable>;
                })}
              </ScrollView>
            ) : <Text style={{ color: c.muted }}>You have no active listings — describe an item instead.</Text>) : (
              <View style={{ gap: 10 }}>
                <TextInput value={text} onChangeText={setText} placeholder="e.g. Nike Air Max, size 42, worn twice" placeholderTextColor={c.muted} maxLength={200}
                  style={{ color: c.text, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 12, fontSize: 15, backgroundColor: c.card }} />
                <TouchableOpacity onPress={async () => { try { const a = await pickCroppedPhoto([1, 1]); if (a) setPhoto(a); } catch (e) { Alert.alert('Photo access', e.message); } }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: c.purple }}>
                  {photo ? <Image source={{ uri: photo.uri }} style={{ width: 44, height: 44, borderRadius: 10 }} /> : <Feather name="camera" size={20} color={c.purple} />}
                  <Text style={{ color: c.purple, fontWeight: '700' }}>{photo ? 'Change photo' : 'Add a photo of your item'}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ gap: 8 }}>
              <Text style={{ color: c.text, fontWeight: '800' }}>Cash top-up</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {chip('NONE', 'Straight swap', 'repeat')}
                {chip('PROPOSER_PAYS', 'I add cash', 'plus-circle')}
                {chip('OWNER_PAYS', 'I ask for cash', 'arrow-down-circle')}
              </View>
              {cash !== 'NONE' && <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={`Amount (${target.currency || 'PLN'})`} placeholderTextColor={c.muted}
                style={{ color: c.text, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 12, fontSize: 16, backgroundColor: c.card }} />}
            </View>

            <TextInput value={message} onChangeText={setMessage} placeholder="Add a message (optional)" placeholderTextColor={c.muted} multiline maxLength={500}
              style={{ color: c.text, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 12, minHeight: 70, textAlignVertical: 'top', backgroundColor: c.card }} />
          </ScrollView>
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <TouchableOpacity onPress={send} disabled={sending} style={{ minHeight: 50, borderRadius: 25, backgroundColor: c.purple, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              {sending ? <ActivityIndicator color="#FFF" /> : <><Feather name="send" size={16} color="#FFF" /><Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>Send swap offer</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    <CropHost /></Modal>
  );
}
