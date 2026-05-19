const STATS = [
  { value: "4.20%", label: "APY · variable · curated onchain markets" },
  { value: "$0.00", label: "fees to send. ever. we pay the gas" },
  { value: "<10s",  label: "settlement, anywhere on earth, on base" },
  { value: "100%",  label: "self-custodial · only you can touch it" },
];

export function Stats() {
  return (
    <section className="px-[5vw] py-[6vw]">
      <div className="mx-auto grid max-w-[1152px] grid-cols-2 overflow-hidden rounded-card border border-hairline bg-paper md:grid-cols-4">
        {STATS.map((s, i) => (
          <div
            key={i}
            className={`border-hairline p-6 md:p-8 ${
              i < STATS.length - 1 ? "md:border-r" : ""
            } ${i < 2 ? "border-b md:border-b-0" : ""} ${i === 0 ? "border-r" : ""}`}
          >
            <div className="font-display-tight text-[11vw] leading-none tracking-tight md:text-[4.2vw]">
              {s.value}
            </div>
            <div className="mt-4 max-w-[22ch] text-[12px] leading-snug text-fog">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
