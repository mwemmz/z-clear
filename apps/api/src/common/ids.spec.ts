import { describe, expect, it } from 'vitest';
import { isUuid, isUuidV7, uuidv7 } from './ids';

describe('uuidv7', () => {
  it('produces a valid v7 uuid', () => {
    const id = uuidv7();
    expect(isUuid(id)).toBe(true);
    expect(isUuidV7(id)).toBe(true);
  });

  it('is time-ordered across calls', () => {
    const first = uuidv7();
    const second = uuidv7();
    expect(second.localeCompare(first)).toBeGreaterThanOrEqual(0);
  });

  it('rejects non-v7 uuids', () => {
    expect(isUuidV7('00000000-0000-4000-8000-000000000000')).toBe(false);
  });
});
