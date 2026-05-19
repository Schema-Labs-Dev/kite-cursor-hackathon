# 06 — API Specification

Base URL: `http://localhost:3001/api/v1`

All authenticated endpoints require an `Authorization: Bearer <jwt>` header. Tokens are issued by `POST /auth/verify` and live for `7d`.

All amounts are returned as objects of the shape:

```json
{ "raw": "1000000", "formatted": "1" }
```

so the client never has to parse bigints itself. USDC has 6 decimals.

## Live status (Phase 3)

| Endpoint | Status |
|---|---|
| `GET  /health` | live |
| `POST /auth/nonce` | live |
| `POST /auth/verify` | live (issues JWT, replay-protected via single-use nonces) |
| `GET  /me` | live |
| `PATCH /me` | live |
| `GET  /treasury/info` | live |
| `GET  /treasury/balance` | live (multicall: `principalOf` + `pendingYield` + `balanceOf` + USDC wallet balance) |
| `GET  /transactions` | live (cursor-paginated, counterparty-resolved) |
| `GET  /users/resolve?q=` | live (address / basename / displayName) |
| _Indexer_ | live (6s polling: USDC `Transfer` + `KiteTreasury.Deposited`/`Withdrawn`) |

## Auth

### `POST /auth/nonce`

Request a nonce to sign for SIWE.

**Body:**
```json
{ "address": "0xabc..." }
```

**Response 200:**
```json
{ "nonce": "a1b2c3...", "expiresIn": 300 }
```

### `POST /auth/verify`

Verify a SIWE signature, return JWT.

**Body:**
```json
{
  "message": "kite.cash wants you to sign in...\nNonce: a1b2c3...",
  "signature": "0x..."
}
```

**Response 200:**
```json
{
  "token": "eyJ...",
  "user": {
    "id": "ckxyz",
    "walletAddress": "0xabc...",
    "basename": "alice.base.eth",
    "displayName": "Alice"
  }
}
```

**Errors:**
- `401` — invalid signature, expired nonce, or wrong nonce

## Users

### `GET /me` 🔒

Return the authenticated user's profile.

**Response 200:**
```json
{
  "id": "ckxyz",
  "walletAddress": "0xabc...",
  "basename": "alice.base.eth",
  "displayName": "Alice",
  "email": null,
  "phone": null,
  "avatarUrl": null,
  "createdAt": "2026-05-18T10:00:00Z"
}
```

### `PATCH /me` 🔒

Update profile fields.

**Body:** any subset of `{ displayName, email, phone, avatarUrl, basename, pushToken }`

**Response 200:** updated user object

### `GET /users/resolve?q=alice.base.eth` 🔒

Resolve a Basename, address, phone, or email to a Kite user (or onchain address).

**Query:**
- `q` — Basename, 0x address, phone, or email

**Response 200 (Kite user):**
```json
{
  "type": "kite_user",
  "user": {
    "id": "ckxyz",
    "walletAddress": "0xabc...",
    "basename": "alice.base.eth",
    "displayName": "Alice"
  }
}
```

**Response 200 (onchain address only):**
```json
{
  "type": "onchain_address",
  "address": "0xabc...",
  "basename": "stranger.base.eth"
}
```

**Response 404:** unable to resolve

## Contacts

### `GET /contacts` 🔒

List the authenticated user's contacts.

**Response 200:**
```json
{
  "contacts": [
    {
      "id": "ckabc",
      "nickname": "Mom",
      "address": "0xdef...",
      "phone": "+260971234567",
      "kiteUser": null
    }
  ]
}
```

### `POST /contacts` 🔒

Add a contact.

**Body:**
```json
{ "nickname": "Mom", "address": "0xdef..." }
```
or
```json
{ "nickname": "Mom", "phone": "+260971234567" }
```

**Response 201:** contact object

### `DELETE /contacts/:id` 🔒

**Response 204**

## Transactions

### `GET /transactions` 🔒

Authenticated user's activity feed (sent + received).

**Query:**
- `limit` (default 20, max 100)
- `cursor` (for pagination)

