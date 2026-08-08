// src/components/nuke/use-nuke-strike.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { GameState } from "@/lib/game-state";
import { haptic, shareUrl, getTelegram } from "@/lib/telegram";
import { listNationsFn } from "@/lib/nations.functions";
import type { NationRow } from "./NationTargetGrid";
import type { NukeResult } from "./StrikeResultCard";

const BOT_LINK = "https://t.me/waronnationsgamebot";

export function useNukeStrike({
  state,
  onLaunch,
}: {
  state: GameState;
  onLaunch: (targetNationId: number) => Promise<NukeResult>;
}) {
  const [nations, setNations] = useState<NationRow[]>([]);
  const [loadingNations, setLoadingNations] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  /** Cinematic only — clears fast */
  const [phase, setPhase] = useState<"idle" | "launch" | "impact">("idle");
  const [lastResult, setLastResult] = useState<NukeResult | null>(null);
  const [search, setSearch] = useState("");
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const owned = Number(state.nukesOwned ?? 0);
  const isTerrorist = Boolean(state.isTerrorist);
  const totalLaunched = Number(state.totalNukesLaunched ?? 0);

  const referralCode = String(state.referralCode || "").trim();
  const inviteLink = referralCode
    ? `https://t.me/waronnationsgamebot?startapp=${referralCode}`
    : BOT_LINK;

  const selected = nations.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingNations(true);
        const list = await listNationsFn();
        if (!cancelled && Array.isArray(list)) {
          setNations(
            list
              .filter((n: any) => n && typeof n.id === "number")
              .map((n: any) => ({
                id: n.id,
                name: n.name,
                tag: n.tag,
                emblem: n.emblem || "⚔",
                isDefault: n.isDefault,
                memberCount: n.memberCount,
                reputation: n.reputation,
                lastNukeLaunchedAt: n.lastNukeLaunchedAt ?? null,
                nukesOwnedTotal: Number(n.nukesOwnedTotal ?? 0),
                timesNuked: Number(n.timesNuked ?? 0),
                isProtected: Boolean(n.isProtected),
              })),
          );
        }
      } catch {
        toast.error("Failed to load nations");
      } finally {
        if (!cancelled) setLoadingNations(false);
      }
    })();
    return () => {
      cancelled = true;
      if (animTimer.current) clearTimeout(animTimer.current);
    };
  }, []);

  const filtered = nations.filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      n.name.toLowerCase().includes(q) || n.tag.toLowerCase().includes(q)
    );
  });

  const selectedIsProtected = Boolean(selected?.isProtected);

  const canLaunch =
    owned > 0 &&
    selectedId !== null &&
    !busy &&
    phase === "idle" &&
    !selectedIsProtected;

  const clearAnim = () => {
    if (animTimer.current) {
      clearTimeout(animTimer.current);
      animTimer.current = null;
    }
  };

  const handleLaunch = useCallback(async () => {
    if (!canLaunch || selectedId === null) return;

    setBusy(true);
    setLastResult(null);
    setPhase("launch");
    haptic("medium");
    clearAnim();

    try {
      const resPromise = onLaunch(selectedId);
      await new Promise((r) => setTimeout(r, 700));

      const res = await resPromise;

      if (!res.ok) {
        setPhase("idle");
        const msg =
          res.reason === "no_nukes_owned"
            ? "No Strategic Nukes owned — buy one in the Shop"
            : res.reason === "cannot_nuke_own_nation"
              ? "You cannot nuke your own nation"
              : res.reason === "nation_not_found"
                ? "Nation not found"
                : res.reason === "nation_protected"
                  ? "This nation is under 24h protection"
                  : res.reason === "recently_nuked"
                    ? "Nation was recently struck — short protection active"
                    : "Strike failed";
        toast.error(msg);
        return;
      }

      setPhase("impact");
      setLastResult(res);
      haptic("heavy");

      if (res.becameTerrorist) {
        toast.error("☢ You are now a TERRORIST", { duration: 5000 });
      } else if (res.wasPeaceful) {
        toast.warning("Peaceful nation — reduced rewards");
      } else {
        toast.success(`☢ ${res.targetName} struck`);
      }

      animTimer.current = setTimeout(() => setPhase("idle"), 480);
    } catch {
      setPhase("idle");
      toast.error("Strike failed");
    } finally {
      setBusy(false);
    }
  }, [canLaunch, selectedId, onLaunch]);

  const buildStrikeShareText = () => {
    if (!lastResult?.ok) return "";

    const name = lastResult.targetName ?? "a nation";
    const glory = lastResult.glory ?? 0;
    const energy = lastResult.energy ?? 0;
    const tokens = (lastResult.tokens ?? 0).toFixed(2);

    const lines = [
      "☢  STRIKE SUCCESSFUL",
      "",
      `${name} has been hit.`,
      "",
      `★  +${glory} glory`,
      `⚡  +${energy} energy`,
      `🪙  +${tokens} tokens`,
    ];

    if (lastResult.transferred != null) {
      lines.push("", `Vault transfer: ${lastResult.transferred} tokens`);
    }
    if (lastResult.wasPeaceful) {
      lines.push("", "⚠ Peaceful nation — reduced rewards");
    }
    if (lastResult.becameTerrorist) {
      lines.push("", "☠ Marked TERRORIST");
    }

    lines.push(
      "",
      "────────────",
      "",
      "Play WAR ON NATIONS",
      "Merge · claim countries · launch strategic nukes",
      "",
      "Join my squad:",
      inviteLink,
    );

    if (referralCode) {
      lines.push("", `My recruit code: ${referralCode}`);
    }

    lines.push("", "#WarOnNations  #WARDOG  #WARCAT");

    return lines.join("\n");
  };

  const shareStrikeTelegram = () => {
    const text = buildStrikeShareText();
    if (!text) return;
    shareUrl(inviteLink, text);
    haptic("medium");
  };

  const shareStrikeX = () => {
    const text = buildStrikeShareText();
    if (!text) return;
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    const tg = getTelegram();
    try {
      if (tg?.openLink) tg.openLink(intent);
      else window.open(intent, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = intent;
    }
    haptic("medium");
  };

  return {
    nations,
    loadingNations,
    selectedId,
    setSelectedId,
    busy,
    phase,
    lastResult,
    setLastResult,
    search,
    setSearch,
    owned,
    isTerrorist,
    totalLaunched,
    selected,
    filtered,
    selectedIsProtected,
    canLaunch,
    handleLaunch,
    shareStrikeTelegram,
    shareStrikeX,
  };
}
