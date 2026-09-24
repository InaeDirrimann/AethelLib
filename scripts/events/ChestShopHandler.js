import { Kernel } from "../core/Kernel.js"

// ----------------------------------------------------------------------------
// | ChestShopHandler                                                         |
// | coordinates the interaction between physical blocks and commerce data.    |
// | handles sign placement, right-click transactions, and security locks.     |
// ----------------------------------------------------------------------------

// these are the magic strings players write on the first line of a sign.
const SHOP_HEADERS = ["[buy]", "[sell]"]

// ----------------------------------------------------------------------------
// | function: init                                                           |
// | registers all the world event listeners for the shop system.              |
// ----------------------------------------------------------------------------
export function init() {
    // ----------------------------------------------------------------------------
    // | playerPlaceBlock listener                                                |
    // | triggers when someone puts down a sign.                                  |
    // ----------------------------------------------------------------------------
    Kernel.world.afterEvents.playerPlaceBlock.subscribe((event) => {
        const block = event.block
        const player = event.player
        if (!block || !player) return

        // only care if the block is some kind of sign.
        const typeId = block.typeId
        if (!typeId.includes("sign")) return

        // we have to wait a few ticks because the sign text isn't updated 
        // until the player closes the native text-entry UI.
        Kernel.system.runTimeout(async () => {
            // check if the block is still there.
            if (!block.isValid) return
            try {
                // get the sign component to read the text.
                const signComponent = block.getComponent("minecraft:sign")
                if (!signComponent) return

                // check the front side of the sign.
                const frontText = signComponent.getText(Kernel.SignSide.Front)
                if (frontText === undefined || frontText === null) return

                // get the very first line of text.
                const firstLine = String(frontText).split("\n")[0]?.toLowerCase()?.trim()
                // if it's not a shop header, ignore it.
                if (!firstLine || !SHOP_HEADERS.includes(firstLine)) return

                // determine if this is a procurement (buy) or liquidation (sell) node.
                const shopType = firstLine === "[buy]" ? "buy" : "sell"
                // look for a container (chest/barrel) adjacent to this sign.
                const chest = getChestAround(block)

                if (!chest) {
                    player.sendMessage("\u00A7c\u00A7l» \u00A77No chest found next to the sign!");
                    return
                }
                
                // FIX: Retrieve SpatialCache directly for native, fast permission checks
                const { SpatialCache } = await import("../systems/protection/SpatialCache.js")
                if (SpatialCache && !SpatialCache.canBuild(player, chest.location)) {
                    player.sendMessage("§c§l» §7You do not have permission to link to this chest.");
                    return
                }

                // check if this chest is already being used by another shop.
                const ChestShopStore = Kernel.get("chestShopStore")
                const existing = ChestShopStore.findShopByChestLocation(chest.location, chest.dimension?.id)
                if (existing) {
                    player.sendMessage("\u00A7c\u00A7l» \u00A77This chest is already being used for a shop.");
                    return
                }

                // check if the player has permission to create a buy/sell chest shop.
                const PermissionManager = Kernel.get("permissions")
                if (PermissionManager) {
                    const permKey = shopType === "buy" ? "chestshop.create.buy" : "chestshop.create.sell"
                    if (!PermissionManager.hasPermission(player, permKey)) {
                        player.sendMessage("\u00A7c\u00A7l» \u00A77You do not have permission to create this type of shop.");
                        return
                    }
                }

                // everything looks good. show the configuration UI to the player.
                showSetupUI(player, shopType, block.location, chest.location)

            } catch (error) {
                // catch any weird engine crashes.
                console.error(`[ChestShopHandler] SIGN_SCAN_FAILURE: ${error}`)
            }
        }, 5)
    })

    // ----------------------------------------------------------------------------
    // | playerInteractWithBlock listener                                         |
    // | triggers when someone right-clicks a shop sign.                          |
    // ----------------------------------------------------------------------------
    Kernel.world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
        const block = event.block
        const player = event.player
        if (!block || !player) return

        // if it's not a sign, we don't care.
        if (!block.typeId.includes("sign")) return

        const ChestShopStore = Kernel.get("chestShopStore")
        // check if this specific sign is registered as a shop.
        const shop = ChestShopStore.getShop(block.location, block.dimension?.id)
        if (!shop) return

        // cancel the native event so the player doesn't open the 'edit sign' UI.
        event.cancel = true 

        // check if player has permission to buy/sell at chest shops
        const PermissionManager = Kernel.get("permissions")
        if (PermissionManager) {
            const permKey = shop.type === "buy" ? "chestshop.buy" : "chestshop.sell"
            if (!PermissionManager.hasPermission(player, permKey)) {
                player.sendMessage(`\u00A7c\u00A7l» \u00A77You do not have permission to use this ${shop.type} shop.`);
                return
            }
        }

        // don't let owners buy from themselves. 
        if (shop.ownerId === player.id) {
            player.sendMessage("\u00A7a\u00A7l» \u00A7fYou own this shop.");
            return
        }

        // kick off the transaction pipeline on the next tick.
        Kernel.system.run(() => {
            processTransaction(player, shop)
        })
    })

    // ----------------------------------------------------------------------------
    // | playerBreakBlock listener                                                |
    // | handles security. only owners and admins can break shops.                |
    // ----------------------------------------------------------------------------
    Kernel.world.beforeEvents.playerBreakBlock.subscribe((event) => {
        const block = event.block
        const player = event.player
        if (!block || !player) return

        // admins can break anything.
        if (player.hasTag("Admin") || player.hasTag("admin") || player.hasTag("AE")) return

        const ChestShopStore = Kernel.get("chestShopStore")
        
        // if they are breaking a sign.
        if (block.typeId.includes("sign")) {
            const shop = ChestShopStore.getShop(block.location, block.dimension?.id)
            // if it's a shop and they don't own it, block them.
            if (shop && shop.ownerId !== player.id) {
                event.cancel = true
                player.onScreenDisplay.setActionBar("\u00A7c\u00A7l» \u00A77This shop belongs to someone else!");
                return
            }

            // if it is their shop, unregister it from the database.
            if (shop && shop.ownerId === player.id) {
                ChestShopStore.removeShop(block.location, block.dimension?.id)
                Kernel.system.run(() => player.sendMessage("\u00A7a\u00A7l» \u00A7fShop removed."));
            }

            return
        }

        // if they are breaking a container (chest/barrel).
        const linkedShop = ChestShopStore.findShopByChestLocation(block.location, block.dimension?.id)
        // if this container is linked to a shop they don't own, block them.
        if (linkedShop && linkedShop.ownerId !== player.id) {
            event.cancel = true
            player.onScreenDisplay.setActionBar("\u00A7c\u00A7l» \u00A77This chest is linked to a shop!");
        }
    })

    console.log("[ChestShopHandler] TRANSACTIONAL_PIPELINE_ONLINE");
}

