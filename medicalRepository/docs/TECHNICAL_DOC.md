# Medical Records System - Technical Documentation

## Overview

This is a decentralized medical records system built on Ethereum using Foundry and Solidity. The system allows patients to control their medical records through wallet-based authentication, with encrypted data stored on IPFS and consent management handled on-chain via EIP-712 signatures.

## Complete Workflow: From Data Collection to Blockchain

### Step-by-Step Process

#### 1. Data Collection (Off-Chain JavaScript Interface)

**Location**: `offchain-app/` directory

**Purpose**: Collect patient data and generate encrypted payload

**How to Run**:
```bash
cd offchain-app
npm install
npm run start
# Open http://127.0.0.1:8080 in browser
```

**Data Collection Process**:

1. **Form Fields** (collected via `FormData` API):
   - `patientHash` (required): Patient identifier hash
   - `examType` (required): Type of medical exam
   - `examDate` (required): Date in ISO format
   - `notesHash` (optional): Medical notes hash
   - `files` (optional): IPFS CIDs, one per line

2. **JavaScript Processing** (`script.js`):
   ```javascript
   // Form submission handler
   form.addEventListener("submit", async (event) => {
     event.preventDefault();
     
     // Build metadata object from form
     const metadata = buildMetadata(event.target);
     // {
     //   schema: "medical-record-metadata@1",
     //   createdAt: "2024-01-01T00:00:00Z",
     //   patientHash: formData.get("patientHash"),
     //   examType: formData.get("examType"),
     //   date: formData.get("examDate"),
     //   files: [...],
     //   notesHash: formData.get("notesHash") || null
     // }
     
     // Encrypt metadata
     const { payload, keyHex } = await encryptMetadata(metadataJson);
   });
   ```

3. **Outputs Generated**:
   - **Metadata JSON**: Plain text JSON (for reference)
   - **Encrypted Payload**: Ready for IPFS upload
   - **Symmetric Key**: 64-character hex string

**How to Access Generated Data**:

- **Via UI**: Copy buttons or download JSON files
- **Via JavaScript**: 
  ```javascript
  // Get metadata JSON
  const metadataJson = document.getElementById("metadata-json").textContent;
  
  // Get encrypted payload
  const encryptedPayload = document.getElementById("encrypted-payload").textContent;
  
  // Get symmetric key
  const symKey = document.getElementById("sym-key").textContent;
  ```

#### 2. IPFS Upload (Pinata)

**Input**: Encrypted payload JSON from step 1

**Process**:
```bash
# Using curl (see docs/PINATA_EXAMPLES.md)
curl -X POST https://api.pinata.cloud/pinning/pinJSONToIPFS \
  -H "Authorization: Bearer $PINATA_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "pinataContent": <encrypted_payload_json>
  }'
```

**Output**: IPFS CID (e.g., `QmXyZ123...`)

#### 3. On-Chain Registration

**Input**: 
- IPFS CID from step 2
- Hash of encrypted payload: `keccak256(encryptedPayload)`

**Process**:
```solidity
// Call smart contract
uint256 recordId = medicalRecords.createRecord(
    patientAddress,  // msg.sender
    cidMeta,         // CID from IPFS
    metaHash         // keccak256(encryptedPayload)
);
```

**Output**: `recordId` (unique identifier)

#### 4. Consent Sharing

**Input**:
- `recordId` from step 3
- Doctor's wallet address
- Expiry timestamp
- Unique nonce

**Process**:
1. Generate EIP-712 signature (off-chain)
2. Share symmetric key via ECIES (off-chain)
3. Call `grantConsent()` on-chain

**Output**: Consent stored on-chain, `ConsentGranted` event emitted

#### 5. Doctor Access

**Input**:
- Encrypted symmetric key (from step 4)
- IPFS CID (from step 2)
- Doctor's private key

**Process**:
1. Decrypt symmetric key (ECIES)
2. Download encrypted payload from IPFS
3. Decrypt metadata (AES-GCM)
4. Call `logAccess()` for audit

