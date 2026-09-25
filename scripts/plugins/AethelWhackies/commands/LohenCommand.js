import { Kernel } from "../../../core/Kernel.js";
import { PlayerUtils } from "../../../utils/PlayerUtils.js";

export const LohenCommand = {
    name: "alohen",
    aliases: ["lohen", "lohenklinge", "flammenklinge", "flameblade"],
    description: "Gives the player the legendary Lohenklinge flame sword",
    usage: "/ae:alohen [player]",
    permission: "essentials.admin.lohen",
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

        try {
            const item = new Kernel.ItemStack("aethel:lohenklinge", 1);
            item.setLore([
                "\u00A76Lohenklinge",
                "\u00A77A legendary blade forged in fire.",
                "\u00A77Fire Beasts Slain: \u00A7e0",
                "\u00A78[\u00A78\u00A7l||||||||||\u00A7r\u00A78] \u00A77Level I",
                "\u00A7cSets victims ablaze on contact."
            ]);

            const inventory = finalTarget.getComponent("minecraft:inventory");
            const container = inventory?.container;
            
            if (container) {
                container.addItem(item);
                player.sendMessage(`\u00A76\u00A7l» \u00A7fGave \u00A7e${finalTarget.name}\u00A7f the legendary \u00A76\u00A7lLohenklinge\u00A7f.`);
                if (finalTarget.id !== player.id) {
                    finalTarget.sendMessage(`\u00A76\u00A7l» \u00A7fYou have received the legendary \u00A76\u00A7lLohenklinge\u00A7f from \u00A7e${player.name}\u00A7f.`);
                }
            } else {
                player.sendMessage("\u00A7cFailed to give item: Inventory container not accessible.");
            }
        } catch (e) {
            player.sendMessage(`\u00A7cFailed to give item: ${e.message}`);
        }
    }
};
