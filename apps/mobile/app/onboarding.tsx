import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Check, Fingerprint, X } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { KiteLogo } from '@/components/ui/kite-logo';
import { useBasenameAvailability } from '@/hooks/use-basename-availability';
import { api, ApiError } from '@/lib/api';
import { signIn } from '@/lib/auth';
import { getOrCreateWallet } from '@/lib/wallet';
import { qk } from '@/lib/query';
import { colors, fonts, layout, radii } from '@/constants/theme';

type Step = 'passkey' | 'basename' | 'done';

export default function Onboarding() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('passkey');
  const [handle, setHandle] = useState('');
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availability = useBasenameAvailability(handle);

  const handlePasskey = async () => {
    setError(null);
    setPasskeyLoading(true);
    try {
      const wallet = await getOrCreateWallet();
      await signIn(wallet);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await qc.invalidateQueries({ queryKey: qk.me });
      setStep('basename');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!availability.data?.available) return;
    setError(null);
    setClaimLoading(true);
    try {
      await api.patch('/me', {
        basename: availability.data.fullName,
        displayName: handle,
      });
      await qc.invalidateQueries({ queryKey: qk.me });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep('done');
      setTimeout(() => router.replace('/(tabs)/home'), 1400);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 409
          ? 'Just got taken — try another.'
          : err instanceof Error
            ? err.message
            : 'Claim failed';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setClaimLoading(false);
    }
  };

  const handleSkip = () => {
    setStep('done');
    setTimeout(() => router.replace('/(tabs)/home'), 800);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <ArrowLeft size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <KiteLogo size={20} color={colors.ink} />
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.dots}>
        {(['passkey', 'basename', 'done'] as Step[]).map((s) => (
          <View
            key={s}
            style={[
              styles.dot,
              (step === s || (step === 'done' && s !== 'done')) && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <View style={styles.body}>
        <AnimatePresence exitBeforeEnter>
          {step === 'passkey' && (
            <MotiView
              key="passkey"
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -8 }}
              style={styles.stepWrap}
            >
              <Text style={styles.eyebrow}>step one</Text>
              <Text style={styles.title}>
                Sign up with{'\n'}
                <Text style={styles.italic}>your face.</Text>
              </Text>
              <Text style={styles.subtitle}>
                Kite creates a wallet on your phone and signs you in. No seed phrase. No email link.
              </Text>

              <View style={styles.glyphCircle}>
                <Fingerprint
                  size={64}
                  color={passkeyLoading ? colors.sun : colors.ink}
                  strokeWidth={1.4}
                />
              </View>

              {error && step === 'passkey' && <ErrorRow message={error} />}

              <View style={styles.stepCta}>
                <Button
                  label={passkeyLoading ? 'Creating wallet…' : 'Continue'}
                  loading={passkeyLoading}
                  onPress={handlePasskey}
                  size="lg"
                />
                <Text style={styles.fine}>
                  Only your device can sign. We never see your key.
                </Text>
              </View>
            </MotiView>
          )}

          {step === 'basename' && (
            <MotiView
              key="basename"
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -8 }}
              style={styles.stepWrap}
            >
              <Text style={styles.eyebrow}>step two</Text>
              <Text style={styles.title}>
                Claim your{'\n'}
                <Text style={styles.italic}>username.</Text>
              </Text>
              <Text style={styles.subtitle}>
                This is how friends pay you, anywhere on Base. It’s yours forever.
              </Text>

              <View style={styles.handleWrap}>
                <Text style={styles.handlePrefix}>@</Text>
                <TextInput
                  value={handle}
                  onChangeText={(t) => {
                    setError(null);
                    setHandle(t.replace(/[^a-z0-9-]/gi, '').toLowerCase());
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.handleInput}
                  placeholder="yourname"
                  placeholderTextColor={colors.inkMuted}
                  maxLength={20}
                />
                <Text style={styles.handleSuffix}>.base.eth</Text>
              </View>
              <AvailabilityRow
                handle={handle}
                loading={availability.isFetching}
                data={availability.data}
                error={availability.error}
              />

              {error && step === 'basename' && <ErrorRow message={error} />}

              <View style={styles.stepCta}>
                <Button
                  label={
                    claimLoading
                      ? 'Claiming…'
                      : handle.length >= 2 && availability.data?.available
                        ? `Claim ${handle}.base.eth`
                        : 'Pick an available name'
                  }
                  onPress={handleClaim}
                  loading={claimLoading}
                  disabled={
                    handle.length < 2 || !availability.data?.available || claimLoading
                  }
                  size="lg"
                />
                <Pressable onPress={handleSkip} hitSlop={10}>
                  <Text style={styles.skip}>Skip for now</Text>
                </Pressable>
              </View>
            </MotiView>
          )}

          {step === 'done' && (
            <MotiView
              key="done"
              from={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              style={styles.stepWrap}
            >
              <View style={styles.successCircle}>
                <Check size={42} color={colors.cream} strokeWidth={2.4} />
              </View>
              <Text style={styles.title}>
                You’re in.{'\n'}
                <Text style={styles.italic}>Welcome to Kite.</Text>
              </Text>
              <Text style={styles.subtitle}>Loading your dollar account…</Text>
            </MotiView>
          )}
        </AnimatePresence>
      </View>
    </SafeAreaView>
  );
}

function AvailabilityRow({
  handle,
  loading,
  data,
  error,
}: {
  handle: string;
  loading: boolean;
  data: ReturnType<typeof useBasenameAvailability>['data'];
  error: ReturnType<typeof useBasenameAvailability>['error'];
}) {
  if (handle.length < 2) {
    return (
      <Text style={styles.availHint}>2 characters minimum, a-z 0-9 only</Text>
    );
  }
  if (loading) {
    return (
      <View style={styles.availRow}>
        <ActivityIndicator size="small" color={colors.inkMuted} />
        <Text style={[styles.availText, { color: colors.inkMuted }]}>checking…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.availRow}>
        <X size={14} color={colors.sun} strokeWidth={2.5} />
        <Text style={[styles.availText, { color: colors.sun }]}>
          couldn’t check — try again
        </Text>
      </View>
    );
  }
  if (data?.available) {
    return (
      <View style={styles.availRow}>
        <Check size={14} color={colors.ink} strokeWidth={2.5} />
        <Text style={styles.availText}>available · sponsored by Kite</Text>
      </View>
    );
  }
  if (data && !data.available) {
    return (
      <View style={styles.availRow}>
        <X size={14} color={colors.sun} strokeWidth={2.5} />
        <Text style={[styles.availText, { color: colors.sun }]}>
          taken — try another
        </Text>
      </View>
    );
  }
  return null;
}

