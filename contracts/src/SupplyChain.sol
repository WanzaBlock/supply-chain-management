// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "./interfaces/ISupplyChain.sol";
import "./SupplyChainAccess.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title  SupplyChain
/// @notice Core registry. Records product batches and all custody transfers.
///         All event data is stored on-chain. Large payloads (images, sensor blobs)
///         are stored off-chain; only their hashes are stored here.
contract SupplyChain is ISupplyChain, ReentrancyGuard {

    SupplyChainAccess public immutable access;

    // track current custodian per product
    mapping(bytes32 => address) private _custodian;

    // cap transfer history per product
    uint256 private constant MAX_TRANSFER_HISTORY = 1_000;

    // cap string input lengths
    uint256 private constant MAX_STRING_LENGTH = 256;

    mapping(bytes32 => Product)         private _products;
    mapping(bytes32 => TransferEvent[]) private _history;

    // Track all product IDs for enumeration
    bytes32[] private _productIds;
    mapping(bytes32 => bool) private _productIdSeen;

    modifier onlyRole(bytes32 role) {
        require(access.hasRole(msg.sender, role), "SupplyChain: unauthorized role");
        _;
    }

    modifier productActive(bytes32 productId) {
        require(_products[productId].isActive, "SupplyChain: product not active");
        _;
    }

    constructor(address accessContract) {
        require(accessContract != address(0), "SupplyChain: zero address");
        access = SupplyChainAccess(accessContract);
    }

    //  Write functions 

    /// @notice Register a new product batch. Only MANUFACTURER role.
    /// @param  productId    keccak256 of a unique product/batch code
    /// @param  metadataHash IPFS CID or Supabase storage key for full metadata
    function registerProduct(bytes32 productId, string calldata metadataHash)
        external
        onlyRole(access.MANUFACTURER())
    {
        require(productId != bytes32(0),        "SupplyChain: empty product id");
        require(bytes(metadataHash).length > 0, "SupplyChain: empty metadata hash");
        require(!_products[productId].exists,   "SupplyChain: already registered");

        _products[productId] = Product({
            id:           productId,
            manufacturer: msg.sender,
            metadataHash: metadataHash,
            isActive:     true,
            exists:       true,
            registeredAt: block.timestamp
        });

        //  manufacturer is the first custodian
        _custodian[productId] = msg.sender;

        if (!_productIdSeen[productId]) {
            _productIds.push(productId);
            _productIdSeen[productId] = true;
        }

        emit ProductRegistered(productId, msg.sender, metadataHash);
    }

    /// @notice Record a custody transfer. MANUFACTURER or DISTRIBUTOR can call this.
    /// @param  productId      Product being transferred
    /// @param  to             Address receiving custody
    /// @param  locationHash   Location string or GPS coords (keep short — gas cost)
    /// @param  conditionHash  Sensor payload note e.g. temperature, humidity
    /// @param  notes          Short free-text note (keep short — gas cost)
    function recordTransfer(
        bytes32 productId,
        address to,
        string  calldata locationHash,
        string  calldata conditionHash,
        string  calldata notes
    )
        external
        nonReentrant
        productActive(productId)
    {
        // only the current custodian can transfer
        require(
            _custodian[productId] == msg.sender,
            "SupplyChain: not current custodian"
        );

        // Role check — only manufacturer or distributor can send
        require(
            access.hasRole(msg.sender, access.MANUFACTURER()) ||
            access.hasRole(msg.sender, access.DISTRIBUTOR()),
            "SupplyChain: not manufacturer or distributor"
        );

        // prevent unbounded history growth
        require(
            _history[productId].length < MAX_TRANSFER_HISTORY,
            "SupplyChain: history limit reached"
        );

        // reject oversized string inputs
        require(bytes(locationHash).length  <= MAX_STRING_LENGTH, "SupplyChain: locationHash too long");
        require(bytes(conditionHash).length <= MAX_STRING_LENGTH, "SupplyChain: conditionHash too long");
        require(bytes(notes).length         <= MAX_STRING_LENGTH, "SupplyChain: notes too long");

        require(to != address(0), "SupplyChain: zero recipient");

        // recipient must hold a valid role in the system
        require(
            access.hasRole(to, access.DISTRIBUTOR())  ||
            access.hasRole(to, access.MANUFACTURER()) ||
            access.hasRole(to, access.REGULATOR())    ||
            access.hasRole(to, access.CONSUMER()),
            "SupplyChain: recipient has no valid role"
        );

        // update custodian to new recipient
        _custodian[productId] = to;

        //  block.timestamp used intentionally;
        // minor validator drift (~15s) is acceptable for a supply chain audit trail
        _history[productId].push(TransferEvent({
            from:          msg.sender,
            to:            to,
            timestamp:     block.timestamp,
            locationHash:  locationHash,
            conditionHash: conditionHash,
            notes:         notes
        }));

        emit TransferRecorded(productId, msg.sender, to);
    }

    /// @notice Deactivate a product (e.g. confirmed counterfeit or recalled). Owner or REGULATOR.
    function deactivateProduct(bytes32 productId) external {
        require(
            msg.sender == access.owner() ||
            access.hasRole(msg.sender, access.REGULATOR()),
            "SupplyChain: not authorized to deactivate"
        );
        require(_products[productId].exists, "SupplyChain: product not found");
        _products[productId].isActive = false;
        emit ProductDeactivated(productId);
    }

    // View functions

    function getProduct(bytes32 productId) external view returns (Product memory) {
        require(_products[productId].exists, "SupplyChain: not found");
        return _products[productId];
    }

    function getHistory(bytes32 productId) external view returns (TransferEvent[] memory) {
        return _history[productId];
    }

    function productExists(bytes32 productId) external view returns (bool) {
        return _products[productId].exists;
    }

    function getTransferCount(bytes32 productId) external view returns (uint256) {
        return _history[productId].length;
    }

    function getTotalProducts() external view returns (uint256) {
        return _productIds.length;
    }

    /// @notice Returns the current custodian of a product
    function getCustodian(bytes32 productId) external view returns (address) {
        require(_products[productId].exists, "SupplyChain: not found");
        return _custodian[productId];
    }

    /// @notice Paginated product list for the manufacturer dashboard
    function getProductIds(uint256 offset, uint256 limit)
        external view returns (bytes32[] memory ids, uint256 total)
    {
        total = _productIds.length;
        if (offset >= total) return (new bytes32[](0), total);
        uint256 end = offset + limit > total ? total : offset + limit;
        uint256 len = end - offset;
        ids = new bytes32[](len);
        for (uint256 i = 0; i < len; i++) {
            ids[i] = _productIds[offset + i];
        }
    }
}