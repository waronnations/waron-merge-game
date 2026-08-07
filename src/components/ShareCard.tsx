// src/components/ShareCard.tsx
// Cinematic, on-brand shareable card (same visual language as WarDispatch).
// Renders a 1080x1350 canvas, then offers Telegram share / X share / copy.
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Send, Twitter, X as XIcon, Download } from "lucide-react";
import { toast } from "sonner";
import { haptic, shareUrl, tgUser } from "@/lib/telegram";
import { GAME_LINK, xIntentUrl, type SharePayload } from "@/lib/share";

export function ShareCard({
  open,
  payload,
  onClose,
}: {
  open: boolean;
  payload: SharePayload | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !payload) return;
    setUrl(null);
    haptic("heavy");
    const t = setTimeout(() => draw(payload), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payload]);

  const draw = (p: SharePayload) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a0f");
    grad.addColorStop(1, "#1a0505");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Diagonal hazard stripes behind the glyph
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 28;
    for (let x = -H; x < W + H; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + H, H);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = p.accent;
    ctx.fillRect(0, 0, W, 14);
    ctx.fillRect(0, H - 14, W, 14);

    ctx.textAlign = "center";
    ctx.fillStyle = "#8a8a92";
    ctx.font = "bold 26px system-ui";
    ctx.fillText(p.kicker, W / 2, 96);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px system-ui";
    ctx.fillText("WAR ON NATIONS", W / 2, 148);

    ctx.font = "150px system-ui";
    ctx.fillText(p.glyph, W / 2, 350);

    ctx.fillStyle = p.accent;
    ctx.font = "bold 78px system-ui";
    ctx.fillText(p.title, W / 2, 460);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 46px system-ui";
    ctx.fillText(p.subject, W / 2, 530);

    const name = tgUser()?.first_name || "Commander";
    ctx.fillStyle = "#8a8a92";
    ctx.font = "32px system-ui";
    ctx.fillText(`by ${name}`, W / 2, 585);

    // Stats box
    const boxTop = 640;
    const rowH = 92;
    const boxH = rowH * p.stats.length + 40;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(80, boxTop, W - 160, boxH);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 3;
    ctx.strokeRect(80, boxTop, W - 160, boxH);

    p.stats.forEach((s, i) => {
      const y = boxTop + 40 + i * rowH + 30;
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 34px system-ui";
      ctx.fillText(s.label, 130, y);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px system-ui";
      ctx.fillText(s.value, W - 130, y);
    });

    ctx.textAlign = "center";
    ctx.fillStyle = p.accent;
    ctx.font = "bold 30px system-ui";
    ctx.fillText("FEED THE PACK • $WARDOG & $WARCAT", W / 2, boxTop + boxH + 90);

    ctx.fillStyle = "#666";
    ctx.font = "26px system-ui";
    ctx.fillText("t.me/waronnationsgamebot", W / 2, boxTop + boxH + 140);

    setUrl(canvas.toDataURL("image/png"));
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
      haptic("light");
    } catch {
      toast.error("Copy failed");
    }
  };

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "war-on-nations.png";
    a.click();
  };

  return (
    <AnimatePresence>
      {open && payload && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/95 p-4"
        >
          <canvas ref={canvasRef} className="hidden" />
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex w-full max-w-md flex-col items-center gap-4"
          >
            {url ? (
              <img
                src={url}
                alt={payload.title}
                className="w-full rounded-2xl border border-zinc-700 shadow-2xl"
              />
            ) : (
              <div className="grid h-64 w-full place-items-center rounded-2xl border border-zinc-800 bg-zinc-900 text-xs uppercase tracking-widest text-zinc-500">
                Rendering dispatch…
              </div>
            )}

            <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
              <div className="whitespace-pre-wrap text-[0.7rem] leading-relaxed text-zinc-300">
                {payload.telegramText}
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2">
              <button
                onClick={() => {
                  // Prefer referral deep-link when present
                  shareUrl(payload.shareLink || GAME_LINK, payload.telegramText);
                  haptic("medium");
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#c8102e] py-3 text-xs font-black uppercase tracking-widest text-white"
              >
                <Send className="h-4 w-4" /> Telegram
              </button>
              <a
                href={xIntentUrl(payload)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => haptic("medium")}
                className="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-3 text-xs font-black uppercase tracking-widest text-black"
              >
                <Twitter className="h-4 w-4" /> Post on X
              </a>
              <button
                onClick={() => copyText(payload.telegramText, "Message")}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-xs font-bold uppercase tracking-widest text-zinc-300"
              >
                <Copy className="h-4 w-4" /> Copy text
              </button>
              <button
                onClick={download}
                disabled={!url}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-xs font-bold uppercase tracking-widest text-zinc-300 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Save card
              </button>
            </div>

            <button
              onClick={onClose}
              className="flex items-center gap-1.5 pb-6 text-xs font-bold uppercase tracking-widest text-zinc-500"
            >
              <XIcon className="h-3.5 w-3.5" /> Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
