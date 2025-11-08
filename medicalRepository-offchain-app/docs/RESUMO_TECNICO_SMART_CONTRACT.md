# Resumo Técnico - Smart Contract MedicalRecords

## Visão Geral

O contrato `MedicalRecords` é um sistema descentralizado de registros médicos implementado em Solidity 0.8.20, utilizando padrões de design avançados da blockchain Ethereum para garantir segurança, upgradeabilidade e controle de acesso granular.

---

## Padrões de Design Utilizados

### 1. **UUPS (Universal Upgradeable Proxy Standard) - ERC-1967**

**Objetivo**: Permitir upgrades do contrato sem perder dados de storage.

**Implementação**:
- **Contrato de Implementação**: `MedicalRecords.sol` (lógica)
- **Contrato Proxy**: `ERC1967Proxy` (armazena dados)
- **Padrão de Storage**: Storage gaps (`uint256[50] private __gap`) para preservar layout em upgrades

**Vantagens**:
- ✅ Upgradeabilidade sem perda de dados
- ✅ Endereço do contrato permanece o mesmo (proxy)
- ✅ Economia de gas (lógica separada do storage)

**Código**:
```solidity
contract MedicalRecords is UUPSUpgradeable {
    function _authorizeUpgrade(address newImplementation) 
        internal override onlyRole(UPGRADER_ROLE) {
        emit ImplementationUpgraded(newImplementation);
    }
}
```

---

### 2. **Access Control (Controle de Acesso) - OpenZeppelin**

**Objetivo**: Gerenciar permissões e roles de forma segura.

**Roles Implementadas**:
- `DEFAULT_ADMIN_ROLE`: Acesso administrativo completo
- `UPGRADER_ROLE`: Autorização para upgrades do contrato

**Herança**: `AccessControlUpgradeable` (compatível com upgradeable contracts)

**Uso**:
```solidity
_grantRole(DEFAULT_ADMIN_ROLE, admin);
_grantRole(UPGRADER_ROLE, admin);
```

---

### 3. **EIP-712 (Typed Structured Data Hashing and Signing)**

**Objetivo**: Assinaturas tipadas para consentimento médico, melhorando UX e segurança.

**Estrutura**:
- **Domain Separator**: `MedicalRecords`, versão `1`, chainId, endereço do contrato
- **Type Hash**: `keccak256("Consent(uint256 recordId,address doctor,uint64 expiry,bytes32 nonce)")`
- **Struct Hash**: Computado com inline assembly para otimização

**Implementação**:
```solidity
bytes32 structHash = _computeConsentStructHash(recordId, doctor, expiry, nonce);
bytes32 hash = _hashTypedDataV4(structHash);
address signer = ECDSA.recover(hash, patientSignature);
```

**Vantagens**:
- ✅ Assinaturas legíveis no MetaMask
- ✅ Prevenção de replay attacks (via nonce)
- ✅ Validação de expiração automática

---

### 4. **ReentrancyGuard (Proteção contra Reentrância)**

**Objetivo**: Prevenir ataques de reentrância em funções críticas.

**Herança**: `ReentrancyGuardUpgradeable`

**Aplicado em**:
- `createRecord()`: Criação de registros
- `grantConsent()`: Concessão de consentimento
- `logAccess()`: Logging de acesso

**Modificador**: `nonReentrant`

---

### 5. **Initializable Pattern**

**Objetivo**: Inicialização segura de contratos upgradeable.

**Implementação**:
```solidity
function initialize(address admin) external initializer {
    __UUPSUpgradeable_init();
    __AccessControl_init();
    __ReentrancyGuard_init();
    __EIP712_init("MedicalRecords", "1");
    // ...
}
```

**Proteção**: Constructor desabilita inicializadores para prevenir uso direto da implementação.

---

## Estruturas de Dados

### MedicalRecord
```solidity
struct MedicalRecord {
    uint256 id;          // ID único do registro
    address owner;       // Endereço do paciente (owner)
    string cidMeta;      // CID do IPFS (metadata criptografado)
    bytes32 metaHash;    // Hash SHA3-256 do metadata (integridade)
    uint64 timestamp;   // Timestamp de criação
    bool revoked;       // Status de revogação
}
```

**Características**:
- Armazena apenas referências (CID + hash), não dados sensíveis
- Suporte a revogação pelo owner
- Timestamp para auditoria

