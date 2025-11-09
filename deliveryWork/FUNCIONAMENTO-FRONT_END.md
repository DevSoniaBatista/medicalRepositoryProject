# Documentação do Sistema Medical Records

## Visão Geral

Sistema descentralizado de registros médicos que utiliza:
- **Blockchain** (Ethereum/Sepolia) para armazenar metadados e controlar acesso
- **IPFS/Pinata** para armazenar dados criptografados off-chain
- **Criptografia AES-256-GCM** para proteger dados sensíveis
- **EIP-712** para assinaturas de consentimento
- **MetaMask** para autenticação via carteira
- **Sistema de Pagamento**: Taxa de 0.0001 ETH (≈ US$0.43) por registro criado
- **Chave Mestra Global**: Uma única chave configurada no servidor para todos os registros

---

## Estrutura de Páginas

### 1. **index.html** (Página Inicial)

**URL:** `/` ou `index.html`

**Funcionalidade:**
- Ponto de entrada do sistema
- Conecta a carteira MetaMask do usuário
- Verifica automaticamente se já está conectado (não mostra tela de conexão se já conectado)
- Após conexão, oferece três opções:
  - **Acesso Paciente**: Para pacientes gerenciarem seus registros
  - **Acesso Médico**: Para médicos acessarem registros com chave de acesso
  - **Acesso Admin**: Para administradores gerenciarem o sistema (apenas se a carteira for admin)
- **Barra superior fixa**: Exibe endereço da carteira conectada e botão de desconectar
- **Informações do Contrato**: Exibe endereço do contrato, rede e Chain ID na página inicial

**Fluxo:**
1. Usuário acessa a página
2. Sistema verifica automaticamente se já está conectado
3. Se não conectado, exibe botão "Conectar MetaMask"
4. Se conectado, exibe menu diretamente
5. Sistema verifica se a carteira é admin e mostra botão de acesso admin se for
6. Usuário clica em "Conectar MetaMask" (se necessário)
7. Autoriza conexão na MetaMask
8. Sistema valida rede (Sepolia) e troca automaticamente se necessário
9. Sistema exibe menu com opções de acesso

**Recursos:**
- **Verificação automática de conexão**: Detecta se carteira já está conectada ao carregar
- **Flag de desconexão manual**: Sistema usa flag `manualDisconnect` no localStorage para evitar reconexão automática imediata após desconectar
- **Validação de rede**: Verifica e solicita troca para Sepolia se necessário
- **Barra superior fixa**: Endereço da carteira e botão desconectar sempre visíveis quando conectado
- **Desconexão completa**: 
  - Limpa todo o localStorage
  - Define flag de desconexão manual para evitar reconexão automática
  - Redireciona para `index.html?disconnected=true`
  - Reseta estado visual de todas as páginas
- **Detecção de Admin**: Verifica automaticamente se a carteira conectada tem permissões de admin

**Arquivos relacionados:**
- `home.js`: Lógica de conexão e navegação

---

### 2. **patient.html** (Acesso do Paciente)

**URL:** `patient.html`

**Funcionalidade:**
Interface completa para pacientes gerenciarem seus registros médicos.

#### 2.1. Menu Principal
Após conectar carteira, o paciente vê três opções:

##### a) **Criar Novo Exame**
- Permite criar e registrar um novo exame médico na blockchain
- **⚠️ PAGAMENTO OBRIGATÓRIO**: Requer pagamento de 0.0001 ETH (≈ US$0.43) por registro
- **Fluxo completo:**
  1. Paciente preenche formulário:
     - Tipo de exame (ex: blood-test, x-ray)
     - Data do exame
     - CIDs de arquivos (opcional - pode usar página de upload)
     - Notes Hash (opcional)
  2. Sistema gera automaticamente:
     - Metadata em JSON padronizado
     - **Usa chave mestre global** (obtida do backend via `/config`)
     - IV (vetor de inicialização, 12 bytes)
     - Payload cifrado (AES-256-GCM)
  3. Upload automático ao Pinata:
     - Envia payload cifrado via backend (`POST /upload`)
     - Recebe CID do IPFS e hash SHA3-256
  4. **Registro na blockchain com pagamento:**
     - Sistema obtém taxa de criação do contrato (`getRecordCreationFee()`)
     - Verifica se contrato está pausado
     - Verifica saldo suficiente (taxa + gas)
     - Chama `createRecord()` com pagamento obrigatório: `{value: 0.0001 ether}`
     - Contrato valida que `msg.value == 0.0001 ether` (reverte se diferente)
     - Armazena CID e hash on-chain
     - **Acumula pagamento no contrato** (não transfere imediatamente)
     - Retorna Record ID
  5. **Eventos emitidos:**
     - `RecordCreated(id, owner, cidMeta, metaHash, timestamp)`
     - `PaymentReceived(payer, recipient, amount, recordId, paymentType, timestamp)`
  6. Exibe resultados:
     - CID do IPFS
     - Record ID
     - Valor pago (0.0001 ETH)
     - Link para visualizar no block explorer

**Dados gerados:**
- **Metadata JSON**: Dados do exame em formato estruturado
- **Payload Cifrado**: Metadata criptografado com AES-256-GCM usando chave mestre global
- **Chave Mestre Global**: Uma única chave configurada no servidor (`.env`), usada por todos os pacientes e médicos
  - Obtida do backend via `GET /config` ou `GET /api/config`
  - NUNCA armazenada no navegador
  - NUNCA armazenada on-chain
  - Incluída automaticamente na chave de acesso quando compartilha com médico

