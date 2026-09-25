import { PlayerUtils } from "../../../utils/PlayerUtils.js";

export const YeetCommand = {
    name: "ayeet",
    aliases: ["yeet"],
    description: "Launches a player into the stratosphere",
    usage: "/ae:ayeet [player] [force]",
    permission: "essentials.admin.yeet",
    category: "Admin",
    parameters: [
        { name: "player", type: "player", optional: true },
        { name: "force", type: "int", optional: true }
    ],
    execute(data, player, args) {
        const { player: target, consumedArgs } = PlayerUtils.resolveFromArgs(args);
        const finalTarget = target || player;
        
        if (!finalTarget) {
            player.sendMessage("\u00A7cPlayer not found.");
            return;
        }

        const remainingArgs = args.slice(consumedArgs);
        const force = remainingArgs.length > 0 ? parseFloat(remainingArgs[0]) : 4;
        const finalForce = isNaN(force) ? 4 : force;

        try {
            finalTarget.applyImpulse({ x: 0, y: finalForce, z: 0 });
            player.sendMessage(`\u00A7a\u00A7l» \u00A7fYeeeting \u00A7e${finalTarget.name}\u00A7f with a force of \u00A7e${finalForce}\u00A7f 🚀.`);
            if (finalTarget.id !== player.id) {
                finalTarget.sendMessage(`\u00A7c\u00A7l» \u00A7fYou were yeeeted into the stratosphere by \u00A7e${player.name}\u00A7f.`);
            }
        } catch (e) {
            player.sendMessage(`\u00A7cFailed to yeet player: ${e.message}`);
        }
    }
};
