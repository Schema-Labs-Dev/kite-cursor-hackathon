import { View, Image, StyleSheet } from 'react-native';

export type CurrencyCode = 'USDC' | 'EURC';

type Props = {
  code: CurrencyCode;
  size?: number;
};

const LOGOS = {
  USDC: require('@/assets/payment-logos/usd.png'),
  EURC: require('@/assets/payment-logos/eurc.png'),
} as const;

/**
 * USDC / EURC currency mark — circular flag image (USD or EU) loaded from
 * the user-supplied PNGs in assets/payment-logos.
 */
export function CurrencyLogo({ code, size = 36 }: Props) {
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Image
        source={LOGOS[code]}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#EEE',
  },
});
