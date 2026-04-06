import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser, setUser } from '../../src/store/authSlice';
import { usersApi, authApi } from '../../src/api/client';

const LIME = '#CDFF00';
const BG = '#050505';

const Field = ({ label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder || label}
      placeholderTextColor="rgba(255,255,255,0.2)"
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      keyboardType={keyboardType || 'default'}
      autoCapitalize={autoCapitalize || 'sentences'}
    />
  </View>
);

export default function EditProfile() {
  const router = useRouter();
  const dispatch = useDispatch();
  const storeUser = useSelector(selectUser);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    bio: '',
    phone: '',
    city: '',
    addressLine1: '',
    addressLine2: '',
    postcode: '',
    country: '',
    website: '',
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const res = await authApi.me();
      const u = res.data;
      setForm({
        fullName: u.fullName || '',
        username: u.username || '',
        bio: u.bio || '',
        phone: u.phone || '',
        city: u.city || '',
        addressLine1: u.addressLine1 || '',
        addressLine2: u.addressLine2 || '',
        postcode: u.postcode || '',
        country: u.country || '',
        website: u.website || '',
      });
    } catch {
      if (storeUser) {
        setForm({
          fullName: storeUser.fullName || '',
          username: storeUser.username || '',
          bio: storeUser.bio || '',
          phone: storeUser.phone || '',
          city: storeUser.city || '',
          addressLine1: storeUser.addressLine1 || '',
          addressLine2: storeUser.addressLine2 || '',
          postcode: storeUser.postcode || '',
          country: storeUser.country || '',
          website: storeUser.website || '',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      Alert.alert('Required', 'Full name is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await usersApi.updateProfile(form);
      dispatch(setUser({ ...storeUser, ...res.data }));
      Alert.alert('Saved!', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not save changes. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={LIME} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>EDIT PROFILE</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={BG} />
              : <Text style={styles.saveBtnText}>SAVE</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Section: Identity */}
          <Text style={styles.section}>IDENTITY</Text>
          <Field label="Full Name *" value={form.fullName} onChangeText={set('fullName')} />
          <Field label="Username" value={form.username} onChangeText={set('username')}
            placeholder="@username" autoCapitalize="none" />
          <Field label="Bio" value={form.bio} onChangeText={set('bio')}
            placeholder="Tell the world your hustle story..." multiline />

          {/* Section: Contact */}
          <Text style={styles.section}>CONTACT</Text>
          <Field label="Phone Number" value={form.phone} onChangeText={set('phone')}
            placeholder="+44 7700 000000" keyboardType="phone-pad" autoCapitalize="none" />
          <Field label="Website / Social Link" value={form.website} onChangeText={set('website')}
            placeholder="https://yourwebsite.com" keyboardType="url" autoCapitalize="none" />

          {/* Section: Address */}
          <Text style={styles.section}>ADDRESS</Text>
          <Field label="Address Line 1" value={form.addressLine1} onChangeText={set('addressLine1')}
            placeholder="Street address, building" />
          <Field label="Address Line 2" value={form.addressLine2} onChangeText={set('addressLine2')}
            placeholder="Apt, suite, unit (optional)" />
          <Field label="City / Town" value={form.city} onChangeText={set('city')}
            placeholder="e.g. London" />
          <Field label="Postcode / ZIP" value={form.postcode} onChangeText={set('postcode')}
            placeholder="e.g. SW1A 1AA" autoCapitalize="characters" />
          <Field label="Country" value={form.country} onChangeText={set('country')}
            placeholder="e.g. United Kingdom" />

          <View style={{ height: 50 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  loadingScreen: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  saveBtn: {
    backgroundColor: LIME, paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 22, minWidth: 70, alignItems: 'center',
  },
  saveBtnText: { color: BG, fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  scrollContent: { padding: 20 },

  section: {
    color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '900',
    letterSpacing: 2, marginTop: 28, marginBottom: 14,
  },

  field: { marginBottom: 16 },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: '#FFF', fontSize: 15, fontWeight: '500',
  },
  inputMultiline: {
    height: 100, textAlignVertical: 'top', paddingTop: 14,
  },
});
