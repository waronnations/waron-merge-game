/**
 * Server-only Telegram bot messaging helper.
 * Uses TELEGRAM_BOT_TOKEN.
 */

export interface SendResult {
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * Send a message via the Telegram bot HTTP API.
 * Returns { ok, status, error? } — never throws.
 */
export async function sendBotMessage(
  chatId: number,
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
