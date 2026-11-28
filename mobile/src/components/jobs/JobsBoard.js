import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '../native/Icon';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { jobsApi } from '../../api/client';
import { Screen, usePalette } from '../native/Kit';
import { mediaUrl } from '../../utils/media';
import { errorMessage, money } from '../../utils/marketplace';

/** The categories people actually look for first: restaurant shifts and warehouse work lead. */
export const QUICK_CATEGORIES = [
  ['all', 'All', 'grid'],
  ['hospitality', 'Restaurants', 'coffee'],
  ['warehouse', 'Warehouse', 'package'],
  ['delivery', 'Delivery', 'truck'],
  ['retail', 'Retail', 'shopping-bag'],
  ['cleaning', 'Cleaning', 'droplet'],
  ['factory', 'Factory', 'tool'],
  ['babysitting', 'Childcare', 'smile'],
  ['office', 'Office', 'briefcase'],
  ['it', 'IT', 'monitor'],
  ['other', 'Other', 'more-horizontal'],
];
const SHIFT_CATEGORIES = QUICK_CATEGORIES.filter(([id]) => ['hospitality', 'warehouse', 'delivery', 'retail', 'cleaning', 'factory', 'other'].includes(id));
const TYPE_LABEL = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Contract', TEMPORARY: 'Temporary', INTERNSHIP: 'Internship', GIG: 'Gig' };

const ago = iso => {
  if (!iso) return '';
  const h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 36e5);
  if (h < 1) return 'Just now';
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
};
// Server times are UTC wall-clock without an offset.
const utc = iso => (iso ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`) : null);
export const shiftWhen = job => {
  const s = utc(job.shiftStartsAt), e = utc(job.shiftEndsAt);
  if (!s) return null;
  const day = s.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const t = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${t(s)}${e ? `–${t(e)}` : ''}`;
};
export const payLabel = job => {
  if (job.salaryMin == null && job.salaryMax == null) return null;
  const per = { HOUR: '/h', SHIFT: ' / shift', MONTH: ' / mo', YEAR: ' / yr', WEEK: ' / wk', DAY: ' / day' }[String(job.salaryPeriod || '').toUpperCase()] || '';
  const lo = job.salaryMin ?? job.salaryMax, hi = job.salaryMax;
  return `${money(lo, job.salaryCurrency)}${hi != null && job.salaryMin != null && hi !== lo ? `–${money(hi, job.salaryCurrency)}` : ''}${per}`;
};

function Chip({ label, icon, on, onPress }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 18, backgroundColor: on ? c.text : c.card, borderWidth: 1, borderColor: on ? c.text : c.line }}>
      {!!icon && <Feather name={icon} size={14} color={on ? c.bg : c.muted} />}
      <Text style={{ color: on ? c.bg : c.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Tag({ text, tone }) {
  const c = usePalette();
  const colors = tone === 'pay' ? [c.purpleSoft, c.purple] : tone === 'shift' ? ['#FFF4E5', '#B45309'] : [c.soft, c.muted];
  return <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, backgroundColor: colors[0] }}><Text style={{ color: colors[1], fontSize: 12, fontWeight: '700' }}>{text}</Text></View>;
}

