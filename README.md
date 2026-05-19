# Kite — Submission

> **Your dollars. On your phone. Set free.**
>
> A mobile-first dollar account built on **Base**. Hold USDC + EURC earning ~4.20% APY, send to any Basename for free, convert currencies on-chain, and spend with a sponsored gas-free Visa-style card. Designed for the 1.4 billion adults the global banking system left behind — Zambia first.

---

## The pitch in 30 seconds

- **Sign up in 8 seconds** — Face ID on your phone creates an ERC-4337 Coinbase Smart Account. No seed phrase, no email link, no app you don't already have.
- **Hold dollars (USDC) or euros (EURC)** — both real on-chain ERC-20s on Base Sepolia. Deposit either into the **multi-token KiteTreasury** to earn a simulated 4.20% APY, withdraw any time.
- **Send to any `@basename`** — typed name → resolved to a Base Sepolia address → real USDC `transfer()` settled in ~2s. Gas is **sponsored by Coinbase Developer Platform** so users never hold ETH.
- **Convert USDC ↔ EURC** — real **Uniswap V3** swap against a USDC/EURC pool we seeded on Base Sepolia. Live quotes via QuoterV2, sponsored gas, settles in seconds.
- **Tap-to-pay card** — press-and-hold the virtual Visa card → merchant sheet (`☕ Vidae Café · $4.50`) → Face ID → real on-chain USDC transfer to the merchant address. Looks and feels like Apple Pay, but every payment is a real on-chain receipt.
- **Add cash from Airtel Money / MTN Money / Card** — kwacha→USDC/EURC simulated onramp. After "confirming with provider" beat, the **admin wallet actually mints** USDC or EURC to your smart account at the live conversion rate. You get real tokens.

Every action settles a real transaction on Base Sepolia. Every screen has a BaseScan deep-link.

---

## What's live & deployed

### Backend

- **API**: <https://api-production-ca74f.up.railway.app/api/v1/health> (on Railway, Postgres-backed)
- **Indexer**: 6-second polling + **Alchemy webhook push** for sub-second tx pickup
- **Smart-account paymaster**: CDP Bundler + Paymaster (ERC-4337 / EIP-5792)

### Smart contracts (Base Sepolia, chain id 84532)

| Contract                              | Address                                      |
| ------------------------------------- | -------------------------------------------- |
| KiteUSDC (test stablecoin)            | `0xcE19877675761f5D5CEd3A12c0f4bf98c68055B5` |
| KiteEURC (test stablecoin)            | `0x99D88dF52473844b1473b9a4Dd6BA90fAAF0AB72` |
| KiteTreasury (multi-token vault)      | `0x289037aBB2cf9E2E7394917b1F9e050887D4b352` |
| Uniswap V3 USDC/EURC pool (0.01% fee) | `0x34813B465308208DeE7eAc892A4D08D149C82f60` |

