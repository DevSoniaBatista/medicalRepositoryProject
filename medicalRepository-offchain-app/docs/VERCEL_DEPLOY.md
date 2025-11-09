# Guia de Deploy no Vercel

## Configuração de Variáveis de Ambiente

No Vercel, você precisa configurar as variáveis de ambiente no painel. Acesse **Settings** > **Environment Variables** e adicione:

### Variáveis Obrigatórias

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=seu_endereco_do_contrato
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_NETWORK_NAME=Sepolia
NEXT_PUBLIC_MASTER_KEY=chave_hex_64_caracteres
NEXT_PUBLIC_PINATA_JWT=seu_token_jwt
```

Ou alternativamente (se usar API Key/Secret):

```env
NEXT_PUBLIC_PINATA_API_KEY=seu_api_key
NEXT_PUBLIC_PINATA_SECRET=seu_secret_key
```

### Variáveis Opcionais

```env
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io
```

## ⚠️ IMPORTANTE: Segurança

**NUNCA** exponha `NEXT_PUBLIC_MASTER_KEY` no frontend se você quiser manter a chave secreta. 

**Opção Recomendada**: Use variáveis **SEM** prefixo `NEXT_PUBLIC_` para dados sensíveis:

```env
# Backend (API Routes) - SEM prefixo NEXT_PUBLIC_
CONTRACT_ADDRESS=seu_endereco_do_contrato
CHAIN_ID=11155111
NETWORK_NAME=Sepolia
MASTER_KEY=chave_hex_64_caracteres
PINATA_JWT=seu_token_jwt

# Frontend (público) - COM prefixo NEXT_PUBLIC_
NEXT_PUBLIC_CONTRACT_ADDRESS=seu_endereco_do_contrato
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_NETWORK_NAME=Sepolia
```

As API Routes (`/api/*`) podem acessar variáveis sem `NEXT_PUBLIC_`, enquanto o frontend só acessa variáveis com o prefixo.

## Estrutura de API Routes

O projeto usa serverless functions do Vercel em `api/`:

- `api/config.js` - Retorna configuração do sistema
- `api/upload.js` - Upload de payload criptografado
- `api/upload-file.js` - Upload de arquivos
- `api/health.js` - Health check

## Como Funciona

### Em Desenvolvimento Local

- Frontend: `http://127.0.0.1:8080` (http-server)
- Backend: `http://127.0.0.1:3000` (Express server)
- O código detecta `localhost` e usa o servidor Express

### Em Produção (Vercel)

- Frontend e Backend: Mesma origem (ex: `https://seu-app.vercel.app`)
- Frontend usa `/api/*` para acessar serverless functions
- As funções leem variáveis de ambiente do Vercel

## Testando o Deploy

1. **Verifique a API de Config**:
   ```
   https://seu-app.vercel.app/api/config
   ```
   Deve retornar JSON com `contractAddress`, `chainId`, `networkName`, `masterKey`.

2. **Verifique o Health Check**:
   ```
   https://seu-app.vercel.app/api/health
   ```
   Deve retornar `{ status: 'ok', time: '...' }`.

3. **Teste no Console do Navegador**:
   Abra o console e verifique se não há erros de configuração.

## Troubleshooting

### "Configuração não disponível"

- Verifique se todas as variáveis estão configuradas no Vercel
- Verifique se marcou todos os ambientes (Production, Preview, Development)
- Faça um **Redeploy** após adicionar variáveis

### "Erro ao fazer upload"

- Verifique se `NEXT_PUBLIC_PINATA_JWT` ou `NEXT_PUBLIC_PINATA_API_KEY/SECRET` estão configurados
- Verifique os logs do Vercel em **Deployments** > **Functions**

### "CORS Error"

- O `vercel.json` já configura CORS
- Se persistir, verifique se a origem está permitida

## Dependências Necessárias

As serverless functions precisam das seguintes dependências (já no `package.json`):

- `axios` - Para requisições HTTP ao Pinata
- `form-data` - Para upload de arquivos
- `busboy` - Para parse de multipart/form-data (adicione se necessário)

Para adicionar `busboy`:

```bash
npm install busboy
```

## Checklist de Deploy

- [ ] Todas as variáveis de ambiente configuradas no Vercel
- [ ] Variáveis marcadas para todos os ambientes (Production, Preview, Development)
- [ ] `vercel.json` configurado corretamente
- [ ] API Routes criadas em `api/`
- [ ] Testado endpoint `/api/config`
- [ ] Testado endpoint `/api/health`
- [ ] Testado upload de arquivo
- [ ] Verificado logs do Vercel

