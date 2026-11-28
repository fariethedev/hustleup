import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '../native/Icon';

/**
 * Category-specific questions for the Add listing form. A job asks for a job title and work
 * mode, a skill asks how it is delivered, an event asks for a date, venue and ticket tiers…
 *
 * Answers are sent two ways: fields the backend models directly (event date, venue, deposit,
 * luggage route, delivery method) as their own form fields, and everything else inside the
 * listing's `meta` JSON, which ListingDto returns untouched for the detail screens.
 */
const PURPLE = '#7D39EB';

const DELIVERY = [['PICKUP', 'Pickup'], ['COURIER', 'Courier'], ['PARCEL_LOCKER', 'Parcel locker'], ['POST', 'Post'], ['SELLER_DELIVERY', 'I deliver']];

export const TYPE_COPY = {
  JOB: { title: 'Job title *', titleHint: 'e.g. Weekend Barista', price: 'Pay', priceHint: 'Amount per pay period', photos: 'Add your logo or workplace photos' },
  SKILL: { title: 'Service title *', titleHint: 'e.g. Logo & brand design', price: 'Price', priceHint: 'From price', photos: 'Show your work — portfolio photos sell skills' },
  HAIR_BEAUTY: { title: 'Service title *', titleHint: 'e.g. Knotless braids', price: 'Price', priceHint: 'Starting price', photos: 'Add photos of your past work' },
  EVENT: { title: 'Event name *', titleHint: 'e.g. Afrobeats Night', price: 'Lowest ticket price', priceHint: 'Set automatically from your ticket types', photos: 'Add a flyer or venue photos' },
  RENTAL: { title: 'Listing title *', titleHint: 'e.g. Room in a shared flat', price: 'Monthly rent', priceHint: 'Rent per month', photos: 'Add photos of every room' },
  LUGGAGE: { title: 'Trip title *', titleHint: 'e.g. Warsaw → Lagos space', price: 'Price per kg', priceHint: 'Per kilogram', photos: 'Add a photo (optional)' },
  FOOD: { title: 'Dish or menu name *', titleHint: 'e.g. Party jollof tray', price: 'Price', priceHint: 'Per order', photos: 'Add mouth-watering photos' },
  FASHION: { title: 'Item name *', titleHint: 'e.g. Vintage denim jacket', price: 'Price', priceHint: 'Asking price', photos: 'Add clear photos — front, back and labels' },
  GOODS: { title: 'Item name *', titleHint: 'e.g. Canon AE-1 camera', price: 'Price', priceHint: 'Asking price', photos: 'Add clear photos from every angle' },
};

const newTier = (name = '', price = '', quantity = '') => ({ id: `t${Math.random().toString(36).slice(2, 8)}`, name, price, quantity });
export const defaultExtra = (type) => (type === 'EVENT'
  ? { ticketTiers: [newTier('Early bird'), newTier('General'), newTier('VIP')] }
  : ['GOODS', 'FASHION'].includes(type) ? { shippingMethod: 'COURIER', condition: 'Good' }
  : type === 'FOOD' ? { shippingMethod: 'PICKUP' }
  : type === 'JOB' ? { employmentType: 'Part-time', workMode: 'On-site', payPeriod: 'HOUR' }
  : type === 'SKILL' ? { deliveryMode: 'Both', pricing: 'Fixed' }
  : type === 'HAIR_BEAUTY' ? { location: 'At my place' }
  : type === 'RENTAL' ? { propertyType: 'Room', furnished: true }
  : {});

const money = v => String(v || '').trim().replace(',', '.');
const isMoney = v => /^\d+(\.\d{1,2})?$/.test(money(v));

