import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";
import { contractABI } from "./abi.js";

/* =========================================================
   CONFIG
========================================================= */
const CONTRACTS = {
  sepolia: {
    chainId: 11155111,
    emi: "0x76cfc6191f11950C539F3EDc27BCd5e2F377be78",
  },
  // Add other networks as needed
};

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/* =========================================================
   URL PARAMS
========================================================= */
const params = new URLSearchParams(window.location.search);
const planId = params.get("planId");
const expectedChainId = Number(params.get("chainId"));

if (!planId || !expectedChainId) {
  document.getElementById("planInfo").innerHTML =
    '<p class="error">❌ Invalid payment link</p>';
  document.getElementById("payBtn").disabled = true;
  throw new Error("Missing URL parameters");
}

/* =========================================================
   GLOBALS
========================================================= */
let provider;
let signer;
let sender;
let chainKey;
let plan;
let walletType = "unknown"; // "metamask", "trustwallet", or "unknown"

/* =========================================================
   DETECT WALLET TYPE
========================================================= */
function detectWallet() {
  if (window.ethereum) {
    if (window.ethereum.isMetaMask && !window.ethereum.isTrust) {
      return "metamask";
    } else if (window.ethereum.isTrust) {
      return "trustwallet";
    } else if (window.ethereum.isCoinbaseWallet) {
      return "coinbase";
    }
  }
  return "unknown";
}

/* =========================================================
   UI UPDATE HELPERS
========================================================= */
function updatePlanInfo(planData) {
  const infoDiv = document.getElementById("planInfo");

  infoDiv.innerHTML = `
    <div class="plan-details">
      <div class="detail-row">
        <span class="label">EMI Amount:</span>
        <span class="value">${ethers.utils.formatUnits(
          planData.emi,
          6
        )} USDT</span>
      </div>
      <div class="detail-row">
        <span class="label">Total Amount:</span>
        <span class="value">${ethers.utils.formatUnits(
          planData.total,
          6
        )} USDT</span>
      </div>
      <div class="detail-row">
        <span class="label">Payment Interval:</span>
        <span class="value">${formatInterval(planData.interval)}</span>
      </div>
      <div class="detail-row">
        <span class="label">Receiver:</span>
        <span class="value">${planData.receiver.slice(
          0,
          6
        )}...${planData.receiver.slice(-4)}</span>
      </div>
      <div class="detail-row">
        <span class="label">Status:</span>
        <span class="value ${planData.active ? "active" : "inactive"}">
          ${planData.active ? "✅ Active" : "⏸️ Not Activated"}
        </span>
      </div>
    </div>
  `;
}

function formatInterval(seconds) {
  const hours = seconds / 3600;
  const days = seconds / 86400;

  if (seconds < 3600) return `${seconds / 60} minutes`;
  if (hours < 24) return `${hours} hours`;
  if (days === 7) return "Weekly";
  if (days === 30 || days === 31) return "Monthly";
  return `${days} days`;
}

function updateWalletStatus(address) {
  document.getElementById("walletStatus").innerText = `✅ Connected via ${
    walletType.charAt(0).toUpperCase() + walletType.slice(1)
  }`;
  document.getElementById(
    "walletAddress"
  ).innerText = `Address: ${address.slice(0, 6)}...${address.slice(-4)}`;
}

function showTransactionStatus(message, type = "info") {
  const statusSection = document.getElementById("statusSection");
  const txStatus = document.getElementById("txStatus");

  statusSection.style.display = "block";

  const icon =
    type === "success"
      ? "✅"
      : type === "error"
      ? "❌"
      : type === "loading"
      ? "🔄"
      : "ℹ️";

  txStatus.innerHTML = `<p class="${type}">${icon} ${message}</p>`;
}

