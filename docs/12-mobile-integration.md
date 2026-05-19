# 12 — Mobile Integration

> Wire every screen in `apps/mobile/` to real data where we can. This doc walks the app screen-by-screen, says exactly what the screen needs, what the backend gives today, what is missing, and what to add or change.
>
> **The mobile app is the source of truth for UX.** Where the backend doesn't fit, the backend changes — not the mobile UI.
>
> **Nothing in the mobile UI gets deleted.** Sections that can't be backed by real data in the MVP stay in place with their existing mock data and a small `preview` / `coming soon` label. The visual app the user sees does not regress.

---

## 0 · Approach

1. **Real where we can, mocked where we can't — never deleted.** Anything we can back with on-chain or DB data is wired to the API. Anything we can't (yield routes, EURC/MXNB, card features, etc.) keeps reading from `constants/mock-data.ts` and gets a discreet `preview` badge so the demo stays honest without losing the visual story.
2. **One new shared layer in mobile.** Today every screen reads from `constants/mock-data.ts`. We add a thin `lib/api.ts` + a small set of TanStack-Query hooks alongside the mock data. Screens read from hooks for live fields and from mock-data for preview fields. The mock-data file stays — it is the fallback.
3. **Backend additions are tiny.** Only three new endpoints are needed (`POST /transactions/memo`, `GET /contacts`, `GET /basenames/check`). One existing endpoint (`GET /transactions`) gets a small shape tweak so mobile can render without remapping every field.
4. **Wallet writes bypass the backend.** USDC `transfer()` and `KiteTreasury.deposit()/withdraw()` are signed on-device with the Coinbase Smart Wallet SDK and broadcast directly via viem. The backend learns about them through the existing 6s indexer.

---

## 1 · Mobile foundations to add

These don't exist yet and every screen below assumes them. Build once, reuse everywhere.

### 1.1 `apps/mobile/lib/api.ts` — typed REST client

A `fetch` wrapper that:
- Reads `process.env.EXPO_PUBLIC_API_URL` (already in `.env.example:28`).
- Reads JWT from `expo-secure-store` and attaches `Authorization: Bearer …`.
- Throws on non-2xx with a typed `ApiError`.
- Exposes `api.get<T>(path)`, `api.post<T>(path, body)`, `api.patch<T>(path, body)`.

### 1.2 `apps/mobile/lib/auth.ts` — auth store

- `getToken()` / `setToken()` / `clearToken()` using `expo-secure-store`.
- `signIn(walletAddress, signMessage)` — runs the SIWE flow against `/auth/nonce` + `/auth/verify`. Pattern from `docs/08-mobile-handoff.md:75-101`.
- `signOut()` — clears JWT, resets query cache, sends user back to `/onboarding`.

### 1.3 `apps/mobile/lib/wallet.ts` — Coinbase Smart Wallet bridge

- Wraps `@mobile-wallet-protocol/client` (the current name of the SDK referenced in `docs/08-mobile-handoff.md:27`).
- `getOrCreateWallet()` returns `{ address, signMessage, sendTransaction }`.
- `signMessage(message: string)` returns the SIWE signature (may be ERC‑6492 wrapped — see §5.1).
- `sendUSDC(to, dollars)`, `depositTreasury(dollars)`, `withdrawTreasury(dollars)` — encode call data with viem and send via the Smart Wallet, returning `txHash`.

### 1.4 `apps/mobile/lib/query.ts` — TanStack Query client

- Single `QueryClient` with defaults: `staleTime: 30_000`, `refetchOnAppFocus: true`.
- `<QueryClientProvider>` mounted in `apps/mobile/app/_layout.tsx`.

### 1.5 `apps/mobile/hooks/` — one hook per resource

| Hook | Wraps |
|---|---|
| `useMe()` | `GET /me` |
| `useTreasuryInfo()` | `GET /treasury/info` |
| `useBalance()` | `GET /treasury/balance` (refetch every 10 s while screen is focused) |
| `useTransactions()` | `GET /transactions` (infinite query on `nextCursor`) |
| `useResolveQuery(q)` | `GET /users/resolve?q=` (debounced 250 ms) |
| `useContacts()` | `GET /contacts` (see §5.3) |
| `useBasenameAvailability(handle)` | `GET /basenames/check/:handle` (see §5.4) |
| `useSendUsdc()` | mutation: wallet write + `POST /transactions/memo` |

### 1.6 Authenticated routing

`apps/mobile/app/index.tsx` (currently the marketing welcome) becomes a redirect gate:
- If there is a stored JWT and `useMe()` succeeds → `router.replace('/(tabs)/home')`.
- Otherwise show the welcome view (extract current `index.tsx` body into a `WelcomeScreen` component).

---

## 2 · Screen-by-screen integration

For each screen: **What it shows → What is currently mocked → Target real source → Gaps → Action items.**

---

### 2.1 Welcome — `apps/mobile/app/index.tsx`

**Shows.** Hero copy, three pillar bullets, "Get started" CTA.

**Mocked today.** Static copy, hardcoded pillars (`apps/mobile/app/index.tsx:74-78`).

**Target real source.** None needed; static. Add the auth-gate behavior from §1.6.

**Action items.**
- [ ] Move the existing JSX into `components/welcome/WelcomeScreen.tsx`.
- [ ] Rewrite `app/index.tsx` to check `useMe()` and redirect to `/(tabs)/home` if signed in, otherwise render `WelcomeScreen`.

---

### 2.2 Onboarding — `apps/mobile/app/onboarding.tsx`

**Shows.** Three steps: `passkey` → `basename` → `done`.

**Mocked today.**
- `handlePasskey` (`onboarding.tsx:21-28`) waits 1.3 s and advances.
- `handleClaim` (`onboarding.tsx:30-34`) flips to `done` and routes home — no chain or backend call.
- Handle availability is hardcoded to `available` (`onboarding.tsx:131-134`).

**Target real source.**

| UI step | Real source |
|---|---|
| passkey | `wallet.getOrCreateWallet()` → `signMessage(SIWE)` → `POST /auth/nonce` + `POST /auth/verify` → store JWT |
| basename — availability | `GET /basenames/check/:handle` (new — §5.4) |
| basename — claim | `PATCH /me { basename: '<handle>.base.eth', displayName: '<handle>' }` |
| done | `useMe()` refetched, then `router.replace('/(tabs)/home')` |

