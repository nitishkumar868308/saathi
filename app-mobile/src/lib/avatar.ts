import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "./supabase";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export class AvatarTooLargeError extends Error {
  constructor() {
    super("Photo 2 MB se badi hai");
    this.name = "AvatarTooLargeError";
  }
}

/** Base64 → Uint8Array (bina kisi runtime dependency ke). */
function base64ToBytes(b64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  let len = b64.length;
  while (len > 0 && b64[len - 1] === "=") len--; // padding count
  const outLen = (len * 3) >> 2;
  const bytes = new Uint8Array(outLen);

  let p = 0;
  for (let i = 0; i + 3 < len + 4; i += 4) {
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

/**
 * Gallery se photo chuno, 2 MB check karo, Supabase Storage me upload karo.
 * Public URL lautata hai. Size zyada ho to AvatarTooLargeError throw karta hai.
 * User ne cancel kiya to null.
 */
export async function pickAndUploadAvatar(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Gallery permission chahiye");

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];

  // Size check — asset.fileSize sabse sahi; na ho to file info se.
  let bytes = asset.fileSize ?? 0;
  if (!bytes) {
    const info = await FileSystem.getInfoAsync(asset.uri);
    bytes = info.exists && "size" in info ? info.size : 0;
  }
  if (bytes > MAX_BYTES) throw new AvatarTooLargeError();

  if (!supabase) throw new Error("Supabase set nahi hai");
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Login zaroori hai");

  const b64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const data = base64ToBytes(b64);

  // Ek hi path — upsert se purani photo replace ho jaati hai (cache-bust query).
  const path = `${uid}/avatar.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, data, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${pub.publicUrl}?t=${Date.now()}`;
}
