// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

interface ISupplyChain {
    struct Product {
        bytes32 id;
        address manufacturer;
        string  metadataHash;
        bool    isActive;
        bool    exists;
        uint256 registeredAt;
    }

    struct TransferEvent {
        address from;
        address to;
        uint256 timestamp;
        string  locationHash;
        string  conditionHash;
        string  notes;
    }

    event ProductRegistered(bytes32 indexed productId, address indexed manufacturer, string metadataHash);
    event ProductDeactivated(bytes32 indexed productId);
    event TransferRecorded(bytes32 indexed productId, address indexed from, address indexed to);

    function registerProduct(bytes32 productId, string calldata metadataHash) external;
    function recordTransfer(bytes32 productId, address to, string calldata locationHash, string calldata conditionHash, string calldata notes) external;
    function deactivateProduct(bytes32 productId) external;
    function getProduct(bytes32 productId) external view returns (Product memory);
    function getHistory(bytes32 productId) external view returns (TransferEvent[] memory);
    function productExists(bytes32 productId) external view returns (bool);
}
