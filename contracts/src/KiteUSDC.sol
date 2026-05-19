// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Kite USD — a Base-Sepolia-only test stablecoin
/// @notice Owner-mintable ERC-20 with 6 decimals, used in place of Circle's
///         official Base Sepolia USDC so the Kite team can mint freely for
///         demos, pool seeding, and end-to-end testing. Token symbol is
///         "USDC" so existing mobile labels render unchanged; the contract
///         name "Kite USD" disambiguates on block explorers.
contract KiteUSDC is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("Kite USD", "USDC") Ownable(msg.sender) {
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Owner-only mint. Use for seeding additional accounts or pools.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
