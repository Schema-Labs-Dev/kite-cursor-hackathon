import { ArrowRight } from "iconsax-react";

import { IPhone17 } from "./iphone-17";
import { KiteAppScreen } from "./kite-app-screen";
import { AppleButton } from "./apple-button";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-[5vw] pb-[6vw] pt-[16vh]">
      {/* big composition */}
      <div className="relative mx-auto max-w-[1320px]">
        {/* line 1 of headline */}
        <h1 className="text-center font-display-tight text-[12vw] leading-[0.86] sm:text-[11vw] md:text-[8.5vw]">
          YOUR DOLLARS.
        </h1>

        {/* phone + sticker chaos — phone descends just slightly into headline bottom */}
        <div className="relative z-10 mt-4 flex items-start justify-center md:-mt-[1.5vw]">
          {/* APY sticker — left side */}
          <FloatingSticker
            className="left-[7%] top-[34%] hidden md:block"
            tilt={-9}
            tint="ink"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] opacity-70">apy</div>
            <div className="text-[22px] font-extrabold leading-none tracking-tight">4.20%</div>
          </FloatingSticker>

          {/* phone */}
          <div className="relative" style={{ transform: "rotate(-2deg)" }}>
            <IPhone17 width={300} color="titanium">
              <KiteAppScreen />
            </IPhone17>

            {/* NO BANK sticker — pinned to BOTTOM-RIGHT of phone, out of headline zone */}
            <div
              className="absolute -bottom-3 -right-6 rotate-[-8deg] rounded-[8px] bg-acid px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-tight text-ink shadow-[0_3px_0_0_rgba(0,0,0,0.12)] md:-bottom-4 md:-right-10 md:rounded-[10px] md:px-4 md:py-2 md:text-[16px]"
            >
              no bank
            </div>
          </div>

          {/* USDC sticker — right side, lower */}
          <FloatingSticker
            className="bottom-[12%] right-[5%] hidden md:block"
            tilt={7}
            tint="acid"
          >
            <div className="text-[9px] uppercase tracking-[0.2em] opacity-70">stablecoin</div>
            <div className="text-[18px] font-extrabold leading-none">USDC · BASE</div>
          </FloatingSticker>

          {/* fee tag bottom-left */}
          <FloatingSticker
            className="bottom-[4%] left-[18%] hidden lg:block"
            tilt={-4}
            tint="paper"
            small
          >
            <div className="text-[9px] uppercase tracking-[0.2em] opacity-70">network fee</div>
            <div className="font-mono text-[14px] font-bold leading-none">$0.00</div>
          </FloatingSticker>
        </div>

        {/* line 2 of headline + italic refrain */}
        <div className="relative mt-6 text-center md:-mt-[2vw]">
          <h2 className="font-display-tight text-[14vw] leading-[0.86] sm:text-[12vw] md:text-[8.5vw]">
            SET <span className="italic text-fog">free</span>.
          </h2>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-fog">
            ↓ on your phone ↓
          </p>
        </div>
      </div>

      {/* subtitle + CTAs */}
      <div className="mx-auto mt-10 max-w-2xl text-center">
        <p className="text-[15px] leading-snug text-fog md:text-[17px]">
          A dollar account that earns 4.20%, sends free to any @basename, and
          spends anywhere Visa works. Sign up with your face. No bank, no seed
          phrase, no fine print.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <AppleButton href="#" label="TestFlight" subline="Download on" />
          <a
            href="#hold"
            className="inline-flex h-[60px] items-center gap-2 rounded-[14px] border border-hairline bg-paper px-6 text-[13px] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink"
          >
            See the app
            <ArrowRight size={14} color="currentColor" variant="Linear" />
          </a>
        </div>
        <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-fog">
          iOS only · early access · we are not a bank
        </p>
      </div>
    </section>
  );
}

/* ─── helpers ─────────────────────────────────────────── */

function FloatingSticker({
  children,
  className = "",
  tilt = 0,
  tint = "ink",
  small = false,
}: {
  children: React.ReactNode;
  className?: string;
  tilt?: number;
  tint?: "ink" | "acid" | "paper";
  small?: boolean;
}) {
  const tintClasses = {
    ink: "bg-ink text-paper",
    acid: "bg-acid text-ink",
    paper: "bg-paper text-ink border border-hairline",
  }[tint];

  return (
    <div
      className={`absolute z-20 rounded-[10px] shadow-[0_4px_0_0_rgba(0,0,0,0.08)] ${tintClasses} ${className} ${small ? "px-2.5 py-1.5" : "px-3 py-2"}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {children}
    </div>
  );
}
