import { Kernel } from "../../core/Kernel.js"
import { LifecycleController } from "../../core/LifecycleController.js"
import { PlayerUtils } from "../../utils/PlayerUtils.js"

const COMMAND_SYSTEM_MAPPINGS = {
    // Economy
    "money": "moneySystem",
    "pay": "moneySystem",
    "topmoney": "moneySystem",
    // Warp
    "warp": "warpSystem",
    "setwarp": "warpSystem",
    "delwarp": "warpSystem",
    "warps": "warpSystem",
    "listwarps": "warpSystem",
    // Home
    "home": "homeSystem",
    "sethome": "homeSystem",
    "delhome": "homeSystem",
    "homes": "homeSystem",
    "listhomes": "homeSystem",
    // TPA
    "tpa": "tpaSystem",
    "tpahere": "tpaSystem",
    "tpaccept": "tpaSystem",
    "tpadeny": "tpaSystem",
    "tpacancel": "tpaSystem",
    // Back
    "back": "backSystem",
    // RTP
    "rtp": "rtpSystem",
    "wild": "rtpSystem",
    // Shop
    "shop": "shopSystem",
    "shoplist": "shopSystem",
    "shopsearch": "shopSystem",
    "shopbuy": "shopSystem",
    "shopinfo": "shopSystem",
    "shopcart": "shopSystem",
    "shopcheckout": "shopSystem",
    "shopadd": "shopSystem",
    "shopcatmk": "shopSystem",
    "shopcatrm": "shopSystem",
    "shopcatls": "shopSystem",
    // Quick Sell
    "sell": "sellSystem",
    // Auction
    "auction": "auctionSystem",
    "ah": "auctionSystem",
    // Withdraw
    "withdraw": "withdrawSystem",
    "banknote": "withdrawSystem",
    // Message
    "msg": "messageSystem",
    "tell": "messageSystem",
    "w": "messageSystem",
    "r": "messageSystem",
    "reply": "messageSystem",
    // Land Claims
    "claim": "landSystem",
    "unclaim": "landSystem",
    "trust": "landSystem",
    "untrust": "landSystem",
    "claims": "landSystem"
};

/*
 * LEGACY_COMMAND_INTERCEPTOR
 * ----------------------------------------------------------------------------
 * Handles the interception of chat-based commands (legacy '!' prefix). 
 * This module acts as the bridge between the chat event-bus and the 
 * internal CommandRegistry. 
 *
 * PHILOSOPHY: Chat-based commands are a fallback for the native registry. 
 * We process them asynchronously to ensure that the chat event-loop 
 * is not blocked by heavy command logic.
 */
