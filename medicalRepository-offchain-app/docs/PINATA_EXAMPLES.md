# Pinata Integration Examples

This document provides examples for uploading encrypted medical records to IPFS via Pinata. The goal is to keep all credentials fora da interface web e utilizá-las apenas em scripts/serviços backend.

## Authentication

### Method 1: JWT Token (Recommended)

```bash
export PINATA_JWT="your_jwt_token_here"
```

### Method 2: API Key + Secret

```bash
export PINATA_API_KEY="your_api_key"
export PINATA_SECRET="your_secret_key"
```

> Windows PowerShell: `$env:PINATA_JWT="..."` ou `setx PINATA_JWT "..."` para persistir na máquina. No PowerShell, use `$env:PINATA_API_KEY` / `$env:PINATA_SECRET` com a mesma ideia.

### Local `.env` (Node.js)

Para scripts Node.js, mantenha as chaves num arquivo `.env` que não deve ser versionado:

```
PINATA_JWT=seu_token_jwt
# ou
PINATA_API_KEY=seu_api_key
PINATA_SECRET=seu_secret_key
```

Carregue no código com:

```javascript
require('dotenv').config();
```

## cURL Examples

### Upload JSON Metadata

```bash
# Using JWT
curl -X POST \
  https://api.pinata.cloud/pinning/pinJSONToIPFS \
  -H "Authorization: Bearer $PINATA_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "pinataContent": {
      "patientHash": "0x123...",  # hash derivado do identificador real do paciente
      "examType": "blood",
      "date": "2024-01-01",
      "files": ["QmImage1", "QmImage2"],
      "notesHash": "0x456..."
    },
    "pinataOptions": {
      "cidVersion": 1
    },
    "pinataMetadata": {
      "name": "medical-record-1"
    }
  }'
```

```bash
# Using API Key + Secret
curl -X POST \
  https://api.pinata.cloud/pinning/pinJSONToIPFS \
  -H "pinata_api_key: $PINATA_API_KEY" \
  -H "pinata_secret_api_key: $PINATA_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "pinataContent": {
      "patientHash": "0x123...",
      "examType": "blood",
      "date": "2024-01-01",
      "files": ["QmImage1", "QmImage2"],
      "notesHash": "0x456..."
    }
  }'
```

### Upload File (Encrypted Image)

```bash
# Using JWT
curl -X POST \
  https://api.pinata.cloud/pinning/pinFileToIPFS \
  -H "Authorization: Bearer $PINATA_JWT" \
  -F "file=@encrypted_exam_image.jpg" \
  -F "pinataOptions={\"cidVersion\":1}" \
  -F "pinataMetadata={\"name\":\"exam-image-1\"}"
```

```bash
# Using API Key + Secret
curl -X POST \
  https://api.pinata.cloud/pinning/pinFileToIPFS \
  -H "pinata_api_key: $PINATA_API_KEY" \
  -H "pinata_secret_api_key: $PINATA_SECRET" \
  -F "file=@encrypted_exam_image.jpg"
```

## Node.js Examples

### Setup

```bash
npm install axios form-data
```

### Upload JSON with JWT

```javascript
const axios = require('axios');

async function pinJSONToIPFS(encryptedMetadata, jwtToken) {
  const url = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
  
  const data = {
    pinataContent: encryptedMetadata,
    pinataOptions: {
      cidVersion: 1
    },
    pinataMetadata: {
      name: `medical-record-${Date.now()}`
    }
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.IpfsHash; // Returns CID
  } catch (error) {
    console.error('Error pinning to IPFS:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
const encryptedMetadata = {
  patientHash: '0x123...', // wallet address ou ID com hash aplicado (ex.: keccak256(walletAddress))
  examType: 'blood',
  date: '2024-01-01',
  files: ['QmImage1'],
  notesHash: '0x456...'
};

const cid = await pinJSONToIPFS(encryptedMetadata, process.env.PINATA_JWT);
console.log('CID:', cid);
```

### Upload JSON with API Key

