import { Kernel } from "../../core/Kernel.js";
import { RankSystem } from "../../systems/social/ranks/RankSystem.js"

/*
 * Rank Admin Command
 * ----------------------------------------------------------------------------
 * Allows admins to manage server ranks and permissions.
 */

export const RankAdminCommand = {
    name: "rankadmin",
    description: "Manage player ranks and permissions",
usage: "/ae:rankadmin <subcommand> [args...]",
permission: "essentials.admin.ranks",
category: "Admin",
// Intercepted by script for subcommand argument joining.
native: false,
parameters: [
    { name: "subcommand", type: "string", optional: true },
    { name: "args",       type: "string", optional: true  }
],

/* 
 * SUBCOMMAND_ROUTING_ENGINE
 */
async execute(_data, player, args) {
        if (args.length < 1) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:rankadmin <subcommand>");

            player.sendMessage("\u00A78- create <tag> <name> <order>");
            player.sendMessage("\u00A78- delete <tag>");
            player.sendMessage("\u00A78- add <player> <tag>");
            player.sendMessage("\u00A78- remove <player> <tag>");
            player.sendMessage("\u00A78- edit <tag> <field> <value>");
            player.sendMessage("\u00A78- setperm <tag> <permission> <value>");
            player.sendMessage("\u00A78- list | info <tag>");
            return
        }


        const subcommand = args[0].toLowerCase()
        
        switch (subcommand) {
            case "create":
                await handleCreate(player, args.slice(1))
                break
            case "delete":
                await handleDelete(player, args.slice(1))
                break
            case "add":
                await handleAdd(player, args.slice(1))
                break
            case "remove":
                await handleRemove(player, args.slice(1))
                break
            case "edit":
                await handleEdit(player, args.slice(1))
                break
            case "setperm":
                await handleSetPerm(player, args.slice(1))
                break
            case "list":
                await handleList(player)
                break
            case "info":
                await handleInfo(player, args.slice(1))
                break
            default:
                player.sendMessage(`\u00A7c\u00A7l» \u00A77Unknown subcommand: '${subcommand}'`);
        }

    }
}

/* 
 * RANK_MANIFEST_INJECTION_HANDLER
 */
async function handleCreate(player, args) {
    if (args.length < 3) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:rankadmin create <tag> <name> <order>");
        return
    }


    const [tag, displayName, orderStr] = args

    if (!/^[a-zA-Z0-9_]+$/.test(tag)) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Rank tag must be alphanumeric.");
        return
    }


    const order = parseInt(orderStr)
    if (isNaN(order)) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Order must be a number.");
        return
    }


    if (RankSystem.getRank(tag)) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Rank '${tag}' already exists.`);
        return
    }


    const rankData = {
        name: displayName,
        order: order,
        hideRanks: false,
        permissions: {},
        inherits: null
    }

    const success = RankSystem.createRank(tag, rankData)
    if (success) {
        player.sendMessage(`\u00A7a\u00A7l» \u00A7fRank \u00A7e${tag}\u00A7f has been created.`);
    } else {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Failed to create rank.");
    }
}


/* 
 * RANK_MANIFEST_DECOMMISSION_HANDLER
 */
async function handleDelete(player, args) {
    if (args.length < 1) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:rankadmin delete <tag>");
        return
    }


    const tag = args[0]

    if (!RankSystem.getRank(tag)) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Rank '${tag}' not found.`);
        return
    }


    const success = RankSystem.deleteRank(tag)
    if (success) {
        player.sendMessage(`\u00A7a\u00A7l» \u00A7fRank \u00A7e${tag}\u00A7f has been deleted.`);
        
        Kernel.world.getAllPlayers().forEach(p => {
            if (p.hasTag(tag)) {
                p.removeTag(tag)
            }
        })
    } else {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Failed to delete rank.");
    }
}


/* 
 * TAG_ASSIGNMENT_HANDLER
 */
async function handleAdd(player, args) {
    if (args.length < 2) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:rankadmin add <player> <tag>");
        return
    }


    const [playerName, tag] = args

    if (!RankSystem.getRank(tag)) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Rank '${tag}' not found.`);
        return
    }


    const target = PlayerUtils.findPlayer(playerName)
    if (!target) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Player '${playerName}' not found.`);
        return
    }


    target.addTag(tag)
    player.sendMessage(`\u00A7a\u00A7l» \u00A7fRank \u00A7e${tag}\u00A7f added to \u00A7e${target.name}\u00A7f.`);
    target.sendMessage(`\u00A7a\u00A7l» \u00A7fYour rank was updated: You are now \u00A7e${tag}\u00A7f.`);
}


/* 
 * TAG_REMOVAL_HANDLER
 */
