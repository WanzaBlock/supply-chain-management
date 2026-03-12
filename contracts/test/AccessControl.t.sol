// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SupplyChainAccess.sol";

contract AccessControlTest is Test {
    SupplyChainAccess access;
    address owner       = address(this);
    address alice       = makeAddr("alice");
    address bob         = makeAddr("bob");

    function setUp() public {
        access = new SupplyChainAccess();
    }

    // ── Role assignment ──────────────────────────────────────────────────────

    function test_OwnerIsSetOnDeploy() public view {
        assertEq(access.owner(), owner);
    }

    function test_AssignManufacturerRole() public {
        access.assignRole(alice, access.MANUFACTURER());
        assertTrue(access.hasRole(alice, access.MANUFACTURER()));
    }

    function test_AssignDistributorRole() public {
        access.assignRole(bob, access.DISTRIBUTOR());
        assertTrue(access.hasRole(bob, access.DISTRIBUTOR()));
    }

    function test_AssignRoleEmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit IAccessControl.RoleAssigned(alice, access.MANUFACTURER());
        access.assignRole(alice, access.MANUFACTURER());
    }

    function test_RoleReplacesExisting() public {
        access.assignRole(alice, access.MANUFACTURER());
        access.assignRole(alice, access.DISTRIBUTOR());
        assertTrue(access.hasRole(alice, access.DISTRIBUTOR()));
        assertFalse(access.hasRole(alice, access.MANUFACTURER()));
    }

    function test_RevokeRole() public {
        access.assignRole(alice, access.MANUFACTURER());
        access.revokeRole(alice);
        assertFalse(access.hasRole(alice, access.MANUFACTURER()));
        assertEq(access.getRole(alice), bytes32(0));
    }

    // ── Revert cases ─────────────────────────────────────────────────────────

    function test_RevertAssignRole_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert("AccessControl: not owner");
        access.assignRole(bob, access.MANUFACTURER());
    }

    function test_RevertAssignRole_ZeroAddress() public {
        vm.expectRevert("AccessControl: zero address");
        access.assignRole(address(0), access.MANUFACTURER());
    }

    function test_RevertAssignRole_UnknownRole() public {
        vm.expectRevert("AccessControl: unknown role");
        access.assignRole(alice, keccak256("UNKNOWN"));
    }

    function test_RevertRevokeRole_NoRole() public {
        vm.expectRevert("AccessControl: no role to revoke");
        access.revokeRole(alice);
    }

    function test_RevertTransferOwnership_ZeroAddress() public {
        vm.expectRevert("AccessControl: zero address");
        access.transferOwnership(address(0));
    }

    function test_TransferOwnership() public {
        access.transferOwnership(alice);
        assertEq(access.owner(), alice);
    }

    // ── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_NonOwnerCannotAssign(address caller) public {
        vm.assume(caller != owner && caller != address(0));
        vm.prank(caller);
        vm.expectRevert("AccessControl: not owner");
        access.assignRole(alice, access.MANUFACTURER());
    }
}
