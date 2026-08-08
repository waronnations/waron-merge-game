// src/lib/units.ts
export type Faction = "dog" | "cat";

export interface UnitDef {
  tier: number;
  faction: Faction;
  name: string;
  image: string;
  color: string;
  glow: string;
}

export const UNITS: Record<Faction, UnitDef[][]> = {
  dog: [
    [
      { tier: 1, faction: "dog", name: "Neon Glock", image: "/images/units/neon_glock.png", color: "#39ff14", glow: "#00ff88" },
      { tier: 1, faction: "dog", name: "Solar Frag", image: "/images/units/solar_frag.png", color: "#ffd700", glow: "#ffaa00" },
      { tier: 1, faction: "dog", name: "Green Mine", image: "/images/units/green_mine.png", color: "#00ff66", glow: "#39ff14" },
    ],
    [
      { tier: 2, faction: "dog", name: "Solar Shotgun", image: "/images/units/solar_shotgun.png", color: "#ffd700", glow: "#ffaa00" },
      { tier: 2, faction: "dog", name: "Green Plasma", image: "/images/units/green_plasma.png", color: "#00ff88", glow: "#39ff14" },
      { tier: 2, faction: "dog", name: "Yellow Mine", image: "/images/units/yellow_mine.png", color: "#ffcc00", glow: "#ffaa00" },
    ],
    [
      { tier: 3, faction: "dog", name: "Magenta Vector", image: "/images/units/magenta_vector.png", color: "#ff00aa", glow: "#ff66cc" },
      { tier: 3, faction: "dog", name: "Green Huge", image: "/images/units/green_huge.png", color: "#00ff66", glow: "#39ff14" },
      { tier: 3, faction: "dog", name: "Yellow Huge", image: "/images/units/yellow_huge.png", color: "#ffd700", glow: "#ffaa00" },
    ],
    [
      { tier: 4, faction: "dog", name: "Green Artillery", image: "/images/units/green_artillery.png", color: "#00ff88", glow: "#aaff00" },
      { tier: 4, faction: "dog", name: "Yellow Artillery", image: "/images/units/yellow_artillery.png", color: "#ffd700", glow: "#ffaa00" },
      { tier: 4, faction: "dog", name: "Magenta Artillery", image: "/images/units/magenta_artillery.png", color: "#ff00aa", glow: "#ff66cc" },
    ],
    [
      { tier: 5, faction: "dog", name: "Green Titan", image: "/images/units/green_titan.png", color: "#00ff88", glow: "#aaff00" },
      { tier: 5, faction: "dog", name: "Green Tank", image: "/images/units/green_tank.png", color: "#00ff66", glow: "#39ff14" },
      { tier: 5, faction: "dog", name: "Yellow Drone", image: "/images/units/yellow_drone.png", color: "#ffd700", glow: "#ffaa00" },
    ],
  ],

  cat: [
    [
      { tier: 1, faction: "cat", name: "Purple SMG", image: "/images/units/purple_smg.png", color: "#bf00ff", glow: "#e066ff" },
      { tier: 1, faction: "cat", name: "Ice Cryo", image: "/images/units/ice_cryo.png", color: "#00ccff", glow: "#66e0ff" },
      { tier: 1, faction: "cat", name: "Purple Mine", image: "/images/units/purple_mine.png", color: "#cc00ff", glow: "#ff66ff" },
    ],
    [
      { tier: 2, faction: "cat", name: "Ice Sniper", image: "/images/units/ice_sniper.png", color: "#00ccff", glow: "#66e0ff" },
      { tier: 2, faction: "cat", name: "Purple EMP", image: "/images/units/purple_emp.png", color: "#bf00ff", glow: "#e066ff" },
      { tier: 2, faction: "cat", name: "Ice Mine", image: "/images/units/ice_mine.png", color: "#00aaff", glow: "#66e0ff" },
    ],
    [
      { tier: 3, faction: "cat", name: "Purple Battle", image: "/images/units/purple_battle.png", color: "#cc00ff", glow: "#ff66ff" },
      { tier: 3, faction: "cat", name: "Ice Huge", image: "/images/units/ice_huge.png", color: "#0099ff", glow: "#00eeff" },
      { tier: 3, faction: "cat", name: "Purple Huge", image: "/images/units/purple_huge.png", color: "#bf00ff", glow: "#e066ff" },
    ],
    [
      { tier: 4, faction: "cat", name: "Blue Artillery", image: "/images/units/blue_artillery.png", color: "#0099ff", glow: "#00eeff" },
      { tier: 4, faction: "cat", name: "Purple Artillery", image: "/images/units/purple_artillery.png", color: "#bf00ff", glow: "#e066ff" },
      { tier: 4, faction: "cat", name: "Purple Jet", image: "/images/units/purple_jet.png", color: "#cc00ff", glow: "#ff66ff" },
    ],
    [
      { tier: 5, faction: "cat", name: "Purple Stealth", image: "/images/units/purple_stealth.png", color: "#bf00ff", glow: "#e066ff" },
      { tier: 5, faction: "cat", name: "Ice Bomber", image: "/images/units/ice_bomber.png", color: "#00ccff", glow: "#66e0ff" },
      { tier: 5, faction: "cat", name: "Magenta Doomsday", image: "/images/units/magenta_doomsday.png", color: "#ff0099", glow: "#ff66cc" },
    ],
  ],
};

/** Deterministic variant picker – same unit always looks the same */
export function getUnit(
  faction: Faction,
  tier: number,
  unitId?: number,
  variant?: number,
): UnitDef {
  const tierIndex = Math.min(Math.max(tier - 1, 0), 4);
  const variants = UNITS[faction][tierIndex];
  const idx =
    typeof variant === "number" && Number.isFinite(variant)
      ? Math.abs(Math.floor(variant)) % variants.length
      : unitId !== undefined
        ? Math.abs(unitId) % variants.length
        : 0;
  return variants[idx];
}

/** Resolve a cell's merge-key variant (back-compat for old cells without variant). */
export function cellVariant(cell: { id: number; variant?: number }): number {
  if (typeof cell.variant === "number" && Number.isFinite(cell.variant)) {
    return Math.abs(Math.floor(cell.variant)) % 3;
  }
  return Math.abs(cell.id) % 3;
}

export const MAX_TIER = 5;
