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
} from "@/lib/topups.functions";

export type TopupToken = "wardog" | "warcat";

type Snapshot = Awaited<ReturnType<typeof getTopupSnapshot>>;

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
              "A top-up is already in progress for this token — try again in a minute",
            database_unavailable: "Top-up desk offline — try again",
          }[intent.error] ??
            intent.error ??
            "Could not start top-up",
        );
        return;
      }

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
        return;
      }

      let boc: string | null = null;
      try {
        const result = await tonConnectUI.sendTransaction(tx);
        boc = result?.boc ?? null;
      } catch (txErr: unknown) {
        const msg = String((txErr as { message?: string })?.message ?? "");
        if (
          msg.toLowerCase().includes("cancel") ||
          msg.toLowerCase().includes("reject")
        ) {
          toast.error("Transfer cancelled");
        } else {
          console.error("[topup sendTransaction]", txErr);
          toast.error("Wallet rejected the transfer");
        }
        return;
      }

      const confirmed = await confirmTopupFn({
        data: {
          topupId: intent.topup.id,
          txHash: boc ?? `boc-${intent.topup.id}-${Date.now()}`,
        },
      });

      if (!confirmed.ok) {
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
          credited after you approve in the wallet.
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

        <div className="space-y-3">
          <div className="flex gap-2">
            {(["wardog", "warcat"] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={busy}
                onClick={() => setToken(t)}
                className={cn(
                  "flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-wider",
                  token === t
                    ? t === "wardog"
                      ? "bg-amber-500 text-black"
                      : "bg-sky-500 text-black"
                    : "bg-zinc-900 text-zinc-500",
                )}
              >
                {TOKENS[t].symbol}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
              Amount (min {minAmount})
            </span>
            <input
              type="number"
              min={minAmount}
              step="1"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
            />
          </label>

          {address ? (
            <p className="text-center font-mono text-[0.65rem] text-zinc-500">
              From {shortenAddress(address)}
            </p>
          ) : (
            <p className="text-center text-[0.7rem] text-amber-400">
              Wallet not connected — tap below to connect
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => void submitTopup()}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black uppercase tracking-wider",
              busy
                ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                : "bg-emerald-500 text-black hover:bg-emerald-400",
            )}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowDownToLine className="h-4 w-4" />
            )}
            {busy
              ? "Waiting for wallet…"
              : address
                ? `Send ${TOKENS[token].symbol}`
                : "Connect wallet"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
