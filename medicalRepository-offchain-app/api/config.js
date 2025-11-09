// Vercel Serverless Function - /api/config
// Retorna configuração do sistema (sem expor MASTER_KEY no frontend)

export default function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // IMPORTANTE: No Vercel, use variáveis SEM prefixo NEXT_PUBLIC_ para dados sensíveis
  // Mas como já mudamos tudo para NEXT_PUBLIC_, vamos usar essas
  // Em produção, você deve ter DUAS versões: com e sem prefixo
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS;
  const chainId = (process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID) 
    ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID, 10) 
    : null;
  const networkName = process.env.NEXT_PUBLIC_NETWORK_NAME || process.env.NETWORK_NAME;
  const masterKey = process.env.NEXT_PUBLIC_MASTER_KEY || process.env.MASTER_KEY;

  // Validar se as variáveis obrigatórias estão configuradas
  if (!contractAddress || !chainId || !networkName || !masterKey) {
    console.error('[API] ERRO: Variáveis de ambiente não configuradas!');
    console.error('[API] Configure no Vercel:');
    console.error('  NEXT_PUBLIC_CONTRACT_ADDRESS=' + (contractAddress || 'NÃO DEFINIDO'));
    console.error('  NEXT_PUBLIC_CHAIN_ID=' + (chainId || 'NÃO DEFINIDO'));
    console.error('  NEXT_PUBLIC_NETWORK_NAME=' + (networkName || 'NÃO DEFINIDO'));
    console.error('  NEXT_PUBLIC_MASTER_KEY=' + (masterKey ? 'DEFINIDO' : 'NÃO DEFINIDO'));

    return res.status(500).json({
      error: 'Configuração incompleta',
      message: 'Configure NEXT_PUBLIC_CONTRACT_ADDRESS, NEXT_PUBLIC_CHAIN_ID, NEXT_PUBLIC_NETWORK_NAME e NEXT_PUBLIC_MASTER_KEY nas variáveis de ambiente do Vercel',
      missing: {
        contractAddress: !contractAddress,
        chainId: !chainId,
        networkName: !networkName,
        masterKey: !masterKey
      }
    });
  }

  // Validar formato da chave mestra (deve ser 64 caracteres hex)
  if (masterKey.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(masterKey)) {
    return res.status(500).json({
      error: 'Chave mestra inválida',
      message: 'NEXT_PUBLIC_MASTER_KEY deve ser uma string hexadecimal de 64 caracteres (32 bytes)'
    });
  }

  const config = {
    contractAddress: contractAddress,
    chainId: chainId,
    networkName: networkName,
    masterKey: masterKey
  };

  // Adicionar RPC e Block Explorer se configurados
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL;
  const blockExplorerUrl = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || process.env.BLOCK_EXPLORER_URL;

  if (rpcUrl) {
    config.rpcUrl = rpcUrl;
  }

  if (blockExplorerUrl) {
    config.blockExplorerUrl = blockExplorerUrl;
  }

  console.log('[API] Configuração retornada:', {
    contractAddress: config.contractAddress,
    chainId: config.chainId,
    networkName: config.networkName,
    masterKeyConfigured: true
  });

  return res.status(200).json(config);
}

