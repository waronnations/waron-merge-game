// src/components/CocoonGenerateModal.tsx
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

interface Props {
  open: boolean;
  onBack: () => void;
  onSuccess: (imageUrl: string) => void;
  seed?: string;
  imagePrompt?: string;
}

type Step = "intro" | "generating" | "error";

export function CocoonGenerateModal({
  open,
  onBack,
  onSuccess,
  seed,
  imagePrompt,
}: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("intro");
      setErrorMsg(null);
    }
  }, [open]);

  const handleBack = () => {
    setStep("intro");
    setErrorMsg(null);
    onBack();
  };

  const handleGenerate = async () => {
    setErrorMsg(null);
    setStep("generating");

    try {
      await new Promise((r) => setTimeout(r, 2200));

      if (Math.random() < 0.08) {
        throw new Error("generation_failed");
      }

      const label = encodeURIComponent(
        `HYBRID\n${seed?.slice(-8) || "UNIQUE"}`,
      );
      const fakeImageUrl = `https://placehold.co/512x512/1a1a2e/fbbf24?text=${label}`;

      onSuccess(fakeImageUrl);
      setStep("intro");
    } catch {
      setErrorMsg(
        "Art generation failed. You can try again or go back and keep a standard hybrid unit for free.",
      );
      setStep("error");
      toast.error("Hybrid art generation failed");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-purple-500/40 bg-gradient-to-b from-zinc-900 to-black p-6 shadow-[0_0_80px_rgba(168,85,247,0.25)]"
            initial={{ scale: 0.85, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 30 }}
          >
            <button
              type="button"
              onClick={handleBack}
              className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>

            <div className="mb-5 mt-6 text-center">
              <div className="mb-1 text-[10px] font-bold tracking-[0.2em] text-purple-400">
                TROPHY ART
              </div>
              <h2 className="text-xl font-black text-white">
                Generate Hybrid Look
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Optional cosmetic art for this hybrid. Not an NFT mint. Payment
                and Cocoon pipeline are still being connected — this build may
                use a preview image.
              </p>
              {seed && (
                <p className="mt-2 font-mono text-[10px] text-zinc-600">
                  seed {seed.slice(0, 24)}
                  {seed.length > 24 ? "…" : ""}
                </p>
              )}
            </div>

            {step === "intro" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-zinc-700 bg-zinc-900/80 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">
                    When live
                  </div>
                  <div className="mt-1 text-lg font-black text-white">
                    ~0.15 TON
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    or token equivalent · preview mode free for now
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  className="w-full rounded-2xl bg-purple-600 py-4 font-bold text-white transition hover:bg-purple-500"
                >
                  Generate Preview Art
                </button>

                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full rounded-2xl border border-zinc-700 py-3 text-sm text-zinc-400"
                >
                  Cancel — keep standard hybrid instead
                </button>
              </div>
            )}

            {step === "generating" && (
              <div className="py-10 text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
                <div className="font-bold text-purple-300">
                  Generating trophy art…
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  {imagePrompt
                    ? "Using hybrid seed & prompt"
                    : "Preparing preview"}
                </div>
              </div>
            )}

            {step === "error" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-center text-sm text-red-200">
                  {errorMsg ?? "Generation failed."}
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  className="w-full rounded-2xl bg-purple-600 py-4 font-bold text-white"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full rounded-2xl border border-zinc-700 py-3 text-sm text-zinc-400"
                >
                  Back — keep unit without art
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
