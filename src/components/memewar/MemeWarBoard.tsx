// src/components/memewar/MemeWarBoard.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TonConnectButton, useTonAddress } from "@tonconnect/ui-react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { SeasonInfo, WarAction, WarHolding } from "@/lib/memewar/types";
import { dominance, orderBattle } from "@/lib/memewar/war-math";
import { MEMEWAR_BOARD_SLOTS } from "@/lib/constants/memewar";
import { getWarHoldingsFn, getWarSeasonFn } from "@/lib/memewar/memewar.functions";
import { haptic } from "@/lib/telegram";
import { WarCoinTile } from "./WarCoinTile";
import { WarMergeModal } from "./WarMergeModal";
import { DominanceMeter, SeasonBar } from "./WarHud";

export function MemeWarBoard({ embedded = false }: { embedded?: boolean } = {}) {
  const owner = useTonAddress();
  const [holdings, setHoldings] = useState<WarHolding[] | null>(null);
  const [demo, setDemo] = useState(true);
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [battle, setBattle] = useState<{ weak: WarHolding; strong: WarHolding } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getWarHoldingsFn({ data: { owner: owner || null } });
      setHoldings(r.holdings);
      setDemo(r.demo);
      if ("error" in r && r.error) toast.error("Couldn't read your wallet. Showing a demo army.");
    } catch {
      toast.error("Board failed to load. Pull to retry.");
      setHoldings((h) => h ?? []);
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const pull = () => getWarSeasonFn().then(setSeason).catch(() => undefined);
    void pull();
    const t = setInterval(pull, 30_000);
    return () => clearInterval(t);
  }, []);

  const board = useMemo(() => (holdings ?? []).slice(0, MEMEWAR_BOARD_SLOTS), [holdings]);
  const dom = useMemo(() => dominance(board), [board]);
  const totalKey = board.reduce((s, h) => s + (dom.top && dom.top.usd > 0 ? h.usd : h.amount), 0) || 1;

  const engage = (a: number, b: number) => {
    const A = board[a];
    const B = board[b];
    setSelected(null);
    if (!A || !B || a === b) return;
    haptic("heavy");
    setBattle(orderBattle(A, B));
  };

  const onTap = (i: number) => {
    haptic("light");
    if (selected === null) setSelected(i);
    else if (selected === i) setSelected(null);
    else engage(selected, i);
  };

  const onDone = (_a: WarAction) => {
    setTimeout(() => void load(), 15_000);
    void getWarSeasonFn().then(setSeason).catch(() => undefined);
  };

  return (
    <div className={embedded ? "mx-auto w-full max-w-lg pb-4" : "app-shell mx-auto w-full max-w-lg px-3 pb-10 pt-3"}>
      <header className={embedded ? "mb-3 flex items-center justify-end gap-2" : "mb-3 flex items-center justify-between gap-2"}>
        {!embedded && (
          <Link to="/" className="flex items-center gap-1 text-xs font-black uppercase text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
        )}
        <TonConnectButton />
      </header>

      <motion.h1 className="text-center text-2xl font-black uppercase tracking-tight text-foreground" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        Memecoin <span className="text-destructive">War</span>
      </motion.h1>
      <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        There will only be 1 memecoin that wins this war.
      </p>

      <div className="space-y-2">
        <SeasonBar season={season} />
        <DominanceMeter top={dom.top} pct={dom.pct} />
      </div>

      <div className="mb-2 mt-3 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-muted-foreground">
        <span>{demo ? "Demo army — connect wallet" : `Your army · ${board.length} coins`}</span>
        <button type="button" onClick={() => void load()} className="flex items-center gap-1" aria-label="Refresh board">
          <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {holdings === null
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted" />)
          : (
            <AnimatePresence>
              {board.map((h, i) => (
                <WarCoinTile
                  key={h.coin.master}
                  holding={h}
                  index={i}
                  power={(dom.top && dom.top.usd > 0 ? h.usd : h.amount) / totalKey}
                  selected={selected === i}
                  dropTarget={selected !== null && selected !== i}
                  onTap={() => onTap(i)}
                  onDropOn={(t) => engage(i, t)}
                />
              ))}
            </AnimatePresence>
          )}
      </div>

      {holdings && board.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">No coins in this wallet yet. Buy any TON memecoin to join the war.</p>
      )}
      {holdings && board.length === 1 && (
        <p className="mt-4 text-center text-sm font-black text-primary">One coin rules your board. Victory.</p>
      )}
      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Drag a coin onto another — or tap two coins — to start a battle. Routes are checked on DeDust and STON.fi.
      </p>

      <AnimatePresence>
        {battle && (
          <WarMergeModal
            key={`${battle.weak.coin.master}-${battle.strong.coin.master}`}
            weak={battle.weak}
            strong={battle.strong}
            holdings={board}
            demo={demo}
            onClose={() => setBattle(null)}
            onDone={onDone}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
