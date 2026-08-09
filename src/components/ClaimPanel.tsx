// src/components/ClaimPanel.tsx
import { useEffect, useState } from "react";
import {
  useTonConnectUI,
  useTonWallet,
  TonConnectButton,
} from "@tonconnect/ui-react";
import { Wallet, Loader2, Coins, Link2, Unlink, Info } from "lucide-react";
import { toast } from "sonner";
import type { GameState } from "@/lib/game-state";
import { TOKENS, shortenAddress } from "@/lib/tokens";
import { haptic } from "@/lib/telegram";
import {
  createClaim,
  getClaims,
  markClaimTxSubmitted,
  type ClaimsSnapshot,
} from "@/lib/claims.functions";
import { TreasuryCard } from "@/components/TreasuryCard";
import { TopupButton } from "@/components/TopupButton";
import { ONCHAIN_CLAIM_GAS_TON } from "@/lib/onchain/contracts";
import { cn } from "@/lib/utils";
import type { TokenKey } from "@/components/claim/claim-helpers";
import { ClaimAmountControls } from "@/components/claim/ClaimAmountControls";
import { ClaimBalanceTiles } from "@/components/claim/ClaimBalanceTiles";
import { ClaimHistoryList } from "@/components/claim/ClaimHistoryList";

export type ClaimBalanceSyncPayload = {
  wardogTokens: number;
  warcatTokens: number;
  claimedWardog: number;
  claimedWarcat: number;
};

