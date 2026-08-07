/**
 * Admin Tools — system-level maintenance (nations heal, etc.).
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { adminHealNationsFn } from "@/lib/admin.functions";
import { Loader2, HeartPulse, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/tools")({
  component: AdminToolsPage,
});

function AdminToolsPage() {
  const [reason, setReason] = useState("Admin tools — nations heal");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleHealNations() {
    if (!reason.trim()) {
      setResult({ type: "error", text: "Reason is required." });
      return;
    }
    if (
      !confirm(
        "Nations Heal will:\n" +
          "• Remove ghost memberships (deleted users)\n" +
          "• Recalculate every member_count\n" +
          "• Clear orphaned leader_id values\n" +
          "• Clear leaders on empty countries (so Claim works again)\n" +
          "• Sync users.nation_id\n\n" +
          "Continue?",
      )
    ) {
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await adminHealNationsFn({ data: { reason } });
      setResult({
        type: "success",
        text:
          `Heal complete. ` +
          `Ghosts removed: ${res.ghostMembersRemoved}, ` +
          `orphaned leaders cleared: ${res.orphanedLeadersCleared}, ` +
          `empty leaders cleared: ${res.emptyLeadersCleared}, ` +
          `users.nation_id fixed: ${res.usersNationIdCleared}. ` +
          `All member_counts recalculated.`,
      });
    } catch (e: any) {
      setResult({
        type: "error",
        text: e?.message || "Failed to run nations heal",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tools</h1>
        <p className="mt-1 text-sm text-zinc-400">
          System-level maintenance actions. All actions are audited.
        </p>
      </div>

      <div className="max-w-xl">
        <label className="mb-1 block text-xs font-medium text-zinc-400">
          Reason (required for all tools)
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you running this tool?"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-amber-500/50"
        />
      </div>

      {result && (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            result.type === "success"
              ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-300"
              : "border-red-900/50 bg-red-950/30 text-red-300"
          }`}
        >
          {result.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{result.text}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/15 p-2.5">
              <HeartPulse className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-semibold">Heal Nations Data</h2>
              <p className="text-xs text-zinc-500">
                Fix empty-country Claim + stale counts
              </p>
            </div>
          </div>
          <p className="mb-4 text-sm text-zinc-400">
            Recalculates <code className="text-zinc-300">member_count</code>, removes
            ghost members, clears orphaned / empty leaders so the{" "}
            <strong className="text-zinc-200">Claim</strong> button reappears on empty
            countries. Multi-leader creation is already blocked in game code.
          </p>
          <button
            onClick={handleHealNations}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HeartPulse className="h-4 w-4" />
            )}
            Run Nations Heal
          </button>
        </div>

        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-6">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-lg bg-zinc-800 p-2.5">
              <AlertTriangle className="h-5 w-5 text-zinc-500" />
            </div>
            <div>
              <h2 className="font-semibold text-zinc-400">More tools coming</h2>
              <p className="text-xs text-zinc-600">Phase 2+</p>
            </div>
          </div>
          <p className="text-sm text-zinc-500">
            Future tools: recalculate all reputations, seed missing countries, force
            season start/end, broadcast notifications, rate-limit flush, etc.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">
        <h3 className="mb-2 font-medium text-zinc-300">Required environment variable</h3>
        <p>
          Set{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-amber-400">
            ADMIN_WALLETS
          </code>{" "}
          in Vercel (comma-separated list of allowed TON wallet addresses).
        </p>
      </div>
    </div>
  );
}
