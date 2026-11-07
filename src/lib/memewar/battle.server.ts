import { Address, Cell, beginCell, loadMessage } from "@ton/core";
import { requireUserId } from "@/lib/auth.server";
import { sql } from "@/lib/db/client.server";
import { CLAIM_TREASURY } from "@/lib/onchain/contracts";
import { MEMEWAR_INTENT_TTL_MS } from "@/lib/constants/memewar";
import { aggregateQuote } from "./aggregator/index.server";
import { getWalletHoldings, rawAddr } from "./tonapi.server";
import { eligibleTaxCoins, orderBattle, seasonPoints, swapAmount, toUnits, warTaxAmount, ACTION_META, seasonWindow } from "./war-math";
import { settledBattle, type BattleEvidence } from "./battle-evidence";
import { ensureWarSchema } from "./season.server";
import type { WarAction } from "./types";

export async function prepareBattle(input: { owner: string; from: string; to: string; action: WarAction; taxMaster: string; slippage: number }) {
  const userId = await requireUserId();
  await ensureWarSchema();
  const holdings = await getWalletHoldings(input.owner);
  const weak = holdings.find(h => rawAddr(h.coin.master) === rawAddr(input.from));
  const strong = input.to === "TON" ? null : holdings.find(h => rawAddr(h.coin.master) === rawAddr(input.to));
  if (!weak || (input.action !== "retreat" && (!strong || orderBattle(weak, strong).weak !== weak))) throw new Error("holdings_changed");
  const tax = eligibleTaxCoins(holdings, weak.usd * ACTION_META[input.action].share).find(h => rawAddr(h.coin.master) === rawAddr(input.taxMaster));
  if (!tax) throw new Error("tax_balance_changed");
  const taxAmount = warTaxAmount(weak.usd * ACTION_META[input.action].share, tax);
  if (taxAmount === null) throw new Error("tax_price_unavailable");
  const amount = swapAmount(input.action, weak, tax.coin.master, taxAmount);
  const units = toUnits(amount, weak.coin.decimals).toString();
  const quote = await aggregateQuote({ offerMaster: weak.coin.master, offerSymbol: weak.coin.symbol, offerDecimals: weak.coin.decimals, askMaster: input.to, askSymbol: strong?.coin.symbol ?? "TON", askDecimals: strong?.coin.decimals ?? 9, offerUnits: units, slippage: input.slippage });
  const execution = quote.execution;
  if (quote.mode !== "live" || !execution?.stonfi || !execution.executable) throw new Error("route_not_executable");
  const id = crypto.randomUUID();
  const payload = { owner: rawAddr(input.owner), router: rawAddr(execution.stonfi.routerAddress), from: rawAddr(weak.coin.master), to: input.to === "TON" ? "TON" : rawAddr(input.to), units, minOut: execution.minAskUnits, taxMaster: rawAddr(tax.coin.master), taxUnits: toUnits(taxAmount, tax.coin.decimals).toString(), treasury: rawAddr(CLAIM_TREASURY.address), createdAt: Date.now(), action: input.action, fromSymbol: weak.coin.symbol, toSymbol: strong?.coin.symbol ?? "TON", toImage: strong?.coin.image ?? null, fromAmount: amount, usd: amount * weak.coin.priceUsd };
  await sql`INSERT INTO memewar_intents (id, user_id, payload) VALUES (${id}, ${userId}, ${JSON.stringify(payload)}::jsonb)`;
  return { id, execution, tax: { master: tax.coin.master, units: payload.taxUnits }, expiresAt: payload.createdAt + MEMEWAR_INTENT_TTL_MS };
}

export async function confirmBattle(id: string, txBoc?: string) {
  const userId = await requireUserId();
  await ensureWarSchema();
  const { rows } = await sql`SELECT payload, message_hash, status, event_id FROM memewar_intents WHERE id = ${id} AND user_id = ${userId}`;
  const row = rows[0];
  if (!row) throw new Error("battle_not_found");
  if (row.status === "confirmed") return { status: "confirmed" as const, eventId: String(row.event_id) };
  const expected = row.payload as Parameters<typeof settledBattle>[1] & { action: WarAction; fromSymbol: string; toSymbol: string; toImage: string | null; fromAmount: number; usd: number };
  let hash = row.message_hash ? String(row.message_hash) : null;
  if (txBoc) {
    const cell = Cell.fromBase64(txBoc);
    const message = loadMessage(cell.beginParse());
    if (message.info.type !== "external-in" || !message.info.dest.equals(Address.parse(expected.owner))) throw new Error("wallet_message_mismatch");
    // Normalized external hash is the indexer's stable lookup key.
    const normalized = beginCell().storeUint(2, 2).storeUint(0, 2).storeAddress(message.info.dest).storeCoins(0).storeBit(false).storeBit(true).storeRef(message.body).endCell().hash().toString("hex");
    if (hash && hash !== normalized) throw new Error("battle_already_submitted");
    hash = normalized;
    await sql`UPDATE memewar_intents SET message_hash = ${hash} WHERE id = ${id} AND user_id = ${userId} AND message_hash IS NULL`;
  }
  if (!hash) return { status: "pending" as const, eventId: null };
  const key = process.env.TONAPI_KEY;
  const res = await fetch(`https://tonapi.io/v2/events/${hash}`, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return { status: "pending" as const, eventId: hash };
  if (!res.ok) throw new Error("confirmation_service_unavailable");
  const event = await res.json() as BattleEvidence;
  const status = settledBattle(event, expected);
  if (status !== "confirmed") return { status, eventId: event.event_id };
  const window = seasonWindow(event.timestamp * 1000);
  // Atomic canonical insert + settlement; globally unique event prevents replay.
  await sql`WITH added AS (
    INSERT INTO memewar_merges (season, wallet, tx_boc_hash, action, from_master, to_master, to_symbol, to_image, usd, points, verified, user_id, from_symbol, from_amount, created_at)
    VALUES (${window.id}, ${expected.owner}, ${event.event_id}, ${expected.action}, ${expected.from}, ${expected.to}, ${expected.toSymbol}, ${expected.toImage}, ${expected.usd}, ${seasonPoints(expected.action, expected.usd)}, TRUE, ${userId}, ${expected.fromSymbol}, ${expected.fromAmount}, ${new Date(event.timestamp * 1000).toISOString()})
    ON CONFLICT (tx_boc_hash) DO NOTHING RETURNING id
  ) UPDATE memewar_intents SET status = 'confirmed', event_id = ${event.event_id} WHERE id = ${id} AND user_id = ${userId}`;
  return { status: "confirmed" as const, eventId: event.event_id };
}