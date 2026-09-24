import { Kernel } from "../../core/Kernel.js"
import { EconomyStore } from "../economy/EconomyStore.js"

/*
 * AUCTION_DATA_CONTROLLER
 * ----------------------------------------------------------------------------
 * Persistence and state-management for auction manifest.
 */
export class AuctionStore {
    static formatMoney(amount) {
        return `\u00A76$\u00A7f${amount.toLocaleString()}`
    }

    /* 
     * MANIFEST_QUERY
     */
    static getAuctions() {
        try {
            const Database = Kernel.get("database")
            const stored = Database.getSharded("ae:auctions")
            return stored || []
        } catch (error) {
            console.error(`[AuctionStore] MANIFEST_LOAD_FAILURE: ${error}`)
            return []
        }
    }

    /* 
     * MANIFEST_COMMIT
     */
    static saveAuctions(auctions) {
        try {
            const Database = Kernel.get("database")
            const indexKey = "ae:auctions:index"
            const currentIndex = Database.get(indexKey) || []
            const newIds = auctions.map(a => a.id)

            // Delete shards that are no longer in the list
            for (const id of currentIndex) {
                if (!newIds.includes(id)) {
                    Database.deleteSharded("ae:auctions", id)
                }
            }

            // Write all current auctions
            for (const auction of auctions) {
                Database.setSharded("ae:auctions", auction.id, auction)
            }
            return true
        } catch (error) {
            console.error(`[AuctionStore] MANIFEST_SAVE_FAILURE: ${error}`)
            return false
        }
    }

    /* 
     * AUCTION_INJECTION
     */
    static createAuction(sellerId, sellerName, itemId, itemName, quantity, startingBid, buyNowPrice, duration = 24) {
        const auctions = this.getAuctions()
        const auction = {
            id: this.generateAuctionId(),
            sellerId: sellerId,
            sellerName: sellerName,
            itemId: itemId,
            itemName: itemName,
            quantity: quantity,
            startingBid: startingBid,
            currentBid: startingBid,
            currentBidder: null,
            currentBidderName: null,
            buyNowPrice: buyNowPrice,
            startTime: Date.now(),
            endTime: Date.now() + (duration * 60 * 60 * 1000),
            status: "active"
        }

        auctions.push(auction)
        this.saveAuctions(auctions)
        return auction
    }

    /* 
     * BID_PROTOCOL
     */
    static async placeBid(auctionId, bidderId, bidderName, bidAmount) {
        const auctions = this.getAuctions()
        const auction = auctions.find(a => a.id === auctionId)

        if (!auction) return { success: false, message: "AUCTION_NOT_FOUND" }
        if (auction.status !== "active") return { success: false, message: "AUCTION_INACTIVE" }
        if (Date.now() > auction.endTime) return { success: false, message: "AUCTION_EXPIRED" }
        if (auction.sellerId === bidderId) return { success: false, message: "SELF_BIDDING_PROHIBITED" }
        if (bidAmount <= auction.currentBid) return { success: false, message: `INSUFFICIENT_BID: MIN_BID: ${auction.currentBid + 1}` }

        if (auction.currentBidder && auction.currentBidder !== bidderId) {
            await this.refundBid(auction.currentBidder, auction.currentBid)
        }

        auction.currentBid = bidAmount
        auction.currentBidder = bidderId
        auction.currentBidderName = bidderName

        this.saveAuctions(auctions)
        return { success: true, message: "BID_ACCEPTED", auction: auction }
    }

    /* 
     * ACQUISITION_PROTOCOL
     */
    static async buyNow(auctionId, buyerId, buyerName) {
        const auctions = this.getAuctions()
        const auction = auctions.find(a => a.id === auctionId)

        if (!auction) return { success: false, message: "AUCTION_NOT_FOUND" }
        if (auction.status !== "active") return { success: false, message: "AUCTION_INACTIVE" }
        if (!auction.buyNowPrice || auction.buyNowPrice <= 0) return { success: false, message: "ACQUISITION_UNAVAILABLE" }
        if (auction.sellerId === buyerId) return { success: false, message: "SELF_ACQUISITION_PROHIBITED" }

        const buyerBalance = this.getPlayerBalance(buyerId)
        if (buyerBalance < auction.buyNowPrice) return { success: false, message: "INSUFFICIENT_LIQUIDITY" }

        const deducted = await this.removePlayerMoney(buyerId, auction.buyNowPrice)
        if (!deducted) return { success: false, message: "PAYMENT_FAILURE" }

        // Refund any active bidder before settling
        if (auction.currentBidder && auction.currentBidder !== buyerId) {
            await this.refundBid(auction.currentBidder, auction.currentBid)
        }

        await this.addPlayerMoney(auction.sellerId, auction.buyNowPrice)

        auction.status = "sold"
        auction.buyerId = buyerId
        auction.buyerName = buyerName
        auction.finalPrice = auction.buyNowPrice

        this.saveAuctions(auctions)
        return { success: true, message: "ACQUISITION_COMPLETE", auction: auction }
    }

