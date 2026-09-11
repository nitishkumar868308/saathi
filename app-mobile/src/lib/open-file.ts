import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";

import { withoutLock } from "./app-lock";

/**
 * Phone par padi file ko uske apne app me kholo (PDF).
 *
 * ── App ke andar PDF viewer jaan-boojh ke nahi banaya ──────────────────
 *
 * Android ka WebView PDF khud nahi dikhata — wo use Google ke online viewer par
 * bhejta hai. Hamari file private signed URL par hai, aur use bahar bhejna theek
 * nahi. Aur PDF kholne wala app har phone me pehle se hota hai.
 *
 * ⚠️ File LOCAL hai, isliye ye bina net ke bhi chalta hai. Yahi is poore raste ki
 * sabse zaroori baat hai: offline screen ka waada hi yahi ek cheez hai — pehle se
 * rakhe hue documents khul jaayein.
 *
 * ⚠️ Android par `file://` doosre app ko seedha nahi diya ja sakta; use uski
 * ijaazat hi nahi hoti. `getContentUriAsync()` use `content://` me badalta hai,
 * aur `FLAG_GRANT_READ_URI_PERMISSION` (1) us app ko padhne dene ki ijaazat deta
 * hai — bina uske PDF app "file nahi khul rahi" dikhata hai.
 *
 * ⚠️ `withoutLock` zaroori hai. PDF app bahar khulta hai, yaani Saathi background
 * me chali jaati hai — par user ne app CHHODI nahi hai, app hi use bahar bhej
 * rahi hai. Bina iske wapas aate hi PIN maanga jaata: wahi shikayat jo camera par
 * thi. (`lib/share.ts` pehle se yahi karta hai.)
 */
export async function openLocalFile(uri: string, mime: string): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      const content = await FileSystem.getContentUriAsync(uri);
      await withoutLock(() =>
        IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: content,
          type: mime,
          flags: 1,
        }),
      );
      return true;
    }
    /**
     * iOS par koi "kholo" wala intent nahi hai. Share sheet hi wahan ka tareeka
     * hai — usme "Copy to Books", "Quick Look" sab aa jaata hai.
     */
    if (!(await Sharing.isAvailableAsync())) return false;
    await withoutLock(() => Sharing.shareAsync(uri, { mimeType: mime, UTI: "com.adobe.pdf" }));
    return true;
  } catch {
    return false;
  }
}