### Consent
```solidity
struct Consent {
    uint256 recordId;    // ID do registro associado
    address patient;     // Endereço do paciente
    address doctor;      // Endereço do médico
    uint64 expiry;       // Timestamp de expiração
    bytes32 nonce;       // Nonce único (proteção replay)
    bool revoked;        // Status de revogação
}
```

**Características**:
- Mapeamento triplo: `recordId → doctor → nonce`
- Expiração automática (validada on-chain)
- Revogação por paciente ou médico

---

## Funções Principais

### 1. `createRecord()`
**Função**: Criar novo registro médico
- **Validações**: 
  - `patient != address(0)`
  - `cidMeta` não vazio
  - `msg.sender == patient` (apenas o próprio paciente)
- **Storage**: Incrementa `_nextRecordId`, armazena struct
- **Event**: `RecordCreated`
- **Gas**: ~100k

### 2. `grantConsent()`
**Função**: Conceder acesso a médico
- **Validações**:
  - Registro existe e não está revogado
  - `expiry > block.timestamp`
  - Nonce não usado
  - Assinatura EIP-712 válida
- **Segurança**: 
  - Verificação de assinatura via `ECDSA.recover()`
  - Marca nonce como usado
- **Event**: `ConsentGranted`
- **Gas**: ~150k

### 3. `revokeConsent()`
**Função**: Revogar consentimento
- **Permissões**: Paciente OU médico
- **Validações**: Consent existe e não está revogado
- **Event**: `ConsentRevoked`

### 4. `getRecord()` / `getConsent()`
**Função**: Consultas view-only
- **Gas**: Gratuito (view)
- **Retorno**: Structs completas

---

## Segurança

### Proteções On-Chain

1. **ReentrancyGuard**: Previne ataques de reentrância
2. **AccessControl**: Controle granular de permissões
3. **Nonce System**: Previne replay attacks
4. **Expiry Validation**: Consents expiram automaticamente
5. **Signature Verification**: EIP-712 com ECDSA
6. **Storage Gaps**: Preserva compatibilidade em upgrades

### Proteções Off-Chain

1. **Criptografia**: Dados sensíveis nunca on-chain (apenas CID + hash)
2. **IPFS**: Armazenamento descentralizado de dados criptografados
3. **Chaves Simétricas**: Nunca armazenadas on-chain (AES-256-GCM)

---

## Otimizações

### 1. Inline Assembly para Hash
```solidity
function _computeConsentStructHash(...) private pure returns (bytes32) {
    bytes memory encoded = abi.encode(CONSENT_TYPEHASH, recordId, doctor, expiry, nonce);
    bytes32 result;
    assembly {
        result := keccak256(add(encoded, 32), mload(encoded))
    }
    return result;
}
```
**Benefício**: Redução de gas ao computar hash de structs.

### 2. Storage Packing
- `uint64` para timestamps (economia de storage)
- `bool` para flags (packing com outros tipos)

### 3. Calldata vs Memory
- Uso de `calldata` em parâmetros de entrada (mais eficiente)

---

## Eventos (Logging)

### Eventos Emitidos

1. **`RecordCreated`**: Novo registro criado
   - Indexed: `id`, `owner`
   - Dados: `cidMeta`, `metaHash`, `timestamp`

2. **`ConsentGranted`**: Consentimento concedido
   - Indexed: `recordId`, `patient`, `doctor`
   - Dados: `expiry`, `nonce`

3. **`ConsentRevoked`**: Consentimento revogado
   - Indexed: `recordId`, `patient`, `doctor`
   - Dados: `nonce`

4. **`AccessLogged`**: Acesso auditado
   - Indexed: `recordId`, `accessor`
   - Dados: `timestamp`, `action`

5. **`ImplementationUpgraded`**: Contrato atualizado
   - Indexed: `newImplementation`

**Uso**: Indexação permite queries eficientes via eventos.

---

## Upgrade Process

### Fluxo de Upgrade

1. **Deploy Nova Implementação**: Deploy de `MedicalRecordsV2.sol`
2. **Validação**: Verificar compatibilidade de storage
3. **Autorização**: Admin com `UPGRADER_ROLE` chama `upgradeTo()`
4. **Verificação**: Testar funções após upgrade

