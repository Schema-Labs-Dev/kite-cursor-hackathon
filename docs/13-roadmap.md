# 13 — Roadmap & Remaining Work

> Snapshot of where the build stands after Step 6 of `docs/12-mobile-integration.md`, plus a concrete plan for the pieces that are still open. Read this when you next sit down to code — it tells you exactly what's left and how to chip away at it.

---

## Where the build stands

All six steps from the integration plan are code-complete:

| Step | Outcome |
|---|---|
| 1 — Foundations | API client, auth/SecureStore, TanStack Query, hooks per resource, debug screen, auth-gated routing |
| 2 — Auth + basename DB-mirror | Real SIWE end-to-end, on-device EOA wallet (viem + `expo-secure-store`), `GET /basenames/check/:handle` (two-layer: on-chain `available()` + DB) |
| 3 — Home + Receive | Real balance / APY / QR / handle; hybrid mock+real "Money in motion" + "Wallets" sections with `<PreviewBadge />` |
| 4 — Activity + Tx detail | Real history with infinite-scroll paging, combined cache→mock→API lookup for detail, preview-tail of mock card/interest rows |
| 5 — Send | Real USDC `transfer()` broadcast + `POST /transactions/memo` round-trip + real txHash + measured settle time from `waitForTransactionReceipt` |
| 6 — Labeling pass | "Add" Alert; Card screen preview labels + disabled controls |

Backend endpoints added across steps: `GET /basenames/check/:handle`, `GET /transactions/:id`, `POST /transactions/memo`, `GET /contacts`. Indexer upsert now backfills placeholder rows from `POST /transactions/memo`.

---

## §6 — Labeling-pass detail (what landed in Step 6)

**Mobile (`apps/mobile/`)**

- `app/(tabs)/home.tsx` — the "Add" quick action now opens an honest `Alert` instead of silently no-opping:
  > *"Adding cash via Coinbase Onramp ships next. For testnet, fund your wallet from the Base Sepolia USDC faucet."*
  When CDP project ID is configured later, this becomes the Onramp launcher.

- `app/(tabs)/card.tsx`:
  - Replaced the `virtual · live` green status pill with `<PreviewBadge label="coming soon" />`.
  - Added `<PreviewBadge />` next to the `cashback this month` label.
  - Added `<PreviewBadge />` next to the `Recent` section title.
  - All three controls (Freeze / Show details / Apple Pay) now render `disabled` with 0.5 opacity — visually intact, no longer lie about pressability.
  - Numbers, layout, and the metal-card upgrade CTA all preserved.

### §6 coverage at a glance

| §   | Item                                     | Status                                   |
|-----|------------------------------------------|------------------------------------------|
| 6.1 | "Money in motion" hybrid (real Treasury row + mock routes) | ✅ Step 3 |
| 6.2 | "Add" quick action                        | ✅ Step 6 (Alert; Onramp path documented) |
| 6.3 | EURC / MXNB preview pills                 | ✅ Step 3                                |
| 6.4 | Card screen relabel                       | ✅ Step 6                                |
| 6.5 | Real tx hash + measured settle time       | ✅ Step 5                                |
| 6.6 | Time-based greeting                       | ✅ Step 3                                |
| 6.7 | Preview tail on Activity                  | ✅ Step 4                                |
| —   | Demo prep (pre-fund, pre-claim, pre-deposit) | ⚠️ Manual — see below                    |

---

## Demo prep — what you do (not me)

These need your hands on the wallets:

1. **Find your demo wallet addresses.** On a fresh install, run through onboarding once, then long-press the Welcome logo to reach `/debug`. The `useMe` block shows your `walletAddress`. Repeat for both demo accounts.
2. **Fund each wallet with Sepolia ETH for gas:** https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet (~0.05 ETH covers many transfers).
3. **Fund each wallet with Sepolia USDC:** https://faucet.circle.com → Network: *Base Sepolia* → Token: *USDC*. Get $100+ per wallet.
4. **Pre-claim basenames** by running through onboarding step 2 with a memorable handle per account. Per the current build that just reserves in our DB (the real on-chain `register()` is the §5.8 follow-up).
5. ~~**(Optional, makes the live yield visible on first load)** Deposit a chunk of USDC from each wallet into `KiteTreasury` …~~ ✅ **shipped** — Home now has a *Move to yield* button below "Money in motion" that opens `app/treasury.tsx` (modal) with a USDC/EURC picker, amount keypad, and Deposit/Withdraw toggle. The contract is multi-token; see `docs/12-mobile-integration.md` §10 for the full architecture.

