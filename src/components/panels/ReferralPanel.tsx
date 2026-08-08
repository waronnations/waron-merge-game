import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Users, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import type { GameState } from "@/lib/game-state";
import { haptic, shareUrl, getTelegram } from "@/lib/telegram";
import { track } from "@/lib/analytics";
import {
  getReferralStatus,
  claimReferralMilestone,
  MILESTONES,
  REFERRAL_BOT,
  type ReferralStatusPayload,
} from "@/lib/referrals.functions";
import {
  buildReferralLink,
  REFERRAL_QUALIFY_MIN_GLORY,
  REFERRAL_QUALIFY_MIN_MERGES,
} from "@/lib/referrals.shared";

const FALLBACK_MILESTONES: ReferralStatusPayload["milestones"] = MILESTONES.map(
  (m) => ({
    threshold: m.threshold,
    reward: m.reward,
    claimed: false,
    claimable: false,
  }),
);

export function ReferralPanel({
  state,
  authenticated,
  onServerReward,
  onCodeSync,
}: {
  state: GameState;
  authenticated: boolean;
  onServerReward: (stateJson: string) => void;
  onCodeSync?: (code: string) => void;
}) {
  const fetchStatus = useServerFn(getReferralStatus);
  const claim = useServerFn(claimReferralMilestone);

  const [status, setStatus] = useState<ReferralStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const syncedCodeRef = useRef<string | null>(null);

  const loadStatus = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!authenticated) return;
      if (!opts?.silent) setRefreshing(true);
      try {
        const res = await fetchStatus();
        if (!res) {
          setError("No response from the server");
          return;
        }
        if ("error" in res) {
          setError(
            res.error === "database_unavailable"
              ? "Recruit HQ is offline — try again shortly"
              : res.error === "user_not_found"
                ? "Account not found — reopen the app from Telegram"
                : "Could not load recruit data",
          );
          return;
        }
        setError(null);
        setStatus(res);
        if (
          res.code &&
          res.code.length >= 5 &&
          res.code !== syncedCodeRef.current
        ) {
          syncedCodeRef.current = res.code;
          onCodeSync?.(res.code);
        }
      } catch {
        setError("Network error — pull to refresh");
      } finally {
        setRefreshing(false);
      }
    },
    [authenticated, fetchStatus, onCodeSync],
  );

  useEffect(() => {
    if (!authenticated) return;
    void loadStatus();
    const id = setInterval(() => void loadStatus({ silent: true }), 30_000);
    return () => clearInterval(id);
  }, [authenticated, loadStatus]);

  useEffect(() => {
    if (!authenticated) return;
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        void loadStatus({ silent: true });
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [authenticated, loadStatus]);

  const code = status?.code ?? state.referralCode;

  const link = useMemo(
    () =>
      status?.botUrl ??
      (code ? buildReferralLink(code) : `https://t.me/${REFERRAL_BOT}`),
    [status?.botUrl, code],
  );

  const referralCount = status?.referralCount ?? 0;
  const rawCount = status?.rawReferralCount ?? 0;
  const recruits = status?.recentRecruits ?? [];
  const minMerges =
    status?.qualify?.minMerges ?? REFERRAL_QUALIFY_MIN_MERGES;
  const minGlory = status?.qualify?.minGlory ?? REFERRAL_QUALIFY_MIN_GLORY;

  const shareText = useMemo(() => {
    return [
      "⚔️ WAR ON NATIONS is live.",
      "",
      "Merge WARDOG & WARCAT units. Climb ranks. Earn $WARDOG & $WARCAT.",
      "Claim a country. Launch strategic nukes. Build your nation vault.",
      "",
      "Join my squad with this link (open inside Telegram):",
      link,
      code ? `My recruit code: ${code}` : "",
      "",
      "#WarOnNations #WARDOG #WARCAT",
    ]
      .filter(Boolean)
      .join("\n");
  }, [link, code]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
      haptic("light");
    } catch {
      toast.error("Copy failed — long-press to copy manually");
    }
  };

  const shareTelegram = () => {
    // Native Telegram share sheet with prefilled text + referral link
    shareUrl(link, shareText);
    haptic("medium");
  };

  const shareX = () => {
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    const tg = getTelegram();
    try {
      if (tg?.openLink) {
        tg.openLink(intent);
      } else if (typeof window !== "undefined") {
        window.open(intent, "_blank", "noopener,noreferrer");
      }
    } catch {
      if (typeof window !== "undefined") {
        window.location.href = intent;
      }
    }
    haptic("medium");
  };

  const doClaim = async (threshold: number) => {
    if (busy !== null) return;
    setBusy(threshold);
    try {
      const res = await claim({ data: { threshold } });
      if (!res.ok) {
        toast.error(
          res.error === "not_enough_referrals"
            ? "Not enough verified recruits yet"
            : res.error === "already_claimed"
              ? "Already claimed"
              : res.error === "database_unavailable"
                ? "Recruit HQ is offline — try again shortly"
                : "Unable to claim",
        );
        await loadStatus({ silent: true });
        return;
      }
      setStatus(res.status);
      setError(null);
      onServerReward(res.stateJson);
      if (res.status?.code) {
        syncedCodeRef.current = res.status.code;
        onCodeSync?.(res.status.code);
      }
      const r = res.reward;
      track("referral_claim", { threshold });
      toast.success(
        `+${r.glory.toLocaleString()}★  +${r.wardog} $WARDOG  +${r.warcat} $WARCAT`,
      );
      haptic("heavy");
    } catch {
      toast.error("Claim failed — check your connection");
    } finally {
      setBusy(null);
    }
  };

  const milestones = status?.milestones ?? FALLBACK_MILESTONES;
  const loading = authenticated && status === null && !error;

  return (
    <div className="space-y-3 pb-6">
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Users className="h-5 w-5 shrink-0 text-amber-500" />
            <h3 className="truncate text-sm font-black uppercase tracking-widest text-white">
              Recruit Command
            </h3>
          </div>
          {authenticated && (
            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={refreshing}
              aria-label="Refresh recruit data"
              className="flex min-h-[2rem] shrink-0 items-center gap-1.5 rounded-lg bg-zinc-800 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-center text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-[0.65rem] leading-relaxed text-amber-200/90">
          Recruits count only after they play:{" "}
          <strong>{minMerges}+ merges</strong> or{" "}
          <strong>{minGlory}+ glory</strong>. Empty joins do not unlock
          milestones.
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-3">
          <div className="text-[0.6rem] uppercase tracking-widest text-zinc-500">
            Your code
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="truncate text-lg font-black tracking-widest text-amber-500">
              {code || "—"}
            </div>
            <button
              type="button"
              onClick={() => code && copy(code, "Code")}
              disabled={!code}
              aria-label="Copy referral code"
              className="shrink-0 rounded-lg bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-2 rounded-xl border border-zinc-700 bg-zinc-950 p-3">
          <div className="text-[0.6rem] uppercase tracking-widest text-zinc-500">
            Invite link · @{REFERRAL_BOT}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="truncate text-xs text-zinc-300">{link}</div>
            <button
              type="button"
              onClick={() => copy(link, "Link")}
              aria-label="Copy invite link"
              className="shrink-0 rounded-lg bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Restored dual share: Telegram + X */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={shareTelegram}
            className="min-h-[2.75rem] rounded-xl bg-sky-600 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-sky-500"
          >
            Share Telegram
          </button>
          <button
            type="button"
            onClick={shareX}
            className="min-h-[2.75rem] rounded-xl bg-zinc-100 py-3 text-sm font-black uppercase tracking-widest text-black hover:bg-white"
          >
            Share on X
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-amber-950/40 px-3 py-2">
            <div className="text-[0.55rem] uppercase tracking-widest text-zinc-500">
              Verified
            </div>
            <div className="text-sm font-black text-amber-500">
              {!authenticated ? "—" : loading ? "…" : referralCount}
            </div>
          </div>
          <div className="rounded-xl bg-zinc-950 px-3 py-2">
            <div className="text-[0.55rem] uppercase tracking-widest text-zinc-500">
              Total joined
            </div>
            <div className="text-sm font-black text-zinc-300">
              {!authenticated ? "—" : loading ? "…" : rawCount}
            </div>
          </div>
        </div>

        {authenticated && !loading && !error && referralCount === 0 && (
          <p className="mt-2 text-center text-[0.65rem] text-zinc-500">
            Friends must open your link <strong>inside Telegram</strong>, then
            play a few merges so they verify.
          </p>
        )}
      </div>

      {authenticated && recruits.length > 0 && (
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">
            Recent Recruits
          </h3>
          <div className="space-y-1.5">
            {recruits.map((r, i) => (
              <div
                key={`${r.name}-${r.joinedAt}-${i}`}
                className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950 px-3 py-2"
              >
                <span className="truncate text-xs font-bold text-zinc-200">
                  {r.name}
                </span>
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[0.55rem] font-black uppercase tracking-wider ${
                    r.qualified
                      ? "bg-emerald-950 text-emerald-400"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {r.qualified ? "Verified" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
        <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">
          Milestone Rewards
        </h3>

        {!authenticated ? (
          <div className="rounded-xl bg-zinc-950 p-3 text-center text-xs text-zinc-500">
            Sign in through Telegram to earn milestone rewards.
          </div>
        ) : loading ? (
          <div className="rounded-xl bg-zinc-950 p-3 text-center text-xs text-zinc-500">
            Loading milestones…
          </div>
        ) : (
          <div className="space-y-2">
            {milestones.map((m) => {
              const progress = Math.min(1, referralCount / m.threshold);
              return (
                <div
                  key={m.threshold}
                  className={`rounded-xl border p-3 ${
                    m.claimed
                      ? "border-zinc-700 bg-zinc-950 opacity-70"
                      : m.claimable
                        ? "border-amber-500/50 bg-amber-950/30"
                        : "border-zinc-700 bg-zinc-950"
                  }`}
                >
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                    <div className="text-sm font-black text-white">
                      {m.threshold} verified recruit
                      {m.threshold === 1 ? "" : "s"}
                    </div>
                    <div className="text-[0.6rem] uppercase tracking-widest text-zinc-500">
                      +{m.reward.glory}★ · +{m.reward.wardog}/{m.reward.warcat}
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-[0.6rem] uppercase tracking-widest text-zinc-500">
                      {Math.min(referralCount, m.threshold)} / {m.threshold}
                    </div>
                    {m.claimable && (
                      <button
                        type="button"
                        onClick={() => void doClaim(m.threshold)}
                        disabled={busy === m.threshold}
                        className="min-h-[2rem] rounded-lg bg-amber-500 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-wider text-black disabled:opacity-50"
                      >
                        {busy === m.threshold ? "Claiming…" : "Claim"}
                      </button>
                    )}
                    {m.claimed && (
                      <span className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-500">
                        Claimed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
