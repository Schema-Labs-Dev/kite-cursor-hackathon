import { Apple } from "iconsax-react";
import Link from "next/link";

type Props = {
  href?: string;
  label?: string;
  subline?: string;
  className?: string;
};

/**
 * App Store / TestFlight badge — Apple-style black pill with logo + two-line label.
 * Matches the standard "Download on the App Store" badge dimensions.
 */
export function AppleButton({
  href = "#",
  label = "TestFlight",
  subline = "Download on",
  className = "",
}: Props) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-3 rounded-[12px] bg-ink px-5 py-2.5 text-paper transition-colors hover:bg-ink-soft ${className}`}
      aria-label={`${subline} ${label}`}
    >
      <Apple size={28} color="currentColor" variant="Bold" className="shrink-0" />
      <span className="flex flex-col leading-none text-left">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-paper/85">
          {subline}
        </span>
        <span className="mt-1 text-[19px] font-semibold leading-none tracking-tight">
          {label}
        </span>
      </span>
    </Link>
  );
}
