import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { payoutsApi } from '../../src/api/client';
import { errorMessage } from '../../src/utils/marketplace';

export default function BankScreen() {
  const router = useRouter();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { const { data } = await payoutsApi.status(); setStatus(data); }
    catch (failure) { setStatus(null); setError(errorMessage(failure, 'Could not verify your bank connection. Please retry.')); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const connect = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await payoutsApi.connect();
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'connect.stripe.com') throw new Error('A secure setup link was not returned.');
      await WebBrowser.openBrowserAsync(url.toString());
      await refresh();
    } catch (failure) { setError(errorMessage(failure, failure.message || 'Could not open bank setup.')); }
    finally { setBusy(false); }
  };
  const button = { minHeight: 50, borderRadius: 25, padding: 15, alignItems: 'center', backgroundColor: '#CDFF00', marginTop: 18 };
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#090909' }}><ScrollView contentContainerStyle={{ padding: 24, gap: 18 }}>
    <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 44 }}><Text style={{ color: '#CDFF00' }}>Back to wallet</Text></TouchableOpacity>
    <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '700' }}>Connect your bank</Text>
    <Text style={{ color: '#AAA', fontSize: 15, lineHeight: 23 }}>Stripe securely collects your bank details and verifies your identity. Return here after setup to check your payout status.</Text>
    <View style={{ borderRadius: 18, backgroundColor: '#191919', padding: 20, gap: 12 }}>
      {loading ? <ActivityIndicator color="#CDFF00" /> : <Text style={{ color: '#FFF', lineHeight: 22 }}>{status?.payoutsEnabled ? 'Bank connected. Payouts are enabled.' : status?.detailsSubmitted ? 'Details submitted. Verification or more information may be needed.' : status?.connected ? 'Setup started. Continue with Stripe to finish.' : status ? 'No bank connected yet.' : 'Bank status could not be verified.'}</Text>}
      {!status?.payoutsEnabled && <TouchableOpacity style={[button, (busy || loading) && { opacity: .5 }]} disabled={busy || loading} onPress={connect}><Text style={{ color: '#050505', fontWeight: '700' }}>{busy ? 'Opening Stripe…' : status?.connected ? 'Continue setup' : 'Connect bank account'}</Text></TouchableOpacity>}
      <TouchableOpacity onPress={refresh} disabled={busy || loading} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#CDFF00' }}>Refresh status</Text></TouchableOpacity>
    </View>
    {!!error && <Text accessibilityRole="alert" style={{ color: '#FCA5A5', lineHeight: 22 }}>{error}</Text>}
  </ScrollView></SafeAreaView>;
}
