import { describe, it, expect } from "vitest";
import {
  MILESTONES,
  buildReferralLink,
  buildReferralShareText,
  REFERRAL_BOT,
} from "@/lib/referrals.shared";

describe("MILESTONES", () => {
  it("is sorted ascending by threshold", () => {
    for (let i = 1; i < MILESTONES.length; i++) {
      expect(MILESTONES[i].threshold).toBeGreaterThan(MILESTONES[i - 1].threshold);
    }
  });

  it("has unique, distinct bit flags", () => {
    const bits = MILESTONES.map((m) => m.bit);
    expect(new Set(bits).size).toBe(bits.length);
    // Each bit is a distinct power of two
    for (const bit of bits) {
      expect(bit & (bit - 1)).toBe(0);
    }
  });

  it("rewards are all positive", () => {
    for (const m of MILESTONES) {
      expect(m.reward.glory).toBeGreaterThan(0);
      expect(m.reward.wardog).toBeGreaterThan(0);
      expect(m.reward.warcat).toBeGreaterThan(0);
    }
  });
});

describe("buildReferralLink", () => {
  it("builds a startapp deep link with the bot username", () => {
    const link = buildReferralLink("WAR-ABC123");
    expect(link).toBe(`https://t.me/${REFERRAL_BOT}?startapp=WAR-ABC123`);
  });
});

describe("buildReferralShareText", () => {
  it("embeds the referral link", () => {
    const text = buildReferralShareText("WAR-XYZ");
    expect(text).toContain(buildReferralLink("WAR-XYZ"));
  });
});
