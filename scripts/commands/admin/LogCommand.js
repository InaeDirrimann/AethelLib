import { Kernel } from "../../core/Kernel.js"
import { PlayerUtils } from "../../utils/PlayerUtils.js"

export const LogCommand = {
    name: "log",
    description: "View a player's activity logs (commands, private messages).",
    usage: "/ae:log <player> [category]",
    permission: "essentials.admin",
    category: "Admin",
    params: [
        { name: "player", type: "player", optional: false },
        { name: "category", type: "logCategory", optional: true }
    ],

    execute(_data, player, args) {
        if (args.length < 1) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:log <player> [command|msg]");
            return
        }

        const { player: target, consumedArgs } = PlayerUtils.resolveFromArgs(args)
        if (!target) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Player not found or offline.");
            return
        }

        const category = args[consumedArgs]?.toLowerCase()
        if (category && !["command", "msg"].includes(category)) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Invalid category. Use: command, msg");
            return
        }

        const LogStore = Kernel.get("logStore")
        if (!LogStore) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Log system is not available.");
            return
        }

        const logs = LogStore.getPlayerLogs(target.id, category, 20)
        const summary = LogStore.getPlayerSummary(target.id)

        if (logs.length === 0) {
            player.sendMessage(`\u00A77\u00A7l» \u00A7e${target.name}\u00A77 has no logged activity${category ? ` (${category})` : ""}.`);
            return
        }

        player.sendMessage(`\u00A78━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        player.sendMessage(`\u00A76\u00A7lLogs: \u00A7e${target.name}`);
        if (summary.lastSeen) {
            const ago = Math.floor((Date.now() - summary.lastSeen) / 60000)
            player.sendMessage(`\u00A77Commands: \u00A7f${summary.commandCount}\u00A77 | Messages: \u00A7f${summary.msgCount}\u00A77 | Last: \u00A7f${ago}m ago`);
        }
        player.sendMessage(`\u00A78━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        for (const log of logs) {
            const time = new Date(log.timestamp).toLocaleTimeString()
            if (log.type === "command") {
                player.sendMessage(`\u00A78[${time}] \u00A7b/ae:${log.command} \u00A77${log.args}`);
            } else if (log.type === "msg") {
                const dir = log.direction === "sent" ? "\u00A7dTO" : "\u00A75FROM"
                player.sendMessage(`\u00A78[${time}] ${dir} \u00A7e${log.partner}\u00A78: \u00A7f${log.content}`);
            }
        }
        player.sendMessage(`\u00A78━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
}
