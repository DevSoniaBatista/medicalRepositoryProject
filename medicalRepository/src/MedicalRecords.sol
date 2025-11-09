// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IMedicalRecords} from "./IMedicalRecords.sol";

/**
 * @title MedicalRecords
 * @notice UUPS upgradeable contract for decentralized medical records
 * @dev Implements EIP-712 for consent signatures, AccessControl for permissions
 */
contract MedicalRecords is
    IMedicalRecords,
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    EIP712Upgradeable
{
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 private constant CONSENT_TYPEHASH =
        keccak256(
            "Consent(uint256 recordId,address doctor,uint64 expiry,bytes32 nonce)"
        );

    // Payment constants
    uint256 public constant RECORD_CREATION_FEE = 0.0001 ether; // 0.0001 ETH ≈ US$0.43

    // Storage variables
    uint256 private _nextRecordId;
    address private _adminAddress;
    uint256 private _totalPayments;
    mapping(uint256 => MedicalRecord) private _records;
    mapping(uint256 => mapping(address => mapping(bytes32 => Consent)))
        private _consents;
    mapping(address => mapping(bytes32 => bool)) private _usedNonces;
    mapping(address => uint256) private _paymentsByPayer; // Total paid by each address

    // Storage gap for future upgrades
    uint256[47] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param admin Address that will receive DEFAULT_ADMIN_ROLE and UPGRADER_ROLE
     */
    function initialize(address admin) external initializer {
        if (admin == address(0)) revert("Invalid admin");
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __EIP712_init("MedicalRecords", "1");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _adminAddress = admin;
        _nextRecordId = 1;
    }

    /**
     * @notice Create a new medical record
     * @param patient Address of the patient (must be msg.sender or authorized)
     * @param cidMeta IPFS CID of the encrypted metadata JSON
     * @param metaHash Keccak256 hash of the encrypted metadata JSON
     * @return recordId The ID of the newly created record
     * @dev Requires payment of RECORD_CREATION_FEE (0.0001 ETH) which is accumulated in the contract
     */
    function createRecord(
        address patient,
        string calldata cidMeta,
        bytes32 metaHash
    ) external payable whenNotPaused nonReentrant returns (uint256 recordId) {
        if (patient == address(0)) revert("Invalid patient");
        if (bytes(cidMeta).length == 0) revert("Empty CID");
        if (msg.sender != patient) revert("Only patient can create");
        if (msg.value != RECORD_CREATION_FEE) revert("Incorrect payment amount");

        // Accumulate payment in contract (ETH stays in contract)
        _totalPayments += msg.value;
        _paymentsByPayer[patient] += msg.value;

        recordId = _nextRecordId++;
        _records[recordId] = MedicalRecord({
            id: recordId,
            owner: patient,
            cidMeta: cidMeta,
            metaHash: metaHash,
            timestamp: uint64(block.timestamp),
            revoked: false
        });

        emit RecordCreated(
            recordId,
            patient,
            cidMeta,
            metaHash,
            uint64(block.timestamp)
        );

        emit PaymentReceived(
            patient,
            _adminAddress,
            msg.value,
            recordId,
            "record_creation",
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Revoke a medical record
     * @param recordId ID of the record to revoke
     */
    function revokeRecord(uint256 recordId) external {
        MedicalRecord storage record = _records[recordId];
        if (record.owner == address(0)) revert("Record not found");
        if (msg.sender != record.owner) revert("Only owner can revoke");
        if (record.revoked) revert("Already revoked");

        record.revoked = true;
    }

    /**
     * @notice Grant consent to a doctor to access a record
     * @param recordId ID of the medical record
     * @param doctor Address of the doctor
     * @param expiry Unix timestamp when consent expires
     * @param nonce Unique nonce to prevent replay attacks
     * @param patientSignature EIP-712 signature of the patient
     */
    function grantConsent(
        uint256 recordId,
        address doctor,
        uint64 expiry,
        bytes32 nonce,
        bytes calldata patientSignature
    ) external whenNotPaused nonReentrant {
        MedicalRecord storage record = _records[recordId];
        if (record.owner == address(0)) revert("Record not found");
        if (record.revoked) revert("Record revoked");
        if (doctor == address(0)) revert("Invalid doctor");
        if (expiry <= block.timestamp) revert("Expired consent");
        if (_usedNonces[record.owner][nonce]) revert("Nonce already used");

        // Verify EIP-712 signature (optimized with inline assembly)
        bytes32 structHash = _computeConsentStructHash(recordId, doctor, expiry, nonce);
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, patientSignature);

        if (signer != record.owner) revert("Invalid signature");

        // Mark nonce as used
        _usedNonces[record.owner][nonce] = true;

        // Store consent
        _consents[recordId][doctor][nonce] = Consent({
            recordId: recordId,
            patient: record.owner,
            doctor: doctor,
            expiry: expiry,
            nonce: nonce,
            revoked: false
        });

        emit ConsentGranted(recordId, record.owner, doctor, expiry, nonce);
        
        // Emit event for admin tracking - key generation
        emit ConsentKeyGenerated(
            recordId,
            record.owner,
            doctor,
            nonce,
            expiry,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Revoke a previously granted consent
     * @param recordId ID of the medical record
     * @param doctor Address of the doctor
     * @param nonce Nonce used when granting consent
     */
    function revokeConsent(
        uint256 recordId,
        address doctor,
        bytes32 nonce
    ) external {
        Consent storage consent = _consents[recordId][doctor][nonce];
        if (consent.patient == address(0)) revert("Consent not found");
        if (msg.sender != consent.patient && msg.sender != consent.doctor)
            revert("Not authorized");
        if (consent.revoked) revert("Already revoked");

        consent.revoked = true;

        emit ConsentRevoked(recordId, consent.patient, doctor, nonce);
    }

    /**
     * @notice Log access to a medical record (for audit purposes)
     * @param recordId ID of the medical record
     * @param action Description of the access action
     */
    function logAccess(
        uint256 recordId,
        string calldata action
    ) external whenNotPaused nonReentrant {
        MedicalRecord storage record = _records[recordId];
        if (record.owner == address(0)) revert("Record not found");
        
        // Emit access log with patient information for admin tracking
        emit AccessLogged(
            recordId,
            msg.sender,
            record.owner, // patient address
            uint64(block.timestamp),
            action
        );
    }

    /**
     * @notice Get a medical record by ID
     * @param recordId ID of the record
     * @return The medical record
     */
    function getRecord(
        uint256 recordId
    ) external view returns (MedicalRecord memory) {
        return _records[recordId];
    }

    /**
     * @notice Get a consent by record ID, doctor, and nonce
     * @param recordId ID of the medical record
     * @param doctor Address of the doctor
     * @param nonce Nonce used when granting consent
     * @return The consent
     */
    function getConsent(
        uint256 recordId,
        address doctor,
        bytes32 nonce
    ) external view returns (Consent memory) {
        return _consents[recordId][doctor][nonce];
    }

    /**
     * @notice Get the admin address that receives payments
     * @return The admin address
     */
    function getAdminAddress() external view returns (address) {
        return _adminAddress;
    }

    /**
     * @notice Get the fee required to create a record
     * @return The fee amount in wei
     */
    function getRecordCreationFee() external pure returns (uint256) {
        return RECORD_CREATION_FEE;
    }

    /**
     * @notice Get total payments received by the contract
     * @return Total amount in wei
     */
    function getTotalPayments() external view returns (uint256) {
        return _totalPayments;
    }

    /**
     * @notice Get total payments made by a specific payer
     * @param payer Address of the payer
     * @return Total amount paid by this address in wei
     */
    function getPaymentsByPayer(address payer) external view returns (uint256) {
        return _paymentsByPayer[payer];
    }

    /**
     * @notice Get the contract's balance (accumulated payments)
     * @return The contract balance in wei
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Withdraw accumulated payments to admin address
     * @dev Only admin can call this function
     */
    function withdraw() external nonReentrant {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert("Only admin can withdraw");
        }

        uint256 balance = address(this).balance;
        if (balance == 0) revert("No funds to withdraw");

        (bool success, ) = payable(_adminAddress).call{value: balance}("");
        if (!success) revert("Withdrawal failed");

        emit PaymentWithdrawn(_adminAddress, balance, uint64(block.timestamp));
    }

    /**
     * @notice Pause the contract (emergency stop)
     * @dev Only admin can pause. Pauses all state-changing functions.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the contract
     * @dev Only admin can unpause. Resumes all state-changing functions.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Authorize an upgrade (UUPS pattern)
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {
        emit ImplementationUpgraded(newImplementation);
    }

    /**
     * @notice Get the current implementation version (for upgrade testing)
     * @return version string
     */
    function version() external pure virtual returns (string memory) {
        return "1.0.0";
    }

    /**
     * @notice Compute EIP-712 struct hash for Consent (optimized with inline assembly)
     * @param recordId The record ID
     * @param doctor The doctor address
     * @param expiry The expiry timestamp
     * @param nonce The nonce
     * @return The struct hash
     */
    function _computeConsentStructHash(
        uint256 recordId,
        address doctor,
        uint64 expiry,
        bytes32 nonce
    ) private pure returns (bytes32) {
        bytes memory encoded = abi.encode(CONSENT_TYPEHASH, recordId, doctor, expiry, nonce);
        bytes32 result;
        assembly {
            result := keccak256(add(encoded, 32), mload(encoded))
        }
        return result;
    }
}

