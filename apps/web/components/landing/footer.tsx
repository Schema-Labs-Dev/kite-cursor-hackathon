import { AppleButton } from "./apple-button";
import { KiteMark } from "./kite-mark";

const LEGAL = [
  { label: "Privacy", href: "#" },
  { label: "Terms",   href: "#" },
  { label: "Risk",    href: "#" },
];

const SOCIAL = [
  { label: "X / Twitter", href: "#" },
  { label: "Farcaster",   href: "#" },
  { label: "GitHub",      href: "#" },
];

export function Footer() {
  return (
    <footer className="px-[5vw] pb-12 pt-6 md:pb-16">
      <div className="mx-auto max-w-[1152px] rounded-card-lg bg-paper p-8 md:p-12">
        {/* download CTA inside footer card */}
        <div className="flex flex-col gap-6 border-b border-hairline pb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fog">
              Get Kite
            </div>
            <p className="mt-2 max-w-md text-[14px] leading-snug text-fog">
              Available on TestFlight only while we cook. iPhone first, Android
              when it’s ready.
            </p>
          </div>
          <AppleButton href="#" label="TestFlight" subline="Download on" />
        </div>

        {/* giant KITE.CASH wordmark with kite glyph */}
        <div className="mt-10 flex flex-col items-start gap-4 overflow-hidden md:flex-row md:items-end md:gap-6">
          <div className="md:hidden">
            <KiteMark size={42} className="text-ink" />
          </div>
          <div className="hidden md:block">
            <KiteMark size={80} className="text-ink" />
          </div>
          <span className="block w-full font-display-tight leading-[0.82] tracking-[-0.05em] text-[clamp(54px,13vw,160px)]">
            KITE.CASH
          </span>
        </div>

        {/* link columns */}
        <div className="mt-10 grid grid-cols-2 gap-8 border-t border-hairline pt-10 md:grid-cols-4">
          <FooterCol title="Get it">
            <a href="#testflight" className="block hover:text-ink/60">TestFlight</a>
            <a href="mailto:hello@kite.cash" className="block hover:text-ink/60">
              hello@kite.cash
            </a>
          </FooterCol>
          <FooterCol title="Social">
            {SOCIAL.map((s) => (
              <a key={s.label} href={s.href} className="block hover:text-ink/60">
                {s.label}
              </a>
            ))}
          </FooterCol>
          <FooterCol title="Legal">
            {LEGAL.map((l) => (
              <a key={l.label} href={l.href} className="block hover:text-ink/60">
                {l.label}
              </a>
            ))}
          </FooterCol>
          <FooterCol title="Posture">
            <p className="text-[13px] leading-snug text-fog">
              We are not a bank. Tier 0 needs no ID. Bigger limits need a
              60-second verification. Honest about both.
            </p>
          </FooterCol>
        </div>

        {/* copyright row */}
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-hairline pt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-fog md:flex-row md:items-center">
          <span className="inline-flex items-center gap-2">
            <KiteMark size={14} />
            Kite by Schema Labs
          </span>
          <span>Built to fly</span>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fog">
        {title}
      </div>
      <div className="space-y-2 text-[14px] text-ink">{children}</div>
    </div>
  );
}
