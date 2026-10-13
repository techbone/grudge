// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Grudge} from "../src/Grudge.sol";

contract MockChog {
    mapping(uint256 => address) public ownerOf;

    function set(uint256 id, address who) external {
        ownerOf[id] = who;
    }
}

contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
    }

    function approve(address s, uint256 amt) external returns (bool) {
        allowance[msg.sender][s] = amt;
        return true;
    }

    function transfer(address to, uint256 amt) external returns (bool) {
        balanceOf[msg.sender] -= amt;
        balanceOf[to] += amt;
        return true;
    }

    function transferFrom(address from, address to, uint256 amt) external returns (bool) {
        allowance[from][msg.sender] -= amt;
        balanceOf[from] -= amt;
        balanceOf[to] += amt;
        return true;
    }
}

contract GrudgeTest is Test {
    Grudge g;
    MockChog chog;
    MockToken tok;

    address alice = makeAddr("alice"); // holds 1, 2
    address bob = makeAddr("bob"); // holds 3
    address carol = makeAddr("carol"); // holds 4
    address dead = 0x000000000000000000000000000000000000dEaD;

    uint128 constant SCRUB = 100e18;
    uint128 constant TRUCE = 50e18;

    function setUp() public {
        vm.warp(1_760_000_000);
        chog = new MockChog();
        tok = new MockToken();
        g = new Grudge(address(chog), address(tok), SCRUB, TRUCE, 1000);
        chog.set(1, alice);
        chog.set(2, alice);
        chog.set(3, bob);
        chog.set(4, carol);
        for (uint256 i; i < 3; ++i) {
            address who = [alice, bob, carol][i];
            tok.mint(who, 10_000e18);
            vm.prank(who);
            tok.approve(address(g), type(uint256).max);
        }
    }

    // ── prank ──

    function test_prank_leaves_scar_and_opens_payback() public {
        vm.prank(alice);
        g.prank(1, 3, 2);

        Grudge.Scar[8] memory s = g.scars(3);
        assertEq(s[0].by, 1);
        assertEq(s[0].kind, 2);
        assertFalse(s[0].heavy);
        assertEq(g.stats(3).received, 1);
        assertEq(g.stats(1).landed, 1);
        assertEq(g.stats(1).notoriety, 1);
        assertEq(g.movesLeft(1), 2);
        assertEq(g.heat(1, 3), 1);
        assertEq(g.paybackUntil(3, 1), block.timestamp + 3 days);
    }

    function test_prank_requires_ownership() public {
        vm.prank(bob);
        vm.expectRevert(Grudge.NotOwner.selector);
        g.prank(1, 3, 0);
    }

    function test_prank_rejects_own_wallet_target() public {
        vm.prank(alice);
        vm.expectRevert(Grudge.SameOwner.selector);
        g.prank(1, 2, 0);
    }

    function test_prank_rejects_bad_ids_and_kind() public {
        vm.startPrank(alice);
        vm.expectRevert(Grudge.BadId.selector);
        g.prank(1, 0, 0);
        vm.expectRevert(Grudge.BadId.selector);
        g.prank(1, 1970, 0);
        vm.expectRevert(Grudge.BadKind.selector);
        g.prank(1, 3, 5);
    }

    function test_one_prank_per_target_per_day() public {
        vm.startPrank(alice);
        g.prank(1, 3, 0);
        vm.expectRevert(Grudge.AlreadyPrankedToday.selector);
        g.prank(1, 3, 1);
        vm.warp(block.timestamp + 1 days);
        g.prank(1, 3, 1);
    }

    function test_three_moves_per_day_then_reset() public {
        for (uint16 t = 3; t <= 5; ++t) {
            if (t == 5) chog.set(5, carol);
            vm.prank(alice);
            g.prank(1, t, 0);
        }
        chog.set(6, bob);
        vm.prank(alice);
        vm.expectRevert(Grudge.OutOfMoves.selector);
        g.prank(1, 6, 0);

        vm.warp(block.timestamp + 1 days);
        assertEq(g.movesLeft(1), 3);
        vm.prank(alice);
        g.prank(1, 6, 0);
    }

    function test_scars_ring_paints_over_oldest() public {
        // 9 different attackers, each lands one scar on #3
        for (uint16 i = 10; i < 19; ++i) {
            chog.set(i, address(uint160(i)));
            vm.prank(address(uint160(i)));
            g.prank(i, 3, 0);
        }
        Grudge.Scar[8] memory s = g.scars(3);
        assertEq(s[0].by, 18); // 9th scar overwrote slot 0
        assertEq(s[1].by, 11);
        assertEq(g.stats(3).received, 9);
    }

    // ── sale inheritance ──

    function test_buyer_inherits_scars_and_payback() public {
        vm.prank(alice);
        g.prank(1, 3, 0);

        chog.set(3, carol); // bob sells #3 to carol

        vm.prank(bob);
        vm.expectRevert(Grudge.NotOwner.selector);
        g.payback(3, 1, 0);

        vm.prank(carol);
        g.payback(3, 1, 4);
        assertEq(g.scars(1)[0].by, 3);
        assertTrue(g.scars(1)[0].heavy);
    }

    // ── payback ──

    function test_payback_is_heavy_free_and_single_use() public {
        vm.prank(alice);
        g.prank(1, 3, 0);

        vm.startPrank(bob);
        g.payback(3, 1, 1);
        assertEq(g.movesLeft(3), 3); // free
        assertEq(g.stats(3).notoriety, 2);
        assertEq(g.heat(1, 3), 3);
        assertEq(g.paybackUntil(1, 3), 0); // no counter-payback

        vm.expectRevert(Grudge.NoPayback.selector);
        g.payback(3, 1, 1);
    }

    function test_payback_expires() public {
        vm.prank(alice);
        g.prank(1, 3, 0);
        vm.warp(block.timestamp + 3 days + 1);
        vm.prank(bob);
        vm.expectRevert(Grudge.NoPayback.selector);
        g.payback(3, 1, 0);
    }

    function test_payback_without_prank_reverts() public {
        vm.prank(bob);
        vm.expectRevert(Grudge.NoPayback.selector);
        g.payback(3, 1, 0);
    }

    // ── heat ──

    function test_heat_caps_and_decays() public {
        vm.prank(alice);
        g.prank(1, 3, 0);
        vm.prank(bob);
        g.payback(3, 1, 0);
        assertEq(g.heat(3, 1), 3);

        vm.warp(block.timestamp + 1 days);
        assertEq(g.heat(1, 3), 2);
        vm.warp(block.timestamp + 2 days);
        assertEq(g.heat(1, 3), 0);
    }

    // ── scrub ──

    function test_scrub_burns_and_clears() public {
        vm.prank(alice);
        g.prank(1, 3, 0);

        vm.prank(bob);
        g.scrub(3, 0);
        assertEq(g.scars(3)[0].by, 0);
        assertEq(tok.balanceOf(dead), SCRUB);
        assertEq(tok.balanceOf(bob), 10_000e18 - SCRUB);
    }

    function test_scrub_guards() public {
        vm.prank(bob);
        vm.expectRevert(Grudge.EmptySlot.selector);
        g.scrub(3, 0);
        vm.prank(bob);
        vm.expectRevert(Grudge.BadSlot.selector);
        g.scrub(3, 8);
        vm.prank(alice);
        vm.expectRevert(Grudge.NotOwner.selector);
        g.scrub(3, 0);
    }

    // ── truce ──

    function test_truce_needs_both_sides() public {
        vm.prank(alice);
        g.prank(1, 3, 0);

        vm.prank(bob);
        g.truce(3, 1);
        assertTrue(g.truceOffered(3, 1));
        assertEq(g.heat(1, 3), 1);

        vm.prank(bob);
        vm.expectRevert(Grudge.AlreadyOffered.selector);
        g.truce(3, 1);

        vm.prank(alice);
        g.truce(1, 3);
        assertEq(g.heat(1, 3), 0);
        assertEq(g.paybackUntil(3, 1), 0);
        assertFalse(g.truceOffered(3, 1));
        assertEq(tok.balanceOf(dead), 2 * uint256(TRUCE));
    }

    // ── bounty ──

    function test_bounty_claimed_by_next_prank() public {
        vm.prank(carol);
        g.postBounty(3, 1000e18);
        assertEq(tok.balanceOf(address(g)), 1000e18);

        vm.prank(alice);
        g.prank(1, 3, 0);

        assertEq(tok.balanceOf(alice), 10_000e18 + 900e18);
        assertEq(tok.balanceOf(dead), 100e18);
        assertEq(g.stats(1).notoriety, 3);
        (, uint96 amount,) = g.bounties(3);
        assertEq(amount, 0);
    }

    function test_funder_cannot_claim_own_bounty() public {
        chog.set(5, carol);
        vm.prank(carol);
        g.postBounty(3, 1000e18);
        vm.prank(carol);
        g.prank(5, 3, 0);
        (, uint96 amount,) = g.bounties(3);
        assertEq(amount, 1000e18);
    }

    function test_bounty_one_at_a_time_and_cancel_after_lock() public {
        vm.prank(carol);
        g.postBounty(3, 1000e18);

        vm.prank(alice);
        vm.expectRevert(Grudge.BountyOpen.selector);
        g.postBounty(3, 5e18);

        vm.prank(carol);
        vm.expectRevert(Grudge.BountyLocked.selector);
        g.cancelBounty(3);

        vm.prank(alice);
        vm.expectRevert(Grudge.NoBounty.selector);
        g.cancelBounty(3);

        vm.warp(block.timestamp + 3 days);
        vm.prank(carol);
        g.cancelBounty(3);
        assertEq(tok.balanceOf(carol), 10_000e18);
    }

    // ── views & admin ──

    function test_getChogs_pages_and_skips_invalid() public {
        vm.prank(alice);
        g.prank(1, 3, 0);
        (Grudge.Stats[] memory st, Grudge.Scar[8][] memory sc) = g.getChogs(0, 5);
        assertEq(st.length, 5);
        assertEq(st[1].landed, 1);
        assertEq(sc[3][0].by, 1);
        g.getChogs(1960, 20); // runs past MAX_ID without reverting
    }

    function test_only_owner_sets_prices() public {
        vm.prank(alice);
        vm.expectRevert(Grudge.NotOwner.selector);
        g.setPrices(1, 1, 1);

        vm.expectRevert(Grudge.TooHigh.selector);
        g.setPrices(1, 1, 2001);

        g.setPrices(1, 2, 300);
        assertEq(g.scrubPrice(), 1);
        assertEq(g.bountyFeeBps(), 300);
    }

    // ── history log ──

    function test_log_records_every_action_in_order() public {
        vm.prank(carol);
        g.postBounty(3, 1000e18);
        vm.prank(alice);
        g.prank(1, 3, 2); // also claims the bounty
        vm.prank(bob);
        g.payback(3, 1, 4);
        vm.prank(bob);
        g.scrub(3, 0);

        assertEq(g.logLength(), 5);
        Grudge.Entry[] memory all = g.getLog(0, 10);
        assertEq(all.length, 5);
        assertEq(all[0].act, g.ACT_BOUNTY_POSTED());
        assertEq(all[0].from, 0);
        assertEq(all[0].to, 3);
        assertEq(all[1].act, g.ACT_PRANK());
        assertEq(all[1].kind, 2);
        assertEq(all[2].act, g.ACT_BOUNTY_CLAIMED());
        assertEq(all[3].act, g.ACT_PAYBACK());
        assertEq(all[3].from, 3);
        assertEq(all[4].act, g.ACT_SCRUB());

        // #3 was involved in all five, #1 in three (prank, claim, payback)
        assertEq(g.chogLogLength(3), 5);
        assertEq(g.chogLogLength(1), 3);
        Grudge.Entry[] memory one = g.getChogLog(1, 1, 10);
        assertEq(one.length, 2);
        assertEq(one[0].act, g.ACT_BOUNTY_CLAIMED());
        assertEq(one[1].act, g.ACT_PAYBACK());
    }

    function test_log_paging_clips_to_end() public {
        vm.prank(alice);
        g.prank(1, 3, 0);
        assertEq(g.getLog(1, 10).length, 0);
        assertEq(g.getLog(0, 0).length, 0);
        assertEq(g.getChogLog(4, 0, 10).length, 0);
    }
}
