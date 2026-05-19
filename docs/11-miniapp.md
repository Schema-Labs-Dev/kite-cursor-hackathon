# 11 — Kite as a Base Mini App

The Mini App is the second surface for Kite. It's a Next.js web app that:

- Runs as a normal website at a public URL (e.g. `https://app.kite.cash`)
- Installs into **Coinbase Wallet**, **Base App**, and any other Mini App host via Base.dev metadata
- Shares **the same backend, the same contracts, and the same user identity** as the mobile app
- Is the killer **distribution moment** in the demo: "Same Kite, in your wallet, no install."

> **Important** — as of April 2026, Base App treats Mini Apps as standard web apps. We don't build against the Farcaster SDK. We build against `wagmi` + `viem` + `@base-org/account` + SIWE. This is exactly the same auth our backend already verifies.

## What it does (hackathon scope)

Two screens. That's all.

1. **Connect screen** — "Connect with Base Account" button → wallet popup → SIWE sign-in
2. **Home screen** — Balance + ticking yield + Send form + recent activity

No card mockup, no settings, no contacts list — those live in the mobile app for now.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router |
| Wallet connection | `wagmi` + `@base-org/account` + `injected()` |
| Chain client | `viem` |
| Auth | SIWE (`createSiweMessage` from `viem/siwe`) → backend's `POST /auth/verify` |
| State | TanStack Query (`@tanstack/react-query`) |
| Styling | Tailwind CSS — match tokens from `apps/web/` |
| Onchain UI helpers | `@coinbase/onchainkit` (optional, for `<Identity />`, `<Avatar />`) |

## Step 1 — Install dependencies

```bash
cd apps/miniapp
pnpm add wagmi viem @tanstack/react-query @base-org/account @coinbase/onchainkit
```

## Step 2 — Wagmi config

`apps/miniapp/lib/wagmi.ts`:

```typescript
import { http, createConfig, createStorage, cookieStorage } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { baseAccount, injected } from 'wagmi/connectors';

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(),
    baseAccount({
      appName: 'Kite',
    }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
```

## Step 3 — Providers

`apps/miniapp/app/providers.tsx`:

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { baseSepolia } from 'wagmi/chains';
import { config } from '@/lib/wagmi';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={baseSepolia}
          config={{
            appearance: {
              mode: 'light',
              theme: 'default',
              name: 'Kite',
            },
          }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

`apps/miniapp/app/layout.tsx`:

```typescript
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## Step 4 — Connect + SIWE

`apps/miniapp/components/sign-in.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { createSiweMessage } from 'viem/siwe';
import { useAccount, useConnect, useSignMessage } from 'wagmi';

export function SignIn() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const [signedIn, setSignedIn] = useState(false);

  async function signInWithEthereum() {
    if (!address || !chainId) return;

    const nonceRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    }).then((r) => r.json());

    const message = createSiweMessage({
      address,
      chainId,
      domain: window.location.host,
      nonce: nonceRes.nonce,
      uri: window.location.origin,
      version: '1',
      statement: 'Sign in to Kite',
    });

    const signature = await signMessageAsync({ message });

    const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature }),
    }).then((r) => r.json());

    document.cookie = `kite_jwt=${verifyRes.token}; path=/; SameSite=Lax`;
    setSignedIn(true);
  }

  if (!isConnected) {
    const baseAcc = connectors.find((c) => c.id === 'baseAccount') ?? connectors[0];
    return (
      <button onClick={() => connect({ connector: baseAcc })}>
        Connect with Base Account
      </button>
    );
  }

  if (!signedIn) {
    return <button onClick={signInWithEthereum}>Sign in to Kite</button>;
  }

  return <p>Signed in as {address}</p>;
}
```

## Step 5 — Home screen

`apps/miniapp/app/page.tsx`:

```typescript
import { SignIn } from '@/components/sign-in';
import { Home } from '@/components/home';

export default function Page() {
  return (
    <main className="min-h-screen bg-[#F1EAD8] text-[#0B1230] p-6">
      <h1 className="font-serif text-4xl mb-2">Kite</h1>
      <p className="opacity-70 mb-8">Your dollars. On your phone. Set free.</p>
      <SignIn />
      <Home />
    </main>
  );
}
```

`Home` is a client component that uses `useReadContract` to call `KiteTreasury.balanceOf(address)` and the backend's `GET /transactions` for the activity feed. It mirrors the home screen of the mobile app — same data, same shape.

## Step 6 — Send form

Inside `Home`, a small form with recipient + amount that uses `useWriteContract` to call `transfer()` on the USDC contract. After broadcasting, it `POST /transactions/memo` to attach the memo.

```typescript
import { useWriteContract } from 'wagmi';
import { parseUnits, encodeFunctionData } from 'viem';

