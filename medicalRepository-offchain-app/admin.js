import { connectWallet, isAdminWallet, getContractAddress, getContract } from './blockchain.js';

const connectButton = document.getElementById('connect-wallet');
const walletSection = document.getElementById('wallet-section');
const walletInfo = document.getElementById('wallet-info');
const adminPanel = document.getElementById('admin-panel');
const walletTopBar = document.getElementById('wallet-top-bar');
const walletAddressShort = document.getElementById('wallet-address-short');
const walletAddressFull = document.getElementById('wallet-address-full');
const disconnectBtnTop = document.getElementById('disconnect-wallet-top');
const contractStatus = document.getElementById('contract-status');
const paymentInfo = document.getElementById('payment-info');
const withdrawBtn = document.getElementById('withdraw-funds');
const pauseBtn = document.getElementById('pause-contract');
const unpauseBtn = document.getElementById('unpause-contract');
const refreshBtn = document.getElementById('refresh-data');
const eventsContainer = document.getElementById('events-container');

let wallet = null;
let contract = null;

const toastTemplate = document.getElementById('toast-template');

// Constantes para roles
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
const UPGRADER_ROLE = null; // Será calculado quando necessário

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
        
        // Verificar se é admin
        const isAdmin = await isAdminWallet(address);
        if (!isAdmin) {
          alert('Esta carteira não é uma carteira de administrador');
          return false;
        }
        
        wallet = { provider, signer, address };
        contract = await getContract(wallet.signer);
        walletInfo.textContent = `Conectado: ${address}`;
        walletInfo.classList.remove('hidden');
        walletSection.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        updateWalletTopBar(address);
        await loadAdminData();
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
    
    // Verificar se é admin
    const isAdmin = await isAdminWallet(address);
    if (!isAdmin) {
      alert('Esta carteira não é uma carteira de administrador');
      return;
    }
    
    contract = await getContract(wallet.signer);
    walletInfo.textContent = `Conectado: ${address}`;
    walletInfo.classList.remove('hidden');
    walletSection.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    updateWalletTopBar(address);
    showToast('Carteira admin conectada!');
    
    await loadAdminData();
  } catch (error) {
    alert(`Erro ao conectar: ${error.message}`);
  }
});

// Função para obter status administrativo completo
async function getAdminStatus() {
  if (!contract || !wallet) return null;
  
  const ethers = window.ethers;
  const callerAddress = wallet.address;
  const upgraderRole = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));
  
  try {
    const isAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, callerAddress);
    const isUpgrader = await contract.hasRole(upgraderRole, callerAddress);
    const adminAddress = await contract.getAdminAddress();
    const isPaused = await contract.paused();
    const contractBalance = await contract.getContractBalance();
    const totalPayments = await contract.getTotalPayments();
    const recordCreationFee = await contract.getRecordCreationFee();
    
    return {
      callerAddress,
      isAdmin,
      isUpgrader,
      adminAddress,
      isPaused,
      contractBalance: ethers.formatEther(contractBalance),
      totalPayments: ethers.formatEther(totalPayments),
      recordCreationFee: ethers.formatEther(recordCreationFee),
      canWithdraw: isAdmin && contractBalance > 0n,
      canPause: isAdmin && !isPaused,
      canUnpause: isAdmin && isPaused
    };
  } catch (error) {
    console.error('Erro ao obter status administrativo:', error);
    throw error;
  }
}

