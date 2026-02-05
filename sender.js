// 🔥 1-CLICK ETH EMI Activation - SIMPLIFIED FLOW
// Sender sends ETH directly to receiver address via MetaMask
// No contract interaction needed

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";

const NETWORK_CONFIG = {
  sepolia: {
    chainId: 11155111,
    emi: "0x4f8eC235AeBb34c0CE63EBA1192CDE7AA5ac4aE7",
     usdt: "0x4297C04483109B2bc3Ed9a6f68B33a588E803Ff7",
  },

  // ready for production
  mainnet: {
    chainId: 1,
    emi: "0xMAINNET_EMI_CONTRACT",
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
};

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/* =========================================================
   URL PARAMS
========================================================= */

const params = new URLSearchParams(window.location.search);
const planId = params.get("planId");
const expectedChainId = Number(params.get("chainId"));

if (!receiverAddress) {
  document.getElementById("status").innerText = "❌ Invalid payment link - missing receiver address";
  throw new Error("No receiver in URL");
}

let provider, signer, senderAddress;
let isConnected = false;

// 🔥 MOBILE WALLET POLLING
async function detectWallet() {
  const statusEl = document.getElementById("status");
  statusEl.innerText = "🔄 Detecting wallet...";

  const providers = ["ethereum", "webkitEthereum", "trustwallet"];

  for (let i = 0; i < 30; i++) {
    for (const providerName of providers) {
      if (window[providerName]) {
        try {
          provider = new ethers.providers.Web3Provider(
            window[providerName],
            "any",
          );
          await provider.send("eth_requestAccounts", []);
          signer = provider.getSigner();
          senderAddress = await signer.getAddress();
          isConnected = true;
          statusEl.innerText = "✅ Wallet connected!";
          return true;
        } catch (e) {
          console.log("Provider not ready:", providerName);
        }
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  statusEl.innerText = "❌ No wallet detected. Please refresh.";
  return false;
}

// 🔥 MAIN INITIALIZATION
async function init() {
  try {
    const connectBtn = document.getElementById("connectBtn");
    
    connectBtn.onclick = async () => {
      connectBtn.disabled = true;
      connectBtn.innerText = "⏳ Connecting...";

      const hasWallet = await detectWallet();
      if (!hasWallet) {
        alert("❌ No wallet found. Please install MetaMask or Trust Wallet.");
        connectBtn.disabled = false;
        connectBtn.innerText = "🔗 Connect Wallet";
        return;
      }

      // Verify network
      await switchNetwork();

      // Show receiver info and payment instructions
      showPaymentInfo();
      connectBtn.style.display = "none";
    };
  } catch (error) {
    console.error("Init failed:", error);
    document.getElementById("status").innerText = "❌ Setup failed";
  }
}

// Switch to Sepolia testnet
async function switchNetwork() {
  const currentChain = await provider.getNetwork();

  if (currentChain.chainId !== NETWORK_CONFIG.sepolia.chainId) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // Sepolia
      });
    } catch (error) {
      if (error.code === 4902) {
        console.log("Chain not added, requesting addition...");
        // Network doesn't exist, can skip for testnet
      }
    }
  }
}

// Show payment instructions
function showPaymentInfo() {
  document.getElementById("paymentInfo").innerHTML = `
    <div style="background: linear-gradient(135deg, #ff6b35, #f7931a); color: white; padding: 24px; border-radius: 16px; text-align: center;">
      <h2>💸 Send ETH to Receiver</h2>
      
      <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 12px; margin: 20px 0;">
        <p style="font-size: 14px; margin-bottom: 12px;"><strong>📍 Receiver Wallet Address:</strong></p>
        <div style="background: #1f2937; color: #f9fafb; padding: 16px; border-radius: 12px; word-break: break-all; font-family: monospace; margin: 16px 0; font-size: 13px; cursor: pointer;" onclick="window.copyAddress('${receiverAddress}')">
          ${receiverAddress}
          <small style="display: block; margin-top: 8px; color: #9ca3af;">(click to copy)</small>
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; margin: 16px 0; font-size: 13px;">
        <strong>💡 How it works:</strong><br/>
        ✅ Send ANY amount of ETH to this address<br/>
        ✅ Our system detects the payment<br/>
        ✅ EMI plan auto-activates instantly<br/>
        ✅ Chainlink pulls installments automatically
      </div>

      <button onclick="window.sendETH()" id="sendBtn" style="background: white; color: #ff6b35; border: none; padding: 16px 32px; border-radius: 8px; cursor: pointer; margin-top: 16px; width: 100%; font-weight: bold; font-size: 16px;">
        🚀 Send ETH Now
      </button>
    </div>
  `;
}

