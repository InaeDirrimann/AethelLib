import { Kernel } from "../../../core/Kernel.js";
import { PlayerUtils } from "../../../utils/PlayerUtils.js";

export const HimmelsspalterCommand = {
    name: "ahimmelsspalter",
    aliases: ["himmelsspalter", "godkiller", "slasher", "heavenblade"],
    description: "Gives the player the legendary Himmelsspalter (God Killer)",
    usage: "/ae:ahimmelsspalter [player]",
    permission: "essentials.admin.himmelsspalter",
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
            const item = new Kernel.ItemStack("aethel:himmelsspalter", 1);
            item.setLore([
                "\u00A7c\u00A7lHimmelsspalter",
                "\u00A77A legendary blade forged in spite.",
                "\u00A77Gods Slain: \u00A7c0",
                "\u00A78[\u00A78\u00A7l||||||||||\u00A7r\u00A78] \u00A77(+0 ATK)",
                "\u00A74Bypasses and slices through God Mode."
            ]);

            const inventory = finalTarget.getComponent("minecraft:inventory");
            const container = inventory?.container;
            
            if (container) {
                container.addItem(item);
                player.sendMessage(`\u00A7c\u00A7l» \u00A7fGave \u00A7e${finalTarget.name}\u00A7f the legendary \u00A7c\u00A7lHimmelsspalter\u00A7f.`);
                if (finalTarget.id !== player.id) {
                    finalTarget.sendMessage(`\u00A7c\u00A7l» \u00A7fYou have received the legendary \u00A7c\u00A7lHimmelsspalter\u00A7f from \u00A7e${player.name}\u00A7f.`);
                }
            } else {
                player.sendMessage("\u00A7cFailed to give item: Inventory container not accessible.");
            }
        } catch (e) {
            player.sendMessage(`\u00A7cFailed to give item: ${e.message}`);
        }
    }
};
