# Medical Records System

A decentralized medical records system built on Ethereum using Foundry. Patients control their medical records through wallet-based authentication, with encrypted data stored on IPFS and consent management handled on-chain via EIP-712 signatures.

## Features

- 🔐 **Wallet-Based Authentication**: Patients control records with their private keys
- 🔒 **End-to-End Encryption**: All metadata encrypted client-side before IPFS upload
- 📝 **EIP-712 Consent Management**: Cryptographic consent signatures
- 💰 **Payment System**: 0.0001 ETH fee per record creation (≈ US$0.43)
- 💼 **Admin Controls**: Fund accumulation, withdrawal, and emergency pause/unpause
- 🔄 **UUPS Upgradeable**: Smart contract can be upgraded safely
- 📊 **Audit Trail**: All access logged on-chain with full tracking
- ⏸️ **Emergency Controls**: Pause/unpause functionality for admin
- 🧪 **Comprehensive Tests**: Full test coverage with Foundry

## Architecture

```
Patient Wallet → Encrypt → IPFS (Pinata) → Smart Contract → Doctor Wallet
```

- Metadata encrypted with AES-256-GCM
- Symmetric keys shared via ECIES (secp256k1)
- Consent managed via EIP-712 signatures
- Records stored on-chain (CID + hash only)

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (latest version)
- Node.js 18+ (for off-chain scripts)
- Git

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd medicalRepository
```

2. Install dependencies:
```bash
forge install
```

3. Install OpenZeppelin contracts:
```bash
forge install OpenZeppelin/openzeppelin-contracts-upgradeable
forge install OpenZeppelin/openzeppelin-foundry-upgrades
```

## Project Structure

```
.
├── src/
│   ├── IMedicalRecords.sol          # Interface
│   ├── MedicalRecords.sol            # V1 Implementation (UUPS)
│   └── MedicalRecordsV2.sol         # V2 Implementation (with tags)
├── script/
│   ├── Deploy.s.sol                  # Deployment script
│   └── Upgrade.s.sol                 # Upgrade script
├── test/
│   ├── MedicalRecords.t.sol          # Unit tests
│   ├── MedicalRecordsUpgrade.t.sol    # Upgrade tests
│   └── IntegrationFlow.t.sol         # Integration tests
├── docs/
│   ├── TECHNICAL_DOC.md              # Technical documentation
│   ├── BUSINESS_SUMMARY.md           # Business model and use cases
│   ├── FRONTEND_INTEGRATION.md       # Frontend integration guide
│   ├── EIP712_SAMPLES.json           # EIP-712 examples
│   └── PINATA_EXAMPLES.md            # Pinata integration guide
└── foundry.toml                      # Foundry configuration
```

## Quick Start

### Build

```bash
forge build
```

### Test

```bash
forge test
```

Run with verbose output:
```bash
forge test -vvv
```

Run specific test:
```bash
forge test --match-test test_CompletePatientDoctorFlow -vvv
```

## Deployment

### Setup Environment Variables

Create a `.env` file (not committed):

```bash
RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=0x...
PINATA_JWT=your_jwt_token  # Optional
```

### Deploy to Testnet

```bash
forge script script/Deploy.s.sol \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### Upgrade Contract

