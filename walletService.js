/**
 * ============================================================================
 * WALLET SERVICE MODULE - walletService.js
 * ============================================================================
 * Handles all wallet connection, detection, and management logic.
 * Supports: MetaMask, Trust Wallet, Coinbase, Binance, OKX, and all EIP-1193
 *
 * Features:
 * - Automatic wallet detection with provider identification
 * - Silent connection with localStorage persistence
 * - Network auto-detection and switching
 * - Event listeners for wallet/network changes
 * - Comprehensive error handling with recovery
 * ============================================================================
 */

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";

// ============================================================================
// STORAGE KEYS
// ============================================================================
const STORAGE_KEYS = {
  CONNECTED: "emi_wallet_connected",
  ADDRESS: "emi_wallet_address",
  CHAIN_ID: "emi_chain_id",
  PROVIDER_TYPE: "emi_provider_type",
};

// ============================================================================
// WALLET PROVIDER DETECTION
// ============================================================================

/**
 * Detect available wallet provider with identification
 * @returns {Object} {provider, type, name}
 */
export function detectWalletProvider() {
  const providers = [];

  // MetaMask (must check before others - can be injected by others)
  if (window.ethereum?.isMetaMask) {
    providers.push({
      provider: window.ethereum,
      type: "metamask",
      name: "MetaMask",
      priority: 100,
    });
  }

  // Trust Wallet
  if (window.trustWallet) {
    providers.push({
      provider: window.trustWallet,
      type: "trustwallet",
      name: "Trust Wallet",
      priority: 90,
    });
  }

  // Coinbase Wallet
  if (window.coinbaseWalletProvider) {
    providers.push({
      provider: window.coinbaseWalletProvider,
      type: "coinbase",
      name: "Coinbase Wallet",
      priority: 85,
    });
  }

  // Binance Chain Wallet
  if (window.BinanceChain) {
    providers.push({
      provider: window.BinanceChain,
      type: "binance",
      name: "Binance Wallet",
      priority: 80,
    });
  }

  // OKX Wallet
  if (window.okxwallet) {
    providers.push({
      provider: window.okxwallet,
      type: "okx",
      name: "OKX Wallet",
      priority: 75,
    });
  }

  // Generic EIP-1193 Provider
  if (window.ethereum && !window.ethereum.isMetaMask) {
    providers.push({
      provider: window.ethereum,
      type: "eip1193",
      name: "Web3 Wallet",
      priority: 50,
    });
  }

  // Sort by priority and return highest
  if (providers.length === 0) {
    return null;
  }

  return providers.sort((a, b) => b.priority - a.priority)[0];
}

/**
 * Get wallet provider from localStorage or detect new one
 */
export function getWalletProvider() {
  const savedProvider = localStorage.getItem(STORAGE_KEYS.PROVIDER_TYPE);

  if (savedProvider) {
    const providerInfo = detectWalletProvider();
    if (providerInfo && providerInfo.type === savedProvider) {
      return providerInfo;
    }
  }

  return detectWalletProvider();
}

// ============================================================================
// CONNECTION STATE MANAGEMENT
// ============================================================================

let connectionState = {
  provider: null,
  signer: null,
  address: null,
  chainId: null,
  providerType: null,
  isConnected: false,
};

// Connection state listeners
const stateListeners = [];

export function onConnectionStateChange(callback) {
  stateListeners.push(callback);
}

function notifyStateChange() {
  stateListeners.forEach((cb) => cb(connectionState));
}

// ============================================================================
// WALLET CONNECTION FUNCTIONS
// ============================================================================

/**
 * Initialize wallet from saved state or auto-connect
 * @param {Array} supportedChainIds - Array of supported chain IDs
 * @returns {Promise<Object>} Connection state
 */
export async function initializeWallet(supportedChainIds = []) {
  console.log("🔍 Initializing wallet...");

  const walletInfo = getWalletProvider();
  if (!walletInfo) {
    console.log("❌ No wallet detected");
    return connectionState;
  }

  console.log(`✅ Detected: ${walletInfo.name}`);

  try {
    // Try silent auto-connect first
    await autoConnectWallet(walletInfo, supportedChainIds);
  } catch (error) {
    console.log("ℹ️  Auto-connect requires user interaction:", error.message);
    // Don't throw - let user click connect button
  }

  return connectionState;
}

