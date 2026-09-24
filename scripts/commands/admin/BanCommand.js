import { Kernel } from "../../core/Kernel.js"
import { PlayerUtils } from "../../utils/PlayerUtils.js"
import { ValidationHelper } from "../../utils/ValidationHelper.js"
import { UIUtils } from "../../ui/UIUtils.js"

// ----------------------------------------------------------------------------
// | object: BanCommand                                                       |
// | Ban management command. Supports direct CLI execution with quotes,        |
// | and opens an interactive modal form if parameters are omitted.           |
// ----------------------------------------------------------------------------
export const BanCommand = {
    name: "ban",
    description: "Ban a player with interactive duration and reason form",
    usage: "/ae:ban [player] [duration] [reason]",
    permission: "essentials.ban",
    category: "Admin",
    
    // Native parameter definitions for autocomplete in Bedrock C++
    params: [
        { name: "player",   type: "player", optional: true },
        { name: "duration", type: "string", optional: true },
        { name: "reason",   type: "string", optional: true }
    ],

    async execute(_data, player, args) {
        // Case 1: No arguments — open the full interactive Ban Form with player selector
        if (!args || args.length === 0 || !args[0]) {
            await showBanModal(player, null);
            return;
        }

        const { player: target, consumedArgs } = PlayerUtils.resolveFromArgs(args);
        
        if (!target) {
            player.sendMessage("\u00A7c\u00A7l\u00BB \u00A77Player target not found or offline.");
            return;
        }

        // Case 2: Player provided, but duration or reason omitted — open Ban Form for this player
        if (args.length <= consumedArgs) {
            await showBanModal(player, target);
            return;
        }

        // Case 3: Full CLI execution (e.g. /ae:ban Steve 1d "griefing")
        const durationStr = args[consumedArgs] || "permanent";
        const reason = args.slice(consumedArgs + 1).join(" ") || "Breaking the rules";

        const banDuration = parseDuration(durationStr);
        if (banDuration === null) {
            player.sendMessage(`\u00A7c\u00A7l\u00BB \u00A77Invalid duration: '${durationStr}'.`);
            player.sendMessage(`\u00A77Examples: \u00A7e1d\u00A77, \u00A7e7d\u00A77, \u00A7e1mo\u00A77, \u00A7e1y\u00A77, \u00A7epermanent`);
            return;
        }

        executeBan(player, target, banDuration, reason);
    }
}

/**
 * Interactive Modal Form for bans: days, months, years, reason, and expiration timer.
 * @param {import("@minecraft/server").Player} sender
 * @param {import("@minecraft/server").Player|null} preselectedTarget
 */
export async function showBanModal(sender, preselectedTarget = null) {
    const onlinePlayers = [...Kernel.world.getAllPlayers()].filter(p => p.id !== sender.id);

    if (!preselectedTarget && onlinePlayers.length === 0) {
        sender.sendMessage("\u00A7c\u00A7l\u00BB \u00A77No other players are currently online to ban.");
        return;
    }

    const form = new Kernel.ModalFormData();
    form.title("\u00A7c\u00A7lBan Player");

    let playerNames = [];
    if (preselectedTarget) {
        playerNames = [preselectedTarget.name];
        form.dropdown("Target Player:", playerNames, 0);
    } else {
        playerNames = onlinePlayers.map(p => p.name);
        form.dropdown("Select Target Player:", playerNames, 0);
    }

    const presets = [
        "Permanent (No Expiration)",
        "1 Day",
        "7 Days (1 Week)",
        "30 Days (1 Month)",
        "90 Days (3 Months)",
        "180 Days (6 Months)",
        "1 Year",
        "Custom Duration (Set Days/Months/Years below)"
    ];
    form.dropdown("Duration Preset:", presets, 0);
    form.textField("Custom Days:", "0", "0");
    form.textField("Custom Months:", "0", "0");
    form.textField("Custom Years:", "0", "0");
    form.textField("Ban Reason:", "Griefing / Rule violation", "Breaking server rules");

    const res = await UIUtils.showForm(sender, form);
    if (res.canceled) return;

    const [playerIndex, presetIndex, customDaysStr, customMonthsStr, customYearsStr, reasonInput] = res.formValues;

    let targetPlayer = preselectedTarget;
    if (!targetPlayer) {
        const selectedName = playerNames[playerIndex];
        targetPlayer = PlayerUtils.findPlayer(selectedName);
    }

    if (!targetPlayer) {
        sender.sendMessage("\u00A7c\u00A7l\u00BB \u00A77Target player not found or offline.");
        return;
    }

    let banDuration = 0;
    switch (presetIndex) {
        case 0: banDuration = 0; break; // Permanent
        case 1: banDuration = 86400000; break; // 1 Day
        case 2: banDuration = 7 * 86400000; break; // 7 Days
        case 3: banDuration = 30 * 86400000; break; // 30 Days
        case 4: banDuration = 90 * 86400000; break; // 3 Months
        case 5: banDuration = 180 * 86400000; break; // 6 Months
        case 6: banDuration = 365 * 86400000; break; // 1 Year
        case 7: {
            const days = parseInt(customDaysStr) || 0;
            const months = parseInt(customMonthsStr) || 0;
            const years = parseInt(customYearsStr) || 0;
            banDuration = (days * 86400000) + (months * 2592000000) + (years * 31536000000);
            break;
        }
    }

    const reason = String(reasonInput || "Breaking the rules").trim();
    executeBan(sender, targetPlayer, banDuration, reason);
}

