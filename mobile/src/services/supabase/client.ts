/**
 * Supabase client for React Native.
 * Session is persisted via custom storage (SecureStore).
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";
import { env } from "@/config/env";
import * as secureStorage from "@/services/storage/secureStorage";

const STORAGE_KEY = "supabase_session";

async function customGetItem(key: string): Promise<string | null> {
  if (key === STORAGE_KEY) {
    return secureStorage.getItem(secureStorage.STORAGE_KEYS.supabaseSession);
  }
  return null;
}

async function customSetItem(key: string, value: string): Promise<void> {
  if (key === STORAGE_KEY) {
    await secureStorage.setItem(secureStorage.STORAGE_KEYS.supabaseSession, value);
  }
}

async function customRemoveItem(key: string): Promise<void> {
  if (key === STORAGE_KEY) {
    await secureStorage.removeItem(secureStorage.STORAGE_KEYS.supabaseSession);
  }
}

const customStorage = {
  getItem: customGetItem,
  setItem: customSetItem,
  removeItem: customRemoveItem,
};

let clientInstance: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (clientInstance) return clientInstance;
  clientInstance = createSupabaseClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: customStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return clientInstance;
}

export type { Session };
