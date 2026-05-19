import { Platform } from 'react-native';

/**
 * Theme v2 — World App-inspired monochrome.
 *
 * Naming stays compatible with the previous palette ("cream", "ink", "sun")
 * so screens don't need to be rewritten, but the values now express a clean
 * white + ink-black + accent-green system instead of cream-and-sun.
 *
 * Mapping intuition:
 *   cream*  → page + card whites and very soft grays
 *   ink*    → text + active states + dark cards
 *   sun     → primary CTA accent (kept as a saturated black so prior "use sun"
 *             code paths still read as primary), with sunDeep as hover
 *   mint    → positive / success badges (green)
 *   sky     → links / neutral info (true muted blue)
 */
export const colors = {
  cream:      '#FFFFFF', // primary page bg
  creamSoft:  '#F7F7F7', // alt bg / surface gray
  creamDeep:  '#F0F0F0', // pressed surface, dividers
  ink:        '#000000', // primary text + buttons
  inkSoft:    '#1A1A1A',
  inkMuted:   '#6E6E6E', // secondary text
  sun:        '#000000', // primary accent — black (was orange in v1)
  sunDeep:    '#1A1A1A',
  sunSoft:    '#E5E5E5',
  sky:        '#2151FF', // links / info
  skyDeep:    '#1B43CC',
  mint:       '#10B981', // positive / success
  white:      '#FFFFFF',
};

/**
 * Type families — kept compatible with the prior tokens. We swap Fraunces
 * (display) out for Geist heavy so headlines read clean & geometric, matching
 * the World App look. `displayItalic` is left pointing at the original
 * Fraunces italic so any one-off italic accents still load.
 */
export const fonts = {
  display:        'Geist_600SemiBold',
  displayItalic:  'Fraunces_400Regular_Italic',
  displayBold:    'Geist_600SemiBold',
  displayRegular: 'Geist_500Medium',
  body:           'Geist_400Regular',
  bodyMedium:     'Geist_500Medium',
  bodySemibold:   'Geist_600SemiBold',
  mono:           'GeistMono_400Regular',
  monoMedium:     'GeistMono_500Medium',
};

export const radii = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,  // bumped — World App favors softer cards
  xxl:  28,
  pill: 999,
};

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
};

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 4 },
    default: {},
  }) as object,
  inkCard: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 8 },
    default: {},
  }) as object,
  sun: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 5 },
    default: {},
  }) as object,
};

export const layout = {
  screenPaddingX: 20,
};
