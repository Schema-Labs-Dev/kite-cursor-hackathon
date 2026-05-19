const required = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(
      `[kite/env] missing required env ${name}. Add EXPO_PUBLIC_${name.replace(/^EXPO_PUBLIC_/, '')} to apps/mobile/.env`,
    );
  }
  return value;
};

const optional = (value: string | undefined, fallback: string): string =>
  value && value.length > 0 ? value : fallback;

export const env = {
  apiUrl: optional(
    process.env.EXPO_PUBLIC_API_URL,
    'http://localhost:3001/api/v1',
  ),
  baseRpcUrl: optional(
    process.env.EXPO_PUBLIC_BASE_RPC_URL,
    'https://sepolia.base.org',
  ),
  chainId: 84532,
  treasuryAddress: optional(
    process.env.EXPO_PUBLIC_KITE_TREASURY_ADDRESS,
    '0x289037aBB2cf9E2E7394917b1F9e050887D4b352',
  ) as `0x${string}`,
  // Kite-deployed test tokens (own supply, mintable). See contracts/src/Kite{USDC,EURC}.sol.
  usdcAddress: optional(
    process.env.EXPO_PUBLIC_USDC_ADDRESS,
    '0xcE19877675761f5D5CEd3A12c0f4bf98c68055B5',
  ) as `0x${string}`,
  eurcAddress: optional(
    process.env.EXPO_PUBLIC_EURC_ADDRESS,
    '0x99D88dF52473844b1473b9a4Dd6BA90fAAF0AB72',
  ) as `0x${string}`,
  basescanUrl: optional(
    process.env.EXPO_PUBLIC_BASESCAN_URL,
    'https://sepolia.basescan.org',
  ),
  walletAppName: optional(process.env.EXPO_PUBLIC_WALLET_APP_NAME, 'Kite'),
  /**
   * CDP bundler + paymaster RPC endpoint (Base Sepolia). Used by the smart
   * account client to sponsor user gas. When empty, `getSmartAccountClient`
   * throws a clear setup-instruction error.
   */
  cdpRpcUrl: optional(process.env.EXPO_PUBLIC_CDP_RPC_URL, ''),
};

export const requireEnv = required;
