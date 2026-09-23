import { PlayerUtils } from "../../../../../utils/PlayerUtils.js";

export const XpCommand = {
    name: "axp",
    description: "Give or take experience levels",
    usage: "/ae:axp [player] <amount> or /ae:axp <amount>",
    permission: "essentials.xp",
    category: "WORLD",
    native: false,
    params: [
        { name: "amount", type: "integer", optional: false },
        { name: "player", type: "player", optional: true }
    ],
    execute(data, player, args) {
        try {
            if (!args || args.length === 0) {
                player.sendMessage("§c§l» §7Usage: /ae:axp [player] <amount> or /ae:axp <amount>");
                return;
            }

            let amount = parseInt(args[0]);
            let target = player;

            if (isNaN(amount)) {
                const { player: resolved, consumedArgs } = PlayerUtils.resolveFromArgs(args);
                if (resolved) {
                    target = resolved;
                    amount = parseInt(args[consumedArgs]);
                }
            } else if (args.length > 1) {
                const { player: resolved } = PlayerUtils.resolveFromArgs(args.slice(1));
                if (resolved) target = resolved;
            }

            if (!target || !target.isValid) {
                player.sendMessage("§c§l» §7Target player not found or offline.");
                return;
            }

            if (isNaN(amount) || amount === 0 || !Number.isFinite(amount)) {
                player.sendMessage("§c§l» §7Invalid amount (must be a non-zero integer).");
                return;
            }

            const rawTarget = target.__rawEntity__ || target;
            const rawPlayer = player.__rawEntity__ || player;
            const absAmount = Math.abs(amount);
            const action = amount > 0 ? "give" : "take";

            try {
                if (typeof rawTarget.addLevels === "function") {
                    rawTarget.addLevels(amount);
                } else {
                    const cmd = action === "give" ? `xp ${absAmount}L "${rawTarget.name}"` : `xp -${absAmount}L "${rawTarget.name}"`;
                    rawPlayer.runCommand(cmd);
                }

                if (rawTarget.id === rawPlayer.id) {
                    rawPlayer.sendMessage(`\u00A7a\u00A7l» \u00A77${action === "give" ? "Gave" : "Took"} ${absAmount} levels ${action === "give" ? "to" : "from"} yourself.`);
                } else {
                    rawPlayer.sendMessage(`\u00A7a\u00A7l» \u00A77${action === "give" ? "Gave" : "Took"} ${absAmount} levels ${action === "give" ? "to" : "from"} ${rawTarget.name}.`);
                    if (rawTarget.isValid) rawTarget.sendMessage(`\u00A7a\u00A7l» \u00A77${rawPlayer.name} ${action === "give" ? "gave" : "took"} ${absAmount} levels ${action === "give" ? "to" : "from"} you.`);
                }
            } catch (e) {
                rawPlayer.sendMessage(`\u00A7c\u00A7l» \u00A77Failed to adjust levels: ${e.message}`);
            }
        } catch (e) {
            player.sendMessage(`§c§l» §7XP command error: ${e.message}`);
        }
    }
};
