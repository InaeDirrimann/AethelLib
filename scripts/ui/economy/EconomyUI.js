import { Kernel } from "../../core/Kernel.js";
import { UIUtils } from "../UIUtils.js";
import { EconomyStore } from "../../systems/economy/EconomyStore.js";
import { BanknoteStore } from "../../systems/banknote/BanknoteStore.js";

/*
 * EconomyUI
 * ----------------------------------------------------------------------------
 * A sleek, glassy player economy menu interface.
 */

export async function showEconomyMenu(player) {
    const balance = EconomyStore.getBalance(player.id);
    const form = new Kernel.ActionFormData()
        .title("\u00A76\u00A7lECONOMY MENU")
        .body(`\u00A77Your Balance: \u00A7a$${balance.toLocaleString()}\n\n\u00A77Manage your funds or view the richest players.`)
        .button("\u00A7ePay Player", "textures/items/gold_ingot")
        .button("\u00A7bRichest Players (Top 10)", "textures/items/gold_block")
        .button("\u00A7aWithdraw Banknote", "textures/items/paper")
        .button("\u00A7cBACK", "textures/ui/refresh");

    const res = await UIUtils.showForm(player, form);
    if (res.canceled) return;

    switch (res.selection) {
        case 0:
            await showPayPlayerUI(player);
            break;
        case 1:
            await showTopMoneyUI(player);
            break;
        case 2:
            await showWithdrawUI(player);
            break;
        case 3:
            const { showMainGUI } = await import("../MainGUI.js");
            Kernel.system.runTimeout(() => {
                showMainGUI(player);
            }, 5);
            break;
    }
}

async function showPayPlayerUI(player) {
    const form = new Kernel.ModalFormData()
        .title("\u00A76\u00A7lPAY PLAYER")
        .textField("Enter player name to pay:", "Player Name");

    const res = await UIUtils.showForm(player, form);
    if (res.canceled) return showEconomyMenu(player);

    const targetName = res.formValues[0]?.trim();
    if (!targetName) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Invalid name.");
        return showEconomyMenu(player);
    }

    const { PlayerUtils } = await import("../../utils/PlayerUtils.js");
    const targetId = PlayerUtils.getIdByName(targetName);

    if (!targetId) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Could not find a player named "\u00A7e${targetName}\u00A77".`);
        return showEconomyMenu(player);
    }

    if (targetId === player.id) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77You cannot pay yourself!");
        return showEconomyMenu(player);
    }

    let targetPlayer = Kernel.world.getAllPlayers().find(p => p.id === targetId);
    if (!targetPlayer) targetPlayer = /** @type {any} */ ({ id: targetId, name: targetName });

    await showPayAmountUI(player, targetPlayer);
}

async function _executePayment(player, targetPlayer, amount) {
    const success = await EconomyStore.transferMoney(player, targetPlayer, amount);
    if (success) {
        player.sendMessage(`\u00A7a\u00A7l» \u00A7fSent \u00A7e$${amount.toLocaleString()}\u00A7f to \u00A7e${targetPlayer.name}\u00A7f.`);
        if (typeof targetPlayer.sendMessage === 'function') {
            targetPlayer.sendMessage(`\u00A7a\u00A7l» \u00A7fReceived \u00A7e$${amount.toLocaleString()}\u00A7f from \u00A7e${player.name}\u00A7f.`);
        }
    } else {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Transaction failed. Please try again.");
    }
}

async function showPayAmountUI(player, targetPlayer) {
    const form = new Kernel.ModalFormData()
        .title(`\u00A76\u00A7lPAY: ${targetPlayer.name}`)
        .textField("Amount to pay:", "e.g. 500")
        .toggle("Verify Transaction", { defaultValue: true });

    const res = await UIUtils.showForm(player, form);
    if (res.canceled) {
        Kernel.system.runTimeout(() => showPayPlayerUI(player), 5);
        return;
    }

    const amount = parseInt(res.formValues[0]);
    if (isNaN(amount) || amount <= 0) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Invalid amount. Must be a positive integer.");
        Kernel.system.runTimeout(() => showPayPlayerUI(player), 5);
        return;
    }

    if (!res.formValues[1]) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Transaction canceled: Verification required.");
        Kernel.system.runTimeout(() => showPayPlayerUI(player), 5);
        return;
    }

    const hasEnough = await EconomyStore.hasEnough(player, amount);
    if (!hasEnough) {
        const balance = EconomyStore.getBalance(player.id);
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Insufficient funds. Balance: \u00A7a$${balance.toLocaleString()}`);
        Kernel.system.runTimeout(() => showPayPlayerUI(player), 5);
        return;
    }

    await _executePayment(player, targetPlayer, amount);
    Kernel.system.runTimeout(() => showEconomyMenu(player), 5);
}