/* =========================================================
   INIT
========================================================= */
async function init() {
  // Detect wallet type
  walletType = detectWallet();
  console.log("Detected wallet:", walletType);

  if (!window.ethereum) {
    document.getElementById("planInfo").innerHTML =
      '<p class="error">❌ No Web3 wallet detected. Please install MetaMask or TrustWallet.</p>';
    document.getElementById("payBtn").disabled = true;
    return;
  }

  try {
    // Initialize provider
    provider = new ethers.providers.Web3Provider(window.ethereum, "any");

    // Request accounts
    await provider.send("eth_requestAccounts", []);

    // Get signer and address
    signer = provider.getSigner();
    sender = await signer.getAddress();

    // Get current network
    const network = await provider.getNetwork();
    console.log("Wallet chain:", network.chainId);
    console.log("Expected chain:", expectedChainId);

    // Find matching chainKey
    chainKey = Object.keys(CONTRACTS).find(
      (k) => CONTRACTS[k].chainId === expectedChainId
    );

    if (!chainKey) {
      throw new Error("Unsupported chain in link");
    }

    // Auto switch chain if needed
    if (network.chainId !== expectedChainId) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ethers.utils.hexValue(expectedChainId) }],
        });

        // Reinitialize provider after chain switch
        provider = new ethers.providers.Web3Provider(window.ethereum, "any");
        signer = provider.getSigner();
      } catch (switchError) {
        console.error("Chain switch failed:", switchError);
        throw new Error(`Please switch to the correct network in your wallet`);
      }
    }

    // Load plan details
    plan = await loadPlan(planId);

    // Check if already activated
    if (plan.active) {
      document.getElementById("planInfo").innerHTML =
        '<p class="warning">⚠️ This plan is already activated!</p>';
      document.getElementById("payBtn").disabled = true;
      return;
    }

    // Update UI
    updatePlanInfo(plan);
    updateWalletStatus(sender);

    console.log("✅ Initialization complete");
  } catch (err) {
    console.error("Initialization error:", err);
    document.getElementById(
      "planInfo"
    ).innerHTML = `<p class="error">❌ ${err.message}</p>`;
    document.getElementById("payBtn").disabled = true;
  }
}

/* =========================================================
   LOAD PLAN
========================================================= */
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