**Output**: Decrypted metadata, `AccessLogged` event

## Architecture

```
┌─────────────────────────────────────┐
│  1. JavaScript Interface (Web)    │
│  ┌─────────────────────────────┐  │
│  │ Form: patientHash, examType │  │
│  │       examDate, files, etc. │  │
│  └──────────────┬──────────────┘  │
│                 │                   │
│                 │ FormData API      │
│                 ▼                   │
│  ┌─────────────────────────────┐  │
│  │ buildMetadata()             │  │
│  │ → JSON structure            │  │
│  └──────────────┬──────────────┘  │
│                 │                   │
│                 │ encryptMetadata() │
│                 ▼                   │
│  ┌─────────────────────────────┐  │
│  │ Web Crypto API              │  │
│  │ - Generate AES-256 key      │  │
│  │ - Encrypt with AES-GCM      │  │
│  │ - Output: payload + keyHex  │  │
│  └──────────────┬──────────────┘  │
└─────────────────┼──────────────────┘
                  │
                  │ 2. Upload encrypted payload
                  ▼
┌─────────────────────────────────────┐
│   IPFS / Pinata                      │
│  ┌─────────────────────────────┐    │
│  │ pinJSONToIPFS(payload)      │    │
│  │ → Returns CID               │    │
│  └──────────────┬──────────────┘    │
└─────────────────┼──────────────────┘
                  │
                  │ 3. Register on-chain
                  │    CID + hash
                  ▼
┌─────────────────────────────────────┐
│   Smart Contract (Blockchain)        │
│  ┌─────────────────────────────┐    │
│  │ createRecord(cid, hash)     │    │
│  │ → Returns recordId          │    │
│  └──────────────┬──────────────┘    │
│                 │                     │
│                 │ 4. Grant consent   │
│                 │    (EIP-712)        │
│                 ▼                     │
│  ┌─────────────────────────────┐    │
│  │ grantConsent(recordId, doctor)│   │
│  │ → Stores consent on-chain   │    │
│  └──────────────┬──────────────┘    │
└─────────────────┼──────────────────┘
                  │
                  │ 5. Share symmetric key
                  │    (ECIES, off-chain)
                  ▼
┌─────────────────────────────────────┐
│   Doctor Wallet                      │
│  ┌─────────────────────────────┐    │
│  │ 1. Decrypt sym key (ECIES)   │    │
│  │ 2. Download from IPFS        │    │
│  │ 3. Decrypt metadata (AES-GCM)│    │
│  │ 4. logAccess(recordId)        │    │
│  └─────────────────────────────┘    │
└──────────────────────────────────────┘
```

### Data Flow Details

**Step 1: JavaScript Interface**
- **Input**: HTML form fields
- **Processing**: 
  - `buildMetadata()`: Constructs JSON from FormData
  - `encryptMetadata()`: Uses Web Crypto API for AES-256-GCM
- **Output**: 
  - Metadata JSON (plain text)
  - Encrypted payload JSON
  - Symmetric key (hex)

**Step 2: IPFS Upload**
- **Input**: Encrypted payload JSON
- **Method**: Pinata API (`pinJSONToIPFS`)
- **Output**: IPFS CID

**Step 3: On-Chain Registration**
- **Input**: CID + `keccak256(encryptedPayload)`
- **Function**: `createRecord(patient, cidMeta, metaHash)`
- **Output**: `recordId`

**Step 4: Consent Management**
- **Input**: `recordId`, doctor address, expiry, nonce
- **Process**: EIP-712 signature generation (off-chain)
- **Function**: `grantConsent(recordId, doctor, expiry, nonce, signature)`
- **Output**: Consent stored, `ConsentGranted` event

**Step 5: Doctor Access**
- **Input**: Encrypted sym key (ECIES), IPFS CID
- **Process**: 
  1. Decrypt sym key with doctor's private key
  2. Download encrypted payload from IPFS
  3. Decrypt metadata with sym key
