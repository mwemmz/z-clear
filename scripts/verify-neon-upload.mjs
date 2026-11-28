import { Files } from 'files-sdk';
import { neon } from 'files-sdk/neon';

const bucket = 'uploads';
const key = 'verification/zclear-upload-proof.txt';
const contents = [
  'Z Clear Neon Object Storage proof',
  `Created: ${new Date().toISOString()}`,
  'Synthetic demo data only. No customer or customs data.',
  '',
].join('\n');

const files = new Files({ adapter: neon({ bucket }) });

try {
  const uploaded = await files.upload(key, contents, {
    contentType: 'text/plain; charset=utf-8',
  });
  console.log('Uploaded object:', uploaded.key, `(${uploaded.size} bytes)`);

  const listed = await files.list({ prefix: 'verification/' });
  console.log('Bucket listing:');
  for (const item of listed.items) {
    console.log(`- ${item.key} (${item.size} bytes, ${item.contentType})`);
  }

  const downloaded = await files.download(key);
  const readBack = await downloaded.text();
  console.log('Read-back contents:');
  console.log(readBack);

  if (readBack !== contents) {
    throw new Error('Read-back contents did not match the uploaded text.');
  }
  if (!listed.items.some((item) => item.key === key)) {
    throw new Error('Uploaded key was not present in the bucket listing.');
  }

  console.log('Verified: uploaded, listed, and read back the same file.');
} catch (error) {
  console.error('Neon upload verification failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
