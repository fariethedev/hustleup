import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { notificationsApi } from '../src/api/client';

const BG = '#050505';
const LIME = '#CDFF00';

const NOTIF_ICONS = {
  FOLLOW:         { name: 'user-plus',      color: '#60A5FA' },
  LIKE:           { name: 'heart',           color: '#F472B6' },
  COMMENT:        { name: 'message-circle',  color: LIME },
  MATCH:          { name: 'zap',             color: '#FB923C' },
  POST:           { name: 'image',           color: '#A3E635' },
  LISTING:        { name: 'tag',             color: '#34D399' },
  DIRECT_MESSAGE: { name: 'message-square',  color: '#818CF8' },
  SYSTEM:         { name: 'bell',            color: '#A78BFA' },
};

const timeAgo = (ts) => {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const NotifCard = ({ notif, onPress }) => {
  const type = (notif.notificationType || notif.type || 'SYSTEM').toUpperCase();
  const icon = NOTIF_ICONS[type] || NOTIF_ICONS.SYSTEM;
  const unread = !notif.read && !notif.isRead;

  return (
    <TouchableOpacity style={[styles.card, unread && styles.cardUnread]} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.iconWrap, { backgroundColor: icon.color + '18' }]}>
        <Feather name={icon.name} size={18} color={icon.color} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{notif.title}</Text>
          <Text style={styles.cardTime}>{timeAgo(notif.createdAt || notif.time)}</Text>
        </View>
        <Text style={styles.cardMsg} numberOfLines={2}>{notif.message}</Text>
      </View>
      {unread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.getAll();
      setNotifications(res.data || []);
    } catch (e) {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true, isRead: true })));
    } catch (e) {}
  };

  const unreadCount = notifications.filter(n => !n.read && !n.isRead).length;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#FFF" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>NOTIFICATIONS</Text>
          {unreadCount > 0 && <Text style={styles.headerSub}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={LIME} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="bell-off" size={40} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySub}>Follow people and they'll show up here</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => String(n.id)}
          renderItem={({ item }) => (
            <NotifCard notif={item} onPress={async () => {
              if (!item.read && !item.isRead) {
                try {
                  await notificationsApi.markRead(item.id);
                  setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true, isRead: true } : n));
                } catch {}
              }
              const type = (item.notificationType || item.type || '').toUpperCase();
              if (type === 'DIRECT_MESSAGE' && item.senderId) {
                router.push(`/(tabs)/messages?partnerId=${item.senderId}`);
              } else if (type === 'FOLLOW' && item.senderId) {
                router.push(`/profile/${item.senderId}`);
              }
            }} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={fetchNotifications}
          refreshing={refreshing}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  headerSub: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  markAllBtn: { marginLeft: 'auto', backgroundColor: 'rgba(205,255,0,0.1)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(205,255,0,0.2)' },
  markAllText: { color: LIME, fontSize: 11, fontWeight: '800' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptySub: { color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  cardUnread: { borderColor: 'rgba(205,255,0,0.12)', backgroundColor: 'rgba(205,255,0,0.03)' },
  iconWrap: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { color: '#FFF', fontSize: 13, fontWeight: '800', flex: 1, marginRight: 8 },
  cardTime: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700' },
  cardMsg: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIME, flexShrink: 0 },
});

