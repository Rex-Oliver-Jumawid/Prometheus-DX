# Device work-session inactivity notifications

Prometheus delivers a native OS push banner after roughly 30 minutes of
**no interaction with the Prometheus web app** during an OPEN work session.
It does **not** measure inactivity across other phone apps or your entire OS.
The old in-page "Still working?" prompt has been removed.

## Device setup

Use **Notifications > Enable notifications** while signed in to register a
Web Push subscription. The browser must permit notifications; the OS may also
suppress banners through Focus, Do Not Disturb, or app-level settings.

For iPhone/iPad, open the deployed site in Safari, choose **Add to Home
Screen**, launch Prometheus from the Home Screen, and enable notifications
inside that installed web app. Normal Safari tabs on iPhone cannot register
the required Home Screen push subscription.

## Production server setup

1. Configure the existing `WEB_PUSH_VAPID_SUBJECT`,
   `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` in the backend.
2. Configure a strong, random `CRON_SECRET` on the API server.
3. Run the tracked Prisma migration
   `20261014090000_work_session_device_idle_push` **before deployment**.
4. Configure a trusted scheduler every **1-5 minutes** to issue:

   `GET https://<your-deployment>/api/work-sessions/idle-reminders/run`

   With header `Authorization: Bearer <CRON_SECRET>`.

This endpoint rejects requests if CRON_SECRET is absent or incorrect.
A repeated call is safe: each eligible open session is atomically claimed
and receives at most one reminder per idle spell; fresh activity re-arms it.
The endpoint checks up to 100 overdue sessions per invocation.

**Important:** Vercel Hobby permits built-in Cron Jobs only once per day,
so do not add a `*/5 * * * *` Vercel cron to `vercel.json` on Hobby.
Use an external scheduler or a Vercel Pro cron instead. Without a scheduler
the browser's own timer can display a banner while it is still running, but
a suspended/closed app cannot receive *scheduled* reminders.

When testing from localhost, browser permissions may differ from production.
Use the deployed HTTPS app for iPhone push testing.

A click on the banner opens `/schedule?view=shifts`.
