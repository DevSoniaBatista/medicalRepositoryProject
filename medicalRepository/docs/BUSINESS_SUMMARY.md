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

## Modelo de Negócio

### Participantes

- **Paciente**: Proprietário dos registros, controla acesso via wallet
- **Médico/Profissional de Saúde**: Acessa registros apenas com consentimento explícito do paciente
- **Rede Blockchain**: Ethereum (ou compatível) para registro de metadados e consentimentos
- **IPFS/Pinata**: Armazenamento descentralizado dos dados criptografados

### Fluxo de Operação Completo

#### Passo 1: Paciente Cria Registro Médico

**1.1. Coleta de Dados (Interface JavaScript)**
- Paciente acessa interface web (`offchain-app/index.html`)
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
  - **Chave Simétrica**: 32 bytes aleatórios (AES-256)
  - **IV (Vetor de Inicialização)**: 12 bytes aleatórios
  - **Payload Cifrado**: Metadata criptografado com AES-GCM
- Resultados exibidos na tela:
  - Metadata JSON (texto plano, antes de cifrar)
  - Payload cifrado (JSON com `encrypted`, `iv`, `authTag`)
  - Chave simétrica em hexadecimal

**1.3. Upload para IPFS (Pinata)**
- Paciente copia o **Payload Cifrado** (JSON completo)
- Faz upload para Pinata usando API (ver `docs/PINATA_EXAMPLES.md`)
- Recebe **CID** do IPFS (ex: `QmXyZ123...`)

**1.4. Registro On-Chain**
- Paciente calcula hash do payload cifrado: `keccak256(payloadCifrado)`
- Chama `createRecord()` no smart contract:
  ```solidity
  createRecord(
      patientAddress,    // msg.sender
      cidMeta,          // CID do IPFS
      metaHash          // Hash do payload
  )
  ```
- Contrato emite evento `RecordCreated` com ID do registro

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
- Contrato verifica assinatura e armazena consentimento
- Emite evento `ConsentGranted`

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
- Contrato emite evento `AccessLogged` para auditoria

## Como Obter os Dados do Formulário JavaScript

### Interface Web (`offchain-app/`)

O sistema inclui uma interface web simples para coletar dados do paciente e gerar o payload cifrado.

**Estrutura do Projeto:**
```
offchain-app/
├── index.html      # Formulário HTML
├── styles.css      # Estilos
├── script.js       # Lógica de criptografia
├── package.json    # Dependências
└── README.md       # Instruções
```

### Como Executar

```bash
cd offchain-app
npm install
npm run start
# Acesse http://127.0.0.1:8080
```

### Coleta de Dados

**Campos do Formulário:**
1. **Patient Hash** (obrigatório): Hash identificador do paciente
2. **Tipo de Exame** (obrigatório): Tipo de exame médico
3. **Data do Exame** (obrigatório): Data em formato ISO
4. **Notes Hash** (opcional): Hash de notas médicas
5. **CIDs de Arquivos**: Lista de CIDs do IPFS (um por linha)

**Processamento Automático:**
- Ao clicar em "Gerar Payload Cifrado", o JavaScript:
  1. Coleta dados do formulário via `FormData`
  2. Constrói objeto JSON padronizado
  3. Gera chave simétrica aleatória (32 bytes)
  4. Criptografa metadata com AES-256-GCM
  5. Gera payload final com `encrypted`, `iv`, `authTag`

**Saídas Geradas:**
- **Metadata JSON**: Dados originais (antes de cifrar) - para referência
- **Payload Cifrado**: JSON pronto para upload ao IPFS
- **Chave Simétrica**: Hexadecimal da chave (para compartilhar com médico)

### Exemplo de Uso

```javascript
// 1. Dados coletados do formulário
const formData = {
  patientHash: "0x1234...",
  examType: "blood-test",
  examDate: "2024-01-01",
  notesHash: "0x5678...",
  files: ["QmImage1", "QmImage2"]
};

// 2. Metadata JSON gerado
const metadata = {
  schema: "medical-record-metadata@1",
  createdAt: "2024-01-01T00:00:00Z",
  patientHash: "0x1234...",
  examType: "blood-test",
  date: "2024-01-01",
  files: ["QmImage1", "QmImage2"],
  notesHash: "0x5678..."
};

// 3. Payload cifrado (resultado final)
const payload = {
  schema: "medical-record-payload@1",
  timestamp: 1704067200,
  iv: "<base64>",
  encrypted: "<base64>",
  authTag: "<base64>"
};

// 4. Chave simétrica (hex)
const symKey = "a1b2c3d4e5f6..."; // 64 caracteres hex
```

## Estrutura Técnica

### Componentes Principais

