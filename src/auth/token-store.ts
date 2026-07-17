// Secure, on-device token storage (Keychain / Keystore via expo-secure-store).
// The access + refresh tokens issued by the backend live ONLY here — never in
// AsyncStorage or plain files.
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'bl_access_token';
const REFRESH_KEY = 'bl_refresh_token';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export async function saveTokens(t: TokenPair): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, t.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, t.refreshToken),
  ]);
}

export function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}
