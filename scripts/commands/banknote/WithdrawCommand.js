import { Kernel } from "../../core/Kernel.js";
import { BanknoteStore } from "../../systems/banknote/BanknoteStore.js";
import { EconomyStore } from "../../systems/economy/EconomyStore.js";
import { SettingsStore } from "../../core/store/SettingsStore.js";
import { ValidationHelper } from "../../utils/ValidationHelper.js";
import { UIUtils } from "../../ui/UIUtils.js";

// ----------------------------------------------------------------------------
// | object: WithdrawCommand                                                  |
// | converts digital liquidity into physical banknotes.                      |
// ----------------------------------------------------------------------------
export const WithdrawCommand = {
    name: "withdraw",
    aliases: ["banknote"],
    description: "Withdraw money into physical banknotes",
    usage: "/ae:withdraw [amount]",
    permission: "essentials.withdraw",
    category: "economy",
    
    params: [
        { name: "amount", type: "integer", optional: true }
    ],

    async execute(_data, player, args) {
        if (!player) return;

        if (SettingsStore.get("withdrawSystem") === false) {
            player.sendMessage("§c§l» §7The withdraw system is currently disabled.");
            return;
        }

        const rawAmount = args ? args[0] : undefined;

        // If no amount is provided via CLI, open the withdraw modal form
        if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
            await showWithdrawModal(player);
            return;
        }

        const amount = Math.floor(Number(rawAmount));
        await processWithdraw(player, amount);
    }
};

async function showWithdrawModal(player) {
    const currentBalance = EconomyStore.getBalance(player);
    const form = new Kernel.ModalFormData()
        .title("§6§lWithdraw Banknote")
        .textField(`Current Balance: §e$${currentBalance.toLocaleString()}§r\n\nEnter amount to withdraw:`, "e.g. 1000", "1000");

    const res = await UIUtils.showForm(player, form);
    if (res.canceled) return;

    const rawInput = res.formValues[0];
    const amount = Math.floor(Number(rawInput));
    await processWithdraw(player, amount);
}

async function processWithdraw(player, amount) {
    if (isNaN(amount) || amount <= 0 || !Number.isInteger(amount)) {
        player.sendMessage("§c§l» §7Please enter a valid positive integer amount.");
        return;
    }

    if (!ValidationHelper.isValidMoney(amount)) {
        player.sendMessage("§c§l» §7Invalid withdrawal amount. Exceeds safe bounds.");
        return;
    }

    const currentBalance = EconomyStore.getBalance(player);
    if (currentBalance < amount) {
        player.sendMessage(`§c§l» §7Insufficient funds. You only have §e$${currentBalance.toLocaleString()}§7.`);
        return;
    }

    const invComp = player.getComponent(Kernel.EntityComponentTypes.Inventory);
    const container = invComp?.container;
    if (!container || container.emptySlotsCount <= 0) {
        player.sendMessage("§c§l» §7Your inventory is full! Make space before withdrawing.");
        return;
    }

    // Deduct money from player account
    const debited = await EconomyStore.removeMoney(player, amount);
    if (!debited) {
        player.sendMessage("§c§l» §7Failed to withdraw money. Account sync error.");
        return;
    }

    // Create the banknote item
    const banknoteItem = BanknoteStore.createBanknoteItem(amount, player.name);
    const leftover = container.addItem(banknoteItem);

    if (leftover !== undefined) {
        // Refund if item could not be added
        await EconomyStore.addMoney(player, amount);
        player.sendMessage("§c§l» §7Could not fit banknote in inventory. Money refunded.");
        return;
    }

    player.sendMessage(`§a§l» §fSuccessfully withdrew §e$${amount.toLocaleString()} §finto a banknote.`);
    player.sendMessage("§7Right-click with the banknote in hand to redeem it.");
    try {
        player.playSound("random.levelup", { volume: 0.5, pitch: 1.5 });
    } catch (_) {}
}
