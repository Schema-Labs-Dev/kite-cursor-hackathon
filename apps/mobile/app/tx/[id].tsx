import { View, Text, StyleSheet, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { X, ExternalLink, Copy, ArrowUpRight, ArrowDownLeft, Sparkles, CreditCard, Plus } from 'lucide-react-native';

import { PreviewBadge } from '@/components/ui/preview-badge';
import { useTransaction } from '@/hooks/use-transaction';
import { mapApiTx } from '@/lib/tx-mapper';
import { env } from '@/lib/env';
import { colors, fonts, layout, radii } from '@/constants/theme';
import { transactions as mockTxs, type Transaction } from '@/constants/mock-data';

function iconFor(kind: Transaction['kind']) {
  switch (kind) {
    case 'send':     return { Icon: ArrowUpRight,  bg: 'rgba(0,0,0,0.08)', fg: colors.ink, label: 'Sent' };
    case 'receive':  return { Icon: ArrowDownLeft, bg: colors.mint,            fg: colors.ink, label: 'Received' };
    case 'interest': return { Icon: Sparkles,      bg: colors.mint,            fg: colors.ink, label: 'Interest' };
    case 'card':     return { Icon: CreditCard,    bg: 'rgba(0,0,0,0.08)', fg: colors.ink, label: 'Card purchase' };
    case 'add':      return { Icon: Plus,          bg: colors.mint,            fg: colors.ink, label: 'Added cash' };
  }
}

export default function TxDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const mockHit = mockTxs.find((t) => t.id === id);
  const isPreview = Boolean(mockHit);

  // Only hit the API/cache when this isn't a mock preview row.
  const remote = useTransaction(isPreview ? undefined : id);

  const tx: Transaction | null = mockHit ?? (remote.data ? mapApiTx(remote.data) : null);
  const loading = !mockHit && remote.isLoading;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.empty}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tx) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Transaction not found.</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const meta = iconFor(tx.kind);
  const isCredit = tx.amount > 0;
  const date = new Date(tx.timestamp);

  const onCopy = async () => {
    await Clipboard.setStringAsync(tx.txHash);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const onView = () => Linking.openURL(`${env.basescanUrl}/tx/${tx.txHash}`).catch(() => {});

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <X size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{meta.label}</Text>
          {isPreview && <PreviewBadge />}
        </View>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroIcon}>
          <View style={[styles.iconCircle, { backgroundColor: meta.bg }]}>
            <meta.Icon size={26} color={meta.fg} strokeWidth={2} />
          </View>
        </View>

        <Text style={styles.amount}>
          {isCredit ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
        </Text>
        <Text style={styles.who}>{tx.counterparty}</Text>
        <Text style={styles.note}>{tx.note || tx.category || ''}</Text>

        <View style={styles.facts}>
          <Fact label="When" value={date.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })} />
          <Fact label="Network" value="Base · Sepolia" />
          <Fact label="Asset" value="USDC" />
          <Fact label="Network fee" value="$0.00 · sponsored" />
          {tx.cashback ? <Fact label="Cashback" value={`+$${tx.cashback.toFixed(2)}`} /> : null}
        </View>

        <Pressable style={({ pressed }) => [styles.hashRow, pressed && styles.pressed]} onPress={onCopy}>
          <View style={{ flex: 1 }}>
            <Text style={styles.factLabel}>Transaction hash</Text>
            <Text style={styles.hash} numberOfLines={1} ellipsizeMode="middle">
              {tx.txHash}
            </Text>
          </View>
          <Copy size={16} color={colors.inkMuted} strokeWidth={2} />
        </Pressable>

        {!isPreview && (
          <Pressable onPress={onView} style={({ pressed }) => [styles.viewBtn, pressed && styles.viewPressed]}>
            <Text style={styles.viewText}>View on BaseScan</Text>
            <ExternalLink size={15} color={colors.cream} strokeWidth={2} />
          </Pressable>
        )}

        <Text style={styles.footnote}>
          {isPreview
            ? 'This is a sample transaction — preview only. Card and cashback ship soon.'
            : 'Every Kite transaction is a real, public, onchain receipt.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: 12,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: { fontFamily: fonts.bodySemibold, color: colors.ink, fontSize: 15 },
  scroll: { paddingHorizontal: layout.screenPaddingX, paddingBottom: 32 },
  heroIcon: { alignItems: 'center', marginTop: 20 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  amount: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 56,
    letterSpacing: -1.5,
    textAlign: 'center',
    marginTop: 18,
  },
  who: { fontFamily: fonts.bodySemibold, color: colors.ink, fontSize: 16, textAlign: 'center', marginTop: 4 },
  note: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 13, textAlign: 'center', marginTop: 2 },
  facts: { marginTop: 28, gap: 4 },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F4F4F4',
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: radii.md,
  },
  factLabel: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 12 },
  factValue: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13 },
  hashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F4F4F4',
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: radii.md,
    marginTop: 4,
  },
  pressed: { backgroundColor: '#EBEBEB' },
  hash: { fontFamily: fonts.mono, color: colors.ink, fontSize: 11, marginTop: 2 },
  viewBtn: {
    marginTop: 20,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  viewPressed: { opacity: 0.85 },
  viewText: { fontFamily: fonts.bodyMedium, color: colors.cream, fontSize: 14 },
  footnote: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 11, textAlign: 'center', marginTop: 18, paddingHorizontal: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: fonts.body, color: colors.ink, fontSize: 14 },
  link: { fontFamily: fonts.bodyMedium, color: colors.sun, fontSize: 14 },
});
