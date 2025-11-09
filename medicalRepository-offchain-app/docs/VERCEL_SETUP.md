# Configuração para Vercel

## Problema

O frontend tenta buscar a configuração do backend em `http://127.0.0.1:3000/config`, que não funciona em produção.

## Soluções

### Opção 1: Usar Variáveis de Ambiente do Frontend (Recomendado)

A Vercel permite injetar variáveis de ambiente no frontend. Configure as seguintes variáveis no painel da Vercel:

1. Acesse **Settings** > **Environment Variables** no seu projeto Vercel
2. Adicione as seguintes variáveis:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=seu_endereco_do_contrato_aqui
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_NETWORK_NAME=Sepolia
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io
NEXT_PUBLIC_MASTER_KEY=chave_hex_64_caracteres
```

**IMPORTANTE**: Substitua `seu_endereco_do_contrato_aqui` pelo endereço real do seu contrato deployado.

3. Para que essas variáveis sejam acessíveis no frontend, você precisa injetá-las no HTML. Crie um script de build ou use um arquivo de configuração.

### Opção 2: Injetar Variáveis no HTML

Adicione um script antes do fechamento do `</head>` em todos os arquivos HTML:

```html
<script>
  // Injetar variáveis de ambiente do Vercel
  // IMPORTANTE: Não use valores padrão hardcoded - sempre use process.env
  window.__CONTRACT_ADDRESS__ = '<%= process.env.NEXT_PUBLIC_CONTRACT_ADDRESS %>';
  window.__CHAIN_ID__ = '<%= process.env.NEXT_PUBLIC_CHAIN_ID %>';
  window.__NETWORK_NAME__ = '<%= process.env.NEXT_PUBLIC_NETWORK_NAME %>';
  window.__RPC_URL__ = '<%= process.env.NEXT_PUBLIC_RPC_URL %>';
  window.__BLOCK_EXPLORER_URL__ = '<%= process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL %>';
</script>
```

**Nota**: Isso requer um build step com template engine. Para vanilla HTML, use a Opção 3.

### Opção 3: Usar Backend na Mesma Origem (Mais Simples)

Se você também está hospedando o backend na Vercel:

1. Configure o backend como uma API Route na Vercel
2. O código já detecta automaticamente a mesma origem
3. Certifique-se de que o endpoint `/api/config` está funcionando

### Opção 4: Configuração Manual via Script Tag

Adicione este script no `<head>` de todos os arquivos HTML antes de carregar `blockchain.js`:

```html
<script>
  // ⚠️ NÃO RECOMENDADO: Configuração manual hardcoded
  // Use apenas se não conseguir usar o backend ou variáveis de ambiente
  // IMPORTANTE: Substitua pelo seu endereço de contrato real
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    window.__CONTRACT_ADDRESS__ = 'SEU_ENDERECO_DO_CONTRATO_AQUI';
    window.__CHAIN_ID__ = 11155111;
    window.__NETWORK_NAME__ = 'Sepolia';
    window.__RPC_URL__ = 'https://rpc.sepolia.org';
    window.__BLOCK_EXPLORER_URL__ = 'https://sepolia.etherscan.io';
  }
</script>
```

**⚠️ AVISO**: Esta opção não é recomendada. Prefira usar o backend que lê do `.env`.

## Configuração do Backend na Vercel

Se você também está hospedando o backend:

1. Configure as variáveis de ambiente no painel da Vercel:
   - `NEXT_PUBLIC_PINATA_JWT` ou `NEXT_PUBLIC_PINATA_API_KEY` + `NEXT_PUBLIC_PINATA_SECRET`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS`
   - `NEXT_PUBLIC_CHAIN_ID`
   - `NEXT_PUBLIC_NETWORK_NAME`
   - `NEXT_PUBLIC_MASTER_KEY`
   - `NEXT_PUBLIC_RPC_URL` (opcional)
   - `NEXT_PUBLIC_BLOCK_EXPLORER_URL` (opcional)

2. O endpoint `/api/config` será acessível em `https://seu-dominio.vercel.app/api/config`

## Teste

Após configurar, verifique no console do navegador se a configuração foi carregada corretamente. O código agora:

1. Tenta buscar do backend (mesma origem em produção)
2. Se falhar, tenta usar variáveis do `window`
3. Se ainda falhar, usa valores padrão (Sepolia)

