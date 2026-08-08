// src/lib/share.ts
// Copy-paste ready hype messages for Telegram + X, plus the shared card payload
// used by <ShareCard />. Pure data/text helpers — no UI, no side effects.

import { buildReferralLink } from "@/lib/referrals.shared";

export const GAME_LINK = "https://t.me/waronnationsgamebot";
export const X_HANDLE = "@waronnations";

export interface SharePayload {
  /** Card headline, e.g. "STRIKE CONFIRMED" */
  title: string;
  /** Big glyph rendered on the card (flag / emblem) */
  glyph: string;
  /** Subject line under the glyph, e.g. country name */
  subject: string;
  /** Small kicker above the title */
  kicker: string;
  /** Stat rows rendered in the card box */
  stats: { label: string; value: string }[];
  /** Message tuned for Telegram (emoji + line breaks) */
  telegramText: string;
  /** Message tuned for X — short, punchy, hashtags */
  xText: string;
  /** Accent colour for the card */
  accent: string;
  /** Deep-link used as the share URL (includes referral when present) */
  shareLink: string;
}

const HASHTAGS = "#WarOnNations #WARDOG #WARCAT #TON";

/** Build the bot deep-link. Always includes the referral code when available. */
function botLink(referralCode?: string | null): string {
  if (referralCode && referralCode.length >= 5) {
    return buildReferralLink(referralCode);
  }
  return GAME_LINK;
}

export function xIntentUrl(payload: SharePayload): string {
  // xText already contains the link
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(payload.xText)}`;
}

/* ---------------- NUKE ---------------- */

export function nukeShare(opts: {
  country: string;
  flag: string;
  glory: number;
  wardog: number;
  warcat: number;
  energy: number;
  referralCode?: string | null;
}): SharePayload {
  const { country, flag, glory, wardog, warcat, energy, referralCode } = opts;
  const link = botLink(referralCode);

  return {
    kicker: "CLASSIFIED · STRATEGIC COMMAND",
    title: "STRIKE CONFIRMED",
    glyph: flag,
    subject: country.toUpperCase(),
    accent: "#c8102e",
    shareLink: link,
    stats: [
      { label: "GLORY", value: `+${glory.toLocaleString()}` },
      { label: "$WARDOG", value: `+${wardog.toFixed(2)}` },
      { label: "$WARCAT", value: `+${warcat.toFixed(2)}` },
      { label: "ENERGY", value: `+${energy}` },
    ],
    telegramText:
      `☢️ STRIKE CONFIRMED ☢️\n\n` +
      `${flag} ${country} just got erased from the map in WAR ON NATIONS.\n\n` +
      `⭐ +${glory.toLocaleString()} Glory\n` +
      `🐕 +${wardog.toFixed(2)} $WARDOG\n` +
      `🐈 +${warcat.toFixed(2)} $WARCAT\n` +
      `⚡ +${energy} Energy\n\n` +
      `The pack is hungry. Your country could be next.\n` +
      `Merge. Build. Conquer. Feed the Pack 🔥\n\n` +
      `Join under my banner → ${link}`,
    xText:
      `☢️ Just glassed ${flag} ${country} in WAR ON NATIONS.\n` +
      `+${glory.toLocaleString()} Glory · +${wardog.toFixed(2)} $WARDOG · +${warcat.toFixed(2)} $WARCAT\n` +
      `Who's next? Feed the pack.\n${HASHTAGS}\n${link}`,
  };
}

/* ---------------- CLAIM A COUNTRY ---------------- */

export function claimNationShare(opts: {
  name: string;
  emblem: string;
  tag: string;
  members: number;
  referralCode?: string | null;
}): SharePayload {
  const { name, emblem, tag, members, referralCode } = opts;
  const link = botLink(referralCode);

  return {
    kicker: "TERRITORY COMMAND",
    title: "COUNTRY CLAIMED",
    glyph: emblem,
    subject: name.toUpperCase(),
    accent: "#ffd166",
    shareLink: link,
    stats: [
      { label: "TAG", value: `[${tag}]` },
      { label: "ROLE", value: "LEADER" },
      { label: "TROOPS", value: String(members) },
    ],
    telegramText:
      `🏴 COUNTRY CLAIMED 🏴\n\n` +
      `${emblem} I now command ${name} [${tag}] in WAR ON NATIONS.\n\n` +
      `Rally under my flag. Farm glory. Take the world board.\n` +
      `Join my nation → ${link}`,
    xText:
      `${emblem} I just claimed ${name} in WAR ON NATIONS.\n` +
      `Leader. Undisputed. Come take it from me. ${HASHTAGS}\n${link}`,
  };
}

/* ---------------- BUY A COUNTRY ---------------- */

export function buyNationShare(opts: {
  name: string;
  emblem: string;
  tag: string;
  price: number;
  referralCode?: string | null;
}): SharePayload {
  const { name, emblem, tag, price, referralCode } = opts;
  const link = botLink(referralCode);

  return {
    kicker: "WAR MARKET · ACQUISITION",
    title: "COUNTRY ACQUIRED",
    glyph: emblem,
    subject: name.toUpperCase(),
    accent: "#9b2d8c",
    shareLink: link,
    stats: [
      { label: "TAG", value: `[${tag}]` },
      { label: "PRICE", value: `${price.toFixed(2)} TOKENS` },
      { label: "STATUS", value: "OWNED" },
    ],
    telegramText:
      `💰 HOSTILE TAKEOVER 💰\n\n` +
      `${emblem} I just bought ${name} [${tag}] for ${price.toFixed(2)} tokens in WAR ON NATIONS.\n\n` +
      `New management. New war plan.\n${link}`,
    xText:
      `Bought ${emblem} ${name} for ${price.toFixed(2)} tokens in WAR ON NATIONS.\n` +
      `Nations are tradable. Territory is money. ${HASHTAGS}\n${link}`,
  };
}

/* ---------------- SELL / LIST A COUNTRY ---------------- */

export function sellNationShare(opts: {
  name: string;
  emblem: string;
  tag: string;
  price: number;
  referralCode?: string | null;
}): SharePayload {
  const { name, emblem, tag, price, referralCode } = opts;
  const link = botLink(referralCode);

  return {
    kicker: "WAR MARKET · LISTING",
    title: "COUNTRY FOR SALE",
    glyph: emblem,
    subject: name.toUpperCase(),
    accent: "#ffd166",
    shareLink: link,
    stats: [
      { label: "TAG", value: `[${tag}]` },
      { label: "ASKING", value: `${price.toFixed(2)} TOKENS` },
      { label: "STATUS", value: "ON MARKET" },
    ],
    telegramText:
      `🏷️ TERRITORY FOR SALE 🏷️\n\n` +
      `${emblem} ${name} [${tag}] is on the war market for ${price.toFixed(2)} tokens.\n\n` +
      `First commander to pay, commands.\n${link}`,
    xText:
      `${emblem} ${name} is FOR SALE — ${price.toFixed(2)} tokens in WAR ON NATIONS.\n` +
      `Buy a country. Rule it. ${HASHTAGS}\n${link}`,
  };
}
