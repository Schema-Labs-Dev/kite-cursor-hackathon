import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  X,
  Wifi,
  Check,
  ExternalLink,
  Sparkles,
  Loader2,
} from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { useBalance } from '@/hooks/use-treasury';
import { useMe } from '@/hooks/use-me';
import { useCardPay, type CardPayToken } from '@/hooks/use-card-pay';
import { DEFAULT_MERCHANT } from '@/lib/merchants';
import { env } from '@/lib/env';
import { log } from '@/lib/log';
import { colors, fonts, layout, radii } from '@/constants/theme';

type Phase = 'idle' | 'connecting' | 'auth' | 'sending' | 'waiting' | 'done';

const DEFAULT_AMOUNT = '4.50';

export default function CardPay() {
  const router = useRouter();
  const me = useMe();
  const balance = useBalance(me.data?.walletAddress);
  const pay = useCardPay();

  const [merchant] = useState(DEFAULT_MERCHANT);
  const [token, setToken] = useState<CardPayToken>('USDC');
  const [amountStr, setAmountStr] = useState(DEFAULT_AMOUNT);
  const [editing, setEditing] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [settledMs, setSettledMs] = useState<number | null>(null);
  const [block, setBlock] = useState<number | null>(null);

  // Subtle entry haptic so it feels like "tap detected"
  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const walletUsdc = parseFloat(balance.data?.walletUsdc.formatted ?? '0');
  const walletEurc = parseFloat(balance.data?.walletEurc.formatted ?? '0');
  const amountNum = parseFloat(amountStr) || 0;
  const tokenSign = token === 'USDC' ? '$' : '€';
  const balanceOfToken = token === 'USDC' ? walletUsdc : walletEurc;
  const insufficient = amountNum > balanceOfToken;
  const cashback = amountNum * 0.04;

  const onApprove = async () => {
    if (insufficient || amountNum <= 0) return;
    setError(null);
    setPhase('connecting');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Cosmetic "tapping terminal" beat — feels like the NFC handshake.
    await new Promise((r) => setTimeout(r, 700));

    setPhase('auth');
    const ok = await runBiometric();
    if (!ok) {
      setPhase('idle');
      setError('Cancelled.');
      return;
    }

    setPhase('sending');
    try {
      const result = await pay.mutateAsync({
        merchant,
        token,
        amount: amountNum.toFixed(2),
      });
      setPhase('waiting');
      try {
        const r = await result.receipt;
        setSettledMs(r.settledMs);
        setBlock(r.blockNumber);
      } catch (e) {
        // Tx broadcast but receipt failed — still treat as paid; just no block.
        log.warn('card.pay', `receipt failed: ${(e as Error).message}`);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPhase('done');
    } catch (e) {
      const msg = (e as Error).message;
      setError(friendlyError(msg));
      setPhase('idle');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const close = () => router.back();
  const txHash = pay.data?.txHash ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={close} style={styles.iconBtn} hitSlop={12}>
          <X size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Tap to pay</Text>
        <View style={styles.headerSpacer} />
      </View>

      <AnimatePresence exitBeforeEnter>
        {phase !== 'done' ? (
          <MotiView
            key="form"
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0 }}
            style={styles.flex}
          >
            <View style={styles.merchantCard}>
              <View style={styles.terminalRow}>
                <Wifi
                  size={12}
                  color={colors.inkMuted}
                  strokeWidth={2}
                  style={{ transform: [{ rotate: '90deg' }] }}
                />
                <Text style={styles.terminalText}>contactless terminal</Text>
              </View>
              <View style={styles.merchantHeader}>
                <Text style={styles.merchantIcon}>{merchant.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.merchantName}>{merchant.name}</Text>
                  <Text style={styles.merchantLoc}>{merchant.location}</Text>
                </View>
              </View>

              <Pressable
                onPress={() => phase === 'idle' && setEditing((e) => !e)}
                disabled={phase !== 'idle'}
                style={styles.amountWrap}
              >
                <Text style={styles.amountEyebrow}>amount</Text>
                {editing ? (
                  <TextInput
                    value={amountStr}
                    onChangeText={(t) =>
                      setAmountStr(t.replace(/[^0-9.]/g, '').slice(0, 10))
                    }
                    onBlur={() => {
                      setAmountStr((s) => normalize(s));
                      setEditing(false);
                    }}
                    keyboardType="decimal-pad"
                    autoFocus
                    style={styles.amountInput}
                  />
                ) : (
                  <Text style={styles.amount}>
                    {tokenSign}
                    {amountNum.toFixed(2)}
                  </Text>
                )}
                {phase === 'idle' && (
                  <Text style={styles.amountHint}>tap to edit</Text>
                )}
              </Pressable>

              <View style={styles.tokenRow}>
                <TokenPill
                  label="USDC"
                  sub={`$${walletUsdc.toFixed(2)}`}
                  active={token === 'USDC'}
                  disabled={phase !== 'idle'}
                  onPress={() => setToken('USDC')}
                />
                <TokenPill
                  label="EURC"
                  sub={`€${walletEurc.toFixed(2)}`}
                  active={token === 'EURC'}
                  disabled={phase !== 'idle'}
                  onPress={() => setToken('EURC')}
                />
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>cashback (4%)</Text>
                <Text style={styles.metaValue}>+${cashback.toFixed(2)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>network fee</Text>
                <Text style={styles.metaValue}>
                  {env.cdpRpcUrl ? '$0.00 · sponsored' : 'paid in Sepolia ETH'}
                </Text>
              </View>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.cta}>
              <Button
                label={ctaLabel({ phase, insufficient, amountNum, token })}
                onPress={onApprove}
                loading={phase !== 'idle'}
                disabled={
                  phase !== 'idle' ||
                  insufficient ||
                  amountNum <= 0
                }
                size="lg"
              />
              {phase !== 'idle' && (
                <View style={styles.phaseHint}>
                  <Loader2 size={14} color={colors.inkMuted} strokeWidth={2} />
                  <Text style={styles.phaseText}>{phaseDescription(phase)}</Text>
                </View>
              )}
            </View>
          </MotiView>
        ) : (
          <MotiView
            key="done"
            from={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            style={styles.doneWrap}
          >
            <View style={styles.checkCircle}>
              <Check size={36} color={colors.cream} strokeWidth={3} />
            </View>
            <Text style={styles.paidTitle}>Paid {merchant.name}</Text>
            <Text style={styles.paidAmount}>
              {tokenSign}
              {amountNum.toFixed(2)}{' '}
              <Text style={styles.paidToken}>{token}</Text>
            </Text>
            <View style={styles.cashbackChip}>
              <Text style={styles.cashbackText}>
                +${cashback.toFixed(2)} cashback earned
              </Text>
            </View>

            <View style={styles.receiptFacts}>
              <Fact label="When" value={new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} />
              <Fact label="Settled" value={settledMs !== null ? `${(settledMs / 1000).toFixed(1)}s` : 'pending'} />
              {block !== null && <Fact label="Block" value={`#${block}`} />}
            </View>

            {txHash && (
              <Pressable
                onPress={() =>
                  Linking.openURL(`${env.basescanUrl}/tx/${txHash}`).catch(() => {})
                }
                hitSlop={8}
                style={styles.basescanRow}
              >
                <Text style={styles.basescanText}>
                  tx {txHash.slice(0, 6)}…{txHash.slice(-4)}
                </Text>
                <ExternalLink size={13} color={colors.inkMuted} strokeWidth={2} />
              </Pressable>
            )}

            <View style={styles.doneCta}>
              <Button label="Done" variant="ink" onPress={close} />
            </View>
          </MotiView>
        )}
      </AnimatePresence>
    </SafeAreaView>
  );
}

function TokenPill({
  label,
  sub,
  active,
  disabled,
  onPress,
}: {
  label: string;
  sub: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.pill,
        active && styles.pillActive,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>{label}</Text>
      <Text style={[styles.pillSub, active && styles.pillSubActive]}>{sub}</Text>
    </Pressable>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factCol}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

async function runBiometric(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hasHardware
      ? await LocalAuthentication.isEnrolledAsync()
      : false;
    if (!hasHardware || !enrolled) {
      // No biometric available — cosmetic "approve" beat so the demo still flows.
      await new Promise((r) => setTimeout(r, 350));
      log.info('card.pay', 'Biometric unavailable — cosmetic approve');
      return true;
    }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Approve payment',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return res.success;
  } catch (e) {
    log.warn('card.pay', `Biometric error: ${(e as Error).message}`);
    return true; // be permissive in dev
  }
}

function phaseDescription(p: Phase): string {
  switch (p) {
    case 'connecting': return 'tapping terminal…';
    case 'auth':       return 'awaiting biometric…';
    case 'sending':    return 'broadcasting…';
    case 'waiting':    return 'settling on Base…';
    default:           return '';
  }
}

function ctaLabel({
  phase,
  insufficient,
  amountNum,
  token,
}: {
  phase: Phase;
  insufficient: boolean;
  amountNum: number;
  token: CardPayToken;
}): string {
  if (phase !== 'idle') {
    if (phase === 'connecting') return 'Connecting…';
    if (phase === 'auth')       return 'Hold for Face ID…';
    if (phase === 'sending')    return 'Broadcasting…';
    if (phase === 'waiting')    return 'Settling…';
    return 'Working…';
  }
  if (insufficient)    return `Insufficient ${token}`;
  if (amountNum <= 0)  return 'Enter an amount';
  return `Approve ${token === 'USDC' ? '$' : '€'}${amountNum.toFixed(2)}`;
}

function normalize(s: string): string {
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return '0.00';
  return n.toFixed(2);
}

function friendlyError(msg: string): string {
  const lower = msg.toLowerCase();
  if (
    lower.includes('insufficient funds') ||
    lower.includes('exceeds the balance') ||
    lower.includes('exceeds allowance (0)') ||
    lower.includes('gas required exceeds')
  ) {
    return 'Need a little Sepolia ETH for gas. Fund the wallet from coinbase.com/faucets and retry.';
  }
  if (lower.includes('transfer amount exceeds balance')) {
    return 'Not enough of this token in your wallet.';
  }
  if (lower.includes('user rejected') || lower.includes('cancel')) {
    return 'Cancelled.';
  }
  return msg;
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
  /** Transparent box to balance the left close button — same dimensions
   *  so the title centers, no background so it doesn't read as a button. */
  headerSpacer: { width: 36, height: 36 },
  headerTitle: { fontFamily: fonts.bodySemibold, color: colors.ink, fontSize: 15 },

  merchantCard: {
    marginHorizontal: layout.screenPaddingX,
    marginTop: 8,
    backgroundColor: '#F4F4F4',
    borderRadius: radii.xl,
    padding: 20,
    gap: 16,
  },
  terminalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  terminalText: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  merchantHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  merchantIcon: { fontSize: 36 },
  merchantName: { fontFamily: fonts.display, color: colors.ink, fontSize: 22, letterSpacing: -0.4 },
  merchantLoc: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 11, marginTop: 2 },

  amountWrap: { alignItems: 'center', gap: 4, marginTop: 4 },
  amountEyebrow: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  amount: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 64,
    letterSpacing: -2,
    lineHeight: 70,
  },
  amountInput: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 56,
    textAlign: 'center',
    padding: 0,
    minWidth: 160,
  },
  amountHint: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 10, opacity: 0.7 },

  tokenRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 2,
  },
  pillActive: { backgroundColor: colors.ink },
  pillLabel: { fontFamily: fonts.bodySemibold, color: colors.ink, fontSize: 14 },
  pillLabelActive: { color: colors.cream },
  pillSub: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 11 },
  pillSubActive: { color: 'rgba(255,255,255,0.7)' },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  metaLabel: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 12 },
  metaValue: { fontFamily: fonts.mono, color: colors.ink, fontSize: 12 },

  errorBox: {
    marginHorizontal: layout.screenPaddingX,
    marginTop: 12,
    backgroundColor: 'rgba(255,90,44,0.12)',
    borderRadius: radii.md,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  errorText: { fontFamily: fonts.body, color: colors.sunDeep, fontSize: 12 },

  cta: { paddingHorizontal: layout.screenPaddingX, marginTop: 'auto', paddingBottom: 12, gap: 8 },
  phaseHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  phaseText: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 11 },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.screenPaddingX },
  checkCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
  },
  paidTitle: { fontFamily: fonts.bodySemibold, color: colors.ink, fontSize: 16, marginBottom: 4 },
  paidAmount: { fontFamily: fonts.displayBold, color: colors.ink, fontSize: 48, letterSpacing: -1.5 },
  paidToken: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 22, letterSpacing: 1 },
  cashbackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 16,
    backgroundColor: '#F4F4F4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  cashbackText: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 12 },

  receiptFacts: { flexDirection: 'row', gap: 24, marginTop: 24 },
  factCol: { alignItems: 'center', gap: 2 },
  factLabel: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  factValue: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13 },

  basescanRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 20 },
  basescanText: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 11 },

  doneCta: { marginTop: 36, alignSelf: 'stretch' },
});
