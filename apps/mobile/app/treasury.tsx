import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Check, ExternalLink, ArrowDownToLine, ArrowUpFromLine, TrendingUp } from 'lucide-react-native';
import { CurrencyLogo, type CurrencyCode } from '@/components/ui/currency-logo';

import { Button } from '@/components/ui/button';
import { Keypad } from '@/components/sections/keypad';
import { useMe } from '@/hooks/use-me';
import { useBalance, useTreasuryInfo } from '@/hooks/use-treasury';
import { useTreasuryAction, type TreasuryActionKind, type TreasuryActionPhase } from '@/hooks/use-treasury-action';
import { env } from '@/lib/env';
import type { TreasuryToken } from '@/lib/treasury';
import { colors, fonts, layout, radii } from '@/constants/theme';

type Stage = 'compose' | 'success';

const TOKENS: { code: TreasuryToken; label: string; symbol: string }[] = [
  { code: 'USDC', label: 'US Dollar', symbol: '$' },
  { code: 'EURC', label: 'Euro Coin', symbol: '€' },
];

export default function TreasuryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; token?: string }>();

  const me = useMe();
  const info = useTreasuryInfo();
  const balance = useBalance(me.data?.walletAddress);

  const [kind, setKind] = useState<TreasuryActionKind>(
    params.kind === 'withdraw' ? 'withdraw' : 'deposit',
  );
  const [token, setToken] = useState<TreasuryToken>(
    params.token === 'EURC' ? 'EURC' : 'USDC',
  );
  const [amount, setAmount] = useState('0');
  const [phase, setPhase] = useState<TreasuryActionPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('compose');
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [approveHash, setApproveHash] = useState<`0x${string}` | null>(null);
  const [settleMs, setSettleMs] = useState<number | null>(null);

  const action = useTreasuryAction({ onPhase: setPhase });

  const apyPercent = info.data ? info.data.apy.decimal * 100 : 0;
  const symbol = TOKENS.find((t) => t.code === token)!.symbol;

  const walletFormatted = balance.data
    ? token === 'USDC'
      ? balance.data.walletUsdc.formatted
      : balance.data.walletEurc.formatted
    : '0';
  const treasuryFormatted = balance.data
    ? token === 'USDC'
      ? balance.data.treasury.usdc.total.formatted
      : balance.data.treasury.eurc.total.formatted
    : '0';
  const walletNum = parseFloat(walletFormatted);
  const treasuryNum = parseFloat(treasuryFormatted);
  const cap = kind === 'deposit' ? walletNum : treasuryNum;
  const capLabel =
    kind === 'deposit' ? 'in wallet' : 'in treasury';

  const amountNum = parseFloat(amount) || 0;
  const insufficient = amountNum > cap;
  const canSubmit =
    amountNum > 0 && !insufficient && !action.isPending && Boolean(me.data?.walletAddress);

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

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setApproveHash(null);
    setPhase(null);
    try {
      const result = await action.mutateAsync({
        kind,
        token,
        amount: amountNum.toFixed(2),
      });
      setTxHash(result.txHash);
      setApproveHash(result.approveTxHash ?? null);
      setSettleMs(null);
      result.receipt
        .then(({ settledMs }) => setSettleMs(settledMs))
        .catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStage('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(friendlyError(msg));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setPhase(null);
    }
  };

  const reset = () => {
    setStage('compose');
    setAmount('0');
    setError(null);
    setTxHash(null);
    setApproveHash(null);
    setSettleMs(null);
    setPhase(null);
  };

  const ctaLabel = useMemo(() => {
    if (action.isPending) {
      if (phase === 'approving') return 'Approving token…';
      if (phase === 'broadcasting')
        return kind === 'deposit' ? 'Depositing…' : 'Withdrawing…';
      return 'Broadcasting…';
    }
    if (insufficient) {
      return kind === 'deposit'
        ? `Not enough ${token} in wallet`
        : `Not enough ${token} in treasury`;
    }
    if (amountNum <= 0) return 'Enter an amount';
    return kind === 'deposit'
      ? `Deposit ${symbol}${amountNum.toFixed(2)}`
      : `Withdraw ${symbol}${amountNum.toFixed(2)}`;
  }, [action.isPending, phase, insufficient, amountNum, kind, symbol, token]);

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
          {stage === 'success' ? (kind === 'deposit' ? 'Deposited' : 'Withdrew') : 'Move to yield'}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <AnimatePresence exitBeforeEnter>
        {stage === 'compose' && (
          <MotiView
            key="compose"
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0 }}
            style={styles.flex}
          >
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.toggleRow}>
                {(['deposit', 'withdraw'] as const).map((k) => {
                  const active = kind === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setKind(k);
                        setAmount('0');
                      }}
                      style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                    >
                      {k === 'deposit' ? (
                        <ArrowDownToLine
                          size={14}
                          color={active ? colors.cream : colors.ink}
                          strokeWidth={2}
                        />
                      ) : (
                        <ArrowUpFromLine
                          size={14}
                          color={active ? colors.cream : colors.ink}
                          strokeWidth={2}
                        />
                      )}
                      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                        {k === 'deposit' ? 'Deposit' : 'Withdraw'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.tokenRow}>
                {TOKENS.map((t) => {
                  const active = token === t.code;
                  return (
                    <Pressable
                      key={t.code}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setToken(t.code);
                        setAmount('0');
                      }}
                      style={[styles.tokenBtn, active && styles.tokenBtnActive]}
                    >
                      <CurrencyLogo code={t.code as CurrencyCode} size={32} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tokenLabel}>{t.label}</Text>
                        <Text style={styles.tokenCode}>{t.code}</Text>
                      </View>
                      {active && (
                        <View style={styles.tokenDot}>
                          <Check size={14} color={colors.cream} strokeWidth={3} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.amountWrap}>
                <Text style={styles.amountEyebrow}>
                  {kind === 'deposit' ? 'you deposit' : 'you withdraw'}
                </Text>
                <View style={styles.amountRow}>
                  <Text style={styles.amountDollar}>{symbol}</Text>
                  <Text style={styles.amount}>{amount}</Text>
                </View>
                <Text style={styles.amountSub}>
                  {balance.isLoading
                    ? 'loading balances…'
                    : `${symbol}${cap.toFixed(2)} ${token} ${capLabel}`}
                </Text>

                <View style={styles.yieldNote}>
                  <TrendingUp size={12} color={colors.inkMuted} strokeWidth={2.2} />
                  <Text style={styles.yieldNoteText}>
                    earning {apyPercent.toFixed(2)}% APY · paid in {token}
                  </Text>
                </View>
              </View>

              <View style={styles.keypadWrap}>
                <Keypad onPress={onKey} />
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText} numberOfLines={4}>
                    {error}
                  </Text>
                </View>
              )}

              <View style={styles.cta}>
                <Button
                  label={ctaLabel}
                  onPress={onSubmit}
                  loading={action.isPending}
                  disabled={!canSubmit}
                  size="lg"
                  variant={kind === 'deposit' ? 'primary' : 'ink'}
                />
                {phase === 'approving' && (
                  <Text style={styles.phaseHint}>
                    Step 1 of 2 — approving {token} for the treasury contract. This only happens once per token.
                  </Text>
                )}
              </View>
            </ScrollView>
          </MotiView>
        )}

        {stage === 'success' && txHash && (
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
              {symbol}
              {amountNum.toFixed(2)}
            </Text>
            <Text style={styles.successSub}>
              {kind === 'deposit'
                ? `${token} deposited into Kite Treasury`
                : `${token} returned to your wallet`}
            </Text>
            <Text style={styles.successHash}>
              tx {shortHash(txHash)}
              {' · '}
              {settleMs === null
                ? 'broadcast — waiting for confirmation…'
                : `settled in ${(settleMs / 1000).toFixed(1)}s`}
            </Text>
            {approveHash && (
              <Text style={styles.approveHash}>
                approval tx {shortHash(approveHash)} · one-time
              </Text>
            )}
            <Pressable
              onPress={() =>
                Linking.openURL(`${env.basescanUrl}/tx/${txHash}`).catch(() => {})
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
                label={kind === 'deposit' ? 'Deposit more' : 'Withdraw more'}
                variant="ghost"
                onPress={reset}
              />
              <Button label="Done" variant="ink" onPress={() => router.back()} />
            </View>
          </MotiView>
        )}
      </AnimatePresence>

      {balance.isLoading && stage === 'compose' && !balance.data && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.inkMuted} />
        </View>
      )}
    </SafeAreaView>
  );
}

