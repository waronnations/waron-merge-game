// src/components/nations/NationsList.tsx
import {
  Flag,
  RefreshCw,
  Crown,
  LogOut,
  Tag,
  ArrowRightLeft,
  AlertTriangle,
  Search,
  Shield,
  Zap,
  Users,
  Trophy,
} from "lucide-react";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { getReputationTier, NATION_BUFFS } from "@/lib/constants";
import { TraitorBadge, OfficerBadge } from "./badges";
import type { Nation, MyNation } from "./use-nations-panel";

function FactionBadge({ faction }: { faction?: "wardog" | "warcat" | null }) {
  if (faction === "wardog") {
    return (
      <span className="rounded border border-orange-500/40 bg-orange-950/80 px-1.5 py-0.5 text-[0.55rem] font-black uppercase tracking-wider text-orange-300">
        WARDOG
      </span>
    );
  }
  if (faction === "warcat") {
    return (
      <span className="rounded border border-purple-500/40 bg-purple-950/80 px-1.5 py-0.5 text-[0.55rem] font-black uppercase tracking-wider text-purple-300">
        WARCAT
      </span>
    );
  }
  return null;
}

export function NationsList({
  loading,
  load,
  myNation,
  isLeader,
  handleLeave,
  leaving,
  setShowListModal,
  handleUnlist,
  unlisting,
  openTransferModal,
  search,
  setSearch,
  filtered,
  openDetails,
  redeeming,
  handleRedeemTraitor,
  onInvite,
}: {
  loading: boolean;
  load: () => Promise<void>;
  myNation: MyNation | null;
  isLeader: boolean;
  handleLeave: () => Promise<void>;
  leaving: boolean;
  setShowListModal: (v: boolean) => void;
  handleUnlist: () => Promise<void>;
  unlisting: boolean;
  openTransferModal: () => Promise<void>;
  search: string;
  setSearch: (v: string) => void;
  filtered: Nation[];
  openDetails: (nationId: number) => Promise<void>;
  redeeming: boolean;
  handleRedeemTraitor: (pay: boolean) => Promise<void>;
  onInvite?: () => void;
}) {
  const rep = myNation
    ? getReputationTier(myNation.reputation || 0)
    : null;

  const activeBuff =
    myNation?.activeBuff &&
    NATION_BUFFS[myNation.activeBuff as keyof typeof NATION_BUFFS]
      ? NATION_BUFFS[myNation.activeBuff as keyof typeof NATION_BUFFS]
      : null;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-amber-500" />
          <h2 className="text-sm font-black uppercase tracking-widest text-white">
            Nations
          </h2>
        </div>
        <button
          onClick={() => {
            void load();
            haptic("light");
          }}
          disabled={loading}
          className="rounded-lg bg-zinc-800 p-2 text-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Your Nation Card */}
      {myNation ? (
        <div
          className={cn(
            "rounded-2xl border p-4",
            myNation.isTraitor
              ? "border-red-500/40 bg-red-950/20"
              : "border-amber-500/30 bg-amber-950/20",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-zinc-900 text-2xl">
                {myNation.emblem || "🏳️"}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-base font-black text-white">
                    {myNation.name}
                  </span>
                  {myNation.myRole === "leader" && (
                    <Crown className="h-4 w-4 text-amber-400" />
                  )}
                  {myNation.myRole === "officer" && <OfficerBadge />}
                  {myNation.isTraitor && <TraitorBadge />}
                  <FactionBadge faction={myNation.faction} />
                  {myNation.isProtected && (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/50 bg-emerald-950/80 px-1.5 py-0.5 text-[0.6rem] font-black uppercase tracking-wider text-emerald-400">
                      <Shield className="h-2.5 w-2.5" />
                      Protected
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400">
                  [{myNation.tag}] · {myNation.memberCount} members
                </div>
                {rep && (
                  <div
                    className={cn(
                      "mt-0.5 text-[0.65rem] font-bold uppercase tracking-wider",
                      rep.color,
                    )}
                  >
                    {rep.tier} · {myNation.reputation || 0} rep
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-300 hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
            >
              {leaving ? (
                "..."
              ) : (
                <span className="flex items-center gap-1">
                  <LogOut className="h-3 w-3" />
                  Leave
                </span>
              )}
            </button>
          </div>

          {activeBuff && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/30 px-3 py-2">
              <Zap className="h-4 w-4 text-sky-400" />
              <div className="text-xs">
                <span className="font-bold text-sky-300">{activeBuff.name}</span>
                <span className="text-zinc-400"> — {activeBuff.desc}</span>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-black/40 px-2 py-1.5">
              <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">
                Vault
              </div>
              <div className="text-xs font-bold text-white">
                {Math.floor(myNation.vaultWardog || 0)} /{" "}
                {Math.floor(myNation.vaultWarcat || 0)}
              </div>
            </div>
            <div className="rounded-lg bg-black/40 px-2 py-1.5">
              <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">
                Weekly
              </div>
              <div className="text-xs font-bold text-amber-300">
                {Math.floor(myNation.myWeeklyGlory || 0)}
              </div>
            </div>
            <div className="rounded-lg bg-black/40 px-2 py-1.5">
              <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">
                Role
              </div>
              <div className="text-xs font-bold capitalize text-white">
                {myNation.myRole}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {onInvite && (
              <button
                onClick={() => {
                  onInvite();
                  haptic("medium");
                }}
                className="rounded-lg border border-amber-500/50 bg-amber-950/40 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-950/70"
              >
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Invite
                </span>
              </button>
            )}

            {isLeader && !myNation.isDefault && (
              <>
                {myNation.listedPrice ? (
                  <button
                    onClick={handleUnlist}
                    disabled={unlisting}
                    className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-300 hover:border-zinc-400 disabled:opacity-50"
                  >
                    {unlisting ? "..." : "Unlist"}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowListModal(true)}
                    className="rounded-lg border border-emerald-600/50 bg-emerald-950/40 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-emerald-400 hover:bg-emerald-950/70"
                  >
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      List for Sale
                    </span>
                  </button>
                )}
                <button
                  onClick={openTransferModal}
                  className="rounded-lg border border-blue-600/50 bg-blue-950/40 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-blue-400 hover:bg-blue-950/70"
                >
                  <span className="flex items-center gap-1">
                    <ArrowRightLeft className="h-3 w-3" />
                    Transfer
                  </span>
                </button>
              </>
            )}
          </div>

          {myNation.listedPrice && (
            <div className="mt-2 text-xs text-emerald-400">
              Currently listed for <strong>{myNation.listedPrice}</strong> tokens
            </div>
          )}

          {myNation.isTraitor && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  You are marked as a <strong>Traitor</strong>. Rewards reduced.
                  Cannot claim empty countries until redeemed.
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => void handleRedeemTraitor(true)}
                  disabled={redeeming}
                  className="rounded-lg bg-emerald-600/80 px-2.5 py-1 text-[0.65rem] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {redeeming ? "..." : "Pay to Redeem"}
                </button>
                <button
                  onClick={() => void handleRedeemTraitor(false)}
                  disabled={redeeming}
                  className="rounded-lg border border-zinc-600 px-2.5 py-1 text-[0.65rem] font-bold text-zinc-300 hover:border-zinc-400 disabled:opacity-50"
                >
                  Wait 7 days
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4 text-center">
          <Trophy className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-2 text-sm text-zinc-400">
            You are not in a nation yet. Claim a country or join one below.
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nations..."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
        />
      </div>

      {/* Nations list */}
      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            Loading nations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            No nations found
          </div>
        ) : (
          filtered.map((n) => {
            const isMine = myNation?.id === n.id;
            const canClaim =
              !n.isDefault &&
              n.memberCount === 0 &&
              (n.leaderId == null || n.leaderId === undefined);
            const nRep = getReputationTier(n.reputation || 0);

            return (
              <button
                key={n.id}
                onClick={() => void openDetails(n.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-zinc-800/80",
                  isMine
                    ? "border-amber-500/40 bg-amber-950/20"
                    : "border-zinc-700 bg-zinc-900",
                )}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-zinc-800 text-xl">
                  {n.emblem || "🏳️"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-bold text-white">
                      {n.name}
                    </span>
                    {n.isDefault && (
                      <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase text-zinc-300">
                        Faction Hub
                      </span>
                    )}
                    <FactionBadge faction={n.faction} />
                    {n.isProtected && (
                      <Shield className="h-3 w-3 shrink-0 text-emerald-400" />
                    )}
                  </div>
                  <div className="text-[0.65rem] text-zinc-400">
                    [{n.tag}] · {n.memberCount} members
                    {n.totalGlory > 0 &&
                      ` · ${Math.floor(n.totalGlory).toLocaleString()} glory`}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {canClaim ? (
                    <span className="rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-emerald-400">
                      Claim
                    </span>
                  ) : isMine ? (
                    <span className="rounded-lg border border-amber-500/40 bg-amber-950/60 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-amber-400">
                      Yours
                    </span>
                  ) : n.listedPrice ? (
                    <span className="rounded-lg border border-blue-500/40 bg-blue-950/60 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-blue-400">
                      {n.listedPrice} ◎
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "text-[0.6rem] font-bold uppercase",
                        nRep.color,
                      )}
                    >
                      {nRep.tier}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
