# Medical Repository Project

DEMO: https://www.loom.com/share/19381fb3bb2b43d3a53bea362b39247a

URL Vercel: https://medical-records-gamma.vercel.app/

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
- 💰 **Payment System**: 0.0001 ETH fee per record creation (≈ US$0.43)
- 📝 **EIP-712 Consent Management**: Cryptographic consent signatures for secure access control
- 🔄 **UUPS Upgradeable**: Smart contracts can be upgraded safely without losing data
- 📊 **Audit Trail**: All access attempts and consent grants are logged on-chain
- 💼 **Admin Controls**: Fund accumulation, withdrawal, and emergency pause/unpause
- 🔍 **Complete Event Tracking**: All payments, consents, and accesses tracked via events
- 🧪 **Comprehensive Tests**: Full test coverage with Foundry

**How It Works:**
- Patients create medical records by storing encrypted metadata CIDs on-chain
- **Payment Required**: Each record creation requires payment of 0.0001 ETH, which is accumulated in the contract
- Consent is managed through EIP-712 typed signatures, ensuring cryptographic proof of patient authorization
- Healthcare providers can only access records after receiving explicit consent from patients
- All access attempts are logged on-chain for transparency and audit purposes
- **Admin Functions**: Administrators can view payment statistics, withdraw accumulated funds, and pause/unpause the contract in emergencies
- **Event System**: Complete tracking of all system activity through blockchain events (payments, creations, consents, accesses)
- The contract uses a UUPS (Universal Upgradeable Proxy Standard) pattern, allowing for safe upgrades while preserving data integrity

**Technology Stack:**
- Solidity for smart contracts
- Foundry for development, testing, and deployment
- OpenZeppelin contracts for security and upgradeability
- Ethereum/Sepolia testnet for deployment

For detailed documentation, see [`medicalRepository/README.md`](medicalRepository/README.md) and [`medicalRepository/docs/`](medicalRepository/docs/).

---

### 2. Frontend Project (`medicalRepository-offchain-app/`)

A JavaScript web application that provides the user interface for patients, healthcare providers, and administrators to interact with the medical records system.

**Key Features:**
- 🔐 **MetaMask Integration**: Seamless wallet connection for authentication
- 🔒 **Client-Side Encryption**: AES-256-GCM encryption with global master key
- 💰 **Payment Integration**: Automatic payment of 0.0001 ETH when creating records
- 📤 **IPFS Upload**: Direct integration with Pinata for decentralized storage
- 👤 **Patient Interface**: Create and manage medical records
- 👨‍⚕️ **Doctor Interface**: Access patient records with proper consent
- 👨‍💼 **Admin Dashboard**: Complete administrative panel with statistics and controls
- 🔑 **Global Master Key**: Single master key configured on server for all records
- 📊 **Event Tracking**: View all system events (payments, creations, consents, accesses)
- 🖼️ **File Visualization**: Inline viewing of images and PDFs

**How It Works:**
- **For Patients:**
  1. Connect MetaMask wallet to authenticate
  2. Fill out medical record form (exam type, date, files, etc.)
  3. System automatically encrypts metadata using AES-256-GCM with global master key
  4. Encrypted payload is uploaded to IPFS (via Pinata)
  5. **Payment Required**: Must pay 0.0001 ETH to create record on-chain
  6. Record is created on-chain with the IPFS CID and payment is accumulated
  7. Access key is generated (includes master key automatically) and shared with healthcare providers

- **For Healthcare Providers:**
  1. Connect MetaMask wallet
  2. Receive access key from patient (contains master key automatically)
  3. System validates consent on-chain
  4. Access patient records using the master key
  5. Download and decrypt medical data from IPFS
  6. View files inline (images, PDFs)
  7. (Optional) Access is logged on-chain for audit purposes

- **For Administrators:**
  1. Connect MetaMask wallet (must have `DEFAULT_ADMIN_ROLE`)
  2. Access admin dashboard to view:
     - Contract status (paused/active)
     - Payment statistics (accumulated balance, total payments)
     - Payment history by payer
     - Complete event history
  3. Administrative actions:
     - Withdraw accumulated funds
     - Pause/unpause contract in emergencies
     - Monitor all system activity

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
         │ 1. Get Master Key from Backend
         │ 2. Encrypt Metadata (AES-256-GCM)
         │
         ▼
┌─────────────────┐
│  Frontend App   │
│  (JavaScript)   │
└────────┬────────┘
         │
         │ 3. Upload to IPFS (Pinata)
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│      IPFS       │      │   Blockchain    │
│   (Pinata)      │◄─────│  (Ethereum)     │
│                 │      │                 │
│ Encrypted Data  │      │ CID + Hash      │
│                 │      │ Payment (0.0001)│
│                 │      │ Consent Logs    │
│                 │      │ Event Tracking  │
└─────────────────┘      └────────┬────────┘
                                   │
                                   │ 4. Grant Consent (EIP-712)
                                   │ 5. Events: PaymentReceived, RecordCreated
                                   │
         ┌─────────────────────────┴──────────────┐
         │                                          │
         ▼                                          ▼
┌─────────────────┐                      ┌─────────────────┐
│   Healthcare    │                      │   Admin        │
│   Provider      │                      │   (MetaMask)    │
│  (MetaMask)     │                      │                 │
│                 │                      │ View Stats      │
│ Access Records  │                      │ Withdraw Funds  │
│ Decrypt Data    │                      │ Pause/Unpause  │
│ Log Access      │                      │ Track Events    │
└─────────────────┘                      └─────────────────┘
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
- ✅ **Global Master Key**: Single master key configured on server, never stored in browser or on-chain
- ✅ **No Keys On-Chain**: Encryption keys never stored on blockchain
- ✅ **Cryptographic Consent**: EIP-712 signatures ensure consent authenticity
- ✅ **Replay Protection**: Nonce-based system prevents replay attacks
- ✅ **Access Control**: Role-based permissions for contract upgrades and admin functions
- ✅ **Payment Validation**: Contract validates exact payment amount (0.0001 ETH)
- ✅ **Emergency Controls**: Admin can pause contract in case of vulnerabilities
- ✅ **Audit Trail**: All access attempts, payments, and consents logged on-chain
- ✅ **Complete Event Tracking**: Full transparency through blockchain events

## Documentation

Each project contains detailed documentation:

- **Blockchain Project:**
  - [`medicalRepository/README.md`](medicalRepository/README.md) - Setup and usage guide
  - [`medicalRepository/docs/TECHNICAL_DOC.md`](medicalRepository/docs/TECHNICAL_DOC.md) - Technical specifications
  - [`medicalRepository/docs/BUSINESS_SUMMARY.md`](medicalRepository/docs/BUSINESS_SUMMARY.md) - Business overview

- **Frontend Project:**
  - [`medicalRepository-offchain-app/README.md`](medicalRepository-offchain-app/README.md) - Setup and usage guide
  - [`medicalRepository-offchain-app/docs/FUNCIONAMENTO.md`](medicalRepository-offchain-app/docs/FUNCIONAMENTO.md) - Complete system operation details
  - [`medicalRepository-offchain-app/docs/ENV_VARIABLES.md`](medicalRepository-offchain-app/docs/ENV_VARIABLES.md) - Environment variables guide
  - [`medicalRepository-offchain-app/docs/VERCEL_DEPLOY.md`](medicalRepository-offchain-app/docs/VERCEL_DEPLOY.md) - Vercel deployment guide

## License

MIT License - see LICENSE file for details

## Disclaimer

This software is provided "as is" without warranty. Use at your own risk. Medical records handling must comply with local regulations (HIPAA, GDPR, etc.).
