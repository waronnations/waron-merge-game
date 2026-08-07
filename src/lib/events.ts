// src/lib/events.ts
// Rotating limited-time events. Client-side FOMO + multipliers.
// Server can later validate multipliers.

export type EventId =
  | "double_glory"
  | "energy_frenzy"
  | "legendary_surge";

export interface ActiveEvent {
  id: EventId;
  name: string;
  desc: string;
  color: string;
  endsAt: number;
  gloryMult?: number;
  energyRegenMult?: number;
  highTierBonus?: number; // extra glory multiplier on T4+
}

/** Returns the current Friday 00:00 UTC → Sunday 23:59:59 UTC window */
function getWeekendWindow(now = Date.now()): { start: number; end: number } {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0 = Sun … 5 = Fri … 6 = Sat

  // Find the most recent Friday 00:00 UTC
  const friday = new Date(d);
  friday.setUTCHours(0, 0, 0, 0);

  // How many days since last Friday
  const daysSinceFriday = (day + 2) % 7; // Fri=0, Sat=1, Sun=2, Mon=3 …
  friday.setUTCDate(friday.getUTCDate() - daysSinceFriday);

  const start = friday.getTime();
  const end = start + 3 * 24 * 60 * 60 * 1000 - 1; // Sunday 23:59:59.999

  return { start, end };
}

export function getActiveEvents(now = Date.now()): ActiveEvent[] {
  const events: ActiveEvent[] = [];

  // ── Double Glory Weekend (Fri 00:00 → Sun 23:59 UTC) ──────────────
  const weekend = getWeekendWindow(now);
  if (now >= weekend.start && now <= weekend.end) {
    events.push({
      id: "double_glory",
      name: "DOUBLE GLORY WEEKEND",
      desc: "All merge glory ×2 until Sunday 23:59 UTC",
      color: "#f59e0b",
      endsAt: weekend.end,
      gloryMult: 2,
    });
  }

  // ── Energy Frenzy – every day 18:00–19:00 UTC ─────────────────────
  const d = new Date(now);
  const frenzyStart = new Date(d);
  frenzyStart.setUTCHours(18, 0, 0, 0);
  const frenzyEnd = new Date(d);
  frenzyEnd.setUTCHours(19, 0, 0, 0);

  if (now >= frenzyStart.getTime() && now <= frenzyEnd.getTime()) {
    events.push({
      id: "energy_frenzy",
      name: "ENERGY FRENZY HOUR",
      desc: "Energy regenerates 2× faster",
      color: "#22d3ee",
      endsAt: frenzyEnd.getTime(),
      energyRegenMult: 2,
    });
  }

  // ── Legendary Surge – deterministic 4-hour window per day ─────────
  const daySeed = Math.floor(now / 86_400_000);
  const surgeHour = (daySeed % 12) + 8; // 08:00 – 19:00 UTC start
  const surgeStart = new Date(d);
  surgeStart.setUTCHours(surgeHour, 0, 0, 0);
  const surgeEnd = new Date(surgeStart);
  surgeEnd.setUTCHours(surgeHour + 4, 0, 0, 0);

  if (now >= surgeStart.getTime() && now <= surgeEnd.getTime()) {
    events.push({
      id: "legendary_surge",
      name: "LEGENDARY SURGE",
      desc: "+50% glory on Tier 4 & 5 merges",
      color: "#ef4444",
      endsAt: surgeEnd.getTime(),
      highTierBonus: 1.5,
    });
  }

  return events;
}

/** Combined glory multiplier for a given merge tier */
export function getGloryMultiplier(
  events: ActiveEvent[],
  tier: number,
): number {
  let mult = 1;
  for (const e of events) {
    if (e.gloryMult) mult *= e.gloryMult;
    if (e.highTierBonus && tier >= 4) mult *= e.highTierBonus;
  }
  return mult;
}

/** Energy regen multiplier (1 = normal) */
export function getEnergyRegenMultiplier(events: ActiveEvent[]): number {
  let mult = 1;
  for (const e of events) {
    if (e.energyRegenMult) mult *= e.energyRegenMult;
  }
  return mult;
}