---

## Remaining work — and how to tackle it

Five open threads. Ordered by impact on the hackathon demo.

### A · Mini App (`docs/11-miniapp.md`) — **biggest open item**

**Why it matters.** This is the distribution story for a Base hackathon. Same backend, same identity, same Basename — accessible from inside Coinbase Wallet and Base App without an App Store install. Judges click one link and they're in.

**How to tackle.**

1. Scaffold `apps/miniapp/` as a Next.js 16 app (mirror `apps/web/` versions). Add to `pnpm-workspace.yaml`.
2. Install: `wagmi`, `viem`, `@base-org/account` (or `@coinbase/onchainkit`), `@tanstack/react-query`, `siwe`.
3. Build two screens:
   - **Connect** — wagmi connector for Coinbase Smart Wallet, then SIWE round-trip against the existing `/auth/nonce` + `/auth/verify`.
   - **Home** — port the mobile Home layout. Reuse the same hooks shape (it's plain TanStack Query + fetch, browser-compatible). Balance card, real Treasury APY, send button.
4. Reuse `apps/mobile/lib/api.ts` patterns; store the JWT in `localStorage` instead of SecureStore.
5. Register on [base.dev](https://base.dev) so it surfaces inside Coinbase Wallet's Mini App tray.

**Effort.** ~4–6 hours. The auth + API path is already proven from mobile.

**Dependencies.** None — backend is ready.

---

### B · Real on-chain Basenames register + CDP Paymaster (§5.8)

**Why it matters.** Closes the "real Basenames on Base" loop. Removes the `paid in Sepolia ETH*` asterisk on Send. Lets us claim a name your friend can resolve from any ENS-aware app on Base.

**How to tackle.**

1. **Paymaster setup.** In CDP Dashboard → Paymaster product (Base Sepolia). Add `RegistrarController` `0x49aE3cC2e3AA768B1e5654f5D3C6002144A59581` and USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` to the allowlist. Allowlist function selectors: `register(RegisterRequest)`, `discountedRegister(...)`, `transfer(address,uint256)`. Copy the Paymaster URL into `EXPO_PUBLIC_CDP_PAYMASTER_URL` in `apps/mobile/.env`.
2. **Wallet bridge upgrade.** Today `lib/wallet.ts` is a plain viem EOA. To use a paymaster we need EIP-5792 (`wallet_sendCalls` with `capabilities.paymasterService`). Two paths:
   - **(a) Stay EOA, use a permissionless bundler** — wrap the EOA in a SimpleAccount via `permissionless` package. More moving parts.
   - **(b) Swap to Coinbase Smart Wallet** — proper passkey-backed Smart Wallet via `@mobile-wallet-protocol/client`. Requires a dev-client build (not Expo Go). This is the real product.
   - Recommended: **(b)** when you have a free afternoon. For the demo, **(a)** is fine if SDK setup blocks.
3. **Mobile claim flow.** Drop in `apps/mobile/lib/basenames.ts` per the snippet in `docs/12-mobile-integration.md` §5.8. Replace the `PATCH /me` call in the onboarding `handleClaim` with: (1) on-chain `register()` via wallet, wait for receipt, (2) `PATCH /me { basename, displayName }` as a DB mirror. On chain failure, fall back to DB-only path that exists today.
4. **Backend indexer addition (nice-to-have).** Subscribe to `NameRegistered` events on `BaseRegistrar` (`0xa0c70ec36c010b55e3c434d6c6ebeec50c705794`); when `owner` matches a known Kite user, write the resulting `<name>.base.eth` to `user.basename`. Auto-heals the DB if the mobile mirror call fails.

**Effort.** ~6–10 hours depending on (a) vs (b).

**Dependencies.** CDP account, Paymaster set up. If going path (b), Expo dev-client build infrastructure.

---

### C · ERC-6492 SIWE verifier (§5.1)

**Why it matters.** Only matters when (B) lands and the wallet bridge switches from EOA to Coinbase Smart Wallet. Smart Wallet signs SIWE messages with an ERC-6492 wrapper before deployment — the current `siwe` library v3 in `auth.service.ts` doesn't verify those.

**How to tackle.**

1. Inside `AuthService.verifySiwe`, replace `siweMessage.verify({ signature })` with viem's `publicClient.verifyMessage({ address, message, signature })`. viem handles EOA + ERC-1271 + ERC-6492 uniformly.
2. Inject `ViemService` into `AuthModule` (already exported globally).
3. Keep all the nonce / replay-protection logic unchanged.

**Effort.** ~30 minutes. Five-line edit.

**Dependencies.** Do this *together with* (B), not before — if you ship it now while the EOA is still in use, you're trading one working verifier for another untested one with no behavior change visible to users.

---

### D · L2 resolver lookup for off-Kite `*.base.eth` recipients (§5.5)

**Why it matters.** Today, if a user types `alice.base.eth` on the Send screen and Alice isn't a Kite user, we show *"We can't pay an off-Kite basename yet — paste their 0x address."* With this, any Basename in the Base ecosystem becomes a valid recipient.

**How to tackle.**

1. Backend: add `GET /api/v1/basenames/resolve/:name`. Compute the ENS namehash, call `L2Resolver.addr(node)` at `0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA`. viem exposes `publicClient.getEnsAddress({ name, universalResolverAddress })` — point it at the Base L2 resolver. ~15 lines including error handling.
2. Mobile: in the `Send` screen's `PickStage`, when `useResolveUser` finds no Kite user *and* input matches `^[a-z0-9-]+\.base\.eth$`, call the new endpoint. If it returns an address, render a synthetic contact card (`displayName: name`, `onKite: false`) and allow the send.

**Effort.** ~1 hour total (backend + mobile).

**Dependencies.** None.

---

### E · Misc backend follow-ups (`docs/12-mobile-integration.md` §5.7, §4)

**Why it matters.** Small polish that may or may not be worth the time.

- **`POST /transactions/refresh`** — runs `indexer.processOnce()` on demand so the success screen reflects `CONFIRMED` faster than the 6 s tick. Only matters if the demo feels laggy. ~10 lines.
- **Rename `treasury.balance.accruedYield` → `accruedYieldSinceLastSync`** — the label on mobile already says `live`, so this is purely backend honesty. Optional.

**Effort.** Each ~15 minutes.

---

## Explicitly NOT building (recap from `docs/README.md:46-53`)

- Real Morpho integration (yield is fixed-simulated in `KiteTreasury.sol`).
- Real Visa card / Rain integration.
- ~~EURC live balances~~ — shipped (real `walletEurc` read in `/treasury/balance`, Home renders it). EURC sends via the Send screen still deferred (the treasury Deposit/Withdraw flow now supports EURC end-to-end; see `docs/12-mobile-integration.md` §10).
- MXN-pegged stablecoin (no Circle MXN on Base Sepolia).
- Streaming payroll / Kite Connect SDK.
- MiniKit official listing (the Mini App ships, but the Base.dev listing comes later).
- Tier 2 KYC / Persona.
- Push notifications, invites (tables exist in `schema.prisma`, no controllers).

If the hackathon judges ask about any of these, the honest answer is "shipped to Mainnet in the next sprint, here's the architecture diagram."

---

## Suggested ordering for the next session

1. **A (Mini App)** — biggest demo-impact, no upstream dependencies.
2. **D (L2 resolver lookup)** — one-hour win that closes a visible UX gap on Send.
3. **B + C (real Basenames + paymaster + ERC-6492)** — bundled because they're entangled.
4. **E (misc polish)** — only if there's time after the above.

The Mini App, once shipped, is what gets demoed as the "three million wallets reach Kite for free" moment.
