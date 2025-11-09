// Script para gerar chave mestra global
// Execute: node generate-master-key.js
// Copie a chave gerada para o arquivo .env como MASTER_KEY=...

const crypto = require('crypto');

// Gerar chave AES-256 (32 bytes = 64 caracteres hex)
const masterKey = crypto.randomBytes(32).toString('hex');

console.log('\n========================================');
console.log('CHAVE MESTRA GERADA');
console.log('========================================\n');
console.log('Adicione esta linha ao seu arquivo .env:\n');
console.log(`MASTER_KEY=${masterKey}\n`);
console.log('========================================\n');
console.log('⚠️  IMPORTANTE:');
console.log('   - Mantenha esta chave em SEGREDO');
console.log('   - Não compartilhe publicamente');
console.log('   - Use a mesma chave em todos os ambientes (dev/prod)');
console.log('   - Se perder a chave, não poderá descriptografar registros antigos\n');

