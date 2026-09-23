import { Kernel } from "../../core/Kernel.js"

// ----------------------------------------------------------------------------
// | object: TPACancelCommand                                                 |
// | command definition for revoking an outgoing teleport handshake.           |
// | allows the requester to pull back their request before it is accepted.    |
// ----------------------------------------------------------------------------
export const TPACancelCommand = {
    // internal name.
    name: "tpacancel",
    // human-readable description.
    description: "Cancel outgoing TPA request",
    // syntax guide.
    usage: "/ae:tpacancel",
    // required permission level.
    permission: "essentials.tpa",
    // command category.
    category: "teleport",
    // native parameter definitions (optional target for specific cancellation).
    parameters: [
        { name: "target", type: "player", optional: true }
    ],

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | revocation pipeline. identifies the active outgoing request and purges it.|
    // ----------------------------------------------------------------------------
    async execute(_data, player, _args) {
        // resolve the handshake registry from the kernel.
        const TpaHandshake = Kernel.get("tpaHandshake")
        if (!TpaHandshake) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77TPA service is currently unavailable.")
            return
        }
        // find the most recent request sent by this player.
        const request = TpaHandshake.getLatestRequestFrom(player.id)
        
        // if no active requests exist.
        if (!request) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77You have no outgoing TPA requests.")
            return
        }

        // step 1: purge the request.
        TpaHandshake.removeRequest(request.id)
        // confirm to the sender.
        player.sendMessage(`\u00A7a\u00A7l» \u00A7fTPA request to \u00A7e${request.targetName} \u00A7fcancelled.`)
        
        // step 2: target notification.
        // find the target player if they are still online.
        const target = [...Kernel.world.getAllPlayers()].find(p => p.id === request.targetId)
        if (target) {
            target.sendMessage(`\u00A7c\u00A7l» \u00A7e${player.name} \u00A77cancelled their TPA request.`)
        }
    }
}