/**
 * Attempt silent connection (no popups)
 */
async function autoConnectWallet(walletInfo, supportedChainIds = []) {
  const wasConnected = localStorage.getItem(STORAGE_KEYS.CONNECTED) === "true";

  if (!wasConnected) {
    console.log("ℹ️  No prior connection found");
    return;
  }

  const savedAddress = localStorage.getItem(STORAGE_KEYS.ADDRESS);
  const savedChainId = localStorage.getItem(STORAGE_KEYS.CHAIN_ID);

  try {
    connectionState.provider = new ethers.providers.Web3Provider(
      walletInfo.provider,
      "any",
    );

    const accounts = await connectionState.provider.listAccounts();

    if (accounts.length === 0) {
      console.log("ℹ️  No accounts available");
      clearConnectionState();
      return;
    }

    const address = accounts[0];

    // Verify saved address matches current
    if (savedAddress && address.toLowerCase() !== savedAddress.toLowerCase()) {
      console.log("⚠️  Account changed, requesting new connection");
      clearConnectionState();
      throw new Error("Account changed");
    }

    connectionState.signer = connectionState.provider.getSigner();
    connectionState.address = address;
    connectionState.providerType = walletInfo.type;

    // Get network
    const network = await connectionState.provider.getNetwork();
    connectionState.chainId = network.chainId;

    // Check if chain is supported
    if (
      supportedChainIds.length > 0 &&
      !supportedChainIds.includes(connectionState.chainId)
    ) {
      console.log(
        `⚠️  Connected to unsupported chain: ${connectionState.chainId}`,
      );
      // Don't fail - let user see the network mismatch
    }

    connectionState.isConnected = true;
    saveConnectionState();
    setupEventListeners(walletInfo.provider);

    console.log("✅ Auto-connected:", address);
    notifyStateChange();
  } catch (error) {
    console.error("Auto-connect failed:", error);
    clearConnectionState();
    throw error;
  }
}

/**
 * Manually connect wallet (shows popup)
 */
export async function connectWallet(supportedChainIds = []) {
  const walletInfo = getWalletProvider();
  if (!walletInfo) {
    throw new Error(
      "No wallet detected. Please install MetaMask or Trust Wallet.",
    );
  }

  try {
    console.log(`🔗 Connecting ${walletInfo.name}...`);

    connectionState.provider = new ethers.providers.Web3Provider(
      walletInfo.provider,
      "any",
    );

    // Request accounts (this will popup)
    const accounts = await connectionState.provider.send(
      "eth_requestAccounts",
      [],
    );

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts provided by wallet");
    }

    connectionState.signer = connectionState.provider.getSigner();
    connectionState.address = accounts[0];
    connectionState.providerType = walletInfo.type;

    // Get current network
    const network = await connectionState.provider.getNetwork();
    connectionState.chainId = network.chainId;

    // Check if supported and potentially switch
    if (
      supportedChainIds.length > 0 &&
      !supportedChainIds.includes(connectionState.chainId)
    ) {
      console.log(
        `⚠️  Wrong network. Connected to ${
          connectionState.chainId
        }, expected one of: ${supportedChainIds.join(", ")}`,
      );

      // Try to auto-switch to first supported network
      try {
        await switchNetwork(supportedChainIds[0]);
      } catch (switchError) {
        console.warn("Auto-switch failed:", switchError.message);
        // Continue anyway - user can switch manually
      }
    }

    connectionState.isConnected = true;
    saveConnectionState();
    setupEventListeners(walletInfo.provider);

    console.log("✅ Connected:", connectionState.address);
    notifyStateChange();

    return connectionState;
  } catch (error) {
    console.error("Connection failed:", error);
    clearConnectionState();
    throw error;
  }
}

/**
 * Switch network (EIP-3035)
 */