// Carregar dados administrativos
async function loadAdminData() {
  try {
    showToast('Carregando dados administrativos...');
    
    const status = await getAdminStatus();
    if (!status) {
      throw new Error('Não foi possível obter status administrativo');
    }
    
    const contractAddress = await getContractAddress();
    const ethers = window.ethers;
    
    // Atualizar status do contrato
    const pausedStatus = status.isPaused ? 
      '<span style="color: #ff6b6b; font-weight: 600;">⏸️ PAUSADO</span>' : 
      '<span style="color: #4ecdc4; font-weight: 600;">▶️ ATIVO</span>';
    
    contractStatus.innerHTML = `
      <p><strong>Status:</strong> ${pausedStatus}</p>
      <p><strong>Endereço do Contrato:</strong> <code style="font-size: 0.85rem;">${contractAddress}</code></p>
      <p><strong>Endereço do Admin:</strong> <code style="font-size: 0.85rem;">${status.adminAddress}</code></p>
      <p><strong>Taxa de Criação:</strong> ${status.recordCreationFee} ETH</p>
      <p><strong>Permissões:</strong> 
        ${status.isAdmin ? '<span style="color: #4ecdc4;">✓ Admin</span>' : '<span style="color: #ff6b6b;">✗ Admin</span>'}
        ${status.isUpgrader ? ' <span style="color: #4ecdc4;">✓ Upgrader</span>' : ' <span style="color: #ff6b6b;">✗ Upgrader</span>'}
      </p>
    `;
    
    // Atualizar informações de pagamento
    paymentInfo.innerHTML = `
      <p><strong>Saldo Acumulado:</strong> <span style="color: var(--accent); font-weight: 600;">${status.contractBalance} ETH</span></p>
      <p><strong>Total de Pagamentos:</strong> <span style="color: var(--accent); font-weight: 600;">${status.totalPayments} ETH</span></p>
    `;
    
    // Atualizar visibilidade dos botões
    if (status.canPause) {
      pauseBtn.style.display = 'block';
      unpauseBtn.style.display = 'none';
    } else if (status.canUnpause) {
      pauseBtn.style.display = 'none';
      unpauseBtn.style.display = 'block';
    } else {
      pauseBtn.style.display = 'none';
      unpauseBtn.style.display = 'none';
    }
    
    if (status.canWithdraw) {
      withdrawBtn.disabled = false;
      withdrawBtn.style.opacity = '1';
    } else {
      withdrawBtn.disabled = true;
      withdrawBtn.style.opacity = '0.5';
    }
    
    showToast('Dados carregados!');
    
    // Carregar eventos também
    await loadEvents();
  } catch (error) {
    console.error('Erro ao carregar dados administrativos:', error);
    showToast('Erro ao carregar dados');
    contractStatus.innerHTML = `<p class="note error">Erro: ${error.message}</p>`;
    paymentInfo.innerHTML = `<p class="note error">Erro ao carregar informações de pagamento</p>`;
  }
}

// Retirar fundos acumulados
async function withdrawFunds() {
  if (!contract || !wallet) {
    alert('Conecte sua carteira primeiro');
    return;
  }
  
  try {
    // Verificar permissões
    const callerAddress = wallet.address;
    const hasAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, callerAddress);
    
    if (!hasAdmin) {
      const adminAddress = await contract.getAdminAddress();
      if (callerAddress.toLowerCase() !== adminAddress.toLowerCase()) {
        throw new Error('Apenas o admin pode retirar fundos');
      }
    }
    
    // Verificar saldo
    const balance = await contract.getContractBalance();
    const ethers = window.ethers;
    if (balance === 0n || balance === BigInt(0)) {
      alert('Não há fundos para retirar');
      return;
    }
    
    const balanceInEth = ethers.formatEther(balance);
    if (!confirm(`Tem certeza que deseja retirar ${balanceInEth} ETH acumulados?`)) {
      return;
    }
    
    showToast('Retirando fundos...');
    
    const tx = await contract.withdraw();
    showToast(`Transação enviada: ${tx.hash}`);
    
    const receipt = await tx.wait();
    showToast('Fundos retirados com sucesso!');
    
    // Recarregar dados
    await loadAdminData();
    
    // Buscar evento de retirada
    const logs = receipt.logs;
    for (const log of logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === 'PaymentWithdrawn') {
          const amount = ethers.formatEther(parsed.args.amount);
          alert(`Fundos retirados com sucesso!\n\nValor: ${amount} ETH\nDestinatário: ${parsed.args.recipient}`);
          break;
        }
      } catch (e) {
        // Continuar procurando
      }
    }
  } catch (error) {
    console.error('Erro ao retirar fundos:', error);
    alert(`Erro ao retirar fundos: ${error.message}`);
  }
}

