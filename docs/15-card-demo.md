# 15 — Card "Tap-to-Pay" Demo

> Make the Card screen feel **alive** for the demo: a single gesture triggers a merchant pop-up, the user picks a wallet, approves with Face ID, and **real on-chain USDC/EURC** moves from their smart account to the demo merchant. No NFC partner needed, no fakery in the receipt — the transaction is a genuine `transfer()` that lands in Activity + on BaseScan.
>
> This is a planning doc. Sign off on the design picks before I build.

---

## 1 · The demo story (what the audience sees)

1. Presenter swipes to the **Card** tab. Card sits in the middle of the screen with a small mono hint underneath: *"press and hold to pay"*.
2. Presenter says "*let me grab a coffee*", **press-and-holds the card** for ~1.2 s. A subtle ring fills around the card, the phone vibrates once, and a sheet slides up from the bottom.
3. The sheet shows a **merchant card**:
   - ☕ icon + "**Vidae Café**" + tiny location ("CDMX · ITP terminal")
   - Big "**$4.50**" amount, edit-on-tap
   - "Pay with" row showing two pills: `USDC $X.XX` and `EURC €Y.YY` — tap to switch.
   - Big black "**Approve**" button at the bottom.
4. Presenter taps Approve → **Face ID prompt** appears → biometric clears → button morphs into a spinner "*Tapping to terminal…*" (cosmetic), then "*Settling on Base…*" (real receipt wait).
5. ~2 s later the sheet animates into a **receipt**:
   - Green check, "*Paid Vidae Café*", "$4.50 from USDC", "*+$0.18 cashback*" (mock label, real-looking).
   - Three small chips: tx hash (tap → BaseScan), block number, settle time.
6. Sheet auto-dismisses. The Card screen's "**Recent · card**" list shows the new payment row at the top, instantly. Activity tab also has it.

The whole thing feels like Apple Pay, except behind the scenes it's a real ERC-20 `transfer(0xAE0A…3091, $4.50)` from the user's Coinbase Smart Account — UserOp, sponsored by CDP, settles in seconds. BaseScan would prove it to anyone who asked.

---

## 2 · Design decisions (pick one per row)

### 2.1 How does the presenter trigger the pay sheet?

| Option | Feel | Discoverability | Demo risk | My pick |
|---|---|---|---|---|
| **Press-and-hold the card** (1.0–1.5 s, ring fills) | Mimics "tap and hold" of contactless | Mono hint label under the card | Low — needs intentional press | ⭐ **Recommended** |
| Single tap the card | Snappy, but light | Same | Medium — easy to mis-trigger when scrolling | |
| Always-visible "Pay" button | Honest, boring | High | None | |
| Shake the phone | Theatrical | Hidden | High — accidental in pocket | |
| Pull-down to "tap" | Familiar gesture | Medium | Conflicts with ScrollView | |
| Triple-tap card (Konami) | Hidden | Zero | High — presenter mis-fires | |

**Pick: press-and-hold the card.** Press feels physical, mirrors NFC choreography, has 0% accident rate. Use `Pressable`'s `onLongPress` with `delayLongPress={1100}` plus a Moti-animated ring that fills during the press (visual feedback that something is happening).

If desired, **add a "tap to pay" affordance** as a Quick Actions-style button on the Card screen for one-tap discovery when the gesture isn't intuitive enough.

### 2.2 Where does the pay flow live — modal or full screen?

| Option | Pros | Cons |
|---|---|---|
| **Bottom-sheet modal** (`presentation: 'modal'`, slide_from_bottom) | Matches Apple Pay choreography; card stays partially visible behind | Stack already has 4 modals; this is fine |
| Full screen (slide_from_right) | More room | Loses the "tap from card" continuity |

**Pick: bottom-sheet modal.** Register as `app/card-pay.tsx` with `presentation: 'modal'` in `_layout.tsx`, same pattern as `treasury` and `convert`.

### 2.3 Amount — fixed, preset, or editable?

| Option | Pros | Cons |
|---|---|---|
| **Editable, default $4.50** | Lets presenter improvise ("$12 latte and pastry") | Slight risk of fat-fingering during demo |
| Fixed $4.50 | Zero demo-day risk | Less flexible |
| Random ($3–$15) | Feels variable | Looks contrived if it lands odd |

**Pick: editable, default $4.50.** Tap the amount to open a Keypad (reuse `components/sections/keypad.tsx`). Default $4.50 means a clean demo if presenter doesn't touch it.

### 2.4 Token picker

User asked "user selects wallet" — that's USDC vs EURC. Two-pill toggle on the sheet:

```
[ USDC · $250.00 ]   [ EURC · €182.40 ]
```

- Tap to switch. Selected pill is `colors.ink` background, `colors.cream` text.
- If selected token's balance < amount, the Approve button disables and shows "*Insufficient USDC*".
- Default = USDC.

