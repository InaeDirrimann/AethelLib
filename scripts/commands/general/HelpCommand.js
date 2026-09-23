import { Kernel } from "../../core/Kernel.js"
import { CommandRegistry as StaticRegistry } from "../base/CommandRegistry.js"

// ----------------------------------------------------------------------------
// | object: HelpCommand                                                      |
// | command definition for the centralized documentation and registry lookup. |
// | dynamically generates a list of commands based on the player's permissions.|
// ----------------------------------------------------------------------------
export const HelpCommand = {
    // internal name.
    name: "help",
    // human-readable description.
    description: "Displays a list of available commands and Aethelgrad lore",
    // command category.
    category: "General",
    // native parameter definitions.
    parameters: [
        { name: "command", type: "string", optional: true }
    ],

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | routes the help request either to the full list or a specific command doc.|
    // ----------------------------------------------------------------------------
    execute(_data, player, args) {
        const CommandRegistry = Kernel.get("commandRegistry") || StaticRegistry
        const topic = args[0]?.toLowerCase()

        if (!topic) {
            this._showAllCommands(player, CommandRegistry)
            return
        }

        if (topic === "lore") {
            this._showLore(player)
            return
        }
        if (topic === "forge" || topic === "rules") {
            this._showForgeRules(player)
            return
        }

        // Check if topic matches a command category (e.g. admin, general, teleport, economy, social)
        const categories = ["admin", "general", "teleport", "economy", "social", "utility"]
        if (categories.includes(topic)) {
            this._showCategoryHelp(player, CommandRegistry, topic)
            return
        }

        const command = CommandRegistry.get(topic)
        if (command) {
            const PermissionManager = Kernel.get("permissions")
            if (command.permission && !PermissionManager.hasPermission(player, command.permission)) {
                player.sendMessage("\u00A7cYou do not have permission to view this command.");
                return;
            }
            this._showCommandHelp(player, command)
            return
        }

        player.sendMessage(`\u00A7cCommand/Category '\u00A7e${topic}\u00A7c' not found. Try \u00A76/ae:help\u00A7c.`);
    },

    _showAllCommands(player, Registry) {
        if (!Registry || typeof Registry.getAll !== "function") {
            player.sendMessage("\u00A7c[Error] Command registry is unavailable.");
            return;
        }
        const PermissionManager = Kernel.get("permissions")
        const commands = Registry.getAll()
        const categoryMap = new Map()

        for (const name of commands) {
            if (name.includes(":")) continue;
            const cmd = Registry.get(name)
            if (!cmd) continue;
            if (cmd.permission && PermissionManager && !PermissionManager.hasPermission(player, cmd.permission)) continue;

            const cat = (cmd.category || "General").toUpperCase();
            if (!categoryMap.has(cat)) {
                categoryMap.set(cat, [])
            }
            categoryMap.get(cat).push({ name, cmd })
        }

        player.sendMessage(" ")
        player.sendMessage("\u00A76\u00A7lAethel\u00A7fLib \u00A7r\u00A78\u2022 \u00A77v1.0.8")
        player.sendMessage("\u00A78\"Built at 3am. Tested in production. Regretted nothing.\"")
        player.sendMessage(" ")
        player.sendMessage("\u00A7eType \u00A76/ae:help <category> \u00A7efor specific category (Admin, General, Teleport, Economy).")
        player.sendMessage("\u00A7eType \u00A76/ae:help <command> \u00A7efor specific command syntax.")
        player.sendMessage(" ")

        const catColors = {
            "GENERAL": "\u00A7a",
            "ADMIN": "\u00A7c",
            "TELEPORT": "\u00A7b",
            "ECONOMY": "\u00A7e",
            "SOCIAL": "\u00A7d",
            "UTILITY": "\u00A79"
        }

        for (const [catName, list] of categoryMap.entries()) {
            const color = catColors[catName] || "\u00A76"
            player.sendMessage(`${color}\u00A7l[ CATEGORY: ${catName} ]\u00A7r`)
            
            list.sort((a, b) => a.name.localeCompare(b.name)).forEach(({ name, cmd }) => {
                const desc = cmd.description || "No description"
                const padding = " ".repeat(Math.max(2, 18 - name.length))
                player.sendMessage(`  \u00A7f/ae:\u00A7e${name}${padding}\u00A77- \u00A7b\u00A7o${desc}`)
            })
            player.sendMessage(" ")
        }
    },

    _showCategoryHelp(player, Registry, categoryName) {
        if (!Registry || typeof Registry.getAll !== "function") {
            player.sendMessage("\u00A7c[Error] Command registry is unavailable.");
            return;
        }
        const PermissionManager = Kernel.get("permissions")
        const commands = Registry.getAll()
        const targetCat = categoryName.toUpperCase()

        player.sendMessage(" ")
        player.sendMessage(`\u00A76\u00A7lCATEGORY MANUAL: \u00A7e${targetCat}`)
        player.sendMessage("\u00A7d=============================================")

        let count = 0
        for (const name of commands) {
            if (name.includes(":")) continue;
            const cmd = Registry.get(name)
            if (!cmd) continue;
            if (cmd.permission && PermissionManager && !PermissionManager.hasPermission(player, cmd.permission)) continue;

            const cat = (cmd.category || "General").toUpperCase();
            if (cat === targetCat) {
                const desc = cmd.description || "No description"
                const usage = cmd.usage || `/ae:${cmd.name}`
                player.sendMessage(`\u00A76- \u00A7f/ae:\u00A7e${cmd.name} \u00A78(\u00A77${usage}\u00A78)`)
                player.sendMessage(`  \u00A7b\u00A7o${desc}`)
                count++
            }
        }

        if (count === 0) {
            player.sendMessage("\u00A77No commands available in this category for your rank.")
        }

        player.sendMessage("\u00A7d=============================================")
        player.sendMessage(" ")
    },

    // ----------------------------------------------------------------------------
    // | internal: _showLore                                                      |
    // | prints background developer/realm history.                               |
    // ----------------------------------------------------------------------------
    _showLore(player) {
        player.sendMessage(" ")
        player.sendMessage("\u00A76\u00A7l» \u00A7f\u00A7lLORE: THE AETHELGRAD CHRONICLES \u00A76\u00A7l«")
        player.sendMessage("\u00A7d=============================================")
        player.sendMessage("\u00A77Wladyslaw18, fueled by sleep deprivation and 3am delirium,")
        player.sendMessage("\u00A77was tired. Tired of Map leaks bloating memory, tired of")
        player.sendMessage("\u00A77Database locks choking the engine, and tired of Mojang's")
        player.sendMessage("\u00A77API updates breaking everything at runtime.")
        player.sendMessage(" ")
        player.sendMessage("\u00A77So he forged the \u00A76Stable Proxy Pattern\u00A77:")
        player.sendMessage("\u00A7a  YOUR CODE \u2192 Kernel \u2192 Minecraft API")
        player.sendMessage(" ")
        player.sendMessage("\u00A77The Kernel acts as a modular shield, absorbing the")
        player.sendMessage("\u00A77runtime pain so your logic survives. The boot sequence")
        player.sendMessage("\u00A77runs in \u00A7a3 phases\u00A77 so nothing blows up during startup.")
        player.sendMessage(" ")
        player.sendMessage("\u00A77It is a hard-coded shield, tested in production,")
        player.sendMessage("\u00A77with absolutely zero regrets.")
        player.sendMessage("\u00A7d=============================================")
        player.sendMessage(" ")
    },

    // ----------------------------------------------------------------------------
    // | internal: _showForgeRules                                                |
    // | prints the strict coding rules.                                          |
    // ----------------------------------------------------------------------------
    _showForgeRules(player) {
        player.sendMessage(" ")
        player.sendMessage("\u00A76\u00A7l» \u00A7f\u00A7lLORE: THE RULES OF THE FORGE \u00A76\u00A7l«")
        player.sendMessage("\u00A7d=============================================")
        player.sendMessage("\u00A7eRule 1: Keep it Tiny")
        player.sendMessage("\u00A77- Files over 120 lines get refactored. Keep it modular")
        player.sendMessage("\u00A77  or face the wrath of 2am refactoring sessions.")
        player.sendMessage(" ")
        player.sendMessage("\u00A7eRule 2: Zero-Bypass")
        player.sendMessage("\u00A77- Always use the Kernel. Going rogue is fun until the")
        player.sendMessage("\u00A77  engine updates and your clever hack breaks.")
        player.sendMessage(" ")
        player.sendMessage("\u00A7eRule 3: Clean Your Trash")
        player.sendMessage("\u00A77- Use the sharded DB and cache. Avoid bloated buffers")
        player.sendMessage("\u00A77  so the server Watchdog doesn't terminate us.")
        player.sendMessage(" ")
        player.sendMessage("\u00A7eRule 4: The Vibe Check")
        player.sendMessage("\u00A77- If it works, it's \u00A7a\"Industrial Peak\"\u00A77. If it crashes,")
        player.sendMessage("\u00A77  it's an \u00A7c\"Advanced Feature Request\"\u00A77. There is no in-between.")
        player.sendMessage(" ")
        player.sendMessage("\u00A7eRule 5: Pure Command Supremacy")
        player.sendMessage("\u00A77- UI is for the weak (mostly because the author is bad")
        player.sendMessage("\u00A77  at building them). Commands are faster and cleaner.")
        player.sendMessage("\u00A7d=============================================")
        player.sendMessage(" ")
    },

    // ----------------------------------------------------------------------------
    // | internal: _showCommandHelp                                               |
    // | prints detailed metadata for a single command vector.                    |
    // ----------------------------------------------------------------------------
    _showCommandHelp(player, command) {
        player.sendMessage(" ")
        player.sendMessage(`\u00A76\u00A7l» \u00A7f\u00A7lCOMMAND: /ae:${command.name.toUpperCase()} \u00A76\u00A7l«`);
        player.sendMessage(`\u00A77${command.description}`);
        player.sendMessage(" ")
        // show category, syntax usage, aliases, and permission node.
        player.sendMessage(`\u00A76\u00A7lCategory:  \u00A7f${command.category || "General"}`);
        player.sendMessage(`\u00A76\u00A7lUsage:     \u00A7f${command.usage || `/ae:${command.name}`}`);
        
        if (command.aliases && command.aliases.length > 0) {
            player.sendMessage(`\u00A76\u00A7lAliases:   \u00A7f${command.aliases.join(", ")}`);
        }
        
        if (command.permission) {
            player.sendMessage(`\u00A76\u00A7lSecurity:  \u00A7f${command.permission}`);
        }
        
        player.sendMessage(" ")
    }
}
