# Transaction Flow Reference

## Before Fix (❌ Broken)

```
User clicks MAD
    ↓
Fetch USDT contract
    ↓
Create contract with incomplete ABI
    ├─ Has: approve()
    └─ Missing: balanceOf() ❌
    ↓
Try to check balance
    ↓
balanceOf() function not in ABI ❌
    ↓
Balance check fails silently
    ↓
Validation reports: "Insufficient USDT balance"
    ↓
Transaction blocked ❌
    ↓
User confused: "But I have 49,400 USDT!"
```

---

## After Fix (✅ Working)

```
User clicks MAD
    ↓
Fetch USDT contract
    ↓
Create contract with COMPLETE ERC20 ABI ✅
    ├─ approve() ✅
    ├─ balanceOf() ✅ NEW
    ├─ allowance() ✅ NEW
    ├─ transfer() ✅ NEW
    └─ transferFrom() ✅ NEW
    ↓
Check balance ✅
    ├─ User balance: 49,400 USDT ✅
    ├─ Required: 500 USDT ✅
    └─ Sufficient: YES ✅
    ↓
Validate all conditions ✅
    ├─ USDT balance: ✅ 49,400 ≥ 500
    ├─ Plan exists: ✅
    └─ ETH for gas: ✅ (≥ 0.01)
    ↓
Apply 2-second buffer time
    ↓
Request approval from MetaMask ✅
    ├─ User approves: 500 USDT
    └─ Transaction confirmed
    ↓
Activate EMI ✅
    └─ MAD function called
    ↓
Display success popup ✅
    └─ "EMI activated successfully"
    ↓
Transaction complete ✅
```

---

## Decision Tree for Troubleshooting

```
                    User clicks MAD
                           ↓
                    ┌──────┴──────┐
                    │             │
        Gets "Insufficient USDT"  Other Error
                    │             │
                    ↓             ↓
            Check console    │  Check Error Message
            for balance      │  └─→ "Rejected by user"? 
            amounts          │      → User needs to approve
                    ↓        │  └─→ "Insufficient ETH"?
         ┌──────────┴──────────┐  → Add 0.01+ ETH
         │                     │  └─→ "Network error"?
    Have ≥ Need?          Have < Need?  → Try again later
         │                     │
         ↓                     ↓
    Verify ABI            Add more USDT
    is complete           to wallet
         ↓                     ↓
    Check contract     Retry transaction
    address                   ↓
         ↓             Success ✅
    Should work        or Failure ❌
```

---

## Validation Sequence

```
VALIDATION STARTS
    ↓
Step 1: Check Plan Validity
    ├─ plan exists? YES ✅
    └─ receiver != address(0)? YES ✅
    ↓
Step 2: Check USDT Balance
    ├─ call usdtContract.balanceOf(sender) ✅
    ├─ balance = 49,400 USDT ✅
    ├─ required = 500 USDT ✅
    └─ 49,400 ≥ 500? YES ✅
    ↓
Step 3: Check ETH for Gas
    ├─ call provider.getBalance(sender) ✅
    ├─ ethBalance = 0.05 ETH ✅
    ├─ minRequired = 0.01 ETH ✅
    └─ 0.05 ≥ 0.01? YES ✅
    ↓
All checks PASSED ✅
    ↓
VALIDATION SUCCESS
```

---

## Approval Retry Logic

```
User needs approval? YES
    ↓
Attempt 1
    ├─ Show MetaMask popup
    ├─ Wait for user action
    └─ Result?
        ├─ Approved → SUCCESS ✅
        ├─ Rejected → FAIL (no retry) ❌
        └─ Timeout (30s) → Continue to Attempt 2
            ↓
        Apply 2-second buffer
            ↓
        Attempt 2
            ├─ Show MetaMask popup again
            ├─ Wait for user action
            └─ Result?
                ├─ Approved → SUCCESS ✅
                ├─ Rejected → FAIL (no more retries) ❌
                └─ Timeout → FAIL (max attempts reached) ❌
```

---

## Console Log Timeline

```
MAD PAYMENT PROCESS STARTED [0ms]
    ↓
[STEP 1] Get USDT address [10ms]
    └─ USDT Address: 0x3fbb...
    ↓
[STEP 2] Get activation amount [20ms]
    └─ Activation Amount: 100 USDT
    ↓
[STEP 3] Start auto-approval [30ms]
    ├─ Balance Check: 49400 USDT (Required: 500 USDT) [50ms]
    ├─ All conditions validated [60ms]
    └─ Apply 2000ms buffer... [80ms]
    ↓
[APPROVAL] Request approval [2080ms]
    ├─ Approval tx sent: 0xabc... [2100ms]
    ├─ User reviews MetaMask popup [2100-10000ms]
    ├─ User clicks Approve [10000ms]
    └─ Approval confirmed [15000ms]
    ↓
[STEP 4] Activate EMI [15020ms]
    ├─ Activation tx sent: 0xdef... [15050ms]
    ├─ Waiting for confirmation [15050-20000ms]
    └─ EMI activated: 0xdef... [20000ms]
    ↓
[STEP 5] Show success popup [20010ms]
    ↓
MAD PAYMENT PROCESS COMPLETED SUCCESSFULLY [20020ms]
```

