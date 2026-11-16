import React from 'react';
import { Text } from 'react-native';

export default function PremiumBadge({ active }) {
  return active ? <Text accessibilityLabel="Premium member" style={{ color: '#A56A00', backgroundColor: '#FFF0BF', fontSize: 15 }}> ★ </Text> : null;
}
