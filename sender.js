import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";
import { contractABI } from "./abi.js";

const CONTRACTS = {
  sepolia: {
    chainId: 11155111,
    emi: "0xa721846B41Ff5Ea7C7D3a398Bb80Fc8CE0f3BB39",
    usdt: "0x3fbb7Fbf85E4B0Df06189A152C41CAc77e634f65",
  },

  // ready for production
  mainnet: {
    chainId: 1,
    emi: "0x7BAA6f2fFc568F1114A392557Bc3bCDe609bb795",
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
};

// ============================================================================
// CONFIGURATION
// ============================================================================
const BUFFER_TIME = 2000; // 2 seconds buffer time for approval completion
const APPROVAL_TIMEOUT = 30000; // 30 seconds timeout for approval transaction

// ============================================================================
// URL PARAMETERS & VALIDATION
// ============================================================================
const params = new URLSearchParams(window.location.search);
const planId = params.get("planId");
const expectedChainId = Number(params.get("chainId"));

if (!planId || !expectedChainId) {
  alert("Invalid payment link");
  throw new Error("Missing URL parameters");
}

// ============================================================================
// GLOBAL STATE
// ============================================================================
let provider;
let signer;
let sender;
let chainKey;
let plan;
let isProcessing = false;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format error messages for user display
 * @param {Error} err - Error object
 * @returns {string} Formatted error message
 */
function formatError(err) {
  if (err.code === 4001) return "Transaction rejected by user";
  if (err.code === -32603) return "Internal JSON-RPC error. Check your balance.";
  if (err.code === -32000) return "Insufficient balance or gas";
  return err.reason || err.message || "Transaction failed";
}

/**
 * Display success popup message
 * @param {string} message - Success message to display
 */
function showSuccessPopup(message = "EMI Activated Successfully") {
  const modal = document.getElementById("successModal");
  const messageEl = document.getElementById("successMessage");
  
  messageEl.textContent = message;
  modal.classList.remove("hidden");
  document.getElementById("modalOverlay").classList.remove("hidden");
}

/**
 * Display error popup message
 * @param {string} message - Error message to display
 */
function showErrorPopup(message) {
  const modal = document.getElementById("errorModal");
  const messageEl = document.getElementById("errorMessage");
  
  messageEl.textContent = message;
  modal.classList.add("error");
  modal.classList.remove("hidden");
  document.getElementById("modalOverlay").classList.remove("hidden");
}

/**
 * Hide all modals
 */
function hideModals() {
  document.getElementById("successModal").classList.add("hidden");
  document.getElementById("errorModal").classList.add("hidden");
  document.getElementById("modalOverlay").classList.add("hidden");
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// APPROVAL LOGIC
// ============================================================================

/**
 * Check if user has sufficient USDT balance for approval
 * @param {ethers.Contract} usdtContract - USDT token contract instance
 * @param {ethers.BigNumber} requiredAmount - Amount needed for approval
 * @returns {Promise<{sufficient: boolean, balance: string, required: string, balanceBN: ethers.BigNumber}>} Balance check result
 */
async function checkUSDTBalance(usdtContract, requiredAmount) {
  try {
    const balance = await usdtContract.balanceOf(sender);
    const isSufficient = balance.gte(requiredAmount);
    
    console.log(`USDT Balance Check: ${ethers.utils.formatUnits(balance, 6)} USDT (Required: ${ethers.utils.formatUnits(requiredAmount, 6)} USDT)`);
    
    return {
      sufficient: isSufficient,
      balance: ethers.utils.formatUnits(balance, 6),
      required: ethers.utils.formatUnits(requiredAmount, 6),
      balanceBN: balance
    };
  } catch (err) {
    console.error("Balance check error:", err);
    throw new Error(`Failed to check USDT balance: ${err.message}`);
  }
}

/**
 * Check if user has sufficient ETH for gas fees
 * @returns {Promise<boolean>} True if ETH balance is sufficient
 */
async function checkETHBalance() {
  try {
    const balance = await provider.getBalance(sender);
    const minGasBalance = ethers.utils.parseEther("0.01"); // Minimum 0.01 ETH for gas
    return balance.gte(minGasBalance);
  } catch (err) {
    console.error("ETH balance check error:", err);
    return false;
  }
}

/**
 * Validate all conditions before proceeding with approval
 * @param {ethers.Contract} usdtContract - USDT token contract
 * @param {ethers.BigNumber} approvalAmount - Amount to approve
 * @returns {Promise<{valid: boolean, issues: string[], balanceInfo: Object}>} Validation result with issues and balance details
 */
async function validateApprovalConditions(usdtContract, approvalAmount) {
  const issues = [];
  let balanceInfo = {};

  // Check EMI contract connection
  if (!plan || plan.receiver === ethers.constants.AddressZero) {
    issues.push("Invalid EMI plan");
  }

  // Check USDT balance with detailed output
  try {
    const balanceCheck = await checkUSDTBalance(usdtContract, approvalAmount);
    balanceInfo = balanceCheck;
    
    if (!balanceCheck.sufficient) {
      issues.push(`Insufficient USDT balance. Have: ${balanceCheck.balance}, Need: ${balanceCheck.required}`);
    }
  } catch (err) {
    issues.push(`Balance check failed: ${err.message}`);
  }

  // Check ETH balance for gas
  try {
    const hasETHBalance = await checkETHBalance();
    if (!hasETHBalance) {
      issues.push("Insufficient ETH for gas fees (minimum 0.01 ETH required)");
    }
  } catch (err) {
    issues.push(`Gas balance check failed: ${err.message}`);
  }

  return {
    valid: issues.length === 0,
    issues,
    balanceInfo,
  };
}

/**
 * Request USDT approval from user with retry logic
 * @param {ethers.Contract} usdtContract - USDT token contract
 * @param {string} spenderAddress - Address to approve
 * @param {ethers.BigNumber} amount - Amount to approve
 * @param {HTMLElement} btn - Button element to update UI
 * @returns {Promise<boolean>} True if approval successful
 */
async function requestApproval(usdtContract, spenderAddress, amount, btn) {
  let retries = 0;
  const maxRetries = 2;

  while (retries < maxRetries) {
    try {
      btn.innerText = `Requesting approval... (Attempt ${retries + 1}/${maxRetries})`;
      btn.disabled = true;

      console.log(`Approval attempt ${retries + 1}: Requesting approval for ${ethers.utils.formatUnits(amount, 6)} USDT`);

      const approveTx = await usdtContract.approve(spenderAddress, amount, {
        gasLimit: 100000, // Explicit gas limit for approve
      });

      console.log("Approval tx sent:", approveTx.hash);
      btn.innerText = "Waiting for approval confirmation...";

      // Wait for approval with timeout
      const receipt = await Promise.race([
        approveTx.wait(),
        sleep(APPROVAL_TIMEOUT).then(() => {
          throw new Error("Approval confirmation timeout");
        }),
      ]);

      console.log("Approval confirmed:", receipt.transactionHash);
      return true;
    } catch (err) {
      console.warn(`Approval attempt ${retries + 1} failed:`, err.message);
      retries++;

      if (retries < maxRetries) {
        // Wait before retrying (buffer time)
        console.log(`Waiting ${BUFFER_TIME}ms before retry...`);
        await sleep(BUFFER_TIME);
      } else {
        throw err;
      }
    }
  }

  throw new Error("Approval failed after maximum retries");
}

/**
 * Initiate auto-approval process with buffer time
 * @param {ethers.Contract} usdtContract - USDT token contract
 * @param {string} emiAddress - EMI contract address
 * @param {ethers.BigNumber} approvalAmount - Amount to approve
 * @param {HTMLElement} btn - Button element to update UI
 * @returns {Promise<boolean>} True if approval completed
 */
async function initiateAutoApproval(usdtContract, emiAddress, approvalAmount, btn) {
  console.log("Starting auto-approval process...");

  // Validate conditions before attempting approval
  const validation = await validateApprovalConditions(usdtContract, approvalAmount);

  if (!validation.valid) {
    throw new Error(`Approval conditions not met: ${validation.issues.join(", ")}`);
  }

  console.log("All conditions validated");

  // Apply buffer time - system prepares for approval
  console.log(`Applying ${BUFFER_TIME}ms buffer time...`);
  await sleep(BUFFER_TIME);

  // Request approval
  return await requestApproval(usdtContract, emiAddress, approvalAmount, btn);
}

// ============================================================================
// EMI ACTIVATION
// ============================================================================

/**
 * Activate EMI by calling the MAD (Make A Down payment) function
 * @param {ethers.Contract} contract - EMI contract instance
 * @param {number} planId - Plan ID to activate
 * @param {ethers.BigNumber} activationAmount - Activation down payment amount
 * @param {HTMLElement} btn - Button element to update UI
 * @returns {Promise<ethers.ContractReceipt>} Transaction receipt
 */
async function activateEMI(contract, planId, activationAmount, btn) {
  try {
    btn.innerText = "Activating EMI...";
    console.log(`Activating EMI for plan ${planId} with amount ${ethers.utils.formatUnits(activationAmount, 6)} USDT`);

    const tx = await contract.MAD(planId, activationAmount, {
      gasLimit: 300000, // Explicit gas limit for MAD
    });

    console.log("Activation tx sent:", tx.hash);
    btn.innerText = "Confirming activation...";

    const receipt = await tx.wait();
    console.log("EMI activated successfully:", receipt.transactionHash);

    return receipt;
  } catch (err) {
    console.error("EMI activation failed:", err);
    throw err;
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize wallet connection and load plan details
 */
async function init() {
  if (!window.ethereum) {
    alert("MetaMask required");
    throw new Error("No wallet");
  }

  try {
    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    sender = await signer.getAddress();

    const network = await provider.getNetwork();

    console.log("Wallet chain:", network.chainId);
    console.log("Expected chain:", expectedChainId);

    chainKey = Object.keys(CONTRACTS).find(
      (k) => CONTRACTS[k].chainId === expectedChainId
    );

    if (!chainKey) {
      alert("Unsupported chain in link");
      throw new Error("Unsupported chain");
    }

    if (network.chainId !== expectedChainId) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ethers.utils.hexValue(expectedChainId) }],
      });
    }

    plan = await loadPlan(planId);
    document.getElementById(
      "planInfo"
    ).innerText = `EMI: ${ethers.utils.formatUnits(plan.emi, 6)} USDT`;
    
    // Display detailed plan information
    const planDetailsEl = document.getElementById("planDetails");
    if (planDetailsEl) {
      document.getElementById("detailEmi").textContent = `${ethers.utils.formatUnits(plan.emi, 6)} USDT`;
      document.getElementById("detailTotal").textContent = `${ethers.utils.formatUnits(plan.total, 6)} USDT`;
      
      // Format interval as human-readable
      const intervalSeconds = plan.interval.toString();
      const intervalHours = Math.floor(intervalSeconds / 3600);
      const intervalDays = Math.floor(intervalSeconds / 86400);
      let intervalText;
      if (intervalDays >= 1) {
        intervalText = `${intervalDays} day${intervalDays > 1 ? 's' : ''}`;
      } else if (intervalHours >= 1) {
        intervalText = `${intervalHours} hour${intervalHours > 1 ? 's' : ''}`;
      } else {
        intervalText = `${intervalSeconds} seconds`;
      }
      document.getElementById("detailInterval").textContent = intervalText;
      document.getElementById("detailReceiver").textContent = plan.receiver;
      planDetailsEl.style.display = "block";
    }
    
    document.getElementById("payBtn").innerText = `MAD #${planId}`;
    console.log("Plan loaded:", plan);
  } catch (err) {
    console.error("Initialization error:", err);
    throw err;
  }
}

