# Resumo Executivo - Sistema de Prontuário Médico Descentralizado

## Visão Geral do Negócio

### Problema que Resolve

O sistema permite que **pacientes controlem completamente seus prontuários médicos** usando blockchain, sem depender de hospitais ou sistemas centralizados. Os dados são criptografados e armazenados de forma descentralizada, garantindo privacidade e portabilidade.

### Proposta de Valor

1. **Controle Total pelo Paciente**: Apenas o paciente (através de sua wallet) pode criar, gerenciar e compartilhar seus registros médicos
2. **Privacidade Garantida**: Dados criptografados end-to-end; chaves nunca armazenadas on-chain
3. **Portabilidade**: Paciente pode acessar seus registros de qualquer lugar, independente de provedor de saúde
4. **Auditoria Transparente**: Todas as ações (criação, consentimento, acesso) registradas na blockchain
5. **Interoperabilidade**: Estrutura padronizada permite integração com diferentes sistemas de saúde
6. **Modelo de Receita Sustentável**: Taxa de 0.0001 ETH (≈ US$0.43) por registro criado

## Modelo de Negócio

### Participantes

- **Paciente**: Proprietário dos registros, controla acesso via wallet, paga taxa de 0.0001 ETH por registro criado
- **Médico/Profissional de Saúde**: Acessa registros apenas com consentimento explícito do paciente
- **Admin/Plataforma**: Gerencia fundos acumulados, monitora sistema através de eventos, pode pausar em emergências
- **Rede Blockchain**: Ethereum (ou compatível) para registro de metadados e consentimentos
- **IPFS/Pinata**: Armazenamento descentralizado dos dados criptografados

### Fluxo de Operação Completo

#### Passo 1: Paciente Cria Registro Médico

**1.1. Coleta de Dados (Interface JavaScript)**
- Paciente acessa interface web (`medicalRepository-offchain-app/index.html`)
- Preenche formulário com:
  - `patientHash`: Hash identificador do paciente (ex: `0xabcd...`)
  - `examType`: Tipo de exame (ex: `blood-test`, `x-ray`)
  - `examDate`: Data do exame
  - `notesHash`: Hash de notas médicas (opcional)
  - `files`: Lista de CIDs de arquivos/imagens (um por linha)
- Clica em "Gerar Payload Cifrado"

**1.2. Processamento Client-Side (JavaScript)**
- Sistema gera automaticamente:
  - **Metadata JSON**: Estrutura padronizada com todos os dados
  - **Chave Simétrica**: 32 bytes aleatórios (AES-256) - usando chave mestra global
  - **IV (Vetor de Inicialização)**: 12 bytes aleatórios
  - **Payload Cifrado**: Metadata criptografado com AES-GCM
- Resultados exibidos na tela:
  - Metadata JSON (texto plano, antes de cifrar)
  - Payload cifrado (JSON com `encrypted`, `iv`, `authTag`)
  - Chave simétrica em hexadecimal

**1.3. Upload para IPFS (Pinata)**
- Paciente faz upload do **Payload Cifrado** (JSON completo) para Pinata
- Recebe **CID** do IPFS (ex: `QmXyZ123...`)

**1.4. Registro On-Chain com Pagamento**
- Paciente calcula hash do payload cifrado: `keccak256(payloadCifrado)`
- **Pagamento Obrigatório**: Deve enviar exatamente 0.0001 ETH com a transação
- Chama `createRecord()` no smart contract:
  ```solidity
  createRecord{value: 0.0001 ether}(
      patientAddress,    // msg.sender (deve ser o paciente)
      cidMeta,          // CID do IPFS
      metaHash          // Hash do payload
  )
  ```
- **Validações do Contrato**:
  - Verifica que `msg.sender == patient`
  - Verifica que `msg.value == 0.0001 ether` (exatamente)
  - Reverte se valor incorreto
- **Acumulação de Fundos**:
  - 0.0001 ETH fica acumulado no contrato (não é transferido imediatamente)
  - Contador `_totalPayments` é incrementado
  - Mapeamento `_paymentsByPayer[patient]` é atualizado
