// src/components/war/FrontLineBar.tsx
import { FRONT_LINE_COLORS } from "@/lib/constants/war-mode";

interface Props {
  frontLine: number; // 0 = full dog, 100 = full cat
  controlGenerated: number;
  active: boolean;
}

export function FrontLineBar({ frontLine, controlGenerated, active }: Props) {
  if (!active) return null;

  const dogPercent = Math.max(0, Math.min(100, 100 - frontLine));
  const catPercent = Math.max(0, Math.min(100, frontLine));

  const status =
    frontLine <= 15
      ? "WARDOG DOMINANCE"
      : frontLine >= 85
        ? "WARCAT DOMINANCE"
        : "CONTESTED FRONT";

  return (
    <div className="w-full px-3 py-2">
      <div className="flex items-center justify-between text-[10px] font-bold tracking-widest uppercase mb-1">
        <span style={{ color: FRONT_LINE_COLORS.dog }}>WARDOG</span>
        <span className="text-zinc-400">{status}</span>
        <span style={{ color: FRONT_LINE_COLORS.cat }}>WARCAT</span>
      </div>

      <div className="relative h-3 w-full rounded-full overflow-hidden bg-zinc-900 border border-zinc-700">
        {/* Dog side */}
        <div
          className="absolute left-0 top-0 h-full transition-all duration-500"
          style={{
            width: `${dogPercent}%`,
            background: `linear-gradient(90deg, ${FRONT_LINE_COLORS.dog}, #ea580c)`,
          }}
        />
        {/* Cat side */}
        <div
          className="absolute right-0 top-0 h-full transition-all duration-500"
          style={{
            width: `${catPercent}%`,
            background: `linear-gradient(270deg, ${FRONT_LINE_COLORS.cat}, #9333ea)`,
          }}
        />
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white/80" />
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
        <span>Control generated: {Math.floor(controlGenerated)}</span>
        <span>{Math.round(frontLine)}%</span>
      </div>
    </div>
  );
}
