import { Kernel } from "../../core/Kernel.js";
import { HomeStore } from "../../systems/teleport/HomeStore.js"
import { RankSystem } from "../../systems/social/ranks/RankSystem.js"
import { Configuration } from "../../Configuration.js"

// Validates home name syntax and length constraints
function validateHomeName(player, name) {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Home name can only contain alphanumeric characters.");
        return false;
    }
    if (name.length < 1 || name.length > 16) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Home name must be between 1-16 characters.");
        return false;
    }
    return true;
}

// Enforces rank and configuration-based home quotas
async function checkQuota(player, name) {
    const hasExisting = await HomeStore.hasHome(player, name);
    if (hasExisting) return true;

    const homeCount = await HomeStore.getHomeCount(player);
    const permLimit = RankSystem.getPermission(player, "home.limit");
    const homeLimit = (typeof permLimit === "number")
        ? (permLimit < 0 ? Infinity : permLimit)
        : (Configuration.MAX_HOMES || 5);

    if (homeLimit !== Infinity && homeCount >= homeLimit) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Failed to set home. Limit reached: \u00A7e${homeCount}/${homeLimit}\u00A77.`);
        return false;
    }
    return true;
}

export const SetHomeCommand = {
    name: "sethome",
    description: "Create a new home point",
    usage: "/ae:sethome <name>",
    permission: "essentials.home",
    category: "teleport",
    parameters: [
        { name: "homeName", type: "string", optional: true }
    ],

    async execute(_data, player, args) {
        const name = args[0]

        if (!name) {
            const { showCreateHomeUI } = await import("../../ui/teleport/HomeActionUI.js")
            Kernel.system.run(() => showCreateHomeUI(player))
            return
        }

        if (!validateHomeName(player, name)) return

        const needsConfirmation = await HomeStore.checkOverwriteConfirmation(player, name);
        if (needsConfirmation) {
            player.sendMessage(`\u00A76\u00A7l» \u00A7eHome '\u00A7f${name}\u00A7e' already exists! Run \u00A7f/sethome ${name}\u00A7e again within 60s to overwrite.`);
            return;
        }

        if (!(await checkQuota(player, name))) return

        const success = await HomeStore.setHome(player, name, player.location, player.dimension.id)
        if (success) {
            player.sendMessage(`\u00A7a\u00A7l» \u00A7fHome \u00A7e${name}\u00A7f has been set.`);
        } else {
            player.sendMessage(`\u00A7c\u00A7l» \u00A77Failed to set home.`);
        }
    }
}
