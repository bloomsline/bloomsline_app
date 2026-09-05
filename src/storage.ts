import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Secure key/value storage for tokens + flags.
//   native → Keychain / Keystore (expo-secure-store)
//   web    → localStorage (preview only; secure-store isn't available on web)
const isWeb = Platform.OS === 'web';

// Every web call is wrapped: touching localStorage THROWS (not returns null) in
// Safari private browsing and wherever site data is blocked, and `?.` does not
// help because the throw is on the access itself. An unguarded throw here used
// to surface as an unhandled rejection far from the cause. A read that fails
// reads as "not stored yet", which is the safe answer for a flag.
export async function storageGet(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Private browsing or a full quota. The caller's in-memory state still
      // holds for this session; it just will not survive a reload.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function storageDelete(key: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Nothing to do: if we cannot reach storage, there is nothing stored.
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
