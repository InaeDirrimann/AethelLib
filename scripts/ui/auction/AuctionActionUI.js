import { Kernel } from "../../core/Kernel.js";
import { AuctionStore } from "../../systems/auction/AuctionStore.js"
import { AuctionService } from "../../systems/auction/AuctionService.js"

import { UIUtils } from "../UIUtils.js"

/*
 * AUCTION_ACTION_INTERFACE
 */

export async function showAuctionDetailUI(player, auction) {
    const time = AuctionStore.getTimeRemaining(auction.endTime)
    const form = new Kernel.ActionFormData()
        .title("\u00A76Auction Details")

        .body(`\u00A77Item: \u00A7f${auction.itemName}\n\u00A77Qty: \u00A7e${auction.quantity}\n\u00A77Seller: \u00A7e${auction.sellerName}\n\u00A77Time: \u00A76${time}\n\n\u00A77Bid: \u00A7e$${auction.currentBid.toLocaleString()}\n\u00A77Bidder: \u00A7b${auction.currentBidderName || "NONE"}\n\u00A77Buy Now: \u00A7a$${auction.buyNowPrice ? auction.buyNowPrice.toLocaleString() : "DISABLED"}`)

    if (auction.status === "active") {
        if (auction.sellerId !== player.id) {
            form.button("\u00A7e\u00A7lPLACE BID\n\u00A78Submit a higher bid")
            if (auction.buyNowPrice > 0) form.button("\u00A7a\u00A7lBUY NOW\n\u00A78Buy this item instantly")
        } else form.button("\u00A7c\u00A7lCANCEL AUCTION\n\u00A78Remove from the auction house")

    } else form.button("\u00A76\u00A7lCLAIM ITEMS\n\u00A78Get your items or credits back")


    form.button("\u00A7cBack", "textures/ui/refresh")


    const res = await UIUtils.showForm(player, form)
    if (res.canceled) return
    
    const backIndex = (auction.status === "active" ? (auction.sellerId !== player.id ? (auction.buyNowPrice > 0 ? 3 : 2) : 2) : 2)
    if (res.selection === backIndex) {
        const { showBrowseUI } = await import("./AuctionBrowseUI.js")
        Kernel.system.run(() => showBrowseUI(player))
        return
    }

    // Logic for selection handled here... (omitted for brevity, assume split if needed)
    handleActionSelection(player, auction, res.selection)
}

async function handleActionSelection(player, auction, selection) {
    if (auction.status === "active") {
        if (auction.sellerId !== player.id) {
            if (selection === 0) Kernel.system.run(() => showBidUI(player, auction))
            if (selection === 1 && auction.buyNowPrice > 0) Kernel.system.run(() => handleBuyNow(player, auction))
        } else if (selection === 0) {
            AuctionStore.deleteAuction(auction.id)
            player.sendMessage("\u00A7a\u00A7l» \u00A7fAuction cancelled. Your item has been returned.")
        }

    } else if (selection === 0) {
        const result = AuctionStore.claimAsset(auction.id, player.id)
        player.sendMessage(`\u00A7a\u00A7l» \u00A7fSuccess: ${result.message}`)
    }

}

async function showBidUI(player, auction) {
    const minBid = auction.currentBid + Math.ceil(auction.currentBid * 0.05)
    const form = new Kernel.ModalFormData()
        .title("\u00A76Place Bid")

        .textField(`Amount (Min: \u00A7e$${minBid.toLocaleString()}\u00A77):`, "0")

    const res = await UIUtils.showForm(player, form)
    if (res.canceled) return

    await AuctionService.placeBid(player, auction, Number(res.formValues[0]))
}

async function handleBuyNow(player, auction) {
    const confirm = new Kernel.MessageFormData()
        .title("\u00A76Buy Now")

        .body(`Confirm purchase for \u00A7a$${auction.buyNowPrice.toLocaleString()}?`)
        .button1("\u00A7cCancel")
        .button2("\u00A7aBuy Now")


    const res = await UIUtils.showForm(player, confirm)
    if (res.canceled || res.selection === 1) return

    await AuctionService.buyNow(player, auction)
}

export async function showCreateUI(player) {
    const equippable = player.getComponent(Kernel.EntityComponentTypes.Equippable)
    const slot = Kernel.EquipmentSlot?.Mainhand || "Mainhand"
    const item = equippable?.getEquipment ? equippable.getEquipment(slot) : null

    if (!item) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77You must be holding an item to list it.")
        return
    }

    const form = new Kernel.ModalFormData()
        .title("\u00A76Create Auction")

        .textField(`Start Bid ($):\n\u00A78(Listing ${item.typeId.replace("minecraft:", "").toUpperCase()} x${item.amount})\u00A7r`, "100")
        .textField("Buy Now ($) [0 to disable]:", "1000")
        .slider("Duration (Hours):", 1, 48, { valueStep: 1, defaultValue: 24 })

    const res = await UIUtils.showForm(player, form)
    if (res.canceled) return

    // RE-VERIFY AFTER AWAIT: Check slot hasn't mutated during UI interaction
    const currentItem = equippable?.getEquipment ? equippable.getEquipment(slot) : null;
    if (!currentItem || currentItem.typeId !== item.typeId || currentItem.amount !== item.amount) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Transaction aborted: Asset state changed during UI operation.");
        return;
    }

    const [start, buy, dur] = res.formValues
    AuctionStore.createAuction(player.id, player.name, item.typeId, item.typeId.replace("minecraft:", "").toUpperCase(), item.amount, Number(start), Number(buy), Number(dur))
    equippable.setEquipment("Mainhand", undefined)
    player.sendMessage("\u00A7a\u00A7l» \u00A7fItem listed successfully on the Auction House!")
}


