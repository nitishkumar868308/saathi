import { useEffect, useState } from "react";

import { supabase } from "./supabase";

export type LocationItem = {
  id: number;
  name: string;
  /** Sirf countries par — ISO 3166-1 alpha-2 ("IN", "US"). Phone code isi se banta hai. */
  code?: string | null;
};

export type UserDetails = {
  full_name: string;
  email: string;
  phone: string;
  phone_dial_code: string | null;
  phone_country: string | null;
  address: string;
  gender: string;
  country_id: number | null;
  state_id: number | null;
  city_id: number | null;
  avatar_url: string | null;
};

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai (.env check karo)");
  return supabase;
}

export async function getCountries(): Promise<LocationItem[]> {
  const { data, error } = await client()
    .from("countries")
    // `code` (ISO alpha-2) bhi chahiye — phone ka dial code aur validation isi se.
    .select("id,name,code")
    .order("name");
  if (error) throw error;
  return (data ?? []) as LocationItem[];
}

export async function getStates(countryId: number): Promise<LocationItem[]> {
  const { data, error } = await client()
    .from("states")
    .select("id,name")
    .eq("country_id", countryId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as LocationItem[];
}

export async function getCities(stateId: number): Promise<LocationItem[]> {
  const { data, error } = await client()
    .from("cities")
    .select("id,name")
    .eq("state_id", stateId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as LocationItem[];
}

/* ---------------------------------------------------------------------- *
 *  Live cache — save karte hi har screen apne aap update ho jaye
 *
 *  Pehle har screen apna `getUserDetails()` call karti thi aur uska result
 *  `rewardsVersion` badalne tak pada rehta tha. Isliye naam/photo badalne ke
 *  baad app me purana hi dikhta tha — logout-login karne par hi naya aata tha.
 *  Ab ek shared cache hai: `saveUserDetails()` uske subscribers ko turant naya
 *  data de deta hai.
 * ---------------------------------------------------------------------- */

let cached: UserDetails | null = null;
let loaded = false;
const listeners = new Set<(d: UserDetails | null) => void>();

function publish(d: UserDetails | null) {
  cached = d;
  loaded = true;
  listeners.forEach((l) => l(d));
}

export async function getUserDetails(force = false): Promise<UserDetails | null> {
  if (loaded && !force) return cached;
  const sb = client();
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data } = await sb
    .from("user_details")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  publish((data as UserDetails) ?? null);
  return cached;
}

/** Logout pe cache saaf — agla user purane ka data na dekhe. */
export function clearUserDetailsCache(): void {
  cached = null;
  loaded = false;
  listeners.forEach((l) => l(null));
}

/**
 * Details + unke live updates. Screens isi ko use karein.
 *
 * `loading` isliye zaroori hai: pehli fetch se pehle details `null` hota hai, aur
 * `null` ko "profile adhoora" maan lein to har baar ek pal ke liye "Profile poori
 * karein" ka nudge chamak jaata hai.
 */
export function useUserDetails(): { details: UserDetails | null; loading: boolean } {
  const [d, setD] = useState<UserDetails | null>(cached);
  const [loading, setLoading] = useState(!loaded);

  useEffect(() => {
    const on = (v: UserDetails | null) => {
      setD(v);
      setLoading(false);
    };
    listeners.add(on);
    getUserDetails()
      .catch(() => null)
      .finally(() => setLoading(false));
    return () => {
      listeners.delete(on);
    };
  }, []);

  return { details: d, loading };
}

export async function saveUserDetails(d: UserDetails): Promise<void> {
  const sb = client();
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Login zaroori hai");
  const { error } = await sb.from("user_details").upsert(
    { user_id: uid, ...d, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw error;

  // Naam/photo auth metadata me bhi likho. Greeting ("Hello Nitish") aur settings
  // ka header wahi se padhte hain; iske bina wo logout-login tak purane rehte the.
  // updateUser `USER_UPDATED` event bhejta hai, jisse AuthProvider ka session
  // apne aap refresh ho jaata hai.
  await sb.auth
    .updateUser({ data: { full_name: d.full_name, avatar_url: d.avatar_url } })
    .catch(() => {});

  publish(d);
}

export function isDetailsComplete(d: UserDetails | null): boolean {
  return (
    !!d && !!d.full_name && !!d.phone && !!d.address && !!d.gender && !!d.city_id
  );
}
