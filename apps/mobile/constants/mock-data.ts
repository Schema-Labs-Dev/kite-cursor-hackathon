export type Currency = 'USDC' | 'EURC';

export type Contact = {
  id: string;
  handle: string;
  displayName: string;
  initial: string;
  country?: string;
  onKite: boolean;
  color: 'sun' | 'sky' | 'mint' | 'ink';
};

export type Transaction = {
  id: string;
  kind: 'send' | 'receive' | 'card' | 'interest' | 'add';
  counterparty: string;
  note: string;
  amount: number;
  cashback?: number;
  category?: string;
  timestamp: string;
  txHash: string;
};

export const me = {
  handle: 'nia',
  displayName: 'Nia Okafor',
  basename: 'nia.base.eth',
  address: '0x9aF3B2A7E1c8c0f1D2c4Fb74A8c2F1E0a4B5c3F2',
  initial: 'n',
  balance: 2847.12,
  apy: 4.2,
  yieldToday: 0.32,
  yieldMonth: 9.87,
  cardLast4: '0042',
  cashbackThisMonth: 24.18,
  cashbackCap: 37.8,
};

export const contacts: Contact[] = [
  { id: 'c1', handle: '@maya',  displayName: 'Maya Reyes',     initial: 'm', country: 'México',  onKite: true,  color: 'sun' },
  { id: 'c2', handle: '@bola',  displayName: 'Bola Adeyemi',   initial: 'b', country: 'Lagos',   onKite: true,  color: 'sky' },
  { id: 'c3', handle: '@luis',  displayName: 'Luis García',    initial: 'l', country: 'Madrid',  onKite: true,  color: 'mint' },
  { id: 'c4', handle: '@kai',   displayName: 'Kai Nakamura',   initial: 'k', country: 'Tokyo',   onKite: true,  color: 'ink' },
  { id: 'c5', handle: '@amara', displayName: 'Amara Johnson',  initial: 'a', country: 'NYC',     onKite: false, color: 'sun' },
  { id: 'c6', handle: '@dani',  displayName: 'Dani Petrov',    initial: 'd', country: 'Sofia',   onKite: true,  color: 'sky' },
];

export const transactions: Transaction[] = [
  {
    id: 't1',
    kind: 'send',
    counterparty: '@maya',
    note: 'lunch on me',
    amount: -25.0,
    timestamp: '2026-05-18T09:14:00Z',
    txHash: '0x9fa12c4b3e7d8a1f9c2e4b6d8a0f1e3c5b7d9a2f4e6c8b0a1d3f5e7b9c2d4f60',
  },
  {
    id: 't2',
    kind: 'card',
    counterparty: 'Cafe Reverie',
    category: 'coffee · CDMX',
    note: 'spend · 4% back',
    amount: -8.4,
    cashback: 0.34,
    timestamp: '2026-05-18T08:02:00Z',
    txHash: '0x2c4e6b8d0a1f3e5c7b9d1a3f5e7c9b1d3a5f7e9c1b3d5a7f9e1c3b5d7a9f1e30',
  },
  {
    id: 't3',
    kind: 'interest',
    counterparty: 'interest',
    note: 'every block, every day',
    amount: 0.32,
    timestamp: '2026-05-18T07:00:00Z',
    txHash: '0x4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a60',
  },
  {
    id: 't4',
    kind: 'receive',
    counterparty: '@bola',
    note: 'split for taxi',
    amount: 14.5,
    timestamp: '2026-05-17T19:48:00Z',
    txHash: '0x8e0a2c4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a00',
  },
  {
    id: 't5',
    kind: 'card',
    counterparty: 'Uber',
    category: 'ride · Lagos',
    note: 'spend · 4% back',
    amount: -12.1,
    cashback: 0.48,
    timestamp: '2026-05-17T17:22:00Z',
    txHash: '0x1d3f5e7b9c2d4f6a8e0c2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f40',
  },
  {
    id: 't6',
    kind: 'add',
    counterparty: 'Apple Pay',
    note: 'added cash',
    amount: 200.0,
    timestamp: '2026-05-16T14:11:00Z',
    txHash: '0x5b7d9c1e3a5f7b9d1c3e5a7f9b1d3c5e7a9f1b3d5c7e9a1f3b5d7c9e1a3f5b70',
  },
  {
    id: 't7',
    kind: 'card',
    counterparty: 'Spotify',
    category: 'subscription',
    note: 'spend · 4% back',
    amount: -9.99,
    cashback: 0.4,
    timestamp: '2026-05-15T10:00:00Z',
    txHash: '0x7f9b1d3c5e7a9f1b3d5c7e9a1f3b5d7c9e1a3f5b7d9c1e3a5f7b9d1c3e5a7f90',
  },
  {
    id: 't8',
    kind: 'interest',
    counterparty: 'interest',
    note: 'every block, every day',
    amount: 0.31,
    timestamp: '2026-05-15T07:00:00Z',
    txHash: '0xa1c3e5b7d9f1c3e5a7b9d1f3c5e7a9b1d3f5c7e9a1b3d5f7c9e1a3b5d7f9c10',
  },
];

export const yieldRoutes = [
  { name: 'Morpho · Base', share: 68, apy: 4.31 },
  { name: 'Aave v3 · Base', share: 24, apy: 3.94 },
  { name: 'Spark · Base', share: 8, apy: 3.62 },
];

/**
 * Wallet rows shown on Home. Balances here are placeholders only —
 * Home overrides them with real on-chain reads via `useBalance()`.
 */
export const currencies = [
  { code: 'USDC' as const, label: 'US Dollar', balance: 0, flag: '🇺🇸' },
  { code: 'EURC' as const, label: 'Euro',      balance: 0, flag: '🇪🇺' },
];
