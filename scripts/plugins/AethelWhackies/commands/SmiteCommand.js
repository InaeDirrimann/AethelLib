import { Kernel } from "../../../core/Kernel.js";
import { PlayerUtils } from "../../../utils/PlayerUtils.js";

export const SmiteCommand = {
    name: "asmite",
    aliases: ["smite"],
    description: "Strikes a player with divine lightning",
    usage: "/ae:asmite [player]",
    permission: "essentials.admin.smite",
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
            // Spawn the lightning bolt at the victim's location
            finalTarget.dimension.spawnEntity("minecraft:lightning_bolt", finalTarget.location);
            
            // Broadcast the divine wrath message to the entire server
            Kernel.world.sendMessage(`\u00A7c\u00A7l» \u00A7fThe wrath of \u00A7e${player.name}\u00A7f has been laid on \u00A7e${finalTarget.name}\u00A7f.`);

            // Play thunder and evoker "voices" to EVERYONE online
            for (const p of Kernel.world.getAllPlayers()) {
                if (p.isValid) {
                    try {
                        p.playSound("ambient.weather.thunder");
                        p.playSound("mob.evocation_illager.prepare_summon");
                    } catch {}
                }
            }
        } catch (e) {
            player.sendMessage(`\u00A7cFailed to strike player: ${e.message}`);
        }
    }
};
