// 🔥 1-CLICK ETH EMI Activation
// 🔥 MOBILE-WALLET PROOF sender.js - No White Screen!
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";

const NETWORK_CONFIG = {
  sepolia: {
    chainId: 11155111,
    emiContract: "0xEb0D024185187f1f7e6daBd6a293157D6318cf5E",
  },
};

const ETH_ABI = [
  "function plans(uint256) view returns (address,address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function activatePlan(uint256) external payable",
  "function planCount() view returns (uint256)",
];

const urlParams = Object.fromEntries(new URLSearchParams(window.location.search));
const planId = urlParams.planId;
const chainIdParam = urlParams.chainId;

if (!planId) {
  document.getElementById("status").innerText = "❌ Invalid Plan ID";
  throw new Error("No planId in URL");
}

let provider, signer, contract, plan;
let isConnected = false;

// 🔥 MOBILE WALLET POLLING (Fixes white screen)
async function detectWallet() {
  const statusEl = document.getElementById("status");
  statusEl.innerText = "🔄 Waiting for wallet...";
  
  // Try multiple wallet providers
  const providers = ['ethereum', 'webkitEthereum', 'trustwallet'];
  
  for (let i = 0; i < 30; i++) { // 15 seconds max
    for (const providerName of providers) {
      if (window[providerName]) {
        provider = new ethers.providers.Web3Provider(window[providerName], "any");
        try {
          await provider.send("eth_requestAccounts", []);
          signer = provider.getSigner();
          isConnected = true;
          statusEl.innerText = "✅ Wallet connected!";
          return true;
        } catch (e) {
          console.log("Provider ready, but no accounts:", providerName);
        }
      }
    }
    await new Promise(r => setTimeout(r, 500)); // Poll every 500ms
  }
  
  statusEl.innerText = "❌ No wallet detected. Please refresh.";
  return false;
}

// 🔥 STEP-BY-STEP INIT
async function init() {
  try {
    const connectBtn = document.getElementById("connectBtn");
    connectBtn.onclick = async () => {
      connectBtn.disabled = true;
      connectBtn.innerText = "⏳ Connecting...";
      
      const hasWallet = await detectWallet();
      if (!hasWallet) {
        alert("No wallet found. Please install MetaMask or Trust Wallet.");
        connectBtn.disabled = false;
        connectBtn.innerText = "🔗 Connect Wallet";
        return;
      }

      await switchNetwork();
      await loadPlan();
      connectBtn.style.display = "none";
    };
  } catch (error) {
    console.error("Init failed:", error);
    document.getElementById("status").innerText = "❌ Setup failed";
  }
}

