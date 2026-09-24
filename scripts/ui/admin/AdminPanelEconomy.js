/*
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  ᚫᛏᚻᛖᛚᚷᚱᚪᛞ  •  A E T H E L G R A D  S T U D I O S  •  ᚫᛏᚻᛖᛚᚷᚱᚪᛞ
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  
 *  Copyright (c) 2026 Aethelgrad Studios (Wladyslaw18).
 *  All Rights Reserved.
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU Affero General Public License for more details.
 *  
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program. If not, see <https://www.gnu.org/licenses/>.
 *  
 *  [ NOBLE INFRASTRUCTURE CORE  • 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/**
 * Admin Panel Economy - Economy control sub-panel
 */

import { Kernel } from "../../core/Kernel.js"
import { showAdminPanel } from "./AdminPanelMain.js"
import { EconomyStore } from "../../systems/economy/EconomyStore.js"
import { UIUtils } from "../UIUtils.js"
import { ValidationHelper } from "../../utils/ValidationHelper.js"
import { Lang } from "../Lang.js"

/** @typedef {import("@minecraft/server").Player} Player */

export async function showEconomyControl(player) {
    const PermissionManager = Kernel.get("permissions")
    if (!PermissionManager.hasPermission(player, "essentials.admin")) {
        player.sendMessage("\u00A7cNo permission.")
        return
    }
    const form = new Kernel.ActionFormData()
        .title(Lang.GRID_M + "\u00A76\u00A7lEconomy Control")
        .body("Select an economy action")
        .button("\u00A7aGive Money", "textures/items/emerald")
        .button("\u00A7bTake Money", "textures/items/gold_nugget")
        .button("\u00A7cSet Balance", "textures/items/gold_ingot")
        .button("\u00A7eView Economy Stats", "textures/items/paper")
        .button("\u00A7fReset Economy", "textures/items/barrier")
        .button("\u00A7cBack", "textures/ui/refresh")

    const res = await UIUtils.showForm(player, form)
    if (res.canceled) return

    switch (res.selection) {
        case 0:
            await showGiveMoneyInterface(player)
            break
        case 1:
            await showTakeMoneyInterface(player)
            break
        case 2:
            await showSetBalanceInterface(player)
            break
        case 3:
            await showEconomyStats(player)
            break
        case 4:
            await showResetEconomyInterface(player)
            break
        case 5:
            await showAdminPanel(player)
            break
    }
}

async function showGiveMoneyInterface(player) {
    const players = Kernel.world.getAllPlayers()
    if (players.length === 0) {
        player.sendMessage("§c§l» §7No players online.")
        await showEconomyControl(player)
        return
    }

    const form = new Kernel.ActionFormData()
        .title("§6§lGive Money")
        .body("Select a player to receive money:")

    players.forEach(p => {
        const bal = EconomyStore.getBalance(p)
        form.button(`${p.name}\n§e$${bal.toLocaleString()}`, "textures/items/totem")
    })

    form.button("§cBack", "textures/ui/refresh")

    const res = await UIUtils.showForm(player, form)
    if (res.canceled || res.selection === players.length) {
        await showEconomyControl(player)
        return
    }

    const target = players[res.selection]
    const currentBal = EconomyStore.getBalance(target)
    
    const amountForm = new Kernel.ModalFormData()
        .title(`§6Give Money: §f${target.name}`)
        .textField(`Target: §b${target.name}§r\nCurrent Balance: §e$${currentBal.toLocaleString()}§r\n\nEnter Amount to Add:`, "e.g. 1000", "1000")

    const amountRes = await UIUtils.showForm(player, amountForm)
    if (amountRes.canceled) {
        await showEconomyControl(player)
        return
    }

    const rawInput = amountRes.formValues[0]
    const amount = Math.floor(Number(rawInput))
    if (isNaN(amount) || amount <= 0 || !ValidationHelper.isValidMoney(amount)) {
        player.sendMessage("§c§l» §7Invalid amount. Must be a positive integer.")
        await showEconomyControl(player)
        return
    }

    const success = await EconomyStore.addMoney(target, amount)
    if (success) {
        const newBal = EconomyStore.getBalance(target)
        player.sendMessage(`§a§l» §fSuccessfully added §e$${amount.toLocaleString()} §fto §b${target.name}§f's balance. (New: §e$${newBal.toLocaleString()}§f)`)
        try {
            target.sendMessage(`§a§l» §fAn administrator added §e$${amount.toLocaleString()} §fto your balance. (New: §e$${newBal.toLocaleString()}§f)`)
        } catch (_) {}
    } else {
        player.sendMessage(`§c§l» §7Failed to add money to §e${target.name}§7's balance.`)
    }

    await showEconomyControl(player)
}

