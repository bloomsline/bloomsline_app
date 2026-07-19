import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Secure key/value storage for tokens + flags.
//   native → Keychain / Keystore (expo-secure-store)
//   web    → localStorage (preview only; secure-store isn't available on web)
const isWeb = Platform.OS === 'web';

export async function storageGet(key: string): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (isWeb) { globalThis.localStorage?.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}

export async function storageDelete(key: string): Promise<void> {
  if (isWeb) { globalThis.localStorage?.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}
