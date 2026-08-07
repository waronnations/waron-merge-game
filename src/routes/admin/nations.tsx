/**
 * Admin Nations — list + full detail drawer with management tools.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  adminListNationsFn,
  adminClearNationLeaderFn,
  adminHealNationsFn,
  adminGetNationDetailsFn,
  adminForceTransferOwnershipFn,
  adminUpdateNationVaultFn,
  adminSetNationProtectionFn,
  adminSetNationRedemptionPriceFn,
  adminKickNationMemberFn,
} from "@/lib/admin.functions";
import {
  Loader2,
  RefreshCw,
  Search,
  HeartPulse,
  Crown,
  Shield,
  AlertTriangle,
  X,
  Users,
  ScrollText,
  Coins,
} from "lucide-react";

export const Route = createFileRoute("/admin/nations")({
  component: AdminNationsPage,
});

type NationRow = Awaited<ReturnType<typeof adminListNationsFn>>[number];
type NationDetail = NonNullable<Awaited<ReturnType<typeof adminGetNationDetailsFn>>>;

function AdminNationsPage() {
  const [nations, setNations] = useState<NationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "claimed" | "empty" | "default">("all");
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState("Admin nations panel");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<NationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "members" | "history">("overview");

  const [transferUserId, setTransferUserId] = useState("");
  const [vaultWardog, setVaultWardog] = useState("0");
  const [vaultWarcat, setVaultWarcat] = useState("0");
  const [protectionHours, setProtectionHours] = useState("24");
  const [redemptionWardog, setRedemptionWardog] = useState("15");
  const [redemptionWarcat, setRedemptionWarcat] = useState("15");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminListNationsFn({ data: { limit: 400 } });
      setNations(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load nations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = nations;
    if (filter === "claimed") list = list.filter((n) => !n.isDefault && n.leaderId != null);
    if (filter === "empty") list = list.filter((n) => !n.isDefault && n.leaderId == null);
    if (filter === "default") list = list.filter((n) => n.isDefault);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.tag.toLowerCase().includes(q) ||
          String(n.id).includes(q) ||
          (n.leaderUsername || "").toLowerCase().includes(q) ||
          (n.leaderFirstName || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [nations, query, filter]);

  const multiLeaderMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const n of nations) {
      if (n.leaderId != null) {
        map.set(n.leaderId, (map.get(n.leaderId) || 0) + 1);
      }
    }
    return map;
  }, [nations]);

  async function openNation(id: number) {
    setSelectedId(id);
    setDetail(null);
    setMsg(null);
    setDetailTab("overview");
    setTransferUserId("");
    setVaultWardog("0");
    setVaultWarcat("0");
    setDetailLoading(true);
    try {
      const d = await adminGetNationDetailsFn({ data: { nationId: id } });
      setDetail(d);
      if (d) {
        setRedemptionWardog(String(d.redemptionPriceWardog));
        setRedemptionWarcat(String(d.redemptionPriceWarcat));
      }
    } catch (e: any) {
      setMsg(e?.message || "Failed to load nation");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
  }

  async function runDetailAction(fn: () => Promise<any>, successMsg: string) {
    if (!reason.trim()) {
      setMsg("Reason is required.");
      return;
    }
    setActionLoading(true);
    setMsg(null);
    try {
      const updated = await fn();
      if (updated && typeof updated === "object" && "id" in updated) {
        setDetail(updated);
      }
      setMsg(successMsg);
      await load();
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "failed"}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClearLeader(nationId: number, name: string) {
    if (!reason.trim()) {
      setMsg("Reason is required.");
      return;
    }
    if (!confirm(`Clear leader of ${name}?`)) return;
    setActionLoading(true);
    setMsg(null);
    try {
      await adminClearNationLeaderFn({ data: { nationId, reason } });
      setMsg(`Leader cleared for ${name}`);
      if (selectedId === nationId) await openNation(nationId);
      await load();
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "failed"}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleHealAll() {
    if (!reason.trim()) {
      setMsg("Reason is required.");
      return;
    }
    if (
      !confirm(
        "Run Nations Heal?\n• Recount member_count\n• Clear orphaned / empty leaders\n• Remove ghost members\nSo Claim works on empty countries again.",
      )
    )
      return;
    setActionLoading(true);
    setMsg(null);
    try {
      const res = await adminHealNationsFn({ data: { reason } });
      setMsg(
        `Heal: ghosts ${res.ghostMembersRemoved}, orphaned leaders ${res.orphanedLeadersCleared}, empty leaders ${res.emptyLeadersCleared}, users synced ${res.usersNationIdCleared}.`,
      );
      await load();
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "failed"}`);
    } finally {
      setActionLoading(false);
    }
  }

  const claimedCount = nations.filter((n) => !n.isDefault && n.leaderId).length;
  const emptyCount = nations.filter((n) => !n.isDefault && !n.leaderId).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nations</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {claimedCount} claimed · {emptyCount} empty ·{" "}
            {nations.filter((n) => n.isDefault).length} default factions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleHealAll}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HeartPulse className="h-4 w-4" />
            )}
            Heal Nations
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs text-zinc-500">Admin reason (for actions)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, tag, leader…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-10 pr-3 text-sm outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-1">
          {(
            [
              ["all", "All"],
              ["claimed", "Claimed"],
              ["empty", "Empty"],
              ["default", "Default"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                filter === key
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/80 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nation</th>
              <th className="px-4 py-3 font-medium">Leader</th>
              <th className="px-4 py-3 font-medium">Members</th>
              <th className="px-4 py-3 font-medium">Glory</th>
              <th className="px-4 py-3 font-medium">Rep</th>
              <th className="px-4 py-3 font-medium">Vault</th>
              <th className="px-4 py-3 font-medium">Status</th>
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
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                  No nations match
                </td>
              </tr>
            ) : (
              filtered.map((n) => {
                const isMulti =
                  n.leaderId != null && (multiLeaderMap.get(n.leaderId) || 0) > 1;
                return (
                  <tr
                    key={n.id}
                    onClick={() => openNation(n.id)}
                    className={`cursor-pointer border-t border-zinc-800/80 transition hover:bg-zinc-900/60 ${
                      isMulti ? "bg-red-950/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{n.emblem}</span>
                        <div>
                          <div className="font-medium">{n.name}</div>
                          <div className="text-xs text-zinc-500">
                            {n.tag} · #{n.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {n.leaderId ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <Crown className="h-3 w-3 text-amber-400" />
                            <span>{n.leaderUsername || n.leaderFirstName || n.leaderId}</span>
                          </div>
                          <div className="text-xs text-zinc-500">ID {n.leaderId}</div>
                          {isMulti && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-red-400">
                              <AlertTriangle className="h-3 w-3" /> multi-leader
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{n.memberCount}</td>
                    <td className="px-4 py-3">{n.totalGlory.toLocaleString()}</td>
                    <td className="px-4 py-3">{n.reputation}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-amber-400">{n.vaultWardog.toFixed(1)}</span>
                      {" / "}
                      <span className="text-cyan-400">{n.vaultWarcat.toFixed(1)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {n.isDefault && (
                          <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-300">
                            default
                          </span>
                        )}
                        {n.isProtected && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            <Shield className="h-2.5 w-2.5" /> protected
                          </span>
                        )}
                        {n.listedPrice != null && (
                          <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-300">
                            listed {n.listedPrice}
                          </span>
                        )}
                        {!n.isDefault && !n.leaderId && (
                          <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">
                            empty
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {n.leaderId && !n.isDefault && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleClearLeader(n.id, n.name)}
                          className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                        >
                          Clear leader
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      {selectedId !== null && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <h2 className="text-lg font-semibold">
                {detail ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{detail.emblem}</span>
                    {detail.name}
                  </span>
                ) : (
                  `Nation #${selectedId}`
                )}
              </h2>
              <button
                onClick={closeDetail}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading || !detail ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-1">
                    {(
                      [
                        ["overview", "Overview", Coins],
                        ["members", "Members", Users],
                        ["history", "History", ScrollText],
                      ] as const
                    ).map(([key, label, Icon]) => (
                      <button
                        key={key}
                        onClick={() => setDetailTab(key)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                          detailTab === key
                            ? "bg-amber-500/20 text-amber-300"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>

                  {detailTab === "overview" && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg bg-zinc-900 p-3">
                          <div className="text-zinc-500">Glory</div>
                          <div className="text-lg font-semibold">
                            {detail.totalGlory.toLocaleString()}
                          </div>
                        </div>
                        <div className="rounded-lg bg-zinc-900 p-3">
                          <div className="text-zinc-500">Reputation</div>
                          <div className="text-lg font-semibold">{detail.reputation}</div>
                        </div>
                        <div className="rounded-lg bg-zinc-900 p-3">
                          <div className="text-zinc-500">Members</div>
                          <div className="text-lg font-semibold">{detail.memberCount}</div>
                        </div>
                        <div className="rounded-lg bg-zinc-900 p-3">
                          <div className="text-zinc-500">Leader</div>
                          <div className="text-sm font-medium">
                            {detail.leaderId
                              ? `${detail.leaderUsername || detail.leaderFirstName || detail.leaderId}`
                              : "None"}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg bg-zinc-900 p-3 text-sm">
                        <div className="mb-1 text-zinc-500">Vault</div>
                        <div>
                          <span className="text-amber-400">
                            {detail.vaultWardog.toFixed(2)} WARDOG
                          </span>
                          {" · "}
                          <span className="text-cyan-400">
                            {detail.vaultWarcat.toFixed(2)} WARCAT
                          </span>
                        </div>
                      </div>

                      {!detail.isDefault && (
                        <div className="rounded-xl border border-zinc-800 p-4 space-y-2">
                          <div className="text-sm font-medium">Adjust Vault</div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              step="0.1"
                              value={vaultWardog}
                              onChange={(e) => setVaultWardog(e.target.value)}
                              placeholder="WARDOG ±"
                              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                            />
                            <input
                              type="number"
                              step="0.1"
                              value={vaultWarcat}
                              onChange={(e) => setVaultWarcat(e.target.value)}
                              placeholder="WARCAT ±"
                              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                            />
                          </div>
                          <button
                            disabled={actionLoading}
                            onClick={() =>
                              runDetailAction(
                                () =>
                                  adminUpdateNationVaultFn({
                                    data: {
                                      nationId: detail.id,
                                      wardogDelta: Number(vaultWardog) || 0,
                                      warcatDelta: Number(vaultWarcat) || 0,
                                      reason,
                                    },
                                  }),
                                "Vault updated",
                              )
                            }
                            className="w-full rounded-lg bg-zinc-800 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
                          >
                            Apply vault change
                          </button>
                        </div>
                      )}

                      {!detail.isDefault && (
                        <div className="rounded-xl border border-zinc-800 p-4 space-y-2">
                          <div className="text-sm font-medium">Force Transfer Ownership</div>
                          <input
                            value={transferUserId}
                            onChange={(e) => setTransferUserId(e.target.value)}
                            placeholder="Target user ID (must be a member)"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                          />
                          <button
                            disabled={actionLoading || !transferUserId}
                            onClick={() =>
                              runDetailAction(
                                () =>
                                  adminForceTransferOwnershipFn({
                                    data: {
                                      nationId: detail.id,
                                      toUserId: Number(transferUserId),
                                      reason,
                                    },
                                  }),
                                "Ownership transferred",
                              )
                            }
                            className="w-full rounded-lg bg-amber-700 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
                          >
                            Transfer to user
                          </button>
                        </div>
                      )}

                      {!detail.isDefault && (
                        <div className="rounded-xl border border-zinc-800 p-4 space-y-2">
                          <div className="text-sm font-medium">
                            Protection{" "}
                            {detail.isProtected && (
                              <span className="text-emerald-400 text-xs">(active)</span>
                            )}
                          </div>
                          <input
                            type="number"
                            value={protectionHours}
                            onChange={(e) => setProtectionHours(e.target.value)}
                            placeholder="Hours"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              disabled={actionLoading}
                              onClick={() =>
                                runDetailAction(
                                  () =>
                                    adminSetNationProtectionFn({
                                      data: {
                                        nationId: detail.id,
                                        enable: true,
                                        hours: Number(protectionHours) || 24,
                                        reason,
                                      },
                                    }),
                                  "Protection enabled",
                                )
                              }
                              className="flex-1 rounded-lg bg-emerald-800 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Enable
                            </button>
                            <button
                              disabled={actionLoading}
                              onClick={() =>
                                runDetailAction(
                                  () =>
                                    adminSetNationProtectionFn({
                                      data: {
                                        nationId: detail.id,
                                        enable: false,
                                        reason,
                                      },
                                    }),
                                  "Protection disabled",
                                )
                              }
                              className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
                            >
                              Disable
                            </button>
                          </div>
                        </div>
                      )}

                      {!detail.isDefault && (
                        <div className="rounded-xl border border-zinc-800 p-4 space-y-2">
                          <div className="text-sm font-medium">Traitor Redemption Price</div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={redemptionWardog}
                              onChange={(e) => setRedemptionWardog(e.target.value)}
                              placeholder="WARDOG"
                              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                            />
                            <input
                              type="number"
                              value={redemptionWarcat}
                              onChange={(e) => setRedemptionWarcat(e.target.value)}
                              placeholder="WARCAT"
                              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                            />
                          </div>
                          <button
                            disabled={actionLoading}
                            onClick={() =>
                              runDetailAction(
                                () =>
                                  adminSetNationRedemptionPriceFn({
                                    data: {
                                      nationId: detail.id,
                                      wardog: Number(redemptionWardog) || 0,
                                      warcat: Number(redemptionWarcat) || 0,
                                      reason,
                                    },
                                  }),
                                "Redemption price updated",
                              )
                            }
                            className="w-full rounded-lg bg-zinc-800 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
                          >
                            Set price
                          </button>
                        </div>
                      )}

                      {detail.leaderId && !detail.isDefault && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleClearLeader(detail.id, detail.name)}
                          className="w-full rounded-lg border border-red-900 bg-red-950/40 py-2.5 text-sm text-red-300 hover:bg-red-900/40 disabled:opacity-50"
                        >
                          Clear Leader
                        </button>
                      )}
                    </div>
                  )}

                  {detailTab === "members" && (
                    <div className="space-y-2">
                      {detail.members.length === 0 ? (
                        <p className="text-sm text-zinc-500">No members</p>
                      ) : (
                        detail.members.map((m) => (
                          <div
                            key={m.userId}
                            className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2.5 text-sm"
                          >
                            <div>
                              <div className="font-medium">
                                {m.username || m.firstName || m.userId}
                                <span className="ml-2 text-xs text-zinc-500">#{m.userId}</span>
                              </div>
                              <div className="text-xs text-zinc-500">
                                {m.role} · weekly {m.weeklyGlory} · glory {m.glory}
                                {m.isTraitor && (
                                  <span className="ml-1 text-red-400">· traitor</span>
                                )}
                              </div>
                            </div>
                            {m.role !== "leader" && (
                              <button
                                disabled={actionLoading}
                                onClick={() =>
                                  runDetailAction(
                                    () =>
                                      adminKickNationMemberFn({
                                        data: {
                                          nationId: detail.id,
                                          userId: m.userId,
                                          reason,
                                        },
                                      }),
                                    `Kicked user ${m.userId}`,
                                  )
                                }
                                className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
                              >
                                Kick
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {detailTab === "history" && (
                    <div className="space-y-2">
                      {detail.history.length === 0 ? (
                        <p className="text-sm text-zinc-500">No history</p>
                      ) : (
                        detail.history.map((h) => (
                          <div
                            key={h.id}
                            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs"
                          >
                            <div className="flex justify-between">
                              <span className="font-mono text-amber-300">{h.event}</span>
                              <span className="text-zinc-500">
                                {new Date(h.createdAt).toLocaleString()}
                              </span>
                            </div>
                            {h.userId && (
                              <div className="mt-0.5 text-zinc-500">user #{h.userId}</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
