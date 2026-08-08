# Vercel Deployment Notes

## Environment Variables

Set these in the Vercel project settings → Environment Variables.
`VITE_*` variables are **build-time** (inlined into the client bundle);
everything else is **server-only** and must never be exposed to the
client.

| Name                        | Scope           | Required | Notes                                                                 |
|-----------------------------|------------------|----------|------------------------------------------------------------------------|
| `DATABASE_URL`               | Server-only      | Yes      | Neon connection string                                                 |
| `POSTGRES_URL`               | Server-only      | No       | Fallback if `DATABASE_URL` is unset                                    |
| `POSTGRES_URL_NON_POOLING`   | Server-only      | No       | Fallback connection string                                             |
| `DATABASE_URL_UNPOOLED`      | Server-only      | No       | Fallback connection string                                             |
| `TELEGRAM_BOT_TOKEN`         | Server-only      | Yes      | From @BotFather                                                        |
| `SESSION_SECRET`             | Server-only      | Yes      | ≥ 32 random characters                                                 |
| `ADMIN_WALLETS`              | Server-only      | No       | Comma-separated TON wallet addresses granted admin access              |
| `CRON_SECRET`                | Server-only      | No       | Shared secret required to trigger scheduled/cron endpoints             |
| `SENTRY_DSN`                 | Server-only      | No       | Server-side Sentry error monitoring DSN                                |
| `VITE_SENTRY_DSN`            | Build-time (VITE_) | No     | Client-side Sentry error monitoring DSN                                |
| `VITE_POSTHOG_KEY`           | Build-time (VITE_) | No     | PostHog project API key                                                |
| `VITE_POSTHOG_HOST`          | Build-time (VITE_) | No     | PostHog ingestion host                                                 |
| `TON_NETWORK`                | Server-only      | No       | `mainnet` or `testnet` for server-side verification                    |
| `VITE_TON_NETWORK`           | Build-time (VITE_) | No     | `mainnet` or `testnet` for the client                                  |
| `TON_TREASURY_ADDRESS`       | Server-only      | No       | Treasury wallet used server-side to verify incoming payments           |
| `VITE_TON_TREASURY_ADDRESS`  | Build-time (VITE_) | No     | Treasury wallet address shown to the client                            |
| `TON_API_KEY`                | Server-only      | No       | API key for the TON indexer used to verify on-chain payments           |
| `VITE_TON_PAYMENTS_ENABLED`  | Build-time (VITE_) | No     | Feature flag; unset/false runs the client in mock payment mode         |
| `NODE_ENV`                   | Server-only      | Auto     | Set automatically by Vercel                                            |

## Build Settings

- Framework Preset: Vite
- Build Command: `npm run build` (or leave default)
- Output Directory: `dist` (TanStack Start / Vite default)
- Install Command: `npm install`

## Domains

The production domain is already connected: `waronnations.lovable.app`

## Health Check

`GET /api/public/health` returns `{ ok, version, uptimeMs, db, time }` and
can be used for uptime monitoring. It never leaks connection strings or
stack traces.

## Notes

- Neon serverless works perfectly with Vercel's serverless functions.
- Telegram WebApp requires the production HTTPS domain to be added in BotFather → Web App.
- After changing env vars, redeploy the project.
