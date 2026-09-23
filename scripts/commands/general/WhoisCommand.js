import { Kernel } from "../../core/Kernel.js"
import { PlayerUtils } from "../../utils/PlayerUtils.js"

// ----------------------------------------------------------------------------
// | object: WhoisCommand                                                     |
// | command definition for intensive entity inspection.                        |
// | aggregates data from multiple kernels (Permissions, Economy, Teleport).   |
// ----------------------------------------------------------------------------
export const WhoisCommand = {
    // internal name.
    name: "inspect",
    // human-readable description.
    description: "Inspect detailed player information and coordinates",
    // syntax guide.
    usage: "/ae:inspect <player>",
    // required permission node (staff level recommended).
    permission: "admin",
    // command category.
    category: "Admin",
    // native parameter definitions.
    parameters: [
        { name: "player", type: "player", optional: false }
    ],

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | the data aggregation pipeline. fetches state from disparate stores and    |
    // | compile them into a single diagnostic view.                              |
    // ----------------------------------------------------------------------------
    async execute(_data, player, args) {
        // syntax validation.
        if (args.length === 0) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:inspect <player>");
            player.sendMessage("\u00A7e\u00A7l» \u00A7fTip: \u00A77Type a player name to view their info.");
            return
        }

        // FIX: Resolve rich target player objects from autocomplete OR strings
        const target = typeof args[0] === 'object' && args[0] !== null
            ? args[0]
            : PlayerUtils.findPlayer(args.join(" "))

        // check if target is online.
        if (!target) {
            player.sendMessage(`\u00A7c\u00A7l» \u00A77Player not found.`);
            return
        }

        // step 1: resolve sub-system services from the kernel.
        const PermissionManager = Kernel.get("permissions")
        const Economy = Kernel.get("economy")
        const TpaStore = Kernel.get("tpaStore")
        const HomeStore = Kernel.get("homeStore")
        const ClaimStore = Kernel.get("claimStore")
        
        // step 2: query individual data points.
        // resolve rank node.
        const rank = PermissionManager ? PermissionManager.getHighestRank(target) : null
        // resolve financial balance.
        const balance = Economy ? Economy.getBalance(target) : 0
        // resolve TPA availability.
        const tpaStatus = TpaStore && typeof TpaStore.isEnabled === "function"
            ? (TpaStore.isEnabled(target.id) ? "\u00A7aEnabled" : "\u00A7cDisabled")
            : "\u00A77Unknown"

        // resolve homes and claims.
        const homes = HomeStore ? await HomeStore.getHomes(target) : {}
        const homesList = Object.keys(homes)
        const homesCount = homesList.length
        
        const claimsList = ClaimStore ? ClaimStore.getPlayerClaims(target.id) : []
        const claimsCount = claimsList.length

        // step 3: formatted output.
        player.sendMessage(`\u00A76\u00A7l» \u00A7ePlayer Info: \u00A7f${target.name} \u00A76\u00A7l«`)
        player.sendMessage(`\u00A77ID: \u00A78${target.id}`)
        player.sendMessage(`\u00A77Rank: \u00A7e${rank?.name || "Member"}`)
        player.sendMessage(`\u00A77Balance: \u00A76$${balance.toLocaleString()}`)
        // resolve dimension name (strip the namespace).
        player.sendMessage(`\u00A77Dimension: \u00A7b${target.dimension.id.split(':').pop().toUpperCase()}`)
        // resolve spatial coordinates.
        player.sendMessage(`\u00A77Coords: \u00A78(${Math.floor(target.location.x)}, ${Math.floor(target.location.y)}, ${Math.floor(target.location.z)})`)
        player.sendMessage(`\u00A77Homes: \u00A7a${homesCount} \u00A77${homesCount > 0 ? `\u00A78(${homesList.join(", ")})` : ""}`)
        player.sendMessage(`\u00A77Claims: \u00A7a${claimsCount}`)
        player.sendMessage(`\u00A77TPA: ${tpaStatus}`)
    }
}
