/**
 * Claim UI — View and manage land claims
 */

import { Kernel } from "../../core/Kernel.js"
import { UIUtils } from "../UIUtils.js"
// import { PERMISSIONS } from "../../systems/protection/ClaimService.js"

/**
 * Show claim management UI
 * @param {import("@minecraft/server").Player} player
 */
export async function showClaimUI(player) {
    const ClaimStore = Kernel.get("claimStore")
    const claims = ClaimStore ? ClaimStore.getPlayerClaims(player.id) : []

    const form = new Kernel.ActionFormData()
        .title("\u00A7b\u00A7lYour Claims")
        .body(claims.length > 0
            ? `\u00A77You have \u00A7e${claims.length}\u00A77 claim(s)\n\u00A77Stand in a chunk and use \u00A7e!claim\u00A77 to claim it.`
            : "\u00A77You have no claims.\n\u00A77Stand in a chunk and use \u00A7e!claim\u00A77 to claim it.")

    // Back button
    form.button("\u00A7cBACK", "textures/ui/refresh")

    // Claim buttons
    for (const claim of claims) {
        form.button(`\u00A7b${claim.chunkKey}\n\u00A77Trusted: ${Object.keys(claim.data?.trusted || {}).length}`)
    }

    const response = await UIUtils.showForm(player, form)
    if (response.canceled) return

    if (response.selection === 0) {
        const { showMainGUI } = await import("../MainGUI.js")
        await showMainGUI(player)
        return
    }

    // Show claim info
    const selectedClaim = claims[response.selection - 1]
    if (selectedClaim) {
        player.sendMessage(`\u00A7bClaim: \u00A7f${selectedClaim.chunkKey}`)
        player.sendMessage(`\u00A77Trusted players: \u00A7f${Object.keys(selectedClaim.data?.trusted || {}).length}`)
    }
}