##### b) **Ver Histórico**
- Lista todos os registros médicos do paciente na blockchain com visualização completa
- **Fluxo:**
  1. Busca eventos `RecordCreated` na blockchain filtrados por endereço do paciente
  2. Para cada evento, busca detalhes do registro via `getRecord()`
  3. Busca dados criptografados do IPFS usando o CID
  4. Obtém chave mestre global do backend
  5. Descriptografa usando chave mestre global (AES-256-GCM)
  6. Exibe cada registro com:
     - Record ID
     - Data do registro formatada em português
     - CID do IPFS e hash do metadata
     - **Dados descriptografados completos:**
       - Tipo de exame
       - Data do exame formatada
       - Endereço do paciente
       - Data de criação
       - **Arquivos do exame com visualização:**
         - **Imagens**: Exibidas inline na página (max 500px altura)
         - **PDFs**: Visualizador incorporado (iframe)
         - **Outros arquivos**: Link de download
         - Detecção automática de tipo de arquivo (HTTP HEAD + magic bytes)
         - Validação de CIDs (detecta se é metadata criptografado vs arquivo real)
       - Notes hash (se disponível)
       - Metadata completo em JSON (expansível em `<details>`)
  7. Filtra registros revogados automaticamente
  8. **Tratamento de erros robusto:**
     - Continua processando mesmo se um registro falhar
     - Exibe mensagens amigáveis para registros que falharam
     - Mostra detalhes técnicos em seção expansível para debug

##### c) **Gerar Chave de Acesso**
- Cria chave de acesso temporária para compartilhar com médico
- **Fluxo:**
  1. Paciente informa:
     - Endereço da carteira do médico
     - Dias de validade (1-365 dias)
     - ID do registro específico (opcional - se vazio, gera para todos)
  2. Sistema gera para cada registro:
     - Nonce único (32 bytes aleatórios)
     - Timestamp de expiração
     - Assinatura EIP-712 do paciente
  3. Registra consentimento na blockchain:
     - Chama `grantConsent()` para cada registro
     - Armazena consentimento on-chain
  4. **Eventos emitidos:**
     - `ConsentGranted(recordId, patient, doctor, expiry, nonce)`
     - `ConsentKeyGenerated(recordId, patient, doctor, nonce, expiry, timestamp)` - para rastreamento admin
  5. Sistema obtém chave mestre global do backend
  6. Gera chave master codificada (base64):
     - Contém todos os nonces e assinaturas
     - Informações do paciente e médico
     - Data de expiração
     - **Chave mestre global incluída automaticamente**
  7. Paciente compartilha:
     - **Apenas a chave de acesso (codificada)** - já contém tudo necessário!
     - Não precisa compartilhar chave de descriptografia separadamente

**Arquivos relacionados:**
- `patient.js`: Lógica completa do paciente
- `blockchain.js`: Funções de interação com blockchain
- `server/index.js`: Backend para upload ao Pinata

---

### 3. **doctor-access.html** (Acesso do Médico)

**URL:** `doctor-access.html`

**Funcionalidade:**
Interface para médicos acessarem registros médicos com autorização do paciente.

**Fluxo completo:**
1. **Conectar Carteira:**
   - Médico conecta sua carteira MetaMask
   - Sistema verifica automaticamente se já está conectado
   - Sistema valida que o endereço corresponde à chave de acesso

2. **Inserir Credenciais:**
   - **Chave de Acesso**: Código base64 fornecido pelo paciente
   - **Não precisa mais de chave de descriptografia separada** - está incluída na chave de acesso!

3. **Validação:**
   - Decodifica chave de acesso
   - Extrai chave mestre global de descriptografia automaticamente
   - Verifica se o endereço do médico corresponde
   - Verifica se a chave não expirou
   - Para cada registro, verifica consentimento via `getConsent()`

4. **Busca e Descriptografia:**
   - Para cada registro autorizado:
     - Busca dados do IPFS usando o CID
     - Descriptografa usando chave mestre global (AES-256-GCM)
     - Exibe metadata completo

5. **Registro de Acesso (Auditoria):**
   - Médico pode chamar `logAccess()` para registrar acesso:
     ```solidity
     logAccess(recordId, "viewed")
     ```
   - Emite evento `AccessLogged(recordId, accessor, patient, timestamp, action)`
   - Admin pode rastrear todos os acessos através deste evento

6. **Exibição:**
   - Mostra todos os registros acessíveis (processa todos, mesmo se alguns falharem)
   - Exibe contador de progresso: "X de Y registros carregados"
   - Para cada registro, exibe dados descriptografados:
     - Tipo de exame
     - Data formatada em português
     - Endereço do paciente
     - Data de criação
     - **Arquivos do exame com visualização:**
       - **Imagens**: Exibidas inline na página (max 500px altura, responsivo)
       - **PDFs**: Visualizador incorporado (iframe, min 600px altura)
       - **Outros arquivos**: Link de download
       - Detecção automática de tipo de arquivo (HTTP HEAD + magic bytes)
       - Validação de CIDs (detecta se é metadata criptografado vs arquivo real)
       - Mensagens de erro amigáveis se CID inválido
     - Notes hash (se disponível)
     - Metadata completo em JSON (expansível em `<details>`)
   - Cards de erro para registros que falharam ao processar

