# 🧪 End-to-End Testing Guide: EMI Auto-Payment System

## Prerequisites

- MetaMask / Trust Wallet installed
- 0.2+ ETH on Sepolia testnet ([Faucet](https://sepoliafaucet.com/))
- Monitor service deployed to Vercel
- Local server running on http://localhost:8000

---

## Phase 1: Plan Creation (On-Chain Setup)

### Test Steps

**1. Open Receiver Dashboard**
```
http://localhost:8000/main.html
```

**2. Connect Wallet**
```
Click "Connect Wallet"
→ MetaMask popup appears
→ Select Sepolia testnet (if needed)
→ Approve connection
→ See address displayed
```

**3. Create EMI Plan**
```
Form:
  Blockchain: Sepolia
  EMI Amount: 0.01
  Total Amount: 0.1
  Interval: 1 Hour
  
Click "Create EMI Plan"
→ "Creating Plan..." (10-15 seconds)
→ "Linking Plan..." (5 seconds)
→ "Registering Monitor..." (2 seconds)
→ Success page appears
```

### Expected Output

✅ **Success Screen Shows:**
```
✅ EMI Plan #5 Created!
Share YOUR WALLET ADDRESS:
0x38ad99a6f863bfd2e65d0cd77e1cdd5cfbbcd538

💡 Sender sends ANY ETH → Auto EMI payments start!
```

✅ **Console Logs Show:**
```
✅ Plan creation tx sent: 0x123abc...
✅ Plan creation confirmed
📦 Plan ID: 5
✅ Link tx sent: 0x456def...
✅ Plan linked to direct payment
✅ Monitor registered: {
  success: true,
  message: "Monitoring activated for Plan #5",
  statusUrl: "https://emi-monitor.vercel.app/status/0x38ad..."
}
```

### Verify on Chain

Open [Sepolia Etherscan](https://sepolia.etherscan.io) and search contract:
```
0x5B57f94BBC1a40664DB22B1067fecf42D7A97d6E

Check:
  ✅ createPlan() transaction
  ✅ PlanCreated(5) event log
  ✅ linkPlanToDirectPayment() transaction
  ✅ PlanLinked(5) event log
```

---

## Phase 2: Monitoring Registration

### Test Steps

**1. Check Vercel Service Status**
```bash
curl https://emi-monitor.vercel.app/admin/monitors

Response:
{
  "count": 1,
  "monitors": {
    "0x38ad...": {
      "planId": 5,
      "receiver": "0x38ad...",
      "chainId": 11155111,
      "contract": "0x5B57...",
      "active": false,
      "sender": null,
      "createdAt": 1738123456
    }
  }
}
```

**2. Check Monitor Status**
```bash
curl https://emi-monitor.vercel.app/status/0x38ad...

Response:
{
  "receiver": "0x38ad...",
  "active": false,
  "planId": 5,
  "status": "⏳ WAITING",
  "sender": null,
  "message": "Plan #5 awaiting first payment..."
}
```

**3. Frontend Status (5-second polling)**
```
Monitor Status Section Shows:
  ✅ PLAN STATUS: ⏳ WAITING
  ✅ SENDER: Not detected yet
  ✅ WHAT'S HAPPENING: 
     Waiting for sender to transfer ETH to your wallet address...
```

### Expected Output

✅ **Monitor registered and waiting for payment**

---

## Phase 3: Payment Detection (The Graph)

### Test Steps

**Option A: Real Transfer (Actual Blockchain)**

```
1. Open different MetaMask account (as "Sender")
2. Send 0.02 ETH to receiver's wallet:
   
   From: 0xABC123... (Sender)
   To: 0x38ad99a6f863bfd2e65d0cd77e1cdd5cfbbcd538 (Receiver)
   Amount: 0.02 ETH
   
3. Wait for confirmation (~15-20 seconds)
4. The Graph indexes transfer (~10-15 seconds more)
5. Monitor service detects transfer (next 10-second check)
```

**Option B: Simulated Transfer (For Testing)**

```bash
# Simulate transfer without waiting for blockchain/Graph
curl -X POST https://emi-monitor.vercel.app/admin/simulate-transfer \
  -H "Content-Type: application/json" \
  -d '{
    "receiver": "0x38ad99a6f863bfd2e65d0cd77e1cdd5cfbbcd538",
    "sender": "0xABC123456789..."
  }'

Response:
{
  "success": true,
  "message": "Simulated transfer received. Plan #5 activated.",
  "monitor": {
    "planId": 5,
    "receiver": "0x38ad...",
    "active": true,
    "sender": "0xABC...",
    "activatedAt": 1738123999
  }
}
```

### Expected Output

✅ **Transfer detected and plan activated**

---

## Phase 4: Plan Activation

### Test Steps

**1. Check Monitor Status (should now be active)**
```bash
curl https://emi-monitor.vercel.app/status/0x38ad...

Response:
{
  "receiver": "0x38ad...",
  "active": true,          ← CHANGED TO TRUE
  "planId": 5,
  "status": "✅ ACTIVE (Plan #5)",
  "sender": "0xABC...",
  "message": "Plan #5 is ACTIVE. Auto-payments starting."
}
```

**2. Frontend Status Update (polling detects it)**
```
Monitor Status Section Updates:
  ✅ PLAN STATUS: ✅ ACTIVE (Plan #5)
  ✅ SENDER: 0xABC123...
  ✅ WHAT'S HAPPENING: 
     ✅ Plan activated! Chainlink Automation started. 
     Auto-payments will be pulled from sender 0xABC... every hour.
```

**3. Console Shows**
```
📡 Status: {
  receiver: "0x38ad...",
  active: true,
  planId: 5,
  sender: "0xABC...",
  message: "Plan #5 is ACTIVE..."
}
```

**4. Verify on Chain (Optional)**
```
Check contract on Etherscan:
  ✅ plans[5].active = true
  ✅ plans[5].sender = 0xABC...
  ✅ plans[5].paymentReceived = true
  ✅ PlanActivated(5, 0xABC...) event emitted
```

### Expected Output

✅ **Plan activated! Chainlink monitoring is now active**

---

## Phase 5: Auto-Payment Execution

### Test Steps

**For Sepolia Testnet (1-hour intervals in this example):**

**1. Chainlink Checks Every Interval**
```
After 1 hour:
  Chainlink Keeper checks: plans[5].active && block.timestamp >= nextPay?
  → Yes! Execute performUpkeep(5)
  → Transfer 0.01 ETH from sender to receiver
  → plans[5].paid = 0.01
```

**2. Monitor Payment (Etherscan)**
```
Check Sepolia Etherscan:
  ✅ Automatic transfer of 0.01 ETH
  ✅ From sender wallet to receiver wallet
  ✅ EmiPaid(5, 0.01) event emitted
  ✅ Triggered by Chainlink Keeper
```

**3. Check Plan State**
```javascript
// Via etherscan or your provider
const plan = await contract.plans(5);

console.log({
  paid: ethers.utils.formatEther(plan.paid),  // "0.01"
  total: ethers.utils.formatEther(plan.total),  // "0.1"
  active: plan.active,  // true (still 9 more payments left)
  nextPay: plan.nextPay  // Block timestamp + 1 hour
});
```

**4. Repeat Every Interval**
```
T+0:    Initial payment detected → Plan activates
T+1hr:  Chainlink pays 0.01 ETH → paid = 0.01
T+2hr:  Chainlink pays 0.01 ETH → paid = 0.02
T+3hr:  Chainlink pays 0.01 ETH → paid = 0.03
...
T+10hr: Chainlink pays 0.01 ETH → paid = 0.10 (COMPLETE)
        → Plan deactivates
        → EmiCompleted(5) emitted
```

### Expected Output

✅ **Automatic payments flowing every interval**

---

## Phase 5: Completion

### Test Steps

**After 10 Intervals (10 hours for 1-hour intervals):**

**1. Final Payment**
```
The 10th payment brings paid = 0.1 = total

Chainlink executes last performUpkeep(5):
  ✅ Transfer 0.01 ETH (final)
  ✅ plans[5].paid = 0.1
  ✅ paid >= total? YES
  ✅ plans[5].active = false
  ✅ Emit EmiCompleted(5)
```

**2. Check Final State**
```
curl https://emi-monitor.vercel.app/status/0x38ad...

Response:
{
  "receiver": "0x38ad...",
  "active": false,  ← PLAN COMPLETED
  "planId": 5,
  "message": "Plan #5 is COMPLETED. All payments made."
}
```

**3. Frontend Shows Completion**
```
Monitor Status Section:
  ✅ PLAN STATUS: ✅ COMPLETED
  ✅ All 10 EMI payments done!
  ✅ Total received: 0.1 ETH
```

### Expected Output

✅ **Plan completed! All payments received**

---

## Quick Test Scenario (15 minutes)

For faster testing with shorter intervals:

```javascript
// Form inputs for quick test:
EMI Amount:    0.01 ETH
Total Amount:  0.03 ETH (3 installments)
Interval:      60 seconds (1 minute)

Timeline:
T+0:   Create plan, register monitor
T+30s: Sender transfers 0.02 ETH
T+40s: Plan activates (Graph + admin call)
T+1m:  Chainlink pays 0.01 → paid = 0.01
T+2m:  Chainlink pays 0.01 → paid = 0.02
T+3m:  Chainlink pays 0.01 → paid = 0.03 (COMPLETE)
Total: ~3 minutes to completion
```

---

## Troubleshooting

### ❌ Plan Creation Fails
```
Error: "Network mismatch"
→ Make sure you're on Sepolia testnet
→ Check MetaMask is connected

Error: "Contract interaction failed"
→ Verify contract address in networkService.js
→ Check RPC endpoint is working
```

### ❌ Monitor Not Registering
```
Error: "Failed to reach Vercel"
→ Check: https://emi-monitor.vercel.app/admin/monitors
→ Verify frontend can reach Vercel (CORS enabled)

Error: "Monitor registered but not detecting transfers"
→ Use /admin/simulate-transfer to test without blockchain
→ Check Graph API is responding
```

### ❌ Plan Not Activating
```
Status shows "WAITING" after 30 seconds
→ Use /admin/simulate-transfer to trigger activation
→ Check if sender has funds on testnet

Status shows "ACTIVE" but no payments
→ Wait for Chainlink (configured on testnet)
→ Check Sepolia Etherscan for failed transactions
```

### ❌ Chainlink Not Paying
```
Upkeep not executing
→ Verify Chainlink Automation is registered on testnet
→ Check contract has sufficient LINK balance
→ Verify gas prices aren't too high

Payment failed
→ Sender account may be out of funds
→ Check Sepolia testnet balance
```

---

## Verification Commands

### Check Contract State
```javascript
// Get plan details
const plan = await contract.plans(5);
console.log({
  sender: plan.sender,
  receiver: plan.receiver,
  emi: ethers.utils.formatEther(plan.emi),
  total: ethers.utils.formatEther(plan.total),
  paid: ethers.utils.formatEther(plan.paid),
  interval: plan.interval.toString(),
  active: plan.active,
  nextPay: new Date(plan.nextPay.toNumber() * 1000)
});

// Check pending plan for receiver
const pendingId = await contract.pendingPlanId("0x38ad...");
console.log("Pending Plan ID:", pendingId.toString());
```

### Monitor Service Endpoints
```bash
# Get all monitors
curl https://emi-monitor.vercel.app/admin/monitors

# Get specific status
curl https://emi-monitor.vercel.app/status/0x38ad...

# Simulate transfer (for testing)
curl -X POST https://emi-monitor.vercel.app/admin/simulate-transfer \
  -H "Content-Type: application/json" \
  -d '{"receiver":"0x38ad...","sender":"0xABC..."}'

# Clear all monitors (testing only)
curl -X POST https://emi-monitor.vercel.app/admin/clear
```

---

## Success Criteria

- ✅ Plan creates successfully
- ✅ Monitor registers and shows "WAITING"
- ✅ Transfer detected within 30 seconds
- ✅ Plan shows "ACTIVE" with sender address
- ✅ Chainlink pays every interval (check Etherscan)
- ✅ Plan shows "COMPLETED" after all payments
- ✅ Total received = 0.1 ETH
- ✅ No errors in console

---

## Performance Notes

| Operation | Time | Notes |
|-----------|------|-------|
| Plan creation tx | 10-15s | Depends on network congestion |
| Plan linking tx | 5-10s | Fast, low gas |
| Monitor registration | <1s | Instant |
| Graph indexing | 10-15s | Can vary |
| Admin activation | 10-20s | On-demand |
| Status polling | 5s interval | Frontend polling |
| Chainlink payment | 20-40s | Once per interval |

---

## Notes

- **Testnet Only:** Use Sepolia for testing before mainnet
- **Interval Flexibility:** Can set intervals from 60s to months (adjust in createPlan)
- **No Upfront Funds:** Receiver doesn't hold funds; pulled on demand
- **Trustless:** All operations on-chain and verifiable

---

**Last Updated:** February 2026  
**Status:** ✅ Ready for Testing
