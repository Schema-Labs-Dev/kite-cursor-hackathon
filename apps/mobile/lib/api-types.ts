export type Me = {
  id: string;
  walletAddress: `0x${string}`;
  basename: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedUser = {
  id: string;
  walletAddress: `0x${string}`;
  basename: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

type FormattedAmount = { raw: string; formatted: string };

export type TreasuryInfo = {
  treasuryAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  eurcAddress: `0x${string}`;
  expectedUsdcAddress: `0x${string}`;
  expectedEurcAddress: `0x${string}`;
  apy: { bps: number; decimal: number; percent: string };
};

export type TreasuryPosition = {
  principal: FormattedAmount;
  accruedYield: FormattedAmount;
  total: FormattedAmount;
};

export type TreasuryBalance = {
  address: `0x${string}`;
  walletUsdc: FormattedAmount;
  walletEurc: FormattedAmount;
  /**
   * `treasury.principal/accruedYield/total` mirror the USDC position for
   * backward compatibility with v1 mobile clients. New code should read
   * `treasury.usdc.*` or `treasury.eurc.*` explicitly.
   */
  treasury: TreasuryPosition & {
    usdc: TreasuryPosition;
    eurc: TreasuryPosition;
  };
};

export type TxType = 'TRANSFER' | 'TREASURY_DEPOSIT' | 'TREASURY_WITHDRAW';
export type TxDirection = 'IN' | 'OUT';
export type TxStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export type DisplayKind = 'send' | 'receive' | 'deposit' | 'withdraw';

type Counterparty =
  | {
      kind: 'USER';
      userId: string;
      address: string;
      shortAddress: string;
      basename: string | null;
      displayName: string | null;
      avatarUrl: string | null;
    }
  | {
      kind: 'EXTERNAL';
      address: string;
      shortAddress: string;
      basename: null;
      displayName: null;
      avatarUrl: null;
    }
  | {
      kind: 'TREASURY';
      address: string;
      shortAddress: string;
      displayName: string;
      basename: null;
      avatarUrl: null;
    };

export type ApiTransaction = {
  id: string;
  txHash: string;
  type: TxType;
  direction: TxDirection;
  displayKind: DisplayKind;
  status: TxStatus;
  amount: FormattedAmount;
  token: string;
  memo: string | null;
  blockNumber: number;
  createdAt: string;
  counterparty: Counterparty;
};

export type TransactionsPage = {
  items: ApiTransaction[];
  nextCursor: string | null;
};
