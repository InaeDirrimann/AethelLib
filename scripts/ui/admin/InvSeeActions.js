import { Kernel } from "../../core/Kernel.js"
import { Lang } from "../Lang.js"
import { UIUtils } from "../UIUtils.js"
import { ThemeTokens } from "../theme/ThemeTokens.js"

/**
 * InvSeeActions
 * ----------------------------------------------------------------------------
 * Action handlers for taking, deleting, and giving items via ContainerSlot.
 * Hardened against dead/disconnected targets and concurrent item race conditions.
 */

export function toRoman(num) {
    const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]
    return roman[num] || String(num)
}

export function getItemDetails(item) {
    if (!item) return { enchants: [], durability: null, lore: [] }

    const enchants = []
    const enchantComp = item.getComponent("minecraft:enchantable")
    if (enchantComp) {
        const list = enchantComp.getEnchantments() || []
        for (const e of list) {
            const rawId = e.type?.id || "unknown"
            const name = rawId.replace("minecraft:", "").replace(/_/g, " ")
            const capName = name.charAt(0).toUpperCase() + name.slice(1)
            enchants.push(`${capName} ${toRoman(e.level)}`)
        }
    }

    let durability = null
    const durComp = item.getComponent("minecraft:durability")
    if (durComp) {
        const remaining = durComp.maxDurability - durComp.damage
        const pct = Math.round((remaining / durComp.maxDurability) * 100)
        durability = `${remaining}/${durComp.maxDurability} (${pct}%)`
    }

    const lore = item.getLore() || []
    return { enchants, durability, lore }
}

function _handleTakeAll(viewer, target, handle, viewerInv) {
    const { item, clear, decrement } = handle
    const clone = item.clone()
    const remainder = viewerInv.addItem(clone)
    if (remainder && remainder.amount > 0) {
        const taken = item.amount - remainder.amount
        if (taken > 0) decrement(taken)
        viewer.sendMessage(`\u00A7cYour inventory was partially full. Took \u00A7e${taken}x\u00A7c items.`)
    } else {
        clear()
        viewer.sendMessage(`\u00A7aSuccessfully took \u00A7e${item.amount}x ${item.typeId}\u00A7a from ${target.name}.`)
    }
}

function _handleTakeOne(viewer, target, handle, viewerInv) {
    const { item, decrement } = handle
    const single = item.clone()
    single.amount = 1
    const remainder = viewerInv.addItem(single)
    if (remainder && remainder.amount > 0) {
        viewer.sendMessage("\u00A7cYour inventory is full!")
    } else {
        decrement(1)
        viewer.sendMessage(`\u00A7aTook 1x ${item.typeId} from ${target.name}.`)
    }
}

export async function showItemActions(viewer, target, handle, returnCallback) {
    if (!viewer?.isValid || !target?.isValid) return
    const { item, name, clear, validate } = handle
    const { enchants, durability, lore } = getItemDetails(item)

    let info = `\u00A77Item: \u00A7e${item.typeId}\n\u00A77Amount: \u00A7f${item.amount}x\n`
    if (durability) info += `\u00A77Durability: \u00A7a${durability}\n`
    if (enchants.length > 0) info += `\u00A77Enchants: \u00A7b${enchants.join(", ")}\n`
    if (lore.length > 0) info += `\u00A77Lore: \u00A7d${lore.join(" / ")}\n`

    const form = new Kernel.ActionFormData()
        .title(`\u00A76\u00A7lITEM: ${name}`)
        .body(info)
        .button("\u00A7a\u00A7lTAKE TO MY BAG\n\u00A78Transfer all to your inventory", ThemeTokens.Textures.Plus)
        .button("\u00A7e\u00A7lTAKE 1 ONLY\n\u00A78Transfer single item", ThemeTokens.Textures.Paper)
        .button("\u00A7c\u00A7lCONFISCATE / DELETE\n\u00A78Remove item completely", ThemeTokens.Textures.Close)
        .button("\u00A77\u00A7lBACK", ThemeTokens.Textures.Back)

    const res = await UIUtils.showForm(viewer, form)
    if (res.canceled || res.selection === 3 || !viewer.isValid || !target.isValid) return returnCallback()

    if (typeof validate === "function" && !validate()) {
        viewer.sendMessage("\u00A7cItem was moved or removed concurrently!")
        return returnCallback()
    }

    const viewerInv = viewer.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
    if (!viewerInv) return returnCallback()

    if (res.selection === 0) _handleTakeAll(viewer, target, handle, viewerInv)
    else if (res.selection === 1) _handleTakeOne(viewer, target, handle, viewerInv)
    else if (res.selection === 2) {
        clear()
        viewer.sendMessage(`\u00A7cDeleted ${item.typeId} from ${target.name}.`)
    }
    return returnCallback()
}

