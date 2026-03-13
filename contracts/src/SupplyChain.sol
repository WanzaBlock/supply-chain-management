// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "./interfaces/ISupplyChain.sol";
import "./SupplyChainAccess.sol";

/// @title  SupplyChain
/// @notice Core registry. Records product batches and all custody transfers.
///         All event data is stored on-chain. Large payloads (images, sensor blobs)
///         are stored off-chain; only their hashes are stored here.
contract SupplyChain is ISupplyChain {
    SupplyChainAccess public immutable access;

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

    // ─── Write functions ────────────────────────────────────────────────────

    /// @notice Register a new product batch. Only MANUFACTURER role.
    /// @param  productId    keccak256 of a unique product/batch code
    /// @param  metadataHash IPFS CID or Supabase storage key for full metadata
    function registerProduct(bytes32 productId, string calldata metadataHash)
        external
        onlyRole(access.MANUFACTURER())
    {
        require(productId != bytes32(0),            "SupplyChain: empty product id");
        require(bytes(metadataHash).length > 0,     "SupplyChain: empty metadata hash");
        // slither-disable-next-line timestamp
        require(!_products[productId].exists, "SupplyChain: already registered");

        _products[productId] = Product({
            id:           productId,
            manufacturer: msg.sender,
            metadataHash: metadataHash,
            isActive:     true,
            exists:       true,
            registeredAt: block.timestamp
        });

        if (!_productIdSeen[productId]) {
            _productIds.push(productId);
            _productIdSeen[productId] = true;
        }

        emit ProductRegistered(productId, msg.sender, metadataHash);
    }

    /// @notice Record a custody transfer. MANUFACTURER or DISTRIBUTOR can call this.
    /// @param  productId      Product being transferred
    /// @param  to             Address receiving custody
    /// @param  locationHash   keccak256 of GPS coords or location string (off-chain stored)
    /// @param  conditionHash  keccak256 of sensor payload (temperature, humidity, etc.)
    /// @param  notes          Short free-text note (keep short — gas cost)
    function recordTransfer(
        bytes32 productId,
        address to,
        string  calldata locationHash,
        string  calldata conditionHash,
        string  calldata notes
    )
        external
        productActive(productId)
    {
        require(
            access.hasRole(msg.sender, access.MANUFACTURER()) ||
            access.hasRole(msg.sender, access.DISTRIBUTOR()),
            "SupplyChain: not manufacturer or distributor"
        );
        require(to != address(0), "SupplyChain: zero recipient");

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
        // slither-disable-next-line timestamp
        require(_products[productId].exists, "SupplyChain: product not found");
        _products[productId].isActive = false;
        emit ProductDeactivated(productId);
    }

    // ─── View functions ─────────────────────────────────────────────────────

    function getProduct(bytes32 productId) external view returns (Product memory) {
        // slither-disable-next-line timestamp
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
