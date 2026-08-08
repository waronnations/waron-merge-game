/**
 * Server-only Nations system (barrel re-export).
 * - WARDOG & WARCAT = permanent default factions
 * - Real-world countries can be claimed, transferred, listed for sale
 * - Traitor system, Vault, Officers, Buffs, Reputation
 * - Phase 1: Protection, contribution on join, traitor redemption
 * - ONE NATION RULE: leave or sell before claiming/joining/buying another
 *
 * See src/lib/nations/* for the actual implementations.
 */

export type {
  NationRow,
  NationMember,
  NationDetails,
  NationRankRow,
} from "@/lib/nations/types.server";
export { COUNTRY_NATIONS } from "@/lib/nations/types.server";

export { recalculateReputation } from "@/lib/nations/reputation.server";

export {
  getMyNation,
  listNations,
  getNationDetails,
  getNationLeaderboard,
  getNationMembers,
  seedCountryNations,
} from "@/lib/nations/list.server";

export {
  requireUserId,
  addWeeklyGlory,
  joinNation,
  leaveNation,
  promoteOfficer,
  demoteOfficer,
  kickMember,
  removeUserFromNation,
} from "@/lib/nations/membership.server";

export {
  transferNationOwnership,
  listNationForSale,
  unlistNation,
  buyNation,
} from "@/lib/nations/ownership.server";

export {
  donateToVault,
  activateNationBuff,
  activateProtection,
  setRedemptionPrice,
  redeemTraitor,
  isNationProtected,
} from "@/lib/nations/vault.server";
