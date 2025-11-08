// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MedicalRecords} from "./MedicalRecords.sol";
import {IMedicalRecords} from "./IMedicalRecords.sol";

/**
 * @title MedicalRecordsV2
 * @notice Upgraded version of MedicalRecords with additional functionality
 * @dev This contract demonstrates the upgrade pattern - storage layout must match V1
 */
contract MedicalRecordsV2 is MedicalRecords {
    // Storage variables must be added after existing ones
    mapping(uint256 => string[]) private _recordTags;
    mapping(string => uint256[]) private _tagToRecords;

    // Additional storage gap for future upgrades
    uint256[50] private __gapV2;

    /**
     * @notice Add a tag to a medical record
     * @param recordId ID of the medical record
     * @param tag Tag to add
     */
    function addTag(
        uint256 recordId,
        string calldata tag
    ) external nonReentrant {
        IMedicalRecords.MedicalRecord memory record = this.getRecord(recordId);
        if (record.owner == address(0)) revert("Record not found");
        if (record.revoked) revert("Record revoked");
        if (msg.sender != record.owner) revert("Only owner can tag");
        if (bytes(tag).length == 0) revert("Empty tag");

        _recordTags[recordId].push(tag);
        _tagToRecords[tag].push(recordId);
    }

    /**
     * @notice Get all tags for a record
     * @param recordId ID of the medical record
     * @return tags Array of tags
     */
    function getRecordTags(
        uint256 recordId
    ) external view returns (string[] memory) {
        return _recordTags[recordId];
    }

    /**
     * @notice Get all records with a specific tag
     * @param tag Tag to search for
     * @return recordIds Array of record IDs
     */
    function getRecordsByTag(
        string calldata tag
    ) external view returns (uint256[] memory) {
        return _tagToRecords[tag];
    }

    /**
     * @notice Get the current implementation version
     * @return version string
     */
    function version() external pure override returns (string memory) {
        return "2.0.0";
    }
}

