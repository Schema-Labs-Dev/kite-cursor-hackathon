import { PhoneScreen, PlaceholderScreen } from "./phone-screen";

/**
 * 3-up colored card grid in the ugly.cash style.
 * Each card has a tint, a placeholder visual inside, and a caption below.
 */

type Pillar = {
  id: string;
  word: string;
  caption: string;
  body: string;
  tint: string;
  textOnTint?: "ink" | "paper";
  screenLabel: string;
};

const PILLARS: Pillar[] = [
  {
    id: "hold",
    word: "Hold",
    caption: "Dollars that earn while you sleep.",
    body: "Your USDC sits on Base. Routed through curated onchain markets. ~4.20% APY. No lockup.",
    tint: "linear-gradient(135deg, #fff2c8 0%, #ffe2a8 100%)",
    screenLabel: "balance",
  },
  {
    id: "send",
    word: "Send",
    caption: "Anywhere on earth. Free, every time.",
    body: "Tap a @basename, a phone number, or a QR. We sponsor the gas. You see zero fees.",
    tint: "#ffffff",
    screenLabel: "send",
  },
  {
    id: "spend",
    word: "Spend",
    caption: "A real Visa card. Up to 4% back, in dollars.",
    body: "Virtual the day you sign up. Metal in your hand when you upgrade. Cashback in dollars, not points.",
    tint: "#02bbff",
    screenLabel: "card",
  },
];

export function Pillars() {
  return (
    <section className="px-[5vw] pb-[6vw] pt-[6vw]">
      <h2 className="mx-auto max-w-[1100px] font-display text-[11vw] leading-[0.88] tracking-[-0.04em] md:text-[5vw]">
        How money <span className="text-fog">works</span>
        <br />
        <span className="text-fog">on</span> Kite.
      </h2>

      <div className="mx-auto mt-12 grid max-w-[1152px] grid-cols-1 gap-4 md:grid-cols-3 md:gap-4">
        {PILLARS.map((p) => (
          <article
            key={p.id}
            id={p.id}
            className="group relative flex flex-col"
          >
            <div
              className="relative flex h-[450px] items-center justify-center overflow-hidden rounded-card"
              style={{ background: p.tint }}
            >
              <div className="float-a">
                <PhoneScreen width={200}>
                  <PlaceholderScreen label={p.screenLabel} />
                </PhoneScreen>
              </div>
            </div>
            <div className="mt-5 px-1">
              <h3 className="text-[22px] font-bold tracking-tight">
                {p.word}
              </h3>
              <p className="mt-1 text-[16px] leading-snug text-ink/85">
                {p.caption}
              </p>
              <p className="mt-2 text-[13px] leading-snug text-fog">
                {p.body}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
