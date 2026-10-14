export type ScanStatus = 'clean' | 'infected' | 'failed' | 'skipped';

export interface ScanInput {
  body: Buffer;
  contentType: string;
  fileName: string;
}

export interface ScanResult {
  status: ScanStatus;
}

/**
 * Malware scanning seam. A file is only downloadable once its status is
 * `clean` or `skipped`; `infected`, `failed` and `pending` block downloads.
 *
 * The default is a no-op that reports `skipped`, because no scanner is bundled.
 * Wiring a real scanner (e.g. ClamAV) as a background job before a file is
 * marked available is an explicit open item, not a silent default.
 */
export interface ScanProvider {
  scan(input: ScanInput): Promise<ScanResult>;
}

export const SCAN_PROVIDER = Symbol('SCAN_PROVIDER');

export class NoopScanProvider implements ScanProvider {
  async scan(_input: ScanInput): Promise<ScanResult> {
    return { status: 'skipped' };
  }
}
