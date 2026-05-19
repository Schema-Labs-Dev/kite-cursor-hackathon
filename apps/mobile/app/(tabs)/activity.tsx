import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityRow } from '@/components/sections/activity-row';
import { useTransactions } from '@/hooks/use-transactions';
import { mapApiTx } from '@/lib/tx-mapper';
import { colors, fonts, layout, radii } from '@/constants/theme';
import { type Transaction } from '@/constants/mock-data';

type Filter = 'all' | 'in' | 'out';

function dayKey(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yest)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export default function Activity() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactions(20);

  const realTxs: Transaction[] = useMemo(() => {
    const items = data?.pages.flatMap((p) => p.items) ?? [];
    return items.map(mapApiTx);
  }, [data]);

  const filtered = useMemo(() => {
    if (filter === 'in') return realTxs.filter((t) => t.amount > 0);
    if (filter === 'out') return realTxs.filter((t) => t.amount < 0);
    return realTxs;
  }, [filter, realTxs]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const k = dayKey(t.timestamp);
      const arr = map.get(k) ?? [];
      arr.push(t);
      map.set(k, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const { totalIn, totalOut } = useMemo(() => {
    const now = new Date();
    let inSum = 0;
    let outSum = 0;
    for (const t of realTxs) {
      const d = new Date(t.timestamp);
      if (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      ) {
        if (t.amount > 0) inSum += t.amount;
        else outSum += Math.abs(t.amount);
      }
    }
    return { totalIn: inSum, totalOut: outSum };
  }, [realTxs]);

  const showEmpty = !isLoading && groups.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor={colors.ink}
          />
        }
      >
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>
          every send, every receive, every block of interest
        </Text>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>in · this month</Text>
            <Text style={styles.statValue}>+${totalIn.toFixed(2)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>out · this month</Text>
            <Text style={styles.statValueOut}>-${totalOut.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.filters}>
          {(['all', 'in', 'out'] as Filter[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filter, filter === f && styles.filterActive]}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'All' : f === 'in' ? 'Received' : 'Sent'}
              </Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.skeletonWrap}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonRow} />
            ))}
          </View>
        ) : showEmpty ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing yet</Text>
            <Text style={styles.emptyBody}>
              Send your first dollar — every block of interest lands here.
            </Text>
          </View>
        ) : (
          groups.map(([day, txs]) => (
            <View key={day} style={styles.group}>
              <Text style={styles.dayLabel}>{day}</Text>
              <View style={styles.dayList}>
                {txs.map((tx) => (
                  <ActivityRow
                    key={tx.id}
                    tx={tx}
                    onPress={() => router.push(`/tx/${tx.id}`)}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        {hasNextPage && (
          <Pressable
            onPress={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            style={({ pressed }) => [
              styles.loadMore,
              pressed && { opacity: 0.85 },
              isFetchingNextPage && { opacity: 0.6 },
            ]}
          >
            {isFetchingNextPage ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <Text style={styles.loadMoreText}>Load more</Text>
            )}
          </Pressable>
        )}

        <Text style={styles.footnote}>
          Every transaction settles onchain. Tap to see proof on BaseScan.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: { paddingHorizontal: layout.screenPaddingX, paddingBottom: 120 },
  title: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 36,
    letterSpacing: -1,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statCard: {
    flex: 1,
    backgroundColor: '#F4F4F4',
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statLabel: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  statValue: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 22,
    marginTop: 6,
    letterSpacing: -0.5,
  },
  statValueOut: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 22,
    marginTop: 6,
    letterSpacing: -0.5,
  },
  filters: { flexDirection: 'row', gap: 6, marginTop: 18 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  filterActive: { backgroundColor: colors.ink },
  filterText: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 12 },
  filterTextActive: { color: colors.cream },
  group: { marginTop: 22 },
  dayLabel: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  dayList: { gap: 8 },
  skeletonWrap: { marginTop: 22, gap: 8 },
  skeletonRow: {
    height: 60,
    backgroundColor: '#F4F4F4',
    borderRadius: radii.lg,
  },
  emptyState: {
    marginTop: 36,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  emptyBody: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  loadMore: {
    marginTop: 18,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.05)',
    minWidth: 120,
    alignItems: 'center',
  },
  loadMoreText: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 12 },
  footnote: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
  },
});
