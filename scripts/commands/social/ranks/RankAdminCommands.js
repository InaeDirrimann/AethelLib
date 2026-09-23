import { Kernel } from "../../../core/Kernel.js"

import { RankSystem, refreshPlayerNametag } from "../../../systems/social/ranks/RankSystem.js"
import { PlayerUtils } from "../../../utils/PlayerUtils.js"
import { ColorUtils } from "../../../utils/ColorUtils.js"

// ----------------------------------------------------------------------------
// | constant: RankAdminCommands                                              |
// | a collection of administrative vectors for the orchestration of the global|
// | hierarchy-manifest. handles creation, assignment, and revocation.         |
// ----------------------------------------------------------------------------
export const RankAdminCommands = [
    // --- Vector: createrank ---
    // Command-line or visual creation of rank nodes.
    {
        name: "createrank",
        aliases: ["createranks", "crrank", "ccrank"],
        description: "Creates a rank via command-line or UI",
        usage: "/ae:createrank [rankTag] [order] [displayName]",
        permission: "essentials.admin.ranks",
        category: "SOCIAL",
        parameters: [
            { name: "rankTag", type: "string", optional: true },
            { name: "order", type: "int", optional: true },
            { name: "displayName", type: "string", optional: true }
        ],
        async execute(data, player, args) {
            if (!args || args.length === 0 || args[0] === undefined) {
                const { RankCreateForm } = await import("../../../ui/social/ranks/RankCreateForm.js");
                Kernel.system.run(() => RankCreateForm.showCreateRank(player))
                return
            }

            const tag = args[0].trim()
            if (!/^[a-zA-Z0-9_]+$/.test(tag)) {
                player.sendMessage("\u00A7cInvalid Rank Tag: Only alphanumeric characters and underscores are allowed.")
                return
            }

            if (RankSystem.getRank(tag)) {
                player.sendMessage("\u00A7cFailed to create rank: Tag already exists.")
                return
            }

            const order = args[1] !== undefined ? parseInt(args[1]) : 1
            const displayName = args[2] ? args.slice(2).join(" ").replace(/&/g, "\u00A7") : tag

            if (RankSystem.createRank(tag, {
                name: displayName,
                order: isNaN(order) ? 1 : order,
                hideRanks: false,
                permissions: {}
            })) {
                player.sendMessage(`\u00A7a\u00A7l» \u00A7fSuccessfully created rank '\u00A7e${tag}\u00A7f'.`)
            } else {
                player.sendMessage("\u00A7cFailed to create rank.")
            }
        }
    },
    // --- Vector: rinfo ---
    // Minimal signature for rank inspection.
    {
        name: "rinfo",
        description: "Inspect rank metadata",
        usage: "/ae:rinfo <rankTag>",
        permission: "essentials.admin.ranks",
        category: "SOCIAL",
        native: false,
        parameters: [{ name: "rankTag", type: "string", optional: false }],
        async execute(data, player, args) {
            const tag = args[0]
            const rank = RankSystem.getRank(tag)
            if (!rank) {
                player.sendMessage(`\u00A7cRank '${tag}' not found.`)
                return
            }
            displayRankDetails(player, tag, rank)
        }
    },
    // --- Vector: rperm ---
    // Sliced permission node management.
    {
        name: "rperm",
        description: "Set rank permission node",
        usage: "/ae:rperm <rankTag> <node> <value>",
        permission: "essentials.admin.ranks",
        category: "SOCIAL",
        native: false,
        parameters: [
            { name: "rankTag", type: "string", optional: false },
            { name: "node", type: "string", optional: false },
            { name: "value", type: "string", optional: false }
        ],
        async execute(data, player, args) {
            const [tag, node, val] = args
            const rank = RankSystem.getRank(tag)
            if (!rank || !node || !val) {
                player.sendMessage("\u00A7cUsage: /ae:rperm <rank> <node> <allow|deny|inherit|number>")
                return
            }

            if (!rank.permissions) rank.permissions = {}
            const valLower = val.toLowerCase()

            if (valLower === "allow" || valLower === "true" || valLower === "1") {
                rank.permissions[node] = true
            } else if (valLower === "deny" || valLower === "false" || valLower === "2") {
                rank.permissions[node] = false
            } else if (valLower === "inherit" || valLower === "default" || valLower === "0") {
                delete rank.permissions[node]
            } else {
                const num = parseInt(val)
                if (!isNaN(num)) rank.permissions[node] = num
                else {
                    player.sendMessage(`\u00A7cInvalid value '${val}'.`)
                    return
                }
            }
            RankSystem.updateRank(tag, rank)
            player.sendMessage(`\u00A7a\u00A7l» \u00A7fUpdated '\u00A7e${node}\u00A7f' for rank \u00A7b${tag}\u00A7f.`)
        }
    },
    // --- Vector: rorder ---
    // Sliced priority/weight management.
    {
        name: "rorder",
        description: "Set rank priority order",
        usage: "/ae:rorder <rankTag> <number>",
        permission: "essentials.admin.ranks",
        category: "SOCIAL",
        native: false,
        parameters: [
            { name: "rankTag", type: "string", optional: false },
            { name: "order", type: "int", optional: false }
        ],
        async execute(data, player, args) {
            const [tag, orderStr] = args
            const rank = RankSystem.getRank(tag)
            if (!rank) return
            const order = parseInt(orderStr)
            if (isNaN(order)) return
            rank.order = order
            RankSystem.updateRank(tag, rank)
            player.sendMessage(`\u00A7a\u00A7l» \u00A7fSet order of \u00A7b${tag}\u00A7f to \u00A7e${order}\u00A7f.`)
        }
    },
    // --- Vector: rname ---
    // Sliced display name management.
    {
        name: "rname",
        description: "Set rank display name",
        usage: "/ae:rname <rankTag> <displayName>",
        permission: "essentials.admin.ranks",
        category: "SOCIAL",
        native: false,
        parameters: [
            { name: "rankTag", type: "string", optional: false },
            { name: "name", type: "string", optional: false }
        ],
        async execute(data, player, args) {
            const tag = args[0]
            const name = args.slice(1).join(" ").replace(/&/g, "\u00A7")
            const rank = RankSystem.getRank(tag)
            if (!rank) return
            rank.name = name
            RankSystem.updateRank(tag, rank)
            player.sendMessage(`\u00A7a\u00A7l» \u00A7fSet display name of \u00A7b${tag}\u00A7f to \u00A7e${name}\u00A7f.`)
        }
    },
    // --- Vector: rcolor ---
    // Sets rank display/name/tag color (e.g. S1, &6, gold, §1)
    {
        name: "rcolor",
        description: "Set rank display/name color",
        usage: "/ae:rcolor <rankTag> <color>",
        permission: "essentials.admin.ranks",
        category: "SOCIAL",
        native: false,
        parameters: [
            { name: "rankTag", type: "string", optional: false },
            { name: "color", type: "string", optional: false }
        ],
        async execute(data, player, args) {
            const [tag, colorInput] = args
            const rank = RankSystem.getRank(tag)
            if (!rank || !colorInput) {
                player.sendMessage("\u00A7cUsage: /ae:rcolor <rankTag> <color (e.g. S1, &6, gold)>")
                return
            }
            const normalized = ColorUtils.normalizeColorCode(colorInput, "§7")
            rank.colorName = normalized
            RankSystem.updateRank(tag, rank)
            player.sendMessage(`\u00A7a\u00A7l» \u00A7fSet display/name color of \u00A7b${tag}\u00A7f to ${normalized}${colorInput}\u00A7f.`)
        }
    },
    // --- Vector: rchatcolor ---
    // Sets rank chat message body color (e.g. Sa, &f, white, §a)
    {
        name: "rchatcolor",
        description: "Set rank chat message body color",
        usage: "/ae:rchatcolor <rankTag> <color>",
        permission: "essentials.admin.ranks",
        category: "SOCIAL",
        native: false,
        parameters: [
            { name: "rankTag", type: "string", optional: false },
            { name: "color", type: "string", optional: false }
        ],
        async execute(data, player, args) {
            const [tag, colorInput] = args
            const rank = RankSystem.getRank(tag)
            if (!rank || !colorInput) {
                player.sendMessage("\u00A7cUsage: /ae:rchatcolor <rankTag> <color (e.g. Sa, &f, white)>")
                return
            }
            const normalized = ColorUtils.normalizeColorCode(colorInput, "§f")
            rank.colorText = normalized
            RankSystem.updateRank(tag, rank)
            player.sendMessage(`\u00A7a\u00A7l» \u00A7fSet chat message color of \u00A7b${tag}\u00A7f to ${normalized}${colorInput}\u00A7f.`)
        }
    },
    // --- Vector: assignranks ---
    // Assigns a rank tag to a player entity and invalidates their permission cache.
    {
        name: "assignranks",
        aliases: ["setrank", "addranks"],
        description: "Assigns a rank to a player",
        usage: "/ae:assignranks <player> [rankTag]",
        permission: "essentials.admin.ranks",
        category: "SOCIAL",
        parameters: [
            { name: "player", type: "player", optional: false },
            { name: "rankTag", type: "rank", optional: true }
        ],
        async execute(data, player, args) {
            const target = args[0];
            const rankTag = args[1];

            const targetPlayer = typeof target === 'object' && target !== null
                ? target
                : PlayerUtils.findPlayer(target)

            if (!targetPlayer) {
                player.sendMessage("\u00A7c\u00A7l» \u00A77Player not found.")
                return
            }

            if (rankTag === undefined) {
                const { RankAssignUI } = await import("../../../ui/social/ranks/RankAssignUI.js");
                Kernel.system.run(() => RankAssignUI.showAssignRank(player, targetPlayer));
                return;
            }

            // verify the rank actually exists in the global registry.
            const targetRank = RankSystem.getRank(rankTag);
            if (!targetRank) {
                player.sendMessage(`\u00A7c\u00A7l» \u00A77Rank definition '${rankTag}' not found.`)
                return
            }

            // check if the target player already has the rank tag
            if (targetPlayer.hasTag(rankTag)) {
                player.sendMessage(`\u00A7c\u00A7l» \u00A7e${targetPlayer.name} \u00A77already has the rank '\u00A7b${rankTag}\u00A77'.`)
                return
            }

            // step 1: HIERARCHY OVERRIDE PREVENTION.
            const PermissionManager = Kernel.get("permissions");
            const executorRank = PermissionManager.getHighestRank(player);

            if (!player.hasTag("op") && targetRank.order >= (executorRank?.order || 0)) {
                player.sendMessage(`\u00A7c\u00A7l» \u00A77Security Fault: Cannot assign a rank equal to or higher than your own clearance.`);
                return;
            }

            // step 2: execution.
            targetPlayer.addTag(rankTag)
            player.sendMessage(`\u00A7a\u00A7l» \u00A7fSuccessfully assigned rank '${rankTag}' to ${targetPlayer.name}.`)
            targetPlayer.sendMessage(`\u00A7a\u00A7l» \u00A7fYou have been assigned the rank: \u00A7e${rankTag}`)

            // refresh overhead nametag
            refreshPlayerNametag(targetPlayer)

            // purge the stale permission cache.
            PermissionManager.invalidatePlayerCache(targetPlayer.id)
        }
    },
    // --- Vector: removeranks ---
    // Revokes a rank tag and updates the player's clearance level.
    {
        name: "removeranks",
        aliases: ["delrank"],
        description: "Removes a rank from a player",
        usage: "/ae:removeranks <player> <rankTag>",
        permission: "essentials.admin.ranks",
        category: "SOCIAL",
        parameters: [
            { name: "player", type: "player", optional: false },
            { name: "rankTag", type: "rank", optional: false }
        ],
        execute(data, player, args) {
            const target = args[0];
            const rankTag = args[1];

            const targetPlayer = typeof target === 'object' && target !== null
                ? target
                : PlayerUtils.findPlayer(target)

            if (!targetPlayer) {
                player.sendMessage("\u00A7c\u00A7l» \u00A77Player not found.")
                return
            }

            // check if the target player has the rank tag
            if (!targetPlayer.hasTag(rankTag)) {
                player.sendMessage(`\u00A7c\u00A7l» \u00A7e${targetPlayer.name} \u00A77does not have the rank '\u00A7b${rankTag}\u00A77'.`)
                return
            }

            // execute revocation.
            targetPlayer.removeTag(rankTag)
            player.sendMessage(`\u00A7a\u00A7l» \u00A7fSuccessfully removed rank '${rankTag}' from ${targetPlayer.name}.`)
            targetPlayer.sendMessage(`\u00A7c\u00A7l» \u00A77Your rank '${rankTag}' has been revoked.`)

            // refresh overhead nametag
            refreshPlayerNametag(targetPlayer)

            // purge the stale permission cache.
            const PermissionManager = Kernel.get("permissions")
            PermissionManager.invalidatePlayerCache(targetPlayer.id)
        }
    },
    // --- Vector: deleteranks ---
    // Purges a rank definition from the world store and cascades removal to all players.
    {
        name: "deleteranks",
        aliases: ["purgerank"],
        description: "Purges a rank definition from the system",
        usage: "/ae:deleteranks <rankTag>",
        permission: "essentials.admin.ranks",
        category: "SOCIAL",
        parameters: [
            { name: "rankTag", type: "rank", optional: false }
        ],
        execute(data, player, args) {
            const rankTag = args[0];
            // step 1: delete the definition from the store.
            if (RankSystem.deleteRank(rankTag)) {
                // step 2: cascade removal to every player currently tagged.
                Kernel.world.getAllPlayers().forEach(p => p.removeTag(rankTag));
                player.sendMessage(`\u00A7a\u00A7l» \u00A7fSuccessfully purged rank definition: ${rankTag}`)
            } else {
                player.sendMessage(`\u00A7c\u00A7l» \u00A77Failed to purge rank: ${rankTag}. Check if tag exists.`)
            }
        }
    },
    // --- Vector: editranks (Enterprise CLI) ---
    // Advanced permission management with LuckPerms-style syntax.
    {
        name: "editranks",
        aliases: ["editrank", "lp", "permset"],
        description: "Sets rank permissions with priority and value (LuckPerms style)",
        usage: "/ae:editranks [rankTag] [permission] [priority] [1|0]",
        permission: "essentials.admin.ranks",
        category: "SOCIAL",
        parameters: [
            { name: "rankTag", type: "rank", optional: true },
            { name: "permission", type: "permission", optional: true },
            { name: "priority", type: "int", optional: true },
            { name: "value", type: "int", optional: true }
        ],
        async execute(data, player, args) {
            if (!args || args.length === 0 || args[0] === undefined) {
                const { RankManagerMenu } = await import("../../../ui/social/ranks/RankManagerMenu.js");
                Kernel.system.run(() => RankManagerMenu.showRankList(player));
                return;
            }

            const tag = args[0];

            if (args.length === 1 || args[1] === undefined) {
                if (tag.toLowerCase() === "help") {
                    player.sendMessage("\u00A7e=== Rank Permissions Help ===");
                    player.sendMessage("\u00A7bUsage: /ae:editranks <rankTag> <permission> <priority> <1|0>");
                    player.sendMessage("\u00A77Or use sharded commands:");
                    player.sendMessage("\u00A7f- /ae:rperm <rankTag> <node> <allow|deny|inherit>");
                    player.sendMessage("\u00A7f- /ae:rorder <rankTag> <priority>");
                    player.sendMessage("\u00A7f- /ae:rname <rankTag> <displayName>");
                    player.sendMessage("\u00A77Available permissions list:");
                    player.sendMessage("\u00A7e- Cooldowns: \u00A7fcooldown.chat, cooldown.back, cooldown.tpa, cooldown.home, cooldown.warp, cooldown.rtp, cooldown.command");
                    player.sendMessage("\u00A7e- Limits: \u00A7flimit.home, limit.land");
                    player.sendMessage("\u00A7e- Costs: \u00A7fcost.back, cost.tpa, cost.home, cost.warp, cost.rtp");
                    player.sendMessage("\u00A7e- Land: \u00A7fland.claim, land.unclaim, land.invite, land.kick, land.transfer, land.setting");
                    player.sendMessage("\u00A7e- ChestShop: \u00A7fchestshop.create.sell, chestshop.create.buy, chestshop.sell, chestshop.buy");
                    player.sendMessage("\u00A7e- Admin: \u00A7fadmin.panel, admin.ban, admin.broadcast, admin.economy, admin.floatingtext, admin.invsee, admin.kick, admin.landsetting, admin.log, admin.mute, admin.ranks, admin.resetdata, admin.sellsetting, admin.setting, admin.shopsetting, admin.warp, admin.tp, admin.gm.c, admin.gm.s, admin.gm.sp, admin.gm.a");
                    player.sendMessage("\u00A7e- General: \u00A7fadmin, essentials.home, essentials.sethome, essentials.delhome, essentials.tpa, essentials.tpaccept, essentials.tpadeny, essentials.tpacancel, essentials.pay, essentials.money, essentials.withdraw, essentials.shop, essentials.sell, essentials.rtp, essentials.back, essentials.menu, essentials.auction, essentials.calculate, essentials.report, essentials.tps, essentials.help, essentials.info, essentials.credit, essentials.default");
                    return;
                }
                const rank = RankSystem.getRank(tag);
                if (!rank) {
                    player.sendMessage(`\u00A7cRank '${tag}' does not exist.`);
                    return;
                }
                const { RankActionMenu } = await import("../../../ui/social/ranks/RankActionMenu.js");
                Kernel.system.run(() => RankActionMenu.showRankActions(player, tag));
                return;
            }

            if (args.length < 4 || args[1] === undefined || args[2] === undefined || args[3] === undefined) {
                player.sendMessage(`\u00A7cInvalid arguments. Usage: /ae:editranks <rankTag> <permission> <priority> <1|0>`);
                player.sendMessage(`\u00A77Type \u00A7e/ae:editranks help \u00A77for details.`);
                return;
            }

            const node = args[1];
            const priority = parseInt(args[2]);
            const valNum = parseInt(args[3]);

            const rank = RankSystem.getRank(tag);
            if (!rank) {
                player.sendMessage(`\u00A7cRank '${tag}' does not exist.`);
                return;
            }

            if (!rank.permissions) rank.permissions = {};

            // Update rank priority (order)
            rank.order = isNaN(priority) ? rank.order : priority;

            // Update permission value (1 = true, 0 = false)
            if (valNum === 1) {
                rank.permissions[node] = true;
                player.sendMessage(`\u00A7a\u00A7l» \u00A7fSet permission '\u00A7e${node}\u00A7f' to \u00A7aALLOW \u00A7f(1) for rank \u00A7b${tag}\u00A7f with priority \u00A7e${priority}\u00A7f.`);
            } else if (valNum === 0) {
                rank.permissions[node] = false;
                player.sendMessage(`\u00A7a\u00A7l» \u00A7fSet permission '\u00A7e${node}\u00A7f' to \u00A7cDENY \u00A7f(0) for rank \u00A7b${tag}\u00A7f with priority \u00A7e${priority}\u00A7f.`);
            } else {
                player.sendMessage(`\u00A7cInvalid value '${valNum}'. Use 1 for true, 0 for false.`);
                return;
            }

            RankSystem.updateRank(tag, rank);
        }
    }
]

/**
 * HELPER: Formats and displays rank metadata to a player.
 */
function displayRankDetails(player, tag, rank) {
    player.sendMessage(" ")
    player.sendMessage(`\u00A7b==== Rank Info: \u00A7e${tag} \u00A7b====`)
    player.sendMessage(`\u00A77Display Name: \u00A7f${rank.name || tag}`)
    player.sendMessage(`\u00A77Order/Priority: \u00A7e${rank.order}`)
    
    const perms = rank.permissions || {}
    const nodes = Object.keys(perms)
    if (nodes.length > 0) {
        player.sendMessage(`\u00A77Permissions (\u00A7e${nodes.length}\u00A77):`)
        nodes.forEach(node => {
            const val = perms[node]
            const color = val === true ? "\u00A7a" : (val === false ? "\u00A7c" : "\u00A7b")
            player.sendMessage(` \u00A78- \u00A77${node}: ${color}${val}`)
        })
    } else {
        player.sendMessage(`\u00A77Permissions: \u00A78None`)
    }
    player.sendMessage(" ")
}
