/**
 * Admin Dashboard — overview stats, data-heal, recent activity.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAdminDashboardStatsFn, adminHealNationsFn } from "@/lib/admin.functions";
import {
  Users,
  Activity,
  Flag,
  Coins,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  RefreshCw,
  HeartPulse,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboardPage,
});

type Stats = Awaited<ReturnType<typeof getAdminDashboardStatsFn>>;

function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminDashboardStatsFn();
      setStats(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleHealNations() {
    if (
      !confirm(
        "Run Nations Heal? Recalculates member counts, clears orphaned/empty leaders, removes ghost members so Claim works again.",
      )
    )
      return;
    setFixing(true);
    setFixResult(null);
    try {
      const res = await adminHealNationsFn({
        data: { reason: "Dashboard one-click nations heal" },
      });
      setFixResult(
        `Heal complete — ghosts: ${res.ghostMembersRemoved}, orphaned leaders: ${res.orphanedLeadersCleared}, empty leaders: ${res.emptyLeadersCleared}, users synced: ${res.usersNationIdCleared}.`,
      );
      await load();
    } catch (e: any) {
      setFixResult(`Error: ${e?.message || "failed"}`);
    } finally {
      setFixing(false);
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-center">
        <p className="text-red-300">{error}</p>
        <button
          onClick={load}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      label: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Active (24h)",
      value: stats.activeLast24h.toLocaleString(),
      icon: Activity,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Countries Claimed",
      value: `${stats.claimedCountries} / ${stats.totalCountries}`,
      icon: Flag,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Traitors",
      value: stats.traitorCount.toLocaleString(),
      icon: ShieldAlert,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">Live overview of War On Nations</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">{c.label}</span>
                <div className={`rounded-lg p-2 ${c.bg}`}>
                  <Icon className={`h-4 w-4 ${c.color}`} />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight">{c.value}</div>
            </div>
          );
        })}
      </div>

      {/* Token economy */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Coins className="h-4 w-4 text-amber-400" />
            Total $WARDOG circulating
          </div>
          <div className="mt-2 text-3xl font-bold text-amber-400">
            {stats.totalWardog.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Coins className="h-4 w-4 text-cyan-400" />
            Total $WARCAT circulating
          </div>
          <div className="mt-2 text-3xl font-bold text-cyan-400">
            {stats.totalWarcat.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Stale leadership data (legacy multi-leader rows) */}
      {stats.multiLeaders.length > 0 && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <h2 className="font-semibold text-red-300">
                  Stale leadership data ({stats.multiLeaders.length})
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Leftover leader_id rows from before the one-nation rule. Run Heal to
                  clear orphans / empty leaders and recount members so Claim works.
                </p>
              </div>
            </div>
            <button
              onClick={handleHealNations}
              disabled={fixing}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {fixing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HeartPulse className="h-4 w-4" />
              )}
              Heal Nations
            </button>
          </div>

          {fixResult && (
            <div className="mt-3 rounded-lg bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300">
              {fixResult}
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="pb-2 pr-4 font-medium">User</th>
                  <th className="pb-2 pr-4 font-medium">ID</th>
                  <th className="pb-2 pr-4 font-medium">Leaders</th>
                  <th className="pb-2 font-medium">Tags</th>
                </tr>
              </thead>
              <tbody>
                {stats.multiLeaders.map((m) => (
                  <tr key={m.userId} className="border-b border-zinc-800/60">
                    <td className="py-2.5 pr-4">
                      <Link
                        to="/admin/users"
                        search={{ q: String(m.userId) }}
                        className="text-amber-400 hover:underline"
                      >
                        {m.username || m.firstName || "—"}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-400">{m.userId}</td>
                    <td className="py-2.5 pr-4 font-medium text-red-300">{m.leaderCount}</td>
                    <td className="py-2.5 text-zinc-400">{m.tags.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Always-available heal when no multi-leader alert */}
      {stats.multiLeaders.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-zinc-200">Nations data heal</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Recount member_count, clear empty/orphaned leaders, remove ghost
                members. Safe to run anytime.
              </p>
            </div>
            <button
              onClick={handleHealNations}
              disabled={fixing}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {fixing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HeartPulse className="h-4 w-4" />
              )}
              Heal Nations
            </button>
          </div>
          {fixResult && (
            <div className="mt-3 rounded-lg bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300">
              {fixResult}
            </div>
          )}
        </div>
      )}

      {/* Recent activity */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-4 font-semibold">Recent Nation Activity</h2>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-zinc-500">No recent events.</p>
        ) : (
          <div className="space-y-2">
            {stats.recentActivity.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-zinc-950/50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{a.emblem}</span>
                  <div>
                    <span className="font-medium">{a.nationName}</span>
                    <span className="ml-2 text-zinc-500">({a.nationTag})</span>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      a.event === "claim"
                        ? "bg-amber-500/20 text-amber-300"
                        : a.event === "join"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-zinc-700 text-zinc-300"
                    }`}
                  >
                    {a.event}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(a.at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
