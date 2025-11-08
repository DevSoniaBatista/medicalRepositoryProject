import {
  connectWallet,
  decodeAccessKey,
  verifyConsent,
  getRecord,
  fetchIPFSData,
  decryptMetadata
} from './blockchain.js';

const connectButton = document.getElementById('connect-wallet');
const walletStatus = document.getElementById('wallet-status');
const walletInfo = document.getElementById('wallet-info');
const accessForm = document.getElementById('access-form');
const walletTopBar = document.getElementById('wallet-top-bar');
const walletAddressShort = document.getElementById('wallet-address-short');
const walletAddressFull = document.getElementById('wallet-address-full');
const disconnectBtnTop = document.getElementById('disconnect-wallet-top');
const accessResult = document.getElementById('access-result');
const statusMessage = document.getElementById('status-message');
const recordsContainer = document.getElementById('records-container');

let wallet = null;

const toastTemplate = document.getElementById('toast-template');

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
      if (network.chainId === 11155111n) {
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        wallet = { provider, signer, address };
        walletInfo.textContent = `Conectado: ${address}`;
        walletStatus.classList.add('hidden');
        accessForm.classList.remove('hidden');
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

// Função para desconectar
function handleDisconnect() {
  console.log('Desconectando carteira...');
  localStorage.clear();
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

connectButton.addEventListener('click', async () => {
  try {
    wallet = await connectWallet();
    const address = wallet.address;
    walletInfo.textContent = `Conectado: ${address}`;
    walletStatus.classList.add('hidden');
    accessForm.classList.remove('hidden');
    updateWalletTopBar(address);
    showToast('Carteira conectada!');
  } catch (error) {
    alert(`Erro ao conectar: ${error.message}`);
  }
});

accessForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!wallet) {
    alert('Conecte sua carteira primeiro');
    return;
  }

  const formData = new FormData(event.target);
  const accessKeyEncoded = formData.get('accessKey').trim();

  if (!accessKeyEncoded) {
    alert('Preencha a chave de acesso');
    return;
  }

  try {
    showToast('Verificando chave de acesso...');

    const accessKey = decodeAccessKey(accessKeyEncoded);
    const doctorAddress = wallet.address.toLowerCase();

    if (accessKey.doctor.toLowerCase() !== doctorAddress) {
      alert('Esta chave não foi gerada para o seu endereço de carteira');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    if (Number(accessKey.expiry) < now) {
      alert('Esta chave de acesso expirou');
      return;
    }

    // Obter chave mestre de descriptografia da chave de acesso
    const masterDecryptionKey = accessKey.decryptionKey;
    if (!masterDecryptionKey) {
      alert('Chave de acesso inválida: chave de descriptografia não encontrada');
      return;
    }

    statusMessage.innerHTML = `
      <h3>Status de Acesso</h3>
      <p><strong>Paciente:</strong> ${accessKey.patient}</p>
      <p><strong>Válido até:</strong> ${new Date(Number(accessKey.expiry) * 1000).toLocaleString('pt-BR')}</p>
      <p><strong>Registros disponíveis:</strong> ${accessKey.records.length}</p>
    `;

    recordsContainer.innerHTML = '';
    let loadedCount = 0;
    const totalRecords = accessKey.records.length;
    
    console.log(`Processando ${totalRecords} registro(s)...`);

    for (let i = 0; i < accessKey.records.length; i++) {
      const recordKey = accessKey.records[i];
      try {
        console.log(`Processando registro ${i + 1}/${totalRecords}: ${recordKey.recordId}`);
        showToast(`Processando registro ${i + 1}/${totalRecords}: #${recordKey.recordId}...`);

        const consentCheck = await verifyConsent(
          wallet.provider,
          recordKey.recordId,
          recordKey.doctor,
          recordKey.nonce
        );

        if (!consentCheck.valid) {
          const card = document.createElement('div');
          card.className = 'card';
          card.innerHTML = `
            <h3>Registro #${recordKey.recordId}</h3>
            <p class="note error">${consentCheck.reason}</p>
          `;
          recordsContainer.appendChild(card);
          continue;
        }

        const record = await getRecord(wallet.provider, recordKey.recordId);
        if (record.revoked) {
          const card = document.createElement('div');
          card.className = 'card';
          card.innerHTML = `
            <h3>Registro #${recordKey.recordId}</h3>
            <p class="note error">Registro revogado pelo paciente</p>
          `;
          recordsContainer.appendChild(card);
          continue;
        }

        showToast(`Carregando dados do IPFS para registro ${recordKey.recordId}...`);
        const encryptedData = await fetchIPFSData(record.cidMeta);

        showToast(`Descriptografando registro ${recordKey.recordId}...`);
        const metadata = await decryptMetadata(encryptedData, masterDecryptionKey);

        const card = document.createElement('div');
        card.className = 'card';
        
        // Formatar data
        const examDate = metadata.date ? new Date(metadata.date).toLocaleDateString('pt-BR') : 'N/A';
        const createdAt = metadata.createdAt ? new Date(metadata.createdAt).toLocaleString('pt-BR') : 'N/A';
        
        // Buscar e exibir arquivos do IPFS (com tratamento de erro)
        let filesSection = '<p class="note">Carregando arquivos...</p>';
        try {
          filesSection = await createFilesSection(metadata.files || []);
        } catch (fileError) {
          console.error(`Erro ao processar arquivos do registro ${recordKey.recordId}:`, fileError);
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
        
        card.innerHTML = `
          <h3>Registro #${recordKey.recordId}</h3>
          <div style="margin-top: 16px;">
            <p><strong>📅 Data do Exame:</strong> ${examDate}</p>
            <p><strong>🏥 Tipo de Exame:</strong> ${metadata.examType || 'N/A'}</p>
            <p><strong>👤 Paciente:</strong> <code style="font-size: 0.85rem; color: var(--accent);">${metadata.patientHash || 'N/A'}</code></p>
            <p><strong>🕐 Criado em:</strong> ${createdAt}</p>
          </div>
          ${filesSection}
          ${metadata.notesHash ? `
            <div style="margin-top: 16px;">
              <p><strong>📝 Hash das Anotações:</strong> <code style="font-size: 0.85rem; color: var(--accent);">${metadata.notesHash}</code></p>
            </div>
          ` : ''}
          <details style="margin-top: 16px; cursor: pointer;">
            <summary style="color: var(--accent); font-weight: 600; user-select: none;">📋 Ver Dados Completos (JSON)</summary>
            <pre style="margin-top: 12px; padding: 12px; background: rgba(2, 6, 23, 0.88); border-radius: 8px; overflow-x: auto; font-size: 0.85rem;">${JSON.stringify(metadata, null, 2)}</pre>
          </details>
        `;
        recordsContainer.appendChild(card);
        loadedCount++;
      } catch (error) {
        console.error(`Erro ao processar registro ${recordKey.recordId}:`, error);
        const card = document.createElement('div');
        card.className = 'card';
        card.style.border = '2px solid rgba(248, 113, 113, 0.5)';
        card.innerHTML = `
          <h3>Registro #${recordKey.recordId}</h3>
          <p class="note error" style="font-weight: 600;">Erro ao carregar registro</p>
          <p class="note" style="margin-top: 8px;">${error.message}</p>
          <details style="margin-top: 12px;">
            <summary style="color: var(--accent); cursor: pointer; font-size: 0.85rem;">Ver detalhes do erro</summary>
            <pre style="margin-top: 8px; padding: 8px; background: rgba(2, 6, 23, 0.88); border-radius: 4px; font-size: 0.75rem; overflow-x: auto;">${error.stack || error.toString()}</pre>
          </details>
        `;
        recordsContainer.appendChild(card);
        // Continuar processando outros registros mesmo se este falhar
      }
    }

    accessResult.classList.remove('hidden');
    
    const successCount = loadedCount;
    const errorCount = totalRecords - successCount;
    
    if (errorCount > 0) {
      showToast(`${successCount} registro(s) carregado(s), ${errorCount} com erro(s)`);
    } else {
      showToast(`${successCount} registro(s) carregado(s) com sucesso!`);
    }
  } catch (error) {
    console.error('Erro ao processar chave:', error);
    alert(`Erro ao processar chave de acesso: ${error.message}`);
  }
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
    if (error.message.includes('metadata criptografado')) {
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

