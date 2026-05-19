# 14 — USDC ↔ EURC Swap

> **STATUS:** Shipped. End-to-end USDC ↔ EURC swap on Base Sepolia, routed through the **real Uniswap V3** deployment with a pool we seed ourselves.
>
> Originally a research doc on bridging options; updated with what actually shipped (we chose "Uniswap on testnet" over the fixed-rate `KiteSwap.sol` alternative).

---

## What shipped

**Backend (`apps/api/`)**
- `scripts/init-swap-pool.ts` — one-shot pool deployer. Uses viem to (1) call `createAndInitializePoolIfNecessary` on Uniswap V3's `NonfungiblePositionManager`, (2) approve USDC + EURC, (3) mint a full-range position with the user's chosen seed amounts.
- `package.json` script: `pnpm --filter @kite/api pool <args>` — wraps the script.

**Mobile (`apps/mobile/`)**
- `lib/uniswap.ts` — Uniswap V3 addresses, ABIs, quote helper (`QuoterV2.quoteExactInputSingle`), encode helpers for `approve` + `exactInputSingle`, slippage math.
- `hooks/use-swap.ts` — `useSwap()` mutation (allowance check → approve tx if needed → swap tx → wait for receipt → invalidate queries) + `useSwapQuote()` for the live preview. Phase tracking (`approving | swapping | waiting | done`) for the CTA label.
- `app/convert.tsx` — modal screen. Two-side pair card with USDC/EURC flip button, amount keypad, live quote with `1 USDC = X EURC` rate readout, fee + slippage disclosure, single Convert CTA that runs the whole approve-then-swap dance, success screen with real tx hash and measured settle time linking to BaseScan.
- `app/(tabs)/home.tsx` — discreet `⇄ convert` link in the Wallets section header.
- `app/_layout.tsx` — registers `convert` as a bottom-sheet modal.
- `hooks/index.ts` — exports `useSwap`, `useSwapQuote`.

## To use it

The pool starts empty. Seed once with a wallet that has both tokens + a little Sepolia ETH:

```bash
# Fund the wallet at https://faucet.circle.com (Base Sepolia, USDC and EURC).
# Then in the repo root:
pnpm --filter @kite/api pool init \
  --usdc 50 \
  --eurc 46 \
  --rate 1.0875
```

Args:
- `--usdc <decimal>` — USDC seeded into the pool (default `50`).
- `--eurc <decimal>` — EURC seeded into the pool (default `46`).
- `--rate <decimal>` — USDC per 1 EURC, sets the pool's initial price (default `1.0875`).

For symmetric depth use `usdc ≈ eurc × rate`. Re-runs are safe — if the pool already exists, the script skips init and just mints more liquidity.

The script needs `PRIVATE_KEY` set in `apps/api/.env` — same key your contracts deploy uses. It pulls `USDC_ADDRESS_BASE_SEPOLIA`, `EURC_ADDRESS_BASE_SEPOLIA`, and the Alchemy RPC from the same env.

Once the pool is seeded, mobile users tap `⇄ convert` on Home → pick direction → enter amount → see live quote → tap Convert. Approve tx, then swap tx. Settles in ~2–5s on Base Sepolia.

## Contract addresses (Base Sepolia)

