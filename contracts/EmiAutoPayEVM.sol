//code with raw bytes - direct address payment
// SPDX-License-Identifier: MIT
// 🔥 COMPLETE FIXED VERSION - REPLACE ENTIRE CONTRACT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract EmiAutoPayEVM is AutomationCompatibleInterface, ReentrancyGuard {
    struct Plan {
        address payable sender;
        address payable receiver;
        uint256 emi;
        uint256 interval;
        uint256 total;
        uint256 paid;
        uint256 nextPay;
        bool active;
    }

    uint256 public planCount;
    mapping(uint256 => Plan) public plans;

    // 🔥 FIXED: Contract receives payments → forwards to receiver
    mapping(address => uint256) public pendingPlanId; // Receiver → PlanId
    mapping(address => bool) public linkedReceivers;

    event PlanCreated(uint256 indexed planId);
    event PlanActivated(uint256 indexed planId, address indexed sender);
    event EmiPaid(uint256 indexed planId, uint256 amount);
    event EmiCompleted(uint256 indexed planId);
    event PlanLinked(uint256 indexed planId, address indexed receiver);

    function createPlan(uint256 emi, uint256 interval, uint256 total) external {
        require(emi > 0, "Invalid EMI");
        require(interval >= 60, "Min 60s");
        require(total >= emi, "Total < EMI");

        planCount++;
        plans[planCount] = Plan({
            sender: payable(address(0)),
            receiver: payable(msg.sender),
            emi: emi,
            interval: interval,
            total: total,
            paid: 0,
            nextPay: 0,
            active: false
        });
        emit PlanCreated(planCount);
    }

    function linkPlanToDirectPayment(uint256 planId) external {
        require(planId > 0 && planId <= planCount, "Invalid plan ID");
        Plan storage p = plans[planId];
        require(p.receiver == msg.sender, "Not your plan");
        require(!p.active, "Plan already active");

        pendingPlanId[msg.sender] = planId;
        linkedReceivers[msg.sender] = true;
        emit PlanLinked(planId, msg.sender);
    }

    function unlinkPlan() external {
        delete pendingPlanId[msg.sender];
        linkedReceivers[msg.sender] = false;
    }

    // 🔥 FIXED: Sender activates via QR (to contract)
    function activatePlan(uint256 planId) external payable nonReentrant {
        Plan storage p = plans[planId];
        require(p.receiver != address(0), "Invalid plan");
        require(!p.active, "Already active");
        require(msg.value >= p.emi, "Send at least 1 EMI");

        p.sender = payable(msg.sender);
        p.paid += msg.value;

        // Forward ETH to receiver
        p.receiver.transfer(msg.value);
        emit EmiPaid(planId, msg.value);

        p.active = true;
        p.nextPay = block.timestamp + p.interval;
        emit PlanActivated(planId, msg.sender);
    }

    // 🔥 FIXED receive(): Contract receives ETH → Auto-activates linked plan
    receive() external payable nonReentrant {
        // Check if this is a direct payment for linked receiver
        if (msg.value >= 0.001 ether) {
            // Min sensible amount
            // Find receiver with pending plan who linked THIS CONTRACT
            // Note: Sender sends to CONTRACT address (shown in UI)
            for (uint256 i = 1; i <= planCount; i++) {
                Plan storage p = plans[i];
                if (
                    !p.active &&
                    pendingPlanId[p.receiver] == i &&
                    linkedReceivers[p.receiver] &&
                    msg.value >= p.emi
                ) {
                    // AUTO-ACTIVATE! ✨
                    p.sender = payable(msg.sender);
                    p.paid += msg.value;

                    // Forward to receiver
                    p.receiver.transfer(msg.value);

                    p.active = true;
                    p.nextPay = block.timestamp + p.interval;

                    emit PlanActivated(i, msg.sender);
                    emit EmiPaid(i, msg.value);
                    return; // First match
                }
            }
        }
    }

    // Chainlink automation (unchanged)
    function checkUpkeep(
        bytes calldata
    )
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        if (planCount == 0) return (false, "");
        for (uint256 i = 1; i <= planCount; i++) {
            Plan storage p = plans[i];
            if (p.active && p.paid < p.total && block.timestamp >= p.nextPay) {
                return (true, abi.encode(i));
            }
        }
        return (false, "");
    }

    function performUpkeep(bytes calldata data) external override nonReentrant {
        if (data.length == 0) return;
        uint256 planId = abi.decode(data, (uint256));
        Plan storage p = plans[planId];
        require(p.active, "Inactive");

        (bool success, ) = p.sender.call{value: p.emi}("");
        require(success, "ETH transfer failed");

        p.paid += p.emi;
        if (p.paid >= p.total) {
            p.active = false;
            emit EmiCompleted(planId);
        } else {
            p.nextPay = block.timestamp + p.interval;
            emit EmiPaid(planId, p.emi);
        }
    }
}

