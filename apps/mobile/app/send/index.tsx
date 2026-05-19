import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Search, Check, X, Sparkles, ExternalLink } from 'lucide-react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Keypad } from '@/components/sections/keypad';
import { useContacts, type Contact } from '@/hooks/use-contacts';
import { useResolveUser } from '@/hooks/use-resolve-user';
import { useBalance } from '@/hooks/use-treasury';
import { useMe } from '@/hooks/use-me';
import { useSendUsdc } from '@/hooks/use-send-usdc';
import { env } from '@/lib/env';
import { colors, fonts, layout, radii } from '@/constants/theme';

type Stage = 'pick' | 'amount' | 'success';

type Recipient = {
  /** Wallet address (lowercase). Used as the React key and as the on-chain `to`. */
  address: `0x${string}`;
  displayName: string;
  basename: string | null;
  initial: string;
  onKite: boolean;
};

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const BASENAME_RE = /^[a-z0-9-]+\.base\.eth$/i;

export default function Send() {
  const router = useRouter();
  const me = useMe();
  const balance = useBalance(me.data?.walletAddress);
  const send = useSendUsdc();

  const [stage, setStage] = useState<Stage>('pick');
  const [query, setQuery] = useState('');
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [settleMs, setSettleMs] = useState<number | null>(null);

  const walletUsdc = parseFloat(balance.data?.walletUsdc.formatted ?? '0');
  const amountNum = parseFloat(amount) || 0;

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

  const onSend = async () => {
    if (!recipient || amountNum <= 0 || amountNum > walletUsdc) return;
    setError(null);
    try {
      const result = await send.mutateAsync({
        to: recipient.address,
        dollars: amountNum.toFixed(2),
        memo: note.trim() || undefined,
      });
      setTxHash(result.txHash);
      setSettleMs(null);
      result.receipt
        .then(({ settledMs }) => setSettleMs(settledMs))
        .catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStage('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      setError(friendlyError(msg));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const reset = () => {
    setStage('pick');
    setRecipient(null);
    setAmount('0');
    setNote('');
    setError(null);
    setTxHash(null);
    setSettleMs(null);
  };

  const insufficient = amountNum > walletUsdc;
  const canSend =
    Boolean(recipient) &&
    amountNum > 0 &&
    !insufficient &&
    !send.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (stage === 'amount' ? setStage('pick') : router.back())}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <ArrowLeft size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>{stage === 'success' ? 'Sent' : 'Send'}</Text>
        <Text style={styles.headerHint}>{stage === 'amount' ? 'free*' : ''}</Text>
      </View>

      <AnimatePresence exitBeforeEnter>
        {stage === 'pick' && (
          <MotiView
            key="pick"
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0 }}
            style={styles.flex}
          >
            <PickStage
              query={query}
              setQuery={setQuery}
              onPick={(r) => {
                Haptics.selectionAsync().catch(() => {});
                setRecipient(r);
                setStage('amount');
              }}
            />
          </MotiView>
        )}

        {stage === 'amount' && recipient && (
          <MotiView
            key="amount"
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0 }}
            style={styles.flex}
          >
            <View style={styles.recipientPill}>
              <Avatar initial={recipient.initial} color="sky" size="md" />
              <View style={styles.recipientText}>
                <Text style={styles.contactName}>{recipient.displayName}</Text>
                <Text style={styles.contactHandle}>
                  {recipient.basename ?? shortAddr(recipient.address)}
                </Text>
              </View>
              {recipient.onKite && (
                <View style={styles.onKite}>
                  <Check size={11} color={colors.ink} strokeWidth={2.5} />
                  <Text style={styles.onKiteText}>on Kite</Text>
                </View>
              )}
            </View>

            <View style={styles.amountWrap}>
              <Text style={styles.amountEyebrow}>you send</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountDollar}>$</Text>
                <Text style={styles.amount}>{amount}</Text>
              </View>
              <Text style={styles.amountSub}>
                {amountNum.toFixed(2)} USDC · wallet ${walletUsdc.toFixed(2)} available
              </Text>

              <View style={styles.noteWrap}>
                <Text style={styles.noteLabel}>note</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="what’s this for?"
                  placeholderTextColor={colors.inkMuted}
                  style={styles.noteInput}
                  maxLength={48}
                />
              </View>

              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>network fee</Text>
                <Text style={styles.feeAmount}>paid in Sepolia ETH*</Text>
              </View>
            </View>

            <View style={styles.keypadWrap}>
              <Keypad onPress={onKey} />
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText} numberOfLines={3}>
                  {error}
                </Text>
              </View>
            )}

            <View style={styles.sendCta}>
              <Button
                label={
                  send.isPending
                    ? 'Broadcasting…'
                    : insufficient
                      ? 'Insufficient USDC'
                      : amountNum > 0
                        ? `Send $${amountNum.toFixed(2)}`
                        : 'Enter an amount'
                }
                onPress={onSend}
                loading={send.isPending}
                disabled={!canSend}
                size="lg"
              />
            </View>
          </MotiView>
        )}

        {stage === 'success' && recipient && txHash && (
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
              ${amountNum.toFixed(2)}
            </Text>
            <Text style={styles.successSub}>
              sent to <Text style={styles.successName}>{recipient.displayName}</Text>
            </Text>
            <Text style={styles.successHash}>
              tx {shortHash(txHash)}
              {' · '}
              {settleMs === null ? 'broadcast — waiting for confirmation…' : `settled in ${(settleMs / 1000).toFixed(1)}s`}
            </Text>
            <Pressable
              onPress={() => Linking.openURL(`${env.basescanUrl}/tx/${txHash}`).catch(() => {})}
              hitSlop={8}
            >
              <View style={styles.basescanRow}>
                <Text style={styles.basescanText}>View on BaseScan</Text>
                <ExternalLink size={13} color={colors.inkMuted} strokeWidth={2} />
              </View>
            </Pressable>
            <View style={styles.successCta}>
              <Button label="Send another" variant="ghost" onPress={reset} />
              <Button label="Done" variant="ink" onPress={() => router.back()} />
            </View>
          </MotiView>
        )}
      </AnimatePresence>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Recipient pick                                                     */
