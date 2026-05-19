import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, ArrowUpDown, Check, ExternalLink } from 'lucide-react-native';
import { formatUnits } from 'viem';

import { Button } from '@/components/ui/button';
import { Keypad } from '@/components/sections/keypad';
import { CurrencyLogo } from '@/components/ui/currency-logo';
import { useMe } from '@/hooks/use-me';
import { useBalance } from '@/hooks/use-treasury';
import { useSwap, useSwapQuote } from '@/hooks/use-swap';
import { TOKEN_DECIMALS, tokensFor, type SwapDirection } from '@/lib/uniswap';
import { env } from '@/lib/env';
import { colors, fonts, layout, radii } from '@/constants/theme';

type Stage = 'enter' | 'success';

const UNISWAP_PINK = '#FC72FF';

export default function Convert() {
  const router = useRouter();
  const me = useMe();
  const balance = useBalance(me.data?.walletAddress);
  const swap = useSwap();

  const [direction, setDirection] = useState<SwapDirection>('USDC_TO_EURC');
  const [amount, setAmount] = useState('0');
  const [stage, setStage] = useState<Stage>('enter');

  const tokens = tokensFor(direction);
  const walletIn =
    direction === 'USDC_TO_EURC'
      ? parseFloat(balance.data?.walletUsdc.formatted ?? '0')
      : parseFloat(balance.data?.walletEurc.formatted ?? '0');

  const amountNum = parseFloat(amount) || 0;
  const insufficient = amountNum > walletIn;

  const quote = useSwapQuote(direction, amountNum > 0 ? amount : '');

  const flip = () => {
    Haptics.selectionAsync().catch(() => {});
    setDirection((d) => (d === 'USDC_TO_EURC' ? 'EURC_TO_USDC' : 'USDC_TO_EURC'));
    setAmount('0');
  };

  const onKey = (k: string) => {
    setAmount((curr) => {
      if (k === 'back') {
        const next = curr.slice(0, -1);
        return next.length ? next : '0';
      }
      if (k === '.') {
        if (curr.includes('.')) return curr;
        return curr + '.';
      }
      if (curr === '0') return k;
      const [, decs] = curr.split('.');
      if (decs && decs.length >= 2) return curr;
      return curr + k;
    });
  };

  const onConvert = async () => {
    if (insufficient || amountNum <= 0 || swap.isPending) return;
    try {
      await swap.mutateAsync({ direction, dollars: amount });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStage('success');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const canConvert =
    amountNum > 0 &&
    !insufficient &&
    !quote.loading &&
    quote.amountOutRaw !== null &&
    !quote.error &&
    !swap.isPending;

  const outAmount = formatOut(quote.amountOutFormatted, quote.loading);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <ArrowLeft size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {stage === 'success' ? 'Converted' : 'Convert'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <AnimatePresence exitBeforeEnter>
        {stage === 'enter' && (
          <MotiView
            key="enter"
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0 }}
            style={styles.flex}
          >
            <View style={styles.swapWrap}>
              {/* Sell card */}
              <View style={styles.swapCard}>
                <Text style={styles.swapLabel}>Sell</Text>
                <View style={styles.swapRow}>
                  <Text
                    style={[
                      styles.swapAmount,
                      amountNum === 0 && styles.swapAmountMuted,
                    ]}
                    numberOfLines={1}
                  >
                    {amount}
                  </Text>
                  <TokenPill code={tokens.inSymbol as 'USDC' | 'EURC'} />
                </View>
                <View style={styles.swapMetaRow}>
                  <Text style={styles.swapMeta}>
                    ${amountNum.toFixed(2)}
                  </Text>
                  <Text style={styles.swapBalance}>
                    {walletIn.toFixed(2)} {tokens.inSymbol}
                  </Text>
                </View>
              </View>

              {/* Swap arrow — bidirectional, taps to flip direction */}
              <Pressable onPress={flip} style={styles.flipBtn} hitSlop={10}>
                <ArrowUpDown size={18} color={colors.ink} strokeWidth={2.4} />
              </Pressable>

              {/* Buy card */}
              <View style={styles.swapCard}>
                <Text style={styles.swapLabel}>Buy</Text>
                <View style={styles.swapRow}>
                  <Text
                    style={[styles.swapAmount, styles.swapAmountMuted]}
                    numberOfLines={1}
                  >
                    {outAmount}
                  </Text>
                  <TokenPill code={tokens.outSymbol as 'USDC' | 'EURC'} />
                </View>
                <View style={styles.swapMetaRow}>
                  <Text style={styles.swapMeta}>
                    {quote.amountOutFormatted
                      ? `$${parseFloat(quote.amountOutFormatted).toFixed(2)}`
                      : '$0.00'}
                  </Text>
                  <Text style={styles.swapBalance}>
                    rate {rateString(amountNum, quote.amountOutFormatted, tokens.inSymbol, tokens.outSymbol)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Keypad */}
            <View style={styles.keypadWrap}>
              <Keypad onPress={onKey} />
            </View>

            {/* Errors */}
            {quote.error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  No USDC/EURC liquidity yet. Seed the pool first.
                </Text>
              </View>
            )}
            {swap.error && !quote.error && swap.friendlyError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{swap.friendlyError}</Text>
              </View>
            )}

            {/* CTA + Powered by Uniswap */}
            <View style={styles.bottom}>
              <Button
                label={ctaLabel({
                  insufficient,
                  amountNum,
                  phase: swap.phase,
                  symbol: tokens.inSymbol,
                  pending: swap.isPending,
                })}
                onPress={onConvert}
                loading={swap.isPending}
                disabled={!canConvert}
                size="lg"
              />
              <View style={styles.poweredRow}>
                <Image
                  source={require('@/assets/payment-logos/uniswap.png')}
                  style={styles.poweredLogo}
                  resizeMode="contain"
                />
                <Text style={styles.poweredText}>Powered by Uniswap</Text>
              </View>
            </View>
          </MotiView>
        )}

        {stage === 'success' && swap.data && (
          <MotiView
            key="success"
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={styles.successWrap}
          >
            <View style={styles.successCircle}>
              <Check size={36} color={colors.cream} strokeWidth={2.6} />
            </View>
            <Text style={styles.successAmount}>
              {tokens.outSign}
              {formatUnits(swap.data.amountOutRaw, TOKEN_DECIMALS)}
            </Text>
            <Text style={styles.successSub}>
              from{' '}
              <Text style={styles.successName}>
                {tokens.inSign}
                {formatUnits(swap.data.amountInRaw, TOKEN_DECIMALS)} {tokens.inSymbol}
              </Text>
            </Text>
            <Text style={styles.successHash}>
              swap {shortHash(swap.data.swapHash)} · settled in{' '}
              {(swap.data.settleMs / 1000).toFixed(1)}s
            </Text>
            <Pressable
              onPress={() =>
                Linking.openURL(
                  `${env.basescanUrl}/tx/${swap.data!.swapHash}`,
                ).catch(() => {})
              }
              hitSlop={8}
            >
              <View style={styles.basescanRow}>
                <Text style={styles.basescanText}>View on BaseScan</Text>
                <ExternalLink size={13} color={colors.inkMuted} strokeWidth={2} />
              </View>
            </Pressable>
            <View style={styles.successCta}>
              <Button
                label="Convert another"
                variant="ghost"
                onPress={() => {
                  swap.reset();
                  setAmount('0');
                  setStage('enter');
                }}
              />
              <Button label="Done" variant="ink" onPress={() => router.back()} />
            </View>
          </MotiView>
        )}
      </AnimatePresence>
    </SafeAreaView>
  );
}

