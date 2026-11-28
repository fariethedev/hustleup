import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '../../src/components/native/Icon';
import { shopsApi } from '../../src/api/client';
import { usePalette, BackButton } from '../../src/components/native/Kit';
import { errorMessage } from '../../src/utils/marketplace';
import { pickCroppedPhoto, uploadAsset } from '../../src/utils/media';

// Mirrors ShopBusinessType on the server.
const SHOP_TYPES = [
  { group: 'Sell products', hint: 'Customers add items to cart and pay online.', items: [
    ['GENERAL', 'General store', 'shopping-bag'], ['CLOTHING_FASHION', 'Clothing & fashion', 'tag'], ['GROCERY_FOOD', 'Grocery & food', 'coffee'],
    ['ELECTRONICS', 'Electronics', 'smartphone'], ['BOOKS_STATIONERY', 'Books & stationery', 'book'], ['HOME_LIVING', 'Home & living', 'home'],
    ['BEAUTY_COSMETICS', 'Beauty & cosmetics', 'droplet'],
  ] },
  { group: 'Take bookings', hint: 'Customers pick a service and a time slot.', items: [
    ['HAIR_SALON', 'Hair salon', 'scissors'], ['BARBERSHOP', 'Barbershop', 'scissors'], ['NAIL_STUDIO', 'Nail studio', 'feather'],
    ['SPA_MASSAGE', 'Spa & massage', 'sun'], ['TATTOO_PIERCING', 'Tattoo & piercing', 'pen-tool'], ['FITNESS_TRAINING', 'Fitness & training', 'activity'],
    ['TUTORING_LESSONS', 'Tutoring & lessons', 'book-open'], ['REPAIR_SERVICES', 'Repairs & tech', 'tool'],
  ] },
];

export default function CreateShop() {
  const router = useRouter();
  const c = usePalette();
  const [step, setStep] = useState(0);
  const [type, setType] = useState(null);
  const [form, setForm] = useState({ name: '', tagline: '', city: '', description: '' });
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);
  const label = SHOP_TYPES.flatMap(g => g.items).find(t => t[0] === type)?.[1];
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const create = async () => {
    if (form.name.trim().length < 2) return Alert.alert('Name your shop', 'Give your shop a name customers will recognise.');
    setBusy(true);
    try {
      const { data: shop } = await shopsApi.create({ name: form.name.trim(), businessType: type, category: label, tagline: form.tagline.trim(), description: form.description.trim(), city: form.city.trim(), published: true });
      if (banner) {
        const fd = new FormData(); fd.append('file', uploadAsset(banner));
        const { data } = await shopsApi.uploadMedia(shop.id, fd);
        await shopsApi.update(shop.id, { bannerUrl: data.url });
      }
      router.replace('/shop/manage');
    } catch (e) { Alert.alert('Could not create shop', errorMessage(e, 'Please try again.')); }
    finally { setBusy(false); }
  };

  const input = { color: c.text, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: c.card };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
          <BackButton onPress={() => (step ? setStep(0) : router.back())} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>Create your shop</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>Step {step + 1} of 2 · {step ? 'Details' : 'What kind of shop?'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 6 }}>
          {[0, 1].map(i => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? c.purple : c.line }} />)}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {step === 0 ? SHOP_TYPES.map(g => (
            <View key={g.group} style={{ gap: 8 }}>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{g.group}</Text>
              <Text style={{ color: c.muted, fontSize: 12, marginTop: -4 }}>{g.hint}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {g.items.map(([key, name, icon]) => {
                  const on = type === key;
                  return <Pressable key={key} onPress={() => setType(key)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                    style={{ width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: on ? c.purple : c.line, backgroundColor: on ? c.purpleSoft : c.card }}>
                    <Feather name={icon} size={18} color={on ? c.purple : c.muted} />
                    <Text style={{ color: on ? c.purple : c.text, fontWeight: '700', fontSize: 13, flex: 1 }}>{name}</Text>
                  </Pressable>;
                })}
              </View>
            </View>
          )) : <>
            <TouchableOpacity onPress={async () => { try { const a = await pickCroppedPhoto([16, 9]); if (a) setBanner(a); } catch (e) { Alert.alert('Photo access', e.message); } }}
              style={{ height: 160, borderRadius: 18, overflow: 'hidden', borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.purple, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card }}>
              {banner ? <Image source={{ uri: banner.uri }} style={{ position: 'absolute', width: '100%', height: '100%' }} /> : <><Feather name="image" size={26} color={c.purple} /><Text style={{ color: c.purple, fontWeight: '700', marginTop: 6 }}>Add a banner photo</Text><Text style={{ color: c.muted, fontSize: 11 }}>Shown across the top of your shop</Text></>}
            </TouchableOpacity>
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: c.purpleSoft }}><Feather name="check" size={12} color={c.purple} /><Text style={{ color: c.purple, fontSize: 12, fontWeight: '800' }}>{label}</Text></View>
            <TextInput value={form.name} onChangeText={v => set('name', v)} placeholder="Shop name *" placeholderTextColor={c.muted} maxLength={60} style={input} />
            <TextInput value={form.tagline} onChangeText={v => set('tagline', v)} placeholder="Tagline (e.g. Handmade streetwear from Warsaw)" placeholderTextColor={c.muted} maxLength={90} style={input} />
            <TextInput value={form.city} onChangeText={v => set('city', v)} placeholder="City" placeholderTextColor={c.muted} style={input} />
            <TextInput value={form.description} onChangeText={v => set('description', v)} placeholder="Tell customers what you offer" placeholderTextColor={c.muted} multiline maxLength={600} style={[input, { minHeight: 100, textAlignVertical: 'top' }]} />
          </>}
        </ScrollView>

        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line }}>
          <TouchableOpacity disabled={busy || !type} onPress={() => (step ? create() : setStep(1))}
            style={{ minHeight: 50, borderRadius: 25, backgroundColor: type ? c.lime : c.soft, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color="#151A00" /> : <Text style={{ color: type ? '#151A00' : c.muted, fontWeight: '900', fontSize: 15 }}>{step ? 'Create shop' : type ? `Continue as ${label}` : 'Choose a shop type'}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