// ----------------------------------------------------------------------------
// | getChestAround                                                           |
// | scans the 6 adjacent blocks (up, down, north, south, east, west)          |
// | to find a container that can hold items.                                 |
// ----------------------------------------------------------------------------
function getChestAround(block) {
    const offsets = [
        { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }
    ]

    // list of supported container types.
    const containerTypes = ["chest", "barrel", "trapped_chest", "shulker"]

    for (const offset of offsets) {
        try {
            // avoid y-limit crashes.
            const ny = block.y + offset.y;
            if (ny < -64 || ny > 320) continue;
            
            const neighbor = block.offset(offset)
            // check if the neighbor exists and matches one of our container types.
            if (neighbor && containerTypes.some(t => neighbor.typeId.includes(t))) {
                return neighbor
            }
        } catch {
            // catch spatial overflow errors.
        }
    }
    return null
}

// ----------------------------------------------------------------------------
// | processTransaction                                                       |
// | high-level coordinator for buying/selling.                                |
// | validates that the physical chest still exists before starting.           |
// ----------------------------------------------------------------------------
async function processTransaction(buyer, shop) {
    try {
        const dim = buyer.dimension
        // find the chest in the world using the coordinates stored in the shop data.
        const chestBlock = dim.getBlock(shop.chestLocation)
        if (!chestBlock) {
            buyer.sendMessage("\u00A7c\u00A7l» \u00A77The shop's chest is missing!");
            return
        }

        // try to get the inventory component.
        const container = chestBlock.getComponent(Kernel.BlockComponentTypes.Inventory)?.container
        if (!container) {
            buyer.sendMessage("\u00A7c\u00A7l» \u00A77Could not open the shop's chest.");
            return
        }

        // route the transaction based on the shop type.
        if (shop.type === "buy") {
            await handleBuy(buyer, shop, container)
        } else {
            await handleSell(buyer, shop, container)
        }
    } catch (error) {
        // if anything crashes, log it and tell the player.
        console.error(`[ChestShopHandler] TRANSACTION_CRASH: ${error}`)
        buyer.sendMessage("\u00A7c\u00A7l» \u00A77Something went wrong with the transaction.");
    }
}

