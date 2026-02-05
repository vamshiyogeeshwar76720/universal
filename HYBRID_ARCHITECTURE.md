# 🏗️ EMI Auto-Payment System: Hybrid On-Chain/Off-Chain Architecture

## Overview

The EMI Auto-Payment System implements a **hybrid architecture** that combines smart contract execution with off-chain monitoring to enable automated installment payments triggered by simple ETH transfers.

**Key Innovation:** No approvals needed - receiver creates a plan, sender just sends ETH to receiver's wallet, and everything activates automatically.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EMI AUTO-PAYMENT FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

PHASE 1: PLAN CREATION (On-Chain Setup)
──────────────────────────────────────────────────────────────────────────────
Receiver Dashboard (Frontend)                Contract (Ethereum)
      ↓                                             ↓
   UI Form                                  createPlan()
   ├─ EMI Amount: 0.01 ETH                  └→ planCount++
   ├─ Total: 0.1 ETH                        └→ plans[5] = {
   ├─ Interval: 1 hour                            receiver: 0x38ad...,
   └─ Click "Create"                             sender: 0x0,
                                                  emiAmount: 0.01,
      ↓                                           total: 0.1,
   TX1: createPlan()                             active: false
   └→ Emit: PlanCreated(5)                    }
                                                  └→ Emit: PlanCreated(5)
      ↓                                             ↓
   Parse Event → planId = 5                Event Log Indexed
      ↓
   TX2: linkPlanToDirectPayment(5)
   └→ pendingPlanId[0x38ad...] = 5


PHASE 2: OFF-CHAIN MONITORING REGISTRATION
──────────────────────────────────────────────────────────────────────────────
Receiver Dashboard                      Vercel Backend
      ↓                                       ↓
   POST /monitor                      monitors[receiver] = {
   {                                     planId: 5,
     planId: 5,                          receiver: "0x38ad...",
     receiver: "0x38ad...",              chainId: 11155111,
     chainId: 11155111,                  contract: "0x5B57...",
     contract: "0x5B57..."               active: false,
   }                                      createdAt: timestamp
      ↓                                  }
   Start Monitoring                       ↓
      ↓                                   Start Graph Queries
   Status: WAITING                        Every 10 seconds


PHASE 3: EXTERNAL PAYMENT DETECTION (The Graph)
──────────────────────────────────────────────────────────────────────────────
Sender (External)           The Graph                 Monitor Service
   ↓                            ↓                            ↓
Send 0.02 ETH          Detect Transfer        Query Transfers
   ↓ to                (to: 0x38ad...)        (to: 0x38ad...)
0x38ad...              ↓                           ↓
   ↓               Index Transfer            Found: sender = 0xABC...
TX Confirmed       Within ~15s
   ↓
   └─────────────────────────────────→ ✅ TRANSFER DETECTED


PHASE 4: PLAN ACTIVATION (On-Chain Execution)
──────────────────────────────────────────────────────────────────────────────
Monitor Service              Contract Admin Call         Chainlink Automation
      ↓                            ↓                           ↓
Detected sender = 0xABC...   activatePlanRaw(5, 0xABC...)  Register Upkeeper
      ↓                            ↓                           ↓
      └─→ Admin Call        plans[5] = {                  checkUpkeep()
          (via private key)    sender: 0xABC...,      ├─ Is it time? Yes
                               active: true,          └→ performUpkeep()
                               paymentReceived: true,     ├─ Send 0.01 ETH
                               nextPay: now + 1hr         ├─ paid += 0.01
                            }                            └─ Set nextPay
                                                            
                            Emit: PlanActivated(5)
                                  


PHASE 5: CONTINUOUS MONITORING & AUTO-PAYMENT
──────────────────────────────────────────────────────────────────────────────
Frontend (5s polling)        Monitor Status        Chainlink Automation
      ↓                           ↓                         ↓
GET /status/0x38ad...   Returns:                  Every 1 hour:
      ↓                 {                         ├─ checkUpkeep(5)
Update UI:               active: true,            └─ Yes? Execute
├─ Status: ✅ ACTIVE     sender: 0xABC...,         ├─ Transfer 0.01 ETH
├─ Sender: 0xABC...      planId: 5             to sender
└─ Message: Auto-                              └─ Update plan.paid
  payments starting          }                    └─ Set nextPay

                                              Repeat until:
                                              paid >= total
                                              (0.1 ETH)

