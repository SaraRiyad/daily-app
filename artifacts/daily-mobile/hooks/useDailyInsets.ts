import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The browser preview has no native status/home-indicator safe areas.
// Never replace or inflate the actual iOS/Android device insets.
export function useDailyInsets() {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'web'
    ? { ...insets, top: Math.max(67, insets.top), bottom: Math.max(34, insets.bottom) }
    : insets;
}