### Storage Layout Preservation

```solidity
uint256[50] private __gap; // Reserva 50 slots para futuras variáveis
```

**Regra**: Novas variáveis apenas ao final, nunca reordenar existentes.

---

## Integração com Frontend

### ABI Simplificado (Usado no Frontend)

```javascript
const CONTRACT_ABI = [
  'function createRecord(address patient, string calldata cidMeta, bytes32 metaHash) external returns (uint256 recordId)',
  'function getRecord(uint256 recordId) external view returns (tuple(...))',
  'function grantConsent(uint256 recordId, address doctor, uint64 expiry, bytes32 nonce, bytes calldata patientSignature) external',
  'function getConsent(uint256 recordId, address doctor, bytes32 nonce) external view returns (tuple(...))',
  'event RecordCreated(uint256 indexed id, address indexed owner, ...)',
  'event ConsentGranted(uint256 indexed recordId, address indexed patient, ...)'
];
```

### EIP-712 Domain (Frontend)

```javascript
{
  name: 'MedicalRecords',
  version: '1',
  chainId: 11155111, // Sepolia
  verifyingContract: '0x600aa9f85Ff66d41649EE02038cF8e9cfC0BF053'
}
```

---

## Padrões de Arquitetura

### 1. **Separation of Concerns**
- **On-Chain**: Metadados, controle de acesso, consentimentos
- **Off-Chain**: Dados sensíveis criptografados (IPFS)

### 2. **Minimal On-Chain Storage**
- Apenas CID (referência) e hash (integridade)
- Dados completos nunca on-chain

### 3. **Event-Driven Architecture**
- Eventos para auditoria e queries off-chain
- Indexação para eficiência

### 4. **Proxy Pattern**
- Lógica separada de storage
- Upgrade sem perda de dados

---

## Considerações de Gas

### Custos Aproximados

| Função | Gas Estimado | Observações |
|--------|--------------|-------------|
| `createRecord` | ~100k | Inclui storage + evento |
| `grantConsent` | ~150k | Inclui verificação EIP-712 |
| `revokeConsent` | ~50k | Apenas atualização de flag |
| `logAccess` | ~30k | Evento de auditoria |
| `getRecord` | 0 | View function (gratuito) |
| `getConsent` | 0 | View function (gratuito) |

---

## Conformidade com Padrões

### ✅ EIPs Implementados

- **EIP-712**: Typed structured data hashing
- **ERC-1967**: Proxy storage slots
- **EIP-1822**: Universal upgradeable proxy standard (UUPS)

### ✅ OpenZeppelin Contracts

- `UUPSUpgradeable`
- `AccessControlUpgradeable`
- `ReentrancyGuardUpgradeable`
- `EIP712Upgradeable`
- `Initializable`

---

## Resumo dos Padrões

| Padrão | Propósito | Benefício |
|--------|-----------|-----------|
| **UUPS** | Upgradeabilidade | Contratos atualizáveis sem perda de dados |
| **AccessControl** | Permissões | Controle granular de acesso |
| **EIP-712** | Assinaturas | UX melhorada e segurança |
| **ReentrancyGuard** | Segurança | Proteção contra reentrância |
| **Storage Gaps** | Upgrade Safety | Compatibilidade em upgrades |
| **Proxy Pattern** | Separação Lógica | Economia de gas e flexibilidade |
| **Event Logging** | Auditoria | Rastreabilidade e queries off-chain |

---

## Conclusão

O contrato `MedicalRecords` implementa uma arquitetura robusta e segura utilizando padrões consagrados da indústria blockchain:

- ✅ **Upgradeável**: UUPS permite evolução sem perda de dados
- ✅ **Seguro**: Múltiplas camadas de proteção (reentrancy, access control, nonces)
- ✅ **Eficiente**: Otimizações de gas e storage
- ✅ **Padrão**: Conformidade com EIPs e OpenZeppelin
- ✅ **Auditável**: Eventos completos para rastreabilidade
- ✅ **Privacidade**: Dados sensíveis nunca on-chain

**Versão Atual**: 1.0.0  
**Endereço Proxy**: `0x600aa9f85Ff66d41649EE02038cF8e9cfC0BF053` (Sepolia)  
**Rede**: Sepolia Testnet (Chain ID: 11155111)

