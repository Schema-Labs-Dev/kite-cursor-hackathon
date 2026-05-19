import { View, Image, StyleSheet, ViewStyle } from 'react-native';

export type PaymentBrand = 'airtel' | 'mtn' | 'visa' | 'mastercard';

type Props = {
  brand: PaymentBrand;
  size?: number;
  style?: ViewStyle;
};

const LOGOS = {
  airtel:     require('@/assets/payment-logos/airtel.png'),
  mtn:        require('@/assets/payment-logos/mtn.png'),
  visa:       require('@/assets/payment-logos/visa.png'),
  mastercard: require('@/assets/payment-logos/mastercard.png'),
} as const;

/**
 * Per-brand surface color. Airtel + MTN get their brand background; Visa
 * and Mastercard sit on white tiles so the multicolor marks read cleanly.
 */
const SURFACE: Record<PaymentBrand, string> = {
  airtel:     '#ED1C24',
  mtn:        '#FFCB05',
  visa:       '#FFFFFF',
  mastercard: '#FFFFFF',
};

/**
 * Branded payment-method tile.
 *
 * Airtel + MTN render their logo via `cover` so the brand graphic fills the
 * tile edge-to-edge (which is how the user-supplied assets are framed).
 * Visa + Mastercard render via `contain` with a small inset so the mark
 * floats inside a white tile, matching how a card scheme is normally shown.
 */
export function PaymentLogo({ brand, size = 48, style }: Props) {
  const fill = brand === 'airtel' || brand === 'mtn';
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: SURFACE[brand],
        },
        style,
      ]}
    >
      <Image
        source={LOGOS[brand]}
        style={
          fill
            ? { width: size, height: size }
            : { width: size * 0.7, height: size * 0.7 }
        }
        resizeMode={fill ? 'cover' : 'contain'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
