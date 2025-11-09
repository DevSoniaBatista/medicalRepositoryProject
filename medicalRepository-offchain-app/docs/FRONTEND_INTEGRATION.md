# Integração Frontend - Sistema de Pagamentos e Rastreamento

Este documento explica como integrar o sistema de pagamentos e rastreamento no frontend.

## Variáveis Importantes

### Valores de Pagamento

```javascript
// Valor que o paciente deve pagar ao criar um exame
// ⚠️ OBRIGATÓRIO: Este pagamento deve ser enviado junto com a transação createRecord()
const RECORD_CREATION_FEE = "0.0001"; // ETH (≈ US$0.43)

// Converter para Wei (para uso com ethers.js ou web3.js)
const RECORD_CREATION_FEE_WEI = ethers.utils.parseEther("0.0001");
// ou com web3.js:
// const RECORD_CREATION_FEE_WEI = web3.utils.toWei("0.0001", "ether");
```

### Roles Administrativas

O contrato utiliza o padrão AccessControl da OpenZeppelin para gerenciar permissões:

```javascript
// Roles disponíveis no contrato
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
const UPGRADER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UPGRADER_ROLE"));

// DEFAULT_ADMIN_ROLE: Acesso administrativo completo
// - Pode gerenciar outras roles (grant/revoke)
// - Pode pausar/despausar o contrato
// - Pode retirar fundos acumulados
// - Pode atualizar configurações administrativas

// UPGRADER_ROLE: Permissão para fazer upgrades do contrato
// - Pode autorizar upgrades do contrato (UUPS pattern)
```

## Eventos para Capturar no Frontend

### 1. PaymentReceived - Captura Pagamentos

Este evento é emitido quando um pagamento é recebido:

```javascript
// Com ethers.js
contract.on("PaymentReceived", (payer, recipient, amount, recordId, paymentType, timestamp, event) => {
    console.log("Pagamento Recebido:");
    console.log("- Pagador (Wallet):", payer);
    console.log("- Recebedor (Admin):", recipient);
    console.log("- Valor:", ethers.utils.formatEther(amount), "ETH");
    console.log("- Record ID:", recordId.toString());
    console.log("- Tipo de Pagamento:", paymentType);
    console.log("- Timestamp:", new Date(timestamp * 1000).toLocaleString());
    
    // Armazenar em variáveis para uso no frontend
    const paymentData = {
        payer: payer,
        recipient: recipient,
        amount: ethers.utils.formatEther(amount),
        amountWei: amount.toString(),
        recordId: recordId.toString(),
        paymentType: paymentType,
        timestamp: timestamp,
        date: new Date(timestamp * 1000)
    };
    
    // Exemplo: adicionar à lista de pagamentos
    addPaymentToHistory(paymentData);
});
```

### 2. ConsentKeyGenerated - Rastreamento de Chaves de Acesso

Este evento é emitido quando uma chave de acesso é gerada:

```javascript
contract.on("ConsentKeyGenerated", (recordId, patient, doctor, nonce, expiry, timestamp, event) => {
    console.log("Chave de Acesso Gerada:");
    console.log("- Record ID:", recordId.toString());
    console.log("- Paciente:", patient);
    console.log("- Médico:", doctor);
    console.log("- Nonce (Chave):", nonce);
    console.log("- Expira em:", new Date(expiry * 1000).toLocaleString());
    console.log("- Tempo de Acesso:", Math.floor((expiry - timestamp) / 86400), "dias");
    console.log("- Timestamp:", new Date(timestamp * 1000).toLocaleString());
    
    // Armazenar em variáveis
    const keyData = {
        recordId: recordId.toString(),
        patient: patient,
        doctor: doctor,
        nonce: nonce,
        expiry: expiry,
        timestamp: timestamp,
        accessDurationDays: Math.floor((expiry - timestamp) / 86400)
    };
    
    addKeyToHistory(keyData);
});
```

