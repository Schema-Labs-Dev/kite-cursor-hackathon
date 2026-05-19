# 08 — Mobile Handoff

> This doc is for your friend (the mobile dev). It's the contract between the two of you so they can build in parallel.

## What you're building

A 4-screen Expo app with passkey auth, Base Sepolia integration, and clean UX matching the brand in `apps/web/`.

## Screens

```
1. Welcome / Onboarding   →  "Get started" CTA → passkey → claim Basename
2. Home                   →  USDC balance + ticking yield + 3 buttons (Hold / Send / Spend)
3. Send                   →  Recipient picker + amount + memo + Send
4. Activity               →  List of recent transactions with friendly receipts
5. Card (mockup)          →  Static UI with "Coming soon" overlay
```

The marketing site has phone screen mockups in `apps/web/components/ui/screens/` — use them as visual reference.

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo (React Native) |
| Navigation | expo-router |
| Wallet SDK | `@coinbase/wallet-mobile-sdk` + `@mobile-wallet-protocol/wallet-mobile-sdk` |
| Chain client | `viem` |
| Signing | Smart Wallet passkey (WebAuthn / native passkey) |
| State | TanStack Query |
| Storage | `expo-secure-store` for JWT |
| HTTP | `fetch` + a tiny `apiClient` wrapper |
| Styling | NativeWind (Tailwind for RN) — matches the marketing site tokens |

## Environment variables (`.env` in `apps/mobile/`)

```bash
EXPO_PUBLIC_API_URL=http://<your-machine-ip>:3001/api/v1
EXPO_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
EXPO_PUBLIC_KITE_TREASURY_ADDRESS=0x...
EXPO_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
EXPO_PUBLIC_BASESCAN_URL=https://sepolia.basescan.org
```

> Use your machine's LAN IP (not `localhost`) so the phone can reach the backend during the demo.

## What the backend gives you (REST)

See [`06-api-spec.md`](./06-api-spec.md) for the full spec. The endpoints you need on day one:

| Endpoint | When you call it |
|---|---|
| `POST /auth/nonce` | Right after wallet creation |
| `POST /auth/verify` | After the user signs the SIWE message |
| `GET /me` | On every app load to confirm auth still valid |
| `GET /users/resolve` | When user types in the recipient field on Send |
| `POST /transactions/memo` | Right after broadcasting a send |
| `GET /transactions` | Activity screen |
| `GET /treasury/balance` | Home screen balance |
| `GET /treasury/yield` | Polling for the ticking yield UI |

## What you talk to directly (the chain)

Two things bypass the backend entirely:

1. **USDC transfers** — call `transfer()` on the USDC ERC-20 directly via the Smart Wallet
2. **Treasury deposits/withdraws** — call `deposit()` / `withdraw()` on `KiteTreasury` directly

Use viem's `writeContract` after the wallet has been initialized.

## Reference snippets

### Auth flow

```typescript
import { SiweMessage } from 'siwe';

async function signIn(walletAddress: string, signMessage: (msg: string) => Promise<string>) {
  // 1. Get nonce
  const { nonce } = await api.post('/auth/nonce', { address: walletAddress });

  // 2. Build SIWE message
  const message = new SiweMessage({
    domain: 'kite.cash',
    address: walletAddress,
    statement: 'Sign in to Kite',
    uri: 'https://kite.cash',
    version: '1',
    chainId: 84532,
    nonce,
  }).prepareMessage();

  // 3. Sign
  const signature = await signMessage(message);

  // 4. Verify with backend
  const { token, user } = await api.post('/auth/verify', { message, signature });

  await SecureStore.setItemAsync('jwt', token);
  return user;
}
```

### Send USDC

```typescript
import { encodeFunctionData, parseUnits } from 'viem';

const USDC_ABI = [{
  name: 'transfer',
  type: 'function',
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [{ type: 'bool' }],
}] as const;

async function sendUSDC(to: `0x${string}`, dollars: string, memo: string) {
  const amount = parseUnits(dollars, 6);
  const data = encodeFunctionData({
    abi: USDC_ABI,
    functionName: 'transfer',
    args: [to, amount],
  });

  // Coinbase Smart Wallet handles paymaster sponsorship automatically
  const txHash = await wallet.sendTransaction({
    to: process.env.EXPO_PUBLIC_USDC_ADDRESS as `0x${string}`,
    data,
    value: 0n,
  });

  // Tell backend about the memo
  await api.post('/transactions/memo', { txHash, memo, toAddress: to });
  return txHash;
}
```

### Read treasury balance

```typescript
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { kiteTreasuryAbi } from '../abis/kite-treasury';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.EXPO_PUBLIC_BASE_RPC_URL),
});

async function getYield(userAddress: `0x${string}`) {
  return client.readContract({
    address: process.env.EXPO_PUBLIC_KITE_TREASURY_ADDRESS as `0x${string}`,
    abi: kiteTreasuryAbi,
    functionName: 'pendingYield',
    args: [userAddress],
  });
}
```

> You can also fetch this from `GET /treasury/yield` on the backend — same data, but cached.

## Auth headers

Every authenticated call needs:

```
Authorization: Bearer <jwt>
```

Wrap fetches in a tiny client:

```typescript
async function authedFetch(path: string, opts: RequestInit = {}) {
  const token = await SecureStore.getItemAsync('jwt');
  return fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
}
```

## Brand tokens (match the marketing site)

```typescript
export const colors = {
  cream: '#F1EAD8',
  creamSoft: '#F6F1E3',
  ink: '#0B1230',
  sun: '#FF5A2C',
  sky: '#3461FF',
  mint: '#B6F0C5',
};

export const fonts = {
  display: 'Fraunces',  // load via expo-font
  body: 'Geist',
};
```

## Hackathon scope cuts

If running short, ship in this order:

1. **Onboarding + Home + Send + Activity** — these four screens make the demo
2. **Card screen as a static mockup** — borrow from `apps/web/components/ui/card-mockup.tsx`
3. Skip Notifications, Contacts, Invites for the demo

## Common gotchas

- **HTTPS required for passkeys.** Use Expo Go on a physical device with a tunnel (`npx expo start --tunnel`) so the backend URL is reachable and the WebAuthn API works.
- **Date / time on phone matters.** SIWE timestamps + JWT exp will reject if the phone clock is off.
- **Network access from device → laptop.** Phone and laptop must share Wi-Fi; or use ngrok/cloudflared for the backend.
- **USDC has 6 decimals, not 18.** Always use `parseUnits(amount, 6)`.

Move on to [`09-timeline.md`](./09-timeline.md).
