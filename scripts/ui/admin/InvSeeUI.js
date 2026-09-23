import { Kernel } from "../../core/Kernel.js"
import { Lang } from "../Lang.js"
import { UIUtils } from "../UIUtils.js"
import { ThemeTokens } from "../theme/ThemeTokens.js"
import { getItemDetails, showItemActions, showGiveMenu, showClearConfirmation } from "./InvSeeActions.js"

/**
 * InvSeeUI (Native ContainerSlot Admin Inspector)
 * ----------------------------------------------------------------------------
 * High-performance inventory inspector using native Bedrock ContainerSlot handles.
 * Zero client-side resource pack hacks, zero legacy 1.16 bitshifts, 100% vanilla stable.
 */

function getInventorySummary(inv, equipComp) {
    let activeItems = 0
    for (let i = 0; i < inv.size; i++) {
        if (inv.getItem(i)) activeItems++
    }

    let armorCount = 0
    const armorSlots = [
        Kernel.EquipmentSlot.Head,
        Kernel.EquipmentSlot.Chest,
        Kernel.EquipmentSlot.Legs,
        Kernel.EquipmentSlot.Feet,
        Kernel.EquipmentSlot.Offhand
    ]
    armorSlots.forEach(s => { if (equipComp?.getEquipment(s)) armorCount++ })
    return { activeItems, armorCount }
}

export async function showInventoryUI(viewer, target) {
    if (!viewer?.isValid || !target?.isValid) return

    const invComp = target.getComponent(Kernel.EntityComponentTypes.Inventory)
    const equipComp = target.getComponent(Kernel.EntityComponentTypes.Equippable)
    const inv = invComp?.container

    if (!inv) {
        viewer.sendMessage(`${ThemeTokens.Colors.RedBold}[!] Target inventory container is unreachable.`)
        return
    }

    const { activeItems, armorCount } = getInventorySummary(inv, equipComp)
    const dimName = target.dimension.id.replace("minecraft:", "")

    const form = new Kernel.ActionFormData()
        .title(`\u00A76\u00A7l\u00BB \u00A7eINSPECT: ${target.name.toUpperCase()} \u00A76\u00A7l\u00AB`)
        .body(
            `\u00A77Player: \u00A7f${target.name} \u00A78| \u00A77Dimension: \u00A7e${dimName}\n` +
            `\u00A77Inventory: \u00A7a${activeItems}/36 slots \u00A78| \u00A77Armor/Offhand: \u00A7b${armorCount}/5 slots\n` +
            `\u00A78Select a section to inspect or modify:`
        )
        .button("\u00A7b\u00A7lEQUIPPED GEAR\n\u00A78Armor, Offhand & Durability", ThemeTokens.Textures.Armor)
        .button("\u00A7e\u00A7lHOTBAR SLOTS\n\u00A78Slots 1 to 9 (Active items)", ThemeTokens.Textures.Weapons)
        .button("\u00A7a\u00A7lMAIN BAG ITEMS\n\u00A78Browse non-empty items", ThemeTokens.Textures.Emerald)
        .button("\u00A76\u00A7lALL 36 SLOTS\n\u00A78Direct slot-by-slot picker", ThemeTokens.Textures.Misc)
        .button("\u00A7d\u00A7lGIVE ITEM\n\u00A78Transfer from your bag", ThemeTokens.Textures.Plus)
        .button("\u00A7c\u00A7lCLEAR INVENTORY\n\u00A78Wipe target's items", ThemeTokens.Textures.Close)
        .button("\u00A77\u00A7lCLOSE", ThemeTokens.Textures.Back)

    const res = await UIUtils.showForm(viewer, form)
    if (res.canceled) return

    switch (res.selection) {
        case 0: return showArmorMenu(viewer, target)
        case 1: return showHotbarMenu(viewer, target)
        case 2: return showBagMenu(viewer, target)
        case 3: return showAllSlotsMenu(viewer, target)
        case 4: return showGiveMenu(viewer, target, () => showInventoryUI(viewer, target))
        case 5: return showClearConfirmation(viewer, target, () => showInventoryUI(viewer, target))
        default: return
    }
}

