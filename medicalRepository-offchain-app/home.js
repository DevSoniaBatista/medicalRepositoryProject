import { connectWallet, getContractAddress, getNetworkName, getChainId } from './blockchain.js';

const connectButton = document.getElementById('connect-wallet');
const walletSection = document.getElementById('wallet-section');
const walletInfo = document.getElementById('wallet-info');
const mainMenu = document.getElementById('main-menu');
const connectedAddress = document.getElementById('connected-address');
const patientAccessBtn = document.getElementById('patient-access');
const doctorAccessBtn = document.getElementById('doctor-access');
const walletTopBar = document.getElementById('wallet-top-bar');
const walletAddressShort = document.getElementById('wallet-address-short');
const walletAddressFull = document.getElementById('wallet-address-full');
const disconnectBtnTop = document.getElementById('disconnect-wallet-top');
const contractAddressEl = document.getElementById('contract-address');
const networkNameEl = document.getElementById('network-name');
const chainIdEl = document.getElementById('chain-id');

// Verificar se elementos foram encontrados
if (!disconnectBtnTop) {
  console.error('Botão desconectar não encontrado!');
}

const toastTemplate = document.getElementById('toast-template');

// Verificar se já está conectado
async function checkExistingConnection() {
  // Verificar se houve desconexão manual
  if (localStorage.getItem('manualDisconnect') === 'true') {
    console.log('Desconexão manual detectada, não reconectando automaticamente');
    return false;
  }
  
  if (typeof window.ethereum === 'undefined') {
    return false;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      // Verificar se ainda está autorizado
      const provider = new window.ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      // Verificar rede
      const network = await provider.getNetwork();
      const { getChainId } = await import('./blockchain.js');
      const expectedChainId = await getChainId();
      if (network.chainId === expectedChainId) {
        // Já conectado e na rede correta
        walletInfo.textContent = `Conectado: ${address}`;
        walletInfo.classList.remove('hidden');
        connectedAddress.textContent = `Endereço: ${address}`;
        mainMenu.classList.remove('hidden');
        walletSection.classList.add('hidden');
        connectButton.disabled = true;
        connectButton.textContent = 'Conectado';
        updateWalletTopBar(address);
        localStorage.setItem('walletAddress', address);
        return true;
      }
    }
  } catch (error) {
    console.warn('Erro ao verificar conexão existente:', error);
  }
  return false;
}

// Função para desconectar
function handleDisconnect() {
  console.log('Desconectando carteira...');
  
  // Chave mestra agora é global do .env, não precisa preservar
  // Adicionar flag de desconexão manual antes de limpar
  localStorage.setItem('manualDisconnect', 'true');
  
  // Limpar todo o localStorage
  const manualDisconnect = localStorage.getItem('manualDisconnect');
  localStorage.clear();
  
  // Restaurar flag de desconexão
  if (manualDisconnect) {
    localStorage.setItem('manualDisconnect', 'true');
  }
  
  // Adicionar flag de desconexão na URL para evitar reconexão automática
  window.location.href = 'index.html?disconnected=true';
}

// Configurar botão desconectar
function setupDisconnectButton() {
  const btn = document.getElementById('disconnect-wallet-top');
  if (!btn) {
    console.warn('Botão desconectar não encontrado, tentando novamente...');
    setTimeout(setupDisconnectButton, 100);
    return;
  }
  
  // Remover listeners anteriores
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  
  // Adicionar novo listener
  newBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDisconnect();
  });
  
  // Também usar onclick como fallback
  newBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDisconnect();
  };
  
  console.log('Botão desconectar configurado');
}

// Carregar e exibir informações do contrato
async function loadContractInfo() {
  try {
    const contractAddress = await getContractAddress();
    const networkName = await getNetworkName();
    const chainId = await getChainId();
    
    if (contractAddressEl) {
      contractAddressEl.textContent = contractAddress;
      contractAddressEl.style.cursor = 'pointer';
      contractAddressEl.title = 'Clique para copiar';
      contractAddressEl.addEventListener('click', () => {
        navigator.clipboard.writeText(contractAddress);
        showToast('Endereço do contrato copiado!');
      });
    }
    
    if (networkNameEl) {
      networkNameEl.textContent = networkName || '-';
    }
    
    if (chainIdEl) {
      chainIdEl.textContent = chainId.toString();
    }
  } catch (error) {
    console.error('Erro ao carregar informações do contrato:', error);
    if (contractAddressEl) {
      contractAddressEl.textContent = 'Erro ao carregar';
      contractAddressEl.style.color = 'var(--error, #ff4444)';
    }
  }
}

// Verificar conexão ao carregar
window.addEventListener('load', async () => {
  // Carregar informações do contrato primeiro
  await loadContractInfo();
  
  // Configurar botão desconectar
  setupDisconnectButton();
  
  // Verificar se foi desconectado (via URL parameter ou localStorage)
  const urlParams = new URLSearchParams(window.location.search);
  const wasDisconnected = urlParams.get('disconnected') === 'true' || 
                          localStorage.getItem('manualDisconnect') === 'true';
  
  // Se foi desconectado, limpar URL e não verificar conexão
  if (wasDisconnected) {
    window.history.replaceState({}, document.title, 'index.html');
    // Manter a flag de desconexão manual no localStorage
    localStorage.setItem('manualDisconnect', 'true');
    // Limpar estado visual
    mainMenu.classList.add('hidden');
    walletSection.classList.remove('hidden');
    walletInfo.classList.add('hidden');
    if (walletTopBar) walletTopBar.classList.add('hidden');
    if (connectButton) {
      connectButton.disabled = false;
      connectButton.textContent = 'Conectar MetaMask';
    }
    return; // Não verificar conexão existente
  }
  
  // Limpar estado visual ao carregar (garantir estado limpo)
  mainMenu.classList.add('hidden');
  walletSection.classList.remove('hidden');
  walletInfo.classList.add('hidden');
  if (walletTopBar) walletTopBar.classList.add('hidden');
  if (connectButton) {
    connectButton.disabled = false;
    connectButton.textContent = 'Conectar MetaMask';
  }
  
  // Aguardar ethers.js carregar
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
  
  // Verificar se há conexão existente (só se não foi desconectado)
  const isConnected = await checkExistingConnection();
  if (!isConnected) {
    walletSection.classList.remove('hidden');
  }
});

connectButton.addEventListener('click', async () => {
  try {
    // Remover flag de desconexão manual ao conectar novamente
    localStorage.removeItem('manualDisconnect');
    
    const wallet = await connectWallet();
    walletInfo.textContent = `Conectado: ${wallet.address}`;
    walletInfo.classList.remove('hidden');
    connectedAddress.textContent = `Endereço: ${wallet.address}`;
    mainMenu.classList.remove('hidden');
    walletSection.classList.add('hidden');
    connectButton.disabled = true;
    connectButton.textContent = 'Conectado';
    updateWalletTopBar(wallet.address);
    showToast('Carteira conectada!');
    
    localStorage.setItem('walletAddress', wallet.address);
  } catch (error) {
    alert(`Erro ao conectar: ${error.message}`);
  }
});

patientAccessBtn.addEventListener('click', () => {
  window.location.href = 'patient.html';
});

doctorAccessBtn.addEventListener('click', () => {
  window.location.href = 'doctor-access.html';
});

// Botão desconectar será configurado em setupDisconnectButton()

function updateWalletTopBar(address) {
  if (!address) {
    walletTopBar.classList.add('hidden');
    return;
  }
  
  walletAddressShort.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
  walletAddressFull.textContent = address;
  walletTopBar.classList.remove('hidden');
}

function showToast(message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

