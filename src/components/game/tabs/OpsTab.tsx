// src/components/game/tabs/OpsTab.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Crosshair,
  RefreshCw,
  ShoppingBag,
  Swords,
  History,
  Loader2,
  Radio,
  Shield,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { TabHero } from "@/components/game/TabHero";
import { TasksPanel, DailyQuestsPanel } from "@/components/Panels";
import type { GameState } from "@/lib/game-state";
import { haptic } from "@/lib/telegram";
import {
  BATTLEFIELD_WEAPONS,
  type BattlefieldWeaponId,
} from "@/lib/constants";
import {
  getBattlefieldInventoryFn,
  getBattlefieldArmoryQuotesFn,
  buyBattlefieldWeaponFn,
  battlefieldStrikeFn,
  listOpsHistoryFn,
  listOpsKillFeedFn,
  lookupBattlefieldTargetFn,
} from "@/lib/battlefield.functions";

type PayToken = "wardog" | "warcat";

type InvState = {
  weapons: Record<string, number>;
  cooldowns: Record<string, number>;
  attacksToday: number;
  dailyAttackCap: number;
};

type Quote = {
  weaponId: BattlefieldWeaponId;
  base: number;
  final: number;
  tax: number;
  multiplier: number;
  zone: string;
};

type HistoryRow = {
  id: number;
  weaponId: string;
  hit: boolean;
  victimTelegramId: number | null;
  gloryGained: number;
  tokenReward: number;
  createdAt: number;
  details: Record<string, unknown>;
};

type FeedRow = {
  id: number;
  weaponId: string;
  hit: boolean;
  attackerName: string;
  victimName: string;
  gloryGained: number;
  createdAt: number;
};

type TargetPreview = {
  displayName: string;
  telegramId: number;
  protected: boolean;
};

const WEAPON_IDS = Object.keys(BATTLEFIELD_WEAPONS) as BattlefieldWeaponId[];

