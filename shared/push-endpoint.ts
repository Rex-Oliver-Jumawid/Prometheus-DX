export function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname;
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      (host === 'fcm.googleapis.com' ||
        host === 'updates.push.services.mozilla.com' ||
        host === 'web.push.apple.com' ||
        (host.endsWith('.notify.windows.com') && host !== 'notify.windows.com'))
    );
  } catch {
    return false;
  }
}