**Recursos:**
- **Processamento robusto**: Continua processando mesmo se um registro falhar
- **Visualização de arquivos**: Imagens e PDFs exibidos diretamente na página
- **Detecção de erros**: Identifica CIDs inválidos (metadata vs arquivos) com mensagens claras
- **Feedback de progresso**: Mostra contador "X de Y registros carregados"
- **Tratamento de erros**: Cards de erro para registros que falharam, com detalhes técnicos expansíveis
- **Barra superior**: Endereço da carteira e botão desconectar sempre visíveis
- **Validação de consentimento**: Verifica cada consentimento via `getConsent()` antes de processar

**Arquivos relacionados:**
- `doctor-access.js`: Lógica de acesso médico
- `blockchain.js`: Funções de verificação e busca

---

### 4. **admin.html** (Painel Administrativo)

**URL:** `admin.html`

**Funcionalidade:**
Interface completa para administradores gerenciarem o sistema, visualizar estatísticas e controlar o contrato.

**Acesso:**
- Apenas carteiras com `DEFAULT_ADMIN_ROLE` podem acessar
- Sistema verifica automaticamente se a carteira conectada é admin
- Se não for admin, exibe alerta e não permite acesso

**Funcionalidades:**

#### 4.1. Status do Contrato
- **Status**: Pausado ou Ativo
- **Endereço do Contrato**: Endereço do proxy/implementação
- **Endereço do Admin**: Endereço que recebe os fundos
- **Taxa de Criação**: Valor da taxa (0.0001 ETH)
- **Permissões**: Exibe se a carteira tem `DEFAULT_ADMIN_ROLE` e `UPGRADER_ROLE`

#### 4.2. Informações de Pagamento
- **Saldo Acumulado**: Total de ETH acumulado no contrato (aguardando retirada)
- **Total de Pagamentos**: Soma de todos os pagamentos recebidos
- **Taxa por Registro**: Valor da taxa de criação (0.0001 ETH)
- **Estatísticas por Pagador**: Lista de endereços e valores pagos por cada um

#### 4.3. Ações Administrativas

**a) Retirar Fundos:**
- Função: `withdraw()`
- Requisitos: `DEFAULT_ADMIN_ROLE` e saldo > 0
- Ação: Transfere todo o saldo acumulado para endereço do admin
- Evento: `PaymentWithdrawn(recipient, amount, timestamp)`
- ⚠️ **Importante**: Retira TODOS os fundos acumulados de uma vez

**b) Pausar Contrato:**
- Função: `pause()`
- Requisitos: `DEFAULT_ADMIN_ROLE` e contrato não pausado
- Ação: Pausa todas as operações de estado
- **Funções Bloqueadas quando pausado:**
  - `createRecord()` - Não é possível criar novos registros
  - `grantConsent()` - Não é possível conceder consentimentos
  - `logAccess()` - Não é possível registrar acessos
- **Funções que Funcionam quando pausado:**
  - `withdraw()` - Admin ainda pode retirar fundos (função de emergência)
  - Todas as funções de visualização (`getRecord()`, `getContractBalance()`, etc.)
  - `revokeRecord()` e `revokeConsent()`

**c) Despausar Contrato:**
- Função: `unpause()`
- Requisitos: `DEFAULT_ADMIN_ROLE` e contrato pausado
- Ação: Retoma todas as operações normais

**d) Atualizar Dados:**
- Recarrega todas as informações do contrato
- Busca eventos recentes da blockchain
- Atualiza estatísticas e histórico

#### 4.4. Histórico de Eventos
- **Eventos de Pagamento** (`PaymentReceived`):
  - Pagador, valor, recordId, tipo de pagamento, timestamp
  - Filtrados por endereço do admin (recipient)
  
- **Eventos de Retirada** (`PaymentWithdrawn`):
  - Recebedor, valor retirado, timestamp
  
- **Eventos de Criação** (`RecordCreated`):
  - ID do registro, owner, CID, hash, timestamp
  
- **Eventos de Consentimento** (`ConsentGranted`, `ConsentKeyGenerated`):
  - Record ID, paciente, médico, nonce, expiração, timestamp
  
- **Eventos de Acesso** (`AccessLogged`):
  - Record ID, médico (acessor), paciente, ação, timestamp

**Recursos:**
- **Atualização em Tempo Real**: Botão "Atualizar Dados" busca eventos mais recentes
- **Filtros**: Eventos podem ser filtrados por tipo
- **Formatação**: Valores em ETH, timestamps convertidos para datas legíveis
- **Links**: Links para block explorer quando disponível

**Arquivos relacionados:**
- `admin.js`: Lógica completa do painel admin
- `blockchain.js`: Funções de interação com blockchain

---

### 5. **upload.html** (Upload de Arquivos)

**URL:** `upload.html`

**Funcionalidade:**
Página auxiliar para fazer upload de arquivos (imagens, PDFs) ao IPFS antes de criar registros.