### 3. AccessLogged - Acesso do Médico ao Histórico

Este evento é emitido quando um médico acessa o histórico de um paciente:

```javascript
contract.on("AccessLogged", (recordId, accessor, patient, timestamp, action, event) => {
    console.log("Acesso ao Histórico Registrado:");
    console.log("- Record ID:", recordId.toString());
    console.log("- Médico (Acessor):", accessor);
    console.log("- Paciente:", patient);
    console.log("- Ação:", action);
    console.log("- Timestamp:", new Date(timestamp * 1000).toLocaleString());
    
    // Armazenar em variáveis
    const accessData = {
        recordId: recordId.toString(),
        doctor: accessor,
        patient: patient,
        action: action,
        timestamp: timestamp,
        date: new Date(timestamp * 1000)
    };
    
    addAccessToHistory(accessData);
});
```

### 4. PaymentWithdrawn - Retirada de Fundos pelo Admin

Este evento é emitido quando o admin retira os fundos acumulados:

```javascript
contract.on("PaymentWithdrawn", (recipient, amount, timestamp, event) => {
    console.log("Fundos Retirados pelo Admin:");
    console.log("- Recebedor (Admin):", recipient);
    console.log("- Valor Retirado:", ethers.utils.formatEther(amount), "ETH");
    console.log("- Timestamp:", new Date(timestamp * 1000).toLocaleString());
    
    // Armazenar em variáveis
    const withdrawData = {
        recipient: recipient,
        amount: ethers.utils.formatEther(amount),
        amountWei: amount.toString(),
        timestamp: timestamp,
        date: new Date(timestamp * 1000)
    };
    
    addWithdrawToHistory(withdrawData);
});
```

## Funções para Obter Informações

### Obter Valor da Taxa de Criação

```javascript
// Obter o valor da taxa de criação de registro
const fee = await contract.getRecordCreationFee();
const feeInEth = ethers.utils.formatEther(fee);
console.log("Taxa de criação:", feeInEth, "ETH");
```

### Obter Endereço do Admin

```javascript
// Obter o endereço do administrador que recebe os pagamentos
const adminAddress = await contract.getAdminAddress();
console.log("Endereço do Admin:", adminAddress);
```

### Verificar Permissões Administrativas

```javascript
// Verificar se um endereço tem role de admin
async function hasAdminRole(contract, address) {
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
    return await contract.hasRole(DEFAULT_ADMIN_ROLE, address);
}

// Verificar se um endereço tem role de upgrader
async function hasUpgraderRole(contract, address) {
    const UPGRADER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UPGRADER_ROLE"));
    return await contract.hasRole(UPGRADER_ROLE, address);
}

// Verificar se o usuário atual é admin
async function checkIfCurrentUserIsAdmin(contract, signer) {
    const userAddress = await signer.getAddress();
    const isAdmin = await hasAdminRole(contract, userAddress);
    console.log(`Usuário ${userAddress} é admin:`, isAdmin);
    return isAdmin;
}

// Exemplo de uso
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const contract = new ethers.Contract(contractAddress, abi, signer);

const isAdmin = await checkIfCurrentUserIsAdmin(contract, signer);
if (!isAdmin) {
    alert("Você não tem permissão para executar esta ação");
    return;
}
```

### Gerenciar Roles Administrativas (Apenas Admin)

