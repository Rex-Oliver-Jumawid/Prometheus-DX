import { describe, expect, it } from 'vitest';
import { isAllowedPushEndpoint } from './push-endpoint';
import { DevicePushSubscriptionSchema } from './contracts/notification';
describe('push endpoint boundary', () => {
  it.each([
    'http://fcm.googleapis.com/send/x',
    'https://127.0.0.1/x',
    'https://[::1]/x',
    'http://169.254.169.254/latest/meta-data',
    'https://fcm.googleapis.com.evil.test/x',
    'https://evil.test/fcm.googleapis.com',
    'https://user:pass@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:444/x',
    'https://fcm.googleapis.com/x#fragment',
  ])('rejects %s at the request boundary', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
    expect(
      DevicePushSubscriptionSchema.safeParse({
        endpoint,
        keys: { p256dh: 'key', auth: 'secret' },
      }).success,
    ).toBe(false);
  });
  it.each([
    'fcm.googleapis.com',
    'updates.push.services.mozilla.com',
    'web.push.apple.com',
    'wns2-db5p.notify.windows.com',
  ])('accepts provider %s', (host) => {
    expect(isAllowedPushEndpoint(`https://${host}/push/token`)).toBe(true);
  });
});