**Fluxo:**
1. Usuário seleciona um ou mais arquivos (aceita múltiplos arquivos)
2. Sistema envia cada arquivo sequencialmente ao backend (`POST /upload-file`)
3. Backend envia ao Pinata via `pinFileToIPFS`
4. Retorna para cada arquivo:
   - CID do IPFS
   - Hash SHA-256 do arquivo
   - Tamanho do pin
   - Nome do arquivo
   - Timestamp
5. Exibe resultados em cards individuais para cada arquivo
6. Usuário pode:
   - Copiar CID individual de cada arquivo
   - Copiar hash SHA-256 individual
   - Copiar todos os CIDs de uma vez (botão "Copiar CIDs")
   - Enviar CIDs automaticamente para o formulário principal (salva no localStorage e redireciona)
7. Feedback visual durante upload (mensagens de status)
8. Barra superior com endereço da carteira e botão desconectar

**Recursos:**
- Upload múltiplo sequencial (um arquivo por vez)
- Feedback de progresso durante upload
- Armazenamento de CIDs no localStorage para transferência entre páginas
- Validação de tipos de arquivo (aceita imagens e PDFs)

**Arquivos relacionados:**
- `upload.js`: Lógica de upload
- `server/index.js`: Endpoint `/upload-file`

---

### 6. **patient-key.html** (Geração de Chave de Acesso - Página Dedicada)

**URL:** `patient-key.html`

**Funcionalidade:**
Página alternativa dedicada para pacientes gerarem chaves de acesso para médicos. Funcionalidade similar à seção "Gerar Chave de Acesso" em `patient.html`, mas em página separada.

**Fluxo:**
1. Conecta carteira MetaMask (ou detecta conexão existente)
2. Preenche formulário:
   - Endereço da carteira do médico
   - Dias de validade (1-365 dias)
   - ID do registro específico (opcional - se vazio, gera para todos)
3. Opcional: Carregar lista de registros antes de gerar chave
4. Gera chave de acesso (mesmo processo de `patient.html`)
5. Exibe chave codificada em base64
6. Opções:
   - Copiar chave
   - Baixar chave como JSON

**Recursos:**
- Botão para carregar lista de registros antes de gerar chave
- Download da chave como arquivo JSON
- Barra superior com endereço da carteira e botão desconectar

**Arquivos relacionados:**
- `patient-key.js`: Lógica de geração de chave
- `blockchain.js`: Funções de blockchain

---

## Arquitetura Técnica

### Frontend
- **HTML5/CSS3**: Interface responsiva com design futurístico
- **JavaScript ES6+**: Lógica de negócio
- **Web Crypto API**: Criptografia AES-256-GCM no navegador
- **Ethers.js v6**: Interação com blockchain Ethereum

### Backend
- **Node.js/Express**: Servidor de API (desenvolvimento local)
- **Vercel Serverless Functions**: API Routes para produção (`/api/*`)
- **Multer/Busboy**: Upload de arquivos
- **Axios**: Comunicação com Pinata
- **dotenv**: Gerenciamento de variáveis de ambiente

### Blockchain
- **Contrato**: `MedicalRecords.sol` (UUPS Upgradeable)
- **Rede**: Sepolia Testnet (Chain ID: 11155111)
- **Endereço do Proxy**: Configurável via `.env` (`NEXT_PUBLIC_CONTRACT_ADDRESS`)
- **Padrões**: EIP-712 para assinaturas tipadas
- **Configuração**: Endereço do contrato carregado automaticamente do backend via `GET /config` ou `GET /api/config`
- **Validação de rede**: Sistema verifica e solicita troca para Sepolia automaticamente
- **Sistema de Pagamento**: Taxa de 0.0001 ETH por registro criado, acumulada no contrato

### Armazenamento
- **IPFS/Pinata**: Dados criptografados off-chain
- **Blockchain**: Metadados (CID, hash), controle de acesso, fundos acumulados
- **Chave Mestra Global**: Configurada no servidor (`.env`), nunca armazenada no navegador ou on-chain

---

## Fluxo de Dados Completo

### Criação de Registro

```
1. Paciente preenche formulário
   ↓
2. Frontend gera metadata JSON
   ↓
3. Frontend obtém chave mestre global do backend
   ↓
4. Frontend criptografa com AES-256-GCM usando chave mestre
   ↓
5. Frontend envia payload cifrado ao backend
   ↓
6. Backend envia ao Pinata (IPFS)
   ↓
7. Backend retorna CID + hash SHA3-256
   ↓
8. Frontend obtém taxa de criação do contrato (0.0001 ETH)
   ↓
9. Frontend verifica saldo suficiente (taxa + gas)
   ↓
10. Frontend registra na blockchain com pagamento:
    - createRecord{value: 0.0001 ether}(patient, cidMeta, metaHash)
    ↓
11. Contrato valida pagamento e acumula fundos
    ↓
12. Blockchain emite eventos:
    - RecordCreated
    - PaymentReceived
    ↓
13. Registro criado com Record ID único
```

### Compartilhamento com Médico

```
1. Paciente gera chave de acesso:
   - Para cada registro: nonce + assinatura EIP-712
   - Obtém chave mestre global do backend
   ↓
2. Sistema registra consentimento:
   - grantConsent(recordId, doctor, expiry, nonce, signature)
   ↓
3. Blockchain emite eventos:
   - ConsentGranted
   - ConsentKeyGenerated (para rastreamento admin)
   ↓
4. Gera chave master codificada (base64):
   - Contém nonces, assinaturas, informações do paciente/médico
   - Inclui chave mestre global de descriptografia automaticamente
   ↓
5. Paciente compartilha:
   - Apenas chave de acesso (base64) - já contém tudo!
```