- **Function**: `logAccess(recordId, action)`
- **Output**: `AccessLogged` event

## Smart Contract Architecture

### Proxy Pattern: UUPS (Universal Upgradeable Proxy Standard)

- **Implementation Contract**: `MedicalRecords.sol` (logic)
- **Proxy Contract**: `ERC1967Proxy` (storage)
- **Upgrade Authorization**: `UPGRADER_ROLE` via AccessControl
- **Storage Layout**: Preserved across upgrades using storage gaps

### Storage Layout

```solidity
// Slot 0: AccessControlUpgradeable storage
// Slot 1: ReentrancyGuardUpgradeable storage
// Slot 2: EIP712Upgradeable storage

uint256 private _nextRecordId;                    // Slot 3
mapping(uint256 => MedicalRecord) private _records; // Slots 4+
mapping(uint256 => mapping(address => mapping(bytes32 => Consent))) private _consents; // Slots 5+
mapping(address => mapping(bytes32 => bool)) private _usedNonces; // Slots 6+
uint256[50] private __gap;                         // Slots 7-56 (reserved for future)
```

### Structs

#### MedicalRecord
```solidity
struct MedicalRecord {
    uint256 id;          // Unique record identifier
    address owner;        // Patient address
    string cidMeta;      // IPFS CID of encrypted metadata
    bytes32 metaHash;    // Keccak256 hash of encrypted metadata
    uint64 timestamp;    // Creation timestamp
    bool revoked;        // Revocation status
}
```

#### Consent
```solidity
struct Consent {
    uint256 recordId;    // Associated record ID
    address patient;     // Patient address
    address doctor;      // Doctor address
    uint64 expiry;       // Expiration timestamp
    bytes32 nonce;       // Replay protection
    bool revoked;        // Revocation status
}
```

## EIP-712 Specification

### Domain Separator

```javascript
{
  name: "MedicalRecords",
  version: "1",
  chainId: <chainId>,
  verifyingContract: <proxyAddress>
}
```

### Primary Type: Consent

```solidity
Consent(uint256 recordId, address doctor, uint64 expiry, bytes32 nonce)
```

### Type Hash

```
keccak256("Consent(uint256 recordId,address doctor,uint64 expiry,bytes32 nonce)")
```

### Example Typed Data

See `EIP712_SAMPLES.json` for complete examples.

## Metadata JSON Schema

The encrypted metadata stored on IPFS follows this schema:

```json
{
  "patientHash": "0x...",
  "examType": "blood",
  "date": "2024-01-01",
  "files": [
    "QmImage1",
    "QmImage2"
  ],
  "notesHash": "0x..."
}
```

**Note**: This entire JSON is encrypted client-side with AES-256-GCM before upload to IPFS.

## Encryption & Key Sharing

### Symmetric Encryption

- **Algorithm**: AES-256-GCM
- **Key Generation**: Random 32-byte key per record
- **Location**: Client-side only (never stored on-chain)

### Key Sharing (ECIES)

- **Algorithm**: ECIES over secp256k1
- **Process**:
  1. Patient encrypts symmetric key with doctor's public key
  2. Encrypted key is shared off-chain (QR code, secure channel)
  3. Doctor decrypts with their private key
  4. Doctor uses symmetric key to decrypt metadata from IPFS

### QR Code Format (Base64 JSON)

```json
{
  "recordId": 1,
  "cidMeta": "QmTest123",
  "expiry": 1704067200,
  "nonce": "0x...",
  "encryptedSymKey": "0x...",
  "signature": "0x..."
}
```

Base64 encode this JSON for QR code generation.

## Pinata Integration

### Authentication

Two methods supported:
1. **JWT Token** (recommended): `PINATA_JWT`
2. **API Key + Secret**: `PINATA_API_KEY` + `PINATA_SECRET`

### Endpoints

- **Upload JSON**: `POST https://api.pinata.cloud/pinning/pinJSONToIPFS`
- **Upload File**: `POST https://api.pinata.cloud/pinning/pinFileToIPFS`

