//raw bytes method
// 🔥 ETH-ONLY receiver.js (No token configs needed)
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm";

// 🔥 ETH-ONLY ABI
const ethContractABI = [
  "function plans(uint256) view returns (address,address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function planCount() view returns (uint256)",
  "function createPlan(uint256,uint256,uint256) external",
  "function activatePlan(uint256) external payable",
  "function checkUpkeep(bytes) external view returns (bool,bytes)",
  "event PlanCreated(uint256 indexed planId)",
  "event PlanActivated(uint256 indexed planId, address indexed sender)",
  "event EmiPaid(uint256 indexed planId, uint256 amount)",
  "event EmiCompleted(uint256 indexed planId)",
];

const NETWORK_CONFIG = {
  sepolia: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    emiContract: "0xEb0D024185187f1f7e6daBd6a293157D6318cf5E",
    // 🔥 NO TOKENS - PURE ETH
  },
  mainnet: {
    chainId: 1,
    name: "Ethereum Mainnet",
    emiContract: "0x7BAA6f2fFc568F1114A392557Bc3bCDe609bb795",
  },
};

// [KEEP ALL WALLET FUNCTIONS UNCHANGED - connectWallet, autoReconnect, etc.]
/* =========================================================
   GLOBAL STATE
========================================================= */
let provider, signer, receiverAddress, currentChainId;

/* =========================================================
   UI ELEMENTS
========================================================= */
const connectBtn = document.getElementById("connectWalletBtn");
const disconnectBtn = document.getElementById("disconnectWalletBtn");
const accountDisplay = document.getElementById("account");
const networkDisplay = document.getElementById("network");

const blockchainSelect = document.getElementById("blockchainSelect");
const tokenSelect = document.getElementById("tokenSelect");
const tokenAddressDisplay = document.getElementById("tokenAddressDisplay");
const tokenDecimalsDisplay =
  document.getElementById("tokenDecimalsDisplay") ||
  document.createElement("p");

const intervalSelect = document.getElementById("intervalSelect");
const customIntervalInput = document.getElementById("customInterval");

const modifyReceiverBtn = document.getElementById("modifyReceiverBtn");

/* =========================================================
   WALLET FUNCTIONS (UNCHANGED)
========================================================= */
async function connectWallet() {
  if (!window.ethereum) return alert("MetaMask required");

  provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  await provider.send("eth_requestAccounts", []);

  signer = provider.getSigner();
  receiverAddress = await signer.getAddress();

  localStorage.setItem("walletConnected", "true");
  accountDisplay.innerText = `${receiverAddress.slice(
    0,
    6,
  )}...${receiverAddress.slice(-4)}`;

  await syncNetwork();
  connectBtn.style.display = "none";
  disconnectBtn.style.display = "inline-block";
}

async function autoReconnect() {
  if (localStorage.getItem("walletConnected") !== "true" || !window.ethereum)
    return;

  provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  const accounts = await provider.listAccounts();

  if (accounts.length > 0) {
    signer = provider.getSigner();
    receiverAddress = accounts[0];
    accountDisplay.innerText = `${receiverAddress.slice(
      0,
      6,
    )}...${receiverAddress.slice(-4)}`;
    connectBtn.style.display = "none";
    disconnectBtn.style.display = "inline-block";
    await syncNetwork();
  }
}

function disconnectWallet() {
  localStorage.removeItem("walletConnected");
  accountDisplay.innerText = "";
  networkDisplay.innerText = "";
  connectBtn.style.display = "inline-block";
  disconnectBtn.style.display = "none";
}

connectBtn.onclick = connectWallet;
disconnectBtn.onclick = disconnectWallet;

/* =========================================================
   NETWORK SYNC + POPULATE DROPDOWNS
========================================================= */
async function syncNetwork() {
  try {
    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    currentChainId = Number(chainIdHex);

    networkDisplay.innerText = `Network: ${getNetworkLabel(currentChainId)}`;

    const chainKey = Object.keys(NETWORK_CONFIG).find(
      (key) => NETWORK_CONFIG[key].chainId === currentChainId,
    );

    if (chainKey) {
      blockchainSelect.value = chainKey;
      populateTokens(chainKey);
    }
  } catch (err) {
    console.error("Network sync failed:", err);
  }
}

