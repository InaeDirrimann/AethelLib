import { Kernel } from "../../../core/Kernel.js"
import { showInventoryUI } from "../../../ui/admin/InvSeeUI.js"
import { showSetMoneyUI } from "./PlayerEconomyUI.js"
import { showKickUI, showBanUI, showMuteUI } from "./PlayerModerationUI.js"
import { showHomeListUI, handleTpaToggle } from "./PlayerSpatialUI.js"
import { UIUtils } from "../../../ui/UIUtils.js"

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
        .title(`\u00A7e\u00A7l${target.name} Panel`)
        .body(`\u00A7aId : \u00A7f${target.id}\n\u00A7aAdmin : \u00A7f${isAdmin ? "Yes" : "No"}\n\u00A7aGamemode : \u00A7f${gameModeStr}\n\u00A7aMoney : \u00A7f$${money.toLocaleString()}\n\u00A7aOwned Homes : \u00A7f${homes}\n\u00A7aPosition : \u00A7f${posStr}\n\u00A7aDimension : \u00A7f${dim}`)
        .button("\u00A7aSet Money")
        .button("\u00A7aTeleport")
        .button("\u00A7cDisable TPA")
        .button("\u00A7cMute")
        .button("\u00A70List Homes")
        .button("\u00A7eKick")
        .button("\u00A7cBan")
        .button("\u00A76Check Inventory")
        .button("\u00A7c<= BACK")

    const res = await UIUtils.showForm(player, form)
    if (res.canceled) return

    const refresh = () => {
        if (player.isValid && target.isValid) {
            showIndividualPlayerPanel(player, target, backCallback)
        } else {
            backCallback()
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
        case 8: await backCallback(); break
    }
}

