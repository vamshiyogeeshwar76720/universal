/**
 * ============================================================================
 * RECEIVER DASHBOARD - receiver.js
 * ============================================================================
 * EMI Auto-Payment System - Receiver Side
 * Creates EMI plans with automated installment payments
 *
 * Architecture:
 * 1. Wallet Connection (walletService.js)
 * 2. Network Management (networkService.js)
 * 3. Smart Contract Interaction
 * 4. Plan Creation & Monitoring
 * 5. Payment Sharing (QR codes & deep links)
 * ============================================================================
 */

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm";
import * as WalletService from "./walletService.js";
import * as NetworkService from "./networkService.js";

// ============================================================================
// CONTRACT ABI
// ============================================================================
const EMI_CONTRACT_ABI = [
  "function plans(uint256) view returns (address,address,uint256,uint256,uint256,uint256,uint256,bool,bool)",
  "function planCount() view returns (uint256)",
  "function createPlan(uint256,uint256,uint256) external",
  "function linkPlanToDirectPayment(uint256) external",
  "function unlinkPlan() external",
  "function pendingPlanId(address) view returns (uint256)",
  "function activatePlanRaw(uint256,address) external",
  "event PlanCreated(uint256 indexed planId)",
  "event PlanLinked(uint256 indexed planId, address indexed receiver)",
  "event PlanActivated(uint256 indexed planId, address indexed sender)",
  "event PaymentReceived(uint256 indexed planId, address indexed sender, uint256 amount)",
];

