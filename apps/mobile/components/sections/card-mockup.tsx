import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Wifi } from 'lucide-react-native';
import { KiteLogo } from '@/components/ui/kite-logo';
import { CurrencyLogo } from '@/components/ui/currency-logo';
import { fonts, radii, shadows } from '@/constants/theme';

type Currency = 'USDC' | 'EURC';

type Props = {
  last4: string;
  holder?: string;
  /** When true, show the full card number / expiry / CVV instead of the masked default. */
  revealed?: boolean;
  fullNumber?: string;
  expiry?: string;
  cvv?: string;
  /** Which Kite balance funds the card right now. Drives the visual variant. */
  currency?: Currency;
};

/**
 * Kite Visa card. Two variants:
 *   USDC → ink/charcoal metallic gradient
 *   EURC → midnight-navy metallic gradient
 *
 * Card details (number / expiry / CVV) render directly on the face when
 * `revealed` is true. There is no separate "show details" panel — the
 * reveal happens on the card itself.
 */
export function CardMockup({
  last4,
  holder = 'KITE MEMBER',
  revealed = false,
  fullNumber,
  expiry,
  cvv,
  currency = 'USDC',
}: Props) {
  const gradient =
    currency === 'EURC'
      ? (['#1d2a4a', '#0a1224', '#162045'] as const)
      : (['#1f1f1f', '#000000', '#0a0a0a'] as const);

  return (
    <LinearGradient
      colors={[...gradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, shadows.inkCard]}
    >
      {/* sheen — subtle diagonal highlight */}
      <LinearGradient
        colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <View style={styles.top}>
        <KiteLogo size={20} color="#FFFFFF" showWordmark wordmarkColor="#FFFFFF" />
        <View style={styles.currencyChip}>
          <CurrencyLogo code={currency} size={16} />
          <Text style={styles.currencyText}>{currency}</Text>
        </View>
      </View>

      <View style={styles.middle}>
        {revealed && fullNumber ? (
          <Text style={styles.numberFull}>{fullNumber}</Text>
        ) : (
          <Text style={styles.numberMasked}>•••• •••• •••• {last4}</Text>
        )}
        {revealed && (
          <View style={styles.detailsRow}>
            <View>
              <Text style={styles.detailLabel}>EXP</Text>
              <Text style={styles.detailValue}>{expiry ?? '••/••'}</Text>
            </View>
            <View>
              <Text style={styles.detailLabel}>CVV</Text>
              <Text style={styles.detailValue}>{cvv ?? '•••'}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.bottom}>
        <Text style={styles.holder}>{holder.toUpperCase()}</Text>
        <View style={styles.bottomRight}>
          {!revealed && (
            <Wifi size={14} color="#FFFFFF" strokeWidth={2} style={styles.nfcIcon} />
          )}
          <Text style={styles.visa}>VISA</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: radii.xl,
    padding: 20,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  currencyText: {
    fontFamily: fonts.mono,
    color: '#FFFFFF',
    fontSize: 10,
    letterSpacing: 2,
  },
  middle: { flex: 1, justifyContent: 'center', gap: 10 },
  numberMasked: {
    fontFamily: fonts.mono,
    color: '#FFFFFF',
    fontSize: 18,
    letterSpacing: 3,
  },
  numberFull: {
    fontFamily: fonts.mono,
    color: '#FFFFFF',
    fontSize: 18,
    letterSpacing: 2,
  },
  detailsRow: { flexDirection: 'row', gap: 24 },
  detailLabel: {
    fontFamily: fonts.mono,
    color: '#FFFFFF',
    fontSize: 9,
    letterSpacing: 1.5,
    opacity: 0.55,
  },
  detailValue: {
    fontFamily: fonts.mono,
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 1,
    marginTop: 2,
  },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  holder: {
    fontFamily: fonts.mono,
    color: '#FFFFFF',
    fontSize: 11,
    letterSpacing: 2,
    opacity: 0.95,
    flex: 1,
  },
  bottomRight: { alignItems: 'flex-end', gap: 4 },
  nfcIcon: { transform: [{ rotate: '90deg' }], opacity: 0.85 },
  visa: {
    fontFamily: fonts.displayBold,
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 18,
    letterSpacing: 2,
    fontStyle: 'italic',
  },
});
