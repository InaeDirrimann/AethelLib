import { Kernel } from "../../core/Kernel.js";
import { EconomyStore } from "./EconomyStore.js"
import { Lang } from "../../ui/Lang.js"

/*
 * INDUSTRIAL_SHOP_SERVICE
 * ----------------------------------------------------------------------------
 * The orchestration layer for asset-to-credit transactions. 
 * Implements atomic balance checks and inventory synchronization.
 */

export class ShopService {
    /**
     * ASSET_ACQUISITION_HANDSHAKE
     */
    static async buy(player, item, amount) {
        const totalCost = Number(item.buy) * amount
        const balance = await EconomyStore.getBalance(player)

        if (balance < totalCost) {
            player.sendMessage(Lang.ERROR + `INSUFFICIENT CREDITS: Need $${totalCost.toLocaleString()}.`)
            return false
        }

        await EconomyStore.removeMoney(player, totalCost)
        this.giveItem(player, item.id, amount)
        player.sendMessage(Lang.SUCCESS + `ACQUIRED: ${amount}x ${item.name} for \u00A7a$${totalCost.toLocaleString()}.`)
        return true
    }

    /**
     * ASSET_LIQUIDATION_HANDSHAKE
     */
    static async sell(player, item, amount) {
        const totalValue = Number(item.sell) * amount

        if (!this.hasItem(player, item.id, amount)) {
            player.sendMessage(Lang.ERROR + "INSUFFICIENT ASSETS: Transaction voided.")
            return false
        }

        this.removeItem(player, item.id, amount)
        await EconomyStore.addMoney(player, totalValue)
        player.sendMessage(Lang.SUCCESS + `LIQUIDATED: ${amount}x ${item.name} for \u00A7a$${totalValue.toLocaleString()}.`)
        return true
    }

    /* 
     * INVENTORY_SYNCHRONIZATION_PRIMITIVES
     */
    static giveItem(player, itemId, amount) {
        const inv = player.getComponent(Kernel.EntityComponentTypes.Inventory)?.container // inv?.
        let remaining = amount
        while (remaining > 0) {
            const take = Math.min(remaining, 64)
            inv.addItem(new Kernel.ItemStack(itemId, take))
            remaining -= take
        }
    }

    static hasItem(player, itemId, amount) {
        const inv = player.getComponent(Kernel.EntityComponentTypes.Inventory)?.container // inv?.
        let count = 0
        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i)
            if (item && item.typeId === itemId) count += item.amount
        }
        return count >= amount
    }

    static removeItem(player, itemId, amount) {
        const inv = player?.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
        if (!inv) return
        let remaining = amount
        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i)
            if (item && item.typeId === itemId) {
                const take = Math.min(item.amount, remaining)
                if (item.amount === take) {
                    inv.setItem(i, undefined)
                } else {
                    item.amount -= take
                    inv.setItem(i, item)
                }
                remaining -= take
            }
            if (remaining <= 0) break
        }
    }
}
