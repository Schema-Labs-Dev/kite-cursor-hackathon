const PARTNERS = [
  { name: "Base",       role: "L2" },
  { name: "Coinbase",   role: "Smart Wallet" },
  { name: "Basenames",  role: "@handles" },
  { name: "USDC",       role: "Circle" },
  { name: "Morpho",     role: "yield" },
  { name: "Visa",       role: "card rails" },
];

export function BuiltOnBase() {
  return (
    <section id="developers" className="px-[5vw] py-[8vw]">
      <div className="mx-auto max-w-[1152px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 className="font-display text-[12vw] leading-[0.88] tracking-[-0.04em] md:text-[5vw]">
            Built on
            <br />
            Base.
          </h2>
          <p className="max-w-md text-[14px] leading-snug text-fog md:text-[15px]">
            Kite is not a wrapper. Base for the chain, Coinbase Smart Wallet
            for the account, Basenames for your @handle, Circle for the
            dollars, Morpho for the yield, and Visa for the swipe. Six rails.
            One app.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 overflow-hidden rounded-card border border-hairline bg-paper sm:grid-cols-3 lg:grid-cols-6">
          {PARTNERS.map((p, i) => (
            <div
              key={p.name}
              className="flex min-w-0 flex-col gap-2 border-b border-r border-hairline p-5 last:border-r-0 md:p-6 lg:border-b-0"
            >
              <span className="block truncate font-display text-[18px] leading-none text-ink md:text-[20px] lg:text-[22px]">
                {p.name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog">
                {p.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
