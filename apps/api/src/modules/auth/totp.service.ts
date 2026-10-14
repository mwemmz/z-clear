import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/errors/api-error';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31] ?? '';
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31] ?? '';
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw ApiError.validation('Invalid TOTP secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * RFC 6238 TOTP. Scaffolded in Phase 1 (data model + primitives, unit-tested)
 * but not yet enforced in the login flow.
 */
@Injectable()
export class TotpService {
  generateSecret(bytes = 20): string {
    return base32Encode(randomBytes(bytes));
  }

  generateCode(secret: string, timestampMs = Date.now(), stepSeconds = 30, digits = 6): string {
    const counter = Math.floor(timestampMs / 1000 / stepSeconds);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
    const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
    const binary =
      (((digest[offset] ?? 0) & 0x7f) << 24) |
      ((digest[offset + 1] ?? 0) << 16) |
      ((digest[offset + 2] ?? 0) << 8) |
      (digest[offset + 3] ?? 0);
    return (binary % 10 ** digits).toString().padStart(digits, '0');
  }

  verify(secret: string, code: string, atMs = Date.now(), window = 1): boolean {
    const expectedLength = 6;
    if (code.length !== expectedLength || !/^\d+$/.test(code)) return false;
    for (let drift = -window; drift <= window; drift += 1) {
      const candidate = this.generateCode(secret, atMs + drift * 30_000);
      if (timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) {
        return true;
      }
    }
    return false;
  }
}

export function buildOtpAuthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
