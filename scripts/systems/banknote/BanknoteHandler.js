/**
 * Banknote Handler - Handles banknote right-click redemption events
 * Compatible with Minecraft Essentials Remake and AethelLib formats.
 */

import { Kernel } from "../../core/Kernel.js";
import { BanknoteStore } from "./BanknoteStore.js";
import { EconomyStore } from "../economy/EconomyStore.js";
import { SettingsStore } from "../../core/store/SettingsStore.js";

const redeemCooldowns = new Map();

export class BanknoteHandler {
    static init() {
        Kernel.world.beforeEvents.itemUse.subscribe((event) => {
            const { source: player, itemStack: item } = event;
            if (!player || !item) return;

            // Check if withdraw/banknote system is globally enabled
            if (SettingsStore.get("withdrawSystem") === false) return;

            // Check if item is paper banknote
            const singleValue = BanknoteStore.parseBanknoteValue(item);
            if (!singleValue || singleValue <= 0) return;

            // Cancel the default item use behavior (e.g. eating/using paper)
            event.cancel = true;

            // Simple debounce to prevent packet spam
            const now = Date.now();
            const last = redeemCooldowns.get(player.id) || 0;
            if (now - last < 250) return;
            redeemCooldowns.set(player.id, now);

            // Defer inventory mutation and account credit to the tick queue
            Kernel.system.run(async () => {
                try {
                    if (!player.isValid) return;

                    const invComp = player.getComponent(Kernel.EntityComponentTypes.Inventory);
                    const container = invComp?.container;
                    if (!container) return;

                    const slotIndex = player.selectedSlotIndex;
                    const handItem = container.getItem(slotIndex);

                    // Re-validate item in hand
                    const noteValue = BanknoteStore.parseBanknoteValue(handItem);
                    if (!noteValue || noteValue <= 0) return;

                    const isSneaking = player.isSneaking;
                    const countToRedeem = isSneaking ? handItem.amount : 1;
                    const totalMoney = noteValue * countToRedeem;

                    // Consume the banknote(s) from inventory
                    if (handItem.amount <= countToRedeem) {
                        container.setItem(slotIndex, undefined);
                    } else {
                        handItem.amount -= countToRedeem;
                        container.setItem(slotIndex, handItem);
                    }

                    // Add funds to player account
                    const added = await EconomyStore.addMoney(player, totalMoney);
                    if (!added) {
                        // Rollback item if transaction failed
                        const rollbackItem = BanknoteStore.createBanknoteItem(noteValue);
                        rollbackItem.amount = countToRedeem;
                        const leftover = container.addItem(rollbackItem);
                        if (leftover && leftover.amount > 0) {
                            try {
                                player.dimension.spawnItem(leftover, player.location);
                            } catch (_) {}
                        }
                        player.sendMessage("§c§l» §7Failed to deposit funds into your account.");
                        return;
                    }

                    // Send success feedback
                    const formatted = BanknoteStore.formatMoney(totalMoney);
                    if (countToRedeem > 1) {
                        player.sendMessage(`§a§l» §fClaimed §e$${totalMoney.toLocaleString()} §ffrom §e${countToRedeem} §fbanknotes.`);
                    } else {
                        player.sendMessage(`§a§l» §fClaimed §e$${totalMoney.toLocaleString()} §ffrom banknote.`);
                    }

                    try {
                        player.playSound("random.orb", { volume: 0.8, pitch: 1.2 });
                    } catch (_) {}
                } catch (err) {
                    console.error("[BanknoteHandler] Redemption error:", err);
                    player.sendMessage("§c§l» §7An error occurred while redeeming the banknote.");
                }
            });
        });
    }
}
