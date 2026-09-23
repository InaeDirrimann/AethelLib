import { HomeStore } from "../../systems/teleport/HomeStore.js"
import { Kernel } from "../../core/Kernel.js"

// ----------------------------------------------------------------------------
// | variable: cooldowns                                                      |
// | in-memory registry of player IDs and their last execution tick.          |
// ----------------------------------------------------------------------------
const cooldowns = new Map()

// ----------------------------------------------------------------------------
// | object: GoHomeCommand                                                     |
// | command definition for traveling back to a saved spatial waypoint.        |
// ----------------------------------------------------------------------------
export const GoHomeCommand = {
    name: "home",
    description: "Teleport to one of your homes",
    usage: "/ae:home <anchor_identifier>",
    permission: "essentials.home",
    category: "TELEPORTATION",
    parameters: [
        { name: "homeName", type: "string", optional: true }
    ],

    async execute(_data, player, args) {
        const name = args[0]
        if (!name) {
            const { showHomeUI } = await import("../../ui/teleport/HomeUI.js")
            Kernel.system.run(() => showHomeUI(player))
            return
        }

        const PermissionManager = Kernel.get("permissions")
        const TeleportService = Kernel.get("teleportService")
        const rawPlayer = player.__rawEntity__ || player;

        if (!TeleportService) {
            rawPlayer.sendMessage("\u00A7c\u00A7l» \u00A77Teleport service is unavailable.");
            return
        }

        const cdValue = PermissionManager ? PermissionManager.getPermission(rawPlayer, "home.cooldown") ?? 30 : 30
        const cd = Number(cdValue) * 20
        const last = cooldowns.get(rawPlayer.id) ?? 0
        
        if (Kernel.system.currentTick - last < cd) {
            const remaining = Math.ceil((cd - (Kernel.system.currentTick - last)) / 20)
            rawPlayer.sendMessage(`\u00A7c\u00A7l» \u00A77Please wait \u00A7e${remaining}s \u00A77before using this again.`);
            return
        }

        const home = await HomeStore.getHome(rawPlayer, name)
        if (!home) {
            rawPlayer.sendMessage(`\u00A7c\u00A7l» \u00A77Home '${name}' not found.`);
            return
        }

        const waitTime = Number((PermissionManager ? PermissionManager.getPermission(rawPlayer, "teleport.wait") : 5) ?? 5)
        const targetLocation = { x: home.x + 0.5, y: home.y, z: home.z + 0.5 }

        if (waitTime > 0) {
            const success = await TeleportService.teleportWithWait(rawPlayer, targetLocation, home.dimension, waitTime);
            if (success) {
                rawPlayer.sendMessage(`\u00A7a\u00A7l» \u00A7fTeleported to home \u00A7e${name}\u00A7f.`);
                cooldowns.set(rawPlayer.id, Kernel.system.currentTick);
            }
        } else {
            const success = TeleportService.teleport(rawPlayer, targetLocation, home.dimension);
            if (success) {
                rawPlayer.sendMessage(`\u00A7a\u00A7l» \u00A7fTeleported to home \u00A7e${name}\u00A7f.`);
                cooldowns.set(rawPlayer.id, Kernel.system.currentTick);
            }
        }
    }
}
