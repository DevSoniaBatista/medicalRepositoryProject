// ethers.js será carregado via script tag no HTML
// Usar window.ethers quando disponível

let CONTRACT_ADDRESS = null;
let CHAIN_ID = null;
let NETWORK_NAME = null;
let NETWORK_CONFIG = null;
let MASTER_KEY = null;
let ADMIN_WALLET = null;

const CONTRACT_ABI = [
  'function createRecord(address patient, string calldata cidMeta, bytes32 metaHash) external payable returns (uint256 recordId)',
  'function getRecord(uint256 recordId) external view returns (tuple(uint256 id, address owner, string cidMeta, bytes32 metaHash, uint64 timestamp, bool revoked))',
  'function grantConsent(uint256 recordId, address doctor, uint64 expiry, bytes32 nonce, bytes calldata patientSignature) external',
  'function getConsent(uint256 recordId, address doctor, bytes32 nonce) external view returns (tuple(uint256 recordId, address patient, address doctor, uint64 expiry, bytes32 nonce, bool revoked))',
  // Funções administrativas
  'function getAdminAddress() external view returns (address)',
  'function getRecordCreationFee() external view returns (uint256)',
  'function getContractBalance() external view returns (uint256)',
  'function getTotalPayments() external view returns (uint256)',
  'function getPaymentsByPayer(address payer) external view returns (uint256)',
  'function paused() external view returns (bool)',
  'function withdraw() external',
  'function pause() external',
  'function unpause() external',
  // AccessControl
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function grantRole(bytes32 role, address account) external',
  'function revokeRole(bytes32 role, address account) external',
  // Eventos
  'event RecordCreated(uint256 indexed id, address indexed owner, string cidMeta, bytes32 metaHash, uint64 timestamp)',
  'event ConsentGranted(uint256 indexed recordId, address indexed patient, address indexed doctor, uint64 expiry, bytes32 nonce)',
  'event PaymentReceived(address indexed payer, address indexed recipient, uint256 amount, uint256 indexed recordId, string paymentType, uint256 timestamp)',
  'event PaymentWithdrawn(address indexed recipient, uint256 amount, uint256 timestamp)',
  'event ConsentKeyGenerated(uint256 indexed recordId, address indexed patient, address indexed doctor, bytes32 nonce, uint64 expiry, uint256 timestamp)',
  'event AccessLogged(uint256 indexed recordId, address indexed accessor, address indexed patient, uint256 timestamp, string action)'
];

let EIP712_DOMAIN = {
  name: 'MedicalRecords',
  version: '1',
  chainId: null,
  verifyingContract: null
};

// Obter URL do backend baseado no ambiente
export function getBackendUrl() {
  // Se houver variável de ambiente definida (Vercel injeta no build)
  if (typeof window !== 'undefined' && window.ENV && window.ENV.API_URL) {
    return window.ENV.API_URL;
  }
  
  // Tentar variável de ambiente do navegador (definida via script tag)
  if (typeof window !== 'undefined' && window.__API_URL__) {
    return window.__API_URL__;
  }
  
  // Detectar ambiente baseado na URL atual
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  
  // Se estiver em localhost, usar servidor Express local
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:3000';
  }
  
  // Em produção (Vercel), usar API Routes na mesma origem
  // As serverless functions ficam em /api/* e são servidas na mesma origem
  // Retornar string vazia para usar caminho relativo
  return '';
}