export const CommandHandler = {
    _initialized: false,
    _prefix: "-",
    _slashCommands: new Map(),
    _commandStats: new Map(),

    /* 
     * SERVICE_BOOTSTRAP
     */
    init() {
        if (!LifecycleController.boot("commandHandler")) return
        this._initialized = true

        // Load prefix dynamically from settings
        const SettingsStore = Kernel.get("settings")
        if (SettingsStore) {
            this._prefix = SettingsStore.get("commandPrefix") || "-"
        }

        /* 
         * CHAT_INTERCEPTION_HOOK
         * Subscribes to the world.beforeEvents.chatSend event to catch 
         * potential commands before they are broadcast to other players.
         */
        const chatEvent = Kernel.world.beforeEvents.chatSend
        if (chatEvent) {
            chatEvent.subscribe(this._handleChatCommand.bind(this))
        } else {
            console.warn("[CommandHandler] FATAL: Chat event-bus unreachable.");
        }

        /* 
         * SCRIPT_EVENT_ORCHESTRATOR
         * Handles '/scriptevent cmd:execute' calls for cross-plugin 
         * communication and tab-completion hacks.
         */
        Kernel.system.afterEvents.scriptEventReceive.subscribe(this._handleSlashCommand.bind(this))
        Kernel.system.afterEvents.scriptEventReceive.subscribe(this._handleTestCommand.bind(this))
        Kernel.system.afterEvents.scriptEventReceive.subscribe(this._handleScriptEventCalc.bind(this))

        console.log(`[CommandHandler] INTERFACE_ONLINE | Prefix: ${this._prefix}`);
    },

    /*
     * CHAT_INPUT_PARSER
     * ----------------------------------------------------------------------------
     * 1. Validate prefix.
     * 2. Check if the command was invoked with a namespace (e.g. "/ae:home").
     *    If namespaced and command is native: true, allow C++ engine processing.
     * 3. Otherwise, cancel the native chat bubble, parse the name, and execute script-side.
     */
    _handleChatCommand(event) {
        const message = event.message.trim()

        // Check for our custom prefix or the native slash
        if (!message.startsWith(this._prefix) && !message.startsWith("/")) return

        const prefix = message.startsWith("/") ? "/" : this._prefix;
        const fullContent = message.slice(prefix.length).trim();

        /*
         * RAW_EXPRESSION_INTERCEPT
         * ----------------------------------------------------------------------------
         * For commands flagged with chatRaw:true, we extract the full unparsed
         * expression string BEFORE any whitespace tokenization or engine processing.
         *
         * Problem: Bedrock does CLIENT-SIDE parameter schema validation for native
         * slash commands. Operators like +, *, / fail this validation before the
         * server ever receives the message. Only - passes because the client treats
         * it as a negative number prefix. This intercept bypasses all of that.
         *
         * Usage: type in CHAT (T key) or with the - prefix. e.g. -calc 2 * (3 + 4)
         */
        const rawFirstWord = fullContent.split(/\s+/)[0];
        if (rawFirstWord) {
            const rawCmdName = rawFirstWord.includes(":") ? rawFirstWord.split(":")[1] : rawFirstWord;
            const EarlyRegistry = Kernel.get("commandRegistry");
            if (EarlyRegistry) {
                const rawCmd = EarlyRegistry.get(rawCmdName);
                if (rawCmd && rawCmd.chatRaw === true) {
                    event.cancel = true;
                    const rawExpression = fullContent.slice(rawFirstWord.length).trim();
                    Kernel.system.run(async () => {
                        try {
                            await this._executeCommand(event.sender, rawCmdName, [rawExpression], "chat_raw");
                        } catch (err) {
                            console.error(`[CommandHandler] Chat raw crash: ${err}`);
                        }
                    });
                    return;
                }
            }
        }

        const tokens = fullContent.split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return;

        const rawName = tokens[0];
        const args = tokens.slice(1);

        const CommandRegistry = Kernel.get("commandRegistry")
        const command = CommandRegistry.get(rawName)

        if (command) {
            const isNamespaced = rawName.includes(":");
            
            // LOGIC GATE: If command is not native OR is not namespaced, we handle it script-side.
            // This allows /ae:calc (non-native) and -calc to work, while /ae:home (native) 
            // passes through to the C++ engine for high-performance parsing.
            if (prefix === "/" && (command.native === false || !isNamespaced)) {
                // Cancel the native bubble/parsing
                event.cancel = true;

                Kernel.system.run(async () => {
                    try {
                        const name = isNamespaced ? rawName.split(":")[1] : rawName;
                        // For non-native commands, we pass the ENTIRE message content after the name
                        // as the first argument to ensure no symbols/spaces are lost.
                        const finalArgs = command.native === false ? [fullContent.slice(rawName.length).trim()] : args;
                        await this._executeCommand(event.sender, name, finalArgs, "chat");
                    } catch (err) {
                        console.error(`[CommandHandler] Chat dispatch crash: ${err}`);
                    }
                });
                return;
            }
            
            // For custom prefix commands, always handle script-side
            if (prefix !== "/") {
                Kernel.system.run(async () => {
                    try {
                        const name = isNamespaced ? rawName.split(":")[1] : rawName;
                        await this._executeCommand(event.sender, name, args, "prefix");
                    } catch (err) {
                        console.error(`[CommandHandler] Prefix dispatch crash: ${err}`);
                    }
                });
            }
        }
    },

    /*
     * SCRIPT_EVENT_PARSER
     */
    _handleSlashCommand(event) {
        if (event.id !== "cmd:execute") return
        if (!event.sourceEntity || !event.sourceEntity.isValid) return

        try {
            const data = JSON.parse(event.message || "{}")
            const { command, args } = data

            if (!command) return

            Kernel.system.run(async () => {
                try {
                    await this._executeCommand(event.sourceEntity, command, args || [], "slash")
                } catch (err) {
                    console.error(`[CommandHandler] Slash dispatch crash: ${err}`);
                }
            })
        } catch (error) {
            console.error(`[CommandHandler] SCRIPT_EVENT_PARSE_FAILURE: ${error}`)
        }
    },

    /*
     * HEADLESS_TEST_ORCHESTRATOR
     * ----------------------------------------------------------------------------
     * Intercepts '/scriptevent ae:test_cmd <cmd> [args...]' from standard input/console,
     * wraps the inputs in a mock player sandbox, and executes the command logic.
     */
    _handleTestCommand(event) {
        if (event.id !== "ae:test_cmd") return

        try {
            const message = event.message || ""
            const tokens = message.trim().split(/\s+/).filter(Boolean)
            if (tokens.length === 0) {
                console.warn("[TestRunner] Usage: /scriptevent ae:test_cmd <commandName> [args...]")
                return
            }

            let commandName = tokens[0]
            if (commandName.startsWith("/")) {
                commandName = commandName.slice(1)
            }
            if (commandName.includes(":")) {
                commandName = commandName.split(":")[1]
            }

            let args = tokens.slice(1)
            // Clean quotes from arguments
            args = args.map(arg => {
                if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
                    return arg.slice(1, -1)
                }
                return arg
            })

            console.warn(`[TestRunner] Headless simulation: commandName='${commandName}' args=${JSON.stringify(args)}`)

            // Helper to generate a robust mock player entity
            const createMockPlayer = (name, id, isAdmin = false) => {
                const properties = new Map()
                const tags = new Set(isAdmin ? ["admin"] : [])
                return {
                    id,
                    name,
                    isValid: true,
                    location: { x: 100, y: 64, z: 100 },
                    dimension: {
                        id: "minecraft:overworld"
                    },
                    sendMessage(msg) {
                        const cleanMsg = msg.replace(/§[0-9a-fklmnor]/g, "")
                        console.warn(`[${name}] ${cleanMsg}`)
                    },
                    hasTag(tag) {
                        return tags.has(tag)
                    },
                    getTags() {
                        return Array.from(tags)
                    },
                    addTag(tag) {
                        tags.add(tag)
                        console.warn(`[${name}] Tag added: ${tag}`)
                        return true
                    },
                    removeTag(tag) {
                        const existed = tags.delete(tag)
                        console.warn(`[${name}] Tag removed: ${tag}`)
                        return existed
                    },
                    getDynamicProperty(key) {
                        return properties.get(key)
                    },
                    setDynamicProperty(key, value) {
                        if (value === undefined) {
                            properties.delete(key)
                        } else {
                            properties.set(key, value)
                        }
                    },
                    teleport(location, options) {
                        if (location) {
                            this.location = { ...location }
                        }
                        if (options && options.dimension) {
                            this.dimension = options.dimension
                        }
                        console.warn(`[${name}] Teleported to: ${JSON.stringify(this.location)} in ${this.dimension.id}`)
                    },
                    setGameMode(mode) {
                        console.warn(`[${name}] GameMode set to ${mode}`)
                        return true
                    },
                    runCommand(cmd) {
                        console.warn(`[${name}] Executed command: ${cmd}`)
                        return { successCount: 1 }
                    },
                    getComponent(componentId) {
                        if (componentId === "minecraft:health" || componentId === "health") {
                            return {
                                effectiveMax: 20,
                                setCurrentValue(val) {
                                    console.warn(`[${name}] Health set to ${val}`)
                                }
                            }
                        }
                        if (componentId === "minecraft:hunger" || componentId === "hunger") {
                            return {
                                setCurrentValue(val) {
                                    console.warn(`[${name}] Hunger set to ${val}`)
                                }
                            }
                        }
                        if (componentId === "minecraft:inventory" || componentId?.endsWith("inventory")) {
                            return {
                                container: {
                                    getItem(_slot) { return null },
                                    setItem(_slot, _item) {},
                                    get size() { return 36 },
                                    get emptySlotsCount() { return 36 },
                                    addItem(_item) { return null }
                                }
                            }
                        }
                        return undefined
                    }
                }
            }

            Kernel.system.run(async () => {
                const registeredMocks = []
                try {
                    const mockPlayer = createMockPlayer("MockPlayer", "mock-player-id", true)
                    PlayerUtils.registerMock(mockPlayer)
                    registeredMocks.push(mockPlayer)

                    // Auto-detect other potential players in the arguments list
                    for (const arg of args) {
                        if (typeof arg === "string" && isNaN(Number(arg)) && !/^\d+[mhdw]$/i.test(arg) && !/^[{}[\],]/.test(arg)) {
                            const lowerName = arg.toLowerCase()
                            if (lowerName !== "mockplayer" && lowerName !== "mock-player-id") {
                                const targetMock = createMockPlayer(arg, `mock-id-${lowerName}`, false)
                                PlayerUtils.registerMock(targetMock)
                                registeredMocks.push(targetMock)
                            }
                        }
                    }

                    await this._executeCommand(mockPlayer, commandName, args, "test")
                    console.warn(`[TestRunner] Simulation finished.`)
                } catch (e) {
                    console.error(`[TestRunner] Simulation crash: ${e}`)
                } finally {
                    for (const mock of registeredMocks) {
                        try {
                            PlayerUtils.unregisterMock(mock)
                        } catch (err) {
                            console.error(`[TestRunner] Error unregistering mock ${mock.name}: ${err}`)
                        }
                    }
                }
            })
        } catch (error) {
            console.error(`[TestRunner] Exception: ${error}`)
        }
    },

    /*
     * EXECUTION_ENGINE
     * ----------------------------------------------------------------------------
     * The heart of the command system. Performs the following sequence:
     * 1. Resolve command from the registry.
     * 2. Perform RBAC permission check.
     * 3. Invoke the command.execute() method.
     * 4. Log performance metrics.
     */
    async _executeCommand(player, commandName, args, _source) {
        const startTime = Date.now()
        const CommandRegistry = Kernel.get("commandRegistry")

        try {
            const command = CommandRegistry.get(commandName)

            if (!command) {
                player.sendMessage(`\u00A7c[Error] Unknown identifier: \u00A7e${commandName}`)
                this._recordCommandStats(commandName, false, Date.now() - startTime)
                return
            }

            // Verify if the system module associated with the command is enabled
            const canonicalName = command.name ? command.name.toLowerCase() : commandName.toLowerCase();
            const settingKey = COMMAND_SYSTEM_MAPPINGS[canonicalName];
            if (settingKey) {
                const SettingsStore = Kernel.get("settings");
                if (SettingsStore && !SettingsStore.get(settingKey)) {
                    player.sendMessage(`\u00A7c[System] The '${canonicalName}' system is currently disabled by an administrator.`);
                    this._recordCommandStats(commandName, false, Date.now() - startTime, "system_disabled");
                    return;
                }
            }

            if (command.permission && !this._hasPermission(player, command.permission)) {
                player.sendMessage(`\u00A7c[Security] Access denied for command: \u00A7e${commandName}`)
                this._recordCommandStats(commandName, false, Date.now() - startTime, "no_permission")
                return
            }

            // Enterprise Safeguard: Validate that all required parameters are provided and typed correctly.
            const paramsList = command.params || command.parameters;
            if (paramsList) {
                for (let i = 0; i < paramsList.length; i++) {
                    const paramDef = paramsList[i];
                    if (!paramDef) continue;

                    const argVal = args[i];

                    // 1. Missing mandatory parameter check
                    if (paramDef.optional === false && (argVal === undefined || argVal === null || argVal === "")) {
                        player.sendMessage(`\u00A7c\u00A7l» \u00A77Usage: ${command.usage || ("/" + commandName)}`);
                        this._recordCommandStats(commandName, false, Date.now() - startTime, "missing_args");
                        return;
                    }

                    // 2. Type validation for provided arguments
                    if (argVal !== undefined && argVal !== null && argVal !== "") {
                        const type = paramDef.type;
                        if (typeof type === "string") {
                            const lowerType = type.toLowerCase();

                            // Integer validation
                            if (lowerType === "int" || lowerType === "integer") {
                                const num = Number(argVal);
                                if (isNaN(num) || !Number.isInteger(num)) {
                                    player.sendMessage(`\u00A7c\u00A7l» \u00A77Invalid value for \u00A7e${paramDef.name}\u00A77. Must be a valid integer.`);
                                    player.sendMessage(`\u00A7c\u00A7l» \u00A77Usage: ${command.usage || ("/" + commandName)}`);
                                    this._recordCommandStats(commandName, false, Date.now() - startTime, "invalid_type");
                                    return;
                                }
                            }

                            // Float validation
                            else if (lowerType === "float" || lowerType === "double" || lowerType === "number") {
                                const num = Number(argVal);
                                if (isNaN(num)) {
                                    player.sendMessage(`\u00A7c\u00A7l» \u00A77Invalid value for \u00A7e${paramDef.name}\u00A77. Must be a valid number.`);
                                    player.sendMessage(`\u00A7c\u00A7l» \u00A77Usage: ${command.usage || ("/" + commandName)}`);
                                    this._recordCommandStats(commandName, false, Date.now() - startTime, "invalid_type");
                                    return;
                                }
                            }

                            // Boolean validation
                            else if (lowerType === "bool" || lowerType === "boolean") {
                                const valStr = String(argVal).toLowerCase();
                                if (valStr !== "true" && valStr !== "false" && valStr !== "1" && valStr !== "0") {
                                    player.sendMessage(`\u00A7c\u00A7l» \u00A77Invalid value for \u00A7e${paramDef.name}\u00A77. Must be true or false.`);
                                    player.sendMessage(`\u00A7c\u00A7l» \u00A77Usage: ${command.usage || ("/" + commandName)}`);
                                    this._recordCommandStats(commandName, false, Date.now() - startTime, "invalid_type");
                                    return;
                                }
                            }

                            // Custom Enum validation
                            else {
                                const getRegistryEnum = (typeStr) => {
                                    if (CommandRegistry && typeof CommandRegistry.hasEnum === "function" && CommandRegistry.hasEnum(typeStr)) {
                                        return CommandRegistry.getEnum(typeStr);
                                    }
                                    if (CommandRegistry && typeof CommandRegistry.getAllEnums === "function") {
                                        const match = CommandRegistry.getAllEnums().find(k => k.toLowerCase() === typeStr.toLowerCase());
                                        if (match) return CommandRegistry.getEnum(match);
                                    }
                                    return null;
                                };
                                const enumValues = getRegistryEnum(type);
                                if (enumValues) {
                                    const valStr = String(argVal).toLowerCase();
                                    if (!enumValues.map(v => String(v).toLowerCase()).includes(valStr)) {
                                        player.sendMessage(`\u00A7c\u00A7l» \u00A77Invalid value for \u00A7e${paramDef.name}\u00A77. Choose from: \u00A7e${enumValues.join("\u00A77, \u00A7e")}`);
                                        player.sendMessage(`\u00A7c\u00A7l» \u00A77Usage: ${command.usage || ("/" + commandName)}`);
                                        this._recordCommandStats(commandName, false, Date.now() - startTime, "invalid_enum");
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            await command.execute(null, player, args)

            this._recordCommandStats(commandName, true, Date.now() - startTime)

            // LOG THE COMMAND FOR PLAYER ACTIVITY AUDIT
            const LogStore = Kernel.get("logStore")
            if (LogStore) {
                LogStore.logCommand(player.id, player.name, commandName, args.join(" "), _source)
            }

        } catch (error) {
            const stackLines = (error.stack || "").split("\n").map(l => `[Scripting] [error]    ${l}`).join("\n")
            console.error(`[CommandHandler] EXECUTION_CRASH [${commandName}]: ${error}\n${stackLines}`)
            player.sendMessage(`\u00A7c[Fatal] Execution pipeline failure: \u00A7e${error.message}`)
            this._recordCommandStats(commandName, false, Date.now() - startTime, "error")
        }
    },

    /*
     * AUTH_RESOLUTION_FALLBACK
     */
    _hasPermission(player, permission) {
        const PermissionManager = Kernel.get("permissions")
        if (!PermissionManager) return player.hasTag("admin") 

        return PermissionManager.hasPermission(player, permission)
    },

    /*
     * ANALYTICS_LOGGER
     */
    _recordCommandStats(commandName, success, executionTime, error = null) {
        if (!this._commandStats.has(commandName)) {
            this._commandStats.set(commandName, {
                total: 0,
                success: 0,
                failed: 0,
                totalTime: 0,
                errors: new Map()
            })
        }

        const stats = this._commandStats.get(commandName)
        stats.total++
        stats.totalTime += executionTime

        if (success) {
            stats.success++
        } else {
            stats.failed++
            if (error) {
                const count = stats.errors.get(error) || 0
                stats.errors.set(error, count + 1)
            }
        }
    },

    registerSlashCommand(name, callback) {
        this._slashCommands.set(name, callback)
    },

    setPrefix(prefix) {
        if (typeof prefix === "string" && prefix.length > 0) {
            this._prefix = prefix
            console.log(`[CommandHandler] PREFIX_UPDATED: ${prefix}`);
        }
    },

    getPrefix() {
        return this._prefix
    },

    getStats(commandName = null) {
        if (commandName) {
            return this._commandStats.get(commandName) || null
        }

        const allStats = {}
        for (const [name, stats] of this._commandStats) {
            allStats[name] = {
                ...stats,
                avgTime: stats.total > 0 ? Math.round(stats.totalTime / stats.total) : 0,
                successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0
            }
        }
        return allStats
    },

    async executeCommand(player, command) {
        const trimmed = command.trim()
        let cmdText = trimmed
        let matched = false

        if (trimmed.startsWith(this._prefix)) {
            cmdText = trimmed.slice(this._prefix.length)
            matched = true
        } else if (trimmed.startsWith("/")) {
            cmdText = trimmed.slice(1)
            matched = true
        }

        if (matched) {
            let [cmdName, ...args] = cmdText.trim().split(/\s+/).filter(Boolean)
            if (cmdName.includes(":")) {
                cmdName = cmdName.split(":")[1]
            }
            args = args.map(arg => {
                if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
                    return arg.slice(1, -1)
                }
                return arg
            })
            await this._executeCommand(player, cmdName, args, "programmatic")
            return true
        }

        return false
    },

    getAvailableCommands(player) {
        const CommandRegistry = Kernel.get("commandRegistry")
        const commands = CommandRegistry.getAll()
        const available = []
        const SettingsStore = Kernel.get("settings")

        for (const name of commands) {
            const command = CommandRegistry.get(name)
            if (command && command.name) {
                const canonicalName = command.name.toLowerCase();
                const settingKey = COMMAND_SYSTEM_MAPPINGS[canonicalName];
                if (settingKey && SettingsStore && !SettingsStore.get(settingKey)) {
                    continue;
                }
            }
            if (!command.permission || this._hasPermission(player, command.permission)) {
                available.push({
                    name,
                    description: command.description || "No description",
                    usage: command.usage,
                    category: command.category ? (command.category.charAt(0).toUpperCase() + command.category.slice(1).toLowerCase()) : "General"
                })
            }
        }

        return available.sort((a, b) => a.name.localeCompare(b.name))
    },

    _handleScriptEventCalc(event) {
        if (event.id !== "ae:calc" && event.id !== "ae:calculate") return
        if (!event.sourceEntity || !event.sourceEntity.isValid) return

        const expression = (event.message || "").trim()
        if (!expression) {
            event.sourceEntity.sendMessage("\u00A7c\u00A7l\u00BB \u00A77Syntax Error: Math expression required.");
            event.sourceEntity.sendMessage("\u00A77Example: /scriptevent ae:calc 2 + 3 * (4 / 2)");
            return
        }

        Kernel.system.run(async () => {
            const name = "calculate" // always use the canonical name
            await this._executeCommand(event.sourceEntity, name, [expression], "scriptevent")
        })
    }
}
