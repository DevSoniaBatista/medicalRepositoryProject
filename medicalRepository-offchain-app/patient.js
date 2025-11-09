// ethers.js será carregado via script tag no HTML
import {
  connectWallet,
  getPatientRecords,
  generateAccessKey,
  grantConsent,
  encodeAccessKey,
  createRecord,
  fetchIPFSData,
  decryptMetadata
} from './blockchain.js';

const connectButton = document.getElementById('connect-wallet');
const walletStatus = document.getElementById('wallet-status');
const walletInfo = document.getElementById('wallet-info');
const patientMenu = document.getElementById('patient-menu');
const patientAddress = document.getElementById('patient-address');
const createExamBtn = document.getElementById('create-exam');
const viewHistoryBtn = document.getElementById('view-history');
const generateKeyBtn = document.getElementById('generate-key');
const walletTopBar = document.getElementById('wallet-top-bar');
const walletAddressShort = document.getElementById('wallet-address-short');
const walletAddressFull = document.getElementById('wallet-address-full');
const disconnectBtnTop = document.getElementById('disconnect-wallet-top');
const createExamSection = document.getElementById('create-exam-section');
const historySection = document.getElementById('history-section');
const keySection = document.getElementById('key-section');
const examForm = document.getElementById('exam-form');
const keyForm = document.getElementById('key-form');
const examResults = document.getElementById('exam-results');
const keyResult = document.getElementById('key-result');
const historyContainer = document.getElementById('history-container');
const recordStatus = document.getElementById('record-status');

let wallet = null;
let patientRecords = [];
// Variável removida - chave mestra agora é global do .env

const toastTemplate = document.getElementById('toast-template');

// Navegação
document.getElementById('back-to-menu')?.addEventListener('click', (e) => {
  e.preventDefault();
  showSection('menu');
});

document.getElementById('back-to-menu-2')?.addEventListener('click', (e) => {
  e.preventDefault();
  showSection('menu');
});

document.getElementById('back-to-menu-3')?.addEventListener('click', (e) => {
  e.preventDefault();
  showSection('menu');
});

function showSection(section) {
  patientMenu.classList.add('hidden');
  createExamSection.classList.add('hidden');
  historySection.classList.add('hidden');
  keySection.classList.add('hidden');
  examResults.classList.add('hidden');
  keyResult.classList.add('hidden');

  if (section === 'menu') {
    patientMenu.classList.remove('hidden');
  } else if (section === 'create') {
    createExamSection.classList.remove('hidden');
  } else if (section === 'history') {
    historySection.classList.remove('hidden');
  } else if (section === 'key') {
    keySection.classList.remove('hidden');
  }
}

// Verificar conexão existente
async function checkExistingConnection() {
  if (typeof window.ethereum === 'undefined') {
    return false;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      const provider = new window.ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      const { getChainId } = await import('./blockchain.js');
      const expectedChainId = await getChainId();
      if (network.chainId === expectedChainId) {
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        wallet = { provider, signer, address };
        walletInfo.textContent = `Conectado: ${address}`;
        walletStatus.classList.add('hidden');
        patientAddress.textContent = `Endereço: ${address}`;
        patientMenu.classList.remove('hidden');
        updateWalletTopBar(address);
        return true;
      }
    }
  } catch (error) {
    console.warn('Erro ao verificar conexão:', error);
  }
  return false;
}

// Verificar ao carregar
window.addEventListener('load', async () => {
  if (!window.ethers) {
    await new Promise(resolve => {
      const checkEthers = setInterval(() => {
        if (window.ethers) {
          clearInterval(checkEthers);
          resolve();
        }
      }, 100);
    });
  }
  await checkExistingConnection();
});

