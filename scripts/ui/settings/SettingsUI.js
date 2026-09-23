import { Kernel } from "../../core/Kernel.js"
import { UIUtils } from "../UIUtils.js"

/**
 * Show player settings UI
 * @param {import("@minecraft/server").Player} player
 */
export async function showSettingsUI(player) {
    const PlayerStore = Kernel.get("playerStore")

    // Load current settings
    const tpaEnabled = PlayerStore?.get ? PlayerStore.get(player, "settings:tpa") !== false : true
    const scoreboardVisible = PlayerStore?.get ? PlayerStore.get(player, "settings:scoreboard") !== false : true

    const form = new Kernel.ModalFormData()
        .title("\u00A76\u00A7lPlayer Settings")
        .toggle("\u00A7eTPA Requests", tpaEnabled)
        .toggle("\u00A76Scoreboard Visible", scoreboardVisible)

    const response = await UIUtils.showForm(player, form)
    if (response.canceled) return

    const newTpa = Boolean(response.formValues[0])
    const newScoreboard = Boolean(response.formValues[1])

    // Save settings
    if (PlayerStore?.set) {
        PlayerStore.set(player, "settings:tpa", newTpa)
        PlayerStore.set(player, "settings:scoreboard", newScoreboard)
    }

    // Apply scoreboard visibility
    if (!newScoreboard) {
        try {
            const rawPlayer = player.__rawEntity__ || player;
            const objective = Kernel.world.scoreboard.getObjective("money")
            if (objective) {
                // @ts-ignore
                objective.setScore(rawPlayer, 0)
            }
        } catch { /* ignore */ }
    }

    player.sendMessage("\u00A7aSettings saved!")
    player.sendMessage(`\u00A77TPA: ${newTpa ? "\u00A7aEnabled" : "\u00A7cDisabled"} \u00A77| Scoreboard: ${newScoreboard ? "\u00A7aVisible" : "\u00A7cHidden"}`)
}

