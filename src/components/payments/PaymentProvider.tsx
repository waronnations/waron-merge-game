// src/components/payments/PaymentProvider.tsx
/**
 * Wallet authorization for paid actions.
 *
 * - Requires TON Connect wallet for shop / nations / redeem (not board energy).
 * - Does NOT charge native TON or $GRAM.
 * - After wallet is connected, the caller spends $WARDOG or $WARCAT server-side.
 * - Connection persists via TonConnect until the player disconnects.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { toast } from "sonner";

import {
  actionLabel,
  type PaidActionId,
} from "@/lib/payments";
import { createPaymentIntentFn, confirmPaymentFn } from "@/lib/payments.functions";
import { haptic } from "@/lib/telegram";
import { track } from "@/lib/analytics";
import { captureException } from "@/lib/monitoring";
import { PaymentModal, type PaymentModalState } from "./PaymentModal";
import { TonApiKeyModal } from "./TonApiKeyModal";

export interface PaymentResult {
  ok: boolean;
  reason?: "wallet_required" | "cancelled" | "not_found" | "failed";
}

interface PaymentContextValue {
  /**
   * Ensure wallet is connected and record an authorization intent.
   * Does not send native TON. Caller then spends WARDOG/WARCAT.
   */
  pay: (action: PaidActionId) => Promise<PaymentResult>;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  openApiKeyModal: () => void;
  address: string;
  connected: boolean;
}

const PaymentContext = createContext<PaymentContextValue | null>(null);

export function usePayments(): PaymentContextValue {
  const ctx = useContext(PaymentContext);
  if (!ctx) {
    return {
      pay: async () => ({ ok: false, reason: "failed" }),
      connectWallet: async () => {},
      disconnectWallet: async () => {},
      openApiKeyModal: () => {},
      address: "",
      connected: false,
    };
  }
  return ctx;
}

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();
  const [modal, setModal] = useState<PaymentModalState | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const resolver = useRef<((r: PaymentResult) => void) | null>(null);
  /** Action waiting for the player to finish connecting. */
  const pendingAction = useRef<PaidActionId | null>(null);

  const finish = useCallback((result: PaymentResult) => {
    setModal(null);
    pendingAction.current = null;
    resolver.current?.(result);
    resolver.current = null;
  }, []);

  const connectWallet = useCallback(async () => {
    try {
      await tonConnectUI.openModal();
      track("wallet_connect");
    } catch (err) {
      captureException(err, { where: "connectWallet" });
    }
  }, [tonConnectUI]);

  const disconnectWallet = useCallback(async () => {
    try {
      await tonConnectUI.disconnect();
      track("wallet_disconnect");
      toast.message("Wallet disconnected");
    } catch {
      /* already disconnected */
    }
  }, [tonConnectUI]);

  /**
   * Authorize a paid action with a connected wallet.
   * Creates + confirms a server intent (mock = no on-chain TON).
   * Never sends native TON from the client.
   */
  const authorizeAction = useCallback(
    async (action: PaidActionId, wallet: string): Promise<boolean> => {
      setModal({ action, phase: "creating" });
      track("payment_started", { action, currency: "wardog_warcat" });

      try {
        const intent = await createPaymentIntentFn({
          data: { action, walletAddress: wallet },
        });

        // No native TON transfer — spend is always WARDOG/WARCAT on the game server.
        setModal({ action, phase: "verifying" });

        const res = await confirmPaymentFn({
          data: { intentId: intent.intentId },
        });

        if (res.ok) {
          haptic("medium");
          track("payment_confirmed", { action, mode: intent.mode });
          setModal({ action, phase: "success" });
          return true;
        }

        setModal({
          action,
          phase: "error",
          message: "Could not authorize this action. Please try again.",
        });
        return false;
      } catch (err) {
        captureException(err, { where: "authorizeAction", action });
        setModal({
          action,
          phase: "error",
          message: "Authorization failed. Please try again.",
        });
        return false;
      }
    },
    [],
  );

  const pay = useCallback(
    (action: PaidActionId): Promise<PaymentResult> => {
      return new Promise<PaymentResult>((resolve) => {
        resolver.current = resolve;
        pendingAction.current = action;

        void (async () => {
          // Not connected → prompt connect (session persists until disconnect)
          if (!address) {
            setModal({ action, phase: "connect" });
            return;
          }

          try {
            const ok = await authorizeAction(action, address);
            if (!ok) return; // modal stays open for retry
            // Brief success, then resolve so the caller can spend tokens
            await new Promise((r) => setTimeout(r, 400));
            finish({ ok: true });
            toast.success(`${actionLabel(action)} authorized · pay with $WARDOG or $WARCAT`);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (/reject|cancel|abort/i.test(message)) {
              track("payment_failed", { action, reason: "cancelled" });
              finish({ ok: false, reason: "cancelled" });
              return;
            }
            captureException(err, { where: "pay", action });
            setModal({
              action,
              phase: "error",
              message: "Authorization failed. Please try again.",
            });
          }
        })();
      });
    },
    [address, authorizeAction, finish],
  );

  // After player connects mid-flow, continue authorization automatically
  useEffect(() => {
    if (!address || !pendingAction.current || !resolver.current) return;
    if (modal?.phase !== "connect") return;

    const action = pendingAction.current;
    void (async () => {
      try {
        const ok = await authorizeAction(action, address);
        if (!ok) return;
        await new Promise((r) => setTimeout(r, 400));
        finish({ ok: true });
        toast.success(`${actionLabel(action)} authorized · pay with $WARDOG or $WARCAT`);
      } catch (err) {
        captureException(err, { where: "payAfterConnect", action });
        setModal({
          action,
          phase: "error",
          message: "Authorization failed. Please try again.",
        });
      }
    })();
  }, [address, modal?.phase, authorizeAction, finish]);

  const value = useMemo<PaymentContextValue>(
    () => ({
      pay,
      connectWallet,
      disconnectWallet,
      openApiKeyModal: () => setShowApiKey(true),
      address,
      connected: Boolean(address),
    }),
    [pay, connectWallet, disconnectWallet, address],
  );

  return (
    <PaymentContext.Provider value={value}>
      {children}
      <PaymentModal
        state={modal}
        address={address}
        onConnect={async () => {
          await connectWallet();
        }}
        onRetry={() => {
          if (!modal || !address) return;
          void (async () => {
            const ok = await authorizeAction(modal.action, address);
            if (ok) {
              await new Promise((r) => setTimeout(r, 400));
              finish({ ok: true });
              toast.success(`${actionLabel(modal.action)} authorized`);
            }
          })();
        }}
        onClose={() => finish({ ok: false, reason: "cancelled" })}
        onDone={() => finish({ ok: true })}
        onOpenApiKey={() => setShowApiKey(true)}
      />
      <TonApiKeyModal open={showApiKey} onClose={() => setShowApiKey(false)} />
    </PaymentContext.Provider>
  );
}
