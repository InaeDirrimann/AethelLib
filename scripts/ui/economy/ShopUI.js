import { Kernel } from "../../core/Kernel.js"
import { EconomyStore } from "../../systems/economy/EconomyStore.js"
import { ShopRegistry } from "../../systems/shop/ShopRegistry.js"
import { UIUtils } from "../UIUtils.js"
import { ThemeTokens } from "../theme/ThemeTokens.js"
import { FormAtoms } from "../components/FormAtoms.js"
import { ShopController } from "./ShopController.js"
import { showCategoryUI } from "./ShopCategoryUI.js"
import { showSearchUI } from "./ShopSearchUI.js"
import { showInventorySellUI } from "./ShopInventoryUI.js"
import { showMainGUI } from "../MainGUI.js"

/**
 * Modernized Marketplace UI (AethelLib Economy)
 * Built with atomic component principles and separated business logic.
 */

function _buildShopForm(balance, categories) {
    const form = new Kernel.ActionFormData()
    FormAtoms.applyHeader(form, "Marketplace", balance, "Select a department or action to proceed:")
    FormAtoms.addSearchButton(form)

    const categoryNameMap = {
        BUILDING: { name: "Building Blocks", subtitle: "Stone, wood, glass & concrete", icon: ThemeTokens.Textures.Blocks },
        MATERIALS: { name: "Materials & Ores", subtitle: "Ingots, gems, redstone & raw goods", icon: ThemeTokens.Textures.Materials },
        EQUIPMENT: { name: "Weapons & Armor", subtitle: "Swords, bows, armor & shields", icon: ThemeTokens.Textures.Weapons },
        CONSUMABLES: { name: "Food & Potions", subtitle: "Crops, golden apples & potions", icon: ThemeTokens.Textures.Food },
        BLOCKS: { name: "Natural Blocks", subtitle: "Dirt, sand, gravel & foliage", icon: ThemeTokens.Textures.Misc },
        MISC: { name: "Miscellaneous", subtitle: "Tools, buckets & utility items", icon: ThemeTokens.Textures.Tools }
    }

    categories.forEach(cat => {
        const meta = categoryNameMap[cat.id.toUpperCase()] || {
            name: cat.id.charAt(0) + cat.id.slice(1).toLowerCase(),
            subtitle: "Browse department items",
            icon: cat.icon || ThemeTokens.Textures.Misc
        }
        FormAtoms.addCategoryButton(form, meta.name, meta.subtitle, meta.icon)
    })

    FormAtoms.addSellInventoryButton(form)
    FormAtoms.addQuickSellButton(form)
    FormAtoms.addBackButton(form, "RETURN TO MENU")
    return form
}

async function _handleShopSelection(player, selection, categories) {
    const totalCategories = categories.length
    const searchIndex = 0
    const sellInvIndex = 1 + totalCategories
    const quickSellIndex = 1 + totalCategories + 1
    const backIndex = 1 + totalCategories + 2

    if (selection === searchIndex) {
        Kernel.system.run(() => showSearchUI(player))
        return
    }
    if (selection === sellInvIndex) {
        Kernel.system.run(() => showInventorySellUI(player))
        return
    }
    if (selection === quickSellIndex) {
        const result = await ShopController.executeQuickSell(player)
        player.sendMessage(result.message)
        Kernel.system.run(() => showShopUI(player))
        return
    }
    if (selection === backIndex) {
        Kernel.system.run(() => showMainGUI(player))
        return
    }

    const selectedCategory = categories[selection - 1]
    if (selectedCategory) {
        Kernel.system.run(() => showCategoryUI(player, selectedCategory.id))
    }
}

export async function showShopUI(player) {
    if (!player || !player.isValid) return

    const balance = EconomyStore.getBalance(player)
    const categories = ShopRegistry.getCategories()

    const form = _buildShopForm(balance, categories)
    const res = await UIUtils.showForm(player, form)
    if (res.canceled) return

    await _handleShopSelection(player, res.selection, categories)
}
