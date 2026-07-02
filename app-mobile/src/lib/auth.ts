import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai (.env check karo)");
  return supabase;
}

/** Email + password se naya account (naam ke saath). */
export async function signUpEmail(email: string, password: string, name: string) {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) throw error;
  return { needsConfirm: !data.session };
}

export async function signInEmail(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await client().auth.signOut();
}

function getParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = url.includes("#") ? url.split("#")[1] : url.split("?")[1];
  if (!q) return out;
  for (const pair of q.split("&")) {
    const [k, v] = pair.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return out;
}

/** Google se login (Supabase OAuth + in-app browser). */
export async function signInGoogle() {
  const sb = client();
  const redirectTo = Linking.createURL("auth");
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" }, // saare accounts dikhaye
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Google URL nahi mili");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  // Agar browser ne redirect pakad liya, yahin session set kar do
  if (result.type === "success" && result.url) {
    const params = getParams(result.url);
    if (params.code) {
      await sb.auth.exchangeCodeForSession(params.code);
      return;
    }
    if (params.access_token && params.refresh_token) {
      await sb.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      return;
    }
  }
  // warna: deep-link `saathi://auth` route (auth.tsx) session handle karega — throw nahi
}
