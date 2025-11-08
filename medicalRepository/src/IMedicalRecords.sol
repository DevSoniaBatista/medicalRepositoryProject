// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMedicalRecords
 * @notice Interface for the Medical Records system
 */
interface IMedicalRecords {
    struct MedicalRecord {
        uint256 id;
        address owner;
        string cidMeta;
        bytes32 metaHash;
        uint64 timestamp;
        bool revoked;
    }

    struct Consent {
        uint256 recordId;
        address patient;
        address doctor;
        uint64 expiry;
        bytes32 nonce;
        bool revoked;
    }

    event RecordCreated(
        uint256 indexed id,
        address indexed owner,
        string cidMeta,
        bytes32 metaHash,
        uint64 timestamp
    );

    event ConsentGranted(
        uint256 indexed recordId,
        address indexed patient,
        address indexed doctor,
        uint64 expiry,
        bytes32 nonce
    );

    event ConsentRevoked(
        uint256 indexed recordId,
        address indexed patient,
        address indexed doctor,
        bytes32 nonce
    );

    event AccessLogged(
        uint256 indexed recordId,
        address indexed accessor,
        uint64 timestamp,
        string action
    );

    event ImplementationUpgraded(address indexed newImplementation);

    function initialize(address admin) external;

    function createRecord(
        address patient,
        string calldata cidMeta,
        bytes32 metaHash
    ) external returns (uint256 recordId);

    function revokeRecord(uint256 recordId) external;

    function grantConsent(
        uint256 recordId,
        address doctor,
        uint64 expiry,
        bytes32 nonce,
        bytes calldata patientSignature
    ) external;

    function revokeConsent(
        uint256 recordId,
        address doctor,
        bytes32 nonce
    ) external;

    function logAccess(uint256 recordId, string calldata action) external;

    function getRecord(
        uint256 recordId
    ) external view returns (MedicalRecord memory);

    function getConsent(
        uint256 recordId,
        address doctor,
        bytes32 nonce
    ) external view returns (Consent memory);
}

