import { Kernel } from "../../core/Kernel.js";
import { MINECRAFT_ITEMS } from "../../data/minecraft-items.js"

/*
 * Sell Store
 * ----------------------------------------------------------------------------
 * Handles selling items and managing sell prices.
 */

export class SellStore {
    static formatMoney(amount) {
        return `\u00A76$\u00A7f${amount.toLocaleString()}`
    }

    /* 
     * VALUATION_MANIFEST_QUERY
     */
    static getSellPrices() {
        try {
            const Database = Kernel.get("database")
            const stored = Database.get("ae:sellPrices")
            return stored || this.getDefaultSellPrices()
        } catch (error) {
            console.error(`[SellStore] VALUATION_LOAD_FAILURE: ${error}`)
            return this.getDefaultSellPrices()
        }
    }

    /* 
     * VALUATION_MANIFEST_COMMIT
     */
    static saveSellPrices(prices) {
        try {
            const Database = Kernel.get("database")
            Database.set("ae:sellPrices", prices)
            return true
        } catch (error) {
            console.error(`[SellStore] VALUATION_SAVE_FAILURE: ${error}`)
            return false
        }
    }

    /* 
     * DEFAULT_VALUATION_ORCHESTRATION
     * Calibrates default liquidation rates at 50% of the acquisition cost.
     */
    static getDefaultSellPrices() {
        const prices = {}
        Object.entries(MINECRAFT_ITEMS).forEach(([id, item]) => {
            prices[id] = Math.floor(item.price * 0.5)
        })
        return prices
    }

    /* 
     * ASSET_VALUATION_QUERY
     * Integrates dynamic supply-side inflation scaling to prevent market dumping.
     */
    static getSellPrice(itemId) {
        const prices = this.getSellPrices()
        const basePrice = prices[itemId] || 0
        if (basePrice <= 0) return 0

        const Database = Kernel.get("database")
        const volume = Database?.get(`shop:volume:${itemId}`) || 0
        
        // Saturation Limit: 1000 units sold saturates the market.
        const saturationLimit = 1000
        const multiplier = Math.max(0.1, 1 - (volume / saturationLimit))

        return Math.max(1, Math.floor(basePrice * multiplier))
    }

    /* 
     * VALUATION_CALIBRATION_VECTOR
     */
    static updateSellPrice(itemId, price) {
        if (!MINECRAFT_ITEMS[itemId]) return false
        const prices = this.getSellPrices()
        prices[itemId] = Math.max(0, price)
        return this.saveSellPrices(prices)
    }

    /* 
     * LIQUIDATION_EXECUTION_PROTOCOL
     * Orchestrates the extraction of assets from the entity-inventory and 
     * the injection of credits into the liquidity-buffer.
     */
    static async sellItem(player, itemId, quantity) {
        const item = MINECRAFT_ITEMS[itemId]
        if (!item) return { success: false, message: "Item cannot be sold." }


        const sellPrice = this.getSellPrice(itemId)
        if (sellPrice <= 0) return { success: false, message: "This item is worth nothing." }


        const playerQuantity = this.getPlayerItemCount(player, itemId)
        if (playerQuantity < quantity) return { success: false, message: "You don't have enough of that item." }


        const totalValue = sellPrice * quantity

        if (!this.removePlayerItems(player, itemId, quantity)) return { success: false, message: "Failed to remove items from inventory." }


        const added = await this.addPlayerMoney(player.id, totalValue)
        if (!added) {
            this.givePlayerItems(player, itemId, quantity) // EMERGENCY_REFUND
            return { success: false, message: "Failed to add money to your account." }
        }

        // Increment dynamic supply volumes & insert into active list
        const Database = Kernel.get("database")
        if (Database) {
            const currentVolume = Database.get(`shop:volume:${itemId}`) || 0
            Database.set(`shop:volume:${itemId}`, currentVolume + quantity)

            const active = Database.get("market:active_items") || []
            if (!active.includes(itemId)) {
                active.push(itemId)
                Database.set("market:active_items", active)
            }
        }

        this.logTransaction(player.id, itemId, quantity, sellPrice, totalValue)

        return {
            success: true,
            message: `\u00A7a\u00A7l» \u00A7fSold \u00A7e${quantity}x ${item.name} \u00A7ffor \u00A7a$${totalValue.toLocaleString()}\u00A7f.`,
            item: item,

            quantity: quantity,
            totalValue: totalValue
        }
    }

