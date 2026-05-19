const ITEMS = [
  "EARN 4.20% APY",
  "FREE TO SEND",
  "NO BANK",
  "USDC ON BASE",
  "TAP TO PAY ANYWHERE",
  "SIGN UP WITH YOUR FACE",
  "@YOU.BASE.ETH",
  "ARRIVES IN 2 SECONDS",
];

export function Marquee() {
  return (
    <div className="overflow-hidden border-y border-hairline bg-ink py-5 text-paper">
      <div className="marquee-track flex w-max gap-12 whitespace-nowrap">
        {[...ITEMS, ...ITEMS, ...ITEMS].map((t, i) => (
          <span key={i} className="flex items-center gap-12">
            <span className="font-display text-[28px] md:text-[36px]">{t}</span>
            <span className="font-display text-[28px] text-acid md:text-[36px]">●</span>
          </span>
        ))}
      </div>
    </div>
  );
}
