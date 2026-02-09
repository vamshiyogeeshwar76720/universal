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

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

 //URL PARAMS
const params = new URLSearchParams(window.location.search);
const planId = params.get("planId");
const expectedChainId = Number(params.get("chainId"));

if (!planId || !expectedChainId) {
  alert("Invalid payment link");
  throw new Error("Missing URL parameters");
}


//GLOBALS
let provider;
let signer;
let sender;
let chainKey;
let plan;


function formatError(err) {
  if (err.code === 4001) return "Transaction rejected by user";
  if (err.code === -32603) return "Internal JSON-RPC error. Check your balance.";
  return err.reason || err.message || "Transaction failed";
}

//INIT
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
  document.getElementById("payBtn").innerText = `MAD #${planId}`;
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

//PAY BUTTON
const btn = document.getElementById("payBtn");
btn.onclick = async (e) => {
  e.preventDefault();
  btn.disabled = true;
   btn.innerText = "Processing...";

  try {
    const emiAddress = CONTRACTS[chainKey].emi;
    const contract = new ethers.Contract(emiAddress, contractABI, signer);

    console.log("Using chain:", chainKey);
    console.log("EMI:", emiAddress);


//STEP 1 — APPROVE PERMIT2
  const usdt = await contract.USDT();
       
  //STEP 2 — READ PERMIT2 NONCE
    const permit2 = new ethers.Contract(
      PERMIT2,
      [
        "function allowance(address,address,address) view returns (uint160,uint48,uint48)",
      ],
      provider
    );
    const [, , nonce] = await permit2.allowance(sender, usdt, emiAddress);

  //STEP 3 — SIGN PERMIT2
btn.innerText = "Sign permit...";
    const activationInput = document.getElementById("activationAmount");
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
    
// STEP 4 — ACTIVATE EMI
   
 btn.innerText = "Activating EMI...";

    const tx = await contract.MAD(
      planId,
      activationAmount, 
      permit,
      signature
    );

    await tx.wait();

    alert("✅ EMI Activated Successfully");

    btn.innerText = "Success!";
    btn.style.backgroundColor = "#10b981";
  } catch (err) {
    console.error(err);
    alert(err.reason || err.message || "Transaction failed");
    btn.disabled = false;
    btn.innerText = "MAD";
  }
};

window.addEventListener("load", () => {
  init().catch(console.error);
});