    /* 
     * INVENTORY_BUFFER_QUERY
     */
    static getPlayerItemCount(player, itemId) {
        try {
            const container = player.getComponent(Kernel.EntityComponentTypes.Inventory)?.container // container?.
            let count = 0
            for (let i = 0; i < container.size; i++) {
                const item = container.getItem(i)
                if (item && item.typeId === itemId) count += item.amount
            }
            return count
        } catch (error) {
            console.error(`[SellStore] INVENTORY_QUERY_FAILURE: ${error}`)
            return 0
        }
    }

    /* 
     * INVENTORY_BUFFER_EXTRACTION
     */
    static removePlayerItems(player, itemId, quantity) {
        try {
            if (this.getPlayerItemCount(player, itemId) < quantity) return false;
            
            const container = player.getComponent(Kernel.EntityComponentTypes.Inventory)?.container // container?.
            let remaining = quantity
            for (let i = 0; i < container.size && remaining > 0; i++) {
                const item = container.getItem(i)
                if (item && item.typeId === itemId) {
                    const toRemove = Math.min(item.amount, remaining)
                    item.amount -= toRemove
                    remaining -= toRemove
                    if (item.amount <= 0) container.setItem(i, undefined)
                    else container.setItem(i, item)
                }
            }
            return remaining === 0
        } catch (error) {
            console.error(`[SellStore] INVENTORY_EXTRACTION_FAILURE: ${error}`)
            return false
        }
    }

    /* 
     * EMERGENCY_ASSET_RESTORATION
     */
    static givePlayerItems(player, itemId, quantity) {
        try {
            const container = player.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
            if (!container) {
                return false
            }
            
            const { ItemStack } = Kernel
            let remaining = quantity
            while (remaining > 0) {
                const take = Math.min(remaining, 64)
                const itemStack = new ItemStack(itemId, take)
                const leftover = container.addItem(itemStack)
                
                if (leftover && leftover.amount > 0) {
                    player.dimension.spawnItem(leftover, player.location)
                }
                remaining -= take
            }
            player.sendMessage(`\u00A7a\u00A7l» \u00A7fRefunded \u00A7e${quantity}x ${itemId}\u00A7f.`);
            return true
        } catch (error) {
            console.error(`[SellStore] EMERGENCY_REFUND_FAILURE: ${error}`)
            return false
        }
    }


    /* 
     * Balance helpers
     */
    static async addPlayerMoney(playerId, amount) {
        const player = Kernel.world.getAllPlayers().find(p => p.id === playerId)
        if (!player) return false
        
        const Economy = Kernel.get("economy")
        if (!Economy) return false
        return await Economy.addMoney(player, amount)
    }

    static getPlayerBalance(playerId) {
        const player = Kernel.world.getAllPlayers().find(p => p.id === playerId)
        if (!player) return 0
        
        const Economy = Kernel.get("economy")
        return Economy.getBalance(player)
    }

    /* 
     * TRANSACTION_LOGGING_PROTOCOL
     */
    static logTransaction(playerId, itemId, quantity, unitPrice, totalValue) {
        try {
            const transactions = this.getTransactions()
            const transaction = {
                id: this.generateTransactionId(),
                playerId: playerId,
                itemId: itemId,
                quantity: quantity,
                unitPrice: unitPrice,
                totalValue: totalValue,
                timestamp: Date.now(),
                type: "sell"
            }
            transactions.push(transaction)
            if (transactions.length > 500) transactions.splice(0, transactions.length - 500)
            
            const Database = Kernel.get("database")
            Database.set("ae:sellTransactions", transactions)
        } catch (error) {
            console.error(`[SellStore] LOG_COMMIT_FAILURE: ${error}`)
        }
    }

    static getTransactions() {
        try {
            const Database = Kernel.get("database")
            const stored = Database.get("ae:sellTransactions")
            return stored || []
        } catch (error) {
            console.error(`[SellStore] LOG_LOAD_FAILURE: ${error}`)
            return []
        }
    }

    /* 
     * IDENTIFIER_GENERATION_PROTOCOL
     */
    static generateTransactionId() {
        return `SELL_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    }

    /* 
     * ANALYTICS_QUERY_VECTORS
     */
    static getSellStats() {
        const transactions = this.getTransactions()
        const recentTransactions = transactions.filter(tx => 
            tx.type === "sell" && (Date.now() - tx.timestamp) < 24 * 60 * 60 * 1000
        )
        const totalSold = recentTransactions.reduce((sum, tx) => sum + tx.totalValue, 0)
        const itemsSold = recentTransactions.reduce((sum, tx) => sum + tx.quantity, 0)
        const uniqueItems = new Set(recentTransactions.map(tx => tx.itemId)).size

        return { totalSold, itemsSold, uniqueItems, transactions: recentTransactions.length }
    }
}


