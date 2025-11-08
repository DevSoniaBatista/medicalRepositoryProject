# Setup Instructions

## Initial Setup

1. **Install Foundry** (if not already installed):
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Install Dependencies**:
   ```bash
   forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v5.0.0
   forge install foundry-rs/forge-std
   ```

3. **Build the project**:
   ```bash
   forge build
   ```

4. **Run tests**:
   ```bash
   forge test
   ```

## Environment Variables

Create a `.env` file (not committed to git):

```bash
RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=0x...
PINATA_JWT=your_jwt_token  # Optional
PROXY_ADDRESS=0x...  # For upgrade script
```

## Deployment

### Deploy to Testnet

```bash
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### Upgrade Contract

```bash
export PROXY_ADDRESS=0x...  # From deployment output

forge script script/Upgrade.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## Project Structure

- `src/` - Solidity contracts
- `script/` - Deployment scripts
- `test/` - Test files
- `docs/` - Documentation
- `lib/` - Dependencies (auto-installed)

## Notes

- All contracts are UUPS upgradeable
- EIP-712 signatures required for consent
- No symmetric keys stored on-chain
- IPFS integration via Pinata (mockable for testing)

