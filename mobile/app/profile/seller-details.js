import React, { useCallback, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { trustApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Button, Copy, fonts, LIME, Notice, Screen, usePalette } from '../../src/components/native/Kit';

const errorText = (e, fallback) => e?.response?.data?.error || e?.response?.data?.message || fallback;

/**
 * Private vs business seller and the legal details EU rules require: trader information shown
 * to buyers (DSA) and the identity the tax office receives once a seller passes the DAC7
 * threshold (30 sales or ~€2,000 a year).
 */
export default function SellerDetails() {
  const c = usePalette();
  const fetcher = useCallback(() => trustApi.sellerProfile().then(r => r.data), []);
  const { data, error, reload } = useRemote(fetcher);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const p = draft || data || {};
  const business = p.sellerType === 'BUSINESS';
  const set = key => value => setDraft({ ...p, [key]: value });

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...p };
      ['traderDetailsComplete', 'taxDetailsComplete', 'strikes', 'strikeLimit', 'salesThisYear', 'grossThisYear', 'taxReportingRequired'].forEach(k => delete body[k]);
      await trustApi.saveSellerProfile(body);
      setDraft(null); await reload();
      Alert.alert('Saved', 'Your seller details are up to date.');
    } catch (e) { Alert.alert('Could not save', errorText(e, 'Please check the details and try again.')); }
    finally { setBusy(false); }
  };

  const field = (key, placeholder, props = {}) => (
    <TextInput key={key} value={p[key] || ''} onChangeText={set(key)} placeholder={placeholder} placeholderTextColor={c.muted}
      style={{ minHeight: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.text, fontFamily: fonts.body, fontSize: 15 }} {...props} />
  );

  return (
    <Screen back title="Seller details">
      {error && <Notice message={error} onRetry={reload} />}
      <Copy muted>EU rules require marketplaces to tell buyers whether a seller is a business, and to report sellers above a yearly threshold to the tax office. Only business details are shown to buyers.</Copy>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[['PRIVATE', 'Private person', 'Selling my own things'], ['BUSINESS', 'Business', 'Company or sole trader']].map(([value, label, hint]) => {
          const on = (p.sellerType || 'PRIVATE') === value;
          return (
            <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => set('sellerType')(value)}
              style={{ flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: on ? LIME : c.line, backgroundColor: c.card, gap: 2 }}>
              <Copy style={{ fontFamily: fonts.medium, fontSize: 14 }}>{label}</Copy>
              <Copy muted style={{ fontSize: 12 }}>{hint}</Copy>
            </Pressable>
          );
        })}
      </View>
      {business && <Copy style={{ color: '#F59E0B', fontSize: 12.5 }}>Business sellers must fill these in before listing.</Copy>}

      <View style={{ gap: 10 }}>
        {field('legalName', 'Full legal name')}
        {business && field('businessName', 'Business name')}
        {business && field('registrationNo', 'KRS / CEIDG number')}
        {field('taxId', business ? 'NIP' : 'PESEL or tax ID', { autoCapitalize: 'characters' })}
        {business && field('vatNumber', 'VAT number (optional)', { autoCapitalize: 'characters' })}
        {!business && field('dateOfBirth', 'Date of birth (YYYY-MM-DD)', { keyboardType: 'numbers-and-punctuation' })}
        {field('addressLine1', 'Street address')}
        {field('city', 'City')}
        {field('postalCode', 'Postal code')}
        {field('country', 'Country code (PL)', { autoCapitalize: 'characters', maxLength: 2 })}
        {business && field('contactEmail', 'Contact email for buyers', { keyboardType: 'email-address', autoCapitalize: 'none' })}
      </View>

      {!!data && (
        <Copy muted style={{ fontSize: 12.5 }}>
          This year: {data.salesThisYear || 0} completed sales. {data.taxReportingRequired
            ? 'You are above the DAC7 threshold — we must report your name, tax ID, date of birth, address and earnings to the tax office (KAS). Please complete these details.'
            : 'If you reach 30 sales or about €2,000 in a year, we must report your details and earnings to the tax office (DAC7).'} Strikes: {data.strikes || 0} of {data.strikeLimit || 3}.
        </Copy>
      )}
      <Button icon="check" busy={busy} onPress={save}>Save seller details</Button>
    </Screen>
  );
}
