# 07 — Flows (auth, send, hold)

Three end-to-end sequences your team needs to internalise. The mobile app and backend interact a lot — this doc is the source of truth for who calls what.

## Flow 1 — Sign up / sign in (passkey + SIWE)

```
┌──────┐                ┌────────────────┐         ┌──────────┐         ┌─────────┐
│ User │                │ Mobile (Expo)  │         │ Backend  │         │  Base   │
└──┬───┘                └────────┬───────┘         └────┬─────┘         └────┬────┘
   │                             │                      │                    │
   │  Tap "Get started"          │                      │                    │
   ├────────────────────────────▶│                      │                    │
   │                             │                      │                    │
   │                             │  Create Smart Wallet │                    │
   │                             │  (Coinbase SDK,      │                    │
   │                             │   passkey via Face ID)                    │
   │                             ├──────────────────────┼───────────────────▶│
   │                             │                      │                    │
   │                             │  Smart Wallet address (counterfactual)    │
   │                             │◀─────────────────────┼────────────────────┤
   │                             │                      │                    │
   │                             │  POST /auth/nonce    │                    │
   │                             │  { address }         │                    │
   │                             ├─────────────────────▶│                    │
   │                             │                      │                    │
   │                             │  { nonce }           │                    │
   │                             │◀─────────────────────┤                    │
   │                             │                      │                    │
   │                             │  Build SIWE message  │                    │
   │                             │  Sign with passkey   │                    │
   │                             │                      │                    │
   │                             │  POST /auth/verify   │                    │
   │                             │  { message, sig }    │                    │
   │                             ├─────────────────────▶│                    │
   │                             │                      │                    │
   │                             │              Verify SIWE                  │
   │                             │              Create user if new           │
   │                             │              Issue JWT                    │
   │                             │                      │                    │
   │                             │  { token, user }     │                    │
   │                             │◀─────────────────────┤                    │
   │                             │                      │                    │
   │                             │  Store JWT in        │                    │
   │                             │  SecureStore          │                    │
   │                             │                      │                    │
   │  (Optional) Claim Basename  │                      │                    │
   ├────────────────────────────▶│                      │                    │
   │                             │  POST /basenames/claim                    │
   │                             ├─────────────────────▶│                    │
   │                             │                      │  Sign + send tx    │
   │                             │                      │  (sponsored)       │
   │                             │                      ├───────────────────▶│
   │                             │                      │  txHash            │
   │                             │                      │◀───────────────────┤
   │                             │  { txHash, status }  │                    │
   │                             │◀─────────────────────┤                    │
   │                             │                      │                    │
```

### Key points

- **Smart Wallet creation is client-side.** The mobile app uses `@coinbase/wallet-sdk` with passkey auth. No private keys ever leave the device.
- **The address is counterfactual** until the first transaction. SIWE signing works fine on counterfactual addresses via ERC-1271 / ERC-6492.
- **The backend never has the private key.** It only verifies signatures.
- **Nonce is single-use** with a 5-min TTL, stored in memory (Redis in prod, fine for hackathon).

## Flow 2 — Send USDC ("tap to send")

```
┌──────┐         ┌────────────────┐         ┌──────────┐    ┌──────────┐    ┌─────────┐
│ User │         │ Mobile (Expo)  │         │ Backend  │    │ Paymaster│    │  Base   │
└──┬───┘         └────────┬───────┘         └────┬─────┘    └────┬─────┘    └────┬────┘
   │                      │                      │               │               │
   │ Type "alice.base.eth"│                      │               │               │
   │ amount $5            │                      │               │               │
   ├─────────────────────▶│                      │               │               │
   │                      │ GET /users/resolve   │               │               │
   │                      │   ?q=alice.base.eth  │               │               │
   │                      ├─────────────────────▶│               │               │
   │                      │                      │               │               │
   │                      │              Resolve via DB or       │               │
   │                      │              ENS lookup on chain     │               │
   │                      │                      ├───────────────┼──────────────▶│
   │                      │  { address, basename, displayName }  │               │
   │                      │◀─────────────────────┤               │               │
   │                      │                      │               │               │
   │ Confirm send         │                      │               │               │
   ├─────────────────────▶│                      │               │               │
   │                      │  Build USDC transfer call            │               │
   │                      │  Wrap as UserOp (ERC-4337)           │               │
   │                      │  Request paymaster sponsorship       │               │
   │                      ├──────────────────────┼──────────────▶│               │
   │                      │                      │ paymasterData │               │
   │                      │◀─────────────────────┼───────────────┤               │
   │                      │                      │               │               │
   │                      │  Sign UserOp w/ passkey              │               │
   │                      │  Send to bundler/RPC                 │               │
   │                      ├──────────────────────┼───────────────┼──────────────▶│
   │                      │                      │               │               │
   │                      │  txHash              │               │               │
   │                      │◀─────────────────────┼───────────────┼───────────────┤
   │                      │                      │               │               │
   │                      │  POST /transactions/memo             │               │
   │                      │  { txHash, memo,     │               │               │
   │                      │    toAddress }       │               │               │
   │                      ├─────────────────────▶│               │               │
   │                      │                      │               │               │
   │                      │            Persist as PENDING tx     │               │
   │                      │  { id, status: PENDING }             │               │
   │                      │◀─────────────────────┤               │               │
   │                      │                      │               │               │
   │  "Sending..."        │                      │               │               │
   │◀─────────────────────┤                      │               │               │
   │                      │                      │               │               │
   │                      │            Indexer picks up tx       │               │
   │                      │            ~10s later, marks         │               │
   │                      │            CONFIRMED                 │               │
   │                      │                      │               │               │
   │                      │  WS push or poll: CONFIRMED          │               │
   │                      │◀─────────────────────┤               │               │
   │  "Sent — Free."      │                      │               │               │
   │◀─────────────────────┤                      │               │               │
```

