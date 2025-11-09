# Medical Records - Frontend Application

Sistema completo de registros médicos descentralizados com interface web para pacientes, médicos e administradores. Utiliza criptografia AES-256-GCM com chave mestra global configurada no servidor e sistema de pagamento integrado.

## Visão Geral

Este é o frontend do sistema de registros médicos que permite:
- **Pacientes**: Criar registros médicos (com pagamento de 0.0001 ETH), visualizar histórico e compartilhar acesso com médicos
- **Médicos**: Acessar registros médicos com autorização do paciente usando apenas a chave de acesso
- **Administradores**: Gerenciar o sistema, visualizar estatísticas, retirar fundos e controlar o contrato
- **Criptografia**: Todos os dados são criptografados com chave mestra global antes de serem enviados ao IPFS
- **Blockchain**: Metadados e controle de acesso gerenciados via smart contracts na Ethereum
- **Pagamento**: Sistema integrado de pagamento com taxa de 0.0001 ETH por registro criado

## Características Principais

- 🔐 **Chave Mestre Global**: Uma única chave configurada no `.env` para todos os registros
- 🔒 **Criptografia End-to-End**: AES-256-GCM com chave mestra global
- 💰 **Sistema de Pagamento**: Taxa de 0.0001 ETH (≈ US$0.43) por registro criado
- 📝 **EIP-712 Consent Management**: Assinaturas criptográficas para autorização
- 🌐 **IPFS/Pinata**: Armazenamento descentralizado de dados criptografados
- 👤 **Interface Completa**: Páginas separadas para pacientes, médicos e administradores
- 🔑 **Acesso Simplificado**: Médico só precisa da chave de acesso (chave mestra obtida automaticamente)
- 📊 **Painel Administrativo**: Dashboard completo com estatísticas, eventos e controles
- 🔍 **Rastreamento Completo**: Todos os eventos são rastreados para auditoria e transparência

## Pré-requisitos

- Node.js 18+
- npm
- MetaMask instalado no navegador
- Backend rodando (para upload ao Pinata e configuração)

## Instalação

```bash
cd medicalRepository-offchain-app
npm install
```

## Configuração

### 1. Gerar Chave Mestre

Primeiro, gere a chave mestra global:

```bash
node generate-master-key.js
```

Copie a chave gerada para o arquivo `.env`.

### 2. Configurar Variáveis de Ambiente

#### Ambiente Local

Crie um arquivo `.env` na raiz do projeto com:

```env
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

# RPC e Block Explorer (opcional)
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io

# Configurações do servidor (opcional)
NEXT_PUBLIC_PORT=3000
NEXT_PUBLIC_MAX_FILE_SIZE_BYTES=26214400
NEXT_PUBLIC_ALLOWED_ORIGINS=http://127.0.0.1:8080,http://localhost:8080
```

#### Ambiente Vercel

No painel do Vercel, acesse **Settings** > **Environment Variables** e adicione as **mesmas variáveis** com o prefixo `NEXT_PUBLIC_`:

- `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_NETWORK_NAME`
- `NEXT_PUBLIC_MASTER_KEY`
- `NEXT_PUBLIC_PINATA_JWT` (ou `NEXT_PUBLIC_PINATA_API_KEY` + `NEXT_PUBLIC_PINATA_SECRET`)

⚠️ **IMPORTANTE**: 
- Use o **mesmo formato** (`NEXT_PUBLIC_*`) em ambos os ambientes
- Marque todas as variáveis para Production, Preview e Development no Vercel
- A chave mestra deve ter exatamente 64 caracteres hexadecimais
- Mantenha a chave em segredo
- Use a mesma chave em todos os ambientes para manter compatibilidade

📖 **Documentação completa**: Veja [`docs/ENV_VARIABLES.md`](docs/ENV_VARIABLES.md) para detalhes.

## Como Executar

### Desenvolvimento

```bash
# Terminal 1: Iniciar backend
npm run api    # Servidor em http://127.0.0.1:3000

# Terminal 2: Iniciar frontend
npm run start  # Interface em http://127.0.0.1:8080

# Ou iniciar ambos juntos:
npm run dev
```

### Produção

O sistema detecta automaticamente o ambiente e ajusta as URLs do backend. Para produção na Vercel, veja [`docs/VERCEL_SETUP.md`](docs/VERCEL_SETUP.md).

## Estrutura de Páginas