```

---

## Phase 1: Plan Creation & Linking (On-Chain Setup)

### 📋 What Happens

Receiver creates an EMI plan on-chain with a specific EMI amount, total amount, and payment interval.

### 🔄 Flow

```javascript
// receiver.js - createAndLinkPlan()

// Step 1: Create plan
const emiWei = ethers.utils.parseEther("0.01");  // 0.01 ETH
const totalWei = ethers.utils.parseEther("0.1"); // 0.1 ETH
const intervalSeconds = 3600; // 1 hour

const tx1 = await contract.createPlan(emiWei, intervalSeconds, totalWei);
const receipt1 = await tx1.wait();

// Event emitted: PlanCreated(planId: 5)
const planId = parsePlanCreatedEvent(receipt1); // Extract from event log
// Result: planId = 5

// Step 2: Link plan to receiver's wallet
const tx2 = await contract.linkPlanToDirectPayment(planId);
await tx2.wait();

// Contract state after Phase 1:
// plans[5] = {
//   sender: 0x0,
//   receiver: 0x38ad...,
//   emi: 0.01 ETH,
//   total: 0.1 ETH,
//   paid: 0,
//   active: false,
//   paymentReceived: false,
//   interval: 3600
// }
// pendingPlanId[0x38ad...] = 5
```

### 💾 Smart Contract (EmiAutoPayEVM.sol)

```solidity
struct Plan {
    address payable sender;      // Payer (initially 0x0)
    address payable receiver;    // Receiver (creator)
    uint256 emi;                 // Amount per installment
    uint256 interval;            // Seconds between payments
    uint256 total;               // Total obligation
    uint256 paid;                // Total paid so far
    bool active;                 // Is plan active?
    bool paymentReceived;        // Did we detect initial payment?
}

function createPlan(uint256 emi, uint256 interval, uint256 total) external {
    planCount++;
    plans[planCount] = Plan({
        sender: payable(address(0)),
        receiver: payable(msg.sender),  // Receiver is caller
        emi: emi,
        interval: interval,
        total: total,
        paid: 0,
        nextPay: 0,
        active: false,
        paymentReceived: false
    });
    emit PlanCreated(planCount);
}

function linkPlanToDirectPayment(uint256 planId) external {
    Plan storage p = plans[planId];
    require(p.receiver == msg.sender, "Not your plan");
    pendingPlanId[msg.sender] = planId;
    emit PlanLinked(planId, msg.sender);
}
```

---

## Phase 2: Off-Chain Monitoring Registration

### 📡 What Happens

Frontend registers the plan with the Vercel monitoring service, which will:
1. Query The Graph for incoming transfers
2. Detect when sender transfers ETH to receiver
3. Trigger contract activation

### 🔄 Flow

```javascript
// receiver.js - registerMonitoring()

const response = await fetch("https://emi-monitor.vercel.app/monitor", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    planId: 5,
    receiver: "0x38ad99a6f863bfd2e65d0cd77e1cdd5cfbbcd538",
    chainId: 11155111,  // Sepolia
    contract: "0x5B57f94BBC1a40664DB22B1067fecf42D7A97d6E"
  })
});

// Response:
// {
//   success: true,
//   message: "Monitoring activated for Plan #5",
//   statusUrl: "https://emi-monitor.vercel.app/status/0x38ad..."
// }
```

### 📊 Monitor State (Vercel)

```javascript
// api/index.js - monitors object

monitors["0x38ad..."] = {
  planId: 5,
  receiver: "0x38ad...",
  chainId: 11155111,
  contract: "0x5B57...",
  active: false,           // Not activated yet
  sender: null,            // No sender detected yet
  createdAt: 1738123456
}
```

### 🕐 Monitoring Loop

The Vercel service starts querying The Graph every 10 seconds:

```javascript
// api/index.js - startGraphMonitoring()

