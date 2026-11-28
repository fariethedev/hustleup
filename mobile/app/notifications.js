import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '../src/components/native/Icon';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notificationsApi } from '../src/api/client';
import { usePalette, BackButton } from '../src/components/native/Kit';
import { typeOf } from '../src/utils/notificationRoutes';

const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['orders', 'Orders'], ['messages', 'Messages'], ['social', 'Social'], ['bond', 'Bond']];

const isUnread = n => !n.read && !n.isRead;
const ago = ts => {
  if (!ts) return '';
  const s = (Date.now() - new Date(ts)) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' });
};

export default function NotificationsScreen() {
  const router = useRouter();
  const c = usePalette();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now()); // captured on load so grouping is stable between renders

  const load = useCallback(async () => {
    setError('');
    try { const { data } = await notificationsApi.getAll(); setNow(Date.now()); setItems(Array.isArray(data) ? data : data?.content || []); }
    catch { setError('Could not load notifications. Pull down to retry.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unread = items.filter(isUnread).length;
  const sections = useMemo(() => {
    const shown = items.filter(n => filter === 'all' || (filter === 'unread' ? isUnread(n) : typeOf(n).group === filter));
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const weekAgo = now - 7 * 86400000;
    const buckets = { Today: [], 'This week': [], Earlier: [] };
    shown.forEach(n => {
      const t = new Date(n.createdAt || n.time || 0).getTime();
      buckets[t >= startOfToday.getTime() ? 'Today' : t >= weekAgo ? 'This week' : 'Earlier'].push(n);
    });
    return Object.entries(buckets).filter(([, data]) => data.length).map(([title, data]) => ({ title, data }));
  }, [items, filter, now]);

  const open = (n) => {
    if (isUnread(n)) {
      setItems(list => list.map(x => (x.id === n.id ? { ...x, read: true, isRead: true } : x)));
      notificationsApi.markRead(n.id).catch(() => {});
    }
    const target = typeOf(n).go?.(n);
    if (target) router.push(target);
  };
  const markAll = async () => {
    setItems(list => list.map(x => ({ ...x, read: true, isRead: true })));
    try { await notificationsApi.markAllRead(); } catch { load(); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '900' }}>Notifications</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>{unread ? `${unread} unread` : 'You’re all caught up'}</Text>
        </View>
        {unread > 0 && <TouchableOpacity onPress={markAll} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 34, borderRadius: 17, backgroundColor: c.purpleSoft }}>
          <Feather name="check-square" size={14} color={c.purple} /><Text style={{ color: c.purple, fontWeight: '800', fontSize: 12 }}>Mark all read</Text>
        </TouchableOpacity>}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 8 }}>
        {FILTERS.map(([key, label]) => {
          const on = filter === key;
          const count = key === 'unread' ? unread : 0;
          return <Pressable key={key} onPress={() => setFilter(key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ minHeight: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: on ? c.purple : c.card, borderWidth: 1, borderColor: on ? c.purple : c.line }}>
            <Text style={{ color: on ? '#FFF' : c.text, fontSize: 12, fontWeight: '700' }}>{label}{count ? ` ${count}` : ''}</Text>
          </Pressable>;
        })}
      </View>

      {loading ? <ActivityIndicator color={c.purple} style={{ marginTop: 40 }} /> : (
        <SectionList
          sections={sections}
          keyExtractor={n => String(n.id)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={c.purple} />}
          renderSectionHeader={({ section }) => <Text style={{ color: c.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 14, marginBottom: 8 }}>{section.title.toUpperCase()}</Text>}
          renderItem={({ item: n }) => {
            const t = typeOf(n);
            const on = isUnread(n);
            return (
              <Pressable onPress={() => open(n)} accessibilityRole="button"
                style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, marginBottom: 8, borderRadius: 18, backgroundColor: on ? c.purpleSoft : c.card, borderWidth: 1, borderColor: on ? `${c.purple}55` : c.line, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: `${t.color}22` }}>
                  <Feather name={t.icon} size={19} color={t.color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: c.text, fontWeight: on ? '900' : '700', flex: 1 }} numberOfLines={1}>{n.title || 'Update'}</Text>
                    <Text style={{ color: c.muted, fontSize: 11 }}>{ago(n.createdAt || n.time)}</Text>
                  </View>
                  {!!n.message && <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }} numberOfLines={2}>{n.message}</Text>}
                  {!!t.hint && <Text style={{ color: c.purple, fontSize: 12, fontWeight: '700', marginTop: 2 }}>{t.hint}</Text>}
                </View>
                {on && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent, marginTop: 4 }} />}
              </Pressable>
            );
          }}
          ListEmptyComponent={<View style={{ alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 30 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.purpleSoft, alignItems: 'center', justifyContent: 'center' }}><Feather name="bell" size={30} color={c.purple} /></View>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>{error ? 'Couldn’t load notifications' : filter === 'all' ? 'No notifications yet' : 'Nothing here'}</Text>
            <Text style={{ color: c.muted, textAlign: 'center', lineHeight: 20 }}>{error || 'Orders, messages, new followers and Bond matches will show up here — tap one to jump straight to it.'}</Text>
          </View>}
        />
      )}
    </SafeAreaView>
  );
}
