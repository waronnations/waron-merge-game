import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyInitData, TelegramAuthError } from "@/lib/telegram-auth.server";

const BOT_TOKEN = "123456:TEST-BOT-TOKEN-abcdef";

function buildInitData(overrides: Record<string, string> = {}, authDate = Math.floor(Date.now() / 1000)) {
  const params: Record<string, string> = {
    auth_date: String(authDate),
    query_id: "AAQ1",
    user: JSON.stringify({ id: 42, first_name: "Test" }),
    ...overrides,
  };
  const entries = Object.entries(params).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const usp = new URLSearchParams(params);
  usp.set("hash", hash);
  return usp.toString();
}

describe("verifyInitData", () => {
  it("verifies a correctly signed initData string", () => {
    const initData = buildInitData();
    const result = verifyInitData(initData, BOT_TOKEN);
    expect(result.user.id).toBe(42);
    expect(result.authDate).toBeGreaterThan(0);
  });

  it("rejects a tampered hash", () => {
    const initData = buildInitData();
    const tampered = initData.replace(/user=[^&]+/, `user=${encodeURIComponent(JSON.stringify({ id: 999 }))}`);
    expect(() => verifyInitData(tampered, BOT_TOKEN)).toThrow(TelegramAuthError);
  });

  it("rejects stale auth_date beyond maxAgeSec", () => {
    const oldAuthDate = Math.floor(Date.now() / 1000) - 100_000;
    const initData = buildInitData({}, oldAuthDate);
    expect(() => verifyInitData(initData, BOT_TOKEN, { maxAgeSec: 3600 })).toThrow(
      "initData expired",
    );
  });

  it("rejects missing hash", () => {
    expect(() => verifyInitData("auth_date=1&user=%7B%7D", BOT_TOKEN)).toThrow(
      "initData missing hash",
    );
  });

  it("rejects empty initData or missing bot token", () => {
    expect(() => verifyInitData("", BOT_TOKEN)).toThrow("Empty initData");
    expect(() => verifyInitData(buildInitData(), "")).toThrow("TELEGRAM_BOT_TOKEN not configured");
  });
});
