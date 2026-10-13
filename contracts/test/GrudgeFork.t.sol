// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Grudge, IERC721Owner} from "../src/Grudge.sol";

/// Runs against real Chog Genesis on a Monad mainnet fork. Skipped unless forked:
/// forge test --fork-url $MONAD_RPC_URL --match-contract GrudgeForkTest
contract GrudgeForkTest is Test {
    address constant CHOG = 0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763;
    address constant TOKEN = 0x350035555E10d9AfAF1566AaebfCeD5BA6C27777;

    Grudge g;
    uint16 a;
    uint16 b;

    function setUp() public {
        if (block.chainid != 143) vm.skip(true);
        g = new Grudge(CHOG, TOKEN, 0, 0, 0);

        a = 1;
        address ownerA = IERC721Owner(CHOG).ownerOf(a);
        for (uint16 i = 2; i <= 1969; ++i) {
            if (IERC721Owner(CHOG).ownerOf(i) != ownerA) {
                b = i;
                break;
            }
        }
    }

    function test_real_holders_prank_and_payback() public {
        address ownerA = IERC721Owner(CHOG).ownerOf(a);
        address ownerB = IERC721Owner(CHOG).ownerOf(b);

        vm.prank(ownerA);
        g.prank(a, b, 0);
        assertEq(g.scars(b)[0].by, a);

        vm.prank(ownerA);
        vm.expectRevert(Grudge.NotOwner.selector);
        g.payback(b, a, 0);

        vm.prank(ownerB);
        g.payback(b, a, 1);
        assertTrue(g.scars(a)[0].heavy);
    }
}
