import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { logoutUser } from '../../src/store/authSlice';

const BG = '#050505';
const LIME = '#CDFF00';
const CARD = '#111';

function SettingRow({ icon, label, subtitle, onPress, isSwitch, value, onValueChange, danger }) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={isSwitch ? 1 : 0.7}
      disabled={isSwitch}
    >
      <View style={[styles.settingIcon, danger && { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
        <Feather name={icon} size={18} color={danger ? '#FF3B30' : LIME} />
      </View>
      <View style={styles.settingText}>
        <Text style={[styles.settingLabel, danger && { color: '#FF3B30' }]}>{label}</Text>
        {subtitle && <Text style={styles.settingSub}>{subtitle}</Text>}
      </View>
      {isSwitch ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#333', true: `${LIME}66` }}
          thumbColor={value ? LIME : '#666'}
        />
      ) : (
        <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.2)" />
      )}
    </TouchableOpacity>
  );
}

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [dmNotifs, setDmNotifs] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        await dispatch(logoutUser());
        router.replace('/login');
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Account Deletion', 'Your request has been submitted. It may take up to 48 hours.') },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SectionTitle title="ACCOUNT" />
        <SettingRow icon="user" label="Edit Profile" subtitle="Name, bio, avatar" onPress={() => router.push('/profile/edit')} />
        <SettingRow icon="lock" label="Privacy" subtitle="Who can see your profile" onPress={() => Alert.alert('Privacy', 'Privacy settings coming soon!')} />
        <SettingRow icon="shield" label="Security" subtitle="Password, 2FA" onPress={() => Alert.alert('Security', 'Security settings coming soon!')} />

        <SectionTitle title="NOTIFICATIONS" />
        <SettingRow icon="bell" label="Push Notifications" isSwitch value={pushEnabled} onValueChange={setPushEnabled} />
        <SettingRow icon="message-circle" label="Message Notifications" isSwitch value={dmNotifs} onValueChange={setDmNotifs} />

        <SectionTitle title="APPEARANCE" />
        <SettingRow icon="moon" label="Dark Mode" subtitle="Always on" isSwitch value={darkMode} onValueChange={setDarkMode} />

        <SectionTitle title="SUPPORT" />
        <SettingRow icon="help-circle" label="Help Center" onPress={() => Alert.alert('Help', 'Visit our help center at hustleup.com/help')} />
        <SettingRow icon="flag" label="Report a Problem" onPress={() => Alert.alert('Report', 'Send us a report at support@hustleup.com')} />
        <SettingRow icon="info" label="About" subtitle="Version 1.0.0" onPress={() => Alert.alert('HustleUp', 'Version 1.0.0\nBuilt with ❤️')} />

        <SectionTitle title="DANGER ZONE" />
        <SettingRow icon="log-out" label="Log Out" onPress={handleLogout} danger />
        <SettingRow icon="trash-2" label="Delete Account" subtitle="Permanent action" onPress={handleDeleteAccount} danger />

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  scrollContent: { paddingHorizontal: 16 },
  sectionTitle: {
    color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '800',
    letterSpacing: 1.5, marginTop: 28, marginBottom: 12, marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16,
    padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  settingIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(205,255,0,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  settingText: { flex: 1 },
  settingLabel: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  settingSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '500', marginTop: 2 },
});
