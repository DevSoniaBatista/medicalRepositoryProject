# Documentação do Sistema Medical Records

## Visão Geral

Sistema descentralizado de registros médicos que utiliza:
- **Blockchain** (Ethereum/Sepolia) para armazenar metadados e controlar acesso
- **IPFS/Pinata** para armazenar dados criptografados off-chain
- **Criptografia AES-256-GCM** para proteger dados sensíveis
- **EIP-712** para assinaturas de consentimento
- **MetaMask** para autenticação via carteira

---

## Estrutura de Páginas

### 1. **index.html** (Página Inicial)

**URL:** `/` ou `index.html`

**Funcionalidade:**
- Ponto de entrada do sistema
- Conecta a carteira MetaMask do usuário
- Verifica automaticamente se já está conectado (não mostra tela de conexão se já conectado)
- Após conexão, oferece duas opções:
  - **Acesso Paciente**: Para pacientes gerenciarem seus registros
  - **Acesso Médico**: Para médicos acessarem registros com chave de acesso
- **Barra superior fixa**: Exibe endereço da carteira conectada e botão de desconectar

**Fluxo:**
1. Usuário acessa a página
2. Sistema verifica automaticamente se já está conectado
3. Se não conectado, exibe botão "Conectar MetaMask"
4. Se conectado, exibe menu diretamente
5. Usuário clica em "Conectar MetaMask" (se necessário)
6. Autoriza conexão na MetaMask
7. Sistema valida rede (Sepolia) e troca automaticamente se necessário
8. Sistema exibe menu com opções de acesso

**Recursos:**
- **Verificação automática de conexão**: Detecta se carteira já está conectada ao carregar
- **Flag de desconexão manual**: Sistema usa flag `manualDisconnect` no localStorage para evitar reconexão automática imediata após desconectar
- **Validação de rede**: Verifica e solicita troca para Sepolia se necessário
- **Barra superior fixa**: Endereço da carteira e botão desconectar sempre visíveis quando conectado
- **Desconexão completa**: 
  - Limpa todo o localStorage (incluindo chaves mestre, CIDs, endereço)
  - Define flag de desconexão manual para evitar reconexão automática
  - Redireciona para `index.html?disconnected=true`
  - Reseta estado visual de todas as páginas

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
- **Fluxo completo:**
  1. Paciente preenche formulário:
     - Tipo de exame (ex: blood-test, x-ray)
     - Data do exame
     - CIDs de arquivos (opcional - pode usar página de upload)
     - Notes Hash (opcional)
  2. Sistema gera automaticamente:
     - Metadata em JSON padronizado
     - **Usa chave mestre única do paciente** (criada automaticamente na primeira vez)
     - IV (vetor de inicialização, 12 bytes)
     - Payload cifrado (AES-256-GCM)
  3. Upload automático ao Pinata:
     - Envia payload cifrado via backend (`POST /upload`)
     - Recebe CID do IPFS e hash SHA3-256
  4. Registro na blockchain:
     - Chama `createRecord()` no contrato
     - Armazena CID e hash on-chain
     - Retorna Record ID
  5. Exibe resultados:
     - CID do IPFS
     - Record ID
     - Chave mestre de descriptografia (armazenada localmente)

**Dados gerados:**
- **Metadata JSON**: Dados do exame em formato estruturado
- **Payload Cifrado**: Metadata criptografado com AES-256-GCM
- **Chave Mestre**: Uma única chave AES-256 por paciente, armazenada no localStorage do navegador
  - Usada para criptografar todos os exames do paciente
  - Incluída automaticamente na chave de acesso quando compartilha com médico
  - NUNCA armazenada on-chain

