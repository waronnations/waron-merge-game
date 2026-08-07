/**
 * Admin Economy — token claims + shop ledger.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  adminListClaimsFn,
  adminMarkClaimSentFn,
  adminMarkClaimFailedFn,
  adminRefundClaimFn,
  adminListShopLedgerFn,
} from "@/lib/admin.functions";
import {
  Loader2,
  RefreshCw,
  Coins,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/admin/economy")({
  component: AdminEconomyPage,
});

type ClaimRow = Awaited<ReturnType<typeof adminListClaimsFn>>[number];
type ShopRow = Awaited<ReturnType<typeof adminListShopLedgerFn>>[number];

function AdminEconomyPage() {
  const [tab, setTab] = useState<"claims" | "shop">("claims");
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "sent" | "failed" | "refunded" | "all"
  >("pending");

  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [shop, setShop] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [reason, setReason] = useState("Admin economy action");
  const [txHashInput, setTxHashInput] = useState<Record<number, string>>({});

  async function loadClaims() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminListClaimsFn({
        data: { status: statusFilter, limit: 80, offset: 0 },
      });
      setClaims(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load claims");
    } finally {
      setLoading(false);
    }
  }

  async function loadShop() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminListShopLedgerFn({ data: { limit: 80, offset: 0 } });
      setShop(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load shop ledger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "claims") loadClaims();
    else loadShop();
  }, [tab, statusFilter]);

  async function handleMarkSent(claimId: number) {
    const tx = (txHashInput[claimId] || "").trim();
    if (!tx) {
      setMsg("TX hash is required to mark as sent.");
      return;
    }
    if (!reason.trim()) {
      setMsg("Reason is required.");
      return;
    }
    setActionLoading(true);
    setMsg(null);
    try {
      await adminMarkClaimSentFn({
        data: { claimId, txHash: tx, reason },
      });
      setMsg(`Claim #${claimId} marked as sent`);
      await loadClaims();
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "failed"}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkFailed(claimId: number) {
    if (!reason.trim()) {
      setMsg("Reason is required.");
      return;
    }
    if (!confirm(`Mark claim #${claimId} as failed?`)) return;
    setActionLoading(true);
    setMsg(null);
    try {
      await adminMarkClaimFailedFn({ data: { claimId, reason } });
      setMsg(`Claim #${claimId} marked as failed`);
      await loadClaims();
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "failed"}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRefund(claimId: number) {
    if (!reason.trim()) {
      setMsg("Reason is required.");
      return;
    }
    if (!confirm(`Refund claim #${claimId}? Tokens will be restored to the user.`)) return;
    setActionLoading(true);
    setMsg(null);
    try {
      await adminRefundClaimFn({ data: { claimId, reason } });
      setMsg(`Claim #${claimId} refunded — tokens restored`);
      await loadClaims();
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "failed"}`);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Economy</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Token claims & shop purchases
          </p>
        </div>
        <button
          onClick={() => (tab === "claims" ? loadClaims() : loadShop())}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-1 w-fit">
        <button
          onClick={() => setTab("claims")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "claims"
              ? "bg-amber-500/20 text-amber-300"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Claims
        </button>
        <button
          onClick={() => setTab("shop")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "shop"
              ? "bg-amber-500/20 text-amber-300"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Shop Ledger
        </button>
      </div>

      {/* Reason */}
      <div className="max-w-md">
        <label className="mb-1 block text-xs text-zinc-500">
          Reason (required for claim actions)
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-amber-500/50"
        />
      </div>

      {msg && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            msg.startsWith("Error")
              ? "border border-red-900/50 bg-red-950/30 text-red-300"
              : "border border-emerald-900/50 bg-emerald-950/30 text-emerald-300"
          }`}
        >
          {msg}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Claims tab */}
      {tab === "claims" && (
        <>
          <div className="flex gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-1 w-fit">
            {(["pending", "sent", "failed", "refunded", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                  statusFilter === s
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900/80 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Token</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-500" />
                    </td>
                  </tr>
                ) : claims.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                      No claims found
                    </td>
                  </tr>
                ) : (
                  claims.map((c) => (
                    <tr key={c.id} className="border-t border-zinc-800/80 align-top">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                        #{c.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {c.username || c.firstName || "—"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          ID {c.userId} · TG {c.telegramId}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            c.token === "wardog" ? "text-amber-400" : "text-cyan-400"
                          }
                        >
                          {c.token.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {c.amount.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                        {c.walletAddress.slice(0, 6)}…{c.walletAddress.slice(-4)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            c.status === "pending"
                              ? "bg-amber-500/20 text-amber-300"
                              : c.status === "sent"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : c.status === "refunded"
                                  ? "bg-blue-500/20 text-blue-300"
                                  : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {c.status}
                        </span>
                        {c.txHash && (
                          <div className="mt-1 font-mono text-[10px] text-zinc-500">
                            {c.txHash.slice(0, 10)}…
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(c.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {(c.status === "pending" || c.status === "failed") && (
                          <div className="space-y-2 min-w-[180px]">
                            {c.status === "pending" && (
                              <>
                                <input
                                  value={txHashInput[c.id] || ""}
                                  onChange={(e) =>
                                    setTxHashInput((prev) => ({
                                      ...prev,
                                      [c.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="TX hash"
                                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                                />
                                <button
                                  disabled={actionLoading}
                                  onClick={() => handleMarkSent(c.id)}
                                  className="flex w-full items-center justify-center gap-1 rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-50"
                                >
                                  <CheckCircle2 className="h-3 w-3" /> Mark sent
                                </button>
                                <button
                                  disabled={actionLoading}
                                  onClick={() => handleMarkFailed(c.id)}
                                  className="flex w-full items-center justify-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                                >
                                  <XCircle className="h-3 w-3" /> Mark failed
                                </button>
                              </>
                            )}
                            <button
                              disabled={actionLoading}
                              onClick={() => handleRefund(c.id)}
                              className="flex w-full items-center justify-center gap-1 rounded border border-blue-800 bg-blue-950/40 px-2 py-1 text-xs text-blue-300 hover:bg-blue-900/40 disabled:opacity-50"
                            >
                              <RotateCcw className="h-3 w-3" /> Refund
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Shop tab */}
      {tab === "shop" && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/80 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-500" />
                  </td>
                </tr>
              ) : shop.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                    No shop purchases yet
                  </td>
                </tr>
              ) : (
                shop.map((s) => (
                  <tr key={s.id} className="border-t border-zinc-800/80">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      #{s.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {s.username || s.firstName || "—"}
                      </div>
                      <div className="text-xs text-zinc-500">ID {s.userId}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{s.itemId}</td>
                    <td className="px-4 py-3">
                      <span className="text-amber-400">{s.cost}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
