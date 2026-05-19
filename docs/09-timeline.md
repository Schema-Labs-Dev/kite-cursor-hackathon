# 09 — Implementation Timeline

A pragmatic plan for ~8 hours of focused build, working in parallel with your friend.

## Pre-hackathon (the night before)

**~2 hours of prep that pays off massively.** Don't skip this.

| Task | Time | Owner |
|---|---|---|
| Get Base Sepolia ETH from faucet (deployer + 2 demo wallets) | 10 min | You |
| Get Base Sepolia USDC from Circle faucet (both demo wallets) | 10 min | You |
| Create CDP account, get Paymaster URL + API keys + OnchainKit API key | 20 min | You |
| Create Vercel account if you don't have one (for Mini App deploy) | 5 min | You |
| Pre-register on [Base.dev](https://www.base.dev) — create project draft | 10 min | You |
| Provision a domain or use a Cloudflare tunnel for the API | 20 min | You |
| Install Expo Go on phone, test it boots a hello-world app | 15 min | Friend |
| Coinbase Smart Wallet SDK install + read docs | 30 min | Friend |
| Read this entire `docs/` folder cover to cover | 30 min | Both |

If this prep doesn't happen, you'll burn 2 hours of hackathon time on faucet captchas.

## Hackathon day — your hour-by-hour

### Hour 0 — Setup (45 min)

- [ ] Pull latest, run [`02-monorepo.md`](./02-monorepo.md) restructure
- [ ] `docker compose up -d` for Postgres
- [ ] `pnpm install` at root
- [ ] Verify `pnpm dev:web` still serves the marketing site
- [ ] Create your `.env` files from `.env.example`
- [ ] Friend: scaffolds `apps/mobile/` and runs `npx expo start`

### Hour 1 — Smart contracts (1h 15min)

- [ ] Write `KiteTreasury.sol` (use [`03-smart-contracts.md`](./03-smart-contracts.md) verbatim)
- [ ] Write tests, run `forge test -vv`, fix until green
- [ ] Deploy to Base Sepolia via deploy script
- [ ] Verify on BaseScan
- [ ] Update `KITE_TREASURY_ADDRESS` in all `.env` files
- [ ] Copy ABI JSON to `apps/api/src/chain/abis/kite-treasury.ts`
- [ ] Send the address + ABI to your friend via Slack/Telegram

> **Checkpoint**: contract is live, both you and your friend have the address. Move on.

### Hour 2 — Backend skeleton (1h)

- [ ] `nest new apps/api` with pnpm
- [ ] Install all deps from [`04-backend-nestjs.md`](./04-backend-nestjs.md)
- [ ] Write `prisma/schema.prisma` from [`05-database-prisma.md`](./05-database-prisma.md)
- [ ] `prisma migrate dev --name init`
- [ ] Wire `PrismaModule`, `ConfigModule`, basic `app.module.ts`
- [ ] Add `GET /health` and verify it returns 200

### Hour 3 — Auth + Users + Treasury reads (1h 15min)

- [ ] Implement `AuthService` with SIWE verification + JWT
- [ ] Implement `POST /auth/nonce` and `POST /auth/verify`
- [ ] Implement `JwtAuthGuard`
- [ ] Implement `GET /me` and `PATCH /me`
- [ ] Implement `ViemService`
- [ ] Implement `GET /treasury/balance` and `GET /treasury/yield`
- [ ] Test all endpoints via curl or Bruno/Postman
- [ ] Generate JWT manually if needed for testing (fake user in DB)

> **Checkpoint**: friend can authenticate from mobile. Block until this works.

### Hour 4 — Indexer + transactions API (45 min)

- [ ] Add `@nestjs/schedule`, register `ScheduleModule`
- [ ] Implement `IndexerService` with USDC `Transfer` event polling
- [ ] Implement `GET /transactions` with pagination
- [ ] Implement `POST /transactions/memo`
- [ ] Implement `GET /users/resolve` (query by basename → DB; fallback to onchain ENS lookup)
- [ ] Manually send a USDC transfer between two test wallets, verify it shows up in the activity feed

### Hour 5 — Mini App build (1h 30m)

Follow [`11-miniapp.md`](./11-miniapp.md) verbatim.

- [ ] Scaffold `apps/miniapp/` with Next.js (already done in monorepo step)
- [ ] Install wagmi + viem + Base Account + OnchainKit
- [ ] Wire `WagmiProvider` + `OnchainKitProvider` in `app/providers.tsx`
- [ ] Build the `<SignIn />` component with SIWE → backend `/auth/verify`
- [ ] Build a minimal Home screen — balance read from `KiteTreasury`, send form
- [ ] Verify the Mini App shows the SAME balance as the mobile app for the same wallet
- [ ] `pnpm dlx vercel deploy --prod` to get a public URL
- [ ] Update Base.dev project draft with the Vercel URL

> **Checkpoint**: Mini App and Mobile app both signed in, both showing the same balance for the same wallet.

### Hour 6 — Mobile integration session (45 min)

- [ ] Sit with friend, get auth flow working end-to-end on real device
- [ ] Debug CORS, network connectivity, JWT expiry
- [ ] Push the indexer through a real Send flow with friend
- [ ] Pre-fund the demo wallets with extra USDC + ETH
- [ ] Test the full demo loop: sign in → see balance → send → see activity → see yield ticking

> **Checkpoint**: full demo path works on the friend's phone AND in the Mini App. From here, it's polish.

### Hour 7 — Hardening + polish (45 min)

- [ ] Pre-create the two "demo accounts" in the DB with known wallets
- [ ] Pre-claim Basenames for both demo accounts
- [ ] Set realistic display names + avatars on demo accounts
- [ ] Pre-deposit some USDC into KiteTreasury for the demo so yield is visibly ticking
- [ ] Verify all 3 demo screens (Home, Send, Activity) look pixel-clean on mobile
- [ ] Verify the Mini App URL works in a phone browser
- [ ] Submit the Base.dev project listing
- [ ] Mute / silence noisy logs

### Hour 8 — Demo dry-runs (30 min)

- [ ] Do the [`10-demo.md`](./10-demo.md) script end-to-end at least 3 times
- [ ] Time each run — target 2:30, max 3:00
- [ ] Identify and pre-empt the slow steps (faucet, gas, RPC)
- [ ] Have a backup video recording in case live demo fails
- [ ] Share screen layout: phone mirror + Mini App tab + BaseScan tab

### Hour 9 — Buffer + present (45 min)

Reserved for fixing whatever just broke. If everything works, use this for:

- [ ] Practising the verbal pitch (3 min — covered in `10-demo.md`)
- [ ] Preparing the one-page submission write-up
- [ ] Submitting to the hackathon platform
- [ ] Resting your voice

## Parallel track — what your friend does

| Hour | Friend's task |
|---|---|
| 0 | Scaffold Expo app, install Coinbase Smart Wallet SDK, set up NativeWind |
| 1 | Build the Welcome / onboarding screen + create Smart Wallet flow |
| 2 | Wire SIWE signing + auth flow against your `/auth/nonce` and `/auth/verify` |
| 3 | Build Home screen — balance, ticking yield, three big buttons |
| 4 | Build Send screen — recipient resolve, amount input, broadcast tx |
| 5 | Build Activity screen — pull from `GET /transactions` (you're heads-down on Mini App) |
| 6 | Integration debugging session with you |
| 7 | Polish, animations, demo dry-runs |
| 8 | Demo dry-runs together |
| 9 | Buffer |

## Risk dashboard

| Risk | Probability | Mitigation |
|---|---|---|
| Faucet runs out / rate-limited | Medium | Fund accounts the night before |
| Paymaster sponsorship fails | Medium | Fall back to user-paid gas; pre-fund demo wallets with ETH |
| Indexer falls behind RPC | Low | Show BaseScan link directly in the UI as the "proof" |
| SIWE verification fails on Smart Wallet (ERC-6492) | Medium | Test with fallback EOA early; have manual JWT ready as plan B |
| Phone can't reach localhost backend | High | Use cloudflared/ngrok tunnel; never demo against `localhost` |
| Demo wallet has no Basename | Low | Pre-claim both demo Basenames the night before |
| Mini App Vercel deploy fails at the venue | Low | Deploy hours before; have local cloudflared tunnel as backup |
| Base.dev review delays listing | High | Don't depend on it — demo the Mini App URL directly in a browser |
| Wi-Fi at venue dies | Medium | Have a 4G hotspot ready |

## Definition of "demo-ready"

- [ ] Two pre-funded demo accounts on Base Sepolia, both with USDC and ETH
- [ ] Both accounts have Basenames claimed
- [ ] One account has a Treasury deposit, yield visibly ticking
- [ ] A live send between the two accounts confirms in <10s
- [ ] BaseScan shows all txs publicly
- [ ] Activity feed updates within 15s of a tx
- [ ] Card screen mockup displays cleanly
- [ ] Mini App at public URL shows the **same balance and Basename** as the mobile app
- [ ] Mini App can broadcast a USDC send and the indexer picks it up

If all these are checked: you're ready. Go to [`10-demo.md`](./10-demo.md).
