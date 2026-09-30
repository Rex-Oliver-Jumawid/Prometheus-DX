import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
} from 'node:crypto';

export type VapidConfig = { subject: string; publicKey: string; privateKey: string };
export type WebPushSubscription = { endpoint: string; p256dh: string; auth: string };
export type WebPushPayload = {
  notificationId: string;
  title: string;
  body: string;
  url: string;
  tag: string;
};

function decode(value: string, label: string) {
  const result = Buffer.from(value, 'base64url');
  if (!result.length) throw new Error(`Invalid ${label}.`);
  return result;
}

function hmac(key: Buffer, value: Buffer) {
  return createHmac('sha256', key).update(value).digest();
}

function vapidKey(config: VapidConfig) {
  const pub = decode(config.publicKey, 'VAPID public key');
  const priv = decode(config.privateKey, 'VAPID private key');
  if (pub.length !== 65 || pub[0] !== 4 || priv.length !== 32) {
    throw new Error('Invalid P-256 VAPID keypair.');
  }
  return createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: pub.subarray(1, 33).toString('base64url'),
      y: pub.subarray(33).toString('base64url'),
      d: priv.toString('base64url'),
    },
    format: 'jwk',
  });
}

export function createVapidAuthorization(
  endpoint: string,
  config: VapidConfig,
  now = Date.now(),
) {
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: config.subject,
  })).toString('base64url');
  const unsigned = `${header}.${claims}`;
  const signature = sign('sha256', Buffer.from(unsigned), {
    key: vapidKey(config),
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  return `vapid t=${unsigned}.${signature}, k=${config.publicKey}`;
}

export function encryptWebPushPayload(
  subscription: Pick<WebPushSubscription, 'p256dh' | 'auth'>,
  payload: string,
  options: { salt?: Buffer; senderPrivateKey?: Buffer } = {},
) {
  const receiver = decode(subscription.p256dh, 'push public key');
  const auth = decode(subscription.auth, 'push auth secret');
  if (receiver.length !== 65 || receiver[0] !== 4 || auth.length < 16) {
    throw new Error('Invalid push subscription keys.');
  }

  const sender = createECDH('prime256v1');
  if (options.senderPrivateKey) sender.setPrivateKey(options.senderPrivateKey);
  else sender.generateKeys();
  const senderPublic = sender.getPublicKey();
  const shared = sender.computeSecret(receiver);
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info'),
    Buffer.from([0]),
    receiver,
    senderPublic,
  ]);
  const ikm = hmac(hmac(auth, shared), Buffer.concat([keyInfo, Buffer.from([1])]));
  const salt = options.salt ?? randomBytes(16);
  if (salt.length !== 16) throw new Error('Web Push salt must be 16 bytes.');
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([
    Buffer.from('Content-Encoding: aes128gcm'),
    Buffer.from([0, 1]),
  ])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([
    Buffer.from('Content-Encoding: nonce'),
    Buffer.from([0, 1]),
  ])).subarray(0, 12);
  const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);
  if (plaintext.length + 16 >= 4096) throw new Error('Web Push payload is too large.');

  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const header = Buffer.alloc(21);
  salt.copy(header);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(senderPublic.length, 20);
  return Buffer.concat([header, senderPublic, encrypted]);
}

export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: WebPushPayload,
  config: VapidConfig,
) {
  let body: Buffer;
  let authorization: string;
  try {
    body = encryptWebPushPayload(subscription, JSON.stringify(payload));
    authorization = createVapidAuthorization(subscription.endpoint, config);
  } catch (error) {
    return {
      ok: false,
      stale: true,
      error: error instanceof Error ? error.message : 'Invalid push subscription.',
    };
  }

  try {
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '120',
        Urgency: 'normal',
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) return { ok: true, stale: false, error: null };
    return {
      ok: false,
      stale: response.status === 404 || response.status === 410,
      error: `Push service returned ${response.status}.`,
    };
  } catch (error) {
    return {
      ok: false,
      stale: false,
      error: error instanceof Error ? error.message : 'Push delivery failed.',
    };
  }
}
