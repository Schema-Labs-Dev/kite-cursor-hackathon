import type { ApiTransaction } from './api-types';
import type { Transaction } from '@/constants/mock-data';
import { merchantForAddress } from './merchants';

/**
 * Adapter: turn a server-shaped ApiTransaction into the mock Transaction
 * shape so the existing ActivityRow / tx-detail UI keeps rendering without
 * a per-screen rewrite. Step 4 will collapse this once we touch tx-detail.
 *
 * Mapping:
 *   displayKind 'send'     → kind 'send'
 *   displayKind 'receive'  → kind 'receive'
 *   displayKind 'deposit'  → kind 'add'  (mint pill, plus icon — closest visual)
 *   displayKind 'withdraw' → kind 'send' (arrow up-right — closest visual)
 *
 * The mock `Transaction.note` doubles as a sub-line; we use it to surface
 * the token symbol for treasury rows so EURC deposits aren't visually
 * indistinguishable from USDC ones.
 */
export function mapApiTx(tx: ApiTransaction): Transaction {
  const cp = tx.counterparty;

  // Merchant override — if the counterparty address is a known merchant,
  // surface the friendly name and icon instead of the short address. Lets
  // outbound card payments render as "☕ Vidae Café" everywhere.
  const merchant =
    cp.kind === 'EXTERNAL' || cp.kind === 'USER'
      ? merchantForAddress(cp.address)
      : null;

  const counterparty =
    merchant
      ? `${merchant.icon} ${merchant.name}`
      : cp.kind === 'USER'
        ? (cp.basename ?? cp.displayName ?? cp.shortAddress)
        : cp.kind === 'TREASURY'
          ? cp.displayName
          : cp.shortAddress;

  const amountNumber =
    (tx.direction === 'IN' ? 1 : -1) * Number(tx.amount.formatted);

  // Merchant payments get a tight subtitle (location or "Card · <name>").
  // Treasury rows get token-tagged. Everything else falls through to memo or
  // the displayKind label.
  const note =
    merchant
      ? (merchant.location ?? `Card · ${merchant.name}`)
      : (tx.memo ??
          (tx.displayKind === 'deposit' || tx.displayKind === 'withdraw'
            ? `${labelFor(tx.displayKind)} · ${tx.token}`
            : labelFor(tx.displayKind)));

  // Merchant tx → render with the existing "card" icon (credit card) so the
  // Card screen's filter and the activity row visual both line up.
  const kind: Transaction['kind'] = merchant
    ? 'card'
    : tx.displayKind === 'deposit'
      ? 'add'
      : tx.displayKind === 'withdraw'
        ? 'send'
        : tx.displayKind;

  return {
    id: tx.id,
    kind,
    counterparty,
    note,
    amount: amountNumber,
    timestamp: tx.createdAt,
    txHash: tx.txHash,
  };
}

function labelFor(k: ApiTransaction['displayKind']): string {
  switch (k) {
    case 'send':     return 'sent';
    case 'receive':  return 'received';
    case 'deposit':  return 'into Kite Treasury';
    case 'withdraw': return 'from Kite Treasury';
  }
}
