import { PlayerUtils } from "../../utils/PlayerUtils.js";

export const HealCommand = {
    name: "aheal",
    aliases: ["heal"],
    description: "Heals a player to full health",
    usage: "/ae:aheal [player]",
    permission: "essentials.admin.heal",
    category: "Admin",
    parameters: [
        { name: "player", type: "player", optional: true }
    ],
    execute(data, player, args) {
        const { player: target } = PlayerUtils.resolveFromArgs(args);
        const finalTarget = target || player;
        
        if (!finalTarget) {
            player.sendMessage("\u00A7cPlayer not found.");
            return;
        }

        let healed = false;
        try {
            const health = finalTarget.getComponent("minecraft:health");
            if (health) {
                if (typeof health.resetToMaxValue === "function") {
                    health.resetToMaxValue();
                } else if (typeof health.setCurrentValue === "function") {
                    health.setCurrentValue(health.effectiveMax ?? 20);
                }
                healed = true;
            }
            if (typeof finalTarget.extinguishFire === "function") {
                finalTarget.extinguishFire(true);
            }
        } catch {}

        if (!healed) {
            try {
                finalTarget.runCommand("effect @s instant_health 1 255 true");
                healed = true;
            } catch {}
        }

        player.sendMessage(`\u00A7a\u00A7l» \u00A7fHealed \u00A7e${finalTarget.name}\u00A7f to full health.`);
        if (finalTarget.id !== player.id) {
            finalTarget.sendMessage(`\u00A7a\u00A7l» \u00A7fYou have been healed by \u00A7e${player.name}\u00A7f.`);
        }
    }
};
