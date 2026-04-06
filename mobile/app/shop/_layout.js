import { Stack } from 'expo-router';

export default function ShopLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#050505' }, animation: 'slide_from_right' }} />
  );
}
