
import { AppConfig } from "./config.js";
import { contractABI } from "./abi.js";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm";

/* =========================================================
   SAFE DOM HELPERS (CRITICAL FIX)
========================================================= */
function $(id) {
  return document.getElementById(id);
}

function safeSetValue(id, value) {
  const el = $(id);
  if (el) el.value = value;
}

function safeSetText(id, text) {
  const el = $(id);
  if (el) el.innerText = text;
}

function safeShow(id) {
  const el = $(id);
  if (el) el.style.display = "block";
}

function safeOnClick(id, handler) {
  const el = $(id);
  if (el) el.onclick = handler;
}

/* =========================================================
   GLOBAL STATE
========================================================= */
let provider;
let signer;
let receiverAddress;
let currentChainId;

let originalMetaMaskLink = null;
let originalTrustWalletLink = null;
let originalUniversalLink = null;

/* =========================================================
   UI ELEMENTS (SAFE ACCESS)
========================================================= */
const connectBtn = $("connectWalletBtn");
const disconnectBtn = $("disconnectWalletBtn");
const accountDisplay = $("account");
const networkDisplay = $("network");

const blockchainSelect = $("blockchainSelect");
const tokenSelect = $("tokenSelect");
const tokenAddressDisplay = $("tokenAddressDisplay");

const intervalSelect = $("intervalSelect");
const customIntervalInput = $("customInterval");
const modifyReceiverBtn = $("modifyReceiverBtn");

/* =========================================================
   SHORT LINK
========================================================= */
async function shrinkLink(longUrl) {
  const res = await fetch(
    `https://api.shrtco.de/v2/shorten?url=${encodeURIComponent(longUrl)}`
  );
  if (!res.ok) throw new Error("Shortener failed");
  const data = await res.json();
  if (!data.ok) throw new Error("Shortening failed");
  return data.result.full_short_link;
}

/* =========================================================
   NETWORK HELPERS
========================================================= */
function getNetworkLabel(chainId) {
  if (chainId === 1) return "Ethereum Mainnet";
  if (chainId === 11155111) return "Sepolia Testnet";
  return `Unknown (${chainId})`;
}

function getBlockchainKeyByChainId(chainId) {
  return Object.keys(AppConfig.CHAINS).find(
    (k) => AppConfig.CHAINS[k][AppConfig.ENV].chainId === chainId
  );
}

/* =========================================================
   SYNC NETWORK
========================================================= */
async function syncNetwork() {
  const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
  currentChainId = Number(chainIdHex);

  safeSetText("network", `Network: ${getNetworkLabel(currentChainId)}`);

  const chainKey = getBlockchainKeyByChainId(currentChainId);
  if (!chainKey) {
    alert("Unsupported network");
    return;
  }

  blockchainSelect.value = chainKey;
  populateTokens();
}

/* =========================================================
   WALLET CONNECTION
========================================================= */
async function connectWallet() {
  if (!window.ethereum) return alert("Wallet required");

  provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  await provider.send("eth_requestAccounts", []);

  signer = provider.getSigner();
  receiverAddress = await signer.getAddress();
  localStorage.setItem("walletConnected", "true");

  safeSetText("account", `Wallet: ${receiverAddress}`);
  await syncNetwork();

  if (connectBtn) connectBtn.style.display = "none";
  if (disconnectBtn) disconnectBtn.style.display = "inline-block";
}

async function autoReconnect() {
  if (localStorage.getItem("walletConnected") !== "true") return;
  if (!window.ethereum) return;

  provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  const accounts = await provider.listAccounts();

  if (accounts.length) {
    signer = provider.getSigner();
    receiverAddress = accounts[0];
    safeSetText("account", `Wallet: ${receiverAddress}`);
    await syncNetwork();
  }
}

function disconnectWallet() {
  localStorage.removeItem("walletConnected");
  window.location.reload();
}

safeOnClick("connectWalletBtn", connectWallet);
safeOnClick("disconnectWalletBtn", disconnectWallet);

