// Access + refresh tokens issued by the backend live only in secure storage
// (Keychain/Keystore on native; localStorage on web preview) — never in plain
// files.
import { storageGet, storageSet, storageDelete } from '../storage';

const ACCESS_KEY = 'bl_access_token';
const REFRESH_KEY = 'bl_refresh_token';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export async function saveTokens(t: TokenPair): Promise<void> {
  await Promise.all([storageSet(ACCESS_KEY, t.accessToken), storageSet(REFRESH_KEY, t.refreshToken)]);
}

export function getAccessToken(): Promise<string | null> {
  return storageGet(ACCESS_KEY);
}

export function getRefreshToken(): Promise<string | null> {
  return storageGet(REFRESH_KEY);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([storageDelete(ACCESS_KEY), storageDelete(REFRESH_KEY)]);
}