### Acesso do Médico

```
1. Médico insere apenas chave de acesso (base64)
   ↓
2. Sistema valida:
   - Decodifica chave
   - Extrai chave mestre global de descriptografia automaticamente
   - Verifica endereço do médico
   - Verifica expiração
   ↓
3. Para cada registro (processa todos, mesmo se alguns falharem):
   - Verifica consentimento via getConsent()
   - Busca registro via getRecord()
   - Busca dados do IPFS usando CID
   ↓
4. Descriptografa dados:
   - Usa chave mestre global extraída da chave de acesso
   - AES-256-GCM decrypt
   ↓
5. Opcional: Registra acesso (auditoria):
   - logAccess(recordId, "viewed")
   - Emite evento AccessLogged (admin pode rastrear)
   ↓
6. Exibe dados descriptografados:
   - Metadata completo
   - Arquivos com visualização (imagens inline, PDFs em iframe)
   - Links para arquivos no IPFS
```

### Gestão Administrativa

```
1. Admin conecta carteira (verifica DEFAULT_ADMIN_ROLE)
   ↓
2. Sistema carrega informações:
   - Status do contrato (pausado/ativo)
   - Saldo acumulado
   - Total de pagamentos
   - Estatísticas por pagador
   ↓
3. Admin pode:
   - Retirar fundos acumulados (withdraw)
   - Pausar/despausar contrato (pause/unpause)
   - Visualizar histórico de eventos
   ↓
4. Sistema busca eventos da blockchain:
   - PaymentReceived (pagamentos)
   - PaymentWithdrawn (retiradas)
   - RecordCreated (criações)
   - ConsentKeyGenerated (chaves geradas)
   - AccessLogged (acessos)
   ↓
5. Exibe dashboard completo com todas as informações
```

---

## Sistema de Pagamento

### Taxa por Registro
- **Valor**: 0.0001 ETH por registro criado (≈ US$0.43, variável com câmbio)
- **Obrigatoriedade**: Pagamento obrigatório ao criar registro via `createRecord()`
- **Método**: Deve ser enviado com a transação (`{value: 0.0001 ether}`)
- **Validação**: Contrato reverte se valor não for exatamente 0.0001 ETH

### Acumulação de Fundos
- Fundos ficam acumulados no contrato (não transferidos imediatamente)
- Contrato mantém saldo ETH que pode ser consultado via `getContractBalance()`
- Total de pagamentos rastreado via `getTotalPayments()`
- Pagamentos por pagador rastreados via `getPaymentsByPayer(address)`

### Retirada de Fundos (Admin)
- Apenas admin pode retirar fundos acumulados
- Função `withdraw()` transfere todo o saldo do contrato para endereço do admin
- Emite evento `PaymentWithdrawn(recipient, amount, timestamp)` quando fundos são retirados
- Função protegida por `DEFAULT_ADMIN_ROLE`

### Eventos de Pagamento
- **PaymentReceived**: Emitido quando paciente paga taxa
  - `payer`: Endereço do paciente
  - `recipient`: Endereço do admin
  - `amount`: 0.0001 ETH (em wei)
  - `recordId`: ID do registro criado
  - `paymentType`: "record_creation"
  - `timestamp`: Timestamp do bloco

- **PaymentWithdrawn**: Emitido quando admin retira fundos
  - `recipient`: Endereço do admin
  - `amount`: Valor retirado
  - `timestamp`: Timestamp da retirada

---

## Chave Mestra Global

### Conceito
- **Uma única chave** configurada no servidor (arquivo `.env`)
- Usada por **todos os pacientes e médicos** para criptografar/descriptografar registros
- **NÃO** armazenada no navegador (localStorage)
- **NÃO** armazenada on-chain
- Obtida do backend via `GET /config` ou `GET /api/config`

### Configuração
```bash
# Gerar chave mestra
node generate-master-key.js

# Adicionar ao .env
NEXT_PUBLIC_MASTER_KEY=chave_hex_64_caracteres
```

### Vantagens
- ✅ **Simplicidade**: Não precisa gerenciar chaves individuais por paciente
- ✅ **Consistência**: Todos os registros usam a mesma chave
- ✅ **Backup**: Chave centralizada no servidor, fácil de fazer backup
- ✅ **Recuperação**: Não há perda de acesso se paciente limpar navegador

### Segurança
- ⚠️ **Importante**: Chave mestra global deve ser mantida em segredo
- ⚠️ **Backup**: Faça backup seguro da chave mestra
- ⚠️ **Rotação**: Se necessário, pode rotacionar chave (requer re-criptografar todos os registros)

---

## Segurança

### Criptografia
- **AES-256-GCM**: Criptografia simétrica com autenticação
- **Chave de 32 bytes**: Chave mestre global configurada no servidor
- **IV único**: 12 bytes aleatórios por registro
- **Auth Tag**: 16 bytes para verificação de integridade

