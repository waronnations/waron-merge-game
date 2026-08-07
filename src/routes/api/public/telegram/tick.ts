import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { flushDueNotifications } from "@/lib/notifications.server";

/**
 * Optional external scheduler endpoint — flushes due bot notifications.
 *
 * The app does NOT depend on this: notifications are also flushed
 * opportunistically on normal authenticated traffic (login / schedule), which
 * keeps the Vercel Hobby plan (no crons) fully supported. Wire an external
 * pinger only if you want delivery while nobody is playing:
 *   GET /api/public/telegram/tick?secret=<CRON_SECRET>
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const Route = createFileRoute("/api/public/telegram/tick")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) return Response.json({ error: "cron_not_configured" }, { status: 503 });
        const url = new URL(request.url);
        const provided = url.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
        if (!provided || !safeEqual(provided, cronSecret)) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (!hasDatabase())
          return Response.json({ error: "database_not_configured" }, { status: 503 });

        await ensureSchema();
        const results = await flushDueNotifications(25);
        return Response.json({ processed: results.length, results });
      },
    },
  },
});
