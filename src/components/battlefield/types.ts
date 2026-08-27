export type Faction = "wardog" | "warcat";

export type BattleMode = "hunt" | "hold" | "waves";

export interface PlayerStats {
  health: number;
  maxHealth: number;
  ammo: number;
  maxAmmo: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  survived: boolean;
  durationSec: number;
  shotsFired: number;
  hits: number;
  headshots: number;
  accuracy: number;
  mode: BattleMode;
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

export interface BattleLoadout {
  fireRate: number;
  damage: number;
  spread: number;
  mag: number;
  name: string;
}