#### 1. Smart Contract (Blockchain)
- **Contrato**: `MedicalRecords.sol` (UUPS upgradeable)
- **Funções Principais**:
  - `createRecord()`: Cria novo prontuário
  - `grantConsent()`: Paciente concede acesso a médico
  - `revokeConsent()`: Revoga acesso
  - `logAccess()`: Médico registra quando acessou
- **Armazenamento On-Chain**:
  - CID do IPFS (onde está o dado criptografado)
  - Hash do conteúdo (verificação de integridade)
  - Consentimentos e permissões
  - **NÃO armazena**: chaves de criptografia, dados sensíveis

#### 2. Armazenamento Descentralizado (IPFS)
- **O que armazena**: Metadata criptografada em JSON
- **Formato**:
  ```json
  {
    "encrypted": "<dados cifrados>",
    "iv": "<vetor de inicialização>",
    "authTag": "<tag de autenticação>",
    "schema": "medical-record-metadata@1",
    "timestamp": 1700000000
  }
  ```

#### 3. Criptografia

**Symmetric (AES-256-GCM)**:
- Uma chave por registro
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
| **Portabilidade** | Dificil transferência | Acesso de qualquer lugar |
| **Privacidade** | Dados em servidor central | Criptografado, descentralizado |
| **Auditoria** | Logs internos | Blockchain transparente |
| **Custos** | Infraestrutura central | Pay-per-use blockchain |

### vs. Outras Soluções Blockchain

- **Upgradeable**: Contrato pode evoluir sem perder dados
- **EIP-712**: Assinaturas padronizadas e verificáveis
- **Zero-knowledge on-chain**: Nenhuma informação sensível exposta
- **Flexível**: Estrutura permite diferentes tipos de exames/registros

## Casos de Uso

### 1. Consulta Médica
- Paciente leva QR code com consentimento
- Médico escaneia, recebe chave criptografada
- Acessa histórico completo do paciente
- Registra nova consulta no sistema

### 2. Segunda Opinião
- Paciente compartilha registros com outro médico
- Consentimento temporário (ex: 30 dias)
- Médico acessa sem depender do hospital original

### 3. Emergência
- Paciente pode conceder acesso de emergência
- Consentimento com expiração curta (ex: 24h)
- Médico de emergência acessa dados críticos

### 4. Pesquisa Médica
- Paciente pode compartilhar dados anonimizados
- Consentimento específico para pesquisa
- Dados agregados sem expor identidade

## Modelo de Receita (Potencial)

### Opções de Monetização

1. **Taxa por Registro**: Pequena taxa em ETH/token por `createRecord()`
2. **Assinatura Mensal**: Paciente paga para manter registros ativos
3. **API Premium**: Hospitais/clínicas pagam para integrar com sistema
4. **Serviços Adicionais**:
   - Backup de chaves (custodial recovery)
   - Integração com dispositivos IoT
   - Analytics agregados (com consentimento)

## Riscos e Mitigações

### Riscos Técnicos

| Risco | Mitigação |
|-------|-----------|
| Perda de chave privada | Backup seguro, hardware wallet, recuperação social (futuro) |
| Ataque ao contrato | Auditoria de segurança, upgrade controlado por multisig |
| IPFS downtime | Pinata garante disponibilidade, múltiplos pinning services |
| Gas costs altos | Otimizações, Layer 2 (Arbitrum, Polygon) |

### Riscos Regulatórios

- **LGPD/GDPR**: Sistema atende requisitos (dados criptografados, controle do paciente)
- **HIPAA**: Pode precisar de ajustes para conformidade total
- **Regulação de cripto**: Monitorar mudanças regulatórias

## Roadmap de Evolução

### Fase 1 (Atual)
- ✅ Contrato básico funcionando
- ✅ Criptografia end-to-end
- ✅ Sistema de consentimento

### Fase 2 (Próximos Passos)
- [ ] Interface web completa
- [ ] Integração com wallets (MetaMask, WalletConnect)
- [ ] App mobile
- [ ] Integração com Pinata API

### Fase 3 (Futuro)
- [ ] Zero-knowledge proofs para privacidade adicional
- [ ] Multi-chain support
- [ ] Integração com dispositivos médicos IoT
- [ ] Marketplace de dados (com consentimento)

## Conclusão

Este sistema oferece uma **alternativa descentralizada e centrada no paciente** para gestão de prontuários médicos, combinando:

- **Tecnologia blockchain** para transparência e imutabilidade
- **Criptografia forte** para privacidade
- **Controle do paciente** sobre seus próprios dados
- **Interoperabilidade** com sistemas existentes

O modelo é **escalável, seguro e alinhado com tendências de privacidade e descentralização** na área de saúde digital.

