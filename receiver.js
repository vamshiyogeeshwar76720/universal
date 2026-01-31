//raw bytes code without IERC20+permit2
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm";

// RAW BYTES CONTRACT ABI (minimal - no IERC20 dependencies)
const rawContractABI = [
  // Plan reading
  "function plans(uint256) view returns (address sender, address receiver, uint256 emi, uint256 interval, uint256 total, uint256 paid, uint256 nextPay, bool active)",
  "function planCount() view returns (uint256)",

  // Core functions (no Permit2!)
  "function createPlan(uint256 emi, uint256 interval, uint256 total) external",
  "function activatePlan(uint256 planId, uint256 activationAmount) external",

  // Chainlink automation
  "function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData)",

  // Events
  "event PlanCreated(uint256 indexed planId)",
  "event PlanActivated(uint256 indexed planId, address sender)",
  "event EmiPaid(uint256 indexed planId, uint256 amount)",
  "event EmiCompleted(uint256 indexed planId)",
];

/* =========================================================
   NETWORK CONFIG (Raw Bytes Compatible)
========================================================= */
const CONTRACTS = {
  sepolia: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    emi: "0x41C7e6A42d46bA5DEa72a20d3954164A6C56315b", // YOUR DEPLOYED CONTRACT
    usdt: "0xFa7Ea86672d261A0A0bfDba22A9F7D2A75581320",
  },
  mainnet: {
    chainId: 1,
    name: "Ethereum Mainnet",
    emi: "0x7BAA6f2fFc568F1114A392557Bc3bCDe609bb795",
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
};

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

const intervalSelect = document.getElementById("intervalSelect");
const customIntervalInput = document.getElementById("customInterval");

const modifyReceiverBtn = document.getElementById("modifyReceiverBtn");

/* =========================================================
   NETWORK HELPERS
========================================================= */
function getNetworkLabel(chainId) {
  return CONTRACTS.sepolia.chainId === chainId
    ? "Sepolia Testnet"
    : CONTRACTS.mainnet.chainId === chainId
    ? "Ethereum Mainnet"
    : `Unknown (${chainId})`;
}

function getContractConfig(chainKey) {
  return CONTRACTS[chainKey];
}

/* =========================================================
   WALLET CONNECTION (SIMPLIFIED)
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
   NETWORK SYNC
========================================================= */
async function syncNetwork() {
  const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
  currentChainId = Number(chainIdHex);

  networkDisplay.innerText = `Network: ${getNetworkLabel(currentChainId)}`;

  // Auto-select matching blockchain dropdown
  const chainKey = Object.keys(CONTRACTS).find(
    (key) => CONTRACTS[key].chainId === currentChainId,
  );

  if (chainKey) blockchainSelect.value = chainKey;
  populateTokens();
}

/* =========================================================
   TOKEN DROPDOWN (USDT Only for Raw Bytes)
========================================================= */
function populateTokens() {
  tokenSelect.innerHTML = '<option value="">Select Token</option>';

  const chainKey = blockchainSelect.value;
  if (!chainKey || !CONTRACTS[chainKey]) return;

  // Raw bytes works with USDT (6 decimals)
  const tokens = {
    USDT: CONTRACTS[chainKey].usdt,
  };

  Object.entries(tokens).forEach(([symbol, address]) => {
    const opt = document.createElement("option");
    opt.value = address;
    opt.textContent = `${symbol} (${address.slice(0, 6)}...)`;
    tokenSelect.appendChild(opt);
  });

  tokenAddressDisplay.value = CONTRACTS[chainKey]?.usdt || "";
}

// Populate on chain change
blockchainSelect.onchange = populateTokens;
tokenSelect.onchange = () => {
  tokenAddressDisplay.value = tokenSelect.value || "";
};

/* =========================================================
   INTERVAL HANDLING
========================================================= */
intervalSelect.onchange = () => {
  customIntervalInput.style.display =
    intervalSelect.value === "custom" ? "block" : "none";
};

/* =========================================================
   UPDATE RECEIVER (Kept Simple)
========================================================= */
modifyReceiverBtn.onclick = async () => {
  if (!signer) return alert("Connect wallet first");

  const planId = document.getElementById("modifyPlanId").value;
  const newReceiver = document.getElementById("newReceiverAddress").value;

  if (!planId || !newReceiver) return alert("Enter Plan ID & New Receiver");

  const chainKey = blockchainSelect.value;
  const contract = new ethers.Contract(
    CONTRACTS[chainKey].emi,
    rawContractABI,
    signer,
  );

  try {
    const tx = await contract.updateReceiver(planId, newReceiver);
    await tx.wait();
    alert(`✅ Receiver updated for Plan #${planId}`);
  } catch (err) {
    alert("Update failed: " + (err.reason || err.message));
  }
};

/* =========================================================
   CREATE EMI PLAN (Raw Bytes Compatible)
========================================================= */
document.getElementById("createPlanBtn").onclick = async () => {
  if (!signer) return alert("Connect MetaMask first");

  const chainKey = blockchainSelect.value;
  if (!chainKey) return alert("Select blockchain");

  const emiInput = document.getElementById("emiAmount").value;
  const totalInput = document.getElementById("totalAmount").value;

  if (!emiInput || !totalInput) return alert("Enter EMI & Total amounts");

  // USDT = 6 decimals
  const emi = ethers.utils.parseUnits(emiInput, 6);
  const total = ethers.utils.parseUnits(totalInput, 6);

  let intervalSeconds =
    intervalSelect.value === "custom"
      ? Number(customIntervalInput.value) * 60
      : Number(intervalSelect.value);

  if (intervalSeconds < 60) return alert("Minimum 60 seconds interval");

  const contract = new ethers.Contract(
    CONTRACTS[chainKey].emi,
    rawContractABI,
    signer,
  );

  try {
    const tx = await contract.createPlan(emi, intervalSeconds, total);
    const receipt = await tx.wait();

    // Parse PlanCreated event manually (minimal ABI)
    const iface = new ethers.utils.Interface(rawContractABI);
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
    if (!planId) throw new Error("Plan ID not found");

    // 🔥 GENERATE PAYMENT LINKS (Raw Bytes Compatible)
    const senderUrl = `${window.location.origin}/sender.html?planId=${planId}&chainId=${CONTRACTS[chainKey].chainId}`;

    document.getElementById("metamaskLinkOutput").value = senderUrl;
    document.getElementById("trustwalletLinkOutput").value = senderUrl;

    // Generate QR Codes
    QRCode.toCanvas(document.getElementById("qrCanvasMetamask"), senderUrl, {
      width: 220,
    });
    QRCode.toCanvas(document.getElementById("qrCanvasTrust"), senderUrl, {
      width: 220,
    });

    document.getElementById("shareSection").style.display = "block";
    alert(`✅ Plan #${planId} created! Share payment link`);
  } catch (err) {
    console.error(err);
    alert("Create failed: " + (err.reason || err.message));
  }
};

/* =========================================================
   AUTO-CONNECT + EVENTS
========================================================= */
window.addEventListener("load", autoReconnect);

if (window.ethereum) {
  window.ethereum.on("chainChanged", syncNetwork);
  window.ethereum.on("accountsChanged", () => window.location.reload());
}

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
