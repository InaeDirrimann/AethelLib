import { Kernel } from "../../core/Kernel.js"

// ----------------------------------------------------------------------------
// | object: TPAdenyCommand                                                   |
// | command definition for rejecting an incoming teleport handshake.          |
// | routes the cancellation to the TPAService to purge the active request.    |
// ----------------------------------------------------------------------------
export const TPAdenyCommand = {
    // internal name.
    name: "tpadeny",
    // human-readable description.
    description: "Deny incoming TPA request",
    // syntax guide.
    usage: "/ae:tpadeny",
    // required permission node.
    permission: "essentials.tpa",
    // command category.
    category: "teleport",
    // native parameter definitions (optional target for multi-request resolution).
    parameters: [
        { name: "target", type: "player", optional: true }
    ],

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | entry point for handshake rejection. delegates to the service.            |
    // ----------------------------------------------------------------------------
    async execute(_data, player, _args) {
        const TpaService = Kernel.get("tpaService")
        if (!TpaService) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77TPA service is currently unavailable.");
            return;
        }
        TpaService.denyRequest(player)
    }
}
