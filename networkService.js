/**
 * ============================================================================
 * NETWORK SERVICE MODULE - networkService.js
 * ============================================================================
 * Handles network configuration, switching, and validation
 *
 * Features:
 * - Network configuration management
 * - Automatic network detection and validation
 * - Chain switching with fallback options
 * - Network-specific contract and RPC management
 * ============================================================================
 */

import { switchNetwork, addNetwork } from "./walletService.js";

// ============================================================================
// NETWORK CONFIGURATIONS
// ============================================================================

export const NETWORK_CONFIG = {
  // ---- ETHEREUM ----
  11155111: {
    // Sepolia Testnet
    id: 11155111,
    name: "Sepolia Testnet",
    shortName: "Sepolia",
    currency: "ETH",
    type: "testnet",
    rpc: "https://eth-sepolia.g.alchemy.com/v2/dtkomuYIPcPjosX9YuBSL",
    emiContract: "0x34Ec000b58547d52821216831bf88E085DFD715C",
    explorer: "https://sepolia.etherscan.io",

    // EIP-3085 config for wallet_addEthereumChain
    eip3085: {
      chainId: "0xaa36a7",
      chainName: "Sepolia Testnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: [
        "https://eth-sepolia.g.alchemy.com/v2/dtkomuYIPcPjosX9YuBSL",
      ],
      blockExplorerUrls: ["https://sepolia.etherscan.io"],
    },
  },

  1: {
    // Ethereum Mainnet
    id: 1,
    name: "Ethereum Mainnet",
    shortName: "Ethereum",
    currency: "ETH",
    type: "mainnet",
    rpc: "https://eth-mainnet.g.alchemy.com/v2/dtkomuYIPcPjosX9YuBSL",
    emiContract: "0x7BAA6f2fFc568F1114A392557Bc3bCDe609bb795",
    explorer: "https://etherscan.io",

    eip3085: {
      chainId: "0x1",
      chainName: "Ethereum Mainnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: [
        "https://eth-mainnet.g.alchemy.com/v2/dtkomuYIPcPjosX9YuBSL",
      ],
      blockExplorerUrls: ["https://etherscan.io"],
    },
  },

  // ---- POLYGON (Optional) ----
  80001: {
    // Mumbai Testnet
    id: 80001,
    name: "Mumbai Testnet",
    shortName: "Mumbai",
    currency: "MATIC",
    type: "testnet",
    rpc: "https://rpc-mumbai.maticvigil.com/",
    emiContract: "0xYourMumbaiContract", // Update with actual address
    explorer: "https://mumbai.polygonscan.com",

    eip3085: {
      chainId: "0x13881",
      chainName: "Mumbai Testnet",
      nativeCurrency: { name: "Polygon Matic", symbol: "MATIC", decimals: 18 },
      rpcUrls: ["https://rpc-mumbai.maticvigil.com/"],
      blockExplorerUrls: ["https://mumbai.polygonscan.com"],
    },
  },

  137: {
    // Polygon Mainnet
    id: 137,
    name: "Polygon Mainnet",
    shortName: "Polygon",
    currency: "MATIC",
    type: "mainnet",
    rpc: "https://polygon-rpc.com/",
    emiContract: "0xYourPolygonContract", // Update with actual address
    explorer: "https://polygonscan.com",

    eip3085: {
      chainId: "0x89",
      chainName: "Polygon",
      nativeCurrency: { name: "Polygon Matic", symbol: "MATIC", decimals: 18 },
      rpcUrls: ["https://polygon-rpc.com/"],
      blockExplorerUrls: ["https://polygonscan.com"],
    },
  },

  // ---- BSC (Optional) ----
  97: {
    // BSC Testnet
    id: 97,
    name: "BSC Testnet",
    shortName: "BSC Testnet",
    currency: "BNB",
    type: "testnet",
    rpc: "https://data-seed-prebsc-1-s1.binance.org:8545",
    emiContract: "0xYourBSCTestContract", // Update with actual address
    explorer: "https://testnet.bscscan.com",

    eip3085: {
      chainId: "0x61",
      chainName: "BSC Testnet",
      nativeCurrency: { name: "Binance Coin", symbol: "BNB", decimals: 18 },
      rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545"],
      blockExplorerUrls: ["https://testnet.bscscan.com"],
    },
  },

  56: {
    // BSC Mainnet
    id: 56,
    name: "BSC Mainnet",
    shortName: "BSC",
    currency: "BNB",
    type: "mainnet",
    rpc: "https://bsc-dataseed1.binance.org",
    emiContract: "0xYourBSCContract", // Update with actual address
    explorer: "https://bscscan.com",

    eip3085: {
      chainId: "0x38",
      chainName: "BSC Mainnet",
      nativeCurrency: { name: "Binance Coin", symbol: "BNB", decimals: 18 },
      rpcUrls: ["https://bsc-dataseed1.binance.org"],
      blockExplorerUrls: ["https://bscscan.com"],
    },
  },
};

// ============================================================================
// NETWORK HELPERS
// ============================================================================

/**
 * Get network config by chain ID
 */
export function getNetworkConfig(chainId) {
  return NETWORK_CONFIG[chainId] || null;
}

/**
 * Get all supported networks
 */
export function getSupportedNetworks() {
  return Object.values(NETWORK_CONFIG);
}

/**
 * Get testnet networks only
 */
