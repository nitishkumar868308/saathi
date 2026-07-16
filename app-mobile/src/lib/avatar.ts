import * as ImagePicker from "expo-image-picker";

import { supabase } from "./supabase";
import { uploadFile, fileSizeBytes } from "./storage";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export class AvatarTooLargeError extends Error {
  constructor() {
    super("Photo 2 MB se badi hai");
    this.name = "AvatarTooLargeError";
  }
}

/**
 * Gallery se photo chuno, 2 MB check karo, Supabase Storage me upload karo.
 * Public URL lautata hai. Size zyada ho to AvatarTooLargeError. Cancel pe null.
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

  const bytes = asset.fileSize ?? (await fileSizeBytes(asset.uri));
  if (bytes > MAX_BYTES) throw new AvatarTooLargeError();

  if (!supabase) throw new Error("Supabase set nahi hai");
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Login zaroori hai");

  const path = `${uid}/avatar.jpg`;
  await uploadFile("avatars", path, asset.uri, "image/jpeg");

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${pub.publicUrl}?t=${Date.now()}`;
}
