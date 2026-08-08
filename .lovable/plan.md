# Vercel backend rollout — War On Nations

Ship the queued backend work as a Vercel-native serverless app inside this
same repo, so a `git push` to your connected GitHub repository triggers a
Vercel deploy. Frontend (TanStack Start client + routes) stays where it is;
only the server target and data layer change.

## Deployment shape

- Nitro build target flips from Cloudflare Workers to `vercel` — every
  `createServerFn` and server route becomes a Vercel serverless function.
  Local `vite dev` still works, and the Lovable preview keeps rendering.
- All secrets live in **Vercel → Project Settings → Environment Variables**.
  Lovable's secrets tool cannot populate the Vercel deployment; anything I
  add here must be added there too.
- Vercel Postgres is provisioned from the Vercel dashboard (Storage →
  Create → Postgres). Vercel injects `POSTGRES_URL` etc. automatically.

## Env vars you set in Vercel

| Name | Where it comes from | What it powers |
| --- | --- | --- |
| `POSTGRES_URL` | Vercel Postgres integration (auto) | DB access |
| `TELEGRAM_BOT_TOKEN` | @BotFather → your `@waronnationsgamebot` | initData HMAC verification, bot notifications, referral start-links |
| `SESSION_SECRET` | 64-char random string | Signed session JWTs |
| `PUBLIC_ORIGIN` | `https://waronnations.vercel.app` | Manifest, referral links, notification URLs |

The Telegram connector inside Lovable is fine for chatting with the bot
from the Lovable side, but Vercel runtime code needs the raw
`TELEGRAM_BOT_TOKEN` — there is no way to HMAC-verify `initData` without it.

## Phases

Each phase is a self-contained deploy. I'll pause between phases so you
can confirm the Vercel build is green before I stack the next one.

### Phase 1 — Vercel build + Telegram auth + user rows

- Switch Nitro preset to `vercel` and add `vercel.json` with region + Node
  runtime pinning.
- Add `@vercel/postgres` + `drizzle-orm` + `drizzle-kit`; commit initial
  schema for `users`, `sessions`, `referrals`.
- Server route `POST /api/public/telegram/login`: validates `initData`
  HMAC with `TELEGRAM_BOT_TOKEN`, upserts a `users` row keyed by Telegram
  ID, issues a signed session cookie. If a `?start=WAR-XXXX` referral code
  is present, records the referrer.
- Server fn `linkWallet` (auth required): stores the connected TON wallet
  address on the user row.
- Client boots by calling `/api/public/telegram/login` with the
  Mini App's `window.Telegram.WebApp.initData`; from then on every server
  fn call is authenticated as that user.

### Phase 2 — Server-authoritative progress + leaderboard

- `game_state` table (one row per user): glory, energy, `energy_updated_at`,
  streak, `last_daily_claim_at`, highest_tier, total_merges, wardog_tokens,
  warcat_tokens, roulette_spins, daily quests JSON, board JSON.
- Server fns for every state-changing action currently in `game-state.ts`:
  `syncBoard`, `commitMerge`, `spawnUnit`, `claimTask`, `claimDailyQuest`,
  `claimDaily`, `spinRoulette`, `recoverEnergy`.
  Energy regen is computed from `energy_updated_at` on read — no
  long-running processes; Vercel-safe.
- Anti-cheat: server re-runs the merge/spawn rules; the client can request
  an action but the server owns the reward math. Zod validation +
  per-user rate limits (in-memory LRU keyed by user id per function
  instance; strict limits on `commitMerge`, `spinRoulette`).
- Global leaderboard: `SELECT id, telegram_username, glory ... ORDER BY
  glory DESC LIMIT 100` behind a 10 s in-memory cache.
- `useGame` hook stops writing to `localStorage` and instead reads
  through TanStack Query; a small offline queue retries failed mutations.

### Phase 3 — Offline/idle progress

- On login, compute `now - state.updated_at`, cap at 8 h, and grant a
  configurable fraction of expected passive rewards (energy fully
  regenerated up to max, plus a small trickle of glory + tokens based on
  average merge rate). Delivered as a "Welcome back — while you were
  away…" modal on the client.

### Phase 4 — Shop

- `shop_items` table + server fn `purchaseShopItem`. Items:
  energy pack (spend $WARDOG for +100⚡), 2× glory buff (2 h), extra spins.
  Costs stored server-side; balances debited atomically.
- Shop tab in the UI with the same military styling.

### Phase 5 — Verified referrals + milestones + bot notifications

- Referrals become server-verified: on login, if the joining user has
  never been referred and the `start` payload matches a real user's
  referral code, insert a `referrals` row and increment the referrer's
  count.
- Milestone rewards at 1 / 5 / 10 / 25 invites (glory + tokens + spins),
  claimed via a server fn once the count crosses each threshold.
- Bot notifications through the Lovable Telegram connector gateway:
  energy full, daily bonus ready, new referral joined, referral milestone
  reached. Users can opt out via a preference on the profile page.
- Referral share button generates
  `https://t.me/waronnationsgamebot?start=<referral_code>`.

### Phase 6 — First-time tutorial + starter rewards

- One-time flag on the user row. On first login, deliver: 25⚡ starter
  boost, 1 extra spin, 100 glory, and a 4-step tutorial overlay (deploy,
  merge, claim daily, spin) with skip on final step.

## Where I need you

- **Now:** add `TELEGRAM_BOT_TOKEN` and `SESSION_SECRET` to Vercel
  environment variables and hit *Redeploy* after Phase 1 lands. Provision
  Vercel Postgres and confirm the connection is live. I'll list the exact
  env keys and the migration command in the Phase 1 message.
- **Between phases:** confirm the previous phase deploys and works in the
  Telegram Mini App before I ship the next.

If any of the phase boundaries feel wrong — reorder or drop — say so and
I'll adjust before writing code.