- **Eventos Emitidos**:
  - `RecordCreated(id, owner, cidMeta, metaHash, timestamp)` - Registro criado
  - `PaymentReceived(payer, recipient, amount, recordId, paymentType, timestamp)` - Pagamento recebido
    - `payer`: Endereço do paciente que pagou
    - `recipient`: Endereço do admin (destinatário dos fundos)
    - `amount`: 0.0001 ETH (em wei)
    - `recordId`: ID do registro criado
    - `paymentType`: "record_creation"
    - `timestamp`: Timestamp do bloco

#### Passo 2: Paciente Compartilha com Médico

**2.1. Geração de Consentimento (EIP-712)**
- Paciente gera assinatura EIP-712 off-chain:
  - `recordId`: ID do registro criado
  - `doctor`: Endereço da wallet do médico
  - `expiry`: Timestamp de expiração
  - `nonce`: Valor único para prevenir replay
- Assina com sua chave privada (via MetaMask ou similar)

**2.2. Compartilhamento da Chave Simétrica (ECIES)**
- Paciente criptografa a chave simétrica com chave pública do médico
- Compartilha via:
  - QR Code (gerado com dados criptografados)
  - Email seguro
  - Canal seguro off-chain

**2.3. Registro de Consentimento On-Chain**
- Paciente (ou médico) chama `grantConsent()`:
  ```solidity
  grantConsent(
      recordId,
      doctor,
      expiry,
      nonce,
      patientSignature  // Assinatura EIP-712
  )
  ```
- **Validações do Contrato**:
  - Verifica assinatura EIP-712
  - Verifica que consentimento não expirou
  - Verifica que nonce não foi usado antes (replay protection)
  - Verifica que registro não foi revogado
- **Armazenamento**:
  - Consentimento armazenado em `_consents[recordId][doctor][nonce]`
  - Nonce marcado como usado em `_usedNonces[patient][nonce]`
- **Eventos Emitidos**:
  - `ConsentGranted(recordId, patient, doctor, expiry, nonce)` - Consentimento concedido
  - `ConsentKeyGenerated(recordId, patient, doctor, nonce, expiry, timestamp)` - Chave gerada (para rastreamento admin)
    - Este evento permite ao admin rastrear:
      - Qual paciente compartilhou com qual médico
      - Qual registro foi compartilhado
      - Quando o consentimento expira
      - Nonce usado (identificador único do consentimento)

#### Passo 3: Médico Acessa Registro

**3.1. Descriptografia da Chave**
- Médico recebe chave simétrica criptografada (ECIES)
- Descriptografa com sua chave privada
- Obtém chave simétrica em hexadecimal

**3.2. Download e Descriptografia do Metadata**
- Médico baixa payload do IPFS usando CID
- Descriptografa usando:
  - Chave simétrica (obtida no passo anterior)
  - IV (do payload)
  - AuthTag (do payload)
- Obtém metadata JSON original

**3.3. Registro de Acesso (Auditoria)**
- Médico chama `logAccess()`:
  ```solidity
  logAccess(recordId, "viewed")
  ```
- **Validações do Contrato**:
  - Verifica que registro existe
  - Verifica que registro não foi revogado
- **Evento Emitido**:
  - `AccessLogged(recordId, accessor, patient, timestamp, action)`
    - `recordId`: ID do registro acessado
    - `accessor`: Endereço do médico que acessou (msg.sender)
    - `patient`: Endereço do paciente (owner do registro)
    - `timestamp`: Timestamp do acesso
    - `action`: Descrição da ação (ex: "viewed", "downloaded")
- **Importante para Admin**: Este evento permite rastrear:
  - Qual médico acessou qual paciente
  - Quando o acesso ocorreu
  - Qual ação foi realizada
  - Qual registro foi acessado

## Sistema de Pagamento e Receita

### Modelo de Receita Implementado

**Taxa por Registro Criado:**
- **Valor**: 0.0001 ETH por registro (≈ US$0.43, variável com câmbio)
- **Obrigatoriedade**: Pagamento obrigatório ao criar registro via `createRecord()`
- **Método**: Deve ser enviado com a transação (`{value: 0.0001 ether}`)
- **Validação**: Contrato reverte se valor não for exatamente 0.0001 ETH

**Acumulação de Fundos:**
- Fundos ficam acumulados no contrato (não transferidos imediatamente)
- Contrato mantém saldo ETH que pode ser consultado via `getContractBalance()`
- Total de pagamentos rastreado via `getTotalPayments()`
- Pagamentos por pagador rastreados via `getPaymentsByPayer(address)`