Verified via [Uniswap docs](https://developers.uniswap.org/contracts/v3/reference/deployments/base-deployments):

| Contract | Address |
|---|---|
| `UniswapV3Factory` | `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24` |
| `SwapRouter02` | `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4` |
| `QuoterV2` | `0xC5290058841028F1614F3A6F0F5816cAd0df5E27` |
| `NonfungiblePositionManager` | `0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2` |

Pool params used:
- Fee tier: `100` (0.01% — standard for stable pairs)
- Tick range: `MIN_TICK / MAX_TICK` aligned to tickSpacing=1 (full range — simpler than concentrated, fine for demo depth)
- Token ordering: `token0 = lower address`. USDC `0x036c…` < EURC `0x8084…`, so USDC is token0.

Slippage default in `lib/uniswap.ts`: `50` bps (0.5%). Tweak `SLIPPAGE_BPS` in `use-swap.ts` if needed.

---

## Why this route (vs. alternatives)

Three options were on the table:

1. **Uniswap V3 on Base Sepolia + self-seeded pool** ← shipped.
   - Real DEX, real on-chain swap, no proprietary contract to maintain.
   - Trade-off: requires the one-time pool seeding step.
2. **Fixed-rate `KiteSwap.sol`** (60-line conversion contract).
   - Cheaper to set up, no liquidity worries.
   - Trade-off: not a real swap; effectively a custodial exchange at a hardcoded rate.
3. **0x Swap API** (mainnet only).
   - Cleanest production path — aggregates Aerodrome + Uniswap + Curve.
   - Trade-off: no testnet support.

We went with **#1** because (a) the demo gets to claim "real Uniswap routing" rather than a custom contract, (b) the pool seed is a one-time chore that doubles as faucet exercise, and (c) the same `lib/uniswap.ts` works against Base mainnet by changing the address constants — no app-side refactor for production.

The production-ready alternative remains **0x Swap API** for mainnet — see "Sources" below. Swapping `lib/uniswap.ts` for a `lib/swap-aggregator.ts` that calls 0x is a ~30-minute change post-hackathon, with `use-swap.ts` and `app/convert.tsx` unchanged.

## Why CCTP is the wrong tool

[Circle's CCTP V2](https://www.circle.com/cross-chain-transfer-protocol) burn-and-mints **the same token across chains** — USDC Ethereum → USDC Base, or EURC Avalanche → EURC Base. It does **not** convert USDC into EURC. Different ledger entirely.

So our problem is a standard DEX swap, not a bridge.

---

## Why CCTP is the wrong tool

[Circle's CCTP V2](https://www.circle.com/cross-chain-transfer-protocol) burn-and-mints **the same token across chains** — USDC Ethereum → USDC Base, or EURC Avalanche → EURC Base. It does **not** convert USDC into EURC. Different ledger entirely.

So our problem is a standard DEX swap, not a bridge.

---

## Mainnet liquidity (where the real swap would happen)

### Aerodrome — recommended primary

Base's dominant DEX. Two USDC/EURC pools:

| Pool | Type | TVL | Fee | Contract |
|---|---|---|---|---|
| EURC/USDC SlipStream | Concentrated | ~$800k | 0.01% | `0xc5e51044eb7318950b1afb044fccfb25782c48c1` |
| EURC/USDC Stable | Curve-style stable | ~$1.9k | n/a | `0xfdf5139b38525627b47538536042a7c8d2686bd9` |

The SlipStream pool is what nearly all volume routes through. Depth is fine for hackathon-scale + early product. SlipStream is Aerodrome's Uniswap V3-style concentrated-liquidity AMM, so swap calls look like Uniswap V3.

### Uniswap V3 — fallback

Also has USDC/EURC pools on Base Mainnet but shallower than Aerodrome. Worth letting an aggregator route through both.

### 0x Swap API — recommended router

Instead of integrating one DEX directly, use the [0x Swap API](https://0x.org/docs/0x-swap-api/api-references/get-swap-v1-quote): one GET request, returns the best route across Aerodrome + Uniswap + Curve + Maverick + others, including calldata you sign and broadcast as-is.

```
GET https://base.api.0x.org/swap/v1/quote
  ?sellToken=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   // USDC on Base mainnet
  &buyToken=0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42    // EURC on Base mainnet
  &sellAmount=10000000                                     // $10 in 6-decimal units
  &takerAddress=0x...
```

Returns `{ to, data, value, gas, price, estimatedPriceImpact, ... }`. App calls `wallet.sendTransaction({ to, data, value })`. Done.

No API key required for ≤1 req/sec; sign up for a free key for higher volume.

### 1inch — alternative router

Same idea as 0x. [API](https://docs.1inch.io/) requires a key on the dev portal. Slightly better routing in stablecoin markets historically; uglier developer experience.

---

## Testnet (Base Sepolia) — no DEX option

- **No Aerodrome on testnet** — they only deployed to mainnet.
- **Uniswap V3 IS on Base Sepolia** at:
  - `UniswapV3Factory`: `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`
  - `SwapRouter02`: `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4`
  - `UniversalRouter`: `0x492E6456D9528771018DeB9E87ef7750EF184104`
  - `QuoterV2`: `0xC5290058841028F1614F3A6F0F5816cAd0df5E27`
- **But:** no USDC/EURC pool exists on Base Sepolia. You'd have to deploy one yourself and seed both sides with faucet'd tokens. That's ~50 lines of script + a few hundred USDC/EURC of faucet drain — not worth the complexity for a demo.

**Just build `KiteSwap.sol`.** See below.

---

## Reference — alternative `KiteSwap.sol` (not shipped)

Kept for reference in case real DEX liquidity becomes infeasible. 60-line fixed-rate converter.

A 60-line contract:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Fixed-rate USDC ↔ EURC converter, demo-only.
/// Reserves are funded by the owner from the Circle faucet. Rate is set by owner.
contract KiteSwap is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;   // 6 decimals
    IERC20 public immutable eurc;   // 6 decimals

    /// USDC per 1 EURC, scaled by 1e6. Example: 1.0875e6 = 1 EURC costs 1.0875 USDC.
    uint256 public rateUsdcPerEurc;

    event Swapped(address indexed user, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut);
    event RateSet(uint256 rateUsdcPerEurc);

    constructor(address _usdc, address _eurc, uint256 _initialRate) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        eurc = IERC20(_eurc);
        rateUsdcPerEurc = _initialRate;
    }

    function setRate(uint256 r) external onlyOwner {
        rateUsdcPerEurc = r;
        emit RateSet(r);
    }

    /// Quote EURC out for given USDC in.
    function quoteUsdcToEurc(uint256 usdcIn) public view returns (uint256) {
        return (usdcIn * 1e6) / rateUsdcPerEurc;
    }

    /// Quote USDC out for given EURC in.
    function quoteEurcToUsdc(uint256 eurcIn) public view returns (uint256) {
        return (eurcIn * rateUsdcPerEurc) / 1e6;
    }

    function swapUsdcToEurc(uint256 usdcIn) external nonReentrant returns (uint256 eurcOut) {
        eurcOut = quoteUsdcToEurc(usdcIn);
        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);
        eurc.safeTransfer(msg.sender, eurcOut);
        emit Swapped(msg.sender, address(usdc), usdcIn, address(eurc), eurcOut);
    }

    function swapEurcToUsdc(uint256 eurcIn) external nonReentrant returns (uint256 usdcOut) {
        usdcOut = quoteEurcToUsdc(eurcIn);
        eurc.safeTransferFrom(msg.sender, address(this), eurcIn);
        usdc.safeTransfer(msg.sender, usdcOut);
        emit Swapped(msg.sender, address(eurc), eurcIn, address(usdc), usdcOut);
    }
}
```

**Deploy** with the existing Foundry setup. **Seed** with ~$50 USDC and €50 EURC from the Circle faucet. **Front-end flow:** Convert screen → token picker + amount → `approve(swap, amount)` → `swap*` → wait for receipt → balance refreshes via existing `useBalance` polling.

**Honesty knob:** display a "1 USDC ≈ €0.92 — fixed-rate, updated daily" hint so judges know this isn't a price oracle. Mainnet swap routes through 0x for real prices.

---

## Recommended sequence

1. **Now (in this build):** ship the multi-token Treasury so users can hold both USDC and EURC at yield. The agent running in parallel is doing this. **No swap UI yet** — users top up the side they want from Circle's faucet.
2. **Next session (optional MVP polish):** add `KiteSwap.sol` + a single "Convert" screen, take ~1 hour total.
3. **Mainnet (post-hackathon):** swap the `KiteSwap.sol` glue for a `lib/swap.ts` that calls 0x Swap API → signs and broadcasts. The mobile UI doesn't change; only the data source under the hood.

---

## Sources

- [Aerodrome Liquidity Page](https://aerodrome.finance/liquidity)
- [EURC/USDC SlipStream pool on GeckoTerminal](https://www.geckoterminal.com/base/pools/0xc5e51044eb7318950b1afb044fccfb25782c48c1)
- [Uniswap V3 Base Deployments (incl. Base Sepolia)](https://developers.uniswap.org/contracts/v3/reference/deployments/base-deployments)
- [Circle EURC](https://www.circle.com/eurc)
- [Circle CCTP V2](https://www.circle.com/cross-chain-transfer-protocol) — useful background on why CCTP doesn't apply