This re-uses the wallet balances we already have via `useBalance()`.

### 2.5 Biometric step — real or cosmetic?

| Option | UX | Risk |
|---|---|---|
| **Real `expo-local-authentication`** | Face ID prompt = "wow factor" | Fails on simulator / phones without enrolled biometrics |
| Cosmetic "Approving…" spinner | Always works | Loses the "magic" beat |

**Pick: real Face ID with cosmetic fallback.** Try `LocalAuthentication.authenticateAsync` first. If it returns `success: false` (no enrolled biometric, cancelled, or unsupported), proceed anyway with a cosmetic confirm — demo never blocks. This needs adding `expo-local-authentication` as a dep.

### 2.6 Cashback — show or hide?

Card screen already shows mock cashback (`me.cashbackThisMonth`). Each real payment in this flow should:
- Compute 4% of amount as a display-only number ("*+$0.18 cashback*").
- **Not** actually move tokens (no cashback contract exists). Pure label.
- Optional: increment the in-memory `cashbackThisMonth` mock counter so the progress bar moves. Cute, but mock-on-top-of-real is a code smell. **Skip** for now — keep cashback labels honest as a static demo number on the card screen, but the per-tx "+$0.18" callout on the receipt is fine because it's clearly tied to a single payment.

### 2.7 Merchant — single or rotating list?

User said just one ("Vidae Café"). Build with a small constants file so we can add Apple, Uber, Spotify later without a refactor:

```ts
// apps/mobile/lib/merchants.ts
export const MERCHANTS = {
  vidae: {
    id: 'vidae',
    name: 'Vidae Café',
    location: 'CDMX · ITP terminal',
    icon: '☕',
    address: '0xAE0AC5583B519C34777FB5998016CF1D1d033091' as const,
  },
} as const;
export const DEFAULT_MERCHANT = MERCHANTS.vidae;
```

For now the modal hardcodes `DEFAULT_MERCHANT`. Adding a merchant picker is a 10-line later change.

### 2.8 How do we tag the transaction so the Card screen recognises it?

Three options:

| Option | Pros | Cons |
|---|---|---|
| **Filter by recipient address** (`tx.to == MERCHANT_ADDRESS`) | Simple, no schema change | Coupled to one address; switching merchant means filtering more |
| Memo prefix (`Card · Vidae Café`) | Self-documenting in BaseScan | Needs memo POST + indexer reconciliation |
| Both | Belt-and-braces | Slightly more code |

**Pick: both.** Set memo to `Card · Vidae Café` via the existing `POST /transactions/memo` flow (the swap hook does the same pattern). Filter Card-screen "Recent" by `to in MERCHANT_ADDRESSES` OR `memo startsWith 'Card ·'`. Memo gives us a nice subtitle in the row.

### 2.9 Display the merchant as a friendly name in Activity

Right now an outbound tx to `0xAE0A…3091` would render as a short address in the counterparty cell. Override it:

```ts
// apps/mobile/lib/merchants.ts
export const MERCHANT_DISPLAY: Record<string, { name: string; icon: string }> = {
  [MERCHANTS.vidae.address.toLowerCase()]: { name: 'Vidae Café', icon: '☕' },
};
```

In `tx-mapper.ts`, after counterparty derivation, check this map and override `counterparty` if present. Adds 4 lines.

### 2.10 Real vs simulated USDC transfer

**Real.** Reuse the existing `useSendUsdc` pattern, but parameterised by token. New hook `useCardPay({ token, dollars })`:
- Encodes ERC-20 `transfer(MERCHANT_ADDRESS, amount)` for the chosen token.
- Calls `wallet.sendTransaction({ to: tokenAddress, data })` — UserOp, sponsored.
- Fires `POST /transactions/memo` with `Card · Vidae Café`.
- Returns `{ txHash, settleMs, settledAt }` once `waitForTransactionReceipt` returns.

This is ~50 lines borrowing heavily from `useSendUsdc` and `useTreasuryAction`.

---

## 3 · Implementation plan

### 3.1 New files

| File | Purpose |
|---|---|
| `apps/mobile/lib/merchants.ts` | Constants for merchant addresses, display names, default merchant |
| `apps/mobile/hooks/use-card-pay.ts` | Mutation hook: wallet write + memo POST + invalidate |
| `apps/mobile/app/card-pay.tsx` | The bottom-sheet modal (merchant card → token picker → biometric → broadcast → receipt) |
| `apps/mobile/components/sections/card-press-ring.tsx` | Moti-animated ring overlay for the long-press feedback |

### 3.2 Edits

