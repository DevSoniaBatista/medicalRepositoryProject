// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MedicalRecords} from "../src/MedicalRecords.sol";
import {IMedicalRecords} from "../src/IMedicalRecords.sol";

contract MedicalRecordsTest is Test {
    MedicalRecords public medicalRecords;
    MedicalRecords public implementation;

    address public admin;
    address public patient;
    address public doctor;
    address public attacker;

    uint256 public constant PATIENT_PRIVATE_KEY = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    uint256 public constant DOCTOR_PRIVATE_KEY = 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890;
    uint256 public constant ADMIN_PRIVATE_KEY = 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef;

    function setUp() public {
        admin = vm.addr(ADMIN_PRIVATE_KEY);
        patient = vm.addr(PATIENT_PRIVATE_KEY);
        doctor = vm.addr(DOCTOR_PRIVATE_KEY);
        attacker = address(0x999);

        // Deploy implementation
        implementation = new MedicalRecords();

        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(
            MedicalRecords.initialize.selector,
            admin
        );
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        medicalRecords = MedicalRecords(payable(address(proxy)));
    }

    function test_Initialize() public view {
        assertTrue(medicalRecords.hasRole(medicalRecords.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(medicalRecords.hasRole(medicalRecords.UPGRADER_ROLE(), admin));
        assertEq(medicalRecords.version(), "1.0.0");
    }

    function test_CreateRecordAsOwner() public {
        vm.prank(patient);
        string memory cidMeta = "QmTest123";
        bytes32 metaHash = keccak256("encrypted metadata");

        // Create record (will emit RecordCreated event)
        uint256 recordId = medicalRecords.createRecord(patient, cidMeta, metaHash);

        assertEq(recordId, 1);
        IMedicalRecords.MedicalRecord memory record = medicalRecords.getRecord(recordId);
        assertEq(record.id, 1);
        assertEq(record.owner, patient);
        assertEq(record.cidMeta, cidMeta);
        assertEq(record.metaHash, metaHash);
        assertFalse(record.revoked);
    }

    function test_CreateRecordNotOwnerReverts() public {
        vm.prank(attacker);
        vm.expectRevert("Only patient can create");
        medicalRecords.createRecord(patient, "QmTest", keccak256("hash"));
    }

    function test_CreateRecordInvalidPatient() public {
        vm.prank(patient);
        vm.expectRevert("Invalid patient");
        medicalRecords.createRecord(address(0), "QmTest", keccak256("hash"));
    }

    function test_CreateRecordEmptyCID() public {
        vm.prank(patient);
        vm.expectRevert("Empty CID");
        medicalRecords.createRecord(patient, "", keccak256("hash"));
    }

    function test_RevokeRecord() public {
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord(
            patient,
            "QmTest",
            keccak256("hash")
        );

        vm.prank(patient);
        medicalRecords.revokeRecord(recordId);

        IMedicalRecords.MedicalRecord memory record = medicalRecords.getRecord(recordId);
        assertTrue(record.revoked);
    }

    function test_RevokeRecordNotOwner() public {
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord(
            patient,
            "QmTest",
            keccak256("hash")
        );

        vm.prank(attacker);
        vm.expectRevert("Only owner can revoke");
        medicalRecords.revokeRecord(recordId);
    }

    function test_GrantConsentValidSignature() public {
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord(
            patient,
            "QmTest",
            keccak256("hash")
        );

        uint64 expiry = uint64(block.timestamp + 30 days);
        bytes32 nonce = keccak256("nonce1");

        // Create EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Consent(uint256 recordId,address doctor,uint64 expiry,bytes32 nonce)"),
                recordId,
                doctor,
                expiry,
                nonce
            )
        );

        // Get domain separator
        bytes32 domainSeparator = _getDomainSeparator();
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PATIENT_PRIVATE_KEY, hash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Grant consent (will emit ConsentGranted event)
        medicalRecords.grantConsent(recordId, doctor, expiry, nonce, signature);

        IMedicalRecords.Consent memory consent = medicalRecords.getConsent(recordId, doctor, nonce);
        assertEq(consent.recordId, recordId);
        assertEq(consent.patient, patient);
        assertEq(consent.doctor, doctor);
        assertEq(consent.expiry, expiry);
        assertEq(consent.nonce, nonce);
        assertFalse(consent.revoked);
    }

    function test_GrantConsentReplayNonce() public {
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord(
            patient,
            "QmTest",
            keccak256("hash")
        );

        uint64 expiry = uint64(block.timestamp + 30 days);
        bytes32 nonce = keccak256("nonce1");

        bytes memory signature = _signConsent(recordId, doctor, expiry, nonce);

        medicalRecords.grantConsent(recordId, doctor, expiry, nonce, signature);

        // Try to reuse nonce
        vm.expectRevert("Nonce already used");
        medicalRecords.grantConsent(recordId, doctor, expiry, nonce, signature);
    }

    function test_GrantConsentExpired() public {
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord(
            patient,
            "QmTest",
            keccak256("hash")
        );

        uint64 expiry = uint64(block.timestamp - 1); // Already expired
        bytes32 nonce = keccak256("nonce1");

        bytes memory signature = _signConsent(recordId, doctor, expiry, nonce);

        vm.expectRevert("Expired consent");
        medicalRecords.grantConsent(recordId, doctor, expiry, nonce, signature);
    }

    function test_GrantConsentInvalidSignature() public {
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord(
            patient,
            "QmTest",
            keccak256("hash")
        );

        uint64 expiry = uint64(block.timestamp + 30 days);
        bytes32 nonce = keccak256("nonce1");

        // Sign with wrong private key
        bytes memory wrongSignature = _signConsentWithKey(
            recordId,
            doctor,
            expiry,
            nonce,
            DOCTOR_PRIVATE_KEY
        );

        vm.expectRevert("Invalid signature");
        medicalRecords.grantConsent(recordId, doctor, expiry, nonce, wrongSignature);
    }

    function test_RevokeConsent() public {
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord(
            patient,
            "QmTest",
            keccak256("hash")
        );

        uint64 expiry = uint64(block.timestamp + 30 days);
        bytes32 nonce = keccak256("nonce1");
        bytes memory signature = _signConsent(recordId, doctor, expiry, nonce);

        medicalRecords.grantConsent(recordId, doctor, expiry, nonce, signature);

        vm.prank(patient);
        // Revoke consent (will emit ConsentRevoked event)
        medicalRecords.revokeConsent(recordId, doctor, nonce);

        IMedicalRecords.Consent memory consent = medicalRecords.getConsent(recordId, doctor, nonce);
        assertTrue(consent.revoked);
    }

    function test_RevokeConsentByDoctor() public {
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord(
            patient,
            "QmTest",
            keccak256("hash")
        );

        uint64 expiry = uint64(block.timestamp + 30 days);
        bytes32 nonce = keccak256("nonce1");
        bytes memory signature = _signConsent(recordId, doctor, expiry, nonce);

        medicalRecords.grantConsent(recordId, doctor, expiry, nonce, signature);

        vm.prank(doctor);
        medicalRecords.revokeConsent(recordId, doctor, nonce);

        IMedicalRecords.Consent memory consent = medicalRecords.getConsent(recordId, doctor, nonce);
        assertTrue(consent.revoked);
    }

    function test_LogAccessEmits() public {
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord(
            patient,
            "QmTest",
            keccak256("hash")
        );

        vm.prank(doctor);
        // Log access (will emit AccessLogged event)
        medicalRecords.logAccess(recordId, "viewed");
    }

    // Helper functions
    function _signConsent(
        uint256 recordId,
        address doctorAddress,
        uint64 expiry,
        bytes32 nonce
    ) internal view returns (bytes memory) {
        return _signConsentWithKey(recordId, doctorAddress, expiry, nonce, PATIENT_PRIVATE_KEY);
    }

    function _signConsentWithKey(
        uint256 recordId,
        address doctorAddress,
        uint64 expiry,
        bytes32 nonce,
        uint256 privateKey
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

        bytes32 domainSeparator = _getDomainSeparator();
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, hash);
        return abi.encodePacked(r, s, v);
    }

    function _getDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("MedicalRecords")),
                keccak256(bytes("1")),
                block.chainid,
                address(medicalRecords)
            )
        );
    }
}

