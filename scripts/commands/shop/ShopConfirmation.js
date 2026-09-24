import { world, system } from "@minecraft/server";
import { Lang } from "../../ui/Lang.js";

const pendingTransactions = new Map();
const TIMEOUT_TICKS = 600; // 30 seconds

/**
 * Creates and registers a transaction confirmation workflow.
 */
export function createPendingTransaction(player, details, callback) {
    const playerId = player.id;
    const transactionId = `shop_${playerId}_${Date.now()}`;

    // Clean up any stale transactions
    clearPlayerTransaction(player);

    const timerId = system.runTimeout(() => {
        if (pendingTransactions.has(transactionId)) {
            pendingTransactions.delete(transactionId);
            if (player.isValid) {
                try {
                    player.setDynamicProperty("ae:pending_shop", undefined);
                    player.sendMessage(`${Lang.PREFIX}§c[X] Purchase confirmation expired.`);
                } catch (e) {
                    console.error("[Shop] Failed to notify player of expired transaction: " + e);
                }
            }
        }
    }, TIMEOUT_TICKS);

    pendingTransactions.set(transactionId, {
        playerId,
        details,
        callback,
        timerId
    });

    try {
        player.setDynamicProperty("ae:pending_shop", transactionId);
    } catch (e) {
        console.error("[Shop] Failed to set dynamic property ae:pending_shop: " + e);
    }

    // Render verification prompt
    player.sendMessage(`${Lang.PREFIX}§6§l┌─ [CONFIRM TRANSACTION] ─┐`);
    player.sendMessage(`${Lang.PREFIX}§6│ §7Summary: §f${details.summary}`);
    player.sendMessage(`${Lang.PREFIX}§6│ §7Total Cost: §a$${details.totalCost.toLocaleString()}`);
    player.sendMessage(`${Lang.PREFIX}§6├───────────────────────────┤`);
    player.sendMessage(`${Lang.PREFIX}§6│ §eType §lY§r§e to authorize`);
    player.sendMessage(`${Lang.PREFIX}§6│ §cType §lN§r§c to cancel`);
    player.sendMessage(`${Lang.PREFIX}§6└───────────────────────────┘`);
    player.sendMessage(`${Lang.PREFIX}§8(This message is private - only you see it)`);
}

function clearPlayerTransaction(player) {
    try {
        const existingId = player.getDynamicProperty("ae:pending_shop");
        if (existingId) {
            const trans = pendingTransactions.get(existingId);
            if (trans) {
                if (trans.timerId !== undefined) {
                    try {
                        system.clearRun(trans.timerId);
                    } catch (e) {}
                }
                pendingTransactions.delete(existingId);
            }
            player.setDynamicProperty("ae:pending_shop", undefined);
        }
    } catch (e) {
        // Player might be invalid
    }
}

// Called during core boot (Stage 2) to register the chat listener.
// Must NOT run at module import time — Bedrock throws in early-execution mode.
export function initShopConfirmation() {
    world.beforeEvents.chatSend.subscribe((event) => {
        const player = event.sender;
        let transactionId;
        try {
            transactionId = player.getDynamicProperty("ae:pending_shop");
        } catch (e) {
            return;
        }
        if (!transactionId) return;

        const transaction = pendingTransactions.get(transactionId);
        if (!transaction) {
            try {
                player.setDynamicProperty("ae:pending_shop", undefined);
            } catch (e) {}
            return;
        }

        const message = event.message.trim().toUpperCase();
        event.cancel = true; // Block leakage instantly

        if (transaction.busy) {
            return;
        }

        if (message === "Y" || message === "N") {
            transaction.busy = true;
        }

        system.run(() => {
            if (!player.isValid) return;
            
            if (message === "Y") {
                // Authorized
                if (transaction.timerId !== undefined) {
                    try {
                        system.clearRun(transaction.timerId);
                    } catch (e) {}
                }
                pendingTransactions.delete(transactionId);
                try {
                    player.setDynamicProperty("ae:pending_shop", undefined);
                } catch (e) {}
                if (typeof transaction.callback === "function") {
                    transaction.callback(player, true);
                }
            } else if (message === "N") {
                // Revoked
                if (transaction.timerId !== undefined) {
                    try {
                        system.clearRun(transaction.timerId);
                    } catch (e) {}
                }
                pendingTransactions.delete(transactionId);
                try {
                    player.setDynamicProperty("ae:pending_shop", undefined);
                } catch (e) {}
                if (typeof transaction.callback === "function") {
                    transaction.callback(player, false);
                }
                player.sendMessage(`${Lang.PREFIX}§c[X] Purchase cancelled.`);
            } else {
                // Invalid entry - keep locked, send instructions
                player.sendMessage(`${Lang.PREFIX}§c[!] Please type §lY§r§c to confirm or §lN§r§c to cancel!`);
            }
        });
    });
}
