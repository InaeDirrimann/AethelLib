import { PlayerUtils } from "../../utils/PlayerUtils.js";

export const FeedCommand = {
    name: "afeed",
    aliases: ["feed"],
    description: "Satiates a player's hunger",
    usage: "/ae:afeed [player]",
    permission: "essentials.admin.feed",
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

        let fed = false;
        try {
            const hunger = finalTarget.getComponent("minecraft:player.hunger") || finalTarget.getComponent("minecraft:hunger");
            if (hunger && typeof hunger.setCurrentValue === "function") {
                hunger.setCurrentValue(hunger.effectiveMax ?? 20);
                fed = true;
            }
            const saturation = finalTarget.getComponent("minecraft:player.saturation");
            if (saturation && typeof saturation.setCurrentValue === "function") {
                saturation.setCurrentValue(saturation.effectiveMax ?? 20);
            }
        } catch {}

        if (!fed) {
            try {
                finalTarget.runCommand("effect @s saturation 1 255 true");
                fed = true;
            } catch {}
        }

        player.sendMessage(`\u00A7a\u00A7l» \u00A7fSatiated \u00A7e${finalTarget.name}\u00A7f.`);
        if (finalTarget.id !== player.id) {
            finalTarget.sendMessage(`\u00A7a\u00A7l» \u00A7fYour hunger was satiated by \u00A7e${player.name}\u00A7f.`);
        }
    }
};
