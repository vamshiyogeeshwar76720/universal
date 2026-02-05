# 🚀 EMI Auto-Payment System: Complete Deployment Guide

## System Overview

The EMI Auto-Payment System is a **hybrid on-chain/off-chain architecture** consisting of:

1. **Smart Contract (Ethereum)** - EmiAutoPayEVM.sol
2. **Receiver Frontend** - main.html + receiver.js
3. **Monitor Service (Vercel)** - api/index.js
4. **Integration Services** - The Graph, Chainlink Automation

---

## Deployment Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    EMI AUTO-PAYMENT SYSTEM                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend                     Backend                    Blockchain
│  ┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  │   receiver.js │    │  Vercel/Node.js │    │  Smart Contract │
│  │   main.html   │←→→→│  api/index.js   │←→→→│ EmiAutoPayEVM   │
│  │   (browser)   │    │  (monitoring)   │    │ (Sepolia/Mainnet)
│  └───────────────┘    └─────────────────┘    └─────────────────┘
│                              ↓                        ↓
│                         ┌──────────────┐     ┌──────────────┐
│                         │  The Graph   │     │  Chainlink   │
│                         │  (indexing)  │     │ (automation) │
│                         └──────────────┘     └──────────────┘
└──────────────────────────────────────────────────────────────────┘
```

---

## Deployment Steps

### Step 1: Deploy Smart Contract

#### 1.1 Prepare Contract

```bash
cd "f:\universal new func\universal"

# Install Hardhat dependencies (if not done)
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers @nomicfoundation/hardhat-toolbox

# Compile contract
npx hardhat compile
```

#### 1.2 Deploy to Sepolia (Testnet)

```bash
# Create .env file (DO NOT commit to git)
cat > .env << EOF
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
SEPOLIA_PRIVATE_KEY=0x...your_private_key...

MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
MAINNET_PRIVATE_KEY=0x...your_private_key...
EOF

# Deploy to Sepolia
npx hardhat run scripts/deploy.js --network sepoliaTestnet

# Expected output:
# ✅ Contract deployed to: 0x5B57f94BBC1a40664DB22B1067fecf42D7A97d6E
# ✅ Admin address: 0x...
```

#### 1.3 Register Chainlink Automation

Go to [Chainlink Automation Registry (Sepolia)](https://sepolia.automation.chain.link/):

```
1. Click "Register New Upkeep"
2. Select: "Custom Logic"
3. Contract Address: 0x5B57f94BBC1a40664DB22B1067fecf42D7A97d6E
4. Funding Amount: 5 LINK (for testing)
5. Gas Limit: 500000
6. Click "Register Upkeep"

Result: Get Upkeep ID
```

#### 1.4 Verify Contract Deployment

```bash
# Check on Sepolia Etherscan
https://sepolia.etherscan.io/address/0x5B57f94BBC1a40664DB22B1067fecf42D7A97d6E

✅ Verify:
  - Code is visible
  - Constructor args show admin address
  - Can call read functions (planCount, plans, etc.)
```

---

### Step 2: Deploy Monitoring Service to Vercel

#### 2.1 Verify Service Structure

```
emi-monitor/
├── package.json
├── vercel.json
└── api/
    └── index.js
```

#### 2.2 Install & Test Locally

```bash
cd "f:\universal new func\emi-monitor"

# Install dependencies
npm install

# Test locally
npm start

# Should start on http://localhost:3000
# Test endpoints:
curl http://localhost:3000/admin/monitors
```

#### 2.3 Deploy to Vercel

**Option A: Via Vercel CLI**

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
cd "f:\universal new func\emi-monitor"
vercel

# Follow prompts:
# - Which scope? (your account)
# - Link to existing project? (No)
# - Project name: emi-monitor
# - Framework: Other

# Result:
# ✅ Production: https://emi-monitor-xxx.vercel.app/
# ✅ Aliased: https://emi-monitor.vercel.app/
```

**Option B: Via GitHub + Vercel Dashboard**

```
1. Push code to GitHub
2. Go to vercel.com
3. Connect GitHub account
4. Import "emi-monitor" project
5. Deploy
```

#### 2.4 Verify Vercel Deployment

```bash
# Test production endpoints
curl https://emi-monitor.vercel.app/admin/monitors

# Should return:
# { "count": 0, "monitors": {} }

✅ Service is live and responding
```

---

### Step 3: Update Frontend Configuration

#### 3.1 Update networkService.js

```javascript
// networkService.js - Update contract addresses after deployment

const NETWORK_CONFIG = {
  // Sepolia (Testnet)
  11155111: {
    name: "Sepolia Testnet",
    id: 11155111,
    currency: "ETH",
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_KEY",
    emiContract: "0x5B57f94BBC1a40664DB22B1067fecf42D7A97d6E",  // ← UPDATE
    explorerUrl: "https://sepolia.etherscan.io",
    // ... rest of config
  },
  
  // Mainnet
  1: {
    name: "Ethereum Mainnet",
    id: 1,
    currency: "ETH",
    rpcUrl: "https://mainnet.infura.io/v3/YOUR_KEY",
    emiContract: "0x...",  // ← ADD AFTER MAINNET DEPLOYMENT
    explorerUrl: "https://etherscan.io",
    // ... rest of config
  }
};
```