//code with raw bytes - link + QR

// import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// contract EmiAutoPayETH is AutomationCompatibleInterface, ReentrancyGuard {
//     struct Plan {
//         address payable sender;
//         address payable receiver;
//         uint256 emi; // ETH amount (wei)
//         uint256 interval;
//         uint256 total; // Total ETH obligation
//         uint256 paid; // ETH paid so far
//         uint256 nextPay;
//         bool active;
//     }

//     uint256 public planCount;
//     mapping(uint256 => Plan) public plans;

//     event PlanCreated(uint256 indexed planId);
//     event PlanActivated(uint256 indexed planId, address sender);
//     event EmiPaid(uint256 indexed planId, uint256 amount);
//     event EmiCompleted(uint256 indexed planId);

//     // 🔥 RECEIVER CREATES PLAN (ETH-based amounts)
//     function createPlan(uint256 emi, uint256 interval, uint256 total) external {
//         require(emi > 0, "Invalid EMI");
//         require(interval >= 60, "Min 60s");
//         require(total >= emi, "Total < EMI");

//         planCount++;
//         plans[planCount] = Plan({
//             sender: payable(address(0)),
//             receiver: payable(msg.sender),
//             emi: emi,
//             interval: interval,
//             total: total,
//             paid: 0,
//             nextPay: 0,
//             active: false
//         });
//         emit PlanCreated(planCount);
//     }

//     // 🔥 SENDER ACTIVATES WITH ETH (payable)
//     function activatePlan(uint256 planId) external payable nonReentrant {
//         Plan storage p = plans[planId];
//         require(p.receiver != address(0), "Invalid plan");
//         require(!p.active, "Already active");
//         require(msg.value >= p.emi, "Send at least 1 EMI");

//         p.sender = payable(msg.sender);

//         // ETH TRANSFER - Direct to receiver
//         p.paid += msg.value;
//         p.receiver.transfer(msg.value);
//         emit EmiPaid(planId, msg.value);

//         p.active = true;
//         p.nextPay = block.timestamp + p.interval;
//         emit PlanActivated(planId, msg.sender);
//     }

//     // 🔥 CHAINLINK CHECK (unchanged logic)
//     function checkUpkeep(
//         bytes calldata
//     )
//         external
//         view
//         override
//         returns (bool upkeepNeeded, bytes memory performData)
//     {
//         if (planCount == 0) return (false, "");
//         for (uint256 i = 1; i <= planCount; i++) {
//             Plan storage p = plans[i];
//             if (p.active && p.paid < p.total && block.timestamp >= p.nextPay) {
//                 return (true, abi.encode(i));
//             }
//         }
//         return (false, "");
//     }

//     // 🔥 CHAINLINK AUTO-PAY (ETH pull from sender)
//     function performUpkeep(bytes calldata data) external override nonReentrant {
//         if (data.length == 0) return;
//         uint256 planId = abi.decode(data, (uint256));
//         Plan storage p = plans[planId];

//         require(p.active, "Inactive");

//         // 🔥 RAW CALL: Pull ETH from sender (requires approval or manual pay)
//         (bool success, ) = p.sender.call{value: p.emi}("");
//         require(success, "ETH transfer failed");

//         p.paid += p.emi;
//         if (p.paid >= p.total) {
//             p.active = false;
//             emit EmiCompleted(planId);
//         } else {
//             p.nextPay = block.timestamp + p.interval;
//             emit EmiPaid(planId, p.emi);
//         }
//     }

//     // Allow contract to receive ETH
//     receive() external payable {}
// }
