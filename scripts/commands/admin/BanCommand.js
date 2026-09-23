import { Kernel } from "../../core/Kernel.js"
import { PlayerUtils } from "../../utils/PlayerUtils.js"
import { ValidationHelper } from "../../utils/ValidationHelper.js"

// ----------------------------------------------------------------------------
// | object: BanCommand                                                       |
// | banishes players. C++ target selectors resolves players instantly.       |
// | no more finding player objects manually. pure beauty.                    |
// ----------------------------------------------------------------------------
export const BanCommand = {
    name: "ban",
    description: "Permanently ban a player",
    usage: "/ae:ban <player> [duration] [reason]",
    permission: "essentials.ban",
    category: "Admin",
    // Intercepted by script for complex string handling.
    native: false,
    
    // NATIVE SCHEMA DEFINITION
    parameters: [
        { name: "player", type: "player", optional: false },
        { name: "duration", type: "string", optional: true },
        { name: "reason", type: "string", optional: true }
    ],

    execute(_data, player, args) {
        const { player: target, consumedArgs } = PlayerUtils.resolveFromArgs(args);
        const duration = args[consumedArgs] || "permanent";
        const reason = args.slice(consumedArgs + 1).join(" ") || "Breaking the rules";

        if (!target) {
            player.sendMessage("\u00A7c\u00A7l\u00BB \u00A77Syntax Error: Player target required.");
            return;
        }

        // step 1: hierarchy check. check if target is an OP or high-clearance dev so moderators don't ban admins.
        const PermissionManager = Kernel.get("permissions")
        if (PermissionManager && !PermissionManager.canActOn(player, target)) {
            player.sendMessage("\u00A7c\u00A7l\u00BB \u00A77Permission Denied: Target is more powerful than you.");
            return
        }

        // step 2: parse the time string. convert '1d' or '2h' to milliseconds.
        const banDuration = parseDuration(duration)
        if (banDuration === null) {
            player.sendMessage(`\u00A7c\u00A7l\u00BB \u00A77Invalid duration: '${duration}'`);
            return
        }

        // step 3: build the ban metadata block.
        const banData = {
            playerId: target.id,
            playerName: target.name,
            bannedBy: player.name,
            bannedById: player.id,
            reason: reason,
            timestamp: Date.now(),
            duration: banDuration,
            expires: banDuration === 0 ? 0 : Date.now() + banDuration
        }

        // step 4: commit to the database.
        if (addBan(banData)) {
            // step 5: terminate their session. run kick command on system loop so it doesn't lag.
            Kernel.system.run(() => {
                try {
                    const safeName = ValidationHelper.escapeCommandString(target.name)
                    const safeReason = ValidationHelper.escapeCommandString(reason)
                    Kernel.world.getDimension("overworld").runCommandAsync(`kick "${safeName}" \u00A7c[BAN]\n\u00A7eREASON: ${safeReason}`)
                } catch (error) {
                    console.error(`[BanCommand] SESSION_TERMINATION_FAILURE: ${error}`)
                }
            })

            // step 6: notify other staff members. broadcast ban event globally.
            const banMessage = formatBanMessage(banData)
            Kernel.world.getAllPlayers().forEach(p => {
                if (PermissionManager?.hasPermission(p, "essentials.admin.notify") || p.id === player.id) {
                    p.sendMessage(banMessage)
                }
            })

            player.sendMessage(`\u00A7a\u00A7l\u00BB \u00A7f${target.name} has been banned.`);
        } else {
            player.sendMessage("\u00A7c\u00A7l\u00BB \u00A77Failed to save ban record.");
        }
    }
}

function parseDuration(duration) {
    const durationLower = duration.toLowerCase()
    if (durationLower === "permanent") return 0
    // matches number + h/d/w suffix.
    const match = durationLower.match(/^(\d+)([hdw])$/)
    if (!match) return null
    
    const amount = parseInt(match[1])
    const unit = match[2]
    const multipliers = { 'h': 3600000, 'd': 86400000, 'w': 604800000 }
    return amount * (multipliers[unit] || 0)
}

function addBan(banData) {
    try {
        const bans = getBans()
        bans.push(banData)
        const now = Date.now()
        // clean up expired bans automatically to save space. database cleanups rule.
        const activeBans = bans.filter(ban => ban.expires === 0 || ban.expires > now)
        const Database = Kernel.get("database")
        Database.set("ae:bans", activeBans)
        return true
    } catch (error) {
        console.error(`[BanCommand] BLACKLIST_COMMIT_FAILURE: ${error}`)
        return false
    }
}

function getBans() {
    try {
        const Database = Kernel.get("database")
        const stored = Database.get("ae:bans")
        return stored || []
    } catch (error) {
        console.error(`[BanCommand] BLACKLIST_LOAD_FAILURE: ${error}`)
        return []
    }
}

function formatBanMessage(banData) {
    const durationText = banData.duration === 0 ? "STATUS: PERMANENT" : `DURATION: ${formatTimeRemaining(banData.expires - Date.now())}`
    return `\u00A76\u00A7l[\u00A7eBAN\u00A76\u00A7l] \u00A7r\u00A7e${banData.playerName} \u00A77was banished by \u00A7f${banData.bannedBy}\u00A77\n\u00A77${durationText}\n\u00A77REASON: \u00A7f${banData.reason}`
}

function formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return "TERMINATED"
    const days = Math.floor(milliseconds / 86400000)
    const hours = Math.floor((milliseconds % 86400000) / 3600000)
    const minutes = Math.floor((milliseconds % 3600000) / 60000)
    return days > 0 ? `${days}d ${hours}h ${minutes}m` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}
