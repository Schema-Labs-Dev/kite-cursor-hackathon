// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KiteTreasury} from "../src/KiteTreasury.sol";

/// @notice Deploys the multi-token KiteTreasury to Base (mainnet or sepolia).
///         Reads USDC_ADDRESS_BASE_SEPOLIA, EURC_ADDRESS_BASE_SEPOLIA,
///         PRIVATE_KEY, and (optionally) YIELD_RESERVE_USDC /
///         YIELD_RESERVE_EURC from env. If the reserve envs are set and the
///         deployer holds enough of each token, the deployer also seeds the
///         contract's per-token yield reserve in the same broadcast.
contract Deploy is Script {
    function run() external returns (KiteTreasury treasury) {
        address usdc = vm.envAddress("USDC_ADDRESS_BASE_SEPOLIA");
        address eurc = vm.envAddress("EURC_ADDRESS_BASE_SEPOLIA");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        uint256 usdcReserve = vm.envOr("YIELD_RESERVE_USDC", uint256(0));
        uint256 eurcReserve = vm.envOr("YIELD_RESERVE_EURC", uint256(0));

        vm.startBroadcast(pk);

        treasury = new KiteTreasury(usdc, eurc);
        console.log("KiteTreasury deployed at:", address(treasury));

        if (usdcReserve > 0) {
            IERC20(usdc).approve(address(treasury), usdcReserve);
            treasury.fundYieldReserve(usdc, usdcReserve);
            console.log("Seeded USDC yield reserve:", usdcReserve);
        }
        if (eurcReserve > 0) {
            IERC20(eurc).approve(address(treasury), eurcReserve);
            treasury.fundYieldReserve(eurc, eurcReserve);
            console.log("Seeded EURC yield reserve:", eurcReserve);
        }

        vm.stopBroadcast();

        console.log("USDC token:              ", usdc);
        console.log("EURC token:              ", eurc);
        console.log("APY (bps):               ", treasury.APY_BPS());
    }
}