**Retirada de Fundos (Admin):**
- Apenas admin pode retirar fundos acumulados
- Função `withdraw()` transfere todo o saldo do contrato para endereço do admin
- Emite evento `PaymentWithdrawn(recipient, amount, timestamp)` quando fundos são retirados
- Função protegida por `DEFAULT_ADMIN_ROLE`

### Opções de Monetização Futuras

1. **Assinatura Mensal**: Paciente paga para manter registros ativos
2. **API Premium**: Hospitais/clínicas pagam para integrar com sistema
3. **Serviços Adicionais**:
   - Backup de chaves (custodial recovery)
   - Integração com dispositivos IoT
   - Analytics agregados (com consentimento)
   - Consultas avançadas de histórico

## Capacidades Administrativas

### Funções de Visualização (Admin)

O admin pode consultar informações do sistema através das seguintes funções:

**Informações Básicas:**
```solidity
address admin = getAdminAddress();           // Endereço do admin
uint256 fee = getRecordCreationFee();        // Taxa de criação (0.0001 ETH)
```

**Estatísticas de Pagamento:**
```solidity
uint256 total = getTotalPayments();          // Total de pagamentos recebidos
uint256 byPayer = getPaymentsByPayer(address); // Total pago por uma wallet específica
uint256 balance = getContractBalance();      // Saldo acumulado no contrato
```

**Informações de Registros:**
```solidity
MedicalRecord memory record = getRecord(recordId); // Detalhes de um registro
Consent memory consent = getConsent(recordId, doctor, nonce); // Detalhes de um consentimento
```

### Funções de Controle (Admin)

**Gestão de Fundos:**
```solidity
withdraw(); // Retira todos os fundos acumulados para endereço do admin
```

**Controles de Emergência:**
```solidity
pause();   // Pausa todas as operações de estado (createRecord, grantConsent, logAccess)
unpause(); // Retoma todas as operações
```

**Comportamento Quando Pausado:**
- ❌ **Bloqueadas**: `createRecord()`, `grantConsent()`, `logAccess()`
- ✅ **Funcionam**: `withdraw()`, todas as funções de visualização, `revokeRecord()`, `revokeConsent()`

### Rastreamento Completo via Eventos

O admin pode monitorar toda a atividade do sistema através dos eventos emitidos:

**1. Eventos de Pagamento:**
```javascript
// Filtrar todos os pagamentos
const paymentFilter = contract.filters.PaymentReceived(null, adminAddress);
const payments = await contract.queryFilter(paymentFilter, fromBlock);

// Cada evento contém:
// - payer: Endereço do paciente que pagou
// - recipient: Endereço do admin
// - amount: Valor pago (0.0001 ETH)
// - recordId: ID do registro criado
// - paymentType: "record_creation"
// - timestamp: Quando o pagamento ocorreu
```

**2. Eventos de Retirada:**
```javascript
// Filtrar retiradas de fundos
const withdrawFilter = contract.filters.PaymentWithdrawn(adminAddress);
const withdrawals = await contract.queryFilter(withdrawFilter, fromBlock);

// Cada evento contém:
// - recipient: Endereço do admin
// - amount: Valor retirado
// - timestamp: Quando a retirada ocorreu
```

**3. Eventos de Criação de Registros:**
```javascript
// Filtrar criação de registros
const recordFilter = contract.filters.RecordCreated();
const records = await contract.queryFilter(recordFilter, fromBlock);

// Cada evento contém:
// - id: ID do registro
// - owner: Endereço do paciente
// - cidMeta: CID do IPFS
// - metaHash: Hash do conteúdo
// - timestamp: Quando foi criado
```

**4. Eventos de Consentimento:**
```javascript
// Filtrar geração de chaves de consentimento
const keyFilter = contract.filters.ConsentKeyGenerated();
const keys = await contract.queryFilter(keyFilter, fromBlock);

// Cada evento contém:
// - recordId: ID do registro
// - patient: Endereço do paciente
// - doctor: Endereço do médico
// - nonce: Identificador único do consentimento
// - expiry: Timestamp de expiração
// - timestamp: Quando foi gerado
```

**5. Eventos de Acesso:**
```javascript
// Filtrar acessos aos registros
const accessFilter = contract.filters.AccessLogged();
const accesses = await contract.queryFilter(accessFilter, fromBlock);

// Cada evento contém:
// - recordId: ID do registro acessado
// - accessor: Endereço do médico que acessou
// - patient: Endereço do paciente
// - timestamp: Quando o acesso ocorreu
// - action: Descrição da ação (ex: "viewed")
```