See `PINATA_EXAMPLES.md` for detailed examples.

### Testing

For CI/testing, use `MOCK_PINATA=true` to return simulated CIDs without API calls.

## Access Control

### Roles

- **DEFAULT_ADMIN_ROLE**: Full administrative access
- **UPGRADER_ROLE**: Can authorize contract upgrades

### Function Permissions

- `createRecord`: Only patient (msg.sender == patient)
- `revokeRecord`: Only record owner
- `grantConsent`: Requires EIP-712 signature from patient
- `revokeConsent`: Patient or doctor
- `logAccess`: Any address (audit logging)
- `upgradeTo`: Only UPGRADER_ROLE

## Security Considerations

### On-Chain Security

1. **No Symmetric Keys**: Never store encryption keys on-chain
2. **Replay Protection**: Nonce-based consent prevents replay attacks
3. **Expiry Validation**: Consents expire automatically
4. **Access Control**: Role-based upgrade authorization
5. **Storage Gaps**: Preserve upgrade safety

### Off-Chain Security

1. **Key Management**: Patient must securely store private keys
2. **Encryption**: All metadata encrypted before IPFS upload
3. **Key Sharing**: Use secure channels for ECIES-encrypted keys
4. **IPFS Privacy**: Content is encrypted, but CID is public

### Recommendations

1. **Multi-sig Wallet**: Use multi-sig for UPGRADER_ROLE
2. **Audit**: Regular security audits of smart contracts
3. **Rate Limiting**: Implement off-chain rate limits for API calls
4. **Backup**: Patient should backup keys securely (Shamir backup, hardware wallet)
5. **Monitoring**: Monitor contract events for suspicious activity

## Upgrade Process

### Pre-Upgrade Checklist

1. Verify storage layout compatibility
2. Test upgrade on testnet
3. Ensure admin has UPGRADER_ROLE
4. Document changes in new version

### Upgrade Script

```bash
export PROXY_ADDRESS="0x..."
export PRIVATE_KEY="0x..."
forge script script/Upgrade.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

### Storage Invariants

After upgrade, verify:
- Existing records remain accessible
- Consents preserved
- Storage layout unchanged (except new variables appended)

## Recovery Options

### Key Recovery

**Current Implementation**: No built-in recovery mechanism

**Options** (not implemented):
1. **Shamir Secret Sharing**: Split key into n shares
2. **Custodial Recovery**: Trusted third-party backup
3. **Social Recovery**: Multi-party approval

**Risks**:
- Lost private key = lost access to records
- No central authority to recover
- Patient responsibility to backup keys

## Testing

### Unit Tests

- `test/MedicalRecords.t.sol`: Core functionality
- `test/MedicalRecordsUpgrade.t.sol`: Upgrade scenarios
- `test/IntegrationFlow.t.sol`: End-to-end flows

### Coverage Goals

- Target: ≥80% function coverage
- Critical paths: 100% coverage
- Edge cases: Comprehensive testing

### Running Tests

```bash
forge test
forge test --match-test test_CompletePatientDoctorFlow -vvv
```

## Complete Integration Example

### End-to-End Workflow

**1. Start JavaScript Interface**
```bash
cd offchain-app
npm install
npm run start
# Open http://127.0.0.1:8080
```

**2. Fill Form and Generate Payload**
- Enter patient data in form
- Click "Gerar Payload Cifrado"
- Copy the encrypted payload JSON
- Save the symmetric key securely

**3. Upload to IPFS**
```bash
# Using Pinata API (see docs/PINATA_EXAMPLES.md)
curl -X POST https://api.pinata.cloud/pinning/pinJSONToIPFS \
  -H "Authorization: Bearer $PINATA_JWT" \
  -H "Content-Type: application/json" \
  -d @encrypted_payload.json
