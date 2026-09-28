# Damalibr Creator Platform

Damalibr is both a creator production studio and a consumer app. A creator is never required to publish content inside Damalibr: every generated project can be exported as a normal media package for YouTube, TikTok, Instagram, Facebook or any other platform.

## Product surfaces
- Creator Studio: projects, stories, characters, episodes, scenes, scripts, media, audio, video, jobs and exports.
- Consumer App: discovery, playback, library and optional Damalibr publishing.
- Infrastructure: API, database, queues, workers, AI providers, media storage, email, payments and observability.

## Production flow
Idea -> Story -> Characters -> Episode -> Script -> Scenes -> Images -> Voice -> Video -> Subtitles -> Render -> Review -> Export.

Publishing to Damalibr is optional and is separate from export.

## Infrastructure contract
- Supabase: Postgres, Auth and RLS.
- Cloudflare: DNS/CDN/WAF and R2 media storage.
- Redis + BullMQ: asynchronous generation jobs.
- Docker: reproducible API/worker runtime.
- FFmpeg: deterministic media composition and export.
- AI provider adapters: text, image, voice and video providers behind stable interfaces.
- Resend: transactional email.
- Stripe: billing and creator/consumer entitlements.
- Sentry: frontend/API/worker error monitoring.
- GitHub Actions: CI/CD.

GPU/CUDA/Kubernetes are intentionally deferred. The architecture allows a future GPU worker without changing the creator-facing API.

## Export-first rule
The canonical output of a project is a versioned media asset. The creator owns the ability to export it. Damalibr publication is an optional distribution target, not a prerequisite for production.

## Security rule
Premium media must never depend on client-side checks alone. Store private storage keys, authorize access on the server, and issue short-lived media access URLs. Public catalog rows must not expose permanent private-media URLs.