// Carregar configuração do backend ou usar variáveis de ambiente
async function loadConfig() {
  // Primeiro, tentar carregar do backend (que lê do .env)
  const backendUrl = getBackendUrl();
  
  // Determinar o endpoint correto
  // Em localhost: http://127.0.0.1:3000/config
  // Em Vercel: /api/config (mesma origem)
  const configEndpoint = backendUrl ? `${backendUrl}/config` : '/api/config';
  
  try {
    console.log(`[Config] Tentando carregar configuração do backend: ${configEndpoint}`);
    const response = await fetch(configEndpoint);
    if (response.ok) {
      const config = await response.json();
      console.log('[Config] Configuração carregada do backend:', config);
      
      CONTRACT_ADDRESS = config.contractAddress;
      CHAIN_ID = BigInt(config.chainId);
      NETWORK_NAME = config.networkName;
      MASTER_KEY = config.masterKey;
      ADMIN_WALLET = config.adminWallet || null;
      
      // Construir configuração da rede para MetaMask
      const chainIdHex = '0x' + config.chainId.toString(16);
      // Usar RPC e explorer padrão baseado no chainId conhecido, ou valores do config se disponíveis
      const defaultRpc = config.rpcUrl || (config.chainId === 11155111 ? 'https://rpc.sepolia.org' : 'https://rpc.ethereum.org');
      const defaultExplorer = config.blockExplorerUrl || (config.chainId === 11155111 ? 'https://sepolia.etherscan.io' : 'https://etherscan.io');
      
      NETWORK_CONFIG = {
        chainId: chainIdHex,
        chainName: NETWORK_NAME,
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: [defaultRpc],
        blockExplorerUrls: [defaultExplorer]
      };
      
      // Atualizar EIP712_DOMAIN
      EIP712_DOMAIN.chainId = Number(config.chainId);
      EIP712_DOMAIN.verifyingContract = CONTRACT_ADDRESS;
      
      console.log('[Config] Configuração aplicada:', {
        contractAddress: CONTRACT_ADDRESS,
        chainId: CHAIN_ID.toString(),
        networkName: NETWORK_NAME,
        masterKeyConfigured: !!MASTER_KEY
      });
      
      return true;
    } else {
      console.warn(`[Config] Backend retornou status ${response.status}`);
    }
  } catch (error) {
    console.warn('[Config] Não foi possível carregar configuração do backend, tentando variáveis de ambiente:', error.message);
  }
  
  // Se falhar, tentar usar variáveis de ambiente do window (injetadas no HTML)
  if (typeof window !== 'undefined') {
    const envContract = window.__CONTRACT_ADDRESS__ || window.ENV?.CONTRACT_ADDRESS;
    const envChainId = window.__CHAIN_ID__ || window.ENV?.CHAIN_ID;
    const envNetworkName = window.__NETWORK_NAME__ || window.ENV?.NETWORK_NAME;
    
    if (envContract && envChainId) {
      console.log('[Config] Usando variáveis de ambiente do window:', { envContract, envChainId, envNetworkName });
      CONTRACT_ADDRESS = envContract;
      CHAIN_ID = BigInt(envChainId);
      NETWORK_NAME = envNetworkName || 'Sepolia';
      
      const chainIdHex = '0x' + envChainId.toString(16);
      const defaultRpc = window.__RPC_URL__ || window.ENV?.RPC_URL || (envChainId === 11155111 ? 'https://rpc.sepolia.org' : 'https://rpc.ethereum.org');
      const defaultExplorer = window.__BLOCK_EXPLORER_URL__ || window.ENV?.BLOCK_EXPLORER_URL || (envChainId === 11155111 ? 'https://sepolia.etherscan.io' : 'https://etherscan.io');
      
      NETWORK_CONFIG = {
        chainId: chainIdHex,
        chainName: NETWORK_NAME,
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: [defaultRpc],
        blockExplorerUrls: [defaultExplorer]
      };
      
      EIP712_DOMAIN.chainId = Number(envChainId);
      EIP712_DOMAIN.verifyingContract = CONTRACT_ADDRESS;
      
      return true;
    }
  }
  
  console.warn('[Config] Nenhuma configuração encontrada. Verifique se o backend está rodando e o .env está configurado.');
  return false;
}

// Função para garantir que a configuração está carregada
async function ensureConfigLoaded() {
  if (!CONTRACT_ADDRESS || !CHAIN_ID || !MASTER_KEY) {
    const loaded = await loadConfig();
    if (!loaded) {
      // NÃO usar valores padrão - FORÇAR configuração do .env
      const errorMsg = 
        'ERRO: Configuração não disponível!\n\n' +
        'Configure o arquivo .env com:\n' +
        '  NEXT_PUBLIC_CONTRACT_ADDRESS=seu_endereco_aqui\n' +
        '  NEXT_PUBLIC_CHAIN_ID=11155111\n' +
        '  NEXT_PUBLIC_NETWORK_NAME=Sepolia\n' +
        '  NEXT_PUBLIC_MASTER_KEY=chave_hex_64_caracteres\n\n' +
        'E certifique-se de que o backend está rodando (npm run api)';
      
      console.error('[Config]', errorMsg);
      throw new Error(errorMsg);
    }
  }
}

