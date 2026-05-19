import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { log } from '@/lib/log';
import {
  OnrampApiMethodKey,
  OnrampToken,
  RATES,
} from '@/lib/onramp';
import { qk } from '@/lib/query';
import { getOrCreateWallet } from '@/lib/wallet';

export type OnrampArgs = {
  method: OnrampApiMethodKey;
  token: OnrampToken;
  amountKwacha: number;
  phone?: string;
  cardLast4?: string;
};

export type OnrampResult = {
  txHash: `0x${string}`;
  token: OnrampToken;
  tokenAmount: string;
  rawAmount: string;
  amountKwacha: number;
  rate: number;
  method: OnrampApiMethodKey;
  methodLabel: string;
  settledMs: number;
  blockNumber: number;
};

/**
 * Fires the simulated on-ramp on the backend. The API charges nothing real;
 * it sleeps for ~1.5s to imitate the provider, then mints KiteUSDC or
 * KiteEURC to the user's smart account from the deployer wallet. We then
 * invalidate wallet balance + activity so both surfaces reflect the new
 * funds within one indexer tick.
 */
export function useOnramp() {
  const qc = useQueryClient();

  return useMutation<OnrampResult, Error, OnrampArgs>({
    mutationFn: async (args) => {
      log.info(
        'onramp',
        `${args.method} · ZMW ${args.amountKwacha} → ${args.token}`,
        { phone: args.phone ? maskPhone(args.phone) : undefined, last4: args.cardLast4 },
      );

      const result = await api.post<OnrampResult>('/onramp/simulate', {
        method: args.method,
        token: args.token,
        amountKwacha: args.amountKwacha,
        phone: args.phone,
        cardLast4: args.cardLast4,
        claimedRate: RATES[args.token],
      });

      log.info(
        'onramp',
        `Minted ${result.tokenAmount} ${result.token} · tx ${result.txHash} · ${result.settledMs}ms`,
        { blockNumber: result.blockNumber },
      );
      return result;
    },
    onSuccess: async () => {
      try {
        const wallet = await getOrCreateWallet();
        qc.invalidateQueries({ queryKey: qk.treasuryBalance(wallet.address) });
      } catch (e) {
        log.warn('onramp', `Wallet invalidate skipped: ${(e as Error).message}`);
      }
      qc.invalidateQueries({ queryKey: qk.transactions });
    },
    onError: (err) => {
      log.error('onramp', `Failed: ${(err as Error).message}`);
    },
  });
}

function maskPhone(p: string): string {
  if (p.length <= 4) return p;
  return `${p.slice(0, 4)}…${p.slice(-2)}`;
}
