import { TonConnectUIProvider } from "@tonconnect/ui-react";
import type { ReactNode } from "react";
import { PaymentProvider } from "@/components/payments/PaymentProvider";

/**
 * Client-only TON Connect provider.
 * Imported lazily so the SDK never runs during SSR.
 */
export default function TonConnectProvider({ children }: { children: ReactNode }) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://waronnations.vercel.app";
  return (
    <TonConnectUIProvider manifestUrl={`${origin}/tonconnect-manifest.json`}>
      <PaymentProvider>{children}</PaymentProvider>
    </TonConnectUIProvider>
  );
}
