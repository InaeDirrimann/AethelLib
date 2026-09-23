import { WarpStore } from "../../systems/teleport/WarpStore.js"
import { Kernel } from "../../core/Kernel.js"
import { showWarpUI } from "../../ui/teleport/WarpUI.js"
import { showMainGUI } from "../../ui/MainGUI.js"

// ----------------------------------------------------------------------------
// | object: WarpCommand                                                      |
// | command definition for traveling to public server anchors.                |
// | interfaces with the WarpStore to resolve global coordinate data.          |
// ----------------------------------------------------------------------------
export const WarpCommand = {
    // internal name.
    name: "warp",
    // human-readable description.
    description: "Teleport to a global warp point",
    // syntax guide.
    usage: "/ae:warp <waypoint_identifier>",
    // required permission node.
    permission: "essentials.warp",
    // command category.
    category: "TELEPORTATION",
    // native parameter definitions.
    parameters: [
        { name: "warpName", type: "string", optional: true }
    ],

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | the spatial migration vector. resolves the warp metadata and triggers     |
    // | the teleport service.                                                    |
    // ----------------------------------------------------------------------------
    async execute(_data, player, args) {
        // syntax check.
        let name = args[0]
        if (name !== undefined && name !== null) {
            name = String(name)
        }
        if (!name) {
            Kernel.system.run(() => showWarpUI(player, showMainGUI))
            return
        }

        // step 1: resolve the warp record from global storage.
        const warp = await WarpStore.getWarp(name)
        // resolve the teleport service from the kernel.
        const teleportService = Kernel.get("teleportService")
        if (!teleportService) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Teleport service is unavailable.");
            return
        }

        // check if the record exists.
        if (!warp) {
            player.sendMessage(`\u00A7c\u00A7l» \u00A77Warp point '${name}' not found.`);
            return
        }

        // step 2: migration execution.
        // add 0.5 to x/z for block centering.
        teleportService.teleport(player, { x: warp.x + 0.5, y: warp.y, z: warp.z + 0.5 }, warp.dimension);
        // feedback to the player.
        player.sendMessage(`\u00A7a\u00A7l» \u00A7fTeleported to warp \u00A7e${name}\u00A7f.`);
    }
}
