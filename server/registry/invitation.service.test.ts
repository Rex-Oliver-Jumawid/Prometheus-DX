import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/env', () => ({
  serverEnvironment: {
    appUrl: 'https://prometheus.example.com',
    brevoApiKey: 'server-only-test-key',
    brevoSenderEmail: 'noreply@example.com',
    brevoSenderName: 'Prometheus',
  },
}));

import { BrevoInvitationService } from './invitation.service';

describe('BrevoInvitationService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends an account-setup link without exposing credentials in content', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new BrevoInvitationService();

    await service.sendAccountSetupInvitation({
      email: 'invited@example.com',
      fullName: 'Invited <Member>',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(request.headers).toMatchObject({
      'api-key': 'server-only-test-key',
    });
    const body = JSON.parse(String(request.body)) as {
      htmlContent: string;
      to: Array<{ email: string }>;
    };
    expect(body.to).toEqual([
      { email: 'invited@example.com', name: 'Invited <Member>' },
    ]);
    expect(body.htmlContent).toContain(
      'https://prometheus.example.com/account-setup?email=invited%40example.com',
    );
    expect(body.htmlContent).toContain('Invited &lt;Member&gt;');
    expect(body.htmlContent).not.toContain('server-only-test-key');
  });

  it('reports provider rejection without returning provider secrets or detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('provider detail', { status: 401 })),
    );
    const service = new BrevoInvitationService();

    await expect(
      service.sendAccountSetupInvitation({
        email: 'invited@example.com',
        fullName: 'Invited Member',
      }),
    ).rejects.toEqual(
      new ServiceUnavailableException(
        'The invitation could not be delivered. Try again.',
      ),
    );
  });
});
