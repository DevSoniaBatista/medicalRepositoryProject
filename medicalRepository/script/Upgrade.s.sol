// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MedicalRecords} from "../src/MedicalRecords.sol";
import {MedicalRecordsV2} from "../src/MedicalRecordsV2.sol";

/**
 * @title Upgrade
 * @notice Script for upgrading MedicalRecords to V2
 * @dev Requires UPGRADER_ROLE on the proxy
 */
contract Upgrade is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");

        console.log("Upgrading MedicalRecords proxy...");
        console.log("Proxy address:", proxyAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Get current implementation address from storage slot
        bytes32 implementationSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        bytes32 currentImplBytes = vm.load(proxyAddress, implementationSlot);
        address currentImpl = address(uint160(uint256(currentImplBytes)));
        console.log("Current implementation:", currentImpl);

        // Verify current version
        MedicalRecords proxy = MedicalRecords(payable(proxyAddress));
        string memory oldVersion = proxy.version();
        console.log("Current version:", oldVersion);

        // Deploy new implementation
        MedicalRecordsV2 newImplementation = new MedicalRecordsV2();
        console.log("New implementation deployed at:", address(newImplementation));

        // Upgrade proxy
        proxy.upgradeToAndCall(address(newImplementation), "");

        // Verify upgrade
        bytes32 newImplBytes = vm.load(proxyAddress, implementationSlot);
        address newImpl = address(uint160(uint256(newImplBytes)));
        console.log("New implementation set:", newImpl);

        // Verify version
        MedicalRecordsV2 upgraded = MedicalRecordsV2(payable(proxyAddress));
        string memory version = upgraded.version();
        console.log("New version:", version);

        vm.stopBroadcast();

        console.log("\n=== Upgrade Summary ===");
        console.log("Proxy:", proxyAddress);
        console.log("Old implementation:", currentImpl);
        console.log("Old version:", oldVersion);
        console.log("New implementation:", address(newImplementation));
        console.log("New version:", version);
    }
}