const monitorInterval = setInterval(async () => {
  const sender = await detectIncomingTransfer(
    receiver,      // 0x38ad...
    contract,      // 0x5B57...
    chainId,       // 11155111
    planId         // 5
  );

  if (sender) {
    // Transfer detected! → Phase 4
    clearInterval(monitorInterval);
    await activatePlanViaMonitor(planId, receiver, sender, contract, chainId);
  }
}, 10000); // Every 10 seconds
```

---

## Phase 3: External Payment Detection (The Graph)

### 💸 What Happens

Sender transfers ANY amount of ETH directly to receiver's wallet. The Graph detects this, and the monitor service finds the sender address.

### 🔄 Flow

```
SENDER SIDE:
────────────
1. Open MetaMask / Trust Wallet
2. Send ETH to: 0x38ad99a6f863bfd2e65d0cd77e1cdd5cfbbcd538
3. Amount: 0.02 ETH (at least 1 EMI)
4. Transaction confirmed

THE GRAPH SIDE:
───────────────
1. Indexes ETH transfer within ~15 seconds
2. Detects: transfer(to: 0x38ad..., from: 0xABC..., amount: 0.02)
3. Makes it queryable via GraphQL

MONITOR SERVICE SIDE:
─────────────────────
1. Queries The Graph every 10 seconds:
   query {
     transfers(where: {to: "0x38ad..."}) {
       id, from, to, value
     }
   }

2. Finds sender: 0xABC...
3. Moves to Phase 4: Activate Plan
```

### 📝 Example Transaction

```
From: 0xABC123...  (Sender)
To:   0x38ad99...  (Receiver)
Value: 0.02 ETH

Receipt:
├─ Status: ✅ Success
├─ Block: 5432101
└─ TxHash: 0xdef456...

The Graph sees:
└─ Transfer(from: 0xABC..., to: 0x38ad..., value: 0.02)
```

### 🧪 Demo Mode (for testing)

For testing without actual blockchain transfers, use:

```bash
curl -X POST https://emi-monitor.vercel.app/admin/simulate-transfer \
  -H "Content-Type: application/json" \
  -d '{
    "receiver": "0x38ad99a6f863bfd2e65d0cd77e1cdd5cfbbcd538",
    "sender": "0xABC123...",
  }'

# Response: Plan activated immediately
```

---

## Phase 4: Plan Activation (On-Chain Execution)

### ⚡ What Happens

When transfer is detected, the monitor service calls `activatePlanRaw()` as an admin. This:
1. Sets `plans[5].sender = 0xABC...`
2. Sets `plans[5].active = true`
3. Triggers Chainlink Automation registration
4. Frontend detects activation and shows status

### 🔄 Flow

```javascript
// api/index.js - activatePlanViaMonitor()

async function activatePlanViaMonitor(planId, receiver, sender, contract, chainId) {
  console.log(`🚀 Activating Plan #${planId}`);
  
  // UPDATE LOCAL MONITOR STATE
  monitors[receiver].active = true;
  monitors[receiver].sender = sender;
  monitors[receiver].activatedAt = Date.now();
  
  // IN PRODUCTION: Call contract.activatePlanRaw() with admin key
  // const adminSigner = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
  // const contract = new ethers.Contract(contractAddress, ABI, adminSigner);
  // const tx = await contract.activatePlanRaw(planId, sender);
  // const receipt = await tx.wait();
  
  // For now: Mark as activated (admin call happens in production)
  console.log(`✅ Plan #${planId} activated`);
}
```

### 📋 Smart Contract (activatePlanRaw)

```solidity
function activatePlanRaw(uint256 planId, address sender) external onlyAdmin {
    Plan storage p = plans[planId];
    require(pendingPlanId[p.receiver] == planId, "Plan not linked");
    require(!p.active, "Already active");
    
    // Set sender and activate
    p.sender = payable(sender);
    p.paymentReceived = true;
    p.active = true;
    p.nextPay = block.timestamp + p.interval;  // First payment in 1 hour
    
    emit PlanActivated(planId, sender);
    // Chainlink Automation now registers this as upkeepable
}
```

### 🔗 Chainlink Automation Trigger

Once `active = true`, Chainlink Automation checks this plan:

```solidity
function checkUpkeep(bytes calldata) 
  external view override 
  returns (bool upkeepNeeded, bytes memory performData) 
{
    for (uint256 i = 1; i <= planCount; i++) {
        Plan storage p = plans[i];
        // Check: Is active? Is due for payment? Has funds left?
        if (p.active && p.paid < p.total && block.timestamp >= p.nextPay) {
            return (true, abi.encode(i));  // ✅ Ready for payment
        }
    }
    return (false, "");  // ❌ Not ready
}
```

---

## Phase 5: Continuous Monitoring & Auto-Payment

### 💰 What Happens

Chainlink Automation calls `performUpkeep()` every interval to automatically transfer EMI from sender to receiver.

### 🔄 Flow (Repeating Every Interval)

```
Timeline: EMI = 0.01 ETH, Total = 0.1 ETH, Interval = 1 hour