async function switchNetwork() {
  const config = NETWORK_CONFIG.sepolia;
  const currentChain = await provider.getNetwork();
  
  if (currentChain.chainId !== config.chainId) {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0xaa36a` }], // Sepolia
    });
  }
}

async function loadPlan() {
  const config = NETWORK_CONFIG.sepolia;
  contract = new ethers.Contract(config.emiContract, ETH_ABI, signer);
  
  const planIdBN = ethers.BigNumber.from(planId);
  plan = await contract.plans(planIdBN);
  
  console.table({
    planId,
    emi: ethers.utils.formatEther(plan.emi),
    total: ethers.utils.formatEther(plan.total),
    receiver: plan.receiver,
    active: plan.active,
  });

  if (plan.receiver === ethers.constants.AddressZero) {
    throw new Error("❌ Plan doesn't exist");
  }
  if (plan.active) {
    throw new Error("❌ Plan already active");
  }

  showPlan(plan);
  createETHButton();
}

function showPlan(plan) {
  document.getElementById("planInfo").innerHTML = `
    ✅ <strong>ETH Plan #${planId}</strong><br>
    💰 EMI: ${ethers.utils.formatEther(plan.emi)} ETH<br>
    💎 Total: ${ethers.utils.formatEther(plan.total)} ETH<br>
    👤 Receiver: ${plan.receiver.slice(0,6)}...${plan.receiver.slice(-4)}<br>
    <small style="color:#059669">✓ Ready for ETH payment ✓</small>
  `;
}

function createETHButton() {
  const btn = document.createElement("button");
  btn.innerText = `🚀 ACTIVATE (${ethers.utils.formatEther(plan.emi)} ETH)`;
  btn.className = "primary";
  btn.onclick = activateETHPlan;
  document.getElementById("planInfo").appendChild(btn);
}

async function activateETHPlan() {
  const btn = event.target;
  btn.disabled = true;
  btn.innerText = "⏳ Sending ETH...";

  try {
    const tx = await contract.activatePlan(ethers.BigNumber.from(planId), {
      value: plan.emi,
      gasLimit: 300000,
    });

    btn.innerText = "✅ Confirming...";
    const receipt = await tx.wait();

    showSuccess(receipt.transactionHash);
  } catch (error) {
    console.error("ETH payment failed:", error);
    const errorMsg = error.reason || error.message || "Transaction failed";
    alert("❌ " + errorMsg);
    btn.disabled = false;
    btn.innerText = `🚀 ACTIVATE (${ethers.utils.formatEther(plan.emi)} ETH)`;
  }
}

function showSuccess(txHash) {
  document.body.innerHTML = `
    <div style="text-align:center; padding:60px; max-width:400px; margin:auto;">
      <div style="font-size:100px; color:#10b981;">✅</div>
      <h1>ETH EMI ACTIVATED!</h1>
      <p><strong>Plan #${planId}</strong> is LIVE 🚀</p>
      <p style="word-break:break-all;">
        Tx: <a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank">${txHash.slice(0,12)}...</a>
      </p>
      <button onclick="window.close()" class="success" style="padding:15px 30px;">Close</button>
    </div>
  `;
}

// 🔥 START ON LOAD
window.addEventListener("load", init);


  
//raw bytes code without IERC20+permit2
// 🔥 FINAL FIXED sender.js - EMI STARTS SUCCESSFULLY!
// 🔥 PRODUCTION sender.js - 100% Working EMI Activation
// import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";

// const NETWORK_CONFIG = {
//   sepolia: {
//     chainId: 11155111,
//     emiContract: "0x41C7e6A42d46bA5DEa72a20d3954164A6C56315b",
//     tokens: { USDT: { address: "0xFa7Ea86672d261A0A0bfDba22A9F7D2A75581320", decimals: 6 } }
//   }
// };

// // 🔥 EXACT ABI - Matches YOUR contract return types
// const ABI = [
//   "function plans(uint256) view returns (address sender, address receiver, uint256 emi, uint256 interval, uint256 total, uint256 paid, uint256 nextPay, bool active)",
//   "function activatePlan(uint256 planId, uint256 activationAmount) external"
// ];

// const { planId } = Object.fromEntries(new URLSearchParams(window.location.search));
// let provider, signer, contract, plan;

// async function init() {
//   document.getElementById("planInfo").textContent = "🔄 Connecting...";

//   provider = new ethers.providers.Web3Provider(window.ethereum);
//   await provider.send("eth_requestAccounts", []);
//   signer = provider.getSigner();

//   const config = NETWORK_CONFIG.sepolia;
//   contract = new ethers.Contract(config.emiContract, ABI, signer);

//   // Verify network
//   if ((await provider.getNetwork()).chainId !== config.chainId) {
//     await window.ethereum.request({
//       method: "wallet_switchEthereumChain",
//       params: [{ chainId: `0xaa36a` }]
//     });
//   }

//   // 🔥 CRITICAL: Load + VALIDATE plan FIRST
//   plan = await validatePlan(planId);
//   showPlan(plan);

//   createApproveButton();
// }

// async function validatePlan(planId) {
//   const planIdBN = ethers.BigNumber.from(planId);
//   const plan = await contract.plans(planIdBN);

//   console.table({
//     planId: planIdBN.toString(),
//     sender: plan.sender,
//     receiver: plan.receiver,
//     emi: ethers.utils.formatUnits(plan.emi, 6),
//     active: plan.active
//   });

//   // 🔥 VALIDATION CHECKS (MUST PASS)
//   if (plan.receiver === ethers.constants.AddressZero)
//     throw new Error("❌ Plan doesn't exist");
//   if (plan.active) throw new Error("❌ Plan already active");
//   if (plan.sender.toLowerCase() !== (await signer.getAddress()).toLowerCase())
//     throw new Error("❌ Not plan owner");

//   return plan;
// }

// function showPlan(plan) {
//   document.getElementById("planInfo").innerHTML = `
//     ✅ <strong>Plan #${planId}</strong><br>
//     💰 EMI: ${ethers.utils.formatUnits(plan.emi, 6)} USDT<br>
//     💎 Total: ${ethers.utils.formatUnits(plan.total, 6)} USDT<br>
//     👤 Receiver: ${plan.receiver.slice(0,6)}...${plan.receiver.slice(-4)}<br>
//     <small style="color:green">✓ Valid plan ✓ Creator ✓ Inactive</small>
//   `;
// }

// function createApproveButton() {
//   const btn = document.createElement("button");
//   btn.id = "approveBtn";
//   btn.innerText = "1️⃣ APPROVE USDT";
//   btn.style.cssText = `
//     width:100%; padding:15px; margin:10px 0;
//     background:linear-gradient(45deg,#ff6b35,#f7931a);
//     color:white; border:none; border-radius:12px; font-size:16px; font-weight:600;
//   `;
//   btn.onclick = approveAndActivate;
//   document.body.insertBefore(btn, document.getElementById("payBtn"));
// }

// async function approveAndActivate() {
//   const approveBtn = document.getElementById("approveBtn");
//   approveBtn.disabled = true;
//   approveBtn.innerText = "⏳ Step 1/2: Approving...";

//   try {
//     // 1️⃣ APPROVE (1 USDT minimum for safety)
//     const config = NETWORK_CONFIG.sepolia;
//     const token = new ethers.Contract(config.tokens.USDT.address,
//       ["function approve(address,uint256) external"], signer);

//     const approveTx = await token.approve(config.emiContract, ethers.utils.parseUnits("1000", 6));
//     await approveTx.wait();

//     approveBtn.innerText = "✅ Approved! Step 2/2: Activating...";

//     // 2️⃣ ACTIVATE (0 downpayment)
//     const activateTx = await contract.activatePlan(
//       ethers.BigNumber.from(planId),
//       0, // 🔥 ZERO downpayment
//       { gasLimit: 800000 }
//     );

//     approveBtn.innerText = "🎉 Finalizing...";
//     const receipt = await activateTx.wait();

//     showSuccess(receipt.transactionHash);

//   } catch (error) {
//     console.error("Transaction failed:", error);
//     const reason = decodeRevertReason(error);
//     alert(`❌ Failed: ${reason}`);
//     approveBtn.disabled = false;
//     approveBtn.innerText = "1️⃣ APPROVE & START EMI";
//   }
// }

// function decodeRevertReason(error) {
//   if (!error.reason) return "Unknown contract error";

//   const reasons = {
//     "Plan does not exist": "Plan missing",
//     "Plan already active": "Already activated",
//     "Not plan creator": "Wrong account",
//     "Insufficient approval": "Approve USDT first",
//     "Insufficient balance": "No USDT balance"
//   };

//   for (const [key, msg] of Object.entries(reasons)) {
//     if (error.reason.includes(key)) return msg;
//   }

//   return error.reason;
// }

// function showSuccess(txHash) {
//   document.body.innerHTML = `
//     <div style="text-align:center; padding:40px; max-width:400px; margin:auto;">
//       <div style="font-size:80px; color:#28a745;">✅</div>
//       <h1>EMI Plan Activated!</h1>
//       <p><strong>Plan #${planId}</strong> is LIVE 🚀</p>
//       <p style="word-break:break-all;">
//         Tx: <a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank">${txHash.slice(0,10)}...</a>
//       </p>
//       <button onclick="window.close()" style="
//         padding:15px 30px; background:#6c757d; color:white;
//         border:none; border-radius:12px; font-size:16px; cursor:pointer;
//       ">Close</button>
//     </div>
//   `;
// }

// window.addEventListener("load", init);

// import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";
// import { contractABI } from "./abi.js";

// const CONTRACTS = {
//   sepolia: {
//     chainId: 11155111,
//     emi: "0x41C7e6A42d46bA5DEa72a20d3954164A6C56315b", // YOUR DEPLOYED CONTRACT
//     usdt: "0xFa7Ea86672d261A0A0bfDba22A9F7D2A75581320",
//   },
//   mainnet: {
//     chainId: 1,
//     emi: "0x7BAA6f2fFc568F1114A392557Bc3bCDe609bb795",
//     usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//   },
// };

// const params = new URLSearchParams(window.location.search);
// const planId = params.get("planId");
// const expectedChainId = Number(params.get("chainId"));

// if (!planId || !expectedChainId) {
//   alert("Invalid payment link");
//   throw new Error("Missing URL parameters");
// }

// let provider, signer, sender, chainKey, plan;

// // INIT (same)
// async function init() {
//   if (!window.ethereum) throw new Error("MetaMask required");

//   provider = new ethers.providers.Web3Provider(window.ethereum, "any");
//   await provider.send("eth_requestAccounts", []);
//   signer = provider.getSigner();
//   sender = await signer.getAddress();

//   const network = await provider.getNetwork();
//   chainKey = Object.keys(CONTRACTS).find(
//     (k) => CONTRACTS[k].chainId === expectedChainId,
//   );

//   if (!chainKey) throw new Error("Unsupported chain");

//   if (network.chainId !== expectedChainId) {
//     await window.ethereum.request({
//       method: "wallet_switchEthereumChain",
//       params: [{ chainId: ethers.utils.hexValue(expectedChainId) }],
//     });
//   }

//   plan = await loadPlan(planId);
//   document.getElementById(
//     "planInfo",
//   ).innerText = `EMI: ${ethers.utils.formatUnits(plan.emi, 6)} USDT`;
// }

// // TWO BUTTON APPROACH
// const approveBtn = document.getElementById("approveBtn") || createApproveBtn();
// const payBtn = document.getElementById("payBtn");

// function createApproveBtn() {
//   const btn = document.createElement("button");
//   btn.id = "approveBtn";
//   btn.innerText = "1️⃣ APPROVE USDT";
//   btn.style.display = "block";
//   btn.style.marginBottom = "10px";
//   document.querySelector("body").insertBefore(btn, payBtn);
//   return btn;
// }

// approveBtn.onclick = async () => {
//   try {
//     approveBtn.disabled = true;
//     approveBtn.innerText = "Approving...";

//     const emiAddress = CONTRACTS[chainKey].emi;
//     const usdtAddress = CONTRACTS[chainKey].usdt;

//     // 🔥 RAW ERC20 APPROVE (minimal ABI)
//     const usdtIface = new ethers.utils.Interface([
//       "function approve(address spender, uint256 amount) external returns (bool)",
//     ]);

//     const data = usdtIface.encodeFunctionData("approve", [
//       emiAddress,
//       ethers.constants.MaxUint256,
//     ]);
//     const tx = await signer.call({ to: usdtAddress, data });

//     const approveTx = await signer.sendTransaction({
//       to: usdtAddress,
//       data: data,
//     });

//     await approveTx.wait();

//     approveBtn.style.display = "none";
//     payBtn.disabled = false;
//     payBtn.innerText = "2️⃣ START EMI";
//     alert("✅ APPROVED! Now click START EMI");
//   } catch (err) {
//     approveBtn.disabled = false;
//     approveBtn.innerText = "1️⃣ APPROVE USDT";
//     alert("Approve failed: " + (err.reason || err.message));
//   }
// };

// payBtn.onclick = async () => {
//   try {
//     payBtn.disabled = true;
//     payBtn.innerText = "Activating...";

//     const emiAddress = CONTRACTS[chainKey].emi;
//     const contract = new ethers.Contract(emiAddress, contractABI, signer);

//     const activationInput = document.getElementById("activationAmount");
//     const activationAmount = ethers.utils.parseUnits(
//       activationInput?.value?.trim() || "0",
//       6,
//     );

//     // ✅ ONLY 2 PARAMS! (planId, activationAmount)
//     const tx = await contract.activatePlan(planId, activationAmount);
//     await tx.wait();

//     alert("✅ EMI ACTIVATED! Auto-payments working 🚀");
//   } catch (err) {
//     alert("Activation failed: " + (err.reason || err.message));
//     payBtn.disabled = false;
//     payBtn.innerText = "2️⃣ START EMI";
//   }
// };

// window.addEventListener("load", () => init().catch(console.error));
// async function loadPlan(planId) {
//   const contract = new ethers.Contract(
//     CONTRACTS[chainKey].emi,
//     contractABI,
//     provider,
//   );
//   const plan = await contract.plans(planId);
//   if (plan.receiver === ethers.constants.AddressZero)
//     throw new Error("Plan does not exist");
//   return plan;
// }

//IERC20 + permit2 code
// import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";
// import { contractABI } from "./abi.js";
// // import { mockedABI } from "./mockabi.js";
// /* =========================================================
//    CONFIG
// ========================================================= */

// const CONTRACTS = {
//   sepolia: {
//     chainId: 11155111,
//     emi: "0x3F359764D05434C894d238d81401Ae85E05c010a",
//     usdt: "0x9f1E5354f68e629D60408084760BE81e8C0eA570",
//   },

//   // ready for production
//   mainnet: {
//     chainId: 1,
//     emi: "0x7BAA6f2fFc568F1114A392557Bc3bCDe609bb795",
//     usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//   },
// };

// const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

// /* =========================================================
//    URL PARAMS
// ========================================================= */

// const params = new URLSearchParams(window.location.search);
// const planId = params.get("planId");
// const expectedChainId = Number(params.get("chainId"));

// if (!planId || !expectedChainId) {
//   alert("Invalid payment link");
//   throw new Error("Missing URL parameters");
// }

// /* =========================================================
//    GLOBALS
// ========================================================= */

// let provider;
// let signer;
// let sender;
// let chainKey;
// let plan;
// /* =========================================================
//    INIT
// ========================================================= */

// async function init() {
//   if (!window.ethereum) {
//     alert("MetaMask required");
//     throw new Error("No wallet");
//   }

//   provider = new ethers.providers.Web3Provider(window.ethereum, "any");
//   await provider.send("eth_requestAccounts", []);
//   signer = provider.getSigner();
//   sender = await signer.getAddress();

//   const network = await provider.getNetwork();

//   console.log("Wallet chain:", network.chainId);
//   console.log("Expected chain:", expectedChainId);

//   // find matching chainKey
//   chainKey = Object.keys(CONTRACTS).find(
//     (k) => CONTRACTS[k].chainId === expectedChainId,
//   );

//   if (!chainKey) {
//     alert("Unsupported chain in link");
//     throw new Error("Unsupported chain");
//   }

//   // auto switch chain if needed
//   if (network.chainId !== expectedChainId) {
//     await window.ethereum.request({
//       method: "wallet_switchEthereumChain",
//       params: [{ chainId: ethers.utils.hexValue(expectedChainId) }],
//     });
//   }
//   plan = await loadPlan(planId);
//   document.getElementById(
//     "planInfo",
//   ).innerText = `EMI: ${ethers.utils.formatUnits(plan.emi, 6)} USDT`;
//   console.log("Plan loaded:", plan);
// }

// async function loadPlan(planId) {
//   const contract = new ethers.Contract(
//     CONTRACTS[chainKey].emi,
//     contractABI,
//     provider,
//   );

//   const plan = await contract.plans(planId);

//   if (plan.receiver === ethers.constants.AddressZero) {
//     throw new Error("Plan does not exist");
//   }

//   return plan;
// }

// /* =========================================================
//    PAY BUTTON
// ========================================================= */
// const btn = document.getElementById("payBtn");
// btn.onclick = async (e) => {
//   e.preventDefault();
//   btn.disabled = true;

//   try {
//     const emiAddress = CONTRACTS[chainKey].emi;
//     const contract = new ethers.Contract(emiAddress, contractABI, signer);

//     console.log("Using chain:", chainKey);
//     console.log("EMI:", emiAddress);

//     //commented now
//     //     /* -------------------------------------------
//     //        STEP 1 — APPROVE PERMIT2 (ONE TIME)
//     //     -------------------------------------------- */
//     //     // const usdt = await contract.USDT();
//     //     // console.log("USDT from contract:", usdt);
//     //     // await usdtContract.approve(PERMIT2, ethers.constants.MaxUint256);

//     //     /* -------------------------------------------
//     //    STEP 1 — APPROVE PERMIT2 (ONE TIME)
//     // -------------------------------------------- */

//     //     const usdt = await contract.USDT();

//     //     const usdtContract = new ethers.Contract(
//     //       usdt,
//     //       [
//     //         "function approve(address,uint256) returns (bool)",
//     //         "function allowance(address,address) view returns (uint256)",
//     //         "function balanceOf(address) view returns (uint256)",
//     //       ],
//     //       // mockedABI,
//     //       signer
//     //     );

//     //     const balance = await usdtContract.balanceOf(sender);

//     //     // safety checks (recommended)
//     //     console.log("Wallet balance raw:", balance.toString());
//     //     console.log("Plan EMI raw:", plan.emi.toString());
//     //     console.log("Wallet balance USDT:", ethers.utils.formatUnits(balance, 6));
//     //     console.log("Plan EMI USDT:", ethers.utils.formatUnits(plan.emi, 6));

//     //     const allowance = await usdtContract.allowance(sender, PERMIT2);

//     //     if (allowance.lt(plan.emi)) {
//     //       console.log("Approving Permit2...");
//     //       const txApprove = await usdtContract.approve(
//     //         PERMIT2,
//     //         ethers.constants.MaxUint256
//     //       );
//     //       await txApprove.wait();
//     //     }

//     /* -------------------------------------------
//        STEP 2 — READ PERMIT2 NONCE
//     -------------------------------------------- */

//     // const permit2 = new ethers.Contract(
//     //   PERMIT2,
//     //   [
//     //     "function allowance(address,address,address) view returns (uint160,uint48,uint48)",
//     //   ],
//     //   provider,
//     // );
//     // const usdt = CONTRACTS[chainKey].usdt || (await contract.USDT());
//     // const [, , nonce] = await permit2.allowance(sender, usdt, emiAddress);

//     /* -------------------------------------------
//        STEP 3 — SIGN PERMIT2
//     -------------------------------------------- */

//     // console.log("Permit token:", usdt);
//     // console.log("Contract USDT:", await contract.USDT());

//     // const amount = ethers.utils.parseUnits("1000000", 6); // high cap
//     const activationInput = document.getElementById("activationAmount");
//     // // const amount = plan.emi;
//     // const deadline = Math.floor(Date.now() / 1000) + 31536000;
//     // const amountForPermit = plan.total;
//     // const permit = {
//     //   details: {
//     //     token: usdt,
//     //     amount: amountForPermit,
//     //     expiration: deadline,
//     //     nonce,
//     //   },
//     //   spender: emiAddress,
//     //   sigDeadline: deadline,
//     // };

//     const activationAmount = ethers.utils.parseUnits(
//       activationInput?.value?.trim() || "0",
//       6,
//     );

//     // console.log("Permit token:", permit.details.token);

//     // const domain = {
//     //   name: "Permit2",
//     //   chainId: expectedChainId,
//     //   verifyingContract: PERMIT2,
//     // };

//     // const types = {
//     //   PermitSingle: [
//     //     { name: "details", type: "PermitDetails" },
//     //     { name: "spender", type: "address" },
//     //     { name: "sigDeadline", type: "uint256" },
//     //   ],
//     //   PermitDetails: [
//     //     { name: "token", type: "address" },
//     //     { name: "amount", type: "uint160" },
//     //     { name: "expiration", type: "uint48" },
//     //     { name: "nonce", type: "uint48" },
//     //   ],
//     // };
//     // const signature = await signer._signTypedData(
//     //   { name: "Permit2", chainId: expectedChainId, verifyingContract: PERMIT2 },
//     //   {
//     //     PermitSingle: [
//     //       { name: "details", type: "PermitDetails" },
//     //       { name: "spender", type: "address" },
//     //       { name: "sigDeadline", type: "uint256" },
//     //     ],
//     //     PermitDetails: [
//     //       { name: "token", type: "address" },
//     //       { name: "amount", type: "uint160" },
//     //       { name: "expiration", type: "uint48" },
//     //       { name: "nonce", type: "uint48" },
//     //     ],
//     //   },
//     //   permit,
//     // );

//     /* -------------------------------------------
//        STEP 4 — ACTIVATE EMI
//     -------------------------------------------- */

//     const tx = await contract.activatePlanWithPermit2AndPay(
//       planId,
//       activationAmount, // ethers.utils.parseUnits("YOUR_DOWNPAYMENT", 6),
//       // permit,
//       // signature,
//     );

//     await tx.wait();

//     alert("✅ EMI Activated Successfully");
//   } catch (err) {
//     console.error(err);
//     alert(err.reason || err.message || "Transaction failed");
//     btn.disabled = false;
//   }
// };

// window.addEventListener("load", () => {
//   init().catch(console.error);
// });

// import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";
// import { contractABI } from "./abi.js";

// /* =========================================================
//    CONFIG
// ========================================================= */

// const CONTRACTS = {
//   sepolia: {
//     chainId: 11155111,
//     emi: "0xbd1d2CD20921aCA78FAc9958041261A74B630403",
//     usdt: "0x9d9832cBF3D2c5e4a59295f199E4fBF42CBA468b",
//   },

//   // ready for production
//   // mainnet: {
//   //   chainId: 1,
//   //   emi: "0xMAINNET_EMI_CONTRACT",
//   //   usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//   // },
// };

// const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

// /* =========================================================
//    URL PARAMS
// ========================================================= */

// const params = new URLSearchParams(window.location.search);
// const planId = params.get("planId");
// const expectedChainId = Number(params.get("chainId"));

// if (!planId || !expectedChainId) {
//   alert("Invalid payment link");
//   throw new Error("Missing URL parameters");
// }

// /* =========================================================
//    GLOBALS
// ========================================================= */

// let provider;
// let signer;
// let sender;
// let chainKey;
// let plan;

// const payBtn = document.getElementById("payBtn");
// payBtn.disabled = true;
// /* =========================================================
//    INIT
// ========================================================= */

// async function init() {
//   if (!window.ethereum) {
//     alert("MetaMask required");
//     throw new Error("No wallet");
//   }

//   provider = new ethers.providers.Web3Provider(window.ethereum, "any");
//   await provider.send("eth_requestAccounts", []);
//   signer = provider.getSigner();
//   sender = await signer.getAddress();

//   const network = await provider.getNetwork();

//   console.log("Wallet chain:", network.chainId);
//   console.log("Expected chain:", expectedChainId);

//   // find matching chainKey
//   chainKey = Object.keys(CONTRACTS).find(
//     (k) => CONTRACTS[k].chainId === expectedChainId
//   );

//   if (!chainKey) {
//     alert("Unsupported chain in link");
//     throw new Error("Unsupported chain");
//   }

//   // auto switch chain if needed
//   if (network.chainId !== expectedChainId) {
//     await window.ethereum.request({
//       method: "wallet_switchEthereumChain",
//       params: [{ chainId: ethers.utils.hexValue(expectedChainId) }],
//     });
//   }
//   plan = await loadPlan(planId);
//   document.getElementById(
//     "planInfo"
//   ).innerText = `EMI: ${ethers.utils.formatUnits(plan.emi, 6)} USDT`;
//   console.log("Plan loaded:", plan);
//   console.log("✅ Sender ready", { sender, plan });

//   payBtn.disabled = false;
// }

// async function loadPlan(planId) {
//   const contract = new ethers.Contract(
//     CONTRACTS[chainKey].emi,
//     contractABI,
//     provider
//   );

//   const p = await contract.plans(planId);

//   if (p.receiver === ethers.constants.AddressZero) {
//     throw new Error("Plan does not exist");
//   }

//   return p;
// }

// /* =========================================================
//    PAY BUTTON
// ========================================================= */

// payBtn.onclick = async (e) => {
//   e.preventDefault();

//   // ✅ SAFETY GUARD
//   if (!chainKey || !plan || !CONTRACTS[chainKey]) {
//     alert("App not initialized. Refresh page.");
//     return;
//   }

//   payBtn.disabled = true;

//   try {
//     const { emi, USDT } = CONTRACTS[chainKey];
//     const usdtContract = new ethers.Contract(
//       USDT,
//       [
//         "function allowance(address,address) view returns (uint256)",
//         "function approve(address,uint256) returns (bool)",
//       ],
//       signer
//     );

//     const allowance = await usdtContract.allowance(sender, PERMIT2);

//     if (allowance.lt(plan.total)) {
//       const approveTx = await usdtContract.approve(
//         PERMIT2,
//         ethers.constants.MaxUint256
//       );
//       await approveTx.wait();
//     }

//     /* ------------------ PERMIT2 NONCE ------------------ */
//     const permit2 = new ethers.Contract(
//       PERMIT2,
//       [
//         "function allowance(address,address,address) view returns (uint160,uint48,uint48)",
//       ],
//       provider
//     );

//     const [, , nonce] = await permit2.allowance(sender, USDT, emi);

//     console.log("Frontend USDT:", USDT);
//     console.log("Plan total:", plan.total.toString());

//     /* ------------------ SIGN PERMIT ------------------ */
//     const deadline = Math.floor(Date.now() / 1000) + 31536000;

//     const permit = {
//       details: {
//         token: USDT,
//         amount: plan.total, // allow full plan amount
//         expiration: deadline,
//         nonce,
//       },
//       spender: emi,
//       sigDeadline: deadline,
//     };

//     const signature = await signer._signTypedData(
//       { name: "Permit2", chainId: expectedChainId, verifyingContract: PERMIT2 },
//       {
//         PermitSingle: [
//           { name: "details", type: "PermitDetails" },
//           { name: "spender", type: "address" },
//           { name: "sigDeadline", type: "uint256" },
//         ],
//         PermitDetails: [
//           { name: "token", type: "address" },
//           { name: "amount", type: "uint160" },
//           { name: "expiration", type: "uint48" },
//           { name: "nonce", type: "uint48" },
//         ],
//       },
//       permit
//     );

//     /* ------------------ ACTIVATE PLAN ------------------ */
//     const emicontract = new ethers.Contract(emi, contractABI, signer);
//     const tx = await emicontract.activatePlanWithPermit2AndPay(
//       planId,
//       plan.emi,
//       permit,
//       signature
//     );

//     await tx.wait();

//     alert("✅ EMI Activated Successfully");
//   } catch (err) {
//     console.error(err);
//     alert(err.reason || err.message || "Transaction failed");
//     payBtn.disabled = false;
//   }
// };

// /* =========================================================
//    AUTO INIT
// ========================================================= */

// window.addEventListener("load", () => {
//   init().catch((err) => {
//     console.error(err);
//     alert("Failed to initialize payment page");
//   });
// });
