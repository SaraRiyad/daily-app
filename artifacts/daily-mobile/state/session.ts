import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'daily-bearer-session-v1';
let bearer: string | null = null;
export const getBearer = () => bearer;
export const setBearer = (value: string | null) => { bearer = value; };

// Bearer tokens never go into the AsyncStorage workspace or a persistent web
// store. Access failures are surfaced, not silently downgraded to unsafe storage.
export async function readSession(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof sessionStorage === 'undefined') throw new Error('Browser session storage is unavailable.');
    return sessionStorage.getItem(KEY);
  }
  return SecureStore.getItemAsync(KEY);
}
export async function writeSession(value: string | null) {
  if (Platform.OS === 'web') {
    if (typeof sessionStorage === 'undefined') throw new Error('Browser session storage is unavailable.');
    if (value) sessionStorage.setItem(KEY, value); else sessionStorage.removeItem(KEY);
  } else if (value) {
    await SecureStore.setItemAsync(KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  } else await SecureStore.deleteItemAsync(KEY);
  bearer = value;
}