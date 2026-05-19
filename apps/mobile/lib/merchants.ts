/**
 * Demo merchants — for the Card "tap to pay" flow.
 *
 * Each merchant has a real on-chain address that USDC/EURC actually transfers
 * to when a user pays. The mobile UI overrides the counterparty display so
 * the friendly name + icon show up wherever an outbound tx to one of these
 * addresses lands (Activity feed, Tx detail, Card screen).
 */

export type Merchant = {
  id: string;
  name: string;
  /** Optional secondary line — usually city + terminal id, for "feels real" vibes. */
  location: string;
  /** Single-glyph icon for the row + sheet header. Emoji is fine. */
  icon: string;
  /** Lowercase 0x address — matches the indexer / mapper. */
  address: `0x${string}`;
};

export const MERCHANTS: Record<string, Merchant> = {
  vidae: {
    id: 'vidae',
    name: 'Vidae Café',
    location: 'CDMX · ITP terminal',
    icon: '☕',
    address: '0xae0ac5583b519c34777fb5998016cf1d1d033091',
  },
};

export const DEFAULT_MERCHANT = MERCHANTS.vidae;

/**
 * Address → friendly display override. Lower-cased keys.
 * Used by tx-mapper to make "Vidae Café" appear in place of `0xAE0A…3091`.
 */
export const MERCHANT_DISPLAY: Record<
  string,
  { name: string; icon: string; location?: string }
> = Object.fromEntries(
  Object.values(MERCHANTS).map((m) => [
    m.address.toLowerCase(),
    { name: m.name, icon: m.icon, location: m.location },
  ]),
);

export function isMerchantAddress(addr: string | null | undefined): boolean {
  if (!addr) return false;
  return Boolean(MERCHANT_DISPLAY[addr.toLowerCase()]);
}

export function merchantForAddress(addr: string | null | undefined) {
  if (!addr) return null;
  return MERCHANT_DISPLAY[addr.toLowerCase()] ?? null;
}
