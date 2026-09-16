import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { serverEnvironment } from '../config/env';

export interface AccountSetupInvitation {
  email: string;
  fullName: string;
}

export interface InvitationDelivery {
  sendAccountSetupInvitation(invitation: AccountSetupInvitation): Promise<void>;
}

export const INVITATION_DELIVERY = Symbol('INVITATION_DELIVERY');

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

@Injectable()
export class BrevoInvitationService implements InvitationDelivery {
  async sendAccountSetupInvitation(
    invitation: AccountSetupInvitation,
  ): Promise<void> {
    const { appUrl, brevoApiKey, brevoSenderEmail, brevoSenderName } =
      serverEnvironment;
    if (!appUrl || !brevoApiKey || !brevoSenderEmail || !brevoSenderName) {
      throw new ServiceUnavailableException(
        'Invitation delivery is not configured.',
      );
    }

    const setupUrl = new URL('/account-setup', appUrl);
    setupUrl.searchParams.set('email', invitation.email);
    const safeName = escapeHtml(invitation.fullName);
    const safeSetupUrl = escapeHtml(setupUrl.toString());

    let response: Response;
    try {
      response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { email: brevoSenderEmail, name: brevoSenderName },
          to: [{ email: invitation.email, name: invitation.fullName }],
          subject: 'Set up your Prometheus account',
          htmlContent: `
            <div style="font-family:Arial,sans-serif;color:#26211f;line-height:1.6;max-width:560px;margin:auto">
              <h1 style="font-family:Georgia,serif;font-weight:500">Welcome to Prometheus</h1>
              <p>Hello ${safeName},</p>
              <p>An administrator has authorized your Prometheus membership. Use the link below to set up authentication with the invited email address.</p>
              <p style="margin:28px 0"><a href="${safeSetupUrl}" style="background:#cb4d22;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Set up account</a></p>
              <p>Authentication alone does not grant workspace access. Prometheus will link your authenticated identity to the existing authorized Member record.</p>
            </div>
          `,
        }),
      });
    } catch {
      throw new ServiceUnavailableException(
        'The invitation could not be delivered. Try again.',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'The invitation could not be delivered. Try again.',
      );
    }
  }
}
