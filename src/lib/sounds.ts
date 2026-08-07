// src/lib/sounds.ts
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (common on mobile / Telegram)
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

/** Soft click / UI feedback */
export function playClick() {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "sine";
  osc.frequency.value = 420;
  gain.gain.setValueAtTime(0.04, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
  osc.start();
  osc.stop(c.currentTime + 0.08);
}

/** Merge sound — scales with tier */
export function playMerge(tier: number) {
  const c = getCtx();
  if (!c) return;

  const base = 160 + tier * 35;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "square";
  osc.frequency.setValueAtTime(base, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(base * 1.6, c.currentTime + 0.12);
  gain.gain.setValueAtTime(0.07 + tier * 0.012, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
  osc.start();
  osc.stop(c.currentTime + 0.18);

  // Soft second harmonic for higher tiers
  if (tier >= 3) {
    const osc2 = c.createOscillator();
    const gain2 = c.createGain();
    osc2.connect(gain2);
    gain2.connect(c.destination);
    osc2.type = "triangle";
    osc2.frequency.value = base * 1.5;
    gain2.gain.setValueAtTime(0.03, c.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
    osc2.start();
    osc2.stop(c.currentTime + 0.2);
  }
}

/** Legendary / T5 sacrifice */
export function playLegendary() {
  const c = getCtx();
  if (!c) return;
  const notes = [180, 240, 320, 420];
  notes.forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = "sawtooth";
    osc.frequency.value = f;
    const t = c.currentTime + i * 0.07;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  });
}

/** Rank-up fanfare */
export function playRankUp() {
  const c = getCtx();
  if (!c) return;
  const notes = [220, 277, 330, 440, 554];
  notes.forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = "triangle";
    osc.frequency.value = f;
    const t = c.currentTime + i * 0.11;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.11, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.start(t);
    osc.stop(t + 0.45);
  });
}

/** Heavy impact (nuke / rank cinematic) */
export function playHeavyImpact() {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(80, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.4);
  gain.gain.setValueAtTime(0.18, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45);
  osc.start();
  osc.stop(c.currentTime + 0.45);
}

/**
 * Hybrid T5×T5 clash — layered boom when the nuke shroom appears.
 * Noise crack + sub thump + bright sting (works on Telegram / mobile).
 */
export function playNukeExplosion() {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;

  // --- 1) Filtered noise burst (crack / debris) ---
  const duration = 0.9;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const env = Math.pow(1 - i / bufferSize, 2.2);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(1200, t0);
  noiseFilter.frequency.exponentialRampToValueAtTime(180, t0 + 0.55);
  noiseFilter.Q.value = 0.7;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t0);
  noiseGain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(c.destination);
  noise.start(t0);
  noise.stop(t0 + duration);

  // --- 2) Sub boom (body of the blast) ---
  const sub = c.createOscillator();
  const subGain = c.createGain();
  sub.type = "sine";
  sub.frequency.setValueAtTime(90, t0);
  sub.frequency.exponentialRampToValueAtTime(28, t0 + 0.7);
  subGain.gain.setValueAtTime(0.0001, t0);
  subGain.gain.exponentialRampToValueAtTime(0.55, t0 + 0.025);
  subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95);
  sub.connect(subGain);
  subGain.connect(c.destination);
  sub.start(t0);
  sub.stop(t0 + 1.0);

  // --- 3) Mid growl ---
  const mid = c.createOscillator();
  const midGain = c.createGain();
  mid.type = "sawtooth";
  mid.frequency.setValueAtTime(140, t0);
  mid.frequency.exponentialRampToValueAtTime(45, t0 + 0.45);
  midGain.gain.setValueAtTime(0.0001, t0);
  midGain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
  midGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
  mid.connect(midGain);
  midGain.connect(c.destination);
  mid.start(t0);
  mid.stop(t0 + 0.55);

  // --- 4) Bright sting (impact snap) ---
  const snap = c.createOscillator();
  const snapGain = c.createGain();
  snap.type = "triangle";
  snap.frequency.setValueAtTime(880, t0);
  snap.frequency.exponentialRampToValueAtTime(220, t0 + 0.12);
  snapGain.gain.setValueAtTime(0.0001, t0);
  snapGain.gain.exponentialRampToValueAtTime(0.1, t0 + 0.01);
  snapGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  snap.connect(snapGain);
  snapGain.connect(c.destination);
  snap.start(t0);
  snap.stop(t0 + 0.2);
}

/** Claim / reward collect */
export function playClaim() {
  const c = getCtx();
  if (!c) return;
  const notes = [520, 680, 860];
  notes.forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = "sine";
    osc.frequency.value = f;
    const t = c.currentTime + i * 0.06;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.start(t);
    osc.stop(t + 0.22);
  });
}

/** Error / blocked action */
export function playError() {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "square";
  osc.frequency.value = 110;
  gain.gain.setValueAtTime(0.06, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
  osc.start();
  osc.stop(c.currentTime + 0.2);
}