#### 3.2 Test Frontend

```bash
cd "f:\universal new func\universal"

# Start local server
python -m http.server 8000
# or
npx http-server -p 8000

# Open in browser
http://localhost:8000/main.html

✅ Verify:
  - Connect wallet works
  - Network selector shows Sepolia/Ethereum
  - Create EMI Plan form is functional
```

---

### Step 4: Configure Admin Key for Vercel

#### 4.1 Add Environment Variables to Vercel

Go to [Vercel Project Settings → Environment Variables](https://vercel.com/dashboard):

```
Variable Name: ADMIN_PRIVATE_KEY
Value: 0x...your_admin_private_key...
Environments: Production, Preview, Development

⚠️  SECURITY: This key should have ONLY the Sepolia/Mainnet test funds
⚠️  NEVER commit .env or expose this key
```

#### 4.2 Update api/index.js to Use Key (Production)

```javascript
// api/index.js - In production version (not in demo)

const ethers = require("ethers");

async function activatePlanViaMonitor(planId, receiver, sender, contract, chainId) {
  try {
    // Get admin key from environment
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      console.error("❌ ADMIN_PRIVATE_KEY not set in environment");
      return;
    }

    // Connect to network
    const rpcUrl = chainId === 11155111
      ? "https://sepolia.infura.io/v3/YOUR_KEY"
      : "https://mainnet.infura.io/v3/YOUR_KEY";
    
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const adminSigner = new ethers.Wallet(adminPrivateKey, provider);

    // Load contract
    const abi = require("../contracts/abi.json");  // Get from artifacts
    const contractInstance = new ethers.Contract(contract, abi, adminSigner);

    // Call activatePlanRaw
    console.log(`🚀 Calling activatePlanRaw(${planId}, ${sender})`);
    const tx = await contractInstance.activatePlanRaw(planId, sender);
    console.log(`✅ TX sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ TX confirmed in block ${receipt.blockNumber}`);

    // Update monitor state
    monitors[receiver].active = true;
    monitors[receiver].sender = sender;
    monitors[receiver].activatedAt = Date.now();

    console.log(`✅ Plan #${planId} activated!`);
  } catch (error) {
    console.error("Activation error:", error);
  }
}
```

---

### Step 5: Register with The Graph (Optional but Recommended)

#### 5.1 Create Subgraph

```bash
# Install The Graph CLI
npm install -g @graphprotocol/graph-cli

# Create subgraph
graph init --product subgraph-studio emi-monitor

# Configure for your contract
# - Contract address: 0x5B57f94BBC1a40664DB22B1067fecf42D7A97d6E
# - Network: sepolia
# - ABI: EmiAutoPayEVM.json
```

#### 5.2 Deploy Subgraph

```bash
# Authenticate
graph auth --product subgraph-studio <ACCESS_TOKEN>

# Deploy
graph deploy --product subgraph-studio emi-monitor

# Result:
# ✅ Subgraph deployed to The Graph Studio
# ✅ API endpoint: https://api.studio.thegraph.com/query/xxx/emi-monitor/vx.x.x
```

---

## Testing & Validation

### Local Testing

```bash
# 1. Start frontend
cd "f:\universal new func\universal"
python -m http.server 8000

# 2. Open in browser
http://localhost:8000/main.html

# 3. Connect MetaMask to Sepolia
# 4. Get Sepolia ETH from faucet: https://sepoliafaucet.com/

# 5. Create a test plan
EMI: 0.01
Total: 0.03
Interval: 60 seconds (for quick testing)

# 6. Observe status updates (should show "WAITING")
```

### Staging on Sepolia

```bash
# 1. Verify monitor service is running
curl https://emi-monitor.vercel.app/admin/monitors

# 2. Create plan on testnet
# 3. Simulate transfer (for testing)
curl -X POST https://emi-monitor.vercel.app/admin/simulate-transfer \
  -H "Content-Type: application/json" \
  -d '{
    "receiver": "0x38ad...",
    "sender": "0xABC..."
  }'

# 4. Verify plan activates
# 5. Wait for Chainlink to execute payment (every interval)
# 6. Check Etherscan for transactions
```

### Pre-Mainnet Checklist

- ✅ Frontend loads without errors
- ✅ Wallet connection works (MetaMask, Trust, etc.)
- ✅ Plan creation succeeds
- ✅ Monitor registration succeeds
- ✅ Status polling shows "WAITING" then "ACTIVE"
- ✅ Chainlink successfully executes payments
- ✅ All Etherscan transactions visible
- ✅ No sensitive data logged
- ✅ Error handling works gracefully
- ✅ Gas costs are reasonable

---

## Mainnet Deployment

### 1. Deploy Contract to Mainnet

```bash
# Deploy to mainnet
npx hardhat run scripts/deploy.js --network ethereumMainnet