### Blockchain
- **EIP-712**: Assinaturas tipadas para consentimento
- **Nonces únicos**: Previne replay attacks
- **Expiração**: Consentimentos têm data de validade
- **Revogação**: Paciente pode revogar registros e consentimentos
- **Validação de Pagamento**: Contrato valida valor exato do pagamento
- **AccessControl**: Sistema de roles para controle de acesso administrativo

### Armazenamento
- **Chaves nunca on-chain**: Chave mestre global nunca é armazenada na blockchain
- **Dados off-chain**: Apenas metadados (CID, hash) ficam on-chain
- **IPFS**: Dados criptografados armazenados de forma descentralizada
- **Chave Mestra**: Armazenada apenas no servidor (`.env`), nunca no navegador

---

## Variáveis de Ambiente Necessárias

### Backend (`.env`)
```
# Credenciais Pinata (obrigatório)
NEXT_PUBLIC_PINATA_JWT=seu_token_jwt
# ou
NEXT_PUBLIC_PINATA_API_KEY=seu_api_key
NEXT_PUBLIC_PINATA_SECRET=seu_secret_key

# Configuração do contrato blockchain (obrigatório)
NEXT_PUBLIC_CONTRACT_ADDRESS=seu_endereco_do_contrato
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_NETWORK_NAME=Sepolia

# Chave Mestre Global (obrigatório)
# Gere com: node generate-master-key.js
NEXT_PUBLIC_MASTER_KEY=chave_hex_64_caracteres
```

### Vercel (Environment Variables)
As mesmas variáveis devem ser configuradas no painel do Vercel:
- Settings > Environment Variables
- Marcar para Production, Preview e Development

---

## Endpoints da API

### Backend Local (`http://127.0.0.1:3000`)

- **GET `/config`**: Configuração do contrato blockchain
  - Retorna: `{ contractAddress, chainId, networkName, masterKey }`
  - Usado pelo frontend para carregar configuração dinamicamente

- **POST `/upload`**: Upload de payload cifrado ao Pinata
  - Body: JSON com payload cifrado
  - Retorna: `{ cid, metaHash, pinSize, timestamp }`

- **POST `/upload-file`**: Upload de arquivo ao Pinata
  - Body: `multipart/form-data` com campo `file`
  - Retorna: `{ cid, sha256, pinSize, timestamp, fileName }`

- **GET `/health`**: Status do serviço
  - Retorna: `{ status: 'ok', time: ISOString }`

### Vercel Serverless Functions (`/api/*`)

- **GET `/api/config`**: Mesma funcionalidade de `/config`
- **POST `/api/upload`**: Mesma funcionalidade de `/upload`
- **POST `/api/upload-file`**: Mesma funcionalidade de `/upload-file`
- **GET `/api/health`**: Mesma funcionalidade de `/health`

---

## Contrato Blockchain

### Funções Principais

**Paciente:**
- `createRecord(patient, cidMeta, metaHash)` - Cria novo registro (requer pagamento de 0.0001 ETH)
- `getRecord(recordId)` - Busca registro por ID
- `grantConsent(recordId, doctor, expiry, nonce, signature)` - Concede acesso
- `getConsent(recordId, doctor, nonce)` - Verifica consentimento
- `revokeRecord(recordId)` - Revoga registro
- `revokeConsent(recordId, doctor, nonce)` - Revoga consentimento
- `logAccess(recordId, action)` - Registra acesso (auditoria)

**Admin:**
- `getAdminAddress()` - Endereço do administrador
- `getRecordCreationFee()` - Taxa de criação (0.0001 ETH)
- `getTotalPayments()` - Total de pagamentos recebidos
- `getPaymentsByPayer(address)` - Total pago por uma wallet específica
- `getContractBalance()` - Saldo acumulado no contrato
- `withdraw()` - Retira fundos acumulados (apenas admin)
- `pause()` - Pausa contrato (apenas admin)
- `unpause()` - Despausa contrato (apenas admin)
- `paused()` - Verifica se contrato está pausado

### Eventos

**Criação e Pagamento:**
- `RecordCreated(id, owner, cidMeta, metaHash, timestamp)` - Registro criado
- `PaymentReceived(payer, recipient, amount, recordId, paymentType, timestamp)` - Pagamento recebido
- `PaymentWithdrawn(recipient, amount, timestamp)` - Fundos retirados pelo admin

**Consentimento:**
- `ConsentGranted(recordId, patient, doctor, expiry, nonce)` - Consentimento concedido
- `ConsentKeyGenerated(recordId, patient, doctor, nonce, expiry, timestamp)` - Chave gerada (rastreamento admin)
- `ConsentRevoked(recordId, patient, doctor, nonce)` - Consentimento revogado

**Acesso:**
- `AccessLogged(recordId, accessor, patient, timestamp, action)` - Acesso registrado (auditoria)

**Sistema:**
- `ImplementationUpgraded(newImplementation)` - Contrato atualizado

---

## Como Usar

### Para Pacientes

1. Acesse `index.html` (página inicial)
2. Conecte sua carteira MetaMask (ou sistema detecta automaticamente se já conectado)
3. Escolha "Acesso Paciente"
4. **Criar exame:**
   - Preencha dados do exame
   - Sistema criptografa com chave mestre global (obtida do backend)
   - **Pague 0.0001 ETH** ao registrar na blockchain
   - Registro criado com Record ID único
