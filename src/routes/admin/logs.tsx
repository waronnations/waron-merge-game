/**
 * Admin Audit Logs — every admin action is recorded here.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { adminGetAuditLogFn } from "@/lib/admin.functions";
import { Loader2, RefreshCw, ScrollText } from "lucide-react";

export const Route = createFileRoute("/admin/logs")({
  component: AdminLogsPage,
});

type LogRow = Awaited<ReturnType<typeof adminGetAuditLogFn>>[number];

function AdminLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 100;

  async function load(newOffset = 0) {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGetAuditLogFn({
        data: { limit, offset: newOffset },
      });
      setLogs(data);
      setOffset(newOffset);
    } catch (e: any) {
      setError(e?.message || "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(0);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Every admin action is permanently recorded
          </p>
        </div>
        <button
          onClick={() => load(offset)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/80 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Admin</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-500" />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                  <ScrollText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No audit entries yet
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t border-zinc-800/80 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-zinc-300">
                      {log.adminWallet.slice(0, 6)}…{log.adminWallet.slice(-4)}
                    </div>
                    {log.adminUserId && (
                      <div className="text-[10px] text-zinc-600">user #{log.adminUserId}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-amber-300">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {log.targetType ? (
                      <>
                        <span className="text-zinc-500">{log.targetType}</span>
                        {log.targetId && (
                          <span className="ml-1 font-mono text-zinc-300">#{log.targetId}</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[180px] px-4 py-3 text-xs text-zinc-400">
                    {log.reason || "—"}
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-zinc-900/80 p-2 font-mono text-[10px] text-zinc-500">
                      {JSON.stringify(log.details, null, 0)}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          disabled={offset === 0 || loading}
          onClick={() => load(Math.max(0, offset - limit))}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-xs text-zinc-500">
          Showing {offset + 1}–{offset + logs.length}
        </span>
        <button
          disabled={logs.length < limit || loading}
          onClick={() => load(offset + limit)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