### Dashboard de Admin - Exemplo de Implementação

```javascript
// Função completa para buscar todos os dados do admin
async function fetchAdminData(contract, fromBlock = 0) {
    const adminAddress = await contract.getAdminAddress();
    const totalPayments = await contract.getTotalPayments();
    const contractBalance = await contract.getContractBalance();
    const recordCreationFee = await contract.getRecordCreationFee();
    
    // Filtrar eventos de pagamento
    const paymentFilter = contract.filters.PaymentReceived(null, adminAddress);
    const paymentEvents = await contract.queryFilter(paymentFilter, fromBlock);
    
    // Filtrar eventos de retirada
    const withdrawFilter = contract.filters.PaymentWithdrawn(adminAddress);
    const withdrawEvents = await contract.queryFilter(withdrawFilter, fromBlock);
    
    // Filtrar eventos de geração de chaves
    const keyFilter = contract.filters.ConsentKeyGenerated();
    const keyEvents = await contract.queryFilter(keyFilter, fromBlock);
    
    // Filtrar eventos de acesso
    const accessFilter = contract.filters.AccessLogged();
    const accessEvents = await contract.queryFilter(accessFilter, fromBlock);
    
    // Filtrar eventos de criação de registros
    const recordFilter = contract.filters.RecordCreated();
    const recordEvents = await contract.queryFilter(recordFilter, fromBlock);
    
    return {
        // Informações básicas
        adminAddress,
        recordCreationFee: ethers.utils.formatEther(recordCreationFee),
        totalPayments: ethers.utils.formatEther(totalPayments),
        contractBalance: ethers.utils.formatEther(contractBalance),
        
        // Estatísticas
        totalRecords: recordEvents.length,
        totalConsents: keyEvents.length,
        totalAccesses: accessEvents.length,
        totalWithdrawals: withdrawEvents.length,
        
        // Dados detalhados
        payments: paymentEvents.map(e => ({
            payer: e.args.payer,
            amount: ethers.utils.formatEther(e.args.amount),
            recordId: e.args.recordId.toString(),
            paymentType: e.args.paymentType,
            timestamp: e.args.timestamp,
            date: new Date(e.args.timestamp * 1000)
        })),
        
        withdrawals: withdrawEvents.map(e => ({
            recipient: e.args.recipient,
            amount: ethers.utils.formatEther(e.args.amount),
            timestamp: e.args.timestamp,
            date: new Date(e.args.timestamp * 1000)
        })),
        
        records: recordEvents.map(e => ({
            id: e.args.id.toString(),
            owner: e.args.owner,
            cidMeta: e.args.cidMeta,
            metaHash: e.args.metaHash,
            timestamp: e.args.timestamp,
            date: new Date(e.args.timestamp * 1000)
        })),
        
        consents: keyEvents.map(e => ({
            recordId: e.args.recordId.toString(),
            patient: e.args.patient,
            doctor: e.args.doctor,
            nonce: e.args.nonce,
            expiry: e.args.expiry,
            timestamp: e.args.timestamp,
            accessDurationDays: Math.floor((e.args.expiry - e.args.timestamp) / 86400),
            date: new Date(e.args.timestamp * 1000),
            expiryDate: new Date(e.args.expiry * 1000)
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
console.log("Dashboard Admin:", adminData);
```

## Estrutura Técnica

### Componentes Principais

#### 1. Smart Contract (Blockchain)

**Contrato**: `MedicalRecords.sol` (UUPS upgradeable)

**Funções Principais:**
- `createRecord()`: Cria novo prontuário (requer pagamento de 0.0001 ETH)
- `grantConsent()`: Paciente concede acesso a médico
- `revokeConsent()`: Revoga acesso
- `revokeRecord()`: Paciente revoga seu próprio registro
- `logAccess()`: Médico registra quando acessou (auditoria)
- `withdraw()`: Admin retira fundos acumulados
- `pause()` / `unpause()`: Admin pausa/despausa contrato (emergência)

