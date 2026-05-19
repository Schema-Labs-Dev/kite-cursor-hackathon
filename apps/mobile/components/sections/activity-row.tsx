import { Pressable, View, Text, StyleSheet } from 'react-native';
import { ArrowUpRight, ArrowDownLeft, Sparkles, CreditCard, Plus } from 'lucide-react-native';
import { colors, fonts, radii } from '@/constants/theme';
import type { Transaction } from '@/constants/mock-data';

type Props = {
  tx: Transaction;
  onPress?: () => void;
};

function iconFor(kind: Transaction['kind']) {
  switch (kind) {
    case 'send':     return { Icon: ArrowUpRight,    bg: 'rgba(0,0,0,0.08)',  fg: colors.ink };
    case 'receive':  return { Icon: ArrowDownLeft,   bg: colors.mint,             fg: colors.ink };
    case 'interest': return { Icon: Sparkles,        bg: colors.mint,             fg: colors.ink };
    case 'card':     return { Icon: CreditCard,      bg: 'rgba(0,0,0,0.08)',  fg: colors.ink };
    case 'add':      return { Icon: Plus,            bg: colors.mint,             fg: colors.ink };
  }
}

export function ActivityRow({ tx, onPress }: Props) {
  const { Icon, bg, fg } = iconFor(tx.kind);
  const isCredit = tx.amount > 0;
  const amountStr = `${isCredit ? '+' : '-'}$${Math.abs(tx.amount).toFixed(2)}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: bg }]}>
        <Icon size={16} color={fg} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <Text style={styles.who} numberOfLines={1}>{tx.counterparty}</Text>
        <Text style={styles.note} numberOfLines={1}>{tx.category ?? tx.note}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, isCredit && styles.amountIn]}>{amountStr}</Text>
        {tx.cashback ? (
          <Text style={styles.cashback}>+${tx.cashback.toFixed(2)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F4F4F4',
    borderRadius: radii.lg,
    gap: 12,
  },
  pressed: { backgroundColor: '#EBEBEB' },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1 },
  who: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 14 },
  note: { fontFamily: fonts.body, color: colors.inkMuted, fontSize: 11, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontFamily: fonts.mono, color: colors.ink, fontSize: 14 },
  amountIn: { color: colors.ink },
  cashback: { fontFamily: fonts.mono, color: colors.sky, fontSize: 11, marginTop: 2 },
});