// Pausar contrato
async function pauseContract() {
  if (!contract || !wallet) {
    alert('Conecte sua carteira primeiro');
    return;
  }
  
  try {
    // Verificar permissões
    const callerAddress = wallet.address;
    const hasAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, callerAddress);
    
    if (!hasAdmin) {
      const adminAddress = await contract.getAdminAddress();
      if (callerAddress.toLowerCase() !== adminAddress.toLowerCase()) {
        throw new Error('Apenas o admin pode pausar o contrato');
      }
    }
    
    // Verificar se já está pausado
    const isPaused = await contract.paused();
    if (isPaused) {
      alert('Contrato já está pausado');
      return;
    }
    
    if (!confirm('Tem certeza que deseja pausar o contrato? Isso impedirá a criação de novos registros.')) {
      return;
    }
    
    showToast('Pausando contrato...');
    
    const tx = await contract.pause();
    showToast(`Transação enviada: ${tx.hash}`);
    
    await tx.wait();
    showToast('Contrato pausado com sucesso!');
    
    // Recarregar dados
    await loadAdminData();
  } catch (error) {
    console.error('Erro ao pausar contrato:', error);
    alert(`Erro ao pausar contrato: ${error.message}`);
  }
}

// Despausar contrato
async function unpauseContract() {
  if (!contract || !wallet) {
    alert('Conecte sua carteira primeiro');
    return;
  }
  
  try {
    // Verificar permissões
    const callerAddress = wallet.address;
    const hasAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, callerAddress);
    
    if (!hasAdmin) {
      const adminAddress = await contract.getAdminAddress();
      if (callerAddress.toLowerCase() !== adminAddress.toLowerCase()) {
        throw new Error('Apenas o admin pode despausar o contrato');
      }
    }
    
    // Verificar se está pausado
    const isPaused = await contract.paused();
    if (!isPaused) {
      alert('Contrato não está pausado');
      return;
    }
    
    if (!confirm('Tem certeza que deseja despausar o contrato?')) {
      return;
    }
    
    showToast('Despausando contrato...');
    
    const tx = await contract.unpause();
    showToast(`Transação enviada: ${tx.hash}`);
    
    await tx.wait();
    showToast('Contrato despausado com sucesso!');
    
    // Recarregar dados
    await loadAdminData();
  } catch (error) {
    console.error('Erro ao despausar contrato:', error);
    alert(`Erro ao despausar contrato: ${error.message}`);
  }
}

