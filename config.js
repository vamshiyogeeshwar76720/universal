const ENV = "testnet"; // "testnet" | "mainnet"
const CHAINS = {
  
  ethereum: {
    type: "evm",
    name: "Ethereum",

    testnet: {
      name: "Sepolia",
      chainId: 11155111,
      rpc: "https://sepolia.infura.io/v3/3b801e8b02084ba68f55b81b9209c916",
      emiContract: "0x32262849a6A82BF4027E21077f0793DbEEA99ED7",
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
          testnet: "0x4Ad13334f266F52a3BDfdD7fCCeF50304F4426c1",
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
