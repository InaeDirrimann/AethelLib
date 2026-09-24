import { Kernel } from "../../core/Kernel.js"
import { UIUtils } from "../../ui/UIUtils.js"
import { CleanupServiceInstance } from "../../core/services/CleanupService.js"

/*
 * TPA Service
 * ----------------------------------------------------------------------------
 * Handles peer-to-peer teleport requests and handshakes.
 */

export const TpaService = {
    /* 
     * Send TPA Request
     */
    async sendRequest(sender, target, type) {
        const TPAStore = Kernel.get("tpaStore")
        const TpaHandshake = Kernel.get("tpaHandshake")

        if (!TPAStore.isEnabled(target.id)) {
            sender.sendMessage("\u00A7c\u00A7l» \u00A77That player has TPA disabled.");
            return false
        }

        const blocked = TPAStore.getBlocked(target.id)
        if (blocked.includes(sender.id)) {
            sender.sendMessage("\u00A7c\u00A7l» \u00A77You are blocked by that player.");
            return false
        }

        const requestId = TpaHandshake.createRequest(
            sender.id,
            sender.name,
            target.id,
            target.name,
            type
        )

        if (requestId) {
            const isHere = type === "tpahere";
            const senderMsg = isHere 
                ? `\u00A7a\u00A7l» \u00A7fTPAHere request sent to \u00A7e${target.name}\u00A7f.`
                : `\u00A7a\u00A7l» \u00A7fTPA request sent to \u00A7e${target.name}\u00A7f.`;
            const targetMsg = isHere
                ? `\u00A76\u00A7l» \u00A7e${sender.name} \u00A77wants you to teleport to them!`
                : `\u00A76\u00A7l» \u00A7e${sender.name} \u00A77wants to teleport to you!`;

            sender.sendMessage(senderMsg);
            target.sendMessage(targetMsg);
            target.sendMessage(`\u00A77Type \u00A7f/ael:tpaccept \u00A77to accept or \u00A7f/ael:tpadeny \u00A77to deny.`);

            if (TPAStore.getUIToggle(target.id)) {
                Kernel.system.run(async () => {
                    try {
                        const { MessageFormData } = Kernel;
                        const bodyMsg = isHere
                            ? `\u00A7e${sender.name} \u00A77wants you to teleport to them.`
                            : `\u00A7e${sender.name} \u00A77wants to teleport to you.`;
                        const form = new MessageFormData()
                            .title("\u00A76\u00A7lTeleport Request")
                            .body(bodyMsg)
                            .button1("\u00A7aAccept")
                            .button2("\u00A7cDeny");

                        const res = await UIUtils.showForm(target, form);
                        if (!res.canceled && res.selection === 1) {
                            this.acceptRequest(target);
                        } else if (!res.canceled && res.selection === 0) {
                            this.denyRequest(target);
                        }
                    } catch (error) {
                        console.error(`[TpaService] UI_THREAD_COLLAPSE: ${error}`);
                    }
                });
            }
        }
        return !!requestId
    },

    /* 
     * Accept TPA Request
     */
    acceptRequest(player) {
        const TpaHandshake = Kernel.get("tpaHandshake")
        const request = TpaHandshake.getLatestRequestFor(player.id)

        if (!request) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77You have no pending TPA requests.");
            return false
        }

        const sender = Kernel.world.getAllPlayers().find(p => p.id === request.senderId)
        if (!sender) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77The player is now offline.");
            TpaHandshake.removeRequest(request.id)
            return false
        }

        player.sendMessage(`\u00A7a\u00A7l» \u00A7fTeleporting \u00A7e${request.senderName} \u00A7fin 5 seconds...`);
        sender.sendMessage(`\u00A7a\u00A7l» \u00A7e${player.name} \u00A7faccepted! Teleporting in 5 seconds...`);

        const teleportService = Kernel.get("teleportService")
        const waitTime = 5 // Standard stabilization window

        if (request.type === "tpa") {
            teleportService.teleportWithWait(sender, player.location, player.dimension?.id || "minecraft:overworld", waitTime)
        } else {
            teleportService.teleportWithWait(player, sender.location, sender.dimension?.id || "minecraft:overworld", waitTime)
        }

        TpaHandshake.removeRequest(request.id)
        return true
    },

    /* 
     * Deny TPA Request
     */
    denyRequest(player) {
        const TpaHandshake = Kernel.get("tpaHandshake")
        const request = TpaHandshake.getLatestRequestFor(player.id)

        if (!request) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77You have no pending requests.");
            return false
        }

        const sender = Kernel.world.getAllPlayers().find(p => p.id === request.senderId)
        if (sender) sender.sendMessage(`\u00A7c\u00A7l» \u00A7e${player.name} \u00A77denied your TPA request.`);

        player.sendMessage("\u00A7a\u00A7l» \u00A7fRequest denied.");

        TpaHandshake.removeRequest(request.id)
        return true
    },

    /* 
     * Initialize TPA Service
     */
    init() {
        Kernel.system.runInterval(() => {
            const TpaHandshake = Kernel.get("tpaHandshake")
            if (TpaHandshake) TpaHandshake.cleanup()
        }, 600)

        CleanupServiceInstance.registerCleanupHandler("tpa", (playerId) => {
            const TpaHandshake = Kernel.get("tpaHandshake")
            if (TpaHandshake && typeof TpaHandshake.handlePlayerLeave === "function") {
                TpaHandshake.handlePlayerLeave(playerId)
            }
        })
        
        console.log("[TpaService] TPA Service online.");
    }
}