// 1. Equipped Armor & Offhand Submenu
async function showArmorMenu(viewer, target) {
    if (!viewer?.isValid || !target?.isValid) return
    const equip = target.getComponent(Kernel.EntityComponentTypes.Equippable)
    if (!equip) return

    const slots = [
        { name: "Helmet", slot: Kernel.EquipmentSlot.Head, icon: "textures/items/diamond_helmet" },
        { name: "Chestplate", slot: Kernel.EquipmentSlot.Chest, icon: "textures/items/diamond_chestplate" },
        { name: "Leggings", slot: Kernel.EquipmentSlot.Legs, icon: "textures/items/diamond_leggings" },
        { name: "Boots", slot: Kernel.EquipmentSlot.Feet, icon: "textures/items/diamond_boots" },
        { name: "Offhand", slot: Kernel.EquipmentSlot.Offhand, icon: "textures/items/shield" }
    ]

    const form = new Kernel.ActionFormData()
        .title(`\u00A7b\u00A7lEQUIPPED: ${target.name}`)
        .body("\u00A77Click an equipped item to inspect or confiscate:")

    slots.forEach(s => {
        const item = equip.getEquipment(s.slot)
        if (item) {
            const { durability, enchants } = getItemDetails(item)
            const sub = [durability, enchants[0]].filter(Boolean).join(" | ") || `${item.amount}x`
            form.button(`\u00A7f\u00A7l${s.name}: ${item.typeId.replace("minecraft:", "")}\n\u00A78${sub}`, Lang.getTexture(item.typeId))
        } else {
            form.button(`\u00A78${s.name}: (Empty)\n\u00A78No item equipped`, s.icon)
        }
    })
    form.button("\u00A7c\u00A7lBACK", ThemeTokens.Textures.Back)

    const res = await UIUtils.showForm(viewer, form)
    if (res.canceled || res.selection === slots.length) {
        return showInventoryUI(viewer, target)
    }

    const chosen = slots[res.selection]
    const item = equip.getEquipment(chosen.slot)
    if (item) {
        return showItemActions(viewer, target, {
            item,
            name: chosen.name,
            clear: () => equip.setEquipment(chosen.slot, undefined),
            decrement: (qty) => {
                if (item.amount <= qty) equip.setEquipment(chosen.slot, undefined)
                else { item.amount -= qty; equip.setEquipment(chosen.slot, item) }
            },
            validate: () => equip.getEquipment(chosen.slot)?.typeId === item.typeId
        }, () => showArmorMenu(viewer, target))
    }
    return showArmorMenu(viewer, target)
}

// 2. Hotbar Menu (Slots 0-8)
async function showHotbarMenu(viewer, target) {
    if (!viewer?.isValid || !target?.isValid) return
    const inv = target.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
    if (!inv) return

    const form = new Kernel.ActionFormData()
        .title(`\u00A7e\u00A7lHOTBAR: ${target.name}`)
        .body("\u00A77Active Hotbar slots (1 to 9):")

    for (let i = 0; i < 9; i++) {
        const slot = inv.getSlot(i)
        const item = slot.getItem()
        if (item) {
            const { enchants } = getItemDetails(item)
            const sub = enchants[0] || `${item.amount}x in slot`
            form.button(`\u00A7f\u00A7l[${i + 1}] ${item.typeId.replace("minecraft:", "")}\n\u00A78${sub}`, Lang.getTexture(item.typeId))
        } else {
            form.button(`\u00A78[${i + 1}] (Empty)\n\u00A78Slot vacant`, "textures/ui/blank")
        }
    }
    form.button("\u00A7c\u00A7lBACK", ThemeTokens.Textures.Back)

    const res = await UIUtils.showForm(viewer, form)
    if (res.canceled || res.selection === 9) {
        return showInventoryUI(viewer, target)
    }

    const slotIndex = res.selection
    const slot = inv.getSlot(slotIndex)
    const item = slot.getItem()
    if (item) {
        return showItemActions(viewer, target, {
            item,
            name: `Hotbar Slot ${slotIndex + 1}`,
            clear: () => slot.setItem(undefined),
            decrement: (qty) => {
                if (slot.amount <= qty) slot.setItem(undefined)
                else slot.amount -= qty
            },
            validate: () => slot.getItem()?.typeId === item.typeId
        }, () => showHotbarMenu(viewer, target))
    }
    return showHotbarMenu(viewer, target)
}

