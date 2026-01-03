import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Estimator account:", deployer.address);

  // USDT address (same as deploy)
  const USDT_MAINNET = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

  // Get contract factory
  const Emi = await ethers.getContractFactory("EmiAutoPayEVM");

  // Create deployment transaction (NOT sent)
  const deployTx = Emi.getDeployTransaction(USDT_MAINNET);

  // Estimate gas units
  const gasEstimate = await ethers.provider.estimateGas({
    from: deployer.address,
    data: deployTx.data,
  });

  // Get current gas price
  const gasPrice = await ethers.provider.getGasPrice();

  // Calculate ETH cost
  const ethCost = gasEstimate.mul(gasPrice);

  console.log("--------------------------------------------------");
  console.log("Estimated Gas Units:", gasEstimate.toString());
  console.log("Gas Price (gwei):", ethers.utils.formatUnits(gasPrice, "gwei"));
  console.log("Total Cost (ETH):", ethers.utils.formatEther(ethCost));
  console.log("--------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
