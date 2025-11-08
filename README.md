# Medical Repository Project

A decentralized medical records system that enables patients to control their medical data through blockchain technology. This repository contains two main projects: a blockchain smart contract system and a frontend web application.

## Overview

This system allows patients to:
- **Control their medical records** using wallet-based authentication
- **Encrypt sensitive data** before storing it on decentralized storage (IPFS)
- **Manage consent** for healthcare providers to access their records
- **Maintain privacy** with end-to-end encryption and on-chain audit trails

## Projects

### 1. Blockchain Project (`medicalRepository/`)

A Solidity smart contract system built with Foundry that manages medical records on the Ethereum blockchain.

**Key Features:**
- 🔐 **Wallet-Based Authentication**: Patients control records with their private keys
- 🔒 **On-Chain Metadata Storage**: Stores IPFS CIDs and content hashes for verification
- 📝 **EIP-712 Consent Management**: Cryptographic consent signatures for secure access control
- 🔄 **UUPS Upgradeable**: Smart contracts can be upgraded safely without losing data
- 📊 **Audit Trail**: All access attempts and consent grants are logged on-chain
- 🧪 **Comprehensive Tests**: Full test coverage with Foundry

**How It Works:**
- Patients create medical records by storing encrypted metadata CIDs on-chain
- Consent is managed through EIP-712 typed signatures, ensuring cryptographic proof of patient authorization
- Healthcare providers can only access records after receiving explicit consent from patients
- All access attempts are logged on-chain for transparency and audit purposes
- The contract uses a UUPS (Universal Upgradeable Proxy Standard) pattern, allowing for safe upgrades while preserving data integrity

**Technology Stack:**
- Solidity for smart contracts
- Foundry for development, testing, and deployment
- OpenZeppelin contracts for security and upgradeability
- Ethereum/Sepolia testnet for deployment

For detailed documentation, see [`medicalRepository/README.md`](medicalRepository/README.md) and [`medicalRepository/docs/`](medicalRepository/docs/).

---

### 2. Frontend Project (`medicalRepository-offchain-app/`)

A JavaScript web application that provides the user interface for patients and healthcare providers to interact with the medical records system.

**Key Features:**
- 🔐 **MetaMask Integration**: Seamless wallet connection for authentication
- 🔒 **Client-Side Encryption**: AES-256-GCM encryption before data leaves the browser
- 📤 **IPFS Upload**: Direct integration with Pinata for decentralized storage
- 👤 **Patient Interface**: Create and manage medical records
- 👨‍⚕️ **Doctor Interface**: Access patient records with proper consent
- 🔑 **Key Management**: Secure symmetric key generation and sharing

**How It Works:**
- **For Patients:**
  1. Connect MetaMask wallet to authenticate
  2. Fill out medical record form (exam type, date, files, etc.)
  3. System automatically encrypts metadata using AES-256-GCM
  4. Encrypted payload is uploaded to IPFS (via Pinata)
  5. Record is created on-chain with the IPFS CID
  6. Symmetric key is generated and can be shared with healthcare providers via ECIES encryption

- **For Healthcare Providers:**
  1. Connect MetaMask wallet
  2. Receive encrypted symmetric key from patient (via secure channel)
  3. Access patient records using the decrypted key
  4. Download and decrypt medical data from IPFS
  5. Access is logged on-chain for audit purposes

**Technology Stack:**
- Vanilla JavaScript (no frameworks)
- Web Crypto API for encryption
- ethers.js for blockchain interaction
- Pinata SDK for IPFS storage
- Node.js backend for secure API operations

For detailed documentation, see [`medicalRepository-offchain-app/README.md`](medicalRepository-offchain-app/README.md) and [`medicalRepository-offchain-app/FUNCIONAMENTO.md`](medicalRepository-offchain-app/FUNCIONAMENTO.md).

---

## System Architecture

```
┌─────────────────┐
│   Patient       │
│   (MetaMask)    │
└────────┬────────┘
         │
         │ 1. Encrypt Metadata (AES-256-GCM)
         │
         ▼
┌─────────────────┐
│  Frontend App   │
│  (JavaScript)   │
└────────┬────────┘
         │
         │ 2. Upload to IPFS (Pinata)
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│      IPFS       │      │   Blockchain    │
│   (Pinata)      │◄─────│  (Ethereum)     │
│                 │      │                 │
│ Encrypted Data  │      │ CID + Hash      │
│                 │      │ Consent Logs    │
└─────────────────┘      └────────┬────────┘
                                   │
                                   │ 3. Grant Consent (EIP-712)
                                   │
                                   ▼
                            ┌─────────────────┐
                            │   Healthcare    │
                            │   Provider      │
                            │  (MetaMask)     │
                            └─────────────────┘
```

## Quick Start

### Prerequisites

- **For Blockchain Project:**
  - [Foundry](https://book.getfoundry.sh/getting-started/installation)
  - Node.js 18+
  - Git

- **For Frontend Project:**
  - Node.js 18+
  - npm
  - MetaMask browser extension

### Running the Projects

**Blockchain Project:**
```bash
cd medicalRepository
forge install
forge build
forge test
```

**Frontend Project:**
```bash
cd medicalRepository-offchain-app
npm install
npm run dev  # Starts both frontend and backend
```

## Security Features

- ✅ **End-to-End Encryption**: All sensitive data encrypted client-side before storage
- ✅ **No Keys On-Chain**: Encryption keys never stored on blockchain
- ✅ **Cryptographic Consent**: EIP-712 signatures ensure consent authenticity
- ✅ **Replay Protection**: Nonce-based system prevents replay attacks
- ✅ **Access Control**: Role-based permissions for contract upgrades
- ✅ **Audit Trail**: All access attempts logged on-chain

## Documentation

Each project contains detailed documentation:

- **Blockchain Project:**
  - [`medicalRepository/README.md`](medicalRepository/README.md) - Setup and usage guide
  - [`medicalRepository/docs/TECHNICAL_DOC.md`](medicalRepository/docs/TECHNICAL_DOC.md) - Technical specifications
  - [`medicalRepository/docs/BUSINESS_SUMMARY.md`](medicalRepository/docs/BUSINESS_SUMMARY.md) - Business overview

- **Frontend Project:**
  - [`medicalRepository-offchain-app/README.md`](medicalRepository-offchain-app/README.md) - Setup and usage guide
  - [`medicalRepository-offchain-app/FUNCIONAMENTO.md`](medicalRepository-offchain-app/FUNCIONAMENTO.md) - System operation details

## License

MIT License - see LICENSE file for details

## Disclaimer

This software is provided "as is" without warranty. Use at your own risk. Medical records handling must comply with local regulations (HIPAA, GDPR, etc.).
