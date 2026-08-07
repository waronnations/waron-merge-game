// src/components/payments/PaymentModal.tsx
import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
} from "lucide-react";

import { actionLabel, type PaidActionId } from "@/lib/payments";

type BtnProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost";
  className?: string;
};

/** Local button — the project has no shadcn ui/ primitives. */
function Btn({
  children,
  onClick,
  variant = "primary",
  className = "",
}: BtnProps) {
  const styles =
    variant === "primary"
      ? "bg-primary text-white hover:brightness-110"
      : variant === "outline"
        ? "border border-white/20 text-white/80 hover:bg-white/5"
        : "text-white/50 hover:text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold uppercase tracking-wide transition ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export type PaymentPhase =
  | "connect"
  | "creating"
  | "awaiting_wallet"
  | "verifying"
  | "success"
  | "error";

export interface PaymentModalState {
  action: PaidActionId;
  phase: PaymentPhase;
  /** @deprecated kept optional for older callers — UI never shows TON */
  amountTon?: number;
  message?: string;
}

const PHASE_COPY: Record<PaymentPhase, { title: string; body: string }> = {
  connect: {
    title: "Connect your wallet",
    body: "Link a TON wallet once. It stays connected until you disconnect. You still pay with $WARDOG or $WARCAT — never native TON.",
  },
  creating: {
    title: "Preparing",
    body: "Opening a secure authorization for this action…",
  },
  awaiting_wallet: {
    title: "Confirm in your wallet",
    body: "Approve in your wallet if prompted. Spend is always $WARDOG or $WARCAT in-game.",
  },
  verifying: {
    title: "Authorizing",
    body: "Binding this action to your connected wallet…",
  },
  success: {
    title: "Wallet authorized",
    body: "Continue — choose $WARDOG or $WARCAT to complete the purchase.",
  },
  error: {
    title: "Authorization failed",
    body: "Something went wrong.",
  },
};

export function PaymentModal({
  state,
  address,
  onConnect,
  onRetry,
  onClose,
  onDone,
  onOpenApiKey,
}: {
  state: PaymentModalState | null;
  address: string;
  onConnect: () => void | Promise<void>;
  onRetry: () => void;
  onClose: () => void;
  onDone: () => void;
  onOpenApiKey: () => void;
}) {
  const busy =
    state?.phase === "creating" ||
    state?.phase === "awaiting_wallet" ||
    state?.phase === "verifying";

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!busy) onClose();
          }}
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
                {state.phase === "success" ? (
                  <CheckCircle2 className="size-5" />
                ) : state.phase === "error" ? (
                  <AlertTriangle className="size-5" />
                ) : busy ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Wallet className="size-5" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold uppercase tracking-wide">
                  {PHASE_COPY[state.phase].title}
                </h3>
                <p className="mt-1 text-sm text-white/60">
                  {state.message ?? PHASE_COPY[state.phase].body}
                </p>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">
                  {actionLabel(state.action)}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  $WARDOG / $WARCAT
                </span>
              </div>
              {address ? (
                <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                  <span>Connected</span>
                  <span className="font-mono">
                    {address.slice(0, 6)}…{address.slice(-4)}
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-xs text-white/40">
                  Wallet not connected yet
                </div>
              )}
              <p className="mt-2 text-[0.65rem] leading-relaxed text-zinc-500">
                No native TON or $GRAM is charged. After authorization, the
                cost is taken from your chosen in-game token.
              </p>
            </div>

            <div className="space-y-2">
              {state.phase === "connect" && (
                <Btn onClick={() => void onConnect()}>
                  <Wallet className="mr-2 size-4" /> Connect Wallet
                </Btn>
              )}
              {state.phase === "success" && (
                <Btn onClick={onDone}>Continue</Btn>
              )}
              {state.phase === "error" && (
                <>
                  <Btn onClick={onRetry}>Try again</Btn>
                  <Btn variant="outline" onClick={onOpenApiKey}>
                    <KeyRound className="mr-2 size-4" /> TON API key (optional)
                  </Btn>
                </>
              )}
              {!busy && state.phase !== "success" && (
                <Btn variant="ghost" onClick={onClose}>
                  Cancel
                </Btn>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