```bash
export PROXY_ADDRESS=0x...  # Address from deployment

forge script script/Upgrade.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## Usage

### Creating a Medical Record

1. **Encrypt metadata** (client-side):
   ```javascript
   const symKey = crypto.randomBytes(32);
   const encrypted = encryptAES256GCM(metadata, symKey);
   ```

2. **Upload to IPFS** (Pinata):
   ```javascript
   const cid = await pinata.pinJSONToIPFS(encrypted);
   ```

3. **Create record on-chain** (requires 0.0001 ETH payment):
   ```solidity
   uint256 recordId = medicalRecords.createRecord{value: 0.0001 ether}(
       patientAddress,
       cid,
       keccak256(encryptedMetadata)
   );
   ```
   
   **Note**: Payment of 0.0001 ETH (≈ US$0.43) is required and accumulated in the contract. Admin can withdraw funds using `withdraw()`.

### Granting Consent

1. **Sign EIP-712 consent** (patient):
   ```javascript
   const signature = await signer._signTypedData(domain, types, message);
   ```

2. **Grant consent on-chain**:
   ```solidity
   medicalRecords.grantConsent(
       recordId,
       doctorAddress,
       expiry,
       nonce,
       signature
   );
   ```

3. **Share encrypted key** (off-chain, ECIES):
   ```javascript
   const encryptedKey = encryptECIES(symKey, doctorPublicKey);
   // Share via QR code or secure channel
   ```

### Accessing a Record

1. **Doctor receives encrypted key** (off-chain)
2. **Decrypt symmetric key** (ECIES):
   ```javascript
   const symKey = decryptECIES(encryptedKey, doctorPrivateKey);
   ```

3. **Download from IPFS**:
   ```javascript
   const encrypted = await ipfs.get(cid);
   ```

4. **Decrypt metadata**:
   ```javascript
   const metadata = decryptAES256GCM(encrypted, symKey);
   ```

5. **Log access on-chain**:
   ```solidity
   medicalRecords.logAccess(recordId, "viewed");
   ```

## Admin Functions

### Payment Management

**Check contract balance:**
```solidity
uint256 balance = medicalRecords.getContractBalance();
```

**Withdraw accumulated funds** (admin only):
```solidity
medicalRecords.withdraw(); // Transfers all accumulated ETH to admin
```

**View payment statistics:**
```solidity
uint256 total = medicalRecords.getTotalPayments();
uint256 byPayer = medicalRecords.getPaymentsByPayer(patientAddress);
```

### Emergency Controls

**Pause contract** (admin only):
```solidity
medicalRecords.pause(); // Stops createRecord, grantConsent, logAccess
```

**Unpause contract** (admin only):
```solidity
medicalRecords.unpause(); // Resumes all operations
```

**Check pause status:**
```solidity
bool isPaused = medicalRecords.paused();
```

**Note**: When paused, `withdraw()` and view functions still work. Only state-changing operations are blocked.

## Testing

### Unit Tests

Test core functionality:
```bash
forge test --match-path test/MedicalRecords.t.sol
```

### Upgrade Tests

Test upgrade functionality:
```bash
forge test --match-path test/MedicalRecordsUpgrade.t.sol
```

### Integration Tests

Test complete flows:
```bash
forge test --match-path test/IntegrationFlow.t.sol
```

### Coverage

Generate coverage report:
```bash
forge coverage
```

## Security

### Key Points

- ✅ **No symmetric keys on-chain**: All encryption keys stored client-side only
- ✅ **Replay protection**: Nonce-based consent prevents replay attacks
- ✅ **Expiry validation**: Consents expire automatically
- ✅ **Access control**: Role-based upgrade authorization
- ✅ **Storage gaps**: Upgrade safety preserved
- ✅ **Payment security**: Funds accumulated safely, admin-controlled withdrawal
- ✅ **Emergency controls**: Pause/unpause for security incidents
- ✅ **Full audit trail**: All payments, consents, and accesses tracked via events

### Recommendations

1. **Multi-sig wallet** for UPGRADER_ROLE
2. **Regular security audits**
3. **Rate limiting** for API calls
4. **Secure key backup** (Shamir, hardware wallet)
5. **Monitor events** for suspicious activity

## Documentation

- [Technical Documentation](docs/TECHNICAL_DOC.md) - Complete technical specification
- [Business Summary](docs/BUSINESS_SUMMARY.md) - Business model and use cases
- [Frontend Integration](docs/FRONTEND_INTEGRATION.md) - Frontend integration guide with payment and event tracking
- [EIP-712 Examples](docs/EIP712_SAMPLES.json) - Consent signing examples
- [Pinata Integration](docs/PINATA_EXAMPLES.md) - IPFS upload examples

## Development

### Adding New Features

1. Create feature branch
2. Implement changes
3. Add tests
4. Update documentation
5. Submit PR

### Code Style

- Follow Solidity style guide
- Use NatSpec comments
- Add tests for all functions
- Document storage layout changes

## Troubleshooting

### Build Errors

```bash
# Clean and rebuild
forge clean
forge build
```

### Test Failures

```bash
# Run with trace
forge test -vvvv
```

### Deployment Issues

- Verify RPC URL is correct
- Check private key has sufficient balance
- Ensure network is supported

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Disclaimer

This software is provided "as is" without warranty. Use at your own risk. Medical records handling must comply with local regulations (HIPAA, GDPR, etc.).

## Support

For issues and questions:
- Open an issue on GitHub
- Check documentation in `docs/`
- Review test files for usage examples

## Roadmap

- [x] Payment system with fund accumulation
- [x] Admin withdrawal functionality
- [x] Pause/unpause emergency controls
- [x] Complete event tracking for admin
- [ ] Batch operations
- [ ] Consent templates
- [ ] Access history queries
- [ ] Multi-chain support
- [ ] Zero-knowledge proofs