function _deliverAdminItem(viewer, target, adminSlot, chosen, targetInv) {
    const toTransfer = chosen.item.clone()
    const remainder = targetInv.addItem(toTransfer)

    if (remainder && remainder.amount > 0) {
        const transferred = chosen.item.amount - remainder.amount
        if (transferred > 0) {
            const updated = chosen.item.clone()
            updated.amount = chosen.item.amount - transferred
            adminSlot.setItem(updated)
        }
        viewer.sendMessage(`\u00A7e${target.name}'s inventory was partially full. Delivered \u00A7a${transferred}x\u00A7e items.`)
    } else {
        adminSlot.setItem(undefined)
        viewer.sendMessage(`\u00A7aDelivered all \u00A7e${chosen.item.amount}x ${chosen.item.typeId}\u00A7a to ${target.name}.`)
        if (target.isValid) {
            target.sendMessage(`\u00A7aAdmin \u00A7e${viewer.name}\u00A7a gave you \u00A7e${chosen.item.amount}x ${chosen.item.typeId}\u00A7a!`)
        }
    }
}

export async function showGiveMenu(viewer, target, returnCallback) {
    if (!viewer?.isValid || !target?.isValid) return
    const viewerInv = viewer.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
    if (!viewerInv) return

    const items = []
    for (let i = 0; i < viewerInv.size; i++) {
        const item = viewerInv.getItem(i)
        if (item) items.push({ item, slotIndex: i })
    }

    if (items.length === 0) {
        viewer.sendMessage("\u00A7cYour inventory is empty. Nothing to give!")
        return returnCallback()
    }

    const form = new Kernel.ActionFormData()
        .title(`\u00A7d\u00A7lGIVE TO: ${target.name}`)
        .body("\u00A77Select an item from your bag to give:")

    items.forEach(({ item }) => {
        form.button(`\u00A7f${item.amount}x ${item.typeId.replace("minecraft:", "")}`, Lang.getTexture(item.typeId))
    })
    form.button("\u00A7c\u00A7lBACK", ThemeTokens.Textures.Back)

    const res = await UIUtils.showForm(viewer, form)
    if (res.canceled || res.selection === items.length || !viewer.isValid || !target.isValid) {
        return returnCallback()
    }

    const chosen = items[res.selection]
    const targetInv = target.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
    if (!targetInv) return

    const adminSlot = viewerInv.getSlot(chosen.slotIndex)
    const currentAdminItem = adminSlot.getItem()
    if (!currentAdminItem || currentAdminItem.typeId !== chosen.item.typeId) {
        viewer.sendMessage("\u00A7cItem was moved or removed from your inventory!")
        return returnCallback()
    }

    _deliverAdminItem(viewer, target, adminSlot, chosen, targetInv)
    return returnCallback()
}

export async function showClearConfirmation(viewer, target, returnCallback) {
    if (!viewer?.isValid || !target?.isValid) return
    const modal = new Kernel.ModalFormData()
        .title("\u00A7c\u00A7lCONFIRM INVENTORY CLEAR")
        .toggle(`Wipe all 36 slots + armor on ${target.name}?`, { defaultValue: false })

    const res = await UIUtils.showForm(viewer, modal)
    if (res.canceled || !res.formValues[0] || !viewer.isValid || !target.isValid) {
        return returnCallback()
    }

    const inv = target.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
    const equip = target.getComponent(Kernel.EntityComponentTypes.Equippable)

    if (inv) {
        for (let i = 0; i < inv.size; i++) {
            inv.getSlot(i).setItem(undefined)
        }
    }

    if (equip) {
        const slots = [
            Kernel.EquipmentSlot.Head,
            Kernel.EquipmentSlot.Chest,
            Kernel.EquipmentSlot.Legs,
            Kernel.EquipmentSlot.Feet,
            Kernel.EquipmentSlot.Offhand
        ]
        slots.forEach(s => equip.setEquipment(s, undefined))
    }

    viewer.sendMessage(`\u00A7cCleared all inventory and equipment on ${target.name}.`)
    if (target.isValid) {
        target.sendMessage("\u00A7cYour inventory was cleared by an administrator.")
    }
    return returnCallback()
}