function ErrorRow({ message }: { message: string }) {
  return (
    <View style={styles.errorRow}>
      <Text style={styles.errorText} numberOfLines={3}>
        {message}
      </Text>
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
    paddingTop: 4,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 24,
  },
  dot: {
    width: 24, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  dotActive: { backgroundColor: colors.ink },
  body: { flex: 1, paddingHorizontal: layout.screenPaddingX },
  stepWrap: { flex: 1 },
  eyebrow: {
    fontFamily: fonts.mono,
    color: colors.sunDeep,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
    marginTop: 8,
  },
  italic: {
    fontFamily: fonts.bodySemibold,
    fontWeight: '700',
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  glyphCircle: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 36,
  },
  stepCta: { marginTop: 'auto', gap: 10, paddingBottom: 12 },
  fine: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  skip: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 6,
  },
  handleWrap: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  handlePrefix: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 22,
  },
  handleInput: {
    flex: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 22,
    padding: 0,
  },
  handleSuffix: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 13,
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  availText: { fontFamily: fonts.body, color: colors.ink, fontSize: 12 },
  availHint: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 11,
    marginTop: 10,
  },
  errorRow: {
    marginTop: 14,
    backgroundColor: 'rgba(255,90,44,0.12)',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { fontFamily: fonts.body, color: colors.sunDeep, fontSize: 12 },
  successCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
});
