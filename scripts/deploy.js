import hre from "hardhat";
const { ethers } = hre;

// ============================================================================
// SMART CONTRACT DEPLOYMENT FOR NATIVE CURRENCY (ETH, MATIC, BNB)
// ============================================================================
// This contract uses NATIVE CURRENCY ONLY (no ERC-20 tokens)
// No token addresses needed - deployment is simple!
// ============================================================================

const NETWORK_INFO = {
  // Ethereum
  11155111: { name: "Sepolia Testnet", currency: "ETH" },
  1: { name: "Ethereum Mainnet", currency: "ETH" },

  // Polygon
  80001: { name: "Mumbai Testnet", currency: "MATIC" },
  137: { name: "Polygon Mainnet", currency: "MATIC" },

  // BSC
  97: { name: "BSC Testnet", currency: "BNB" },
  56: { name: "BSC Mainnet", currency: "BNB" },
};

async function main() {
  const [deployer] = await ethers.getSigners();

  // Get current network
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("\n" + "=".repeat(80));
  console.log("📋 SMART CONTRACT DEPLOYMENT");
  console.log("=".repeat(80));
  console.log(`🔐 Deployer Address: ${deployer.address}`);
  console.log(`🌐 Network Chain ID: ${chainId}`);

  // Get network info
  const networkInfo = NETWORK_INFO[chainId];

  if (!networkInfo) {
    console.error(`\n❌ Network ${chainId} is not supported!`);
    console.error(
      `Supported networks: ${Object.keys(NETWORK_INFO).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`📡 Network: ${networkInfo.name}`);
  console.log(
    `💱 Currency: ${networkInfo.currency} (NATIVE - No token needed)`,
  );
  console.log("=".repeat(80));

  console.log("\n🚀 Deploying EmiAutoPayEVM contract...");

  try {
    // Get contract factory
    const Emi = await ethers.getContractFactory("EmiAutoPayEVM");

    // Deploy contract (no parameters - uses native currency only)
    const emi = await Emi.deploy();

    // Wait for deployment
    const receipt = await emi.deployed();

    console.log("\n✅ CONTRACT DEPLOYED SUCCESSFULLY!");
    console.log("=".repeat(80));
    console.log(`📍 Contract Address: ${emi.address}`);
    console.log(`🔗 Network: ${networkInfo.name}`);
    console.log(`💱 Currency: ${networkInfo.currency} (Native)`);
    console.log(`🧮 Admin: ${deployer.address}`);
    console.log("=".repeat(80));

    // Provide next steps
    console.log("\n📝 NEXT STEPS:");
    console.log("1. Update networkService.js with the contract address:");
    console.log(`   emiContract: "${emi.address}"`);
    console.log(`2. Verify contract on block explorer:`);

    // Generate explorer link based on network
    let explorerUrl = "";
    switch (chainId) {
      case 11155111:
        explorerUrl = `https://sepolia.etherscan.io/address/${emi.address}`;
        break;
      case 1:
        explorerUrl = `https://etherscan.io/address/${emi.address}`;
        break;
      case 80001:
        explorerUrl = `https://mumbai.polygonscan.com/address/${emi.address}`;
        break;
      case 137:
        explorerUrl = `https://polygonscan.com/address/${emi.address}`;
        break;
      case 97:
        explorerUrl = `https://testnet.bscscan.com/address/${emi.address}`;
        break;
      case 56:
        explorerUrl = `https://bscscan.com/address/${emi.address}`;
        break;
    }

    if (explorerUrl) {
      console.log(`   ${explorerUrl}`);
    }

    console.log(`3. Register Chainlink Automation upkeep`);
    console.log(`4. Deploy monitor service to Vercel`);
    console.log("\n");
  } catch (error) {
    console.error("\n❌ DEPLOYMENT FAILED!");
    console.error("Error:", error.message);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
