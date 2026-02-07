const ENV = "testnet"; // "testnet" | "mainnet"
const CHAINS = {
  
  ethereum: {
    type: "evm",
    name: "Ethereum",

    testnet: {
      name: "Sepolia",
      chainId: 11155111,
      rpc: "https://sepolia.infura.io/v3/3b801e8b02084ba68f55b81b9209c916",
      emiContract: "0xa5D37d983AF3C180A59f6b1EbE1BC0a1F5c768d3",
    },

    mainnet: {
      name: "Mainnet",
      chainId: 1,
      rpc: "https://mainnet.infura.io/v3/3b801e8b02084ba68f55b81b9209c916",
      emiContract: "0x7BAA6f2fFc568F1114A392557Bc3bCDe609bb795",
    },

    tokens: {
      USDT: {
        decimals: 6,
        permit: false,
        addresses: {
          testnet: "0xAD7A06965C287c7da28d64E6Bc7c90785a1fab1d",
          mainnet: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        },
      },
    },
  },
};


function getChain(chainKey) {
  return CHAINS[chainKey] || null;
}

function isEvmChain(chainKey) {
  return CHAINS[chainKey]?.type === "evm";
}

function getRpc(chainKey) {
  const chain = CHAINS[chainKey];
  if (!chain) return null;

  if (chain.type === "tron") return chain.rpc;
  return chain[ENV].rpc;
}

function getEmiContract(chainKey) {
  const chain = CHAINS[chainKey];
  if (!chain) return null;

  if (chain.type === "tron") return chain.emiContract;
  return chain[ENV].emiContract;
}

function getTokens(chainKey) {
  const chain = CHAINS[chainKey];
  if (!chain) return {};

  const tokens = {};

  for (const [symbol, t] of Object.entries(chain.tokens)) {
    tokens[symbol] = chain.type === "tron" ? t.address : t.addresses[ENV];
  }
  return tokens;
}

const TOKEN_DECIMALS = {
  USDT: 6,
  DAI: 18,
  WETH: 18,
  BUSD: 18,
};

function getTokenMeta(chainKey, symbol) {
  const chain = CHAINS[chainKey];
  if (!chain) return null;

  return chain.tokens[symbol] || null;
}

function generateEmiLink({ chain, planId, token, receiver }) {
  const base = "https://yourapp.com/activate";
  const params = new URLSearchParams({
    chain,
    planId,
    token,
    receiver,
  });

  return `${base}?${params.toString()}`;
}


// Export

export const AppConfig = {
  ENV,
  CHAINS,
  TOKEN_DECIMALS,
  // helpers
  getChain,
  isEvmChain,
  getRpc,
  getEmiContract,
  getTokens,
  getTokenMeta,
  generateEmiLink,
};
