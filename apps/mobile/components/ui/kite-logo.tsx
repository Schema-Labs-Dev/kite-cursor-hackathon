import Svg, { Path } from 'react-native-svg';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/constants/theme';

type Props = {
  size?: number;
  /** Override base ink color — both halves derive from this. Default = ink. */
  color?: string;
  showWordmark?: boolean;
  wordmarkColor?: string;
};

/**
 * Kite logomark — V-split asymmetric kite matching the web favicon /
 * usekite.xyz brand mark. Left half rendered at 50% currentColor opacity,
 * right half rendered at 100%, so the mark works on both light and dark
 * surfaces.
 */
export function KiteLogo({
  size = 28,
  color = colors.ink,
  showWordmark = false,
  wordmarkColor,
}: Props) {
  // viewBox is 32 wide × 40 tall — keep aspect ratio.
  const width = size;
  const height = Math.round(size * 1.25);
  return (
    <View style={styles.row}>
      <Svg width={width} height={height} viewBox="0 0 32 40">
        <Path d="M16 2 L4 14 L16 38 Z" fill={color} fillOpacity={0.5} />
        <Path d="M16 2 L28 14 L16 38 Z" fill={color} />
      </Svg>
      {showWordmark && (
        <Text
          style={[
            styles.wordmark,
            {
              color: wordmarkColor ?? color,
              fontSize: size * 0.78,
            },
          ]}
        >
          KITE
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: {
    fontFamily: fonts.bodySemibold,
    fontWeight: '700',
    letterSpacing: -1,
  },
});
