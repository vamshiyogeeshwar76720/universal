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
    createBtn.innerText = "Creating Plan...";

    // Parse inputs
    const emiWei = ethers.utils.parseEther(emiInput);
    const totalWei = ethers.utils.parseEther(totalInput);

    console.log("📋 Creating plan with:", {
      emiWei: emiWei.toString(),
      intervalSeconds,
      totalWei: totalWei.toString(),
    });

    // Step 1: Create plan
    const tx1 = await appState.contract.createPlan(
      emiWei,
      intervalSeconds,
      totalWei,
    );
    console.log("✅ Plan creation tx sent:", tx1.hash);

    const receipt1 = await tx1.wait();
    console.log("✅ Plan creation confirmed");

    // Step 2: Parse plan ID from event
    const planId = parsePlanCreatedEvent(receipt1);
    if (!planId) {
      throw new Error("Failed to extract plan ID from event");
    }

    appState.currentPlanId = planId.toString();
    console.log("📦 Plan ID:", appState.currentPlanId);

    createBtn.innerText = "Linking Plan...";

    // Step 3: Link plan to direct payment
    const tx2 = await appState.contract.linkPlanToDirectPayment(
      appState.currentPlanId,
    );
    console.log("✅ Link tx sent:", tx2.hash);
    await tx2.wait();
    console.log("✅ Plan linked to direct payment");

    createBtn.innerText = "Registering Monitor...";

    // Step 4: Register monitoring service
    await registerMonitoring(appState.currentPlanId);

    // Step 5: Show success screen
    showSuccessScreen(appState.currentPlanId, emiInput);
  } catch (error) {
    console.error("Error:", error);
    showError(`Failed: ${error.reason || error.message || "Unknown error"}`);
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
 */
async function registerMonitoring(planId) {
  try {
    const state = WalletService.getConnectionState();
    const config = NetworkService.getNetworkConfig(state.chainId);

    const monitorUrl = "https://emi-monitor.vercel.app";

    const response = await fetch(`${monitorUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: planId.toString(),
        receiver: state.address,
        chainId: state.chainId,
        contract: config.emiContract,
      }),
    });

    const result = await response.json();
    console.log("✅ Monitor registered:", result);
  } catch (error) {
    console.error("Monitor registration warning:", error);
    // Don't fail - monitoring is optional
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
function showSuccessScreen(planId, emiAmount) {
  const state = WalletService.getConnectionState();
  const config = NetworkService.getNetworkConfig(state.chainId);

  // Show sections
  document.getElementById("directPaymentSection").style.display = "block";
  document.getElementById("shareSection").style.display = "block";
  document.getElementById("monitoringStatusSection").style.display = "block";

  // Update success message
  document.getElementById("directPaymentSection").innerHTML = `
    <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 24px; border-radius: 16px; text-align: center;">
      <h2>✅ EMI Plan #${planId} Created!</h2>
      <p><strong>Share YOUR WALLET ADDRESS:</strong></p>
      <div style="background: #1f2937; color: #f9fafb; padding: 16px; border-radius: 12px; word-break: break-all; font-family: monospace; margin: 16px 0; font-size: 14px;">
        ${state.address}
      </div>
      <p style="font-size: 14px;">
        💡 Sender sends ANY ETH → Auto EMI payments start!
      </p>
      <button onclick="window.copyAddress('${state.address}')" style="background: white; color: #10b981; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin-top: 12px; width: 100%; font-weight: bold;">
        📋 Copy Wallet Address
      </button>
    </div>
  `;

  // Generate share links
  generateShareLinks(planId);

  // Start status monitoring
  if (appState.statusInterval) {
    clearInterval(appState.statusInterval);
  }
  appState.statusInterval = setInterval(
    () => checkMonitoringStatus(planId),
    5000,
  );
}

/**
 * Generate and display sharing links and QR codes
 */
async function generateShareLinks(planId) {
  const state = WalletService.getConnectionState();
  const config = NetworkService.getNetworkConfig(state.chainId);

  // MetaMask deep link
  const metamaskLink = `https://metamask.app.link/dapp/${window.location.host}/sender.html?planId=${planId}&chainId=${state.chainId}`;

  // Trust Wallet deep link
  const trustLink = `ethereum:${state.address}?value=0.01&text=EMI%20Payment%20Plan%20%23${planId}`;

  // Set link outputs
  const metamaskOutput = document.getElementById("metamaskLinkOutput");
  const trustOutput = document.getElementById("trustwalletLinkOutput");

  if (metamaskOutput) metamaskOutput.value = metamaskLink;
  if (trustOutput) trustOutput.value = trustLink;

  // Generate QR codes
  try {
    const qrMM = document.getElementById("qrCanvasMetamask");
    const qrTrust = document.getElementById("qrCanvasTrust");

    if (qrMM) {
      await QRCode.toCanvas(qrMM, metamaskLink, { width: 200 });
    }
    if (qrTrust) {
      await QRCode.toCanvas(qrTrust, trustLink, { width: 200 });
    }
  } catch (error) {
    console.error("QR generation failed:", error);
  }
}

/**
 * Check monitoring status and update UI
 */
async function checkMonitoringStatus(planId) {
  try {
    const state = WalletService.getConnectionState();
    const statusUrl = `https://emi-monitor.vercel.app/status/${state.address}`;

    const response = await fetch(statusUrl);
    const status = await response.json();

    // Update UI elements
    const statusBadge = document.getElementById("statusBadge");
    const senderAddress = document.getElementById("senderAddress");
    const statusMessage = document.getElementById("statusMessage");

    if (statusBadge) {
      if (status.active) {
        statusBadge.innerHTML = `✅ ACTIVE (Plan #${status.planId})`;
        statusBadge.style.color = "#10b981";
      } else {
        statusBadge.innerHTML = "⏳ WAITING";
        statusBadge.style.color = "#ef4444";
      }
    }

    if (senderAddress) {
      if (status.sender) {
        senderAddress.textContent = status.sender;
        senderAddress.style.color = "#10b981";
      } else {
        senderAddress.textContent = "Not detected yet";
        senderAddress.style.color = "#6b7280";
      }
    }

    if (statusMessage) {
      if (status.active && status.sender) {
        statusMessage.innerHTML = `
          ✅ <strong>Plan activated!</strong> Chainlink Automation started. 
          EMI payments will be pulled from sender ${status.sender} every interval.
        `;
        statusMessage.style.color = "#10b981";
      } else {
        statusMessage.innerHTML = `
          ⏳ <strong>Waiting for first payment...</strong> 
          Once sender transfers ETH to <span style="font-family: monospace;">${state.address}</span>, 
          this plan will activate automatically.
        `;
        statusMessage.style.color = "#374151";
      }
    }

    console.log("📡 Status:", status);
  } catch (error) {
    console.error("Status check warning:", error);
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
