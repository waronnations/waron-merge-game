import { createServerFn } from "@tanstack/react-start";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import {
  ScheduleInput,
  cancelFor,
  flushDueNotifications,
  scheduleFor,
  sessionIds,
} from "@/lib/notifications.server";

export const scheduleNotification = createServerFn({ method: "POST" })
  .validator((input: unknown) => ScheduleInput.parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { ok: false, reason: "database_not_configured" as const };
    const ids = await sessionIds();
    if (!ids) return { ok: false, reason: "unauthenticated" as const };
    await ensureSchema();
    const result = await scheduleFor(ids.userId, ids.telegramId, data.kind, data.dueAt);
    // No cron on Vercel Hobby — piggyback the flush on normal traffic.
    await flushDueNotifications(10);
    return result;
  });

export const cancelNotifications = createServerFn({ method: "POST" }).handler(async () => {
  if (!hasDatabase()) return { ok: false as const };
  const ids = await sessionIds();
  if (!ids) return { ok: false as const };
  await ensureSchema();
  await cancelFor(ids.userId);
  return { ok: true as const };
});
