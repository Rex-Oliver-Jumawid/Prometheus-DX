import { createECDH } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendWebPush } from './web-push';

describe('Web Push transport boundary', () => {
  afterEach(() => vi.unstubAllGlobals());
  function fixture(endpoint = 'https://fcm.googleapis.com/push/token') {
    const key = createECDH('prime256v1');
    key.generateKeys();
    return {
      subscription: {
        endpoint,
        p256dh: key.getPublicKey().toString('base64url'),
        auth: Buffer.alloc(16, 1).toString('base64url'),
      },
      config: {
        subject: 'mailto:test@example.com',
        publicKey: key.getPublicKey().toString('base64url'),
        privateKey: key.getPrivateKey().toString('base64url'),
      },
      payload: {
        notificationId: 'id',
        title: 'Title',
        body: 'body',
        url: '/',
        tag: 'id',
      },
    };
  }
  it('blocks legacy unsafe database endpoints before any network call', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const f = fixture('http://169.254.169.254/latest/meta-data');
    expect(
      await sendWebPush(f.subscription, f.payload, f.config),
    ).toMatchObject({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('disables redirects even for trusted providers', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetch);
    const f = fixture();
    await sendWebPush(f.subscription, f.payload, f.config);
    expect(fetch).toHaveBeenCalledWith(
      f.subscription.endpoint,
      expect.objectContaining({ redirect: 'error' }),
    );
  });
  it('does not delete a healthy subscription because of an oversized payload', async () => {
    const f = fixture();
    expect(
      await sendWebPush(
        f.subscription,
        { ...f.payload, body: 'x'.repeat(5000) },
        f.config,
      ),
    ).toMatchObject({ ok: false, stale: false });
  });
});
