// src/lib/monitoring.ts
// Isomorphic, dependency-free error monitoring via the Sentry HTTP envelope API.
// Works on Cloudflare/Vercel edge runtimes (no @sentry/* packages).

type SentryDsn = {
  publicKey: string;
  host: string;
  projectId: string;
};

const MAX_EVENTS_PER_MINUTE = 20;
const DEDUPE_WINDOW_MS = 5000;

let eventTimestamps: number[] = [];
let lastMessages = new Map<string, number>();
let installed = false;

function parseDsn(dsn: string | undefined | null): SentryDsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "");
    if (!publicKey || !projectId) return null;
    return { publicKey, host: url.host, projectId };
  } catch {
    return null;
  }
}

function getDsn(): SentryDsn | null {
  // Browser build-time env var.
  try {
    const viteDsn = (import.meta as unknown as { env?: Record<string, string | undefined> })
      ?.env?.VITE_SENTRY_DSN;
    if (viteDsn) return parseDsn(viteDsn);
  } catch {
    /* ignore */
  }
  // Server-side runtime env var, read lazily so this file stays edge-safe.
  if (typeof process !== "undefined" && process.env) {
    return parseDsn(process.env.SENTRY_DSN);
  }
  return null;
}

function getRelease(): string | undefined {
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
      ?.VITE_APP_VERSION;
  } catch {
    return undefined;
  }
}

function getEnvName(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> })?.env;
    if (env?.PROD) return "production";
    if (env?.DEV) return "development";
  } catch {
    /* ignore */
  }
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production"
    ? "production"
    : "development";
}

function genEventId(): string {
  // 32 hex chars, no dashes — matches Sentry's event_id format.
  let id = "";
  for (let i = 0; i < 32; i++) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}

function rateLimitOk(): boolean {
  const now = Date.now();
  eventTimestamps = eventTimestamps.filter((t) => now - t < 60_000);
  if (eventTimestamps.length >= MAX_EVENTS_PER_MINUTE) return false;
  eventTimestamps.push(now);
  return true;
}

function isDuplicate(key: string): boolean {
  const now = Date.now();
  const last = lastMessages.get(key);
  if (last && now - last < DEDUPE_WINDOW_MS) return true;
  lastMessages.set(key, now);
  // Prevent unbounded growth.
  if (lastMessages.size > 200) {
    const cutoff = now - DEDUPE_WINDOW_MS;
    for (const [k, t] of lastMessages) if (t < cutoff) lastMessages.delete(k);
  }
  return false;
}

function buildEvent(opts: {
  level: "error" | "warning" | "info";
  message?: string;
  exception?: { type: string; value: string; stacktrace?: string };
  context?: Record<string, unknown>;
}) {
  return {
    event_id: genEventId(),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: opts.level,
    message: opts.message ? { formatted: opts.message } : undefined,
    exception: opts.exception
      ? {
          values: [
            {
              type: opts.exception.type,
              value: opts.exception.value,
              stacktrace: opts.exception.stacktrace
                ? { frames: [{ filename: "app", function: "unknown", raw: opts.exception.stacktrace }] }
                : undefined,
            },
          ],
        }
      : undefined,
    tags: {
      release: getRelease() ?? "unknown",
      environment: getEnvName(),
    },
    extra: opts.context,
  };
}

async function sendEnvelope(dsn: SentryDsn, event: ReturnType<typeof buildEvent>) {
  const url = `https://${dsn.host}/api/${dsn.projectId}/envelope/?sentry_key=${dsn.publicKey}`;
  const envelopeHeader = JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() });
  const itemHeader = JSON.stringify({ type: "event" });
  const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}\n`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
      keepalive: typeof window !== "undefined",
    });
  } catch {
    /* swallow — monitoring must never break the app */
  }
}

function errorToParts(err: unknown): { type: string; value: string; stacktrace?: string } {
  if (err instanceof Error) {
    return { type: err.name || "Error", value: err.message || String(err), stacktrace: err.stack };
  }
  return { type: "NonError", value: String(err) };
}

/** Report a caught exception. Never throws. No-op without a configured DSN. */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  try {
    const dsn = getDsn();
    if (!dsn) return;
    const parts = errorToParts(err);
    const key = `err:${parts.type}:${parts.value}`;
    if (isDuplicate(key)) return;
    if (!rateLimitOk()) return;
    const event = buildEvent({ level: "error", exception: parts, context });
    void sendEnvelope(dsn, event);
  } catch {
    /* never throw */
  }
}

/** Report a message-level event. Never throws. No-op without a configured DSN. */
export function captureMessage(
  msg: string,
  level: "error" | "warning" | "info" = "info",
): void {
  try {
    const dsn = getDsn();
    if (!dsn) return;
    const key = `msg:${level}:${msg}`;
    if (isDuplicate(key)) return;
    if (!rateLimitOk()) return;
    const event = buildEvent({ level, message: msg });
    void sendEnvelope(dsn, event);
  } catch {
    /* never throw */
  }
}

/** Installs global window.onerror / unhandledrejection handlers once (browser only). */
export function initMonitoring(): void {
  if (typeof window === "undefined") return;
  if (installed) return;
  installed = true;

  window.addEventListener("error", (event) => {
    captureException(event.error ?? event.message, { source: "window.onerror" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    captureException(event.reason, { source: "unhandledrejection" });
  });
}
