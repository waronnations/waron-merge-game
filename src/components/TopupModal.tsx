// src/components/TopupModal.tsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";
import { ArrowDownToLine, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { haptic } from "@/lib/telegram";
import { TOKENS, shortenAddress } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import {
  getTopupSnapshot,
  createTopup,
  confirmTopupFn,
  cancelTopupFn,
} from "@/lib/topups.functions";

export type TopupToken = "wardog" | "warcat";

type Snapshot = Awaited<ReturnType<typeof getTopupSnapshot>>;

const QUICK_AMOUNTS = ["10", "25", "50", "100", "250"] as const;

export function TopupModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const address = wallet?.account?.address;

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [token, setToken] = useState<TopupToken>("wardog");
  const [amount, setAmount] = useState("50");
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refresh = async () => {
    try {
      const s = await getTopupSnapshot();
      setSnap(s);
    } catch {
      /* offline */
    }
  };

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open]);

  // Lock body scroll while open (helps Telegram WebView)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const minAmount = snap?.minAmount ?? 10;
  const spendable = snap?.spendable ?? {
    spendableWardog: 0,
    spendableWarcat: 0,
  };

  /** Release pending intent so the user can retry immediately. */
  const releaseIntent = async (topupId: number | null | undefined) => {
    if (topupId == null) return;
    try {
      await cancelTopupFn({ data: { topupId } });
    } catch {
      /* ignore — create will supersede anyway */
    }
  };

  const connectIfNeeded = async () => {
    if (address) return true;
    try {
      await tonConnectUI.openModal();
      haptic("light");
      toast.message("Connect a TON wallet to top up");
    } catch {
      toast.error("Could not open wallet connect");
    }
    return false;
  };

  /**
   * 1) Server creates pending top-up (ledger + comment)
   * 2) Wallet prompts jetton transfer to Claim Treasury
   * 3) On approve → auto-confirm credits spendable
   * On cancel / build fail → release pending so retry is instant
   */
  const submitTopup = async () => {
    if (!address) {
      await connectIfNeeded();
      return;
    }

    const n = Number(amount);
    if (!Number.isFinite(n) || n < minAmount) {
      toast.error(`Minimum top-up is ${minAmount}`);
      return;
    }

    setBusy(true);
    let topupId: number | null = null;
    /** True only after the user signed and BOC was returned. */
    let signed = false;

    try {
      const intent = await createTopup({
        data: {
          token,
          amount: n,
          walletAddress: address,
        },
      });

      if (!intent.ok) {
        toast.error(
          {
            below_minimum: `Minimum top-up is ${minAmount}`,
            wallet_required: "Connect your TON wallet first",
            topup_already_pending:
              "A top-up is already in progress for this token — try again in a moment",
            database_unavailable: "Top-up desk offline — try again",
          }[intent.error] ??
            intent.error ??
            "Could not start top-up",
        );
        return;
      }

      topupId = intent.topup.id;

      const { Buffer } = await import("buffer");
      (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
      await import("@/lib/onchain/buffer-polyfill").catch(() => undefined);

      const { buildTopupTransaction } = await import(
        "@/lib/onchain/topup-tx"
      );

      let tx;
      try {
        tx = await buildTopupTransaction({
          token,
          amount: n,
          senderAddress: address,
          comment: intent.comment,
        });
      } catch (e: unknown) {
        const msg = String((e as Error)?.message ?? e);
        if (msg.includes("jetton_wallet_not_found")) {
          toast.error(
            `No ${TOKENS[token].symbol} in this wallet — buy or transfer some first`,
          );
        } else {
          console.error("[buildTopupTransaction]", e);
          toast.error("Could not prepare jetton transfer");
        }
        await releaseIntent(topupId);
        return;
      }

      let boc: string | null = null;
      try {
        const result = await tonConnectUI.sendTransaction(tx);
        boc = result?.boc ?? null;
        signed = true;
      } catch (txErr: unknown) {
        const msg = String((txErr as { message?: string })?.message ?? "");
        if (
          msg.toLowerCase().includes("cancel") ||
          msg.toLowerCase().includes("reject")
        ) {
          toast.error("Transfer cancelled — you can top up again right away");
        } else {
          console.error("[topup sendTransaction]", txErr);
          toast.error("Wallet rejected the transfer");
        }
        // Jettons never left the wallet — free the lock instantly
        await releaseIntent(topupId);
        return;
      }

      const confirmed = await confirmTopupFn({
        data: {
          topupId: intent.topup.id,
          txHash: boc ?? `boc-${intent.topup.id}-${Date.now()}`,
        },
      });

      if (!confirmed.ok) {
        // Coins may be in flight — do NOT cancel the pending row
        toast.error(
          "Transfer sent — credit pending. Reopen Top up in a moment if balance is delayed.",
        );
        await refresh();
        return;
      }

      haptic("medium");
      toast.success(
        `+${confirmed.topup.amount} ${TOKENS[token].symbol} added to spendable`,
      );
      await refresh();
      onClose();
    } catch (e) {
      console.error("[submitTopup]", e);
      toast.error("Top-up failed");
      // Only release if the user never signed
      if (!signed) {
        await releaseIntent(topupId);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open || !mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/75 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">
            Top up spendable
          </h3>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3 text-[0.7rem] leading-relaxed text-zinc-500">
          Send $WARDOG / $WARCAT from your connected wallet to the Claim
          Treasury. Your{" "}
          <strong className="text-zinc-300">spendable</strong> balance is
          credited after you approve in the wallet. Cancel anytime — the
          pending lock is released instantly.
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-zinc-900 p-2 text-center">
            <div className="text-sm font-black text-amber-400">
              {spendable.spendableWardog.toFixed(2)}
            </div>
            <div className="text-[0.55rem] uppercase tracking-wider text-zinc-500">
              Spendable $WARDOG
            </div>
          </div>
          <div className="rounded-xl bg-zinc-900 p-2 text-center">
            <div className="text-sm font-black text-sky-400">
              {spendable.spendableWarcat.toFixed(2)}
            </div>
            <div className="text-[0.55rem] uppercase tracking-wider text-zinc-500">
              Spendable $WARCAT
            </div>
          </div>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setToken("wardog")}
            className={cn(
              "flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-wider transition",
              token === "wardog"
                ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50"
                : "bg-zinc-900 text-zinc-500 hover:text-zinc-300",
            )}
          >
            $WARDOG
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setToken("warcat")}
            className={cn(
              "flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-wider transition",
              token === "warcat"
                ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/50"
                : "bg-zinc-900 text-zinc-500 hover:text-zinc-300",
            )}
          >
            $WARCAT
          </button>
        </div>

        <label className="mb-1 block text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
          Amount (min {minAmount})
        </label>
        <input
          type="number"
          min={minAmount}
          step="1"
          value={amount}
          disabled={busy}
          onChange={(e) => setAmount(e.target.value)}
          className="mb-2 w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm font-bold text-white outline-none focus:border-zinc-500"
        />

        <div className="mb-4 flex flex-wrap gap-1.5">
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => setAmount(q)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[0.65rem] font-bold transition",
                amount === q
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
              )}
            >
              {q}
            </button>
          ))}
        </div>

        {address ? (
          <p className="mb-3 truncate text-[0.6rem] text-zinc-600">
            Wallet · {shortenAddress(address)}
          </p>
        ) : (
          <p className="mb-3 text-[0.6rem] text-amber-500/80">
            Connect a TON wallet to continue
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void submitTopup()}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black uppercase tracking-wider text-white transition",
            token === "wardog"
              ? "bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400"
              : "bg-gradient-to-r from-sky-600 to-blue-500 hover:from-sky-500 hover:to-blue-400",
            busy && "cursor-not-allowed opacity-60",
          )}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for wallet…
            </>
          ) : (
            <>
              <ArrowDownToLine className="h-4 w-4" />
              Top up {amount || "…"} {TOKENS[token].symbol}
            </>
          )}
        </button>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
