// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MedicalRecords} from "../src/MedicalRecords.sol";
import {IMedicalRecords} from "../src/IMedicalRecords.sol";

/**
 * @title IntegrationFlowTest
 * @notice Integration tests simulating the complete flow:
 * 1. Patient generates symmetric key, encrypts metadata
 * 2. Mock Pinata upload returns CID
 * 3. Patient creates record on-chain
 * 4. Patient creates EIP-712 consent signature
 * 5. Doctor receives encrypted symmetric key (off-chain simulation)
 * 6. Doctor logs access
 */
contract IntegrationFlowTest is Test {
    MedicalRecords public medicalRecords;

    address public patient;
    address public doctor;

    uint256 public constant PATIENT_PRIVATE_KEY = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    uint256 public constant DOCTOR_PRIVATE_KEY = 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890;

    // Mock symmetric key (in real scenario, this would be AES-256-GCM key)
    bytes32 public constant SYMMETRIC_KEY = keccak256("mock-symmetric-key");

    event MockPinataUpload(string cid, bytes32 hash);
    event MockKeyEncryption(bytes encryptedKey);
    event MockKeyDecryption(bytes32 decryptedKey);

    function setUp() public {
        patient = vm.addr(PATIENT_PRIVATE_KEY);
        doctor = vm.addr(DOCTOR_PRIVATE_KEY);

        // Deploy contract
        MedicalRecords implementation = new MedicalRecords();
        bytes memory initData = abi.encodeWithSelector(
            MedicalRecords.initialize.selector,
            address(this)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        medicalRecords = MedicalRecords(payable(address(proxy)));
    }

    /**
     * @notice Simulates complete flow: encryption -> IPFS -> on-chain -> consent -> access
     */
    function test_CompletePatientDoctorFlow() public {
        // Step 1: Patient encrypts metadata (simulated)
        string memory metadataJson = '{"patientHash":"0x123","examType":"blood","date":"2024-01-01","files":["QmFile1"],"notesHash":"0x456"}';
        bytes memory encryptedMetadata = abi.encodePacked("encrypted_", metadataJson);
        bytes32 metadataHash = keccak256(encryptedMetadata);

        // Step 2: Mock Pinata upload (simulated)
        string memory cidMeta = _mockPinataUpload(encryptedMetadata);
        console.log("Mock CID:", cidMeta);

        // Step 3: Patient creates record on-chain
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord(patient, cidMeta, metadataHash);

        IMedicalRecords.MedicalRecord memory record = medicalRecords.getRecord(recordId);
        assertEq(record.owner, patient);
        assertEq(record.cidMeta, cidMeta);
        assertEq(record.metaHash, metadataHash);

        // Step 4: Patient grants consent with EIP-712 signature
        uint64 expiry = uint64(block.timestamp + 30 days);
        bytes32 nonce = keccak256("integration-test-nonce");
        bytes memory patientSignature = _signConsent(recordId, doctor, expiry, nonce);

        // Grant consent (will emit ConsentGranted event)
        medicalRecords.grantConsent(recordId, doctor, expiry, nonce, patientSignature);

        // Verify consent stored
        IMedicalRecords.Consent memory consent = medicalRecords.getConsent(recordId, doctor, nonce);
        assertEq(consent.patient, patient);
        assertEq(consent.doctor, doctor);
        assertFalse(consent.revoked);

        // Step 5: Mock ECIES encryption (off-chain simulation)
        // In real scenario: encrypt SYMMETRIC_KEY with doctor's public key
        bytes memory encryptedSymKey = _mockEncryptKey(SYMMETRIC_KEY, doctor);
        emit MockKeyEncryption(encryptedSymKey);

        // Step 6: Doctor receives encrypted key and decrypts (off-chain simulation)
        bytes32 decryptedKey = _mockDecryptKey(encryptedSymKey, doctor);
        emit MockKeyDecryption(decryptedKey);
        assertEq(decryptedKey, SYMMETRIC_KEY);

        // Step 7: Doctor logs access
        vm.prank(doctor);
        medicalRecords.logAccess(recordId, "viewed");
    }

    function test_FlowWithMultipleDoctors() public {
        address doctor2 = address(0x789);

        // Create record
        vm.prank(patient);
        uint256 recordId = medicalRecords.createRecord(
            patient,
            "QmTest",
            keccak256("hash")
        );

        // Grant consent to doctor 1
        uint64 expiry1 = uint64(block.timestamp + 30 days);
        bytes32 nonce1 = keccak256("nonce1");
        bytes memory sig1 = _signConsent(recordId, doctor, expiry1, nonce1);
        medicalRecords.grantConsent(recordId, doctor, expiry1, nonce1, sig1);

        // Grant consent to doctor 2
        uint64 expiry2 = uint64(block.timestamp + 15 days);
        bytes32 nonce2 = keccak256("nonce2");
        bytes memory sig2 = _signConsent(recordId, doctor2, expiry2, nonce2);
        medicalRecords.grantConsent(recordId, doctor2, expiry2, nonce2, sig2);

        // Verify both consents exist
        IMedicalRecords.Consent memory consent1 = medicalRecords.getConsent(recordId, doctor, nonce1);
        IMedicalRecords.Consent memory consent2 = medicalRecords.getConsent(recordId, doctor2, nonce2);

        assertEq(consent1.doctor, doctor);
        assertEq(consent2.doctor, doctor2);
        assertFalse(consent1.revoked);
        assertFalse(consent2.revoked);

        // Both doctors can log access
        vm.prank(doctor);
        medicalRecords.logAccess(recordId, "viewed");

        vm.prank(doctor2);
        medicalRecords.logAccess(recordId, "viewed");
    }

    function test_FlowWithConsentRevocation() public {
        // Create record and grant consent
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

        // Patient revokes consent
        vm.prank(patient);
        medicalRecords.revokeConsent(recordId, doctor, nonce);

        IMedicalRecords.Consent memory consent = medicalRecords.getConsent(recordId, doctor, nonce);
        assertTrue(consent.revoked);

        // Doctor can still log access (contract doesn't enforce revocation in logAccess)
        // This is by design - revocation is for audit purposes
        vm.prank(doctor);
        medicalRecords.logAccess(recordId, "viewed");
    }

    // Mock functions simulating off-chain operations
    function _mockPinataUpload(
        bytes memory data
    ) internal pure returns (string memory) {
        // In real scenario, this would call Pinata API
        // For testing, return a deterministic CID
        bytes32 hash = keccak256(data);
        return string(abi.encodePacked("Qm", _bytes32ToBase58(hash)));
    }

    function _mockEncryptKey(
        bytes32 key,
        address recipient
    ) internal pure returns (bytes memory) {
        // In real scenario, this would use ECIES to encrypt with recipient's public key
        // For testing, return a mock encrypted value
        return abi.encodePacked("encrypted_", key, recipient);
    }

    function _mockDecryptKey(
        bytes memory encryptedKey,
        address recipient
    ) internal pure returns (bytes32) {
        // In real scenario, this would use ECIES to decrypt with recipient's private key
        // For testing, extract the key from mock format
        require(
            keccak256(encryptedKey) == keccak256(abi.encodePacked("encrypted_", SYMMETRIC_KEY, recipient)),
            "Invalid encryption"
        );
        return SYMMETRIC_KEY;
    }

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

    function _bytes32ToBase58(bytes32 data) internal pure returns (bytes memory) {
        // Simplified base58 encoding (for testing only)
        bytes memory alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        bytes memory result = new bytes(44);
        uint256 value = uint256(data);
        for (uint256 i = 0; i < 44; i++) {
            result[i] = alphabet[value % 58];
            value /= 58;
        }
        return result;
    }
}