function getNetworkLabel(chainId) {
  const config = Object.values(NETWORK_CONFIG).find(
    (c) => c.chainId === chainId,
  );
  return config ? config.name : `Unknown (${chainId})`;
}

/* =========================================================
   INTERVAL HANDLING
========================================================= */
intervalSelect.onchange = () => {
  customIntervalInput.style.display =
    intervalSelect.value === "custom" ? "block" : "none";
};

/* =========================================================
   MODIFY RECEIVER
========================================================= */
modifyReceiverBtn.onclick = async () => {
  if (!signer) return alert("Connect wallet first");

  const planId = document.getElementById("modifyPlanId").value;
  const newReceiver = document
    .getElementById("newReceiverAddress")
    .value.trim();

  if (!planId || !newReceiver || !ethers.utils.isAddress(newReceiver)) {
    return alert("Enter valid Plan ID & Receiver address");
  }

  const chainKey = blockchainSelect.value;
  const contract = new ethers.Contract(
    NETWORK_CONFIG[chainKey].emiContract,
    rawContractABI,
    signer,
  );

  try {
    const tx = await contract.updateReceiver(planId, newReceiver);
    await tx.wait();
    alert(`✅ Receiver updated for Plan #${planId}`);
  } catch (err) {
    alert("Update failed: " + (err.reason || err.message || "Unknown error"));
  }
};