**Response 200:**
```json
{
  "transactions": [
    {
      "id": "ckxxx",
      "txHash": "0x...",
      "direction": "OUT",
      "amount": "5000000",
      "token": "USDC",
      "txType": "TRANSFER",
      "memo": "coffee",
      "counterparty": {
        "address": "0xdef...",
        "basename": "alice.base.eth",
        "displayName": "Alice"
      },
      "status": "CONFIRMED",
      "blockNumber": 15123456,
      "createdAt": "2026-05-18T10:42:00Z",
      "explorerUrl": "https://sepolia.basescan.org/tx/0x..."
    }
  ],
  "nextCursor": "ckabc"
}
```

### `POST /transactions/memo` 🔒

Attach a memo to a transaction the user just submitted. The mobile app calls this right after broadcasting a tx, before the indexer picks it up.

**Body:**
```json
{ "txHash": "0x...", "memo": "coffee", "toAddress": "0xdef..." }
```

**Response 200:** transaction object (status: PENDING — indexer fills the rest)

### `GET /transactions/:id` 🔒

Single transaction detail (must belong to the user).

## Treasury

### `GET /treasury/balance` 🔒

User's full Kite Treasury balance (principal + accrued yield), read directly from the contract.

**Response 200:**
```json
{
  "principal": "1000000000",
  "yieldAccrued": "418082",
  "total": "1000418082",
  "apyBps": 420
}
```

### `GET /treasury/yield` 🔒

Just the pending yield. Fast endpoint for the "ticking yield" UI on the home screen.

**Response 200:**
```json
{ "yieldAccrued": "418082" }
```

## Basenames

### `GET /basenames/check/:name` 🔒

Check if a Basename is available.

**Response 200:**
```json
{ "name": "alice.base.eth", "available": false }
```

### `POST /basenames/claim` 🔒

Claim a Basename for the authenticated user. Backend signs+sponsors the registration tx.

**Body:**
```json
{ "name": "alice" }
```

**Response 200:**
```json
{
  "name": "alice.base.eth",
  "txHash": "0x...",
  "status": "PENDING"
}
```

> For hackathon: this can mock the actual onchain claim and just record the basename in the DB if time is tight. Mention this in the demo as "sponsored basename claim, takes ~10s on mainnet."

## Notifications

### `GET /notifications` 🔒

**Response 200:**
```json
{
  "notifications": [
    {
      "id": "cknxyz",
      "type": "TX_RECEIVED",
      "payload": {
        "amount": "5000000",
        "token": "USDC",
        "fromAddress": "0xabc..."
      },
      "readAt": null,
      "createdAt": "2026-05-18T10:00:00Z"
    }
  ]
}
```

### `POST /notifications/mark-read` 🔒

**Body:** `{ "ids": ["cknxyz"] }` (or omit `ids` to mark all)

**Response 204**

## Webhooks

### `POST /webhooks/onramp`

Coinbase Onramp completion webhook. Public endpoint — verified via `ONRAMP_WEBHOOK_SECRET` HMAC.

**Headers:**
- `X-Onramp-Signature: <hmac>`

**Body:** Coinbase Onramp event payload (whatever they send)

**Response 200:** `{ "ok": true }`

## Health

### `GET /health`

Public health check.

**Response 200:**
```json
{ "status": "ok", "chain": "base-sepolia", "blockHeight": 15123456 }
```

## DTO conventions

- **All inputs validated** with `class-validator` decorators on DTOs
- **All responses** use plain JSON, no envelope (no `{ "data": ..., "error": ... }` wrapper)
- **Errors** follow NestJS default: `{ "statusCode": 401, "message": "..." }`
- **Timestamps** ISO 8601 strings
- **Amounts** raw bigint as string

## Hackathon priority order

If time is tight, ship in this order:

1. `POST /auth/nonce` + `POST /auth/verify` (without these, nothing works)
2. `GET /me` + `PATCH /me`
3. `GET /transactions`
4. `GET /treasury/balance` + `GET /treasury/yield`
5. `GET /users/resolve` (needed for "send to Basename")
6. `POST /transactions/memo` (nice for the demo receipt)
7. `GET /contacts` + `POST /contacts` (skip if running short)
8. Notifications + invites (post-hackathon)

Move on to [`07-flows.md`](./07-flows.md).
