# Damalibr execution roadmap

1. Security: private media, server-side entitlement checks, signed URLs.
2. Domain model: creator workspaces/projects/books/episodes/scenes/media/jobs/exports.
3. Queue: Redis + BullMQ adapter and persistent job state in Postgres.
4. Worker: Docker + FFmpeg with resumable jobs and progress reporting.
5. AI providers: text/image/voice/video interfaces and Gemini implementation.
6. Media library: versions, metadata, previews and lifecycle.
7. Creator Studio: project dashboard, episode editor, generation controls and job monitor.
8. Export Studio: YouTube 16:9, vertical 9:16, square 1:1, subtitles and downloadable MP4.
9. Optional Damalibr publishing: moderation/review and catalog publishing.
10. Email: Resend notifications for job completion, invitations and account events.
11. Billing: Stripe entitlements and creator plans.
12. Observability: Sentry + structured logs + worker metrics.
13. Native: Capacitor offline downloads using authorized download endpoints.
14. Scale: dedicated CPU workers, then optional GPU workers. Kubernetes only if operational scale actually requires it.

The creator workflow must remain usable even when Damalibr publishing is disabled. Export is a first-class product capability.
