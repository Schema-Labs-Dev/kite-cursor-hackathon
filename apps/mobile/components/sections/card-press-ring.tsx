import { StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import { colors, radii } from '@/constants/theme';

type Props = {
  /** Show the ring + the "tap" wave overlay. */
  active: boolean;
};

/**
 * Visual feedback while the user presses & holds the card. Two layers:
 *  - A pulsing ring around the card edge (sun color, fades + scales)
 *  - A "wave" emanating from the centre, mimicking NFC contactless choreography
 */
export function CardPressRing({ active }: Props) {
  if (!active) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <MotiView
        from={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 0.9, scale: 1.04 }}
        transition={{ type: 'timing', duration: 1100, loop: false }}
        style={styles.ring}
      />
      <MotiView
        from={{ opacity: 0.5, scale: 0.6 }}
        animate={{ opacity: 0, scale: 1.6 }}
        transition={{ type: 'timing', duration: 1100, loop: true, repeatReverse: false }}
        style={styles.wave}
      />
      <MotiView
        from={{ opacity: 0.5, scale: 0.6 }}
        animate={{ opacity: 0, scale: 1.6 }}
        transition={{
          type: 'timing',
          duration: 1100,
          delay: 400,
          loop: true,
          repeatReverse: false,
        }}
        style={styles.wave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.xl,
    borderWidth: 3,
    borderColor: colors.sun,
  },
  wave: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 120,
    height: 120,
    marginTop: -60,
    marginLeft: -60,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.cream,
  },
});
