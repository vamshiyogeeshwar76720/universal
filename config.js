// config.js
// =====================================================
// Global Environment
// =====================================================
const ENV = "mainnet"; // "testnet" | "mainnet"

// =====================================================
// Chain Configuration
// =====================================================
const CHAINS = {
  
  ethereum: {
    type: "evm",
    name: "Ethereum",
 
    testnet: {
      name: "Sepolia",
      chainId: 11155111,
      rpc: "https://sepolia.infura.io/v3/3b801e8b02084ba68f55b81b9209c916",
      emiContract: "0x8A03d44262707E8053af99fB57032F0B25661E3e",
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
          testnet: "0xc0a384bCB02bA86FA2e7Cd91eB7693C0b90C4961",
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
