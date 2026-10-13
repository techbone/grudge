// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Grudge} from "../src/Grudge.sol";

/// forge script script/Deploy.s.sol --rpc-url <rpc> --broadcast --private-key <key>
/// Prices are in $CHOG wei (18 decimals): scrub 500, truce 250 per side (~$0.85 / ~$0.42 at deploy).
contract Deploy is Script {
    address constant CHOG = 0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763;
    address constant TOKEN = 0x350035555E10d9AfAF1566AaebfCeD5BA6C27777;

    function run() external returns (Grudge g) {
        uint128 scrub = uint128(vm.envOr("SCRUB_PRICE", uint256(500e18)));
        uint128 truce = uint128(vm.envOr("TRUCE_PRICE", uint256(250e18)));
        uint16 fee = uint16(vm.envOr("BOUNTY_FEE_BPS", uint256(1000)));

        vm.startBroadcast();
        g = new Grudge(CHOG, TOKEN, scrub, truce, fee);
        vm.stopBroadcast();

        console.log("Grudge deployed at", address(g));
    }
}