##### b) **Ver Histórico**
- Lista todos os registros médicos do paciente na blockchain com visualização completa
- **Fluxo:**
  1. Busca eventos `RecordCreated` na blockchain filtrados por endereço do paciente
  2. Para cada evento, busca detalhes do registro via `getRecord()`
  3. Busca dados criptografados do IPFS usando o CID
  4. Descriptografa usando chave mestre do paciente (do localStorage)
  5. Exibe cada registro com:
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
  6. Filtra registros revogados automaticamente
  7. **Tratamento de erros robusto:**
     - Continua processando mesmo se um registro falhar
     - Exibe mensagens amigáveis para registros antigos (criados antes da chave mestre)
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
  4. Sistema obtém chave mestre do paciente (do localStorage)
  5. Gera chave master codificada (base64):
     - Contém todos os nonces e assinaturas
     - Informações do paciente e médico
     - Data de expiração
     - **Chave mestre de descriptografia incluída automaticamente**
  6. Paciente compartilha:
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
   - Extrai chave mestre de descriptografia automaticamente
   - Verifica se o endereço do médico corresponde
   - Verifica se a chave não expirou
   - Para cada registro, verifica consentimento via `getConsent()`

4. **Busca e Descriptografia:**
   - Para cada registro autorizado:
     - Busca dados do IPFS usando o CID
     - Descriptografa usando chave mestre (AES-256-GCM)
     - Exibe metadata completo

5. **Exibição:**
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

### 4. **upload.html** (Upload de Arquivos)

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

### 5. **patient-key.html** (Geração de Chave de Acesso - Página Dedicada)

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

### 6. **Páginas Legadas**

O antigo `index.html` (gerador de metadata) foi substituído pela nova página inicial. As funcionalidades de geração de metadata foram integradas em `patient.html`.

---

## Arquitetura Técnica

### Frontend
- **HTML5/CSS3**: Interface responsiva com design futurístico
- **JavaScript ES6+**: Lógica de negócio
- **Web Crypto API**: Criptografia AES-256-GCM no navegador
- **Ethers.js v6**: Interação com blockchain Ethereum

### Backend
- **Node.js/Express**: Servidor de API
- **Multer**: Upload de arquivos
- **Axios**: Comunicação com Pinata
- **dotenv**: Gerenciamento de variáveis de ambiente

### Blockchain
- **Contrato**: `MedicalRecords.sol` (UUPS Upgradeable)
- **Rede**: Sepolia Testnet (Chain ID: 11155111)
- **Endereço do Proxy**: Configurável via `.env` (padrão: `0x600aa9f85Ff66d41649EE02038cF8e9cfC0BF053`)
- **Padrões**: EIP-712 para assinaturas tipadas
- **Configuração**: Endereço do contrato carregado automaticamente do backend via `GET /config`
- **Validação de rede**: Sistema verifica e solicita troca para Sepolia automaticamente

### Armazenamento
- **IPFS/Pinata**: Dados criptografados off-chain
- **Blockchain**: Metadados (CID, hash) e controle de acesso

---

## Fluxo de Dados Completo

### Criação de Registro

```
1. Paciente preenche formulário
   ↓
2. Frontend gera metadata JSON
   ↓
3. Frontend criptografa com AES-256-GCM
   ↓
4. Frontend envia payload cifrado ao backend
   ↓
5. Backend envia ao Pinata (IPFS)
   ↓
6. Backend retorna CID + hash SHA3-256
   ↓
7. Frontend registra na blockchain:
   - createRecord(patient, cidMeta, metaHash)
   ↓
8. Blockchain emite evento RecordCreated
   ↓
9. Registro criado com Record ID único
```

### Compartilhamento com Médico

```
1. Paciente gera chave de acesso:
   - Para cada registro: nonce + assinatura EIP-712
   - Obtém chave mestre do localStorage
   ↓
2. Sistema registra consentimento:
   - grantConsent(recordId, doctor, expiry, nonce, signature)
   ↓
3. Gera chave master codificada (base64):
   - Contém nonces, assinaturas, informações do paciente/médico
   - Inclui chave mestre de descriptografia automaticamente
   ↓
4. Paciente compartilha:
   - Apenas chave de acesso (base64) - já contém tudo!
```

### Acesso do Médico