async function handleRemove(player, args) {
    if (args.length < 2) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:rankadmin remove <player> <tag>");
        return
    }


    const [playerName, tag] = args

    const target = PlayerUtils.findPlayer(playerName)
    if (!target) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Player '${playerName}' not found.`);
        return
    }

    target.removeTag(tag)
    player.sendMessage(`\u00A7a\u00A7l» \u00A7fRank \u00A7e${tag}\u00A7f removed from \u00A7e${target.name}\u00A7f.`);
    target.sendMessage(`\u00A7a\u00A7l» \u00A7fYour rank was updated: You no longer have the rank \u00A7e${tag}\u00A7f.`);
}


/* 
 * MANIFEST_CALIBRATION_HANDLER
 */
async function handleEdit(player, args) {
    if (args.length < 3) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:rankadmin edit <tag> <field> <value>");
        player.sendMessage("\u00A78- Fields: name, order");
        return
    }


    const [tag, field, value] = args
    const allowedFields = ["name", "order"]
    if (!allowedFields.includes(field)) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Invalid field: '${field}'`);
        return
    }


    const rank = RankSystem.getRank(tag)
    if (!rank) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Rank '${tag}' not found.`);
        return
    }


    const updatedRank = { ...rank }
    
    switch (field) {
        case "name":
            updatedRank.name = value
            updatedRank.displayName = value
            break
        case "order":
            const order = parseInt(value)
            if (isNaN(order)) {
                player.sendMessage("\u00A7c\u00A7l» \u00A77Order must be a number.");
                return
            }
            updatedRank.order = order

            break
    }

    const success = RankSystem.updateRank(tag, updatedRank)
    if (success) {
        player.sendMessage(`\u00A7a\u00A7l» \u00A7fRank field \u00A7e${field}\u00A7f updated for \u00A7e${tag}\u00A7f.`);
    } else {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Failed to update rank.");
    }
}


/* 
 * GLOBAL_HIERARCHY_QUERY
 */
async function handleList(player) {
    const ranks = RankSystem.getAllRanks()
    
    if (Object.keys(ranks).length === 0) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77No ranks found.");
        return
    }


    player.sendMessage(" ")
    player.sendMessage("\u00A76\u00A7lServer Ranks")
    Object.entries(ranks).forEach(([tag, rank]) => {
        player.sendMessage(`\u00A77- ${tag}: ${rank.name} \u00A78(Order: ${rank.order})`)
    })
    player.sendMessage(" ")
}


/* 
 * SPECIFIC_MANIFEST_QUERY
 */
async function handleInfo(player, args) {
    if (args.length < 1) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:rankadmin info <tag>");
        return
    }


    const tag = args[0]
    const rank = RankSystem.getRank(tag)

    if (!rank) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Rank '${tag}' not found.`);
        return
    }


    player.sendMessage(" ")
    player.sendMessage(`\u00A76\u00A7lRank Info: \u00A7f${tag}`)
    player.sendMessage(`\u00A77Display: ${rank.name}`)
    player.sendMessage(`\u00A77Order: \u00A7e${rank.order}`)
    player.sendMessage(`\u00A77Permissions: \u00A7f${JSON.stringify(rank.permissions, null, 2)}`)
    player.sendMessage(" ")
}

/* 
 * PERMISSION_NODE_CALIBRATION_HANDLER
 */
async function handleSetPerm(player, args) {
    if (args.length < 3) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:rankadmin setperm <tag> <permission> <value>");
        player.sendMessage("\u00A78- Values: true, false, a number, or 'none' / 'remove' to delete");
        return
    }

    const [tag, permission, valueStr] = args
    const rank = RankSystem.getRank(tag)
    if (!rank) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Rank '${tag}' not found.`);
        return
    }

    const updatedRank = { ...rank }
    if (!updatedRank.permissions) {
        updatedRank.permissions = {}
    }

    if (valueStr.toLowerCase() === "none" || valueStr.toLowerCase() === "remove" || valueStr === "0") {
        delete updatedRank.permissions[permission]
        player.sendMessage(`\u00A7a\u00A7l» \u00A7fPermission \u00A7e${permission}\u00A7f removed from rank \u00A7e${tag}\u00A7f.`);
    } else {
        let value;
        if (valueStr.toLowerCase() === "true" || valueStr === "1") {
            value = true
        } else if (valueStr.toLowerCase() === "false" || valueStr === "2") {
            value = false
        } else {
            const num = Number(valueStr)
            if (!isNaN(num)) {
                value = num
            } else {
                value = valueStr
            }
        }
        updatedRank.permissions[permission] = value
        player.sendMessage(`\u00A7a\u00A7l» \u00A7fPermission \u00A7e${permission}\u00A7f set to \u00A7e${value}\u00A7f for rank \u00A7e${tag}\u00A7f.`);
    }

    const success = RankSystem.updateRank(tag, updatedRank)
    if (!success) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Failed to update rank permissions.");
    }
}


