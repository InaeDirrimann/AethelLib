import { Kernel } from "../../core/Kernel.js";
import { ShopRegistry } from "../../systems/shop/ShopRegistry.js"
import { Lang } from "../Lang.js"
import { UIUtils } from "../UIUtils.js"
import { showShopUI } from "./ShopUI.js"
// @ts-ignore
import { showBuyConfirmation } from "./ShopTransaction.js"

export async function showCategoryUI(player, category) {
    const items = await ShopRegistry.getAssetsByCategory(category)
    const form = new Kernel.ActionFormData()
        .title(Lang.GOLD + "SHOP: " + category)
        .body(items.length > 0 
            ? `\u00A77Browsing ${items.length} nodes in vector.`
            : "\u00A7cMANIFEST DECOMMISSIONED: No items found in this vector.")
        
    let sortedItems = []
    if (items.length > 0) {
        // Sort items by priority (Industrial Catalog Optimization)
        sortedItems = [...items].sort((a, b) => (a.priority || 99) - (b.priority || 99))
        
        sortedItems.forEach(item => {
            const id = item.itemId || "minecraft:stone"
            form.button(`\u00A7f\u00A7l${item.name}\n\u00A7aPrice: $${item.price.toLocaleString()}`, Lang.getTexture(id))
        })
    } else {
        form.button("\u00A7e\u00A7lREFRESH MANIFEST", "textures/ui/refresh")
    }

    form.button("\u00A7c\u00A7l[BACK]", "textures/ui/refresh")

    const res = await UIUtils.showForm(player, form)
    
    const backIndex = items.length > 0 ? items.length : 1
    if (res.canceled || res.selection === backIndex) {
        Kernel.system.run(() => showShopUI(player))
        return
    }

    if (items.length === 0 && res.selection === 0) {
        Kernel.system.run(() => showCategoryUI(player, category))
        return
    }

    const selected = sortedItems[res.selection]
    Kernel.system.run(() => showBuyConfirmation(player, { ...selected, id: selected.itemId }))
}