export function ClaimPanel({
  state,
  authenticated,
  onBalanceSync,
}: {
  state: GameState;
  authenticated: boolean;
  onBalanceSync?: (payload: ClaimBalanceSyncPayload) => void;
}) {
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const address = wallet?.account?.address;

  const [snapshot, setSnapshot] = useState<ClaimsSnapshot | null>(null);
  const [busy, setBusy] = useState<TokenKey | null>(null);
  const [amountWardog, setAmountWardog] = useState("");
  const [amountWarcat, setAmountWarcat] = useState("");

  // CRITICAL FIX: never overwrite ledger totals (state.wardogTokens / warcatTokens)
  // with claimable amounts. Only sync the claimed counters so Shop can compute
  // playable = total - claimed correctly.
  const pushBalanceSync = (snap: ClaimsSnapshot) => {
    if (!onBalanceSync) return;
    onBalanceSync({
      wardogTokens: Number(state.wardogTokens ?? 0),
      warcatTokens: Number(state.warcatTokens ?? 0),
      claimedWardog: snap.claimed.wardog,
      claimedWarcat: snap.claimed.warcat,
    });
  };

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getClaims();
        if (!cancelled && "claims" in snap) {
          setSnapshot(snap);
          pushBalanceSync(snap);
        }
      } catch {
        /* offline */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, authenticated]);

  const disconnect = async () => {
    try {
      await tonConnectUI.disconnect();
      haptic("light");
      toast.success("Wallet disconnected");
    } catch {
      /* ignore */
    }
  };

  const parseAmount = (raw: string, available: number, minAmount: number) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false as const, error: "Enter a claim amount" };
    }
    if (n < minAmount) {
      return { ok: false as const, error: `Minimum claim is ${minAmount}` };
    }
    if (n > available + 1e-9) {
      return {
        ok: false as const,
        error: `Only ${available.toFixed(2)} available`,
      };
    }
    return { ok: true as const, amount: n };
  };

  const submitClaim = async (token: TokenKey) => {
    if (!address) {
      toast.error("Connect your TON wallet first");
      return;
    }

    const available = balances[token];
    const raw = token === "wardog" ? amountWardog : amountWarcat;
    const parsed = parseAmount(raw, available, minAmount);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }

    setBusy(token);
    try {
      const res = await createClaim({
        data: {
          token,
          beneficiaryAddress: address,
          amount: parsed.amount,
        },
      });

      if (!res.ok) {
        toast.error(
          {
            wallet_not_linked: "Connect your TON wallet first",
            claim_already_pending: "A claim for this token is already queued",
            below_minimum: `You need at least ${snapshot?.minAmount ?? 10} to request a claim`,
            balance_changed: "Balance changed — try again",
            database_unavailable: "Claim desk offline — try again shortly",
            no_progress: "Progress not found — reopen the app",
            claims_paused:
              "Claims are paused while the treasury refills — check Treasury Health",
            daily_cap_reached: "Daily claim cap reached for this token",
            amount_too_small_for_zone:
              "Claimable slice is under the minimum in the current treasury zone",
          }[res.error] ??
            res.note ??
            "Claim request failed",
        );
        return;
      }

      setSnapshot(res.snapshot);
      pushBalanceSync(res.snapshot);
      if (token === "wardog") setAmountWardog("");
      else setAmountWarcat("");

      if (res.onChain) {
        const { Buffer } = await import("buffer");
        (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
        await import("@/lib/onchain/buffer-polyfill");

        const { buildClaimTransaction } = await import("@/lib/onchain/claim-tx");
        const tx = buildClaimTransaction({
          token: res.onChain.token,
          amount: BigInt(res.onChain.amount),
          beneficiary: res.onChain.beneficiary,
          nonce: BigInt(res.onChain.nonce),
          deadline: res.onChain.deadline,
          signatureHex: res.onChain.signature,
          gasTon: ONCHAIN_CLAIM_GAS_TON,
        });

        try {
          const result = await tonConnectUI.sendTransaction(tx);
          await markClaimTxSubmitted({
            data: {
              claimId: res.claim.id,
              txHash: result?.boc ?? null,
            },
          });
          haptic("medium");
          toast.success(
            `${res.claim.amount.toFixed(2)} ${TOKENS[token].symbol} claim submitted on-chain`,
            {
              description: `Payout: ${res.onChain.beneficiary.slice(0, 6)}…${res.onChain.beneficiary.slice(-4)}. Gas ~${ONCHAIN_CLAIM_GAS_TON} TON.`,
            },
          );
          const snap = await getClaims();
          if ("claims" in snap) {
            setSnapshot(snap);
            pushBalanceSync(snap);
          }
        } catch (txErr: unknown) {
          haptic("heavy");
          const msg = String((txErr as { message?: string })?.message ?? "");
          toast.error(
            msg.toLowerCase().includes("cancel") ||
              msg.toLowerCase().includes("reject")
              ? "Transaction cancelled — balance stays locked; retry or contact support"
              : "Wallet rejected the claim transaction",
          );
        }
        return;
      }

      haptic("medium");
      toast.success(
        `${res.claim.amount.toFixed(2)} ${TOKENS[token].symbol} locked & queued`,
      );
    } catch (e) {
      console.error("[submitClaim]", e);
      toast.error("Claim request failed");
    } finally {
      setBusy(null);
    }
  };

  // Prefer live claimable from server snapshot. Fallback only while loading.
  const balances = snapshot
    ? snapshot.balances
    : { wardog: 0, warcat: 0 };
  const claimed = snapshot?.claimed ?? { wardog: 0, warcat: 0 };
  const total = snapshot?.total ?? {
    wardog: balances.wardog + claimed.wardog,
    warcat: balances.warcat + claimed.warcat,
  };
  const minAmount = snapshot?.minAmount ?? 10;
  const pendingClaims =
    snapshot?.claims.filter((c) => c.status === "pending") ?? [];
  const onChainLive =
    snapshot?.onChainLive === true ||
    snapshot?.claimTreasuryAddress?.startsWith("EQCbh4") === true;

  const canClaim = (token: TokenKey) =>
    Boolean(address) &&
    balances[token] >= minAmount &&
    !busy &&
    !pendingClaims.some((c) => c.token === token);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-amber-500" />
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">
            Claim Center
          </h2>
        </div>
        <TopupButton className="!px-2.5 !py-1.5 !text-[0.6rem]" />
      </div>

      <TreasuryCard />

      <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-2.5 text-[0.65rem] leading-relaxed text-emerald-100/90">
        <p className="font-black uppercase tracking-wider text-emerald-300">
          Two balances
        </p>
        <p className="mt-1 text-emerald-100/70">
          <strong className="text-emerald-200">Claimable</strong> = free rewards
          from the merge board. Claim them here to the Claim Treasury.
          <br />
          <strong className="text-emerald-200">Topped-up</strong> = jettons you
          deposited. Required for shop, energy recover, nations & operations.
        </p>
      </div>

      <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-950/25 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="space-y-1 text-[0.7rem] leading-relaxed text-amber-100/90">
          <p className="font-bold uppercase tracking-wider text-amber-300">
            {onChainLive
              ? "On-chain claims — current wallet only"
              : "Payouts are queued — not instant"}
          </p>
          <p className="text-amber-100/70">
            {onChainLive ? (
              <>
                Choose how much to claim. Jettons go to the{" "}
                <strong className="text-amber-200">currently connected</strong>{" "}
                TON wallet. You pay ~{ONCHAIN_CLAIM_GAS_TON} TON gas.
              </>
            ) : (
              <>Claiming locks balance until batch payout is live.</>
            )}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-700 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-500" />
            <span className="text-xs font-black uppercase tracking-widest text-zinc-300">
              Wallet
            </span>
          </div>
          {address ? (
            <button
              type="button"
              onClick={disconnect}
              className="flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-500 hover:text-red-400"
            >
              <Unlink className="h-3 w-3" />
              Disconnect
            </button>
          ) : null}
        </div>

        {address ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-2">
            <Link2 className="h-4 w-4 text-emerald-400" />
            <span className="font-mono text-xs text-emerald-300">
              {shortenAddress(address)}
            </span>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <TonConnectButton />
          </div>
        )}
      </div>

      <ClaimBalanceTiles
        balances={balances}
        claimed={claimed}
        total={total}
      />

      {/* WARDOG claim */}
      <div className="space-y-3 rounded-2xl border border-zinc-700 bg-zinc-900/80 p-4">
        <div className="text-xs font-black uppercase tracking-widest text-amber-400">
          Claim {TOKENS.wardog.symbol} (merge rewards)
        </div>
        <ClaimAmountControls
          token="wardog"
          available={balances.wardog}
          minAmount={minAmount}
          value={amountWardog}
          onChange={setAmountWardog}
          disabled={Boolean(busy) || !address}
        />
        <button
          type="button"
          disabled={!canClaim("wardog")}
          onClick={() => submitClaim("wardog")}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wider transition",
            canClaim("wardog")
              ? "bg-amber-500 text-black hover:bg-amber-400"
              : "cursor-not-allowed bg-zinc-800 text-zinc-500",
          )}
        >
          {busy === "wardog" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Coins className="h-4 w-4" />
          )}
          {busy === "wardog" ? "Claiming…" : `Claim ${TOKENS.wardog.symbol}`}
        </button>
      </div>

      {/* WARCAT claim */}
      <div className="space-y-3 rounded-2xl border border-zinc-700 bg-zinc-900/80 p-4">
        <div className="text-xs font-black uppercase tracking-widest text-sky-400">
          Claim {TOKENS.warcat.symbol} (merge rewards)
        </div>
        <ClaimAmountControls
          token="warcat"
          available={balances.warcat}
          minAmount={minAmount}
          value={amountWarcat}
          onChange={setAmountWarcat}
          disabled={Boolean(busy) || !address}
        />
        <button
          type="button"
          disabled={!canClaim("warcat")}
          onClick={() => submitClaim("warcat")}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wider transition",
            canClaim("warcat")
              ? "bg-sky-500 text-black hover:bg-sky-400"
              : "cursor-not-allowed bg-zinc-800 text-zinc-500",
          )}
        >
          {busy === "warcat" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Coins className="h-4 w-4" />
          )}
          {busy === "warcat" ? "Claiming…" : `Claim ${TOKENS.warcat.symbol}`}
        </button>
      </div>

      <ClaimHistoryList claims={snapshot?.claims ?? []} />
    </div>
  );
}
