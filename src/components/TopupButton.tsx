// src/components/TopupButton.tsx
import { useEffect, useState } from "react";
import { useTonWallet } from "@tonconnect/ui-react";
import { ArrowDownToLine, Loader2, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { haptic } from "@/lib/telegram";
import { TOKENS, shortenAddress } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import {
  getTopupSnapshot,
  createTopup,
  confirmTopupFn,
} from "@/lib/topups.functions";
import type { TopupToken } from "@/lib/topups.server";

type Snapshot = Awaited<ReturnType<typeof getTopupSnapshot>>;

export function TopupButton({ className }: { className?: string }) {
  const wallet = useTonWallet();
  const address = wallet?.account?.address;

  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [token, setToken] = useState<TopupToken>("wardog");
  const [amount, setAmount] = useState("50");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"form" | "await_tx">("form");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [comment, setComment] = useState<string>("");
  const [depositAddress, setDepositAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState<"addr" | "comment" | null>(null);

  const refresh = async () => {
    try {
      const s = await getTopupSnapshot();
      setSnap(s);
      if (s.depositAddress) setDepositAddress(s.depositAddress);
    } catch {
      /* offline */
    }
  };

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open]);

  const minAmount = snap?.minAmount ?? 10;
  const spendable = snap?.spendable ?? {
    spendableWardog: 0,
    spendableWarcat: 0,
  };

  const copy = async (text: string, kind: "addr" | "comment") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      haptic("light");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  const startTopup = async () => {
    if (!address) {
      toast.error("Connect your TON wallet first");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n < minAmount) {
      toast.error(`Minimum top-up is ${minAmount}`);
      return;
    }

    setBusy(true);
    try {
      const res = await createTopup({
        data: {
          token,
          amount: n,
          walletAddress: address,
        },
      });

      if (!res.ok) {
        toast.error(
          {
            below_minimum: `Minimum top-up is ${minAmount}`,
            wallet_required: "Connect your TON wallet first",
            topup_already_pending:
              "You already have a pending top-up for this token",
            database_unavailable: "Top-up desk offline — try again",
          }[res.error] ?? res.error ?? "Could not start top-up",
        );
        return;
      }

      setPendingId(res.topup.id);
      setComment(res.comment);
      setDepositAddress(res.depositAddress);
      setPhase("await_tx");
      haptic("medium");
      toast.success("Top-up created — send jettons, then paste TX hash");
    } catch (e) {
      console.error("[startTopup]", e);
      toast.error("Top-up request failed");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!pendingId) return;
    const hash = txHash.trim();
    if (hash.length < 8) {
      toast.error("Paste the transaction hash from your wallet");
      return;
    }

    setBusy(true);
    try {
      const res = await confirmTopupFn({
        data: { topupId: pendingId, txHash: hash },
      });

      if (!res.ok) {
        toast.error(
          {
            tx_hash_required: "Paste a valid TX hash",
            not_found: "Top-up not found",
            not_pending: "This top-up is no longer pending",
            expired: "Top-up expired — start a new one",
            tx_already_used: "This TX was already used",
          }[res.error] ?? res.error ?? "Confirm failed",
        );
        return;
      }

      haptic("medium");
      toast.success(
        `+${res.topup.amount} ${TOKENS[res.topup.token].symbol} added to spendable`,
      );
      setPhase("form");
      setPendingId(null);
      setComment("");
      setTxHash("");
      await refresh();
      setOpen(false);
    } catch (e) {
      console.error("[confirmTopup]", e);
      toast.error("Confirm failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          haptic("light");
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-900/50",
          className,
        )}
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        Top up
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div
            className="absolute inset-0"
            onClick={() => !busy && setOpen(false)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">
                Top up spendable
              </h3>
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-zinc-500 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 text-[0.7rem] leading-relaxed text-zinc-500">
              Send $WARDOG / $WARCAT to the Claim Treasury. After the transfer,
              paste the TX hash to credit your{" "}
              <strong className="text-zinc-300">spendable</strong> balance
              (used for paid actions). Claimable vault is separate.
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

            {phase === "form" ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(["wardog", "warcat"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
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
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
                  />
                </label>

                {!address ? (
                  <p className="text-center text-[0.7rem] text-amber-400">
                    Connect your TON wallet in Claim Center first
                  </p>
                ) : (
                  <p className="text-center font-mono text-[0.65rem] text-zinc-500">
                    From {shortenAddress(address)}
                  </p>
                )}

                <button
                  type="button"
                  disabled={busy || !address}
                  onClick={() => void startTopup()}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black uppercase tracking-wider",
                    busy || !address
                      ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                      : "bg-emerald-500 text-black hover:bg-emerald-400",
                  )}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="h-4 w-4" />
                  )}
                  {busy ? "Creating…" : "Create top-up"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[0.7rem] text-emerald-100/90">
                  <p className="mb-2 font-bold uppercase tracking-wider text-emerald-300">
                    Send {amount} {TOKENS[token].symbol}
                  </p>
                  <p className="mb-1 text-zinc-400">Treasury address</p>
                  <button
                    type="button"
                    onClick={() => void copy(depositAddress, "addr")}
                    className="mb-2 flex w-full items-center justify-between gap-2 rounded-lg bg-black/40 px-2 py-1.5 font-mono text-[0.65rem] text-emerald-200"
                  >
                    <span className="truncate">{depositAddress}</span>
                    {copied === "addr" ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                  <p className="mb-1 text-zinc-400">
                    Comment / memo (if your wallet supports it)
                  </p>
                  <button
                    type="button"
                    onClick={() => void copy(comment, "comment")}
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-black/40 px-2 py-1.5 font-mono text-[0.65rem] text-emerald-200"
                  >
                    <span className="truncate">{comment}</span>
                    {copied === "comment" ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
                    Transaction hash
                  </span>
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="Paste TX hash after sending"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-white outline-none focus:border-emerald-500/50"
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPhase("form");
                      setPendingId(null);
                      setTxHash("");
                    }}
                    className="flex-1 rounded-xl bg-zinc-800 py-3 text-xs font-black uppercase tracking-wider text-zinc-400"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void confirm()}
                    className={cn(
                      "flex flex-[2] items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase tracking-wider",
                      busy
                        ? "bg-zinc-800 text-zinc-500"
                        : "bg-emerald-500 text-black hover:bg-emerald-400",
                    )}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Confirm credit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
