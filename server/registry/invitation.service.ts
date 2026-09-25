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

const BREVO_REQUEST_TIMEOUT_MS = 5_000;
const INVITATION_DELIVERY_FAILURE_MESSAGE =
  'The invitation could not be delivered. Try again.';

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
    if (serverEnvironment.invitationDeliveryMode === 'disabled') {
      throw new ServiceUnavailableException(
        INVITATION_DELIVERY_FAILURE_MESSAGE,
      );
    }

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
    const safeLogoUrl = escapeHtml(
      new URL('/auth/prometheus-mark.png', appUrl).toString(),
    );

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      BREVO_REQUEST_TIMEOUT_MS,
    );

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
            <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#2b2522;">
              <div style="max-width:560px;margin:0 auto;padding:32px 24px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;border-collapse:collapse;">
                  <tr>
                    <td width="48" valign="middle" style="width:48px;vertical-align:middle;">
                      <img src="${safeLogoUrl}" width="48" height="48" alt="Prometheus" style="display:block;width:48px;height:48px;border:0;border-radius:12px;">
                    </td>
                    <td valign="middle" style="padding-left:12px;vertical-align:middle;">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:26px;font-weight:700;color:#2b2522;">Prometheus</div>
                      <div style="margin-top:3px;font-size:8px;line-height:10px;font-weight:700;letter-spacing:3px;color:#8d7f78;">VIRTUAL OFFICE</div>
                    </td>
                  </tr>
                </table>
                <div style="margin:0 0 10px;font-size:10px;line-height:14px;font-weight:700;letter-spacing:3px;color:#d34b1f;">ACCOUNT SETUP</div>
                <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:38px;font-weight:700;letter-spacing:-0.5px;color:#2b2522;">Welcome to Prometheus</h1>
                <p style="margin:0 0 12px;font-size:16px;line-height:24px;">Hello ${safeName},</p>
                <p style="margin:0 0 22px;font-size:16px;line-height:24px;">An administrator has authorized your Prometheus membership. Set up your account using the invited email address.</p>
                <p style="margin:0 0 22px;">
                  <a href="${safeSetupUrl}" style="display:inline-block;background:#d34b1f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:9px;font-size:15px;line-height:20px;font-weight:700;">Set up account</a>
                </p>
                <p style="margin:0;font-size:14px;line-height:21px;color:#6f625c;">Your account will be linked to your existing Prometheus member record.</p>
              </div>
            </div>
          `,
        }),
        signal: controller.signal,
      });
    } catch {
      throw new ServiceUnavailableException(
        INVITATION_DELIVERY_FAILURE_MESSAGE,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        INVITATION_DELIVERY_FAILURE_MESSAGE,
      );
    }
  }
}

@Injectable()
export class DisabledInvitationService implements InvitationDelivery {
  async sendAccountSetupInvitation(
    invitation: AccountSetupInvitation,
  ): Promise<void> {
    void invitation;
    throw new ServiceUnavailableException(INVITATION_DELIVERY_FAILURE_MESSAGE);
  }
}
