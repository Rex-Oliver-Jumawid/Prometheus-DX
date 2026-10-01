import { useEffect, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { MutedChatsManager } from './MutedChatsManager';
import {
  disableCurrentDevicePush,
  enableDevicePush,
  getDevicePushState,
  type DevicePushState,
} from './device-push';

export function DevicePushControl() {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [state, setState] = useState<DevicePushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    void getDevicePushState(accessToken)
      .then((next) => {
        if (active) setState(next);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Device notification status could not be loaded.');
        }
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  if (!accessToken) return null;

  const refresh = async () => {
    const next = await getDevicePushState(accessToken);
    setState(next);
  };

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (state?.subscribed) {
        await disableCurrentDevicePush(accessToken);
      } else if (state?.applicationServerKey) {
        await enableDevicePush(accessToken, state.applicationServerKey);
      } else {
        throw new Error('Device notifications are not configured for this environment.');
      }
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Device notification settings could not be changed.',
      );
      try {
        await refresh();
      } catch {
        // Preserve the action error as the useful message.
      }
    } finally {
      setBusy(false);
    }
  };

  const unavailable = state && (!state.supported || !state.configured);
  const blocked = state?.permission === 'denied';
  const description = !state
    ? 'Checking this device...'
    : !state.supported
      ? 'This browser does not support standards-based Web Push.'
      : !state.configured
        ? 'Device notifications are not configured on this Prometheus environment yet.'
        : blocked
          ? 'Notifications are blocked in this browser. Re-enable them in the browser or system settings.'
          : state.subscribed
            ? 'This device can receive Prometheus notifications even when the web app is closed.'
            : 'Receive Prometheus mentions, review requests, and project updates on this device.';

  return (
    <section className="device-push-card" aria-labelledby="device-push-title">
      <div className="device-push-copy">
        <span className="device-push-eyebrow">DEVICE NOTIFICATIONS</span>
        <strong id="device-push-title">
          {state?.subscribed ? 'Notifications enabled' : 'Stay notified outside Prometheus'}
        </strong>
        <p>{description}</p>
        <small>
          On iPhone or iPad, add Prometheus to the Home Screen and open it there before enabling notifications.
        </small>
        {error && <span className="device-push-error" role="alert">{error}</span>}
      </div>
      <div className="device-push-actions">
        <MutedChatsManager accessToken={accessToken} />
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy || !state || Boolean(unavailable) || blocked}
        >
          {busy
            ? 'Updating...'
            : state?.subscribed
              ? 'Disable on this device'
              : 'Enable notifications'}
        </button>
      </div>
    </section>
  );
}
