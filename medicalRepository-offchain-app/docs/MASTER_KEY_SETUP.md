# Configuração da Chave Mestre Global

## Visão Geral

O sistema agora usa uma **chave mestra global** configurada no arquivo `.env` do servidor. Esta chave é usada para criptografar e descriptografar todos os registros médicos de todos os pacientes.

## Vantagens

- ✅ **Simplicidade**: Uma única chave para gerenciar
- ✅ **Persistência**: Não é perdida em deploys ou limpeza do navegador
- ✅ **Consistência**: Todos os registros usam a mesma chave
- ✅ **Facilidade para médicos**: Não precisam de chave separada, apenas da chave de acesso

## Como Gerar a Chave Mestre

1. Execute o script de geração:
```bash
cd medicalRepository-offchain-app
node generate-master-key.js
```

2. O script gerará uma chave hexadecimal de 64 caracteres (32 bytes)

3. Adicione ao arquivo `.env`:
```env
NEXT_PUBLIC_MASTER_KEY=chave_gerada_aqui_64_caracteres_hex
```

## Configuração do .env

O arquivo `.env` deve conter:

```env
# Blockchain
NEXT_PUBLIC_CONTRACT_ADDRESS=seu_endereco_do_contrato
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_NETWORK_NAME=Sepolia

# Chave Mestre Global (obrigatória)
NEXT_PUBLIC_MASTER_KEY=chave_hex_64_caracteres

# Pinata (opcional)
NEXT_PUBLIC_PINATA_JWT=seu_token
# ou
NEXT_PUBLIC_PINATA_API_KEY=seu_api_key
NEXT_PUBLIC_PINATA_SECRET=seu_secret

# RPC e Explorer (opcional)
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io
```

## Como Funciona

### Para Pacientes

1. Paciente cria um registro médico
2. Sistema busca a chave mestra global do backend (`/config`)
3. Registro é criptografado com a chave mestra global
4. Dados criptografados são enviados ao IPFS
5. CID e hash são registrados na blockchain

### Para Médicos

1. Médico recebe chave de acesso do paciente (contém apenas informações de autorização)
2. Médico insere a chave de acesso no sistema
3. Sistema busca automaticamente a chave mestra global do backend (`/config`)
4. Sistema descriptografa os registros usando a chave mestra global
5. Médico visualiza os dados descriptografados

## Segurança

⚠️ **IMPORTANTE**:
- A chave mestra deve ser mantida em **SEGREDO**
- Não commite o arquivo `.env` no Git
- Use a mesma chave em todos os ambientes (dev/prod) para manter compatibilidade
- Se perder a chave, não poderá descriptografar registros antigos
- Considere usar um gerenciador de segredos (ex: AWS Secrets Manager, HashiCorp Vault)

## Migração de Chave Mestre Individual

Se você estava usando chaves mestras individuais por paciente:

1. **Registros antigos**: Não poderão ser descriptografados com a nova chave global
2. **Registros novos**: Serão criptografados com a chave global
3. **Solução**: Mantenha a chave antiga se precisar acessar registros antigos, ou migre os dados

## Troubleshooting

### "Chave mestra não configurada"
- Verifique se `NEXT_PUBLIC_MASTER_KEY` está no arquivo `.env`
- Verifique se o backend está rodando (`npm run api`)
- Verifique se a chave tem exatamente 64 caracteres hexadecimais

### "Erro ao descriptografar"
- Verifique se está usando a mesma chave mestra usada para criptografar
- Registros criados com chave diferente não podem ser descriptografados

====

node generate-master-key.js
CHAVE MESTRA GERADA
========================================

Adicione esta linha ao seu arquivo .env:

NEXT_PUBLIC_MASTER_KEY=b5f0c3ebe9d77e6489a61633353d75ac7b469169ad27034c45429eb66814710f
========================================

⚠️  IMPORTANTE:
   - Mantenha esta chave em SEGREDO
   - Não compartilhe publicamente
   - Use a mesma chave em todos os ambientes (dev/prod)
   - Se perder a chave, não poderá descriptografar registros antigos  