// Conectar carteira
connectButton.addEventListener('click', async () => {
  try {
    wallet = await connectWallet();
    walletInfo.textContent = `Conectado: ${wallet.address}`;
    walletStatus.classList.add('hidden');
    patientAddress.textContent = `Endereço: ${wallet.address}`;
    patientMenu.classList.remove('hidden');
    updateWalletTopBar(wallet.address);
    showToast('Carteira conectada!');
  } catch (error) {
    alert(`Erro ao conectar: ${error.message}`);
  }
});

// Menu buttons
createExamBtn.addEventListener('click', () => {
  showSection('create');
});

viewHistoryBtn.addEventListener('click', async () => {
  if (!wallet) {
    alert('Conecte sua carteira primeiro');
    return;
  }
  showSection('history');
  await loadHistory();
});

generateKeyBtn.addEventListener('click', () => {
  showSection('key');
});

// Chave mestra agora é global do .env - não precisa mais de backup individual

// Função para desconectar
function handleDisconnect() {
  console.log('Desconectando carteira...');
  
  // Limpar localStorage (chave mestra agora é global do .env, não precisa preservar)
  const manualDisconnect = localStorage.getItem('manualDisconnect');
  localStorage.clear();
  
  // Restaurar flag de desconexão
  if (manualDisconnect) {
    localStorage.setItem('manualDisconnect', 'true');
  }
  
  window.location.href = 'index.html?disconnected=true';
}

// Configurar botão desconectar
if (disconnectBtnTop) {
  disconnectBtnTop.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDisconnect();
  });
  disconnectBtnTop.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDisconnect();
  };
}

function updateWalletTopBar(address) {
  if (!address) {
    walletTopBar.classList.add('hidden');
    return;
  }
  
  walletAddressShort.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
  walletAddressFull.textContent = address;
  walletTopBar.classList.remove('hidden');
}

// Criar exame
examForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!wallet) {
    alert('Conecte sua carteira primeiro');
    return;
  }

  try {
    showToast('Gerando metadata cifrado...');

    const formData = new FormData(event.target);
    const filesRaw = formData.get('files')?.toString() ?? '';
    const files = filesRaw
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    const metadata = {
      schema: 'medical-record-metadata@1',
      createdAt: new Date().toISOString(),
      patientHash: wallet.address,
      examType: formData.get('examType'),
      date: formData.get('examDate'),
      files,
      notesHash: formData.get('notesHash') || null
    };

    const metadataJson = JSON.stringify(metadata);
    
    // Usar chave mestra global do .env
    const { getMasterKey } = await import('./blockchain.js');
    const masterKey = await getMasterKey();
    const { payload } = await encryptMetadataWithKey(metadataJson, masterKey);

    document.getElementById('encrypted-payload').textContent = JSON.stringify(payload, null, 2);
    // Chave mestra é global do .env - não precisa exibir

    examResults.classList.remove('hidden');
    showToast('Metadata gerado! Enviando ao Pinata...');

    // Upload para Pinata
    const { getBackendUrl } = await import('./blockchain.js');
    const backendUrl = getBackendUrl();
    const uploadEndpoint = backendUrl ? `${backendUrl}/upload` : '/api/upload';
    
    const uploadResponse = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.error || 'Erro no upload');
    }

    const uploadData = await uploadResponse.json();
    const { cid, metaHash } = uploadData;

    showToast('Registrando na blockchain...');

    // Registrar na blockchain
    // metaHash já vem como hex do backend (sha3-256 = 32 bytes = 64 hex chars)
    const ethers = window.ethers;
    const metaHashBytes32 = metaHash.startsWith('0x') ? metaHash : `0x${metaHash}`;
    const recordId = await createRecord(wallet.signer, cid, metaHashBytes32);

    recordStatus.innerHTML = `
      <p class="note success"><strong>Registro criado com sucesso!</strong></p>
      <p><strong>Record ID:</strong> ${recordId}</p>
      <p><strong>CID:</strong> ${cid}</p>
      <p><strong>Meta Hash:</strong> ${metaHash}</p>
    `;

    showToast('Exame registrado na blockchain!');
  } catch (error) {
    console.error('Erro ao criar exame:', error);
    recordStatus.innerHTML = `<p class="note error">Erro: ${error.message}</p>`;
    alert(`Erro ao criar exame: ${error.message}`);
  }
});

