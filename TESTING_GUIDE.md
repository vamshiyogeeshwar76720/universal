# EMI Auto-Approval: Quick Testing Guide

## Issue Summary
**Error**: "Approval conditions not met: Insufficient USDT balance"  
**Root Cause**: Incomplete ERC20 ABI (missing `balanceOf` function)  
**Solution**: Enhanced ABI with complete ERC20 interface functions

---

## What Was Fixed

### 1. ✅ ERC20 Contract ABI
**Before**: Only 1 function
```javascript
["function approve(address spender, uint256 amount) returns (bool)"]
```

**After**: 5 functions (complete ERC20 interface)
```javascript
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)"
];
```

### 2. ✅ Balance Checking Logic
Now returns detailed information:
```javascript
{
  sufficient: boolean,
  balance: "49400.5",           // Formatted user balance
  required: "500.0",            // Formatted required amount
  balanceBN: BigNumber          // Raw value for calculations
}
```

### 3. ✅ Error Messages
More helpful and diagnostic:
```
Before: "Insufficient USDT balance"
After:  "Insufficient USDT balance. Have: 49400, Need: 500"
        
        Diagnostics: Your USDT balance may be too low. 
        Please ensure you have enough USDT for the plan total.
```

---

## Test Cases

### Test 1: Successful Transaction (Happy Path)
```
Setup:
- Sender USDT Balance: 49,400 USDT
- Plan Total: 500 USDT
- ETH Balance: 0.05 ETH (for gas)
- Activation Amount: 100 USDT

Steps:
1. Load sender.html with valid planId and chainId URL params
2. Fill in Activation Amount: 100
3. Click "MAD" button

Expected Result: ✅ SUCCESS
- "EMI activated successfully" popup displays
- Console shows all 4 STEPs completing
- Button changes to "Success!" with green background
```

### Test 2: Insufficient USDT Balance
```
Setup:
- Sender USDT Balance: 100 USDT (less than 500 required)
- Plan Total: 500 USDT
- Activation Amount: 50 USDT

Steps:
1. Click "MAD" button

Expected Result: ❌ ERROR
- Error popup displays:
  "Insufficient USDT balance. Have: 100, Need: 500"
- Diagnostics message shown
- Button resets to "MAD"
```

### Test 3: Insufficient ETH for Gas
```
Setup:
- Sender USDT Balance: 49,400 USDT ✓
- ETH Balance: 0.001 ETH (less than 0.01 required)
- Activation Amount: 100 USDT

Steps:
1. Click "MAD" button

Expected Result: ❌ ERROR
- Error popup displays:
  "Insufficient ETH for gas fees (minimum 0.01 ETH required)"
- Button resets to "MAD"
```

### Test 4: Approval Rejection
```
Setup:
- All balances sufficient
- But user clicks "Reject" in MetaMask approval popup

Steps:
1. Click "MAD" button
2. MetaMask approval popup appears
3. User clicks "Reject"

Expected Result: ❌ ERROR
- Error popup displays:
  "Transaction rejected by user"
- Button resets to "MAD"
- No more retries (user rejected, not a network error)
```

### Test 5: Approval Timeout & Retry
```
Setup:
- All balances sufficient
- MetaMask popup hangs for 30+ seconds

Steps:
1. Click "MAD" button
2. MetaMask approval popup appears
3. Network is slow, approval takes 35+ seconds

Expected Result: 🔄 AUTO-RETRY
- First attempt times out after 30 seconds
- Button shows: "Requesting approval... (Attempt 2/2)"
- System waits 2 seconds (buffer time)
- Second approval attempt begins
- If successful: ✅ EMI activated successfully
- If fails again: ❌ Error popup after 2nd attempt
```

---

## Console Logging

Open browser DevTools (F12) and watch the Console tab:

### Successful Flow
```
============================================================
MAD PAYMENT PROCESS STARTED
============================================================
Using chain: sepolia
EMI Contract: 0xa721846B41...
Plan ID: 1

[STEP 1] Fetching USDT token address...
USDT Address: 0x3fbb7Fbf85...

[STEP 2] Reading activation amount from input...
Activation Amount: 100 USDT

[STEP 3] Initiating auto-approval process...
Starting auto-approval process...
USDT Balance Check: 49400 USDT (Required: 500 USDT)
All conditions validated

Applying 2000ms buffer time...

Approval attempt 1: Requesting approval for 500 USDT
Approval tx sent: 0xabc123def456...
Approval confirmed: 0xabc123def456...
✓ Approval completed successfully

[STEP 4] Activating EMI...
Activating EMI for plan 1 with amount 100 USDT
Activation tx sent: 0xdef456ghi789...
EMI activated successfully: 0xdef456ghi789...
✓ EMI activated successfully

[STEP 5] Displaying success notification...

============================================================
MAD PAYMENT PROCESS COMPLETED SUCCESSFULLY
============================================================
```

