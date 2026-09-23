import { Kernel } from "../../core/Kernel.js";
import { PlayerUtils } from "../../utils/PlayerUtils.js";

// ----------------------------------------------------------------------------
// | object: GamemodeCommand                                                  |
// | alters a player's reality (survival/creative).                          |
// ----------------------------------------------------------------------------
export const GamemodeCommand = {
    name: "gamemode",
    aliases: ["gm"],
    description: "Change a player's game mode",
    usage: "/ae:gamemode [player] <mode> or /ae:gamemode <mode>",
    permission: "essentials.gamemode",
    category: "Admin",
    
    // NATIVE SCHEMA DEFINITION: flexible string bindings
    parameters: [
        { name: "arg1", type: Kernel.CustomCommandParamType.String, optional: false },
        { name: "arg2", type: Kernel.CustomCommandParamType.String, optional: true }
    ],

    execute(_data, player, args) {
        if (!args || args.length === 0) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:gamemode [player] <mode> or /ae:gamemode <mode>");
            player.sendMessage("\u00A78- Modes: survival (s, 0), creative (c, 1), adventure (a, 2), spectator (sp, 3)");
            return;
        }

        let target = null;
        let modeToken = null;

        const normalizeMode = (m) => {
            if (!m) return null;
            const str = String(m).toLowerCase();
            if (["survival", "s", "0"].includes(str)) return "survival";
            if (["creative", "c", "1"].includes(str)) return "creative";
            if (["adventure", "a", "2"].includes(str)) return "adventure";
            if (["spectator", "sp", "3"].includes(str)) return "spectator";
            return null;
        };

        if (args.length === 1) {
            modeToken = normalizeMode(args[0]);
            target = player;
        } else {
            const m1 = normalizeMode(args[0]);
            const m2 = normalizeMode(args[1]);

            if (m1 && !m2) {
                modeToken = m1;
                target = typeof args[1] === "object" ? args[1] : PlayerUtils.findPlayer(args[1]);
            } else if (m2 && !m1) {
                modeToken = m2;
                target = typeof args[0] === "object" ? args[0] : PlayerUtils.findPlayer(args[0]);
            } else if (m1 && m2) {
                modeToken = m2;
                target = typeof args[0] === "object" ? args[0] : PlayerUtils.findPlayer(args[0]);
            } else {
                target = typeof args[0] === "object" ? args[0] : PlayerUtils.findPlayer(args[0]);
                modeToken = normalizeMode(args[1]);
            }
        }

        if (!target) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Player not found.");
            return;
        }

        if (!modeToken) {
            player.sendMessage(`\u00A7c\u00A7l» \u00A77Invalid mode. Use: survival (s, 0), creative (c, 1), adventure (a, 2), spectator (sp, 3)`);
            return;
        }

        const PM = Kernel.get("permissions");
        if (PM) {
            const shortMap = {
                "survival": "admin.gm.s",
                "creative": "admin.gm.c",
                "adventure": "admin.gm.a",
                "spectator": "admin.gm.sp"
            };
            const permKey = shortMap[modeToken];
            if (!PM.hasPermission(player, permKey) && !PM.hasPermission(player, "essentials.gamemode")) {
                player.sendMessage(`\u00A7c\u00A7l\u00BB \u00A77You do not have permission to switch to ${modeToken} mode.`);
                return;
            }
        }

        // execute outside the current event tick.
        Kernel.system.run(() => {
            try {
                // map the string tokens to the native engine Kernel.GameMode enum.
                const modeMap = {
                    "survival": Kernel.GameMode?.Survival ?? "survival",
                    "creative": Kernel.GameMode?.Creative ?? "creative",
                    "adventure": Kernel.GameMode?.Adventure ?? "adventure",
                    "spectator": Kernel.GameMode?.Spectator ?? "spectator"
                };
                
                const rawTarget = target.__rawEntity__ || target;
                if (typeof rawTarget.setGameMode === "function") {
                    rawTarget.setGameMode(modeMap[modeToken] || "survival");
                } else if (typeof rawTarget.runCommand === "function") {
                    rawTarget.runCommand(`gamemode ${modeToken} @s`);
                }
                
                if (target.id !== player.id) {
                    target.sendMessage(`\u00A7a\u00A7l» \u00A7fYour game mode was set to \u00A7e${modeToken}\u00A7f by \u00A7e${player.name}\u00A7f.`);
                }
                player.sendMessage(`\u00A7a\u00A7l» \u00A7fSet \u00A7e${target.name}\u00A7f's game mode to \u00A7e${modeToken}\u00A7f.`);
            } catch (error) {
                player.sendMessage(`\u00A7c\u00A7l\u00BB \u00A77Failed to change game mode for '${target.name}'.`);
            }
        })
    }
}

function isValidGamemode(mode) {
    const validModes = ["survival", "creative", "adventure", "spectator"]
    return validModes.includes(mode)
}
