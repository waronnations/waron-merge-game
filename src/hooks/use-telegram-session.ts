import { useEffect, useState } from "react";
import { getInitData, getStartParam, initTelegram } from "@/lib/telegram";

export interface SessionUser {
  id: number;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  walletAddress: string | null;
  referralCode: string;
  referredBy: number | null;
}

export interface SessionState {
  status: "idle" | "authenticating" | "authenticated" | "unavailable" | "error";
  user: SessionUser | null;
  error?: string;
}

export function useTelegramSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "idle", user: null });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      initTelegram();
      const initData = getInitData();
      if (!initData) {
        setState({ status: "unavailable", user: null });
        return;
      }

      setState({ status: "authenticating", user: null });

      try {
        const startParam = getStartParam();
        const search = new URLSearchParams(window.location.search);
        const referralCode =
          startParam ||
          search.get("ref") ||
          search.get("start") ||
          search.get("startapp") ||
          undefined;

        const res = await fetch("/api/public/telegram/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            initData,
            referralCode: referralCode || undefined,
          }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          if (cancelled) return;
          setState({
            status: res.status === 503 ? "unavailable" : "error",
            user: null,
            error: body?.error ?? `login_failed_${res.status}`,
          });
          return;
        }

        const body = (await res.json()) as { user: SessionUser };
        if (cancelled) return;
        setState({ status: "authenticated", user: body.user });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          user: null,
          error: e instanceof Error ? e.message : "network_error",
        });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