/**
 * Load plan details from contract
 * @param {number} planId - Plan ID to load
 * @returns {Promise<Object>} Plan details
 */
async function loadPlan(planId) {
  const contract = new ethers.Contract(
    CONTRACTS[chainKey].emi,
    contractABI,
    provider
  );

  const plan = await contract.plans(planId);

  if (plan.receiver === ethers.constants.AddressZero) {
    throw new Error("Plan does not exist");
  }

  return plan;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle MAD button click - Main entry point for approval and activation
 */
const btn = document.getElementById("payBtn");
btn.onclick = async (e) => {
  e.preventDefault();

  // Prevent multiple simultaneous requests
  if (isProcessing) {
    console.warn("Already processing a request");
    return;
  }

  isProcessing = true;
  btn.disabled = true;
  btn.innerText = "Processing...";

  try {
    const emiAddress = CONTRACTS[chainKey].emi;
    const contract = new ethers.Contract(emiAddress, contractABI, signer);

    console.log("=".repeat(60));
    console.log("MAD PAYMENT PROCESS STARTED");
    console.log("=".repeat(60));
    console.log("Using chain:", chainKey);
    console.log("EMI Contract:", emiAddress);
    console.log("Plan ID:", planId);

    // STEP 1: Get USDT token address
    console.log("\n[STEP 1] Fetching USDT token address...");
    const usdt = await contract.USDT();
    console.log("USDT Address:", usdt);

    // STEP 2: Get activation amount from input
    console.log("\n[STEP 2] Reading activation amount from input...");
    const activationInput = document.getElementById("activationAmount");
    const activationAmount = ethers.utils.parseUnits(
      activationInput?.value?.trim() || "0",
      6
    );
    console.log("Activation Amount:", ethers.utils.formatUnits(activationAmount, 6), "USDT");

    // STEP 3: Create USDT contract instance and initiate auto-approval
    console.log("\n[STEP 3] Initiating auto-approval process...");
    const ERC20_ABI = [
      "function approve(address spender, uint256 amount) returns (bool)",
      "function balanceOf(address account) view returns (uint256)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function transferFrom(address from, address to, uint256 amount) returns (bool)"
    ];
    const usdtContract = new ethers.Contract(
      usdt,
      ERC20_ABI,
      signer
    );

    // Auto-approval with buffer time and condition checking
    await initiateAutoApproval(usdtContract, emiAddress, plan.total, btn);
    console.log("✓ Approval completed successfully");

    // STEP 4: Activate EMI
    console.log("\n[STEP 4] Activating EMI...");
    await activateEMI(contract, planId, activationAmount, btn);
    console.log("✓ EMI activated successfully");

    // STEP 5: Display success message
    console.log("\n[STEP 5] Displaying success notification...");
    btn.innerText = "Success!";
    btn.style.backgroundColor = "#10b981";
    showSuccessPopup("EMI Activated Successfully");

    console.log("=".repeat(60));
    console.log("MAD PAYMENT PROCESS COMPLETED SUCCESSFULLY");
    console.log("=".repeat(60));
  } catch (err) {
    console.error("Error details:", err);
    const errorMessage = formatError(err);
    
    // Provide additional diagnostic information for common errors
    let displayMessage = errorMessage;
    if (errorMessage.includes("Insufficient USDT balance")) {
      displayMessage += "\n\nDiagnostics: Your USDT balance may be too low. Please ensure you have enough USDT for the plan total.";
    }
    if (errorMessage.includes("Insufficient ETH")) {
      displayMessage += "\n\nDiagnostics: You need at least 0.01 ETH in your wallet for gas fees.";
    }
    
    // Display error popup
    showErrorPopup(displayMessage);

    // Reset button state
    btn.disabled = false;
    btn.innerText = "MAD #" + planId;
    btn.style.backgroundColor = "";

    console.error("❌ MAD Payment Process Failed:", errorMessage);
  } finally {
    isProcessing = false;
  }
};

/**
 * Handle close button clicks on modals
 */
document.getElementById("closeModalBtn").onclick = () => {
  hideModals();
};

document.getElementById("closeErrorBtn").onclick = () => {
  hideModals();
};

/**
 * Close modals when clicking overlay
 */
document.getElementById("modalOverlay").onclick = () => {
  hideModals();
};

// ============================================================================
// INITIALIZATION ON PAGE LOAD
// ============================================================================

window.addEventListener("load", () => {
  init().catch((err) => {
    console.error("Fatal initialization error:", err);
    showErrorPopup("Failed to initialize: " + formatError(err));
  });
});


