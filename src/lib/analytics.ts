// src/lib/analytics.ts
// Browser-only, dependency-free analytics via the PostHog HTTP capture API.

export type AnalyticsEvent =
  | "first_open"
  | "first_merge"
  | "first_nation_join"
  | "shop_purchase"
  | "energy_recover"
  | "nuke_launch"
  | "nation_protect"
  | "nation_buff"
  | "referral_claim"
  | "daily_claim"
  | "wallet_connect"
  | "wallet_disconnect"
  | "payment_started"
  | "payment_confirmed"
  | "payment_failed";

const ANON_ID_KEY = "won_anon_id";
const ONCE_KEY_PREFIX = "won_once_";

function getApiKey(): string | null {
  try {
    return (
      (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
        ?.VITE_POSTHOG_KEY ?? null
    );
  } catch {
    return null;
  }
}

function getHost(): string {
  try {
    const host = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
      ?.VITE_POSTHOG_HOST;
    return host || "https://eu.i.posthog.com";
  } catch {
    return "https://eu.i.posthog.com";
  }
}

function getDistinctId(): string {
  try {
    const tgId = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tgId) return String(tgId);
  } catch {
    /* ignore */
  }
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const id = `anon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(ANON_ID_KEY, id);
    return id;
  } catch {
    return "anon_unknown";
  }
}

/** Fire-and-forget analytics event. Never throws. No-op without an API key. */
export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    const apiKey = getApiKey();
    if (!apiKey) return;
    const body = JSON.stringify({
      api_key: apiKey,
      event,
      distinct_id: getDistinctId(),
      properties: props,
    });
    void fetch(`${getHost()}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* swallow */
    });
  } catch {
    /* never throw */
  }
}

/** Fires an event at most once per device, tracked via a localStorage marker. */
export function trackOnce(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    const key = `${ONCE_KEY_PREFIX}${event}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    track(event, props);
  } catch {
    /* never throw */
  }
}