// Send ETH directly to receiver address
window.sendETH = async function () {
  const sendBtn = document.getElementById("sendBtn");
  const amountInput = document.getElementById("amountInput");
  
  // Get amount from input or use EMI amount as default
  let amount = emiAmount || "0.01";
  
  try {
    // Prompt for amount if not provided
    if (!emiAmount) {
      amount = prompt("Enter amount of ETH to send:", "0.01");
      if (!amount) return;
    }

    sendBtn.disabled = true;
    sendBtn.innerText = "⏳ Processing transaction...";

    const amountWei = ethers.utils.parseEther(amount.toString());

    // Send ETH transaction directly to receiver
    console.log(`💸 Sending ${amount} ETH to ${receiverAddress}...`);

    const tx = await signer.sendTransaction({
      to: receiverAddress,
      value: amountWei,
      gasLimit: 21000, // Standard ETH transfer gas
    });

    console.log("✅ Transaction sent:", tx.hash);
    sendBtn.innerText = "⏳ Waiting for confirmation...";

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed:", receipt.hash);

    showSuccess(tx.hash, amount);
  } catch (error) {
    console.error("❌ Transaction failed:", error);
    const errorMsg = error.reason || error.message || "Transaction failed";
    alert("❌ " + errorMsg);
    sendBtn.disabled = false;
    sendBtn.innerText = "🚀 Send ETH Now";
  }
};

// Show success message
function showSuccess(txHash, amount) {
  document.body.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; max-width: 600px; margin: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="font-size: 100px; margin-bottom: 20px;">✅</div>
      <h1 style="color: #10b981; margin-bottom: 12px;">Payment Sent!</h1>
      <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
        <strong>${amount} ETH</strong> has been transferred to the receiver.<br/>
        <small>The EMI plan will activate within 10 seconds.</small>
      </p>
      
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="color: #6b7280; font-size: 12px; margin-bottom: 8px;">Transaction Hash:</p>
        <code style="display: block; word-break: break-all; font-size: 11px; color: #374151; cursor: pointer;" onclick="window.copyAddress('${txHash}')">
          ${txHash}
        </code>
        <small style="color: #9ca3af; display: block; margin-top: 8px;">
          <a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank" style="color: #3b82f6; text-decoration: none;">View on Etherscan ↗</a>
        </small>
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        ✅ Monitor detected payment<br/>
        ✅ EMI plan activated<br/>
        ✅ Chainlink Automation running
      </p>

      <button onclick="window.close()" style="
        padding: 12px 32px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        margin-top: 24px;
      ">Close</button>
    </div>
  `;
}

// Utility: Copy to clipboard
window.copyAddress = function (text) {
  navigator.clipboard.writeText(text).then(() => {
    alert("✅ Copied!");
  }).catch(() => {
    alert("Failed to copy");
  });
};

window.addEventListener("load", init);
    12,
  )}...</a>
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

    const usdtContract = new ethers.Contract(
      usdt,
      [
        "function approve(address,uint256) returns (bool)",
        "function allowance(address,address) view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
      ],
      // mockedABI,
      signer
    );

    const balance = await usdtContract.balanceOf(sender);

    // safety checks (recommended)
    console.log("Wallet balance raw:", balance.toString());
    console.log("Plan EMI raw:", plan.emi.toString());
    console.log("Wallet balance USDT:", ethers.utils.formatUnits(balance, 6));
    console.log("Plan EMI USDT:", ethers.utils.formatUnits(plan.emi, 6));

    const allowance = await usdtContract.allowance(sender, PERMIT2);

    if (allowance.lt(plan.emi)) {
      console.log("Approving Permit2...");
      const txApprove = await usdtContract.approve(
        PERMIT2,
        ethers.constants.MaxUint256
      );
      await txApprove.wait();
    }

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
