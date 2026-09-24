import { Kernel } from "../../core/Kernel.js"
import { PlayerUtils } from "../../utils/PlayerUtils.js"
import { ValidationHelper } from "../../utils/ValidationHelper.js"

// ----------------------------------------------------------------------------
// | object: TempbanCommand                                                   |
// | command definition for temporarily banning a player from the server.     |
// | interfaces with the admin service to persist the ban record.             |
// ----------------------------------------------------------------------------
export const TempbanCommand = {
    // internal name.
    name: "tempban",
    // human-readable description.
    description: "Temporarily ban a player",
    // syntax guide.
    usage: "/ae:tempban <playerName> <duration> [reason]",
    // required permission node.
    permission: "essentials.admin.ban",
    // command category.
    category: "admin",
    native: false,
    
    // native parameter definitions for the command parser.
    parameters: [
        { name: "player", type: "player", optional: false  },
        { name: "duration", type: "string", optional: true  },
        { name: "reason",   type: "string", optional: true  }
    ],

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | processes the temporary ban request.                                     |
    // ----------------------------------------------------------------------------
    execute(_data, player, args) {
        // syntax check.
        if (args.length < 2) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:tempban <player> <duration> [reason]")
            player.sendMessage("\u00A77Examples: /ae:tempban Wladyslaw18 1d Spamming")
            return
        }

        // resolve the target player.
        const { player: target, consumedArgs } = PlayerUtils.resolveFromArgs(args)

        // ensure the target is online.
        if (!target) {
            player.sendMessage(`\u00A7c\u00A7l» \u00A77Player '${args[0]}' not found or is offline.`)
            return
        }

        // extract duration and reason from the arguments.
        const duration = args[consumedArgs]
        const reason = args.slice(consumedArgs + 1).join(" ") || "No reason provided"

        if (!duration) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Please provide a duration (e.g. 1h, 1d, 1w).")
            return
        }

        // step 1: hierarchy check.
        const PermissionManager = Kernel.get("permissions")
        if (PermissionManager && !PermissionManager.canActOn(player, target)) {
            player.sendMessage("\u00A7cYou do not have enough power to ban this player.")
            return
        }

        // step 2: parse the time token.
        const banDuration = parseDuration(duration)
        if (banDuration === null) {
            player.sendMessage(`\u00A7c\u00A7l» \u00A77Invalid duration: '${duration}'`)
            return
        }

        // step 3: build the ban metadata record.
        const banData = {
            playerId: target.id,
            playerName: target.name,
            bannedBy: player.name,
            bannedById: player.id,
            reason: reason,
            timestamp: Date.now(),
            duration: banDuration,
            expires: Date.now() + banDuration,
            temp: true
        }

        // step 4: commit to the ban manager.
        const BanManager = Kernel.get("banManager")
        if (BanManager.addBan(banData)) {
            // step 5: disconnect the player immediately.
            Kernel.system.run(() => {
                try {
                    const safeName = ValidationHelper.escapeCommandString(target.name)
                    const safeReason = ValidationHelper.escapeCommandString(reason)
                    // we use the dimension runCommand as a reliable way to kick.
                    /* try */ Kernel.world.getDimension("overworld").runCommand(`kick "${safeName}" \u00A7c\u00A7l[TEMPORARY BAN]\n\u00A7eReason: ${safeReason}`)
                } catch (error) {
                    console.error(`Failed to kick tempbanned player ${target.name}: ${error}`)
                }
            })

            // step 6: notify other staff members.
            const banMessage = formatBanMessage(banData)
            Kernel.world.getAllPlayers().forEach(p => {
                if (PermissionManager.hasPermission(p, "essentials.admin.notify") || p.id === player.id) {
                    p.sendMessage(banMessage)
                }
            })

            // confirm to the admin.
            player.sendMessage(`\u00A7a\u00A7l» \u00A7fPlayer '${target.name}' tempbanned for \u00A7e${formatTimeRemaining(banDuration)}`)
        } else {
            // fail if the database rejected the record.
            player.sendMessage("\u00A7c\u00A7l» \u00A77Failed to add tempban")
        }
    }
}

// ----------------------------------------------------------------------------
// | function: parseDuration                                                  |
// | converts temporal tokens (h, d, w) into millisecond offsets.             |
// ----------------------------------------------------------------------------
function parseDuration(duration) {
    const durationLower = duration.toLowerCase()
    // regex for number + unit character.
    const match = durationLower.match(/^(\d+)([hdw])$/)
    if (!match) return null

    const amount = parseInt(match[1])
    const unit = match[2]

    // unit multipliers for time calculation.
    const multipliers = {
        'h': 60 * 60 * 1000,    // hours
        'd': 24 * 60 * 60 * 1000, // days  
        'w': 7 * 24 * 60 * 60 * 1000 // weeks
    }

    return amount * (multipliers[unit] || 0)
}

// ----------------------------------------------------------------------------
// | function: formatBanMessage                                               |
// | builds the pretty-printed announcement string for the server logs.       |
// ----------------------------------------------------------------------------
function formatBanMessage(banData) {
    const durationText = formatTimeRemaining(banData.duration)
    return `\u00A76\u00A7l[\u00A7eTEMPBAN\u00A76\u00A7l] \u00A7r${banData.playerName} \u00A77was tempbanned by \u00A7e${banData.bannedBy}\u00A77\n\u00A77Duration: \u00A7e${durationText}\u00A77\n\u00A77Reason: \u00A7f${banData.reason}`
}

// ----------------------------------------------------------------------------
// | function: formatTimeRemaining                                            |
// | converts millisecond deltas into human-readable strings.                 |
// ----------------------------------------------------------------------------
function formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return "Expired"

    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24))
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`
    } else {
        return `${minutes}m`
    }
}