// ============================================================================
// APP STATE
// ============================================================================
let appState = {
  currentPlanId: null,
  contract: null,
  statusInterval: null,
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the application
 */
async function initApp() {
  console.log("🚀 EMI Receiver Dashboard initializing...");

  // Populate UI dropdowns
  populateNetworkSelect();
  setupIntervalToggle();

  // Listen for wallet and network changes
  WalletService.onConnectionStateChange(onWalletStateChange);

  // Try to auto-connect
  const supportedChainIds = NetworkService.getSupportedChainIds();
  await WalletService.initializeWallet(supportedChainIds);

  // Setup event listeners
  setupEventListeners();

  console.log("✅ App initialized");
}

// ============================================================================
// UI SETUP & EVENT LISTENERS
// ============================================================================

function populateNetworkSelect() {
  const select = document.getElementById("blockchainSelect");
  if (!select) return;

  select.innerHTML = "";

  NetworkService.getSupportedNetworks().forEach((network) => {
    const option = document.createElement("option");
    option.value = network.id;
    option.textContent = `${network.name} (${network.currency})`;
    select.appendChild(option);
  });

  // Default to first testnet
  const testnet = NetworkService.getTestnetNetworks()[0];
  if (testnet) {
    select.value = testnet.id;
  }
}

function setupIntervalToggle() {
  const intervalSelect = document.getElementById("intervalSelect");
  const customInput = document.getElementById("customInterval");

  if (intervalSelect) {
    intervalSelect.addEventListener("change", function () {
      if (customInput) {
        customInput.style.display = this.value === "custom" ? "block" : "none";
      }
    });
  }
}

function setupEventListeners() {
  const connectBtn = document.getElementById("connectWalletBtn");
  const disconnectBtn = document.getElementById("disconnectWalletBtn");
  const createBtn = document.getElementById("createPlanBtn");

  if (connectBtn) {
    connectBtn.addEventListener("click", handleConnectWallet);
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener("click", handleDisconnectWallet);
  }

  if (createBtn) {
    createBtn.addEventListener("click", createAndLinkPlan);
  }
}

// ============================================================================
// WALLET CONNECTION HANDLERS
// ============================================================================

/**
 * Handle wallet connection button click
 */
async function handleConnectWallet() {
  const connectBtn = document.getElementById("connectWalletBtn");
  const originalText = connectBtn.innerText;

  try {
    connectBtn.disabled = true;
    connectBtn.innerText = "Connecting...";

    const supportedChainIds = NetworkService.getSupportedChainIds();
    await WalletService.connectWallet(supportedChainIds);

    // Force Sepolia testnet for receiver dashboard
    const SEPOLIA_CHAIN_ID = 11155111;
    const state = WalletService.getConnectionState();

    if (state.chainId !== SEPOLIA_CHAIN_ID) {
      connectBtn.innerText = "Switching to Sepolia...";
      await NetworkService.requestNetworkSwitch(SEPOLIA_CHAIN_ID);
      // Wait for network switch to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("Connection failed:", error);
    showError(`Connection failed: ${error.message}`);
  } finally {
    connectBtn.disabled = false;
    connectBtn.innerText = originalText;
  }
}

/**
 * Handle wallet disconnection button click
 */
function handleDisconnectWallet() {
  if (appState.statusInterval) {
    clearInterval(appState.statusInterval);
    appState.statusInterval = null;
  }

  WalletService.disconnectWallet();
}

/**
 * Handle wallet connection state changes
 */
function onWalletStateChange(state) {
  const accountEl = document.getElementById("account");
  const networkEl = document.getElementById("network");
  const connectBtn = document.getElementById("connectWalletBtn");
  const disconnectBtn = document.getElementById("disconnectWalletBtn");
  const createBtn = document.getElementById("createPlanBtn");

  if (state.isConnected) {
    // Update UI for connected state
    accountEl.textContent = WalletService.formatAddress(state.address);
    connectBtn.style.display = "none";
    disconnectBtn.style.display = "inline-block";
    createBtn.disabled = false;

    // Sync network
    syncToCurrentNetwork(state.chainId);
  } else {
    // Update UI for disconnected state
    accountEl.textContent = "";
    networkEl.textContent = "";
    connectBtn.style.display = "inline-block";
    disconnectBtn.style.display = "none";
    createBtn.disabled = true;
    appState.contract = null;
  }
}

/**
 * Sync UI to current network
 */
async function syncToCurrentNetwork(chainId) {
  const networkConfig = NetworkService.getNetworkConfig(chainId);
  const networkEl = document.getElementById("network");
  const blockchainSelect = document.getElementById("blockchainSelect");

  if (!networkConfig) {
    showError(
      NetworkService.createNetworkMismatchMessage(
        chainId,
        NetworkService.getSupportedChainIds()[0],
      ),
    );

    // Try to switch to first supported network
    try {
      const targetChain = NetworkService.getSupportedChainIds()[0];
      await NetworkService.requestNetworkSwitch(targetChain);
    } catch (error) {
      console.error("Auto-switch failed:", error.message);
    }
    return;
  }

  // Update UI
  networkEl.textContent = `${networkConfig.name} (${networkConfig.currency})`;
  blockchainSelect.value = chainId;

  // Create contract instance
  const state = WalletService.getConnectionState();
  appState.contract = new ethers.Contract(
    networkConfig.emiContract,
    EMI_CONTRACT_ABI,
    state.signer,
  );

  console.log("✅ Synced to:", networkConfig.name);
}

// ============================================================================
// CREATE EMI PLAN FLOW
// ============================================================================

/**
 * Main function: Create plan and link to direct payment
 */
window.createAndLinkPlan = async function () {
  const state = WalletService.getConnectionState();

  // Validate connection
  if (!state.isConnected) {
    showError("Please connect wallet first");
    return;
  }

  if (!appState.contract) {
    showError("Network not synced. Please try again.");
    return;
  }

  // Get form inputs
  const emiInput = document.getElementById("emiAmount").value;
  const totalInput = document.getElementById("totalAmount").value;
  const intervalSeconds = getIntervalSeconds();

  // Validate inputs
  if (!validateInputs(emiInput, totalInput, intervalSeconds)) {
    return;
  }

  const createBtn = document.getElementById("createPlanBtn");
  const originalText = createBtn.innerText;

  try {
    createBtn.disabled = true;
    createBtn.innerText = "⏳ Creating Plan...";

    // Parse inputs
    const emiWei = ethers.utils.parseEther(emiInput);
    const totalWei = ethers.utils.parseEther(totalInput);

    console.log("📋 [PHASE 1] Creating EMI Plan...", {
      emiWei: emiWei.toString(),
      intervalSeconds,
      totalWei: totalWei.toString(),
    });

    // ============================================================================
    // STEP 1: CREATE PLAN (On-Chain)
    // ============================================================================
    const tx1 = await appState.contract.createPlan(
      emiWei,
      intervalSeconds,
      totalWei,
    );
    console.log("✅ Plan creation tx sent:", tx1.hash);
    createBtn.innerText = "⏳ Confirming plan creation...";

    const receipt1 = await tx1.wait();
    console.log(
      "✅ Plan creation confirmed (Block:",
      receipt1.blockNumber + ")",
    );

    // Parse plan ID from PlanCreated event
    const planId = parsePlanCreatedEvent(receipt1);
    if (!planId) {
      throw new Error("Failed to extract plan ID from event");
    }

    appState.currentPlanId = planId.toString();
    console.log("📦 Plan ID created:", appState.currentPlanId);

    // ============================================================================
    // STEP 2: AUTO-LINK PLAN TO RECEIVER WALLET (On-Chain)
    // ============================================================================
    createBtn.innerText = "⏳ Linking plan to your wallet...";
    console.log("📋 [PHASE 1] Linking plan to receiver:", state.address);

    const tx2 = await appState.contract.linkPlanToDirectPayment(
      appState.currentPlanId,
    );
    console.log("✅ Plan linking tx sent:", tx2.hash);
    createBtn.innerText = "⏳ Confirming plan link...";

    const receipt2 = await tx2.wait();
    console.log(
      "✅ Plan linked successfully (Block:",
      receipt2.blockNumber + ")",
    );

    // ============================================================================
    // STEP 3: REGISTER OFF-CHAIN MONITORING (Vercel Backend)
    // ============================================================================
    createBtn.innerText = "⏳ Starting payment monitoring...";
    console.log("📡 [PHASE 2] Registering off-chain monitoring...");

    await registerMonitoring(appState.currentPlanId, state.address);

    // ============================================================================
    // STEP 4: SHOW SUCCESS SCREEN WITH SHARING OPTIONS
    // ============================================================================
    console.log(
      "✅ [PHASE 1-2] Plan setup complete! Showing success screen...",
    );
    showSuccessScreen(appState.currentPlanId, emiInput, state.address);
  } catch (error) {
    console.error("❌ Error:", error);
    const errorMsg = error.reason || error.message || "Unknown error";
    showError(`Transaction failed: ${errorMsg}`);
  } finally {
    createBtn.innerText = originalText;
    createBtn.disabled = false;
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse PlanCreated event from transaction receipt
 */
function parsePlanCreatedEvent(receipt) {
  for (const log of receipt.logs) {
    try {
      const iface = new ethers.utils.Interface(EMI_CONTRACT_ABI);
      const parsed = iface.parseLog(log);
      if (parsed.name === "PlanCreated") {
        return parsed.args.planId;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

/**
 * Register plan with monitoring service
 * Backend will detect incoming ETH transfers to receiver address via RPC event logs
 */
async function registerMonitoring(planId, receiverAddress) {
  try {
    const state = WalletService.getConnectionState();
    const config = NetworkService.getNetworkConfig(state.chainId);

    const monitorUrl = "https://emi-monitor.vercel.app";
    const payload = {
      planId: planId.toString(),
      receiver: receiverAddress || state.address,
      chainId: state.chainId,
      contract: config.emiContract,
    };

    console.log("📡 [DEBUG] Sending registration to monitor service:");
    console.log("   URL:", `${monitorUrl}/monitor`);
    console.log("   Payload:", payload);

    const response = await fetch(`${monitorUrl}/monitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("📡 [DEBUG] Response status:", response.status);
    console.log("📡 [DEBUG] Response headers:", {
      "content-type": response.headers.get("content-type"),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("✅ Monitor registered successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ Monitor registration error:", error);
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
    // Don't fail plan creation - monitoring is optional for manual activation
  }
}

/**
 * Validate form inputs
 */
function validateInputs(emiInput, totalInput, intervalSeconds) {
  const emiNum = Number(emiInput);
  const totalNum = Number(totalInput);

  if (!emiInput || !totalInput || emiNum <= 0 || totalNum <= 0) {
    showError("Enter valid positive amounts");
    return false;
  }

  if (totalNum < emiNum) {
    showError("Total must be >= EMI amount");
    return false;
  }

  if (intervalSeconds < 60) {
    showError("Minimum interval: 60 seconds");
    return false;
  }

  return true;
}

/**
 * Get interval in seconds from select
 */
function getIntervalSeconds() {
  const select = document.getElementById("intervalSelect");
  if (select.value === "custom") {
    return Number(document.getElementById("customInterval").value) * 60;
  }
  return Number(select.value);
}

/**
 * Show success screen with sharing options
 */
function showSuccessScreen(planId, emiAmount, receiverAddress) {
  const state = WalletService.getConnectionState();
  const config = NetworkService.getNetworkConfig(state.chainId);

  // Use passed address or fallback to state
  const displayAddress = receiverAddress || state.address;

  // Show sections
  document.getElementById("directPaymentSection").style.display = "block";
  document.getElementById("shareSection").style.display = "block";
  document.getElementById("monitoringStatusSection").style.display = "block";

  // ============================================================================
  // SUCCESS MESSAGE - SHOW WALLET ADDRESS FOR DIRECT ETH TRANSFER
  // ============================================================================
  document.getElementById("directPaymentSection").innerHTML = `
    <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 24px; border-radius: 16px; text-align: center;">
      <h2>✅ EMI Plan #${planId} Created!</h2>
      
      <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 12px; margin: 20px 0;">
        <p style="font-size: 14px; margin-bottom: 12px;"><strong>📝 SHARE THIS WALLET ADDRESS</strong></p>
        <p style="font-size: 12px; color: #c5e4e8; margin-bottom: 16px;">
          Share this wallet address with the sender. They can send ETH from ANY wallet (MetaMask, Trust Wallet, Binance, or any other wallet). No special page or app needed!
        </p>
        <div style="background: #1f2937; color: #f9fafb; padding: 16px; border-radius: 12px; word-break: break-all; font-family: monospace; margin: 16px 0; font-size: 13px;">
          ${displayAddress}
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; margin: 16px 0; font-size: 13px;">
        <strong>💡 How it works:</strong><br/>
        ✅ Sender sends ETH to your wallet from ANY wallet<br/>
        ✅ Our backend detects the transaction<br/>
        ✅ EMI plan auto-activates instantly<br/>
        ✅ Chainlink pulls EMI amounts automatically
      </div>

      <button onclick="window.copyAddress('${displayAddress}')" style="background: white; color: #10b981; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin-top: 16px; width: 100%; font-weight: bold; font-size: 14px;">
        📋 Copy Wallet Address
      </button>
    </div>
  `;

  // Generate QR code for wallet address
  generateShareLinks(planId, displayAddress);

  // Start status monitoring with receiver address
  if (appState.statusInterval) {
    clearInterval(appState.statusInterval);
  }
  appState.statusInterval = setInterval(
    () => checkMonitoringStatus(planId, displayAddress),
    5000,
  );

  console.log(
    "✅ [PHASE 2] Waiting for sender to transfer ETH to:",
    displayAddress,
  );
}

/**
 * Generate QR code for wallet address
 * Sender can scan this to get the wallet address
 */
async function generateShareLinks(planId, receiverAddress) {
  const displayAddress = receiverAddress;

  // Generate QR code with wallet address
  try {
    const qrCanvas = document.getElementById("qrCanvasMetamask");

    if (qrCanvas) {
      // QR code encodes the wallet address
      await QRCode.toCanvas(qrCanvas, displayAddress, { width: 200 });
      console.log("✅ QR code generated for wallet:", displayAddress);
    }
  } catch (error) {
    console.error("⚠️  QR generation failed:", error);
  }
}

/**
 * Check monitoring status and update UI
 */
async function checkMonitoringStatus(planId, receiverAddress) {
  try {
    const displayAddress =
      receiverAddress || WalletService.getConnectionState().address;
    const statusUrl = `https://emi-monitor.vercel.app/status/${displayAddress}`;

    const response = await fetch(statusUrl);
    const status = await response.json();

    console.log("📡 Status check result:", status);

    // Update UI elements
    const statusBadge = document.getElementById("statusBadge");
    const senderAddress = document.getElementById("senderAddress");
    const statusMessage = document.getElementById("statusMessage");

    if (statusBadge) {
      if (status.active) {
        statusBadge.innerHTML = `✅ ACTIVE (Plan #${status.planId})`;
        statusBadge.style.color = "#10b981";
      } else {
        statusBadge.innerHTML = "⏳ WAITING FOR PAYMENT";
        statusBadge.style.color = "#ef4444";
      }
    }

    if (senderAddress) {
      if (status.sender) {
        senderAddress.textContent = WalletService.formatAddress(status.sender);
        senderAddress.style.color = "#10b981";
      } else {
        senderAddress.textContent = "Not detected yet";
        senderAddress.style.color = "#6b7280";
      }
    }

    if (statusMessage) {
      if (status.active && status.sender) {
        statusMessage.innerHTML = `
          ✅ <strong>Plan activated!</strong><br/>
          Sender: ${WalletService.formatAddress(status.sender)}<br/>
          Chainlink Automation started. EMI payments will be pulled automatically every interval.
        `;
        statusMessage.style.color = "#10b981";
        statusMessage.style.backgroundColor = "#ecfdf5";
        statusMessage.style.padding = "16px";
        statusMessage.style.borderRadius = "8px";
      } else {
        statusMessage.innerHTML = `
          ⏳ <strong>Waiting for sender to transfer ETH...</strong><br/>
          <small style="color: #6b7280;">
            Share your wallet address (<span style="font-family: monospace;">${displayAddress.slice(
              0,
              10,
            )}...</span>) with the sender. 
            Once they send any amount of ETH, your EMI plan will activate automatically.
          </small>
        `;
        statusMessage.style.color = "#374151";
        statusMessage.style.backgroundColor = "#f3f4f6";
        statusMessage.style.padding = "16px";
        statusMessage.style.borderRadius = "8px";
      }
    }

    return status;
  } catch (error) {
    console.error("⚠️  Status check warning:", error);
    return null;
  }
}

// ============================================================================
// UTILITY FUNCTIONS (Global)
// ============================================================================

window.copyAddress = function (address) {
  navigator.clipboard
    .writeText(address)
    .then(() => {
      alert("✅ Address copied!");
    })
    .catch((err) => {
      console.error("Copy failed:", err);
      showError("Copy to clipboard failed");
    });
};

window.copyText = function (id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.select();
  document.execCommand("copy");
  alert("✅ Text copied!");
};

window.copyQR = async function (canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  canvas.toBlob(async (blob) => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      alert("✅ QR code copied!");
    } catch (err) {
      console.error("QR copy failed:", err);
      showError("Failed to copy QR code");
    }
  });
};

function showError(message) {
  alert(message);
  console.error(message);
}

function showSuccess(message) {
  console.log("✅", message);
}

// ============================================================================
// APP STARTUP
// ============================================================================

document.addEventListener("DOMContentLoaded", initApp);
