import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ReactNode } from 'react';
import { colors, fonts, radii, shadows } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'ink';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading,
  disabled,
  fullWidth = true,
  style,
}: Props) {
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        v.container,
        s.container,
        fullWidth && styles.fullWidth,
        variant === 'primary' && shadows.sun,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.label.color as string} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[v.label, s.label]} numberOfLines={1}>
            {label}
          </Text>
          {iconRight}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.4 },
});

const variantStyles: Record<Variant, { container: ViewStyle; label: TextStyle }> = {
  primary: {
    container: { backgroundColor: colors.sun },
    label: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 15 },
  },
  secondary: {
    container: { backgroundColor: colors.creamDeep },
    label: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 15 },
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
    label: { color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 15 },
  },
  ink: {
    container: { backgroundColor: colors.ink },
    label: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 15 },
  },
};

const sizeStyles: Record<Size, { container: ViewStyle; label: TextStyle }> = {
  sm: { container: { paddingVertical: 10, paddingHorizontal: 16 }, label: { fontSize: 13 } },
  md: { container: { paddingVertical: 14, paddingHorizontal: 20 }, label: { fontSize: 15 } },
  lg: { container: { paddingVertical: 16, paddingHorizontal: 24 }, label: { fontSize: 16 } },
};
