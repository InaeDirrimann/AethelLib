import { Kernel } from "../../core/Kernel.js";
import { showInventoryUI } from "../../ui/admin/InvSeeUI.js"
import { PlayerUtils } from "../../utils/PlayerUtils.js"

// ----------------------------------------------------------------------------
// | object: InvSeeCommand                                                    |
// | command definition for inspecting another player's inventory contents.    |
// | routes the request to a dedicated UI handler.                            |
// ----------------------------------------------------------------------------
export const InvSeeCommand = {
    // internal name.
    name: "invsee",
    // human-readable description.
    description: "View a player's inventory",
    // syntax guide.
    usage: "/ae:invsee <player_identifier>",
    // required permission level.
    permission: "essentials.admin.invsee",
    // organization category.
    category: "Admin",
    
    // native parameter definitions.
    parameters: [
        { name: "player", type: "player", optional: true }
    ],

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | resolves the target player and launches the inspection UI.               |
    // ----------------------------------------------------------------------------
    execute(_data, player, args) {
        // syntax check.
        if (args.length === 0) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:invsee <player_name>");
            player.sendMessage("\u00A7e\u00A7l» \u00A7fTip: \u00A77Type a player name to view their inventory.");
            return
        }

        // resolve the target player object.
        const targetName = args.join(" ")
        const target = PlayerUtils.findPlayer(targetName)
        
        // check if they are online.
        if (!target) {
            player.sendMessage(`\u00A7c\u00A7l» \u00A77Player '${targetName}' not found.`);
            return
        }

        // launch the UI vector.
        // we use Kernel.system.run to avoid triggering UI constraints in the same tick as the command.
        Kernel.system.run(() => {
            showInventoryUI(player, target)
        })
    }
}
