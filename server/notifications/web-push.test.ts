import { describe, expect, it } from 'vitest';
import { encryptWebPushPayload } from './web-push';

describe('Web Push encryption', () => {
  it('matches the RFC 8291 aes128gcm example', () => {
    const encrypted = encryptWebPushPayload(
      {
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
        p256dh:
          'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      },
      'When I grow up, I want to be a watermelon',
      {
        salt: Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url'),
        senderPrivateKey: Buffer.from(
          'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
          'base64url',
        ),
      },
    );

    expect(encrypted.toString('base64url')).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    );
  });
});
