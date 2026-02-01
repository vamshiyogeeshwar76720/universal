# EMI Auto-Payment System - Developer Reference Card

## 🎯 Quick API Reference

### WalletService Module

#### Connection Management
```javascript
// Initialize on page load
await WalletService.initializeWallet(supportedChainIds);

// Manual connection (shows popup)
await WalletService.connectWallet(supportedChainIds);

// Disconnect (clears everything)
WalletService.disconnectWallet();

// Subscribe to connection changes
WalletService.onConnectionStateChange((state) => {
  console.log(state.isConnected, state.address, state.chainId);
});
```

#### State Getters
```javascript
// Get all state at once
const state = WalletService.getConnectionState();
// {provider, signer, address, chainId, providerType, isConnected}

// Get individual values
const connected = WalletService.isConnected(); // boolean
const address = WalletService.getAddress();     // "0x..."
const chainId = WalletService.getChainId();     // 11155111
const signer = WalletService.getSigner();       // ethers.Signer
const provider = WalletService.getProvider();   // ethers.Provider

// Get provider type
const walletType = WalletService.getProviderType(); // "metamask"
```

#### Wallet Detection
```javascript
// Detect available wallet
const wallet = WalletService.detectWalletProvider();
// {provider, type, name, priority}
// Returns null if no wallet

// Get from localStorage or detect
const wallet = WalletService.getWalletProvider();
```

#### Utilities
```javascript
// Format address for display
const short = WalletService.formatAddress("0x38ad99a6f863bfd2e65d0cd77e1cdd5cfbbcd538");
// "0x38ad...9538"

// Compare addresses (case-insensitive)
const same = WalletService.addressEquals(addr1, addr2); // boolean
```

---

### NetworkService Module

#### Network Configuration
```javascript
// Get network by chain ID
const config = NetworkService.getNetworkConfig(11155111);
// {id, name, chainId, rpc, emiContract, currency, ...}

// Get all networks
const networks = NetworkService.getSupportedNetworks();

// Get only testnets
const testnets = NetworkService.getTestnetNetworks();

// Get only mainnets
const mainnets = NetworkService.getMainnetNetworks();

// Get all chain IDs
const chainIds = NetworkService.getSupportedChainIds();
// [11155111, 1, 80001, 137, 97, 56]
```

#### Network Validation & Switching
```javascript
// Check if network is supported
const supported = NetworkService.isNetworkSupported(1); // boolean

// Request network switch (with auto-add if needed)
await NetworkService.requestNetworkSwitch(1);

// Get closest supported network
const closest = NetworkService.getClosestNetwork(
  currentChainId,
  "testnet" // optional: prefer testnet/mainnet
);

// Validate all configs
const issues = NetworkService.validateNetworkConfig();
// Returns array of configuration issues
```

#### Display Helpers
```javascript
// Get contract address
const contract = NetworkService.getEmiContract(1);

// Get RPC URL
const rpc = NetworkService.getRpc(1);

// Get currency
const currency = NetworkService.getCurrency(1); // "ETH"

// Get network name
const name = NetworkService.getNetworkName(1); // "Ethereum Mainnet"

// Create error message
const msg = NetworkService.createNetworkMismatchMessage(97, 11155111);
// "Wrong network! Currently on BSC Testnet, please switch to Sepolia Testnet"

// Format amount with currency
const formatted = NetworkService.formatAmount("0.01", 1);
// "0.01 ETH"

// Get explorer URLs
const link = NetworkService.getExplorerLink(1, "0x...", "address");
const txLink = NetworkService.getTxLink(1, "0x...");
const contractLink = NetworkService.getContractLink(1);
```

#### Network Comparison
```javascript
// Check if networks are same
const same = NetworkService.networkEquals(1, 1); // boolean
```

---

### Receiver Application

#### App Initialization
```javascript
// Called on DOMContentLoaded
initApp();
// Populates networks, sets up listeners, attempts auto-connect
```

#### Plan Creation
```javascript
// Main function - create and link plan
window.createAndLinkPlan();
// Validates inputs → Creates plan → Links → Registers monitoring

// Required form values:
// - #emiAmount: "0.01"
// - #totalAmount: "0.1"
// - #intervalSelect: "86400" (or "custom")
// - #customInterval: (only if custom selected)
```

