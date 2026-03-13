// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

interface IAccessControl {
    event RoleAssigned(address indexed account, bytes32 indexed role);
    event RoleRevoked(address indexed account, bytes32 indexed role);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function assignRole(address account, bytes32 role) external;
    function revokeRole(address account) external;
    function hasRole(address account, bytes32 role) external view returns (bool);
    function getRole(address account) external view returns (bytes32);
    function transferOwnership(address newOwner) external;
}
