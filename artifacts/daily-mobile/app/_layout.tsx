import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { DailyProvider, useDaily } from '@/state/DailyContext';
import { StoreGate } from '@/components/daily/StoreGate';
import { useDailyTheme } from '@/hooks/useColors';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import { getBearer } from '@/state/session';

setBaseUrl(process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : null);
setAuthTokenGetter(getBearer);

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { authenticated } = useDaily();
  const { colors, isDark } = useDailyTheme();
  useEffect(() => {
    if (Platform.OS !== 'web') void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);
  return (
    <>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={authenticated}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="detail" />
      </Stack.Protected>
    </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <DailyProvider>
                <ErrorBoundary><StoreGate><RootLayoutNav /></StoreGate></ErrorBoundary>
              </DailyProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
    </SafeAreaProvider>
  );
}