```javascript
// Conceder role de admin a um endereço (apenas quem já é admin pode fazer isso)
async function grantAdminRole(contract, signer, targetAddress) {
    try {
        // Verificar se o caller é admin
        const callerAddress = await signer.getAddress();
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const isAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, callerAddress);
        
        if (!isAdmin) {
            throw new Error("Apenas admins podem conceder roles");
        }
        
        // Verificar se o endereço já tem a role
        const alreadyHasRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, targetAddress);
        if (alreadyHasRole) {
            throw new Error("Endereço já possui role de admin");
        }
        
        console.log(`Concedendo role de admin para ${targetAddress}...`);
        const tx = await contract.grantRole(DEFAULT_ADMIN_ROLE, targetAddress);
        console.log("Transação enviada:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("Role concedida com sucesso!");
        
        return receipt;
    } catch (error) {
        console.error("Erro ao conceder role:", error);
        throw error;
    }
}

// Revogar role de admin de um endereço
async function revokeAdminRole(contract, signer, targetAddress) {
    try {
        // Verificar se o caller é admin
        const callerAddress = await signer.getAddress();
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const isAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, callerAddress);
        
        if (!isAdmin) {
            throw new Error("Apenas admins podem revogar roles");
        }
        
        // Verificar se o endereço tem a role
        const hasRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, targetAddress);
        if (!hasRole) {
            throw new Error("Endereço não possui role de admin");
        }
        
        console.log(`Revogando role de admin de ${targetAddress}...`);
        const tx = await contract.revokeRole(DEFAULT_ADMIN_ROLE, targetAddress);
        console.log("Transação enviada:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("Role revogada com sucesso!");
        
        return receipt;
    } catch (error) {
        console.error("Erro ao revogar role:", error);
        throw error;
    }
}

// Conceder role de upgrader
async function grantUpgraderRole(contract, signer, targetAddress) {
    try {
        const callerAddress = await signer.getAddress();
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const UPGRADER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UPGRADER_ROLE"));
        
        const isAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, callerAddress);
        if (!isAdmin) {
            throw new Error("Apenas admins podem conceder roles");
        }
        
        const tx = await contract.grantRole(UPGRADER_ROLE, targetAddress);
        const receipt = await tx.wait();
        console.log("Role de upgrader concedida com sucesso!");
        
        return receipt;
    } catch (error) {
        console.error("Erro ao conceder role de upgrader:", error);
        throw error;
    }
}
```

### Obter Total de Pagamentos

```javascript
// Obter o total de pagamentos recebidos
const totalPayments = await contract.getTotalPayments();
const totalInEth = ethers.utils.formatEther(totalPayments);
console.log("Total de pagamentos:", totalInEth, "ETH");
```

### Obter Pagamentos por Wallet

```javascript
// Obter o total pago por uma wallet específica
const patientAddress = "0x..."; // endereço do paciente
const paymentsByPayer = await contract.getPaymentsByPayer(patientAddress);
const paymentsInEth = ethers.utils.formatEther(paymentsByPayer);
console.log(`Total pago por ${patientAddress}:`, paymentsInEth, "ETH");
```

### Obter Saldo Acumulado no Contrato

```javascript
// Obter o saldo acumulado no contrato (aguardando retirada pelo admin)
const contractBalance = await contract.getContractBalance();
const balanceInEth = ethers.utils.formatEther(contractBalance);
console.log("Saldo acumulado no contrato:", balanceInEth, "ETH");
```

### Retirar Fundos Acumulados (Apenas Admin)

```javascript
// Função para admin retirar todos os fundos acumulados
async function withdrawFunds(contract, signer) {
    try {
        // Verificar se o caller tem role de admin usando AccessControl
        const callerAddress = await signer.getAddress();
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const hasAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, callerAddress);
        
        if (!hasAdmin) {
            // Fallback: verificar se é o admin address (compatibilidade)
            const adminAddress = await contract.getAdminAddress();
            if (callerAddress.toLowerCase() !== adminAddress.toLowerCase()) {
                throw new Error("Apenas o admin pode retirar fundos");
            }
        }
        
        // Verificar saldo disponível
        const balance = await contract.getContractBalance();
        if (balance.eq(0)) {
            throw new Error("Não há fundos para retirar");
        }
        
        const balanceInEth = ethers.utils.formatEther(balance);
        console.log(`Retirando ${balanceInEth} ETH...`);
        
        // Chamar função withdraw
        const tx = await contract.withdraw();
        console.log("Transação enviada:", tx.hash);
        
        // Aguardar confirmação
        const receipt = await tx.wait();
        console.log("Transação confirmada:", receipt.transactionHash);
        
        // Buscar evento de retirada
        const withdrawEvent = receipt.events.find(e => e.event === "PaymentWithdrawn");
        if (withdrawEvent) {
            console.log("Fundos retirados:", {
                recipient: withdrawEvent.args.recipient,
                amount: ethers.utils.formatEther(withdrawEvent.args.amount),
                timestamp: withdrawEvent.args.timestamp
            });
        }
        
        return receipt;
    } catch (error) {
        console.error("Erro ao retirar fundos:", error);
        throw error;
    }
}
```

