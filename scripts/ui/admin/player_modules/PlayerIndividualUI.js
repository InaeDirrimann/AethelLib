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

import { Kernel } from "../../../core/Kernel.js"
import { showInventoryUI } from "../InvSeeUI.js"
import { showSetMoneyUI } from "./PlayerEconomyUI.js"
import { showKickUI, showBanUI, showMuteUI } from "./PlayerModerationUI.js"
import { showHomeListUI, handleTpaToggle } from "./PlayerSpatialUI.js"
import { UIUtils } from "../../UIUtils.js"
import { Lang } from "../../Lang.js"

export async function showIndividualPlayerPanel(player, target, backCallback) {
    if (!target || !target.isValid) {
        player.sendMessage("\u00A7cPlayer is no longer online.");
        return backCallback();
    }
    
    const PM = Kernel.get("permissions")
    const economy = Kernel.get("economy")
    const homesStore = Kernel.get("homeStore")
    const PlayerStore = Kernel.get("playerStore")
    
    const money = economy ? economy.getBalance(target) : 0
    const homesObj = homesStore ? await homesStore.getHomes(target) : {}
    const homes = Object.keys(homesObj).length
    const isAdmin = PM ? PM.hasPermission(target, "essentials.admin") : target.hasTag("admin")
    
    const pos = target.location
    const posStr = pos ? `${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}` : "Unknown"
    const dim = target.dimension?.id ? target.dimension.id.split(":").pop().replace(/^\w/, c => c.toUpperCase()) : "Unknown"

    let gameModeStr = "Unknown";
    try {
        gameModeStr = target.getGameMode();
    } catch {}

    const form = new Kernel.ActionFormData()
        .title(Lang.GRID_M + `\u00A7e\u00A7l${target.name} Panel`)
        .body(`\u00A7aId : \u00A7f${target.id}\n\u00A7aAdmin : \u00A7f${isAdmin ? "Yes" : "No"}\n\u00A7aGamemode : \u00A7f${gameModeStr}\n\u00A7aMoney : \u00A7f$${money.toLocaleString()}\n\u00A7aOwned Homes : \u00A7f${homes}\n\u00A7aPosition : \u00A7f${posStr}\n\u00A7aDimension : \u00A7f${dim}`)
        .button("\u00A7aSet Money")
        .button("\u00A7aTeleport")
        .button("\u00A7cDisable TPA")
        .button("\u00A7cMute")
        .button("\u00A70List Homes")
        .button("\u00A7eKick")
        .button("\u00A7cBan")
        .button("\u00A76Check Inventory")
        .button("\u00A7bCheck Claims")
        .button("\u00A7c<= BACK")

    const res = await UIUtils.showForm(player, form)
    if (res.canceled) return

    const refresh = async () => {
        if (player.isValid && target.isValid) {
            await showIndividualPlayerPanel(player, target, backCallback)
        } else {
            await backCallback()
        }
    }

    switch (res.selection) {
        case 0: await showSetMoneyUI(player, target, refresh); break
        case 1: 
            if (target.isValid) {
                player.teleport(target.location, { dimension: target.dimension })
                player.sendMessage(`\u00A7a\u00A7l» \u00A7fTeleported to \u00A7e${target.name}\u00A7f.`)
            }
            await refresh(); break
        case 2: handleTpaToggle(player, target, PlayerStore); await refresh(); break
        case 3: await showMuteUI(player, target, refresh); break
        case 4: await showHomeListUI(player, target, refresh); break
        case 5: await showKickUI(player, target, refresh); break
        case 6: await showBanUI(player, target, refresh); break
        case 7: await showInventoryUI(player, target); break
        case 8: await showAdminClaimUI(player, target, refresh); break
        case 9: await backCallback(); break
    }
}

async function showAdminClaimUI(player, target, refreshCallback) {
    if (!target || !target.isValid) return refreshCallback();

    const ClaimStore = Kernel.get("claimStore");
    if (!ClaimStore) {
        player.sendMessage("§cClaim system is currently disabled.");
        return refreshCallback();
    }

    const claims = ClaimStore.getPlayerClaims(target.id);

    const form = new Kernel.ActionFormData()
        .title(Lang.GRID_M + `§b§l${target.name}'s Claims`)
        .body(claims.length > 0 
            ? `§7Found §e${claims.length}§7 active claims for this player.` 
            : "§cThis player has no active land claims.");

    claims.forEach(claim => {
        form.button(`§bChunk: §f${claim.chunkKey}\n§7Trusted: ${Object.keys(claim.data?.trusted || {}).length}`, "textures/items/wooden_axe");
    });

    form.button("§c<= BACK", "textures/ui/refresh");

    const res = await UIUtils.showForm(player, form);
    if (res.canceled) return refreshCallback();

    if (res.selection === claims.length) {
        return refreshCallback();
    }

    // Teleport admin to claim
    const selectedClaim = claims[res.selection];
    if (selectedClaim) {
        // ChunkKey can be "dim_x_z" or "x,z" or "x_z"
        const delimiter = selectedClaim.chunkKey.includes(",") ? "," : "_";
        const parts = selectedClaim.chunkKey.split(delimiter);
        if (parts.length === 3) {
            const dimId = parts[0];
            const cx = parseInt(parts[1]);
            const cz = parseInt(parts[2]);
            const dim = Kernel.world.getDimension(dimId === "0" ? "overworld" : dimId === "1" ? "nether" : "the_end");
            
            player.teleport({ x: (cx * 16) + 8, y: 100, z: (cz * 16) + 8 }, { dimension: dim });
            player.sendMessage(`§a§l» §fTeleported to chunk §e${selectedClaim.chunkKey}§f (Safe Y level).`);
        } else if (parts.length === 2) {
            const cx = parseInt(parts[0]);
            const cz = parseInt(parts[1]);
            player.teleport({ x: (cx * 16) + 8, y: 100, z: (cz * 16) + 8 });
            player.sendMessage(`§a§l» §fTeleported to chunk §e${selectedClaim.chunkKey}§f (Safe Y level).`);
        }
    }
    await refreshCallback();
}