/** Returns an error message, or null when the category's required answers are present. */
export function validateExtra(type, x) {
  if (type === 'EVENT') {
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(x.eventDate || '')) return 'Enter the event date and time as YYYY-MM-DD HH:MM.';
    if (!(x.venue || '').trim()) return 'Add the venue.';
    const tiers = (x.ticketTiers || []).filter(t => t.name.trim());
    if (!tiers.length) return 'Add at least one ticket type.';
    if (tiers.some(t => !isMoney(t.price))) return 'Give every ticket type a price (0 for free).';
    if (tiers.some(t => t.quantity && !/^\d+$/.test(t.quantity))) return 'Ticket quantities must be whole numbers.';
  }
  if (type === 'LUGGAGE') {
    if (!(x.destinationCity || '').trim()) return 'Add the destination city.';
    if (!/^\d+$/.test(x.capacityKg || '')) return 'Enter how many kg you can carry.';
  }
  if (type === 'SKILL' && !(x.skillType || '').trim()) return 'Choose the type of skill.';
  if (type === 'HAIR_BEAUTY' && !(x.serviceType || '').trim()) return 'Choose the service type.';
  if (['GOODS', 'FASHION', 'FOOD'].includes(type) && x.shippingMethod && x.shippingMethod !== 'PICKUP' && x.shippingPrice && !isMoney(x.shippingPrice)) return 'Check the delivery price.';
  if (type === 'RENTAL' && x.deposit && !isMoney(x.deposit)) return 'Check the deposit amount.';
  return null;
}

/** Splits answers into backend form fields + meta JSON, and the price to list (events: lowest tier). */
export function toSubmission(type, x) {
  const fields = {};
  const meta = {};
  let price = null;
  const keep = keys => keys.forEach(k => { if (x[k] !== undefined && x[k] !== '') meta[k] = x[k]; });
  if (type === 'EVENT') {
    fields.eventStartsAt = x.eventDate.replace(' ', 'T');
    fields.eventVenue = x.venue.trim();
    const tiers = x.ticketTiers.filter(t => t.name.trim()).map(t => ({
      id: t.id, name: t.name.trim(), price: Number(money(t.price)), quantity: t.quantity ? Number(t.quantity) : null, description: t.description || undefined,
    }));
    meta.ticketTiers = tiers;
    const capacity = tiers.every(t => t.quantity) ? tiers.reduce((n, t) => n + t.quantity, 0) : null;
    if (x.capacity) fields.eventCapacity = x.capacity; else if (capacity) fields.eventCapacity = String(capacity);
    price = Math.min(...tiers.map(t => t.price)).toFixed(2);
    keep(['ageLimit', 'dressCode']);
  } else if (type === 'LUGGAGE') {
    fields.destinationCity = x.destinationCity.trim();
    fields.luggageCapacityKg = x.capacityKg;
    keep(['travelDate']);
  } else if (type === 'RENTAL') {
    if (x.deposit) fields.depositAmount = money(x.deposit);
    if (x.bills) fields.billsAmount = money(x.bills);
    fields.payOnPlatform = String(!!x.payOnPlatform);
    keep(['propertyType', 'availableFrom', 'furnished']);
  } else if (['GOODS', 'FASHION', 'FOOD'].includes(type)) {
    if (x.shippingMethod) fields.shippingMethod = x.shippingMethod;
    if (x.shippingMethod && x.shippingMethod !== 'PICKUP' && x.shippingPrice) fields.shippingPrice = money(x.shippingPrice);
    keep(['condition', 'brand', 'size', 'cuisine', 'serves', 'dietary', 'allergens']);
  } else if (type === 'JOB') keep(['company', 'employmentType', 'workMode', 'payPeriod', 'requirements', 'howToApply']);
  else if (type === 'SKILL') keep(['skillType', 'deliveryMode', 'pricing', 'turnaround', 'portfolioUrl']);
  else if (type === 'HAIR_BEAUTY') keep(['serviceType', 'durationMinutes', 'location']);
  return { fields, meta, price };
}

