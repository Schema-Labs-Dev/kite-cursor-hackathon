import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, fonts, radii } from '@/constants/theme';

type Props = {
  label?: string;
  style?: ViewStyle;
};

/**
 * Discreet "preview" pill used to mark UI sections that are still backed by
 * mock data while we wait for the real integration. See docs/12-mobile-integration.md §6.
 */
export function PreviewBadge({ label = 'preview', style }: Props) {
  return (
    <View style={[styles.pill, style]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
