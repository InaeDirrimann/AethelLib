import { PlayerUtils } from "../../utils/PlayerUtils.js";

export const ClearInventoryCommand = {
    name: "aclear",
    aliases: ["clearinventory"],
    description: "Clears a player's inventory",
    usage: "/ae:aclear [player]",
    permission: "essentials.admin.clear",
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

        let cleared = false;
        try {
            const inv = finalTarget.getComponent("minecraft:inventory")?.container;
            if (inv && typeof inv.clearAll === "function") {
                inv.clearAll();
                cleared = true;
            }
            const equip = finalTarget.getComponent("minecraft:equippable");
            if (equip) {
                const slots = ["Head", "Chest", "Legs", "Feet", "Offhand", "Mainhand"];
                for (const slot of slots) {
                    try { equip.setEquipment(slot, undefined); } catch {}
                }
            }
        } catch {}

        if (!cleared) {
            try {
                finalTarget.runCommand("clear @s");
                cleared = true;
            } catch {}
        }

        player.sendMessage(`\u00A7a\u00A7l» \u00A7fCleared inventory of \u00A7e${finalTarget.name}\u00A7f.`);
        if (finalTarget.id !== player.id) {
            finalTarget.sendMessage(`\u00A7a\u00A7l» \u00A7fYour inventory was cleared by \u00A7e${player.name}\u00A7f.`);
        }
    }
};
