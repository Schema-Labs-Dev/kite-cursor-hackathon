import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/constants/theme';

type Props = {
  balance: number;
  /** APY shown is owned by the "Money in motion" section now, so we accept
   *  the prop for back-compat but render nothing for it on Home. */
  apy?: number;
  yieldToday?: number;
};

function formatBalance(balance: number) {
  const [whole, cents = '00'] = balance.toFixed(2).split('.');
  const wholeFmt = Number(whole).toLocaleString('en-US');
  return { whole: wholeFmt, cents };
}

/**
 * Balance — quiet hero. Massive centered number, nothing else. The
 * currency/APY context lives in "Money in motion" below, so Home stays
 * focused on the headline figure.
 */
export function BalanceCard({ balance }: Props) {
  const { whole, cents } = formatBalance(balance);
  return (
    <View style={styles.wrap}>
      <View style={styles.amountRow}>
        <Text style={styles.dollar}>$</Text>
        <Text style={styles.whole}>{whole}</Text>
        <Text style={styles.cents}>.{cents}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  dollar: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 30,
    marginRight: 4,
  },
  whole: {
    fontFamily: fonts.bodySemibold,
    fontWeight: '700',
    color: colors.ink,
    fontSize: 64,
    letterSpacing: -3,
    lineHeight: 68,
  },
  cents: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
    fontSize: 34,
    letterSpacing: -1,
  },
});
