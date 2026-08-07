import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface VerifiedInitData {
  user: TelegramUser;
  authDate: number;
  startParam?: string;
  queryId?: string;
}

export class TelegramAuthError extends Error {}

export function verifyInitData(
  initData: string,
  botToken: string,
  { maxAgeSec = 24 * 60 * 60 }: { maxAgeSec?: number } = {},
): VerifiedInitData {
  if (!initData) throw new TelegramAuthError("Empty initData");
  if (!botToken) throw new TelegramAuthError("TELEGRAM_BOT_TOKEN not configured");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new TelegramAuthError("initData missing hash");
  params.delete("hash");

  const pairs: string[] = [];
  const entries = Array.from(params.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [k, v] of entries) pairs.push(`${k}=${v}`);
  const dataCheckString = pairs.join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new TelegramAuthError("initData signature mismatch");
  }

  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number(authDateRaw) : NaN;
  if (!Number.isFinite(authDate)) throw new TelegramAuthError("initData missing auth_date");
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (ageSec > maxAgeSec) throw new TelegramAuthError("initData expired");

  const userRaw = params.get("user");
  if (!userRaw) throw new TelegramAuthError("initData missing user");
  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    throw new TelegramAuthError("initData user is not JSON");
  }
  if (!user || typeof user.id !== "number") {
    throw new TelegramAuthError("initData user missing numeric id");
  }

  return {
    user,
    authDate,
    startParam: params.get("start_param") ?? undefined,
    queryId: params.get("query_id") ?? undefined,
  };
}
