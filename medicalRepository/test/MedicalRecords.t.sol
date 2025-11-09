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
        
        // Fund patient and doctor with ETH for payments
        vm.deal(patient, 10 ether);
        vm.deal(doctor, 10 ether);
    }

    function test_Initialize() public view {
        assertTrue(medicalRecords.hasRole(medicalRecords.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(medicalRecords.hasRole(medicalRecords.UPGRADER_ROLE(), admin));
        assertEq(medicalRecords.version(), "1.0.0");
        assertEq(medicalRecords.getAdminAddress(), admin);
        assertEq(medicalRecords.getRecordCreationFee(), 0.0001 ether);
    }

    function test_CreateRecordAsOwner() public {
        uint256 contractBalanceBefore = address(medicalRecords).balance;
        uint256 patientBalanceBefore = patient.balance;
        
        vm.prank(patient);
        string memory cidMeta = "QmTest123";
        bytes32 metaHash = keccak256("encrypted metadata");

        // Create record with payment (will emit RecordCreated and PaymentReceived events)
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
            patient,
            cidMeta,
            metaHash
        );

        assertEq(recordId, 1);
        IMedicalRecords.MedicalRecord memory record = medicalRecords.getRecord(recordId);
        assertEq(record.id, 1);
        assertEq(record.owner, patient);
        assertEq(record.cidMeta, cidMeta);
        assertEq(record.metaHash, metaHash);
        assertFalse(record.revoked);
        
        // Verify payment was accumulated in contract (not transferred immediately)
        assertEq(address(medicalRecords).balance, contractBalanceBefore + 0.0001 ether);
        assertEq(patient.balance, patientBalanceBefore - 0.0001 ether);
        assertEq(medicalRecords.getTotalPayments(), 0.0001 ether);
        assertEq(medicalRecords.getPaymentsByPayer(patient), 0.0001 ether);
        assertEq(medicalRecords.getContractBalance(), 0.0001 ether);
    }

    function test_CreateRecordNotOwnerReverts() public {
        vm.deal(attacker, 10 ether);
        vm.prank(attacker);
        vm.expectRevert("Only patient can create");
        medicalRecords.createRecord{value: 0.0001 ether}(patient, "QmTest", keccak256("hash"));
    }

    function test_CreateRecordInvalidPatient() public {
        vm.prank(patient);
        vm.expectRevert("Invalid patient");
        medicalRecords.createRecord{value: 0.0001 ether}(address(0), "QmTest", keccak256("hash"));
    }

    function test_CreateRecordEmptyCID() public {
        vm.prank(patient);
        vm.expectRevert("Empty CID");
        medicalRecords.createRecord{value: 0.0001 ether}(patient, "", keccak256("hash"));
    }
    
    function test_CreateRecordIncorrectPayment() public {
        vm.prank(patient);
        vm.expectRevert("Incorrect payment amount");
        medicalRecords.createRecord{value: 0.0002 ether}(patient, "QmTest", keccak256("hash"));
    }
    
    function test_CreateRecordNoPayment() public {
        vm.prank(patient);
        vm.expectRevert("Incorrect payment amount");
        medicalRecords.createRecord(patient, "QmTest", keccak256("hash"));
    }

    function test_RevokeRecord() public {
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
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
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
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
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
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
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
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
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
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
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
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
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
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
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
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
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
            patient,
            "QmTest",
            keccak256("hash")
        );

        vm.prank(doctor);
        // Log access (will emit AccessLogged event with patient info)
        medicalRecords.logAccess(recordId, "viewed");
    }

    function test_WithdrawByAdmin() public {
        // Create multiple records to accumulate payments
        vm.prank(patient);
        medicalRecords.createRecord{value: 0.0001 ether}(
            patient,
            "QmTest1",
            keccak256("hash1")
        );

        vm.prank(patient);
        medicalRecords.createRecord{value: 0.0001 ether}(
            patient,
            "QmTest2",
            keccak256("hash2")
        );

        uint256 contractBalanceBefore = address(medicalRecords).balance;
        uint256 adminBalanceBefore = admin.balance;
        
        assertEq(contractBalanceBefore, 0.0002 ether);

        // Admin withdraws accumulated funds
        vm.prank(admin);
        medicalRecords.withdraw();

        // Verify funds were transferred to admin
        assertEq(address(medicalRecords).balance, 0);
        assertEq(admin.balance, adminBalanceBefore + 0.0002 ether);
    }

    function test_WithdrawByNonAdminReverts() public {
        vm.prank(patient);
        medicalRecords.createRecord{value: 0.0001 ether}(
            patient,
            "QmTest",
            keccak256("hash")
        );

        // Non-admin tries to withdraw
        vm.prank(patient);
        vm.expectRevert("Only admin can withdraw");
        medicalRecords.withdraw();
    }

    function test_WithdrawEmptyBalanceReverts() public {
        // Try to withdraw when contract has no balance
        vm.prank(admin);
        vm.expectRevert("No funds to withdraw");
        medicalRecords.withdraw();
    }

    function test_WithdrawMultipleTimes() public {
        // First withdrawal
        vm.prank(patient);
        medicalRecords.createRecord{value: 0.0001 ether}(
            patient,
            "QmTest1",
            keccak256("hash1")
        );

        uint256 adminBalanceBefore = admin.balance;
        
        vm.prank(admin);
        medicalRecords.withdraw();
        assertEq(admin.balance, adminBalanceBefore + 0.0001 ether);
        assertEq(address(medicalRecords).balance, 0);

        // Create another record and withdraw again
        vm.prank(patient);
        medicalRecords.createRecord{value: 0.0001 ether}(
            patient,
            "QmTest2",
            keccak256("hash2")
        );

        vm.prank(admin);
        medicalRecords.withdraw();
        assertEq(admin.balance, adminBalanceBefore + 0.0002 ether);
        assertEq(address(medicalRecords).balance, 0);
    }

    function test_PauseByAdmin() public {
        // Contract should not be paused initially
        assertFalse(medicalRecords.paused());

        // Admin pauses the contract
        vm.prank(admin);
        medicalRecords.pause();

        // Contract should be paused
        assertTrue(medicalRecords.paused());
    }

    function test_PauseByNonAdminReverts() public {
        // Non-admin tries to pause
        vm.prank(patient);
        vm.expectRevert();
        medicalRecords.pause();
    }

    function test_UnpauseByAdmin() public {
        // Pause first
        vm.prank(admin);
        medicalRecords.pause();
        assertTrue(medicalRecords.paused());

        // Admin unpauses
        vm.prank(admin);
        medicalRecords.unpause();

        // Contract should not be paused
        assertFalse(medicalRecords.paused());
    }

    function test_UnpauseByNonAdminReverts() public {
        // Pause first
        vm.prank(admin);
        medicalRecords.pause();

        // Non-admin tries to unpause
        vm.prank(patient);
        vm.expectRevert();
        medicalRecords.unpause();
    }

    function test_CreateRecordWhenPausedReverts() public {
        // Pause the contract
        vm.prank(admin);
        medicalRecords.pause();

        // Try to create record when paused
        vm.prank(patient);
        vm.expectRevert("Pausable: paused");
        medicalRecords.createRecord{value: 0.0001 ether}(
            patient,
            "QmTest",
            keccak256("hash")
        );
    }

    function test_GrantConsentWhenPausedReverts() public {
        // Create record first
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
            patient,
            "QmTest",
            keccak256("hash")
        );

        // Pause the contract
        vm.prank(admin);
        medicalRecords.pause();

        // Try to grant consent when paused
        uint64 expiry = uint64(block.timestamp + 30 days);
        bytes32 nonce = keccak256("nonce1");
        bytes memory signature = _signConsent(recordId, doctor, expiry, nonce);

        vm.expectRevert("Pausable: paused");
        medicalRecords.grantConsent(recordId, doctor, expiry, nonce, signature);
    }

    function test_LogAccessWhenPausedReverts() public {
        // Create record first
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
            patient,
            "QmTest",
            keccak256("hash")
        );

        // Pause the contract
        vm.prank(admin);
        medicalRecords.pause();

        // Try to log access when paused
        vm.prank(doctor);
        vm.expectRevert("Pausable: paused");
        medicalRecords.logAccess(recordId, "viewed");
    }

    function test_WithdrawWhenPausedStillWorks() public {
        // Create record and accumulate funds
        vm.prank(patient);
        medicalRecords.createRecord{value: 0.0001 ether}(
            patient,
            "QmTest",
            keccak256("hash")
        );

        // Pause the contract
        vm.prank(admin);
        medicalRecords.pause();

        // Withdraw should still work when paused (emergency function)
        uint256 adminBalanceBefore = admin.balance;
        vm.prank(admin);
        medicalRecords.withdraw();
        assertEq(admin.balance, adminBalanceBefore + 0.0001 ether);
    }

    function test_ViewFunctionsWorkWhenPaused() public {
        // Create record
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
            patient,
            "QmTest",
            keccak256("hash")
        );

        // Pause the contract
        vm.prank(admin);
        medicalRecords.pause();

        // View functions should still work
        IMedicalRecords.MedicalRecord memory record = medicalRecords.getRecord(recordId);
        assertEq(record.id, recordId);
        assertEq(medicalRecords.getContractBalance(), 0.0001 ether);
        assertEq(medicalRecords.getTotalPayments(), 0.0001 ether);
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

