/**
 * Admin server functions (TanStack Start) — barrel.
 * All mutations require a valid admin session (wallet in ADMIN_WALLETS).
 * Implementation lives in src/lib/admin/*.functions.ts.
 */

export * from "./admin/auth.functions";
export * from "./admin/dashboard.functions";
export * from "./admin/users.functions";
export * from "./admin/nations.functions";
export * from "./admin/logs.functions";
export * from "./admin/economy.functions";
