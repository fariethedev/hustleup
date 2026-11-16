import React from 'react';
import { Redirect } from 'expo-router';
export default function SalesProfile() {
  return <Redirect href="/profile/orders?view=selling" />;
}
