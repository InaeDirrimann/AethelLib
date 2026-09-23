/*
 * INDUSTRIAL_COLOR_UTILITIES
 * ----------------------------------------------------------------------------
 * High-speed color code normalizer and string translator for Minecraft Bedrock.
 * Converts human inputs (e.g. "S1", "&1", "1", "gold", "§1") directly into
 * valid native section symbols (§) with zero lag and zero object allocations.
 */

const NAMED_COLORS = {
    black: "§0", dark_blue: "§1", dark_green: "§2", dark_aqua: "§3",
    dark_red: "§4", dark_purple: "§5", gold: "§6", gray: "§7",
    dark_gray: "§8", blue: "§9", green: "§a", aqua: "§b",
    red: "§c", light_purple: "§d", yellow: "§e", white: "§f",
    obfuscated: "§k", bold: "§l", strikethrough: "§m", underline: "§n",
    italic: "§o", reset: "§r"
};

export const ColorUtils = {
    /**
     * Normalizes any color input string into a standard Minecraft § code.
     * Accepts:
     * - Named colors: "gold" -> "§6"
     * - Mobile typos / ampersands: "S1" -> "§1", "s6" -> "§6", "&a" -> "§a"
     * - Raw hex/symbol chars: "1" -> "§1", "c" -> "§c"
     * - Compound codes: "ScSl" -> "§c§l", "&e&o" -> "§e§o"
     * @param {string} input - User or form input
     * @param {string} defaultColor - Fallback code (default: "§7")
     * @returns {string} Native section symbol code
     */
    normalizeColorCode(input, defaultColor = "§7") {
        if (!input) return defaultColor;
        const trimmed = String(input).trim();
        const lower = trimmed.toLowerCase();

        if (NAMED_COLORS[lower]) {
            return NAMED_COLORS[lower];
        }

        // Single color character (e.g. "1", "c", "f", "e")
        if (/^[0-9a-fk-or]$/i.test(trimmed)) {
            return `§${trimmed.toLowerCase()}`;
        }

        // Prefixed single code (e.g. "S1", "s1", "&1", "§1")
        const singleMatch = trimmed.match(/^[&§sS]([0-9a-fk-or])$/i);
        if (singleMatch) {
            return `§${singleMatch[1].toLowerCase()}`;
        }

        // Multiple or compound codes (e.g. "ScSl", "&c&l", "§6§l")
        if (/[&sS§][0-9a-fk-or]/i.test(trimmed)) {
            return trimmed.replace(/[&sS]([0-9a-fk-or])/gi, "§$1");
        }

        return defaultColor;
    },

    /**
     * Translates alternate color codes (& and S) in message body to native §.
     * @param {string} text - Message or raw string
     * @returns {string} Formatted string with native § codes
     */
    translateColorCodes(text) {
        if (!text) return "";
        return text.replace(/[&]([0-9a-fk-or])/gi, "§$1");
    },

    /**
     * Strips all Minecraft color codes from a string.
     * @param {string} text
     * @returns {string}
     */
    stripColorCodes(text) {
        if (!text) return "";
        return text.replace(/§[0-9a-fk-or]/gi, "");
    }
};
