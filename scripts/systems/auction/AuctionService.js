import { AuctionStore } from "../../systems/auction/AuctionStore.js"
import { EconomyStore } from "../economy/EconomyStore.js"
import { Lang } from "../../ui/Lang.js"

/*
 * INDUSTRIAL_AUCTION_SERVICE
 * ----------------------------------------------------------------------------
 * Handles bidding, listing, and settlement logic.
 */

export class AuctionService {
    static async placeBid(player, auction, amount) {
        const minBid = auction.currentBid + Math.ceil(auction.currentBid * 0.05)
        if (amount < minBid) {
            player.sendMessage(Lang.ERROR + "INVALID BID: Minimum not met.")
            return false
        }

        const balance = EconomyStore.getBalance(player)
        if (balance < amount) {
            player.sendMessage(Lang.ERROR + "INSUFFICIENT LIQUIDITY.")
            return false
        }

        const deducted = await EconomyStore.removeMoney(player, amount)
        if (!deducted) {
            player.sendMessage(Lang.ERROR + "TRANSACTION FAILED: Unable to hold bid funds.")
            return false
        }

        const result = await AuctionStore.placeBid(auction.id, player.id, player.name, amount)
        if (result.success) {
            player.sendMessage(Lang.SUCCESS + `BID ACCEPTED: High bidder for ${auction.itemName}.`)
            return true
        }

        await EconomyStore.addMoney(player, amount)
        player.sendMessage(Lang.ERROR + `ERROR: ${result.message}`)
        return false
    }

    static async buyNow(player, auction) {
        const balance = await EconomyStore.getBalance(player)
        if (balance < auction.buyNowPrice) {
            player.sendMessage(Lang.ERROR + "INSUFFICIENT LIQUIDITY.")
            return false
        }

        const result = AuctionStore.buyNow(auction.id, player.id, player.name)
        if (result.success) {
            player.sendMessage(Lang.SUCCESS + `PURCHASE COMPLETE: Asset secured.`)
            return true
        }

        player.sendMessage(Lang.ERROR + `ERROR: ${result.message}`)
        return false
    }
}
