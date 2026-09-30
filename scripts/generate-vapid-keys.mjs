import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });
if (!publicJwk.x || !publicJwk.y || !privateJwk.d) throw new Error('Could not export generated P-256 keypair.');
const applicationServerKey = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(publicJwk.x, 'base64url'),
  Buffer.from(publicJwk.y, 'base64url'),
]).toString('base64url');
process.stdout.write([
  'WEB_PUSH_VAPID_SUBJECT=mailto:admin@example.com',
  `WEB_PUSH_VAPID_PUBLIC_KEY=${applicationServerKey}`,
  `WEB_PUSH_VAPID_PRIVATE_KEY=${privateJwk.d}`,
  '',
].join('\n'));