// Buscar dados administrativos completos (incluindo eventos)
async function fetchAdminData(fromBlock = null) {
  if (!contract || !wallet) return null;
  
  try {
    const ethers = window.ethers;
    const adminAddress = await contract.getAdminAddress();
    const totalPayments = await contract.getTotalPayments();
    
    // Se fromBlock não foi especificado, buscar desde o bloco 0 (todos os eventos)
    if (fromBlock === null) {
      fromBlock = 0; // Buscar desde o início para garantir que encontramos todos os eventos
      console.log(`[Admin] Buscando eventos desde o bloco ${fromBlock}`);
    }
    
    // Filtrar eventos de pagamento - buscar todos os pagamentos (não filtrar por recipient)
    let paymentEvents = [];
    try {
      // Primeiro tentar buscar todos os eventos PaymentReceived
      const paymentFilter = contract.filters.PaymentReceived();
      paymentEvents = await contract.queryFilter(paymentFilter, fromBlock);
      console.log(`[Admin] Encontrados ${paymentEvents.length} eventos PaymentReceived`);
      
      // Filtrar apenas os que foram para o admin
      paymentEvents = paymentEvents.filter(e => {
        try {
          return e.args.recipient.toLowerCase() === adminAddress.toLowerCase();
        } catch (err) {
          console.warn('[Admin] Erro ao filtrar evento de pagamento:', err);
          return false;
        }
      });
      console.log(`[Admin] ${paymentEvents.length} eventos de pagamento para o admin`);
    } catch (error) {
      console.error('[Admin] Erro ao buscar eventos de pagamento:', error);
    }
    
    // Filtrar eventos de criação de registros (exames)
    let recordEvents = [];
    try {
      const recordFilter = contract.filters.RecordCreated();
      recordEvents = await contract.queryFilter(recordFilter, fromBlock);
      console.log(`[Admin] Encontrados ${recordEvents.length} eventos RecordCreated`);
    } catch (e) {
      console.warn('[Admin] Evento RecordCreated não disponível:', e.message);
    }
    
    // Filtrar eventos de geração de chaves/consentimento
    let keyEvents = [];
    try {
      // Tentar ConsentKeyGenerated primeiro
      const keyFilter = contract.filters.ConsentKeyGenerated();
      keyEvents = await contract.queryFilter(keyFilter, fromBlock);
      console.log(`[Admin] Encontrados ${keyEvents.length} eventos ConsentKeyGenerated`);
    } catch (e) {
      // Se não existir, tentar ConsentGranted
      try {
        const consentFilter = contract.filters.ConsentGranted();
        keyEvents = await contract.queryFilter(consentFilter, fromBlock);
        console.log(`[Admin] Encontrados ${keyEvents.length} eventos ConsentGranted`);
      } catch (e2) {
        console.warn('[Admin] Eventos de consentimento não disponíveis:', e2.message);
      }
    }
    
    // Filtrar eventos de acesso (se existir)
    let accessEvents = [];
    try {
      const accessFilter = contract.filters.AccessLogged();
      accessEvents = await contract.queryFilter(accessFilter, fromBlock);
      console.log(`[Admin] Encontrados ${accessEvents.length} eventos AccessLogged`);
    } catch (e) {
      console.warn('[Admin] Evento AccessLogged não disponível:', e.message);
    }
    
    // Processar eventos de pagamento
    const processedPayments = paymentEvents.map(e => {
      try {
        return {
          payer: e.args.payer,
          amount: ethers.formatEther(e.args.amount),
          recordId: e.args.recordId.toString(),
          paymentType: e.args.paymentType || 'record_creation',
          timestamp: e.args.timestamp,
          date: new Date(Number(e.args.timestamp) * 1000),
          blockNumber: e.blockNumber,
          transactionHash: e.transactionHash
        };
      } catch (err) {
        console.error('[Admin] Erro ao processar evento de pagamento:', err, e);
        return null;
      }
    }).filter(p => p !== null);
    
    // Processar eventos de criação de registros
    const processedRecords = recordEvents.map(e => {
      try {
        return {
          recordId: e.args.id.toString(),
          owner: e.args.owner,
          cidMeta: e.args.cidMeta,
          metaHash: e.args.metaHash,
          timestamp: e.args.timestamp,
          date: new Date(Number(e.args.timestamp) * 1000),
          blockNumber: e.blockNumber,
          transactionHash: e.transactionHash
        };
      } catch (err) {
        console.error('[Admin] Erro ao processar evento RecordCreated:', err, e);
        return null;
      }
    }).filter(r => r !== null);
    
    // Processar eventos de consentimento/chave
    const processedKeys = keyEvents.map(e => {
      try {
        const recordId = e.args.recordId ? e.args.recordId.toString() : e.args.id?.toString() || 'N/A';
        const patient = e.args.patient || e.args.owner || 'N/A';
        const doctor = e.args.doctor || 'N/A';
        const expiry = e.args.expiry || e.args.expiryDate || 0;
        const timestamp = e.args.timestamp || expiry;
        
        return {
          recordId,
          patient,
          doctor,
          nonce: e.args.nonce || 'N/A',
          expiry: expiry,
          timestamp: timestamp,
          date: new Date(Number(timestamp) * 1000),
          expiryDate: new Date(Number(expiry) * 1000),
          accessDurationDays: expiry > 0 ? Math.floor((Number(expiry) - Number(timestamp)) / 86400) : 0,
          blockNumber: e.blockNumber,
          transactionHash: e.transactionHash
        };
      } catch (err) {
        console.error('[Admin] Erro ao processar evento de consentimento:', err, e);
        return null;
      }
    }).filter(k => k !== null);
    
    // Processar eventos de acesso
    const processedAccesses = accessEvents.map(e => {
      try {
        return {
          recordId: e.args.recordId.toString(),
          doctor: e.args.accessor,
          patient: e.args.patient,
          action: e.args.action || 'view',
          timestamp: e.args.timestamp,
          date: new Date(Number(e.args.timestamp) * 1000),
          blockNumber: e.blockNumber,
          transactionHash: e.transactionHash
        };
      } catch (err) {
        console.error('[Admin] Erro ao processar evento AccessLogged:', err, e);
        return null;
      }
    }).filter(a => a !== null);
    
    return {
      adminAddress,
      totalPayments: ethers.formatEther(totalPayments),
      payments: processedPayments,
      records: processedRecords,
      keys: processedKeys,
      accesses: processedAccesses
    };
  } catch (error) {
    console.error('Erro ao buscar dados administrativos:', error);
    throw error;
  }
}

