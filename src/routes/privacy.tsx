// src/routes/privacy.tsx
import { createFileRoute, Link } from "@tanstack/react-router";

const LAST_UPDATED = "2024-06-01";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — War On Nations" },
      {
        name: "description",
        content:
          "Privacy Policy for War On Nations, a Telegram Mini App merge game: what we collect, how we use it, and your rights.",
      },
      { property: "og:title", content: "Privacy Policy — War On Nations" },
      {
        property: "og:description",
        content:
          "Privacy Policy for War On Nations, a Telegram Mini App merge game: what we collect, how we use it, and your rights.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-zinc-500">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <Section title="Overview">
          War On Nations ("the Game", "we", "us") is a Telegram Mini App
          merge game. This Privacy Policy explains what information we
          collect when you play, why we collect it, and the choices you
          have. By opening the Game inside Telegram you agree to the
          practices described here.
        </Section>

        <Section title="What We Collect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>Telegram profile data</b> provided by Telegram when you
              open the Mini App: your Telegram user ID, username, first/last
              name, language code, and profile photo URL.
            </li>
            <li>
              <b>Gameplay progress</b>: glory, ranks, unit tiers, energy,
              inventory, quests, nation membership, and in-game token
              balances ($WARDOG / $WARCAT).
            </li>
            <li>
              <b>Referral relationships</b>: your referral code, who
              referred you, and who you have referred.
            </li>
            <li>
              <b>TON wallet address</b>, only if you choose to connect a
              wallet via TON Connect, used for token claims and on-chain
              payments.
            </li>
            <li>
              <b>Session cookies</b> used to keep you signed in between
              visits to the Mini App.
            </li>
            <li>
              <b>Technical and usage data</b> such as device/browser
              information, crash reports, and in-app events, collected
              automatically through the third-party tools listed below.
            </li>
          </ul>
        </Section>

        <Section title="How We Use It">
          <ul className="list-disc space-y-2 pl-5">
            <li>Operate and save your gameplay progress across sessions.</li>
            <li>Authenticate you securely through Telegram.</li>
            <li>Run the referral program and anti-cheat / anti-fraud checks.</li>
            <li>
              Process TON token claims and on-chain payments to the wallet
              address you connect.
            </li>
            <li>
              Diagnose crashes and errors, and understand how the Game is
              used so we can improve it.
            </li>
            <li>Communicate important updates via the Telegram bot.</li>
          </ul>
        </Section>

        <Section title="Legal Basis">
          Where applicable data protection law requires a legal basis
          (e.g. under the GDPR), we rely on: performance of a contract
          (providing the Game to you), our legitimate interests
          (security, anti-cheat, service improvement), and your consent
          where you take an optional action such as connecting a TON
          wallet.
        </Section>

        <Section title="Third Parties">
          We share limited data with the following service providers,
          each acting under their own privacy terms:
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <b>Telegram</b> — provides the Mini App platform and your
              authenticated profile data.
            </li>
            <li>
              <b>Neon</b> — hosts our Postgres database that stores
              gameplay and account records.
            </li>
            <li>
              <b>Sentry</b> — error monitoring, used to capture crash
              reports and stack traces (never wallet keys or secrets).
            </li>
            <li>
              <b>PostHog</b> — product analytics, used to understand
              feature usage in aggregate.
            </li>
            <li>
              <b>TON blockchain / TON Connect</b> — public, permissionless
              network used to process token claims and payments; wallet
              transactions are visible on-chain by design.
            </li>
          </ul>
        </Section>

        <Section title="Retention">
          We keep account and gameplay data for as long as your account is
          active, and for a reasonable period afterward to prevent abuse,
          resolve disputes, and comply with legal obligations. On-chain
          data cannot be deleted because blockchains are immutable by
          design.
        </Section>

        <Section title="Your Rights">
          Depending on where you live, you may have the right to access,
          correct, export, or delete your personal data. You can request
          access to or deletion of your data at any time by messaging the
          War On Nations Telegram bot with a deletion request, or by
          contacting us (see below). We may retain minimal records where
          required to prevent fraud or comply with the law.
        </Section>

        <Section title="Children">
          The Game is not directed at children under 13. Telegram's own
          Terms of Service require users to meet Telegram's minimum age
          requirements; if you do not meet those requirements you may not
          use the Game.
        </Section>

        <Section title="Changes to This Policy">
          We may update this Privacy Policy from time to time. Material
          changes will be reflected by updating the "Last updated" date
          above. Continued use of the Game after changes take effect
          constitutes acceptance of the revised policy.
        </Section>

        <Section title="Contact">
          Questions about this policy? Reach us on X at{" "}
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
