import { Kernel } from "../../core/Kernel.js";
import { SellStore } from "../../systems/sell/SellStore.js"
import { MINECRAFT_ITEMS } from "../../data/minecraft-items.js"
import { UIUtils } from "../../ui/UIUtils.js";

// ----------------------------------------------------------------------------
// | object: SellCommand                                                      |
// | command definition for the centralized liquidation pipeline.              |
// | supports direct command input, hand-held selling, and visual browsing.    |
// ----------------------------------------------------------------------------
export const SellCommand = {
    // internal identifier.
    name: "sell",
    // human-readable description.
    description: "Sell items for money",
    // syntax guide.
    usage: "/ae:sell <item> [quantity]",
    // required permission node.
    permission: "essentials.sell",
    // command category.
    category: "economy",
    // native parameter definitions
    params: [
        { name: "item", type: "string", optional: true },
        { name: "quantity", type: "integer", optional: true }
    ],

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | entry point for the liquidation vector. routes to UI if no args,         |
    // | otherwise processes direct item removal and payout.                      |
    // ----------------------------------------------------------------------------
    async execute(_data, player, args) {
        // case 1: no arguments. trigger the visual sell management dashboard.
        if (args.length === 0) {
            showSellMenu(player)
            return
        }

        // case 2: direct command input.
        const itemName = args[0].toLowerCase()
        const quantity = parseInt(args[1]) || 1

        // quantity validation.
        if (quantity <= 0) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Quantity must be positive.");
            return
        }

        // step 1: item resolution.
        // search the industrial catalog for the target item.
        const item = findItem(itemName)
        if (!item) {
            player.sendMessage(`\u00A7c\u00A7l» \u00A77Item '\u00A7e${itemName}\u00A77' not found in catalog.`);
            return
        }

        // step 2: valuation check.
        // verify the item has a non-zero liquidity value in the sell store.
        const sellPrice = SellStore.getSellPrice(item.id)
        if (sellPrice <= 0) {
            player.sendMessage(`\u00A7c\u00A7l» \u00A7e${item.name} \u00A77cannot be liquidated.`);
            return
        }

        // step 3: transaction execution.
        // trigger the removal and payout sequence.
        const transaction = await SellStore.sellItem(player, item.id, quantity)
        
        if (transaction.success) {
            player.sendMessage(`\u00A7a\u00A7l» \u00A7f${transaction.message}`);
        } else {
            // display error (e.g. insufficient items in inventory).
            player.sendMessage(`\u00A7c\u00A7l» \u00A77${transaction.message}`);
        }
    }
}

// ----------------------------------------------------------------------------
// | function: showSellMenu                                                   |
// | visual dashboard for choosing between quick hand-selling and browsing.    |
// ----------------------------------------------------------------------------
function showSellMenu(player) {
    const form = new Kernel.MessageFormData()
        .title("\u00A76\u00A7lSell Items")
        .body("\u00A77Choose how you want to sell items:\n\n\u00A7a• Quick Sell - Sell hand item\n\u00A7a• Browse Items - Choose from inventory\n\u00A7a• Search Items - Find specific items\n\u00A7a• View Prices - Check sell values")
        .button1("\u00A7aQuick Sell")
        .button2("\u00A7bBrowse Items")

    // execute on next tick to satisfy engine UI constraints.
    Kernel.system.run(async () => {
        const res = await UIUtils.showForm(player, form)
        if (res.canceled) return
        if (res.selection === 1) quickSell(player)
        else showBrowseInventory(player)
    })
}

// ----------------------------------------------------------------------------
// | function: quickSell                                                      |
// | liquidates the item currently held in the player's primary slot.         |
// ----------------------------------------------------------------------------
async function quickSell(player) {
    try {
        // fetch item from current slot.
        const inv = player.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
        const selectedItem = inv ? inv.getItem(player.selectedSlotIndex) : null
        if (!selectedItem) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77No item in hand.");
            return
        }

        // map to catalog definition.
        const item = MINECRAFT_ITEMS[selectedItem.typeId]
        if (!item) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77This item cannot be sold.");
            return
        }

        // resolve valuation.
        const sellPrice = SellStore.getSellPrice(selectedItem.typeId)
        if (sellPrice <= 0) {
            player.sendMessage(`\u00A7c\u00A7l» \u00A7e${item.name} \u00A77cannot be sold.`);
            return
        }

        // execute transaction.
        const transaction = await SellStore.sellItem(player, selectedItem.typeId, selectedItem.amount)
        
        if (transaction.success) {
            player.sendMessage(`\u00A7a\u00A7l» \u00A7f${transaction.message}`);
        } else {
            player.sendMessage(`\u00A7c\u00A7l» \u00A77${transaction.message}`);
        }
    } catch (error) {
        console.error(`Quick sell error: ${error}`)
        player.sendMessage("\u00A7c\u00A7l» \u00A77Failed to sell item.");
    }
}

