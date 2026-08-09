// src/components/panels/ProfilePanel.tsx
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  Copy,
  ExternalLink,
  Twitter,
  ShieldAlert,
  RefreshCw,
  Wallet,
} from "lucide-react";
import type { GameState } from "@/lib/game-state";
import type { SessionUser } from "@/hooks/use-telegram-session";
import { getRankForGlory } from "@/lib/ranks";
import { getUnit } from "@/lib/units";
import { haptic } from "@/lib/telegram";
import { TOKENS, shortenAddress } from "@/lib/tokens";
import { MAX_ENERGY } from "@/lib/constants";
import { TreasuryCard } from "@/components/TreasuryCard";
import { redeemTraitorFn } from "@/lib/nations.functions";
import { usePayments } from "@/components/payments/PaymentProvider";
import { getClaims } from "@/lib/claims.functions";

export type PayToken = "wardog" | "warcat";

export function ProfilePanel({
  state,
  user,
  authenticated,
}: {
  state: GameState;
  user?: SessionUser | null;
  authenticated?: boolean;
}) {
  const { pay, connected, address, disconnectWallet } = usePayments();
  const rank = getRankForGlory(state.glory);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  // Authoritative claimable (same source as Earn → Claim)
  const [claimable, setClaimable] = useState({
    wardog: Number(state.wardogTokens ?? 0),
    warcat: Number(state.warcatTokens ?? 0),
  });
  const [claimed, setClaimed] = useState({ wardog: 0, warcat: 0 });
  const [totalEarned, setTotalEarned] = useState({
    wardog: Number(state.wardogTokens ?? 0),
    warcat: Number(state.warcatTokens ?? 0),
  });
  const [loadingBalances, setLoadingBalances] = useState(false);

  const isTraitor = Boolean(
    (state as any).isTraitor ?? (user as any)?.isTraitor,
  );

  // Display these (authoritative)
  const wardog = claimable.wardog;
  const warcat = claimable.warcat;

  const refreshClaimable = useCallback(async () => {
    if (!authenticated) return;
    setLoadingBalances(true);
    try {
      const snap = await getClaims();
      if (snap && "balances" in snap) {
        setClaimable({
          wardog: Number(snap.balances.wardog ?? 0),
          warcat: Number(snap.balances.warcat ?? 0),
        });
        setClaimed({
          wardog: Number(snap.claimed?.wardog ?? 0),
          warcat: Number(snap.claimed?.warcat ?? 0),
        });
        setTotalEarned({
          wardog: Number(snap.total?.wardog ?? 0),
          warcat: Number(snap.total?.warcat ?? 0),
        });
      }
    } catch {
      // keep previous values
    } finally {
      setLoadingBalances(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void refreshClaimable();
  }, [refreshClaimable]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
      haptic("light");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleRedeemPaid = async (payWith: PayToken) => {
    if (redeeming) return;
    setRedeeming(payWith);
    try {
      const auth = await pay("nation:redeem");
      if (!auth.ok) {
        if (auth.reason !== "cancelled") {
          toast.error("Wallet authorization required");
        }
        return;
      }
      await redeemTraitorFn({ data: { pay: true, payWith } });
      toast.success(
        `Traitor status cleared with $${payWith === "wardog" ? "WARDOG" : "WARCAT"}`,
      );
      haptic("heavy");
      void refreshClaimable();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Redeem failed";
      if (msg.includes("insufficient_tokens")) {
        toast.error(
          payWith === "wardog" ? "Not enough $WARDOG" : "Not enough $WARCAT",
        );
      } else if (msg.includes("not_traitor")) {
        toast.error("You are not a traitor");
      } else {
        toast.error("Redeem failed");
      }
    } finally {
      setRedeeming(null);
    }
  };

  const handleRedeemCooldown = async () => {
    if (redeeming) return;
    setRedeeming("cooldown");
    try {
      await redeemTraitorFn({ data: { pay: false } });
      toast.success("Traitor status cleared (cooldown)");
      haptic("medium");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Redeem failed";
      if (msg.includes("cooldown_not_over")) {
        toast.error("Cooldownoldown not over yet");
      } else if (msg.includes("not_traitor")) {
        toast.error("You are not a traitor");
      } else {
        toast.error("Redeem failed");
      }
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <div className="text-center">
          <div className="text-xs font-black uppercase tracking-widest text-zinc-500">
            Commander
          </div>
          <div className="mt-1 text-xl font-black text-white">
            {user?.firstName || user?.username || "Soldier"}
          </div>
          <div className="mt-1 text-sm font-bold text-amber-500">
            {rank.name} · T{state.highestTier}
          </div>
          {authenticated && (
            <div className="mt-1 text-[0.6rem] uppercase tracking-widest text-emerald-500">
              Live · Server synced
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-zinc-950 p-3 text-center">
            <div className="text-lg font-black text-amber-500">
              {state.glory.toLocaleString()}
            </div>
            <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">
              Glory
            </div>
          </div>
          <div className="rounded-xl bg-zinc-950 p-3 text-center">
            <div className="text-lg font-black text-white">
              {state.totalMerges.toLocaleString()}
            </div>
            <div className="text-[0.6rem] uppercase tracking-widest text-zinc-500">
              Merges
            </div>
          </div>
        </div>
      </div>

      {/* Wallet status */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Wallet
            className={`h-4 w-4 shrink-0 ${connected ? "text-emerald-400" : "text-zinc-500"}`}
          />
          <div className="min-w-0">
            <div className="text-[0.65rem] font-black uppercase tracking-wider text-zinc-400">
              {connected ? "Wallet connected" : "Wallet offline"}
            </div>
            <div className="truncate font-mono text-[0.65rem] text-zinc-500">
              {connected && address
                ? `${address.slice(0, 6)}…${address.slice(-4)}`
                : "Connects on paid actions · stays until disconnect"}
            </div>
          </div>
        </div>
        {connected && (
          <button
            type="button"
            onClick={() => void disconnectWallet()}
            className="shrink-0 rounded-lg border border-zinc-600 px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-zinc-400 hover:border-zinc-400 hover:text-white"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Traitor redemption */}
      {isTraitor && (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-red-400">
            <ShieldAlert className="h-4 w-4" />
            Traitor Status
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            Paid redemption needs a connected wallet (once), then spends
            $WARDOG or $WARCAT — never native TON. Or wait the 7-day cooldown
            for free.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleRedeemPaid("wardog")}
              disabled={!!redeeming || wardog < 0.001}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/50 bg-red-950/40 py-2.5 text-[0.65rem] font-black uppercase tracking-wider text-red-300 disabled:opacity-50"
            >
              {redeeming === "wardog" ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              $WARDOG
            </button>
            <button
              type="button"
              onClick={() => void handleRedeemPaid("warcat")}
              disabled={!!redeeming || warcat < 0.001}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-violet-500/50 bg-violet-950/40 py-2.5 text-[0.65rem] font-black uppercase tracking-wider text-violet-300 disabled:opacity-50"
            >
              {redeeming === "warcat" ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              $WARCAT
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleRedeemCooldown()}
            disabled={!!redeeming}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-900 py-2.5 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-300 disabled:opacity-50"
          >
            {redeeming === "cooldown" ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Wait Cooldown (free · no wallet)
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
        <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-500">
          Command Stats
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stat label="Highest Tier" value={`T${state.highestTier}`} />
          <Stat label="Daily Streak" value={`${state.dailyStreak} days`} />
          <Stat label="Energy" value={`${state.energy}/${MAX_ENERGY}`} />
          <Stat label="Referral Code" value={state.referralCode} />
          <Stat label="Nukes Today" value={state.nukesUsedToday ?? 0} />
          <Stat label="Recruits" value={state.referrals?.length ?? 0} />
        </div>
      </div>

      {/* Token Vault – now always shows live claimable (matches Earn) */}
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
            Token Vault (claimable rewards)
          </h3>
          <button
            type="button"
            onClick={() => void refreshClaimable()}
            disabled={loadingBalances}
            className="text-zinc-500 hover:text-white"
            title="Refresh claimable balances"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingBalances ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <TokenCard
            token={TOKENS.wardog}
            claimable={wardog}
            claimed={claimed.wardog}
            total={totalEarned.wardog}
            onCopy={(t) => copy(t, "Address")}
          />
          <TokenCard
            token={TOKENS.warcat}
            claimable={warcat}
            claimed={claimed.warcat}
            total={totalEarned.warcat}
            onCopy={(t) => copy(t, "Address")}
          />
        </div>

        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-[0.6rem] leading-relaxed text-emerald-100/80">
          <strong className="text-emerald-300">Claimable</strong> = merge
          rewards you can still claim in Earn → Claim.
          <br />
          These numbers come from the exact same server source as the Claim
          Center, so Earn and Base always match.
        </div>
      </div>

      <TreasuryCard />

      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
        <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-500">
          WARDOG ARMORY
        </h3>
        <UnitRow faction="dog" highest={state.highestTier} />

        <h3 className="mb-3 mt-5 text-xs font-black uppercase tracking-widest text-zinc-500">
          WARCAT ARMORY
        </h3>
        <UnitRow faction="cat" highest={state.highestTier} />
      </div>

      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500">
          <Twitter className="h-4 w-4" /> Socials
        </h3>
        <a
          href="https://x.com/waronnations"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 p-3 hover:border-amber-500/40"
        >
          <div>
            <div className="text-sm font-bold text-white">@waronnations</div>
            <div className="text-[0.6rem] uppercase tracking-widest text-zinc-500">
              Follow on X
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-amber-500" />
        </a>
      </div>

      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[0.65rem] uppercase tracking-widest text-zinc-500">
          <Link to="/privacy" className="hover:text-red-500">
            Privacy Policy
          </Link>
          <span className="text-zinc-700">·</span>
          <Link to="/terms" className="hover:text-red-500">
            Terms of Service
          </Link>
          <span className="text-zinc-700">·</span>
          <a
            href="https://x.com/waronnations"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-red-500"
          >
            @waronnations
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-zinc-950 p-2.5">
      <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="truncate text-lg font-black text-white">{value}</div>
    </div>
  );
}

function TokenCard({
  token,
  claimable,
  claimed,
  total,
  onCopy,
}: {
  token: (typeof TOKENS)["wardog"];
  claimable: number;
  claimed: number;
  total: number;
  onCopy: (text: string) => void;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-3"
      style={{
        borderColor: `${token.color}40`,
        background: `linear-gradient(135deg, ${token.color}15, transparent)`,
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="text-[0.65rem] font-black uppercase tracking-wider"
          style={{ color: token.color }}
        >
          {token.symbol}
        </div>
        <div className="text-[0.55rem] uppercase tracking-wider text-zinc-500">
          claimable
        </div>
      </div>

      <div className="mt-1 text-xl font-black text-white">
        {claimable.toFixed(2)}
      </div>

      <div className="mt-1.5 space-y-0.5 text-[0.55rem] text-zinc-500">
        <div>
          Claimed · <span className="text-zinc-400">{claimed.toFixed(2)}</span>
        </div>
        <div>
          Total earned ·{" "}
          <span className="text-zinc-400">{total.toFixed(2)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onCopy(token.contractAddress)}
        className="mt-2 flex w-full items-center justify-between rounded-lg bg-black/40 px-2 py-1.5 text-[0.6rem] font-mono text-zinc-300 hover:bg-black/60"
        title={token.contractAddress}
      >
        <span className="truncate">
          {shortenAddress(token.contractAddress, 6, 6)}
        </span>
        <Copy className="h-3 w-3 shrink-0" />
      </button>

      <div className="mt-1 flex gap-1">
        <a
          href={token.tonviewer}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-[0.55rem] uppercase tracking-widest text-zinc-400 hover:bg-black/60"
        >
          Tonviewer <ExternalLink className="h-2.5 w-2.5" />
        </a>
        <a
          href={token.dedust}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-[0.55rem] uppercase tracking-widest text-zinc-400 hover:bg-black/60"
        >
          DeDust <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </div>
  );
}

function UnitRow({
  faction,
  highest,
}: {
  faction: "dog" | "cat";
  highest: number;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((t) => {
        const u = getUnit(faction, t);
        const isUnlocked = highest >= t;
        return (
          <div
            key={t}
            className={`flex aspect-square flex-col items-center justify-center rounded-xl border p-1 ${
              isUnlocked
                ? "border-zinc-600 bg-zinc-950"
                : "border-zinc-800 bg-zinc-950/50 opacity-40"
            }`}
          >
            {isUnlocked ? (
              <img
                src={u.image}
                alt={u.name}
                loading="lazy"
                className="h-9 w-9 object-contain"
              />
            ) : (
              <div className="h-9 w-9 rounded bg-zinc-800" aria-hidden />
            )}
            <span className="mt-0.5 text-[0.55rem] font-bold text-zinc-400">
              T{t}
            </span>
          </div>
        );
      })}
    </div>
  );
}