// Gerar chave de acesso
keyForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!wallet) {
    alert('Conecte sua carteira primeiro');
    return;
  }

  const formData = new FormData(event.target);
  const doctorAddress = formData.get('doctorAddress').trim();
  const expiryDays = parseInt(formData.get('expiryDays'), 10);
  const recordId = formData.get('recordId')?.trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(doctorAddress)) {
    alert('Endereço do médico inválido');
    return;
  }

  try {
    showToast('Gerando chave de acesso...');

    let recordsToShare = [];
    if (recordId) {
      recordsToShare = [{ id: recordId }];
    } else {
      if (patientRecords.length === 0) {
        patientRecords = await getPatientRecords(wallet.provider, wallet.address);
      }
      recordsToShare = patientRecords;
    }

    if (recordsToShare.length === 0) {
      alert('Nenhum registro encontrado para compartilhar');
      return;
    }

    const accessKeys = [];
    for (const record of recordsToShare) {
      const keyData = await generateAccessKey(
        wallet.signer,
        record.id,
        doctorAddress,
        expiryDays
      );

      try {
        await grantConsent(
          wallet.signer,
          keyData.recordId,
          keyData.doctor,
          keyData.expiry,
          keyData.nonce,
          keyData.signature
        );
      } catch (error) {
        console.warn(`Erro ao registrar consentimento:`, error);
      }

      accessKeys.push({
        recordId: record.id,
        ...keyData
      });
    }

    // Chave mestra é global e vem do .env - médico busca do backend
    const masterKey = {
      patient: wallet.address,
      doctor: doctorAddress,
      expiry: accessKeys[0].expiry,
      expiryDate: accessKeys[0].expiryDate,
      records: accessKeys
      // Não incluir decryptionKey - médico busca do backend via /config
    };

    const encodedKey = encodeAccessKey(masterKey);
    document.getElementById('access-key').textContent = encodedKey;
    document.getElementById('key-details').textContent = JSON.stringify(masterKey, null, 2);
    document.getElementById('expiry-info').textContent = new Date(Number(masterKey.expiry) * 1000).toLocaleString('pt-BR');

    keyResult.classList.remove('hidden');
    showToast('Chave gerada com sucesso!');
  } catch (error) {
    console.error('Erro ao gerar chave:', error);
    alert(`Erro ao gerar chave: ${error.message}`);
  }
});

// Carregar histórico
async function loadHistory() {
  if (!wallet) return;

  try {
    showToast('Carregando histórico...');
    patientRecords = await getPatientRecords(wallet.provider, wallet.address);

    if (patientRecords.length === 0) {
      historyContainer.innerHTML = '<div class="card"><p class="note">Nenhum registro encontrado.</p></div>';
      return;
    }

    await renderHistory(patientRecords);
    showToast(`${patientRecords.length} registro(s) encontrado(s)`);
  } catch (error) {
    console.error('Erro ao carregar histórico:', error);
    historyContainer.innerHTML = `<div class="card"><p class="note error">Erro: ${error.message}</p></div>`;
  }
}

