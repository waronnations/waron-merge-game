export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  isVerticalSwipesEnabled?: boolean;
  HapticFeedback?: {
    impactOccurred: (
      style: "light" | "medium" | "heavy" | "rigid" | "soft",
    ) => void;
  };
  /** Bot API 6.1+ — open t.me links inside Telegram */
  openTelegramLink?: (url: string) => void;
  /** Bot API 6.1+ — open external links */
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
    auth_date?: number;
    hash?: string;
    query_id?: string;
  };
  themeParams?: Record<string, string>;
  platform?: string;
  version?: string;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTelegram(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function initTelegram(): TelegramWebApp | null {
  const tg = getTelegram();
  if (!tg) return null;
  try {
    tg.ready();
    tg.expand();

    if (webAppVersion() >= 6.1) {
      tg.setHeaderColor?.("#0a0a0f");
      tg.setBackgroundColor?.("#0a0a0f");
    }

    // Bot API 7.7+ — stop vertical swipe from stealing board drags
    if (webAppVersion() >= 7.7) {
      tg.disableVerticalSwipes?.();
    }
  } catch {
    /* ignore */
  }
  return tg;
}

/** Telegram WebApp version as a number (0 when unavailable). */
export function webAppVersion(): number {
  const v = parseFloat(String(getTelegram()?.version ?? "0"));
  return Number.isFinite(v) ? v : 0;
}

export function haptic(kind: "light" | "medium" | "heavy" = "light") {
  if (webAppVersion() < 6.1) return;
  try {
    getTelegram()?.HapticFeedback?.impactOccurred(kind);
  } catch {
    /* ignore */
  }
}

export function tgUser(): TelegramUser | null {
  return getTelegram()?.initDataUnsafe?.user ?? null;
}

export function getStartParam(): string | null {
  const tg = getTelegram();

  if (tg?.initDataUnsafe?.start_param) {
    return tg.initDataUnsafe.start_param;
  }

  if (typeof window !== "undefined") {
    const search = new URLSearchParams(window.location.search);
    const fromSearch =
      search.get("tgWebAppStartParam") ||
      search.get("startapp") ||
      search.get("start") ||
      search.get("ref");
    if (fromSearch) return fromSearch;

    const hash = window.location.hash.slice(1);
    const hashParams = new URLSearchParams(hash);
    const fromHash =
      hashParams.get("tgWebAppStartParam") ||
      hashParams.get("startapp") ||
      hashParams.get("start");
    if (fromHash) return fromHash;
  }

  return null;
}

export function getInitData(): string | null {
  const data = getTelegram()?.initData;
  return data && data.length > 0 ? data : null;
}

/**
 * Share a URL + text via Telegram's native share sheet.
 * Prefer openTelegramLink (Mini App) over window.open (often blocked).
 */
export function shareUrl(url: string, text: string) {
  if (typeof window === "undefined") return;

  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const tg = getTelegram();

  try {
    // Native path — works inside Telegram Mini Apps
    if (tg?.openTelegramLink && webAppVersion() >= 6.1) {
      tg.openTelegramLink(share);
      return;
    }
    // Fallback: open as external link if available
    if (tg?.openLink) {
      tg.openLink(share);
      return;
    }
    window.open(share, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = share;
  }
}
