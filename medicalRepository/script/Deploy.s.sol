// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MedicalRecords} from "../src/MedicalRecords.sol";

/**
 * @title Deploy
 * @notice Script for deploying MedicalRecords with UUPS proxy
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(deployerPrivateKey);

        console.log("Deploying MedicalRecords...");
        console.log("Admin address:", admin);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        MedicalRecords implementation = new MedicalRecords();
        console.log("Implementation deployed at:", address(implementation));

        // Encode initialize call
        bytes memory initData = abi.encodeWithSelector(
            MedicalRecords.initialize.selector,
            admin
        );

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        console.log("Proxy deployed at:", address(proxy));

        // Verify initialization
        MedicalRecords medicalRecords = MedicalRecords(payable(address(proxy)));
        string memory version = medicalRecords.version();
        console.log("Contract version:", version);

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary ===");
        console.log("Implementation:", address(implementation));
        console.log("Proxy:", address(proxy));
        console.log("Admin:", admin);
        console.log("Use the proxy address for interactions");
    }
}