### 1. `index.html` - Página Inicial
- Conecta carteira MetaMask
- Exibe informações do contrato (endereço, rede, chain ID)
- Menu de acesso (Paciente, Médico ou Admin)
- Verificação automática se a carteira é admin

### 2. `patient.html` - Acesso do Paciente
- **Criar novos exames médicos** (com pagamento obrigatório de 0.0001 ETH)
- Visualizar histórico de registros com dados descriptografados
- Gerar chave de acesso para médicos
- Visualização inline de arquivos (imagens, PDFs)

### 3. `doctor-access.html` - Acesso do Médico
- Inserir chave de acesso fornecida pelo paciente
- Visualizar registros autorizados
- Descriptografar e exibir dados médicos
- Visualização inline de arquivos (imagens, PDFs)
- (Opcional) Registrar acesso para auditoria

### 4. `admin.html` - Painel Administrativo
- **Status do Contrato**: Visualizar se está pausado/ativo
- **Informações de Pagamento**: Saldo acumulado, total de pagamentos, estatísticas
- **Ações Administrativas**:
  - Retirar fundos acumulados
  - Pausar/despausar contrato
  - Atualizar dados e eventos
- **Histórico de Eventos**: 
  - Pagamentos recebidos
  - Retiradas de fundos
  - Criações de registros
  - Consentimentos concedidos
  - Acessos aos registros

### 5. `upload.html` - Upload de Arquivos
- Upload de imagens/PDFs ao IPFS/Pinata
- Geração automática de CIDs
- Integração com formulário de criação de exames
- Upload múltiplo de arquivos

### 6. `patient-key.html` - Gerar Chave de Acesso
- Interface alternativa para geração de chaves de acesso
- Download da chave como JSON

## Fluxo de Uso

### Para Pacientes

1. **Conectar Carteira**: Acesse `index.html` e conecte sua carteira MetaMask
2. **Criar Registro**: 
   - Acesse "Acesso Paciente"
   - Clique em "Criar Novo Exame"
   - (Opcional) Faça upload de arquivos em `upload.html`
   - Preencha os dados do exame
   - O sistema criptografa automaticamente com a chave mestra global
   - **⚠️ Pagamento Obrigatório**: Deve pagar 0.0001 ETH ao criar o registro
   - Sistema valida saldo suficiente (taxa + gas)
   - Registro é enviado ao IPFS e blockchain
   - Pagamento é acumulado no contrato (admin pode retirar depois)
3. **Ver Histórico**:
   - Visualize todos os seus registros
   - Dados são descriptografados automaticamente
   - Arquivos são exibidos inline (imagens, PDFs)
4. **Compartilhar Acesso**:
   - Clique em "Gerar Chave de Acesso"
   - Informe o endereço do médico e validade (1-365 dias)
   - Sistema registra consentimento na blockchain
   - Compartilhe a chave de acesso gerada (já inclui chave mestra)

### Para Médicos

1. **Conectar Carteira**: Acesse `index.html` e conecte sua carteira MetaMask
2. **Acessar Registros**:
   - Acesse "Acesso Médico"
   - Cole a chave de acesso fornecida pelo paciente
   - Sistema valida autorização e expiração
   - O sistema busca automaticamente a chave mestra do backend
   - Registros são descriptografados e exibidos
   - Arquivos são visualizados inline (imagens, PDFs)
3. **Registro de Acesso** (Opcional):
   - Sistema pode registrar acesso via `logAccess()` para auditoria
   - Admin pode rastrear todos os acessos através de eventos

### Para Administradores

1. **Conectar Carteira Admin**: Acesse `index.html` ou `admin.html` e conecte sua carteira MetaMask
2. **Verificar Permissões**: Sistema verifica automaticamente se a carteira tem `DEFAULT_ADMIN_ROLE`
3. **Visualizar Informações**:
   - Status do contrato (pausado/ativo)
   - Saldo acumulado no contrato
   - Total de pagamentos recebidos
   - Estatísticas por pagador
   - Histórico completo de eventos
4. **Ações Administrativas**:
   - **Retirar Fundos**: Transfere todo o saldo acumulado para endereço do admin
   - **Pausar Contrato**: Pausa operações em caso de emergência
   - **Despausar Contrato**: Retoma operações normais
   - **Atualizar Dados**: Recarrega informações e eventos recentes

## Arquitetura