    /* 
     * EXPIRATION_SETTLEMENT
     */
    static async endExpiredAuctions() {
        const auctions = this.getAuctions()
        const now = Date.now()
        const endedAuctions = []

        for (const auction of auctions) {
            if (auction.status === "active" && now > auction.endTime) {
                if (auction.currentBidder) {
                    await this.addPlayerMoney(auction.sellerId, auction.currentBid)
                    auction.status = "sold"
                    auction.buyerId = auction.currentBidder
                    auction.buyerName = auction.currentBidderName
                    auction.finalPrice = auction.currentBid
                } else {
                    auction.status = "expired"
                }
                endedAuctions.push(auction)
            }
        }

        if (endedAuctions.length > 0) this.saveAuctions(auctions)
        return endedAuctions
    }

    /* 
     * QUERY_VECTORS
     */
    static getPlayerAuctions(playerId) {
        return this.getAuctions().filter(a => a.sellerId === playerId)
    }

    static getActiveAuctions(limit = 45) {
        return this.getAuctions()
            .filter(a => a.status === "active")
            .sort((a, b) => b.endTime - a.endTime)
            .slice(0, limit)
    }

    /* 
     * REFUND_VECTOR
     */
    static async refundBid(playerId, amount) {
        return await EconomyStore.addMoney(playerId, amount)
    }

    /* 
     * BALANCE_QUERY
     */
    static getPlayerBalance(playerId) {
        return EconomyStore.getBalance(playerId)
    }

    /* 
     * BALANCE_MUTATION
     */
    static async addPlayerMoney(playerId, amount) {
        return await EconomyStore.addMoney(playerId, amount)
    }

    static async removePlayerMoney(playerId, amount) {
        return await EconomyStore.removeMoney(playerId, amount)
    }

    /* 
     * ID_GENERATION
     */
    static generateAuctionId() {
        return `AUCTION_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    }

    /* 
     * TEMPORAL_RESOLVER
     */
    static getTimeRemaining(endTime) {
        const now = Date.now()
        const remaining = Math.max(0, endTime - now)
        if (remaining === 0) return "SETTLED"
        const hours = Math.floor(remaining / (1000 * 60 * 60))
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000)
        return hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
    }

    /* 
     * MAINTENANCE_PURGE
     */
    static cleanupOldAuctions() {
        const auctions = this.getAuctions()
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
        const originalLength = auctions.length
        const filtered = auctions.filter(a => a.status === "active" || a.endTime > oneWeekAgo)
        if (filtered.length < originalLength) {
            this.saveAuctions(filtered)
            console.log(`[AuctionStore] PURGE_COMPLETE: ${originalLength - filtered.length} stale nodes decommissioned.`);
        }
    }

    /* 
     * ASSET_RECLAMATION
     */
    static claimAsset(auctionId, claimantId) {
        const auctions = this.getAuctions()
        const index = auctions.findIndex(a => a.id === auctionId)
        
        if (index === -1) return { success: false, message: "NODE_NOT_FOUND" }
        
        const auction = auctions[index]
        if (auction.status === "active") return { success: false, message: "NODE_STILL_ACTIVE" }

        if (auction.status === "sold") {
            if (auction.buyerId !== claimantId) return { success: false, message: "UNAUTHORIZED_CLAIM" }
        } else if (auction.status === "expired") {
            if (auction.sellerId !== claimantId) return { success: false, message: "UNAUTHORIZED_CLAIM" }
        } else {
            return { success: false, message: "UNAUTHORIZED_CLAIM" }
        }

        // Give the item to online claimant or abort without deleting auction
        const player = Kernel.world.getAllPlayers().find(p => p.id === claimantId);
        if (!player) {
            return { success: false, message: "PLAYER_OFFLINE" };
        }
        const inv = player.getComponent(Kernel.EntityComponentTypes.Inventory)?.container;
        if (!inv) return { success: false, message: "INVENTORY_UNAVAILABLE" };

        let remaining = auction.quantity;
        while (remaining > 0) {
            const take = Math.min(remaining, 64);
            const leftover = inv.addItem(new Kernel.ItemStack(auction.itemId, take));
            if (leftover && leftover.amount > 0) {
                try {
                    player.dimension.spawnItem(leftover, player.location);
                } catch (e) {
                    console.error(`[AuctionStore] Leftover drop error: ${e}`);
                }
            }
            remaining -= take;
        }

        auctions.splice(index, 1)
        this.saveAuctions(auctions)
        
        return { success: true, message: "ASSET_RECLAIMED" }
    }

    /* 
     * ADMINISTRATIVE_DECOMMISSION
     */
    static deleteAuction(auctionId) {
        const auctions = this.getAuctions()
        const filtered = auctions.filter(a => a.id !== auctionId)
        if (filtered.length < auctions.length) {
            this.saveAuctions(filtered)
            return true
        }
        return false
    }
}


