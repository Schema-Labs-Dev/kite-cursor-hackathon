import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { X, Copy, Share2, Check } from 'lucide-react-native';

import { Avatar } from '@/components/ui/avatar';
import { useMe } from '@/hooks/use-me';
import { env } from '@/lib/env';
import { colors, fonts, layout, radii } from '@/constants/theme';

export default function Receive() {
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const [copied, setCopied] = useState<'basename' | 'address' | null>(null);

  const onCopy = async (value: string, what: 'basename' | 'address') => {
    await Clipboard.setStringAsync(value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };

  const onShare = async () => {
    if (!me) return;
    try {
      const label = me.basename ?? shortAddr(me.walletAddress);
      await Share.share({
        message: `Pay me on Kite — ${label}\n${me.walletAddress}`,
      });
    } catch {}
  };

  if (isLoading || !me) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  const initial = (me.displayName ?? me.walletAddress.slice(2, 3))[0]!.toLowerCase();
  const display = me.displayName ?? me.basename?.split('.')[0] ?? shortAddr(me.walletAddress);
  const basenameLabel = me.basename ?? 'no basename yet';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Get paid</Text>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <X size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Avatar initial={initial} color="ink" size="lg" />
        <Text style={styles.name}>{display}</Text>
        <Text style={styles.basename}>{basenameLabel}</Text>

        <View style={styles.qrWrap}>
          <QRCode
            value={`ethereum:${me.walletAddress}@${env.chainId}`}
            size={196}
            color={colors.ink}
            backgroundColor={colors.creamSoft}
          />
        </View>

        <Text style={styles.scanHint}>
          Anyone with Kite can scan this to pay you. Free, instant, anywhere.
        </Text>

        {me.basename && (
          <Pressable
            onPress={() => onCopy(me.basename!, 'basename')}
            style={({ pressed }) => [styles.copyRow, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.copyLabel}>basename</Text>
              <Text style={styles.copyValue}>{me.basename}</Text>
            </View>
            {copied === 'basename' ? (
              <Check size={16} color={colors.ink} strokeWidth={2.5} />
            ) : (
              <Copy size={16} color={colors.inkMuted} strokeWidth={2} />
            )}
          </Pressable>
        )}

        <Pressable
          onPress={() => onCopy(me.walletAddress, 'address')}
          style={({ pressed }) => [styles.copyRow, pressed && styles.pressed]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.copyLabel}>address · Base Sepolia</Text>
            <Text style={styles.copyValueMono}>{shortAddr(me.walletAddress)}</Text>
          </View>
          {copied === 'address' ? (
            <Check size={16} color={colors.ink} strokeWidth={2.5} />
          ) : (
            <Copy size={16} color={colors.inkMuted} strokeWidth={2} />
          )}
        </Pressable>

        <Pressable onPress={onShare} style={({ pressed }) => [styles.shareBtn, pressed && styles.sharePressed]}>
          <Share2 size={16} color={colors.cream} strokeWidth={2} />
          <Text style={styles.shareText}>Share my Kite</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: 12,
  },
  headerTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 22, letterSpacing: -0.5 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: layout.screenPaddingX, paddingTop: 12 },
  name: { fontFamily: fonts.bodySemibold, color: colors.ink, fontSize: 16, marginTop: 12 },
  basename: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  qrWrap: {
    marginTop: 22,
    padding: 16,
    backgroundColor: colors.creamSoft,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  scanHint: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 16,
    lineHeight: 17,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
    backgroundColor: '#F4F4F4',
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: radii.md,
    marginTop: 10,
  },
  pressed: { backgroundColor: '#EBEBEB' },
  copyLabel: { fontFamily: fonts.mono, color: colors.inkMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 },
  copyValue: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 14, marginTop: 2 },
  copyValueMono: { fontFamily: fonts.mono, color: colors.ink, fontSize: 13, marginTop: 2 },
  shareBtn: {
    marginTop: 'auto',
    alignSelf: 'stretch',
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sharePressed: { opacity: 0.9 },
  shareText: { fontFamily: fonts.bodyMedium, color: colors.cream, fontSize: 15 },
});