5. **Ver histórico:**
   - Visualize todos seus registros com dados completos descriptografados
   - Veja arquivos inline (imagens, PDFs) diretamente na página
   - Acesse metadata completo em formato JSON expansível
6. **Compartilhar com médico:**
   - Gere chave de acesso informando endereço do médico
   - Sistema inclui chave mestre global automaticamente na chave de acesso
   - Compartilhe apenas a chave de acesso (base64) - já contém tudo!

### Para Médicos

1. Acesse `index.html`
2. Conecte sua carteira MetaMask (ou sistema detecta automaticamente se já conectado)
3. Escolha "Acesso Médico"
4. Cole apenas a chave de acesso fornecida pelo paciente (base64)
5. Sistema extrai chave mestre global automaticamente
6. Visualize os registros descriptografados:
   - Dados do exame formatados
   - Imagens exibidas diretamente na página
   - PDFs visualizáveis no navegador
   - Links para arquivos no IPFS
7. (Opcional) Sistema pode registrar acesso via `logAccess()` para auditoria

### Para Administradores

1. Acesse `index.html` ou `admin.html`
2. Conecte sua carteira MetaMask de administrador
3. Sistema verifica automaticamente se a carteira tem `DEFAULT_ADMIN_ROLE`
4. Escolha "Acesso Admin" ou acesse `admin.html` diretamente
5. **Visualize informações:**
   - Status do contrato (pausado/ativo)
   - Saldo acumulado no contrato
   - Total de pagamentos recebidos
   - Estatísticas por pagador
   - Histórico completo de eventos
6. **Ações administrativas:**
   - **Retirar fundos**: Transfere todo o saldo acumulado para endereço do admin
   - **Pausar contrato**: Pausa operações em caso de emergência
   - **Despausar contrato**: Retoma operações normais
   - **Atualizar dados**: Recarrega informações e eventos recentes

---

## Notas Importantes

✅ **Chave Mestre Global**: Uma única chave configurada no servidor é usada por todos os pacientes e médicos. Esta chave é incluída automaticamente na chave de acesso, então o médico só precisa da chave de acesso (não precisa de chave separada).

✅ **Sistema de Pagamento**: Cada registro criado requer pagamento de 0.0001 ETH (≈ US$0.43). O pagamento é acumulado no contrato e pode ser retirado pelo admin a qualquer momento.

✅ **Rastreamento Completo**: Admin pode rastrear todas as operações através dos eventos emitidos: pagamentos, criações, consentimentos, acessos.

⚠️ **Armazenamento da Chave Mestre**: A chave mestre global é armazenada apenas no servidor (`.env`), nunca no navegador ou on-chain. Faça backup seguro desta chave.

⚠️ **Validade**: Chaves de acesso têm data de expiração. Após expirar, o médico não consegue mais acessar.

⚠️ **Rede**: O sistema está configurado para Sepolia Testnet. O sistema verifica e solicita troca automática se necessário.

⚠️ **Backend**: O backend deve estar rodando (`npm run api`) para uploads funcionarem localmente. Em produção (Vercel), as API Routes são servidas automaticamente.

⚠️ **CIDs de Arquivos**: Certifique-se de usar os CIDs dos arquivos reais (obtidos na página de upload), não o CID do metadata criptografado. O sistema detecta automaticamente CIDs inválidos e exibe mensagens de erro amigáveis.

⚠️ **Desconexão Manual**: Ao clicar em "Desconectar", o sistema define uma flag que impede reconexão automática imediata. Para conectar novamente, clique manualmente no botão "Conectar MetaMask".

⚠️ **Visualização de Arquivos**: Tanto pacientes quanto médicos podem visualizar arquivos inline. O sistema detecta automaticamente o tipo de arquivo e exibe adequadamente (imagens inline, PDFs em iframe, outros como download).

⚠️ **Pagamento Obrigatório**: O pagamento de 0.0001 ETH é obrigatório ao criar um registro. O contrato valida o valor e reverte a transação se o pagamento não for feito corretamente.

⚠️ **Contrato Pausado**: Quando o contrato está pausado, não é possível criar novos registros, conceder consentimentos ou registrar acessos. Apenas funções de visualização e retirada de fundos funcionam.

---

## Estrutura de Arquivos

```
medicalRepository-offchain-app/
├── index.html          # Página inicial (conexão e menu)
├── home.js             # Lógica da página inicial
├── patient.html        # Interface do paciente
├── patient.js          # Lógica do paciente
├── patient-key.html    # Página para gerar chave de acesso
├── patient-key.js      # Lógica de geração de chave
├── doctor-access.html  # Interface do médico
├── doctor-access.js    # Lógica do médico
├── admin.html          # Painel administrativo
├── admin.js            # Lógica do admin
├── upload.html         # Upload de arquivos
├── upload.js           # Lógica de upload
├── blockchain.js       # Funções de blockchain
├── script.js           # Funções auxiliares (legado)
├── styles.css          # Estilos (design futurístico)
├── generate-master-key.js # Script para gerar chave mestra
├── server/
│   └── index.js        # Backend API (desenvolvimento local)
├── api/
│   ├── config.js       # Vercel Serverless Function - Configuração
│   ├── upload.js       # Vercel Serverless Function - Upload payload
│   ├── upload-file.js  # Vercel Serverless Function - Upload arquivo
│   └── health.js       # Vercel Serverless Function - Health check
├── .env                # Variáveis de ambiente (não versionado)
├── vercel.json         # Configuração Vercel
└── docs/
    └── FUNCIONAMENTO.md # Esta documentação
```

