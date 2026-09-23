import { Kernel } from "../../../core/Kernel.js"
import { ColorUtils } from "../../../utils/ColorUtils.js"

/*
 * INDUSTRIAL_HIERARCHY_FORMATTER
 * ----------------------------------------------------------------------------
 * Visual manifestation layer for ranks, player names, and chat packets.
 * Automatically applies rank-configured colors without requiring players
 * to manually input section symbols (§).
 */
export const RankFormatter = {
    /* 
     * HIERARCHY_PREFIX_MANIFEST
     * Resolves the highest rank prefix. If the rank display name already contains
     * color codes, preserves them. Otherwise wraps with the rank's defined colorName.
     */
    formatPlayerRanks: (player) => {
        const PermissionManager = Kernel.get("permissions")
        const highestRank = PermissionManager ? PermissionManager.getHighestRank(player) : null
        if (!highestRank || !highestRank.name || highestRank.hideRanks) return ""
        // Strip existing outer brackets to prevent [[TAG]] double-wrapping
        const cleanName = highestRank.name.replace(/^\[+|\]+$/g, "").toUpperCase()
        const hasColor = /§[0-9a-fk-or]/i.test(cleanName)
        const rankColor = ColorUtils.normalizeColorCode(highestRank.colorName || highestRank.color, "§7")
        return hasColor ? `[${cleanName}]§r ` : `${rankColor}[${cleanName}]§r `
    },
 
    /* 
     * NAME_COLOR_RESOLVER
     * Resolves display/nametag color from rank metadata (colorName).
     */
    getPlayerNameColor: (player) => {
        const PermissionManager = Kernel.get("permissions")
        const highestRank = PermissionManager ? PermissionManager.getHighestRank(player) : null
        return ColorUtils.normalizeColorCode(highestRank?.colorName || highestRank?.color, "§7")
    },

    /* 
     * MESSAGE_COLOR_RESOLVER
     * Resolves chat message body color from rank metadata (colorText).
     */
    getPlayerMessageColor: (player) => {
        const PermissionManager = Kernel.get("permissions")
        const highestRank = PermissionManager ? PermissionManager.getHighestRank(player) : null
        return ColorUtils.normalizeColorCode(highestRank?.colorText || highestRank?.chatColor, "§f")
    },

    /* 
     * BACKWARD_COMPATIBILITY_PROXY
     */
    getPlayerChatColor: (player) => {
        return RankFormatter.getPlayerNameColor(player)
    },

    /* 
     * PACKET_FORMAT_ORCHESTRATOR
     * Merges rank prefix, player name (in name color), and message (automatically in message color).
     * Players do not need to type § or S1 in chat - it works automatically!
     */
    formatChatMessage: (player, message) => {
        const SettingsStore = Kernel.get("settings")
        const showRank = !SettingsStore || SettingsStore.get("showRankOnMessage") !== false
        const rankPrefix = showRank ? RankFormatter.formatPlayerRanks(player) : ""
        const nameColor = RankFormatter.getPlayerNameColor(player)
        const messageColor = RankFormatter.getPlayerMessageColor(player)
        
        // Strip newlines and translate any optional manual & color codes
        const sanitized = message.replace(/\n/g, "")
        const translated = ColorUtils.translateColorCodes(sanitized)
        return `${rankPrefix}${nameColor}${player.name}§r: ${messageColor}${translated}§r`
    },

    /*
     * NAMETAG_FORMAT_ORCHESTRATOR
     */
    formatPlayerNametag: (player) => {
        const rankPrefix = RankFormatter.formatPlayerRanks(player)
        const nameColor = RankFormatter.getPlayerNameColor(player)
        return `${rankPrefix}${nameColor}${player.name}§r`
    }
}
