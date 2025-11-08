const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const multer = require('multer');
const FormData = require('form-data');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE_BYTES || 25 * 1024 * 1024)
  }
});

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [
        'http://127.0.0.1:8080',
        'http://localhost:8080',
        'http://127.0.0.1:8081',
        'http://localhost:8081'
      ]
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by CORS'));
    }
  })
);

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/config', (_req, res) => {
  res.json({
    contractAddress: process.env.CONTRACT_ADDRESS || '0x600aa9f85Ff66d41649EE02038cF8e9cfC0BF053',
    chainId: process.env.CHAIN_ID || 11155111,
    networkName: process.env.NETWORK_NAME || 'Sepolia'
  });
});

if (!process.env.PINATA_JWT && !(process.env.PINATA_API_KEY && process.env.PINATA_SECRET)) {
  console.warn('[Pinata] Nenhuma credencial encontrada. Configure PINATA_JWT ou PINATA_API_KEY/PINATA_SECRET.');
}

function resolvePinataHeaders() {
  if (process.env.PINATA_JWT) {
    return {
      Authorization: `Bearer ${process.env.PINATA_JWT}`
    };
  }

  if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET) {
    return {
      pinata_api_key: process.env.PINATA_API_KEY,
      pinata_secret_api_key: process.env.PINATA_SECRET
    };
  }

  return null;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Missing payload');
  }

  const requiredFields = ['schema', 'timestamp', 'iv', 'encrypted', 'authTag'];
  const missing = requiredFields.filter((field) => !payload[field]);

  if (missing.length > 0) {
    throw new Error(`Missing fields in payload: ${missing.join(', ')}`);
  }
}

app.post('/upload', async (req, res) => {
  try {
    const headers = resolvePinataHeaders();
    if (!headers) {
      return res.status(500).json({
        error: 'Pinata credentials not configured. Set PINATA_JWT or PINATA_API_KEY/PINATA_SECRET.'
      });
    }

    const payload = req.body;
    validatePayload(payload);

    const pinataRequest = {
      pinataContent: payload,
      pinataOptions: {
        cidVersion: 1
      },
      pinataMetadata: {
        name: `medical-payload-${Date.now()}`
      }
    };

    const response = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', pinataRequest, {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 15000
    });

    const deterministicHash = crypto
      .createHash('sha3-256')
      .update(JSON.stringify(payload))
      .digest('hex');

    return res.status(201).json({
      cid: response.data.IpfsHash,
      pinSize: response.data.PinSize,
      timestamp: response.data.Timestamp,
      metaHash: `0x${deterministicHash}`
    });
  } catch (error) {
    console.error('Upload failed', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const detail = error.response?.data || error.message;
    return res.status(status).json({ error: 'Failed to pin payload', detail });
  }
});

app.post('/upload-file', upload.single('file'), async (req, res) => {
  try {
    const headers = resolvePinataHeaders();
    if (!headers) {
      return res.status(500).json({
        error: 'Pinata credentials not configured. Set PINATA_JWT or PINATA_API_KEY/PINATA_SECRET.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided. Use multipart/form-data with field "file".' });
    }

    const { buffer, originalname, mimetype } = req.file;

    const formData = new FormData();
    formData.append('file', buffer, {
      filename: originalname,
      contentType: mimetype || 'application/octet-stream'
    });
    formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
    formData.append(
      'pinataMetadata',
      JSON.stringify({
        name: originalname,
        keyvalues: {
          uploadedAt: new Date().toISOString()
        }
      })
    );

    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      headers: {
        ...formData.getHeaders(),
        ...headers
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 30000
    });

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    return res.status(201).json({
      cid: response.data.IpfsHash,
      pinSize: response.data.PinSize,
      timestamp: response.data.Timestamp,
      sha256: `0x${sha256}`,
      fileName: originalname
    });
  } catch (error) {
    console.error('File upload failed', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const detail = error.response?.data || error.message;
    return res.status(status).json({ error: 'Failed to pin file', detail });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Pinata upload service listening on http://127.0.0.1:${PORT}`);
});