All verifiable on [Base Sepolia BaseScan](https://sepolia.basescan.org/).

---

## Mobile setup (5 minutes)

Only the **mobile app** runs locally — the backend is already on Railway. Anyone with this repo + the env block below can run the demo end-to-end without touching the backend.

### Prerequisites

- **Node 20+** and **pnpm 9+** (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **Expo Go** on a phone (App Store / Play Store) — _or_ an iOS simulator if you have Xcode
- A device on Wi-Fi that can reach `expo.dev` for the dev bundle

### Steps

```bash
# 1. Clone + install
git clone <this-repo>
cd <repo>
pnpm install

# 2. Drop in the env file (copy-paste from the block below)
cp apps/mobile/.env.example apps/mobile/.env
# ...or just create apps/mobile/.env with the block below

# 3. Start Metro
cd apps/mobile
pnpm start

# 4. Scan the QR with Expo Go (iOS Camera works too)
```

The app boots straight into the Welcome screen → Get Started → onboarding → Face ID prompt → you're in. Whatever wallet/balance state your previous installs left in iOS Keychain will resurface — see "Reset for a fresh demo" below.

### Mobile `.env` (paste verbatim into `apps/mobile/.env`)

```bash
# Kite backend — already deployed on Railway, no local API needed.
EXPO_PUBLIC_API_URL=https://api-production-ca74f.up.railway.app/api/v1

# CDP bundler + paymaster (sponsors gas for every UserOp). Same URL serves
# both bundler RPC and paymaster RPC via ERC-7677. This is a hackathon-
# demo key — please rotate or replace if you fork the project.
EXPO_PUBLIC_CDP_RPC_URL=https://api.developer.coinbase.com/rpc/v1/base-sepolia/SPlq8IOwr7P8RYsW36ObKYD8RQVn9SWA

# Base Sepolia RPC (used for direct chain reads — balance polling, etc.)
EXPO_PUBLIC_BASE_RPC_URL=https://sepolia.base.org

# Contract addresses on Base Sepolia
EXPO_PUBLIC_KITE_TREASURY_ADDRESS=0x289037aBB2cf9E2E7394917b1F9e050887D4b352
EXPO_PUBLIC_USDC_ADDRESS=0xcE19877675761f5D5CEd3A12c0f4bf98c68055B5
EXPO_PUBLIC_EURC_ADDRESS=0x99D88dF52473844b1473b9a4Dd6BA90fAAF0AB72

# Block explorer (powers "View on BaseScan" deep-links from tx receipts)
EXPO_PUBLIC_BASESCAN_URL=https://sepolia.basescan.org
```

`EXPO_PUBLIC_*` is the Expo convention — these are inlined into the JS bundle at build time, so the values above are also visible in the shipped app and aren't secret beyond the rotation note on the CDP key.

After editing `.env`, **stop and restart Metro with cache clear** so the new values bundle in:

```bash
pnpm start --clear
```

---

## Demo tour (what to try)

Once you're signed in:

1. **Add money** — Home → **Add** → pick **Airtel Money** → `ZMW 250` → token **USDC** → phone `+260 *** *** ****` → Approve. ~3s later your USDC balance jumps by ~$9.26 — that's the admin wallet minting real test-USDC to your smart account at the live rate.
2. **Hold + earn** — Home → **Earn Interest** → pick USDC or EURC → enter amount → Deposit. Two real txs: ERC-20 approve + Treasury deposit. APY accrues lazily per position.
3. **Convert** — Home → Wallets → `⇄ convert` → flip USDC↔EURC → enter amount → see live quote from Uniswap V3 → Approve. Real swap on the seeded Uniswap pool.
4. **Send** — Home → Send → type a basename (autocomplete) or paste a `0x...` address → amount → optional note → Send. Real USDC transfer, sponsored gas.
5. **Card tap-to-pay** — Card tab → **press & hold the card** (1.1s, ring fills) → merchant sheet `☕ Vidae Café · $4.50` → Face ID → green-check receipt with a real txHash → BaseScan deep-link. Edit your name on the card by tapping "Name on card". Reveal full card number with **Show details** (Face ID).
6. **Receive** — Send screen → Get paid → real QR encoding `ethereum:<your-smart-account>@84532`. Anyone with a Base Sepolia wallet can scan and pay you.

Every action shows up on Activity (`/(tabs)/activity`) within seconds, and the chain interaction log is visible on the hidden `/debug` screen (long-press the Kite logo on the welcome screen).

---

## Architecture (one-paragraph version)

The mobile app is **Expo SDK 54 + React 19 + React Native 0.81** with file-based routing (`expo-router 6`), TanStack Query for server state, and `viem 2` + `permissionless 0.3` driving an on-device **Coinbase Smart Account** (ERC-4337) whose owner is a viem-derived EOA in `expo-secure-store`. All transactions become UserOps sponsored by **CDP Paymaster** → users never need ETH. The backend (NestJS + Prisma + Postgres on Railway) speaks SIWE (ERC-6492 verified via viem) for auth, indexes USDC/EURC/Treasury events from Base Sepolia, exposes a thin REST API the mobile app drinks from. Real Uniswap V3 routes USDC↔EURC against a pool we deployed and seeded with 50k of each on a fee-100 tier. Card payments mint memos through the indexer and surface as friendly merchant rows. Onramps run on the admin EOA calling `mint()` on the test stablecoins — judges get real tokens, no faucet required.

---

## What to look at in the code

- **Wallet bridge** — `apps/mobile/lib/wallet.ts` + `lib/smart-account.ts` (EOA-signed Coinbase Smart Account via permissionless + CDP)
- **Auth** — `apps/mobile/lib/auth.ts` (SIWE round-trip with viem-verified ERC-6492 sigs)
- **Send / Convert / Treasury / Card / Onramp hooks** — `apps/mobile/hooks/use-*.ts` (each is ~80 lines; they all share a clean "wallet.sendTransaction → memo → receipt + invalidate" shape)
- **Multi-token Treasury** — `contracts/src/KiteTreasury.sol` (per-token positions, lazy yield accrual)
- **Backend indexer + Alchemy webhook** — `apps/api/src/indexer/` + `apps/api/src/webhooks/` (polling + push, idempotent upserts)
- **Onramp** — `apps/api/src/onramp/` (admin-mint flow with rate-drift guard)
- **In-app chain logger** — `apps/mobile/lib/log.ts` + `app/debug.tsx` (every tx logged with tags; debug screen renders them live)

---
