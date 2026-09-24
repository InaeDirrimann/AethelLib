import { Kernel } from "../../core/Kernel.js";
import { EconomyStore } from "../../systems/economy/EconomyStore.js"
import { ShopStore } from "../../systems/economy/ShopStore.js"
import { ShopService } from "../../systems/economy/ShopService.js"
import { Lang } from "../Lang.js"
import { UIUtils } from "../UIUtils.js"
import { showShopUI } from "./ShopUI.js"

/*
 * SHOP_TRANSACTION_ENGINE
 */

export async function showBuyConfirmation(player, item) {
    const balance = await EconomyStore.getBalance(player)
    
    const form = new Kernel.ModalFormData()
        .title("\u00A76Buy: " + item.name.toUpperCase())
        .slider(`\u00A77Select Quantity\n\u00A78Unit Price: \u00A7a$${item.buy}\n\u00A78Balance: \u00A7a$${balance.toLocaleString()}`, 1, 64, 1, 1)
        .toggle("Confirm Purchase", false)

    
    const res = await UIUtils.showForm(player, form)
    if (res.canceled) return

    const [amount, confirm] = res.formValues
    if (!confirm) return

    const success = await ShopService.buy(player, item, amount)
    if (success) {
        Kernel.system.run(() => showShopUI(player))
    }
}

export async function showSellConfirmation(player, item) {
    const form = new Kernel.ModalFormData()
        .title("\u00A76Sell: " + item.name.toUpperCase())
        .slider(`\u00A77Select Quantity\n\u00A78Unit Value: \u00A7c$${item.sell}`, 1, 64, 1, 1)
        .toggle("Confirm Sale", false)

    
    const res = await UIUtils.showForm(player, form)
    if (res.canceled) return

    const [amount, confirm] = res.formValues
    if (!confirm) return

    const success = await ShopService.sell(player, item, amount)
    if (success) {
        Kernel.system.run(() => showShopUI(player))
    }
}

export async function handleQuickSell(player) {
    const equippable = player.getComponent(Kernel.EntityComponentTypes.Equippable)
    const slot = Kernel.EquipmentSlot?.Mainhand || "Mainhand"
    const mainhand = equippable?.getEquipment ? equippable.getEquipment(slot) : null

    if (!mainhand) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Your main hand is empty.")
        return
    }


    const shopItem = ShopStore.getItems().find(i => i.id === mainhand.typeId)
    if (!shopItem) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77This item cannot be sold here.")
        return
    }


    Kernel.system.run(() => showSellConfirmation(player, shopItem))
}