/* ------------------------------------------------------------------ */

function PickStage({
  query,
  setQuery,
  onPick,
}: {
  query: string;
  setQuery: (q: string) => void;
  onPick: (r: Recipient) => void;
}) {
  const contacts = useContacts();
  const resolve = useResolveUser(query);

  const items = useMemo<Recipient[]>(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '');

    // Bare address: synthetic external recipient.
    if (ADDRESS_RE.test(q)) {
      return [
        {
          address: q as `0x${string}`,
          displayName: shortAddr(q as `0x${string}`),
          basename: null,
          initial: q.slice(2, 3),
          onKite: false,
        },
      ];
    }

    const fromContacts: Recipient[] = (contacts.data?.items ?? [])
      .filter((c) => {
        if (!q) return true;
        return (
          c.basename?.toLowerCase().includes(q) ||
          c.displayName?.toLowerCase().includes(q) ||
          c.walletAddress.toLowerCase().includes(q)
        );
      })
      .map(contactToRecipient);

    const seen = new Set(fromContacts.map((r) => r.address.toLowerCase()));
    const fromResolve: Recipient[] = (resolve.data?.results ?? [])
      .map((u) => ({
        address: u.walletAddress.toLowerCase() as `0x${string}`,
        displayName: u.displayName ?? u.basename ?? shortAddr(u.walletAddress),
        basename: u.basename,
        initial: (u.displayName ?? u.basename ?? u.walletAddress.slice(2, 3))[0]!.toLowerCase(),
        onKite: true,
      }))
      .filter((r) => !seen.has(r.address.toLowerCase()));

    return [...fromContacts, ...fromResolve];
  }, [query, contacts.data, resolve.data]);

  const showOffKiteBasenameHint =
    query.length > 0 && BASENAME_RE.test(query.trim()) && items.length === 0 && !resolve.isFetching;

  return (
    <>
      <View style={styles.searchWrap}>
        <Search size={16} color={colors.inkMuted} strokeWidth={2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="@handle, basename, or 0x address"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <X size={14} color={colors.inkMuted} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      <Text style={styles.listLabel}>
        {query.length > 0 ? 'Matches' : 'Recent'}
      </Text>
      <FlatList
        data={items}
        keyExtractor={(r) => r.address}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPick(item)}
            style={({ pressed }) => [styles.contactRow, pressed && styles.pressed]}
          >
            <Avatar initial={item.initial} color="sky" size="md" />
            <View style={styles.contactText}>
              <Text style={styles.contactName}>{item.displayName}</Text>
              <Text style={styles.contactHandle}>
                {item.basename ?? shortAddr(item.address)}
              </Text>
            </View>
            {item.onKite && (
              <View style={styles.onKite}>
                <Check size={11} color={colors.ink} strokeWidth={2.5} />
                <Text style={styles.onKiteText}>on Kite</Text>
              </View>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          contacts.isLoading || resolve.isFetching ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator color={colors.inkMuted} />
            </View>
          ) : showOffKiteBasenameHint ? (
            <Text style={styles.empty}>
              We can’t pay an off-Kite basename yet — paste their 0x address.
            </Text>
          ) : query.length > 0 ? (
            <Text style={styles.empty}>
              No matches. Paste a 0x address to send.
            </Text>
          ) : (
            <Text style={styles.empty}>
              No recent recipients yet. Search or paste an address above.
            </Text>
          )
        }
      />
    </>
  );
}