async function renderHistory(records) {
  historyContainer.innerHTML = '<p class="note">Carregando registros e arquivos...</p>';
  
  // Obter chave mestra global do .env
  const { getMasterKey } = await import('./blockchain.js');
  let masterKey;
  try {
    masterKey = await getMasterKey();
    console.log('[Master Key] Chave mestra global obtida do backend');
  } catch (error) {
    historyContainer.innerHTML = `<div class="card"><p class="note error">Erro: ${error.message}</p></div>`;
    return;
  }
  
  // Processar cada registro
  for (const record of records) {
    try {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>Registro #${record.id}</h3>
        <p><strong>Data do Registro:</strong> ${new Date(record.date).toLocaleString('pt-BR')}</p>
        <p><strong>CID:</strong> <code style="font-size: 0.85rem;">${record.cidMeta}</code></p>
        <p><strong>Hash:</strong> <code style="font-size: 0.85rem;">${record.metaHash}</code></p>
        <div class="record-content" style="margin-top: 16px;">
          <p class="note">Carregando conteúdo...</p>
        </div>
      `;
      historyContainer.appendChild(card);
      
      // Buscar e descriptografar metadados
      try {
        console.log(`Buscando dados do IPFS para registro ${record.id}, CID: ${record.cidMeta}`);
        const encryptedData = await fetchIPFSData(record.cidMeta);
        console.log(`Dados do IPFS recebidos para registro ${record.id}:`, encryptedData);
        
        console.log(`Descriptografando registro ${record.id} com chave mestre...`);
        const metadata = await decryptMetadata(encryptedData, masterKey);
        console.log(`Metadata descriptografado para registro ${record.id}:`, metadata);
        
        const createdAt = metadata.createdAt ? new Date(metadata.createdAt).toLocaleString('pt-BR') : 'N/A';
        const examDate = metadata.date ? new Date(metadata.date).toLocaleDateString('pt-BR') : 'N/A';
        
        // Buscar e exibir arquivos do IPFS
        let filesSection = '<p class="note">Carregando arquivos...</p>';
        try {
          filesSection = await createFilesSection(metadata.files || []);
        } catch (fileError) {
          console.error(`Erro ao processar arquivos do registro ${record.id}:`, fileError);
          filesSection = `
            <div style="margin-top: 16px;">
              <p><strong>📎 Arquivos do Exame:</strong></p>
              <p class="note error">Erro ao carregar arquivos: ${fileError.message}</p>
              ${(metadata.files || []).length > 0 ? `
                <p class="note">CIDs dos arquivos:</p>
                <ul style="margin-left: 20px;">
                  ${(metadata.files || []).map(file => `<li><code style="font-size: 0.8rem;">${file}</code></li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `;
        }
        
        // Atualizar card com dados descriptografados
        const contentDiv = card.querySelector('.record-content');
        contentDiv.innerHTML = `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(148, 163, 255, 0.2);">
            <p><strong>Tipo de Exame:</strong> ${metadata.examType || 'N/A'}</p>
            <p><strong>Data do Exame:</strong> ${examDate}</p>
            <p><strong>Paciente:</strong> <code style="font-size: 0.85rem;">${metadata.patientHash || wallet.address}</code></p>
            <p><strong>Criado em:</strong> ${createdAt}</p>
            ${metadata.notesHash ? `<p><strong>Notes Hash:</strong> <code style="font-size: 0.85rem;">${metadata.notesHash}</code></p>` : ''}
          </div>
          ${filesSection}
          <details style="margin-top: 16px;">
            <summary style="cursor: pointer; color: var(--accent); font-size: 0.9rem;">📋 Ver metadata completo (JSON)</summary>
            <pre style="margin-top: 8px; padding: 12px; background: rgba(0, 0, 0, 0.3); border-radius: 8px; overflow-x: auto; font-size: 0.8rem;">${JSON.stringify(metadata, null, 2)}</pre>
          </details>
        `;
      } catch (error) {
        console.error(`Erro ao processar registro ${record.id}:`, error);
        const contentDiv = card.querySelector('.record-content');
        let errorMessage = error.message || 'Erro desconhecido';
        
        // Mensagem mais amigável para erros de descriptografia
        if (errorMessage.includes('descriptografar') || errorMessage.includes('decrypt') || errorMessage.includes('chave')) {
          errorMessage = '⚠️ Este registro foi criado com uma chave diferente da chave mestre atual. Registros criados antes da implementação da chave mestre não podem ser descriptografados automaticamente.';
        } else if (errorMessage.includes('IPFS') || errorMessage.includes('fetch')) {
          errorMessage = 'Erro ao buscar dados do IPFS. Verifique se o CID está correto.';
        }
        
        contentDiv.innerHTML = `
          <div style="margin-top: 12px; padding: 12px; background: rgba(248, 113, 113, 0.1); border-radius: 8px; border: 1px solid rgba(248, 113, 113, 0.3);">
            <p class="note error" style="margin-bottom: 8px;">
              <strong>⚠️ Erro ao carregar conteúdo:</strong>
            </p>
            <p class="note" style="margin-bottom: 12px;">
              ${errorMessage}
            </p>
            <p class="note" style="font-size: 0.85rem; margin-top: 8px;">
              <strong>Informação:</strong> Este registro pode ter sido criado antes da implementação da chave mestre única. 
              Apenas registros criados após a atualização podem ser descriptografados automaticamente.
            </p>
            <details style="margin-top: 12px;">
              <summary style="cursor: pointer; color: var(--accent); font-size: 0.85rem;">Ver detalhes técnicos</summary>
              <pre style="margin-top: 8px; padding: 8px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; overflow-x: auto; font-size: 0.75rem;">${error.stack || error.toString()}</pre>
            </details>
          </div>
        `;
      }
    } catch (error) {
      console.error(`Erro ao criar card para registro ${record.id}:`, error);
      const errorCard = document.createElement('div');
      errorCard.className = 'card';
      errorCard.style.border = '2px solid rgba(248, 113, 113, 0.5)';
      errorCard.innerHTML = `
        <h3>Registro #${record.id}</h3>
        <p class="note error">Erro ao processar registro: ${error.message}</p>
        <p><strong>CID:</strong> <code style="font-size: 0.85rem;">${record.cidMeta}</code></p>
      `;
      historyContainer.appendChild(errorCard);
    }
  }
  
  if (historyContainer.querySelectorAll('.card').length === 0) {
    historyContainer.innerHTML = '<div class="card"><p class="note">Nenhum registro encontrado.</p></div>';
  }
}

// Chave mestra agora é global do .env - funções removidas

// Funções de criptografia (do script.js)
async function encryptMetadata(metadataJson) {
  const encoder = new TextEncoder();
  const metadataBytes = encoder.encode(metadataJson);

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );

  const keyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  const keyHex = bufferToHex(keyRaw);

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    metadataBytes
  );

  const cipherWithTag = new Uint8Array(encryptedBuffer);
  const authTagLength = 16;
  const tag = cipherWithTag.slice(cipherWithTag.length - authTagLength);
  const cipher = cipherWithTag.slice(0, cipherWithTag.length - authTagLength);

  const payload = {
    schema: 'medical-record-payload@1',
    timestamp: Math.floor(Date.now() / 1000),
    iv: bufferToBase64(iv),
    encrypted: bufferToBase64(cipher),
    authTag: bufferToBase64(tag)
  };

  return { payload, keyHex };
}

// Criptografar com chave específica (para usar a chave mestre)
async function encryptMetadataWithKey(metadataJson, keyHex) {
  const encoder = new TextEncoder();
  const metadataBytes = encoder.encode(metadataJson);

  const keyBuffer = hexToBuffer(keyHex);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    metadataBytes
  );

  const cipherWithTag = new Uint8Array(encryptedBuffer);
  const authTagLength = 16;
  const tag = cipherWithTag.slice(cipherWithTag.length - authTagLength);
  const cipher = cipherWithTag.slice(0, cipherWithTag.length - authTagLength);

  const payload = {
    schema: 'medical-record-payload@1',
    timestamp: Math.floor(Date.now() / 1000),
    iv: bufferToBase64(iv),
    encrypted: bufferToBase64(cipher),
    authTag: bufferToBase64(tag)
  };

  return { payload };
}

function hexToBuffer(hex) {
  const hexString = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return bytes;
}

function bufferToHex(buffer) {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bufferToBase64(buffer) {
  const binary = String.fromCharCode(...buffer);
  return btoa(binary);
}

// Copy buttons
document.querySelectorAll('button[data-copy]').forEach((button) => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.copy;
    const text = document.getElementById(targetId)?.textContent ?? '';
    if (text.trim().length === 0) return;
    navigator.clipboard
      .writeText(text)
      .then(() => showToast('Copiado!'))
      .catch(() => alert('Não foi possível copiar.'));
  });
});

function showToast(message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

// Criar seção de visualização de arquivos
async function createFilesSection(files) {
  if (!files || files.length === 0) {
    return '<p class="note">Nenhum arquivo associado a este exame.</p>';
  }

  let filesHTML = `
    <div style="margin-top: 16px;">
      <p><strong>📎 Arquivos do Exame (${files.length}):</strong></p>
      <div style="display: grid; gap: 16px; margin-top: 12px;">
  `;

  for (const fileCid of files) {
    try {
      const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${fileCid}`;
      
      // Tentar determinar o tipo de arquivo pela URL ou buscar headers
      let fileType;
      try {
        fileType = await detectFileType(ipfsUrl);
      } catch (detectError) {
        // Se detectar que é metadata, lançar erro específico
        if (detectError.message && detectError.message.includes('metadata criptografado')) {
          throw detectError;
        }
        // Se outro erro na detecção, tentar continuar
        console.warn(`Erro ao detectar tipo do arquivo ${fileCid}:`, detectError);
        fileType = 'application/octet-stream'; // Tipo genérico
      }
      
      // Verificar se o arquivo é realmente uma imagem/PDF ou se é metadata
      if (fileType.startsWith('image/')) {
        // Exibir imagem
        filesHTML += `
          <div class="card" style="padding: 12px;">
            <p style="margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);">
              <strong>CID:</strong> <code style="font-size: 0.8rem;">${fileCid}</code>
            </p>
            <div style="text-align: center; margin-top: 12px;">
              <img 
                src="${ipfsUrl}" 
                alt="Arquivo do exame" 
                style="max-width: 100%; max-height: 500px; border-radius: 8px; border: 1px solid rgba(148, 163, 255, 0.3);"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
              />
              <div style="display: none; padding: 20px; background: rgba(248, 113, 113, 0.1); border-radius: 8px; color: #fca5a5;">
                <p>Erro ao carregar imagem</p>
                <a href="${ipfsUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--accent); text-decoration: underline; margin-top: 8px; display: inline-block;">
                  Abrir em nova aba
                </a>
              </div>
            </div>
            <div style="margin-top: 12px; text-align: center;">
              <a href="${ipfsUrl}" target="_blank" rel="noopener noreferrer" 
                 style="color: var(--accent); text-decoration: underline; font-size: 0.85rem;">
                🔗 Abrir imagem em tamanho real
              </a>
            </div>
          </div>
        `;
      } else if (fileType === 'application/pdf') {
        // Exibir PDF
        filesHTML += `
          <div class="card" style="padding: 12px;">
            <p style="margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);">
              <strong>CID:</strong> <code style="font-size: 0.8rem;">${fileCid}</code>
            </p>
            <div style="text-align: center; margin-top: 12px;">
              <iframe 
                src="${ipfsUrl}" 
                style="width: 100%; min-height: 600px; border-radius: 8px; border: 1px solid rgba(148, 163, 255, 0.3);"
                title="Visualizador de PDF"
              ></iframe>
            </div>
            <div style="margin-top: 12px; text-align: center;">
              <a href="${ipfsUrl}" target="_blank" rel="noopener noreferrer" 
                 style="color: var(--accent); text-decoration: underline; font-size: 0.85rem;">
                📄 Abrir PDF em nova aba
              </a>
            </div>
          </div>
        `;
      } else {
        // Arquivo genérico - mostrar link de download
        filesHTML += `
          <div class="card" style="padding: 12px;">
            <p style="margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);">
              <strong>CID:</strong> <code style="font-size: 0.8rem;">${fileCid}</code>
            </p>
            <p style="margin-top: 8px; font-size: 0.85rem; color: var(--text-muted);">
              Tipo: ${fileType || 'Desconhecido'}
            </p>
            <div style="margin-top: 12px; text-align: center;">
              <a href="${ipfsUrl}" target="_blank" rel="noopener noreferrer" 
                 style="color: var(--accent); text-decoration: underline; font-size: 0.85rem;">
                📥 Baixar arquivo
              </a>
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error(`Erro ao processar arquivo ${fileCid}:`, error);
      
      let errorMessage = error.message || 'Erro desconhecido';
      let isMetadataError = errorMessage.includes('metadata criptografado');
      
      filesHTML += `
        <div class="card" style="padding: 12px; border: 2px solid rgba(248, 113, 113, 0.5);">
          <p class="note error" style="font-weight: 600;">
            ${isMetadataError ? '⚠️ CID inválido' : 'Erro ao carregar arquivo'}
          </p>
          <p class="note" style="margin-top: 8px;">
            ${isMetadataError 
              ? 'Este CID aponta para o metadata criptografado do exame, não para o arquivo real (imagem/PDF). O CID do arquivo deve ser obtido na página de upload de arquivos.'
              : `CID: ${fileCid}`}
          </p>
          ${!isMetadataError ? `
            <a href="https://gateway.pinata.cloud/ipfs/${fileCid}" target="_blank" rel="noopener noreferrer" 
               style="color: var(--accent); text-decoration: underline; font-size: 0.85rem; margin-top: 8px; display: inline-block;">
              Tentar abrir diretamente
            </a>
          ` : ''}
        </div>
      `;
    }
  }

  filesHTML += `
      </div>
    </div>
  `;

  return filesHTML;
}

// Detectar tipo de arquivo
async function detectFileType(url) {
  try {
    // Tentar buscar apenas o header para detectar o tipo
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    
    // Verificar se é JSON (metadata criptografado)
    if (contentType && contentType.includes('application/json')) {
      // Tentar buscar o conteúdo para verificar se é metadata
      const contentResponse = await fetch(url);
      const content = await contentResponse.text();
      try {
        const json = JSON.parse(content);
        // Se tem schema, iv, encrypted, authTag - é metadata criptografado
        if (json.schema && json.iv && json.encrypted && json.authTag) {
          throw new Error('Este CID aponta para metadata criptografado, não para o arquivo real. Verifique se o CID do arquivo está correto.');
        }
      } catch (e) {
        if (e.message.includes('metadata criptografado')) {
          throw e;
        }
      }
    }
    
    if (contentType && !contentType.includes('application/json')) {
      return contentType;
    }
  } catch (error) {
    if (error.message && error.message.includes('metadata criptografado')) {
      throw error;
    }
    console.warn('Erro ao detectar tipo de arquivo:', error);
  }
  
  // Tentar buscar uma pequena parte do arquivo para detectar o tipo
  try {
    const response = await fetch(url, { 
      method: 'GET',
      headers: { 'Range': 'bytes=0-1023' } // Primeiros 1KB
    });
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
      return contentType;
    }
    
    // Verificar magic bytes para imagens
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Magic bytes para diferentes tipos
    if (uint8Array.length >= 4) {
      // JPEG: FF D8 FF
      if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) {
        return 'image/jpeg';
      }
      // PNG: 89 50 4E 47
      if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
        return 'image/png';
      }
      // PDF: %PDF
      if (uint8Array[0] === 0x25 && uint8Array[1] === 0x50 && uint8Array[2] === 0x44 && uint8Array[3] === 0x46) {
        return 'application/pdf';
      }
      // GIF: GIF8
      if (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x38) {
        return 'image/gif';
      }
    }
  } catch (error) {
    console.warn('Erro ao detectar tipo por magic bytes:', error);
  }
  
  // Fallback: assumir imagem
  return 'image/jpeg';
}