```
1. Médico insere apenas chave de acesso (base64)
   ↓
2. Sistema valida:
   - Decodifica chave
   - Extrai chave mestre de descriptografia automaticamente
   - Verifica endereço do médico
   - Verifica expiração
   ↓
3. Para cada registro (processa todos, mesmo se alguns falharem):
   - Verifica consentimento via getConsent()
   - Busca registro via getRecord()
   - Busca dados do IPFS usando CID
   ↓
4. Descriptografa dados:
   - Usa chave mestre extraída da chave de acesso
   - AES-256-GCM decrypt
   ↓
5. Exibe dados descriptografados:
   - Metadata completo
   - Arquivos com visualização (imagens inline, PDFs em iframe)
   - Links para arquivos no IPFS
```

---

## Segurança

### Criptografia
- **AES-256-GCM**: Criptografia simétrica com autenticação
- **Chave de 32 bytes**: Gerada aleatoriamente no navegador
- **IV único**: 12 bytes aleatórios por registro
- **Auth Tag**: 16 bytes para verificação de integridade

### Blockchain
- **EIP-712**: Assinaturas tipadas para consentimento
- **Nonces únicos**: Previne replay attacks
- **Expiração**: Consentimentos têm data de validade
- **Revogação**: Paciente pode revogar registros e consentimentos

### Armazenamento
- **Chaves nunca on-chain**: Chaves simétricas nunca são armazenadas na blockchain
- **Dados off-chain**: Apenas metadados (CID, hash) ficam on-chain
- **IPFS**: Dados criptografados armazenados de forma descentralizada

---

## Variáveis de Ambiente Necessárias

### Backend (`.env`)
```
# Credenciais Pinata (obrigatório)
PINATA_JWT=seu_token_jwt
# ou
PINATA_API_KEY=seu_api_key
PINATA_SECRET=seu_secret_key

# Configuração do contrato blockchain (opcional - usa valores padrão se não definido)
CONTRACT_ADDRESS=0x600aa9f85Ff66d41649EE02038cF8e9cfC0BF053
CHAIN_ID=11155111
NETWORK_NAME=Sepolia
```

---

## Endpoints da API

### Backend (`http://127.0.0.1:3000`)

- **GET `/config`**: Configuração do contrato blockchain
  - Retorna: `{ contractAddress, chainId, networkName }`
  - Usado pelo frontend para carregar configuração dinamicamente

- **POST `/upload`**: Upload de payload cifrado ao Pinata
  - Body: JSON com payload cifrado
  - Retorna: `{ cid, metaHash, pinSize, timestamp }`

- **POST `/upload-file`**: Upload de arquivo ao Pinata
  - Body: `multipart/form-data` com campo `file`
  - Retorna: `{ cid, sha256, pinSize, timestamp, fileName }`

- **GET `/health`**: Status do serviço
  - Retorna: `{ status: 'ok', time: ISOString }`

---

## Contrato Blockchain

### Funções Principais

- **`createRecord(patient, cidMeta, metaHash)`**: Cria novo registro
- **`getRecord(recordId)`**: Busca registro por ID
- **`grantConsent(recordId, doctor, expiry, nonce, signature)`**: Concede acesso
- **`getConsent(recordId, doctor, nonce)`**: Verifica consentimento
- **`revokeRecord(recordId)`**: Revoga registro
- **`revokeConsent(recordId, doctor, nonce)`**: Revoga consentimento

### Eventos

- **`RecordCreated`**: Emitido quando registro é criado
- **`ConsentGranted`**: Emitido quando consentimento é concedido
- **`ConsentRevoked`**: Emitido quando consentimento é revogado

---

## Como Usar

### Para Pacientes

1. Acesse `index.html` (página inicial)
2. Conecte sua carteira MetaMask (ou sistema detecta automaticamente se já conectado)
3. Escolha "Acesso Paciente"
4. **Criar exame:**
   - Preencha dados do exame
   - Sistema criptografa com chave mestre (criada automaticamente)
   - Registra automaticamente na blockchain
   - Chave mestre é armazenada localmente no navegador
5. **Ver histórico:**
   - Visualize todos seus registros com dados completos descriptografados
   - Veja arquivos inline (imagens, PDFs) diretamente na página
   - Acesse metadata completo em formato JSON expansível
6. **Compartilhar com médico:**
   - Gere chave de acesso informando endereço do médico
   - Sistema inclui chave mestre automaticamente na chave de acesso
   - Compartilhe apenas a chave de acesso (base64) - já contém tudo!