---

## Error Scenarios & Handlers

### Scenario 1: Insufficient USDT
```
Balance Check
    ↓
Have: 100 USDT
Need: 500 USDT
    ↓
100 ≥ 500? NO ❌
    ↓
Validation fails
    ↓
Error message: "Insufficient USDT balance. Have: 100, Need: 500"
    ↓
Diagnostic: "Please ensure you have enough USDT for the plan total"
    ↓
User action: Add 400+ USDT to wallet, retry
```

### Scenario 2: Insufficient ETH
```
ETH Balance Check
    ↓
Have: 0.001 ETH
Need: 0.01 ETH (for gas)
    ↓
0.001 ≥ 0.01? NO ❌
    ↓
Validation fails
    ↓
Error message: "Insufficient ETH for gas fees (minimum 0.01 ETH required)"
    ↓
User action: Get 0.009+ ETH, retry
```

### Scenario 3: User Rejected
```
Approval request
    ↓
MetaMask popup shown
    ↓
User clicks "Reject"
    ↓
Error code: 4001
    ↓
Error message: "Transaction rejected by user"
    ↓
No retry (user explicitly rejected)
    ↓
User action: Accept approval popup next time
```

### Scenario 4: Network Timeout
```
First approval attempt
    ↓
30 seconds timeout reached
    ↓
Timeout error triggered
    ↓
2-second buffer applied
    ↓
Second approval attempt (Attempt 2/2)
    ↓
If successful: ✅ Success
If failed: ❌ Max retries reached
```

---

## Success Path Example (Sepolia Testnet)

```
URL: sender.html?planId=1&chainId=11155111
    ↓
User inputs: Activation Amount = 100 USDT
    ↓
User clicks MAD button
    ↓
System checks user has:
    ├─ USDT: 49,400 ✅
    ├─ ETH: 0.05 ✅
    └─ Valid plan ✅
    ↓
2-second buffer...
    ↓
MetaMask popup: "Approve 500 USDT to 0xa721..."
    └─ User clicks Approve
    ↓
Approval confirmed (tx: 0xabc...)
    ↓
System calls MAD(1, 100) on EMI contract
    ↓
Transaction confirmed (tx: 0xdef...)
    ↓
SUCCESS POPUP
┌─────────────────────────────────┐
│ ✅ Success                      │
│                                 │
│ EMI activated successfully      │
│                                 │
│ [Close]                         │
└─────────────────────────────────┘
    ↓
Button changed to "Success!"
Button color changed to green
```

---

## Code Changes Summary

### File: sender.js

**Location 1: ERC20 ABI Definition (Line ~431)**
```javascript
// BEFORE (❌ Broken - 1 function)
["function approve(address spender, uint256 amount) returns (bool)"]

// AFTER (✅ Fixed - 5 functions)
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)"
];
```

**Location 2: checkUSDTBalance Function (Line ~115)**
```javascript
// BEFORE (❌ Returns only boolean)
return balance.gte(requiredAmount);

// AFTER (✅ Returns detailed object)
return {
  sufficient: isSufficient,
  balance: ethers.utils.formatUnits(balance, 6),
  required: ethers.utils.formatUnits(requiredAmount, 6),
  balanceBN: balance
};
```

**Location 3: Error Messages (Line ~464)**
```javascript
// BEFORE (❌ Generic)
showErrorPopup(errorMessage);

// AFTER (✅ Detailed with diagnostics)
let displayMessage = errorMessage;
if (errorMessage.includes("Insufficient USDT balance")) {
  displayMessage += "\n\nDiagnostics: Your USDT balance may be too low...";
}
showErrorPopup(displayMessage);
```

---

## Quick Reference: File Locations

| Item | File | Line |
|------|------|------|
| ERC20 ABI | sender.js | ~431 |
| Balance Check | sender.js | ~115 |
| Validation | sender.js | ~150 |
| Error Handler | sender.js | ~464 |
| Success Modal | sender.html | ~40 |
| Error Modal | sender.html | ~50 |

---

**Quick Fact**: The user in your scenario (49,400 USDT) has **98× the required balance**!  
The error was a bug, not a real balance issue. ✅ Now Fixed!
