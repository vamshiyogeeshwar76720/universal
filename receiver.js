
import { AppConfig } from "./config.js";
import { contractABI } from "./abi.js";

import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm";


//   GLOBAL STATE

let provider;
let signer;
let receiverAddress;
let currentChainId;

//   UI ELEMENTS

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

// NETWORK HELPERS

function getNetworkLabel(chainId) {
  if (chainId === 1) return "Ethereum Mainnet";
  if (chainId === 11155111) return "Sepolia Testnet";
  return `Unknown (${chainId})`;
}

function getBlockchainKeyByChainId(chainId) {
  return Object.keys(AppConfig.CHAINS).find(
    (key) => AppConfig.CHAINS[key][AppConfig.ENV].chainId === chainId
  );
}


// SYNC NETWORK (SOURCE OF TRUTH)

async function syncNetwork() {
  const chainIdHex = await window.ethereum.request({
    method: "eth_chainId",
  });

  currentChainId = Number(chainIdHex);
  networkDisplay.innerText = `Network: ${getNetworkLabel(currentChainId)}`;

  const chainKey = getBlockchainKeyByChainId(currentChainId);

  if (!chainKey) {
    alert("Unsupported network. Please switch wallet network.");
    return;
  }

  blockchainSelect.value = chainKey;
  populateTokens();

  console.log("✅ Connected chain:", currentChainId, chainKey);
}

// WALLET CONNECTION

async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask required");
    return;
  }

  provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  await provider.send("eth_requestAccounts", []);

  signer = provider.getSigner();
  receiverAddress = await signer.getAddress();
  localStorage.setItem("walletConnected", "true");
  accountDisplay.innerText = `Wallet: ${receiverAddress}`;


  await new Promise((res) => setTimeout(res, 200));
  await syncNetwork();

  connectBtn.style.display = "none";
  disconnectBtn.style.display = "inline-block";
  await syncNetwork();
}

async function autoReconnect() {
  if (localStorage.getItem("walletConnected") !== "true") return;
  if (!window.ethereum) return;

  provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  const accounts = await provider.listAccounts();

  if (accounts.length > 0) {
    signer = provider.getSigner();
    receiverAddress = accounts[0];

    accountDisplay.innerText = `Wallet: ${receiverAddress}`;
    connectBtn.style.display = "none";
    disconnectBtn.style.display = "inline-block";

    await syncNetwork();
  }
}

function disconnectWallet() {
  provider = null;
  signer = null;
  receiverAddress = null;
  localStorage.removeItem("walletConnected");
  accountDisplay.innerText = "";
  networkDisplay.innerText = "";

  connectBtn.style.display = "inline-block";
  disconnectBtn.style.display = "none";
}

connectBtn.onclick = connectWallet;
disconnectBtn.onclick = disconnectWallet;



// AUTO CONNECT ON LOAD
window.addEventListener("load", autoReconnect);

//CHAIN & TOKEN DROPDOWNS

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

  Object.entries(tokens).forEach(([symbol, address]) => {
    const opt = document.createElement("option");
    opt.value = address;
    opt.textContent = symbol;
    tokenSelect.appendChild(opt);
  });

  tokenAddressDisplay.value = tokenSelect.value || "";
}

blockchainSelect.addEventListener("change", populateTokens);
tokenSelect.addEventListener("change", () => {
  tokenAddressDisplay.value = tokenSelect.value || "";
});


//   INTERVAL HANDLING
intervalSelect.addEventListener("change", () => {
  customIntervalInput.style.display =
    intervalSelect.value === "custom" ? "block" : "none";
});


//   CREATE EMI PLAN

document.getElementById("createPlanBtn").onclick = async () => {
  if (!signer) return alert("Connect MetaMask");

  const blockchain = blockchainSelect.value;
  const tokenSymbol = tokenSelect.options[tokenSelect.selectedIndex]?.text;

  const emiInput = document.getElementById("emiAmount").value;
  const totalInput = document.getElementById("totalAmount").value;

  if (!emiInput || !totalInput) {
    return alert("EMI & Total required");
  }

  const tokenMeta = AppConfig.getTokenMeta(blockchain, tokenSymbol);
  if (!tokenMeta) return alert("Token metadata missing");

  let intervalSeconds =
    intervalSelect.value === "custom"
      ? Number(customIntervalInput.value) * 60
      : Number(intervalSelect.value);

  if (intervalSeconds < 60) return alert("Minimum 60 seconds");

  const emi = ethers.utils.parseUnits(emiInput, tokenMeta.decimals);
  const total = ethers.utils.parseUnits(totalInput, tokenMeta.decimals);

  const contract = new ethers.Contract(
    AppConfig.getEmiContract(blockchain),
    contractABI,
    signer
  );

  let planId;

  try {
    const tx = await contract.createPlan(emi, intervalSeconds, total);
    const receipt = await tx.wait(1);

    const event = receipt.events?.find(
      (e) => e.event === "PlanCreated" && e.args?.planId
    );

    if (!event) throw new Error("PlanCreated missing");

    planId = event.args.planId.toString();
  } catch (err) {
    console.error(err);
    alert(err.reason || err.message || "Create plan failed");
    return;
  }

  
  //   DEEPLINK + QR

  const host = window.location.origin.replace("https://", "");
  const senderUrl = `${window.location.origin}/sender.html?planId=${planId}&chainId=${currentChainId}`;

  // MetaMask deep link (EXACT same as before)
  const metamaskLink =
    `https://metamask.app.link/dapp/${host}` +
    `/sender.html?planId=${planId}&chainId=${currentChainId}`;

  // Trust Wallet deep link
  const trustWalletLink =
    `https://link.trustwallet.com/open_url` +
    `?coin_id=60` +
    `&url=${encodeURIComponent(senderUrl)}`;

  // Set outputs
  document.getElementById("metamaskLinkOutput").value = metamaskLink;
  document.getElementById("trustwalletLinkOutput").value = trustWalletLink;


  // 🔥 Generate wallet-specific QR codes
  renderWalletQR(metamaskLink, trustWalletLink);

  document.getElementById("shareSection").style.display = "block";
};
/* =========================================================
   QR
========================================================= */
function renderWalletQR(metamaskLink, trustWalletLink) {
  const mmCanvas = document.getElementById("qrCanvasMetamask");
  const twCanvas = document.getElementById("qrCanvasTrust");

  QRCode.toCanvas(mmCanvas, metamaskLink, { width: 220 }, (err) => {
    if (err) console.error("MetaMask QR error:", err);
  });

  QRCode.toCanvas(twCanvas, trustWalletLink, { width: 220 }, (err) => {
    if (err) console.error("Trust Wallet QR error:", err);
  });
}


//   METAMASK EVENTS

if (window.ethereum) {
  window.ethereum.on("chainChanged", async () => {
    await syncNetwork();
  });

  window.ethereum.on("accountsChanged", () => {
    window.location.reload();
  });
}
