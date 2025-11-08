// ethers.js será carregado via script tag no HTML
// Usar window.ethers quando disponível

let CONTRACT_ADDRESS = '0x600aa9f85Ff66d41649EE02038cF8e9cfC0BF053'; // Fallback
let SEPOLIA_CHAIN_ID = 11155111n;

const SEPOLIA_NETWORK = {
  chainId: '0xaa36a7', // 11155111 em hex
  chainName: 'Sepolia',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: ['https://rpc.sepolia.org'],
  blockExplorerUrls: ['https://sepolia.etherscan.io']
};

const CONTRACT_ABI = [
  'function createRecord(address patient, string calldata cidMeta, bytes32 metaHash) external returns (uint256 recordId)',
  'function getRecord(uint256 recordId) external view returns (tuple(uint256 id, address owner, string cidMeta, bytes32 metaHash, uint64 timestamp, bool revoked))',
  'function grantConsent(uint256 recordId, address doctor, uint64 expiry, bytes32 nonce, bytes calldata patientSignature) external',
  'function getConsent(uint256 recordId, address doctor, bytes32 nonce) external view returns (tuple(uint256 recordId, address patient, address doctor, uint64 expiry, bytes32 nonce, bool revoked))',
  'event RecordCreated(uint256 indexed id, address indexed owner, string cidMeta, bytes32 metaHash, uint64 timestamp)',
  'event ConsentGranted(uint256 indexed recordId, address indexed patient, address indexed doctor, uint64 expiry, bytes32 nonce)'
];

let EIP712_DOMAIN = {
  name: 'MedicalRecords',
  version: '1',
  chainId: 11155111,
  verifyingContract: CONTRACT_ADDRESS
};

// Carregar configuração do backend
async function loadConfig() {
  try {
    const response = await fetch('http://127.0.0.1:3000/config');
    if (response.ok) {
      const config = await response.json();
      CONTRACT_ADDRESS = config.contractAddress;
      SEPOLIA_CHAIN_ID = BigInt(config.chainId);
      // Atualizar EIP712_DOMAIN
      EIP712_DOMAIN.chainId = config.chainId;
      EIP712_DOMAIN.verifyingContract = CONTRACT_ADDRESS;
    }
  } catch (error) {
    console.warn('Não foi possível carregar configuração do backend, usando valores padrão:', error);
  }
}

// Carregar config ao inicializar
loadConfig();

const CONSENT_TYPE = {
  Consent: [
    { name: 'recordId', type: 'uint256' },
    { name: 'doctor', type: 'address' },
    { name: 'expiry', type: 'uint64' },
    { name: 'nonce', type: 'bytes32' }
  ]
};

export async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask não está instalado. Por favor, instale a extensão MetaMask.');
  }

  if (!window.ethers) {
    throw new Error('ethers.js não foi carregado. Aguarde alguns segundos e tente novamente.');
  }

  const ethers = window.ethers;
  const provider = new ethers.BrowserProvider(window.ethereum);
  
  // Verificar e trocar para Sepolia se necessário
  try {
    const network = await provider.getNetwork();
    if (network.chainId !== SEPOLIA_CHAIN_ID) {
      const shouldSwitch = confirm(
        `Você está na rede ${network.name} (Chain ID: ${network.chainId}).\n` +
        `O sistema requer Sepolia (Chain ID: ${SEPOLIA_CHAIN_ID}).\n` +
        `Deseja trocar para Sepolia agora?`
      );
      
      if (shouldSwitch) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_NETWORK.chainId }]
          });
        } catch (switchError) {
          // Se a rede não existir, adicionar
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [SEPOLIA_NETWORK]
            });
          } else {
            throw switchError;
          }
        }
        // Aguardar um pouco para a troca completar
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw new Error('Por favor, troque para a rede Sepolia na MetaMask.');
      }
    }
  } catch (error) {
    console.error('Erro ao verificar/trocar rede:', error);
    throw new Error(`Erro na rede: ${error.message}`);
  }

  const accounts = await provider.send('eth_requestAccounts', []);
  
  if (accounts.length === 0) {
    throw new Error('Nenhuma conta conectada.');
  }

  // Verificar novamente após conectar
  const finalNetwork = await provider.getNetwork();
  if (finalNetwork.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(`Rede incorreta. Esperado Sepolia (${SEPOLIA_CHAIN_ID}), mas está em ${finalNetwork.name} (${finalNetwork.chainId})`);
  }

  return { provider, signer: await provider.getSigner(), address: accounts[0] };
}

export async function getContract(provider) {
  const ethers = window.ethers;
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

export async function createRecord(signer, cidMeta, metaHash) {
  const ethers = window.ethers;
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  const address = await signer.getAddress();
  
  const tx = await contract.createRecord(address, cidMeta, metaHash);
  const receipt = await tx.wait();
  
  const event = receipt.logs.find(log => {
    try {
      const parsed = contract.interface.parseLog(log);
      return parsed && parsed.name === 'RecordCreated';
    } catch {
      return false;
    }
  });

  if (event) {
    const parsed = contract.interface.parseLog(event);
    return parsed.args.id.toString();
  }

  throw new Error('Evento RecordCreated não encontrado');
}

export async function getRecord(provider, recordId) {
  const contract = await getContract(provider);
  return await contract.getRecord(recordId);
}

export async function generateAccessKey(signer, recordId, doctorAddress, expiryDays = 30) {
  const ethers = window.ethers;
  const expiry = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);
  const nonce = ethers.randomBytes(32);
  
  const message = {
    recordId: BigInt(recordId),
    doctor: doctorAddress,
    expiry: BigInt(expiry),
    nonce: ethers.hexlify(nonce)
  };

  const signature = await signer.signTypedData(EIP712_DOMAIN, CONSENT_TYPE, message);

  return {
    recordId: recordId.toString(),
    doctor: doctorAddress,
    expiry: expiry.toString(),
    nonce: ethers.hexlify(nonce),
    signature,
    expiryDate: new Date(expiry * 1000).toISOString()
  };
}

