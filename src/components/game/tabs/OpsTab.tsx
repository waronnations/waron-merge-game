// src/components/game/tabs/OpsTab.tsx
// White-on-black base · colored writings only (labels / status / tokens)
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Crosshair,
  RefreshCw,
  ShoppingBag,
  History,
  Loader2,
  Radio,
  Shield,
  Search,
  Users,
  Share2,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { TabHero } from "@/components/game/TabHero";
import { TasksPanel, DailyQuestsPanel } from "@/components/Panels";
import type { GameState } from "@/lib/game-state";
import {
  haptic,
  shareReferralInvite,
  openWaronCommunity,
  shareStrikeRevenge,
  shareStrikeFlex,
} from "@/lib/telegram";
import {
  buildReferralLink,
  buildReferralShareText,
} from "@/lib/referrals.shared";
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
  jailed?: boolean;
};

type TargetPreview = {
  displayName: string;
  telegramId: number;
  protected: boolean;
};

type LastHit = {
  weaponId: BattlefieldWeaponId;
  victimLabel: string;
  glory: number;
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

function priceFor(q: Quote | undefined, baseCost: number): number {
  const final = Number(q?.final);
  if (Number.isFinite(final) && final > 0) return final;
  return baseCost;
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
  const [strikeWeapon, setStrikeWeapon] =
    useState<BattlefieldWeaponId>("knife");
  const [tick, setTick] = useState(0);
  const [lastHit, setLastHit] = useState<LastHit | null>(null);

  void tick;

  const referralCode = state.referralCode?.trim() || "";
  const referralLink = referralCode
    ? buildReferralLink(referralCode)
    : "https://t.me/waronnationsgamebot";

  const openShareReferral = useCallback(() => {
    const text = referralCode
      ? buildReferralShareText(referralCode)
      : [
          "WAR ON NATIONS is live.",
          "Merge WARDOG & WARCAT. Climb ranks. Earn jettons.",
          "",
          "Join the pack:",
          referralLink,
        ].join("\n");
    shareReferralInvite(referralLink, text);
    haptic("medium");
    toast.success("Opening Telegram share…");
  }, [referralCode, referralLink]);

  const openGroup = () => {
    openWaronCommunity();
    haptic("light");
  };

  const shareRevenge = useCallback(
    (hit?: LastHit | null) => {
      const src = hit ?? lastHit;
      const weaponId = src?.weaponId ?? strikeWeapon;
      shareStrikeRevenge({ weaponId, referralLink });
      haptic("medium");
      toast.success("Share revenge — pick their chat");
    },
    [lastHit, strikeWeapon, referralLink],
  );

  const shareFlex = useCallback(
    (hit?: LastHit | null) => {
      const src = hit ?? lastHit;
      if (!src) {
        openShareReferral();
        return;
      }
      shareStrikeFlex({
        weaponId: src.weaponId,
        victimLabel: src.victimLabel,
        glory: src.glory,
        referralLink,
      });
      haptic("medium");
      toast.success("Share flex — pick @waronnations or a chat");
    },
    [lastHit, referralLink, openShareReferral],
  );

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
              : "Invalid target",
          );
        }
      } catch {
        if (!cancelled) {
          setPreview(null);
          setPreviewError("Lookup failed");
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
    setBusy(`buy-${weaponId}-${payWith}`);
    try {
      const res = await buyBattlefieldWeaponFn({
        data: { weaponId, payWith },
      });
      haptic("medium");
      toast.success(
        `${BATTLEFIELD_WEAPONS[weaponId].name} acquired · paid ${fmtToken(
          Number((res as any).cost ?? 0),
        )} (tax ${fmtToken(Number((res as any).tax ?? 0))})`,
      );
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("insufficient_spendable") ||
        msg.includes("insufficient_balance")
      ) {
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
    setBusy("strike");
    try {
      const res = await battlefieldStrikeFn({
        data: { target, weaponId: strikeWeapon },
      });

      if ((res as any).jailed) {
        haptic("heavy");
        toast.error(
          (res as any).message ||
            "You attacked an important World Leader — jail time + glory & token loss",
          { duration: 6500 },
        );
        await refresh();
        return;
      }

      haptic(res.hit ? "heavy" : "light");
      if (res.hit) {
        const victimLabel =
          res.victimName ??
          (res.victimTelegramId ? `tg:${res.victimTelegramId}` : "a soldier");
        const hit: LastHit = {
          weaponId: strikeWeapon,
          victimLabel,
          glory: res.gloryGained,
        };
        setLastHit(hit);
        toast.success(
          `HIT · ${victimLabel} · +${res.gloryGained} glory · +${fmtToken(
            res.tokenReward,
          )} tokens`,
        );
        setTimeout(() => {
          shareFlex(hit);
        }, 700);
      } else {
        toast.message(`Miss on ${res.victimName ?? "target"} — weapon spent`);
      }
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("no_weapon")) toast.error("No ammo — buy a weapon first");
      else if (msg.includes("cooldown")) toast.error("Weapon on cooldown");
      else if (msg.includes("daily_cap"))
        toast.error("Daily attack cap reached");
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

  return (
    <>
      <TabHero tab="ops" />

      {missionsBadge > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-[0.7rem] font-black uppercase tracking-wider text-amber-300">
          {missionsBadge} reward{missionsBadge === 1 ? "" : "s"} ready — scroll
          & tap Claim
        </div>
      )}

      <DailyQuestsPanel state={state} onClaim={onClaimDailyQuest} />
      <TasksPanel state={state} onClaim={onClaimTask} />

      {/* ── Armory ─────────────────────────────────────────────────────── */}
      <div className="mt-4 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-white" />
          <h3 className="text-xs font-black uppercase tracking-widest text-white">
            Armory
          </h3>
          <button
            type="button"
            onClick={() => void refresh()}
            className="ml-auto text-zinc-500 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="grid gap-2">
            {WEAPON_IDS.map((id) => {
              const w = BATTLEFIELD_WEAPONS[id];
              const q = quoteMap.get(id);
              const owned = inv?.weapons[id] ?? 0;
              const cd = inv?.cooldowns[id] ?? 0;
              const onCd = cd > Date.now();
              const price = priceFor(q, w.cost);
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5"
                >
                  <div className="flex-1">
                    <div className="text-xs font-black text-white">
                      {w.emoji} {w.name} · {owned}
                    </div>
                    <div className="text-[0.6rem] text-zinc-500">
                      {w.desc}
                      {onCd && (
                        <span className="ml-1 text-amber-400">
                          · {formatCooldown(cd)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void handleBuy(id, "wardog")}
                      className="rounded-lg bg-red-900/60 px-2.5 py-1.5 text-[0.6rem] font-black uppercase text-red-200 disabled:opacity-40"
                    >
                      {fmtToken(price)} WD
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void handleBuy(id, "warcat")}
                      className="rounded-lg bg-purple-900/60 px-2.5 py-1.5 text-[0.6rem] font-black uppercase text-purple-200 disabled:opacity-40"
                    >
                      {fmtToken(price)} WC
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Strike ─────────────────────────────────────────────────────── */}
      <div className="mt-4 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-white" />
          <h3 className="text-xs font-black uppercase tracking-widest text-white">
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
            className="w-full rounded-xl border border-zinc-600 bg-zinc-950 py-2.5 pl-9 pr-3 font-mono text-sm text-white outline-none focus:border-white/40"
          />
        </div>

        {previewLoading && (
          <div className="mb-2 text-[0.65rem] text-zinc-500">Looking up…</div>
        )}

        {preview && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200">
            {preview.protected ? (
              <Shield className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            ) : (
              <Crosshair className="h-3.5 w-3.5 shrink-0 text-white" />
            )}
            <span className="font-bold text-white">{preview.displayName}</span>
            <span className="text-[0.6rem] text-zinc-500">
              tg:{preview.telegramId}
            </span>
            {preview.protected && (
              <span className="ml-auto text-[0.6rem] font-black uppercase text-amber-400">
                Protected
              </span>
            )}
          </div>
        )}

        {preview?.protected && (
          <div className="mb-3 rounded-lg border border-amber-600/40 bg-amber-950/40 px-3 py-2 text-[0.65rem] text-amber-200">
            ⚠️ Protected Leader — attacking risks 1 min jail + glory &
            WARDOG/WARCAT loss
          </div>
        )}

        {previewError && (
          <div className="mb-3 text-[0.65rem] text-zinc-400">{previewError}</div>
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
                    ? "border-white/50 bg-white/10 text-white"
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
          disabled={!!busy}
          onClick={() => void handleStrike()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-black uppercase tracking-wider text-black hover:bg-zinc-200 disabled:opacity-40"
        >
          {busy === "strike" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Crosshair className="h-4 w-4" />
          )}
          {busy === "strike"
            ? "Engaging…"
            : preview?.protected
              ? "Strike Protected Leader (Risk Jail)"
              : "Execute strike"}
        </button>
      </div>

      {/* ── Last Hit + Shares ──────────────────────────────────────────── */}
      {lastHit && (
        <div className="mt-4 rounded-2xl border border-emerald-700/50 bg-emerald-950/30 p-4">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-300">
            Last Hit
          </div>
          <div className="text-sm text-white">
            {lastHit.victimLabel} · +{lastHit.glory} glory
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => shareRevenge(lastHit)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-600 bg-zinc-900 py-2 text-[0.65rem] font-black uppercase text-zinc-200"
            >
              <Share2 className="h-3.5 w-3.5" />
              Revenge
            </button>
            <button
              type="button"
              onClick={() => shareFlex(lastHit)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-600 bg-zinc-900 py-2 text-[0.65rem] font-black uppercase text-zinc-200"
            >
              <Megaphone className="h-3.5 w-3.5" />
              Flex
            </button>
          </div>
        </div>
      )}

      {/* ── Kill Feed (scroll box) ─────────────────────────────────────── */}
      <div className="mt-4 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Radio className="h-4 w-4 text-white" />
          <h3 className="text-xs font-black uppercase tracking-widest text-white">
            Live Ops Feed
          </h3>
        </div>
        <div className="max-h-40 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
          {feed.length === 0 && (
            <div className="py-4 text-center text-[0.65rem] text-zinc-500">
              No recent activity
            </div>
          )}
          {feed.map((row) => (
            <div
              key={row.id}
              className={`rounded-lg border px-3 py-2 text-[0.7rem] ${
                row.jailed
                  ? "border-amber-600/40 bg-amber-950/30 text-amber-200"
                  : row.hit
                    ? "border-red-700/40 bg-red-950/20 text-red-100"
                    : "border-zinc-700 bg-zinc-950 text-zinc-400"
              }`}
            >
              {row.jailed ? (
                <>
                  🔒 <span className="font-bold">{row.attackerName}</span> tried
                  to attack protected Leader{" "}
                  <span className="font-bold">{row.victimName}</span> and got
                  JAILED
                </>
              ) : row.hit ? (
                <>
                  ⚔️ <span className="font-bold">{row.attackerName}</span>{" "}
                  {row.weaponId === "knife"
                    ? "stabbed"
                    : row.weaponId === "pistol"
                      ? "shot"
                      : "hit"}{" "}
                  <span className="font-bold">{row.victimName}</span> (+
                  {row.gloryGained} glory)
                </>
              ) : (
                <>
                  <span className="font-bold">{row.attackerName}</span> missed{" "}
                  {row.victimName}
                </>
              )}
              <span className="ml-2 text-[0.55rem] text-zinc-500">
                {timeAgo(row.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Personal History (scroll box) ──────────────────────────────── */}
      <div className="mt-4 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-4">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-white" />
          <h3 className="text-xs font-black uppercase tracking-widest text-white">
            Your Ops History
          </h3>
        </div>
        <div className="max-h-48 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
          {history.length === 0 && (
            <div className="py-4 text-center text-[0.65rem] text-zinc-500">
              No strikes yet
            </div>
          )}
          {history.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-[0.7rem]"
            >
              <div>
                <span className="font-bold text-white">
                  {BATTLEFIELD_WEAPONS[row.weaponId as BattlefieldWeaponId]
                    ?.name ?? row.weaponId}
                </span>
                <span className="ml-2 text-zinc-500">
                  {row.details?.victimName
                    ? String(row.details.victimName)
                    : row.victimTelegramId
                      ? `tg:${row.victimTelegramId}`
                      : "—"}
                </span>
                {Boolean(row.details?.jailed) && (
                  <span className="ml-2 text-amber-400">· JAILED</span>
                )}
              </div>
              <div className="text-right">
                <div
                  className={row.hit ? "text-emerald-400" : "text-zinc-500"}
                >
                  {row.hit ? `+${row.gloryGained}` : "miss"}
                </div>
                <div className="text-[0.55rem] text-zinc-600">
                  {timeAgo(row.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Community / Share bar */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={openGroup}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 text-[0.65rem] font-black uppercase text-zinc-300"
        >
          <Users className="h-3.5 w-3.5" />
          Community
        </button>
        <button
          type="button"
          onClick={openShareReferral}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 text-[0.65rem] font-black uppercase text-zinc-300"
        >
          <Share2 className="h-3.5 w-3.5" />
          Invite
        </button>
      </div>
    </>
  );
}
