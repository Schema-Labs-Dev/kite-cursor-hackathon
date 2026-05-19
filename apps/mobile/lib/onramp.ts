import { colors } from '@/constants/theme';
import type { PaymentBrand } from '@/components/ui/payment-logo';

/**
 * Demo Zambian on-ramp constants. Backed by a fake-payment endpoint on the
 * API (`POST /onramp/simulate`) that mints real KiteUSDC / KiteEURC on Base
 * Sepolia from the deployer wallet. None of the payment-provider logos /
 * phone numbers / card details ever leave the app — this is purely a demo
 * surface to make the on-chain mint feel like a real on-ramp.
 *
 * Rates are hard-coded ("demo") and validated server-side; mobile sends its
 * claimed rate so the backend can reject a drifting client (>2%).
 */

export type OnrampToken = 'USDC' | 'EURC';
export type OnrampMethodKey = 'airtel' | 'mtn' | 'visa' | 'mastercard';

/** API-side method id — backend only knows 'airtel' | 'mtn' | 'card', so
 *  Visa / Mastercard collapse back to 'card' on the wire. */
export type OnrampApiMethodKey = 'airtel' | 'mtn' | 'card';

export function toApiMethod(key: OnrampMethodKey): OnrampApiMethodKey {
  if (key === 'visa' || key === 'mastercard') return 'card';
  return key;
}

/** ZMW per 1 token. Mirrors `RATES_ZMW_PER_TOKEN` in apps/api/src/onramp. */
export const RATES: Record<OnrampToken, number> = {
  USDC: 27.0,
  EURC: 29.5,
} as const;

/** Per-tx sanity bounds. */
export const MIN_ZMW = 50;
export const MAX_ZMW = 5_000;

export type PaymentMethod = {
  key: OnrampMethodKey;
  name: string;
  /** Brand colour — used for the on-screen processing pulse + subtle accents. */
  color: string;
  /** Logo to render via <PaymentLogo brand={...} />. */
  brand: PaymentBrand;
  subtitle: string;
  /** Defines which input we collect on the amount step. */
  input: 'phone' | 'card';
  countryCode?: string;
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    key: 'airtel',
    name: 'Airtel Money',
    color: '#ED1C24',
    brand: 'airtel',
    subtitle: 'instant · ZM',
    input: 'phone',
    countryCode: '+260',
  },
  {
    key: 'mtn',
    name: 'MTN Money',
    color: '#FFCB05',
    brand: 'mtn',
    subtitle: 'instant · ZM',
    input: 'phone',
    countryCode: '+260',
  },
  {
    key: 'visa',
    name: 'Visa',
    color: colors.ink,
    brand: 'visa',
    subtitle: '1–2 min · debit or credit',
    input: 'card',
  },
  {
    key: 'mastercard',
    name: 'Mastercard',
    color: colors.ink,
    brand: 'mastercard',
    subtitle: '1–2 min · debit or credit',
    input: 'card',
  },
];

export function getPaymentMethod(key: OnrampMethodKey): PaymentMethod {
  const m = PAYMENT_METHODS.find((x) => x.key === key);
  if (!m) throw new Error(`Unknown payment method: ${key}`);
  return m;
}

/** ZMW → token amount, 6dp precision. */
export function zmwToToken(zmw: number, token: OnrampToken): number {
  if (!Number.isFinite(zmw) || zmw <= 0) return 0;
  return zmw / RATES[token];
}

export function formatZmw(n: number): string {
  if (!Number.isFinite(n)) return 'ZMW 0';
  return `ZMW ${n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatToken(n: number, token: OnrampToken): string {
  const sign = token === 'USDC' ? '$' : '€';
  return `${sign}${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Pretty-format a Zambian mobile-money number while the user types. We just
 * keep digits + a leading +260 and group the trailing 9 digits as "XX XXX XXXX".
 */
export function formatPhone(raw: string, countryCode = '+260'): string {
  const digits = raw.replace(/[^0-9]/g, '').replace(/^260/, '').slice(0, 9);
  if (digits.length === 0) return '';
  const groups = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 9),
  ].filter(Boolean);
  return `${countryCode} ${groups.join(' ')}`;
}

/** Strip everything except digits, prepend country code if missing. */
export function normalizePhone(raw: string, countryCode = '+260'): string {
  const digits = raw.replace(/[^0-9]/g, '');
  const cc = countryCode.replace(/[^0-9]/g, '');
  const without = digits.startsWith(cc) ? digits.slice(cc.length) : digits;
  return `+${cc}${without}`;
}

/**
 * Validate a phone number after stripping every non-digit char. We do this
 * because the screen stores the *formatted* display string ("+260 97 123 4567")
 * in state, and the raw regex would reject spaces. 10–15 digits covers
 * Zambian (12) and most other African mobile-money ranges.
 */
export function isPhoneValid(raw: string): boolean {
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/** Test card constants — render these when the user taps "use test card". */
export const TEST_CARD = {
  number: '4242 4242 4242 4242',
  expiry: '12/29',
  cvv: '123',
  last4: '4242',
} as const;

/** Pull the last 4 digits from any user-typed PAN. */
export function cardLast4(rawNumber: string): string {
  return rawNumber.replace(/[^0-9]/g, '').slice(-4);
}

/** Pretty-format a 16-digit PAN as four 4-digit groups while typing. */
export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}
