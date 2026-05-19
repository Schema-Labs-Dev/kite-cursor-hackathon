# 03 — Smart Contracts

## Scope

For the hackathon MVP, you write **one** contract: `KiteTreasury.sol`.

Everything else (USDC, Smart Wallet, Basenames, Paymaster) is already deployed by Circle, Coinbase, or Base — we just integrate.

| Contract | Owner | Address (Base Sepolia) |
|---|---|---|
| `KiteTreasury.sol` | **You write** | [`0xFF3889c6898F3172D749999cbb2a31984e5B997b`](https://sepolia.basescan.org/address/0xFF3889c6898F3172D749999cbb2a31984e5B997b) ✅ deployed |
| `USDC` | Circle | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| `Smart Wallet Factory` | Coinbase | Use Coinbase Smart Wallet SDK |
| `BaseNames` | Base | Use OnchainKit |

## Foundry setup

```bash
cd contracts
# Already initialized via `forge init` in the monorepo doc
```

Edit `contracts/foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
base_sepolia = "${BASE_SEPOLIA_RPC_URL}"

[etherscan]
base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
```

Install OpenZeppelin:

```bash
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

## `KiteTreasury.sol`

A simplified yield vault. **No real Morpho integration** for the hackathon — yield is computed from a fixed APY for demo purposes. Production version would route to Morpho's `supply()` / `withdraw()`.

Place at `contracts/src/KiteTreasury.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title KiteTreasury
/// @notice Hackathon-grade yield vault. Holds USDC, simulates yield via fixed APY.
///         Production version routes to Morpho on Base.
contract KiteTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    /// @notice APY in basis points. 420 = 4.20%
    uint256 public constant APY_BPS = 420;
    uint256 private constant BPS_DENOM = 10_000;
    uint256 private constant SECONDS_PER_YEAR = 365 days;

    struct Position {
        uint256 principal;
        uint256 lastUpdate;
        uint256 accruedYield;
    }

    mapping(address => Position) public positions;

    event Deposited(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 amount, uint256 yield, uint256 timestamp);

    constructor(address _usdc) {
        require(_usdc != address(0), "zero usdc");
        usdc = IERC20(_usdc);
    }

    /// @notice Deposit USDC into the vault. Yield begins accruing immediately.
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "zero amount");
        _accrue(msg.sender);
        positions[msg.sender].principal += amount;
        positions[msg.sender].lastUpdate = block.timestamp;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, block.timestamp);
    }

    /// @notice Withdraw principal + accrued yield (or partial principal).
    /// @dev If amount > principal, the excess is paid from accruedYield.
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "zero amount");
        _accrue(msg.sender);
        Position storage p = positions[msg.sender];
        require(amount <= p.principal + p.accruedYield, "insufficient");

        uint256 fromYield = 0;
        if (amount <= p.principal) {
            p.principal -= amount;
        } else {
            fromYield = amount - p.principal;
            p.principal = 0;
            p.accruedYield -= fromYield;
        }
        p.lastUpdate = block.timestamp;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, fromYield, block.timestamp);
    }

    /// @notice Total claimable balance (principal + yield) for a user.
    function balanceOf(address user) external view returns (uint256) {
        Position memory p = positions[user];
        return p.principal + p.accruedYield + _pendingYield(p);
    }

    /// @notice Yield accrued but not yet realised.
    function pendingYield(address user) external view returns (uint256) {
        return _pendingYield(positions[user]);
    }

    function _accrue(address user) internal {
        Position storage p = positions[user];
        uint256 pending = _pendingYield(p);
        if (pending > 0) {
            p.accruedYield += pending;
        }
        p.lastUpdate = block.timestamp;
    }

    function _pendingYield(Position memory p) internal view returns (uint256) {
        if (p.principal == 0 || p.lastUpdate == 0) return 0;
        uint256 elapsed = block.timestamp - p.lastUpdate;
        return (p.principal * APY_BPS * elapsed) / (BPS_DENOM * SECONDS_PER_YEAR);
    }
}
```

## Tests

Place at `contracts/test/KiteTreasury.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {KiteTreasury} from "../src/KiteTreasury.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract KiteTreasuryTest is Test {
    KiteTreasury treasury;
    MockUSDC usdc;
    address alice = address(0xA11CE);

    function setUp() public {
        usdc = new MockUSDC();
        treasury = new KiteTreasury(address(usdc));
        usdc.mint(alice, 1_000e6); // 1,000 USDC
    }

    function test_deposit_and_yield_accrual() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), 1_000e6);
        treasury.deposit(1_000e6);
        vm.stopPrank();

        // Fast-forward one year
        vm.warp(block.timestamp + 365 days);
        // 4.20% of 1000 USDC = 42 USDC
        assertApproxEqAbs(treasury.balanceOf(alice), 1_042e6, 1e3);
    }

    function test_withdraw_principal_only() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), 500e6);
        treasury.deposit(500e6);
        treasury.withdraw(200e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 700e6);
    }

    function test_withdraw_with_yield() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), 1_000e6);
        treasury.deposit(1_000e6);
        vm.warp(block.timestamp + 365 days);
        treasury.withdraw(1_042e6); // principal + ~all yield
        vm.stopPrank();

        assertApproxEqAbs(usdc.balanceOf(alice), 1_042e6, 1e3);
    }

    function test_revert_on_overdraw() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), 100e6);
        treasury.deposit(100e6);
        vm.expectRevert("insufficient");
        treasury.withdraw(200e6);
        vm.stopPrank();
    }
}
```

Run:

```bash
forge test -vv
```

All four tests should pass.

## Deployment script

Place at `contracts/script/Deploy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KiteTreasury} from "../src/KiteTreasury.sol";

contract Deploy is Script {
    function run() external {
        address usdc = vm.envAddress("USDC_ADDRESS_BASE_SEPOLIA");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        KiteTreasury treasury = new KiteTreasury(usdc);
        vm.stopBroadcast();

        console.log("KiteTreasury deployed at:", address(treasury));
    }
}
```

## Get testnet ETH and USDC

You need both on Base Sepolia for the deployer:

1. **ETH** — [https://www.alchemy.com/faucets/base-sepolia](https://www.alchemy.com/faucets/base-sepolia)
2. **USDC** — [https://faucet.circle.com](https://faucet.circle.com) (select Base Sepolia)

## Deploy

From `contracts/`:

```bash
# Load env vars
source ../.env

# Dry run
forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --sender $(cast wallet address $PRIVATE_KEY)

# Real deploy + verify
forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify
```

Copy the deployed address into `.env`:

```bash
KITE_TREASURY_ADDRESS=0x...
EXPO_PUBLIC_KITE_TREASURY_ADDRESS=0x...
```

## Export ABI for the backend and mobile app

After `forge build`, the ABI is at:

```
contracts/out/KiteTreasury.sol/KiteTreasury.json
```

The backend imports this directly. Mobile imports a copy. We'll create a tiny `abi/` folder symlinked from both later — or just commit the JSON.

## Done — what you have

- A deployed `KiteTreasury` on Base Sepolia
- A passing test suite
- An ABI ready for the backend and mobile to consume
- An address to plug into env vars

Move on to [`04-backend-nestjs.md`](./04-backend-nestjs.md).
