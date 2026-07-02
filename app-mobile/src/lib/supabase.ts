import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "";

/** true jab .env mein Supabase URL + publishable key set ho */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Supabase client. `null` jab tak .env configure na ho (app crash na ho).
 * Screens use karne se pehle `isSupabaseConfigured` check karein.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
