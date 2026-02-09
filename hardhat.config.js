import "@nomiclabs/hardhat-ethers";
import "dotenv/config";

const {
  SEPOLIA_RPC,
  ETH_MAINNET_RPC,
  PRIVATE_KEY,
  ENV,
} = process.env;

export default { 
  solidity: "0.8.20",
  defaultNetwork: ENV === "mainnet" ? "ethereumMainnet" : "ethereumSepolia",
  networks: {
    ethereumSepolia: {
      url: SEPOLIA_RPC,
      accounts: [PRIVATE_KEY],
    },
    ethereumMainnet: {
      url: ETH_MAINNET_RPC,
      accounts: [PRIVATE_KEY],
    },

  },
};