### Pausar/Despausar Contrato (Apenas Admin)

```javascript
// Verificar se o contrato está pausado
async function checkPausedStatus(contract) {
    const isPaused = await contract.paused();
    console.log("Contrato está pausado:", isPaused);
    return isPaused;
}

// Pausar o contrato (emergência)
async function pauseContract(contract, signer) {
    try {
        // Verificar se o caller tem role de admin
        const callerAddress = await signer.getAddress();
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const hasAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, callerAddress);
        
        if (!hasAdmin) {
            // Fallback: verificar se é o admin address
            const adminAddress = await contract.getAdminAddress();
            if (callerAddress.toLowerCase() !== adminAddress.toLowerCase()) {
                throw new Error("Apenas o admin pode pausar o contrato");
            }
        }
        
        // Verificar se já está pausado
        const isPaused = await contract.paused();
        if (isPaused) {
            throw new Error("Contrato já está pausado");
        }
        
        console.log("Pausando contrato...");
        
        // Chamar função pause
        const tx = await contract.pause();
        console.log("Transação enviada:", tx.hash);
        
        // Aguardar confirmação
        const receipt = await tx.wait();
        console.log("Contrato pausado com sucesso!");
        
        return receipt;
    } catch (error) {
        console.error("Erro ao pausar contrato:", error);
        throw error;
    }
}

// Despausar o contrato
async function unpauseContract(contract, signer) {
    try {
        // Verificar se o caller tem role de admin
        const callerAddress = await signer.getAddress();
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const hasAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, callerAddress);
        
        if (!hasAdmin) {
            // Fallback: verificar se é o admin address
            const adminAddress = await contract.getAdminAddress();
            if (callerAddress.toLowerCase() !== adminAddress.toLowerCase()) {
                throw new Error("Apenas o admin pode despausar o contrato");
            }
        }
        
        // Verificar se está pausado
        const isPaused = await contract.paused();
        if (!isPaused) {
            throw new Error("Contrato não está pausado");
        }
        
        console.log("Despausando contrato...");
        
        // Chamar função unpause
        const tx = await contract.unpause();
        console.log("Transação enviada:", tx.hash);
        
        // Aguardar confirmação
        const receipt = await tx.wait();
        console.log("Contrato despausado com sucesso!");
        
        return receipt;
    } catch (error) {
        console.error("Erro ao despausar contrato:", error);
        throw error;
    }
}
```

## Exemplo Completo de Criação de Registro com Pagamento

### ⚠️ IMPORTANTE: Pagamento Obrigatório

**O pagamento de 0.0001 ETH é OBRIGATÓRIO ao criar um exame.** O contrato valida que o valor correto foi enviado e reverte a transação se o pagamento não for feito corretamente.