```
Frontend (Browser)
  ↓
  Obtém MASTER_KEY do backend (/config)
  ↓
  Criptografa dados com AES-256-GCM
  ↓
Backend (/upload)
  ↓
IPFS/Pinata (dados criptografados)
  ↓
Blockchain (CID + hash + pagamento 0.0001 ETH)
  ↓
  Eventos: RecordCreated, PaymentReceived
  ↓
Médico (com chave de acesso)
  ↓
  Valida consentimento on-chain
  ↓
Backend (/config) → MASTER_KEY
  ↓
Descriptografa registros
  ↓
  (Opcional) logAccess() → AccessLogged event
  ↓
Admin (Painel)
  ↓
  Visualiza eventos e estatísticas
  ↓
  Retira fundos acumulados (withdraw)
```

## Endpoints do Backend

### `GET /config`
Retorna configuração do sistema:
```json
{
  "contractAddress": "0x...",
  "chainId": 11155111,
  "networkName": "Sepolia",
  "masterKey": "chave_hex_64_caracteres",
  "rpcUrl": "https://rpc.sepolia.org",
  "blockExplorerUrl": "https://sepolia.etherscan.io"
}
```

### `POST /upload`
Upload de payload criptografado ao Pinata:
- **Body**: JSON com payload criptografado
- **Retorna**: `{ cid, metaHash, pinSize, timestamp }`

### `POST /upload-file`
Upload de arquivo ao Pinata:
- **Body**: `multipart/form-data` com campo `file`
- **Retorna**: `{ cid, sha256, pinSize, timestamp, fileName }`

### `GET /health`
Status do serviço:
- **Retorna**: `{ status: 'ok', time: ISOString }`

## Sistema de Pagamento

### Taxa por Registro
- **Valor**: 0.0001 ETH por registro criado (≈ US$0.43, variável com câmbio)
- **Obrigatoriedade**: Pagamento obrigatório ao criar registro via `createRecord()`
- **Validação**: Contrato valida que `msg.value == 0.0001 ether` (reverte se diferente)
- **Acumulação**: Fundos ficam acumulados no contrato (não transferidos imediatamente)

### Processo de Pagamento
1. Sistema obtém taxa de criação do contrato (`getRecordCreationFee()`)
2. Verifica se contrato está pausado
3. Verifica saldo suficiente (taxa + gas)
4. Chama `createRecord()` com pagamento: `{value: 0.0001 ether}`
5. Contrato valida pagamento e acumula fundos
6. Emite eventos: `RecordCreated` e `PaymentReceived`

### Retirada de Fundos (Admin)
- Apenas admin pode retirar fundos acumulados
- Função `withdraw()` transfere todo o saldo para endereço do admin
- Emite evento `PaymentWithdrawn` quando fundos são retirados

## Criptografia

### Chave Mestre Global
- **Tipo**: AES-256-GCM
- **Tamanho**: 32 bytes (64 caracteres hex)
- **Origem**: Configurada no `.env` do servidor (`NEXT_PUBLIC_MASTER_KEY`)
- **Uso**: Todos os registros são criptografados com a mesma chave
- **Segurança**: Nunca armazenada no navegador ou on-chain

### Processo de Criptografia
1. Metadata JSON é criado com dados do exame
2. Sistema busca chave mestra global do backend (`GET /config` ou `GET /api/config`)
3. Metadata é criptografado com AES-256-GCM (IV único por registro)
4. Payload criptografado é enviado ao IPFS
5. CID e hash são registrados na blockchain com pagamento de 0.0001 ETH

### Processo de Descriptografia
1. Médico fornece chave de acesso (base64)
2. Sistema valida autorização na blockchain (`getConsent()`)
3. Sistema extrai chave mestra global da chave de acesso (ou busca do backend)
4. Dados são descriptografados e exibidos
5. (Opcional) Sistema registra acesso via `logAccess()` para auditoria

## Eventos de Rastreamento

O sistema emite eventos na blockchain que permitem rastreamento completo:

- **`PaymentReceived`**: Quando paciente paga taxa de 0.0001 ETH
- **`PaymentWithdrawn`**: Quando admin retira fundos acumulados
- **`RecordCreated`**: Quando novo registro é criado
- **`ConsentGranted`**: Quando consentimento é concedido
- **`ConsentKeyGenerated`**: Quando chave de acesso é gerada (rastreamento admin)
- **`AccessLogged`**: Quando médico acessa registro (auditoria)

O painel administrativo permite visualizar todos esses eventos e gerar relatórios completos.

