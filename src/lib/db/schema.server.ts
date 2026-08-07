/**
 * War On Nations — schema bootstrap (server-only).
 * Additive schema only. Existing tables and data are never broken.
 */

import { sql } from "./client.server";

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      // ─── USERS ───────────────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id                BIGSERIAL PRIMARY KEY,
          telegram_id       BIGINT UNIQUE NOT NULL,
          username          TEXT,
          first_name        TEXT,
          last_name         TEXT,
          photo_url         TEXT,
          language_code     TEXT,
          wallet_address    TEXT,
          referral_code     TEXT UNIQUE NOT NULL,
          referred_by       BIGINT REFERENCES users(id),
          nation_id         BIGINT,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_login_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_milestones_claimed INT NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nation_id BIGINT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_traitor BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS traitor_since TIMESTAMPTZ`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS traitor_reason TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_terrorist BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`CREATE INDEX IF NOT EXISTS users_referral_code_idx ON users (referral_code)`;
      await sql`CREATE INDEX IF NOT EXISTS users_referred_by_idx  ON users (referred_by)`;
      await sql`CREATE INDEX IF NOT EXISTS users_nation_idx ON users (nation_id)`;
      await sql`CREATE INDEX IF NOT EXISTS users_traitor_idx ON users (is_traitor) WHERE is_traitor = TRUE`;
      await sql`CREATE INDEX IF NOT EXISTS users_terrorist_idx ON users (is_terrorist) WHERE is_terrorist = TRUE`;
      await sql`CREATE INDEX IF NOT EXISTS users_admin_idx ON users (is_admin) WHERE is_admin = TRUE`;
      await sql`CREATE INDEX IF NOT EXISTS users_banned_idx ON users (is_banned) WHERE is_banned = TRUE`;
      await sql`CREATE INDEX IF NOT EXISTS users_wallet_idx ON users (wallet_address) WHERE wallet_address IS NOT NULL`;

      // ─── PROGRESS ────────────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS progress (
          user_id           BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          glory             BIGINT NOT NULL DEFAULT 0,
          total_merges      BIGINT NOT NULL DEFAULT 0,
          highest_tier      INT    NOT NULL DEFAULT 1,
          wardog_tokens     NUMERIC(20,4) NOT NULL DEFAULT 0,
          warcat_tokens     NUMERIC(20,4) NOT NULL DEFAULT 0,
          state             JSONB  NOT NULL DEFAULT '{}'::jsonb,
          last_sync_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS progress_glory_idx ON progress (glory DESC)`;
      await sql`ALTER TABLE progress ADD COLUMN IF NOT EXISTS claimed_wardog NUMERIC(20,4) NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE progress ADD COLUMN IF NOT EXISTS claimed_warcat NUMERIC(20,4) NOT NULL DEFAULT 0`;

      // ─── TREASURY DEPOSITS ───────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS treasury_deposits (
          id            BIGSERIAL PRIMARY KEY,
          user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
          source        TEXT NOT NULL,
          wardog        NUMERIC(20,4) NOT NULL DEFAULT 0,
          warcat        NUMERIC(20,4) NOT NULL DEFAULT 0,
          base_amount   NUMERIC(20,4) NOT NULL DEFAULT 0,
          multiplier    NUMERIC(10,4) NOT NULL DEFAULT 1,
          status        TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','settled','void')),
          details       JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS treasury_deposits_status_idx ON treasury_deposits (status, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS treasury_deposits_user_idx ON treasury_deposits (user_id, created_at DESC)`;

      // ─── NOTIFICATIONS ───────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS notifications (
          id            BIGSERIAL PRIMARY KEY,
          user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          telegram_id   BIGINT NOT NULL,
          kind          TEXT   NOT NULL,
          text          TEXT   NOT NULL,
          due_at        TIMESTAMPTZ NOT NULL,
          sent          BOOLEAN NOT NULL DEFAULT FALSE,
          sent_at       TIMESTAMPTZ,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS notifications_due_idx ON notifications (sent, due_at)`;
      await sql`CREATE INDEX IF NOT EXISTS notifications_user_kind_idx ON notifications (user_id, kind) WHERE sent = FALSE`;

      // ─── SHOP LEDGER ─────────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS shop_ledger (
          id            BIGSERIAL PRIMARY KEY,
          user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          item_id       TEXT   NOT NULL,
          cost          NUMERIC(12,4) NOT NULL,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS shop_ledger_user_idx ON shop_ledger (user_id, created_at DESC)`;

      // ─── CLAIMS ──────────────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS claims (
          id              BIGSERIAL PRIMARY KEY,
          user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token           TEXT   NOT NULL CHECK (token IN ('wardog','warcat')),
          amount          NUMERIC(20,4) NOT NULL CHECK (amount > 0),
          status          TEXT   NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','sent','failed','refunded')),
          wallet_address  TEXT   NOT NULL,
          tx_hash         TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS claims_user_idx ON claims (user_id, created_at DESC)`;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS claims_one_pending_per_token
          ON claims (user_id, token) WHERE status = 'pending'
      `;

      // On-chain claim authorization fields (additive)
      await sql`ALTER TABLE claims ADD COLUMN IF NOT EXISTS nonce TEXT`;
      await sql`ALTER TABLE claims ADD COLUMN IF NOT EXISTS deadline BIGINT`;
      await sql`ALTER TABLE claims ADD COLUMN IF NOT EXISTS signature_hex TEXT`;
      await sql`ALTER TABLE claims ADD COLUMN IF NOT EXISTS onchain_status TEXT`;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS claims_nonce_uidx
          ON claims (nonce) WHERE nonce IS NOT NULL
      `;

      // ─── NATIONS ─────────────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS nations (
          id              BIGSERIAL PRIMARY KEY,
          name            TEXT NOT NULL,
          tag             TEXT NOT NULL UNIQUE,
          emblem          TEXT NOT NULL DEFAULT '⚔',
          leader_id       BIGINT REFERENCES users(id),
          is_default      BOOLEAN NOT NULL DEFAULT FALSE,
          total_glory     BIGINT NOT NULL DEFAULT 0,
          member_count    INT NOT NULL DEFAULT 0,
          listed_price    NUMERIC(12,4),
          listed_at       TIMESTAMPTZ,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS listed_price NUMERIC(12,4)`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS listed_at TIMESTAMPTZ`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS first_claimed_at TIMESTAMPTZ`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS original_claimer_id BIGINT REFERENCES users(id)`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS vault_wardog NUMERIC(20,4) NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS vault_warcat NUMERIC(20,4) NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS active_buff TEXT`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS buff_expires_at TIMESTAMPTZ`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS reputation INT NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS last_nuke_launched_at TIMESTAMPTZ`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS last_nuke_received_at TIMESTAMPTZ`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS protection_expires_at TIMESTAMPTZ`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS join_contribution_wardog NUMERIC(20,4) NOT NULL DEFAULT 2`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS join_contribution_warcat NUMERIC(20,4) NOT NULL DEFAULT 2`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS redemption_price_wardog NUMERIC(20,4) NOT NULL DEFAULT 15`;
      await sql`ALTER TABLE nations ADD COLUMN IF NOT EXISTS redemption_price_warcat NUMERIC(20,4) NOT NULL DEFAULT 15`;

      await sql`CREATE INDEX IF NOT EXISTS nations_tag_idx ON nations (tag)`;
      await sql`CREATE INDEX IF NOT EXISTS nations_glory_idx ON nations (total_glory DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS nations_listed_idx ON nations (listed_price) WHERE listed_price IS NOT NULL`;
      await sql`CREATE INDEX IF NOT EXISTS nations_reputation_idx ON nations (reputation DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS nations_protected_idx ON nations (is_protected) WHERE is_protected = TRUE`;

      await sql`
        INSERT INTO nations (name, tag, emblem, is_default)
        SELECT 'WARDOG Nation', 'DOG', 'dog', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM nations WHERE tag = 'DOG')
      `;
      await sql`
        INSERT INTO nations (name, tag, emblem, is_default)
        SELECT 'WARCAT Nation', 'CAT', 'cat', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM nations WHERE tag = 'CAT')
      `;

      // ─── NATION MEMBERS ──────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS nation_members (
          nation_id       BIGINT NOT NULL REFERENCES nations(id) ON DELETE CASCADE,
          user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role            TEXT NOT NULL DEFAULT 'member'
                            CHECK (role IN ('leader','officer','member')),
          joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          weekly_glory    BIGINT NOT NULL DEFAULT 0,
          PRIMARY KEY (nation_id, user_id)
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS nation_members_user_idx ON nation_members (user_id)`;

      // ─── NATION WEEKLY ───────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS nation_weekly (
          nation_id       BIGINT NOT NULL REFERENCES nations(id) ON DELETE CASCADE,
          week_start      DATE NOT NULL,
          glory           BIGINT NOT NULL DEFAULT 0,
          PRIMARY KEY (nation_id, week_start)
        )
      `;

      // ─── NATION HISTORY ──────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS nation_history (
          id              BIGSERIAL PRIMARY KEY,
          nation_id       BIGINT NOT NULL REFERENCES nations(id) ON DELETE CASCADE,
          user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
          event           TEXT NOT NULL DEFAULT 'event',
          details         JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE nation_history ADD COLUMN IF NOT EXISTS user_id BIGINT`;
      await sql`ALTER TABLE nation_history ADD COLUMN IF NOT EXISTS event TEXT`;
      await sql`ALTER TABLE nation_history ADD COLUMN IF NOT EXISTS details JSONB`;
      await sql`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = 'nation_history'
              AND column_name  = 'event_type'
          ) THEN
            UPDATE nation_history
            SET event = event_type
            WHERE (event IS NULL OR event = '' OR event = 'event')
              AND event_type IS NOT NULL
              AND event_type <> '';
            BEGIN
              ALTER TABLE nation_history ALTER COLUMN event_type DROP NOT NULL;
            EXCEPTION WHEN undefined_column THEN
              NULL;
            END;
          END IF;
        END $$;
      `;
      await sql`
        UPDATE nation_history
        SET event = 'event'
        WHERE event IS NULL OR event = ''
      `;
      await sql`
        DO $$
        BEGIN
          ALTER TABLE nation_history ALTER COLUMN event SET DEFAULT 'event';
          ALTER TABLE nation_history ALTER COLUMN event SET NOT NULL;
        EXCEPTION WHEN others THEN
          NULL;
        END $$;
      `;
      await sql`CREATE INDEX IF NOT EXISTS nation_history_nation_idx ON nation_history (nation_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS nation_history_event_idx ON nation_history (event, created_at DESC)`;

      // ─── SEASONS ─────────────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS seasons (
          id              BIGSERIAL PRIMARY KEY,
          name            TEXT NOT NULL,
          starts_at       TIMESTAMPTZ NOT NULL,
          ends_at         TIMESTAMPTZ NOT NULL,
          is_active       BOOLEAN NOT NULL DEFAULT FALSE
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS seasonal_scores (
          season_id       BIGINT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
          user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          glory           BIGINT NOT NULL DEFAULT 0,
          highest_tier    INT NOT NULL DEFAULT 1,
          PRIMARY KEY (season_id, user_id)
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS seasonal_scores_glory_idx ON seasonal_scores (season_id, glory DESC)`;

      // ─── BADGES ──────────────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS user_badges (
          user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          badge_id        TEXT NOT NULL,
          earned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, badge_id)
        )
      `;

      // ─── ADMIN AUDIT LOG ─────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS admin_audit_log (
          id              BIGSERIAL PRIMARY KEY,
          admin_wallet    TEXT NOT NULL,
          admin_user_id   BIGINT REFERENCES users(id),
          action          TEXT NOT NULL,
          target_type     TEXT,
          target_id       TEXT,
          details         JSONB NOT NULL DEFAULT '{}'::jsonb,
          reason          TEXT,
          ip              TEXT,
          user_agent      TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS admin_audit_log_wallet_idx ON admin_audit_log (admin_wallet)`;
      await sql`CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON admin_audit_log (action)`;
      await sql`CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON admin_audit_log (target_type, target_id)`;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