---

## Recursos de Interface

### Barra Superior Fixa
- **Presente em**: Todas as páginas (`index.html`, `patient.html`, `doctor-access.html`, `patient-key.html`, `upload.html`, `admin.html`)
- **Endereço da Carteira**: Exibido no topo direito quando conectado
  - Versão curta: `0x1234...5678` (primeiros 6 e últimos 4 caracteres)
  - Versão completa: Endereço completo em uma linha
  - Responsivo: Quebra de linha automática se necessário (`word-break: break-all`)
  - Não truncado: Endereço completo sempre visível
- **Botão Desconectar**: Sempre visível quando conectado
  - Posicionado no topo direito, ao lado do endereço
  - Limpa todo o localStorage
  - Define flag `manualDisconnect` para evitar reconexão automática imediata
  - Redireciona para `index.html?disconnected=true`
  - Reseta estado visual de todas as páginas
  - Implementação robusta com múltiplos event listeners para garantir funcionamento

### Verificação Automática de Conexão
- **Presente em**: Todas as páginas que requerem conexão
- **Processo:**
  1. Ao carregar página, verifica se há flag `manualDisconnect` no localStorage
  2. Se flag presente, não reconecta automaticamente (respeita desconexão manual)
  3. Verifica se MetaMask está instalado
  4. Verifica se há contas conectadas via `eth_accounts`
  5. Verifica se está na rede correta (Sepolia, Chain ID: 11155111)
  6. Se tudo OK, conecta automaticamente e oculta tela de conexão
  7. Se em outra rede, solicita troca automática via prompt
  8. Se não conectado, exibe botão de conexão
- **Aguarda carregamento**: Sistema aguarda `ethers.js` carregar antes de verificar conexão

### Visualização de Arquivos
- **Disponível em**: Página do paciente (histórico) e página do médico (acesso)
- **Imagens**: 
  - Exibidas inline com tamanho máximo de 500px de altura
  - Responsivo (max-width: 100%)
  - Link para abrir em tamanho real em nova aba
  - Tratamento de erro se imagem não carregar
- **PDFs**: 
  - Visualizador incorporado (iframe)
  - Altura mínima de 600px
  - Link para abrir em nova aba
- **Outros arquivos**: Link de download com tipo MIME exibido
- **Detecção automática**: 
  - Identifica tipo de arquivo por HTTP HEAD request (Content-Type)
  - Validação adicional por magic bytes (primeiros bytes do arquivo)
  - Suporta: image/*, application/pdf, application/octet-stream
- **Validação de CIDs**: 
  - Detecta se CID aponta para metadata criptografado (JSON) vs arquivo real
  - Exibe mensagem de erro amigável se CID inválido
  - Sugere usar CIDs obtidos na página de upload
- **Tratamento de erros**: 
  - Cards de erro para arquivos que falharam ao carregar
  - Links alternativos para tentar abrir diretamente
  - Mensagens claras sobre o problema

---

## Funcionalidades Implementadas

✅ **Sistema Completo de Registros Médicos**
- Criação de exames com criptografia end-to-end
- Histórico completo com visualização de arquivos
- Compartilhamento seguro com médicos via chave única

✅ **Sistema de Pagamento**
- Taxa de 0.0001 ETH por registro criado
- Validação automática de pagamento
- Acumulação de fundos no contrato
- Retirada de fundos pelo admin

✅ **Chave Mestre Global**
- Uma única chave configurada no servidor
- Usada por todos os pacientes e médicos
- Incluída automaticamente na chave de acesso
- Nunca armazenada no navegador ou on-chain

✅ **Painel Administrativo**
- Visualização de status do contrato
- Estatísticas de pagamento
- Retirada de fundos
- Pausar/despausar contrato
- Histórico completo de eventos

✅ **Rastreamento Completo**
- Eventos de pagamento
- Eventos de criação
- Eventos de consentimento
- Eventos de acesso
- Dashboard admin com todas as informações

✅ **Visualização de Arquivos**
- Imagens inline
- PDFs em visualizador incorporado
- Detecção automática de tipo
- Validação de CIDs

✅ **Interface Completa**
- Barra superior fixa em todas as páginas
- Verificação automática de conexão
- Desconexão robusta com limpeza completa
- Tratamento de erros amigável

✅ **Processamento Robusto**
- Continua processando mesmo se alguns registros falharem
- Mensagens de erro claras e informativas
- Feedback de progresso

---

## Próximos Passos Sugeridos

- [ ] Adicionar busca de registros por tipo de exame
- [ ] Implementar revogação de consentimento na UI
- [ ] Adicionar notificações quando consentimento expira
- [ ] Adicionar suporte a múltiplas redes blockchain
- [ ] Implementar cache de registros para melhor performance
- [ ] Adicionar exportação de histórico em PDF/JSON
- [ ] Implementar dashboard admin com gráficos e analytics
- [ ] Adicionar filtros avançados no histórico de eventos
- [ ] Implementar notificações push para eventos importantes
- [ ] Adicionar suporte a múltiplas moedas para pagamento