```javascript
const { ethers } = require("ethers");

// Conectar à wallet
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const contract = new ethers.Contract(contractAddress, abi, signer);

// Obter a taxa de criação dinamicamente do contrato
const fee = await contract.getRecordCreationFee();
const feeInEth = ethers.utils.formatEther(fee);
console.log(`Taxa de criação: ${feeInEth} ETH`);

// Criar registro com pagamento obrigatório
async function createRecordWithPayment(patientAddress, cidMeta, metaHash) {
    try {
        // 1. Verificar se o contrato está pausado
        const isPaused = await contract.paused();
        if (isPaused) {
            throw new Error("Contrato está pausado. Não é possível criar registros no momento.");
        }
        
        // 2. Verificar se o caller é o próprio paciente
        const callerAddress = await signer.getAddress();
        if (callerAddress.toLowerCase() !== patientAddress.toLowerCase()) {
            throw new Error("Apenas o próprio paciente pode criar seu registro");
        }
        
        // 3. Verificar se o usuário tem ETH suficiente (incluindo gas)
        const balance = await provider.getBalance(patientAddress);
        const estimatedGas = await contract.estimateGas.createRecord(
            patientAddress,
            cidMeta,
            metaHash,
            { value: fee }
        );
        const gasPrice = await provider.getGasPrice();
        const totalNeeded = fee.add(estimatedGas.mul(gasPrice));
        
        if (balance.lt(totalNeeded)) {
            const neededEth = ethers.utils.formatEther(totalNeeded);
            const balanceEth = ethers.utils.formatEther(balance);
            throw new Error(
                `Saldo insuficiente. Necessário: ${neededEth} ETH (taxa: ${feeInEth} ETH + gas), ` +
                `disponível: ${balanceEth} ETH`
            );
        }
        
        // 4. Criar registro e enviar pagamento OBRIGATÓRIO
        // ⚠️ O valor deve ser enviado no campo { value: fee }
        console.log(`Criando registro e enviando pagamento de ${feeInEth} ETH...`);
        const tx = await contract.createRecord(
            patientAddress,
            cidMeta,
            metaHash,
            { 
                value: fee, // ⚠️ PAGAMENTO OBRIGATÓRIO: 0.0001 ETH
                gasLimit: estimatedGas.mul(120).div(100) // Adicionar 20% de margem para gas
            }
        );
        
        console.log("Transação enviada:", tx.hash);
        console.log("Aguardando confirmação...");
        
        // 5. Aguardar confirmação
        const receipt = await tx.wait();
        console.log("Transação confirmada:", receipt.transactionHash);
        
        // 6. Buscar eventos do bloco
        const recordCreatedEvent = receipt.events.find(e => e.event === "RecordCreated");
        const paymentEvent = receipt.events.find(e => e.event === "PaymentReceived");
        
        if (recordCreatedEvent) {
            const recordId = recordCreatedEvent.args.id.toString();
            console.log("Registro criado com sucesso! Record ID:", recordId);
        }
        
        if (paymentEvent) {
            console.log("Pagamento confirmado:", {
                payer: paymentEvent.args.payer,
                recipient: paymentEvent.args.recipient,
                amount: ethers.utils.formatEther(paymentEvent.args.amount),
                recordId: paymentEvent.args.recordId.toString(),
                paymentType: paymentEvent.args.paymentType
            });
        } else {
            console.warn("⚠️ Evento PaymentReceived não encontrado. Verifique se o pagamento foi processado.");
        }
        
        return receipt;
    } catch (error) {
        console.error("Erro ao criar registro:", error);
        
        // Tratamento de erros específicos
        if (error.message.includes("insufficient funds")) {
            throw new Error("Saldo insuficiente para pagar a taxa de criação");
        } else if (error.message.includes("paused")) {
            throw new Error("Contrato está pausado. Tente novamente mais tarde.");
        } else if (error.message.includes("value")) {
            throw new Error("Valor do pagamento incorreto. O pagamento de 0.0001 ETH é obrigatório.");
        }
        
        throw error;
    }
}

// Exemplo de uso
const patientAddress = await signer.getAddress();
const cidMeta = "QmXxxx..."; // CID do IPFS
const metaHash = "0x1234..."; // Hash SHA3-256 do metadata

try {
    const receipt = await createRecordWithPayment(patientAddress, cidMeta, metaHash);
    console.log("✅ Registro criado e pagamento processado com sucesso!");
} catch (error) {
    console.error("❌ Erro:", error.message);
    alert(`Erro ao criar registro: ${error.message}`);
}
```

