// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title KiteTreasury
/// @notice Hackathon-grade multi-token vault. Holds user deposits across an
///         allow-listed set of ERC-20 tokens (USDC + EURC on Base Sepolia)
///         and accrues yield at a fixed simulated APY per (token, user).
///         The production version routes to Morpho on Base; this version
///         simulates the same interface so the frontend, indexer, and tests
///         stay identical.
/// @dev    Yield is computed lazily inside `balanceOf` / `pendingYield`, and
///         materialised into `accruedYield` whenever a user transacts. Each
///         supported token tracks its own positions and its own yield reserve.
contract KiteTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Annual yield in basis points. 420 = 4.20% APY.
    uint256 public constant APY_BPS = 420;
    uint256 private constant BPS_DENOM = 10_000;
    uint256 private constant SECONDS_PER_YEAR = 365 days;

    /// @notice First supported token. Kept named `usdc` for ABI continuity
    ///         with the v1 single-token vault that the indexer / mobile read.
    address public immutable usdc;
    /// @notice Second supported token. Euro Coin on Base Sepolia.
    address public immutable eurc;

    struct Position {
        uint256 principal;
        uint256 accruedYield;
        uint256 lastUpdate;
    }

    /// @dev token => user => position
    mapping(address token => mapping(address user => Position)) private _positions;
    /// @dev which tokens this vault accepts. Cheaper than iterating an array.
    mapping(address token => bool) public supported;

    event Deposited(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    event Withdrawn(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 yieldPortion,
        uint256 timestamp
    );
    event YieldReserveFunded(
        address indexed funder,
        address indexed token,
        uint256 amount
    );

    error ZeroAmount();
    error ZeroAddress();
    error UnsupportedToken(address token);
    error InsufficientBalance(uint256 requested, uint256 available);

    constructor(address _usdc, address _eurc) {
        if (_usdc == address(0) || _eurc == address(0)) revert ZeroAddress();
        usdc = _usdc;
        eurc = _eurc;
        supported[_usdc] = true;
        supported[_eurc] = true;
    }

    /// @notice Deposit `amount` of `token` into the vault. Yield begins
    ///         accruing immediately. Caller must have approved `amount` to
    ///         this contract first.
    function deposit(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (!supported[token]) revert UnsupportedToken(token);

        _accrue(token, msg.sender);
        Position storage p = _positions[token][msg.sender];
        p.principal += amount;
        p.lastUpdate = block.timestamp;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, token, amount, block.timestamp);
    }

    /// @notice Withdraw `amount` of `token` from the vault. Pulls from
    ///         principal first, then from accrued yield.
    function withdraw(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (!supported[token]) revert UnsupportedToken(token);

        _accrue(token, msg.sender);
        Position storage p = _positions[token][msg.sender];

        uint256 available = p.principal + p.accruedYield;
        if (amount > available) revert InsufficientBalance(amount, available);

        uint256 fromYield;
        if (amount <= p.principal) {
            p.principal -= amount;
        } else {
            fromYield = amount - p.principal;
            p.principal = 0;
            p.accruedYield -= fromYield;
        }
        p.lastUpdate = block.timestamp;

        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, token, amount, fromYield, block.timestamp);
    }

    /// @notice Sponsor a token's yield pool. The simulated APY model creates
    ///         yield out of thin air; this function lets anyone seed real
    ///         token balance so withdrawals can pay out the simulated yield.
    function fundYieldReserve(address token, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (!supported[token]) revert UnsupportedToken(token);
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit YieldReserveFunded(msg.sender, token, amount);
    }

    /* ----------------------------- views ------------------------------ */

    /// @notice Total claimable balance for `user` in `token`
    ///         (principal + realised + pending yield).
    function balanceOf(address token, address user)
        external
        view
        returns (uint256)
    {
        Position memory p = _positions[token][user];
        return p.principal + p.accruedYield + _pendingYield(p);
    }

    /// @notice Yield accrued since last interaction, not yet realised.
    function pendingYield(address token, address user)
        external
        view
        returns (uint256)
    {
        return _pendingYield(_positions[token][user]);
    }

    /// @notice Convenience getter for the indexer.
    function principalOf(address token, address user)
        external
        view
        returns (uint256)
    {
        return _positions[token][user].principal;
    }

    /// @notice Full position read-out, useful for direct debugging.
    function positions(address token, address user)
        external
        view
        returns (uint256 principal, uint256 accruedYield, uint256 lastUpdate)
    {
        Position memory p = _positions[token][user];
        return (p.principal, p.accruedYield, p.lastUpdate);
    }

    /* --------------------------- internal ----------------------------- */

    function _accrue(address token, address user) internal {
        Position storage p = _positions[token][user];
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
