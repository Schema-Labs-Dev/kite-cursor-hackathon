// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KiteUSDC} from "../src/KiteUSDC.sol";
import {KiteEURC} from "../src/KiteEURC.sol";

/// @notice Deploys the Kite-controlled testnet USDC + EURC tokens. Mints
///         INITIAL_SUPPLY of each to the deployer so they can fund the
///         Treasury yield reserve, seed the Uniswap V3 pool, and mint to
///         test accounts via `KiteUSDC.mint` / `KiteEURC.mint`.
///
///         Env required: PRIVATE_KEY.
///         Optional: INITIAL_SUPPLY (raw uint, 6-decimal units). Default
///         1_000_000_000_000 = 1,000,000 USDC.
contract DeployTokens is Script {
    function run() external returns (KiteUSDC usdc, KiteEURC eurc) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        uint256 initialSupply = vm.envOr(
            "INITIAL_SUPPLY",
            uint256(1_000_000) * 10 ** 6
        );

        vm.startBroadcast(pk);
        usdc = new KiteUSDC(initialSupply);
        console.log("KiteUSDC deployed at:", address(usdc));
        eurc = new KiteEURC(initialSupply);
        console.log("KiteEURC deployed at:", address(eurc));
        vm.stopBroadcast();

        console.log("Initial supply per token (raw, 6 decimals):", initialSupply);
        console.log("Deployer holds both supplies.");
    }
}
