// src/routes/terms.tsx
import { createFileRoute, Link } from "@tanstack/react-router";

const LAST_UPDATED = "2024-06-01";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — War On Nations" },
      {
        name: "description",
        content:
          "Terms of Service for War On Nations, a Telegram Mini App merge game covering accounts, virtual items, TON payments, and prohibited conduct.",
      },
      { property: "og:title", content: "Terms of Service — War On Nations" },
      {
        property: "og:description",
        content:
          "Terms of Service for War On Nations, a Telegram Mini App merge game covering accounts, virtual items, TON payments, and prohibited conduct.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center px-4 py-3">
          <Link
            to="/"
            className="text-xs font-black uppercase tracking-widest text-red-500"
          >
            ← Back
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-6 px-4 pb-16 pt-6 leading-relaxed">
        <header>
          <h1 className="text-2xl font-black uppercase tracking-widest">
            Terms of Service
          </h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-zinc-500">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <Section title="1. Eligibility">
          You must be eligible to use Telegram under Telegram's own Terms
          of Service to use War On Nations ("the Game"). By using the
          Game you represent that you meet those requirements and that
          your use of the Game complies with the laws applicable to you,
          including any laws relating to virtual items and cryptocurrency.
        </Section>

        <Section title="2. Account & Telegram Authentication">
          Your account is created and authenticated using data provided by
          Telegram when you open the Mini App. You are responsible for the
          security of the Telegram account used to access the Game.
          Sharing your account or credentials with others is at your own
          risk.
        </Section>

        <Section title="3. Virtual Items & In-Game Currency">
          Glory, $WARDOG, $WARCAT, units, nations, and any other in-game
          items or currencies ("Virtual Items") are licensed, revocable
          records maintained in our systems, not property, securities, or
          guaranteed-value assets. Virtual Items have no guaranteed
          monetary value and are not redeemable for cash except through
          any on-chain token claim or payout mechanism we may launch, at
          our sole discretion. Balances shown in the Game are in-game
          records only until such on-chain payouts, if any, are executed.
        </Section>

        <Section title="4. TON Payments">
          Where the Game accepts payments via the TON blockchain, all such
          transactions are final and irreversible once confirmed on-chain.
          We do not control the TON network and cannot reverse, cancel, or
          refund a blockchain transaction. Double-check wallet addresses
          and amounts before confirming any transaction.
        </Section>

        <Section title="5. No Refunds">
          All purchases and consumptions of Virtual Items are final. We do
          not provide refunds for Virtual Items that have been delivered,
          consumed, or used, except where required by applicable law.
        </Section>

        <Section title="6. Prohibited Conduct">
          You agree not to: cheat, exploit bugs, or manipulate game
          mechanics; use bots, scripts, or other automation; operate or
          benefit from multiple accounts ("multi-accounting"); exploit
          referral, treasury, or marketplace systems for unintended gain;
          interfere with other players' enjoyment of the Game; or attempt
          to reverse engineer, disrupt, or gain unauthorized access to our
          systems.
        </Section>

        <Section title="7. Anti-Cheat & Termination">
          We run automated and manual anti-cheat checks. We may suspend,
          restrict, or permanently terminate any account, reverse
          fraudulently obtained Virtual Items, and withhold pending
          claims, without prior notice, if we reasonably believe this
          Agreement or fair-play rules have been violated.
        </Section>

        <Section title="8. Nations & Marketplace">
          Nations are shared, competitive structures; leadership, taxes,
          and membership rules are governed by in-game mechanics that may
          change to preserve game balance. Any in-game marketplace or
          trading feature is provided "as is" and trades are final once
          executed; we are not a party to trades between players and bear
          no liability for disputes between them.
        </Section>

        <Section title="9. Risk Disclosure">
          Interacting with cryptocurrency and blockchain networks carries
          risk, including price volatility, irreversible transactions,
          smart contract risk, network congestion, and total loss of
          funds. You are solely responsible for the security of your
          wallet, private keys, and seed phrases. Never share your seed
          phrase with anyone, including anyone claiming to represent War
          On Nations.
        </Section>

        <Section title="10. Disclaimer of Warranties">
          The Game is provided "as is" and "as available" without
          warranties of any kind, express or implied, including
          warranties of merchantability, fitness for a particular purpose,
          non-infringement, or uninterrupted, error-free operation.
        </Section>

        <Section title="11. Limitation of Liability">
          To the maximum extent permitted by law, War On Nations and its
          operators shall not be liable for any indirect, incidental,
          special, consequential, or punitive damages, or any loss of
          profits, data, or Virtual Items, arising from your use of the
          Game, even if advised of the possibility of such damages.
        </Section>

        <Section title="12. Governing Law">
          These Terms are governed by the laws of [Governing Law
          Placeholder — to be finalized], without regard to conflict of
          law principles. Any disputes will be resolved in the courts of
          that jurisdiction, unless applicable law requires otherwise.
        </Section>

        <Section title="13. Changes to These Terms">
          We may update these Terms from time to time. Material changes
          will be reflected by updating the "Last updated" date above.
          Continued use of the Game after changes take effect constitutes
          acceptance of the revised Terms.
        </Section>

        <Section title="Contact">
          Questions about these Terms? Reach us on X at{" "}
          <a
            href="https://x.com/waronnations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-500 underline"
          >
            @waronnations
          </a>{" "}
          or message the War On Nations Telegram bot directly.
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-red-500">
        {title}
      </h2>
      <div className="text-sm text-zinc-300">{children}</div>
    </section>
  );
}
