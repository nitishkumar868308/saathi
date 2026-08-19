import { assertValidKey } from "@reel/core/storage/keys";
import type {
  SignedUploadTarget,
  SignedUrlOptions,
  StorageDriver,
  StorageObjectInfo,
} from "@reel/core/storage/types";

import { assertR2Configured, type R2Config } from "../config";
import { presignUrl, type SignMethod } from "../sigv4";

/**
 * Cloudflare R2 driver.
 *
 * Bucket poora **private** rehta hai — koi public URL nahi. Har padhna-likhna
 * chhoti umar ke presigned URL se hota hai, jo server par banta hai. Isi wajah se
 * browser seedha upload kar paata hai bina R2 ki key jaane.
 *
 * R2 ka region hamesha "auto" hota hai aur path-style URL chalta hai
 * (`/<bucket>/<key>`) — dono baatein Cloudflare ki apni hain, S3 se alag.
 */

const REGION = "auto";
const SERVICE = "s3";

/**
 * `fetch` ki body ka type dono jagah se nikala gaya hai, naam se likha nahi.
 *
 * Ye file do alag lib sets ke saath compile hoti hai — worker/@reel/storage me
 * Node (undici) ke types, aur studio me lib.dom. `BodyInit` naam dono jagah ek
 * jaisa maujood nahi hai, par `RequestInit` dono jagah hai; isliye body ka type
 * usi se nikaal lete hain aur ye file kahin bhi compile ho jaati hai.
 */
type FetchBody = NonNullable<RequestInit["body"]>;

/** R2/S3 ki apni chhat 7 din hai; usse zyada maangna seedha 400 deta hai. */
const MAX_EXPIRY_SECONDS = 604800;
const DEFAULT_EXPIRY_SECONDS = 300;

export class R2StorageDriver implements StorageDriver {
  readonly name = "r2" as const;

  private readonly config: R2Config;

  constructor(config: R2Config) {
    assertR2Configured(config);
    this.config = config;
  }

  private host(): string {
    return `${this.config.accountId}.r2.cloudflarestorage.com`;
  }

  private presign(
    method: SignMethod,
    key: string,
    options: SignedUrlOptions & { contentType?: string } = {},
  ): string {
    assertValidKey(key);

    const extraQuery: Record<string, string> = {};
    if (options.downloadName) {
      // Quote/newline hata dena zaroori hai — warna header inject ho sakta hai.
      extraQuery["response-content-disposition"] =
        `attachment; filename="${options.downloadName.replace(/["\\\r\n]/g, "")}"`;
    }

    return presignUrl({
      method,
      host: this.host(),
      path: `/${this.config.bucket}/${key}`,
      region: REGION,
      service: SERVICE,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      expiresIn: Math.min(
        Math.max(options.expiresIn ?? DEFAULT_EXPIRY_SECONDS, 1),
        MAX_EXPIRY_SECONDS,
      ),
      ...(options.contentType ? { headers: { "content-type": options.contentType } } : {}),
      extraQuery,
    });
  }

  async putSigned(
    key: string,
    mime: string,
    options: SignedUrlOptions = {},
  ): Promise<SignedUploadTarget> {
    const expiresIn = Math.min(
      Math.max(options.expiresIn ?? DEFAULT_EXPIRY_SECONDS, 1),
      MAX_EXPIRY_SECONDS,
    );
    return {
      // content-type sign me bandha hai — client isi type ke saath hi chadha
      // sakta hai, kisi aur ke saath nahi.
      url: this.presign("PUT", key, { ...options, expiresIn, contentType: mime }),
      method: "PUT",
      headers: { "content-type": mime },
      key,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async getSignedUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    return this.presign("GET", key, options);
  }

  async put(key: string, data: Uint8Array, mime?: string): Promise<void> {
    const contentType = mime ?? "application/octet-stream";
    const response = await fetch(this.presign("PUT", key, { expiresIn: 900, contentType }), {
      method: "PUT",
      headers: { "content-type": contentType },
      // lib.dom ka body type `Uint8Array<ArrayBuffer>` maangta hai jabki hamara
      // `Uint8Array<ArrayBufferLike>` hai (SharedArrayBuffer ki wajah se). Runtime
      // par dono jagah bilkul theek chalta hai — ye sirf lib types ka jhagda hai.
      // Copy nahi kar rahe: 200MB ka MP4 slice karna bekaar ki memory hoti.
      body: data as unknown as FetchBody,
    });
    if (!response.ok) {
      throw new Error(
        `R2 par "${key}" upload nahi hua: ${response.status} ${await safeText(response)}`,
      );
    }
  }

  async get(key: string): Promise<Uint8Array | null> {
    const response = await fetch(this.presign("GET", key, { expiresIn: 300 }));
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(
        `R2 se "${key}" nahi mila: ${response.status} ${await safeText(response)}`,
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async delete(key: string): Promise<boolean> {
    const response = await fetch(this.presign("DELETE", key, { expiresIn: 120 }), {
      method: "DELETE",
    });
    // R2 ka DELETE idempotent hai — na hone par bhi 204 deta hai.
    return response.ok || response.status === 404;
  }

  async exists(key: string): Promise<StorageObjectInfo | null> {
    const response = await fetch(this.presign("HEAD", key, { expiresIn: 120 }), {
      method: "HEAD",
    });
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") ?? "0");
    return {
      key,
      size: Number.isFinite(length) ? length : 0,
      contentType: response.headers.get("content-type"),
    };
  }
}

/** Error body padhne me bhi fail ho sakta hai — usse asli error nahi dabna chahiye. */
async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return "(response body padhi nahi ja saki)";
  }
}