### Key points

- **Only the mobile app talks to the chain to send.** The backend never holds keys, never signs transfers.
- **Paymaster sponsorship is configured client-side.** Coinbase Smart Wallet SDK has paymaster URL config.
- **The memo lives offchain.** It's submitted to the backend before or just after the tx is broadcast.
- **The indexer reconciles** — when the USDC `Transfer` event fires, the backend updates the cached transaction from PENDING to CONFIRMED.
- **For the demo**, you can poll `GET /transactions/:id` every 2s, or implement a simple WebSocket if time allows.

### Two-second send (hackathon shortcut)

If WebSockets are too much for a hackathon, the mobile app can:
1. Show "Sent. Confirming..." immediately after broadcast
2. Poll `GET /transactions/:id` every 1s for up to 30s
3. Update UI to "Sent. Free." when status flips to CONFIRMED

## Flow 3 — Hold (deposit + yield)

```
┌──────┐         ┌────────────────┐         ┌──────────┐    ┌─────────────┐    ┌─────────┐
│ User │         │ Mobile (Expo)  │         │ Backend  │    │ KiteTreasury│    │  USDC   │
└──┬───┘         └────────┬───────┘         └────┬─────┘    └──────┬──────┘    └────┬────┘
   │                      │                      │                 │                │
   │ Add money $20        │                      │                 │                │
   ├─────────────────────▶│                      │                 │                │
   │                      │  Coinbase Onramp     │                 │                │
   │                      │  flow (out of scope) │                 │                │
   │                      │                      │                 │  USDC arrives  │
   │                      │                      │                 │  at user wallet│
   │                      │                      │                 │◀───────────────┤
   │                      │                      │                 │                │
   │ Move to "earning"    │                      │                 │                │
   ├─────────────────────▶│                      │                 │                │
   │                      │  approve(treasury, 20)                 │                │
   │                      ├──────────────────────┼─────────────────┼───────────────▶│
   │                      │                      │                 │                │
   │                      │  treasury.deposit(20)                  │                │
   │                      ├──────────────────────┼────────────────▶│                │
   │                      │                      │                 │ transferFrom   │
   │                      │                      │                 ├───────────────▶│
   │                      │                      │                 │                │
   │                      │  txHash              │                 │                │
   │                      │◀─────────────────────┼─────────────────┤                │
   │                      │                      │                 │                │
   │  "Earning 4.20% APY" │                      │                 │                │
   │◀─────────────────────┤                      │                 │                │
   │                      │                      │                 │                │
   │ Open home screen     │                      │                 │                │
   ├─────────────────────▶│                      │                 │                │
   │                      │  GET /treasury/balance                 │                │
   │                      ├─────────────────────▶│                 │                │
   │                      │              Read balanceOf(user)      │                │
   │                      │                      ├────────────────▶│                │
   │                      │                      │ balance         │                │
   │                      │                      │◀────────────────┤                │
   │                      │  { principal,        │                 │                │
   │                      │    yieldAccrued, total }               │                │
   │                      │◀─────────────────────┤                 │                │
   │                      │                      │                 │                │
   │  Yield ticking up    │                      │                 │                │
   │  (re-fetch /yield    │                      │                 │                │
   │   every 5s)          │                      │                 │                │
```

### Key points

- **Two transactions for deposit**: `approve` then `deposit`. ERC-4337 supports batching — the mobile app can wrap both in one UserOp for the demo.
- **Yield ticks live** because `balanceOf()` computes pending yield at read time. The mobile app polling `/treasury/yield` every few seconds gives the "money growing" feel.
- **No backend signing for treasury.** Backend only reads. The mobile app constructs and broadcasts everything.

## Failure modes (and what to demo around)

| Failure | What to do |
|---|---|
| Base Sepolia RPC is slow | Have a backup public RPC ready (Alchemy, Quicknode demo URLs) |
| Faucet ran out | Pre-fund both demo wallets with USDC + ETH the night before |
| Paymaster rate limit | For demo, OK to fall back to user-paid gas — they'll have ETH |
| Indexer falls behind | Show the BaseScan link directly so judges see the tx instantly |
| Signature verification fails | Test with both real Smart Wallet and a fallback EOA wallet |

Move on to [`08-mobile-handoff.md`](./08-mobile-handoff.md).
