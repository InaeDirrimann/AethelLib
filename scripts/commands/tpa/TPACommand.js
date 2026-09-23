import { Kernel } from "../../core/Kernel.js"
import { PlayerUtils } from "../../utils/PlayerUtils.js"

// ----------------------------------------------------------------------------
// | object: TPACommand                                                       |
// | command definition for requesting permission to teleport TO another player.|
// | interfaces with the TPAService to manage the handshake lifecycle.         |
// ----------------------------------------------------------------------------
export const TPACommand = {
    // internal name.
    name: "tpa",
    // human-readable description.
    description: "Request to teleport to another player",
    // syntax guide.
    usage: "/ae:tpa <player_name>",
    // required permission node.
    permission: "essentials.tpa",
    // command category.
    category: "teleport",
    // native parameter definitions.
    parameters: [
        { name: "player", type: Kernel.CustomCommandParamType.PlayerSelector, optional: false }
    ],

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | the handshake initialization vector. resolves the target and triggers     |
    // | the request logic in the TPA service.                                   |
    // ----------------------------------------------------------------------------
    async execute(_data, player, args) {
        // basic syntax check.
        if (args.length === 0) {
            player.sendMessage("\u00A7c\u00A7l\u00BB \u00A77Usage: /ae:tpa <player_name>")
            return
        }

        // FIX: Resolve rich target player objects from autocomplete OR strings
        const targetPlayer = typeof args[0] === 'object' && args[0] !== null
            ? args[0]
            : PlayerUtils.findPlayer(args.join(" "))

        // check if target is online.
        if (!targetPlayer) {
            player.sendMessage(`\u00A7c\u00A7l\u00BB \u00A77Player not found or offline.`)
            return
        }

        // check for self-request block.
        if (targetPlayer.id === player.id) {
            player.sendMessage("\u00A7c\u00A7l\u00BB \u00A77You cannot send a TPA request to yourself.")
            return
        }

        // step 1: initialize handshake.
        // resolve the service from the kernel and send a "to" type request.
        const TpaService = Kernel.get("tpaService")
        if (!TpaService) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77TPA service is unavailable.")
            return
        }
        await TpaService.sendRequest(player, targetPlayer, "tpa")
    }
}
