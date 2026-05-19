type Props = {
  size?: number;
  withWord?: boolean;
  className?: string;
};

/**
 * Kite logomark — V-split asymmetric kite (variant #01).
 * Left half uses currentColor at 0.5 opacity, right half is full currentColor,
 * so it tones correctly on both light and dark surfaces.
 */
export function KiteMark({ size = 24, withWord = false, className = "" }: Props) {
  const height = Math.round(size * 1.25); // viewBox is 32:40
  return (
    <span className={`inline-flex items-center gap-2 align-middle ${className}`}>
      <svg
        width={size}
        height={height}
        viewBox="0 0 32 40"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M16 2 L4 14 L16 38 Z" fill="currentColor" opacity="0.5" />
        <path d="M16 2 L28 14 L16 38 Z" fill="currentColor" />
      </svg>
      {withWord && (
        <span
          className="font-display leading-none"
          style={{ fontSize: size * 0.95, letterSpacing: "-0.045em" }}
        >
          KITE
        </span>
      )}
    </span>
  );
}
