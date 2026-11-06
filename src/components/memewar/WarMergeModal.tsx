// src/components/memewar/WarMergeModal.tsx
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";
import { ArrowRight, Loader2, Skull, Swords, Handshake, Flag, X, Zap } from "lucide-react";
import { toast } from "sonner";
import type { AggregatedQuote, WarAction, WarHolding } from "@/lib/memewar/types";
import { TON_TARGET } from "@/lib/memewar/types";
import {
  ACTION_META,
  defaultSlippage,
  eligibleTaxCoins,
  pickDefaultTaxCoin,
  swapAmount,
  toUnits,
  fromUnits,
  warTaxAmount,
  warTaxUsd,
  seasonPoints,
} from "@/lib/memewar/war-math";
import { MEMEWAR_SLIPPAGE_OPTIONS, MEMEWAR_HIGH_IMPACT } from "@/lib/constants/memewar";
import { getWarQuoteFn, recordWarMergeFn } from "@/lib/memewar/memewar.functions";
import { haptic } from "@/lib/telegram";
import { CoinLogo, fmtAmount, fmtUsd } from "./CoinLogo";
import { cn } from "@/lib/utils";

const ICONS: Record<WarAction, typeof Swords> = { absorb: Swords, totalWar: Skull, alliance: Handshake, retreat: Flag };
const PROVIDER_LABEL = { stonfi: "STON.fi", dedust: "DeDust", mock: "Simulator" } as const;

type Phase = "idle" | "signing" | "pending" | "success" | "error";

