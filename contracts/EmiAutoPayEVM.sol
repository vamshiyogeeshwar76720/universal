//code with raw bytes - direct address payment
// SPDX-License-Identifier: MIT
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
        bool paymentReceived; // 🔥 NEW: Track initial payment
    }

    uint256 public planCount;
    mapping(uint256 => Plan) public plans;
    mapping(address => uint256) public pendingPlanId; // Receiver → PlanId
    address public admin; // Off-chain monitor

    event PlanCreated(uint256 indexed planId);
    event PlanActivated(uint256 indexed planId, address indexed sender);
    event EmiPaid(uint256 indexed planId, uint256 amount);
    event EmiCompleted(uint256 indexed planId);
    event PlanLinked(uint256 indexed planId, address indexed receiver);
    event PaymentReceived(
        uint256 indexed planId,
        address indexed sender,
        uint256 amount
    );

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

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
            active: false,
            paymentReceived: false
        });
        emit PlanCreated(planCount);
    }

    // 🔥 LINK: Receiver links their WALLET for monitoring
    function linkPlanToDirectPayment(uint256 planId) external {
        require(planId > 0 && planId <= planCount, "Invalid plan ID");
        Plan storage p = plans[planId];
        require(p.receiver == msg.sender, "Not your plan");
        require(!p.active, "Plan already active");

        pendingPlanId[msg.sender] = planId;
        emit PlanLinked(planId, msg.sender);
    }

    // 🔥 OFF-CHAIN MONITOR: Activate when payment detected
    function activatePlanRaw(
        uint256 planId,
        address sender
    ) external onlyAdmin {
        Plan storage p = plans[planId];
        require(pendingPlanId[p.receiver] == planId, "Plan not linked");
        require(!p.active, "Already active");
        require(!p.paymentReceived, "Payment already received");

        p.sender = payable(sender);
        p.paymentReceived = true;
        p.active = true;
        p.nextPay = block.timestamp + p.interval;
        emit PlanActivated(planId, sender);
    }

    // Manual activation (QR code method - unchanged)
    function activatePlan(uint256 planId) external payable nonReentrant {
        Plan storage p = plans[planId];
        require(p.receiver != address(0), "Invalid plan");
        require(!p.active, "Already active");
        require(msg.value >= p.emi, "Send at least 1 EMI");

        p.sender = payable(msg.sender);
        p.paid += msg.value;
        p.receiver.transfer(msg.value);
        emit EmiPaid(planId, msg.value);

        p.active = true;
        p.nextPay = block.timestamp + p.interval;
        emit PlanActivated(planId, msg.sender);
    }

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

    // Admin functions
    function setAdmin(address newAdmin) external {
        require(msg.sender == admin, "Only admin");
        admin = newAdmin;
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