/* =========================================================
   🔥 ETH-ONLY CREATE PLAN (Simplified - NO TOKENS!)
========================================================= */
document.getElementById("createPlanBtn").onclick = async () => {
  if (!signer) return alert("Connect MetaMask first");
  if (!blockchainSelect.value) return alert("Select blockchain");

  const emiInput = document.getElementById("emiAmount").value;
  const totalInput = document.getElementById("totalAmount").value;
  if (
    !emiInput ||
    !totalInput ||
    Number(emiInput) <= 0 ||
    Number(totalInput) <= 0
  ) {
    return alert("Enter valid EMI & Total amounts (positive numbers)");
  }
  if (Number(totalInput) < Number(emiInput)) {
    return alert("Total must be >= EMI amount");
  }

  // 🔥 ETH amounts (18 decimals)
  const chainKey = blockchainSelect.value;
  const emiAmount = ethers.utils.parseEther(emiInput); // ETH
  const totalAmount = ethers.utils.parseEther(totalInput); // ETH

  let intervalSeconds =
    intervalSelect.value === "custom"
      ? Number(customIntervalInput.value) * 60
      : Number(intervalSelect.value);

  if (intervalSeconds < 60) return alert("Minimum 60 seconds interval");

  const contract = new ethers.Contract(
    NETWORK_CONFIG[chainKey].emiContract,
    ethContractABI,
    signer,
  );

  try {
    const btn = document.getElementById("createPlanBtn");
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Creating ETH Plan...";

    const tx = await contract.createPlan(
      emiAmount,
      intervalSeconds,
      totalAmount,
    );
    const receipt = await tx.wait();

    // Parse event
    const iface = new ethers.utils.Interface(ethContractABI);
    const event = receipt.logs
      .map((log) => {
        try {
          return iface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "PlanCreated");

    const planId = event?.args?.planId?.toString();
    if (!planId) throw new Error("PlanCreated event not found");

    // 🔥 ETH Sender Links
    const chainId = NETWORK_CONFIG[chainKey].chainId;
    // 🔥 WORKING DEEP LINKS (Tested on Netlify!)
    const senderUrl = `${window.location.origin}/sender.html?planId=${planId}&chainId=${chainId}`;

    // 1️⃣ METAMASK - CORRECT FORMAT
    const metamaskLink = `https://metamask.app.link/dapp/${encodeURIComponent(
      senderUrl,
    )}`;

    // 2️⃣ TRUST WALLET - CORRECT FORMAT
    const trustWalletLink = `tw://open_url?url=${encodeURIComponent(
      senderUrl,
    )}`;

    // 🎯 UPDATE UI
    document.getElementById("metamaskLinkOutput").value = metamaskLink;
    document.getElementById("trustwalletLinkOutput").value = trustWalletLink;

    // 🔥 GENERATE QR CODES
    QRCode.toCanvas(document.getElementById("qrCanvasMetamask"), metamaskLink, {
      width: 220,
    });
    QRCode.toCanvas(document.getElementById("qrCanvasTrust"), trustWalletLink, {
      width: 220,
    });

    document.getElementById("shareSection").style.display = "block";

    alert(
      `✅ ETH Plan #${planId} created!\n` +
        `💰 EMI: ${emiInput} ETH\n💎 Total: ${totalInput} ETH\n` +
        `📱 MetaMask: ${metamaskLink.slice(0, 50)}...\n` +
        `🟢 Trust: ${trustWalletLink.slice(0, 50)}...`,
    );
    btn.disabled = false;
    btn.innerText = originalText;
  } catch (err) {
    alert("Create failed: " + (err.reason || err.message));
    document.getElementById("createPlanBtn").disabled = false;
    document.getElementById("createPlanBtn").innerText = "Create ETH EMI Plan";
  }
};

// [REST OF CODE UNCHANGED - Remove token-related UI logic]

// ========================================================= */
window.addEventListener("load", autoReconnect);

if (window.ethereum) {
  window.ethereum.on("chainChanged", syncNetwork);
  window.ethereum.on("accountsChanged", () => window.location.reload());
}

// Populate blockchain dropdown
Object.entries(NETWORK_CONFIG).forEach(([key, config]) => {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = config.name;
  blockchainSelect.appendChild(opt);
});

//raw bytes code without IERC20+permit2
// Raw Bytes Multi-Token Receiver - FULLY FUNCTIONAL
// import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";
// import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm";

// // Minimal ABI for Raw Bytes contract
// const rawContractABI = [
//   "function plans(uint256) view returns (address,address,uint256,uint256,uint256,uint256,uint256,bool)",
//   "function planCount() view returns (uint256)",
//   "function createPlan(uint256,uint256,uint256) external",
//   "function activatePlan(uint256,uint256) external",
//   "function checkUpkeep(bytes) external view returns (bool,bytes)",
//   "event PlanCreated(uint256 indexed planId)",
//   "event PlanActivated(uint256 indexed planId, address indexed sender)",
//   "event EmiPaid(uint256 indexed planId, uint256 amount)",
//   "event EmiCompleted(uint256 indexed planId)",
// ];

// // 🔥 MULTI-CHAIN + MULTI-TOKEN CONFIG
// const NETWORK_CONFIG = {
//   sepolia: {
//     chainId: 11155111,
//     name: "Sepolia Testnet",
//     emiContract: "0x41C7e6A42d46bA5DEa72a20d3954164A6C56315b", // YOUR DEPLOYED
//     tokens: {
//       USDT: {
//         address: "0xFa7Ea86672d261A0A0bfDba22A9F7D2A75581320", // Mock USDT
//         decimals: 6,
//         symbol: "USDT",
//       },
//     },
//   },
//   mainnet: {
//     chainId: 1,
//     name: "Ethereum Mainnet",
//     emiContract: "0x7BAA6f2fFc568F1114A392557Bc3bCDe609bb795",
//     tokens: {
//       USDT: {
//         address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//         decimals: 6,
//         symbol: "USDT",
//       },
//       USDC: {
//         address: "0xA0b86a33Edd01A2061bD3a25eaf6221eEBf05724",
//         decimals: 6,
//         symbol: "USDC",
//       },
//     },
//   },
// };

// /* =========================================================
//    GLOBAL STATE
// ========================================================= */
// let provider, signer, receiverAddress, currentChainId;

// /* =========================================================
//    UI ELEMENTS
// ========================================================= */
// const connectBtn = document.getElementById("connectWalletBtn");
// const disconnectBtn = document.getElementById("disconnectWalletBtn");
// const accountDisplay = document.getElementById("account");
// const networkDisplay = document.getElementById("network");

// const blockchainSelect = document.getElementById("blockchainSelect");
// const tokenSelect = document.getElementById("tokenSelect");
// const tokenAddressDisplay = document.getElementById("tokenAddressDisplay");
// const tokenDecimalsDisplay =
//   document.getElementById("tokenDecimalsDisplay") ||
//   document.createElement("p");

// const intervalSelect = document.getElementById("intervalSelect");
// const customIntervalInput = document.getElementById("customInterval");

// const modifyReceiverBtn = document.getElementById("modifyReceiverBtn");

// /* =========================================================
//    WALLET FUNCTIONS (UNCHANGED)
// ========================================================= */
// async function connectWallet() {
//   if (!window.ethereum) return alert("MetaMask required");

//   provider = new ethers.providers.Web3Provider(window.ethereum, "any");
//   await provider.send("eth_requestAccounts", []);

//   signer = provider.getSigner();
//   receiverAddress = await signer.getAddress();

//   localStorage.setItem("walletConnected", "true");
//   accountDisplay.innerText = `${receiverAddress.slice(
//     0,
//     6,
//   )}...${receiverAddress.slice(-4)}`;

//   await syncNetwork();
//   connectBtn.style.display = "none";
//   disconnectBtn.style.display = "inline-block";
// }

// async function autoReconnect() {
//   if (localStorage.getItem("walletConnected") !== "true" || !window.ethereum)
//     return;

//   provider = new ethers.providers.Web3Provider(window.ethereum, "any");
//   const accounts = await provider.listAccounts();

//   if (accounts.length > 0) {
//     signer = provider.getSigner();
//     receiverAddress = accounts[0];
//     accountDisplay.innerText = `${receiverAddress.slice(
//       0,
//       6,
//     )}...${receiverAddress.slice(-4)}`;
//     connectBtn.style.display = "none";
//     disconnectBtn.style.display = "inline-block";
//     await syncNetwork();
//   }
// }

// function disconnectWallet() {
//   localStorage.removeItem("walletConnected");
//   accountDisplay.innerText = "";
//   networkDisplay.innerText = "";
//   connectBtn.style.display = "inline-block";
//   disconnectBtn.style.display = "none";
// }

// connectBtn.onclick = connectWallet;
// disconnectBtn.onclick = disconnectWallet;

// /* =========================================================
//    NETWORK SYNC + POPULATE DROPDOWNS
// ========================================================= */
// async function syncNetwork() {
//   try {
//     const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
//     currentChainId = Number(chainIdHex);

//     networkDisplay.innerText = `Network: ${getNetworkLabel(currentChainId)}`;

//     const chainKey = Object.keys(NETWORK_CONFIG).find(
//       (key) => NETWORK_CONFIG[key].chainId === currentChainId,
//     );

//     if (chainKey) {
//       blockchainSelect.value = chainKey;
//       populateTokens(chainKey);
//     }
//   } catch (err) {
//     console.error("Network sync failed:", err);
//   }
// }

// function getNetworkLabel(chainId) {
//   const config = Object.values(NETWORK_CONFIG).find(
//     (c) => c.chainId === chainId,
//   );
//   return config ? config.name : `Unknown (${chainId})`;
// }

// /* =========================================================
//    🔥 MULTI-TOKEN POPULATION (Dynamic Decimals!)
// ========================================================= */
// function populateTokens(chainKey) {
//   tokenSelect.innerHTML = '<option value="">Select Token</option>';

//   if (!chainKey || !NETWORK_CONFIG[chainKey]?.tokens) {
//     tokenAddressDisplay.value = "";
//     tokenDecimalsDisplay.textContent = "";
//     return;
//   }

//   const tokens = NETWORK_CONFIG[chainKey].tokens;

//   Object.entries(tokens).forEach(([symbol, tokenInfo]) => {
//     const opt = document.createElement("option");
//     opt.value = symbol;
//     opt.dataset.address = tokenInfo.address;
//     opt.dataset.decimals = tokenInfo.decimals;
//     opt.textContent = `${symbol} (${tokenInfo.symbol})`;
//     tokenSelect.appendChild(opt);
//   });

//   updateTokenDisplay();
// }

// function updateTokenDisplay() {
//   const selectedOption = tokenSelect.selectedOptions[0];
//   if (selectedOption) {
//     tokenAddressDisplay.value = selectedOption.dataset.address || "";
//     tokenDecimalsDisplay.textContent = `Decimals: ${selectedOption.dataset.decimals}`;
//   } else {
//     tokenAddressDisplay.value = "";
//     tokenDecimalsDisplay.textContent = "";
//   }
// }

// // Event listeners
// blockchainSelect.onchange = (e) => populateTokens(e.target.value);
// tokenSelect.onchange = updateTokenDisplay;

// /* =========================================================
//    INTERVAL HANDLING
// ========================================================= */
// intervalSelect.onchange = () => {
//   customIntervalInput.style.display =
//     intervalSelect.value === "custom" ? "block" : "none";
// };

// /* =========================================================
//    MODIFY RECEIVER
// ========================================================= */
// modifyReceiverBtn.onclick = async () => {
//   if (!signer) return alert("Connect wallet first");

//   const planId = document.getElementById("modifyPlanId").value;
//   const newReceiver = document
//     .getElementById("newReceiverAddress")
//     .value.trim();

//   if (!planId || !newReceiver || !ethers.utils.isAddress(newReceiver)) {
//     return alert("Enter valid Plan ID & Receiver address");
//   }

//   const chainKey = blockchainSelect.value;
//   const contract = new ethers.Contract(
//     NETWORK_CONFIG[chainKey].emiContract,
//     rawContractABI,
//     signer,
//   );

//   try {
//     const tx = await contract.updateReceiver(planId, newReceiver);
//     await tx.wait();
//     alert(`✅ Receiver updated for Plan #${planId}`);
//   } catch (err) {
//     alert("Update failed: " + (err.reason || err.message || "Unknown error"));
//   }
// };

// /* =========================================================
//    🔥 CREATE EMI PLAN - FULLY VALIDATED
// ========================================================= */
// document.getElementById("createPlanBtn").onclick = async () => {
//   // Validation
//   if (!signer) return alert("Connect MetaMask first");
//   if (!blockchainSelect.value) return alert("Select blockchain");

//   const tokenSymbol = tokenSelect.selectedOptions[0]?.value;
//   if (!tokenSymbol) return alert("Select token");

//   const emiInput = document.getElementById("emiAmount").value;
//   const totalInput = document.getElementById("totalAmount").value;
//   if (
//     !emiInput ||
//     !totalInput ||
//     Number(emiInput) <= 0 ||
//     Number(totalInput) <= 0
//   ) {
//     return alert("Enter valid EMI & Total amounts (positive numbers)");
//   }

//   if (Number(totalInput) < Number(emiInput)) {
//     return alert("Total must be >= EMI amount");
//   }

//   // Get values
//   const chainKey = blockchainSelect.value;
//   const tokenInfo = NETWORK_CONFIG[chainKey].tokens[tokenSymbol];
//   const decimals = tokenInfo.decimals;

//   const emiAmount = ethers.utils.parseUnits(emiInput, decimals);
//   const totalAmount = ethers.utils.parseUnits(totalInput, decimals);

//   let intervalSeconds =
//     intervalSelect.value === "custom"
//       ? Number(customIntervalInput.value) * 60
//       : Number(intervalSelect.value);

//   if (intervalSeconds < 60) return alert("Minimum 60 seconds interval");

//   const contract = new ethers.Contract(
//     NETWORK_CONFIG[chainKey].emiContract,
//     rawContractABI,
//     signer,
//   );

//   try {
//     // Show loading
//     const btn = document.getElementById("createPlanBtn");
//     const originalText = btn.innerText;
//     btn.disabled = true;
//     btn.innerText = "Creating...";

//     const tx = await contract.createPlan(
//       emiAmount,
//       intervalSeconds,
//       totalAmount,
//     );
//     const receipt = await tx.wait();

//     // Parse PlanCreated event
//     const iface = new ethers.utils.Interface(rawContractABI);
//     const event = receipt.logs
//       .map((log) => {
//         try {
//           return iface.parseLog(log);
//         } catch {
//           return null;
//         }
//       })
//       .find((log) => log?.name === "PlanCreated");

//     const planId = event?.args?.planId?.toString();
//     if (!planId) throw new Error("PlanCreated event not found");

//     // 🔥 PERFECT LINKS + QR CODES
//     const chainId = NETWORK_CONFIG[chainKey].chainId;
//     const senderUrl = `${window.location.origin}/sender.html?planId=${planId}&chainId=${chainId}`;

//     // MetaMask + Trust Wallet deep links
//     const metamaskLink = `https://metamask.app.link/dapp/${window.location.host}/sender.html?planId=${planId}&chainId=${chainId}`;
//     const trustWalletLink = `tw://open_url?url=${encodeURIComponent(
//       senderUrl,
//     )}`;

//     // Update UI
//     document.getElementById("metamaskLinkOutput").value = metamaskLink;
//     document.getElementById("trustwalletLinkOutput").value = trustWalletLink;

//     // Generate QR Codes
//     QRCode.toCanvas(document.getElementById("qrCanvasMetamask"), metamaskLink, {
//       width: 220,
//     });
//     QRCode.toCanvas(document.getElementById("qrCanvasTrust"), trustWalletLink, {
//       width: 220,
//     });

//     document.getElementById("shareSection").style.display = "block";

//     // Success feedback
//     alert(
//       `✅ Plan #${planId} created!\nEMI: ${emiInput} ${tokenSymbol}\nTotal: ${totalInput} ${tokenSymbol}\nShare links with sender!`,
//     );

//     btn.disabled = false;
//     btn.innerText = originalText;
//   } catch (err) {
//     console.error(err);
//     alert(
//       "Create failed: " + (err.reason || err.message || "Transaction failed"),
//     );
//     document.getElementById("createPlanBtn").disabled = false;
//     document.getElementById("createPlanBtn").innerText = "Create EMI Plan";
//   }
// };

// /* =========================================================
//    INIT + EVENTS
// ========================================================= */
// window.addEventListener("load", autoReconnect);

// if (window.ethereum) {
//   window.ethereum.on("chainChanged", syncNetwork);
//   window.ethereum.on("accountsChanged", () => window.location.reload());
// }

// // Populate blockchain dropdown
// Object.entries(NETWORK_CONFIG).forEach(([key, config]) => {
//   const opt = document.createElement("option");
//   opt.value = key;
//   opt.textContent = config.name;
//   blockchainSelect.appendChild(opt);
// });

//IERC20 + permit2 code
// import { AppConfig } from "./config.js";
// import { contractABI } from "./abi.js";

// import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm";

// /* =========================================================
//    GLOBAL STATE
// ========================================================= */
// let provider;
// let signer;
// let receiverAddress;
// let currentChainId;

// /* =========================================================
//    UI ELEMENTS
// ========================================================= */
// const connectBtn = document.getElementById("connectWalletBtn");
// const disconnectBtn = document.getElementById("disconnectWalletBtn");
// const accountDisplay = document.getElementById("account");
// const networkDisplay = document.getElementById("network");

// const blockchainSelect = document.getElementById("blockchainSelect");
// const tokenSelect = document.getElementById("tokenSelect");
// const tokenAddressDisplay = document.getElementById("tokenAddressDisplay");

// const intervalSelect = document.getElementById("intervalSelect");
// const customIntervalInput = document.getElementById("customInterval");

// const modifyReceiverBtn = document.getElementById("modifyReceiverBtn");
// /* =========================================================
//    NETWORK HELPERS
// ========================================================= */
// function getNetworkLabel(chainId) {
//   if (chainId === 1) return "Ethereum Mainnet";
//   if (chainId === 11155111) return "Sepolia Testnet";
//   return `Unknown (${chainId})`;
// }

// function getBlockchainKeyByChainId(chainId) {
//   return Object.keys(AppConfig.CHAINS).find(
//     (key) => AppConfig.CHAINS[key][AppConfig.ENV].chainId === chainId
//   );
// }

// /* =========================================================
//    SYNC NETWORK (SOURCE OF TRUTH)
// ========================================================= */
// async function syncNetwork() {
//   const chainIdHex = await window.ethereum.request({
//     method: "eth_chainId",
//   });

//   currentChainId = Number(chainIdHex);
//   networkDisplay.innerText = `Network: ${getNetworkLabel(currentChainId)}`;

//   const chainKey = getBlockchainKeyByChainId(currentChainId);

//   if (!chainKey) {
//     alert("Unsupported network. Please switch wallet network.");
//     return;
//   }

//   blockchainSelect.value = chainKey;
//   populateTokens();

//   console.log("✅ Connected chain:", currentChainId, chainKey);
// }

// /* =========================================================
//    WALLET CONNECTION
// ========================================================= */
// async function connectWallet() {
//   if (!window.ethereum) {
//     alert("MetaMask required");
//     return;
//   }

//   provider = new ethers.providers.Web3Provider(window.ethereum, "any");
//   await provider.send("eth_requestAccounts", []);

//   signer = provider.getSigner();
//   receiverAddress = await signer.getAddress();
//   localStorage.setItem("walletConnected", "true");
//   accountDisplay.innerText = `Wallet: ${receiverAddress}`;

//   // Important for Netlify cold load
//   await new Promise((res) => setTimeout(res, 200));
//   await syncNetwork();

//   connectBtn.style.display = "none";
//   disconnectBtn.style.display = "inline-block";
//   await syncNetwork();
// }

// async function autoReconnect() {
//   if (localStorage.getItem("walletConnected") !== "true") return;
//   if (!window.ethereum) return;

//   provider = new ethers.providers.Web3Provider(window.ethereum, "any");
//   const accounts = await provider.listAccounts();

//   if (accounts.length > 0) {
//     signer = provider.getSigner();
//     receiverAddress = accounts[0];

//     accountDisplay.innerText = `Wallet: ${receiverAddress}`;
//     connectBtn.style.display = "none";
//     disconnectBtn.style.display = "inline-block";

//     await syncNetwork();
//   }
// }

// function disconnectWallet() {
//   provider = null;
//   signer = null;
//   receiverAddress = null;
//   localStorage.removeItem("walletConnected");
//   accountDisplay.innerText = "";
//   networkDisplay.innerText = "";

//   connectBtn.style.display = "inline-block";
//   disconnectBtn.style.display = "none";
// }

// connectBtn.onclick = connectWallet;
// disconnectBtn.onclick = disconnectWallet;

// /* =========================================================
//    UPDATE RECEIVER BUTTON
// ========================================================= */

// modifyReceiverBtn.onclick = async () => {
//   if (!signer) return alert("Connect wallet");

//   const planId = document.getElementById("modifyPlanId").value;
//   const newReceiver = document.getElementById("newReceiverAddress").value;

//   if (!planId || !newReceiver) return alert("Missing input");

//   const contract = new ethers.Contract(
//     AppConfig.getEmiContract(blockchainSelect.value),
//     contractABI,
//     signer
//   );

//   try {
//     const tx = await contract.updateReceiver(planId, newReceiver);
//     await tx.wait();
//     alert("✅ Receiver updated successfully");
//   } catch (err) {
//     console.error(err);
//     alert(err.reason || err.message);
//   }
// };

// /* =========================================================
//    AUTO CONNECT ON LOAD
// ========================================================= */

// window.addEventListener("load", autoReconnect);

// /* =========================================================
//    CHAIN & TOKEN DROPDOWNS
// ========================================================= */
// Object.entries(AppConfig.CHAINS).forEach(([key, cfg]) => {
//   const opt = document.createElement("option");
//   opt.value = key;
//   opt.textContent = cfg.name;
//   blockchainSelect.appendChild(opt);
// });

// function populateTokens() {
//   tokenSelect.innerHTML = "";
//   tokenAddressDisplay.value = "";

//   const tokens = AppConfig.getTokens(blockchainSelect.value);
//   if (!tokens) return;

//   Object.entries(tokens).forEach(([symbol, address]) => {
//     const opt = document.createElement("option");
//     opt.value = address;
//     opt.textContent = symbol;
//     tokenSelect.appendChild(opt);
//   });

//   tokenAddressDisplay.value = tokenSelect.value || "";
// }

// blockchainSelect.addEventListener("change", populateTokens);
// tokenSelect.addEventListener("change", () => {
//   tokenAddressDisplay.value = tokenSelect.value || "";
// });

// /* =========================================================
//    INTERVAL HANDLING
// ========================================================= */
// intervalSelect.addEventListener("change", () => {
//   customIntervalInput.style.display =
//     intervalSelect.value === "custom" ? "block" : "none";
// });

// /* =========================================================
//    CREATE EMI PLAN
// ========================================================= */
// document.getElementById("createPlanBtn").onclick = async () => {
//   if (!signer) return alert("Connect MetaMask");

//   const blockchain = blockchainSelect.value;
//   const tokenSymbol = tokenSelect.options[tokenSelect.selectedIndex]?.text;

//   const emiInput = document.getElementById("emiAmount").value;
//   const totalInput = document.getElementById("totalAmount").value;

//   if (!emiInput || !totalInput) {
//     return alert("EMI & Total required");
//   }

//   const tokenMeta = AppConfig.getTokenMeta(blockchain, tokenSymbol);
//   if (!tokenMeta) return alert("Token metadata missing");

//   let intervalSeconds =
//     intervalSelect.value === "custom"
//       ? Number(customIntervalInput.value) * 60
//       : Number(intervalSelect.value);

//   if (intervalSeconds < 60) return alert("Minimum 60 seconds");

//   const emi = ethers.utils.parseUnits(emiInput, tokenMeta.decimals);
//   const total = ethers.utils.parseUnits(totalInput, tokenMeta.decimals);

//   const contract = new ethers.Contract(
//     AppConfig.getEmiContract(blockchain),
//     contractABI,
//     signer
//   );

//   let planId;

//   try {
//     const tx = await contract.createPlan(emi, intervalSeconds, total);
//     const receipt = await tx.wait(1);

//     const event = receipt.events?.find(
//       (e) => e.event === "PlanCreated" && e.args?.planId
//     );

//     if (!event) throw new Error("PlanCreated missing");

//     planId = event.args.planId.toString();
//   } catch (err) {
//     console.error(err);
//     alert(err.reason || err.message || "Create plan failed");
//     return;
//   }

//   /* =====================================================
//      DEEPLINK + QR
//   ===================================================== */
//   const host = window.location.origin.replace("https://", "");

//   // Base sender URL (same logic)
//   const senderUrl = `${window.location.origin}/sender.html?planId=${planId}&chainId=${currentChainId}`;

//   // MetaMask deep link (EXACT same as before)
//   const metamaskLink =
//     `https://metamask.app.link/dapp/${host}` +
//     `/sender.html?planId=${planId}&chainId=${currentChainId}`;

//   // Trust Wallet deep link
//   const trustWalletLink =
//     `https://link.trustwallet.com/open_url` +
//     `?coin_id=60` +
//     `&url=${encodeURIComponent(senderUrl)}`;

//   // Set outputs
//   document.getElementById("metamaskLinkOutput").value = metamaskLink;
//   document.getElementById("trustwalletLinkOutput").value = trustWalletLink;

//   // 🔥 Generate wallet-specific QR codes
//   renderWalletQR(metamaskLink, trustWalletLink);

//   document.getElementById("shareSection").style.display = "block";
// };
// /* =========================================================
//    QR
// ========================================================= */
// function renderWalletQR(metamaskLink, trustWalletLink) {
//   const mmCanvas = document.getElementById("qrCanvasMetamask");
//   const twCanvas = document.getElementById("qrCanvasTrust");

//   QRCode.toCanvas(mmCanvas, metamaskLink, { width: 220 }, (err) => {
//     if (err) console.error("MetaMask QR error:", err);
//   });

//   QRCode.toCanvas(twCanvas, trustWalletLink, { width: 220 }, (err) => {
//     if (err) console.error("Trust Wallet QR error:", err);
//   });
// }

// /* =========================================================
//    METAMASK EVENTS
// ========================================================= */
// if (window.ethereum) {
//   window.ethereum.on("chainChanged", async () => {
//     await syncNetwork();
//   });

//   window.ethereum.on("accountsChanged", () => {
//     window.location.reload();
//   });
// }