export function getTestnetNetworks() {
  return Object.values(NETWORK_CONFIG).filter((n) => n.type === "testnet");
}

/**
 * Get mainnet networks only
 */
export function getMainnetNetworks() {
  return Object.values(NETWORK_CONFIG).filter((n) => n.type === "mainnet");
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds() {
  return Object.keys(NETWORK_CONFIG).map(Number);
}

/**
 * Check if network is supported
 */
export function isNetworkSupported(chainId) {
  return chainId in NETWORK_CONFIG;
}

/**
 * Get EMI contract for network
 */
export function getEmiContract(chainId) {
  const config = getNetworkConfig(chainId);
  return config ? config.emiContract : null;
}

/**
 * Get RPC for network
 */
export function getRpc(chainId) {
  const config = getNetworkConfig(chainId);
  return config ? config.rpc : null;
}

/**
 * Get currency for network
 */
export function getCurrency(chainId) {
  const config = getNetworkConfig(chainId);
  return config ? config.currency : "ETH";
}

/**
 * Get display name for network
 */
export function getNetworkName(chainId) {
  const config = getNetworkConfig(chainId);
  return config ? config.name : `Chain ${chainId}`;
}

// ============================================================================
// NETWORK SWITCHING & VALIDATION
// ============================================================================

/**
 * Request network switch with fallback to manual selection
 */
export async function requestNetworkSwitch(chainId) {
  const config = getNetworkConfig(chainId);

  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  try {
    // Try to switch to existing chain
    await switchNetwork(chainId);
    return true;
  } catch (switchError) {
    if (switchError.message.includes("not found")) {
      // Chain not in wallet, ask to add it
      console.log(`Chain ${chainId} not in wallet, requesting to add...`);
      try {
        await addNetwork(config.eip3085);
        // After adding, try to switch
        await switchNetwork(chainId);
        return true;
      } catch (addError) {
        throw new Error(
          `Failed to add chain: ${addError.message}. Please add manually in wallet settings.`,
        );
      }
    }
    throw switchError;
  }
}

/**
 * Validate network and switch if necessary
 * Returns true if on correct network, false if switched, throws on error
 */
export async function validateAndSyncNetwork(requiredChainId) {
  const supportedChainIds = getSupportedChainIds();

  if (!supportedChainIds.includes(requiredChainId)) {
    throw new Error(
      `Chain ${requiredChainId} is not supported. Supported: ${supportedChainIds.join(
        ", ",
      )}`,
    );
  }

  // Wallet will handle syncing when user confirms
  try {
    await requestNetworkSwitch(requiredChainId);
    return true;
  } catch (error) {
    console.error("Network switch failed:", error);
    throw error;
  }
}

/**
 * Get closest compatible network if current is unsupported
 * Prefers: same currency -> same type (testnet/mainnet) -> any supported
 */
export function getClosestNetwork(currentChainId, preferredType = null) {
  const current = getNetworkConfig(currentChainId);
  const supported = getSupportedNetworks();

  if (!current) {
    // Current not supported, return first available
    return supported[0];
  }

  // Try same currency and type
  let closest = supported.find(
    (n) =>
      n.currency === current.currency &&
      (preferredType ? n.type === preferredType : true),
  );

  if (closest) return closest;

  // Try same currency
  closest = supported.find((n) => n.currency === current.currency);
  if (closest) return closest;

  // Return first (should be Sepolia testnet)
  return supported[0];
}

// ============================================================================
// NETWORK-AWARE UTILITIES
// ============================================================================

/**
 * Format amount with network currency
 */
export function formatAmount(amount, chainId) {
  const currency = getCurrency(chainId);
  return `${amount} ${currency}`;
}

/**
 * Generate explorer link for address
 */
export function getExplorerLink(chainId, address, type = "address") {
  const config = getNetworkConfig(chainId);
  if (!config) return null;

  return `${config.explorer}/${type}/${address}`;
}

/**
 * Generate explorer link for transaction
 */
export function getTxLink(chainId, txHash) {
  return getExplorerLink(chainId, txHash, "tx");
}

/**
 * Generate explorer link for contract
 */
export function getContractLink(chainId) {
  const contract = getEmiContract(chainId);
  return getExplorerLink(chainId, contract, "address");
}

/**
 * Compare networks
 */
export function networkEquals(chainId1, chainId2) {
  return Number(chainId1) === Number(chainId2);
}

// ============================================================================
// NETWORK VALIDATION & NOTIFICATIONS
// ============================================================================

/**
 * Create network mismatch error message
 */
export function createNetworkMismatchMessage(currentChainId, requiredChainId) {
  const current = getNetworkConfig(currentChainId);
  const required = getNetworkConfig(requiredChainId);

  const currentName = current ? current.name : `Chain ${currentChainId}`;
  const requiredName = required ? required.name : `Chain ${requiredChainId}`;

  return `Wrong network! Currently on ${currentName}, please switch to ${requiredName}`;
}

/**
 * Validate all required networks are in config
 */
export function validateNetworkConfig() {
  const issues = [];

  Object.entries(NETWORK_CONFIG).forEach(([chainId, config]) => {
    if (!config.emiContract || config.emiContract.includes("Your")) {
      issues.push(
        `Chain ${chainId}: Missing or placeholder EMI contract address`,
      );
    }
    if (!config.rpc) {
      issues.push(`Chain ${chainId}: Missing RPC URL`);
    }
  });

  return issues;
}