**Funções de Visualização (Admin):**
- `getAdminAddress()`: Endereço do administrador
- `getRecordCreationFee()`: Taxa de criação (0.0001 ETH)
- `getTotalPayments()`: Total de pagamentos recebidos
- `getPaymentsByPayer(address)`: Total pago por uma wallet específica
- `getContractBalance()`: Saldo acumulado no contrato
- `getRecord(recordId)`: Detalhes de um registro
- `getConsent(recordId, doctor, nonce)`: Detalhes de um consentimento

**Armazenamento On-Chain:**
- CID do IPFS (onde está o dado criptografado)
- Hash do conteúdo (verificação de integridade)
- Consentimentos e permissões
- Fundos acumulados (ETH)
- Contadores de pagamentos
- **NÃO armazena**: chaves de criptografia, dados sensíveis

**Eventos de Rastreamento:**
- `RecordCreated`: Criação de registros (id, owner, cidMeta, metaHash, timestamp)
- `PaymentReceived`: Todos os pagamentos (payer, recipient, amount, recordId, paymentType, timestamp)
- `PaymentWithdrawn`: Retiradas de fundos (recipient, amount, timestamp)
- `ConsentGranted`: Consentimentos concedidos (recordId, patient, doctor, expiry, nonce)
- `ConsentKeyGenerated`: Chaves geradas para rastreamento admin (recordId, patient, doctor, nonce, expiry, timestamp)
- `ConsentRevoked`: Consentimentos revogados (recordId, patient, doctor, nonce)
- `AccessLogged`: Acessos aos registros (recordId, accessor, patient, timestamp, action)

#### 2. Armazenamento Descentralizado (IPFS)

**O que armazena**: Metadata criptografada em JSON

**Formato**:
```json
{
  "schema": "medical-record-payload@1",
  "timestamp": 1700000000,
  "iv": "<base64>",
  "encrypted": "<base64>",
  "authTag": "<base64>"
}
```

#### 3. Criptografia

**Symmetric (AES-256-GCM)**:
- Uma chave por registro (gerada usando chave mestra global)
- Criptografa o metadata antes de upload
- Chave compartilhada via ECIES

**Assymmetric (ECIES - secp256k1)**:
- Paciente criptografa chave simétrica com chave pública do médico
- Médico descriptografa com sua chave privada
- Compartilhamento off-chain (QR code, email seguro, etc.)

**Assinaturas (EIP-712)**:
- Consentimentos assinados pelo paciente
- Previne falsificação e replay attacks
- Verificação on-chain

### Estrutura de Dados

#### MedicalRecord (On-Chain)
```solidity
{
  id: uint256,           // ID único
  owner: address,         // Wallet do paciente
  cidMeta: string,        // CID do IPFS
  metaHash: bytes32,      // Hash para verificação
  timestamp: uint64,      // Data de criação
  revoked: bool           // Se foi revogado
}
```

#### Consent (On-Chain)
```solidity
{
  recordId: uint256,      // ID do registro
  patient: address,       // Paciente
  doctor: address,        // Médico autorizado
  expiry: uint64,         // Data de expiração
  nonce: bytes32,         // Proteção contra replay
  revoked: bool           // Se foi revogado
}
```

#### Metadata (Off-Chain, Criptografado)
```json
{
  "schema": "medical-record-metadata@1",
  "createdAt": "2024-01-01T00:00:00Z",
  "patientHash": "0x...",
  "examType": "blood-test",
  "date": "2024-01-01",
  "files": ["QmImage1", "QmImage2"],
  "notesHash": "0x..."
}
```

## Diferenciais Competitivos

### vs. Sistemas Tradicionais (Hospitais)

| Aspecto | Sistema Tradicional | Este Sistema |
|---------|---------------------|--------------|
| **Controle** | Hospital controla | Paciente controla |
| **Portabilidade** | Difícil transferência | Acesso de qualquer lugar |
| **Privacidade** | Dados em servidor central | Criptografado, descentralizado |
| **Auditoria** | Logs internos | Blockchain transparente |
| **Custos** | Infraestrutura central | Pay-per-use blockchain (0.0001 ETH ≈ US$0.43) |
| **Transparência** | Limitada | Total (via eventos blockchain) |

### vs. Outras Soluções Blockchain

- **Upgradeable**: Contrato pode evoluir sem perder dados
- **EIP-712**: Assinaturas padronizadas e verificáveis
- **Zero-knowledge on-chain**: Nenhuma informação sensível exposta
- **Flexível**: Estrutura permite diferentes tipos de exames/registros
- **Rastreamento Completo**: Admin tem visibilidade total via eventos
- **Gestão de Fundos**: Sistema robusto de acumulação e retirada