## Documentação Adicional

- [`docs/FUNCIONAMENTO.md`](docs/FUNCIONAMENTO.md) - Documentação completa do funcionamento do sistema
- [`docs/ENV_VARIABLES.md`](docs/ENV_VARIABLES.md) - Guia completo de variáveis de ambiente
- [`docs/VERCEL_DEPLOY.md`](docs/VERCEL_DEPLOY.md) - Guia de deploy na Vercel
- [`docs/PINATA_EXAMPLES.md`](docs/PINATA_EXAMPLES.md) - Exemplos de integração com Pinata
- [`docs/RESUMO_TECNICO_SMART_CONTRACT.md`](docs/RESUMO_TECNICO_SMART_CONTRACT.md) - Resumo técnico do smart contract

## Scripts Disponíveis

- `npm run start` - Inicia servidor frontend (http://127.0.0.1:8080)
- `npm run api` - Inicia servidor backend (http://127.0.0.1:3000)
- `npm run dev` - Inicia frontend e backend juntos
- `node generate-master-key.js` - Gera chave mestra global para o `.env`

## Segurança

- ✅ **Chave mestra nunca exposta**: Apenas o backend tem acesso ao `.env`
- ✅ **Criptografia client-side**: Dados são criptografados no navegador antes do upload
- ✅ **Sem chaves on-chain**: Chaves nunca são armazenadas na blockchain
- ✅ **Autorização criptográfica**: EIP-712 garante autenticidade das autorizações
- ✅ **Validação de rede**: Sistema verifica e solicita troca para rede correta
- ✅ **Validação de pagamento**: Contrato valida valor exato do pagamento
- ✅ **AccessControl**: Sistema de roles para controle de acesso administrativo
- ✅ **Pausa de emergência**: Admin pode pausar contrato em caso de vulnerabilidade
- ✅ **Rastreamento completo**: Todos os eventos são registrados para auditoria

## Troubleshooting

### "Configuração não disponível"
- Verifique se o backend está rodando (`npm run api`)
- Verifique se o arquivo `.env` está configurado corretamente
- Verifique se todas as variáveis obrigatórias estão definidas

### "Chave mestra não configurada"
- Execute `node generate-master-key.js` para gerar a chave
- Adicione `MASTER_KEY=...` ao arquivo `.env`
- Reinicie o backend

### "Erro ao descriptografar"
- Verifique se está usando a mesma chave mestra usada para criptografar
- Registros criados com chave diferente não podem ser descriptografados

### "Pagamento insuficiente"
- Certifique-se de ter pelo menos 0.0001 ETH + gas fees na carteira
- Verifique se o valor enviado é exatamente 0.0001 ETH

### "Contrato está pausado"
- O admin pausou o contrato temporariamente
- Apenas funções de visualização funcionam quando pausado
- Aguarde o admin despausar o contrato

### "Esta carteira não é uma carteira de administrador"
- Apenas carteiras com `DEFAULT_ADMIN_ROLE` podem acessar o painel admin
- Verifique se você está usando a carteira correta

## Estrutura de Arquivos

```
medicalRepository-offchain-app/
├── index.html              # Página inicial
├── patient.html            # Interface do paciente
├── doctor-access.html      # Interface do médico
├── admin.html              # Painel administrativo
├── upload.html             # Upload de arquivos
├── patient-key.html        # Geração de chave de acesso
├── blockchain.js           # Funções de blockchain e configuração
├── patient.js              # Lógica do paciente
├── doctor-access.js        # Lógica do médico
├── admin.js                # Lógica do painel admin
├── home.js                 # Lógica da página inicial
├── upload.js               # Lógica de upload
├── generate-master-key.js  # Script para gerar chave mestra
├── server/
│   └── index.js            # Backend (API + Pinata) - desenvolvimento local
├── api/                    # Vercel Serverless Functions
│   ├── config.js           # Endpoint de configuração
│   ├── upload.js           # Upload de payload
│   ├── upload-file.js      # Upload de arquivo
│   └── health.js           # Health check
├── docs/                   # Documentação
│   ├── FUNCIONAMENTO.md
│   ├── ENV_VARIABLES.md
│   ├── VERCEL_DEPLOY.md
│   ├── PINATA_EXAMPLES.md
│   └── RESUMO_TECNICO_SMART_CONTRACT.md
├── vercel.json             # Configuração Vercel
└── README.md               # Este arquivo
```

## Licença

MIT License