/** Currency badge — flag + ticker. No chevron since the only pair is
 *  USDC↔EURC and that's controlled by the swap arrow between the cards. */
function TokenPill({ code }: { code: 'USDC' | 'EURC' }) {
  return (
    <View style={styles.tokenPill}>
      <CurrencyLogo code={code} size={26} />
      <Text style={styles.tokenPillText}>{code}</Text>
    </View>
  );
}

function ctaLabel({
  insufficient,
  amountNum,
  phase,
  symbol,
  pending,
}: {
  insufficient: boolean;
  amountNum: number;
  phase: string;
  symbol: string;
  pending: boolean;
}): string {
  if (!pending) {
    if (insufficient) return `Insufficient ${symbol}`;
    if (amountNum <= 0) return 'Enter an amount';
    return `Convert ${amountNum.toFixed(2)} ${symbol}`;
  }
  switch (phase) {
    case 'approving':
      return 'Approving…';
    case 'swapping':
      return 'Broadcasting swap…';
    case 'waiting':
      return 'Waiting for receipt…';
    default:
      return 'Working…';
  }
}

function formatOut(formatted: string | null, loading: boolean): string {
  if (loading) return '…';
  if (!formatted) return '0';
  const n = parseFloat(formatted);
  return n.toFixed(2);
}

