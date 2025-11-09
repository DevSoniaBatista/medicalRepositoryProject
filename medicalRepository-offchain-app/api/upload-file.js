// Vercel Serverless Function - /api/upload-file
// Upload de arquivo ao Pinata

const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');
const Busboy = require('busboy');

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

export default async function handler(req, res) {
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

    // Parse multipart form data usando Busboy
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileName = null;
    let fileMimeType = null;

    await new Promise((resolve, reject) => {
      busboy.on('file', (name, file, info) => {
        const { filename, encoding, mimeType } = info;
        fileName = filename;
        fileMimeType = mimeType;
        const chunks = [];

        file.on('data', (chunk) => {
          chunks.push(chunk);
        });

        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      busboy.on('finish', () => {
        resolve();
      });

      busboy.on('error', (err) => {
        reject(err);
      });

      req.pipe(busboy);
    });

    if (!fileBuffer || !fileName) {
      return res.status(400).json({ error: 'No file provided. Use multipart/form-data with field "file".' });
    }

    const originalname = fileName;
    const mimetype = fileMimeType || 'application/octet-stream';
    const buffer = fileBuffer;

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
    console.error('[API] File upload failed', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const detail = error.response?.data || error.message;
    return res.status(status).json({ error: 'Failed to pin file', detail });
  }
}

