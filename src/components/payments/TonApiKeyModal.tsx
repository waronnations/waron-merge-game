import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import {
  TON_API_KEY_PROVIDERS,
  getStoredTonApiKey,
  storeTonApiKey,
} from "@/lib/payments";

/**
 * Players can supply their own TON indexer key so on-chain verification is
 * fast and never rate-limited. The key is stored locally on their device and
 * only forwarded to the server for the duration of a verification call.
 */
export function TonApiKeyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [value, setValue] = useState(() => getStoredTonApiKey());

  const save = () => {
    storeTonApiKey(value.trim());
    toast.success(value.trim() ? "TON API key saved on this device" : "TON API key cleared");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[96] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#0b0b0f] p-5 pb-8 sm:rounded-2xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-0.5 rounded-lg border border-primary/40 bg-primary/10 p-2 text-primary">
                <KeyRound className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold uppercase tracking-wide">TON API key</h3>
                <p className="mt-1 text-sm text-white/60">
                  Optional. Without a key we use the free public endpoint, which is rate
                  limited and can delay payment confirmation.
                </p>
              </div>
            </div>

            <div className="mb-4 space-y-2">
              {TON_API_KEY_PROVIDERS.map((provider) => (
                <a
                  key={provider.url}
                  href={provider.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm transition hover:border-primary/40"
                >
                  <span>
                    <span className="font-semibold">{provider.name}</span>
                    <span className="block text-xs text-white/45">{provider.hint}</span>
                  </span>
                  <ExternalLink className="size-4 shrink-0 text-white/40" />
                </a>
              ))}
            </div>

            <label className="mb-1 block text-xs uppercase tracking-wide text-white/40">
              Paste your key
            </label>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="AE...your TonAPI key"
              autoComplete="off"
              spellCheck={false}
              className="mb-4 h-11 w-full rounded-xl border border-white/15 bg-black/60 px-3 font-mono text-sm outline-none focus:border-primary/60"
            />

            <div className="space-y-2">
              <button
                type="button"
                onClick={save}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
              >
                Save key
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold uppercase tracking-wide text-white/50 transition hover:text-white"
              >
                Not now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
