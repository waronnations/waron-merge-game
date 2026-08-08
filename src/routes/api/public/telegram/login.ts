import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ensureSchema, hasDatabase, sql } from "@/lib/db.server";
import { mutableSession } from "@/lib/session.server";
import { sendBotMessage } from "@/lib/notify.server";
import { flushDueNotifications } from "@/lib/notifications.server";
import { TelegramAuthError, verifyInitData } from "@/lib/telegram-auth.server";

const REFERRAL_CODE_RE = /^WAR-[A-Z0-9]{4,10}$/;

/** Instant glory granted to the referrer the moment a new recruit signs in. */
const INSTANT_REFERRER_GLORY = 250;
const INSTANT_REFERRER_WARDOG = 2;
const INSTANT_REFERRER_WARCAT = 2;

const BodySchema = z.object({
  initData: z.string().min(1),
  referralCode: z.string().optional(),
});

function makeReferralCode(): string {
  const alphabet = "ACDEFGHJKMNPQRTUVWXYZ2346789";
  for (let attempt = 0; attempt < 8; attempt++) {
    let code = "WAR-";
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }
  // ultra-safe fallback
  return `WAR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export const Route = createFileRoute("/api/public/telegram/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hasDatabase()) {
          return Response.json({ error: "database_not_configured" }, { status: 503 });
        }
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          return Response.json({ error: "telegram_not_configured" }, { status: 503 });
        }

        let payload: z.infer<typeof BodySchema>;
        try {
          payload = BodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }

        let verified;
        try {
          verified = verifyInitData(payload.initData, botToken);
        } catch (e) {
          const msg = e instanceof TelegramAuthError ? e.message : "invalid_initdata";
          return Response.json({ error: "invalid_initdata", detail: msg }, { status: 401 });
        }

        await ensureSchema();

        // Prefer explicit referralCode from client, fall back to start_param.
        // Normalize to uppercase so case differences never break attribution.
        const raw =
          payload.referralCode ??
          (verified.startParam && verified.startParam.length > 0
            ? verified.startParam
            : undefined);

        const startCode =
          raw && REFERRAL_CODE_RE.test(raw.toUpperCase().trim())
            ? raw.toUpperCase().trim()
            : undefined;

        let referredByUserId: number | null = null;
        let referrerTelegramId: number | null = null;

        if (startCode) {
          const referrer = await sql`
            SELECT id, telegram_id
            FROM users
            WHERE referral_code = ${startCode}
            LIMIT 1
          `;
          if (
            referrer.rows.length &&
            Number(referrer.rows[0].telegram_id) !== verified.user.id
          ) {
            referredByUserId = Number(referrer.rows[0].id);
            referrerTelegramId = Number(referrer.rows[0].telegram_id);
          }
        }

        const inserted = await sql`
          INSERT INTO users (
            telegram_id, username, first_name, last_name, photo_url, language_code,
            referral_code, referred_by, last_login_at
          )
          VALUES (
            ${verified.user.id},
            ${verified.user.username ?? null},
            ${verified.user.first_name ?? null},
            ${verified.user.last_name ?? null},
            ${verified.user.photo_url ?? null},
            ${verified.user.language_code ?? null},
            ${makeReferralCode()},
            ${referredByUserId},
            NOW()
          )
          ON CONFLICT (telegram_id) DO UPDATE SET
            username      = EXCLUDED.username,
            first_name    = EXCLUDED.first_name,
            last_name     = EXCLUDED.last_name,
            photo_url     = EXCLUDED.photo_url,
            language_code = EXCLUDED.language_code,
            last_login_at = NOW()
            -- referred_by is intentionally NEVER updated on existing users
          RETURNING id, telegram_id, username, first_name, last_name, photo_url,
                    wallet_address, referral_code, referred_by, created_at
        `;

        const row = inserted.rows[0];
        const userId = Number(row.id);
        const createdAt = row.created_at
          ? new Date(row.created_at as string).getTime()
          : 0;
        // 60-second window is safer against clock skew / cold starts
        const isNewUser = Date.now() - createdAt < 60_000;

        // Instant referrer reward + bot notification (only on true first signup)
        if (isNewUser && referredByUserId && referrerTelegramId) {
          const who = row.username
            ? `@${row.username}`
            : ((row.first_name as string | null) ?? "A new recruit");

          // Ensure referrer has a progress row
          await sql`
            INSERT INTO progress (user_id, state)
            VALUES (${referredByUserId}, '{}'::jsonb)
            ON CONFLICT (user_id) DO NOTHING
          `;

          const progRes = await sql`
            SELECT glory, wardog_tokens, warcat_tokens, state
            FROM progress
            WHERE user_id = ${referredByUserId}
            LIMIT 1
          `;

          if (progRes.rows[0]) {
            const p = progRes.rows[0];
            const st = (p.state ?? {}) as Record<string, unknown>;
            const newState = {
              ...st,
              glory: Number(st.glory ?? p.glory ?? 0) + INSTANT_REFERRER_GLORY,
              wardogTokens:
                Number(st.wardogTokens ?? p.wardog_tokens ?? 0) + INSTANT_REFERRER_WARDOG,
              warcatTokens:
                Number(st.warcatTokens ?? p.warcat_tokens ?? 0) + INSTANT_REFERRER_WARCAT,
            };

            await sql`
              UPDATE progress
              SET
                glory          = ${Number(p.glory) + INSTANT_REFERRER_GLORY},
                wardog_tokens  = ${Number(p.wardog_tokens) + INSTANT_REFERRER_WARDOG},
                warcat_tokens  = ${Number(p.warcat_tokens) + INSTANT_REFERRER_WARCAT},
                state          = ${JSON.stringify(newState)}::jsonb,
                last_sync_at   = NOW(),
                updated_at     = NOW()
              WHERE user_id = ${referredByUserId}
            `;
          }

          void sendBotMessage(
            referrerTelegramId,
            `New recruit just joined your pack!\n` +
              `+${INSTANT_REFERRER_GLORY} Glory · +${INSTANT_REFERRER_WARDOG} $WARDOG · +${INSTANT_REFERRER_WARCAT} $WARCAT\n` +
              `Milestone rewards are unlocking — open the app and claim them.`,
          );
        }

        // Guarantee a progress row so the player appears on the leaderboard immediately
        await sql`
          INSERT INTO progress (user_id, state)
          VALUES (${userId}, '{}'::jsonb)
          ON CONFLICT (user_id) DO NOTHING
        `;

        // Piggyback notification delivery on login traffic
        await flushDueNotifications(10).catch(() => []);

        const session = await mutableSession();
        await session.update({ userId, telegramId: verified.user.id });

        return Response.json({
          user: {
            id: userId,
            telegramId: verified.user.id,
            username: row.username,
            firstName: row.first_name,
            lastName: row.last_name,
            photoUrl: row.photo_url,
            walletAddress: row.wallet_address,
            referralCode: row.referral_code,
            referredBy: row.referred_by,
          },
        });
      },
    },
  },
});
