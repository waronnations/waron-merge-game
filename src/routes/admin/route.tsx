/**
 * Admin layout — pure web, wallet-gated.
 * Path: /admin/*
 *
 * TonConnect hooks live only in AdminLayoutClient, after client mount,
 * so we never hit TonConnectProviderNotSetError during SSR / ClientOnly fallback.
 */

import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useTonAddress, useTonConnectUI, TonConnectButton } from "@tonconnect/ui-react";
import {
  getAdminSessionFn,
  adminLoginFn,
  adminLogoutFn,
} from "@/lib/admin.functions";
import {
  LayoutDashboard,
  Users,
  Flag,
  ScrollText,
  Wrench,
  LogOut,
  Shield,
  Loader2,
  Coins,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV: ReadonlyArray<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/nations", label: "Nations", icon: Flag },
  { to: "/admin/economy", label: "Economy", icon: Coins },
  { to: "/admin/logs", label: "Audit Logs", icon: ScrollText },
  { to: "/admin/tools", label: "Tools", icon: Wrench },
];

/** Outer shell — no TonConnect hooks */
function AdminLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return <AdminLayoutClient />;
}

/** Inner — safe to use TonConnect (provider is mounted under ClientOnly) */
function AdminLayoutClient() {
  const address = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const [session, setSession] = useState<{
    isAdmin: boolean;
    wallet: string | null;
    userId: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getAdminSessionFn();
        if (!cancelled) setSession(s);
      } catch {
        if (!cancelled) setSession({ isAdmin: false, wallet: null, userId: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tryAdminLogin = useCallback(async (wallet: string) => {
    setLoggingIn(true);
    setLoginError(null);
    try {
      await adminLoginFn({ data: { wallet } });
      const s = await getAdminSessionFn();
      setSession(s);
      if (!s.isAdmin) {
        setLoginError(
          "Wallet connected but not authorized. Check ADMIN_WALLETS env variable.",
        );
      }
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      if (msg.includes("wallet_not_allowed")) {
        setLoginError(
          "This wallet is not in ADMIN_WALLETS. Add it in Vercel / .env and restart.",
        );
      } else {
        setLoginError(msg || "Login failed.");
      }
      setSession({ isAdmin: false, wallet: null, userId: null });
    } finally {
      setLoggingIn(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (session?.isAdmin) return;
    if (!address) return;
    if (loggingIn) return;

    void tryAdminLogin(address);
  }, [address, loading, session?.isAdmin, loggingIn, tryAdminLogin]);

  async function handleLogout() {
    try {
      await adminLogoutFn();
      setSession({ isAdmin: false, wallet: null, userId: null });
      setLoginError(null);
      await tonConnectUI.disconnect();
    } catch {
      // ignore
    }
  }

  function openConnectModal() {
    setLoginError(null);
    void tonConnectUI.openModal();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!session?.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl">
          <div className="mb-6 flex items-center justify-center gap-3">
            <Shield className="h-10 w-10 text-amber-500" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">War On Nations</h1>
              <p className="text-sm text-zinc-400">Admin Dashboard</p>
            </div>
          </div>

          <p className="mb-6 text-center text-sm text-zinc-400">
            Connect an authorized TON wallet to continue.
            <br />
            <span className="text-xs text-zinc-500">
              Allowed wallets are set via the{" "}
              <code className="text-amber-500/80">ADMIN_WALLETS</code> env variable.
            </span>
          </p>

          <button
            type="button"
            onClick={openConnectModal}
            disabled={loggingIn}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {loggingIn ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" />
                {address ? "Retry admin login" : "Connect Wallet"}
              </>
            )}
          </button>

          <div className="flex justify-center">
            <TonConnectButton />
          </div>

          {address && (
            <p className="mt-4 text-center text-xs text-zinc-500">
              Connected:{" "}
              <span className="font-mono text-zinc-300">
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
            </p>
          )}

          {loginError && (
            <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-center text-sm text-red-300">
              {loginError}
            </div>
          )}

          {!address && !loginError && (
            <p className="mt-4 text-center text-xs text-zinc-600">
              No wallet connected yet. Click the button above.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-zinc-800 bg-zinc-900">
        <div className="flex h-16 items-center gap-2 border-b border-zinc-800 px-5">
          <Shield className="h-6 w-6 text-amber-500" />
          <div>
            <div className="text-sm font-bold leading-none">WON Admin</div>
            <div className="mt-0.5 text-[10px] text-zinc-500">War On Nations</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = item.exact
              ? currentPath === item.to || currentPath === `${item.to}/`
              : currentPath.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-amber-500/15 text-amber-400"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <div className="mb-3 truncate text-xs text-zinc-500">
            {session.wallet?.slice(0, 8)}…{session.wallet?.slice(-6)}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="ml-60 flex-1 min-h-screen">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
