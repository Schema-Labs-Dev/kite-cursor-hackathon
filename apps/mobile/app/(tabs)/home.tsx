import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Settings, ChevronRight, ArrowDownUp } from 'lucide-react-native';

import { Avatar } from '@/components/ui/avatar';
import { BalanceCard } from '@/components/sections/balance-card';
import { QuickActions } from '@/components/sections/quick-actions';
import { ActivityRow } from '@/components/sections/activity-row';
import { EarningsChart } from '@/components/sections/earnings-chart';
import { CurrencyLogo, type CurrencyCode } from '@/components/ui/currency-logo';
import { useMe } from '@/hooks/use-me';
import { useBalance, useTreasuryInfo } from '@/hooks/use-treasury';
import { useTransactions } from '@/hooks/use-transactions';
import { mapApiTx } from '@/lib/tx-mapper';
import { colors, fonts, layout } from '@/constants/theme';
import { currencies } from '@/constants/mock-data';

export default function Home() {
  const router = useRouter();
  const me = useMe();
  const info = useTreasuryInfo();
  const balance = useBalance(me.data?.walletAddress);
  const txs = useTransactions(20);

  const greeting = greetingFor(new Date());
  const initial = (me.data?.displayName ?? me.data?.walletAddress?.slice(2, 3) ?? '?')[0]!.toLowerCase();
  const handle = displayHandle(me.data);
  const usdcInTreasury = parseFloat(balance.data?.treasury.usdc.total.formatted ?? '0');
  const eurcInTreasury = parseFloat(balance.data?.treasury.eurc.total.formatted ?? '0');
  const walletUsdc = parseFloat(balance.data?.walletUsdc.formatted ?? '0');
  const walletEurc = parseFloat(balance.data?.walletEurc.formatted ?? '0');
  // Headline total = everything the user owns inside Kite.
  // EURC is counted 1:1 against USD — matches the Uniswap pool we seed at
  // 1:1, so the figure equals what they could realistically withdraw via
  // Convert. Production swaps to a price-oracle quote.
  const totalUsd =
    walletUsdc + walletEurc + usdcInTreasury + eurcInTreasury;
  const apyPercent = info.data ? info.data.apy.decimal * 100 : 0;
  const yieldLive =
    parseFloat(balance.data?.treasury.usdc.accruedYield.formatted ?? '0') +
    parseFloat(balance.data?.treasury.eurc.accruedYield.formatted ?? '0');

  const recent = useMemo(() => {
    const items = txs.data?.pages.flatMap((p) => p.items) ?? [];
    return items.slice(0, 4).map(mapApiTx);
  }, [txs.data]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar seed={me.data?.walletAddress ?? null} size="md" />
            <View>
              <Text style={styles.greeting}>{greeting},</Text>
              <Text style={styles.handle}>{handle}</Text>
            </View>
          </View>
          <Pressable style={styles.iconBtn} hitSlop={10}>
            <Settings size={18} color={colors.ink} strokeWidth={1.8} />
          </Pressable>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500 }}
          style={styles.balanceWrap}
        >
          <BalanceCard balance={totalUsd} apy={apyPercent} yieldToday={yieldLive} />
        </MotiView>

        <View style={styles.actions}>
          <QuickActions
            onAdd={() => router.push('/onramp')}
            onSend={() => router.push('/send')}
            onReceive={() => router.push('/receive')}
            onCard={() => router.push('/(tabs)/card')}
          />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Money in motion</Text>
        </View>
        <EarningsChart
          earned={yieldLive}
          apyPercent={apyPercent}
          principal={totalUsd}
        />

        <View style={styles.yieldCtaRow}>
          <Pressable
            onPress={() => router.push('/treasury?kind=deposit')}
            style={({ pressed }) => [styles.yieldCta, styles.yieldCtaPrimary, pressed && styles.pressed]}
          >
            <Text style={styles.yieldCtaPrimaryText}>Earn Interest</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/treasury?kind=withdraw')}
            style={({ pressed }) => [styles.yieldCta, styles.yieldCtaGhost, pressed && styles.pressed]}
            disabled={totalUsd <= 0}
          >
            <Text
              style={[
                styles.yieldCtaGhostText,
                totalUsd <= 0 && styles.yieldCtaGhostTextDisabled,
              ]}
            >
              Withdraw
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Wallets</Text>
          <Pressable onPress={() => router.push('/convert')} hitSlop={10}>
            <View style={styles.convertLink}>
              <ArrowDownUp size={13} color={colors.inkMuted} strokeWidth={2} />
              <Text style={styles.convertLinkText}>convert</Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.wallets}>
          {currencies.map((c) => {
            const shownBalance = c.code === 'USDC' ? walletUsdc : walletEurc;
            const symbol = c.code === 'USDC' ? '$' : '€';
            return (
              <Pressable
                key={c.code}
                style={({ pressed }) => [styles.wallet, pressed && styles.pressed]}
              >
                <CurrencyLogo code={c.code as CurrencyCode} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.walletName}>{c.label}</Text>
                  <Text style={styles.walletCode}>{c.code}</Text>
                </View>
                <Text style={styles.walletBal}>
                  {symbol}
                  {shownBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <Pressable onPress={() => router.push('/(tabs)/activity')} hitSlop={10}>
            <View style={styles.seeAll}>
              <Text style={styles.seeAllText}>see all</Text>
              <ChevronRight size={14} color={colors.inkMuted} strokeWidth={2} />
            </View>
          </Pressable>
        </View>
        <View style={styles.activity}>
          {txs.isLoading ? (
            <View style={styles.activityState}>
              <ActivityIndicator color={colors.inkMuted} />
            </View>
          ) : recent.length === 0 ? (
            <View style={styles.activityState}>
              <Text style={styles.activityEmpty}>
                Your first send shows up here.
              </Text>
            </View>
          ) : (
            recent.map((tx) => (
              <ActivityRow
                key={tx.id}
                tx={tx}
                onPress={() => router.push(`/tx/${tx.id}`)}
              />
            ))
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            <Text style={styles.italic}>Pull the string.</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'good morning';
  if (h < 18) return 'good afternoon';
  return 'good evening';
}

/** Compute a percentage-width string for the route bar. Caps at 100% and
 *  hands back a small visual minimum (4%) for non-zero positions so the
 *  bar reads as "present, just tiny." */
function shareWidth(part: number, total: number): `${number}%` {
  if (part <= 0 || total <= 0) return '0%';
  const pct = Math.min(100, Math.max(4, (part / total) * 100));
  return `${pct}%`;
}

function displayHandle(me: ReturnType<typeof useMe>['data']): string {
  if (!me) return '…';
  if (me.basename) return me.basename.split('.')[0]!;
  if (me.displayName) return me.displayName;
  const a = me.walletAddress;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: { paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greeting: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 11,
  },
  handle: {
    fontFamily: fonts.bodySemibold,
    color: colors.ink,
    fontSize: 15,
    marginTop: 1,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  balanceWrap: { paddingHorizontal: layout.screenPaddingX },
  actions: {
    paddingHorizontal: layout.screenPaddingX,
    marginTop: 16,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    marginTop: 28,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 20,
    letterSpacing: -0.4,
  },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 12 },
  convertLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  convertLinkText: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'lowercase',
  },
  routesTile: {
    marginHorizontal: layout.screenPaddingX,
    gap: 12,
  },
  yieldCtaRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: layout.screenPaddingX,
    marginTop: 10,
  },
  yieldCta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 999,
  },
  yieldCtaPrimary: { backgroundColor: colors.ink },
  yieldCtaPrimaryText: { fontFamily: fonts.bodyMedium, color: colors.cream, fontSize: 13 },
  yieldCtaGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  yieldCtaGhostText: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13 },
  yieldCtaGhostTextDisabled: { opacity: 0.4 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeMain: { flex: 1, gap: 6 },
  routeName: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13 },
  barTrack: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.sky, borderRadius: 2 },
  routeRight: { alignItems: 'flex-end' },
  routeApy: { fontFamily: fonts.monoMedium, color: colors.ink, fontSize: 12 },
  routeShare: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 10, marginTop: 2 },
  wallets: { paddingHorizontal: layout.screenPaddingX, gap: 8 },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F4F4F4',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  pressed: { opacity: 0.85 },
  flag: { fontSize: 24 },
  walletNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletName: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 14 },
  walletCode: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 11, marginTop: 2 },
  walletBal: { fontFamily: fonts.monoMedium, color: colors.ink, fontSize: 14 },
  activity: { paddingHorizontal: layout.screenPaddingX, gap: 8 },
  activityState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  activityEmpty: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 13,
  },
  footer: { alignItems: 'center', marginTop: 36 },
  footerText: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 13 },
  italic: { fontFamily: fonts.displayItalic, color: colors.sun, fontSize: 16 },
});