#### Sharing & Monitoring
```javascript
// Check monitoring status
checkMonitoringStatus(planId);
// Fetches status from Vercel API, updates UI

// Generate sharing links
generateShareLinks(planId);
// Creates MetaMask & Trust Wallet deep links
// Generates QR codes
```

#### Utilities (Global Window Functions)
```javascript
// Copy address
window.copyAddress("0x..."); // Shows alert on success

// Copy text from input
window.copyText("metamaskLinkOutput"); // Copies input value

// Copy QR code image
window.copyQR("qrCanvasMetamask"); // Copies image to clipboard
```

---

## 📊 Data Flow Diagrams

### Connection Flow

```
User loads page
    ↓
initApp() called
    ↓
populateNetworkSelect()
    ↓
WalletService.onConnectionStateChange(listener)
    ↓
WalletService.initializeWallet(chainIds)
    ├─ detectWalletProvider()
    ├─ Check localStorage
    └─ Silent auto-connect if found
    ↓
setupEventListeners()
    ↓
Ready for user interaction ✅
```

### Connection State Changes

```
User clicks "Connect Wallet"
    ↓
handleConnectWallet()
    ↓
WalletService.connectWallet(chainIds)
    ├─ Shows MetaMask popup
    ├─ User approves
    ├─ Save to localStorage
    └─ Emit connection event
    ↓
onWalletStateChange(state) called
    ├─ Update UI (show address)
    ├─ syncToCurrentNetwork()
    ├─ Create contract instance
    └─ Enable create button
    ↓
User can create EMI plan ✅
```

### EMI Plan Creation

```
User fills form:
  EMI: 0.01 ETH
  Total: 0.1 ETH
  Interval: Daily (86400s)
    ↓
User clicks "Create EMI Plan"
    ↓
createAndLinkPlan()
    ├─ Validate inputs
    ├─ TX1: contract.createPlan(emi, interval, total)
    │   └─ Wait for confirmation
    │   └─ Parse PlanCreated event
    │   └─ Extract planId
    ├─ TX2: contract.linkPlanToDirectPayment(planId)
    │   └─ Wait for confirmation
    ├─ registerMonitoring(planId)
    │   └─ POST to Vercel API
    └─ showSuccessScreen(planId)
        ├─ Show wallet address
        ├─ Generate sharing links
        ├─ Generate QR codes
        └─ Start status polling ✅
```

---

## 🔧 Common Code Patterns

### Pattern 1: Validate & Connect
```javascript
async function ensureConnected() {
  const state = WalletService.getConnectionState();
  
  if (!state.isConnected) {
    await WalletService.connectWallet([11155111, 1]);
  }
  
  return state;
}
```

### Pattern 2: Validate & Switch Network
```javascript
async function ensureNetwork(requiredChainId) {
  const currentChain = WalletService.getChainId();
  
  if (currentChain !== requiredChainId) {
    await NetworkService.requestNetworkSwitch(requiredChainId);
  }
}
```

### Pattern 3: Error Handling
```javascript
try {
  // Attempt operation
  const tx = await contract.createPlan(emi, interval, total);
  const receipt = await tx.wait();
  
  // Success
  showSuccess("Plan created!");
  
} catch (error) {
  // Handle error
  console.error("Failed:", error);
  showError(`Operation failed: ${error.reason || error.message}`);
}
```

### Pattern 4: Safe Contract Calls
```javascript
async function safeContractCall(fn, ...args) {
  try {
    const state = WalletService.getConnectionState();
    
    if (!state.isConnected) {
      throw new Error("Wallet not connected");
    }
    
    if (!appState.contract) {
      throw new Error("Contract not initialized");
    }
    
    return await fn(...args);
  } catch (error) {
    showError(error.message);
    throw error;
  }
}
```

---

## 📱 Mobile Wallet Testing

### MetaMask Mobile
```javascript
// Deep link format
https://metamask.app.link/dapp/{host}/path

// Example
https://metamask.app.link/dapp/myapp.com/sender.html?planId=5
```

