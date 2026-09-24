/**
 * Banknote Store - Manages physical paper banknote items
 * Compatible with Minecraft Essentials Remake and AethelLib formats.
 */

import { Kernel } from "../../core/Kernel.js"

export class BanknoteStore {
    static getBanknoteId() {
        return "minecraft:paper"
    }

    /**
     * Formats money for banknote display
     * @param {number} amount 
     * @returns {string}
     */
    static formatMoney(amount) {
        return `\u00A7e$${amount.toLocaleString()}`
    }

    /**
     * Creates a single banknote ItemStack for a given integer amount
     * @param {number} amount - Exact monetary value of the note
     * @param {string} [creatorName=""] - Name of the creator
     * @returns {import("@minecraft/server").ItemStack}
     */
    static createBanknoteItem(amount, creatorName = "") {
        const item = new Kernel.ItemStack("minecraft:paper", 1);
        item.nameTag = `\u00A7r\u00A7e$${amount.toLocaleString()} \u00A7fBanknote`;
        
        const dateStr = new Date().toLocaleDateString();
        const lore = [
            "",
            `\u00A7r\u00A7eValue: \u00A7r${amount}`,
            `\u00A7r\u00A7eCreated: \u00A7r${dateStr}`
        ];
        if (creatorName) {
            lore.push(`\u00A7r\u00A77Signer: \u00A7f${creatorName}`);
        }
        lore.push("\u00A7r\u00A77Right-click to claim");

        item.setLore(lore);
        try {
            item.setDynamicProperty("ae:banknote_value", amount);
        } catch (_) {}

        return item;
    }

    /**
     * Extracts monetary value from a paper banknote item
     * Checks dynamic properties first, then parses lore (supporting Essentials Remake and legacy AethelLib)
     * @param {import("@minecraft/server").ItemStack} item 
     * @returns {number|null} The banknote value, or null if not a valid banknote
     */
    static parseBanknoteValue(item) {
        if (!item || item.typeId !== "minecraft:paper") return null;

        // 1. Dynamic property check (tamper-proof)
        try {
            const propVal = item.getDynamicProperty("ae:banknote_value");
            if (typeof propVal === "number" && Number.isInteger(propVal) && propVal > 0) {
                return propVal;
            }
        } catch (_) {}

        // 2. Parse Lore lines
        try {
            const lore = item.getLore();
            if (!lore || lore.length === 0) return null;

            for (const rawLine of lore) {
                // Strip Minecraft color codes
                const line = rawLine.replace(/\u00A7[0-9a-fk-or]/gi, "").trim();

                // Essentials Remake pattern: "Value: 1000"
                // AethelLib pattern: "Value: $1,000"
                if (line.toLowerCase().startsWith("value:")) {
                    const numStr = line.slice(6).replace(/[^0-9]/g, "");
                    const val = parseInt(numStr, 10);
                    if (!isNaN(val) && val > 0) return val;
                }
            }
        } catch (_) {}

        return null;
    }

    /**
     * Checks if an item is a valid banknote
     * @param {import("@minecraft/server").ItemStack} item 
     * @returns {boolean}
     */
    static isBanknoteItem(item) {
        return this.parseBanknoteValue(item) !== null;
    }
}

// Retain init function to satisfy bootstrap/systems.js imports
export function initBanknoteCleanup() {
    // Stateless banknote system requires no periodic DB sweep
}
