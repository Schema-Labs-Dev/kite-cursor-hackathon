# Kite — Implementation Plan

This folder is the build manual for the Kite hackathon MVP. Read in order.

## Reading order

1. [`01-architecture.md`](./01-architecture.md) — system overview, who owns what
2. [`02-monorepo.md`](./02-monorepo.md) — repo restructure + tooling
3. [`03-smart-contracts.md`](./03-smart-contracts.md) — `KiteTreasury.sol` + Foundry
4. [`04-backend-nestjs.md`](./04-backend-nestjs.md) — NestJS modules + setup
5. [`05-database-prisma.md`](./05-database-prisma.md) — Prisma schema + migrations
6. [`06-api-spec.md`](./06-api-spec.md) — REST endpoints (mobile contract)
7. [`07-flows.md`](./07-flows.md) — auth, send, hold flows end-to-end
8. [`08-mobile-handoff.md`](./08-mobile-handoff.md) — what the mobile dev needs
9. [`09-timeline.md`](./09-timeline.md) — hour-by-hour build plan
10. [`10-demo.md`](./10-demo.md) — 3-minute demo script for judges
11. [`11-miniapp.md`](./11-miniapp.md) — Kite as a Base Mini App (web distribution)
12. [`12-mobile-integration.md`](./12-mobile-integration.md) — Wire every mobile screen to real data
13. [`13-roadmap.md`](./13-roadmap.md) — Build status + how to tackle remaining work
14. [`14-usdc-eurc-swap.md`](./14-usdc-eurc-swap.md) — Research: bridging USDC ↔ EURC on Base
15. [`15-card-demo.md`](./15-card-demo.md) — Card tap-to-pay demo (real USDC, simulated NFC)

## Ownership at a glance

| Domain | Owner | Stack |
|---|---|---|
| Smart contracts | You | Solidity + Foundry on Base Sepolia |
| Backend API | You | NestJS + Prisma + Postgres |
| Indexer / chain reader | You | Viem inside NestJS |
| **Mini App (web)** | **You** | **Next.js + wagmi + Base Account** |
| Mobile app | Friend | Expo (React Native) |
| Marketing site | Already done | Next.js 16 (`apps/web/`) |

## What we're building (MVP scope)

A working **Hold + Send** demo on Base Sepolia, shipped on **two surfaces**:

1. **Native mobile app** (Expo) — passkey + Coinbase Smart Wallet
2. **Web Mini App** (Next.js) — installs into Base App / Coinbase Wallet via Base.dev

Both surfaces share the same backend, contracts, and identity. The user features:

1. Sign up with passkey → Coinbase Smart Wallet → claim `you.base.eth`
2. Deposit testnet USDC → balance accrues yield (simulated APY in `KiteTreasury`)
3. Send to any Basename / address → gas sponsored by CDP Paymaster
4. Activity feed with friendly receipts
5. Card UI as **mockup only** — no live Rain integration
6. **"Add to Coinbase Wallet"** — Mini App version registers on Base.dev for discovery

## What we are NOT building

- Real Morpho integration (use simulated APY)
- Live Visa card / Rain integration
- MXN-pegged stablecoin (no Circle MXN on Base Sepolia)
- Streaming payroll, Kite Connect SDK
- MiniKit listing
- Tier 2 KYC / Persona

## Hackathon constraints

- **Time**: ~8 hours of focused build
- **Stack discipline**: only the technologies in `01-architecture.md`
- **Demo discipline**: every feature must work in the 3-minute demo or it doesn't ship
