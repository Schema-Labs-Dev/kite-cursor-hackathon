import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Plus, ArrowUpRight, ArrowDownLeft, CreditCard } from 'lucide-react-native';
import { ReactNode } from 'react';
import { colors, fonts, radii } from '@/constants/theme';

type Action = {
  key: string;
  label: string;
  icon: ReactNode;
  onPress?: () => void;
};

type Props = {
  onAdd?: () => void;
  onSend?: () => void;
  onReceive?: () => void;
  onCard?: () => void;
};

export function QuickActions({ onAdd, onSend, onReceive, onCard }: Props) {
  const actions: Action[] = [
    { key: 'add', label: 'Add', icon: <Plus size={22} color={colors.ink} strokeWidth={1.9} />, onPress: onAdd },
    { key: 'send', label: 'Send', icon: <ArrowUpRight size={22} color={colors.ink} strokeWidth={1.9} />, onPress: onSend },
    { key: 'recv', label: 'Get paid', icon: <ArrowDownLeft size={22} color={colors.ink} strokeWidth={1.9} />, onPress: onReceive },
    { key: 'card', label: 'Card', icon: <CreditCard size={22} color={colors.ink} strokeWidth={1.9} />, onPress: onCard },
  ];
  return (
    <View style={styles.row}>
      {actions.map((a) => (
        <Pressable
          key={a.key}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            a.onPress?.();
          }}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
        >
          <View style={styles.icon}>{a.icon}</View>
          <Text style={styles.label}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  tile: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 8,
  },
  pressed: { opacity: 0.65 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.creamSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 12 },
});
