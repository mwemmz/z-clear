import { connect, type Socket } from 'node:net';
import type { ScanInput, ScanProvider, ScanResult } from './scan.provider';

/**
 * ClamAV `INSTREAM` client. The daemon is external: when it is unreachable the
 * scan reports `failed`, which keeps the file locked (downloads stay blocked).
 * Nothing is silently treated as clean.
 */
export class ClamAvScanProvider implements ScanProvider {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs = 5_000,
  ) {}

  scan(input: ScanInput): Promise<ScanResult> {
    return new Promise((resolve) => {
      const socket: Socket = connect({ host: this.host, port: this.port });
      let settled = false;
      let buffer = '';

      const finish = (status: ScanResult['status'], detail?: string) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(detail ? { status, detail } : { status });
      };

      socket.setTimeout(this.timeoutMs, () => finish('failed'));
      socket.on('error', () => finish('failed'));
      socket.on('close', () => {
        if (buffer.length === 0) finish('failed');
      });
      socket.on('data', (chunk) => {
        buffer += chunk.toString('latin1');
        const terminator = buffer.indexOf('\0');
        if (terminator < 0) return;
        const response = buffer.slice(0, terminator).trim();
        if (/\bFOUND\b/i.test(response)) finish('infected');
        else if (/\bOK\b/i.test(response)) finish('clean');
        else finish('failed');
      });
      socket.on('connect', () => {
        socket.write(Buffer.from('zINSTREAM\0', 'latin1'));
        const chunkSize = 8 * 1024;
        for (let offset = 0; offset < input.body.length; offset += chunkSize) {
          const chunk = input.body.subarray(
            offset,
            Math.min(offset + chunkSize, input.body.length),
          );
          const header = Buffer.alloc(4);
          header.writeUInt32BE(chunk.length, 0);
          socket.write(header);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4)); // zero-length chunk ends the stream
      });
    });
  }
}
