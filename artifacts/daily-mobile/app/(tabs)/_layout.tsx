import { Tabs, Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useDailyInsets } from '@/hooks/useDailyInsets';
import { useDaily } from '@/state/DailyContext';
import { theme as c, fonts } from '@/constants/colors';

export default function TabLayout() {
  const { data } = useDaily(), insets = useDailyInsets();
  if (!data.entered) return <Redirect href="/" />;
  return <Tabs screenOptions={{
    headerShown: false, tabBarActiveTintColor: c.accentForeground, tabBarInactiveTintColor: c.mutedForeground,
    tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border, paddingTop: 8, ...(Platform.OS === 'web' ? { height: 84 } : { height: 66 + insets.bottom, paddingBottom: Math.max(insets.bottom, 5) }) },
    tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 10, marginTop: 3 },
    tabBarItemStyle: { borderRadius: 12 }, sceneStyle: { backgroundColor: c.background },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home tab', tabBarIcon: ({ color }) => <Feather name="home" size={21} color={color} /> }} />
    <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarAccessibilityLabel: 'Tasks tab', tabBarIcon: ({ color }) => <Feather name="check-circle" size={21} color={color} /> }} />
    <Tabs.Screen name="work" options={{ title: 'Work', tabBarAccessibilityLabel: 'Work tab', tabBarIcon: ({ color }) => <Feather name="briefcase" size={21} color={color} /> }} />
    <Tabs.Screen name="money" options={{ title: 'Money', tabBarAccessibilityLabel: 'Money tab', tabBarIcon: ({ color }) => <Feather name="credit-card" size={21} color={color} /> }} />
    <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarAccessibilityLabel: 'Calendar tab', tabBarIcon: ({ color }) => <Feather name="calendar" size={21} color={color} /> }} />
  </Tabs>;
}