// Obter chave mestra global
export async function getMasterKey() {
  await ensureConfigLoaded();
  if (!MASTER_KEY) {
    throw new Error('Chave mestra não configurada. Configure NEXT_PUBLIC_MASTER_KEY no arquivo .env');
  }
  return MASTER_KEY;
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

  // Garantir que a configuração está carregada
  await ensureConfigLoaded();

  const ethers = window.ethers;
  const provider = new ethers.BrowserProvider(window.ethereum);
  
  // Verificar e trocar para a rede configurada se necessário
  try {
    const network = await provider.getNetwork();
    if (network.chainId !== CHAIN_ID) {
      const shouldSwitch = confirm(
        `Você está na rede ${network.name} (Chain ID: ${network.chainId}).\n` +
        `O sistema requer ${NETWORK_NAME} (Chain ID: ${CHAIN_ID}).\n` +
        `Deseja trocar para ${NETWORK_NAME} agora?`
      );
      
      if (shouldSwitch) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: NETWORK_CONFIG.chainId }]
          });
        } catch (switchError) {
          // Se a rede não existir, adicionar
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [NETWORK_CONFIG]
            });
          } else {
            throw switchError;
          }
        }
        // Aguardar um pouco para a troca completar
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw new Error(`Por favor, troque para a rede ${NETWORK_NAME} na MetaMask.`);
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
  if (finalNetwork.chainId !== CHAIN_ID) {
    throw new Error(`Rede incorreta. Esperado ${NETWORK_NAME} (${CHAIN_ID}), mas está em ${finalNetwork.name} (${finalNetwork.chainId})`);
  }

  return { provider, signer: await provider.getSigner(), address: accounts[0] };
}

// Exportar funções para obter configuração
export async function getChainId() {
  await ensureConfigLoaded();
  return CHAIN_ID;
}

export async function getContractAddress() {
  await ensureConfigLoaded();
  return CONTRACT_ADDRESS;
}

export async function getNetworkName() {
  await ensureConfigLoaded();
  return NETWORK_NAME;
}

export async function getAdminWallet() {
  await ensureConfigLoaded();
  return ADMIN_WALLET;
}

export async function isAdminWallet(address) {
  if (!address) return false;
  const adminWallet = await getAdminWallet();
  if (!adminWallet) return false;
  return address.toLowerCase() === adminWallet.toLowerCase();
}

export async function getContract(provider) {
  await ensureConfigLoaded();
  const ethers = window.ethers;
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

export async function createRecord(signer, cidMeta, metaHash) {
  await ensureConfigLoaded();
  const ethers = window.ethers;
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  const address = await signer.getAddress();
  
  // Obter a taxa de criação do contrato (OBRIGATÓRIO)
  const fee = await contract.getRecordCreationFee();
  
  // Verificar se o contrato está pausado
  const isPaused = await contract.paused();
  if (isPaused) {
    throw new Error('Contrato está pausado. Não é possível criar registros no momento.');
  }
  
  // Criar registro e enviar pagamento OBRIGATÓRIO
  const tx = await contract.createRecord(address, cidMeta, metaHash, {
    value: fee // ⚠️ PAGAMENTO OBRIGATÓRIO
  });
  
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
  await ensureConfigLoaded();
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
  await ensureConfigLoaded();
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
  
  // Verificar se o consentimento existe no contrato atual
  if (consent.patient === ethers.ZeroAddress) {
    return { valid: false, reason: 'O consentimento enviado não existe para o contrato' };
  }

  // Verificar se o recordId do consentimento corresponde ao recordId solicitado
  // Isso garante que o consentimento pertence ao contrato correto
  if (consent.recordId.toString() !== recordId.toString()) {
    return { valid: false, reason: 'O consentimento enviado não existe para o contrato' };
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