function shortHash(h: string): string {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

function friendlyError(msg: string): string {
  const lower = msg.toLowerCase();
  if (
    lower.includes('insufficient funds') ||
    lower.includes('exceeds the balance') ||
    lower.includes('exceeds allowance (0)') ||
    lower.includes('gas required exceeds')
  ) {
    return 'Your wallet needs a little Sepolia ETH for gas. Fund it at coinbase.com/faucets/base-ethereum-sepolia-faucet and try again.';
  }
  if (lower.includes('transfer amount exceeds balance')) {
    return 'Not enough of this token in your wallet.';
  }
  if (lower.includes('insufficientbalance')) {
    return 'Treasury balance is too low for that withdrawal.';
  }
  if (lower.includes('user rejected')) {
    return 'Cancelled.';
  }
  return msg;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  scroll: { paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: { fontFamily: fonts.bodySemibold, color: colors.ink, fontSize: 15 },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: layout.screenPaddingX,
    marginTop: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  toggleBtnActive: { backgroundColor: colors.ink },
  toggleText: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13 },
  toggleTextActive: { color: colors.cream },

  tokenRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: layout.screenPaddingX,
    marginTop: 12,
  },
  tokenBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F4F4F4',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tokenBtnActive: {
    backgroundColor: '#EBEBEB',
    borderColor: colors.ink,
  },
  tokenFlag: { fontSize: 20 },
  tokenLabel: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13 },
  tokenCode: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 10, marginTop: 2 },
  tokenDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.cream },

  amountWrap: { alignItems: 'center', paddingHorizontal: layout.screenPaddingX, marginTop: 28 },
  amountEyebrow: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  amountDollar: { fontFamily: fonts.display, color: colors.ink, fontSize: 36, marginRight: 2 },
  amount: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 80,
    letterSpacing: -3,
    lineHeight: 84,
  },
  amountSub: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 11, marginTop: 4 },
  yieldNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F4F4F4',
    borderRadius: radii.pill,
  },
  yieldNoteText: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 11 },

  keypadWrap: { paddingHorizontal: layout.screenPaddingX, marginTop: 18 },
  errorBox: {
    marginHorizontal: layout.screenPaddingX,
    marginTop: 8,
    backgroundColor: 'rgba(255,90,44,0.12)',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { fontFamily: fonts.body, color: colors.sunDeep, fontSize: 12 },
  cta: {
    paddingHorizontal: layout.screenPaddingX,
    marginTop: 16,
    gap: 8,
  },
  phaseHint: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },

  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenPaddingX,
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  successAmount: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 56,
    letterSpacing: -1.5,
  },
  successSub: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 15, marginTop: 8, textAlign: 'center' },
  successHash: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 11,
    marginTop: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  approveHash: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  basescanRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  basescanText: { fontFamily: fonts.bodyMedium, color: colors.inkMuted, fontSize: 12 },
  successCta: { marginTop: 36, alignSelf: 'stretch', gap: 10 },

  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
