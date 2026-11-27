import { createServer, type Server } from 'node:net';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { ClamAvScanProvider } from './clamav-scan.provider';
import type { ScanInput } from './scan.provider';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function fakeClamd(reply: (body: Buffer) => string): Promise<{ host: string; port: number }> {
  const server = createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      const received = Buffer.concat(chunks);
      if (received.length < 4) return;
      // The INSTREAM terminator is a final zero-length chunk.
      if (received.readUInt32BE(received.length - 4) !== 0) return;
      socket.write(`${reply(received)}\0`);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { host: '127.0.0.1', port: (server.address() as AddressInfo).port };
}

const input: ScanInput = {
  body: Buffer.from('synthetic file content', 'utf8'),
  contentType: 'application/pdf',
  fileName: 'synthetic.pdf',
};

describe('ClamAvScanProvider', () => {
  it('reports clean when clamd replies OK', async () => {
    const clamd = await fakeClamd(() => 'stream: OK');
    const provider = new ClamAvScanProvider(clamd.host, clamd.port, 2_000);
    await expect(provider.scan(input)).resolves.toEqual({ status: 'clean' });
  });

  it('reports infected when clamd names a signature', async () => {
    const clamd = await fakeClamd(() => 'stream: Synthetic.Test.Signature FOUND');
    const provider = new ClamAvScanProvider(clamd.host, clamd.port, 2_000);
    await expect(provider.scan(input)).resolves.toEqual({ status: 'infected' });
  });

  it('fails closed when the daemon is unreachable', async () => {
    const provider = new ClamAvScanProvider('127.0.0.1', 1, 200);
    await expect(provider.scan(input)).resolves.toEqual({ status: 'failed' });
  });
});
