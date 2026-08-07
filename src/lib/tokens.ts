// Live TON contract addresses for the WARON MERGE reward tokens.
// These are the real on-chain jetton master addresses.

export const WARDOG_CA = "EQAmjezmAjiXZ7XfoLGQbNIm4CIEcQwM9CNbpTZJgcN9LeVi";
export const WARCAT_CA = "EQDMqYAfQ1FnMpvkm4aJstq2Gx2ebPLq9vcBfPSxoBNw1kqb";

export interface TokenDef {
  symbol: "$WARDOG" | "$WARCAT";
  name: string;
  contractAddress: string;
  color: string;
  glow: string;
  tonviewer: string;
  dedust: string;
}

export const TOKENS: Record<"wardog" | "warcat", TokenDef> = {
  wardog: {
    symbol: "$WARDOG",
    name: "War Dog",
    contractAddress: WARDOG_CA,
    color: "#c8102e",
    glow: "#ff2e4e",
    tonviewer: `https://tonviewer.com/${WARDOG_CA}`,
    dedust: `https://dedust.io/swap/TON/${WARDOG_CA}`,
  },
  warcat: {
    symbol: "$WARCAT",
    name: "War Cat",
    contractAddress: WARCAT_CA,
    color: "#9b2d8c",
    glow: "#e070d0",
    tonviewer: `https://tonviewer.com/${WARCAT_CA}`,
    dedust: `https://dedust.io/swap/TON/${WARCAT_CA}`,
  },
};

export function shortenAddress(addr: string, head = 4, tail = 4): string {
  if (addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/**
 * Normalize a token amount to exactly 4 decimal places.
 * Prevents floating-point drift while keeping the same visible economy.
 */
export function normalizeToken(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Safe addition of two token amounts.
 */
export function addTokens(a: number, b: number): number {
  return normalizeToken(Number(a) + Number(b));
}

/**
 * Safe subtraction (never goes below zero).
 */
export function subTokens(a: number, b: number): number {
  return normalizeToken(Math.max(0, Number(a) - Number(b)));
}
