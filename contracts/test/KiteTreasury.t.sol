// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {KiteTreasury} from "../src/KiteTreasury.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract MockEURC is ERC20 {
    constructor() ERC20("Euro Coin", "EURC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract KiteTreasuryTest is Test {
    KiteTreasury internal treasury;
    MockUSDC internal usdc;
    MockEURC internal eurc;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 internal constant ONE = 1e6;
    uint256 internal constant THOUSAND = 1_000e6;

    function setUp() public {
        usdc = new MockUSDC();
        eurc = new MockEURC();
        treasury = new KiteTreasury(address(usdc), address(eurc));

        usdc.mint(alice, THOUSAND);
        usdc.mint(bob, THOUSAND);
        eurc.mint(alice, THOUSAND);
        eurc.mint(bob, THOUSAND);

        // Seed each token's yield reserve so withdrawals can pay out
        // simulated yield. In production this is funded by the deployer.
        usdc.mint(address(this), 100 * ONE);
        usdc.approve(address(treasury), 100 * ONE);
        treasury.fundYieldReserve(address(usdc), 100 * ONE);

        eurc.mint(address(this), 100 * ONE);
        eurc.approve(address(treasury), 100 * ONE);
        treasury.fundYieldReserve(address(eurc), 100 * ONE);
    }

    /* --------------------------- constructor -------------------------- */

    function test_constructor_reverts_on_zero_usdc() public {
        vm.expectRevert(KiteTreasury.ZeroAddress.selector);
        new KiteTreasury(address(0), address(eurc));
    }

    function test_constructor_reverts_on_zero_eurc() public {
        vm.expectRevert(KiteTreasury.ZeroAddress.selector);
        new KiteTreasury(address(usdc), address(0));
    }

    function test_constructor_sets_supported_tokens() public view {
        assertEq(treasury.usdc(), address(usdc));
        assertEq(treasury.eurc(), address(eurc));
        assertTrue(treasury.supported(address(usdc)));
        assertTrue(treasury.supported(address(eurc)));
        assertFalse(treasury.supported(address(0xdeadbeef)));
    }

    /* -------------------------- fundYieldReserve ---------------------- */

    function test_fund_yield_reserve_emits_event_for_each_token() public {
        usdc.mint(address(this), 50 * ONE);
        usdc.approve(address(treasury), 50 * ONE);
        vm.expectEmit(true, true, false, true);
        emit KiteTreasury.YieldReserveFunded(address(this), address(usdc), 50 * ONE);
        treasury.fundYieldReserve(address(usdc), 50 * ONE);

        eurc.mint(address(this), 25 * ONE);
        eurc.approve(address(treasury), 25 * ONE);
        vm.expectEmit(true, true, false, true);
        emit KiteTreasury.YieldReserveFunded(address(this), address(eurc), 25 * ONE);
        treasury.fundYieldReserve(address(eurc), 25 * ONE);
    }

    function test_fund_yield_reserve_reverts_on_zero() public {
        vm.expectRevert(KiteTreasury.ZeroAmount.selector);
        treasury.fundYieldReserve(address(usdc), 0);
    }

    function test_fund_yield_reserve_reverts_on_unsupported_token() public {
        address unknown = address(0xC0FFEE);
        vm.expectRevert(
            abi.encodeWithSelector(KiteTreasury.UnsupportedToken.selector, unknown)
        );
        treasury.fundYieldReserve(unknown, 1);
    }

    /* ------------------------------ deposit --------------------------- */

    function test_deposit_increases_usdc_principal() public {
        uint256 before = usdc.balanceOf(address(treasury));

        vm.startPrank(alice);
        usdc.approve(address(treasury), THOUSAND);
        treasury.deposit(address(usdc), THOUSAND);
        vm.stopPrank();

        assertEq(treasury.principalOf(address(usdc), alice), THOUSAND);
        assertEq(usdc.balanceOf(address(treasury)), before + THOUSAND);
        assertEq(treasury.principalOf(address(eurc), alice), 0);
    }

    function test_deposit_increases_eurc_principal_independently() public {
        vm.startPrank(alice);
        eurc.approve(address(treasury), THOUSAND);
        treasury.deposit(address(eurc), THOUSAND);
        vm.stopPrank();

        assertEq(treasury.principalOf(address(eurc), alice), THOUSAND);
        assertEq(treasury.principalOf(address(usdc), alice), 0);
    }

    function test_deposit_reverts_on_zero_amount() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), 0);
        vm.expectRevert(KiteTreasury.ZeroAmount.selector);
        treasury.deposit(address(usdc), 0);
        vm.stopPrank();
    }

    function test_deposit_reverts_on_unsupported_token() public {
        address unknown = address(0xC0FFEE);
        vm.expectRevert(
            abi.encodeWithSelector(KiteTreasury.UnsupportedToken.selector, unknown)
        );
        vm.prank(alice);
        treasury.deposit(unknown, 1);
    }

    function test_deposit_emits_event_with_token() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), THOUSAND);
        vm.expectEmit(true, true, false, true);
        emit KiteTreasury.Deposited(alice, address(usdc), THOUSAND, block.timestamp);
        treasury.deposit(address(usdc), THOUSAND);
        vm.stopPrank();
    }

    /* ----------------------------- accrual ---------------------------- */

    function test_yield_accrues_at_4_2_percent_per_year_per_token() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), THOUSAND);
        treasury.deposit(address(usdc), THOUSAND);
        eurc.approve(address(treasury), THOUSAND);
        treasury.deposit(address(eurc), THOUSAND);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        // 4.20% of 1000 = 42 (token-units, both have 6 decimals)
        assertApproxEqAbs(treasury.balanceOf(address(usdc), alice), THOUSAND + 42 * ONE, 1e3);
        assertApproxEqAbs(treasury.balanceOf(address(eurc), alice), THOUSAND + 42 * ONE, 1e3);
    }

    function test_pending_yield_is_zero_for_no_position() public view {
        assertEq(treasury.pendingYield(address(usdc), bob), 0);
        assertEq(treasury.balanceOf(address(usdc), bob), 0);
        assertEq(treasury.pendingYield(address(eurc), bob), 0);
    }

    function test_yield_isolates_users_per_token() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), THOUSAND);
        treasury.deposit(address(usdc), THOUSAND);
        vm.stopPrank();

        vm.startPrank(bob);
        eurc.approve(address(treasury), 500 * ONE);
        treasury.deposit(address(eurc), 500 * ONE);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);

        // Alice has USDC only; Bob has EURC only. They must not bleed.
        assertApproxEqAbs(treasury.balanceOf(address(usdc), alice), THOUSAND + 42 * ONE, 1e3);
        assertEq(treasury.balanceOf(address(eurc), alice), 0);

        assertApproxEqAbs(treasury.balanceOf(address(eurc), bob), 500 * ONE + 21 * ONE, 1e3);
        assertEq(treasury.balanceOf(address(usdc), bob), 0);
    }

    /* ----------------------------- withdraw --------------------------- */

    function test_withdraw_returns_usdc_principal() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), THOUSAND);
        treasury.deposit(address(usdc), THOUSAND);
        treasury.withdraw(address(usdc), 200 * ONE);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 200 * ONE);
        assertEq(treasury.principalOf(address(usdc), alice), 800 * ONE);
    }

    function test_withdraw_returns_eurc_principal() public {
        vm.startPrank(alice);
        eurc.approve(address(treasury), THOUSAND);
        treasury.deposit(address(eurc), THOUSAND);
        treasury.withdraw(address(eurc), 300 * ONE);
        vm.stopPrank();

        assertEq(eurc.balanceOf(alice), 300 * ONE);
        assertEq(treasury.principalOf(address(eurc), alice), 700 * ONE);
    }

    function test_withdraw_includes_yield_when_exceeding_principal() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), THOUSAND);
        treasury.deposit(address(usdc), THOUSAND);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);

        vm.prank(alice);
        treasury.withdraw(address(usdc), THOUSAND + 42 * ONE);

        assertApproxEqAbs(usdc.balanceOf(alice), THOUSAND + 42 * ONE, 1e3);
        assertEq(treasury.principalOf(address(usdc), alice), 0);
    }

    function test_withdraw_reverts_on_overdraw() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), 100 * ONE);
        treasury.deposit(address(usdc), 100 * ONE);
        vm.expectRevert(
            abi.encodeWithSelector(
                KiteTreasury.InsufficientBalance.selector,
                200 * ONE,
                100 * ONE
            )
        );
        treasury.withdraw(address(usdc), 200 * ONE);
        vm.stopPrank();
    }

    function test_withdraw_reverts_on_unsupported_token() public {
        address unknown = address(0xC0FFEE);
        vm.expectRevert(
            abi.encodeWithSelector(KiteTreasury.UnsupportedToken.selector, unknown)
        );
        vm.prank(alice);
        treasury.withdraw(unknown, 1);
    }

    function test_withdraw_reverts_on_zero_amount() public {
        vm.prank(alice);
        vm.expectRevert(KiteTreasury.ZeroAmount.selector);
        treasury.withdraw(address(usdc), 0);
    }

    function test_withdraw_emits_event_with_token_and_yield_portion() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), THOUSAND);
        treasury.deposit(address(usdc), THOUSAND);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);

        uint256 amount = THOUSAND + 5 * ONE;
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit KiteTreasury.Withdrawn(alice, address(usdc), amount, 5 * ONE, block.timestamp);
        treasury.withdraw(address(usdc), amount);
    }

    /* ------------------------ multi-token interplay ------------------- */

    function test_alice_can_hold_positions_in_both_tokens_simultaneously() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), THOUSAND);
        treasury.deposit(address(usdc), THOUSAND);
        eurc.approve(address(treasury), 500 * ONE);
        treasury.deposit(address(eurc), 500 * ONE);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);

        // USDC pos
        assertApproxEqAbs(treasury.balanceOf(address(usdc), alice), THOUSAND + 42 * ONE, 1e3);
        // EURC pos: 4.2% of 500 = 21
        assertApproxEqAbs(treasury.balanceOf(address(eurc), alice), 500 * ONE + 21 * ONE, 1e3);
    }

    function test_withdrawing_usdc_does_not_touch_eurc_position() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), THOUSAND);
        treasury.deposit(address(usdc), THOUSAND);
        eurc.approve(address(treasury), THOUSAND);
        treasury.deposit(address(eurc), THOUSAND);

        treasury.withdraw(address(usdc), THOUSAND);
        vm.stopPrank();

        assertEq(treasury.principalOf(address(usdc), alice), 0);
        assertEq(treasury.principalOf(address(eurc), alice), THOUSAND);
        assertEq(usdc.balanceOf(alice), THOUSAND);
        // alice started with THOUSAND eurc, deposited it all → wallet 0
        assertEq(eurc.balanceOf(alice), 0);
    }

    function test_successive_deposits_compound_via_realised_yield_per_token() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), THOUSAND);

        treasury.deposit(address(usdc), 500 * ONE);
        vm.warp(block.timestamp + 365 days);
        treasury.deposit(address(usdc), 500 * ONE);
        vm.stopPrank();

        assertEq(treasury.principalOf(address(usdc), alice), THOUSAND);
        assertApproxEqAbs(treasury.balanceOf(address(usdc), alice), THOUSAND + 21 * ONE, 1e3);
    }
}
