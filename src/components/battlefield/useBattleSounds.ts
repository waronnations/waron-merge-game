import { useCallback, useRef } from "react";

type Sfx = "shot" | "empty" | "hit" | "reload" | "playerHit" | "headshot";

export function useBattleSounds() {
  const ctxRef = useRef<AudioContext | null>(null);

  const ctx = () => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    return ctxRef.current;
  };

  const unlock = useCallback(async () => {
    const c = ctx();
    if (c && c.state === "suspended") await c.resume();
  }, []);

  const beep = (
    c: AudioContext,
    type: OscillatorType,
    freq: number,
    dur: number,
    gain = 0.08,
    extra?: (o: OscillatorNode, g: GainNode) => void,
  ) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    extra?.(o, g);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  };

  const play = useCallback((name: Sfx) => {
    const c = ctx();
    if (!c) return;
    const t = c.currentTime;
    if (name === "shot") {
      beep(c, "sawtooth", 180, 0.07, 0.07);
      beep(c, "square", 90, 0.05, 0.05);
    } else if (name === "empty") {
      beep(c, "square", 70, 0.08, 0.04);
    } else if (name === "hit") {
      beep(c, "triangle", 420, 0.06, 0.05);
    } else if (name === "headshot") {
      beep(c, "triangle", 880, 0.09, 0.06);
      beep(c, "sine", 1320, 0.07, 0.03);
    } else if (name === "reload") {
      beep(c, "square", 140, 0.12, 0.04);
    } else if (name === "playerHit") {
      beep(c, "sawtooth", 60, 0.16, 0.09);
    }
    void t;
  }, []);

  return { play, unlock };
}
