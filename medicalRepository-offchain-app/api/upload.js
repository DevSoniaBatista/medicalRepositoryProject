// Vercel Serverless Function - /api/upload
// Upload de payload criptografado ao Pinata

const axios = require('axios');
const crypto = require('crypto');

function resolvePinataHeaders() {
  const pinataJwt = process.env.NEXT_PUBLIC_PINATA_JWT || process.env.PINATA_JWT;
  const pinataApiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY || process.env.PINATA_API_KEY;
  const pinataSecret = process.env.NEXT_PUBLIC_PINATA_SECRET || process.env.PINATA_SECRET;

  if (pinataJwt) {
    return {
      Authorization: `Bearer ${pinataJwt}`
    };
  }

  if (pinataApiKey && pinataSecret) {
    return {
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataSecret
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

module.exports = async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const headers = resolvePinataHeaders();
    if (!headers) {
      return res.status(500).json({
        error: 'Pinata credentials not configured. Set NEXT_PUBLIC_PINATA_JWT or NEXT_PUBLIC_PINATA_API_KEY/NEXT_PUBLIC_PINATA_SECRET.'
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
    console.error('[API] Upload failed', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const detail = error.response?.data || error.message;
    return res.status(status).json({ error: 'Failed to pin payload', detail });
  }
}