async function showTakeMoneyInterface(player) {
    const players = Kernel.world.getAllPlayers()
    if (players.length === 0) {
        player.sendMessage("§c§l» §7No players online.")
        await showEconomyControl(player)
        return
    }

    const form = new Kernel.ActionFormData()
        .title("§6§lTake Money")
        .body("Select a player to deduct money from:")

    players.forEach(p => {
        const bal = EconomyStore.getBalance(p)
        form.button(`${p.name}\n§e$${bal.toLocaleString()}`, "textures/items/totem")
    })

    form.button("§cBack", "textures/ui/refresh")

    const res = await UIUtils.showForm(player, form)
    if (res.canceled || res.selection === players.length) {
        await showEconomyControl(player)
        return
    }

    const target = players[res.selection]
    const currentBal = EconomyStore.getBalance(target)
    
    const amountForm = new Kernel.ModalFormData()
        .title(`§6Take Money: §f${target.name}`)
        .textField(`Target: §b${target.name}§r\nCurrent Balance: §e$${currentBal.toLocaleString()}§r\n\nEnter Amount to Deduct:`, "e.g. 1000", "1000")

    const amountRes = await UIUtils.showForm(player, amountForm)
    if (amountRes.canceled) {
        await showEconomyControl(player)
        return
    }

    const rawInput = amountRes.formValues[0]
    const amount = Math.floor(Number(rawInput))
    if (isNaN(amount) || amount <= 0 || !ValidationHelper.isValidMoney(amount)) {
        player.sendMessage("§c§l» §7Invalid amount. Must be a positive integer.")
        await showEconomyControl(player)
        return
    }

    const success = await EconomyStore.removeMoney(target, amount)
    if (success) {
        const newBal = EconomyStore.getBalance(target)
        player.sendMessage(`§a§l» §fSuccessfully deducted §e$${amount.toLocaleString()} §ffrom §b${target.name}§f's balance. (New: §e$${newBal.toLocaleString()}§f)`)
        try {
            target.sendMessage(`§c§l» §fAn administrator deducted §e$${amount.toLocaleString()} §ffrom your balance. (New: §e$${newBal.toLocaleString()}§f)`)
        } catch (_) {}
    } else {
        player.sendMessage(`§c§l» §7Failed to deduct funds. §b${target.name} §7only has §e$${currentBal.toLocaleString()}§7.`)
    }

    await showEconomyControl(player)
}

async function showSetBalanceInterface(player) {
    const players = Kernel.world.getAllPlayers()
    if (players.length === 0) {
        player.sendMessage("§c§l» §7No players online.")
        await showEconomyControl(player)
        return
    }

    const form = new Kernel.ActionFormData()
        .title("§6§lSet Balance")
        .body("Select a player to calibrate balance:")

    players.forEach(p => {
        const bal = EconomyStore.getBalance(p)
        form.button(`${p.name}\n§e$${bal.toLocaleString()}`, "textures/items/totem")
    })

    form.button("§cBack", "textures/ui/refresh")

    const res = await UIUtils.showForm(player, form)
    if (res.canceled || res.selection === players.length) {
        await showEconomyControl(player)
        return
    }

    const target = players[res.selection]
    const currentBal = EconomyStore.getBalance(target)
    
    const amountForm = new Kernel.ModalFormData()
        .title(`§6Set Balance: §f${target.name}`)
        .textField(`Target: §b${target.name}§r\nCurrent Balance: §e$${currentBal.toLocaleString()}§r\n\nEnter New Balance:`, "e.g. 1000", String(currentBal))

    const amountRes = await UIUtils.showForm(player, amountForm)
    if (amountRes.canceled) {
        await showEconomyControl(player)
        return
    }

    const rawInput = amountRes.formValues[0]
    const amount = Math.floor(Number(rawInput))
    if (isNaN(amount) || amount < 0 || !ValidationHelper.isValidMoney(amount)) {
        player.sendMessage("§c§l» §7Invalid amount. Must be a non-negative integer.")
        await showEconomyControl(player)
        return
    }

    const success = await EconomyStore.setBalance(target, amount)
    if (success) {
        player.sendMessage(`§a§l» §fSuccessfully set §b${target.name}§f's balance to §e$${amount.toLocaleString()}§f.`)
        try {
            target.sendMessage(`§e§l» §fYour balance was set to §e$${amount.toLocaleString()} §fby an administrator.`)
        } catch (_) {}
    } else {
        player.sendMessage(`§c§l» §7Failed to set balance for §b${target.name}§7.`)
    }

    await showEconomyControl(player)
}

