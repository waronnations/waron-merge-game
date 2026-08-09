/**
 * Server-only Telegram bot messaging helper.
 * Uses TELEGRAM_BOT_TOKEN.
 *
 * Supports both private user IDs (number) and public groups/channels
 * (string username like "@waronnations").
 */

export interface SendResult {
  ok: boolean;
  status: number;
  error?: string;
}

/** Official community group / channel */
export const WARON_GROUP = "@waronnations";

/**
 * Send a message via the Telegram bot HTTP API.
 * chatId can be a user telegram_id (number) or a public @username / group id (string).
 * Returns { ok, status, error? } — never throws.
 */
export async function sendBotMessage(
  chatId: number | string,
  text: string,
): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, status: 0, error: "TELEGRAM_BOT_TOKEN missing" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: body.slice(0, 300) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "network_error",
    };
  }
}

/**
 * Fire-and-forget announcement into the public @waronnations group.
 * Never throws / never blocks the main game flow.
 */
export function announceToGroup(text: string): void {
  void sendBotMessage(WARON_GROUP, text).catch(() => {
    /* non-fatal */
  });
}
