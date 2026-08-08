import { getSession, useSession } from "@tanstack/react-start/server";

export interface WonSession {
  userId?: number;
  telegramId?: number;
  // Admin session fields (pure web admin dashboard)
  isAdmin?: boolean;
  adminWallet?: string;
}

function sessionPassword(): string {
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV !== "production") {
      return "dev-session-secret-must-be-at-least-32-chars-long!!";
    }
    throw new Error(
      "SESSION_SECRET must be set to a 32+ char random string in Vercel env vars.",
    );
  }
  return raw;
}

export const SESSION_NAME = "won-session";

/**
 * Telegram Mini Apps run inside a cross-site iframe (t.me / web.telegram.org).
 * SameSite=Lax/Strict cookies are dropped → session lost on desktop Web.
 * SameSite=None; Secure is required for the cookie to be sent in that context.
 */
export function sessionConfig() {
  const isProd = process.env.NODE_ENV === "production";

  return {
    password: sessionPassword(),
    name: SESSION_NAME,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    cookie: {
      httpOnly: true,
      // None + Secure: required for Telegram Web / Mini App iframe
      sameSite: (isProd ? "none" : "lax") as "none" | "lax",
      secure: isProd ? true : false,
      path: "/",
    },
  };
}

export function readSession() {
  return getSession<WonSession>(sessionConfig());
}

export function mutableSession() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- TanStack Start session helper
  return useSession<WonSession>(sessionConfig());
}