async function showEconomyStats(player) {
    const allPlayers = Kernel.world.getAllPlayers()
    const balances = EconomyStore.getAllBalances()

    let body = "\u00A77=== \u00A76Economy Overview \u00A77===\n\n"

    // Total money in circulation
    const totalMoney = balances.reduce((sum, entry) => sum + (entry.balance || 0), 0)
    body += `\u00A7eTotal Money in Circulation: \u00A7f$${totalMoney.toLocaleString()}\n`

    // Online player count
    body += `\u00A7ePlayers Online: \u00A7f${allPlayers.length}\n`

    // Top 5 richest
    const sorted = [...balances].sort((a, b) => b.balance - a.balance)
    const top5 = sorted.slice(0, 5)
    if (top5.length > 0) {
        body += "\n\u00A76\u00A7lWealthiest Players:\n"
        top5.forEach((entry, i) => {
            const medal = i === 0 ? "\u00A7e\u2605" : i === 1 ? "\u00A77\u2605" : i === 2 ? "\u00A76\u2605" : "\u00A78\u2605"
            body += `  ${medal} \u00A7f${entry.name}: \u00A7a$${entry.balance.toLocaleString()}\n`
        })
    } else {
        body += "\n\u00A78No economy data available yet.\n"
    }

    // Default starting balance
    body += `\n\u00A78Starting Balance: $${EconomyStore.DEFAULT_BALANCE?.toLocaleString() ?? "N/A"}\n`

    // Count of players with a balance record
    body += `\u00A78Player Records: \u00A7f${balances.length}\n`

    const form = new Kernel.ActionFormData()
        .title(Lang.GRID_M + "\u00A76\u00A7lEconomy Stats")
        .body(body)
        .button("\u00A7cBack")

    const res = await UIUtils.showForm(player, form)
    if (res.canceled || res.selection === 0) {
        await showEconomyControl(player)
        return
    }
}

async function showResetEconomyInterface(player) {
    const form = new Kernel.ActionFormData()
        .title(Lang.GRID_M + "\u00A7c\u00A7lReset Economy")
        .body("\u00A7c\u00A7l\u26A0\uFE0F WARNING: \u00A77This resets player balances.\nChoose reset scope:")
        .button("\u00A74\u00A7lReset ALL Players", "textures/ui/cancel")
        .button("\u00A7eReset Single Player", "textures/items/gold_ingot")
        .button("\u00A7cBack", "textures/ui/refresh")

    const res = await UIUtils.showForm(player, form)
    if (res.canceled) return

    switch (res.selection) {
        case 0:
            await showConfirmResetAll(player)
            break
        case 1:
            await showResetSinglePlayerPicker(player)
            break
        case 2:
            await showEconomyControl(player)
            break
    }
}

async function showConfirmResetAll(player) {
    const confirmForm = new Kernel.ModalFormData()
        .title("\u00A7c\u00A7lReset ALL Balances")
        .textField("Type \u00A7cRESET\u00A7f to confirm:", "")
        .toggle("I understand this cannot be undone", false)

    const res = await UIUtils.showForm(player, confirmForm)
    if (res.canceled || !res.formValues[1]) {
        await showResetEconomyInterface(player)
        return
    }

    const typed = String(res.formValues[0]).trim().toUpperCase()
    if (typed !== "RESET") {
        player.sendMessage("\u00A7c\u00A7l\u00BB \u00A77Confirmation failed. Type \u00A7cRESET\u00A77 to confirm.")
        await showResetEconomyInterface(player)
        return
    }

    const balances = EconomyStore.getAllBalances()
    let resetCount = 0

    for (const entry of balances) {
        try {
            await EconomyStore.setBalance(entry.name, EconomyStore.DEFAULT_BALANCE)
            resetCount++
        } catch (e) {
            player.sendMessage(`\u00A7cFailed to reset ${entry.name}: ${e.message}`)
        }
    }

    player.sendMessage(`\u00A7a\u00A7l\u00BB \u00A77Reset ${resetCount}/${balances.length} player balances to \u00A7e$${EconomyStore.DEFAULT_BALANCE}`)
    await showEconomyControl(player)
}

async function showResetSinglePlayerPicker(player) {
    const players = Kernel.world.getAllPlayers()
    if (players.length === 0) {
        player.sendMessage("\u00A7cNo players online.")
        await showResetEconomyInterface(player)
        return
    }

    const form = new Kernel.ActionFormData()
        .title("\u00A7e\u00A7lReset Single Player")
        .body("Select a player to reset to default balance")

    players.forEach(p => form.button(p.name, "textures/items/totem"))
    form.button("\u00A7cBack", "textures/ui/refresh")

    const res = await UIUtils.showForm(player, form)
    if (res.canceled || res.selection === players.length) {
        await showResetEconomyInterface(player)
        return
    }

    const target = players[res.selection]
    const currentBalance = EconomyStore.getBalance(target)

    const confirmForm = new Kernel.ModalFormData()
        .title(`\u00A7cReset ${target.name}`)
        .textField(`Current: $${currentBalance}. Type \u00A7cYES\u00A7f to reset to $${EconomyStore.DEFAULT_BALANCE}:`, "YES")
        .toggle("Confirm reset", false)

    const confirmRes = await UIUtils.showForm(player, confirmForm)
    if (confirmRes.canceled || !confirmRes.formValues[1]) {
        await showResetEconomyInterface(player)
        return
    }

    const typed = String(confirmRes.formValues[0]).trim().toUpperCase()
    if (typed !== "YES") {
        player.sendMessage("\u00A7cReset cancelled. Type \u00A7cYES\u00A77 to confirm.")
        await showResetEconomyInterface(player)
        return
    }

    await EconomyStore.setBalance(target, EconomyStore.DEFAULT_BALANCE)
    player.sendMessage(`\u00A7a\u00A7l\u00BB \u00A77Reset \u00A7f${target.name}\u00A77's balance to \u00A7e$${EconomyStore.DEFAULT_BALANCE}`)
    await showEconomyControl(player)
}
