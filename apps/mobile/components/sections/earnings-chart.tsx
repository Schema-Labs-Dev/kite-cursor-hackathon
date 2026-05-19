import { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Circle,
  Line,
} from 'react-native-svg';
import { colors, fonts, layout, radii } from '@/constants/theme';

type Props = {
  /** Total yield accrued so far (USDC + EURC, denominated in USD). */
  earned: number;
  /** Annualized rate, e.g. 4.20 for 4.2 %. */
  apyPercent: number;
  /** Total balance in Kite (wallet + treasury, USD-equivalent). Footer line. */
  principal: number;
  /** Optional height override; width auto-fills the parent. */
  height?: number;
};

/**
 * Generate a smooth, slightly-noisy curve that ends at `endValue`. The shape
 * eases up (compound-interest-ish) and carries tiny ± wobbles so it doesn't
 * read as a pure line. Deterministic — same inputs always produce the
 * same curve.
 */
function generateCurve(endValue: number, points = 36): { x: number; y: number }[] {
  // Even a "$0 earned" state should show *something* so the chart never
  // collapses to a flat line. Floor to a tiny non-zero so the eye has
  // contour to track.
  const tip = Math.max(endValue, 0.001);

  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    // ease-out curve — fast early growth that flattens slightly as it
    // approaches the present moment. Power < 1 → concave from below.
    const base = tip * (1 - Math.pow(1 - t, 1.45));
    // Deterministic pseudo-noise scaled to ±4 % of tip.
    const noise =
      (Math.sin(i * 1.7) * 0.5 + Math.sin(i * 0.6 + 1.3) * 0.5) * 0.04 * tip;
    return { x: t, y: Math.max(0, base + noise) };
  });
}

/**
 * Convert (0–1, 0–maxY) points into an SVG path with quadratic-bezier
 * smoothing between successive points. Returns the path string plus the
 * pixel coordinate of the rightmost point so the caller can place a
 * leading-edge dot.
 */
function buildPath(
  points: { x: number; y: number }[],
  width: number,
  height: number,
  paddingY: number,
): { d: string; last: { x: number; y: number }; baseline: number } {
  const maxY = Math.max(...points.map((p) => p.y)) || 1;
  const minY = Math.min(...points.map((p) => p.y));
  const range = maxY - minY || 1;
  const usable = height - paddingY * 2;
  const scaled = points.map((p) => ({
    x: p.x * width,
    y: height - paddingY - ((p.y - minY) / range) * usable,
  }));

  let d = `M ${scaled[0]!.x.toFixed(2)} ${scaled[0]!.y.toFixed(2)}`;
  for (let i = 1; i < scaled.length; i++) {
    const prev = scaled[i - 1]!;
    const curr = scaled[i]!;
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    // Q with prev as the control + endpoint at midpoint — chain of small
    // bezier hops yields a smooth catmull-rom-like curve.
    d += ` Q ${prev.x.toFixed(2)} ${prev.y.toFixed(2)}, ${midX.toFixed(2)} ${midY.toFixed(2)}`;
  }
  // Final straight to the last point so it lands exactly on the data.
  const last = scaled[scaled.length - 1]!;
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;

  return { d, last, baseline: height };
}

export function EarningsChart({ earned, apyPercent, principal, height = 156 }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  // The chart sits inside a 16-padded card inside a 20-padded screen.
  // 20*2 (screen) + 16*2 (card) = 72 of horizontal subtraction.
  const chartWidth = Math.max(0, screenWidth - layout.screenPaddingX * 2 - 32);

  const { d, last, fillPath } = useMemo(() => {
    const pts = generateCurve(earned, 36);
    const built = buildPath(pts, chartWidth, height, 14);
    const fill = `${built.d} L ${chartWidth} ${built.baseline} L 0 ${built.baseline} Z`;
    return { d: built.d, last: built.last, fillPath: fill };
  }, [earned, chartWidth, height]);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.label}>EARNED</Text>
          <Text style={styles.earned}>
            +${earned.toLocaleString('en-US', {
              minimumFractionDigits: 4,
              maximumFractionDigits: 4,
            })}
          </Text>
        </View>
        <View style={styles.apyChip}>
          <View style={styles.apyDot} />
          <Text style={styles.apyText}>{apyPercent.toFixed(2)}% APY</Text>
        </View>
      </View>

      {chartWidth > 0 && (
        <Svg width={chartWidth} height={height} style={styles.svg}>
          <Defs>
            <SvgGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.ink} stopOpacity={0.14} />
              <Stop offset="0.85" stopColor={colors.ink} stopOpacity={0} />
            </SvgGradient>
          </Defs>

          {/* faint baseline */}
          <Line
            x1="0"
            y1={height - 0.5}
            x2={chartWidth}
            y2={height - 0.5}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth={1}
          />

          {/* gradient fill under the curve */}
          <Path d={fillPath} fill="url(#earningsFill)" />

          {/* main curve */}
          <Path
            d={d}
            stroke={colors.ink}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* leading-edge dot — outer ink ring + inner mint pulse */}
          <Circle cx={last.x} cy={last.y} r={6} fill={colors.cream} />
          <Circle cx={last.x} cy={last.y} r={4} fill={colors.ink} />
          <Circle cx={last.x} cy={last.y} r={2} fill={colors.mint} />
        </Svg>
      )}

      <View style={styles.footRow}>
        <Text style={styles.footLabel}>
          ${principal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total in Kite
        </Text>
        <Text style={styles.footRange}>last 30 days</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: layout.screenPaddingX,
    backgroundColor: colors.cream,
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  earned: {
    fontFamily: fonts.bodySemibold,
    fontWeight: '700',
    color: colors.ink,
    fontSize: 30,
    letterSpacing: -1,
    marginTop: 4,
  },
  apyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F4F4F4',
  },
  apyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mint,
  },
  apyText: {
    fontFamily: fonts.bodySemibold,
    fontWeight: '700',
    color: colors.ink,
    fontSize: 12,
  },
  svg: {
    marginTop: 10,
  },
  footRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footLabel: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 11,
  },
  footRange: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 1,
  },
});
