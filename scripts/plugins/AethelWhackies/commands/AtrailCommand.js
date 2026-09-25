import { MolangVariableMap } from "@minecraft/server";
import { PlayerUtils } from "../../../utils/PlayerUtils.js";
import { CleanupServiceInstance } from "../../../core/services/CleanupService.js";

// Map of playerId -> presetName
const activeTrails = new Map();

// Preset configurations: single particle per tick to avoid client render lag
const PRESETS = {
    edgelord: "minecraft:dragon_breath_trail",
    hero: "minecraft:totem_particle",
    dark: "minecraft:basic_smoke_particle",
    triad: "minecraft:blue_flame_particle"
};

// Register cleanup handler to prevent memory leaks when players disconnect
CleanupServiceInstance.registerCleanupHandler("atrail", (playerId) => {
    activeTrails.delete(playerId);
});

export const AtrailCommand = {
    name: "atrail",
    aliases: ["trail"],
    description: "Sets a lightweight cosmetic trail for a player",
    usage: "/ae:atrail [player] [preset/off]",
    permission: "essentials.admin.trail",
    category: "Admin",
    parameters: [
        { name: "player", type: "player", optional: true },
        { name: "preset", type: "string", optional: true }
    ],
    execute(data, player, args) {
        const { player: target, consumedArgs } = PlayerUtils.resolveFromArgs(args);
        const finalTarget = target || player;
        
        if (!finalTarget) {
            player.sendMessage("\u00A7cPlayer not found.");
            return;
        }

        const remainingArgs = args.slice(consumedArgs);
        const choice = remainingArgs.length > 0 ? remainingArgs[0].toLowerCase() : "";

        if (!choice) {
            player.sendMessage(" ");
            player.sendMessage("\u00A76\u00A7lCosmetic Trail Presets (Low-Lag Optimized):");
            player.sendMessage("\u00A7e- edgelord\u00A77: Dragon breath purple trail");
            player.sendMessage("\u00A7e- hero\u00A77: Golden totem sparkle");
            player.sendMessage("\u00A7e- dark\u00A77: Shrouded shadow smoke");
            player.sendMessage("\u00A7e- triad\u00A77: Radiant soul flame");
            player.sendMessage("\u00A7e- off\u00A77: Disable trail");
            player.sendMessage(" ");
            player.sendMessage(`\u00A77Usage: /ae:atrail [player] <preset|off>`);
            return;
        }

        if (choice === "off" || choice === "none") {
            if (activeTrails.has(finalTarget.id)) {
                activeTrails.delete(finalTarget.id);
                player.sendMessage(`\u00A7a\u00A7l» \u00A7fDisabled trail for \u00A7e${finalTarget.name}\u00A7f.`);
                if (finalTarget.id !== player.id) {
                    finalTarget.sendMessage(`\u00A7a\u00A7l» \u00A7fYour trail was disabled by \u00A7e${player.name}\u00A7f.`);
                }
            } else {
                player.sendMessage(`\u00A7cPlayer ${finalTarget.name} does not have an active trail.`);
            }
            return;
        }

        if (!PRESETS[choice]) {
            player.sendMessage(`\u00A7cUnknown preset '${choice}'. Available: edgelord, hero, dark, triad, off.`);
            return;
        }

        activeTrails.set(finalTarget.id, choice);
        player.sendMessage(`\u00A7a\u00A7l» \u00A7fActivated \u00A7e${choice}\u00A7f trail for \u00A7e${finalTarget.name}\u00A7f.`);
        if (finalTarget.id !== player.id) {
            finalTarget.sendMessage(`\u00A7a\u00A7l» \u00A7fYou were given the \u00A7e${choice}\u00A7f trail by \u00A7e${player.name}\u00A7f.`);
        }
    }
};

/**
 * Initializes the trail ticker inside the deferred plugin context.
 * Uses a single pre-allocated MolangVariableMap and 4-tick throttle to minimize GC & network packets.
 * @param {import("../../../core/plugins/PluginManager.js").PluginContext} context
 */
export function initTrailTicker(context) {
    let molangVars = null;
    try {
        molangVars = new MolangVariableMap();
        molangVars.setVector3("variable.direction", { x: 0, y: 0.5, z: 0 });
    } catch (_) {}

    context.system.runInterval(() => {
        if (activeTrails.size === 0) return;

        try {
            const players = context.world.getAllPlayers();
            for (const player of players) {
                if (!player.isValid) {
                    activeTrails.delete(player.id);
                    continue;
                }

                const preset = activeTrails.get(player.id);
                if (!preset) continue;

                const particle = PRESETS[preset];
                if (!particle) continue;

                const loc = player.location;
                // Spawn a single particle at player's feet/torso
                try {
                    player.dimension.spawnParticle(particle, {
                        x: loc.x,
                        y: loc.y + 0.3,
                        z: loc.z
                    }, molangVars || undefined);
                } catch (_) {}
            }
        } catch (_) {}
    }, 4); // 5Hz throttle: smooth enough for eyes, 80% fewer packets!
}