function rateString(
  inN: number,
  outFmt: string | null,
  inSym: string,
  outSym: string,
): string {
  if (!outFmt || inN <= 0) return '—';
  const out = parseFloat(outFmt);
  if (!Number.isFinite(out) || out <= 0) return '—';
  const rate = out / inN;
  return `1 ${inSym} = ${rate.toFixed(4)} ${outSym}`;
}

function shortHash(h: string): string {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  /** Transparent box that balances the left back button so the title
   *  stays centered — no background, no border. */
  headerSpacer: { width: 36, height: 36 },
  headerTitle: { fontFamily: fonts.bodySemibold, color: colors.ink, fontSize: 15 },

  /* Uniswap-style swap stack — cards separated by a small bone gap so
     they don't read as a single welded slab. The flip-arrow button
     overlaps the gap. */
  swapWrap: {
    marginHorizontal: layout.screenPaddingX,
    marginTop: 12,
    position: 'relative',
    gap: 6,
  },
  swapCard: {
    backgroundColor: '#F4F4F4',
    borderRadius: radii.xl,
    padding: 18,
    gap: 14,
  },
  swapLabel: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 14,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  swapAmount: {
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontWeight: '600',
    color: colors.ink,
    fontSize: 38,
    letterSpacing: -1.2,
  },
  swapAmountMuted: { color: colors.inkMuted, opacity: 0.6 },
  swapMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swapMeta: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 13 },
  swapBalance: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 13 },

  /* Flip arrow centered between cards */
  flipBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -22,
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.cream,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },

  /* Token pill — Uniswap-style with logo + ticker + chevron */
  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  tokenPillText: {
    fontFamily: fonts.bodySemibold,
    fontWeight: '700',
    color: colors.ink,
    fontSize: 15,
  },

  keypadWrap: { paddingHorizontal: layout.screenPaddingX, marginTop: 16 },

  errorBox: {
    marginHorizontal: layout.screenPaddingX,
    marginTop: 8,
    backgroundColor: 'rgba(220,38,38,0.10)',
    borderRadius: radii.md,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  errorText: { fontFamily: fonts.body, color: '#DC2626', fontSize: 12 },

  /* Bottom CTA + powered by Uniswap */
  bottom: {
    paddingHorizontal: layout.screenPaddingX,
    marginTop: 'auto',
    paddingBottom: 8,
    gap: 12,
  },
  poweredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  poweredLogo: { width: 16, height: 16 },
  poweredText: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 12,
  },

  /* Success */
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.screenPaddingX },
  successCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  successAmount: {
    fontFamily: fonts.bodySemibold,
    fontWeight: '700',
    color: colors.ink,
    fontSize: 56,
    letterSpacing: -1.5,
  },
  successSub: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 15, marginTop: 8 },
  successName: { fontFamily: fonts.bodySemibold, color: colors.ink },
  successHash: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 11, marginTop: 14, textAlign: 'center', paddingHorizontal: 24 },
  basescanRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  basescanText: { fontFamily: fonts.bodyMedium, color: colors.inkMuted, fontSize: 12 },
  successCta: { marginTop: 36, alignSelf: 'stretch', gap: 10 },
});

// Silence unused-const lint while Uniswap pink stays declared for potential
// secondary accents later (e.g., the swap-success badge).
void UNISWAP_PINK;
