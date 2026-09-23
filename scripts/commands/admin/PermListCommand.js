
export const PermListCommand = {
    // internal name.
    name: "permlist",
    // human-readable description.
    description: "Displays a list of all assignable permission nodes",
    // required permission node.
    permission: "essentials.admin.ranks",
    // command category.
    category: "Admin",
    // native parameter definitions.
    parameters: [],

    execute(_data, player, _args) {
        const permissionsList = [
            { name: "admin", desc: "Grants absolute bypass & control" },
            { name: "admin.system", desc: "Manage core settings and modules" },
            { name: "essentials.home", desc: "Allows executing /home command" },
            { name: "essentials.sethome", desc: "Allows executing /sethome command" },
            { name: "essentials.delhome", desc: "Allows executing /delhome command" },
            { name: "essentials.tpa", desc: "Allows executing /tpa command" },
            { name: "essentials.tpaccept", desc: "Allows accepting TPA requests" },
            { name: "essentials.tpadeny", desc: "Allows denying TPA requests" },
            { name: "essentials.tpacancel", desc: "Allows canceling TPA requests" },
            { name: "essentials.pay", desc: "Allows transferring money to players" },
            { name: "essentials.money", desc: "Allows checking player balance" },
            { name: "essentials.withdraw", desc: "Allows withdrawing banknotes" },
            { name: "essentials.shop", desc: "Allows accessing the item shop" },
            { name: "essentials.sell", desc: "Allows quick selling items" },
            { name: "essentials.rtp", desc: "Allows random teleportation" },
            { name: "essentials.back", desc: "Allows returning to last point" },
            { name: "essentials.menu", desc: "Allows opening the main GUI menu" },
            { name: "essentials.auction", desc: "Allows using the auction house" },
            { name: "essentials.calculate", desc: "Allows executing the calculator" },
            { name: "essentials.report", desc: "Allows reporting players" },
            { name: "essentials.tps", desc: "Allows checking server TPS" },
            { name: "essentials.admin.inspect", desc: "Inspect player coordinates & tags" },
            { name: "essentials.admin.invsee", desc: "View player inventories" },
            { name: "essentials.admin.ft", desc: "Manage floating texts" },
            { name: "essentials.admin.reports", desc: "View and manage player reports" },
            { name: "essentials.admin.economy", desc: "Manage global economy & balances" },
            { name: "essentials.admin.ranks", desc: "Manage ranks and permissions" },
            { name: "home.limit", desc: "Home limit numeric value" },
            { name: "home.cooldown", desc: "GoHome cooldown (seconds)" },
            { name: "teleport.wait", desc: "Stand still wait duration (seconds)" },
            { name: "command.cooldown", desc: "General command cooldown (seconds)" },
            { name: "tpa.cooldown", desc: "TPA command cooldown (seconds)" },
            { name: "warp.cooldown", desc: "Warp command cooldown (seconds)" },
            { name: "rtp.cooldown", desc: "RTP command cooldown (seconds)" },
            { name: "back.cooldown", desc: "Back command cooldown (seconds)" },
            { name: "chat.cooldown", desc: "Chat cooldown between messages (ms)" }
        ];

        // Header display - styled like AethelLib help
        player.sendMessage(" ")
        player.sendMessage("\u00A76\u00A7lAethel\u00A7fLib")
        player.sendMessage("\u00A77Assignable Permissions List")
        player.sendMessage(" ")

        // Sort alphabetically and print the list, matching help alignment
        permissionsList.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
            const name = item.name;
            const desc = item.desc;
            
            // split the name for a two-tone color effect (orange and white).
            const split = Math.ceil(name.length / 2);
            const firstHalf = name.substring(0, split);
            const secondHalf = name.substring(split);
            
            // padding logic: calculate whitespace needed to keep descriptions aligned in a column
            const padding = " ".repeat(Math.max(5, 32 - name.length));
            
            player.sendMessage(`\u00A76- \u00A76\u00A7l${firstHalf}\u00A7f\u00A7l${secondHalf}${padding}\u00A7b\u00A7o${desc}`);
        });

        // Footer display
        player.sendMessage(" ")
        player.sendMessage("\u00A77Use \u00A76/ae:rankadmin setperm <rank> <node> <value> \u00A77to assign.")
        player.sendMessage(" ")
    }
}