**Gaps.**
- No SIWE wiring at all in mobile.
- No availability check.
- No claim path. **Update:** for a Base hackathon we should claim real Basenames on-chain. See §5.8 for the full path (RegistrarController on Base Sepolia, gasless via Paymaster). The DB-only fallback below is the second choice and only used if the on-chain path fails on demo day.

**Action items.**
- [ ] Replace `handlePasskey` with `auth.signIn(...)` from §1.2 using the wallet from §1.3.
- [ ] Debounce the handle input. Resolve availability against the real Basenames `RegistrarController.available(name)` view (§5.8). Render `available · sponsored by Kite` only when the on-chain check returns true; otherwise render `taken — try another`.
- [ ] Replace `handleClaim` with a two-phase call:
  1. **On-chain:** `wallet.sendTransaction` calling `RegistrarController.register(...)` (or `discountedRegister(...)` if a Coinbase-product discount key applies) with the gas paid by CDP Paymaster (§5.8). Wait for the receipt.
  2. **Backend mirror:** `api.patch('/me', { basename: \`${handle}.base.eth\`, displayName: handle })` so the API has a fast cache of the user's name. The DB still enforces `@unique`; on 409 (P2002) the on-chain claim happened but our cache is out of sync — refetch and continue.
- [ ] On the `done` step, invalidate `useMe()` then redirect.
- [ ] Fallback (only if on-chain claim throws): skip phase 1, do phase 2 only, log a warning. The user gets a name in our DB; we backfill the on-chain claim later.

---

### 2.3 Home — `apps/mobile/app/(tabs)/home.tsx`

**Shows (top to bottom).**
1. Greeting + avatar + handle.
2. Balance card with APY pill and "today" yield (`components/sections/balance-card.tsx`).
3. Quick actions: Add / Send / Receive / Card.
4. "Money in motion" — `yieldRoutes` (Morpho 68 %, Aave 24 %, Spark 8 %).
5. "Wallets" — USDC, EURC, MXNB.
6. "Activity" preview (4 most recent).

**Mocked today.** Everything: `me`, `transactions`, `yieldRoutes`, `currencies` from `constants/mock-data.ts:25-141`.

**Target real source.**