### Para Médicos

1. Acesse `index.html`
2. Conecte sua carteira MetaMask (ou sistema detecta automaticamente se já conectado)
3. Escolha "Acesso Médico"
4. Cole apenas a chave de acesso fornecida pelo paciente (base64)
5. Sistema extrai chave mestre automaticamente
6. Visualize os registros descriptografados:
   - Dados do exame formatados
   - Imagens exibidas diretamente na página
   - PDFs visualizáveis no navegador
   - Links para arquivos no IPFS

---

## Notas Importantes

✅ **Chave Mestre Única**: Cada paciente tem uma única chave mestre que descriptografa todos os seus exames. Esta chave é incluída automaticamente na chave de acesso, então o médico só precisa da chave de acesso (não precisa de chave separada).

⚠️ **Armazenamento Local**: A chave mestre é armazenada no `localStorage` do navegador. Se limpar os dados do navegador, a chave será perdida. Para exames futuros, uma nova chave será gerada.

⚠️ **Compatibilidade**: Exames criados antes da implementação da chave mestre podem não ser descriptografáveis com a nova chave. Apenas exames criados após a atualização usam a chave mestre.

⚠️ **Validade**: Chaves de acesso têm data de expiração. Após expirar, o médico não consegue mais acessar.

⚠️ **Rede**: O sistema está configurado para Sepolia Testnet. O sistema verifica e solicita troca automática se necessário.

⚠️ **Backend**: O backend deve estar rodando (`npm run api`) para uploads funcionarem.

⚠️ **CIDs de Arquivos**: Certifique-se de usar os CIDs dos arquivos reais (obtidos na página de upload), não o CID do metadata criptografado. O sistema detecta automaticamente CIDs inválidos e exibe mensagens de erro amigáveis.

⚠️ **Desconexão Manual**: Ao clicar em "Desconectar", o sistema define uma flag que impede reconexão automática imediata. Para conectar novamente, clique manualmente no botão "Conectar MetaMask".

⚠️ **Visualização de Arquivos**: Tanto pacientes quanto médicos podem visualizar arquivos inline. O sistema detecta automaticamente o tipo de arquivo e exibe adequadamente (imagens inline, PDFs em iframe, outros como download).

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
├── upload.html         # Upload de arquivos
├── upload.js           # Lógica de upload
├── blockchain.js       # Funções de blockchain
├── script.js           # Funções auxiliares (legado)
├── styles.css          # Estilos (design futurístico)
├── server/
│   └── index.js        # Backend API
├── .env                # Variáveis de ambiente (não versionado)
└── FUNCIONAMENTO.md    # Esta documentação
```

## Recursos de Interface

### Barra Superior Fixa
- **Presente em**: Todas as páginas (`index.html`, `patient.html`, `doctor-access.html`, `patient-key.html`, `upload.html`)
- **Endereço da Carteira**: Exibido no topo direito quando conectado
  - Versão curta: `0x1234...5678` (primeiros 6 e últimos 4 caracteres)
  - Versão completa: Endereço completo em uma linha
  - Responsivo: Quebra de linha automática se necessário (`word-break: break-all`)
  - Não truncado: Endereço completo sempre visível
- **Botão Desconectar**: Sempre visível quando conectado
  - Posicionado no topo direito, ao lado do endereço
  - Limpa todo o localStorage (chaves mestre, CIDs, endereço, etc.)
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

✅ **Chave Mestre Única**
- Uma chave por paciente para todos os exames
- Incluída automaticamente na chave de acesso
- Armazenamento local seguro

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

## Próximos Passos Sugeridos

- [ ] Adicionar busca de registros por tipo de exame
- [ ] Implementar revogação de consentimento na UI
- [ ] Adicionar notificações quando consentimento expira
- [ ] Implementar ECIES para compartilhar chave simétrica de forma segura (opcional - já simplificado com chave mestre)
- [ ] Adicionar suporte a múltiplas redes blockchain
- [ ] Implementar cache de registros para melhor performance
- [ ] Adicionar exportação de histórico em PDF/JSON
- [ ] Implementar backup/restauração de chave mestre

