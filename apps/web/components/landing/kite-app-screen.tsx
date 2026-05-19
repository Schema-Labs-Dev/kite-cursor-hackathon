/**
 * Realistic Kite Home screen — lives inside the iPhone 17 mockup.
 * Black canvas, cream type, mint badges. Swap for real screenshots later.
 */

export function KiteAppScreen() {
  return (
    <div className="absolute inset-0 flex h-full w-full flex-col bg-[#0a0a0a] pt-[18%] text-white">
      {/* header */}
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[10px] font-bold text-black">
            n
          </span>
          <div className="leading-tight">
            <div className="text-[8px] text-white/55">good morning,</div>
            <div className="text-[10px] font-semibold">nia</div>
          </div>
        </div>
        <div className="grid h-6 w-6 place-items-center rounded-full bg-white/10">
          <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden>
            <circle cx="12" cy="12" r="2.4" stroke="white" strokeWidth="1.6" fill="none" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"
              stroke="white"
              strokeWidth="1.4"
              fill="none"
            />
          </svg>
        </div>
      </div>

      {/* balance card */}
      <div className="mx-3 mt-3 rounded-[14px] bg-white p-3 text-black">
        <div className="text-[7px] uppercase tracking-[0.2em] text-black/55">balance</div>
        <div className="mt-1 flex items-baseline">
          <span className="text-[10px] font-medium">$</span>
          <span className="font-display text-[26px] leading-none tracking-tight">2,847</span>
          <span className="font-display text-[14px] leading-none text-black/45">.12</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[8px]">
          <span className="font-mono text-black/55">USDC · BASE</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#adff02] px-1.5 py-[2px] font-semibold">
            <svg width="6" height="6" viewBox="0 0 8 8" aria-hidden>
              <circle cx="4" cy="4" r="3" fill="black" />
            </svg>
            4.20%
          </span>
        </div>
        {/* yield bar */}
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-black/10">
          <div className="h-full w-[58%] rounded-full bg-black" />
        </div>
      </div>

      {/* quick actions */}
      <div className="mx-3 mt-3 grid grid-cols-4 gap-1.5">
        {[
          { l: "Add", g: <PlusGlyph /> },
          { l: "Send", g: <UpRightGlyph /> },
          { l: "Get paid", g: <DownLeftGlyph /> },
          { l: "Card", g: <CardGlyph /> },
        ].map((a, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1 rounded-[10px] bg-white/[0.07] py-2 text-[7.5px] font-medium tracking-tight"
          >
            <span className="text-white/85">{a.g}</span>
            <span className="text-white/75">{a.l}</span>
          </div>
        ))}
      </div>

      {/* activity */}
      <div className="mx-3 mt-3 flex items-center justify-between text-[8px]">
        <span className="font-semibold">Activity</span>
        <span className="text-white/55">see all</span>
      </div>
      <div className="mx-3 mt-1.5 flex-1 space-y-1.5">
        <ActivityRow who="@maya" note="lunch on me" amt="-$25.00" />
        <ActivityRow who="Cafe Reverie" note="spend · 4% back" amt="-$8.40" />
        <ActivityRow who="interest" note="every block, every day" amt="+$0.32" tint />
      </div>

      {/* home bar */}
      <div className="mb-2 mt-2 flex justify-center">
        <div className="h-[3px] w-[28%] rounded-full bg-white/35" />
      </div>
    </div>
  );
}

function ActivityRow({
  who,
  note,
  amt,
  tint,
}: {
  who: string;
  note: string;
  amt: string;
  tint?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-[10px] bg-white/[0.05] px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <div
          className={`grid h-4 w-4 place-items-center rounded-full ${
            tint ? "bg-[#adff02]" : "bg-white/15"
          }`}
        >
          <svg width="6" height="6" viewBox="0 0 8 8" aria-hidden>
            <circle cx="4" cy="4" r="1.6" fill={tint ? "black" : "white"} />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-[8px] font-semibold">{who}</div>
          <div className="text-[7px] text-white/45">{note}</div>
        </div>
      </div>
      <span className="font-mono text-[8px]">{amt}</span>
    </div>
  );
}

function PlusGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function UpRightGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
      <path d="M3 9L9 3M9 3H4M9 3v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DownLeftGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
      <path d="M9 3L3 9M3 9h5M3 9V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CardGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
      <rect x="1.5" y="3" width="9" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M1.5 5.2h9" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
