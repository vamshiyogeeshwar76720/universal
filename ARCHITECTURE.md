# System Architecture Diagram

## Complete System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER BROWSER ENVIRONMENT                      │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              RECEIVER DASHBOARD (main.html)               │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  Wallet Connection UI                              │ │  │
│  │  │  ├─ Connect Wallet Button                          │ │  │
│  │  │  ├─ Disconnect Button                              │ │  │
│  │  │  └─ Address Display (0x38ad...9538)               │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  Network Selection & Display                        │ │  │
│  │  │  ├─ Network Dropdown (Sepolia/Mainnet/Polygon)    │ │  │
│  │  │  └─ Network Name & Currency Display               │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  EMI Plan Creation Form                             │ │  │
│  │  │  ├─ EMI Amount Input (e.g., 0.01 ETH)             │ │  │
│  │  │  ├─ Total Amount Input (e.g., 0.1 ETH)            │ │  │
│  │  │  ├─ Payment Interval Dropdown                       │ │  │
│  │  │  │  ├─ 1 Hour / 3 Hours / 6 Hours / 12 Hours      │ │  │
│  │  │  │  ├─ Daily / Weekly / Monthly                    │ │  │
│  │  │  │  └─ Custom (minutes)                            │ │  │
│  │  │  └─ Create EMI Plan Button                         │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  Success Screen & Sharing (After Plan Creation)    │ │  │
│  │  │  ├─ Plan ID Display (Plan #5)                      │ │  │
│  │  │  ├─ Receiver Wallet Address                        │ │  │
│  │  │  ├─ MetaMask Deep Link + Copy Button              │ │  │
│  │  │  ├─ Trust Wallet Deep Link + Copy Button          │ │  │
│  │  │  ├─ QR Code (MetaMask)                            │ │  │
│  │  │  ├─ QR Code (Trust Wallet)                        │ │  │
│  │  │  └─ Monitoring Status (✅ ACTIVE / ⏳ WAITING)     │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘ │  │
│                                                                   │
└───────────────────────────┬───────────────────────────────────────┘
                            │
                ┌───────────┼───────────┬─────────────────┐
                │           │           │                 │
                ▼           ▼           ▼                 ▼
         ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
         │   Wallet  │ │ Network  │ │  Local   │ │    Smart     │
         │  Service  │ │ Service  │ │ Storage  │ │  Contracts   │
         │           │ │          │ │          │ │              │
         └───────────┘ └──────────┘ └──────────┘ └──────────────┘
             │             │              │              │
             │             │              │              │
   ┌─────────▼──────────────▼──────────────▼──────────────▼─────────┐
   │                    KEY OPERATIONS                               │
   └────────────────────────────────────────────────────────────────┘

```

## Module Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    RECEIVER.JS                              │
│              (Main Application Logic)                       │
│                                                             │
│  initApp()                                                 │
│    ├─ populateNetworkSelect()                             │
│    ├─ setupIntervalToggle()                               │
│    ├─ WalletService.onConnectionStateChange()             │
│    ├─ WalletService.initializeWallet()                    │
│    └─ setupEventListeners()                               │
└──────────┬──────────────────────────┬──────────────────────┘
           │                          │
           │                          │
     ┌─────▼──────────────┐    ┌──────▼─────────────┐
     │  WALLET SERVICE    │    │ NETWORK SERVICE    │
     │  walletService.js  │    │ networkService.js  │
     │                    │    │                    │
     │ FUNCTIONS:         │    │ FUNCTIONS:         │
     │ ├─ detect          │    │ ├─ getConfig       │
     │ ├─ connect         │    │ ├─ switch          │
     │ ├─ autoConnect     │    │ ├─ validate        │
     │ ├─ disconnect      │    │ ├─ getContract     │
     │ ├─ setupListeners  │    │ ├─ getRpc          │
     │ ├─ getState        │    │ ├─ getCurrency     │
     │ └─ formatAddress   │    │ └─ getExplorerUrl  │
     │                    │    │                    │
     │ STATE:             │    │ CONFIG:            │
     │ ├─ provider        │    │ ├─ chainId → config│
     │ ├─ signer          │    │ ├─ RPC endpoints   │
     │ ├─ address         │    │ ├─ Contracts       │
     │ ├─ chainId         │    │ └─ Networks (6)    │
     │ └─ isConnected     │    │                    │
     └──────┬─────────────┘    └────────┬──────────┘
            │                           │
            │                           │
   ┌────────▼──────────────────────────▼────────┐
   │       PERSISTENT STATE (localStorage)       │
   │  ├─ emi_wallet_connected: "true"           │
   │  ├─ emi_wallet_address: "0x..."            │
   │  ├─ emi_chain_id: "11155111"               │
   │  └─ emi_provider_type: "metamask"          │
   └────────┬─────────────────────────────────────┘
            │
            └──────────────────────────────────────┐
                                                   │
                                    ┌──────────────▼───────────┐
                                    │ User Browser Storage     │
                                    │ Persists across         │
                                    │ - Reloads               │
                                    │ - Navigation            │
                                    │ - Closing & reopening   │
                                    └─────────────────────────┘
```

## Transaction Flow - EMI Plan Creation

```
USER INTERACTION PHASE
├─ User enters EMI amount: 0.01 ETH
├─ User enters Total amount: 0.1 ETH
├─ User selects interval: Daily (86400 seconds)
└─ User clicks "Create EMI Plan"

               │
               ▼

VALIDATION PHASE
├─ Check wallet connected: ✅
├─ Check network synced: ✅
├─ Validate EMI > 0: ✅
├─ Validate Total >= EMI: ✅
├─ Validate Interval >= 60s: ✅
└─ All checks passed → Proceed

               │
               ▼

BLOCKCHAIN PHASE - TRANSACTION 1: createPlan()

receiver.js
  │
  ├─ Parse inputs:
  │  ├─ emiWei = parseEther("0.01") = 10000000000000000
  │  ├─ totalWei = parseEther("0.1") = 100000000000000000
  │  └─ intervalSeconds = 86400
  │
  └─ Call contract.createPlan(emiWei, intervalSeconds, totalWei)
      │
      ▼
  Smart Contract (Solidity)
      │
      ├─ Validate inputs
      ├─ Create plan struct:
      │  {
      │    planId: 5,
      │    receiver: msg.sender,
      │    sender: 0x0,
      │    emiAmount: emiWei,
      │    totalAmount: totalWei,
      │    paid: 0,
      │    interval: intervalSeconds,
      │    active: false,
      │    paymentReceived: false
      │  }
      ├─ Store in mapping: plans[5] = {...}
      ├─ Emit event: PlanCreated(5)
      └─ Update planCount++
      
  Blockchain
      │
      ├─ TX included in mempool
      ├─ Miners pick up TX
      ├─ TX mined in block
      ├─ 12 confirmations (safety)
      └─ Receipt returned

  receiver.js
      │
      ├─ await tx.wait()
      ├─ Parse receipt.logs
      ├─ Find PlanCreated event
      ├─ Extract planId = 5
      └─ Store currentPlanId = "5"

               │
               ▼

BLOCKCHAIN PHASE - TRANSACTION 2: linkPlanToDirectPayment()

receiver.js
  │
  └─ Call contract.linkPlanToDirectPayment(planId)
      │
      ▼
  Smart Contract (Solidity)
      │
      ├─ Validate sender is receiver
      ├─ Link wallet → plan:
      │  pendingPlanId[msg.sender] = planId
      ├─ Emit event: PlanLinked(5, msg.sender)
      └─ Return
      
  Blockchain
      │
      ├─ TX mined
      └─ Receipt returned

  receiver.js
      │
      ├─ await tx.wait()
      └─ Continue to monitoring

               │
               ▼

OFF-CHAIN PHASE - MONITORING REGISTRATION

receiver.js
  │
  └─ POST to: https://emi-monitor.vercel.app/monitor
      │
      Body: {
        planId: "5",
        receiver: "0x38ad99a6f863bfd2e65d0cd77e1cdd5cfbbcd538",
        chainId: 11155111,
        contract: "0x5B57f94BBC1a40664DB22B1067fecf42D7A97d6E"
      }
      │
      ▼
  Vercel API
      │
      ├─ Store in memory: global.monitors[receiver] = {planId, active: true}
      └─ Return: {status: "monitoring", planId: 5}

  receiver.js
      │
      ├─ Monitor registered ✅
      └─ Continue to UI update

               │
               ▼

SUCCESS DISPLAY PHASE

receiver.js
  │
  ├─ Show success screen:
  │  ├─ ✅ EMI Plan #5 Created!
  │  ├─ Share YOUR WALLET: 0x38ad...9538
  │  ├─ Receiver sends ANY ETH → Auto EMI starts!
  │  └─ Copy Wallet Address button
  │
  ├─ Generate sharing links:
  │  ├─ MetaMask: https://metamask.app.link/dapp/...
  │  └─ Trust: ethereum:0x38ad...?value=0.01&text=...
  │
  ├─ Generate QR codes:
  │  ├─ MetaMask QR code (scannable)
  │  └─ Trust Wallet QR code (scannable)
  │
  └─ Start monitoring status:
      Every 5 seconds:
      ├─ GET /status/0x38ad...
      ├─ Check if payment received
      ├─ Update UI: "✅ ACTIVE (Plan #5)"
      └─ Monitor until completion

               │
               ▼

USER SHARES PLAN

User copies address/link/QR and sends to Sender

Sender transfers ETH to: 0x38ad99a6f863bfd2e65d0cd77e1cdd5cfbbcd538

               │
               ▼

OFF-CHAIN MONITORING

Monitoring service queries The Graph:
├─ Detects incoming ETH transfer
├─ Extracts sender address
└─ Calls contract.activatePlanRaw(5, sender_address)

               │
               ▼

PLAN ACTIVATION & EXECUTION

Smart Contract:
├─ plans[5].sender = sender_address
├─ plans[5].active = true
├─ Register with Chainlink Automation
└─ Automation starts executing every 86400s (daily)

Each execution:
├─ Check: paid < totalAmount
├─ Transfer: emiAmount to sender
├─ Update: paid += emiAmount
├─ Emit: PaymentReceived event
└─ Repeat until paid >= totalAmount

               │
               ▼

COMPLETION

When paid >= totalAmount:
├─ Emit: PlanCompleted event
├─ Chainlink stops execution
├─ UI shows: ✅ Plan Complete
└─ Receiver can create new plan
```

## Network Detection & Switching Flow

```
PAGE LOADS
│
├─ WalletService.detectWalletProvider()
│  │
│  ├─ Check window.ethereum?.isMetaMask → MetaMask
│  ├─ Check window.trustWallet → Trust Wallet
│  ├─ Check window.coinbaseWalletProvider → Coinbase
│  ├─ Check window.BinanceChain → Binance
│  ├─ Check window.okxwallet → OKX
│  └─ Fallback to window.ethereum → Generic EIP-1193
│
├─ User previously connected?
│  │
│  ├─ YES: localStorage.getItem("emi_wallet_connected") === "true"
│  │   │
│  │   ├─ WalletService.autoConnect()
│  │   ├─ Silent reconnect (NO popup)
│  │   └─ Emit connection event
│  │
│  └─ NO: Show "Connect Wallet" button
│
├─ User clicks "Connect Wallet"
│  │
│  ├─ provider.send("eth_requestAccounts", [])
│  ├─ MetaMask popup appears
│  ├─ User approves
│  └─ Connection saved to localStorage
│
├─ Get current network:
│  │
│  ├─ provider.getNetwork()
│  └─ Extract chainId (e.g., 11155111)
│
├─ Validate network:
│  │
│  ├─ NetworkService.getNetworkConfig(chainId)
│  │
│  ├─ IF FOUND:
│  │  ├─ Network is supported ✅
│  │  ├─ Display network name & currency
│  │  ├─ Load contract address
│  │  └─ Create contract instance
│  │
│  └─ IF NOT FOUND:
│     ├─ Network not supported ❌
│     ├─ Show error: "Wrong network"
│     ├─ Offer: "Switch to Sepolia?"
│     │
│     └─ If user agrees:
│        ├─ NetworkService.requestNetworkSwitch(11155111)
│        ├─ Check if chain in wallet
│        │
│        ├─ IF NOT: Add chain with wallet_addEthereumChain (EIP-3085)
│        │   └─ User approves adding chain
│        │
│        ├─ Switch to chain with wallet_switchEthereumChain (EIP-3035)
│        │   └─ User approves switch
│        │
│        ├─ Fire chainChanged event
│        └─ Repeat validation
│
└─ Ready for EMI plan creation ✅

USER SWITCHES NETWORK IN WALLET
│
├─ Wallet emits 'chainChanged' event
├─ walletService listener catches it
├─ onWalletStateChange(newState) fired
├─ receiver.js syncToCurrentNetwork(newChainId)
├─ Validate new network
├─ Update UI
└─ Ready for operations on new network ✅
```

## Error Handling & Recovery Flow

```
ERROR OCCURS
│
├─ try/catch block catches error
├─ console.error() logs error
│
├─ DETERMINE ERROR TYPE:
│  │
│  ├─ "No wallet detected"
│  │  └─ Message: "Install MetaMask or Trust Wallet"
│  │
│  ├─ "User rejected request"
│  │  └─ Message: "Please approve in wallet"
│  │
│  ├─ "Network not supported"
│  │  ├─ Message: "Wrong network. Switch to Sepolia?"
│  │  └─ Offer automatic switch
│  │
│  ├─ "Wallet not connected"
│  │  └─ Message: "Please connect wallet first"
│  │
│  ├─ "Invalid amount"
│  │  └─ Message: "Enter valid positive amounts"
│  │
│  ├─ "Transaction failed"
│  │  └─ Message: "Transaction failed. Check gas"
│  │
│  ├─ "Event not found"
│  │  └─ Message: "Failed to process plan"
│  │
│  └─ "Contract not initialized"
│     └─ Message: "Network sync failed. Try again"
│
├─ SHOW USER-FRIENDLY MESSAGE:
│  │
│  ├─ Use alert() or toast notification
│  ├─ Avoid technical jargon
│  ├─ Suggest action (e.g., "Try again" or "Switch network")
│  └─ Log full error to console for debugging
│
├─ ATTEMPT RECOVERY:
│  │
│  ├─ IF network issue:
│  │  └─ Try automatic network switch
│  │
│  ├─ IF connection issue:
│  │  └─ Prompt "Connect Wallet" again
│  │
│  └─ IF input issue:
│     └─ Clear invalid input, show form again
│
└─ READY FOR RETRY ✅
```

---

## Summary of Communication Flows

| Flow | Direction | Trigger | Response |
|------|-----------|---------|----------|
| Wallet Detection | Frontend → Browser | Page load | Wallet provider object |
| Connection | Frontend → Wallet | Click "Connect" | Account address |
| Network Query | Frontend → Provider | After connect | Chain ID |
| Network Switch | Frontend → Wallet | Dropdown change | Chain switched event |
| Create Plan | Frontend → Smart Contract | Click "Create" | Transaction hash |
| Event Parse | Frontend ← Smart Contract | TX mined | Plan ID extracted |
| Monitoring Register | Frontend → Vercel API | After link | Monitoring started |
| Status Check | Frontend ← Vercel API | Every 5s | Active/waiting status |
| Payment Activation | Smart Contract ← Monitoring | Payment detected | Plan activated |
| EMI Execution | Smart Contract → User | Every interval | ETH transferred |

---

**Architecture Version:** 2.0  
**Last Updated:** February 2026  
**Status:** Production Ready ✅