### Error Flow
```
Starting auto-approval process...
USDT Balance Check: 100 USDT (Required: 500 USDT)

Balance check error details:
- Have: 100 USDT
- Need: 500 USDT
- Shortage: 400 USDT

Validation failed with issues:
  - Insufficient USDT balance. Have: 100, Need: 500

Error details: Error: Approval conditions not met: 
  Insufficient USDT balance. Have: 100, Need: 500

❌ MAD Payment Process Failed: 
  Approval conditions not met: Insufficient USDT balance. Have: 100, Need: 500
```

---

## Browser Console Commands (for debugging)

```javascript
// Check user's USDT balance
const balance = await usdtContract.balanceOf(sender);
console.log("USDT Balance:", ethers.utils.formatUnits(balance, 6));

// Check user's ETH balance
const ethBalance = await provider.getBalance(sender);
console.log("ETH Balance:", ethers.utils.formatEther(ethBalance));

// Check plan details
const plan = await contract.plans(planId);
console.log("Plan Total:", ethers.utils.formatUnits(plan.total, 6), "USDT");
console.log("Plan EMI:", ethers.utils.formatUnits(plan.emi, 6), "USDT");
console.log("Plan Receiver:", plan.receiver);
console.log("Plan Active:", plan.active);

// Check USDT contract
const usdt = await contract.USDT();
console.log("USDT Contract:", usdt);

// Manually check if approval was granted
const allowance = await usdtContract.allowance(sender, emiAddress);
console.log("Approval Amount:", ethers.utils.formatUnits(allowance, 6), "USDT");
```

---

## Network Details

### Sepolia (Testnet) ⭐ Recommended for Testing
```
Chain ID: 11155111
EMI Contract: 0xa721846B41Ff5Ea7C7D3a398Bb80Fc8CE0f3BB39
USDT Contract: 0x3fbb7Fbf85E4B0Df06189A152C41CAc77e634f65
RPC: https://sepolia.infura.io/v3/YOUR_KEY

Getting Test USDT:
1. Visit Sepolia testnet faucet
2. Request test ETH
3. Swap ETH for test USDT on DEX
```

### Mainnet (Production)
```
Chain ID: 1
EMI Contract: 0x7BAA6f2fFc568F1114A392557Bc3bCDe609bb795
USDT Contract: 0xdAC17F958D2ee523a2206206994597C13D831ec7
RPC: https://mainnet.infura.io/v3/YOUR_KEY

⚠️ Only test on mainnet after thorough testnet validation
```

---

## Deployment Checklist

Before going live, verify:

- [ ] ERC20 ABI includes all 5 functions (`approve`, `balanceOf`, `allowance`, `transfer`, `transferFrom`)
- [ ] Balance check returns detailed information (have, need, sufficient)
- [ ] Error messages are user-friendly
- [ ] Console logs provide debugging info
- [ ] Success popup displays with correct message
- [ ] Button state resets properly on error
- [ ] Retry logic works (2 attempts with 2s buffer)
- [ ] Gas limits are appropriate:
  - [ ] Approval: 100,000 gas
  - [ ] MAD: 300,000 gas
- [ ] Timeout handling works (30s per attempt)
- [ ] MetaMask integration tested
- [ ] Multiple networks tested (sepolia + mainnet)

---

## Common Issues & Fixes

### Issue: "balanceOf is not a function"
❌ **Problem**: ERC20 ABI is incomplete  
✅ **Fix**: Use the complete ERC20_ABI with 5 functions

### Issue: Balance check returns undefined
❌ **Problem**: Balance check didn't handle error properly  
✅ **Fix**: Wrapped in try-catch with proper error messaging

### Issue: Success popup doesn't show
❌ **Problem**: Modal elements missing from HTML  
✅ **Fix**: Ensure `successModal` and `modalOverlay` divs exist in HTML

### Issue: Approval never completes
❌ **Problem**: Insufficient ETH for gas  
✅ **Fix**: Add 0.01+ ETH to wallet

### Issue: Transaction keeps retrying
❌ **Problem**: Might be network issue  
✅ **Fix**: Check RPC connection, try different RPC provider

---

## Files Modified

- ✅ `sender.html` - Updated HTML with modals and styling
- ✅ `sender.js` - Fixed ERC20 ABI, enhanced balance checking, improved error handling
- ✅ `DIAGNOSTIC_REPORT.md` - Comprehensive issue analysis

---

**Last Updated**: February 9, 2026  
**Status**: Ready for Testing ✅
