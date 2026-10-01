import { useColorScheme } from 'react-native';
import { darkTheme, theme } from '@/constants/colors';
import { useDaily } from '@/state/DailyContext';

export function useDailyTheme() {
  const { data } = useDaily();
  const system = useColorScheme();
  const isDark = data.preferences.theme === 'Dark' || (data.preferences.theme === 'System' && system === 'dark');
  return { colors: isDark ? darkTheme : theme, isDark };
}

export function useColors() {
  return useDailyTheme().colors;
}