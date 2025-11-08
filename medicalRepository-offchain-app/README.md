# Medical Metadata Encryption Demo

Projeto simples em JavaScript para gerar metadata cifrado (AES-256-GCM) antes de enviar para o smart contract/IPFS ou armazenar off-chain com segurança.

## Pré-requisitos

- Node.js 18+
- npm

## Como executar

```bash
cd offchain-app
npm install
npm run start # serve a interface em http://127.0.0.1:8080

# em outro terminal (para upload automático):
npm run api    # inicia o serviço de upload em http://127.0.0.1:3000
# ou
npm run dev    # sobe front-end + backend juntos
```

O comando `npm run start` inicia um servidor local (`http://127.0.0.1:8080`). Abra o link no navegador para acessar a interface. 

O serviço backend (`npm run api`) expõe `POST /upload`, que recebe o payload cifrado e o envia ao Pinata usando as credenciais definidas via variáveis de ambiente.

> ⚠️ O Web Crypto API exige HTTPS ou `localhost`. O `http-server` usa `127.0.0.1`, permitindo o uso da API.

## Fluxo básico

1. (Opcional) Se ainda não tem os CIDs dos arquivos do exame, acesse `upload.html`, envie as imagens/PDFs e copie os CIDs gerados automaticamente.
2. Preencha os campos do formulário (veja a explicação dos campos logo abaixo).
2. A ferramenta gera automaticamente:
   - Metadata em JSON padronizado (`patientHash`, `examType`, `date`, `files`, `notesHash`).
   - Chave simétrica aleatória (32 bytes) em hexadecimal.
   - Vetor de inicialização (IV) de 12 bytes.
   - Payload cifrado (AES-256-GCM) com tag de autenticação.
3. Use os botões para copiar JSONs ou baixar arquivos.
4. Faça upload do payload cifrado para o Pinata usando os exemplos em `docs/PINATA_EXAMPLES.md` **ou** clique em "Enviar ao Pinata" (backend). Armazene as credenciais do Pinata em variáveis de ambiente, nunca diretamente no front-end.
5. Registre `cidMeta` + `metaHash` no contrato via `createRecord`.

## Campos do formulário

- `Patient Hash`: identificador único do paciente em formato hexadecimal (ex.: `0xabc...`). Pode ser a wallet address do paciente ou um hash derivado (`keccak256(walletAddress)` ou `keccak256(patientId)`). A recomendação é **hashiar** a informação original para que terceiros não consigam reidentificar o paciente.
- `Exam Type`: tipo de exame (ex.: `blood`, `x-ray`).
- `Exam Date`: data no formato ISO (`YYYY-MM-DD`).
- `Files (CIDs)`: lista de CIDs/IPFS associados ao exame (uma entrada por linha ou separadas por vírgula).
- `Notes Hash`: opcional. Hash das anotações clínicas (`keccak256` do texto ou outro hash consistente).

> Defina um padrão interno para calcular o `patientHash`. Se usar diretamente o endereço da carteira, considere armazenar apenas `keccak256(address)` para esconder o endereço público de quem visualizar o payload.

## Estrutura do payload gerado

```json
{
  "encrypted": "<base64 do ciphertext sem tag>",
  "authTag": "<base64 da tag de 16 bytes>",
  "iv": "<base64 do IV>",
  "schema": "medical-record-metadata@1",
  "timestamp": 1700000000
}
```

- `encrypted`: resultado cifrado do JSON de metadata.
- `authTag`: tag de autenticação do AES-GCM (16 bytes).
- `iv`: vetor de inicialização (12 bytes).
- `schema`: ajuda a versionar o formato.
- `timestamp`: época de criação.

### Chave simétrica

- Exibida em hexadecimal (`32 bytes = 256 bits`).
- **Nunca** armazenar essa chave on-chain.
- Compartilhe com o médico usando ECIES (ver documentação principal).

## Configurando variáveis de ambiente

A interface web não lê variáveis de ambiente, portanto as credenciais devem ficar em um script/servidor backend.

1. Crie um arquivo `.env` na raiz do projeto (não o versione) com:

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

2. No script Node.js, carregue com `require('dotenv').config();`.
3. O frontend busca automaticamente a configuração do backend via `GET /config`.
4. Alternativamente, exporte as variáveis diretamente no terminal antes de rodar o script (Linux/macOS: `export`, Windows PowerShell: `$env:PINATA_JWT="..."`).

### Endpoints backend disponíveis

- `GET http://127.0.0.1:3000/config`: retorna configuração do contrato blockchain (`{ contractAddress, chainId, networkName }`). O frontend busca automaticamente ao carregar.
- `POST http://127.0.0.1:3000/upload`: recebe o payload cifrado no formato gerado pela interface e retorna `{ cid, metaHash, pinSize, timestamp }` em caso de sucesso. Em caso de erro, devolve `{ error, detail }` para facilitar o debug.
- `POST http://127.0.0.1:3000/upload-file`: recebe `multipart/form-data` com `file` (imagem/PDF), envia ao Pinata (`pinFileToIPFS`) e retorna `{ cid, sha256, pinSize, timestamp }`.
- `GET http://127.0.0.1:3000/health`: usado para checar o status do serviço.

### Fluxo de upload de arquivos

1. Acesse `http://127.0.0.1:8080/upload.html` e selecione os arquivos do exame.
2. Clique em **Enviar arquivos**. Cada arquivo é enviado ao Pinata e retorna CID + hash SHA-256.
3. Use **Preencher formulário** para mandar os CIDs direto para o campo `Files (CIDs)` do formulário principal (`index.html`).
4. Complete o restante das informações e siga o fluxo normal de geração/envio do payload cifrado.

## Customização

- Ajuste os campos do formulário em `index.html` conforme a necessidade.
- Modifique `script.js` para incluir campos adicionais no metadata.
- Integre com APIs externas (por exemplo, geração de `patientHash`) conforme seu fluxo.

## Próximos passos sugeridos

- Adicionar upload direto ao Pinata via fetch.
- Implementar cifragem ECIES para enviar a `encryptedSymKey` ao médico.
- Sincronizar com wallets via WalletConnect para assinatura do consentimento.