export function WarMergeModal({
  weak,
  strong,
  holdings,
  demo,
  onClose,
  onDone,
}: {
  weak: WarHolding;
  strong: WarHolding;
  holdings: WarHolding[];
  demo: boolean;
  onClose: () => void;
  onDone: (action: WarAction) => void;
}) {
  const [tonConnectUI] = useTonConnectUI();
  const owner = useTonAddress();
  const [action, setAction] = useState<WarAction>("absorb");
  const [slippage, setSlippage] = useState(defaultSlippage("absorb"));
  const roughUsd = weak.usd * ACTION_META[action].share;
  const taxOptions = useMemo(() => eligibleTaxCoins(holdings, roughUsd), [holdings, roughUsd]);
  const [taxMaster, setTaxMaster] = useState<string | null>(
    () => pickDefaultTaxCoin(holdings, weak.usd, weak.coin.master, strong.coin.master)?.coin.master ?? null,
  );
  const tax = holdings.find((h) => h.coin.master === taxMaster) ?? null;
  const taxAmt = tax ? warTaxAmount(roughUsd, tax) : null;
  const offerAmount = swapAmount(action, weak, taxMaster ?? "", taxAmt);
  const offerUnits = toUnits(offerAmount, weak.coin.decimals);
  const toTon = ACTION_META[action].toTon;
  const ask = toTon
    ? { master: TON_TARGET, symbol: "TON", decimals: 9, image: "https://ton.org/download/ton_symbol.png", price: 0 }
    : { master: strong.coin.master, symbol: strong.coin.symbol, decimals: strong.coin.decimals, image: strong.coin.image, price: strong.coin.priceUsd };

  const [quote, setQuote] = useState<AggregatedQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [confirmImpact, setConfirmImpact] = useState(false);

  useEffect(() => {
    if (offerUnits <= 0n) return;
    let live = true;
    setQuoting(true);
    setQuoteErr(null);
    const t = setTimeout(async () => {
      try {
        const q = await getWarQuoteFn({
          data: {
            offerMaster: weak.coin.master,
            offerSymbol: weak.coin.symbol,
            offerDecimals: weak.coin.decimals,
            askMaster: ask.master,
            askSymbol: ask.symbol,
            askDecimals: ask.decimals,
            offerUnits: offerUnits.toString(),
            slippage,
            offerPriceUsd: weak.coin.priceUsd,
            askPriceUsd: ask.price,
          },
        });
        if (live) setQuote(q);
      } catch {
        if (live) setQuoteErr("Quote service unreachable. Try again.");
      } finally {
        if (live) setQuoting(false);
      }
    }, 350);
    const refresh = setInterval(() => setQuote((q) => q), 20_000);
    return () => {
      live = false;
      clearTimeout(t);
      clearInterval(refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weak.coin.master, ask.master, offerUnits.toString(), slippage]);

  const best = quote?.best ?? null;
  const exec = quote?.execution ?? null;
  const outAmount = best ? fromUnits(best.askUnits, best.askDecimals) : 0;
  const minOut = exec ? fromUnits(exec.minAskUnits, exec.askDecimals) : 0;
  const impact = exec?.priceImpact ?? best?.priceImpact ?? 0;
  const highImpact = impact >= MEMEWAR_HIGH_IMPACT;
  const swapUsd = offerAmount * weak.coin.priceUsd;
  const taxUsd = tax ? warTaxUsd(swapUsd, tax.coin.master) : 0;
  const points = seasonPoints(action, swapUsd);

  const blocker = demo
    ? "Connect your wallet to fight with your real coins."
    : !tax
      ? "No coin on your board can cover the War Tax."
      : !exec
        ? quoting
          ? null
          : "No executable route for this pair right now."
        : null;

  async function fire() {
    if (demo) {
      await tonConnectUI.openModal();
      return;
    }
    if (!exec || !tax || !owner || taxAmt === null) return;
    if (highImpact && !confirmImpact) {
      setConfirmImpact(true);
      haptic("medium");
      return;
    }
    try {
      setPhase("signing");
      await import("@/lib/onchain/buffer-polyfill");
      const { buildWarMergeTx } = await import("@/lib/memewar/war-tx");
      const tx = await buildWarMergeTx({
        owner,
        quote: exec,
        tax: { master: tax.coin.master, units: toUnits(taxAmt, tax.coin.decimals) },
      });
      const res = await tonConnectUI.sendTransaction(tx);
      setPhase("pending");
      haptic("heavy");
      recordWarMergeFn({
        data: {
          wallet: owner,
          txBoc: res.boc,
          action,
          fromMaster: weak.coin.master,
          fromAmount: offerAmount,
          toMaster: ask.master,
          toSymbol: ask.symbol,
          toImage: ask.image && /^https?:\/\//.test(ask.image) ? ask.image : null,
        },
      }).catch(() => undefined);
      setTimeout(() => {
        setPhase("success");
        haptic("heavy");
        onDone(action);
      }, 1800);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      setPhase("error");
      haptic("medium");
      toast.error(/reject|cancel|declin/i.test(msg) ? "Strike cancelled in wallet." : msg === "jetton_wallet_not_found" ? "Coin wallet not found on-chain." : "Strike failed. Nothing was sent.");
    }
  }

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={phase === "signing" || phase === "pending" ? undefined : onClose}>
      <motion.div
        role="dialog"
        aria-label="War merge"
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-4 pb-[calc(1rem+var(--safe-b))] sm:rounded-3xl"
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        exit={{ y: 120 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        {/* Battle header */}
        <div className="flex items-center justify-center gap-3 py-2">
          <Side h={weak} label="Attacker" />
          <motion.div animate={{ scale: [1, 1.25, 1], rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>
            <Swords className="h-7 w-7 text-destructive" />
          </motion.div>
          {toTon ? (
            <div className="flex w-24 flex-col items-center gap-1">
              <CoinLogo image={ask.image} symbol="TON" className="h-12 w-12" />
              <div className="text-xs font-black">TON</div>
              <div className="text-[10px] uppercase text-muted-foreground">Retreat</div>
            </div>
          ) : (
            <Side h={strong} label="Stronger" />
          )}
        </div>

        {/* Actions */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(Object.keys(ACTION_META) as WarAction[]).map((a) => {
            const Icon = ICONS[a];
            return (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAction(a);
                  setSlippage(defaultSlippage(a));
                  setConfirmImpact(false);
                  haptic("light");
                }}
                className={cn("rounded-xl border p-2 text-left transition-colors", action === a ? "border-destructive bg-destructive/10" : "border-border bg-secondary")}
              >
                <div className="flex items-center gap-1.5 text-xs font-black uppercase">
                  <Icon className="h-3.5 w-3.5 text-destructive" /> {ACTION_META[a].label}
                </div>
                <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{ACTION_META[a].blurb}</div>
              </button>
            );
          })}
        </div>

        {/* War tax */}
        <Section title="War Tax — pay with">
          {taxOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No coin can cover the tax ({fmtUsd(warTaxUsd(roughUsd, ""))}).</p>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {taxOptions.map((h) => (
                <button
                  key={h.coin.master}
                  type="button"
                  onClick={() => setTaxMaster(h.coin.master)}
                  className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-black", taxMaster === h.coin.master ? "border-primary text-primary" : "border-border text-muted-foreground")}
                >
                  <CoinLogo image={h.coin.image} imageRaw={h.coin.imageRaw} symbol={h.coin.symbol} className="h-4 w-4" />
                  {h.coin.symbol}
                  {h.coin.symbol === "WARDOG" && <span className="text-success">-50%</span>}
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Slippage */}
        <Section title="Slippage">
          <div className="flex gap-1.5">
            {MEMEWAR_SLIPPAGE_OPTIONS.map((s) => (
              <button key={s} type="button" onClick={() => setSlippage(s)} className={cn("flex-1 rounded-lg border py-1 text-xs font-black", slippage === s ? "border-destructive text-foreground" : "border-border text-muted-foreground")}>
                {(s * 100).toFixed(1)}%
              </button>
            ))}
          </div>
        </Section>

        {/* Quote summary */}
        <Section title="Battle plan">
          {quoting && !quote ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scouting DeDust + STON.fi routes…</div>
          ) : quoteErr ? (
            <p className="text-xs text-destructive">{quoteErr}</p>
          ) : !best ? (
            <p className="text-xs text-muted-foreground">No liquidity found on DeDust or STON.fi for this pair.</p>
          ) : (
            <div className={cn("space-y-1 text-xs", quoting && "opacity-60")}>
              <Row k="You send" v={`${fmtAmount(offerAmount)} ${weak.coin.symbol} (${fmtUsd(swapUsd)})`} />
              <Row k="You receive" v={`≈ ${fmtAmount(outAmount)} ${ask.symbol}`} strong />
              {exec && <Row k="Minimum received" v={`${fmtAmount(minOut)} ${ask.symbol}`} />}
              <Row k="Route" v={<span className="flex items-center gap-1">{(exec ?? best).route.map((r, i, a) => (<span key={i} className="flex items-center gap-1">{r}{i < a.length - 1 && <ArrowRight className="h-3 w-3" />}</span>))}</span>} />
              <Row k="Price impact" v={<span className={highImpact ? "text-destructive" : ""}>{(impact * 100).toFixed(2)}%</span>} />
              <Row k="Pool fee" v={`${fmtAmount(fromUnits((exec ?? best).feeUnits, ask.decimals))} ${ask.symbol}`} />
              <Row k="War Tax" v={tax && taxAmt !== null ? `${fmtAmount(taxAmt)} ${tax.coin.symbol} (${fmtUsd(taxUsd)})` : "—"} />
              <Row k="Network gas" v="≈ 0.3 TON (unused part refunded)" />
              <Row k="Season points" v={points > 0 ? `+${fmtAmount(points)} for ${ask.symbol}` : "none"} />
              <div className="mt-2 flex flex-wrap gap-1">
                {quote?.quotes.map((q) => (
                  <span key={q.provider} className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black", q === exec ? "border-success text-success" : "border-border text-muted-foreground")}>
                    {PROVIDER_LABEL[q.provider]}: {fmtAmount(fromUnits(q.askUnits, q.askDecimals))}
                    {q === best && " · best"}
                    {q === exec ? " · executing" : !q.executable ? " · compare" : ""}
                  </span>
                ))}
                {quote?.errors.map((e) => (
                  <span key={e.provider} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{PROVIDER_LABEL[e.provider]}: no route</span>
                ))}
              </div>
            </div>
          )}
        </Section>

        {highImpact && confirmImpact && <p className="mt-2 text-xs font-bold text-destructive">High price impact. Tap again to strike anyway.</p>}
        {blocker && !demo && <p className="mt-2 text-xs text-muted-foreground">{blocker}</p>}

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={phase === "signing" || phase === "pending" || (!demo && Boolean(blocker))}
          onClick={fire}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive py-3.5 text-sm font-black uppercase tracking-wider text-destructive-foreground disabled:opacity-40"
        >
          {phase === "signing" ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirm in wallet…</> : phase === "pending" ? <><Loader2 className="h-4 w-4 animate-spin" /> Strike in flight…</> : demo ? "Connect wallet to fight" : <><Zap className="h-4 w-4" /> {ACTION_META[action].label}</>}
        </motion.button>

        <AnimatePresence>
          {(phase === "pending" || phase === "success") && (
            <motion.div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-card/95" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="absolute h-40 w-40 rounded-full bg-destructive/30" animate={{ scale: [0.4, 2.4], opacity: [0.9, 0] }} transition={{ repeat: phase === "pending" ? Infinity : 0, duration: 1.1 }} />
              <motion.div animate={phase === "success" ? { scale: [0.5, 1.3, 1] } : { rotate: 360 }} transition={phase === "success" ? { duration: 0.5 } : { repeat: Infinity, duration: 1.2, ease: "linear" }}>
                <CoinLogo image={ask.image} symbol={ask.symbol} className="h-20 w-20" />
              </motion.div>
              <div className="mt-4 text-lg font-black uppercase">{phase === "success" ? (toTon ? "Retreated to TON" : `${ask.symbol} absorbs ${weak.coin.symbol}`) : "Strike in flight"}</div>
              <div className="text-xs text-muted-foreground">{phase === "success" ? "Your board refreshes once the chain confirms." : "Waiting for the swap to land on TON…"}</div>
            </motion.div>
          )}
        </AnimatePresence>
        {phase === "success" && (
          <button type="button" onClick={onClose} className="relative z-10 mt-2 w-full rounded-2xl border border-border py-2.5 text-xs font-black uppercase">Back to the board</button>
        )}
      </motion.div>
    </motion.div>
  );
}

function Side({ h, label }: { h: WarHolding; label: string }) {
  return (
    <div className="flex w-24 flex-col items-center gap-1">
      <CoinLogo image={h.coin.image} imageRaw={h.coin.imageRaw} symbol={h.coin.symbol} className="h-12 w-12" />
      <div className="max-w-full truncate text-xs font-black">{h.coin.symbol}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label} · {fmtUsd(h.usd)}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn("text-right font-bold", strong && "text-sm font-black text-foreground")}>{v}</span>
    </div>
  );
}