// ----------------------------------------------------------------------------
// | handleBuy                                                                |
// | logic for when a player buys an item from a chest shop.                  |
// ----------------------------------------------------------------------------
async function handleBuy(buyer, shop, container) {
    // calculate total bill.
    const totalCost = shop.price * shop.quantity
    const EconomyStore = Kernel.get("economy")
    const balance = EconomyStore.getBalance(buyer)

    // step 1: check if the buyer is broke.
    if (balance < totalCost) {
        buyer.sendMessage("\u00A7c\u00A7l» \u00A77You don't have enough money!");
        return
    }

    // step 2: scan the chest to see if it actually has enough items.
    let stockCount = 0
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i)
        if (item && item.typeId === shop.itemId) {
            stockCount += item.amount
        }
    }

    if (stockCount < shop.quantity) {
        buyer.sendMessage("\u00A7c\u00A7l» \u00A77This shop is out of stock!");
        return
    }

    // step 3: take the money first (pessimistic lock).
    const success = await EconomyStore.removeMoney(buyer, totalCost)
    if (!success) {
        buyer.sendMessage("\u00A7c\u00A7l» \u00A77Failed to process payment.");
        return
    }

    // step 4: try to give the item to the buyer.
    const { ItemStack } = Kernel
    const itemStack = new ItemStack(shop.itemId, shop.quantity)
    const buyerInv = buyer.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
    if (!buyerInv) return;

    // Bedrock addItem returns any leftover items if the inventory is full.
    const leftover = buyerInv.addItem(itemStack);

    if (leftover) {
        // if they had no room for some or all of the items.
        // we refund the difference.
        const failedAmount = leftover.amount;
        const costPerItem = shop.price;
        const refundAmount = failedAmount * costPerItem;

        await EconomyStore.addMoney(buyer, refundAmount);
        buyer.sendMessage(`\u00A7c\u00A7l» \u00A77Inventory full! Refunded \u00A7e$${refundAmount}\u00A77 for ${failedAmount} items.`);
        
        // adjust the amount we are actually going to take from the shop chest.
        const actualDelivered = shop.quantity - failedAmount;
        
        // if NOTHING was delivered, we're done here.
        if (actualDelivered <= 0) return;
        
        // temporarily update the shop object for the removal logic below.
        shop.quantity = actualDelivered;
    }

    // step 5: deduct the items from the shop's chest.
    let remaining = shop.quantity;
    for (let i = 0; i < container.size && remaining > 0; i++) {
        const item = container.getItem(i);
        if (item && item.typeId === shop.itemId) {
            const take = Math.min(item.amount, remaining);
            if (take >= item.amount) {
                // if we're taking the whole stack, clear the slot.
                container.setItem(i, undefined);
            } else {
                // otherwise just reduce the count.
                item.amount -= take;
                container.setItem(i, item);
            }
            remaining -= take;
        }
    }

    // step 6: pay the shop owner.
    // EconomyStore.addMoney supports offline players by passing the ownerId string.
    await EconomyStore.addMoney(shop.ownerId, totalCost);

    const owner = Kernel.world.getAllPlayers().find(p => p.id === shop.ownerId)
    if (owner) {
        owner.sendMessage(`\u00A7a\u00A7l» \u00A7fSold \u00A7e${shop.quantity}x ${shop.itemId} \u00A7fto \u00A7e${buyer.name}\u00A7f. Profit: \u00A7a$${totalCost}\u00A7f.`);
    }

    // tell the buyer it worked.
    buyer.sendMessage(`\u00A7a\u00A7l» \u00A7fPurchased \u00A7e${shop.quantity}x ${shop.itemId} \u00A7ffor \u00A7a$${totalCost}\u00A7f.`);
}

