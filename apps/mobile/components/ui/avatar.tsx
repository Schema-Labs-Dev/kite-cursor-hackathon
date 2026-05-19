import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Color = 'sun' | 'sky' | 'mint' | 'ink' | 'cream' | 'auto';
type Size = 'sm' | 'md' | 'lg' | 'xl';

type Props = {
  /** Stable seed (wallet address, handle, anything) — same input always
   *  produces the same gradient. If omitted, a random gradient is picked. */
  seed?: string | null;
  /** Legacy `initial` prop — accepted but no longer rendered. Keeps existing
   *  call sites compiling while we move to gradient-only avatars. */
  initial?: string;
  /** Legacy `color` prop — ignored when seed is present (we always render
   *  a gradient blob now). Kept so old call sites don't have to change. */
  color?: Color;
  size?: Size;
};

const sizeMap: Record<Size, number> = {
  sm: 28,
  md: 40,
  lg: 56,
  xl: 80,
};

/**
 * Curated soft-pastel gradient pairs — World App-style avatar look. Each
 * pair runs top-left → bottom-right inside a circle.
 */
const GRADIENTS: readonly [string, string, string][] = [
  ['#FFB199', '#FF6FAE', '#A06CFF'], // peach → pink → violet
  ['#FFD27A', '#FF9466', '#FF6FA1'], // honey → coral → rose
  ['#A8E6FF', '#7FA8FF', '#B388FF'], // sky → indigo → lavender
  ['#FFE08A', '#FFB07A', '#FF8FBC'], // butter → peach → pink
  ['#B8FFD9', '#7BE3C4', '#6FA8FF'], // mint → teal → blue
  ['#FFC1CC', '#D9A0FF', '#7FB6FF'], // blush → orchid → cornflower
  ['#FFE9B0', '#FFB57A', '#FF7A8A'], // cream → peach → coral
  ['#C0FFE7', '#9BD3FF', '#C7A8FF'], // seafoam → ice → mauve
  ['#FFB07A', '#FF6F9B', '#9B6BFF'], // tangerine → fuchsia → purple
  ['#7AD4FF', '#9DA8FF', '#FF99CC'], // aqua → periwinkle → bubblegum
] as const;

/** Hash a seed string to one of the gradient indices. djb2-ish, stable across
 *  runs. */
function pickGradient(seed: string): readonly [string, string, string] {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
  }
  const idx = Math.abs(h) % GRADIENTS.length;
  return GRADIENTS[idx]!;
}

/**
 * Avatar — random soft-gradient blob in a circle. No initial inside,
 * matches the World App profile-picture placeholder vibe.
 *
 * Pass `seed` (usually the wallet address) so the same user always renders
 * the same gradient across launches.
 */
export function Avatar({ seed, size = 'md' }: Props) {
  // Pick a stable random seed once per mount if none provided. Math.random
  // here only fires when the consumer doesn't pass a seed — perfectly fine
  // for a placeholder.
  const effectiveSeed = useMemo(
    () => seed ?? Math.random().toString(36).slice(2),
    [seed],
  );
  const colors = useMemo(() => pickGradient(effectiveSeed), [effectiveSeed]);
  const px = sizeMap[size];

  return (
    <View
      style={[
        styles.box,
        {
          width: px,
          height: px,
          borderRadius: px / 2,
        },
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    backgroundColor: '#EEE',
  },
});
