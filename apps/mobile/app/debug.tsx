import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react-native';

import { useMe } from '@/hooks/use-me';
import { useTreasuryInfo, useBalance } from '@/hooks/use-treasury';
import { useTransactions } from '@/hooks/use-transactions';
import { getToken, setToken } from '@/lib/auth-storage';
import { env } from '@/lib/env';
import { signOut } from '@/lib/auth';
import { clearEntries, useLogEntries, type LogEntry } from '@/lib/log';
import { colors, fonts, layout, radii } from '@/constants/theme';

/**
 * Step 1 verification harness. Paste a JWT (cut from a curl call against
 * /auth/verify) and watch the four hooks light up. When Step 2 lands the
 * real wallet bridge, this screen becomes redundant.
 */
export default function Debug() {
  const router = useRouter();
  const qc = useQueryClient();
  const [pasted, setPasted] = useState('');
  const [stored, setStored] = useState<string | null>(null);

  const me = useMe();
  const info = useTreasuryInfo();
  const balance = useBalance(me.data?.walletAddress);
  const txs = useTransactions(5);

  useEffect(() => {
    getToken().then(setStored);
  }, []);

  const saveToken = async () => {
    const trimmed = pasted.trim();
    if (!trimmed) return;
    await setToken(trimmed);
    setStored(trimmed);
    setPasted('');
    qc.invalidateQueries();
  };

  const wipeToken = async () => {
    // wipeWallet: true also deletes the on-device signer key from Keychain so
    // the next sign-in mints a fresh smart account address (otherwise iOS
    // Keychain survives JWT-only clear and we keep re-using the same EOA).
    await signOut({ wipeWallet: true });
    setStored(null);
    qc.invalidateQueries();
  };

  const txItems = txs.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug</Text>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <X size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Block label="API URL" value={env.apiUrl} />
        <Block
          label="Wallet mode"
          value={
            env.cdpRpcUrl
              ? 'smart account · sponsored gas via CDP'
              : 'plain EOA · user pays gas (set EXPO_PUBLIC_CDP_RPC_URL to enable sponsorship)'
          }
        />
        <Block
          label="Stored JWT"
          value={stored ? `${stored.slice(0, 12)}…${stored.slice(-8)}` : '(none)'}
        />

        <Text style={styles.sectionLabel}>Paste JWT</Text>
        <TextInput
          value={pasted}
          onChangeText={setPasted}
          placeholder="eyJhbGciOi…"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          style={styles.input}
        />
        <View style={styles.row}>
          <Pressable onPress={saveToken} style={[styles.btn, styles.btnInk]}>
            <Text style={styles.btnInkText}>Save & refetch</Text>
          </Pressable>
          <Pressable onPress={wipeToken} style={[styles.btn, styles.btnGhost]}>
            <Text style={styles.btnGhostText}>Clear</Text>
          </Pressable>
        </View>

        <Section
          title="useMe()"
          state={hookState(me)}
          json={me.data ?? me.error}
        />
        <Section
          title="useTreasuryInfo()"
          state={hookState(info)}
          json={info.data ?? info.error}
        />
        <Section
          title="useBalance(me.walletAddress)"
          state={hookState(balance)}
          json={balance.data ?? balance.error}
        />
        <Section
          title="useTransactions() — first page (5)"
          state={hookState(txs)}
          json={
            txs.isError ? txs.error : { count: txItems.length, items: txItems }
          }
        />

        <LogsPanel />
      </ScrollView>
    </SafeAreaView>
  );
}

function LogsPanel() {
  const entries = useLogEntries();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Chain interactions</Text>
        <Pressable
          onPress={clearEntries}
          style={styles.clearLogsBtn}
          hitSlop={8}
        >
          <Text style={styles.clearLogsText}>clear</Text>
        </Pressable>
      </View>
      {entries.length === 0 ? (
        <Text style={styles.logsEmpty}>
          No logs yet. Trigger a wallet init, send, swap, or treasury action.
        </Text>
      ) : (
        <View style={styles.logsList}>
          {entries.map((e) => (
            <LogRow key={e.id} entry={e} />
          ))}
        </View>
      )}
    </View>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  const time = new Date(entry.ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dotColor =
    entry.level === 'error'
      ? colors.sun
      : entry.level === 'warn'
        ? '#caa84a'
        : colors.inkMuted;
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      style={styles.logRow}
    >
      <View style={styles.logHead}>
        <View style={[styles.logDot, { backgroundColor: dotColor }]} />
        <Text style={styles.logTime}>{time}</Text>
        <Text style={styles.logTag}>{entry.tag}</Text>
      </View>
      <Text style={styles.logMsg} selectable>
        {entry.msg}
      </Text>
      {open && entry.data !== undefined && (
        <Text style={styles.logData} selectable>
          {prettify(entry.data)}
        </Text>
      )}
    </Pressable>
  );
}

function hookState(q: {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess?: boolean;
}): string {
  if (q.isError) return 'error';
  if (q.isLoading) return 'loading';
  if (q.isFetching) return 'refetching';
  if (q.isSuccess) return 'ok';
  return 'idle';
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      <Text style={styles.blockValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Section({
  title,
  state,
  json,
}: {
  title: string;
  state: string;
  json: unknown;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View
          style={[
            styles.statePill,
            state === 'ok' && { backgroundColor: colors.mint },
            state === 'error' && { backgroundColor: 'rgba(255,90,44,0.18)' },
          ]}
        >
          <Text style={styles.stateText}>{state}</Text>
        </View>
      </View>
      <Text style={styles.json} selectable>
        {prettify(json)}
      </Text>
    </View>
  );
}

function prettify(v: unknown): string {
  if (v === undefined) return '—';
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
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
  title: { fontFamily: fonts.displayBold, color: colors.ink, fontSize: 28 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  scroll: { paddingHorizontal: layout.screenPaddingX, paddingBottom: 32 },
  block: {
    backgroundColor: '#F4F4F4',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  blockLabel: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  blockValue: { fontFamily: fonts.mono, color: colors.ink, fontSize: 12, marginTop: 2 },
  sectionLabel: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    minHeight: 80,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: radii.md,
    padding: 12,
    fontFamily: fonts.mono,
    color: colors.ink,
    fontSize: 12,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: radii.pill, alignItems: 'center' },
  btnInk: { backgroundColor: colors.ink },
  btnInkText: { fontFamily: fonts.bodyMedium, color: colors.cream, fontSize: 13 },
  btnGhost: { backgroundColor: 'rgba(0,0,0,0.05)' },
  btnGhostText: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13 },
  section: { marginTop: 18 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionTitle: { fontFamily: fonts.bodySemibold, color: colors.ink, fontSize: 13 },
  statePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  stateText: { fontFamily: fonts.mono, color: colors.ink, fontSize: 10 },
  json: {
    fontFamily: fonts.mono,
    color: colors.ink,
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: radii.md,
    padding: 10,
  },
  clearLogsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  clearLogsText: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 10 },
  logsList: { gap: 4 },
  logsEmpty: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 12,
    padding: 12,
  },
  logRow: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  logHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logDot: { width: 6, height: 6, borderRadius: 3 },
  logTime: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 10 },
  logTag: { fontFamily: fonts.mono, color: colors.ink, fontSize: 10 },
  logMsg: { fontFamily: fonts.body, color: colors.ink, fontSize: 12, marginTop: 4 },
  logData: {
    fontFamily: fonts.mono,
    color: colors.ink,
    fontSize: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: radii.sm,
    padding: 8,
    marginTop: 6,
  },
});