# Update NETWORK_CONFIG with new contract address
# Sepolia: 0x5B57f94BBC1a40664DB22B1067fecf42D7A97d6E (testnet)
# Mainnet: 0x...new_address... (production)
```

### 2. Register Chainlink on Mainnet

Go to [Chainlink Automation Registry (Mainnet)](https://automation.chain.link/):

```
Similar to Sepolia setup, but with mainnet funds:
- Use real LINK (not testnet LINK)
- Fund with sufficient LINK for your use case
- Monitor upkeep execution and costs
```

### 3. Update Configuration

```javascript
// networkService.js
1: {
  name: "Ethereum Mainnet",
  id: 1,
  emiContract: "0x...",  // Mainnet address
  rpcUrl: "https://mainnet.infura.io/v3/YOUR_KEY"
}
```

### 4. Final Testing Before Launch

```bash
# Test on mainnet with small amounts
# Monitor gas costs
# Verify Chainlink timing
# Check The Graph indexing
```

---

## Cost Estimation

### Testnet (Sepolia - Free)
- Contract deployment: Free (testnet ETH)
- Chainlink automation: Free (testnet LINK)
- Vercel hosting: Free tier
- Total: **$0**

### Mainnet (Ethereum)

| Operation | Cost | Notes |
|-----------|------|-------|
| Contract deployment | $20-50 | One-time, depends on gas |
| Plan creation (2 txs) | $10-20 | Per plan (createPlan + linkPlan) |
| Transfer detection | $0 | Off-chain via The Graph |
| Plan activation | $5-15 | Admin call (once per plan) |
| Auto-payments (Chainlink) | 0.25 LINK per execution | E.g., 10 intervals × 0.25 = 2.5 LINK (~$40) |
| Vercel hosting | $0-20 | Depends on usage |

**Example Total for 10-plan system:** $500-1000 per month (varies by gas prices)

---

## Monitoring & Maintenance

### Ongoing Tasks

```bash
# Daily
- Check Etherscan for failed transactions
- Monitor Vercel logs: vercel.com/dashboard
- Check Chainlink execution status

# Weekly  
- Verify monitor service health: /admin/monitors
- Check LINK balance for Chainlink
- Review error logs

# Monthly
- Analyze gas costs and optimize
- Review failed activations
- Plan for upgrades/features
```

### Logs & Debugging

```bash
# Vercel logs
vercel logs --follow

# Frontend console
F12 in browser → Console tab

# Contract events
https://sepolia.etherscan.io/address/0x5B57.../events
```

---

## Troubleshooting Deployment

### Contract Deployment Fails
```
Error: "Contract already exists"
→ Use different contract address or deploy to different network

Error: "Insufficient funds"
→ Add ETH to deployment account
→ Use faucet for testnet: https://sepoliafaucet.com/
```

### Vercel Deployment Fails
```
Error: "Build failed"
→ Check package.json dependencies
→ Verify vercel.json configuration
→ Check logs: vercel logs

Error: "Environment variables not set"
→ Add ADMIN_PRIVATE_KEY in Vercel dashboard
→ Redeploy after adding variables
```

### Frontend Can't Connect to Monitor
```
Error: "CORS error"
→ Check Vercel is deployed and accessible
→ Verify URL: https://emi-monitor.vercel.app/admin/monitors
→ May need to add CORS headers to Vercel

Error: "Monitor not detecting transfers"
→ Use /admin/simulate-transfer to test without blockchain
→ Check The Graph is indexed
→ Verify receiver address is correct
```

---

## Security Checklist

- ✅ Never commit .env or private keys to Git
- ✅ Admin private key stored ONLY in Vercel environment
- ✅ No sensitive data in frontend console logs
- ✅ Contract verified on Etherscan
- ✅ CORS headers configured properly
- ✅ Rate limiting on Vercel endpoints (consider adding)
- ✅ Contract uses nonReentrant for safety
- ✅ Input validation throughout
- ✅ No admin functions callable from frontend
- ✅ Error messages don't expose sensitive info

---

## Rollback Plan

If issues occur post-deployment:

```
1. Pause Chainlink upkeep (Chainlink UI)
2. Stop monitoring service (Vercel)
3. Investigate issue
4. Redeploy fixed version
5. Resume services

No user funds are at risk (pull-based system).
```

---

## Post-Deployment Checklist

- ✅ Contract deployed and verified on Etherscan
- ✅ Chainlink Automation registered
- ✅ Monitor service running on Vercel
- ✅ Frontend updated with correct addresses
- ✅ All endpoints tested and working
- ✅ Documentation updated
- ✅ Team trained on system
- ✅ Monitoring alerts configured
- ✅ Backup plan in place
- ✅ Security audit completed (optional but recommended)

---

## Support & Resources

- **Hardhat Docs:** https://hardhat.org/
- **Ethers.js Docs:** https://docs.ethers.org/
- **Chainlink Automation:** https://docs.chain.link/automation/
- **The Graph:** https://thegraph.com/docs/
- **Vercel Docs:** https://vercel.com/docs/
- **Etherscan API:** https://docs.etherscan.io/

---

**Last Updated:** February 2026  
**Status:** ✅ Ready for Deployment
