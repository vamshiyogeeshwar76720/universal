import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";
import { contractABI } from "./abi.js";

/* =========================================================
   CONFIG
========================================================= */

const CONTRACTS = {
  sepolia: {
    chainId: 11155111,
    emi: "0xF15f4b677B45208Fc7AA1B8294Fe2bC83037e0AE",
    usdt: "0x1d0Ac7A08bbc8231aeAdA7Ead6F4bd444780f51f",
  },
  mainnet: {
    chainId: 1,
    emi: "0x7BAA6f2fFc568F1114A392557Bc3bCDe609bb795",
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

if (!planId || !expectedChainId) {
  alert("Invalid payment link");
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

/* =========================================================
   UTILITY - FORMAT ERROR MESSAGES
========================================================= */
function formatError(err) {
  if (err.code === 4001) return "Transaction rejected by user";
  if (err.code === -32603) return "Internal JSON-RPC error. Check your balance.";
  return err.reason || err.message || "Transaction failed";
}

/* =========================================================
   INIT
========================================================= */

async function init() {
  try {
    if (!window.ethereum) {
      alert("MetaMask required");
      throw new Error("No wallet");
    }

    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    sender = await signer.getAddress();

    const network = await provider.getNetwork();

    console.log("Wallet chain:", network.chainId);
    console.log("Expected chain:", expectedChainId);

    // Find matching chainKey
    chainKey = Object.keys(CONTRACTS).find(
      (k) => CONTRACTS[k].chainId === expectedChainId
    );

    if (!chainKey) {
      alert("Unsupported chain in link");
      throw new Error("Unsupported chain");
    }

    // Auto switch chain if needed
    if (network.chainId !== expectedChainId) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ethers.utils.hexValue(expectedChainId) }],
      });
      // Reload provider after chain switch
      provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      signer = provider.getSigner();
    }

    plan = await loadPlan(planId);
    
    document.getElementById("planInfo").innerText = 
      `EMI: ${ethers.utils.formatUnits(plan.emi, 6)} USDT | Total: ${ethers.utils.formatUnits(plan.total, 6)} USDT`;
    
    console.log("Plan loaded:", plan);
  } catch (err) {
    console.error("Init error:", err);
    alert(formatError(err));
  }
}

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

  if (plan.active) {
    throw new Error("Plan already activated");
  }

  return plan;
}

/* =========================================================
   PAY BUTTON
========================================================= */
const btn = document.getElementById("payBtn");
btn.onclick = async (e) => {
  e.preventDefault();
  btn.disabled = true;
  btn.innerText = "Processing...";

  try {
    const emiAddress = CONTRACTS[chainKey].emi;
    const usdtAddress = CONTRACTS[chainKey].usdt;
    
    const contract = new ethers.Contract(emiAddress, contractABI, signer);

    console.log("Using chain:", chainKey);
    console.log("EMI Contract:", emiAddress);
    console.log("USDT Address:", usdtAddress);

    /* -------------------------------------------
       STEP 0 — VALIDATE INPUT
    -------------------------------------------- */
    const activationInput = document.getElementById("activationAmount");
    const activationAmountRaw = activationInput?.value?.trim() || "0";
    const activationAmount = ethers.utils.parseUnits(activationAmountRaw, 6);

    console.log("Activation Amount:", ethers.utils.formatUnits(activationAmount, 6), "USDT");

    /* -------------------------------------------
       STEP 1 — CHECK BALANCE & APPROVE PERMIT2
    -------------------------------------------- */
    const usdtContract = new ethers.Contract(
      usdtAddress,
      [
        "function approve(address,uint256) returns (bool)",
        "function allowance(address,address) view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
      ],
      signer
    );

    const balance = await usdtContract.balanceOf(sender);
    console.log("Wallet USDT Balance:", ethers.utils.formatUnits(balance, 6));

    // Check if user has enough balance for total EMI plan
    if (balance.lt(plan.total)) {
      throw new Error(
        `Insufficient balance. You need ${ethers.utils.formatUnits(plan.total, 6)} USDT but only have ${ethers.utils.formatUnits(balance, 6)} USDT`
      );
    }

    // Check Permit2 allowance
    const allowance = await usdtContract.allowance(sender, PERMIT2);
    console.log("Current Permit2 Allowance:", ethers.utils.formatUnits(allowance, 6));

    if (allowance.lt(plan.total)) {
      console.log("⏳ Approving Permit2...");
      btn.innerText = "Approve USDT...";
      
      const txApprove = await usdtContract.approve(
        PERMIT2,
        ethers.constants.MaxUint256
      );
      
      console.log("Approval TX submitted:", txApprove.hash);
      await txApprove.wait();
      console.log("✅ Permit2 approved");
    }

    /* -------------------------------------------
       STEP 2 — READ PERMIT2 NONCE
    -------------------------------------------- */
    btn.innerText = "Reading nonce...";

    const permit2 = new ethers.Contract(
      PERMIT2,
      [
        "function allowance(address,address,address) view returns (uint160,uint48,uint48)",
      ],
      provider
    );

    const [, , nonce] = await permit2.allowance(sender, usdtAddress, emiAddress);
    console.log("Permit2 Nonce:", nonce.toString());

    /* -------------------------------------------
       STEP 3 — SIGN PERMIT2
    -------------------------------------------- */
    btn.innerText = "Sign permit...";

    const deadline = Math.floor(Date.now() / 1000) + 31536000; // 1 year

    const permit = {
      details: {
        token: usdtAddress,
        amount: plan.total, // Total EMI amount
        expiration: deadline,
        nonce,
      },
      spender: emiAddress,
      sigDeadline: deadline,
    };

    console.log("Permit details:", permit);

    const signature = await signer._signTypedData(
      { 
        name: "Permit2", 
        chainId: expectedChainId, 
        verifyingContract: PERMIT2 
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
       STEP 4 — ACTIVATE EMI
    -------------------------------------------- */
    btn.innerText = "Activating EMI...";

    const tx = await contract.MAD(
      planId,
      activationAmount,
      permit,
      signature
    );

    console.log("MAD TX submitted:", tx.hash);
    await tx.wait();

    console.log("✅ EMI Activated");
    alert("✅ EMI Activated Successfully!");
    
    btn.innerText = "Success!";
    btn.style.backgroundColor = "#10b981";

  } catch (err) {
    console.error("Transaction error:", err);
    alert(`❌ ${formatError(err)}`);
    
    btn.disabled = false;
    btn.innerText = "MAD";
  }
};

window.addEventListener("load", () => {
  init().catch(console.error);
});

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