export async function grantConsent(signer, recordId, doctorAddress, expiry, nonce, signature) {
  const ethers = window.ethers;
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  
  const tx = await contract.grantConsent(
    recordId,
    doctorAddress,
    expiry,
    nonce,
    signature
  );
  
  return await tx.wait();
}

export async function verifyConsent(provider, recordId, doctorAddress, nonce) {
  const contract = await getContract(provider);
  const consent = await contract.getConsent(recordId, doctorAddress, nonce);
  
  const ethers = window.ethers;
  if (consent.patient === ethers.ZeroAddress) {
    return { valid: false, reason: 'Consentimento não encontrado' };
  }

  if (consent.revoked) {
    return { valid: false, reason: 'Consentimento revogado' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(consent.expiry) < now) {
    return { valid: false, reason: 'Consentimento expirado' };
  }

  return { valid: true, consent };
}

export async function getPatientRecords(provider, patientAddress, fromBlock = 0) {
  const contract = await getContract(provider);
  const filter = contract.filters.RecordCreated(null, patientAddress);
  
  try {
    const events = await contract.queryFilter(filter, fromBlock);
    
    const records = [];
    for (const event of events) {
      const recordId = event.args.id.toString();
      try {
        const record = await contract.getRecord(recordId);
        if (!record.revoked) {
          records.push({
            id: recordId,
            cidMeta: record.cidMeta,
            metaHash: record.metaHash,
            timestamp: Number(record.timestamp),
            date: new Date(Number(record.timestamp) * 1000).toISOString()
          });
        }
      } catch (error) {
        console.warn(`Erro ao buscar registro ${recordId}:`, error);
      }
    }
    
    return records.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    return [];
  }
}

export function encodeAccessKey(accessKeyData) {
  return btoa(JSON.stringify(accessKeyData));
}

export function decodeAccessKey(encodedKey) {
  try {
    return JSON.parse(atob(encodedKey));
  } catch (error) {
    throw new Error('Chave de acesso inválida');
  }
}

export async function fetchIPFSData(cid) {
  const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
  if (!response.ok) {
    throw new Error(`Erro ao buscar dados do IPFS: ${response.statusText}`);
  }
  return await response.json();
}

export function decryptMetadata(encryptedData, keyHex) {
  return new Promise(async (resolve, reject) => {
    try {
      // Validar dados de entrada
      if (!encryptedData || !encryptedData.iv || !encryptedData.encrypted || !encryptedData.authTag) {
        throw new Error('Dados criptografados incompletos. Faltam iv, encrypted ou authTag.');
      }
      
      if (!keyHex || keyHex.length !== 64) {
        throw new Error(`Chave inválida. Esperado 64 caracteres hex, recebido ${keyHex ? keyHex.length : 0}.`);
      }
      
      const keyBuffer = hexToBuffer(keyHex);
      if (keyBuffer.length !== 32) {
        throw new Error(`Tamanho da chave inválido. Esperado 32 bytes, recebido ${keyBuffer.length}.`);
      }
      
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const iv = base64ToBuffer(encryptedData.iv);
      if (iv.length !== 12) {
        throw new Error(`Tamanho do IV inválido. Esperado 12 bytes, recebido ${iv.length}.`);
      }
      
      const encrypted = base64ToBuffer(encryptedData.encrypted);
      const authTag = base64ToBuffer(encryptedData.authTag);
      
      if (authTag.length !== 16) {
        throw new Error(`Tamanho do authTag inválido. Esperado 16 bytes, recebido ${authTag.length}.`);
      }

      const ciphertext = new Uint8Array(encrypted.length + authTag.length);
      ciphertext.set(encrypted);
      ciphertext.set(authTag, encrypted.length);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      const decoder = new TextDecoder();
      const metadataJson = decoder.decode(decrypted);
      resolve(JSON.parse(metadataJson));
    } catch (error) {
      // Melhorar mensagem de erro
      let errorMessage = error.message || 'Erro desconhecido';
      
      // Erros específicos do Web Crypto API
      if (error.name === 'OperationError') {
        errorMessage = 'Falha na descriptografia. A chave pode estar incorreta ou os dados foram corrompidos.';
      } else if (error.name === 'InvalidAccessError') {
        errorMessage = 'Acesso inválido à chave de descriptografia.';
      } else if (error.name === 'DataError') {
        errorMessage = 'Dados inválidos para descriptografia.';
      }
      
      console.error('Erro detalhado na descriptografia:', {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        keyLength: keyHex ? keyHex.length : 0,
        hasEncryptedData: !!encryptedData,
        encryptedDataKeys: encryptedData ? Object.keys(encryptedData) : []
      });
      
      reject(new Error(`Erro ao descriptografar: ${errorMessage}`));
    }
  });
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

