// src/components/game/TabHero.tsx
import type { PrimaryTab } from "@/components/game/PrimaryTabBar";

export const TAB_HERO: Record<PrimaryTab, { title: string; desc: string }> = {
  play: {
    title: "Battlefield",
    desc: "Deploy recruits · merge same-tier units · climb tiers for glory & tokens.",
  },
  ops: {
    title: "Daily operations",
    desc: "Finish the 3 daily ops, then tap CLAIM — rewards only pay when claimed.",
  },
  world: {
    title: "World theater",
    desc: "Join or lead a nation, or launch Strategic Nukes against other countries.",
  },
  earn: {
    title: "Economy",
    desc: "Shop uses topped-up tokens · Claim unclaimed merge earnings · Recruit allies.",
  },
  base: {
    title: "Your command",
    desc: "Profile stats and the global ranks leaderboard.",
  },
};

export function TabHero({ tab }: { tab: PrimaryTab }) {
  const h = TAB_HERO[tab];
  return (
    <div className="tab-hero mb-3">
      <div className="tab-hero-title">{h.title}</div>
      <p className="tab-hero-desc">{h.desc}</p>
    </div>
  );
}
