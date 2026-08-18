export type Faction = "wardog" | "warcat";

export interface PlayerStats {
  health: number;
  maxHealth: number;
  ammo: number;
  maxAmmo: number;
  kills: number;
  deaths: number;
}

export interface Enemy {
  id: string;
  position: [number, number, number];
  health: number;
  maxHealth: number;
  faction: Faction;
  alive: boolean;
  lastShot: number;
}
