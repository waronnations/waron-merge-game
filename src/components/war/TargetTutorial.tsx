// src/components/war/TargetTutorial.tsx
interface Props {
  onDismiss: () => void;
}

export function TargetTutorial({ onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-red-500/40 bg-zinc-950 p-5 text-center shadow-2xl">
        <div className="mb-2 text-xs font-black tracking-[0.25em] text-red-400 uppercase">
          New in War Mode
        </div>
        <div className="mb-3 text-xl font-black text-white">
          LIVE TARGETS
        </div>

        <div className="mb-4 space-y-3 text-left text-sm text-zinc-300">
          <p>
            <span className="font-bold text-red-400">Country flags</span> and{" "}
            <span className="font-bold text-amber-400">enemy players</span> will
            appear on your board.
          </p>
          <p>
            <span className="font-bold">Merge</span> into them or{" "}
            <span className="font-bold">Deploy</span> a unit onto them to attack.
          </p>
          <p>
            Attacking costs energy + tokens and gives big Glory + Front Line push.
          </p>
          <p className="text-zinc-500 text-xs">
            Tip: Keep some tokens ready. Top up if you want to strike more.
          </p>
        </div>

        <button
          onClick={onDismiss}
          className="w-full rounded-xl bg-red-600 py-3 text-sm font-black uppercase tracking-widest text-white active:scale-95"
        >
          Got it — Let’s fight
        </button>
      </div>
    </div>
  );
}
