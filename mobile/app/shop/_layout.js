import { useAppTheme } from '../../src/theme/ThemeProvider';
import { Stack } from 'expo-router';

export default function ShopLayout() {
  const { palette, reducedMotion } = useAppTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg }, animation: reducedMotion ? 'none' : 'slide_from_right' }} />
  );
}
