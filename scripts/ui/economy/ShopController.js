import { Kernel } from "../../core/Kernel.js"
import { EconomyStore } from "../../systems/economy/EconomyStore.js"
import { ShopRegistry } from "../../systems/shop/ShopRegistry.js"
import { ThemeTokens } from "../theme/ThemeTokens.js"

/**
 * ShopController
 * ----------------------------------------------------------------------------
 * Decoupled controller managing commerce business logic, inventory capacity
 * validation, atomic transactions, and rollback safety.
 */

export const ShopController = {
    /**
     * Retrieves the player's container inventory.
     * @param {any} player
     * @returns {import("@minecraft/server").Container|null}
     */
    getInventory(player) {
        if (!player || !player.isValid) return null
        const invComponent = player.getComponent(Kernel.EntityComponentTypes.Inventory)
        return invComponent?.container || null
    },

    /**
     * Checks how many units of an item can fit in the player's inventory.
     * @param {any} player
     * @param {string} itemId
     * @returns {number}
     */
    getAvailableCapacity(player, itemId) {
        const inv = this.getInventory(player)
        if (!inv) return 0

        const maxStack = 64
        let capacity = 0

        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i)
            if (!item) {
                capacity += maxStack
            } else if (item.typeId === itemId) {
                capacity += Math.max(0, maxStack - item.amount)
            }
        }
        return capacity
    },

    /**
     * Helper to safely deliver purchased items with overflow ground-drop protection.
     */
    _deliverPurchasedItems(player, inv, resolvedId, qty) {
        let remaining = qty
        while (remaining > 0) {
            const batch = Math.min(remaining, 64)
            const stack = new Kernel.ItemStack(resolvedId, batch)
            const remainder = inv.addItem(stack)

            if (remainder && remainder.amount > 0) {
                player.dimension.spawnItem(remainder, player.location)
            }
            remaining -= batch
        }
    },

    /**
     * Executes an atomic item purchase with full inventory overflow protection.
     * @param {any} player
     * @param {{ id: string, itemId?: string, name: string, buy: number }} item
     * @param {number} amount
     * @returns {Promise<{ success: boolean, message: string }>}
     */
    async executeBuy(player, item, amount) {
        const inv = this.getInventory(player)
        if (!inv) return { success: false, message: "\u00A7cCannot access your inventory container." }

        const qty = Math.max(1, parseInt(amount) || 1)
        const unitPrice = Number(item.buy) || 0
        if (unitPrice <= 0 || !Number.isFinite(unitPrice)) {
            return { success: false, message: "\u00A7cInvalid item price." }
        }

        const totalCost = Math.round(unitPrice * qty * 100) / 100
        const currentBalance = EconomyStore.getBalance(player)
        if (currentBalance < totalCost) {
            return {
                success: false,
                message: `\u00A7cInsufficient funds! Need \u00A7e${ThemeTokens.Format.money(totalCost)}\u00A7c (Balance: \u00A7a${ThemeTokens.Format.money(currentBalance)}\u00A7c)`
            }
        }

        const resolvedId = item.itemId || item.id
        const availableCapacity = this.getAvailableCapacity(player, resolvedId)
        if (availableCapacity < qty) {
            return {
                success: false,
                message: `\u00A7cInventory full! You only have room for \u00A7e${availableCapacity}x\u00A7c items.`
            }
        }

        const debited = await EconomyStore.removeMoney(player, totalCost)
        if (!debited) return { success: false, message: "\u00A7cTransaction failed: Balance deduction error." }

        try {
            this._deliverPurchasedItems(player, inv, resolvedId, qty)
            return {
                success: true,
                message: `\u00A7aPurchased \u00A7e${qty}x ${item.name}\u00A7a for \u00A7e${ThemeTokens.Format.money(totalCost)}\u00A7a!`
            }
        } catch (error) {
            await EconomyStore.addMoney(player, totalCost)
            console.error(`[ShopController] BUY_ERROR: ${error}`)
            return { success: false, message: "\u00A7cItem delivery failed. Money refunded." }
        }
    },

    /**
     * Helper to deduct items across inventory slots.
     */
    _deductInventoryItems(inv, resolvedId, qty) {
        let remaining = qty
        for (let i = 0; i < inv.size && remaining > 0; i++) {
            const slotItem = inv.getItem(i)
            if (slotItem && slotItem.typeId === resolvedId) {
                if (slotItem.amount <= remaining) {
                    remaining -= slotItem.amount
                    inv.setItem(i, undefined)
                } else {
                    slotItem.amount -= remaining
                    inv.setItem(i, slotItem)
                    remaining = 0
                }
            }
        }
    },

    /**
     * Executes an item sale from player's inventory.
     * @param {any} player
     * @param {{ id: string, itemId?: string, name: string, sell: number }} item
     * @param {number} amount
     * @returns {Promise<{ success: boolean, message: string }>}
     */
    async executeSell(player, item, amount) {
        const inv = this.getInventory(player)
        if (!inv) return { success: false, message: "\u00A7cCannot access your inventory container." }

        const qty = Math.max(1, parseInt(amount) || 1)
        const unitPrice = Number(item.sell) || 0
        if (unitPrice <= 0 || !Number.isFinite(unitPrice)) {
            return { success: false, message: "\u00A7cInvalid item sell price." }
        }

        const resolvedId = item.itemId || item.id
        let availableCount = 0
        for (let i = 0; i < inv.size; i++) {
            const slotItem = inv.getItem(i)
            if (slotItem && slotItem.typeId === resolvedId) availableCount += slotItem.amount
        }

        if (availableCount < qty) {
            return {
                success: false,
                message: `\u00A7cYou don't have enough items! Have: \u00A7e${availableCount}\u00A7c, Need: \u00A7e${qty}\u00A7c.`
            }
        }

        this._deductInventoryItems(inv, resolvedId, qty)
        const totalEarned = Math.round(unitPrice * qty * 100) / 100
        await EconomyStore.addMoney(player, totalEarned)

        return {
            success: true,
            message: `\u00A7aSold \u00A7e${qty}x ${item.name}\u00A7a for \u00A7e${ThemeTokens.Format.money(totalEarned)}\u00A7a!`
        }
    },

    /**
     * Sells the item currently in player's main hand.
     * @param {any} player
     * @returns {Promise<{ success: boolean, message: string }>}
     */
    async executeQuickSell(player) {
        const equip = player.getComponent(Kernel.EntityComponentTypes.Equippable)
        const mainhand = equip?.getEquipment("Mainhand")

        if (!mainhand) {
            return { success: false, message: "\u00A7cYour main hand is empty!" }
        }

        const catalog = await ShopRegistry.getAllAssets()
        const match = catalog.find(i => (i.itemId || i.id) === mainhand.typeId)

        if (!match || !match.sell || match.sell <= 0) {
            return { success: false, message: `\u00A7c"${mainhand.typeId}" cannot be sold to the shop!` }
        }

        const count = mainhand.amount
        equip.setEquipment("Mainhand", undefined)

        const totalEarned = Math.round(match.sell * count * 100) / 100
        await EconomyStore.addMoney(player, totalEarned)

        return {
            success: true,
            message: `\u00A7aQuick-sold \u00A7e${count}x ${match.name}\u00A7a for \u00A7e${ThemeTokens.Format.money(totalEarned)}\u00A7a!`
        }
    }
}