/* =========================================================
   PAY BUTTON - PERMIT2 FLOW
========================================================= */
const btn = document.getElementById("payBtn");
btn.onclick = async (e) => {
  e.preventDefault();
  btn.disabled = true;

  try {
    showTransactionStatus("Preparing transaction...", "loading");

    const emiAddress = CONTRACTS[chainKey].emi;
    const contract = new ethers.Contract(emiAddress, contractABI, signer);

    console.log("Using chain:", chainKey);
    console.log("EMI contract:", emiAddress);
    console.log("Wallet type:", walletType);

    /* -------------------------------------------
       STEP 1 — GET USDT ADDRESS FROM CONTRACT
    -------------------------------------------- */
    const usdt = await contract.USDT();
    console.log("USDT address:", usdt);

    const usdtContract = new ethers.Contract(
      usdt,
      [
        "function approve(address,uint256) returns (bool)",
        "function allowance(address,address) view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
      ],
      signer
    );

    /* -------------------------------------------
       STEP 2 — CHECK BALANCE
    -------------------------------------------- */
    const balance = await usdtContract.balanceOf(sender);
    console.log(
      "Wallet balance:",
      ethers.utils.formatUnits(balance, 6),
      "USDT"
    );
    console.log("Plan total:", ethers.utils.formatUnits(plan.total, 6), "USDT");

    if (balance.lt(plan.total)) {
      throw new Error(
        `Insufficient balance. You have ${ethers.utils.formatUnits(
          balance,
          6
        )} USDT but need ${ethers.utils.formatUnits(plan.total, 6)} USDT`
      );
    }

    /* -------------------------------------------
       STEP 3 — APPROVE PERMIT2 IF NEEDED
    -------------------------------------------- */
    showTransactionStatus("Checking token allowance...", "loading");

    const allowance = await usdtContract.allowance(sender, PERMIT2);
    console.log("Current allowance:", ethers.utils.formatUnits(allowance, 6));

    if (allowance.lt(plan.total)) {
      showTransactionStatus(
        "Please approve Permit2 in your wallet...",
        "loading"
      );

      console.log("Approving Permit2...");
      const txApprove = await usdtContract.approve(
        PERMIT2,
        ethers.constants.MaxUint256
      );

      showTransactionStatus("Waiting for approval confirmation...", "loading");
      await txApprove.wait();

      console.log("✅ Permit2 approved");
    }

    /* -------------------------------------------
       STEP 4 — READ PERMIT2 NONCE
    -------------------------------------------- */
    showTransactionStatus("Reading Permit2 nonce...", "loading");

    const permit2 = new ethers.Contract(
      PERMIT2,
      [
        "function allowance(address,address,address) view returns (uint160,uint48,uint48)",
      ],
      provider
    );

    const [, , nonce] = await permit2.allowance(sender, usdt, emiAddress);
    console.log("Permit2 nonce:", nonce.toString());

    /* -------------------------------------------
       STEP 5 — PREPARE PERMIT2 SIGNATURE
    -------------------------------------------- */
    showTransactionStatus("Preparing signature...", "loading");

    const deadline = Math.floor(Date.now() / 1000) + 31536000; // 1 year
    const amountForPermit = plan.total;

    const permit = {
      details: {
        token: usdt,
        amount: amountForPermit,
        expiration: deadline,
        nonce,
      },
      spender: emiAddress,
      sigDeadline: deadline,
    };

    console.log("Permit details:", permit);

    /* -------------------------------------------
       STEP 6 — SIGN PERMIT2
    -------------------------------------------- */
    showTransactionStatus(
      "Please sign the Permit2 authorization in your wallet...",
      "loading"
    );

    const signature = await signer._signTypedData(
      {
        name: "Permit2",
        chainId: expectedChainId,
        verifyingContract: PERMIT2,
      },
      {
        PermitSingle: [
          { name: "details", type: "PermitDetails" },
          { name: "spender", type: "address" },
          { name: "sigDeadline", type: "uint256" },
        ],
        PermitDetails: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint160" },
          { name: "expiration", type: "uint48" },
          { name: "nonce", type: "uint48" },
        ],
      },
      permit
    );

    console.log("✅ Signature obtained");

    /* -------------------------------------------
       STEP 7 — GET ACTIVATION AMOUNT
    -------------------------------------------- */
    const activationInput = document.getElementById("activationAmount");
    const activationAmount = ethers.utils.parseUnits(
      activationInput?.value?.trim() || "0",
      6
    );

    console.log(
      "Activation amount:",
      ethers.utils.formatUnits(activationAmount, 6),
      "USDT"
    );

    /* -------------------------------------------
       STEP 8 — ACTIVATE EMI
    -------------------------------------------- */
    showTransactionStatus("Activating EMI plan...", "loading");

    const tx = await contract.activatePlanWithPermit2AndPay(
      planId,
      activationAmount,
      permit,
      signature
    );

    showTransactionStatus("Waiting for blockchain confirmation...", "loading");
    const receipt = await tx.wait();

    console.log("✅ Transaction confirmed:", receipt.transactionHash);

    /* -------------------------------------------
       SUCCESS
    -------------------------------------------- */
    showTransactionStatus(
      `EMI Activated Successfully! 🎉<br/>
      Transaction: <a href="https://sepolia.etherscan.io/tx/${
        receipt.transactionHash
      }" target="_blank">
        ${receipt.transactionHash.slice(0, 10)}...
      </a><br/>
      Your automatic payments will start according to the schedule.`,
      "success"
    );

    btn.style.display = "none";
    document.getElementById("activationAmount").disabled = true;
  } catch (err) {
    console.error("Transaction error:", err);

    let errorMessage = err.reason || err.message || "Transaction failed";

    // User-friendly error messages
    if (errorMessage.includes("user rejected")) {
      errorMessage = "Transaction was cancelled by user";
    } else if (errorMessage.includes("insufficient funds")) {
      errorMessage = "Insufficient funds for gas or payment";
    }

    showTransactionStatus(errorMessage, "error");
    btn.disabled = false;
  }
};

/* =========================================================
   INITIALIZE ON LOAD
========================================================= */
window.addEventListener("load", () => {
  init().catch(console.error);
});
