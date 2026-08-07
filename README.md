# War On Nations — Merge Game

Telegram Mini App merge game.
Fuse WARDOG & WARCAT units, earn tokens, climb ranks, claim countries, and compete in Nations.

**Live:** https://waronnations.lovable.app

## Tech Stack

- TanStack Start + React 19 + TypeScript
- Tailwind CSS 4 + Radix UI + Framer Motion
- Neon Postgres (serverless)
- Telegram WebApp auth + TON Connect
- Sentry (error monitoring) + PostHog (analytics)
- Zod validation + server-authoritative economy

## Local Development

```bash
npm install
npm run dev
```

The app runs as a normal web app in dev, but Telegram-specific auth flows
require opening it through a Telegram Mini App / BotFather Web App link to
get real `initData`.

## Environment Variables

| Variable                    | Scope        | Required | Notes                                                                 |
|------------------------------|--------------|----------|------------------------------------------------------------------------|
| `DATABASE_URL`               | Server       | Yes      | Neon Postgres connection string                                       |
| `POSTGRES_URL`                | Server       | No       | Fallback if `DATABASE_URL` is unset                                    |
| `POSTGRES_URL_NON_POOLING`    | Server       | No       | Fallback connection string                                             |
| `DATABASE_URL_UNPOOLED`       | Server       | No       | Fallback connection string                                             |
| `TELEGRAM_BOT_TOKEN`         | Server       | Yes      | From @BotFather, used to verify Telegram `initData` and send bot messages |
| `SESSION_SECRET`             | Server       | Yes      | ≥ 32 random characters, signs session cookies                          |
| `ADMIN_WALLETS`              | Server       | No       | Comma-separated TON wallet addresses granted admin access              |
| `CRON_SECRET`                | Server       | No       | Shared secret required to trigger scheduled/cron endpoints             |
| `SENTRY_DSN`                 | Server       | No       | Server-side Sentry error monitoring DSN                                |
| `VITE_SENTRY_DSN`            | Build (client) | No     | Client-side Sentry error monitoring DSN                                |
| `VITE_POSTHOG_KEY`           | Build (client) | No     | PostHog project API key for analytics                                  |
| `VITE_POSTHOG_HOST`          | Build (client) | No     | PostHog ingestion host (defaults to PostHog Cloud)                      |
| `VITE_TON_NETWORK`           | Build (client) | No     | `mainnet` or `testnet`, selects the TON network the client targets     |
| `TON_NETWORK`                | Server       | No       | `mainnet` or `testnet`, selects the TON network the server verifies against |
| `VITE_TON_TREASURY_ADDRESS`  | Build (client) | No     | TON treasury wallet address shown to the client for payments           |
| `TON_TREASURY_ADDRESS`       | Server       | No       | TON treasury wallet address used server-side to verify incoming payments |
| `TON_API_KEY`                | Server       | No       | API key for the TON indexer (tonapi.io) used to verify payments and read live treasury jetton balances |
| `VITE_TON_PAYMENTS_ENABLED`  | Build (client) | No     | Feature flag; when unset/false the client runs TON payments in mock mode |
| `CLAIM_ONCHAIN_LIVE`         | Server       | No       | `true` enables on-chain claim signing/payouts                            |
| `CLAIM_TREASURY_ADDRESS`     | Server       | No       | Deployed ClaimTreasury contract address                                 |
| `VITE_CLAIM_TREASURY_ADDRESS`| Build (client) | No     | Same address, exposed to the client for the claim transaction            |
| `CLAIM_SIGNER_PRIVATE_KEY`   | Server       | No       | Ed25519 private key signing claim authorizations (secret)               |
| `CLAIM_SIGNER_PUBLIC_KEY`    | Server       | No       | Matching public key, verified by the contract                            |
| `VITE_CLAIM_SIGNER_PUBLIC_KEY`| Build (client) | No    | Public key surfaced to the client for display/validation                |
| `OWNER_MNEMONIC`             | Scripts only | No       | Deploy-script wallet mnemonic; never set in the app runtime             |
| `TREASURY_MOCK_WARDOG`       | Server       | No       | Dev-only override for the live $WARDOG treasury balance read            |
| `TREASURY_MOCK_WARCAT`       | Server       | No       | Dev-only override for the live $WARCAT treasury balance read            |
| `NODE_ENV`                   | Server       | Auto     | Set automatically by the hosting platform                              |

`VITE_*` variables are inlined into the client bundle at build time; all
other variables are server-only and must never be exposed to the client.

## Health Check

`GET /api/public/health` returns `200` when the app is serving traffic and
`503` when a hard dependency is broken. The payload reports database
connectivity, Telegram bot configuration, session-secret strength, live
on-chain treasury reachability (including whether dev overrides are active),
and whether Sentry/PostHog are wired.


## Architecture Overview

- **Routes** (`src/routes/`): file-based TanStack Start routes. Content
  routes each declare their own `head()` for SEO/social metadata. Server
  routes live under `src/routes/api/` and export `server.handlers`.
- **Server functions & `.server.ts` boundary**: any module ending in
  `.server.ts` only ever runs on the server (Neon connections, Telegram
  bot token, session secrets). Client code calls into it via TanStack
  `createServerFn` or server route handlers — never by importing it
  directly.
- **Database**: Neon serverless Postgres, accessed through
  `src/lib/db.server.ts` (`hasDatabase()` / `sql`). Schema changes are
  additive only (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- **Economy**: all economy-affecting actions (shop purchases, energy
  recovery, daily claims, quests, nukes, token claims) are
  server-authoritative — the client never mutates balances directly.
- **Anti-cheat reconciliation**: server-side checks compare submitted
  client state against server records and game rules before accepting
  progress, rejecting or flagging implausible jumps.
- **Treasury**: dynamic taxes and fees collected in-game are recorded as
  pending deposits owed to the Claim Treasury, settled on-chain once
  token payouts are live.

## How TON Payments Work

1. The player connects a TON wallet in the Mini App via TON Connect.
2. The client requests a payment intent from the server for the action
   they want to pay for; the server creates a pending intent with a
   unique payment comment/memo tied to that player and action.
3. The player's wallet sends a TON transaction to the treasury address
   with that comment attached.
4. The server verifies the transaction on-chain via a TON indexer
   (matching amount, destination treasury address, and comment) before
   marking the intent as paid.
5. Once verified, the intent is consumed exactly once to unlock the
   paid action — payments are final and cannot be replayed.

If no treasury address is configured (`VITE_TON_TREASURY_ADDRESS` /
`TON_TREASURY_ADDRESS` unset, or `VITE_TON_PAYMENTS_ENABLED` is false),
the client falls back to a mock payment mode for local development and
demos, with no real on-chain transaction required.

## Deployment

See [`VERCEL.md`](./VERCEL.md) for the full deployment guide, including
the required environment variables and build settings.
