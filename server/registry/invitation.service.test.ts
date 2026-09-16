import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/env', () => ({
  serverEnvironment: {
    appUrl: 'https://prometheus.example.com',
    brevoApiKey: 'server-only-test-key',
    brevoSenderEmail: 'noreply@example.com',
    brevoSenderName: 'Prometheus',
    invitationDeliveryMode: 'brevo',
  },
}));

import {
  BrevoInvitationService,
  DisabledInvitationService,
} from './invitation.service';
import { serverEnvironment } from '../config/env';

describe('BrevoInvitationService', () => {
  afterEach(() => {
    serverEnvironment.invitationDeliveryMode = 'brevo';
    vi.useRealTimers();
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

  it('reports network rejection without exposing provider detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('socket reset')),
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

  it('aborts a stalled provider request and returns only the safe failure', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, request: RequestInit) => {
        requestSignal = request.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener('abort', () => {
            reject(new Error('Brevo connection timeout detail'));
          });
        });
      }),
    );
    const service = new BrevoInvitationService();
    const delivery = service.sendAccountSetupInvitation({
      email: 'invited@example.com',
      fullName: 'Invited Member',
    });
    const expectedFailure = expect(delivery).rejects.toEqual(
      new ServiceUnavailableException(
        'The invitation could not be delivered. Try again.',
      ),
    );

    await vi.advanceTimersByTimeAsync(5_000);

    await expectedFailure;
    expect(requestSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fails immediately when delivery is disabled', async () => {
    const service = new DisabledInvitationService();

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

  it('does not reach Brevo when disabled mode resolves the Brevo provider', async () => {
    serverEnvironment.invitationDeliveryMode = 'disabled';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
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
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
