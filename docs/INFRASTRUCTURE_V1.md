# Damalibr Infrastructure V1

| Service | Responsibility | V1 |
|---|---|---|
| Supabase | PostgreSQL/Auth/RLS | Yes |
| Cloudflare | DNS/CDN/WAF | Yes |
| Cloudflare R2 | Images/audio/video/files | Yes |
| Redis | Queue backend | Yes |
| BullMQ | Job orchestration | Yes |
| Worker VM/container | Heavy processing | Yes |
| FFmpeg | Render/transcode/export | Yes |
| Resend | Transactional email | Yes |
| Stripe | Payments/subscriptions | Yes |
| Sentry | Errors/observability | Yes |
| Docker | Runtime packaging | Yes |
| GitHub Actions | CI/CD | Yes |
| GPU/CUDA | Local AI inference | Later |
| Kubernetes | Orchestration | Later |

## Runtime topology
Browser/Capacitor -> Cloudflare -> API -> Supabase.
Long work: API -> BullMQ/Redis -> Worker -> AI providers/FFmpeg -> R2 -> job progress.
Email: API/Worker -> Resend.

The API never waits for a long render. A job ID is returned immediately and the client subscribes/polls for progress.

## Environment variables
Server-only secrets:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- REDIS_URL
- R2_ENDPOINT
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET
- RESEND_API_KEY
- EMAIL_FROM
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- SENTRY_DSN

Public client configuration remains limited to VITE_* values that are safe to expose.
