# Medical Records - Frontend Application

Sistema completo de registros médicos descentralizados com interface web para pacientes e médicos. Utiliza criptografia AES-256-GCM com chave mestra global configurada no servidor.

## Visão Geral

Este é o frontend do sistema de registros médicos que permite:
- **Pacientes**: Criar registros médicos, visualizar histórico e compartilhar acesso com médicos
- **Médicos**: Acessar registros médicos com autorização do paciente usando apenas a chave de acesso
- **Criptografia**: Todos os dados são criptografados com chave mestra global antes de serem enviados ao IPFS
- **Blockchain**: Metadados e controle de acesso gerenciados via smart contracts na Ethereum

## Características Principais

- 🔐 **Chave Mestre Global**: Uma única chave configurada no `.env` para todos os registros
- 🔒 **Criptografia End-to-End**: AES-256-GCM com chave mestra global
- 📝 **EIP-712 Consent Management**: Assinaturas criptográficas para autorização
- 🌐 **IPFS/Pinata**: Armazenamento descentralizado de dados criptografados
- 👤 **Interface Completa**: Páginas separadas para pacientes e médicos
- 🔑 **Acesso Simplificado**: Médico só precisa da chave de acesso (chave mestra obtida automaticamente)

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

Crie um arquivo `.env` na raiz do projeto com:

```env
# Credenciais Pinata (obrigatório)
PINATA_JWT=seu_token_jwt
# ou
PINATA_API_KEY=seu_api_key
PINATA_SECRET=seu_secret_key

# Configuração do contrato blockchain (obrigatório)
CONTRACT_ADDRESS=seu_endereco_do_contrato
CHAIN_ID=11155111
NETWORK_NAME=Sepolia

# Chave Mestre Global (obrigatório)
# Gere com: node generate-master-key.js
MASTER_KEY=chave_hex_64_caracteres

# RPC e Block Explorer (opcional)
RPC_URL=https://rpc.sepolia.org
BLOCK_EXPLORER_URL=https://sepolia.etherscan.io
```

⚠️ **IMPORTANTE**: 
- A chave mestra deve ter exatamente 64 caracteres hexadecimais
- Mantenha a chave em segredo
- Use a mesma chave em todos os ambientes para manter compatibilidade

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
- Menu de acesso (Paciente ou Médico)

### 2. `patient.html` - Acesso do Paciente
- Criar novos exames médicos
- Visualizar histórico de registros
- Gerar chave de acesso para médicos
- Upload de arquivos ao IPFS

### 3. `doctor-access.html` - Acesso do Médico
- Inserir chave de acesso fornecida pelo paciente
- Visualizar registros autorizados
- Descriptografar e exibir dados médicos

### 4. `upload.html` - Upload de Arquivos
- Upload de imagens/PDFs ao IPFS/Pinata
- Geração automática de CIDs
- Integração com formulário de criação de exames

### 5. `patient-key.html` - Gerar Chave de Acesso
- Interface alternativa para geração de chaves de acesso

## Fluxo de Uso

### Para Pacientes

1. **Conectar Carteira**: Acesse `index.html` e conecte sua carteira MetaMask
2. **Criar Registro**: 
   - Acesse "Acesso Paciente"
   - Clique em "Criar Novo Exame"
   - (Opcional) Faça upload de arquivos em `upload.html`
   - Preencha os dados do exame
   - O sistema criptografa automaticamente com a chave mestra global
   - Registro é enviado ao IPFS e blockchain
3. **Compartilhar Acesso**:
   - Clique em "Gerar Chave de Acesso"
   - Informe o endereço do médico e validade
   - Compartilhe a chave de acesso gerada (o médico não precisa de chave separada)

### Para Médicos

1. **Conectar Carteira**: Acesse `index.html` e conecte sua carteira MetaMask
2. **Acessar Registros**:
   - Acesse "Acesso Médico"
   - Cole a chave de acesso fornecida pelo paciente
   - O sistema busca automaticamente a chave mestra do backend
   - Registros são descriptografados e exibidos

## Arquitetura

```
Frontend (Browser)
  ↓
  Criptografa com MASTER_KEY (do backend)
  ↓
Backend (/upload)
  ↓
IPFS/Pinata (dados criptografados)
  ↓
Blockchain (CID + hash)
  ↓
Médico (com chave de acesso)
  ↓
Backend (/config) → MASTER_KEY
  ↓
Descriptografa registros
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

## Criptografia

### Chave Mestre Global
- **Tipo**: AES-256-GCM
- **Tamanho**: 32 bytes (64 caracteres hex)
- **Origem**: Configurada no `.env` do servidor
- **Uso**: Todos os registros são criptografados com a mesma chave

### Processo de Criptografia
1. Metadata JSON é criado com dados do exame
2. Sistema busca chave mestra global do backend
3. Metadata é criptografado com AES-256-GCM
4. Payload criptografado é enviado ao IPFS
5. CID e hash são registrados na blockchain

### Processo de Descriptografia
1. Médico fornece chave de acesso
2. Sistema valida autorização na blockchain
3. Sistema busca chave mestra global do backend
4. Dados são descriptografados e exibidos

## Documentação Adicional

- [`docs/FUNCIONAMENTO.md`](docs/FUNCIONAMENTO.md) - Documentação completa do funcionamento do sistema
- [`docs/MASTER_KEY_SETUP.md`](docs/MASTER_KEY_SETUP.md) - Configuração detalhada da chave mestra global
- [`docs/VERCEL_SETUP.md`](docs/VERCEL_SETUP.md) - Guia de deploy na Vercel
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

## Estrutura de Arquivos

```
medicalRepository-offchain-app/
├── index.html              # Página inicial
├── patient.html            # Interface do paciente
├── doctor-access.html      # Interface do médico
├── upload.html             # Upload de arquivos
├── patient-key.html        # Geração de chave de acesso
├── blockchain.js           # Funções de blockchain e configuração
├── patient.js              # Lógica do paciente
├── doctor-access.js        # Lógica do médico
├── home.js                 # Lógica da página inicial
├── upload.js               # Lógica de upload
├── generate-master-key.js  # Script para gerar chave mestra
├── server/
│   └── index.js            # Backend (API + Pinata)
├── docs/                   # Documentação
│   ├── FUNCIONAMENTO.md
│   ├── MASTER_KEY_SETUP.md
│   ├── VERCEL_SETUP.md
│   ├── PINATA_EXAMPLES.md
│   └── RESUMO_TECNICO_SMART_CONTRACT.md
└── README.md               # Este arquivo
```

## Licença

MIT License
