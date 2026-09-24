import { Kernel } from "../../core/Kernel.js";
import { EconomyStore } from "../../systems/economy/EconomyStore.js"

// ----------------------------------------------------------------------------
// | object: EconomyCommand (Admin)                                           |
// | administrative command definition for managing player financial accounts. |
// | allows staff to override balances via give, take, set, or reset vectors.  |
// ----------------------------------------------------------------------------
export const EconomyCommand = {
    // internal identifier.
    name: "economy",
    // human-readable description.
    description: "Manage player balances",
    // syntax guide.
    usage: "/ae:economy <give|take|set|reset> <player_identifier> [amount]",
    // required permission node (staff only).
    permission: "essentials.admin.economy",
    // command category.
    category: "Admin",
    // native parameter definitions.
    params: [
        { name: "subcommand", type: "economyAction", optional: true },
        { name: "player",     type: "string",        optional: true },
        { name: "amount",     type: "integer",       optional: true  }
    ],

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | the administrative routing engine. parses sub-vectors and delegates      |
    // | to specialized liquidity handlers.                                       |
    // ----------------------------------------------------------------------------
    async execute(_data, player, args) {
        // Case 1: No arguments — open the Economy Control dashboard
        if (!args || args.length === 0 || !args[0]) {
            const { showEconomyControl } = await import("../../ui/admin/AdminPanelEconomy.js");
            await showEconomyControl(player);
            return;
        }

        // Case 2: Direct CLI input validation
        if (args.length < 2) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:economy <give|take|set|reset> <player> [amount]");
            player.sendMessage("\u00A77Or type \u00A7e/ae:economy \u00A77with no arguments to open the menu.");
            return;
        }

        const subcommand = args[0].toLowerCase();
        const playerName = args[1]

        // step 1: entity resolution.
        // locate the target player object in the current Kernel.world buffer.
        const target = Kernel.world.getAllPlayers().find(p => p.name === playerName)
        if (!target) {
            player.sendMessage(`\u00A7c\u00A7l» \u00A77Player '${playerName}' not found.`);
            return
        }

        // step 2: routing.
        switch (subcommand) {
            case "give":
                // add funds to account.
                await handleGive(player, target, args[2])
                break
            case "take":
                // deduct funds from account.
                await handleTake(player, target, args[2])
                break
            case "set":
                // absolute balance calibration.
                await handleSet(player, target, args[2])
                break
            case "reset":
                // revert to industrial default balance.
                await handleReset(player, target, args[2])
                break
            default:
                player.sendMessage("\u00A7c\u00A7l» \u00A77Invalid action. Use give, take, set, or reset.");
        }
    }
}

// ----------------------------------------------------------------------------
// | function: handleGive                                                     |
// | liquidity injection handler. increments the target's balance.             |
// ----------------------------------------------------------------------------
async function handleGive(executor, target, amountStr) {
    const amount = Math.floor(Number(amountStr))
    // validate input amount.
    if (isNaN(amount) || amount <= 0) {
        executor.sendMessage("\u00A7c\u00A7l» \u00A77Please provide a valid amount.");
        return
    }

    try {
        // execute atomic addition in the persistent store.
        const success = await EconomyStore.addMoney(target, amount)
        if (success) {
            executor.sendMessage(`\u00A7a\u00A7l» \u00A7fAdded \u00A7e$${amount.toLocaleString()}\u00A7f to \u00A7e${target.name}\u00A7f's balance.`);
            target.sendMessage("\u00A7a\u00A7l» \u00A7fYour balance was adjusted by an admin.");
        } else {
            executor.sendMessage("\u00A7c\u00A7l» \u00A77Failed to add money.");
        }
    } catch (error) {
        executor.sendMessage(`\u00A7c\u00A7l[Critical] \u00A77Transaction Crash: ${error.message}`);
    }
}

// ----------------------------------------------------------------------------
// | function: handleTake                                                     |
// | liquidity extraction handler. decrements the target's balance.            |
// ----------------------------------------------------------------------------
async function handleTake(executor, target, amountStr) {
    const amount = Math.floor(Number(amountStr))
    if (isNaN(amount) || amount <= 0) {
        executor.sendMessage("\u00A7c\u00A7l» \u00A77Please provide a valid amount.");
        return
    }

    try {
        // execute atomic deduction. fails if funds are insufficient.
        const success = await EconomyStore.removeMoney(target, amount)
        if (success) {
            executor.sendMessage(`\u00A7a\u00A7l» \u00A7fRemoved \u00A7e$${amount.toLocaleString()}\u00A7f from \u00A7e${target.name}\u00A7f's balance.`);
            target.sendMessage("\u00A7a\u00A7l» \u00A7fYour balance was adjusted by an admin.");
        } else {
            executor.sendMessage("\u00A7c\u00A7l» \u00A77Failed to remove money (Insufficient funds).");
        }
    } catch (error) {
        executor.sendMessage(`\u00A7c\u00A7l[Critical] \u00A77Transaction Crash: ${error.message}`);
    }
}

// ----------------------------------------------------------------------------
// | function: handleSet                                                      |
// | absolute buffer calibration. forces a specific balance value.             |
// ----------------------------------------------------------------------------
async function handleSet(executor, target, amountStr) {
    const amount = Math.floor(Number(amountStr))
    if (isNaN(amount) || amount < 0) {
        executor.sendMessage("\u00A7c\u00A7l» \u00A77Please provide a valid amount.");
        return
    }

    try {
        // force state update in the store.
        const success = await EconomyStore.setBalance(target, amount)
        if (success) {
            executor.sendMessage(`\u00A7a\u00A7l» \u00A7fSet \u00A7e${target.name}\u00A7f's balance to \u00A7e$${amount.toLocaleString()}\u00A7f.`);
            target.sendMessage("\u00A7a\u00A7l» \u00A7fYour balance was adjusted by an admin.");
        } else {
            executor.sendMessage("\u00A7c\u00A7l» \u00A77Failed to set balance.");
        }
    } catch (error) {
        executor.sendMessage(`\u00A7c\u00A7l[Critical] \u00A77Transaction Crash: ${error.message}`);
    }
}

// ----------------------------------------------------------------------------
// | function: handleReset                                                    |
// | buffer reset handler. restores account to the system default.            |
// ----------------------------------------------------------------------------
async function handleReset(executor, target, amountStr) {
    try {
        let amount = EconomyStore.DEFAULT_BALANCE;
        if (amountStr !== undefined && amountStr !== null && amountStr !== "") {
            const parsed = Math.floor(Number(amountStr));
            if (!isNaN(parsed) && parsed >= 0) {
                amount = parsed;
            } else {
                executor.sendMessage("\u00A7c\u00A7l» \u00A77Please provide a valid amount.");
                return;
            }
        }
        // query the store for the constant default balance.
        const success = await EconomyStore.setBalance(target, amount)
        if (success) {
            executor.sendMessage(`\u00A7a\u00A7l» \u00A7fReset \u00A7e${target.name}\u00A7f's balance to \u00A7e$${amount.toLocaleString()}\u00A7f.`);
            target.sendMessage("\u00A7a\u00A7l» \u00A7fYour balance was reset by an admin.");
        } else {
            executor.sendMessage("\u00A7c\u00A7l» \u00A77Failed to reset balance.");
        }
    } catch (error) {
        executor.sendMessage(`\u00A7c\u00A7l[Critical] \u00A77Transaction Crash: ${error.message}`);
    }
}
