// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @dev On-chain interface for ZK inbound verification
interface InboundVerifier {
    function verify(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view returns (bool);
}

/// @dev On-chain interface for ZK outbound verification
interface OutboundVerifier {
    function verify(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view returns (bool);
}

contract TrocaEscrow is Ownable {
    using SafeERC20 for IERC20;

    /// @dev Data for an inbound intent
    struct InboundIntent {
        address dao;
        address signer;
        address asset;
        uint256 amount;
        uint256 timestamp;
        bool closed;
    }

    /// @dev Data for an outbound intent
    struct OutboundIntent {
        address initiator;
        address asset;
        uint256 amount;
        address recipient;
        bytes32 payloadHash;
        uint256 timestamp;
        bool closed;
    }

    InboundVerifier public inboundVerifier;
    OutboundVerifier public outboundVerifier;
    address public node;

    /// @dev inbound: intentId → InboundIntent
    mapping(bytes32 => InboundIntent) public inboundIntents;
    /// @dev dao → nonce for inbound
    mapping(address => uint256) public inboundNonces;

    /// @dev outbound: intentId → OutboundIntent
    mapping(bytes32 => OutboundIntent) public outboundIntents;
    /// @dev initiator → nonce for outbound
    mapping(address => uint256) public outboundNonces;

    /// @dev Events for inbound
    event InboundRegistered(
        bytes32 indexed intentId,
        address indexed dao,
        address indexed signer,
        address asset,
        uint256 amount,
        uint256 timestamp
    );
    event InboundExecuted(bytes32 indexed intentId, address indexed executor);
    event InboundRefunded(bytes32 indexed intentId, address indexed dao);

    /// @dev Events for outbound
    event OutboundRegistered(
        bytes32 indexed intentId,
        address indexed initiator,
        address asset,
        uint256 amount,
        address indexed recipient,
        bytes32 payloadHash,
        uint256 timestamp
    );
    event OutboundExecuted(bytes32 indexed intentId, address indexed executor);
    event OutboundRefunded(bytes32 indexed intentId, address indexed initiator);

    modifier onlyNode() {
        require(msg.sender == node, "Only node");
        _;
    }

    constructor(
        address _inboundVerifier,
        address _outboundVerifier,
        address _node
    ) Ownable(msg.sender) {
        inboundVerifier = InboundVerifier(_inboundVerifier);
        outboundVerifier = OutboundVerifier(_outboundVerifier);
        node = _node;
    }

    /// @notice Change the node (e.g. chainlink node) if needed
    function setNode(address _node) external onlyOwner {
        node = _node;
    }

    /// @notice Change the inbound verifier
    function setInboundVerifier(address _v) external onlyOwner {
        inboundVerifier = InboundVerifier(_v);
    }

    /// @notice Change the outbound verifier
    function setOutboundVerifier(address _v) external onlyOwner {
        outboundVerifier = OutboundVerifier(_v);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Inbound logic (DAO → Pix)
    // ──────────────────────────────────────────────────────────────────────

    /// @notice DAO deposits asset & registers a signer intent
    function intendPayment(
        address signer,
        address asset,
        uint256 amount
    ) external returns (bytes32 intentId) {
        require(signer != address(0), "Invalid signer");
        require(asset != address(0), "Invalid asset");
        require(amount > 0, "Zero amount");

        uint256 nonce = inboundNonces[msg.sender]++;
        intentId = keccak256(
            abi.encodePacked(msg.sender, signer, asset, amount, nonce)
        );

        // pull in funds
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        inboundIntents[intentId] = InboundIntent({
            dao: msg.sender,
            signer: signer,
            asset: asset,
            amount: amount,
            timestamp: block.timestamp,
            closed: false
        });

        emit InboundRegistered(
            intentId,
            msg.sender,
            signer,
            asset,
            amount,
            block.timestamp
        );
    }

    /// @notice Node finalizes inbound: verifies ZK proof, then sends asset to signer
    function executeInbound(
        bytes32 intentId,
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external onlyNode {
        InboundIntent storage intent = inboundIntents[intentId];
        require(intent.dao != address(0), "Unknown intent");
        require(!intent.closed, "Already closed");

        require(
            inboundVerifier.verify(proof, publicInputs),
            "Inbound ZK proof failed"
        );

        require(publicInputs.length > 0, "Missing public inputs");
        // publicInputs[0] must be signer address
        //RATHER THAN THE LONG, ENCODED VERSION OF PUBLICINPUTS GENERATED FROM ZK, HOW CAN WE DERIVE THIS ON CHAIN?

        intent.closed = true;

        emit InboundExecuted(intentId, msg.sender);
    }

    /// @notice DAO can refund after 1 week if not executed
    function refundInbound(bytes32 intentId) external {
        InboundIntent storage intent = inboundIntents[intentId];
        require(intent.dao == msg.sender, "Not DAO");
        require(!intent.closed, "Already closed");
        require(block.timestamp >= intent.timestamp + 1 weeks, "Too early");

        intent.closed = true;
        IERC20(intent.asset).safeTransfer(intent.dao, intent.amount);

        emit InboundRefunded(intentId, msg.sender);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Outbound logic (Pix → DAO payload → ERC20)
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Register an outbound intent with its payloadHash
    function registerOutboundIntent(
        address asset,
        uint256 amount,
        address recipient,
        bytes32 payloadHash
    ) external returns (bytes32 intentId) {
        require(asset != address(0), "Invalid asset");
        require(amount > 0, "Zero amount");
        require(recipient != address(0), "Invalid recipient");
        require(payloadHash != bytes32(0), "Invalid payloadHash");
        // ensure contract has funds
        require(
            IERC20(asset).balanceOf(address(this)) >= amount,
            "Insufficient escrow balance"
        );

        uint256 nonce = outboundNonces[msg.sender]++;
        intentId = keccak256(abi.encodePacked(msg.sender, payloadHash, nonce));

        outboundIntents[intentId] = OutboundIntent({
            initiator: msg.sender,
            asset: asset,
            amount: amount,
            recipient: recipient,
            payloadHash: payloadHash,
            timestamp: block.timestamp,
            closed: false
        });

        emit OutboundRegistered(
            intentId,
            msg.sender,
            asset,
            amount,
            recipient,
            payloadHash,
            block.timestamp
        );
    }

    /// @notice Node finalizes outbound: verifies ZK proof, then pays out
    function executeOutbound(
        bytes32 intentId,
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external onlyNode {
        OutboundIntent storage intent = outboundIntents[intentId];
        require(intent.initiator != address(0), "Unknown intent");
        require(!intent.closed, "Already closed");

        require(
            outboundVerifier.verify(proof, publicInputs),
            "Outbound ZK proof failed"
        );

        // publicInputs[0] must be the registered payloadHash
        require(publicInputs.length > 0, "Missing public inputs");
        //RATHER THAN THE LONG, ENCODED VERSION OF PUBLICINPUTS GENERATED FROM ZK, HOW CAN WE DERIVE THIS ON CHAIN?

        intent.closed = true;
        IERC20(intent.asset).safeTransfer(intent.recipient, intent.amount);

        emit OutboundExecuted(intentId, msg.sender);
    }

    /// @notice Initiator can refund after 1 week if not executed
    function refundOutbound(bytes32 intentId) external {
        OutboundIntent storage intent = outboundIntents[intentId];
        require(intent.initiator == msg.sender, "Not initiator");
        require(!intent.closed, "Already closed");
        require(block.timestamp >= intent.timestamp + 1 weeks, "Too early");

        intent.closed = true;
        IERC20(intent.asset).safeTransfer(intent.initiator, intent.amount);

        emit OutboundRefunded(intentId, msg.sender);
    }
}