```javascript
const axios = require('axios');

async function pinJSONToIPFS(encryptedMetadata, apiKey, secretKey) {
  const url = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
  
  const data = {
    pinataContent: encryptedMetadata
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': secretKey,
        'Content-Type': 'application/json'
      }
    });

    return response.data.IpfsHash;
  } catch (error) {
    console.error('Error pinning to IPFS:', error.response?.data || error.message);
    throw error;
  }
}
```

### Upload File

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function pinFileToIPFS(filePath, jwtToken) {
  const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
  
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  formData.append('pinataOptions', JSON.stringify({
    cidVersion: 1
  }));
  formData.append('pinataMetadata', JSON.stringify({
    name: `medical-file-${Date.now()}`
  }));

  try {
    const response = await axios.post(url, formData, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    return response.data.IpfsHash;
  } catch (error) {
    console.error('Error pinning file to IPFS:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
const cid = await pinFileToIPFS('./encrypted_exam.jpg', process.env.PINATA_JWT);
console.log('File CID:', cid);
```

## Complete Example: Encrypt and Upload

```javascript
const crypto = require('crypto');
const axios = require('axios');

// Generate symmetric key (AES-256)
function generateSymmetricKey() {
  return crypto.randomBytes(32);
}

// Encrypt metadata with AES-256-GCM
function encryptMetadata(metadata, key) {
  const iv = crypto.randomBytes(12); // 12 bytes for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(metadata), 'utf8'),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

// Upload encrypted metadata
async function createEncryptedRecord(metadata, pinataJWT) {
  // Generate symmetric key
  const symKey = generateSymmetricKey();
  
  // Encrypt metadata
  const encrypted = encryptMetadata(metadata, symKey);
  
  // Prepare payload for IPFS (store encrypted data + IV + authTag)
  const ipfsPayload = {
    encrypted: encrypted.encrypted,
    iv: encrypted.iv,
    authTag: encrypted.authTag
  };
  
  // Upload to Pinata
  const cid = await pinJSONToIPFS(ipfsPayload, pinataJWT);
  
  // Calculate hash for on-chain storage
  const hash = crypto.createHash('sha3-256')
    .update(JSON.stringify(ipfsPayload))
    .digest('hex');
  
  return {
    cid,
    hash: `0x${hash}`,
    symKey: symKey.toString('hex') // Store securely, never on-chain!
  };
}

// Usage
const metadata = {
  patientHash: "0x123...",
  examType: "blood",
  date: "2024-01-01",
  files: ["QmImage1"],
  notesHash: "0x456..."
};

const { cid, hash, symKey } = await createEncryptedRecord(
  metadata,
  process.env.PINATA_JWT
);

console.log('CID:', cid);
console.log('Hash:', hash);
console.log('Symmetric Key (store securely):', symKey);
```

## Mocking for Testing

For CI/testing environments, use mocks instead of real Pinata calls:

```javascript
function mockPinataUpload(data) {
  if (process.env.MOCK_PINATA === 'true') {
    // Return deterministic mock CID
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
    return `Qm${hash.substring(0, 44)}`;
  }
  
  // Real Pinata call
  return pinJSONToIPFS(data, process.env.PINATA_JWT);
}
```

## Error Handling

```javascript
async function pinWithRetry(data, jwtToken, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await pinJSONToIPFS(data, jwtToken);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

## Rate Limits

Pinata has rate limits:
- Free tier: 100 requests/day
- Paid tiers: Higher limits

Implement rate limiting in your application:

```javascript
const rateLimit = require('express-rate-limit');

const pinataLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 100 // limit each IP to 100 requests per windowMs
});
```

## Security Best Practices

1. **Never expose JWT/API keys** in client-side code
2. **Use environment variables** for credentials
3. **Encrypt before upload** - never upload plaintext medical data
4. **Validate CIDs** before storing on-chain
5. **Monitor uploads** for suspicious activity
6. **Use HTTPS** only for API calls

## References

- [Pinata API Documentation](https://docs.pinata.cloud/)
- [Pinata Authentication](https://docs.pinata.cloud/api-keys/api-authentication)
- [IPFS CID Specification](https://docs.ipfs.tech/concepts/content-addressing/)

