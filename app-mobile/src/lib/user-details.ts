import { supabase } from "./supabase";

export type LocationItem = { id: number; name: string };

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
};

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai (.env check karo)");
  return supabase;
}

export async function getCountries(): Promise<LocationItem[]> {
  const { data, error } = await client()
    .from("countries")
    .select("id,name")
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

export async function getUserDetails(): Promise<UserDetails | null> {
  const sb = client();
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data } = await sb
    .from("user_details")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  return (data as UserDetails) ?? null;
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
}

export function isDetailsComplete(d: UserDetails | null): boolean {
  return (
    !!d && !!d.full_name && !!d.phone && !!d.address && !!d.gender && !!d.city_id
  );
}
