// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SupplyChain.sol";
import "../src/SupplyChainAccess.sol";

contract SupplyChainTest is Test {
    event ProductRegistered(bytes32 indexed productId, address indexed manufacturer, string metadataHash);
    event ProductDeactivated(bytes32 indexed productId);
    event TransferRecorded(bytes32 indexed productId, address indexed from, address indexed to);
    SupplyChainAccess access;
    SupplyChain       chain;

    address owner        = address(this);
    address manufacturer = makeAddr("manufacturer");
    address distributor  = makeAddr("distributor");
    address regulator    = makeAddr("regulator");
    address consumer     = makeAddr("consumer");
    address stranger     = makeAddr("stranger");

    bytes32 constant PRODUCT_ID    = keccak256("SEED-BATCH-001");
    bytes32 constant PRODUCT_ID_2  = keccak256("SEED-BATCH-002");
    string  constant METADATA_HASH = "ipfs://QmTestHash1234567890";
    string  constant LOC_HASH      = "0xabc123locationhash";
    string  constant COND_HASH     = "0xdef456conditionhash";
    string  constant NOTES         = "Stored at 4C, no damage";

    function setUp() public {
        access = new SupplyChainAccess();
        chain  = new SupplyChain(address(access));

        access.assignRole(manufacturer, access.MANUFACTURER());
        access.assignRole(distributor,  access.DISTRIBUTOR());
        access.assignRole(regulator,    access.REGULATOR());
        access.assignRole(consumer,     access.CONSUMER());
    }

    // ── Product registration ──────────────────────────────────────────────────

    function test_RegisterProduct() public {
        vm.prank(manufacturer);
        chain.registerProduct(PRODUCT_ID, METADATA_HASH);

        ISupplyChain.Product memory p = chain.getProduct(PRODUCT_ID);
        assertEq(p.id,           PRODUCT_ID);
        assertEq(p.manufacturer, manufacturer);
        assertEq(p.metadataHash, METADATA_HASH);
        assertTrue(p.isActive);
        assertGt(p.registeredAt, 0);
    }

    function test_RegisterProduct_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit ProductRegistered(PRODUCT_ID, manufacturer, METADATA_HASH);
        vm.prank(manufacturer);
        chain.registerProduct(PRODUCT_ID, METADATA_HASH);
    }

    function test_TotalProductsIncrementsOnRegister() public {
        vm.startPrank(manufacturer);
        chain.registerProduct(PRODUCT_ID,   METADATA_HASH);
        chain.registerProduct(PRODUCT_ID_2, "ipfs://QmSecondHash");
        vm.stopPrank();
        assertEq(chain.getTotalProducts(), 2);
    }

    function test_RevertRegister_NotManufacturer() public {
        vm.prank(distributor);
        vm.expectRevert("SupplyChain: unauthorized role");
        chain.registerProduct(PRODUCT_ID, METADATA_HASH);
    }

    function test_RevertRegister_Stranger() public {
        vm.prank(stranger);
        vm.expectRevert("SupplyChain: unauthorized role");
        chain.registerProduct(PRODUCT_ID, METADATA_HASH);
    }

    function test_RevertRegister_DuplicateId() public {
        vm.startPrank(manufacturer);
        chain.registerProduct(PRODUCT_ID, METADATA_HASH);
        vm.expectRevert("SupplyChain: already registered");
        chain.registerProduct(PRODUCT_ID, METADATA_HASH);
        vm.stopPrank();
    }

    function test_RevertRegister_EmptyMetadataHash() public {
        vm.prank(manufacturer);
        vm.expectRevert("SupplyChain: empty metadata hash");
        chain.registerProduct(PRODUCT_ID, "");
    }

    function test_RevertRegister_EmptyProductId() public {
        vm.prank(manufacturer);
        vm.expectRevert("SupplyChain: empty product id");
        chain.registerProduct(bytes32(0), METADATA_HASH);
    }

    // ── Transfer recording ────────────────────────────────────────────────────

    function _registerProduct() internal {
        vm.prank(manufacturer);
        chain.registerProduct(PRODUCT_ID, METADATA_HASH);
    }

    function test_RecordTransfer_ByManufacturer() public {
        _registerProduct();
        vm.prank(manufacturer);
        chain.recordTransfer(PRODUCT_ID, distributor, LOC_HASH, COND_HASH, NOTES);

        ISupplyChain.TransferEvent[] memory history = chain.getHistory(PRODUCT_ID);
        assertEq(history.length, 1);
        assertEq(history[0].from, manufacturer);
        assertEq(history[0].to,   distributor);
        assertEq(history[0].notes, NOTES);
    }

    function test_RecordTransfer_ByDistributor() public {
        _registerProduct();
        vm.prank(distributor);
        chain.recordTransfer(PRODUCT_ID, consumer, LOC_HASH, COND_HASH, "Final delivery");

        ISupplyChain.TransferEvent[] memory history = chain.getHistory(PRODUCT_ID);
        assertEq(history.length, 1);
        assertEq(history[0].from, distributor);
    }

    function test_MultipleTransfersRecorded() public {
        _registerProduct();
        vm.prank(manufacturer);
        chain.recordTransfer(PRODUCT_ID, distributor, LOC_HASH, COND_HASH, "Shipped");
        vm.prank(distributor);
        chain.recordTransfer(PRODUCT_ID, consumer, LOC_HASH, COND_HASH, "Delivered");

        assertEq(chain.getTransferCount(PRODUCT_ID), 2);
    }

    function test_RecordTransfer_EmitsEvent() public {
        _registerProduct();
        vm.expectEmit(true, true, true, false);
        emit TransferRecorded(PRODUCT_ID, manufacturer, distributor);
        vm.prank(manufacturer);
        chain.recordTransfer(PRODUCT_ID, distributor, LOC_HASH, COND_HASH, "");
    }

    function test_RevertTransfer_Stranger() public {
        _registerProduct();
        vm.prank(stranger);
        vm.expectRevert("SupplyChain: not manufacturer or distributor");
        chain.recordTransfer(PRODUCT_ID, consumer, LOC_HASH, COND_HASH, "");
    }

    function test_RevertTransfer_Regulator() public {
        _registerProduct();
        vm.prank(regulator);
        vm.expectRevert("SupplyChain: not manufacturer or distributor");
        chain.recordTransfer(PRODUCT_ID, consumer, LOC_HASH, COND_HASH, "");
    }

    function test_RevertTransfer_ZeroRecipient() public {
        _registerProduct();
        vm.prank(manufacturer);
        vm.expectRevert("SupplyChain: zero recipient");
        chain.recordTransfer(PRODUCT_ID, address(0), LOC_HASH, COND_HASH, "");
    }

    function test_RevertTransfer_InactiveProduct() public {
        _registerProduct();
        // Deactivate first
        chain.deactivateProduct(PRODUCT_ID);
        vm.prank(manufacturer);
        vm.expectRevert("SupplyChain: product not active");
        chain.recordTransfer(PRODUCT_ID, distributor, LOC_HASH, COND_HASH, "");
    }

    // ── Deactivation ──────────────────────────────────────────────────────────

    function test_DeactivateByOwner() public {
        _registerProduct();
        chain.deactivateProduct(PRODUCT_ID);
        ISupplyChain.Product memory p = chain.getProduct(PRODUCT_ID);
        assertFalse(p.isActive);
    }

    function test_DeactivateByRegulator() public {
        _registerProduct();
        vm.prank(regulator);
        chain.deactivateProduct(PRODUCT_ID);
        ISupplyChain.Product memory p = chain.getProduct(PRODUCT_ID);
        assertFalse(p.isActive);
    }

    function test_DeactivateEmitsEvent() public {
        _registerProduct();
        vm.expectEmit(true, false, false, false);
        emit ProductDeactivated(PRODUCT_ID);
        chain.deactivateProduct(PRODUCT_ID);
    }

    function test_RevertDeactivate_Stranger() public {
        _registerProduct();
        vm.prank(stranger);
        vm.expectRevert("SupplyChain: not authorized to deactivate");
        chain.deactivateProduct(PRODUCT_ID);
    }

    // ── View functions ────────────────────────────────────────────────────────

    function test_ProductExists() public {
        assertFalse(chain.productExists(PRODUCT_ID));
        _registerProduct();
        assertTrue(chain.productExists(PRODUCT_ID));
    }

    function test_GetProductIds_Pagination() public {
        vm.startPrank(manufacturer);
        for (uint256 i = 0; i < 5; i++) {
            chain.registerProduct(keccak256(abi.encode(i)), METADATA_HASH);
        }
        vm.stopPrank();

        (bytes32[] memory page1, uint256 total) = chain.getProductIds(0, 3);
        assertEq(total,        5);
        assertEq(page1.length, 3);

        (bytes32[] memory page2,) = chain.getProductIds(3, 3);
        assertEq(page2.length, 2);
    }

    function test_GetHistory_EmptyForNewProduct() public {
        _registerProduct();
        ISupplyChain.TransferEvent[] memory history = chain.getHistory(PRODUCT_ID);
        assertEq(history.length, 0);
    }

    // ── Fuzz ──────────────────────────────────────────────────────────────────

    function testFuzz_OnlyManufacturerCanRegister(address caller) public {
        vm.assume(caller != manufacturer && caller != address(0));
        vm.prank(caller);
        vm.expectRevert();
        chain.registerProduct(keccak256(abi.encode(caller)), METADATA_HASH);
    }
}
