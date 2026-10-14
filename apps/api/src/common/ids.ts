import { randomBytes } from 'node:crypto';

const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let lastTimestamp = 0;
let counter = new Uint8Array(16);

function increment(bytes: Uint8Array): void {
  for (let i = bytes.length - 1; i >= 0; i -= 1) {
    if (bytes[i] === 0xff) {
      bytes[i] = 0;
      continue;
    }
    bytes[i] = (bytes[i] ?? 0) + 1;
    return;
  }
}

/**
 * RFC 9562 UUID version 7: 48-bit Unix millisecond timestamp then random bits.
 * Time-ordered (good index locality) and not guessable from a sequence. When
 * several ids are created in the same millisecond the random field is
 * incremented so ordering is strictly monotonic (and clock regressions do not
 * break it).
 */
export function uuidv7(): string {
  const now = Date.now();
  if (now > lastTimestamp) {
    lastTimestamp = now;
    counter = new Uint8Array(randomBytes(16));
  } else {
    increment(counter);
  }

  const bytes = Buffer.from(counter);
  bytes.writeUIntBE(lastTimestamp, 0, 6);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10xx

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isUuidV7(value: string): boolean {
  return UUID_V7_RE.test(value);
}
