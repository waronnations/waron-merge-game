import { describe, it, expect } from "vitest";
import { getActiveEvents, getGloryMultiplier, getEnergyRegenMultiplier } from "@/lib/events";

describe("getActiveEvents", () => {
  it("activates double_glory during the Fri-Sun UTC weekend window", () => {
    // Saturday 12:00 UTC
    const saturdayNoon = Date.UTC(2024, 0, 6, 12, 0, 0); // 2024-01-06 is a Saturday
    const events = getActiveEvents(saturdayNoon);
    expect(events.some((e) => e.id === "double_glory")).toBe(true);
  });

  it("does not activate double_glory on a Wednesday", () => {
    const wednesday = Date.UTC(2024, 0, 3, 12, 0, 0); // 2024-01-03 is a Wednesday
    const events = getActiveEvents(wednesday);
    expect(events.some((e) => e.id === "double_glory")).toBe(false);
  });

  it("activates energy_frenzy between 18:00 and 19:00 UTC", () => {
    const during = Date.UTC(2024, 0, 3, 18, 30, 0);
    const outside = Date.UTC(2024, 0, 3, 12, 0, 0);
    expect(getActiveEvents(during).some((e) => e.id === "energy_frenzy")).toBe(true);
    expect(getActiveEvents(outside).some((e) => e.id === "energy_frenzy")).toBe(false);
  });
});

describe("getGloryMultiplier", () => {
  it("returns 1 with no events", () => {
    expect(getGloryMultiplier([], 5)).toBe(1);
  });

  it("multiplies gloryMult across events", () => {
    const events = [{ id: "double_glory", name: "", desc: "", color: "", endsAt: 0, gloryMult: 2 }] as any;
    expect(getGloryMultiplier(events, 3)).toBe(2);
  });

  it("applies highTierBonus only for tier >= 4", () => {
    const events = [
      { id: "legendary_surge", name: "", desc: "", color: "", endsAt: 0, highTierBonus: 1.5 },
    ] as any;
    expect(getGloryMultiplier(events, 3)).toBe(1);
    expect(getGloryMultiplier(events, 4)).toBe(1.5);
  });
});

describe("getEnergyRegenMultiplier", () => {
  it("returns 1 with no events", () => {
    expect(getEnergyRegenMultiplier([])).toBe(1);
  });
  it("multiplies energyRegenMult across events", () => {
    const events = [{ id: "energy_frenzy", name: "", desc: "", color: "", endsAt: 0, energyRegenMult: 2 }] as any;
    expect(getEnergyRegenMultiplier(events)).toBe(2);
  });
});
