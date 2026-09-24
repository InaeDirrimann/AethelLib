import { Kernel, FeatureDisabledError } from "../Kernel.js";
import { PlayerUtils } from "../../utils/PlayerUtils.js";
import { Database } from "../datastore/DatabaseManager.js";
import { DEFAULT_RANKS } from "../../data/RankConfig.js";

// ----------------------------------------------------------------------------
// | object: CommandManager                                                   |
// | bridges custom commands with bedrock's native C++ command engine.       |
// | chat events are slow and full of string regex sadness. this is way better. |
// ----------------------------------------------------------------------------
export const CommandManager = {
    // track if we've already done the handshakes.
    _isInitialized: false,
    get _initialized() { return this._isInitialized; },
    set _initialized(val) { this._isInitialized = val; },
    
    // the default command prefix/namespace.
    _primaryNS: "ae",
    // the alias namespace prefix.
    _aliasNS: "ae", 
    _startupTa: null,

    /**
     * Initializes the CommandManager and subscribes to startup events.
     * 
     * EXPECTS:
     * - Kernel.system.beforeEvents.startup exists.
     * 
     * GUARANTEES:
     * - Prevents duplicate initialization checks.
     * - Registers the startup listener wrapper to hook custom commands before game ticks start.
     * 
     * DOES NOT PROMISE:
     * - Active registration if called after the server has already booted.
     */
    init() {
        if (this._isInitialized) return;
        this._isInitialized = true;

        // we have to wait for the startup event to grab the custom command registry.
        // the engine is super picky and will refuse to let us register things once ticking.
        this._startupTa = (ev) => this._injectNativeRegistry(ev);
        Kernel.system.beforeEvents.startup.subscribe(this._startupTa);

        console.log(`[CommandManager] Registry online. Namespace: /${this._primaryNS}:`);
    },

    /**
     * Injects custom commands and enums into the native C++ command registry.
     * 
     * EXPECTS:
     * - event: StartupEvent object containing the native customCommandRegistry.
     * 
     * GUARANTEES:
     * - Populates systemName, permission, rank, and chatcolor enums.
     * - Synchronously registers all registry commands and aliases natively.
     * - Correctly namespaces all registered command names and aliases.
     * 
     * DOES NOT PROMISE:
     * - Native registration for commands flagged with chatRaw: true.
     */
    _injectNativeRegistry(event) {
        const Registry = Kernel.get("commandRegistry");
        const nativeReg = event.customCommandRegistry;
        if (!Registry || !nativeReg) return;

        // --- ENUM_REGISTRATION_PIPELINE ---
        // Populate 'rank' enum from database store or static defaults (Safe for Startup phase)
        try {
            let ranksList = DEFAULT_RANKS.map(r => r.id);
            const db = Kernel.get("database") || Database;
            if (db) {
                const storedRanks = db.get("ranks");
                if (storedRanks && typeof storedRanks === "object") {
                    const dbRankIds = Object.keys(storedRanks);
                    if (dbRankIds.length > 0) {
                        ranksList = dbRankIds;
                    }
                }
            }
            Registry.registerEnum("rank", ranksList);
        } catch (e) {
            try {
                const staticRanks = DEFAULT_RANKS.map(r => r.id);
                Registry.registerEnum("rank", staticRanks);
            } catch (e2) { }
        }


        // Populate 'systemName' enum
        try {
            const staticSystems = [
                "database", "playerStore", "worldStore", "rankStore", "keys", "settings",
                "economy", "shopStore", "chestShopStore", "ranks", "chat", "banManager",
                "permissions", "formatter", "muteStore", "messageStore", "homeStore",
                "warpStore", "tpaStore", "tpaHandshake", "tpaService", "teleportService",
                "signalBus", "placeholders", "claimStore", "floatingTextStore"
            ];
            const kernelSystems = Array.from(Kernel.systems.keys()).filter(k => k !== "commandRegistry" && k !== "commandManager");
            const allSystems = Array.from(new Set([...staticSystems, ...kernelSystems]));
            Registry.registerEnum("systemName", allSystems);
        } catch (e) {
            console.error(`[CommandManager] Failed to register systemName enum: ${e}`);
        }

        // Populate 'permission' enum
        Registry.registerEnum("permission", [
            "admin", "admin.system", "essentials.home", "essentials.sethome", "essentials.delhome", 
            "essentials.tpa", "essentials.tpaccept", "essentials.tpadeny", "essentials.tpacancel",
            "essentials.pay", "essentials.money", "essentials.withdraw", "essentials.shop",
            "essentials.sell", "essentials.rtp", "essentials.back", "essentials.menu",
            "essentials.auction", "essentials.calculate", "essentials.report", "essentials.tps",
            "essentials.admin.inspect", "essentials.admin.invsee", 
            "essentials.admin.ft", "essentials.admin.reports", "essentials.admin.economy", 
            "essentials.admin.ranks", "home.limit", "home.cooldown", "teleport.wait",
            // Sharded / Extended permission nodes:
            "admin.panel", "admin.ban", "admin.broadcast", "admin.economy", "admin.floatingtext",
            "admin.invsee", "admin.kick", "admin.landsetting", "admin.log", "admin.mute",
            "admin.ranks", "admin.resetdata", "admin.sellsetting", "admin.setting", "admin.shopsetting",
            "admin.warp", "admin.tp", "admin.gm.c", "admin.gm.s", "admin.gm.sp", "admin.gm.a",
            "land.claim", "land.unclaim", "land.invite", "land.kick", "land.transfer", "land.setting",
            "limit.land", "limit.home",
            "chestshop.create.sell", "chestshop.create.buy", "chestshop.sell", "chestshop.buy",
            "cooldown.chat", "cooldown.back", "cooldown.tpa", "cooldown.home", "cooldown.warp",
            "cooldown.rtp", "cooldown.command",
            "cost.back", "cost.tpa", "cost.home", "cost.warp", "cost.rtp",
            "essentials.help", "essentials.info", "essentials.credit", "essentials.default"
        ]);

        // Populate 'chatcolor' enum
        Registry.registerEnum("chatcolor", [
            "black", "dark_blue", "dark_green", "dark_aqua", "dark_red", "dark_purple",
            "gold", "gray", "dark_gray", "blue", "green", "aqua", "red", "light_purple",
            "yellow", "white", "rainbow", "bold", "strikethrough", "underline", "italic", "reset"
        ]);

        // Populate 'claimPermission' enum
        Registry.registerEnum("claimPermission", [
            "build", "chests", "doors", "containers", "all"
        ]);

        // Populate 'logCategory' enum
        Registry.registerEnum("logCategory", [
            "command", "msg"
        ]);

        // Populate 'economyAction' enum
        Registry.registerEnum("economyAction", [
            "give", "take", "set", "reset"
        ]);

        // Sync all enums to the native C++ engine
        Registry.getAllEnums().forEach(enumName => {
            try {
                const values = Registry.getEnum(enumName);
                // CRITICAL: Namespacing is MANDATORY for custom enums in this engine version.
                const namespacedName = enumName.includes(":") ? enumName : `${this._primaryNS}:${enumName}`;
                nativeReg.registerEnum(namespacedName, values);
                console.log(`[CommandManager] ENUM_SYNC: ${namespacedName} (${values.length} values)`);
            } catch (e) {
                console.error(`[CommandManager] ENUM_SYNC_FAILURE [${enumName}]: ${e}`);
            }
        });

        const registeredNames = new Set();
        // --- COMMAND_REGISTRATION_PIPELINE ---
        Registry.getAll().forEach(name => {
            const def = Registry.get(name);
            if (!def) return;

            if (def.chatRaw === true) {
                console.log(`[CommandManager] Skipping native registration for chatRaw command: ${name}`);
                return;
            }

            // Resolve parameters
            let paramsList = def.params || def.parameters || [];
            
            const namespacedName = name.includes(":") ? name : `${this._primaryNS}:${name}`;
            const lowerNS = namespacedName.toLowerCase();
            
            if (!registeredNames.has(lowerNS)) {
                registeredNames.add(lowerNS);
                const configs = this._generateConfigs(namespacedName, def, paramsList);
                configs.forEach(config => this._registerSingle(nativeReg, config, def));
            }
            
            // Register aliases
            if (def.aliases && Array.isArray(def.aliases)) {
                def.aliases.forEach(alias => {
                    const aliasNS = alias.includes(":") ? alias : `${this._aliasNS}:${alias}`;
                    if (registeredNames.has(aliasNS.toLowerCase())) return;
                    registeredNames.add(aliasNS.toLowerCase());
                    const aliasConfigs = this._generateConfigs(aliasNS, def, paramsList);
                    aliasConfigs.forEach(config => this._registerSingle(nativeReg, config, def));
                });
            }
        });

        console.log(`[CommandManager] Native C++ Command Registry sync complete`);
    },

    /**
     * Map string parameter types to native CustomCommandParamType enum values.
     * 
     * EXPECTS:
     * - type: String representing parameter type name.
     * 
     * GUARANTEES:
     * - Returns corresponding Kernel.CustomCommandParamType enum value.
     * - Returns null if parameter type is unrecognized.
     * 
     * @param {string} type - Parameter type string.
     * @returns {number|null} Native parameter type ID or null.
     */
    _mapParamType(type) {
        switch(type?.toLowerCase()) {
            case "player":
            case "playerselector":
                return Kernel.CustomCommandParamType.PlayerSelector; 
            case "entity":
            case "entityselector":
                return Kernel.CustomCommandParamType.EntitySelector;
            case "block":
            case "blocktype":
                return Kernel.CustomCommandParamType.BlockType;
            case "entitytype":
                return Kernel.CustomCommandParamType.EntityType;
            case "item":
            case "itemtype":
                return Kernel.CustomCommandParamType.ItemType;
            case "location":
                return Kernel.CustomCommandParamType.Location;
            case "float":
            case "double":
                return Kernel.CustomCommandParamType.Float;
            case "int":
            case "integer":
                return Kernel.CustomCommandParamType.Integer;
            case "bool":
            case "boolean":
                return Kernel.CustomCommandParamType.Boolean;
            case "string":
                return Kernel.CustomCommandParamType.String;
            case "enum":
                return Kernel.CustomCommandParamType.Enum;
            default:
                return null;
        }
    },

    /**
     * Registers a single command configuration natively.
     * 
     * EXPECTS:
     * - registry: Native custom command registry object.
     * - config: Formatted command configuration payload.
     * - def: Internal CommandDefinition structure.
     * 
     * GUARANTEES:
     * - Hooks command execution natively to dispatch logic catching execution panics.
     * - Returns native Success status status code on completion.
     */
    _registerSingle(registry, config, def) {
        try {
            registry.registerCommand(config, (origin, ...args) => {
                const player = origin.sourceEntity ? Kernel.wrapEntity(origin.sourceEntity) : null;
                this._dispatch(player, def, args, "NATIVE");
                return { status: Kernel.CustomCommandStatus.Success };
            });
        } catch (e) {
            console.error(`[CommandManager] FAILED_INJECTION [${config.name}]: ${e}`);
        }
    },


    /**
     * Dispatches command execution flow checking auth clearance and casting args.
     * 
     * EXPECTS:
     * - player: The executing player object.
     * - cmd: Command definition object.
     * - args: Array of input arguments.
     * - vector: Execution dispatch context ("NATIVE" or "CHAT").
     * 
     * GUARANTEES:
     * - Aborts if executing player is null.
     * - Verifies permissions using PermissionManager resolving tags or nodes.
     * - Enforces command cooldown limits.
     * - Sanitizes/unpacks native Selector, Location, and Block/Item type values.
     * - Checks mandatory inputs showing usage strings if lacking.
     * - Dispatches command execute/callback calls inside safety run locks.
     */
    _dispatch(player, cmd, args, vector) {
        if (!player) return;

        try {
            const PM = Kernel.get("permissions");
            
            // RBAC gate: verify clearance level before letting them do anything.
            if (!this._checkAuth(player, cmd.permission)) {
                player.sendMessage(`\u00A7c\u00A7l» \u00A77You lack the clearance level for this vector.`);
                return;
            }

            // Cooldown logic: stop players from spamming heavy SQL/DB database queries.
            const cooldownSec = PM ? (PM.getPermission(player, "command.cooldown") ?? 0) : 0;
            if (cooldownSec > 0) {
                const now = Kernel.system.currentTick;
                const last = player.getDynamicProperty("ae:last_cmd_tick") ?? 0;
                const diff = now - Number(last);
                
                if (diff < cooldownSec * 20) {
                    const remaining = Math.ceil((cooldownSec * 20 - diff) / 20);
                    player.sendMessage(`\u00A7c\u00A7l» \u00A77Slow down! Wait \u00A7e${remaining}s \u00A77before using another command.`);
                    return;
                }
                player.setDynamicProperty("ae:last_cmd_tick", now);
            }

            const paramsList = cmd.params || cmd.parameters;
            const isLegacy = !cmd.params && !!cmd.parameters;
            let rawArgs = args;
            if (vector === "NATIVE" && args.length === 1 && typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0]) && typeof args[0].isValid !== "function" && !args[0].id && !args[0].typeId && !("x" in args[0] && "y" in args[0] && "z" in args[0])) {
                const argsObj = args[0];
                rawArgs = (paramsList && paramsList.length > 0)
                    ? paramsList.map(param => argsObj[param.name])
                    : (argsObj.args !== undefined ? [argsObj.args] : Object.values(argsObj));
            }


            const cleanArgs = rawArgs.map((arg, index) => {
                if (arg === undefined) return undefined;

                const paramDef = paramsList ? paramsList[index] : null;
                if (!paramDef) return arg;

                const pType = paramDef.type;

                // Cast number parameters back to string if the original command parameter expects a string
                const isOriginalString = pType === "string" || pType === Kernel.CustomCommandParamType.String;
                if (isOriginalString && typeof arg === "number") {
                    arg = String(arg);
                }
                const isPlayerSelector = pType === Kernel.CustomCommandParamType.PlayerSelector || 
                    (typeof pType === "string" && pType.toLowerCase() === "player");
                const isEntitySelector = pType === Kernel.CustomCommandParamType.EntitySelector || 
                    (typeof pType === "string" && pType.toLowerCase() === "entity");
                const isLocation = pType === Kernel.CustomCommandParamType.Location || 
                    (typeof pType === "string" && pType.toLowerCase() === "location");
                const isBlockType = pType === Kernel.CustomCommandParamType.BlockType || 
                    (typeof pType === "string" && pType.toLowerCase() === "block");
                const isEntityType = pType === Kernel.CustomCommandParamType.EntityType || 
                    (typeof pType === "string" && pType.toLowerCase() === "entitytype");
                const isItemType = pType === Kernel.CustomCommandParamType.ItemType || 
                    (typeof pType === "string" && pType.toLowerCase() === "item");

                // Target Selectors (unpack the array)
                if (isPlayerSelector || isEntitySelector) {
                    const resolved = Array.isArray(arg) ? arg[0] : arg;
                    if (isLegacy) {
                        if (isPlayerSelector) {
                            return resolved?.name || String(arg);
                        } else {
                            return resolved?.nameTag || resolved?.typeId || String(arg);
                        }
                    }
                    return resolved;
                }

                // Locations (for legacy coords, stringify to "x y z")
                if (isLocation) {
                    if (isLegacy) {
                        if (arg && typeof arg === "object" && "x" in arg) {
                            return `${Math.floor(arg.x)} ${Math.floor(arg.y)} ${Math.floor(arg.z)}`;
                        }
                        return String(arg);
                    }
                    return arg;
                }

                // Type Objects (for legacy, return the string id)
                if (isBlockType || isEntityType || isItemType) {
                    if (isLegacy) {
                        return arg?.id || String(arg);
                    }
                    return arg;
                }

                // Numbers and booleans
                if (typeof arg === "number" || typeof arg === "boolean") {
                    return arg;
                }

                // Generic objects fallback
                if (typeof arg === "object" && arg !== null) {
                    if (arg.name) return isLegacy ? arg.name : arg;
                    return arg;
                }

                return String(arg);
            });

            // Automatic mandatory arguments validation.
            if (paramsList) {
                for (let i = 0; i < paramsList.length; i++) {
                    const paramDef = paramsList[i];
                    if (paramDef && paramDef.optional === false && (cleanArgs[i] === undefined || cleanArgs[i] === null || cleanArgs[i] === "")) {
                        player.sendMessage(`\u00A7c\u00A7l» \u00A77Usage: ${cmd.usage || ("/" + this._primaryNS + ":" + cmd.name)}`);
                        return;
                    }
                }
            }

            // system.run ensures we are safely locked inside the ticking thread loop.
            Kernel.system.run(() => {
                try {
                    if (typeof cmd.execute === "function") {
                        cmd.execute(null, player, cleanArgs);
                    } else if (typeof cmd.callback === "function") {
                        cmd.callback({ sourceEntity: player, sourceType: "Entity", vector }, cleanArgs);
                    }
                } catch (execError) {
                    if (execError instanceof FeatureDisabledError) {
                        player.sendMessage(`\u00A7c\u00A7l» \u00A77This feature is currently disabled.`);
                        return;
                    }
                    console.error(`[CommandManager] Command crash [${cmd.name}]:`, execError);
                    player.sendMessage(`\u00A7c\u00A7l» \u00A77Command execution failed due to an internal error.`);
                }
            });
        } catch (dispatchError) {
            console.error(`[CommandManager] Dispatch error [${cmd.name}]:`, dispatchError);
        }
    },

    /**
     * Resolves player object from offline/online name tags.
     * 
     * EXPECTS:
     * - query: String query (name tag or index).
     * 
     * GUARANTEES:
     * - Returns resolved player object, or undefined.
     * 
     * @param {string} query - Looked up player name/tag.
     * @returns {import("@minecraft/server").Player|undefined} Resolved player.
     */
    _resolvePlayer(query) {
        return PlayerUtils.findPlayer(query);
    },

    /**
     * Checks permission clearance for a given player and node.
     * 
     * EXPECTS:
     * - player: Executing player object.
     * - perm: String permission node node node.
     * 
     * GUARANTEES:
     * - Returns true if permission node is empty/null.
     * - Returns true if player has admin tag and PM is missing.
     * - Returns result of PM.hasPermission check.
     */
    _checkAuth(player, perm) {
        if (!perm) return true;
        const PM = Kernel.get("permissions");
        if (!PM) return player.hasTag("admin");
        return PM.hasPermission(player, perm);
    },

    /**
     * Maps command registry permissions.
     */
    _mapPerms() {
        return Kernel.CommandPermissionLevel.Any;
    },

    /**
     * Generates command configuration array list for native registration.
     */
    _generateConfigs(finalName, def, paramsList) {
        if (!paramsList || paramsList.length === 0) {
            return [{
                name: finalName,
                description: def.description || "Aethelgrad Command Vector",
                permissionLevel: Kernel.CommandPermissionLevel.Any,
                mandatoryParameters: [],
                optionalParameters: [
                    { name: "args", type: Kernel.CustomCommandParamType.String }
                ]
            }];
        }

        return [this._buildConfig(finalName, def, paramsList)];
    },

    /**
     * Builds command configuration payload for native registry mappings.
     */
    _buildConfig(finalName, def, paramsList) {
        const mandatory = [];
        const optional = [];

        if (paramsList && Array.isArray(paramsList)) {
            const Registry = Kernel.get("commandRegistry");
            paramsList.forEach(p => {
                let pType = p.type;
                let enumName = null;

                if (typeof pType === "string") {
                    const standardType = this._mapParamType(pType);
                    if (standardType) {
                        pType = standardType;
                    } else if (Registry && Registry.hasEnum && Registry.hasEnum(pType)) {
                        enumName = pType.includes(":") ? pType : `${this._primaryNS}:${pType}`;
                        pType = Kernel.CustomCommandParamType.Enum;
                    } else {
                        pType = Kernel.CustomCommandParamType.String;
                    }
                }

                const derived = {
                    name: p.name,
                    type: pType
                };

                if (enumName) {
                    derived.enumName = enumName;
                    derived.enum = enumName;
                }

                if (p.optional) {
                    optional.push(derived);
                } else {
                    mandatory.push(derived);
                }
            });
        }

        return {
            name: finalName,
            description: def.description || "AethelLib command",
            // Must be false — Bedrock defaults to true, which silently blocks
            // commands on survival servers that don't have cheats enabled.
            cheatsRequired: false,
            permissionLevel: Kernel.CommandPermissionLevel.Any,
            mandatoryParameters: mandatory,
            optionalParameters: optional
        };
    },

    refreshAliases() {
        const Registry = Kernel.get("commandRegistry");
        if (!Registry) return;

        const allNames = Registry.getAll();
        const aliasNames = new Set();

        for (const name of allNames) {
            const def = Registry.get(name);
            if (!def || !def.aliases || !Array.isArray(def.aliases)) continue;

            for (const alias of def.aliases) {
                const lowerAlias = alias.toLowerCase();
                // Avoid re-processing the same alias
                if (aliasNames.has(lowerAlias)) continue;
                aliasNames.add(lowerAlias);

                // Re-register the alias mapping in the command registry
                Registry.register(alias, def);
            }
        }

        console.log(`[CommandManager] Aliases refreshed: ${aliasNames.size} aliases mapped.`);
    },
    
    /**
     * Wipes active listeners and resets the initialization state.
     * 
     * EXPECTS:
     * - None.
     * 
     * GUARANTEES:
     * - Unsubscribes from beforeEvents.startup listener.
     * - Sets _isInitialized back to false.
     */
    shutdown() {
        if (this._startupTa) {
            try { Kernel.system.beforeEvents.startup.unsubscribe(this._startupTa); } catch(e) {}
            this._startupTa = null;
        }
        this._isInitialized = false;
        console.log(`[CommandManager] Offline.`);
    }
};