// ----------------------------------------------------------------------------
// | function: showBrowseInventory                                            |
// | scans the player container and presents a menu of all sellable assets.   |
// ----------------------------------------------------------------------------
function showBrowseInventory(player) {
    try {
        const inventory = player.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
        if (!inventory) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Failed to access inventory.");
            return
        }

        const items = []
        // scan all slots for assets with non-zero liquidation value.
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i)
            if (item && item.amount > 0) {
                const minecraftItem = MINECRAFT_ITEMS[item.typeId]
                if (minecraftItem) {
                    const sellPrice = SellStore.getSellPrice(item.typeId)
                    if (sellPrice > 0) {
                        items.push({
                            name: minecraftItem.name,
                            amount: item.amount,
                            sellPrice,
                            totalValue: sellPrice * item.amount,
                            id: item.typeId
                        })
                    }
                }
            }
        }

        if (items.length === 0) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77No sellable items in inventory.");
            return
        }

        const form = new Kernel.ActionFormData()
            .title("\u00A76\u00A7lSell Inventory")
            .body("Select an item to sell")

        // build buttons for each unique sellable item stack.
        items.forEach(item => {
            form.button(`\u00A7e${item.name} \u00A77x${item.amount} \u00A7a- ${SellStore.formatMoney(item.totalValue)}`)
        })

        Kernel.system.run(async () => {
            const res = await UIUtils.showForm(player, form)
            if (res.canceled) return
            // if an item is selected, open the quantity specification dialog.
            if (res.selection >= 0 && res.selection < items.length) {
                showSellDialog(player, items[res.selection])
            }
        })
    } catch (error) {
        console.error(`Browse inventory error: ${error}`)
        player.sendMessage("\u00A7c\u00A7l» \u00A77Failed to open inventory.");
    }
}

// ----------------------------------------------------------------------------
// | function: showSellDialog                                                 |
// | a detailed modal for specifying the exact quantity to liquidate.         |
// ----------------------------------------------------------------------------
function showSellDialog(player, item) {
    const form = new Kernel.ModalFormData()
        .title(`\u00A76\u00A7lSell ${item.name}`)
        .textField("Item Name:", item.name)
        .textField("Available:", item.amount.toString())
        .textField("Sell price:", SellStore.formatMoney(item.sellPrice))
        .textField("Total value:", SellStore.formatMoney(item.totalValue))
        .textField("Quantity to sell:", "Enter quantity...")

    Kernel.system.run(async () => {
        const res = await UIUtils.showForm(player, form)
        if (res.canceled) return
        // parse quantity from input field index 4.
        const quantity = parseInt(String(res.formValues[4]))
        if (quantity && quantity > 0) {
            const transaction = await SellStore.sellItem(player, item.id, quantity)
                    
            if (transaction.success) {
                player.sendMessage(`\u00A7a\u00A7l» \u00A7f${transaction.message}`);
            } else {
                player.sendMessage(`\u00A7c\u00A7l» \u00A77${transaction.message}`);
            }
        } else {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Invalid quantity.");
        }
    })
}

// ----------------------------------------------------------------------------
// | function: findItem                                                       |
// | search engine for the industrial item catalog.                           |
// ----------------------------------------------------------------------------
function findItem(query) {
    const lowerQuery = query.toLowerCase()
    
    // search by ID first (exact match).
    if (MINECRAFT_ITEMS[`minecraft:${query}`]) {
        return { id: `minecraft:${query}`, ...MINECRAFT_ITEMS[`minecraft:${query}`] }
    }

    // search by fuzzy name match.
    const matches = Object.entries(MINECRAFT_ITEMS)
        .filter(([id, item]) => 
            id.toLowerCase().includes(lowerQuery) || 
            item.name.toLowerCase().includes(lowerQuery)
        )
        .map(([id, item]) => ({ id, ...item }))

    // return the first match or null.
    return matches.length > 0 ? matches[0] : null
}


