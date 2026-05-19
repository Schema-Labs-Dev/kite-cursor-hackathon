import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { ArrowRight, Wallet, ArrowUpRight, CreditCard } from 'lucide-react-native';

import { KiteLogo } from '@/components/ui/kite-logo';
import { Button } from '@/components/ui/button';
import { colors, fonts, layout, radii } from '@/constants/theme';

/**
 * Welcome / unauthenticated landing. World App-inspired:
 *   - kite glyph hero block at the top
 *   - big bold headline + plain subtitle
 *   - black pill primary + outline secondary
 *   - three benefit rows with circular icons (Hold / Send / Spend)
 */
export function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable
            onLongPress={() => __DEV__ && router.push('/debug')}
            delayLongPress={600}
            hitSlop={8}
          >
            <KiteLogo size={26} color={colors.ink} showWordmark />
          </Pressable>
          <Text style={styles.notBank}>WE ARE NOT A BANK</Text>
        </View>

        {/* Hero glyph + headline */}
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600 }}
          style={styles.heroBlock}
        >
          <View style={styles.heroGlyph}>
            <KiteLogo size={80} color={colors.ink} />
          </View>
          <Text style={styles.h1}>
            Money, set free.
          </Text>
          <Text style={styles.lede}>
            A dollar account on your phone. Earn 4.20%. Send free to any{' '}
            <Text style={styles.lede_emph}>@basename</Text>. Spend anywhere Visa works.
          </Text>
        </MotiView>

        {/* Benefit rows */}
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 700, delay: 200 }}
          style={styles.benefits}
        >
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>{b.icon}</View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitBody}>{b.body}</Text>
              </View>
            </View>
          ))}
        </MotiView>

        {/* CTAs */}
        <View style={styles.cta}>
          <Button
            label="Get started"
            iconRight={<ArrowRight size={18} color={colors.cream} strokeWidth={2} />}
            onPress={() => router.push('/onboarding')}
            size="lg"
            variant="primary"
          />
          <Text style={styles.fineprint}>
            Sign up with your face. No seed phrase, ever.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const BENEFITS = [
  {
    title: 'Hold',
    body: 'Dollars that earn ~4.20% APY while you sleep.',
    icon: <Wallet size={18} color={colors.ink} strokeWidth={2} />,
  },
  {
    title: 'Send',
    body: 'Free, instant transfers to any @basename.',
    icon: <ArrowUpRight size={18} color={colors.ink} strokeWidth={2} />,
  },
  {
    title: 'Spend',
    body: 'Visa card. Up to 4% cashback in dollars.',
    icon: <CreditCard size={18} color={colors.ink} strokeWidth={2} />,
  },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: {
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: 32,
    flexGrow: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  notBank: {
    fontFamily: fonts.mono,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 1.4,
  },

  heroBlock: { marginTop: 56, alignItems: 'flex-start' },
  heroGlyph: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: colors.creamSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  h1: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1,
  },
  lede: {
    marginTop: 12,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  lede_emph: { fontFamily: fonts.bodySemibold, color: colors.ink },

  benefits: { marginTop: 40, gap: 4 },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.creamSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1 },
  benefitTitle: {
    fontFamily: fonts.bodySemibold,
    color: colors.ink,
    fontSize: 16,
  },
  benefitBody: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },

  cta: { marginTop: 'auto', paddingTop: 32, gap: 12 },
  fineprint: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
