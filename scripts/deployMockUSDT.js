// import hre from "hardhat";
// const { ethers } = hre;

// async function main() {
//   const [deployer] = await ethers.getSigners();
//   console.log("Deploying with:", deployer.address);

//   /* -----------------------------
//      1. Deploy Mock USDT
//   ------------------------------ */
//   const MockUSDT = await ethers.getContractFactory("MockUSDT");
//   const usdt = await MockUSDT.deploy();
//   await usdt.deployed();

//   console.log("Mock USDT deployed to:", usdt.address);

//   /* -----------------------------
//      2. Deploy EMI Contract
//   ------------------------------ */
//   const Emi = await ethers.getContractFactory("EmiAutoPayEVM");
//   const emi = await Emi.deploy(usdt.address);
//   await emi.deployed();

//   console.log("EmiAutoPay deployed to:", emi.address);
// }

// main().catch((error) => {
//   console.error(error);
//   process.exitCode = 1;
// });
import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  /* -----------------------------
     1. Deploy Mock USDT (Optional - for testing)
  ------------------------------ */
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const usdt = await MockUSDT.deploy();
  await usdt.deployed();
  console.log("Mock USDT deployed to:", usdt.address);

  /* -----------------------------
     2. Deploy ETH-ONLY EMI Contract (NO USDT ARG!)
  ------------------------------ */
  const Emi = await ethers.getContractFactory("EmiAutoPayEVM");
  const emi = await Emi.deploy(); // ✅ NO ARGUMENTS - ETH ONLY!
  await emi.deployed();

  console.log("EmiAutoPayEVM (ETH-ONLY) deployed to:", emi.address);

  /* -----------------------------
     3. Export for receiver.js
  ------------------------------ */
  console.log("\n🎉 ✅ DEPLOYMENT SUCCESS!");
  console.log("═══════════════════════════════");
  console.log("📍 EMI CONTRACT (UPDATE receiver.js):", emi.address);
  console.log("💰 Mock USDT (Optional):", usdt.address);
  console.log("👤 Deployer:", deployer.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
