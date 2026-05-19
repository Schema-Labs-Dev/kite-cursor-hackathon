# 01 — Architecture

## System overview

```
        ┌─────────────────────────┐    ┌─────────────────────────┐
        │   Mobile App (Expo)     │    │  Web Mini App (Next.js) │
        │   Coinbase Smart Wallet │    │   wagmi + Base Account  │
        │   Native, App Store     │    │   Installs into:        │
        │                         │    │   - Coinbase Wallet     │
        │                         │    │   - Base App            │
        │                         │    │   - Any browser         │
        └──────┬──────────────┬───┘    └────┬───────────────┬────┘
               │              │             │               │
       REST    │              │ JSON-RPC    │ REST          │ JSON-RPC
               │              │             │               │
               ▼              ▼             ▼               ▼
        ┌──────────────────────────┐   ┌─────────────────┐
        │   NestJS API Backend     │   │   Base Sepolia  │
        │  ───────────────────     │   │   ───────────   │
        │  Auth (SIWE → JWT)       │   │  USDC contract  │
        │  Users / Profiles        │◄──┤  KiteTreasury   │
        │  Contacts                │   │  Basenames      │
        │  Activity feed (cached)  │   │  Smart Wallet   │
        │  Onramp webhooks         │   │  factory        │
        │  Indexer (viem listener) │   └─────────────────┘
        └─────────┬────────────────┘
                  │
            Prisma│
                  ▼
            ┌──────────────┐
            │   Postgres   │
            └──────────────┘
```

**Two surfaces, one backend.** The Mini App and the Mobile app are independent
clients. They share the same SIWE auth, the same REST API, the same database,
the same KiteTreasury contract, and — crucially — the same user identity. A
user who signs in on mobile sees their balance and Basename on the Mini App
the moment they connect that wallet, and vice versa.

## Two truths

1. **The wallet is the source of truth for money.** USDC balance and KiteTreasury deposits live onchain. The backend never holds funds.
2. **The backend is the source of truth for context.** Contacts, memos, display names, activity feed, push notifications — none of this fits onchain cheaply, so it lives in Postgres.

## Why a backend at all?

A self-custodial wallet alone could ship Hold + Send. But you need a backend for:

- **Mapping handles to addresses** — phone/email → wallet address registry
- **Friendly activity feed** — turning `0xabc...→0xdef...: 5 USDC` into "You sent $5 to Alice for coffee"
- **Push notifications** — when funds arrive
- **Onramp webhooks** — Coinbase Onramp posts completion events to a public URL
- **Rate limiting + abuse prevention**
- **Future: AI features** if we add them post-hackathon

## Ownership boundaries

### You own (backend + contracts + Mini App)

- `contracts/` — Solidity, Foundry, deployment scripts
- `apps/api/` — NestJS, Prisma migrations, REST endpoints
- `apps/miniapp/` — Next.js 16 + wagmi + Base Account (web Mini App for Coinbase Wallet / Base App)
- Indexer — viem-based event listener inside NestJS
- Database schema and seed data
- Auth flow (SIWE verification + JWT issuance)
- All endpoint contracts in [`06-api-spec.md`](./06-api-spec.md)
- Base.dev registration for the Mini App (see [`11-miniapp.md`](./11-miniapp.md))

### Friend owns (mobile)

- `apps/mobile/` — Expo, navigation, screens
- Smart Wallet integration on the client (Coinbase Smart Wallet SDK)
- Direct USDC transfers via Wagmi/Viem
- KiteTreasury deposit/withdraw transactions
- Calling your REST API for everything else
- Push notification client setup

### Shared

- `apps/web/` — existing landing page (no change for hackathon)
- [`08-mobile-handoff.md`](./08-mobile-handoff.md) — the contract between your two domains

## Critical technology choices

| Decision | Choice | Why |
|---|---|---|
| L2 | Base Sepolia | Free testnet, Coinbase ecosystem |
| Smart account | Coinbase Smart Wallet (ERC-4337) | Passkey auth out of the box |
| Identity | Basenames | Already integrated with OnchainKit |
| Gas | CDP Paymaster | Sponsored UX, no ETH for users |
| Backend | NestJS | Modular, opinionated, AI-friendly |
| ORM | Prisma | Type-safe, migration-first |
| DB | Postgres | Industry standard |
| Chain client | Viem | Modern, type-safe, fast |
| Contracts tooling | Foundry | Fastest dev loop, Cursor-friendly |

## What runs where (during the demo)

- **Mobile** — Expo on phone (or expo dev client in browser as fallback)
- **Mini App** — Next.js running on Vercel preview deploy (or `localhost:3002` via cloudflared tunnel)
- **Backend** — `localhost:3001` or a tunnel via `ngrok`/`cloudflared`
- **Postgres** — local Docker container
- **Contracts** — already deployed to Base Sepolia
- **Chain RPC** — public Base Sepolia RPC or Coinbase Developer Platform RPC

If Wi-Fi at the venue is unreliable, have a hotspot ready. The whole demo depends on hitting Base Sepolia at least twice.