function contactToRecipient(c: Contact): Recipient {
  const display = c.displayName ?? c.basename ?? shortAddr(c.walletAddress);
  return {
    address: c.walletAddress.toLowerCase() as `0x${string}`,
    displayName: display,
    basename: c.basename,
    initial: display[0]!.toLowerCase(),
    onKite: true,
  };
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
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
    return 'Not enough USDC in your wallet for this transfer.';
  }
  if (lower.includes('user rejected')) {
    return 'Cancelled.';
  }
  return msg;
}

/* ------------------------------------------------------------------ */

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
  headerTitle: { fontFamily: fonts.bodySemibold, color: colors.ink, fontSize: 15 },
  headerHint: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 12, minWidth: 36, textAlign: 'right' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: layout.screenPaddingX,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    color: colors.ink,
    fontSize: 14,
    padding: 0,
  },
  listLabel: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    marginHorizontal: layout.screenPaddingX,
  },
  list: { paddingHorizontal: layout.screenPaddingX, gap: 6, paddingBottom: 24 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radii.lg,
  },
  pressed: { backgroundColor: '#F4F4F4' },
  contactText: { flex: 1 },
  contactName: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 14 },
  contactHandle: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 11, marginTop: 2 },
  onKite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.mint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  onKiteText: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 10 },
  empty: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  emptyWrap: { paddingVertical: 36, alignItems: 'center' },

  recipientPill: {
    marginHorizontal: layout.screenPaddingX,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F4F4F4',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
  },
  recipientText: { flex: 1 },

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
  noteWrap: {
    marginTop: 18,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  noteLabel: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  noteInput: {
    fontFamily: fonts.body,
    color: colors.ink,
    fontSize: 14,
    marginTop: 2,
    padding: 0,
  },
  feeRow: {
    alignSelf: 'stretch',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: radii.md,
  },
  feeLabel: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 12 },
  feeAmount: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 11 },

  keypadWrap: { paddingHorizontal: layout.screenPaddingX, marginTop: 16 },
  errorBox: {
    marginHorizontal: layout.screenPaddingX,
    marginTop: 8,
    backgroundColor: 'rgba(255,90,44,0.12)',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { fontFamily: fonts.body, color: colors.sunDeep, fontSize: 12 },
  sendCta: { paddingHorizontal: layout.screenPaddingX, marginTop: 'auto', paddingBottom: 8 },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.screenPaddingX },
  successCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  successAmount: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 56,
    letterSpacing: -1.5,
  },
  successSub: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 15, marginTop: 8 },
  successName: { fontFamily: fonts.bodySemibold, color: colors.ink },
  successHash: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 11, marginTop: 14, textAlign: 'center', paddingHorizontal: 24 },
  basescanRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  basescanText: { fontFamily: fonts.bodyMedium, color: colors.inkMuted, fontSize: 12 },
  successCta: { marginTop: 36, alignSelf: 'stretch', gap: 10 },
});
