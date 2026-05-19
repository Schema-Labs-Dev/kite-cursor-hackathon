import { Pressable, View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import { colors, fonts, radii } from '@/constants/theme';

type Props = {
  onPress: (key: string) => void;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

export function Keypad({ onPress }: Props) {
  return (
    <View style={styles.grid}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onPress(k);
          }}
          style={({ pressed }) => [styles.key, pressed && styles.pressed]}
        >
          {k === 'back' ? (
            <Delete size={22} color={colors.ink} strokeWidth={1.6} />
          ) : (
            <Text style={styles.label}>{k}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  key: {
    width: '32%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
  },
  pressed: { backgroundColor: 'rgba(0,0,0,0.06)' },
  label: { fontFamily: fonts.display, color: colors.ink, fontSize: 28 },
});
