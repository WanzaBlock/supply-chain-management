// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SupplyChainAccess.sol";
import "../src/SupplyChain.sol";

/// @notice Deploys AccessControl then SupplyChain, then assigns roles from env.
///
/// Usage (local Anvil):
///   anvil
///   forge script script/Deploy.s.sol --rpc-url http://localhost:8545 \
///     --private-key $PRIVATE_KEY --broadcast
///
/// Usage (Base Sepolia):
///   forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC \
///     --private-key $PRIVATE_KEY --broadcast --verify \
///     --etherscan-api-key $BASESCAN_KEY
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        // Optional: assign these via env for automated setup
        address manufacturer = vm.envOr("MANUFACTURER_ADDRESS", address(0));
        address distributor  = vm.envOr("DISTRIBUTOR_ADDRESS",  address(0));
        address regulator    = vm.envOr("REGULATOR_ADDRESS",    address(0));

        vm.startBroadcast(deployerKey);

        // 1. Deploy access control
        SupplyChainAccess accessControl = new SupplyChainAccess();
        console2.log("SupplyChainAccess deployed:", address(accessControl));

        // 2. Deploy main contract
        SupplyChain supplyChain = new SupplyChain(address(accessControl));
        console2.log("SupplyChain deployed:       ", address(supplyChain));

        // 3. Assign roles if addresses provided
        if (manufacturer != address(0)) {
            accessControl.assignRole(manufacturer, accessControl.MANUFACTURER());
            console2.log("Manufacturer role assigned:", manufacturer);
        }
        if (distributor != address(0)) {
            accessControl.assignRole(distributor, accessControl.DISTRIBUTOR());
            console2.log("Distributor role assigned: ", distributor);
        }
        if (regulator != address(0)) {
            accessControl.assignRole(regulator, accessControl.REGULATOR());
            console2.log("Regulator role assigned:   ", regulator);
        }

        vm.stopBroadcast();

        // Print env block for copy-paste into .env
        console2.log("\n--- Copy to .env ---");
        console2.log("ACCESS_CONTRACT_ADDRESS=", address(accessControl));
        console2.log("SUPPLY_CHAIN_ADDRESS=",    address(supplyChain));
        console2.log("DEPLOYER_ADDRESS=",         deployer);
    }
}
