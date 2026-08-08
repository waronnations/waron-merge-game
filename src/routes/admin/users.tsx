/**
 * Admin Users — search, list, and manage players.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  adminSearchUsersFn,
  adminGetUserFn,
  adminUpdateUserTokensFn,
  adminUpdateUserGloryFn,
  adminClearTraitorFn,
  adminSetBannedFn,
  adminForceLeaveNationFn,
  adminResetBoardFn,
} from "@/lib/admin.functions";
import {
  Search,
  Loader2,
  RefreshCw,
  X,
  Ban,
  ShieldOff,
  Coins,
  Trophy,
  LogOut,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: AdminUsersPage,
});

type UserRow = Awaited<ReturnType<typeof adminSearchUsersFn>>[number];
type UserDetail = NonNullable<Awaited<ReturnType<typeof adminGetUserFn>>>;

function AdminUsersPage() {
  const { q: initialQ } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [query, setQuery] = useState(initialQ);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Token / glory form state
  const [wardogDelta, setWardogDelta] = useState("0");
  const [warcatDelta, setWarcatDelta] = useState("0");
  const [gloryDelta, setGloryDelta] = useState("0");
  const [reason, setReason] = useState("");

  const loadUsers = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminSearchUsersFn({ data: { query: q, limit: 80 } });
      setUsers(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers(initialQ);
  }, [initialQ, loadUsers]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ search: { q: query } });
    loadUsers(query);
  }

  async function openUser(id: number) {
    setSelectedId(id);
    setDetail(null);
    setActionMsg(null);
    setWardogDelta("0");
    setWarcatDelta("0");
    setGloryDelta("0");
    setReason("");
    setDetailLoading(true);
    try {
      const d = await adminGetUserFn({ data: { userId: id } });
      setDetail(d);
    } catch (e: any) {
      setActionMsg(e?.message || "Failed to load user");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setActionMsg(null);
  }

  async function runAction(fn: () => Promise<any>, successMsg: string) {
    if (!reason.trim()) {
      setActionMsg("Reason is required for all admin actions.");
      return;
    }
    setActionLoading(true);
    setActionMsg(null);
    try {
      const updated = await fn();
      setDetail(updated);
      setActionMsg(successMsg);
      // refresh list row
      await loadUsers(query);
    } catch (e: any) {
      setActionMsg(`Error: ${e?.message || "failed"}`);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-zinc-400">Search and manage players</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, telegram ID, username, wallet, referral code…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-amber-500/50"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => loadUsers(query)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </form>

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
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Nation</th>
              <th className="px-4 py-3 font-medium">Glory</th>
              <th className="px-4 py-3 font-medium">Tokens</th>
              <th className="px-4 py-3 font-medium">Flags</th>
              <th className="px-4 py-3 font-medium">Last login</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-500" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => openUser(u.id)}
                  className="cursor-pointer border-t border-zinc-800/80 transition hover:bg-zinc-900/60"
                >
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">{u.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.username || u.firstName || "—"}</div>
                    {u.walletAddress && (
                      <div className="text-xs text-zinc-500">
                        {u.walletAddress.slice(0, 6)}…{u.walletAddress.slice(-4)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {u.nationTag ? `${u.nationTag}` : "—"}
                  </td>
                  <td className="px-4 py-3">{u.glory.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="text-amber-400">{u.wardogTokens.toFixed(1)}</span>
                    {" / "}
                    <span className="text-cyan-400">{u.warcatTokens.toFixed(1)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.isTraitor && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">
                          traitor
                        </span>
                      )}
                      {u.isBanned && (
                        <span className="rounded bg-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300">
                          banned
                        </span>
                      )}
                      {u.isAdmin && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                          admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail drawer / modal */}
      {selectedId !== null && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <h2 className="text-lg font-semibold">User #{selectedId}</h2>
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
                  {/* Profile */}
                  <div>
                    <div className="text-xl font-bold">
                      {detail.username || detail.firstName || "Unknown"}
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                      TG: {detail.telegramId} · Created{" "}
                      {new Date(detail.createdAt).toLocaleDateString()}
                    </div>
                    {detail.walletAddress && (
                      <div className="mt-1 break-all font-mono text-xs text-zinc-500">
                        {detail.walletAddress}
                      </div>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-zinc-900 p-3">
                      <div className="text-zinc-500">Glory</div>
                      <div className="text-lg font-semibold">{detail.glory.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg bg-zinc-900 p-3">
                      <div className="text-zinc-500">Merges</div>
                      <div className="text-lg font-semibold">{detail.totalMerges.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg bg-zinc-900 p-3">
                      <div className="text-zinc-500">$WARDOG</div>
                      <div className="text-lg font-semibold text-amber-400">
                        {detail.wardogTokens.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-zinc-900 p-3">
                      <div className="text-zinc-500">$WARCAT</div>
                      <div className="text-lg font-semibold text-cyan-400">
                        {detail.warcatTokens.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Nation & flags */}
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-zinc-500">Nation: </span>
                      {detail.nationName ? (
                        <span>
                          {detail.nationEmblem} {detail.nationName} ({detail.nationTag})
                        </span>
                      ) : (
                        "None"
                      )}
                    </div>
                    {detail.leaderships.length > 0 && (
                      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
                        <div className="mb-1 flex items-center gap-1 text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Leaderships ({detail.leaderships.length})
                        </div>
                        {detail.leaderships.map((l) => (
                          <div key={l.id} className="text-xs text-zinc-300">
                            {l.emblem} {l.name} ({l.tag}) — {l.memberCount} members
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {detail.isTraitor && (
                        <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                          Traitor {detail.traitorReason ? `· ${detail.traitorReason}` : ""}
                        </span>
                      )}
                      {detail.isBanned && (
                        <span className="rounded bg-zinc-600 px-2 py-0.5 text-xs">Banned</span>
                      )}
                    </div>
                  </div>

                  {/* Reason (required) */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-400">
                      Reason (required for all actions)
                    </label>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why are you doing this?"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-amber-500/50"
                    />
                  </div>

                  {/* Token adjust */}
                  <div className="rounded-xl border border-zinc-800 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <Coins className="h-4 w-4 text-amber-400" /> Adjust Tokens
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={wardogDelta}
                        onChange={(e) => setWardogDelta(e.target.value)}
                        placeholder="WARDOG ±"
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={warcatDelta}
                        onChange={(e) => setWarcatDelta(e.target.value)}
                        placeholder="WARCAT ±"
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      disabled={actionLoading}
                      onClick={() =>
                        runAction(
                          () =>
                            adminUpdateUserTokensFn({
                              data: {
                                userId: detail.id,
                                wardogDelta: Number(wardogDelta) || 0,
                                warcatDelta: Number(warcatDelta) || 0,
                                reason,
                              },
                            }),
                          "Tokens updated",
                        )
                      }
                      className="mt-2 w-full rounded-lg bg-zinc-800 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
                    >
                      Apply token change
                    </button>
                  </div>

                  {/* Glory adjust */}
                  <div className="rounded-xl border border-zinc-800 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <Trophy className="h-4 w-4 text-yellow-400" /> Adjust Glory
                    </div>
                    <input
                      type="number"
                      value={gloryDelta}
                      onChange={(e) => setGloryDelta(e.target.value)}
                      placeholder="Glory ±"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    />
                    <button
                      disabled={actionLoading}
                      onClick={() =>
                        runAction(
                          () =>
                            adminUpdateUserGloryFn({
                              data: {
                                userId: detail.id,
                                gloryDelta: Number(gloryDelta) || 0,
                                reason,
                              },
                            }),
                          "Glory updated",
                        )
                      }
                      className="mt-2 w-full rounded-lg bg-zinc-800 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
                    >
                      Apply glory change
                    </button>
                  </div>

                  {/* Quick actions */}
                  <div className="space-y-2">
                    {detail.isTraitor && (
                      <button
                        disabled={actionLoading}
                        onClick={() =>
                          runAction(
                            () =>
                              adminClearTraitorFn({
                                data: { userId: detail.id, reason },
                              }),
                            "Traitor status cleared",
                          )
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 py-2.5 text-sm text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50"
                      >
                        <ShieldOff className="h-4 w-4" /> Clear Traitor
                      </button>
                    )}

                    <button
                      disabled={actionLoading}
                      onClick={() =>
                        runAction(
                          () =>
                            adminForceLeaveNationFn({
                              data: { userId: detail.id, reason },
                            }),
                          "Forced leave + cleared leaderships",
                        )
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4" /> Force Leave Nation
                    </button>

                    <button
                      disabled={actionLoading}
                      onClick={() =>
                        runAction(
                          () =>
                            adminResetBoardFn({
                              data: { userId: detail.id, reason },
                            }),
                          "Board reset",
                        )
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" /> Reset Board
                    </button>

                    <button
                      disabled={actionLoading}
                      onClick={() =>
                        runAction(
                          () =>
                            adminSetBannedFn({
                              data: {
                                userId: detail.id,
                                banned: !detail.isBanned,
                                reason,
                              },
                            }),
                          detail.isBanned ? "User unbanned" : "User banned",
                        )
                      }
                      className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm disabled:opacity-50 ${
                        detail.isBanned
                          ? "border border-emerald-800 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40"
                          : "border border-red-900 bg-red-950/40 text-red-300 hover:bg-red-900/40"
                      }`}
                    >
                      <Ban className="h-4 w-4" />
                      {detail.isBanned ? "Unban User" : "Ban User"}
                    </button>
                  </div>

                  {actionMsg && (
                    <div
                      className={`rounded-lg px-3 py-2 text-sm ${
                        actionMsg.startsWith("Error")
                          ? "bg-red-950/40 text-red-300"
                          : "bg-emerald-950/40 text-emerald-300"
                      }`}
                    >
                      {actionMsg}
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