## Exemplo de Dashboard para Admin

```javascript
// Função para buscar todos os eventos relevantes para o admin
async function fetchAdminData(contract, fromBlock = 0) {
    const adminAddress = await contract.getAdminAddress();
    const totalPayments = await contract.getTotalPayments();
    
    // Filtrar eventos de pagamento
    const paymentFilter = contract.filters.PaymentReceived(null, adminAddress);
    const paymentEvents = await contract.queryFilter(paymentFilter, fromBlock);
    
    // Filtrar eventos de geração de chaves
    const keyFilter = contract.filters.ConsentKeyGenerated();
    const keyEvents = await contract.queryFilter(keyFilter, fromBlock);
    
    // Filtrar eventos de acesso
    const accessFilter = contract.filters.AccessLogged();
    const accessEvents = await contract.queryFilter(accessFilter, fromBlock);
    
    return {
        adminAddress,
        totalPayments: ethers.utils.formatEther(totalPayments),
        payments: paymentEvents.map(e => ({
            payer: e.args.payer,
            amount: ethers.utils.formatEther(e.args.amount),
            recordId: e.args.recordId.toString(),
            paymentType: e.args.paymentType,
            timestamp: e.args.timestamp,
            date: new Date(e.args.timestamp * 1000)
        })),
        keys: keyEvents.map(e => ({
            recordId: e.args.recordId.toString(),
            patient: e.args.patient,
            doctor: e.args.doctor,
            nonce: e.args.nonce,
            expiry: e.args.expiry,
            timestamp: e.args.timestamp,
            accessDurationDays: Math.floor((e.args.expiry - e.args.timestamp) / 86400)
        })),
        accesses: accessEvents.map(e => ({
            recordId: e.args.recordId.toString(),
            doctor: e.args.accessor,
            patient: e.args.patient,
            action: e.args.action,
            timestamp: e.args.timestamp,
            date: new Date(e.args.timestamp * 1000)
        }))
    };
}

// Usar a função
const adminData = await fetchAdminData(contract);
console.log("Dados do Admin:", adminData);
```

## Variáveis para Armazenar no Frontend

```javascript
// Estrutura de dados recomendada para armazenar no frontend
const frontendState = {
    // Informações de pagamento
    payments: [], // Array de objetos PaymentReceived
    totalPayments: "0", // Total em ETH
    
    // Informações de chaves de acesso
    accessKeys: [], // Array de objetos ConsentKeyGenerated
    
    // Informações de acessos
    accessLogs: [], // Array de objetos AccessLogged
    
    // Configurações
    recordCreationFee: "0.0001", // ETH
    adminAddress: null
};

// Exemplo de função para atualizar o estado
function updatePaymentState(paymentEvent) {
    frontendState.payments.push({
        payer: paymentEvent.payer,
        recipient: paymentEvent.recipient,
        amount: paymentEvent.amount,
        recordId: paymentEvent.recordId,
        paymentType: paymentEvent.paymentType,
        timestamp: paymentEvent.timestamp,
        date: paymentEvent.date
    });
    
    // Atualizar total
    const total = frontendState.payments.reduce((sum, p) => 
        sum + parseFloat(p.amount), 0
    );
    frontendState.totalPayments = total.toString();
}
```

## Controle de Acesso Administrativo

### Sistema de Roles (AccessControl)

O contrato utiliza o padrão **AccessControl da OpenZeppelin** para gerenciar permissões de forma granular e segura.

### Roles Disponíveis

1. **DEFAULT_ADMIN_ROLE** (`0x00...00`)
   - Acesso administrativo completo
   - Pode conceder/revogar outras roles
   - Pode pausar/despausar o contrato
   - Pode retirar fundos acumulados
   - Pode atualizar configurações administrativas