// ----------------------------------------------------------------------------
// | handleSell                                                               |
// | logic for when a player sells an item TO a chest shop.                   |
// ----------------------------------------------------------------------------
async function handleSell(seller, shop, container) {
    const sellerInv = seller.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
    if (!sellerInv) return

    const EconomyStore = Kernel.get("economy")

    // step 1: check if the owner can afford at least 1 unit.
    if (EconomyStore.getBalance(shop.ownerId) < shop.price) {
        seller.sendMessage("\u00A7c\u00A7l» \u00A77The shop owner cannot afford to buy your items!");
        return
    }

    // Determine maximum affordable units based on owner's budget
    const maxAffordable = Math.floor(EconomyStore.getBalance(shop.ownerId) / shop.price)
    const transactionQty = Math.min(shop.quantity, maxAffordable)

    if (transactionQty <= 0) {
        seller.sendMessage("\u00A7c\u00A7l» \u00A77The shop owner cannot afford this transaction!");
        return
    }

    // step 2: check if the seller actually has at least transactionQty items.
    let sellerStock = 0
    for (let i = 0; i < sellerInv.size; i++) {
        const item = sellerInv.getItem(i)
        if (item && item.typeId === shop.itemId) {
            sellerStock += item.amount
        }
    }

    if (sellerStock < transactionQty) {
        seller.sendMessage("\u00A7c\u00A7l» \u00A77You don't have enough items to sell!");
        return
    }

    // step 3: remove the sold items from the seller's inventory first (Synchronously!)
    let remaining = transactionQty
    for (let i = 0; i < sellerInv.size && remaining > 0; i++) {
        const item = sellerInv.getItem(i)
        if (item && item.typeId === shop.itemId) {
            const take = Math.min(item.amount, remaining)
            if (take >= item.amount) {
                sellerInv.setItem(i, undefined)
            } else {
                item.amount -= take
                sellerInv.setItem(i, item)
            }
            remaining -= take
        }
    }

    const actualTaken = transactionQty - remaining
    if (actualTaken <= 0) {
        seller.sendMessage("\u00A7c\u00A7l» \u00A77You don't have enough items to sell!");
        return
    }

    // step 4: add items to the chest to check capacity.
    const { ItemStack } = Kernel
    const testStack = new ItemStack(shop.itemId, actualTaken)
    const leftover = container.addItem(testStack)
    const delivered = leftover ? actualTaken - leftover.amount : actualTaken

    if (delivered <= 0) {
        // Refund the seller the items we took from them since chest is full
        sellerInv.addItem(new ItemStack(shop.itemId, actualTaken))
        seller.sendMessage("\u00A7c\u00A7l» \u00A77The shop's chest is full!");
        return
    }

    // If there is any leftover that couldn't fit in the chest, refund it to the seller
    if (leftover && leftover.amount > 0) {
        sellerInv.addItem(leftover)
    }

    // step 5: transfer money from shop owner to the seller.
    const finalCost = shop.price * delivered
    const txSuccess = await EconomyStore.transferMoney(shop.ownerId, seller, finalCost)

    if (!txSuccess) {
        // ROLLBACK: Remove the added items from the chest container!
        let toRemove = delivered
        for (let i = 0; i < container.size && toRemove > 0; i++) {
            const item = container.getItem(i)
            if (item && item.typeId === shop.itemId) {
                const take = Math.min(item.amount, toRemove)
                if (take >= item.amount) {
                    container.setItem(i, undefined)
                } else {
                    item.amount -= take
                    container.setItem(i, item)
                }
                toRemove -= take
            }
        }
        // Refund the seller
        sellerInv.addItem(new ItemStack(shop.itemId, delivered))
        seller.sendMessage("\u00A7c\u00A7l» \u00A77Transaction failed. Could not process payment transfer.");
        return
    }

    // tell the seller it worked.
    seller.sendMessage(`\u00A7a\u00A7l» \u00A7fSold \u00A7e${delivered}x ${shop.itemId} \u00A7ffor \u00A7a$${finalCost}\u00A7f.`);

    // notify the owner if they are online.
    const owner = Kernel.world.getAllPlayers().find(p => p.id === shop.ownerId)
    if (owner) {
        owner.sendMessage(`\u00A7a\u00A7l» \u00A7fBought \u00A7e${delivered}x ${shop.itemId} \u00A7ffrom \u00A7e${seller.name}\u00A7f. Cost: \u00A7c$${finalCost}\u00A7f.`);
    }
}

// ----------------------------------------------------------------------------
// | showSetupUI                                                              |
// | opens a modal form for the player to configure their new shop.           |
// ----------------------------------------------------------------------------
async function showSetupUI(player, shopType, signLocation, chestLocation) {
    const { ModalFormData } = Kernel
    const { UIUtils } = await import("../ui/UIUtils.js")

    // build the form.
    const form = new ModalFormData()
        .title("\u00A76Shop Setup")
        .textField("Item ID (e.g. minecraft:diamond)", "minecraft:diamond")
        .slider("Price per Unit", 1, 10000, 1, 1)
        .slider("Quantity per Trade", 1, 64, 1, 1)

    // show the form to the player.
    const response = await UIUtils.showForm(player, form)
    // if they closed it, stop.
    if (response.canceled) return

    // parse the inputs.
    const itemId = String(response.formValues[0] || "").trim()
    const price = Number(response.formValues[1])
    const quantity = Number(response.formValues[2])

    // basic validation.
    if (!itemId || !itemId.includes(":")) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Invalid Item ID. Example: 'minecraft:diamond'.");
        return
    }

    // register the shop in the database.
    const ChestShopStore = Kernel.get("chestShopStore")
    const success = ChestShopStore.createShop({
        ownerId: player.id,
        ownerName: player.name,
        itemId,
        price,
        quantity,
        type: shopType,
        dimensionId: player.dimension?.id || "minecraft:overworld",
        signLocation,
        chestLocation
    })

    if (success) {
        player.sendMessage(`\u00A7a\u00A7l» \u00A7fShop created successfully!`);
    } else {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Failed to create shop.");
    }
}