### Trust Wallet
```javascript
// Deep link format
ethereum:{address}?value={amount}&text={message}

// Example
ethereum:0x38ad99a6f863bfd2e65d0cd77e1cdd5cfbbcd538?value=0.01&text=EMI%20Plan%20%235
```

### Testing on Mobile
```javascript
// Get local IP
ipconfig getifaddr en0  // macOS
hostname -I            // Linux

// Share URL
http://192.168.1.100:8000/main.html

// Open in mobile wallet browser
```

---

## 🐛 Debug Commands

### Check Connection State
```javascript
// In browser console
const state = WalletService.getConnectionState();
console.log("Connection:", state);

// Verify each property
console.log("Connected:", state.isConnected);
console.log("Address:", state.address);
console.log("Chain:", state.chainId);
console.log("Provider Type:", state.providerType);
```

### Check Network Config
```javascript
// Get current network
const chainId = WalletService.getChainId();
const config = NetworkService.getNetworkConfig(chainId);
console.log("Network Config:", config);

// List all networks
const all = NetworkService.getSupportedNetworks();
console.log("Supported Networks:", all);
```

### Check Contract Instance
```javascript
// Verify contract is initialized
console.log("Contract:", appState.contract);

// Test contract call
try {
  const count = await appState.contract.planCount();
  console.log("Total plans:", count.toString());
} catch (err) {
  console.error("Contract call failed:", err.message);
}
```

### Check localStorage
```javascript
// View all EMI data
const data = {
  connected: localStorage.getItem("emi_wallet_connected"),
  address: localStorage.getItem("emi_wallet_address"),
  chainId: localStorage.getItem("emi_chain_id"),
  provider: localStorage.getItem("emi_provider_type"),
};
console.log("Stored Data:", data);

// Clear all EMI data
Object.keys(localStorage)
  .filter(k => k.startsWith("emi_"))
  .forEach(k => localStorage.removeItem(k));
```

---

## 📋 Configuration Reference

### Supported Networks

```javascript
{
  11155111: "Sepolia Testnet",
  1: "Ethereum Mainnet",
  80001: "Polygon Mumbai",
  137: "Polygon Mainnet",
  97: "BSC Testnet",
  56: "BSC Mainnet",
}
```

### RPC Endpoints

```javascript
Sepolia: https://sepolia.infura.io/v3/{YOUR_KEY}
Mainnet: https://mainnet.infura.io/v3/{YOUR_KEY}
Mumbai:  https://rpc-mumbai.maticvigil.com/
Polygon: https://polygon-rpc.com/
BSC:     https://bsc-dataseed1.binance.org
```

### Contract Addresses

```javascript
Sepolia:  0x5B57f94BBC1a40664DB22B1067fecf42D7A97d6E
Mainnet:  0x7BAA6f2fFc568F1114A392557Bc3bCDe609bb795
// Others configured in networkService.js
```

---

## 🚨 Error Codes & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "No wallet detected" | No wallet extension | Install MetaMask/Trust Wallet |
| "User rejected request" | User denied popup | Ask user to approve |
| "Network not supported" | Wrong chain | Switch network in dropdown |
| "Contract not initialized" | Network sync failed | Reconnect wallet |
| "Transaction failed" | Gas or validation issue | Check amount, gas price |
| "PlanCreated event not found" | Event parsing failed | Check contract ABI |

---

## 📚 External Resources

- **ethers.js v5 Docs:** https://docs.ethers.org/v5/
- **MetaMask Docs:** https://docs.metamask.io/
- **EIP-1193 Standard:** https://eips.ethereum.org/EIPS/eip-1193
- **EIP-3085 (Add Chain):** https://eips.ethereum.org/EIPS/eip-3085
- **EIP-3035 (Switch Chain):** https://eips.ethereum.org/EIPS/eip-3035
- **Sepolia Faucet:** https://sepoliafaucet.com/
- **Etherscan (Testnet):** https://sepolia.etherscan.io/

---

**Quick Reference Version:** 1.0  
**Last Updated:** February 2026  
**For:** EMI Auto-Payment System v2.0