/**
 * Executes the ban, saves to database, kicks target, and broadcasts notification.
 */
function executeBan(player, target, banDuration, reason) {
    const PermissionManager = Kernel.get("permissions");
    if (PermissionManager && !PermissionManager.canActOn(player, target)) {
        player.sendMessage("\u00A7c\u00A7l\u00BB \u00A77Permission Denied: Target is more powerful than you.");
        return;
    }

    const banData = {
        playerId: target.id,
        playerName: target.name,
        bannedBy: player.name,
        bannedById: player.id,
        reason: reason,
        timestamp: Date.now(),
        duration: banDuration,
        expires: banDuration === 0 ? 0 : Date.now() + banDuration
    };

    if (addBan(banData)) {
        Kernel.system.run(() => {
            try {
                const safeName = ValidationHelper.escapeCommandString(target.name);
                const safeReason = ValidationHelper.escapeCommandString(reason);
                const timerText = banDuration === 0 ? "Permanent" : formatTimeRemaining(banDuration);
                Kernel.world.getDimension("overworld").runCommand(
                    `kick "${safeName}" \u00A7c[BANNED]\n\u00A7eREASON: \u00A7f${safeReason}\n\u00A7eDURATION: \u00A7f${timerText}`
                );
            } catch (error) {
                console.error(`[BanCommand] Kick dispatch error: ${error}`);
            }
        });

        const banMessage = formatBanMessage(banData);
        Kernel.world.getAllPlayers().forEach(p => {
            if (PermissionManager?.hasPermission(p, "essentials.admin.notify") || p.id === player.id) {
                p.sendMessage(banMessage);
            }
        });

        player.sendMessage(`\u00A7a\u00A7l\u00BB \u00A7f${target.name} has been successfully banned.`);
    } else {
        player.sendMessage("\u00A7c\u00A7l\u00BB \u00A77Failed to save ban record to database.");
    }
}

/**
 * Parses time strings into milliseconds.
 * Supports s, m, h, d, w, mo, y, and permanent.
 */
function parseDuration(duration) {
    if (!duration) return null;
    const durationLower = duration.toLowerCase().trim();
    if (durationLower === "permanent" || durationLower === "perm" || durationLower === "0") return 0;
    
    const match = durationLower.match(/^(\d+)(s|m|h|d|w|mo|y)$/);
    if (!match) return null;
    
    const amount = parseInt(match[1]);
    const unit = match[2];
    const multipliers = {
        's': 1000,
        'm': 60000,
        'h': 3600000,
        'd': 86400000,
        'w': 604800000,
        'mo': 2592000000, // 30 days
        'y': 31536000000   // 365 days
    };
    return amount * (multipliers[unit] || 0);
}

function addBan(banData) {
    try {
        const bans = getBans();
        bans.push(banData);
        const now = Date.now();
        const activeBans = bans.filter(ban => ban.expires === 0 || ban.expires > now);
        const Database = Kernel.get("database");
        Database.set("ae:bans", activeBans);
        return true;
    } catch (error) {
        console.error(`[BanCommand] Database write error: ${error}`);
        return false;
    }
}

function getBans() {
    try {
        const Database = Kernel.get("database");
        const stored = Database.get("ae:bans");
        return stored || [];
    } catch (error) {
        console.error(`[BanCommand] Database read error: ${error}`);
        return [];
    }
}

function formatBanMessage(banData) {
    const durationText = banData.duration === 0 ? "STATUS: PERMANENT" : `DURATION: ${formatTimeRemaining(banData.expires - Date.now())}`;
    return `\u00A76\u00A7l[\u00A7eBAN\u00A76\u00A7l] \u00A7r\u00A7e${banData.playerName} \u00A77was banished by \u00A7f${banData.bannedBy}\u00A77\n\u00A77${durationText}\n\u00A77REASON: \u00A7f${banData.reason}`;
}

function formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return "EXPIRED";
    const years = Math.floor(milliseconds / 31536000000);
    const months = Math.floor((milliseconds % 31536000000) / 2592000000);
    const days = Math.floor((milliseconds % 2592000000) / 86400000);
    const hours = Math.floor((milliseconds % 86400000) / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);

    const parts = [];
    if (years > 0) parts.push(`${years}y`);
    if (months > 0) parts.push(`${months}mo`);
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.length > 0 ? parts.join(" ") : "< 1m";
}
