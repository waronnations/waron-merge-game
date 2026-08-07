// src/routes/api/public/health.ts
import { createFileRoute } from "@tanstack/react-router";

const START_TIME = Date.now();
const VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.npm_package_version ??
  "dev";

type Status = "ok" | "unconfigured" | "error";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const uptimeMs = Date.now() - START_TIME;
        const time = new Date().toISOString();

        // ── Database ──────────────────────────────────────────────
        let db: Status = "unconfigured";
        try {
          const { hasDatabase, sql } = await import("@/lib/db.server");
          if (hasDatabase()) {
            await sql`SELECT 1`;
            db = "ok";
          }
        } catch {
          db = "error";
        }

        // ── Telegram bot ──────────────────────────────────────────
        const telegram: Status = process.env.TELEGRAM_BOT_TOKEN
          ? "ok"
          : "unconfigured";

        // ── Session signing ───────────────────────────────────────
        const sessionSecret =
          (process.env.SESSION_SECRET?.length ?? 0) >= 32
            ? "ok"
            : process.env.SESSION_SECRET
              ? "error"
              : "unconfigured";

        // ── On-chain treasury reachability ────────────────────────
        let treasury: {
          status: Status;
          mode?: string;
          lastGoodAt?: number | null;
          error?: string;
        } = { status: "unconfigured" };
        try {
          const [{ probeTreasuryReachable }, { treasuryReaderStatus }] =
            await Promise.all([
              import("@/lib/onchain/treasury-balance.server"),
              import("@/lib/treasury.server"),
            ]);
          const info = treasuryReaderStatus();
          if (info.mode === "override") {
            treasury = { status: "ok", mode: "override" };
          } else {
            const probe = await probeTreasuryReachable();
            treasury = {
              status: probe.ok ? "ok" : "error",
              mode: "onchain",
              lastGoodAt: info.lastGoodAt,
              ...(probe.error ? { error: probe.error } : {}),
            };
          }
        } catch (e) {
          treasury = {
            status: "error",
            error: e instanceof Error ? e.message : String(e),
          };
        }

        // ── Monitoring / analytics wiring ──────────────────────────
        const monitoring = {
          sentry: process.env.SENTRY_DSN ? "ok" : "unconfigured",
          posthog: process.env.VITE_POSTHOG_KEY ? "ok" : "unconfigured",
        };

        // Only hard dependencies gate the status code.
        const ok =
          db !== "error" && telegram !== "unconfigured" && sessionSecret === "ok";

        return Response.json(
          {
            ok,
            version: VERSION,
            uptimeMs,
            time,
            checks: {
              db,
              telegram,
              sessionSecret,
              treasury,
              monitoring,
            },
          },
          {
            status: ok ? 200 : 503,
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
