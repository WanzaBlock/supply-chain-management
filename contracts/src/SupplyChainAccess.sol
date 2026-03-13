// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "./interfaces/IAccessControl.sol";

/// @title  SupplyChainAccess
/// @notice Role registry for the supply chain system.
///         Owner assigns and revokes roles. Contracts call hasRole() to gate functions.
contract SupplyChainAccess is IAccessControl {
    bytes32 public constant MANUFACTURER = keccak256("MANUFACTURER");
    bytes32 public constant DISTRIBUTOR  = keccak256("DISTRIBUTOR");
    bytes32 public constant REGULATOR    = keccak256("REGULATOR");
    bytes32 public constant CONSUMER     = keccak256("CONSUMER");
    bytes32 public constant NONE         = bytes32(0);

    address public owner;
    mapping(address => bytes32) private _roles;

    modifier onlyOwner() {
        require(msg.sender == owner, "AccessControl: not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }

    /// @notice Assign a role to an account. Replaces any existing role.
    function assignRole(address account, bytes32 role) external onlyOwner {
        require(account != address(0), "AccessControl: zero address");
        require(
            role == MANUFACTURER ||
            role == DISTRIBUTOR  ||
            role == REGULATOR    ||
            role == CONSUMER,
            "AccessControl: unknown role"
        );
        _roles[account] = role;
        emit RoleAssigned(account, role);
    }

    /// @notice Remove a role from an account.
    function revokeRole(address account) external onlyOwner {
        require(_roles[account] != NONE, "AccessControl: no role to revoke");
        emit RoleRevoked(account, _roles[account]);
        _roles[account] = NONE;
    }

    /// @notice Returns true if account holds the given role.
    function hasRole(address account, bytes32 role) external view returns (bool) {
        return _roles[account] == role;
    }

    /// @notice Returns the role held by account (NONE if unassigned).
    function getRole(address account) external view returns (bytes32) {
        return _roles[account];
    }

    /// @notice Transfer contract ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AccessControl: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
