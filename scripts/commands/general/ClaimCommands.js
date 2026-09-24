/*
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  ᚫᛏᚻᛖᛚᚷᚱᚪᛞ  •  A E T H E L G R A D  S T U D I O S  •  ᚫᛏᚻᛖᛚᚷᚱᚪᛞ
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  
 *  Copyright (c) 2026 Aethelgrad Studios (Wladyslaw18).
 *  All Rights Reserved.
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU Affero General Public License for more details.
 *  
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program. If not, see <https://www.gnu.org/licenses/>.
 *  
 *  [ NOBLE INFRASTRUCTURE CORE  •
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { showClaimUI } from "../../ui/protection/ClaimUI.js"
import { UIUtils } from "../../ui/UIUtils.js"
import {
    createClaim,
    removeClaim,
    trustPlayer,
    untrustPlayer
} from "../../systems/protection/ClaimService.js"
import { Kernel } from "../../core/Kernel.js"

// ----------------------------------------------------------------------------
// | SHARED HELPER                                                            |
// | resolves the maximum chunk allowance for a player, respecting           |
// | super admin bypass and rank-based limits.                                |
// ----------------------------------------------------------------------------
function resolveClaimLimit(player) {
    const PM = Kernel.get("permissions")
    if (!PM) return undefined
    if (PM._isSuperAdmin(player)) return Infinity
    return PM.getPermission(player, "limit.land")
}

function checkClaimQuota(player, radius) {
    const ClaimStore = Kernel.get("claimStore")
    const maxClaims = resolveClaimLimit(player)
    
    // ✦ FIXED: Treat -1 and Infinity as Unlimited!
    if (maxClaims === Infinity || maxClaims === -1) return true

    const currentClaims = ClaimStore.getPlayerClaims(player.id).length
    const chunksToClaim = Math.pow((radius * 2) + 1, 2)

    if (currentClaims + chunksToClaim > maxClaims) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Claim limit reached! You have \u00A7e${currentClaims}\u00A77/\u00A7e${maxClaims}\u00A77 chunks.`)
        return false
    }
    return true
}

function parsePermissions(permString) {
    if (!permString) return 15  // default: full clearance (build+chests+doors+containers)
    let permissions = 0
    const parts = permString.toLowerCase().split(",")
    for (const part of parts) {
        switch (part.trim()) {
            case "build":      permissions |= 1;  break
            case "chests":     permissions |= 2;  break
            case "doors":      permissions |= 4;  break
            case "containers": permissions |= 8;  break
            case "all":        permissions  = 15; break
        }
    }
    return permissions
}

// ----------------------------------------------------------------------------
// | command: ClaimCommand                                                    |
// | /ae:claim — instantly claims the chunk you're standing in.              |
// ----------------------------------------------------------------------------
export const ClaimCommand = {
    name: "claim",
    description: "Claim the chunk you're standing in.",
    usage: "/ae:claim",
    permission: "essentials.claim",
    category: "General",
    // no parameters — bare command, no parser ambiguity possible.
    parameters: [],

    execute(_data, player) {
        if (!checkClaimQuota(player, 0)) return
        createClaim(player, player.location, 0)
    }
}

// ----------------------------------------------------------------------------
// | command: ClaimRadiusCommand                                              |
// | /ae:claimradius <radius> — claims a square radius of chunks.            |
// | Integer param = no syntax error, ever.                                  |
// ----------------------------------------------------------------------------
export const ClaimRadiusCommand = {
    name: "claimradius",
    description: "Claim a square radius of chunks around you (1-5).",
    usage: "/ae:claimradius <radius>",
    permission: "essentials.claim",
    category: "General",
    parameters: [
        { name: "radius", type: "integer", optional: false }
    ],

    execute(_data, player, args) {
        const radius = typeof args[0] === "number" ? args[0] : parseInt(args[0])
        if (isNaN(radius) || radius < 1 || radius > 5) {
            player.sendMessage("\u00A7c\u00A7l[Error] \u00A77Radius must be between 1 and 5 chunks.")
            return
        }
        if (!checkClaimQuota(player, radius)) return
        createClaim(player, player.location, radius)
    }
}

// ----------------------------------------------------------------------------
// | command: UnclaimCommand                                                  |
// | /ae:unclaim — removes the claim at your current location.               |
// ----------------------------------------------------------------------------
export const UnclaimCommand = {
    name: "unclaim",
    description: "Remove your land claim at your current location.",
    usage: "/ae:unclaim",
    permission: "essentials.claim",
    category: "General",
    parameters: [],

    execute(_data, player) {
        removeClaim(player, player.location)
    }
}

// ----------------------------------------------------------------------------
// | command: ClaimTrustCommand                                               |
// | /ae:claimtrust <player> [permission] — grants trust to a player.        |
// | PlayerSelector = native name resolution, clean autocomplete.            |
// ----------------------------------------------------------------------------
export const ClaimTrustCommand = {
    name: "claimtrust",
    description: "Trust a player in your land claim.",
    usage: "/ae:claimtrust <player> [build|chests|doors|containers|all]",
    permission: "essentials.claim",
    category: "General",
    params: [
        { name: "player", type: "player",          optional: false },
        { name: "perms",  type: "claimPermission", optional: true  }
    ],

    execute(_data, player, args) {
        const target = args[0]
        if (!target) {
            player.sendMessage("§c§l[Error] §7Usage: /ae:claimtrust <player> [perms]")
            return
        }
        // args[0] is a Player object from PlayerSelector — grab their name.
        const playerName = typeof target === "object" ? target.name : String(target)
        // trusting yourself is just... no 💧
        if (playerName === player.name) {
            player.sendMessage("§c§l» §7You can't trust yourself — you already own the claim 💧")
            return
        }
        const permissions = parsePermissions(args[1] ? String(args[1]) : null)
        trustPlayer(player, playerName, permissions)
    }
}

// ----------------------------------------------------------------------------
// | command: ClaimUntrustCommand                                             |
// | /ae:claimuntrust <player> — revokes all trust from a player.            |
// ----------------------------------------------------------------------------
export const ClaimUntrustCommand = {
    name: "claimuntrust",
    description: "Revoke all trust from a player in your land claim.",
    usage: "/ae:claimuntrust <player>",
    permission: "essentials.claim",
    category: "General",
    parameters: [
        { name: "player", type: "player", optional: false }
    ],

    execute(_data, player, args) {
        const target = args[0]
        if (!target) {
            player.sendMessage("§c§l[Error] §7Usage: /ae:claimuntrust <player>")
            return
        }
        const playerName = typeof target === "object" ? target.name : String(target)
        // untrusing yourself is equally as dumb 💧
        if (playerName === player.name) {
            player.sendMessage("§c§l» §7You can't untrust yourself — you're the owner 💧")
            return
        }
        untrustPlayer(player, playerName)
    }
}

// ----------------------------------------------------------------------------
// | command: ClaimUICommand                                                  |
// | /ae:claimui — opens the visual land management dashboard.               |
// ----------------------------------------------------------------------------
export const ClaimUICommand = {
    name: "claimui",
    description: "Open the land claim management UI.",
    usage: "/ae:claimui",
    permission: "essentials.claim",
    category: "General",
    parameters: [],

    async execute(_data, player) {
        await UIUtils.waitForChatClose(player, () => showClaimUI(player));
    }
}