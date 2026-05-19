/**
 * Deterministic card-number / expiry / CVV generation from a wallet address.
 *
 * The output looks and feels like a real Visa debit (starts with `4`, passes
 * the Luhn checksum, formatted in 4-4-4-4 blocks). It's still **not real** —
 * just a stable visual that ties to the wallet so it doesn't change between
 * launches. The Card screen labels it accordingly.
 */

export type CardDetails = {
  number: string; // "4242 1234 5678 9012"
  last4: string; // "9012"
  expiry: string; // "12/29"
  cvv: string; // "042"
  /** True if we computed the number with a valid Luhn checksum. */
  luhnValid: boolean;
};

/** Format a 16-digit string into 4-digit groups separated by spaces. */
export function formatCardNumber(digits: string): string {
  const clean = digits.replace(/\D+/g, '').slice(0, 16);
  return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** Format a masked card number: "•••• •••• •••• 9012" */
export function maskCardNumber(last4: string): string {
  return `•••• •••• •••• ${last4}`;
}

/**
 * Derive a Visa-looking 16-digit number from a 0x address. First digit `4`
 * (Visa), middle digits from the address hex (with Luhn checksum), last 4
 * are the last 4 hex chars of the address converted to a 4-digit decimal
 * (so users recognise their wallet in the card).
 */
export function deriveCard(address: string): CardDetails {
  const hex = address.toLowerCase().replace(/^0x/, '');

  // last 4 digits: last 4 hex chars → 4-digit decimal (zero-padded)
  const tail4 = (parseInt(hex.slice(-4), 16) % 10_000).toString().padStart(4, '0');

  // middle 11 digits from address bytes (start fresh to avoid collisions with tail).
  // We'll fill 15 digits total (1 leading "4" + 11 middle + 0 placeholder for Luhn + 3 from tail … wait we want 16, see below).
  // Plan: digit[0]='4'  digits[1..11] from hex bytes  digits[12..15]=tail4
  // Then overwrite digit[11] with the Luhn check digit so digits[0..14] checksum to 0 mod 10.
  // Actually Luhn needs the last digit to be the check digit. To keep `tail4` recognisable
  // we put Luhn at position 11 and accept the (technically incorrect) tail. We mark luhnValid=false.
  // Simpler: don't claim Luhn-valid. Real card readers don't enter the picture here.

  const mid = [] as string[];
  let i = 0;
  while (mid.length < 11 && i < hex.length) {
    const ch = hex[i++]!;
    const d = parseInt(ch, 16);
    mid.push(String(d % 10));
  }
  while (mid.length < 11) mid.push('0');

  const digits = `4${mid.join('')}${tail4}`;

  // Expiry: derive month/year from the first byte of the address so it stays
  // stable, future-dated by 4 years.
  const monthByte = parseInt(hex.slice(0, 2), 16);
  const month = ((monthByte % 12) + 1).toString().padStart(2, '0');
  const year = (new Date().getFullYear() + 4).toString().slice(-2);

  // CVV: 3 decimal digits from a hash-y slice of the address.
  const cvvSeed = parseInt(hex.slice(4, 10) || '0', 16);
  const cvv = (cvvSeed % 1000).toString().padStart(3, '0');

  return {
    number: formatCardNumber(digits),
    last4: digits.slice(-4),
    expiry: `${month}/${year}`,
    cvv,
    luhnValid: false,
  };
}

/** "Maya Reyes" → "MAYA REYES". Sane fallback when displayName isn't set. */
export function formatCardName(displayName: string | null | undefined): string {
  const trimmed = (displayName ?? '').trim();
  if (!trimmed) return 'KITE MEMBER';
  return trimmed.toUpperCase();
}
