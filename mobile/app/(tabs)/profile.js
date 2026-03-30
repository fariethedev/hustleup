import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

const actions = [
  { title: 'My Shop', icon: 'shopping-bag' },
  { title: 'Account Settings', icon: 'settings' },
  { title: 'Log Out', icon: 'log-out', danger: true },
];

export default function ProfileScreen() {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarCard}>
            <Feather name="user" size={42} color="#CDFF00" />
          </View>
          <Text style={styles.name}>Guest User</Text>
          <Text style={styles.role}>Hustler status pending</Text>
        </View>

        <View style={styles.actions}>
          {actions.map((item) => (
            <TouchableOpacity key={item.title} activeOpacity={0.85} style={styles.actionCard}>
              <Feather
                name={item.icon}
                size={20}
                color={item.danger ? '#FF4D6A' : '#CDFF00'}
              />
              <Text style={[styles.actionText, item.danger && styles.actionTextDanger]}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    paddingTop: 84,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  avatarCard: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  role: {
    marginTop: 8,
    color: '#CDFF00',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 14,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  actionTextDanger: {
    color: '#FF4D6A',
  },
});
