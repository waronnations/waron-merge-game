export type Faction = "wardog" | "warcat";

export interface PlayerStats {
  health: number;
  maxHealth: number;
  ammo: number;
  maxAmmo: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  survived: boolean; // true if player won (all enemies dead)
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

export interface BattleRewardResult {
  glory: number;
  wardog: number;
  warcat: number;
  energy: number;
  message: string;
}