// 3. Main Bag Menu (Only Non-Empty Items)
async function showBagMenu(viewer, target) {
    if (!viewer?.isValid || !target?.isValid) return
    const inv = target.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
    if (!inv) return

    const items = []
    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i)
        if (item) items.push({ item, slotIndex: i })
    }

    if (items.length === 0) {
        viewer.sendMessage(`${ThemeTokens.Colors.Yellow}[!] ${target.name}'s inventory is completely empty.`)
        return showInventoryUI(viewer, target)
    }

    const form = new Kernel.ActionFormData()
        .title(`\u00A7a\u00A7lMAIN BAG: ${target.name}`)
        .body(`\u00A77Found \u00A7e${items.length}\u00A77 non-empty item stacks:`)

    items.forEach(({ item, slotIndex }) => {
        const { enchants } = getItemDetails(item)
        const sub = [enchants[0], `Slot #${slotIndex}`].filter(Boolean).join(" | ")
        form.button(`\u00A7f\u00A7l${item.amount}x ${item.typeId.replace("minecraft:", "")}\n\u00A78${sub}`, Lang.getTexture(item.typeId))
    })
    form.button("\u00A7c\u00A7lBACK", ThemeTokens.Textures.Back)

    const res = await UIUtils.showForm(viewer, form)
    if (res.canceled || res.selection === items.length) {
        return showInventoryUI(viewer, target)
    }

    const chosen = items[res.selection]
    const slot = inv.getSlot(chosen.slotIndex)
    const item = slot.getItem()
    if (item) {
        return showItemActions(viewer, target, {
            item,
            name: `Slot #${chosen.slotIndex}`,
            clear: () => slot.setItem(undefined),
            decrement: (qty) => {
                if (slot.amount <= qty) slot.setItem(undefined)
                else slot.amount -= qty
            },
            validate: () => slot.getItem()?.typeId === item.typeId
        }, () => showBagMenu(viewer, target))
    }
    return showBagMenu(viewer, target)
}

// 4. All 36 Slots Menu (Exact Slot Grid)
async function showAllSlotsMenu(viewer, target) {
    if (!viewer?.isValid || !target?.isValid) return
    const inv = target.getComponent(Kernel.EntityComponentTypes.Inventory)?.container
    if (!inv) return

    const form = new Kernel.ActionFormData()
        .title(`\u00A76\u00A7lALL SLOTS: ${target.name}`)
        .body("\u00A77Direct 0-35 Slot Selector:")

    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i)
        if (item) {
            form.button(`\u00A7f[${i}] ${item.typeId.replace("minecraft:", "")}\n\u00A7a${item.amount}x`, Lang.getTexture(item.typeId))
        } else {
            form.button(`\u00A78[${i}] (Empty)`, "textures/ui/blank")
        }
    }
    form.button("\u00A7c\u00A7lBACK", ThemeTokens.Textures.Back)

    const res = await UIUtils.showForm(viewer, form)
    if (res.canceled || res.selection === inv.size) {
        return showInventoryUI(viewer, target)
    }

    const slotIndex = res.selection
    const slot = inv.getSlot(slotIndex)
    const item = slot.getItem()
    if (item) {
        return showItemActions(viewer, target, {
            item,
            name: `Slot #${slotIndex}`,
            clear: () => slot.setItem(undefined),
            decrement: (qty) => {
                if (slot.amount <= qty) slot.setItem(undefined)
                else slot.amount -= qty
            },
            validate: () => slot.getItem()?.typeId === item.typeId
        }, () => showAllSlotsMenu(viewer, target))
    }
    return showAllSlotsMenu(viewer, target)
}

export { showInventoryUI as showInvSeeUI }
