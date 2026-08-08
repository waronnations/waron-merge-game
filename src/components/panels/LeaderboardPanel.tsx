import { useEffect, useMemo, useState } from "react";
import { Crown, Flag, Trophy, Users } from "lucide-react";
import type { GameState } from "@/lib/game-state";
import { getRankForGlory } from "@/lib/ranks";
import { haptic, tgUser } from "@/lib/telegram";
import { getNationLeaderboardFn } from "@/lib/nations.functions";

export interface LeaderboardServerEntry {
  rank: number;
  userId: number;
  username: string | null;
  firstName: string | null;
  glory: number;
  highestTier: number;
}

export type NationRank = Awaited<
  ReturnType<typeof getNationLeaderboardFn>
>[number];

export function LeaderboardPanel({
  state,
  serverEntries,
  myUserId,
  authenticated = false,
}: {
  state: GameState;
  serverEntries?: LeaderboardServerEntry[] | null;
  myUserId?: number | null;
  authenticated?: boolean;
}) {
  const meName = tgUser()?.first_name || "You";

  const rows = useMemo(() => {
    if (authenticated) {
      if (!serverEntries) return null;

      const mapped = serverEntries.map((e) => ({
        name:
          (e.firstName || e.username || `Warlord #${e.userId}`) +
          (e.userId === myUserId ? " (you)" : ""),
        glory: e.glory,
        tier: e.highestTier,
        isYou: e.userId === myUserId,
        userId: e.userId,
      }));

      const onBoard = mapped.some((r) => r.isYou);
      if (!onBoard && myUserId != null) {
        mapped.push({
          name: `${meName} (you)`,
          glory: state.glory,
          tier: state.highestTier,
          isYou: true,
          userId: myUserId,
        });
      }

      mapped.sort((a, b) => b.glory - a.glory || a.userId - b.userId);
      return mapped;
    }

    return [
      {
        name: `${meName} (you)`,
        glory: state.glory,
        tier: state.highestTier,
        isYou: true,
        userId: -1,
      },
    ];
  }, [
    authenticated,
    serverEntries,
    myUserId,
    state.glory,
    state.highestTier,
    meName,
  ]);

  const [view, setView] = useState<"players" | "nations">("players");
  const [visible, setVisible] = useState(50);
  const [nationRows, setNationRows] = useState<NationRank[] | null>(null);

  useEffect(() => {
    if (view !== "nations" || !authenticated) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await getNationLeaderboardFn();
        if (!cancelled) setNationRows(res);
      } catch {
        if (!cancelled) setNationRows([]);
      }
    };
    void load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [view, authenticated]);

  const myServerRow = serverEntries?.find((e) => e.userId === myUserId);
  const myRank = rows ? rows.findIndex((r) => r.isYou) + 1 : 0;
  const gloryDesync =
    authenticated &&
    myServerRow != null &&
    Math.abs(myServerRow.glory - state.glory) > 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(["players", "nations"] as const).map((v) => (
          <button
            key={v}
            onClick={() => {
              setView(v);
              haptic("light");
            }}
            className={`flex min-h-[2.5rem] items-center justify-center gap-1.5 rounded-xl border py-2 text-[0.65rem] font-black uppercase tracking-widest transition-colors ${
              view === v
                ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                : "border-zinc-700 bg-zinc-900 text-zinc-500"
            }`}
          >
            {v === "players" ? (
              <Trophy className="h-3.5 w-3.5" />
            ) : (
              <Flag className="h-3.5 w-3.5" />
            )}
            {v === "players" ? "Warlords" : "Country Rank"}
          </button>
        ))}
      </div>

      {view === "nations" ? (
        <NationRankList rows={nationRows} authenticated={authenticated} />
      ) : (
        <>
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
                <h3 className="truncate text-sm font-black uppercase tracking-widest text-white">
                  Global Warlords
                </h3>
              </div>
              <div className="shrink-0 rounded-lg bg-zinc-800 px-2.5 py-1 text-[0.65rem] uppercase tracking-widest text-zinc-400">
                Your rank:{" "}
                <span className="font-bold text-amber-500">
                  {myRank > 0 ? `#${myRank}` : "—"}
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-zinc-950 p-2">
                <div className="text-sm font-black text-amber-500">
                  {state.glory.toLocaleString()}
                </div>
                <div className="text-[0.55rem] uppercase tracking-widest text-zinc-500">
                  Your glory (live)
                </div>
              </div>
              <div className="rounded-xl bg-zinc-950 p-2">
                <div className="text-sm font-black text-white">
                  {(myServerRow?.glory ?? state.glory).toLocaleString()}
                </div>
                <div className="text-[0.55rem] uppercase tracking-widest text-zinc-500">
                  Board glory
                </div>
              </div>
            </div>

            {gloryDesync && (
              <p className="mt-2 text-center text-[0.6rem] text-amber-500/90">
                Board updates a few seconds after sync — your live glory is correct.
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
            {rows === null ? (
              <div className="p-6 text-center text-sm text-zinc-500">
                Loading live ranks…
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">
                No warlords yet — merge to join
              </div>
            ) : (
              rows.slice(0, visible).map((r, i) => {
                const rank = i + 1;
                const medal =
                  rank === 1
                    ? "🥇"
                    : rank === 2
                      ? "🥈"
                      : rank === 3
                        ? "🥉"
                        : `#${rank}`;
                return (
                  <div
                    key={`${r.userId}-${i}`}
                    className={`flex items-center gap-3 border-b border-zinc-800 p-3 last:border-b-0 ${
                      r.isYou ? "bg-amber-950/30" : ""
                    }`}
                  >
                    <div className="w-8 shrink-0 text-center text-sm font-black text-amber-500">
                      {medal}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-sm font-bold ${
                          r.isYou ? "text-white" : "text-zinc-200"
                        }`}
                      >
                        {r.name}
                      </div>
                      <div className="text-[0.6rem] uppercase tracking-widest text-zinc-500">
                        {getRankForGlory(r.glory).name} · T{r.tier}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-black text-amber-500">
                        {r.glory.toLocaleString()}
                      </div>
                      <div className="text-[0.55rem] uppercase tracking-widest text-zinc-600">
                        glory
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {rows && rows.length > visible && (
            <button
              onClick={() => {
                setVisible((v) => Math.min(v + 50, rows.length));
                haptic("light");
              }}
              className="min-h-[2.75rem] w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 text-[0.65rem] font-black uppercase tracking-widest text-zinc-400 transition-colors hover:border-amber-500/40 hover:text-amber-400"
            >
              Show more ({rows.length - visible} left)
            </button>
          )}

          <p className="text-center text-[0.6rem] uppercase tracking-widest text-zinc-600">
            {authenticated
              ? `Live · server-verified${rows ? ` · ${rows.length} commanders` : ""}`
              : "Local only · open in Telegram for the live board"}
          </p>
        </>
      )}
    </div>
  );
}

function NationRankList({
  rows,
  authenticated,
}: {
  rows: NationRank[] | null;
  authenticated: boolean;
}) {
  if (!authenticated) {
    return (
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
        Open in Telegram to see the live country board
      </div>
    );
  }
  if (rows === null) {
    return (
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
        Loading country ranks…
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
        No nations on the board yet
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
      {rows.map((n, i) => {
        const rank = i + 1;
        const medal =
          rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
        return (
          <div
            key={n.id}
            className="flex items-center gap-3 border-b border-zinc-800 p-3 last:border-b-0"
          >
            <div className="w-8 shrink-0 text-center text-sm font-black text-amber-500">
              {medal}
            </div>
            <div className="text-xl">{n.emblem}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-zinc-200">
                {n.name}{" "}
                <span className="text-[0.6rem] text-zinc-500">[{n.tag}]</span>
              </div>
              <div className="flex items-center gap-2 text-[0.6rem] uppercase tracking-widest text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {n.memberCount}
                </span>
                {n.leaderName && (
                  <span className="inline-flex min-w-0 items-center gap-1 truncate">
                    <Crown className="h-3 w-3 text-amber-500" /> {n.leaderName}
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-black text-amber-500">
                {n.totalGlory.toLocaleString()}
              </div>
              <div className="text-[0.55rem] uppercase tracking-widest text-zinc-600">
                glory
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
