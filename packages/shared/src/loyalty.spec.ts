import { describe, expect, it } from 'vitest';
import {
  PROGRAM_NOT_CONFIGURED_NOTICE,
  isProgrammeConfigured,
  programmeNotice,
  type ProgramConfigSummary,
} from './loyalty';

const emptyProgram: ProgramConfigSummary = {
  version: 0,
  verificationStatus: 'NEEDS_VERIFICATION',
  configuredAt: null,
  notice: PROGRAM_NOT_CONFIGURED_NOTICE,
};

describe('loyalty programme contracts', () => {
  it('treats an empty, unverified programme as unconfigured', () => {
    expect(isProgrammeConfigured(emptyProgram)).toBe(false);
    expect(programmeNotice(emptyProgram)).toBe(PROGRAM_NOT_CONFIGURED_NOTICE);
  });

  it('does not treat a verified status with no stored version as configured', () => {
    expect(
      isProgrammeConfigured({
        ...emptyProgram,
        verificationStatus: 'VERIFIED',
      }),
    ).toBe(false);
  });

  it('only reports configured when versioned rules are verified', () => {
    expect(
      isProgrammeConfigured({
        ...emptyProgram,
        version: 1,
        verificationStatus: 'VERIFIED',
      }),
    ).toBe(true);
  });

  it('keeps superseded programmes visibly unconfigured', () => {
    const superseded: ProgramConfigSummary = {
      ...emptyProgram,
      version: 2,
      verificationStatus: 'SUPERSEDED',
    };
    expect(isProgrammeConfigured(superseded)).toBe(false);
    expect(programmeNotice(superseded)).toBe(PROGRAM_NOT_CONFIGURED_NOTICE);
  });
});
