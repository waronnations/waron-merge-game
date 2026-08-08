/**
 * Barrel re-export for the (now split) game server modules.
 * Kept so existing imports of "@/lib/game.server" keep working.
 */

export * from "./game/server/state.server";
export * from "./game/server/merge.server";
export * from "./game/server/spawn.server";
export * from "./game/server/shop.server";
export * from "./game/server/nuke.server";
export * from "./game/server/hybrid.server";
export * from "./game/server/claims.server";
export * from "./game/server/gifts.server";
