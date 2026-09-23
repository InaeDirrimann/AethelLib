import { Kernel } from "../../core/Kernel.js"

// ----------------------------------------------------------------------------
// | object: TPAcceptCommand                                                  |
// | command definition for authorizing an incoming teleport handshake.         |
// | routes the confirmation to the TPAService for final relocation.          |
// ----------------------------------------------------------------------------
export const TPAcceptCommand = {
    // internal name.
    name: "tpaccept",
    // human-readable description.
    description: "Accept incoming TPA request",
    // syntax guide.
    usage: "/ae:tpaccept",
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
    // | entry point for handshake confirmation. simply delegates to the service.  |
    // ----------------------------------------------------------------------------
    async execute(_data, player, _args) {
        const TpaService = Kernel.get("tpaService")
        if (!TpaService) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77TPA service is currently unavailable.");
            return;
        }
        TpaService.acceptRequest(player)
    }
}