function formatCooldown(readyAt: number): string {
  const ms = readyAt - Date.now();
  if (ms <= 0) return "Ready";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtToken(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n >= 10 ? n.toFixed(1) : n.toFixed(2);
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function OpsTab({
  state,
  missionsBadge,
  onClaimDailyQuest,
  onClaimTask,
}: {
  state: GameState;
  missionsBadge: number;
  onClaimDailyQuest: (id: string) => void;
  onClaimTask: (id: string) => void;
}) {
  const [inv, setInv] = useState<InvState | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [preview, setPreview] = useState<TargetPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [strikeWeapon, setStrikeWeapon] = useState<BattlefieldWeaponId>("knife");
  const [tick, setTick] = useState(0);

  const quoteMap = useMemo(() => {
    const m = new Map<string, Quote>();
    for (const q of quotes) m.set(q.weaponId, q);
    return m;
  }, [quotes]);

  const refresh = useCallback(async () => {
    try {
      const [i, q, h, f] = await Promise.all([
        getBattlefieldInventoryFn(),
        getBattlefieldArmoryQuotesFn(),
        listOpsHistoryFn({ data: { limit: 20 } }),
        listOpsKillFeedFn({ data: { limit: 12 } }),
      ]);
      setInv(i);
      setQuotes(q as Quote[]);
      setHistory(h as HistoryRow[]);
      setFeed(f as FeedRow[]);
    } catch {
      /* offline / unauth */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Debounced target preview
  useEffect(() => {
    const q = targetInput.trim();
    if (q.length < 2) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await lookupBattlefieldTargetFn({ data: { query: q } });
        if (cancelled) return;
        if (res.ok) {
          setPreview({
            displayName: res.displayName,
            telegramId: res.telegramId,
            protected: res.protected,
          });
          setPreviewError(null);
        } else {
          setPreview(null);
          setPreviewError(
            res.error === "target_not_found"
              ? "Player not found in War On Nations"
              : res.error === "invalid_target"
                ? "Enter Telegram ID or @username"
                : "Lookup failed",
          );
        }
      } catch {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(null);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [targetInput]);

  const handleBuy = async (weaponId: BattlefieldWeaponId, payWith: PayToken) => {
    if (busy) return;
    setBusy(`buy:${weaponId}:${payWith}`);
    try {
      const res = await buyBattlefieldWeaponFn({
        data: { weaponId, payWith },
      });
      haptic("medium");
      toast.success(
        `${BATTLEFIELD_WEAPONS[weaponId].name} acquired · paid ${fmtToken(res.cost)} (tax ${fmtToken(res.tax)})`,
      );
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("insufficient_spendable")) {
        toast.error("Need topped-up balance — use Top Up");
      } else if (msg.includes("unauthorized")) {
        toast.error("Sign in via Telegram first");
      } else {
        toast.error("Purchase failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleStrike = async () => {
    if (busy) return;
    const target = targetInput.trim();
    if (target.length < 1) {
      toast.error("Enter Telegram ID or @username");
      return;
    }
    if (preview?.protected) {
      toast.error("Target nation is protected");
      return;
    }
    setBusy("strike");
    try {
      const res = await battlefieldStrikeFn({
        data: { target, weaponId: strikeWeapon },
      });
      haptic(res.hit ? "heavy" : "light");
      if (res.hit) {
        toast.success(
          `HIT · ${res.victimName ?? "target"} · +${res.gloryGained} glory · +${fmtToken(res.tokenReward)} tokens`,
        );
      } else {
        toast.message(`Miss on ${res.victimName ?? "target"} — weapon spent`);
      }
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("no_weapon")) toast.error("No ammo — buy a weapon first");
      else if (msg.includes("cooldown")) toast.error("Weapon on cooldown");
      else if (msg.includes("daily_cap")) toast.error("Daily attack cap reached");
      else if (msg.includes("target_not_found"))
        toast.error("Target not in War On Nations yet");
      else if (msg.includes("cannot_attack_self"))
        toast.error("Cannot attack yourself");
      else if (msg.includes("target_protected"))
        toast.error("Target nation is protected");
      else if (msg.includes("unauthorized"))
        toast.error("Sign in via Telegram first");
      else toast.error("Strike failed");
    } finally {
      setBusy(null);
    }
  };

  void tick;

  const zoneLabel = quotes[0]?.zone
    ? `Treasury ${quotes[0].zone} · ×${fmtToken(quotes[0].multiplier)}`
    : null;

  return (
    <>
      <TabHero tab="ops" />

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-red-400" />
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">
              Battlefield
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>

        <div className="rounded-xl border border-red-500/25 bg-red-950/20 px-3 py-2 text-[0.65rem] leading-relaxed text-red-100/80">
          Weapons cost <strong className="text-red-200">topped-up</strong>{" "}
          $WARDOG / $WARCAT — dynamic tax feeds Claim Treasury
          {zoneLabel ? ` (${zoneLabel})` : ""}. Strike by{" "}
          <strong className="text-red-200">Telegram ID</strong> or{" "}
          <strong className="text-red-200">@username</strong>. Protected nations
          cannot be hit.
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : (
          <>
            {/* Kill feed */}
            <div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <Radio className="h-3.5 w-3.5 text-amber-400" />
                <h3 className="text-[0.65rem] font-black uppercase tracking-widest text-zinc-500">
                  Kill feed
                </h3>
              </div>
              {feed.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 py-4 text-center text-xs text-zinc-500">
                  No confirmed hits yet — open the armory
                </div>
              ) : (
                <div className="max-h-40 space-y-1.5 overflow-y-auto">
                  {feed.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-2.5 py-1.5 text-[0.65rem]"
                    >
                      <span className="font-black text-emerald-400">HIT</span>
                      <span className="truncate text-zinc-300">
                        <span className="text-white">{row.attackerName}</span>
                        {" → "}
                        <span className="text-zinc-400">{row.victimName}</span>
                        {" · "}
                        {row.weaponId}
                      </span>
                      <span className="ml-auto shrink-0 text-zinc-600">
                        {timeAgo(row.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Armory */}
            <div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <ShoppingBag className="h-3.5 w-3.5 text-amber-400" />
                <h3 className="text-[0.65rem] font-black uppercase tracking-widest text-zinc-500">
                  Armory · spendable only
                </h3>
              </div>
              <div className="space-y-3">
                {WEAPON_IDS.map((id) => {
                  const w = BATTLEFIELD_WEAPONS[id];
                  const owned = inv?.weapons[id] ?? 0;
                  const cd = inv?.cooldowns[id] ?? 0;
                  const q = quoteMap.get(id);
                  const price = q?.final ?? w.cost;
                  const tax = q?.tax ?? 0;
                  return (
                    <div
                      key={id}
                      className="rounded-2xl border border-zinc-700 bg-zinc-900/90 p-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-xl bg-black/40 text-xl">
                          {w.emoji === "Rifle" ? "🪖" : w.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-black text-white">
                            {w.name}
                          </div>
                          <div className="text-xs text-zinc-400">{w.desc}</div>
                          <div className="mt-1 text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
                            Hit {Math.round(w.hitChance * 100)}% · CD{" "}
                            {w.cooldownSec}s · Own {owned}
                            {cd > Date.now()
                              ? ` · ${formatCooldown(cd)}`
                              : ""}
                          </div>
                          <div className="mt-0.5 text-[0.6rem] text-zinc-500">
                            Base {fmtToken(w.cost)}
                            {tax > 0
                              ? ` + tax ${fmtToken(tax)} = ${fmtToken(price)}`
                              : ` = ${fmtToken(price)}`}
                            {q ? ` · ${q.zone}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() => void handleBuy(id, "wardog")}
                          className="rounded-xl border border-red-500/50 bg-red-950/40 py-2.5 text-[0.65rem] font-black uppercase tracking-wider text-red-300 disabled:opacity-40"
                        >
                          {busy === `buy:${id}:wardog` ? (
                            <RefreshCw className="mx-auto h-3.5 w-3.5 animate-spin" />
                          ) : (
                            `$WARDOG · ${fmtToken(price)}`
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() => void handleBuy(id, "warcat")}
                          className="rounded-xl border border-violet-500/50 bg-violet-950/40 py-2.5 text-[0.65rem] font-black uppercase tracking-wider text-violet-300 disabled:opacity-40"
                        >
                          {busy === `buy:${id}:warcat` ? (
                            <RefreshCw className="mx-auto h-3.5 w-3.5 animate-spin" />
                          ) : (
                            `$WARCAT · ${fmtToken(price)}`
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Strike */}
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900/90 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-red-400" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">
                  Strike
                </h3>
                <span className="ml-auto text-[0.6rem] font-bold text-zinc-500">
                  {inv?.attacksToday ?? 0}/{inv?.dailyAttackCap ?? 40} today
                </span>
              </div>

              <label className="mb-1 block text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
                Target · Telegram ID or @username
              </label>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="123456789 or @username"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="w-full rounded-xl border border-zinc-600 bg-zinc-950 py-2.5 pl-9 pr-3 font-mono text-sm text-white outline-none focus:border-red-500/60"
                />
              </div>

              {previewLoading && (
                <div className="mb-2 text-[0.65rem] text-zinc-500">
                  Looking up…
                </div>
              )}
              {preview && (
                <div
                  className={`mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                    preview.protected
                      ? "border-sky-500/40 bg-sky-950/30 text-sky-200"
                      : "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
                  }`}
                >
                  {preview.protected ? (
                    <Shield className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Crosshair className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="font-bold">{preview.displayName}</span>
                  <span className="text-[0.6rem] opacity-70">
                    tg:{preview.telegramId}
                  </span>
                  {preview.protected && (
                    <span className="ml-auto text-[0.6rem] font-black uppercase">
                      Protected
                    </span>
                  )}
                </div>
              )}
              {previewError && (
                <div className="mb-3 text-[0.65rem] text-amber-400/90">
                  {previewError}
                </div>
              )}

              <label className="mb-1 block text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
                Weapon
              </label>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {WEAPON_IDS.map((id) => {
                  const owned = inv?.weapons[id] ?? 0;
                  const selected = strikeWeapon === id;
                  const cd = inv?.cooldowns[id] ?? 0;
                  const onCd = cd > Date.now();
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setStrikeWeapon(id)}
                      className={`rounded-xl border py-2 text-[0.6rem] font-black uppercase tracking-wider ${
                        selected
                          ? "border-red-500/60 bg-red-950/40 text-red-300"
                          : "border-zinc-700 bg-zinc-950 text-zinc-400"
                      }`}
                    >
                      {BATTLEFIELD_WEAPONS[id].name.split(" ").pop()} · {owned}
                      {onCd ? " ⏳" : ""}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!!busy || !!preview?.protected}
                onClick={() => void handleStrike()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-black uppercase tracking-wider text-white hover:bg-red-500 disabled:opacity-40"
              >
                {busy === "strike" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Crosshair className="h-4 w-4" />
                )}
                {busy === "strike"
                  ? "Engaging…"
                  : preview?.protected
                    ? "Target protected"
                    : "Execute strike"}
              </button>
            </div>

            {/* Personal history */}
            <div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <History className="h-3.5 w-3.5 text-zinc-400" />
                <h3 className="text-[0.65rem] font-black uppercase tracking-widest text-zinc-500">
                  Your operations
                </h3>
              </div>
              {history.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 py-6 text-center text-xs text-zinc-500">
                  No strikes yet
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2"
                    >
                      <span
                        className={`text-[0.65rem] font-black uppercase ${
                          row.hit ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        {row.hit ? "HIT" : "MISS"}
                      </span>
                      <span className="truncate text-xs text-zinc-300">
                        {row.weaponId}
                        {row.details?.victimName
                          ? ` → ${String(row.details.victimName)}`
                          : row.victimTelegramId
                            ? ` → ${row.victimTelegramId}`
                            : ""}
                      </span>
                      <span className="ml-auto shrink-0 text-[0.6rem] text-zinc-500">
                        {row.hit
                          ? `+${row.gloryGained}g · +${fmtToken(row.tokenReward)}`
                          : timeAgo(row.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Missions */}
      <div className="mt-6 space-y-3 border-t border-zinc-800 pt-4">
        <h3 className="px-1 text-[0.65rem] font-black uppercase tracking-widest text-zinc-500">
          Missions
        </h3>
        {missionsBadge > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-[0.7rem] font-black uppercase tracking-wider text-amber-300">
            {missionsBadge} reward{missionsBadge === 1 ? "" : "s"} ready — scroll
            & tap Claim
          </div>
        )}
        <DailyQuestsPanel state={state} onClaim={onClaimDailyQuest} />
        <TasksPanel state={state} onClaim={onClaimTask} />
      </div>
    </>
  );
}
