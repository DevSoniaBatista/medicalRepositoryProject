# Variáveis de Ambiente - Vercel vs Local

## 📋 Resumo

**IMPORTANTE**: O código atual usa o prefixo `NEXT_PUBLIC_` para todas as variáveis. Use o mesmo formato em ambos os ambientes.

## 🏠 Ambiente Local (`.env`)

Crie um arquivo `.env` na raiz do projeto `medicalRepository-offchain-app/`:

```env
# ============================================
# CONFIGURAÇÃO DO CONTRATO BLOCKCHAIN
# ============================================
NEXT_PUBLIC_CONTRACT_ADDRESS=0xSeuEnderecoDoContratoAqui
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_NETWORK_NAME=Sepolia

# ============================================
# CHAVE MESTRA GLOBAL (OBRIGATÓRIA)
# ============================================
# Gere com: node generate-master-key.js
NEXT_PUBLIC_MASTER_KEY=chave_hex_64_caracteres_aqui

# ============================================
# CREDENCIAIS PINATA (OBRIGATÓRIO)
# ============================================
# Opção 1: Usar JWT Token
NEXT_PUBLIC_PINATA_JWT=seu_token_jwt_aqui

# Opção 2: Usar API Key + Secret (alternativa ao JWT)
# NEXT_PUBLIC_PINATA_API_KEY=seu_api_key_aqui
# NEXT_PUBLIC_PINATA_SECRET=seu_secret_key_aqui

# ============================================
# CONFIGURAÇÕES OPCIONAIS
# ============================================
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io

# ============================================
# CONFIGURAÇÕES DO SERVIDOR (OPCIONAL)
# ============================================
NEXT_PUBLIC_PORT=3000
NEXT_PUBLIC_MAX_FILE_SIZE_BYTES=26214400
NEXT_PUBLIC_ALLOWED_ORIGINS=http://127.0.0.1:8080,http://localhost:8080
```

## ☁️ Ambiente Vercel

No painel do Vercel, acesse **Settings** > **Environment Variables** e adicione as mesmas variáveis:

### Variáveis Obrigatórias

| Nome da Variável | Valor | Ambiente |
|-----------------|-------|----------|
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0xSeuEnderecoDoContratoAqui` | Production, Preview, Development |
| `NEXT_PUBLIC_CHAIN_ID` | `11155111` | Production, Preview, Development |
| `NEXT_PUBLIC_NETWORK_NAME` | `Sepolia` | Production, Preview, Development |
| `NEXT_PUBLIC_MASTER_KEY` | `chave_hex_64_caracteres_aqui` | Production, Preview, Development |
| `NEXT_PUBLIC_PINATA_JWT` | `seu_token_jwt_aqui` | Production, Preview, Development |

**OU** (alternativa ao JWT):

| Nome da Variável | Valor | Ambiente |
|-----------------|-------|----------|
| `NEXT_PUBLIC_PINATA_API_KEY` | `seu_api_key_aqui` | Production, Preview, Development |
| `NEXT_PUBLIC_PINATA_SECRET` | `seu_secret_key_aqui` | Production, Preview, Development |

### Variáveis Opcionais

| Nome da Variável | Valor | Ambiente |
|-----------------|-------|----------|
| `NEXT_PUBLIC_RPC_URL` | `https://rpc.sepolia.org` | Production, Preview, Development |
| `NEXT_PUBLIC_BLOCK_EXPLORER_URL` | `https://sepolia.etherscan.io` | Production, Preview, Development |

## ⚠️ IMPORTANTE: Por que NEXT_PUBLIC_?

O prefixo `NEXT_PUBLIC_` é usado porque:

1. **Compatibilidade**: O código foi configurado para usar esse prefixo
2. **Consistência**: Mesmo formato em todos os ambientes
3. **Simplicidade**: Não precisa gerenciar duas versões (com e sem prefixo)

### ⚠️ Segurança (Nota Importante)

**ATENÇÃO**: Variáveis com prefixo `NEXT_PUBLIC_` são expostas ao frontend no Vercel/Next.js. 

Se você quiser manter a `MASTER_KEY` secreta:

1. **Opção 1 (Recomendada)**: Use variáveis **SEM** prefixo no backend e **COM** prefixo no frontend:
   - Backend (API Routes): `MASTER_KEY` (sem prefixo)
   - Frontend: `NEXT_PUBLIC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_CHAIN_ID`, etc.

2. **Opção 2 (Atual)**: Use `NEXT_PUBLIC_MASTER_KEY` mas entenda que ela será acessível no frontend (embora não seja exposta diretamente no código fonte).

## 📝 Exemplo Completo

### Arquivo `.env` Local

```env
# Blockchain
NEXT_PUBLIC_CONTRACT_ADDRESS=0x600aa9f85Ff66d41649EE02038cF8e9cfC0BF053
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_NETWORK_NAME=Sepolia

# Chave Mestra (gerada com: node generate-master-key.js)
NEXT_PUBLIC_MASTER_KEY=b5f0c3ebe9d77e6489a61633353d75ac7b469169ad27034c45429eb66814710f

# Pinata
NEXT_PUBLIC_PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Opcional
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io
```

### Configuração no Vercel

1. Acesse: https://vercel.com/seu-projeto/settings/environment-variables
2. Clique em **Add New**
3. Adicione cada variável:
   - **Key**: `NEXT_PUBLIC_CONTRACT_ADDRESS`
   - **Value**: `0x600aa9f85Ff66d41649EE02038cF8e9cfC0BF053`
   - **Environments**: Marque ✅ Production, ✅ Preview, ✅ Development
4. Repita para todas as variáveis

## 🔍 Verificação

### Local

```bash
# Verificar se o .env está sendo lido
cd medicalRepository-offchain-app
npm run api
# Deve mostrar: "Pinata upload service listening on http://127.0.0.1:3000"
```

### Vercel

1. Após o deploy, acesse: `https://seu-app.vercel.app/api/config`
2. Deve retornar JSON com todas as configurações
3. Verifique o console do navegador para erros

## 🚨 Troubleshooting

### "Configuração não disponível"

- ✅ Verifique se todas as variáveis têm o prefixo `NEXT_PUBLIC_`
- ✅ Verifique se o arquivo `.env` está na raiz do projeto
- ✅ No Vercel, verifique se marcou todos os ambientes
- ✅ Faça um **Redeploy** após adicionar variáveis no Vercel

### "Chave mestra não configurada"

- ✅ Verifique se `NEXT_PUBLIC_MASTER_KEY` tem exatamente 64 caracteres hexadecimais
- ✅ Execute `node generate-master-key.js` para gerar uma nova chave

### Variáveis não aparecem no Vercel

- ✅ Certifique-se de fazer **Redeploy** após adicionar variáveis
- ✅ Verifique se marcou o ambiente correto (Production/Preview/Development)

## 📚 Referências

- [Documentação Vercel - Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js - Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)

