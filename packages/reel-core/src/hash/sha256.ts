/**
 * SHA-256 — chunk-dar-chunk (streaming).
 *
 * ⚠️ Sawaal pehle: `crypto.subtle.digest("SHA-256", buffer)` browser me pehle se
 * hai, phir apna kyun? Kyunki wo **poori file ek saath memory me** maangta hai.
 * Ek 200MB ki screen recording ke liye iska matlab hai 200MB ka ArrayBuffer,
 * aur uska koi progress bhi nahi — user ko lagta hai app atak gaya. Yahan
 * `file.stream()` se 1MB ke tukde aate hain, memory sthir rehti hai, aur har
 * tukde par progress mil jaata hai.
 *
 * Ye pure TypeScript hai (koi Node, koi DOM), isliye browser aur worker dono
 * ise chalate hain — aur dono ka checksum ek hi nikalta hai, jo duplicate
 * pehchanne ke liye zaroori hai.
 *
 * **Sahi hai ya nahi, ye maana nahi gaya hai:** check script isse `node:crypto`
 * ke saath random data par milata hai, aur chunk ke alag-alag naaps par bhi —
 * kyunki streaming hash ki galti hamesha "boundary" par hi nikalti hai.
 */

/** FIPS 180-4 ke round constants (pehle 64 primes ke cube root ka fractional hissa). */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const BLOCK_BYTES = 64;

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

export class Sha256 {
  private readonly state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  /** Adhoora block jo agle chunk ka intezaar kar raha hai. */
  private readonly tail = new Uint8Array(BLOCK_BYTES);
  private tailLength = 0;
  private totalBytes = 0;
  /** Message schedule — har block par naya array banane se GC pit'ta hai. */
  private readonly w = new Uint32Array(64);
  private finished = false;

  update(chunk: Uint8Array): this {
    if (this.finished) throw new Error("Sha256: digest() ke baad update() nahi ho sakta");
    this.totalBytes += chunk.length;

    let offset = 0;

    // Pehle pichhla adhoora block poora karo.
    if (this.tailLength > 0) {
      const take = Math.min(BLOCK_BYTES - this.tailLength, chunk.length);
      this.tail.set(chunk.subarray(0, take), this.tailLength);
      this.tailLength += take;
      offset = take;
      if (this.tailLength === BLOCK_BYTES) {
        this.compress(this.tail, 0);
        this.tailLength = 0;
      }
    }

    // Poore block seedha chunk se — copy kiye bina.
    while (offset + BLOCK_BYTES <= chunk.length) {
      this.compress(chunk, offset);
      offset += BLOCK_BYTES;
    }

    // Bacha hua hissa agli baar ke liye rakh lo.
    if (offset < chunk.length) {
      this.tail.set(chunk.subarray(offset), 0);
      this.tailLength = chunk.length - offset;
    }
    return this;
  }

  digest(): Uint8Array {
    if (this.finished) throw new Error("Sha256: digest() do baar nahi");
    this.finished = true;

    /*
     * Padding: ek `0x80` byte, phir zeroes, phir aakhri 8 byte me poori message
     * ki lambai **bits** me (big-endian). Agar lambai ke liye jagah na bache to
     * ek block aur lagta hai — yahi wo jagah hai jahan galat implementations
     * 55/56/64 byte ki files par toot'te hain, isliye check script me wahi
     * lambaiyan alag se naapi gayi hain.
     */
    const padded = new Uint8Array(this.tailLength < BLOCK_BYTES - 8 ? BLOCK_BYTES : BLOCK_BYTES * 2);
    padded.set(this.tail.subarray(0, this.tailLength));
    padded[this.tailLength] = 0x80;

    const bits = this.totalBytes * 8;
    // 32-bit me shift karne se 512MB ke upar sab galat ho jaata — isliye
    // division se hi upar aur neeche ke aadhe nikalte hain.
    const high = Math.floor(bits / 0x1_0000_0000);
    const low = bits - high * 0x1_0000_0000;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, high, false);
    view.setUint32(padded.length - 4, low, false);

    for (let offset = 0; offset < padded.length; offset += BLOCK_BYTES) {
      this.compress(padded, offset);
    }

    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    for (let i = 0; i < 8; i += 1) outView.setUint32(i * 4, this.state[i] as number, false);
    return out;
  }

  digestHex(): string {
    return toHex(this.digest());
  }

  private compress(block: Uint8Array, offset: number): void {
    const w = this.w;

    for (let i = 0; i < 16; i += 1) {
      const at = offset + i * 4;
      w[i] =
        ((block[at] as number) << 24) |
        ((block[at + 1] as number) << 16) |
        ((block[at + 2] as number) << 8) |
        (block[at + 3] as number);
    }
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15] as number;
      const y = w[i - 2] as number;
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) | 0;
    }

    let a = this.state[0] as number;
    let b = this.state[1] as number;
    let c = this.state[2] as number;
    let d = this.state[3] as number;
    let e = this.state[4] as number;
    let f = this.state[5] as number;
    let g = this.state[6] as number;
    let h = this.state[7] as number;

    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + (K[i] as number) + (w[i] as number)) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    this.state[0] = ((this.state[0] as number) + a) | 0;
    this.state[1] = ((this.state[1] as number) + b) | 0;
    this.state[2] = ((this.state[2] as number) + c) | 0;
    this.state[3] = ((this.state[3] as number) + d) | 0;
    this.state[4] = ((this.state[4] as number) + e) | 0;
    this.state[5] = ((this.state[5] as number) + f) | 0;
    this.state[6] = ((this.state[6] as number) + g) | 0;
    this.state[7] = ((this.state[7] as number) + h) | 0;
  }
}

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/** Ek hi tukde ka hash — chhoti cheezon ke liye. */
export function sha256Hex(bytes: Uint8Array): string {
  return new Sha256().update(bytes).digestHex();
}

export interface StreamHashOptions {
  /** Har tukde ke baad — upload se pehle wali progress bar isi se chalti hai. */
  onProgress?: (bytesHashed: number) => void;
  signal?: { aborted: boolean };
}

/**
 * Kisi bhi byte-stream ka hash.
 *
 * Browser me `file.stream()` seedha yahan aata hai. `signal` diya ho aur user
 * cancel kar de to beech me hi ruk jaata hai — 200MB ki file ka hash poora
 * karne ke liye user ko rukna nahi padta.
 */
export async function sha256HexFromStream(
  stream: ReadableStream<Uint8Array>,
  options: StreamHashOptions = {},
): Promise<string> {
  const hasher = new Sha256();
  const reader = stream.getReader();
  let done = 0;

  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      if (options.signal?.aborted) throw new Error("hash cancel ho gaya");
      hasher.update(next.value);
      done += next.value.length;
      options.onProgress?.(done);
    }
  } finally {
    reader.releaseLock();
  }

  return hasher.digestHex();
}
