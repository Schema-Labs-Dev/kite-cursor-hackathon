import Svg, { Path } from 'react-native-svg';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/constants/theme';

type Props = {
  width?: number;
  height?: number;
  color?: string;
  style?: ViewStyle;
  variant?: 'arc' | 'loop' | 'curve';
};

export function StringDecor({
  width = 320,
  height = 80,
  color = colors.ink,
  style,
  variant = 'arc',
}: Props) {
  const paths = {
    arc: 'M0 60 Q 160 -20 320 60',
    loop: 'M0 40 Q 80 80 160 40 T 320 40',
    curve: 'M0 20 C 80 80, 240 80, 320 20',
  };
  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={paths[variant]}
          stroke={color}
          strokeWidth={1}
          strokeLinecap="round"
          fill="none"
          opacity={0.4}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
});