| File | Change |
|---|---|
| `apps/mobile/app/_layout.tsx` | Register `card-pay` as a bottom-sheet modal route (next to `treasury`, `convert`) |
| `apps/mobile/app/(tabs)/card.tsx` | Wrap `<CardMockup>` in a `Pressable` with `onLongPress` → `router.push('/card-pay')`. Add the press-ring overlay. Filter the "Recent" section by merchant address + memo prefix |
| `apps/mobile/lib/tx-mapper.ts` | Apply `MERCHANT_DISPLAY` override when counterparty matches a known merchant |
| `apps/mobile/hooks/index.ts` | Re-export `useCardPay` |
| `apps/mobile/package.json` | Add `expo-local-authentication` (via `expo install`) |
| `apps/mobile/app.json` | Add Face ID usage description (`NSFaceIDUsageDescription`) for iOS |

### 3.3 Step-by-step build order (~3 hours)

1. **Merchants + tx-mapper override** (~15 min) — get the friendly name showing up in Activity for any existing tx to that address.
2. **`use-card-pay` hook** (~30 min) — write + test against the convert/send flow patterns; verify memo POST works.
3. **`card-pay.tsx` modal — token picker + amount edit + Approve** (~60 min) — wire to `useCardPay`, manage the four UI phases (idle → biometric → broadcasting → receipt).
4. **Biometric** (~15 min) — `LocalAuthentication.authenticateAsync`; fallback to cosmetic confirm.
5. **Receipt** (~20 min) — green-check animation, real txHash/block/time chips, BaseScan deep-link.
6. **Card screen integration** (~30 min) — long-press wrap, press-ring component, "press to pay" hint label, filter the Recent list.
7. **Demo polish** (~20 min) — haptic on press start, haptic on biometric clear, animation timing tweaks, confirm with `--clear` cache reload.

### 3.4 Database / backend

**No changes needed.** Memo flow already exists, indexer already picks up the tx (the merchant address won't appear in any Kite user account so it'll be EXTERNAL counterparty until the mobile mapper renames it). The CDP Paymaster allowlist needs USDC `transfer` already (it does — we added it for the Convert flow).

If the merchant address `0xAE0A…3091` is going to receive many of these in the demo, also add it to the **Alchemy webhook watchlist** so we get push notifications on inbound. `pnpm --filter @kite/api webhook sync-users` doesn't include merchants — add a one-liner to also push `MERCHANT_ADDRESSES`. Optional, the polling indexer covers it anyway.

---

## 4 · Risks & how I'd mitigate

| Risk | Likelihood | Mitigation |
|---|---|---|
| Face ID prompt unavailable on simulator | High in dev | Already plan: cosmetic fallback when `LocalAuthentication.hasHardwareAsync` is false |
| Long-press triggered accidentally while scrolling Card screen | Low | Press is on the card image specifically, not the surface; 1.1 s delay |
| CDP Paymaster rejects `transfer` to merchant | Low | `transfer(address,uint256)` is already allowlisted for the swap. Selector is the same. |
| Network slow → presenter awkward silence | Medium | Receipt screen has cosmetic "*tapping…*" first; real waitForReceipt second. Time on stage feels like it's still doing something |
| Demo wallet drained | Medium | The merchant address IS the deployer (huge USDC/EURC supply via `mint`). Refundable any time. |
| Activity row appears with `0xAE0A…3091` instead of "Vidae Café" | Low (we control the mapper) | tx-mapper override handles it before the row hits screen |
| User edits amount to `0` or exceeds balance | Medium | Approve button is disabled with clear label (matches Send/Convert convention) |

---

## 5 · Open questions for you

1. **Demo amount default**: $4.50 (cheap coffee) or something else (e.g., $12.50 / "lunch")? Whichever you'll demo most often.
2. **Editable amount?** I'd say yes (`tap the price to change`). Confirm.
3. **Cashback line on the receipt**: keep ("*+$0.18 cashback*") or drop because it's not real?
4. **Biometric fallback during the demo itself**: if you'll demo on a simulator (no Face ID), should we keep the prompt path on by default or auto-skip when no hardware?
5. **One-tap "Pay" button as backup** in addition to the long-press, in case the gesture doesn't click for the audience the first time? I'd suggest a small "tap to pay" button below the card that does the same thing — discoverable insurance.
6. **Merchant rotation later**: should I leave the constants array open-ended (so adding Uber/Apple/Spotify is a one-line edit) or scope strictly to Vidae Café? (Leaving open costs nothing.)

---

## 6 · What this **doesn't** include (out of scope)

- Real NFC — needs a Visa/Stripe Issuing partner.
- Cashback that actually moves tokens — would need a `KiteCashback` contract minting rewards.
- Merchant-side QR or receipt printing.
- Card freeze / "Show full number" / Apple Pay (these stay disabled per the §6.4 labelling pass).

---

Once you sign off on §5 I'll build. Estimated ~3 h end-to-end.