# Response: {"IpfsHash": "QmXyZ123..."}
```

**4. Calculate Hash**
```javascript
// In browser console or Node.js
const payload = JSON.parse(encryptedPayloadJson);
const payloadString = JSON.stringify(payload);
const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(payloadString));
// Or use: keccak256(abi.encode(payload))
```

**5. Register on Blockchain**
```javascript
// Using ethers.js or web3.js
const contract = new ethers.Contract(proxyAddress, abi, signer);
const tx = await contract.createRecord(
  patientAddress,
  cidMeta,      // From step 3
  metaHash      // From step 4
);
const receipt = await tx.wait();
const recordId = receipt.events[0].args.id;
```

**6. Grant Consent**
```javascript
// Generate EIP-712 signature
const domain = {
  name: "MedicalRecords",
  version: "1",
  chainId: chainId,
  verifyingContract: proxyAddress
};

const types = {
  Consent: [
    { name: "recordId", type: "uint256" },
    { name: "doctor", type: "address" },
    { name: "expiry", type: "uint64" },
    { name: "nonce", type: "bytes32" }
  ]
};

const value = {
  recordId: recordId,
  doctor: doctorAddress,
  expiry: expiryTimestamp,
  nonce: nonce
};

const signature = await signer._signTypedData(domain, types, value);

// Call grantConsent
await contract.grantConsent(recordId, doctorAddress, expiry, nonce, signature);
```

## Deployment

### Environment Variables

```bash
export RPC_URL="https://sepolia.infura.io/v3/YOUR_KEY"
export PRIVATE_KEY="0x..."  # Without 0x prefix for forge
export PINATA_JWT="your_jwt_token"  # Optional
```

### Deploy Script

```bash
forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

### Post-Deployment

1. Verify proxy address
2. Grant roles if needed
3. Test createRecord function
4. Monitor events

## Event Logging

All important actions emit events for audit:

- `RecordCreated`: New record creation
- `ConsentGranted`: Patient grants access
- `ConsentRevoked`: Consent revoked
- `AccessLogged`: Doctor accesses record
- `ImplementationUpgraded`: Contract upgraded

## Gas Optimization

### Current Gas Costs (approximate)

- `createRecord`: ~100k gas
- `grantConsent`: ~150k gas (includes EIP-712 verification)
- `revokeConsent`: ~50k gas
- `logAccess`: ~30k gas

### Optimization Opportunities

1. Pack structs more efficiently
2. Use events instead of storage for historical data
3. Batch operations where possible

## Future Enhancements

1. **Batch Operations**: Create multiple records in one transaction
2. **Consent Templates**: Reusable consent configurations
3. **Access History**: Query all access logs for a record
4. **Multi-chain Support**: Cross-chain record sharing
5. **Privacy Pools**: Zero-knowledge proof integration

## References

- [EIP-712: Typed Structured Data Hashing and Signing](https://eips.ethereum.org/EIPS/eip-712)
- [ERC-1967: Proxy Storage Slots](https://eips.ethereum.org/EIPS/eip-1967)
- [OpenZeppelin UUPS Upgradeable Pattern](https://docs.openzeppelin.com/upgrades-plugins/1.x/upgradeable-smart-contracts)
- [Pinata API Documentation](https://docs.pinata.cloud/)

## License

MIT

========================================
== Logs ==
  Deploying MedicalRecords...
  Admin address: 0x49eE6FB60a0941fC9aAc4DBf1e9d1aF4cc00DF1f
  Implementation deployed at: 0xd19D8bE73d79A3B7c97c022b7ff059B9AA55e523
  Proxy deployed at: 0x30Ed4461B9cd13fD68dF8C59009357FDF8aC7688
  Contract version: 1.0.0

=== Deployment Summary ===
  Implementation: 0xd19D8bE73d79A3B7c97c022b7ff059B9AA55e523
  Proxy: 0x30Ed4461B9cd13fD68dF8C59009357FDF8aC7688
  Admin: 0x49eE6FB60a0941fC9aAc4DBf1e9d1aF4cc00DF1f
  Use the proxy address for interactions