2. **UPGRADER_ROLE** (hash calculado)
   - Permissão para autorizar upgrades do contrato (UUPS pattern)
   - Usado para atualizar a implementação do contrato sem perder dados

### Verificação de Permissões

Sempre verifique permissões antes de executar ações administrativas:

```javascript
// Exemplo: Verificar permissões antes de ação administrativa
async function executeAdminAction(contract, signer, action) {
    const callerAddress = await signer.getAddress();
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
    
    const hasAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, callerAddress);
    
    if (!hasAdmin) {
        throw new Error("Acesso negado: você não tem permissão de administrador");
    }
    
    // Executar ação administrativa
    return await action();
}
```

### Dashboard Administrativo Completo

```javascript
// Função completa para verificar status administrativo
async function getAdminStatus(contract, signer) {
    const callerAddress = await signer.getAddress();
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const UPGRADER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UPGRADER_ROLE"));
    
    const isAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, callerAddress);
    const isUpgrader = await contract.hasRole(UPGRADER_ROLE, callerAddress);
    const adminAddress = await contract.getAdminAddress();
    const isPaused = await contract.paused();
    const contractBalance = await contract.getContractBalance();
    const totalPayments = await contract.getTotalPayments();
    
    return {
        callerAddress,
        isAdmin,
        isUpgrader,
        adminAddress,
        isPaused,
        contractBalance: ethers.utils.formatEther(contractBalance),
        totalPayments: ethers.utils.formatEther(totalPayments),
        canWithdraw: isAdmin && !contractBalance.eq(0),
        canPause: isAdmin && !isPaused,
        canUnpause: isAdmin && isPaused
    };
}

// Usar a função
const status = await getAdminStatus(contract, signer);
console.log("Status Administrativo:", status);
```

## Notas Importantes

1. **Conversão de Valores**: Sempre use `ethers.utils.formatEther()` para converter Wei para ETH ao exibir valores
2. **Eventos Indexados**: Os eventos têm campos indexados que facilitam a busca por filtros
3. **Timestamp**: Os timestamps são em segundos Unix, multiplique por 1000 para usar com `new Date()`
4. **Pagamento Obrigatório**: O pagamento de 0.0001 ETH é **OBRIGATÓRIO** ao criar um registro. O contrato valida o valor e reverte a transação se o pagamento não for feito corretamente
5. **Validação de Pagamento**: O contrato verifica automaticamente se o valor enviado corresponde à taxa de criação. Se não corresponder, a transação será revertida
6. **Acumulação de Fundos**: Os pagamentos são acumulados no contrato e não são transferidos imediatamente ao admin
7. **Retirada de Fundos**: Apenas quem tem `DEFAULT_ADMIN_ROLE` pode retirar os fundos acumulados através da função `withdraw()`
8. **Pausa do Contrato**: Apenas quem tem `DEFAULT_ADMIN_ROLE` pode pausar/despausar o contrato em caso de emergência usando `pause()`/`unpause()`
9. **Funções Pausadas**: Quando pausado, as seguintes funções não funcionam:
   - `createRecord()` - Não é possível criar novos registros
   - `grantConsent()` - Não é possível conceder consentimentos
   - `logAccess()` - Não é possível registrar acessos
10. **Funções que Funcionam Quando Pausado**:
    - `withdraw()` - Admin ainda pode retirar fundos (função de emergência)
    - Todas as funções de visualização (`getRecord()`, `getContractBalance()`, etc.)
    - Funções de gerenciamento de roles (apenas admin)
11. **Admin Tracking**: O admin pode rastrear todas as ações através dos eventos emitidos
12. **AccessControl**: Use `hasRole()` para verificar permissões antes de executar ações administrativas
13. **Múltiplos Admins**: O sistema suporta múltiplos administradores através do sistema de roles
14. **Segurança**: Sempre verifique permissões no frontend, mas lembre-se que a validação real acontece no contrato

