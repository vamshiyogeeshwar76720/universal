import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  const USDT_MAINNET = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  const Emi = await ethers.getContractFactory("EmiAutoPayEVM");
  const emi = await Emi.deploy(USDT_MAINNET);
  await emi.deployed();

  console.log("EmiAutoPay deployed to:", emi.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