export async function switchNetwork(chainId) {
  if (!connectionState.provider || !connectionState.isConnected) {
    throw new Error("Wallet not connected");
  }

  try {
    const hexChainId = "0x" + chainId.toString(16);
    await connectionState.provider.provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });

    connectionState.chainId = chainId;
    saveConnectionState();
    notifyStateChange();

    console.log(`✅ Switched to chain ${chainId}`);
  } catch (error) {
    if (error.code === 4902) {
      throw new Error(`Chain ${chainId} not found in wallet`);
    }
    throw error;
  }
}

/**
 * Add network to wallet (EIP-3085)
 */
export async function addNetwork(chainConfig) {
  if (!connectionState.provider) {
    throw new Error("Wallet not connected");
  }

  try {
    await connectionState.provider.provider.request({
      method: "wallet_addEthereumChain",
      params: [chainConfig],
    });

    console.log(`✅ Added chain ${chainConfig.chainId}`);
  } catch (error) {
    if (error.code === 4001) {
      throw new Error("User rejected network addition");
    }
    throw error;
  }
}

/**
 * Disconnect wallet (only on explicit user action)
 */
export function disconnectWallet() {
  console.log("🔌 Disconnecting wallet...");
  clearConnectionState();
  console.log("✅ Disconnected");
  notifyStateChange();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners(provider) {
  // Listen for account changes
  provider.on("accountsChanged", handleAccountsChanged);

  // Listen for chain changes
  provider.on("chainChanged", handleChainChanged);

  // Listen for disconnection
  if (provider.on) {
    provider.on("disconnect", handleDisconnect);
  }

  console.log("✅ Event listeners attached");
}

function removeEventListeners(provider) {
  try {
    provider.removeListener("accountsChanged", handleAccountsChanged);
    provider.removeListener("chainChanged", handleChainChanged);
    provider.removeListener("disconnect", handleDisconnect);
  } catch (e) {
    // Some providers don't support removeListener
  }
}

async function handleAccountsChanged(accounts) {
  console.log("👤 Accounts changed:", accounts);

  if (accounts.length === 0) {
    disconnectWallet();
  } else {
    connectionState.address = accounts[0];
    saveConnectionState();
    notifyStateChange();
  }
}

function handleChainChanged(chainIdHex) {
  const chainId = parseInt(chainIdHex, 16);
  console.log("🔗 Chain changed to:", chainId);

  connectionState.chainId = chainId;
  saveConnectionState();
  notifyStateChange();
}

function handleDisconnect(error) {
  console.log("❌ Wallet disconnected:", error);
  clearConnectionState();
  notifyStateChange();
}

// ============================================================================
// STATE PERSISTENCE
// ============================================================================

function saveConnectionState() {
  localStorage.setItem(STORAGE_KEYS.CONNECTED, "true");
  localStorage.setItem(STORAGE_KEYS.ADDRESS, connectionState.address);
  localStorage.setItem(STORAGE_KEYS.CHAIN_ID, connectionState.chainId);
  localStorage.setItem(
    STORAGE_KEYS.PROVIDER_TYPE,
    connectionState.providerType,
  );
}

function clearConnectionState() {
  if (connectionState.provider) {
    removeEventListeners(connectionState.provider.provider);
  }

  connectionState = {
    provider: null,
    signer: null,
    address: null,
    chainId: null,
    providerType: null,
    isConnected: false,
  };

  localStorage.removeItem(STORAGE_KEYS.CONNECTED);
  localStorage.removeItem(STORAGE_KEYS.ADDRESS);
  localStorage.removeItem(STORAGE_KEYS.CHAIN_ID);
  localStorage.removeItem(STORAGE_KEYS.PROVIDER_TYPE);
}

// ============================================================================
// STATE GETTERS
// ============================================================================

export function getConnectionState() {
  return { ...connectionState };
}

export function isConnected() {
  return connectionState.isConnected;
}

export function getAddress() {
  return connectionState.address;
}

export function getChainId() {
  return connectionState.chainId;
}

export function getProvider() {
  return connectionState.provider;
}

export function getSigner() {
  return connectionState.signer;
}

export function getProviderType() {
  return connectionState.providerType;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format address for display
 */
export function formatAddress(address, chars = 4) {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Check if address matches (case-insensitive)
 */
export function addressEquals(addr1, addr2) {
  if (!addr1 || !addr2) return false;
  return addr1.toLowerCase() === addr2.toLowerCase();
}