async function showTopMoneyUI(player) {
    const balances = EconomyStore.getAllBalances();
    balances.sort((a, b) => b.balance - a.balance);
    const topPlayers = balances.slice(0, 10);

    let bodyText = "\u00A76\u00A7lRichest Players \u00A78(Top 10):\n\n";
    if (topPlayers.length === 0) {
        bodyText += "\u00A77No balances found.";
    } else {
        for (let i = 0; i < topPlayers.length; i++) {
            const entry = topPlayers[i];
            const color = i === 0 ? "\u00A76\u00A7l" : i === 1 ? "\u00A7e\u00A7l" : i === 2 ? "\u00A7f\u00A7l" : "\u00A77";
            bodyText += `${color}${i + 1}. \u00A7f${entry.name} \u00A78- \u00A7a$${entry.balance.toLocaleString()}\n`;
        }
    }

    const form = new Kernel.ActionFormData()
        .title("\u00A76\u00A7lTOP MONEY")
        .body(bodyText)
        .button("\u00A7cBACK", "textures/ui/refresh");

    await UIUtils.showForm(player, form);
    return showEconomyMenu(player);
}

async function _processWithdrawal(player, amount) {
    try {
        const removed = await EconomyStore.removeMoney(player.id, amount);
        if (!removed) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Failed to withdraw money.");
            return;
        }

        const created = createBanknotes(player, amount);
        if (created > 0) {
            player.sendMessage(`\u00A7a\u00A7l» \u00A7fSuccessfully withdrew ${BanknoteStore.formatMoney(amount)} into ${created} banknote(s)`);
            player.sendMessage("\u00A77Right-click banknotes to redeem them");
        } else {
            await EconomyStore.addMoney(player.id, amount);
            player.sendMessage("\u00A7c\u00A7l» \u00A77Failed to create banknotes. Money refunded.");
        }
    } catch (error) {
        console.error(`Withdraw UI error: ${error}`);
        player.sendMessage("\u00A7c\u00A7l» \u00A77An error occurred during withdrawal.");
        await EconomyStore.addMoney(player.id, amount);
    }
}

async function showWithdrawUI(player) {
    const balance = EconomyStore.getBalance(player.id);
    const form = new Kernel.ModalFormData()
        .title("\u00A76\u00A7lWITHDRAW BANKNOTE")
        .textField(`Amount to withdraw:\n(Min: $100, Max: $1,000,000)\nBalance: $${balance.toLocaleString()}`, "e.g. 10000");

    const res = await UIUtils.showForm(player, form);
    if (res.canceled) return showEconomyMenu(player);

    const amount = parseInt(res.formValues[0]);
    if (isNaN(amount) || amount <= 0) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Invalid amount.");
        return showEconomyMenu(player);
    }

    if (amount < 100) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Minimum withdrawal amount is \u00A7e$100");
        return showEconomyMenu(player);
    }

    if (amount > 1000000) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Maximum withdrawal amount is \u00A7e$1,000,000");
        return showEconomyMenu(player);
    }

    const currentBalance = EconomyStore.getBalance(player.id);
    if (currentBalance < amount) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Insufficient funds.");
        return showEconomyMenu(player);
    }

    const requiredSlots = Math.ceil(amount / 64000);
    const availableSlots = getAvailableInventorySlots(player);
    if (availableSlots < requiredSlots) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Not enough inventory space. Need ${requiredSlots} slots, have ${availableSlots}`);
        return showEconomyMenu(player);
    }

    Kernel.system.run(() => _processWithdrawal(player, amount));
    Kernel.system.runTimeout(() => showEconomyMenu(player), 10);
}

function createBanknotes(player, totalAmount) {
    const denominations = [1000000, 500000, 100000, 50000, 10000, 5000, 1000, 500, 100];
    let remaining = totalAmount;
    let created = 0;

    for (const denom of denominations) {
        while (remaining >= denom) {
            const banknote = BanknoteStore.createBanknote(denom, player.id, player.name);
            
            if (!BanknoteStore.storeBanknoteData(banknote)) {
                console.error(`Failed to store banknote data for ${banknote.id}`);
                continue;
            }

            const item = new Kernel.ItemStack(BanknoteStore.getBanknoteId(), 1);
            item.nameTag = BanknoteStore.getBanknoteName(denom);
            item.setLore(BanknoteStore.getBanknoteLore(banknote));
            
            try { item.setDynamicProperty("ae:banknote_id", banknote.id); } catch (e) {}
            
            const container = player.getComponent(Kernel.EntityComponentTypes.Inventory)?.container; // container?.
            const leftover = container.addItem(item);
            
            if (leftover === undefined) {
                remaining -= denom;
                created++;
            } else {
                break;
            }
        }
        
        if (remaining < 100) break;
    }

    if (remaining > 0) {
        EconomyStore.addMoney(player.id, remaining);
        player.sendMessage(`\u00A77Could not convert ${BanknoteStore.formatMoney(remaining)} - refunded to account`);
    }

    return created;
}

function getAvailableInventorySlots(player) {
    try {
        const container = player.getComponent(Kernel.EntityComponentTypes.Inventory)?.container; // container?.
        let available = 0;
        
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (!item) {
                available++;
            } else if (item.typeId === BanknoteStore.getBanknoteId() && item.amount < 64) {
                available++;
            }
        }
        
        return available;
    } catch (error) {
        console.error(`Failed to check inventory space: ${error}`);
        return 0;
    }
}