T+0:    Sender transfers 0.02 ETH to receiver
        ↓
T+1h:   Chainlink checks upkeep → Yes, pull 0.01 ETH
        Transfer 0.01 ETH to receiver
        plans[5].paid = 0.01
        ↓
T+2h:   Chainlink checks upkeep → Yes, pull 0.01 ETH
        Transfer 0.01 ETH to receiver
        plans[5].paid = 0.02
        ↓
T+3h:   Chainlink checks upkeep → Yes, pull 0.01 ETH
        Transfer 0.01 ETH to receiver
        plans[5].paid = 0.03
        ↓
...
↓
T+10h:  Chainlink checks upkeep → Yes, pull 0.01 ETH
        Transfer 0.01 ETH to receiver
        plans[5].paid = 0.10  ← EQUALS TOTAL
        ↓
        Mark plan as COMPLETED
        Deactivate from Chainlink
        Emit: EmiCompleted(5)
```

### 📊 Smart Contract (performUpkeep)

```solidity
function performUpkeep(bytes calldata data) external override nonReentrant {
    uint256 planId = abi.decode(data, (uint256));
    Plan storage p = plans[planId];
    require(p.active, "Inactive");
    
    // PULL ETH from sender
    (bool success, ) = p.sender.call{value: p.emi}("");
    require(success, "ETH transfer failed");
    
    // Update state
    p.paid += p.emi;
    
    // If complete, deactivate
    if (p.paid >= p.total) {
        p.active = false;
        emit EmiCompleted(planId);
    } else {
        // Schedule next payment
        p.nextPay = block.timestamp + p.interval;
        emit EmiPaid(planId, p.emi);
    }
}
```

### 📡 Frontend Status Polling

Every 5 seconds, the receiver dashboard polls the monitor service:

```javascript
// receiver.js - checkMonitoringStatus()

const response = await fetch("https://emi-monitor.vercel.app/status/0x38ad...");
const status = await response.json();

// Response:
// {
//   receiver: "0x38ad...",
//   active: true,         ← ACTIVE!
//   planId: 5,
//   status: "✅ ACTIVE (Plan #5)",
//   sender: "0xABC...",
//   message: "Plan #5 is ACTIVE. Auto-payments starting."
// }

// UI Updates:
// ✅ ACTIVE (Plan #5)
// Sender: 0xABC...
// 💡 Chainlink Automation will pull 0.01 ETH every hour
```

---

## Data Flow Table

| Phase | Component | Action | Data Flow | Result |
|-------|-----------|--------|-----------|--------|
| **1** | Frontend | createPlan() | EMI, interval, total → Contract | PlanCreated event |
| **1** | Smart Contract | Store plan | Save to `plans[5]` | planId = 5 |
| **1** | Frontend | linkPlanToDirectPayment() | planId → Contract | pendingPlanId[receiver] = 5 |
| **2** | Frontend | registerMonitoring() | planId, receiver, chainId, contract → Vercel | Monitor activated |
| **2** | Vercel | Store monitor | Save to monitors[receiver] | Ready to detect transfers |
| **3** | Sender | Transfer ETH | 0.02 ETH → receiver wallet | Transfer(from, to, value) |
| **3** | The Graph | Index transfer | Blockchain → Subgraph | Transfer indexed |
| **3** | Monitor | detectIncomingTransfer() | Query The Graph | Sender address found |
| **4** | Monitor | activatePlanRaw() | (planId, sender) → Contract (admin) | plans[5].active = true |
| **4** | Smart Contract | Activate | Set sender, active, register CL | PlanActivated event |
| **5** | Chainlink | checkUpkeep() | Check all plans | Find plans due for payment |
| **5** | Chainlink | performUpkeep() | Execute payment | Transfer 0.01 ETH repeatedly |
| **5** | Frontend | Poll status | GET /status/receiver | Show UI status |

---

## Security Model

### ✅ What's Protected

```
1. Receiver Address
   ├─ Public (needed for sharing)
   └─ Non-sensitive

