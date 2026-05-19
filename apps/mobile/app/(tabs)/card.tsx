import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  Snowflake,
  Eye,
  EyeOff,
  Wifi,
  Edit3,
  Check,
  ChevronRight,
} from 'lucide-react-native';

import { CardMockup } from '@/components/sections/card-mockup';
import { CardPressRing } from '@/components/sections/card-press-ring';
import { ActivityRow } from '@/components/sections/activity-row';
import { CurrencyLogo, type CurrencyCode } from '@/components/ui/currency-logo';
import { useMe } from '@/hooks/use-me';
import { useTransactions } from '@/hooks/use-transactions';
import { api } from '@/lib/api';
import { deriveCard, formatCardName, maskCardNumber } from '@/lib/card';
import { log } from '@/lib/log';
import { isMerchantAddress } from '@/lib/merchants';
import { qk } from '@/lib/query';
import { mapApiTx } from '@/lib/tx-mapper';
import { colors, fonts, layout, radii } from '@/constants/theme';

const REVEAL_TIMEOUT_MS = 30_000;
const CASHBACK_MONTH = 24.18;
const CASHBACK_CAP = 37.8;

type CardCurrency = CurrencyCode;

export default function Card() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const txs = useTransactions(40);

  const [currency, setCurrency] = useState<CardCurrency>('USDC');
  const [frozen, setFrozen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  const card = useMemo(
    () => (me.data ? deriveCard(me.data.walletAddress) : null),
    [me.data],
  );
  const holder = formatCardName(me.data?.displayName ?? null);

  const cardTxs = useMemo(() => {
    const items = txs.data?.pages.flatMap((p) => p.items) ?? [];
    return items
      .filter((t) => {
        const cp = t.counterparty;
        const addr =
          cp.kind === 'EXTERNAL' || cp.kind === 'USER' ? cp.address : null;
        return isMerchantAddress(addr) || t.memo?.startsWith('Card · ');
      })
      .map(mapApiTx)
      .slice(0, 6);
  }, [txs.data]);

  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setRevealed(false), REVEAL_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [revealed]);

  const openPay = async () => {
    if (frozen) {
      Alert.alert('Card frozen', 'Unfreeze the card to make a payment.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/card-pay');
  };

  const onLongPressStart = () => {
    if (frozen) return;
    setPressing(true);
    Haptics.selectionAsync().catch(() => {});
  };
  const onLongPressEnd = () => setPressing(false);

  const onReveal = async () => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    const has = await LocalAuthentication.hasHardwareAsync();
    const enr = has ? await LocalAuthentication.isEnrolledAsync() : false;
    if (has && enr) {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Show card details',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (!r.success) return;
    }
    setRevealed(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const onFreezeToggle = () => {
    setFrozen((f) => !f);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const startEditName = () => {
    setNameDraft(me.data?.displayName ?? '');
    setNameEditing(true);
  };

  const saveName = async () => {
    const next = nameDraft.trim().slice(0, 32);
    if (!next || next === me.data?.displayName) {
      setNameEditing(false);
      return;
    }
    setNameSaving(true);
    try {
      await api.patch('/me', { displayName: next });
      await qc.invalidateQueries({ queryKey: qk.me });
      log.info('card.name', `Set holder name → ${next}`);
      setNameEditing(false);
    } catch (e) {
      Alert.alert('Couldn’t save', (e as Error).message);
      log.error('card.name', `Save failed: ${(e as Error).message}`);
    } finally {
      setNameSaving(false);
    }
  };

  const pickCurrency = (next: CardCurrency) => {
    if (next === currency) return;
    Haptics.selectionAsync().catch(() => {});
    setCurrency(next);
  };

  const pct = Math.min(100, (CASHBACK_MONTH / CASHBACK_CAP) * 100);
  const nameDisplayMissing = !me.data?.displayName;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Card</Text>
          {frozen && (
            <View style={styles.frozenChip}>
              <Snowflake size={11} color={colors.ink} strokeWidth={2.2} />
              <Text style={styles.frozenText}>Frozen</Text>
            </View>
          )}
        </View>

        {/* Wallet picker — which Kite balance funds the next swipe */}
        <View style={styles.walletPicker}>
          <Text style={styles.walletPickerLabel}>Pays with</Text>
          <View style={styles.segmented}>
            {(['USDC', 'EURC'] as const).map((code) => {
              const active = currency === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => pickCurrency(code)}
                  style={[styles.segment, active && styles.segmentActive]}
                  hitSlop={6}
                >
                  <CurrencyLogo code={code} size={22} />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.cardWrap}>
          <Pressable
            onPress={openPay}
            onLongPress={openPay}
            delayLongPress={1100}
            onPressIn={onLongPressStart}
            onPressOut={onLongPressEnd}
            disabled={!me.data}
            style={{ width: '100%' }}
          >
            <View style={{ width: '100%', position: 'relative' }}>
              <CardMockup
                last4={card?.last4 ?? '0000'}
                holder={holder}
                revealed={revealed}
                fullNumber={card?.number}
                expiry={card?.expiry}
                cvv={card?.cvv}
                currency={currency}
              />
              <CardPressRing active={pressing} />
            </View>
          </Pressable>
          <Text style={styles.payHint}>
            press &amp; hold the card · or tap to pay
          </Text>
        </View>

        {/* Cardholder name */}
        <Pressable
          onPress={nameEditing ? undefined : startEditName}
          style={styles.nameBlock}
        >
          {nameEditing ? (
            <View style={styles.nameEditRow}>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Name on card"
                placeholderTextColor={colors.inkMuted}
                autoFocus
                autoCapitalize="words"
                style={styles.nameInput}
                maxLength={32}
              />
              <Pressable
                onPress={saveName}
                disabled={nameSaving}
                style={styles.nameSaveBtn}
                hitSlop={6}
              >
                {nameSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Check size={14} color="#FFFFFF" strokeWidth={2.4} />
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nameLabel}>Name on card</Text>
                <Text
                  style={[
                    styles.nameValue,
                    nameDisplayMissing && styles.nameValueMissing,
                  ]}
                >
                  {nameDisplayMissing ? 'Tap to add your name' : holder}
                </Text>
              </View>
              <Edit3 size={14} color={colors.inkMuted} strokeWidth={2} />
            </View>
          )}
        </Pressable>

        {/* Controls */}
        <View style={styles.controlsRow}>
          <Control
            icon={<Snowflake size={20} color={colors.ink} strokeWidth={2} />}
            label={frozen ? 'Unfreeze' : 'Freeze'}
            active={frozen}
            onPress={onFreezeToggle}
          />
          <Control
            icon={
              revealed ? (
                <EyeOff size={20} color={colors.ink} strokeWidth={2} />
              ) : (
                <Eye size={20} color={colors.ink} strokeWidth={2} />
              )
            }
            label={revealed ? 'Hide details' : 'Show details'}
            onPress={onReveal}
          />
          <Control
            icon={<Wifi size={20} color={colors.ink} strokeWidth={2} />}
            label="Tap to pay"
            onPress={openPay}
          />
        </View>

        {/* Cashback */}
        <View style={styles.cashback}>
          <View style={styles.cashbackHead}>
            <Text style={styles.cashbackLabel}>Cashback this month</Text>
            <Text style={styles.cashbackAmount}>
              ${CASHBACK_MONTH.toFixed(2)}
            </Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
          <View style={styles.cashbackFoot}>
            <Text style={styles.cashbackHint}>4% back on every swipe</Text>
            <Text style={styles.cashbackHint}>${CASHBACK_CAP.toFixed(2)} cap</Text>
          </View>
        </View>

        {/* Upgrade CTA */}
        <Pressable style={styles.physicalCta}>
          <View style={{ flex: 1 }}>
            <Text style={styles.physicalEyebrow}>UPGRADE</Text>
            <Text style={styles.physicalTitle}>Get the metal card</Text>
            <Text style={styles.physicalBody}>
              60-second ID check unlocks the physical card and higher limits.
            </Text>
          </View>
          <ChevronRight size={18} color="#FFFFFF" strokeWidth={2} />
        </Pressable>

        {/* Recent card transactions */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <Text style={styles.sectionHint}>card only</Text>
        </View>
        <View style={styles.txList}>
          {cardTxs.length === 0 ? (
            <Text style={styles.emptyText}>
              No card payments yet. Press &amp; hold the card to make one.
            </Text>
          ) : (
            cardTxs.map((tx) => (
              <ActivityRow
                key={tx.id}
                tx={tx}
                onPress={() => router.push(`/tx/${tx.id}`)}
              />
            ))
          )}
        </View>

        <Text style={styles.footnote}>
          Spend anywhere Visa works. {currency} debited at the moment of swipe.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Control({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        pressed && styles.controlPressed,
        active && styles.controlActive,
      ]}
    >
      <View style={[styles.controlIcon, active && styles.controlIconActive]}>
        {icon}
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const SURFACE       = '#F5F5F5'; // subtle gray surface
const SURFACE_HOVER = '#EBEBEB';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: { paddingHorizontal: layout.screenPaddingX, paddingBottom: 120 },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  title: {
    fontFamily: fonts.bodySemibold,
    color: colors.ink,
    fontSize: 32,
    letterSpacing: -1,
  },
  frozenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  frozenText: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 12,
  },

  /* Wallet picker */
  walletPicker: { marginTop: 20, gap: 8 },
  walletPickerLabel: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 13,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: 10,
  },
  segmentActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  segmentText: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
    fontSize: 14,
  },
  segmentTextActive: { color: colors.ink, fontFamily: fonts.bodySemibold },

  /* Card */
  cardWrap: { marginTop: 18, gap: 10 },
  payHint: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 1.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  /* Card details panel */
  detailsPanel: {
    marginTop: 16,
    backgroundColor: SURFACE,
    borderRadius: radii.xl,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailsTitle: {
    fontFamily: fonts.bodySemibold,
    color: colors.ink,
    fontSize: 14,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  detailsToggleText: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
    fontSize: 11,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  detailRowLabel: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 13,
  },
  detailRowValue: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 13,
  },
  detailRowValueMono: { fontFamily: fonts.mono, fontSize: 12 },

  /* Name */
  nameBlock: {
    marginTop: 12,
    backgroundColor: SURFACE,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameLabel: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 12,
  },
  nameValue: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 15, marginTop: 2 },
  nameValueMissing: { color: colors.inkMuted, fontStyle: 'italic' },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 15,
    padding: 0,
  },
  nameSaveBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Controls */
  controlsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  control: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    gap: 8,
  },
  controlPressed: { opacity: 0.65 },
  controlActive: {},
  controlIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: SURFACE,
  },
  controlIconActive: { backgroundColor: '#E0EAFF' },
  controlLabel: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 12 },

  /* Cashback */
  cashback: {
    marginTop: 24,
    backgroundColor: SURFACE,
    borderRadius: radii.xl,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cashbackHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cashbackLabel: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 13 },
  cashbackAmount: {
    fontFamily: fonts.bodySemibold,
    color: colors.ink,
    fontSize: 16,
  },
  barTrack: {
    marginTop: 10,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.ink, borderRadius: 3 },
  cashbackFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cashbackHint: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 11 },

  /* Physical / metal upgrade */
  physicalCta: {
    marginTop: 16,
    backgroundColor: colors.ink,
    borderRadius: radii.xl,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  physicalEyebrow: {
    fontFamily: fonts.mono,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    letterSpacing: 1.6,
  },
  physicalTitle: { fontFamily: fonts.bodySemibold, color: '#FFFFFF', fontSize: 17, marginTop: 4 },
  physicalBody: { fontFamily: fonts.body, color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4, lineHeight: 17 },

  /* Section header */
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 10,
  },
  sectionTitle: { fontFamily: fonts.bodySemibold, color: colors.ink, fontSize: 18 },
  sectionHint: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 12 },
  txList: { gap: 8 },
  emptyText: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  footnote: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 11, textAlign: 'center', marginTop: 20, paddingHorizontal: 24 },
});

// Suppress unused-variable lint on the hover constant; reserved for future
// pressed-state styling.
void SURFACE_HOVER;
