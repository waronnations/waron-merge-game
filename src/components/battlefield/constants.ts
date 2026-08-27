export const ARENA_SIZE = 42;
export const PLAYER_SPEED = 9.8;
export const PLAYER_HEIGHT = 1.65;
export const MAX_HEALTH = 100;
export const MAX_AMMO = 30;
export const FIRE_RATE = 0.095;
export const DAMAGE = 28;
export const HEADSHOT_MULT = 1.85;
export const ENEMY_COUNT = 8;
export const ENEMY_HEALTH = 85;
export const ENEMY_SPEED = 3.15;
export const ENEMY_DAMAGE = 9;
export const ENEMY_FIRE_RATE = 1.55;
export const ENEMY_RANGE = 26;
export const LOOK_SENSITIVITY = 0.0024;
export const RECOIL_AMOUNT = 0.055;
export const RECOIL_RECOVERY = 9.5;
export const MATCH_SECONDS = 90;
export const MAX_SPREAD = 0.085;
export const MOVE_SPREAD = 0.035;

export const REWARD_BASE_GLORY = 18;
export const REWARD_KILL_GLORY = 9;
export const REWARD_WIN_GLORY = 35;
export const REWARD_BASE_TOKEN = 0.22;
export const REWARD_KILL_TOKEN = 0.11;
export const REWARD_WIN_TOKEN = 0.45;
export const REWARD_ENERGY_PER_MIN = 3;

export const LOADOUT = {
  wardog: {
    name: "Pack SMG",
    fireRate: 0.075,
    damage: 22,
    spread: 0.028,
    mag: 32,
  },
  warcat: {
    name: "Pride DMR",
    fireRate: 0.16,
    damage: 38,
    spread: 0.012,
    mag: 18,
  },
} as const;
