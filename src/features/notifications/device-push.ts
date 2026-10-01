import {
  DevicePushConfigResponseSchema,
  DevicePushSubscriptionResponseSchema,
  type DevicePushSubscription,
} from '../../../shared/contracts/notification';
import { apiFetch } from '../../lib/api';

export type DevicePushState = {
  supported: boolean;
  configured: boolean;
  applicationServerKey: string | null;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
};

function supported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function decodeApplicationServerKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function toInput(subscription: PushSubscription): DevicePushSubscription {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error('This browser returned an incomplete push subscription.');
  }
  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}

export async function registerPushServiceWorker() {
  if (!supported()) return null;
  return navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });
}

async function config(accessToken: string) {
  return apiFetch(
    '/notifications/push/config',
    DevicePushConfigResponseSchema,
    { accessToken },
  );
}

async function syncSubscription(
  accessToken: string,
  subscription: PushSubscription,
) {
  return apiFetch(
    '/notifications/push/subscription',
    DevicePushSubscriptionResponseSchema,
    {
      accessToken,
      method: 'PUT',
      body: toInput(subscription),
    },
  );
}

export async function syncExistingDevicePush(accessToken: string) {
  if (!supported() || Notification.permission !== 'granted') return false;

  const pushConfig = await config(accessToken);
  if (!pushConfig.enabled) return false;

  const registration = await registerPushServiceWorker();
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;
  if (!subscription) return false;

  await syncSubscription(accessToken, subscription);
  return true;
}

export async function getDevicePushState(
  accessToken: string,
): Promise<DevicePushState> {
  if (!supported()) {
    return {
      supported: false,
      configured: false,
      applicationServerKey: null,
      permission: 'unsupported',
      subscribed: false,
    };
  }

  const pushConfig = await config(accessToken);
  const registration = await registerPushServiceWorker();
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  if (pushConfig.enabled && subscription && Notification.permission === 'granted') {
    await syncSubscription(accessToken, subscription);
  }

  return {
    supported: true,
    configured: pushConfig.enabled,
    applicationServerKey: pushConfig.applicationServerKey,
    permission: Notification.permission,
    subscribed: Boolean(subscription && Notification.permission === 'granted'),
  };
}

export async function enableDevicePush(
  accessToken: string,
  applicationServerKey: string,
) {
  if (!supported()) throw new Error('Device notifications are not supported by this browser.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked in your browser settings.'
        : 'Notification permission was not granted.',
    );
  }

  const registration = await registerPushServiceWorker();
  if (!registration) throw new Error('The Prometheus service worker could not be registered.');

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(applicationServerKey),
    }));

  await syncSubscription(accessToken, subscription);
}

export async function disableCurrentDevicePush(accessToken?: string) {
  if (!supported()) return;

  const registration = await registerPushServiceWorker();
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;
  if (!subscription) return;

  let apiError: unknown = null;
  if (accessToken) {
    try {
      await apiFetch(
        '/notifications/push/subscription',
        DevicePushSubscriptionResponseSchema,
        {
          accessToken,
          method: 'DELETE',
          body: toInput(subscription),
        },
      );
    } catch (error) {
      apiError = error;
    }
  }

  await subscription.unsubscribe();
  if (apiError) throw apiError;
}