const USDC_ABI = [{
  name: 'transfer',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [{ type: 'bool' }],
}] as const;

const { writeContractAsync } = useWriteContract();

async function send(to: `0x${string}`, dollars: string, memo: string) {
  const txHash = await writeContractAsync({
    address: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: 'transfer',
    args: [to, parseUnits(dollars, 6)],
  });
  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/memo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getJwt()}` },
    body: JSON.stringify({ txHash, memo, toAddress: to }),
  });
}
```

## Step 7 — Base.dev metadata (`farcaster.json` for legacy hosts)

Create `apps/miniapp/public/.well-known/farcaster.json`:

```json
{
  "frame": {
    "version": "1",
    "name": "Kite",
    "iconUrl": "https://app.kite.cash/icon.png",
    "homeUrl": "https://app.kite.cash",
    "imageUrl": "https://app.kite.cash/og.png",
    "buttonTitle": "Open Kite",
    "splashImageUrl": "https://app.kite.cash/splash.png",
    "splashBackgroundColor": "#F1EAD8"
  }
}
```

> Already-registered Base.dev apps don't need to update metadata. Newly registered apps fill in name/icon/tagline/screenshots through the Base.dev dashboard, not this file. Keep `farcaster.json` for Farcaster compatibility but it's not strictly needed for Base App after April 2026.

## Step 8 — Register on Base.dev

1. Go to [https://www.base.dev](https://www.base.dev)
2. Sign in with Smart Wallet
3. Create a new project: "Kite"
4. Set **Primary URL** to your deployed Mini App (Vercel preview URL works for the demo)
5. Upload icon (use the Kite logo from `apps/web/components/ui/kite-logo.tsx`)
6. Tagline: "Your dollars. On your phone. Set free."
7. Description: pull from `BRIEF.md`
8. Category: **Finance**
9. Submit

After registration, your Mini App appears in the Base.dev directory and is discoverable inside Coinbase Wallet's Mini Apps drawer.

## Step 9 — Deploy

For the demo, fastest path is Vercel:

```bash
cd apps/miniapp
pnpm dlx vercel deploy --prod
```

You get a public HTTPS URL in <60 seconds. Use this URL in the Base.dev project Primary URL field.

> If you don't want to deploy: run `pnpm dev:miniapp` with `cloudflared tunnel --url http://localhost:3002` to get a public HTTPS URL pointing at your local machine. Works just as well for the demo.

## How it ties together (the demo punchline)

```
       Native mobile demo                      Mini App demo
       ──────────────────                      ─────────────
                                            
   1. Open Kite on phone                  6. Open Coinbase Wallet
   2. Face ID → wallet created            7. Tap Mini Apps drawer → "Kite"
   3. Claim alice.base.eth                8. Same Basename appears
   4. Send $5 → confirmed                 9. Same balance, same yield
   5. See activity                        10. Send another $5 from here
                                          
                   Both surfaces sign over the SAME wallet.
                   Both surfaces talk to the SAME backend.
                   The user is one person, two screens.
```

This is the moment that wins the demo: the judge sees Kite running natively on a phone, *and* running inside Coinbase Wallet, *and* both showing the exact same balance and identity. Distribution and product converge.

## Hackathon scope cuts

If running short:

1. **Skip Base.dev registration during the build.** You can still demo the Mini App URL in a mobile browser — the judge sees it works as a real web app.
2. **Skip the sponsorship integration via OnchainKit.** Use plain wagmi for sends; mention "in production this is gas-sponsored via the Paymaster on the mobile side" verbally.
3. **Skip the activity feed.** Just show balance + yield + a working Send. That's enough for the demo punchline.

## Verification checklist

- [ ] `pnpm dev:miniapp` boots at `http://localhost:3002`
- [ ] "Connect with Base Account" opens the Base Account modal
- [ ] After connect, "Sign in to Kite" calls your backend and gets a JWT
- [ ] Home screen reads `KiteTreasury.balanceOf` and shows the user's balance
- [ ] Send form successfully transfers USDC and the tx confirms on Base Sepolia
- [ ] The Mini App shows the same data as the mobile app for the same wallet
- [ ] Public URL works in a mobile browser (test on a phone)

If all green: you have two surfaces sharing one identity. Move on.
