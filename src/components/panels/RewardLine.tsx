// src/components/panels/RewardLine.tsx
// White-on-black · token labels lightly tinted only
export function RewardLine({
  glory,
  wardog,
  warcat,
  energy,
}: {
  glory?: number;
  wardog?: number;
  warcat?: number;
  energy?: number;
}) {
  const parts: { key: string; text: string; className: string }[] = [];

  if (glory && glory > 0) {
    parts.push({
      key: "glory",
      text: `+${glory} glory`,
      className: "text-white",
    });
  }
  if (wardog && wardog > 0) {
    parts.push({
      key: "wardog",
      text: `+${wardog} $WARDOG`,
      className: "text-red-300",
    });
  }
  if (warcat && warcat > 0) {
    parts.push({
      key: "warcat",
      text: `+${warcat} $WARCAT`,
      className: "text-violet-300",
    });
  }
  if (energy && energy > 0) {
    parts.push({
      key: "energy",
      text: `+${energy} energy`,
      className: "text-zinc-300",
    });
  }

  if (!parts.length) return null;

  return (
    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[0.65rem] font-bold">
      {parts.map((p) => (
        <span key={p.key} className={p.className}>
          {p.text}
        </span>
      ))}
    </div>
  );
}
