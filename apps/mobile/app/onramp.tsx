import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import {
  X,
  ChevronRight,
  Check,
  ExternalLink,
  Loader2,
  ArrowLeft,
  Sparkles,
  ArrowRight,
} from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Keypad } from '@/components/sections/keypad';
import { PaymentLogo } from '@/components/ui/payment-logo';
import { useOnramp, type OnrampResult } from '@/hooks/use-onramp';
import { env } from '@/lib/env';
import {
  cardLast4,
  formatCardNumber,
  formatPhone,
  formatToken,
  formatZmw,
  getPaymentMethod,
  isPhoneValid,
  toApiMethod,
  MAX_ZMW,
  MIN_ZMW,
  normalizePhone,
  OnrampMethodKey,
  OnrampToken,
  PAYMENT_METHODS,
  RATES,
  TEST_CARD,
  zmwToToken,
} from '@/lib/onramp';
import { colors, fonts, layout, radii } from '@/constants/theme';

type Stage = 'method' | 'amount' | 'review' | 'processing' | 'done';

type ProcessingStep = 'provider' | 'mint' | 'settled';

export default function Onramp() {
  const router = useRouter();
  const onramp = useOnramp();

  const [stage, setStage] = useState<Stage>('method');
  const [method, setMethod] = useState<OnrampMethodKey | null>(null);
  const [token, setToken] = useState<OnrampToken>('USDC');
  const [zmw, setZmw] = useState('0');
  const [phone, setPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<ProcessingStep>('provider');
  const [result, setResult] = useState<OnrampResult | null>(null);

  // Subtle entry haptic so it feels like the sheet "snaps" up.
  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const pickedMethod = method ? getPaymentMethod(method) : null;
  const zmwNum = parseFloat(zmw) || 0;
  const tokenAmount = zmwToToken(zmwNum, token);
  const rate = RATES[token];

  const amountValid =
    zmwNum >= MIN_ZMW && zmwNum <= MAX_ZMW;
  const inputValid =
    pickedMethod?.input === 'phone'
      ? isPhoneValid(phone)
      : pickedMethod?.input === 'card'
        ? cardLast4(cardNumber).length === 4
        : false;
  const canReview = amountValid && inputValid;

  const close = () => router.back();
  const back = () => {
    Haptics.selectionAsync().catch(() => {});
    if (stage === 'amount') setStage('method');
    else if (stage === 'review') setStage('amount');
    else if (stage === 'done') close();
    else close();
  };

  const onKey = (k: string) => {
    if (stage !== 'amount') return;
    setZmw((curr) => {
      if (k === 'back') {
        const next = curr.slice(0, -1);
        return next.length ? next : '0';
      }
      if (k === '.') {
        if (curr.includes('.')) return curr;
        return curr + '.';
      }
      if (curr === '0') return k === '.' ? '0.' : k;
      const [, decs] = curr.split('.');
      if (decs && decs.length >= 2) return curr;
      // Cap at 5 digits before decimal (MAX_ZMW = 5000 is 4 digits).
      const [intPart] = curr.split('.');
      if (!curr.includes('.') && (intPart?.length ?? 0) >= 5) return curr;
      return curr + k;
    });
  };

  const useTestCard = () => {
    setCardNumber(TEST_CARD.number);
    setCardExpiry(TEST_CARD.expiry);
    setCardCvv(TEST_CARD.cvv);
    Haptics.selectionAsync().catch(() => {});
  };

  const startProcessing = async () => {
    if (!pickedMethod || !canReview) return;
    setError(null);
    setStage('processing');
    setStep('provider');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Switch to "minting" copy a beat after the backend's cosmetic delay
    // starts — feels like the provider settled and we kicked off-chain.
    const mintTimer = setTimeout(() => setStep('mint'), 1500);

    try {
      const r = await onramp.mutateAsync({
        method: toApiMethod(pickedMethod.key),
        token,
        amountKwacha: zmwNum,
        phone:
          pickedMethod.input === 'phone'
            ? normalizePhone(phone, pickedMethod.countryCode)
            : undefined,
        cardLast4:
          pickedMethod.input === 'card' ? cardLast4(cardNumber) : undefined,
      });
      clearTimeout(mintTimer);
      setStep('settled');
      setResult(r);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Tiny beat so the user sees the "minted" step land before the receipt.
      setTimeout(() => setStage('done'), 350);
    } catch (e) {
      clearTimeout(mintTimer);
      const msg = (e as Error).message;
      setError(friendlyError(msg));
      setStage('review');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={stage === 'method' || stage === 'done' ? close : back}
          style={styles.iconBtn}
          hitSlop={12}
          disabled={stage === 'processing'}
        >
          {stage === 'method' || stage === 'done' ? (
            <X size={18} color={colors.ink} strokeWidth={2} />
          ) : (
            <ArrowLeft size={18} color={colors.ink} strokeWidth={2} />
          )}
        </Pressable>
        <Text style={styles.headerTitle}>{headerTitle(stage)}</Text>
        <View style={styles.iconBtn} />
      </View>

      <AnimatePresence exitBeforeEnter>
        {stage === 'method' && (
          <MotiView
            key="method"
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0 }}
            style={styles.flex}
          >
            <ScrollView contentContainerStyle={styles.methodScroll}>
              <Text style={styles.eyebrow}>pay with</Text>
              <Text style={styles.bigTitle}>
                Add cash from Zambia
              </Text>
              <Text style={styles.subtle}>
                Convert Kwacha into stablecoin in seconds. Settles on Base
                Sepolia.
              </Text>

              <View style={styles.methodList}>
                {PAYMENT_METHODS.map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setMethod(m.key);
                      setStage('amount');
                    }}
                    style={({ pressed }) => [
                      styles.methodRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <PaymentLogo brand={m.brand} size={52} />
                    <View style={styles.methodCopy}>
                      <Text style={styles.methodName}>{m.name}</Text>
                      <Text style={styles.methodSub}>{m.subtitle}</Text>
                    </View>
                    <ChevronRight
                      size={18}
                      color={colors.inkMuted}
                      strokeWidth={2}
                    />
                  </Pressable>
                ))}
              </View>

            </ScrollView>
          </MotiView>
        )}

        {stage === 'amount' && pickedMethod && (
          <MotiView
            key="amount"
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0 }}
            style={styles.flex}
          >
            <ScrollView
              contentContainerStyle={styles.amountScroll}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.methodChip}>
                <PaymentLogo brand={pickedMethod.brand} size={22} />
                <Text style={styles.methodChipText}>{pickedMethod.name}</Text>
              </View>

              <View style={styles.amountCenter}>
                <Text style={styles.eyebrow}>you pay</Text>
                <Text style={styles.amountBig}>{formatZmw(zmwNum)}</Text>
                <View style={styles.convertRow}>
                  <ArrowRight
                    size={14}
                    color={colors.inkMuted}
                    strokeWidth={2}
                  />
                  <Text style={styles.convertText}>
                    {formatToken(tokenAmount, token)}{' '}
                    <Text style={styles.convertToken}>{token}</Text>
                  </Text>
                </View>
                <Text style={styles.rateText}>
                  1 {token} = ZMW {rate.toFixed(2)}
                </Text>
              </View>

              <View style={styles.tokenRow}>
                <TokenPill
                  label="USDC"
                  sub="US dollar"
                  active={token === 'USDC'}
                  onPress={() => setToken('USDC')}
                />
                <TokenPill
                  label="EURC"
                  sub="euro"
                  active={token === 'EURC'}
                  onPress={() => setToken('EURC')}
                />
              </View>

              {pickedMethod.input === 'phone' ? (
                <View style={styles.inputBlock}>
                  <Text style={styles.inputLabel}>
                    {pickedMethod.name} phone number
                  </Text>
                  <TextInput
                    value={phone}
                    onChangeText={(t) =>
                      setPhone(formatPhone(t, pickedMethod.countryCode))
                    }
                    placeholder={`${pickedMethod.countryCode} 97 123 4567`}
                    placeholderTextColor="rgba(0,0,0,0.3)"
                    keyboardType="phone-pad"
                    style={styles.textInput}
                  />
                </View>
              ) : (
                <View style={styles.inputBlock}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.inputLabel}>Card details</Text>
                    <Pressable onPress={useTestCard} hitSlop={8}>
                      <Text style={styles.linkText}>use test card</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={cardNumber}
                    onChangeText={(t) => setCardNumber(formatCardNumber(t))}
                    placeholder="4242 4242 4242 4242"
                    placeholderTextColor="rgba(0,0,0,0.3)"
                    keyboardType="number-pad"
                    style={styles.textInput}
                  />
                  <View style={styles.cardRow}>
                    <TextInput
                      value={cardExpiry}
                      onChangeText={(t) =>
                        setCardExpiry(
                          t
                            .replace(/[^0-9]/g, '')
                            .slice(0, 4)
                            .replace(/^(\d{2})(\d{0,2})/, (_m, a, b) =>
                              b ? `${a}/${b}` : a,
                            ),
                        )
                      }
                      placeholder="MM/YY"
                      placeholderTextColor="rgba(0,0,0,0.3)"
                      keyboardType="number-pad"
                      style={[styles.textInput, styles.cardSmall]}
                    />
                    <TextInput
                      value={cardCvv}
                      onChangeText={(t) =>
                        setCardCvv(t.replace(/[^0-9]/g, '').slice(0, 4))
                      }
                      placeholder="CVV"
                      placeholderTextColor="rgba(0,0,0,0.3)"
                      keyboardType="number-pad"
                      style={[styles.textInput, styles.cardSmall]}
                    />
                  </View>
                </View>
              )}

              <Keypad onPress={onKey} />
            </ScrollView>

            <View style={styles.cta}>
              {!amountValid && zmwNum > 0 && (
                <Text style={styles.helperText}>
                  Min {formatZmw(MIN_ZMW)} · Max {formatZmw(MAX_ZMW)} per
                  transaction
                </Text>
              )}
              <Button
                label={canReview ? 'Review' : 'Enter amount & details'}
                onPress={() => canReview && setStage('review')}
                disabled={!canReview}
                size="lg"
                variant="ink"
              />
            </View>
          </MotiView>
        )}

        {stage === 'review' && pickedMethod && (
          <MotiView
            key="review"
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0 }}
            style={styles.flex}
          >
            <ScrollView contentContainerStyle={styles.reviewScroll}>
              <Text style={styles.eyebrow}>review</Text>
              <Text style={styles.bigTitle}>
                You'll receive{' '}
                <Text style={styles.italic}>
                  {formatToken(tokenAmount, token)}
                </Text>
              </Text>

              <View style={styles.reviewCard}>
                <ReviewRow label="You pay" value={formatZmw(zmwNum)} />
                <ReviewRow
                  label="Rate"
                  value={`1 ${token} = ZMW ${rate.toFixed(2)}`}
                />
                <ReviewRow
                  label="You receive"
                  value={`${formatToken(tokenAmount, token)} ${token}`}
                  emphasize
                />
                <View style={styles.divider} />
                <ReviewRow label="Method" value={pickedMethod.name} />
                <ReviewRow
                  label="Account"
                  value={
                    pickedMethod.input === 'phone'
                      ? phone
                      : `•••• ${cardLast4(cardNumber)}`
                  }
                />
                <ReviewRow label="Network" value="Base Sepolia" />
                <ReviewRow label="Provider fee" value="$0.00 · demo" />
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.cta}>
              <Button
                label={`Pay & receive ${formatToken(tokenAmount, token)}`}
                onPress={startProcessing}
                size="lg"
              />
            </View>
          </MotiView>
        )}

        {stage === 'processing' && pickedMethod && (
          <MotiView
            key="processing"
            from={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={styles.processingWrap}
          >
            <MotiView
              from={{ scale: 0.85, opacity: 0.55 }}
              animate={{ scale: 1.05, opacity: 1 }}
              transition={{
                loop: true,
                type: 'timing',
                duration: 1100,
                repeatReverse: true,
              }}
              style={styles.pulse}
            >
              <PaymentLogo brand={pickedMethod.brand} size={96} />
            </MotiView>
            <Text style={styles.processingTitle}>
              {processingTitle(step, pickedMethod.name)}
            </Text>
            <Text style={styles.processingSub}>
              {processingSub(step, token)}
            </Text>

            <View style={styles.stepsList}>
              <StepDot
                done={step !== 'provider'}
                active={step === 'provider'}
                label={`Confirming with ${pickedMethod.name}…`}
              />
              <StepDot
                done={step === 'settled'}
                active={step === 'mint'}
                label={`Minting ${token} on Base Sepolia…`}
              />
              <StepDot
                done={step === 'settled'}
                active={false}
                label="Crediting your wallet"
              />
            </View>
          </MotiView>
        )}

        {stage === 'done' && result && pickedMethod && (
          <MotiView
            key="done"
            from={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            style={styles.doneWrap}
          >
            <View style={styles.checkCircle}>
              <Check size={36} color={colors.cream} strokeWidth={3} />
            </View>
            <Text style={styles.paidTitle}>
              Added via {pickedMethod.name}
            </Text>
            <Text style={styles.paidAmount}>
              {formatToken(parseFloat(result.tokenAmount), result.token)}{' '}
              <Text style={styles.paidToken}>{result.token}</Text>
            </Text>
            <Text style={styles.paidSub}>
              from {formatZmw(result.amountKwacha)}
            </Text>

            <View style={styles.receiptFacts}>
              <Fact
                label="When"
                value={new Date().toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              />
              <Fact
                label="Settled"
                value={
                  result.settledMs ? `${(result.settledMs / 1000).toFixed(1)}s` : '—'
                }
              />
              {result.blockNumber > 0 && (
                <Fact label="Block" value={`#${result.blockNumber}`} />
              )}
            </View>

            <Pressable
              onPress={() =>
                Linking.openURL(`${env.basescanUrl}/tx/${result.txHash}`).catch(
                  () => {},
                )
              }
              hitSlop={8}
              style={styles.basescanRow}
            >
              <Text style={styles.basescanText}>
                tx {result.txHash.slice(0, 6)}…{result.txHash.slice(-4)}
              </Text>
              <ExternalLink
                size={13}
                color={colors.inkMuted}
                strokeWidth={2}
              />
            </Pressable>

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
  onPress,
}: {
  label: string;
  sub: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
        {label}
      </Text>
      <Text style={[styles.pillSub, active && styles.pillSubActive]}>
        {sub}
      </Text>
    </Pressable>
  );
}

function ReviewRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={[styles.reviewValue, emphasize && styles.reviewValueBig]}>
        {value}
      </Text>
    </View>
  );
}

function StepDot({
  done,
  active,
  label,
}: {
  done: boolean;
  active: boolean;
  label: string;
}) {
  return (
    <View style={styles.step}>
      <View
        style={[
          styles.stepDot,
          done && styles.stepDotDone,
          active && styles.stepDotActive,
        ]}
      >
        {done ? (
          <Check size={11} color={colors.ink} strokeWidth={3} />
        ) : active ? (
          <Loader2 size={11} color={colors.ink} strokeWidth={2.5} />
        ) : null}
      </View>
      <Text
        style={[
          styles.stepLabel,
          (done || active) && styles.stepLabelActive,
        ]}
      >
        {label}
      </Text>
    </View>
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

function headerTitle(stage: Stage): string {
  switch (stage) {
    case 'method':
      return 'Add cash';
    case 'amount':
      return 'Amount';
    case 'review':
      return 'Review';
    case 'processing':
      return 'Processing';
    case 'done':
      return 'Receipt';
  }
}

function processingTitle(step: ProcessingStep, name: string): string {
  switch (step) {
    case 'provider':
      return `Processing payment with ${name}…`;
    case 'mint':
      return 'Minting on Base Sepolia…';
    case 'settled':
      return 'Just landed.';
  }
}

function processingSub(step: ProcessingStep, token: OnrampToken): string {
  switch (step) {
    case 'provider':
      return 'Confirming the Kwacha leg with the provider.';
    case 'mint':
      return `Broadcasting your ${token} mint to the network.`;
    case 'settled':
      return 'Your wallet has been credited.';
  }
}

function friendlyError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('insufficient funds')) {
    return 'Admin wallet is low on Sepolia ETH. Top it up from coinbase.com/faucets.';
  }
  if (lower.includes('rate drift')) {
    return 'Conversion rate has changed — please reopen the screen.';
  }
  if (lower.includes('phone')) return 'Phone number doesn’t look right.';
  if (lower.includes('cardlast4')) return 'Card details look incomplete.';
  if (lower.includes('amountkwacha')) {
    return `Amount must be between ${MIN_ZMW} and ${MAX_ZMW} ZMW.`;
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontFamily: fonts.bodySemibold,
    color: colors.ink,
    fontSize: 15,
  },

  eyebrow: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  bigTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 28,
    letterSpacing: -0.5,
    marginTop: 6,
  },
  italic: { fontFamily: fonts.bodySemibold, fontWeight: '700', color: colors.ink },
  subtle: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 19,
  },

  // method picker
  methodScroll: {
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: 32,
    gap: 4,
  },
  methodList: { marginTop: 24, gap: 10 },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F4F4F4',
    padding: 16,
    borderRadius: radii.xl,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodEmoji: { fontSize: 22 },
  methodCopy: { flex: 1 },
  methodName: {
    fontFamily: fonts.bodySemibold,
    color: colors.ink,
    fontSize: 15,
  },
  methodSub: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 11,
    marginTop: 3,
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.mint,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  demoText: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 11 },

  // amount stage
  amountScroll: {
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: 12,
    gap: 16,
  },
  methodChip: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  methodChipIcon: { fontSize: 14 },
  methodChipText: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 12,
  },
  amountCenter: { alignItems: 'center', gap: 6, marginTop: 4 },
  amountBig: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 44,
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  convertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  convertText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 20,
  },
  convertToken: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 12,
    letterSpacing: 1,
  },
  rateText: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 11,
  },
  tokenRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: radii.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 2,
  },
  pillActive: { backgroundColor: colors.ink },
  pillLabel: {
    fontFamily: fonts.bodySemibold,
    color: colors.ink,
    fontSize: 14,
  },
  pillLabelActive: { color: colors.cream },
  pillSub: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 10 },
  pillSubActive: { color: 'rgba(255,255,255,0.7)' },

  inputBlock: { gap: 8 },
  inputLabel: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    fontFamily: fonts.mono,
    color: colors.sky,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  textInput: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 14, default: 10 }),
    fontFamily: fonts.mono,
    color: colors.ink,
    fontSize: 14,
  },
  cardRow: { flexDirection: 'row', gap: 8 },
  cardSmall: { flex: 1 },

  helperText: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 11,
    textAlign: 'center',
  },

  cta: {
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 8,
  },

  // review
  reviewScroll: {
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: 16,
    gap: 16,
  },
  reviewCard: {
    backgroundColor: '#F4F4F4',
    borderRadius: radii.xl,
    padding: 18,
    gap: 12,
    marginTop: 12,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewLabel: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 13 },
  reviewValue: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 14 },
  reviewValueBig: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 2,
  },
  errorBox: {
    backgroundColor: 'rgba(255,90,44,0.12)',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { fontFamily: fonts.body, color: colors.sunDeep, fontSize: 12 },

  // processing
  processingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenPaddingX,
    gap: 8,
  },
  pulse: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pulseEmoji: { fontSize: 48 },
  processingTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  processingSub: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
  },
  stepsList: { marginTop: 28, gap: 12, alignSelf: 'stretch' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  stepDotActive: { backgroundColor: colors.sunSoft, borderColor: colors.sun },
  stepDotDone: { backgroundColor: colors.mint, borderColor: colors.ink },
  stepLabel: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 13,
  },
  stepLabelActive: { color: colors.ink, fontFamily: fonts.bodyMedium },

  // done
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenPaddingX,
  },
  checkCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  paidTitle: {
    fontFamily: fonts.bodySemibold,
    color: colors.ink,
    fontSize: 16,
    marginBottom: 4,
  },
  paidAmount: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 48,
    letterSpacing: -1.5,
  },
  paidToken: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 22,
    letterSpacing: 1,
  },
  paidSub: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 6,
  },
  receiptFacts: { flexDirection: 'row', gap: 24, marginTop: 24 },
  factCol: { alignItems: 'center', gap: 2 },
  factLabel: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  factValue: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 13,
  },
  basescanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 20,
  },
  basescanText: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 11,
  },
  doneCta: { marginTop: 36, alignSelf: 'stretch' },
});