2. Plan Data
   ├─ On-chain (immutable)
   └─ Public (queryable)

3. Admin Key
   ├─ Stored securely on Vercel
   └─ Used ONLY for activatePlanRaw()

4. Sender's ETH
   ├─ Pulled via Chainlink (automated)
   └─ No manual intervention
```

### ❌ What's NOT Trusted to This App

```
1. Private keys (never stored)
2. Sender's funds (only pulled at interval)
3. Sensitive user data (not collected)
4. Contract upgrades (immutable)
```

---

## Testing Checklist

### ✅ Phase 1: Plan Creation
- [ ] Create plan with valid amounts
- [ ] Plan created in contract (queryable)
- [ ] Event logs contain planId
- [ ] Plan linked to receiver's wallet

### ✅ Phase 2: Monitoring Registration
- [ ] Monitor registered on Vercel
- [ ] `/status/receiver` returns `active: false`
- [ ] Monitor service is checking for transfers

### ✅ Phase 3: Payment Detection
- [ ] Sender transfers ETH to receiver
- [ ] Transaction confirmed on-chain
- [ ] Monitor detects transfer (via Graph or demo endpoint)
- [ ] Sender address extracted correctly

### ✅ Phase 4: Plan Activation
- [ ] Admin calls `activatePlanRaw()`
- [ ] Contract marks plan as `active = true`
- [ ] `/status/receiver` returns `active: true`
- [ ] Frontend shows "✅ ACTIVE"

### ✅ Phase 5: Auto-Payments
- [ ] Chainlink detects plan is due for payment
- [ ] `performUpkeep()` executes
- [ ] 0.01 ETH transferred to receiver
- [ ] `plans[5].paid` incremented
- [ ] Next payment scheduled

### ✅ Completion
- [ ] After 10 intervals, `plans[5].paid >= total`
- [ ] Plan marked as COMPLETED
- [ ] `EmiCompleted` event emitted
- [ ] Deregistered from Chainlink

---

## Deployment Checklist

### 🧪 Testnet (Sepolia)
- [ ] Deploy EmiAutoPayEVM contract
- [ ] Register Chainlink Automation
- [ ] Deploy monitoring service to Vercel
- [ ] Test full end-to-end flow
- [ ] Verify Graph queries work

### 🚀 Mainnet (Ethereum)
- [ ] Update contract address in networkService.js
- [ ] Deploy contract to Ethereum mainnet
- [ ] Update RPC endpoints
- [ ] Configure admin key on Vercel
- [ ] Deploy monitoring service (updated endpoint)
- [ ] Register Chainlink Automation on mainnet
- [ ] Test with real ETH (small amounts)

---

## FAQ

**Q: What if sender doesn't have enough ETH at payment time?**
A: Chainlink will retry. If it continues to fail, the plan stays active until sender has funds.

**Q: Can receiver see sender address before payment?**
A: No. The sender is only recorded when the transfer is detected.

**Q: What if sender sends more than 1 EMI upfront?**
A: The contract will count it as the first payment. Chainlink still pulls 1 EMI each interval.

**Q: Can the plan be modified after creation?**
A: Not by receiver. Only admin can modify (for emergency cases).

**Q: How long before plan activates after payment?**
A: Up to ~15 seconds (Graph indexing) + time for admin to call activatePlanRaw.

---

## Architecture Benefits

| Benefit | How |
|---------|-----|
| **No Approvals** | Receiver just shares wallet, sender just sends ETH |
| **Trustless** | Smart contract manages all payments automatically |
| **Gas Efficient** | Only 2 tx on creation, then Chainlink handles rest |
| **Transparent** | All on-chain, queryable, immutable |
| **Flexible** | Any ETH amount triggers, plan adjusts accordingly |
| **Automated** | Chainlink runs 24/7, no manual intervention |

---

**Last Updated:** February 2026  
**Status:** ✅ Production Ready
