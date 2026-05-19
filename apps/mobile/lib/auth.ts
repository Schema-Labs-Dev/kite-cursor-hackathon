import { api } from './api';
import { clearToken, setToken } from './auth-storage';
import { queryClient } from './query';
import { buildSiweMessage } from './siwe';
import type { Wallet } from './wallet';

export type AuthedUser = {
  id: string;
  walletAddress: `0x${string}`;
};

type NonceResponse = { nonce: string; expiresAt: string };
type VerifyResponse = { token: string; user: AuthedUser };

/**
 * Full SIWE round-trip. The wallet is passed in (not imported) so this
 * function stays testable and Step 2 can swap implementations freely.
 */
export async function signIn(wallet: Wallet): Promise<AuthedUser> {
  const { nonce } = await api.post<NonceResponse>(
    '/auth/nonce',
    { address: wallet.address },
    { auth: false },
  );

  const message = buildSiweMessage({
    address: wallet.address,
    nonce,
  });
  const signature = await wallet.signMessage(message);

  const { token, user } = await api.post<VerifyResponse>(
    '/auth/verify',
    { message, signature },
    { auth: false },
  );

  await setToken(token);
  return user;
}

export async function signOut(opts: { wipeWallet?: boolean } = {}): Promise<void> {
  await clearToken();
  if (opts.wipeWallet) {
    const { resetWallet } = await import('./wallet');
    await resetWallet();
  }
  queryClient.clear();
}

export { getToken } from './auth-storage';
