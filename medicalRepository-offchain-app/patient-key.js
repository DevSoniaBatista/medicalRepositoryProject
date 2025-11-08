import {
  connectWallet,
  getPatientRecords,
  generateAccessKey,
  grantConsent,
  encodeAccessKey
} from './blockchain.js';

const connectButton = document.getElementById('connect-wallet');
const walletStatus = document.getElementById('wallet-status');
const walletInfo = document.getElementById('wallet-info');
const keyForm = document.getElementById('key-form');
const walletTopBar = document.getElementById('wallet-top-bar');
const walletAddressShort = document.getElementById('wallet-address-short');
const walletAddressFull = document.getElementById('wallet-address-full');
const disconnectBtnTop = document.getElementById('disconnect-wallet-top');
const loadRecordsBtn = document.getElementById('load-records');
const recordsList = document.getElementById('records-list');
const recordsContainer = document.getElementById('records-container');
const keyResult = document.getElementById('key-result');
const accessKeyOutput = document.getElementById('access-key');
const keyDetailsOutput = document.getElementById('key-details');
const expiryInfo = document.getElementById('expiry-info');
const downloadKeyBtn = document.getElementById('download-key');

let wallet = null;
let patientRecords = [];

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
    walletInfo.textContent = `Conectado: ${wallet.address}`;
    walletStatus.classList.add('hidden');
    updateWalletTopBar(wallet.address);
    keyForm.classList.remove('hidden');
    showToast('Carteira conectada!');
  } catch (error) {
    alert(`Erro ao conectar: ${error.message}`);
  }
});

loadRecordsBtn.addEventListener('click', async () => {
  if (!wallet) {
    alert('Conecte sua carteira primeiro');
    return;
  }

  try {
    showToast('Carregando registros...');
    patientRecords = await getPatientRecords(wallet.provider, wallet.address);
    
    if (patientRecords.length === 0) {
      alert('Nenhum registro encontrado para este endereço.');
      return;
    }

    renderRecords(patientRecords);
    recordsList.classList.remove('hidden');
    showToast(`${patientRecords.length} registro(s) encontrado(s)`);
  } catch (error) {
    console.error('Erro ao carregar registros:', error);
    alert(`Erro ao carregar registros: ${error.message}`);
  }
});

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
        showToast(`Consentimento registrado para registro ${record.id}`);
      } catch (error) {
        console.warn(`Erro ao registrar consentimento para ${record.id}:`, error);
      }

      accessKeys.push({
        recordId: record.id,
        ...keyData
      });
    }

    const masterKey = {
      patient: wallet.address,
      doctor: doctorAddress,
      expiry: accessKeys[0].expiry,
      expiryDate: accessKeys[0].expiryDate,
      records: accessKeys
    };

    const encodedKey = encodeAccessKey(masterKey);
    accessKeyOutput.textContent = encodedKey;
    keyDetailsOutput.textContent = JSON.stringify(masterKey, null, 2);
    expiryInfo.textContent = new Date(Number(masterKey.expiry) * 1000).toLocaleString('pt-BR');

    keyResult.classList.remove('hidden');
    showToast('Chave gerada com sucesso!');
  } catch (error) {
    console.error('Erro ao gerar chave:', error);
    alert(`Erro ao gerar chave: ${error.message}`);
  }
});

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

downloadKeyBtn.addEventListener('click', () => {
  const keyData = keyDetailsOutput.textContent;
  if (!keyData) return;

  const blob = new Blob([keyData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `access-key-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Chave baixada!');
});

function renderRecords(records) {
  recordsContainer.innerHTML = '';
  records.forEach((record) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>Registro #${record.id}</h3>
      <p><strong>Data:</strong> ${new Date(record.date).toLocaleString('pt-BR')}</p>
      <p><strong>CID:</strong> ${record.cidMeta}</p>
      <p><strong>Hash:</strong> ${record.metaHash}</p>
    `;
    recordsContainer.appendChild(card);
  });
}

function showToast(message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

