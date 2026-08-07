// src/lib/preload-units.ts
// Preloads every unit / FX image into browser memory + HTTP cache
// so the board never “pops in” slowly the second time a tier appears.
import { UNITS } from "@/lib/units";

/** Collect every static unit image path used by the game */
function collectUnitImageUrls(): string[] {
  const urls = new Set<string>();

  for (const faction of ["dog", "cat"] as const) {
    for (const variants of UNITS[faction]) {
      for (const unit of variants) {
        if (unit.image) urls.add(unit.image);
      }
    }
  }

  // Nuke mushroom FX used by hybrid clash
  for (const color of ["green", "purple", "yellow", "blue", "magenta"] as const) {
    urls.add(`/images/units/nuke_shroom_${color}.png`);
  }

  return Array.from(urls);
}

const ALL_URLS = collectUnitImageUrls();

let started = false;

/**
 * Fire-and-forget preload. Safe to call multiple times.
 * Uses the browser Image() constructor so files land in memory + HTTP cache.
 */
export function preloadUnitImages(): void {
  if (typeof window === "undefined") return;
  if (started) return;
  started = true;

  for (const src of ALL_URLS) {
    try {
      const img = new Image();
      img.decoding = "async";
      // Prefer high priority when supported
      if ("fetchPriority" in img) {
        (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority =
          "high";
      }
      img.src = src;
    } catch {
      /* ignore individual failures */
    }
  }
}

/**
 * Optional: also pin remote hybrid art into Cache API so it survives reloads.
 * Call this when a hybrid imageUrl is known.
 */
export async function cacheRemoteImage(url: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!url || !url.startsWith("http")) return;
  if (!("caches" in window)) return;

  try {
    const cache = await caches.open("waron-hybrid-art-v1");
    const hit = await cache.match(url);
    if (!hit) {
      await cache.add(url);
    }
  } catch {
    /* Cache API can fail in private mode — non-fatal */
  }
}
