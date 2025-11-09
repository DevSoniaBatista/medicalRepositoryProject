# Integração Frontend - Sistema de Pagamentos e Rastreamento

Este documento explica como integrar o sistema de pagamentos e rastreamento no frontend.

## Variáveis Importantes

### Valores de Pagamento

```javascript
// Valor que o paciente deve pagar ao criar um exame
const RECORD_CREATION_FEE = "0.0001"; // ETH (≈ US$0.43)

// Converter para Wei (para uso com ethers.js ou web3.js)
const RECORD_CREATION_FEE_WEI = ethers.utils.parseEther("0.0001");
// ou com web3.js:
// const RECORD_CREATION_FEE_WEI = web3.utils.toWei("0.0001", "ether");
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
async function withdrawFunds() {
    try {
        // Verificar se o caller é admin
        const adminAddress = await contract.getAdminAddress();
        const signerAddress = await signer.getAddress();
        
        if (signerAddress.toLowerCase() !== adminAddress.toLowerCase()) {
            throw new Error("Apenas o admin pode retirar fundos");
        }
        
        // Verificar saldo disponível
        const balance = await contract.getContractBalance();
        if (balance.eq(0)) {
            throw new Error("Não há fundos para retirar");
        }
        
        console.log("Retirando", ethers.utils.formatEther(balance), "ETH");
        
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
async function checkPausedStatus() {
    const isPaused = await contract.paused();
    console.log("Contrato está pausado:", isPaused);
    return isPaused;
}

// Pausar o contrato (emergência)
async function pauseContract() {
    try {
        // Verificar se o caller é admin
        const adminAddress = await contract.getAdminAddress();
        const signerAddress = await signer.getAddress();
        
        if (signerAddress.toLowerCase() !== adminAddress.toLowerCase()) {
            throw new Error("Apenas o admin pode pausar o contrato");
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
async function unpauseContract() {
    try {
        // Verificar se o caller é admin
        const adminAddress = await contract.getAdminAddress();
        const signerAddress = await signer.getAddress();
        
        if (signerAddress.toLowerCase() !== adminAddress.toLowerCase()) {
            throw new Error("Apenas o admin pode despausar o contrato");
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

```javascript
const { ethers } = require("ethers");

// Conectar à wallet
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const contract = new ethers.Contract(contractAddress, abi, signer);

// Obter a taxa de criação
const fee = await contract.getRecordCreationFee();

// Criar registro com pagamento
async function createRecordWithPayment(patientAddress, cidMeta, metaHash) {
    try {
        // Verificar se o contrato está pausado
        const isPaused = await contract.paused();
        if (isPaused) {
            throw new Error("Contrato está pausado. Não é possível criar registros no momento.");
        }
        
        // Verificar se o usuário tem ETH suficiente
        const balance = await provider.getBalance(patientAddress);
        if (balance.lt(fee)) {
            throw new Error("Saldo insuficiente para pagar a taxa");
        }
        
        // Criar registro e enviar pagamento
        const tx = await contract.createRecord(
            patientAddress,
            cidMeta,
            metaHash,
            { value: fee } // Enviar ETH junto com a transação
        );
        
        console.log("Transação enviada:", tx.hash);
        
        // Aguardar confirmação
        const receipt = await tx.wait();
        console.log("Transação confirmada:", receipt.transactionHash);
        
        // Buscar eventos do bloco
        const paymentEvent = receipt.events.find(e => e.event === "PaymentReceived");
        if (paymentEvent) {
            console.log("Pagamento confirmado:", {
                payer: paymentEvent.args.payer,
                amount: ethers.utils.formatEther(paymentEvent.args.amount),
                recordId: paymentEvent.args.recordId.toString()
            });
        }
        
        return receipt;
    } catch (error) {
        console.error("Erro ao criar registro:", error);
        throw error;
    }
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

## Notas Importantes

1. **Conversão de Valores**: Sempre use `ethers.utils.formatEther()` para converter Wei para ETH ao exibir valores
2. **Eventos Indexados**: Os eventos têm campos indexados que facilitam a busca por filtros
3. **Timestamp**: Os timestamps são em segundos Unix, multiplique por 1000 para usar com `new Date()`
4. **Pagamento Obrigatório**: O pagamento de 0.0001 ETH é obrigatório ao criar um registro
5. **Acumulação de Fundos**: Os pagamentos são acumulados no contrato e não são transferidos imediatamente
6. **Retirada de Fundos**: Apenas o admin pode retirar os fundos acumulados através da função `withdraw()`
7. **Pausa do Contrato**: O admin pode pausar o contrato em caso de emergência usando `pause()`
8. **Funções Pausadas**: Quando pausado, as seguintes funções não funcionam:
   - `createRecord()` - Não é possível criar novos registros
   - `grantConsent()` - Não é possível conceder consentimentos
   - `logAccess()` - Não é possível registrar acessos
9. **Funções que Funcionam Quando Pausado**:
   - `withdraw()` - Admin ainda pode retirar fundos (função de emergência)
   - Todas as funções de visualização (`getRecord()`, `getContractBalance()`, etc.)
10. **Admin Tracking**: O admin pode rastrear todas as ações através dos eventos emitidos

