import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "./supabase";

/** Base64 → Uint8Array (bina kisi runtime dependency ke). */
export function base64ToBytes(b64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  let len = b64.length;
  while (len > 0 && b64[len - 1] === "=") len--; // padding
  const outLen = (len * 3) >> 2;
  const bytes = new Uint8Array(outLen);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = lookup[b64.charCodeAt(i)];
    const c1 = lookup[b64.charCodeAt(i + 1)];
    const c2 = i + 2 < len ? lookup[b64.charCodeAt(i + 2)] : 0;
    const c3 = i + 3 < len ? lookup[b64.charCodeAt(i + 3)] : 0;
    if (p < outLen) bytes[p++] = (c0 << 2) | (c1 >> 4);
    if (p < outLen) bytes[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (p < outLen) bytes[p++] = ((c2 & 3) << 6) | c3;
  }
  return bytes;
}

/** Local file ka size (bytes). Na mile to 0. */
export async function fileSizeBytes(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && "size" in info ? info.size : 0;
}

/**
 * Local image/file ko Supabase Storage me upload karo (upsert).
 * Uploaded size (bytes) lautata hai.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
): Promise<{ size: number }> {
  if (!supabase) throw new Error("Supabase set nahi hai");
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const data = base64ToBytes(b64);
  const { error } = await supabase.storage.from(bucket).upload(path, data, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  return { size: data.byteLength };
}

/** Private file ka short-lived signed URL (dekhne ke liye). */
export async function signedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}
