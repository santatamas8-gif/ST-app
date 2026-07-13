/**
 * Secure key-value storage (Expo SecureStore).
 * Use for tokens / session only; not for large data.
 */

import * as SecureStore from "expo-secure-store";

const PREFIX = "st_app_";

export async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PREFIX + key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(PREFIX + key, value);
}

export async function removeItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(PREFIX + key);
}

export const STORAGE_KEYS = {
  supabaseSession: "supabase_session",
} as const;
