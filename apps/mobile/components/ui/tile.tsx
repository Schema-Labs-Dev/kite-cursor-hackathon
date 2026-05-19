import { View, StyleSheet, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { colors, radii } from '@/constants/theme';

type Variant = 'cream' | 'ink' | 'plain' | 'soft';

type Props = {
  children: ReactNode;
  variant?: Variant;
  style?: ViewStyle;
  padded?: boolean;
};

/**
 * Generic surface tile. Variants are kept compatible with prior call sites
 * but the colors now express the new monochrome World App-style palette.
 *
 *   cream → soft light-gray surface (was beige in v1)
 *   ink   → solid black emphasis
 *   soft  → very light black-tint
 *   plain → off-white background-on-background
 */
export function Tile({ children, variant = 'cream', style, padded = true }: Props) {
  return (
    <View
      style={[
        styles.base,
        variant === 'cream' && styles.cream,
        variant === 'ink' && styles.ink,
        variant === 'soft' && styles.soft,
        variant === 'plain' && styles.plain,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.xl },
  cream: { backgroundColor: '#F4F4F4' },
  ink: { backgroundColor: colors.ink },
  soft: { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
  plain: { backgroundColor: colors.creamSoft },
  padded: { padding: 16 },
});