function Choice({ label, options, value, onChange, colors }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: colors.light ? '#7D39EB' : '#C4B5FD' }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => {
          const [key, text] = Array.isArray(o) ? o : [o, o];
          const on = value === key;
          return (
            <TouchableOpacity key={key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(key)}
              style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, justifyContent: 'center', borderColor: on ? PURPLE : colors.line, backgroundColor: on ? PURPLE : 'transparent' }}>
              <Text style={{ color: on ? '#FFF' : colors.text, fontWeight: '600', fontSize: 13 }}>{text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function ListingTypeFields({ type, extra, setExtra, inputStyle, fieldLabelStyle, colors, currency }) {
  const set = (k, v) => setExtra(x => ({ ...x, [k]: v }));
  const Input = ({ k, label, placeholder, keyboardType, multiline }) => (
    <View style={{ gap: 6 }}>
      <Text style={fieldLabelStyle}>{label}</Text>
      <TextInput accessibilityLabel={label} value={extra[k] || ''} onChangeText={v => set(k, v)} placeholder={placeholder} placeholderTextColor="#777"
        keyboardType={keyboardType} multiline={multiline} style={[inputStyle, multiline && { minHeight: 90, textAlignVertical: 'top' }]} />
    </View>
  );
  const toggle = (k, label) => (
    <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: !!extra[k] }} onPress={() => set(k, !extra[k])} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <Feather name={extra[k] ? 'check-square' : 'square'} size={22} color={PURPLE} /><Text style={{ color: colors.text, fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );
  const delivery = (
    <>
      <Choice label="DELIVERY" options={type === 'FOOD' ? [['PICKUP', 'Pickup'], ['SELLER_DELIVERY', 'I deliver'], ['COURIER', 'Courier']] : DELIVERY} value={extra.shippingMethod} onChange={v => set('shippingMethod', v)} colors={colors} />
      {extra.shippingMethod && extra.shippingMethod !== 'PICKUP' && Input({ k: 'shippingPrice', label: `DELIVERY PRICE (${currency})`, placeholder: '0.00 for free delivery', keyboardType: 'decimal-pad' })}
    </>
  );

  switch (type) {
    case 'JOB': return (<>
      {Input({ k: 'company', label: 'COMPANY / BUSINESS', placeholder: 'Who is hiring?' })}
      <Choice label="EMPLOYMENT TYPE" options={['Full-time', 'Part-time', 'Contract', 'Gig', 'Internship']} value={extra.employmentType} onChange={v => set('employmentType', v)} colors={colors} />
      <Choice label="WORK MODE" options={['On-site', 'Remote', 'Hybrid']} value={extra.workMode} onChange={v => set('workMode', v)} colors={colors} />
      <Choice label="PAY PERIOD" options={[['HOUR', 'Per hour'], ['DAY', 'Per day'], ['MONTH', 'Per month'], ['PROJECT', 'Per project']]} value={extra.payPeriod} onChange={v => set('payPeriod', v)} colors={colors} />
      {Input({ k: 'requirements', label: 'REQUIREMENTS', placeholder: 'Experience, languages, availability…', multiline: true })}
      {Input({ k: 'howToApply', label: 'HOW TO APPLY', placeholder: 'e.g. Message me with your CV' })}
    </>);
    case 'SKILL': return (<>
      <Choice label="TYPE OF SKILL *" options={['Design', 'Photography', 'Video', 'Tech & web', 'Tutoring', 'Music', 'Writing', 'Marketing', 'Cleaning', 'Repairs', 'Other']} value={extra.skillType} onChange={v => set('skillType', v)} colors={colors} />
      <Choice label="HOW YOU DELIVER" options={['In person', 'Online', 'Both']} value={extra.deliveryMode} onChange={v => set('deliveryMode', v)} colors={colors} />
      <Choice label="PRICING" options={['Fixed', 'Per hour', 'Per session']} value={extra.pricing} onChange={v => set('pricing', v)} colors={colors} />
      {Input({ k: 'turnaround', label: 'TURNAROUND', placeholder: 'e.g. 3 days' })}
      {Input({ k: 'portfolioUrl', label: 'PORTFOLIO LINK', placeholder: 'https://…' })}
    </>);
    case 'HAIR_BEAUTY': return (<>
      <Choice label="SERVICE TYPE *" options={['Braids', 'Haircut', 'Wig install', 'Nails', 'Lashes', 'Brows', 'Makeup', 'Skincare', 'Other']} value={extra.serviceType} onChange={v => set('serviceType', v)} colors={colors} />
      {Input({ k: 'durationMinutes', label: 'DURATION (MINUTES)', placeholder: 'e.g. 180', keyboardType: 'number-pad' })}
      <Choice label="WHERE" options={['At my place', 'I travel to you', 'Both']} value={extra.location} onChange={v => set('location', v)} colors={colors} />
    </>);
    case 'EVENT': return (<>
      {Input({ k: 'eventDate', label: 'DATE & TIME * (YYYY-MM-DD HH:MM)', placeholder: '2026-12-31 21:00' })}
      {Input({ k: 'venue', label: 'VENUE *', placeholder: 'Venue name and address' })}
      <View style={{ gap: 10 }}>
        <Text style={fieldLabelStyle}>TICKET TYPES *</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Early bird, general, VIP — each with its own price and how many are for sale. Leave quantity empty for unlimited.</Text>
        {(extra.ticketTiers || []).map((t, i) => (
          <View key={t.id} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput accessibilityLabel={`Ticket type ${i + 1} name`} value={t.name} onChangeText={v => set('ticketTiers', extra.ticketTiers.map(x => x.id === t.id ? { ...x, name: v } : x))} placeholder="Ticket name" placeholderTextColor="#777" style={[inputStyle, { flex: 1 }]} />
              <TouchableOpacity accessibilityLabel={`Remove ticket type ${i + 1}`} onPress={() => set('ticketTiers', extra.ticketTiers.filter(x => x.id !== t.id))} style={{ padding: 8 }}><Feather name="trash-2" size={18} color="#F87171" /></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput accessibilityLabel={`${t.name || 'Ticket'} price`} value={String(t.price)} onChangeText={v => set('ticketTiers', extra.ticketTiers.map(x => x.id === t.id ? { ...x, price: v } : x))} placeholder={`Price (${currency})`} placeholderTextColor="#777" keyboardType="decimal-pad" style={[inputStyle, { flex: 1 }]} />
              <TextInput accessibilityLabel={`${t.name || 'Ticket'} quantity`} value={String(t.quantity || '')} onChangeText={v => set('ticketTiers', extra.ticketTiers.map(x => x.id === t.id ? { ...x, quantity: v } : x))} placeholder="Quantity" placeholderTextColor="#777" keyboardType="number-pad" style={[inputStyle, { flex: 1 }]} />
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={() => set('ticketTiers', [...(extra.ticketTiers || []), newTier()])} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
          <Feather name="plus-circle" size={20} color={PURPLE} /><Text style={{ color: PURPLE, fontWeight: '700' }}>Add ticket type</Text>
        </TouchableOpacity>
      </View>
      {Input({ k: 'ageLimit', label: 'AGE LIMIT', placeholder: 'e.g. 18+' })}
      {Input({ k: 'dressCode', label: 'DRESS CODE', placeholder: 'Optional' })}
    </>);
    case 'RENTAL': return (<>
      <Choice label="PROPERTY TYPE" options={['Room', 'Studio', 'Apartment', 'House', 'Parking']} value={extra.propertyType} onChange={v => set('propertyType', v)} colors={colors} />
      {Input({ k: 'availableFrom', label: 'AVAILABLE FROM', placeholder: 'YYYY-MM-DD' })}
      {Input({ k: 'deposit', label: `DEPOSIT (${currency})`, placeholder: '0.00', keyboardType: 'decimal-pad' })}
      {Input({ k: 'bills', label: `BILLS PER MONTH (${currency})`, placeholder: 'Leave empty if included', keyboardType: 'decimal-pad' })}
      {toggle('furnished', 'Furnished')}
      {toggle('payOnPlatform', 'Tenants pay securely through HustleSpace')}
    </>);
    case 'LUGGAGE': return (<>
      {Input({ k: 'destinationCity', label: 'DESTINATION CITY *', placeholder: 'e.g. Lagos' })}
      {Input({ k: 'travelDate', label: 'TRAVEL DATE', placeholder: 'YYYY-MM-DD' })}
      {Input({ k: 'capacityKg', label: 'SPACE AVAILABLE (KG) *', placeholder: 'e.g. 20', keyboardType: 'number-pad' })}
    </>);
    case 'FOOD': return (<>
      {Input({ k: 'cuisine', label: 'CUISINE', placeholder: 'e.g. Nigerian' })}
      {Input({ k: 'serves', label: 'SERVES', placeholder: 'e.g. 10 people', keyboardType: 'default' })}
      <Choice label="DIETARY" options={['None', 'Vegetarian', 'Vegan', 'Halal', 'Gluten-free']} value={extra.dietary} onChange={v => set('dietary', v)} colors={colors} />
      {Input({ k: 'allergens', label: 'ALLERGENS', placeholder: 'e.g. peanuts, shellfish' })}
      {delivery}
    </>);
    case 'FASHION': case 'GOODS': return (<>
      <Choice label="CONDITION" options={['New', 'Like new', 'Good', 'Fair']} value={extra.condition} onChange={v => set('condition', v)} colors={colors} />
      {Input({ k: 'brand', label: 'BRAND', placeholder: 'Optional' })}
      {type === 'FASHION' && Input({ k: 'size', label: 'SIZE', placeholder: 'e.g. M, 42, UK 8' })}
      {delivery}
    </>);
    default: return null;
  }
}