## Casos de Uso

### 1. Consulta Médica
- Paciente leva QR code com consentimento
- Médico escaneia, recebe chave criptografada
- Acessa histórico completo do paciente
- Registra nova consulta no sistema
- Admin pode rastrear acesso via eventos

### 2. Segunda Opinião
- Paciente compartilha registros com outro médico
- Consentimento temporário (ex: 30 dias)
- Médico acessa sem depender do hospital original
- Admin rastreia compartilhamentos via `ConsentKeyGenerated`

### 3. Emergência
- Paciente pode conceder acesso de emergência
- Consentimento com expiração curta (ex: 24h)
- Médico de emergência acessa dados críticos
- Admin monitora acessos de emergência via `AccessLogged`

### 4. Pesquisa Médica
- Paciente pode compartilhar dados anonimizados
- Consentimento específico para pesquisa
- Dados agregados sem expor identidade
- Admin pode analisar padrões via eventos agregados

## Riscos e Mitigações

### Riscos Técnicos

| Risco | Mitigação |
|-------|-----------|
| Perda de chave privada | Backup seguro, hardware wallet, recuperação social (futuro) |
| Ataque ao contrato | Auditoria de segurança, upgrade controlado por multisig, função pause para emergência |
| IPFS downtime | Pinata garante disponibilidade, múltiplos pinning services |
| Gas costs altos | Otimizações, Layer 2 (Arbitrum, Polygon) |
| Perda de fundos | Fundos acumulados no contrato, apenas admin pode retirar, função pause para proteção |
| Falta de rastreamento | Sistema completo de eventos permite monitoramento total |

### Riscos Regulatórios

- **LGPD/GDPR**: Sistema atende requisitos (dados criptografados, controle do paciente)
- **HIPAA**: Pode precisar de ajustes para conformidade total
- **Regulação de cripto**: Monitorar mudanças regulatórias
- **Auditoria**: Eventos blockchain fornecem trilha de auditoria completa

## Roadmap de Evolução

### Fase 1 (Atual - Implementado)
- ✅ Contrato básico funcionando
- ✅ Criptografia end-to-end
- ✅ Sistema de consentimento
- ✅ Sistema de pagamento (0.0001 ETH por registro)
- ✅ Acumulação de fundos no contrato
- ✅ Função de retirada para admin
- ✅ Controles de emergência (pause/unpause)
- ✅ Rastreamento completo de eventos para admin
- ✅ Funções de visualização para estatísticas
- ✅ Dashboard de admin via eventos

### Fase 2 (Próximos Passos)
- [ ] Interface web completa
- [ ] Integração com wallets (MetaMask, WalletConnect)
- [ ] App mobile
- [ ] Integração com Pinata API
- [ ] Dashboard admin visual
- [ ] Relatórios de analytics

### Fase 3 (Futuro)
- [ ] Zero-knowledge proofs para privacidade adicional
- [ ] Multi-chain support
- [ ] Integração com dispositivos médicos IoT
- [ ] Marketplace de dados (com consentimento)
- [ ] API para integração com sistemas hospitalares
- [ ] Machine learning para detecção de padrões (com consentimento)

## Conclusão

Este sistema oferece uma **alternativa descentralizada e centrada no paciente** para gestão de prontuários médicos, combinando:

- **Tecnologia blockchain** para transparência e imutabilidade
- **Criptografia forte** para privacidade
- **Controle do paciente** sobre seus próprios dados
- **Interoperabilidade** com sistemas existentes
- **Modelo de receita sustentável** com taxa por registro (0.0001 ETH ≈ US$0.43)
- **Controles administrativos robustos** com gestão de fundos e emergência
- **Rastreamento completo** de todas as operações para auditoria e transparência
- **Visibilidade total para admin** através de eventos e funções de visualização

O modelo é **escalável, seguro, economicamente viável e alinhado com tendências de privacidade e descentralização** na área de saúde digital. O sistema de pagamento garante sustentabilidade financeira enquanto mantém custos acessíveis para pacientes, e os controles administrativos permitem gestão segura e responsiva do sistema. O rastreamento completo via eventos permite ao admin monitorar toda a atividade do sistema, garantindo transparência e capacidade de auditoria.
