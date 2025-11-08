// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MedicalRecords} from "../src/MedicalRecords.sol";
import {MedicalRecordsV2} from "../src/MedicalRecordsV2.sol";
import {IMedicalRecords} from "../src/IMedicalRecords.sol";

/**
 * @title MedicalRecordsUpgradeTest
 * @notice Tests for UUPS upgrade functionality
 */
contract MedicalRecordsUpgradeTest is Test {
    MedicalRecords public medicalRecords;
    MedicalRecordsV2 public medicalRecordsV2;
    MedicalRecords public implementationV1;
    MedicalRecordsV2 public implementationV2;

    address public admin;
    address public patient;
    address public doctor;

    uint256 public constant ADMIN_PRIVATE_KEY = 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef;
    uint256 public constant PATIENT_PRIVATE_KEY = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;

    function setUp() public {
        admin = vm.addr(ADMIN_PRIVATE_KEY);
        patient = vm.addr(PATIENT_PRIVATE_KEY);
        doctor = address(0x456);

        // Deploy V1 implementation
        implementationV1 = new MedicalRecords();

        // Deploy proxy with V1
        bytes memory initData = abi.encodeWithSelector(
            MedicalRecords.initialize.selector,
            admin
        );
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementationV1),
            initData
        );
        medicalRecords = MedicalRecords(payable(address(proxy)));

        // Create some records before upgrade
        vm.prank(patient);
        medicalRecords.createRecord(patient, "QmRecord1", keccak256("hash1"));

        vm.prank(patient);
        medicalRecords.createRecord(patient, "QmRecord2", keccak256("hash2"));
    }

    function test_UpgradePreservesStorage() public {
        // Verify V1 state
        assertEq(medicalRecords.version(), "1.0.0");
        IMedicalRecords.MedicalRecord memory record1 = medicalRecords.getRecord(1);
        IMedicalRecords.MedicalRecord memory record2 = medicalRecords.getRecord(2);
        assertEq(record1.owner, patient);
        assertEq(record2.owner, patient);

        // Deploy V2 implementation
        implementationV2 = new MedicalRecordsV2();

        // Upgrade proxy
        vm.prank(admin);
        medicalRecords.upgradeToAndCall(address(implementationV2), "");

        // Cast to V2
        medicalRecordsV2 = MedicalRecordsV2(payable(address(medicalRecords)));

        // Verify V2 version
        assertEq(medicalRecordsV2.version(), "2.0.0");

        // Verify storage preserved
        record1 = medicalRecordsV2.getRecord(1);
        record2 = medicalRecordsV2.getRecord(2);
        assertEq(record1.owner, patient);
        assertEq(record1.cidMeta, "QmRecord1");
        assertEq(record1.metaHash, keccak256("hash1"));
        assertEq(record2.owner, patient);
        assertEq(record2.cidMeta, "QmRecord2");
        assertEq(record2.metaHash, keccak256("hash2"));
    }

    function test_UpgradeAddsNewFunctionality() public {
        // Deploy and upgrade to V2
        implementationV2 = new MedicalRecordsV2();
        vm.prank(admin);
        medicalRecords.upgradeToAndCall(address(implementationV2), "");
        medicalRecordsV2 = MedicalRecordsV2(payable(address(medicalRecords)));

        // Test new functionality
        vm.prank(patient);
        medicalRecordsV2.addTag(1, "urgent");

        string[] memory tags = medicalRecordsV2.getRecordTags(1);
        assertEq(tags.length, 1);
        assertEq(tags[0], "urgent");

        uint256[] memory recordIds = medicalRecordsV2.getRecordsByTag("urgent");
        assertEq(recordIds.length, 1);
        assertEq(recordIds[0], 1);
    }

    function test_UpgradeOnlyByUpgrader() public {
        implementationV2 = new MedicalRecordsV2();

        // Non-admin cannot upgrade
        vm.prank(patient);
        vm.expectRevert();
        medicalRecords.upgradeToAndCall(address(implementationV2), "");
    }

    function test_UpgradeEmitsEvent() public {
        implementationV2 = new MedicalRecordsV2();

        vm.prank(admin);
        // Upgrade (will emit ImplementationUpgraded event)
        medicalRecords.upgradeToAndCall(address(implementationV2), "");
    }

    function test_UpgradePreservesExistingConsents() public {
        // Grant consent before upgrade
        uint64 expiry = uint64(block.timestamp + 30 days);
        bytes32 nonce = keccak256("nonce1");
        bytes memory signature = _signConsent(1, doctor, expiry, nonce);

        medicalRecords.grantConsent(1, doctor, expiry, nonce, signature);

        // Verify consent exists
        IMedicalRecords.Consent memory consent = medicalRecords.getConsent(1, doctor, nonce);
        assertEq(consent.patient, patient);
        assertFalse(consent.revoked);

        // Upgrade
        implementationV2 = new MedicalRecordsV2();
        vm.prank(admin);
        medicalRecords.upgradeToAndCall(address(implementationV2), "");
        medicalRecordsV2 = MedicalRecordsV2(payable(address(medicalRecords)));

        // Verify consent still exists after upgrade
        consent = medicalRecordsV2.getConsent(1, doctor, nonce);
        assertEq(consent.patient, patient);
        assertEq(consent.doctor, doctor);
        assertFalse(consent.revoked);
    }

    // Helper function
    function _signConsent(
        uint256 recordId,
        address doctorAddress,
        uint64 expiry,
        bytes32 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Consent(uint256 recordId,address doctor,uint64 expiry,bytes32 nonce)"),
                recordId,
                doctorAddress,
                expiry,
                nonce
            )
        );

        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("MedicalRecords")),
                keccak256(bytes("1")),
                block.chainid,
                address(medicalRecords)
            )
        );

        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PATIENT_PRIVATE_KEY, hash);
        return abi.encodePacked(r, s, v);
    }
}

