import { RACE_SHARE_CODE_PREFIX, racePayloadSchema, type RacePayload } from "./race";

/**
 * Isomorphic (browser + Node 18+) share-code decoding. Uses the native
 * CompressionStream/DecompressionStream APIs, exactly like the in-game exporter, so no bundled
 * gzip library is needed on either side.
 *
 * Every activity type BeamJoy can export is keyed by its own versioned prefix. Only races export
 * codes today; new activity types (hunter/infected arenas, bus lines, ...) slot in here.
 */
export const ACTIVITY_TYPES = {
  race: { prefix: RACE_SHARE_CODE_PREFIX, label: "Race" },
} as const;

export type ActivityType = keyof typeof ACTIVITY_TYPES;

export type DecodedShareCode = {
  type: "race";
  prefix: string;
  payload: RacePayload;
  /** The canonical, whitespace-free code. */
  code: string;
};

/** Hard limits: codes are pasted by strangers, so a gzip bomb must not take the server down. */
export const MAX_CODE_LENGTH = 1_000_000;
const MAX_DECOMPRESSED_BYTES = 8_000_000;

export class ShareCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareCodeError";
  }
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function gunzipLimited(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_DECOMPRESSED_BYTES) {
      await reader.cancel();
      throw new ShareCodeError("Share code is too large.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(out);
}

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([new TextEncoder().encode(text)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function detectActivityType(code: string): ActivityType | null {
  const trimmed = code.trim();
  for (const [type, def] of Object.entries(ACTIVITY_TYPES)) {
    if (trimmed.startsWith(def.prefix)) return type as ActivityType;
  }
  return null;
}

export async function decodeShareCode(input: string): Promise<DecodedShareCode> {
  // Codes get mangled by chat apps: tolerate wrapped lines and stray spaces.
  const code = (input ?? "").replace(/\s+/g, "");
  if (!code) throw new ShareCodeError("Paste a share code.");
  if (code.length > MAX_CODE_LENGTH) throw new ShareCodeError("Share code is too long.");

  const type = detectActivityType(code);
  if (!type) {
    throw new ShareCodeError(
      `Not a race share code (should start with ${RACE_SHARE_CODE_PREFIX}).`,
    );
  }
  const prefix = ACTIVITY_TYPES[type].prefix;

  let json: string;
  try {
    json = await gunzipLimited(base64ToBytes(code.slice(prefix.length)));
  } catch (e) {
    if (e instanceof ShareCodeError) throw e;
    throw new ShareCodeError("Share code is incomplete or corrupted. Copy it again.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ShareCodeError("Share code is corrupted. Copy it again.");
  }

  const parsed = racePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ShareCodeError("Share code has no valid race.");
  }
  return { type, prefix, payload: parsed.data, code };
}

/** Same encoding as the in-game exporter. Used by the seed script and tests. */
export async function encodeRaceShareCode(payload: RacePayload): Promise<string> {
  return RACE_SHARE_CODE_PREFIX + bytesToBase64(await gzip(JSON.stringify(payload)));
}
