import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/+esm";
import { contractABI } from "./abi.js";
// import { mockedABI } from "./mockabi.js";
/* =========================================================
   CONFIG
========================================================= */

const CONTRACTS = {
  sepolia: {
    chainId: 11155111,
    emi: "0xa5D37d983AF3C180A59f6b1EbE1BC0a1F5c768d3",
    usdt: "0xAD7A06965C287c7da28d64E6Bc7c90785a1fab1d",
  },

  // ready for production
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
   INIT
========================================================= */

async function init() {
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

  // find matching chainKey
  chainKey = Object.keys(CONTRACTS).find(
    (k) => CONTRACTS[k].chainId === expectedChainId
  );

  if (!chainKey) {
    alert("Unsupported chain in link");
    throw new Error("Unsupported chain");
  }

  // auto switch chain if needed
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
  console.log("Plan loaded:", plan);
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

  return plan;
}

/* =========================================================
   PAY BUTTON
========================================================= */
const btn = document.getElementById("payBtn");
btn.onclick = async (e) => {
  e.preventDefault();
  btn.disabled = true;

  try {
    const emiAddress = CONTRACTS[chainKey].emi;
    const contract = new ethers.Contract(emiAddress, contractABI, signer);

    console.log("Using chain:", chainKey);
    console.log("EMI:", emiAddress);

    /* -------------------------------------------
   STEP 1 — APPROVE PERMIT2 (ONE TIME)
-------------------------------------------- */

    const usdt = await contract.USDT();

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

    /* -------------------------------------------
       STEP 2 — READ PERMIT2 NONCE
    -------------------------------------------- */

    const permit2 = new ethers.Contract(
      PERMIT2,
      [
        "function allowance(address,address,address) view returns (uint160,uint48,uint48)",
      ],
      provider
    );

    const [, , nonce] = await permit2.allowance(sender, usdt, emiAddress);

    /* -------------------------------------------
       STEP 3 — SIGN PERMIT2
    -------------------------------------------- */

 
    const activationInput = document.getElementById("activationAmount");
    // const amount = plan.emi;
    const deadline = Math.floor(Date.now() / 1000) + 31536000;
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

    const activationAmount = ethers.utils.parseUnits(
      activationInput?.value?.trim() || "0",
      6
    );

    
    const signature = await signer._signTypedData(
      { name: "Permit2", chainId: expectedChainId, verifyingContract: PERMIT2 },
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

    /* -------------------------------------------
       STEP 4 — ACTIVATE EMI
    -------------------------------------------- */

    const tx = await contract.activatePlanWithPermit2AndPay(
      planId,
      activationAmount,
      permit,
      signature
    );

    await tx.wait();

    alert("✅ EMI Activated Successfully");
  } catch (err) {
    console.error(err);
    alert(err.reason || err.message || "Transaction failed");
    btn.disabled = false;
  }
};

window.addEventListener("load", () => {
  init().catch(console.error);
});