function JobCard({ job, onPress }) {
  const c = usePalette();
  const when = shiftWhen(job);
  const pay = payLabel(job);
  const logo = job.companyLogoUrl ? mediaUrl(job.companyLogoUrl) : null;
  const cat = QUICK_CATEGORIES.find(([id]) => id === job.category);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${job.title}, ${job.companyName || ''}`}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: when ? '#F5C77E' : c.line, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 46, height: 46, borderRadius: 13, overflow: 'hidden', backgroundColor: when ? '#FFF4E5' : c.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
        {logo ? <Image source={{ uri: logo }} style={{ width: '100%', height: '100%' }} />
          : <Feather name={when ? 'clock' : cat?.[2] || 'briefcase'} size={20} color={when ? '#B45309' : c.purple} />}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={2} style={{ color: c.text, fontSize: 15.5, fontWeight: '800', lineHeight: 20 }}>{job.title}</Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>{[job.companyName, job.remote ? 'Remote' : job.location].filter(Boolean).join(' · ')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {!!when && <Tag tone="shift" text={when} />}
          {!!pay && <Tag tone="pay" text={pay} />}
          {!when && !!job.jobType && <Tag text={TYPE_LABEL[job.jobType] || job.jobType} />}
          {job.remote && <Tag text="Remote" />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <Text style={{ color: c.muted, fontSize: 12 }}>{ago(job.createdAt)}</Text>
          {job.appliedByCurrentUser && <Text style={{ color: c.purple, fontSize: 12, fontWeight: '700' }}>✓ Applied</Text>}
          {!!job.sourceName && <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>via {job.sourceName}</Text>}
        </View>
      </View>
      
    </Pressable>
  );
}

const pad = n => String(n).padStart(2, '0');
const TIMES = Array.from({ length: 48 }, (_, i) => [Math.floor(i / 2), i % 2 ? 30 : 0]);

function PostShiftSheet({ visible, onClose, onPosted }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const user = useSelector(s => s.auth.user);
  const [form, setForm] = useState({ title: '', workplace: '', category: 'hospitality', location: user?.city || '', pay: '', payPeriod: 'HOUR', description: '' });
  const [day, setDay] = useState(0);
  const [start, setStart] = useState(36); // 18:00
  const [end, setEnd] = useState(46); // 23:00
  const [busy, setBusy] = useState(false);
  const [days] = useState(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const input = { minHeight: 46, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 12, color: c.text, backgroundColor: c.card, fontSize: 15 };
  const label = t => <Text style={{ color: c.text, fontWeight: '800', fontSize: 14, marginTop: 6 }}>{t}</Text>;

  const at = idx => { const d = new Date(days[day]); const [h, m] = TIMES[idx]; d.setHours(h, m, 0, 0); return d; };
  const submit = async () => {
    const s = at(start);
    const e = at(end);
    if (end <= start) e.setDate(e.getDate() + 1); // overnight shift
    setBusy(true);
    try {
      await jobsApi.postShift({ ...form, startsAt: s.toISOString(), endsAt: e.toISOString(), currency: 'PLN' });
      onPosted?.();
    } catch (err) { Alert.alert('Shift not posted', errorMessage(err, 'Please check the details and try again.')); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <View style={{ maxHeight: '90%', backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 14) }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.line, marginBottom: 10 }} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingBottom: 10 }} keyboardShouldPersistTaps="handled">
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Post a shift</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>Can&apos;t make a shift? Post it and someone nearby can take it.</Text>

            {label('What is the shift?')}
            <TextInput value={form.title} onChangeText={v => set('title', v)} placeholder="e.g. Waiter, Friday dinner" placeholderTextColor={c.muted} style={input} maxLength={120} />
            <TextInput value={form.workplace} onChangeText={v => set('workplace', v)} placeholder="Workplace (e.g. Pizzeria Roma)" placeholderTextColor={c.muted} style={input} maxLength={80} />

            {label('Type of work')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SHIFT_CATEGORIES.map(([id, name, icon]) => <Chip key={id} label={name} icon={icon} on={form.category === id} onPress={() => set('category', id)} />)}
            </View>

            {label('Day')}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {days.map((d, i) => {
                const on = i === day;
                return <Pressable key={i} onPress={() => setDay(i)} style={{ width: 54, paddingVertical: 8, borderRadius: 14, alignItems: 'center', backgroundColor: on ? c.lime : c.card, borderWidth: 1, borderColor: on ? c.lime : c.line }}>
                  <Text style={{ color: on ? '#151A00' : c.muted, fontSize: 11, fontWeight: '700' }}>{i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' })}</Text>
                  <Text style={{ color: on ? '#151A00' : c.text, fontSize: 17, fontWeight: '900' }}>{d.getDate()}</Text>
                </Pressable>;
              })}
            </ScrollView>

            {[['Starts', start, setStart], ['Ends', end, setEnd]].map(([name, value, setter]) => (
              <View key={name} style={{ gap: 6 }}>
                {label(name)}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {TIMES.map(([h, m], i) => {
                    const on = i === value;
                    return <Pressable key={i} onPress={() => setter(i)} style={{ paddingHorizontal: 11, height: 34, justifyContent: 'center', borderRadius: 10, backgroundColor: on ? c.lime : c.card, borderWidth: 1, borderColor: on ? c.lime : c.line }}>
                      <Text style={{ color: on ? '#151A00' : c.text, fontWeight: '700', fontSize: 13 }}>{pad(h)}:{pad(m)}</Text>
                    </Pressable>;
                  })}
                </ScrollView>
              </View>
            ))}
            {end <= start && <Text style={{ color: c.muted, fontSize: 12 }}>Ends the next morning (overnight shift).</Text>}

            {label('Pay (optional)')}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={form.pay} onChangeText={v => set('pay', v)} placeholder="Amount in PLN" placeholderTextColor={c.muted} keyboardType="decimal-pad" style={[input, { flex: 1 }]} />
              <Chip label="per hour" on={form.payPeriod === 'HOUR'} onPress={() => set('payPeriod', 'HOUR')} />
              <Chip label="per shift" on={form.payPeriod === 'SHIFT'} onPress={() => set('payPeriod', 'SHIFT')} />
            </View>
            <TextInput value={form.location} onChangeText={v => set('location', v)} placeholder="City or address" placeholderTextColor={c.muted} style={input} maxLength={120} />
            <TextInput value={form.description} onChangeText={v => set('description', v)} placeholder="Anything to know? Dress code, experience, who to ask for…" placeholderTextColor={c.muted} multiline maxLength={1000} style={[input, { minHeight: 80, paddingTop: 10, textAlignVertical: 'top' }]} />

            <Pressable onPress={submit} disabled={busy || form.title.trim().length < 3} accessibilityRole="button"
              style={{ marginTop: 8, height: 52, borderRadius: 26, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center', opacity: busy || form.title.trim().length < 3 ? 0.5 : 1 }}>
              {busy ? <ActivityIndicator color="#151A00" /> : <Text style={{ color: '#151A00', fontWeight: '800', fontSize: 16 }}>Post shift</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function JobsBoard() {
  const c = usePalette();
  const router = useRouter();
  const user = useSelector(s => s.auth.user);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [shifts, setShifts] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchPage = useCallback((p, replace) => {
    setLoading(true); setError('');
    return jobsApi.board({ q: search || undefined, category, shifts: shifts || undefined, page: p, size: 20 })
      .then(({ data }) => {
        setRows(old => (replace ? data.content || [] : [...old, ...(data.content || [])]));
        setPage(p); setTotalPages(data.totalPages || 1);
      })
      .catch(e => setError(errorMessage(e, 'Jobs could not load.')))
      .finally(() => setLoading(false));
  }, [search, category, shifts]);
  useEffect(() => { const t = setTimeout(() => fetchPage(0, true), 0); return () => clearTimeout(t); }, [fetchPage]);

  const header = (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>Find work or cover a shift</Text>
        <Text style={{ color: c.muted, fontSize: 14 }}>Restaurant shifts, warehouse work, delivery and more near you.</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 12, borderRadius: 23, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
        <Feather name="search" size={18} color={c.muted} />
        <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => setSearch(query.trim())} returnKeyType="search" placeholder="Search roles, places or companies" placeholderTextColor={c.muted}
          accessibilityLabel="Search jobs" style={{ flex: 1, color: c.text, fontSize: 15 }} />
        {!!query && <Pressable onPress={() => { setQuery(''); setSearch(''); }} hitSlop={8} accessibilityLabel="Clear search"><Feather name="x-circle" size={17} color={c.muted} /></Pressable>}
      </View>

      <View style={{ flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: c.soft }}>
        {[[false, 'All jobs', 'briefcase'], [true, 'Shifts up for grabs', 'clock']].map(([value, name, icon]) => {
          const on = shifts === value;
          return <Pressable key={name} onPress={() => setShifts(value)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ flex: 1, height: 38, borderRadius: 12, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.card : 'transparent' }}>
            <Feather name={icon} size={14} color={on ? c.text : c.muted} />
            <Text style={{ color: on ? c.text : c.muted, fontWeight: '700', fontSize: 13 }}>{name}</Text>
          </Pressable>;
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {QUICK_CATEGORIES.map(([id, name, icon]) => <Chip key={id} label={name} icon={icon} on={category === id} onPress={() => setCategory(id)} />)}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={() => (user ? setPosting(true) : router.push('/login'))} accessibilityRole="button"
          style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 22, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: c.lime, opacity: pressed ? 0.85 : 1 })}>
          <Feather name="plus" size={16} color="#151A00" /><Text style={{ color: '#151A00', fontWeight: '800', fontSize: 14 }}>Post a shift</Text>
        </Pressable>
        <Pressable onPress={() => router.push(user ? '/jobs/applications' : '/login')} accessibilityRole="button"
          style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 22, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line, backgroundColor: c.card, opacity: pressed ? 0.85 : 1 })}>
          <Feather name="file-text" size={15} color={c.text} /><Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>My applications</Text>
        </Pressable>
      </View>

      {!!error && <Text style={{ color: c.danger, fontSize: 13 }}>{error}</Text>}
    </View>
  );

  return (
    <Screen back title="Jobs & gigs" scroll={false}>
      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 150, gap: 10 }}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: 6 }}
        refreshControl={<RefreshControl refreshing={loading && page === 0 && rows.length > 0} onRefresh={() => fetchPage(0, true)} tintColor={c.accent} />}
        renderItem={({ item }) => <JobCard job={item} onPress={() => router.push(`/jobs/${item.id}`)} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (!loading && page + 1 < totalPages) fetchPage(page + 1, false); }}
        ListEmptyComponent={loading ? <ActivityIndicator color={c.accent} style={{ marginTop: 30 }} /> : (
          <View style={{ alignItems: 'center', gap: 8, padding: 28, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
            <Feather name={shifts ? 'clock' : 'search'} size={26} color={c.muted} />
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{shifts ? 'No shifts up for grabs right now' : 'Nothing matches yet'}</Text>
            <Text style={{ color: c.muted, fontSize: 13, textAlign: 'center' }}>{shifts ? 'Got a shift you can’t make? Post it and someone can take it.' : 'Try another category or a shorter search.'}</Text>
          </View>
        )}
        ListFooterComponent={loading && rows.length > 0 ? <ActivityIndicator color={c.accent} style={{ marginVertical: 16 }} /> : null}
      />
      <PostShiftSheet visible={posting} onClose={() => setPosting(false)} onPosted={() => { setPosting(false); setShifts(true); fetchPage(0, true); Alert.alert('Shift posted', 'People can now offer to take it. You’ll get their messages in Applications.'); }} />
    </Screen>
  );
}