// Carregar e exibir eventos
async function loadEvents() {
  try {
    showToast('Carregando eventos...');
    console.log('[Admin] Iniciando carregamento de eventos...');
    const adminData = await fetchAdminData();
    
    if (!adminData) {
      eventsContainer.innerHTML = '<p class="note error">Erro ao carregar eventos</p>';
      return;
    }
    
    console.log('[Admin] Dados carregados:', {
      payments: adminData.payments?.length || 0,
      records: adminData.records?.length || 0,
      accesses: adminData.accesses?.length || 0,
      keys: adminData.keys?.length || 0
    });
    
    let eventsHTML = '';
    
    // Criação de Exames (RecordCreated)
    if (adminData.records && adminData.records.length > 0) {
      eventsHTML += `
        <div style="margin-bottom: 24px;">
          <h4 style="color: var(--accent); margin-bottom: 12px;">📋 Criação de Exames (${adminData.records.length})</h4>
          <div style="max-height: 300px; overflow-y: auto;">
      `;
      
      adminData.records.slice(0, 10).forEach(record => {
        eventsHTML += `
          <div style="padding: 12px; margin-bottom: 8px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border-left: 3px solid #4caf50;">
            <p style="margin: 0; font-size: 0.9rem;"><strong>Record ID:</strong> #${record.recordId}</p>
            <p style="margin: 4px 0 0 0; font-size: 0.9rem;"><strong>Paciente:</strong> <code style="font-size: 0.8rem;">${record.owner}</code></p>
            <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-secondary);"><strong>Data:</strong> ${record.date.toLocaleString('pt-BR')}</p>
          </div>
        `;
      });
      
      if (adminData.records.length > 10) {
        eventsHTML += `<p class="note" style="margin-top: 8px;">Mostrando 10 de ${adminData.records.length} exames</p>`;
      }
      
      eventsHTML += `</div></div>`;
    }
    
    // Geração de Chaves/Consentimentos
    if (adminData.keys && adminData.keys.length > 0) {
      eventsHTML += `
        <div style="margin-bottom: 24px;">
          <h4 style="color: var(--accent); margin-bottom: 12px;">🔑 Geração de Chaves de Acesso (${adminData.keys.length})</h4>
          <div style="max-height: 300px; overflow-y: auto;">
      `;
      
      adminData.keys.slice(0, 10).forEach(key => {
        eventsHTML += `
          <div style="padding: 12px; margin-bottom: 8px; background: rgba(255, 193, 7, 0.1); border-radius: 8px; border-left: 3px solid #ffc107;">
            <p style="margin: 0; font-size: 0.9rem;"><strong>Record ID:</strong> #${key.recordId}</p>
            <p style="margin: 4px 0 0 0; font-size: 0.9rem;"><strong>Paciente:</strong> <code style="font-size: 0.8rem;">${key.patient}</code></p>
            <p style="margin: 4px 0 0 0; font-size: 0.9rem;"><strong>Médico:</strong> <code style="font-size: 0.8rem;">${key.doctor}</code></p>
            <p style="margin: 4px 0 0 0; font-size: 0.85rem;"><strong>Duração de Acesso:</strong> ${key.accessDurationDays} dias</p>
            <p style="margin: 4px 0 0 0; font-size: 0.85rem;"><strong>Expira em:</strong> ${key.expiryDate.toLocaleString('pt-BR')}</p>
            <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-secondary);"><strong>Chave gerada em:</strong> ${key.date.toLocaleString('pt-BR')}</p>
          </div>
        `;
      });
      
      if (adminData.keys.length > 10) {
        eventsHTML += `<p class="note" style="margin-top: 8px;">Mostrando 10 de ${adminData.keys.length} chaves</p>`;
      }
      
      eventsHTML += `</div></div>`;
    }
    
    // Pagamentos
    if (adminData.payments && adminData.payments.length > 0) {
      eventsHTML += `
        <div style="margin-bottom: 24px;">
          <h4 style="color: var(--accent); margin-bottom: 12px;">Pagamentos Recebidos (${adminData.payments.length})</h4>
          <div style="max-height: 300px; overflow-y: auto;">
      `;
      
      adminData.payments.slice(0, 10).forEach(payment => {
        eventsHTML += `
          <div style="padding: 12px; margin-bottom: 8px; background: rgba(148, 163, 255, 0.1); border-radius: 8px; border-left: 3px solid var(--accent);">
            <p style="margin: 0; font-size: 0.9rem;"><strong>Pagador:</strong> <code style="font-size: 0.8rem;">${payment.payer.slice(0, 10)}...${payment.payer.slice(-8)}</code></p>
            <p style="margin: 4px 0 0 0; font-size: 0.9rem;"><strong>Valor:</strong> ${payment.amount} ETH</p>
            <p style="margin: 4px 0 0 0; font-size: 0.9rem;"><strong>Record ID:</strong> ${payment.recordId}</p>
            <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">${payment.date.toLocaleString('pt-BR')}</p>
          </div>
        `;
      });
      
      if (adminData.payments.length > 10) {
        eventsHTML += `<p class="note" style="margin-top: 8px;">Mostrando 10 de ${adminData.payments.length} pagamentos</p>`;
      }
      
      eventsHTML += `</div></div>`;
    }
    
    // Acessos do Médico
    if (adminData.accesses && adminData.accesses.length > 0) {
      eventsHTML += `
        <div style="margin-top: 24px;">
          <h4 style="color: var(--accent); margin-bottom: 12px;">👨‍⚕️ Acessos de Médicos aos Exames (${adminData.accesses.length})</h4>
          <div style="max-height: 300px; overflow-y: auto;">
      `;
      
      adminData.accesses.slice(0, 10).forEach(access => {
        eventsHTML += `
          <div style="padding: 12px; margin-bottom: 8px; background: rgba(33, 150, 243, 0.1); border-radius: 8px; border-left: 3px solid #2196f3;">
            <p style="margin: 0; font-size: 0.9rem;"><strong>Record ID:</strong> #${access.recordId}</p>
            <p style="margin: 4px 0 0 0; font-size: 0.9rem;"><strong>Médico:</strong> <code style="font-size: 0.8rem;">${access.doctor}</code></p>
            <p style="margin: 4px 0 0 0; font-size: 0.9rem;"><strong>Paciente:</strong> <code style="font-size: 0.8rem;">${access.patient}</code></p>
            <p style="margin: 4px 0 0 0; font-size: 0.85rem;"><strong>Ação:</strong> ${access.action || 'visualização'}</p>
            <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-secondary);"><strong>Data de Visualização:</strong> ${access.date.toLocaleString('pt-BR')}</p>
          </div>
        `;
      });
      
      if (adminData.accesses.length > 10) {
        eventsHTML += `<p class="note" style="margin-top: 8px;">Mostrando 10 de ${adminData.accesses.length} acessos</p>`;
      }
      
      eventsHTML += `</div></div>`;
    }
    
    // Se não houver nenhum evento
    if (!eventsHTML) {
      eventsHTML = '<p class="note">Nenhum evento encontrado. Os eventos aparecerão aqui quando houver atividade no contrato.</p>';
    }
    
    eventsContainer.innerHTML = eventsHTML;
    showToast('Eventos carregados!');
  } catch (error) {
    console.error('Erro ao carregar eventos:', error);
    eventsContainer.innerHTML = `<p class="note error">Erro ao carregar eventos: ${error.message}</p>`;
  }
}

// Event listeners para ações administrativas
withdrawBtn.addEventListener('click', withdrawFunds);
pauseBtn.addEventListener('click', pauseContract);
unpauseBtn.addEventListener('click', unpauseContract);
refreshBtn.addEventListener('click', async () => {
  await loadAdminData();
  await loadEvents();
});

function showToast(message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}