/* =========================================================
   TOKEN DROPDOWNS
========================================================= */
Object.entries(AppConfig.CHAINS).forEach(([key, cfg]) => {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = cfg.name;
  blockchainSelect.appendChild(opt);
});

function populateTokens() {
  tokenSelect.innerHTML = "";
  tokenAddressDisplay.value = "";

  const tokens = AppConfig.getTokens(blockchainSelect.value);
  if (!tokens) return;

  Object.entries(tokens).forEach(([symbol, addr]) => {
    const opt = document.createElement("option");
    opt.value = addr;
    opt.textContent = symbol;
    tokenSelect.appendChild(opt);
  });

  tokenAddressDisplay.value = tokenSelect.value || "";
}

blockchainSelect?.addEventListener("change", populateTokens);
tokenSelect?.addEventListener("change", () => {
  tokenAddressDisplay.value = tokenSelect.value || "";
});

/* =========================================================
   DEEP LINK GENERATION
========================================================= */
function generateDeepLinks(planId, chainId) {
  const base = `${location.origin}/sender.html?planId=${planId}&chainId=${chainId}`;

  return {
    universal: base,
    metaMask: `https://metamask.app.link/dapp/${location.host}/sender.html?planId=${planId}&chainId=${chainId}`,
    trustWallet: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(
      base
    )}`,
  };
}

/* =========================================================
   CREATE PLAN
========================================================= */
safeOnClick("createPlanBtn", async () => {
  if (!signer) return alert("Connect wallet");

  const emi = $("emiAmount").value;
  const total = $("totalAmount").value;
  if (!emi || !total) return alert("Missing amounts");

  const intervalSeconds =
    intervalSelect.value === "custom"
      ? Number(customIntervalInput.value) * 60
      : Number(intervalSelect.value);

  const tokenSymbol = tokenSelect.options[tokenSelect.selectedIndex].text;
  const meta = AppConfig.getTokenMeta(blockchainSelect.value, tokenSymbol);

  const contract = new ethers.Contract(
    AppConfig.getEmiContract(blockchainSelect.value),
    contractABI,
    signer
  );

  const tx = await contract.createPlan(
    ethers.utils.parseUnits(emi, meta.decimals),
    intervalSeconds,
    ethers.utils.parseUnits(total, meta.decimals)
  );

  const receipt = await tx.wait();
  const event = receipt.events.find((e) => e.event === "PlanCreated");
  const planId = event.args.planId.toString();

  const links = generateDeepLinks(planId, currentChainId);

  originalUniversalLink = links.universal;
  originalMetaMaskLink = links.metaMask;
  originalTrustWalletLink = links.trustWallet;

  safeSetValue("metamaskLinkOutput", links.metaMask);
  safeSetValue("trustwalletLinkOutput", links.trustWallet);

  renderQR(links.universal);
  safeShow("shareSection");
});

/* =========================================================
   QR
========================================================= */
function renderQR(text) {
  const canvas = $("qrCanvas");
  if (!canvas) return;
  QRCode.toCanvas(canvas, text, { width: 240 });
}

/* =========================================================
   SHRINK + COPY
========================================================= */
safeOnClick("copyLinkBtnMetamask", () =>
  navigator.clipboard.writeText($("metamaskLinkOutput").value)
);

safeOnClick("copyLinkBtnTrustwallet", () =>
  navigator.clipboard.writeText($("trustwalletLinkOutput").value)
);

safeOnClick("shrinkLinkBtnMetamask", async () => {
  const input = $("metamaskLinkOutput");
  if (!input?.value) return;
  input.value = await shrinkLink(originalMetaMaskLink || input.value);
});

safeOnClick("shrinkLinkBtnTrustwallet", async () => {
  const input = $("trustwalletLinkOutput");
  if (!input?.value) return;
  input.value = await shrinkLink(originalTrustWalletLink || input.value);
});

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", autoReconnect);



































// import { AppConfig } from "./config.js";
// import { contractABI } from "./abi.js";
// import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm";

// /* =========================================================
//    SAFE DOM HELPERS (CRITICAL FIX)
// ========================================================= */
// function $(id) {
//   return document.getElementById(id);
// }

// function safeSetValue(id, value) {
//   const el = $(id);
//   if (el) el.value = value;
// }

// function safeSetText(id, text) {
//   const el = $(id);
//   if (el) el.innerText = text;
// }

// function safeShow(id) {
//   const el = $(id);
//   if (el) el.style.display = "block";
// }

// function safeOnClick(id, handler) {
//   const el = $(id);
//   if (el) el.onclick = handler;
// }

// /* =========================================================
//    GLOBAL STATE
// ========================================================= */
// let provider;
// let signer;
// let receiverAddress;
// let currentChainId;

// /* =========================================================
//    WALLET-SPECIFIC DEEP LINK STORAGE
// ========================================================= */
// let originalMetaMaskLink = null;
// let originalTrustWalletLink = null;
// let originalUniversalLink = null;
// /* =========================================================
//    UI ELEMENTS
// ========================================================= */
// const connectBtn = $("connectWalletBtn");
// const disconnectBtn = $("disconnectWalletBtn");
// const accountDisplay = $("account");
// const networkDisplay = $("network");

// const blockchainSelect = $("blockchainSelect");
// const tokenSelect = $("tokenSelect");
// const tokenAddressDisplay = $("tokenAddressDisplay");

// const intervalSelect = $("intervalSelect");
// const customIntervalInput = $("customInterval");
// const modifyReceiverBtn = $("modifyReceiverBtn");



// /* =========================================================
//    SHRINK LINK FUNCTIONALITY
// ========================================================= */
// async function shrinkLink(longUrl) {
//   const res = await fetch(
//     `https://api.shrtco.de/v2/shorten?url=${encodeURIComponent(longUrl)}`
//   );

//   if (!res.ok) {
//     throw new Error("Shortener API failed");
//   }

//   const data = await res.json();

//   if (!data.ok) {
//     throw new Error("Shortening failed");
//   }

//   return data.result.full_short_link;
// }

// function copyTextById(id) {
//   const el = document.getElementById(id);
//   el.select();
//   el.setSelectionRange(0, 99999);
//   navigator.clipboard.writeText(el.value);
//   alert("📋 Link copied!");
// }

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
//  safeSetText("network", `Network: ${getNetworkLabel(currentChainId)}`);

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
//     alert("MetaMask or compatible wallet required");
//     return;
//   }

//   provider = new ethers.providers.Web3Provider(window.ethereum, "any");
//   await provider.send("eth_requestAccounts", []);

//   signer = provider.getSigner();
//   receiverAddress = await signer.getAddress();
//   localStorage.setItem("walletConnected", "true");
//  safeSetText("account", `Wallet: ${receiverAddress}`);

//   await new Promise((res) => setTimeout(res, 200));
//   await syncNetwork();

//   connectBtn.style.display = "none";
//   disconnectBtn.style.display = "inline-block";
// }

// async function autoReconnect() {
//   if (localStorage.getItem("walletConnected") !== "true") return;
//   if (!window.ethereum) return;

//   provider = new ethers.providers.Web3Provider(window.ethereum, "any");
//   const accounts = await provider.listAccounts();

//   if (accounts.length > 0) {
//     signer = provider.getSigner();
//     receiverAddress = accounts[0];
// safeSetText("account", `Wallet: ${receiverAddress}`);
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
//    GENERATE WALLET-SPECIFIC DEEP LINKS
// ========================================================= */
// function generateDeepLinks(planId, chainId) {
//   const host = window.location.origin;
//   const senderPath = `/sender.html?planId=${planId}&chainId=${chainId}`;

//   // Universal link (for QR code and general use)
//   const universalLink = `${host}${senderPath}`;

//   // MetaMask Deep Link
//   const metaMaskLink = `https://metamask.app.link/dapp/${host.replace(
//     "https://",
//     ""
//   )}${senderPath}`;

//   // TrustWallet Deep Link
//   const trustWalletLink = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(
//     universalLink
//   )}`;

//   return {
//     universal: universalLink,
//     metaMask: metaMaskLink,
//     trustWallet: trustWalletLink,
//   };
// }

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
//      GENERATE ALL WALLET-SPECIFIC LINKS
//   ===================================================== */
//   const links = generateDeepLinks(planId, currentChainId);

//   // Store original links
//   originalUniversalLink = links.universal;
//   originalMetaMaskLink = links.metaMask;
//   originalTrustWalletLink = links.trustWallet;

//   // Display MetaMask link by default
//   document.getElementById("metamaskLinkOutput").value = links.metaMask;
//   document.getElementById("trustwalletLinkOutput").value = links.trustWallet;

//   // Generate QR for universal link
//   renderQR(links.universal);

//   // Show share section
//   document.getElementById("shareSection").style.display = "block";

//   // Reset shrink status
//   document.getElementById("shrinkStatusMetamask").innerText = "";
//   document.getElementById("shrinkStatusTrustwallet").innerText = "";
// };

// /* =========================================================
//    QR CODE GENERATION
// ========================================================= */
// function renderQR(text) {
//   const canvas = document.getElementById("qrCanvas");
//   QRCode.toCanvas(canvas, text, { width: 240 }, (err) => {
//     if (err) console.error(err);
//   });
// }

// /* =========================================================
//    DOWNLOAD QR CODE
// ========================================================= */
// window.downloadQR = function () {
//   const canvas = document.getElementById("qrCanvas");
//   const url = canvas.toDataURL("image/png");
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = "emi-payment-qr.png";
//   a.click();
// };

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

// /* =========================================================
//    BUTTON HANDLERS FOR METAMASK
// ========================================================= */
// const shrinkBtnMetamask = document.getElementById("shrinkLinkBtnMetamask");
// const copyBtnMetamask = document.getElementById("copyLinkBtnMetamask");
// const statusTextMetamask = document.getElementById("shrinkStatusMetamask");

// copyBtnMetamask.onclick = () => copyTextById("metamaskLinkOutput");

// shrinkBtnMetamask.onclick = async () => {
//   const input = document.getElementById("metamaskLinkOutput");

//   if (!input.value) return;

//   try {
//     statusTextMetamask.innerText = "🔄 Shrinking link...";
//     shrinkBtnMetamask.disabled = true;

//     // Use original link if already shortened
//     const linkToShrink = originalMetaMaskLink || input.value;
//     const shortUrl = await shrinkLink(linkToShrink);
//     input.value = shortUrl;

//     statusTextMetamask.innerText = "✅ Link shortened";
//   } catch (err) {
//     console.error(err);
//     statusTextMetamask.innerText = "❌ Failed to shrink link";
//   } finally {
//     shrinkBtnMetamask.disabled = false;
//   }
// };

// /* =========================================================
//    BUTTON HANDLERS FOR TRUSTWALLET
// ========================================================= */
// const shrinkBtnTrustwallet = document.getElementById(
//   "shrinkLinkBtnTrustwallet"
// );
// const copyBtnTrustwallet = document.getElementById("copyLinkBtnTrustwallet");
// const statusTextTrustwallet = document.getElementById(
//   "shrinkStatusTrustwallet"
// );

// copyBtnTrustwallet.onclick = () => copyTextById("trustwalletLinkOutput");

// shrinkBtnTrustwallet.onclick = async () => {
//   const input = document.getElementById("trustwalletLinkOutput");

//   if (!input.value) return;

//   try {
//     statusTextTrustwallet.innerText = "🔄 Shrinking link...";
//     shrinkBtnTrustwallet.disabled = true;

//     // Use original link if already shortened
//     const linkToShrink = originalTrustWalletLink || input.value;
//     const shortUrl = await shrinkLink(linkToShrink);
//     input.value = shortUrl;

//     statusTextTrustwallet.innerText = "✅ Link shortened";
//   } catch (err) {
//     console.error(err);
//     statusTextTrustwallet.innerText = "❌ Failed to shrink link";
//   } finally {
//     shrinkBtnTrustwallet.disabled = false;
//   }
// };