| UI element | Endpoint / source | Notes |
|---|---|---|
| Avatar initial | `useMe()` → `displayName?.[0] ?? walletAddress.slice(2,3)` | Drop the `me.initial` field |
| Greeting label | client-side from `new Date().getHours()` | No backend |
| Handle | `useMe().basename?.split('.')[0] ?? short(walletAddress)` | |
| Balance whole/cents | `useBalance().treasury.total.formatted` | `TreasuryService.getBalance` already returns this exact shape (`treasury.service.ts:89-97`) |
| APY pill | `useTreasuryInfo().apy.percent` | `treasury.service.ts:44-50` — already returns `"4.20%"` |
| "today" yield | `useBalance().treasury.accruedYield.formatted` | Already exposed; this is `pendingYield` since last interaction, not literal "today" — re-label as `since last sync` |
| Quick actions | client-side navigation | `Add` button = §6.2 |
| Yield routes — real row | `useTreasuryInfo()` → render one row `Kite Treasury · Base Sepolia` with `share: 100%`, `apy: info.apy.decimal * 100` | Backed by the deployed `KiteTreasury` at `0xFF38…997b` |
| Yield routes — preview rows | **keep mocked** from `yieldRoutes` (`mock-data.ts:130-134`) below the real row, with a `preview · routing roadmap` chip on the group | Morpho/Aave/Spark routing doesn't exist on-chain in MVP — see §6.1 |
| Wallets | USDC row → `useBalance().walletUsdc.formatted`. EURC row → `useBalance().walletEurc.formatted` (real on-chain ERC-20 read at `0x808456652fdb597867f38412077A9182bf77359F`, funded via Circle's Base Sepolia faucet). MXNB removed entirely. | Both rows are real |
| Activity preview | `useTransactions()` first page, slice(0,4) | |

**Gaps.**
- No way to get the user's wallet address before SIWE is done — but we only render Home after auth, so `useMe()` will always have `walletAddress`.
- "today" yield in the mock is a daily figure; `pendingYield` is "since last user interaction with the contract." They are not the same number. Cheapest honest fix is to rename the field on the UI from `today` to `live`.

**Action items.**
- [ ] Stop importing `me` for live fields; **keep** importing `currencies` and `yieldRoutes` for the preview sections.
- [ ] Replace `<BalanceCard balance={…} apy={…} yieldToday={…} />` with hook values; pass `apy` from `useTreasuryInfo`, `balance` and `yieldToday`/`yieldLive` from `useBalance`.
- [ ] Inside `BalanceCard`, change the `today` row label to `live` (single-word edit at `balance-card.tsx:36`).
- [ ] **Keep** the "Money in motion" section (`home.tsx:56-75`). Prepend a real `Kite Treasury · Base Sepolia` row driven by `useTreasuryInfo()` (APY) and `useBalance()` (so the bar fills at 100% of whatever principal exists). Render the existing `yieldRoutes` rows underneath the real row with a `preview · routing roadmap` chip on that subgroup (§6.1).
- [ ] Wire the "Wallets" section (`home.tsx`) to real on-chain ERC-20 balances: USDC row → `useBalance().walletUsdc.formatted`, EURC row → `useBalance().walletEurc.formatted`. MXNB row removed (no MXN stablecoin on Base Sepolia). See §6.3.
- [ ] Wire `Add` to either a Coinbase Onramp URL (§6.2) or leave it as a no-op pressable that triggers a toast `"Buying soon"`.

---

### 2.4 Activity — `apps/mobile/app/(tabs)/activity.tsx`

**Shows.** Title, this-month in/out totals, All/Received/Sent filter, day-grouped tx list.

**Mocked today.** `transactions` from `mock-data.ts:49-128`, with the mock-only `kind` field driving icons and copy.

**Target real source.** `useTransactions()` → backend already returns the right shape from `TransactionsService.shape` (`transactions.service.ts:71-98`). The mobile-side `kind` enum (`send | receive | card | interest | add`) maps from backend `type` + `direction`:

| Mobile `kind` | Source |
|---|---|
| `send` | `type === 'TRANSFER' && direction === 'OUT'` |
| `receive` | `type === 'TRANSFER' && direction === 'IN'` |
| `deposit` (new) | `type === 'TREASURY_DEPOSIT'` (rendered with the existing `add` icon — green plus on mint background) |
| `withdraw` (new) | `type === 'TREASURY_WITHDRAW'` (rendered with the existing `send` icon — arrow up-right) |
| `card`, `interest`, `add` | **keep** in the type union; real data never produces these yet, but the icons / colors stay available for the preview tail (see below) |

**Preview tail.** Append a short, clearly-tagged tail of mock card / interest / "added cash" rows from `mock-data.ts:49-128` underneath the live list, grouped under a `Preview · sample card & cashback` day-label. They make the activity screen feel inhabited during the demo without claiming to be real. Drop the tail entirely if at demo time the real list has ≥ 6 rows.

This-month in/out totals can be computed client-side from the loaded pages (good enough for ≤500 txs).

**Gaps.**
- Mobile types in `mock-data.ts:13-23` use `amount: number` (signed); backend returns `amount: { raw: string, formatted: string }`. Mobile needs a `toDisplayTx()` mapper.
- Day grouping in `activity.tsx:12-23` uses `timestamp`; backend field is `createdAt`. One field rename in the mapper.
- Filter chip currently runs client-side. Fine — keep client-side filter, push it down later if perf matters.

**Action items.**
- [ ] Create `apps/mobile/lib/tx-mapper.ts` that turns an API tx into the existing mobile `Transaction` shape (or, cleaner, refactor `ActivityRow` and `tx/[id].tsx` to consume the API shape directly).
- [ ] Replace `transactions` import with `useTransactions()`; render a loading skeleton (4 rows) on first load.
- [ ] Add `onEndReached` to load `nextCursor`.
- [ ] Make the "in/out · this month" stats reduce over the loaded list, filtered by `createdAt` month.

---

### 2.5 Card — `apps/mobile/app/(tabs)/card.tsx`

**Shows.** Card visual, status pill `virtual · live`, three controls (Freeze / Show details / Apple Pay), cashback progress, upgrade CTA, card-only tx list.

**Mocked today.** All of it. `me.cardLast4`, `me.cashbackThisMonth`, `me.cashbackCap`, controls do nothing, card-only filter relies on the mock-only `kind: 'card'`.

**Target real source.** **None in MVP.** There is no card issuer integration (`docs/README.md:48`, BRIEF.md positions card as Q2-style roadmap).

**Action items.**
- [ ] Change status pill from `virtual · live` to `preview` (`card.tsx:23`).
- [ ] **Keep** the cashback block with its current mock numbers; add a small `preview` chip next to the `cashback this month` label so nobody mistakes it for real spending.
- [ ] **Keep** the "Recent · card only" section reading from `mock-data.ts` card txs — without it the screen looks broken. Re-label the section header `Recent · preview`.
- [ ] **Keep** the three controls visually but render them `disabled` and 0.5 opacity, so taps don't lie about behavior.
- [ ] Leave the metal-card CTA as-is; it already says "upgrade" without claiming the feature works.

---

### 2.6 Send — `apps/mobile/app/send/index.tsx`

**Shows.** Three stages: `pick` recipient → `amount` keypad → `success`.

**Mocked today.**
- Recipient list from `contacts` (`mock-data.ts:40-47`).
- `onSend` (`send/index.tsx:55-59`) just flips to `success`; no chain call.
- Success screen shows a hardcoded tx hash `0x9fa1…2d4f` and `settled in 2.1s` (`send/index.tsx:220`).
- `me.balance` cap (`send/index.tsx:53`) is a mock number.

**Target real source.**

| UI element | Real source |
|---|---|
| Recent contacts | `useContacts()` (new — §5.3) |
| Type-to-resolve | `useResolveQuery(q)` calls `GET /users/resolve` (exists, `users-public.controller.ts:17`) |
| Paste-an-address path | Treat any string matching `/^0x[a-fA-F0-9]{40}$/` as a destination; show a synthetic contact card (no `displayName`) |
| Balance cap | `useBalance().walletUsdc.formatted` (USDC the user can actually send; principal sitting in `KiteTreasury` is not spendable until withdrawn) |
| Send transaction | `wallet.sendUSDC(to, amount)` then `POST /transactions/memo { txHash, memo }` (new — §5.2) |
| Success tx hash | Real `txHash` returned by `sendUSDC` |
| "settled in 2.1s" | Measure wall-clock between `sendUSDC` call and `waitForTransactionReceipt({hash})` resolving |

**Gaps.**
- Mobile uses `me.balance` (the total USDC + treasury position). When sending we must check **wallet USDC only**, since the treasury balance is not directly spendable.
- The `pick` list assumes everyone is "on Kite." Real contacts derived from past transactions may include external addresses — show the `on Kite` chip only when `contact.userId !== null`.
- If the recipient has a Basename but no Kite account, we need to resolve the Basename → 0x address. **Not in MVP** — see §5.5 caveat.

**Action items.**
- [ ] Wire `query` to `useResolveQuery(query)`; combine results with `useContacts()` (recents first, search results below).
- [ ] Validate `amountNum <= walletUsdc.formatted` instead of `me.balance`.
- [ ] Replace `onSend` with `useSendUsdc().mutateAsync({ to, amount, memo: note })`.
- [ ] On success, show the real `txHash` (truncated middle-ellipsis) and the measured settle time.
- [ ] On the success screen, route the "Done" button to `/(tabs)/home` and let TanStack Query invalidate `useBalance` + `useTransactions` so the new tx appears.

---

### 2.7 Receive — `apps/mobile/app/receive.tsx`

**Shows.** Avatar, display name, basename, QR code (`ethereum:<address>@84532`), copy buttons for basename + address, share sheet.

**Mocked today.** All `me.*` fields from `mock-data.ts:25-38`.

**Target real source.** Pure consumer of `useMe()`. The QR encoding format is already correct (Base Sepolia chainId 84532, `receive.tsx:51`).

**Action items.**
- [ ] Swap `me` for `useMe()` values. Compute `initial` from `displayName?.[0]`.
- [ ] Build the share message from real data: `Pay me on Kite — ${basename ?? short(address)}`. Drop the `kite.cash` URL or replace with an env-driven `EXPO_PUBLIC_PROFILE_BASE_URL`.

---

### 2.8 Transaction detail — `apps/mobile/app/tx/[id].tsx`

**Shows.** Hero icon by kind, signed amount, counterparty name, note/category, fact rows (when, network, asset, fee, optional cashback), tx hash with copy, "View on BaseScan" link.

**Mocked today.** `transactions.find(...)` from `mock-data.ts`. Uses the mock-only `kind`, `cashback`, and `category` fields.

**Target real source.** `useTransactions()` cache → find by `id`. If not present (e.g. user opened a deep link), fall back to a new `GET /transactions/:id` endpoint (cheap to add — §5.6) or refetch the list.

**Gaps.**
- `cashback` and `category` don't exist in the backend tx shape (`transactions.service.ts:82-98`). For real txs the mapper sets them to `undefined`; the existing conditional `tx.cashback ? <Fact … /> : null` (`tx/[id].tsx:86`) already hides them gracefully.
- `counterparty` on the backend is a typed object (`{kind, displayName, basename, address, ...}`); current detail screen prints `tx.counterparty` as a string. Adjust to render `displayName ?? basename ?? short(address)`.
- "Network fee · sponsored" is true only when the tx is gas-sponsored. For MVP every Smart-Wallet send is sponsored, so the static label is fine.
- Mock preview txs (card / interest / add) keep their original `cashback`/`category` values and render exactly as today.

**Action items.**
- [ ] Replace the `transactions.find` lookup with a combined lookup: first check the TanStack Query cache, then fall back to the mock list (`mock-data.ts:49-128`) so preview rows still open, then `GET /transactions/:id` (§5.6) as a network fallback.
- [ ] **Keep** the cashback `<Fact>` row guarded by `tx.cashback`; preview txs continue to show it, real txs hide it automatically.
- [ ] Change `tx.category ?? tx.note` to `tx.memo ?? tx.category ?? tx.note ?? ''` so both real and preview rows render.
- [ ] Render counterparty as `displayName ?? basename ?? short(address) ?? tx.counterparty` (the trailing fallback covers preview rows where `counterparty` is a plain string).
- [ ] Map `type + direction` → label: `Sent` / `Received` / `Deposited to Treasury` / `Withdrew from Treasury` for real txs; preview rows keep using `iconFor(kind).label`.

---

## 3 · Backend endpoint coverage at a glance

| Endpoint | Method | Auth | Status today | Used by mobile |
|---|---|---|---|---|
| `/api/v1/health` | GET | – | ✅ done | none (devops) |
| `/api/v1/auth/nonce` | POST | – | ✅ done | Onboarding |
| `/api/v1/auth/verify` | POST | – | ✅ done | Onboarding |
| `/api/v1/me` | GET | JWT | ✅ done | Home, Receive, Onboarding gate |
| `/api/v1/me` | PATCH | JWT | ✅ done | Onboarding (basename claim), Settings (future) |
| `/api/v1/users/resolve?q=` | GET | JWT | ✅ done | Send |
| `/api/v1/treasury/info` | GET | – | ✅ done | Home |
| `/api/v1/treasury/balance` | GET | JWT | ✅ done | Home, Send (cap) |
| `/api/v1/transactions` | GET | JWT | ✅ done | Activity, Home preview |
| `/api/v1/transactions/:id` | GET | JWT | ❌ **add** (§5.6) | Tx detail deep-link |
| `/api/v1/transactions/memo` | POST | JWT | ❌ **add** (§5.2) | Send (post-broadcast) |
| `/api/v1/contacts` | GET | JWT | ❌ **add** (§5.3) | Send recents |
| `/api/v1/basenames/check/:handle` | GET | JWT | ❌ **add** (§5.4) | Onboarding |

No endpoint needs to be deleted. Several need small contract changes (§4).

---

## 4 · Backend endpoint changes (existing routes)

### 4.1 `GET /me` — add a couple of fields

Today returns `{ id, walletAddress, basename, displayName, email, avatarUrl, createdAt, updatedAt }` (`users.service.ts:19-33`).

Mobile also wants:
- `phone` (already in the schema, just not selected).
- A derived `initial` is **not** needed — compute on the client.

**Change.** Add `phone: true` to the `select` in `UsersService.getById` and in `updateMe`.

### 4.2 `GET /treasury/info` — shape unchanged

Already returns `apy.percent` (`"4.20%"`) and addresses. Mobile uses `apy.percent` directly. ✅

### 4.3 `GET /treasury/balance` — clarify field names

Mobile's "today" yield label is misleading vs. `accruedYield` (which is "since last on-chain interaction"). Either:
- **Option A (preferred):** rename `accruedYield` → `accruedYieldSinceLastSync` in the API response. Mobile labels it `live`.
- Option B: keep the field name, change the mobile label to `live`. (Done in §2.3 either way.)

Pick Option A for clarity. One-line change in `treasury.service.ts:94`.

### 4.4 `GET /transactions` — small shape additions

The existing shape (`transactions.service.ts:71-98`) is good. Add two derived fields so mobile doesn't replicate logic in three places:

| New field | Value |
|---|---|
| `displayKind` | `'send' | 'receive' | 'deposit' | 'withdraw'`, derived from `type` + `direction` |
| `counterparty.shortAddress` | `address.slice(0,6) + '…' + address.slice(-4)` when no `displayName`/`basename` |

Both are one-liners in `TransactionsService.shape` / `counterparty`.

Also: the response is currently `{ items, nextCursor }`. Keep that — it matches TanStack Query's `useInfiniteQuery({ getNextPageParam: last => last.nextCursor })`.

---

## 5 · New backend pieces

### 5.1 SIWE on Smart Wallet — verify ERC‑6492 wrapped signatures

The `siwe` library v3 in `auth.service.ts:55-58` uses its built-in verifier, which **only handles EOA + ERC‑1271**. Coinbase Smart Wallet signs SIWE messages with an **ERC‑6492 wrapper** before the wallet is deployed.

**Fix.** Inside `AuthService.verifySiwe`, replace the `siweMessage.verify({ signature })` call with viem's `publicClient.verifyMessage({ address, message, signature })`. viem handles EOA + ERC‑1271 + ERC‑6492 uniformly. Keep all the nonce / replay-protection logic unchanged.

This is a five-line edit in `auth.service.ts` plus injecting `ViemService`.

### 5.2 `POST /transactions/memo` — attach a note to a just-broadcast tx

The send flow signs and broadcasts on-device, then needs to tell the backend "this tx hash should carry this memo." The indexer will fill in the rest a few seconds later.

```http
POST /api/v1/transactions/memo
Authorization: Bearer <jwt>
Content-Type: application/json

{ "txHash": "0x…", "memo": "lunch on me" }
```

**Behavior.**
- Upsert by `txHash`. If the indexer hasn't seen the tx yet, create a row with `status: PENDING` and the memo. When the indexer later sees the on-chain event, its existing `upsert` keeps `update: {}` (`indexer.service.ts:213-218`) — so the memo survives.
- Reject if the caller is neither sender nor recipient (we know the caller's `walletAddress` from JWT, and the memo POST must include both `txHash` and a hint of `toAddress` so we can authorise before the event lands).

**Suggested signature:**

```ts
POST /transactions/memo
{ txHash: string, toAddress: string, amount: string, memo: string }
// returns 202 Accepted, { id }
```

The indexer will later fill in `blockNumber`, `txType`, `toUserId`, etc.

**Change `indexer.service.ts` upsert** from `update: {}` to `update: { blockNumber, fromUserId, toUserId, status: 'CONFIRMED' }` so the late-binding fields overwrite the placeholder row.

### 5.3 `GET /contacts` — recent counterparties

For the Send screen "Recent" list. No `Contact` rows exist yet (the table is in the schema but nothing writes to it). Cheapest implementation: derive from the user's last N transactions.

```http
GET /api/v1/contacts
→ { items: [{ userId, walletAddress, basename, displayName, avatarUrl, lastTxAt }] }
```

**Implementation.** `prisma.transaction.findMany({ where: OR fromUserId/toUserId, distinct: counterpartyUserId, orderBy createdAt desc, take 12 })`, then hydrate user data. Skip TREASURY rows. Skip rows with no counterparty user (external addresses can come later).

Putting the explicit `Contact` table on the back burner is fine — `docs/06-api-spec.md:343-354` already lists contacts as "skip" for hackathon priority.

### 5.4 `GET /basenames/check/:handle` — availability

```http
GET /api/v1/basenames/check/nia
→ { handle: "nia", available: true, source: "onchain" }
```

Two-layer check, both cheap:

1. **On-chain (authoritative):** `RegistrarController.available(name)` on Base Sepolia at `0x49aE3cC2e3AA768B1e5654f5D3C6002144A59581`. The view is free, no signature needed. Returns `true` when the label is valid and not yet registered.
2. **DB cache (defense in depth):** also reject if `prisma.user.findUnique({ where: { basename: \`${handle}.base.eth\` } })` already exists. Catches the (rare) case where someone claimed via Kite a moment ago but the indexer hasn't caught the on-chain event yet.

Return `available: true` only when both layers agree. `source` is mostly for debugging.

A separate `POST /basenames/claim` is **not** needed — the claim happens on-chain from the user's wallet (§5.8). After the on-chain receipt, mobile calls `PATCH /me { basename }` to mirror it into the DB. `@unique` + `ConflictException` (`users.service.ts:50-58`) handles races.

### 5.5 Basename → address resolution (Send recipient flow)

When a user types `alice.base.eth` in Send and `alice` is not in our DB, resolve through the L2 `L2Resolver` at `0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA` on Base Sepolia (`0xC6d566A56A1aFf6508b41f6c90ff131615583BCD` on mainnet).

Backend exposes:

```http
GET /api/v1/basenames/resolve/:name
→ { name: "alice.base.eth", address: "0x…" | null }
```

Implementation: compute the ENS namehash of `alice.base.eth`, call `L2Resolver.addr(node)`. viem already exposes `publicClient.getEnsAddress({ name, universalResolverAddress })` — point it at the Base L2 resolver. ~15 lines.

UI behavior: if `useResolveQuery` finds no Kite user and the input matches `^[a-z0-9-]+\.base\.eth$`, fall back to `GET /basenames/resolve/:name`. If the resolver returns an address, render a synthetic contact card (`displayName: name`, `onKite: false`) and allow the send. The recipient receives USDC at their Basename address even if they have never used Kite.

### 5.6 `GET /transactions/:id` — single tx fetch

Trivial: `prisma.transaction.findFirst({ where: { id, OR: [{fromUserId: viewerId}, {toUserId: viewerId}] }, include: {...} })`, then run through the existing `shape()` helper. One controller method, ~15 lines.

### 5.7 Optional — webhook for fresh balance

After §5.2 the user sees a `PENDING` tx instantly. The indexer flips it to `CONFIRMED` within 6 s. If that feels laggy in the demo, expose a `POST /transactions/refresh` that runs `indexer.processOnce()` on demand. Not needed if the indexer keeps up.

### 5.8 Real on-chain Basenames claim (Base hackathon path)

This replaces the earlier "DB-only reservation" plan. We register actual `*.base.eth` names on Base Sepolia from the user's Smart Wallet, with gas sponsored by the CDP Paymaster.

#### Deployed contracts (Base Sepolia, chainId 84532)

| Contract | Address | Purpose |
|---|---|---|
| `RegistrarController` | `0x49aE3cC2e3AA768B1e5654f5D3C6002144A59581` | Where we call `register` / `discountedRegister` / `available` / `registerPrice` |
| `L2Resolver` | `0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA` | Records (`addr`, `name`, text records). Pass this as `resolver` in `RegisterRequest`. |
| `BaseRegistrar` | `0xa0c70ec36c010b55e3c434d6c6ebeec50c705794` | NFT registrar (the `.base.eth` second-level node owner). Read-only for us. |
| `ReverseRegistrar` | `0x876eF94ce0773052a2f81921E70FF25a5e76841f` | For `setName(addr → name)` — already invoked under the hood when `RegisterRequest.reverseRecord = true`. |

Mainnet equivalents (for the post-hackathon switch): RegistrarController `0x4cCb0BB02FCABA27e82a56646E81d8c5bC4119a5`, L2Resolver `0xC6d566A56A1aFf6508b41f6c90ff131615583BCD`, BaseRegistrar `0x03c4738ee98ae44591e1a4a4f3cab6641d95dd9a`, ReverseRegistrar `0x79ea96012eea67a83431f1701b3dff7e37f9e282`.

Suffix is `.base.eth` on both networks (no `basetest.eth`).

#### Contract surface we touch

```solidity
struct RegisterRequest {
  string  name;          // "nia" — bare label, no suffix
  address owner;         // user's Smart Wallet address
  uint256 duration;      // seconds, e.g. 365 days
  address resolver;      // L2Resolver address above
  bytes[] data;          // resolver setup calls; can be empty for MVP
  bool    reverseRecord; // true → also call setName so address → name resolves
}

function available(string name) external view returns (bool);
function registerPrice(string name, uint256 duration) external view returns (uint256); // wei
function register(RegisterRequest request) external payable;                            // emits NameRegistered
function discountedRegister(RegisterRequest request, bytes32 discountKey, bytes validationData) external payable; // emits NameRegistered + DiscountApplied
```

`registerPrice` already factors in length-based pricing (3-char names are pricier than 10-char). On testnet the values are tiny — fund the demo wallet with a fraction of an ETH from a Base Sepolia faucet and we can register hundreds.

#### Gasless via CDP Paymaster

Base's Smart Wallet supports sponsored UserOps. To make `register` gasless for end users:

1. In the Coinbase Developer Platform dashboard (project ID in `CDP_PROJECT_ID`, `.env.example:20`), open the **Paymaster** product for Base Sepolia.
2. Add `RegistrarController` (`0x49aE…59581`) to the allowlisted contract list.
3. Allowlist the function selectors for `register(RegisterRequest)` and `discountedRegister(RegisterRequest,bytes32,bytes)`.
4. Set a per-user spend cap (e.g. $0.50/user on testnet) to avoid abuse during the demo.
5. In `apps/mobile/lib/wallet.ts`, configure the Smart Wallet bridge to attach the CDP Paymaster URL (`paymasterUrl`) to the UserOp. The Smart Wallet SDK exposes a `capabilities.paymasterService` field on the `wallet_sendCalls` request — fill it with `{ url: process.env.EXPO_PUBLIC_CDP_PAYMASTER_URL }`.

Reference: [docs.base.org/cookbook/account-abstraction/gasless-transactions-with-paymaster](https://docs.base.org/cookbook/account-abstraction/gasless-transactions-with-paymaster). Per the Base gasless campaign, Smart-Wallet users currently get sponsored Basename registration directly — try `discountedRegister` first with the Smart-Wallet discount key and fall back to plain `register` (still gasless via our Paymaster) on revert.

#### Mobile claim flow (end-to-end)

```ts
// apps/mobile/lib/basenames.ts
import { encodeFunctionData, namehash, parseAbi } from 'viem';

const REGISTRAR = '0x49aE3cC2e3AA768B1e5654f5D3C6002144A59581';
const RESOLVER  = '0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA';
const ONE_YEAR  = 365n * 24n * 60n * 60n;

const abi = parseAbi([
  'function available(string name) view returns (bool)',
  'function registerPrice(string name, uint256 duration) view returns (uint256)',
  'function register((string,address,uint256,address,bytes[],bool) request) payable',
]);

export async function claimBasename(handle: string, owner: `0x${string}`) {
  const ok = await publicClient.readContract({ address: REGISTRAR, abi, functionName: 'available', args: [handle] });
  if (!ok) throw new Error('TAKEN');

  const price = await publicClient.readContract({ address: REGISTRAR, abi, functionName: 'registerPrice', args: [handle, ONE_YEAR] });

  const data = encodeFunctionData({
    abi,
    functionName: 'register',
    args: [{ name: handle, owner, duration: ONE_YEAR, resolver: RESOLVER, data: [], reverseRecord: true }],
  });

  const txHash = await wallet.sendTransaction({
    to: REGISTRAR,
    data,
    value: price,
    capabilities: { paymasterService: { url: process.env.EXPO_PUBLIC_CDP_PAYMASTER_URL! } },
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { fullName: `${handle}.base.eth`, txHash };
}
```

#### Backend changes for §5.8

- **`GET /basenames/check/:handle`** — use the two-layer logic in §5.4 (on-chain `available` + DB cache).
- **Indexer addition (optional, nice-to-have):** subscribe to `NameRegistered(name, label, owner, expires)` on `BaseRegistrar`. When we see `owner` match a known Kite user, write the resulting `<name>.base.eth` into `user.basename`. This auto-heals the DB if the mobile mirror call (`PATCH /me`) ever fails.
- **`GET /me`** — already returns `basename`. No change.

#### Risks & fallbacks

- **Paymaster cap hit** on demo day → user pays gas themselves (have 0.01 ETH on the Smart Wallet, mention in onboarding fineprint).
- **Smart Wallet doesn't expose `paymasterService` capability in the current mobile SDK** → fall back to a regular EOA `sendTransaction` with the Smart Wallet paying gas in ETH. The visible UX is identical; only the "free" label is slightly less true.
- **On-chain `available` returns true but the registration reverts** (e.g. the label fails the validator's character rules) → catch, show "try a different name."
- **Demo day RPC slow** → register two basenames the night before, hand them to the two demo wallets. Live registration during the demo is a stretch goal, not the critical path.

---

## 6 · Mock-only UI — keep & label, never delete

Each item below is currently rendered as a real, working feature in the mock. **None of these sections gets removed from the app.** They stay visible, stay reading from `constants/mock-data.ts`, and get a small `preview` badge so nobody mistakes them for live data.

The `preview` badge is one shared component: a pill, 10 px mono, `colors.inkMuted` text on `rgba(11,18,48,0.05)` background, label `preview`. Add it at `apps/mobile/components/ui/preview-badge.tsx` and reuse.

### 6.1 "Money in motion" (yield routes)

This section is **half real, half preview**:

- **Real (top row):** `Kite Treasury · Base Sepolia` — the deployed `KiteTreasury` contract at `KITE_TREASURY_ADDRESS` (`.env.example:16`, `0xFF3889c6898F3172D749999cbb2a31984e5B997b`). APY from `GET /treasury/info` (currently 4.20%, fixed-simulated — see `contracts/src/KiteTreasury.sol`). Share = 100% of user principal. This row is fully live and clickable through to BaseScan.
- **Preview (rows below):** `Morpho · Base 4.31% · 68%`, `Aave v3 · Base 3.94% · 24%`, `Spark · Base 3.62% · 8%` — illustrative routing roadmap. Multi-protocol routing is excluded from MVP (`docs/README.md:48`).

Render a single `<PreviewBadge />` next to the subgroup header for the three preview rows (something like `routing roadmap · preview`), not on the section title — the section title is now honest because the top row is real.

Numbers in the preview rows stay; the badge makes clear the allocation is illustrative.

### 6.2 "Add" quick action

Today it is a no-op (`home.tsx:50`). Two valid paths, both keep the button:
- **Wire to Coinbase Onramp Buy URL** (preferred) — opens an in-app browser to Coinbase Onramp with `appId`, `destinationWallets`, and a return URL. Add `EXPO_PUBLIC_CDP_PROJECT_ID` and read it in `wallet.ts`.
- **Toast fallback** — `onPress` shows a `Buying soon` toast via `expo-haptics` + a one-off `Animated` snackbar.

Don't ship a button that silently does nothing.

### 6.3 Multi-currency wallets (USDC + EURC)

Both rows are real on-chain ERC-20 reads. The backend's `GET /treasury/balance` multicall returns `walletUsdc` and `walletEurc` side-by-side. The mobile Home reads both via `useBalance()` and renders them with their respective currency symbols (`$`, `€`).

**Faucets:**
- USDC: https://faucet.circle.com → Network: *Base Sepolia* → Token: *USDC*
- EURC: same faucet, Token: *EURC*

**Contract addresses (Base Sepolia):**
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- EURC: `0x808456652fdb597867f38412077A9182bf77359F`

**MXNB was removed.** There's no MXN-pegged stablecoin Circle issues on Base Sepolia, so the mock row was misleading. Future Mexican-peso support would come via a separate provider (e.g., Bitso's MXNB on Arbitrum) — not in MVP.

**Out of this step's scope (deferred):**
- **Sending EURC.** The Send screen and `useSendUsdc` are USDC-only. Adding a token picker is a follow-up — needs UI work plus a generic `useSendErc20` hook.
- **EURC transfers in Activity.** The indexer + Alchemy webhook only process USDC `Transfer` events. EURC transfers to your wallet update the Home EURC row balance within 10s (via `useBalance` polling) but don't appear in the Activity feed.

### 6.4 Card screen

No issuer integration. `card.tsx` is a real screen in the tab bar — leave it that way.

- Status pill: `preview`, not `virtual · live` (`card.tsx:23`).
- **Keep** the cashback block with the existing mock numbers; add a `<PreviewBadge />` next to the `cashback this month` label.
- **Keep** the "Recent · card only" section reading from mock card txs; re-label the section header `Recent · preview`.
- **Keep** the three controls visually but render them `disabled` and 0.5 opacity.
- **Keep** the `kind: 'card'`, `cashback`, `category` fields on the mobile `Transaction` type — they continue to back mock previews on Home, Activity, and Tx Detail.

### 6.5 Tx fake hash / settle time on Send success

`send/index.tsx:220` prints a fake `0x9fa1…2d4f · settled in 2.1s`. For real sends, replace with measured real values from §2.6. For the preview/demo fallback (if the wallet write fails for any reason during the demo), keep the mock hash but only render it inside an `if (__DEV__ || demoMode)` branch — never as the silent default.

### 6.6 Greeting

`good morning,` is hardcoded (`home.tsx:29`). Cheap fix: derive from `new Date().getHours()` (`morning` < 12, `afternoon` < 18, otherwise `evening`).

### 6.7 Preview-tail on Activity

See §2.4. A short tail of mock card / interest / "added cash" rows appended under a `Preview · sample card & cashback` day-label keeps the screen full during the demo. The tail is suppressed once the real list has ≥ 6 rows so we never double up on density.

---

## 7 · Environment additions

Add to both `.env.example` and `apps/mobile/.env` once created:

```bash
# Coinbase Smart Wallet
EXPO_PUBLIC_WALLET_APP_NAME=Kite
EXPO_PUBLIC_WALLET_APP_LOGO_URL=https://kite.cash/logo.png

# Profile share base (optional — used in Receive's share sheet)
EXPO_PUBLIC_PROFILE_BASE_URL=https://kite.cash

# Optional — if we wire Coinbase Onramp for the "Add" button (§6.2)
EXPO_PUBLIC_CDP_PROJECT_ID=

# CDP Paymaster — sponsors basename claims (§5.8) and USDC sends (§2.6)
EXPO_PUBLIC_CDP_PAYMASTER_URL=https://api.developer.coinbase.com/rpc/v1/base-sepolia/<your-key>

# Basenames contracts on Base Sepolia (§5.8) — pinned so we don't rely on viem chain config
EXPO_PUBLIC_BASENAMES_REGISTRAR=0x49aE3cC2e3AA768B1e5654f5D3C6002144A59581
EXPO_PUBLIC_BASENAMES_L2_RESOLVER=0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA
```

`EXPO_PUBLIC_API_URL` already exists at `.env.example:28`. For physical-device demos, set this to your machine's LAN IP, not `localhost`.

---

## 8 · Build order (suggested 6-step sequence)

Each step lands a complete vertical slice. After each step the app still runs.

1. **Foundations.** Build §1.1–1.6. Mount `<QueryClientProvider>`. Add a dev-only debug screen that shows `useMe()`, `useTreasuryInfo()`, `useBalance()` for a manually-pasted JWT — proves the API client + auth + RPC paths work end-to-end before any UI changes.
2. **Auth + real Basenames.** Land §2.1 (gate), §2.2 (real onboarding), §5.1 (ERC‑6492 fix), §5.4 (availability), §5.5 (resolution), §5.8 (on-chain claim + Paymaster). After this step a fresh install can sign up, claim a real `*.base.eth` name with sponsored gas, and arrive at Home.
3. **Home + Receive.** Land §2.3, §2.7, and the §4 backend tweaks. After this step the user sees their real balance, real APY, and a real QR code — but Send and Activity still use mock data.
4. **Activity + Tx detail.** Land §2.4, §2.8, §5.6. After this step the indexer's history shows up correctly.
5. **Send.** Land §2.6, §5.2, §5.3. This is the hardest step (wallet write + paymaster + memo round-trip). Test with two demo accounts.
6. **Labeling pass.** Land §6.1–6.7 and the Card screen relabel (§2.5). Build the shared `<PreviewBadge />` (§6 intro) and sprinkle it on the mock-backed sections — nothing visual gets removed, the badges just make the demo honest. Pre-fund demo wallets, pre-claim two basenames, pre-deposit USDC into `KiteTreasury` so the live yield ticks immediately on first load.

---

## 9 · What this does **not** cover

Out of scope for this doc; tracked elsewhere:

- The Mini App surface (`docs/11-miniapp.md`).
- Push notifications (`Notification` table exists in `schema.prisma:93-104`, but no controller or push integration — defer).
- Invites (`Invite` table exists in `schema.prisma:106-125`, no flow yet — defer).
- Real Morpho integration / real card / KYC (all explicitly excluded in `docs/README.md:48-53`).

---

## 10 · Multi-token treasury (USDC + EURC)

The single-token v1 `KiteTreasury` has been upgraded in place to a multi-token vault that supports both USDC and EURC on Base Sepolia. Same simulated APY model (fixed 420 bps lazy-accrual), now keyed per `(token, user)`.

### 10.1 Contract

`contracts/src/KiteTreasury.sol` — same accrual math as v1, plus an allow-list of tokens populated at construction time. New surface:

```solidity
constructor(address _usdc, address _eurc);

function deposit(address token, uint256 amount) external;
function withdraw(address token, uint256 amount) external;
function fundYieldReserve(address token, uint256 amount) external;

function balanceOf(address token, address user) external view returns (uint256);
function pendingYield(address token, address user) external view returns (uint256);
function principalOf(address token, address user) external view returns (uint256);
function positions(address token, address user) external view
    returns (uint256 principal, uint256 accruedYield, uint256 lastUpdate);

event Deposited(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
event Withdrawn(address indexed user, address indexed token, uint256 amount, uint256 yieldPortion, uint256 timestamp);
event YieldReserveFunded(address indexed funder, address indexed token, uint256 amount);

error UnsupportedToken(address token);
```

Read-only views named `usdc()` and `eurc()` expose the immutable token addresses; `supported(address)` returns whether a token is allow-listed. Tests live in `contracts/test/KiteTreasury.t.sol` and cover deposit/withdraw/accrual per token plus cross-token isolation (Alice's USDC balance can't bleed into her EURC balance, withdrawing USDC doesn't move EURC, etc.).

### 10.2 Backend

- `apps/api/src/chain/abis/kite-treasury.ts` — new ABI matching the multi-token contract.
- `apps/api/src/treasury/treasury.service.ts` — `GET /treasury/balance` now returns per-token treasury sub-fields. The shape preserves backward compatibility (the v1 `treasury.principal/accruedYield/total` keys mirror the USDC position) and adds `treasury.usdc.*` and `treasury.eurc.*`. `GET /treasury/info` now also returns `eurcAddress` + `expectedEurcAddress`.
- `apps/api/src/indexer/indexer.service.ts` — listens to the new `Deposited(user, token, ...)` and `Withdrawn(user, token, ...)` event signatures, plus EURC `Transfer` logs (in addition to USDC). Each persisted `Transaction` row carries the correct `token` field (`"USDC"` or `"EURC"`), so the Activity feed and Tx Detail show the right token.

### 10.3 Mobile

- `apps/mobile/lib/erc20.ts` — new generic ERC-20 helpers (`encodeTransfer`, `encodeApprove`, `readAllowance`). `apps/mobile/lib/usdc.ts` now wraps these so existing call sites keep working.
- `apps/mobile/lib/treasury.ts` — `encodeTreasuryDeposit(token, amount)` / `encodeTreasuryWithdraw(token, amount)` helpers built on the new ABI.
- `apps/mobile/hooks/use-treasury-action.ts` — single mutation that handles the two-tx deposit flow (`approve` if allowance < amount, then `deposit`) and the one-tx withdraw flow. Exposes `onPhase` callback so the UI can show `Approving token… → Depositing…`. Invalidates `qk.treasuryBalance` + `qk.transactions` on receipt.
- `apps/mobile/app/treasury.tsx` — new modal screen. Token picker (USDC | EURC) + amount keypad + Deposit/Withdraw toggle + success screen with the real txHash and measured settle time. Reachable from Home via two buttons below "Money in motion": **Move to yield** (primary, ink) and **Withdraw** (ghost, disabled when total treasury position is 0).
- `apps/mobile/app/(tabs)/home.tsx` — "Money in motion" now shows a `Kite Treasury · USDC` and a `Kite Treasury · EURC` row side by side, bar widths reflect each token's share of the user's combined position. The headline balance and live yield sum across both tokens.
- `apps/mobile/lib/api-types.ts` — `TreasuryBalance` updated to expose `treasury.usdc` and `treasury.eurc` per-token sub-objects.

### 10.4 Indexer cursor reset (after redeploy)

The new contract is at a new address, so old logs at the v1 treasury address are irrelevant. On a fresh DB, the indexer initialises from `head - 200 blocks` and picks up new logs automatically. If the indexer DB cursor predates the redeploy block, advance it manually:

```sql
UPDATE "IndexerCursor" SET "lastBlock" = <deploy_block - 1> WHERE name = 'main';
```

### 10.5 Demo prep

Each demo wallet now needs both tokens funded:

- USDC: https://faucet.circle.com → Base Sepolia → USDC
- EURC: same faucet, Token: EURC
- Sepolia ETH (gas): https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

After the deploy, seed both yield reserves (per-token) so withdrawals can pay out simulated yield. The deploy script handles this when `YIELD_RESERVE_USDC` / `YIELD_RESERVE_EURC` are exported:

```bash
export YIELD_RESERVE_USDC=1000000     # 1 USDC
export YIELD_RESERVE_EURC=1000000     # 1 EURC
forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify
```

If reserves aren't seeded at deploy time, anyone can `fundYieldReserve(token, amount)` later from a wallet holding the token.
