import { AppleButton } from "./apple-button";

export function TestflightCta() {
  return (
    <section id="testflight" className="px-[5vw] py-[10vw]">
      <div className="mx-auto max-w-5xl rounded-card-lg border border-hairline bg-paper px-6 py-16 text-center md:px-12 md:py-24">
        <h2 className="font-display-tight text-[12vw] leading-[0.86] tracking-[-0.045em] md:text-[7vw]">
          PULL
          <br />
          THE STRING.
        </h2>

        <p className="mx-auto mt-6 max-w-xl text-[15px] leading-snug text-fog md:text-[17px]">
          Kite ships through TestFlight while we’re in private beta. Tap
          below and you’ll be among the first thousand to hold dollars on
          Base without ever opening a bank.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <AppleButton href="#" label="TestFlight" subline="Download on" />
          <a
            href="mailto:hello@kite.cash"
            className="inline-flex h-[60px] items-center gap-2 rounded-[12px] border border-hairline bg-bone px-7 text-[13px] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink"
          >
            Talk to us
          </a>
        </div>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.22em] text-fog">
          link goes live with the next testflight cut · we are not a bank
        </p>
      </div>
    </section>
  );
}
