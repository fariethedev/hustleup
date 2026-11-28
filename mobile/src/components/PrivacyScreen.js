import { usePalette } from '../theme/ThemeProvider';
import { BackButton } from './native/Kit';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { authApi, usersApi, followsApi } from '../api/client';

export default function PrivacyScreen({ visible, onClose }) {
  const dark = !usePalette().light;
  const backgroundColor = dark ? '#101214' : '#F5F6F8';
  const color = dark ? '#FAFAFA' : '#17201C';
  const card = dark ? '#202522' : '#FFFFFF';
  const [privateAccount, setPrivateAccount] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const lock = useRef(false);
  const generation = useRef(0);

  const load = async () => {
    const current = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const [profile, pending] = await Promise.all([authApi.me(), followsApi.requests()]);
      if (current !== generation.current) return;
      setPrivateAccount(profile.data.privateAccount === true);
      setRequests(Array.isArray(pending.data) ? pending.data : []);
    } catch {
      if (current === generation.current) setError('Could not load privacy settings. Please try again.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) load();
    return () => { generation.current += 1; };
  }, [visible]);

  const changePrivacy = async (value) => {
    if (lock.current) return;
    lock.current = true;
    setBusy('privacy');
    try {
      await usersApi.updateProfile({ privateAccount: value });
      setPrivateAccount(value);
    } catch {
      Alert.alert('Not saved', 'Your privacy setting has not changed. Please try again.');
    } finally { lock.current = false; setBusy(null); }
  };

  const decide = async (id, accept) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(id);
    try {
      await (accept ? followsApi.approveRequest(id) : followsApi.declineRequest(id));
      setRequests(items => items.filter(item => item.id !== id));
    } catch {
      Alert.alert('Could not update request', 'Refresh the list and try again.');
    } finally { lock.current = false; setBusy(null); }
  };

  const button = (label, onPress, disabled = false) => (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
      onPress={onPress} style={{ padding: 12, borderRadius: 12, backgroundColor: card, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor }}>
        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <BackButton onPress={onClose} label="Back to settings" />
          <Text style={{ color, fontSize: 24, fontWeight: '800' }}>Privacy</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          {loading ? <ActivityIndicator accessibilityLabel="Loading privacy settings" /> : error ? (
            <View style={{ gap: 12 }}><Text accessibilityRole="alert" style={{ color }}>{error}</Text>{button('Try again', load)}</View>
          ) : <>
            <View style={{ backgroundColor: card, borderRadius: 20, padding: 20, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Feather name={privateAccount ? 'lock' : 'globe'} size={24} color={color} />
                <Text style={{ color, flex: 1, fontSize: 18, fontWeight: '700' }}>Private account</Text>
                <Switch accessibilityLabel="Private account" value={privateAccount} disabled={busy !== null}
                  onValueChange={changePrivacy} trackColor={{ true: '#21864B' }} />
              </View>
              <Text style={{ color, lineHeight: 22 }}>Approve new followers before they can see your private profile content. Existing followers keep their access. Marketplace listings remain subject to marketplace visibility rules.</Text>
              {busy === 'privacy' && <ActivityIndicator />}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color, fontSize: 20, fontWeight: '800' }}>Follow requests ({requests.length})</Text>
              {button('Refresh', load, busy !== null)}
            </View>
            {!requests.length && <Text style={{ color }}>You’re all caught up. New follow requests will appear here.</Text>}
            {requests.map(person => <View key={person.id} style={{ padding: 16, borderRadius: 18, backgroundColor: card, gap: 12 }}>
              <Text style={{ color, fontSize: 17, fontWeight: '700' }}>{person.fullName || person.username || 'Member'}</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {button('Approve', () => decide(person.id, true), busy !== null)}
                {button('Decline', () => decide(person.id, false), busy !== null)}
                {busy === person.id && <ActivityIndicator />}
              </View>
            </View>)}
          </>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
