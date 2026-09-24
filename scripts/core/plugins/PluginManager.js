import { Kernel } from "../Kernel.js"
import { DependencySorter } from "../../utils/DependencySorter.js"

// Manages plugin loading, dependency ordering, and resource tracking.
export const PluginManager = {
    _plugins: new Map(),
    _apis: new Map(), // Public APIs exposed by plugins
    _commandManifests: new Map(), // pluginId -> { manifest, commands, logic }

    /**
     * Creates a scoped context object for a plugin.
     * 
     * EXPECTS:
     * - manifest: Plugin manifest metadata object.
     * 
     * GUARANTEES:
     * - Returns a secure, scoped sandbox context object.
     * - Restricts database updates to aNamespaced plugin prefix to prevent database contamination.
     * - Wraps native interval, timeout, and event registration calls.
     * - Tracks and records active resources privately to facilitate absolute cleanup during reloads.
     * 
     * DOES NOT PROMISE:
     * - Mutex database locking between threads.
     * 
     * @param {Object} manifest - Plugin manifest.
     * @returns {Object} Scoped plugin context.
     */
    _createContext(manifest) {
        const activeIntervals = [];
        const activeTimeouts = [];
        const activeListeners = new Map(); // Map of callback -> Map of originalEvent -> unsubscribe function

        // Pre-create event proxies once per context to prevent GC pressure
        const createEventProxy = (sourceObj) => new Proxy({}, {
            get(eventsDummyTarget, eventName) {
                const originalEvent = sourceObj[eventName];
                if (originalEvent && typeof originalEvent.subscribe === "function") {
                    return {
                        subscribe: (callback, options) => {
                            if (options !== undefined) {
                                originalEvent.subscribe(callback, options);
                            } else {
                                originalEvent.subscribe(callback);
                            }
                            const unsubscribe = () => {
                                try { originalEvent.unsubscribe(callback); } catch(e) {}
                                const eventMap = activeListeners.get(callback);
                                if (eventMap) {
                                    eventMap.delete(originalEvent);
                                    if (eventMap.size === 0) activeListeners.delete(callback);
                                }
                            };
                            if (!activeListeners.has(callback)) {
                                activeListeners.set(callback, new Map());
                            }
                            activeListeners.get(callback).set(originalEvent, unsubscribe);
                            return callback;
                        },
                        unsubscribe: (callback) => {
                            const eventMap = activeListeners.get(callback);
                            if (eventMap) {
                                const unsubscribe = eventMap.get(originalEvent);
                                if (unsubscribe) {
                                    unsubscribe();
                                } else {
                                    try { originalEvent.unsubscribe(callback); } catch(e) {}
                                }
                            } else {
                                try { originalEvent.unsubscribe(callback); } catch(e) {}
                            }
                        }
                    };
                }
                return originalEvent;
            }
        });


        const cachedBeforeEvents = createEventProxy(Kernel.world.beforeEvents);
        const cachedAfterEvents = createEventProxy(Kernel.world.afterEvents);

        const context = {
            manifest,
            // db wrapper. forces a prefix so plugins don't overwrite each other's keys.
            db: {
                get: (key) => Kernel.get("database").get(`plugin:${manifest.id}:${key}`),
                set: (key, val) => Kernel.get("database").set(`plugin:${manifest.id}:${key}`, val),
                delete: (key) => Kernel.get("database").delete(`plugin:${manifest.id}:${key}`)
            },
            // api exposure. how plugins talk to each other without circular imports.
            exportAPI: (apiObject) => {
                this._apis.set(manifest.id, apiObject);
                console.log(`[PluginManager] API bound: ${manifest.id}`);
            },
            // api consumption. throws if the dependency isn't loaded yet.
            requireAPI: (pluginId) => {
                if (!this._apis.has(pluginId)) {
                    throw new Error(`[PluginManager] Missing API for dependency: ${pluginId}. Check load order.`);
                }
                return this._apis.get(pluginId);
            },
            // safe core access
            getService: (id) => Kernel.get(id),
            registerCommand: (cmd) => {
                const registry = Kernel.get("commandRegistry");
                if (!registry) {
                    console.error(`[PluginManager] Failed to register command for '${manifest.id}': commandRegistry is offline.`);
                    return;
                }
                registry.register(cmd);
            },
            log: (msg) => console.log(`\u00A78[\u00A7b${manifest.id}\u00A78] \u00A7f${msg}`),
            error: (msg) => console.error(`\u00A78[\u00A7c${manifest.id}\u00A78] \u00A7cERROR: ${msg}`),

            // Proxied engine interfaces for resource tracking
            system: new Proxy({}, {
                get(dummyTarget, prop) {
                    if (prop === "runInterval") {
                        return (callback, ticks) => {
                            const id = Kernel.system.runInterval(callback, ticks);
                            activeIntervals.push(id);
                            return id;
                        };
                    }
                    if (prop === "runTimeout") {
                        return (callback, ticks) => {
                            const id = Kernel.system.runTimeout(callback, ticks);
                            activeTimeouts.push(id);
                            return id;
                        };
                    }
                    if (prop === "clearRun") {
                        return (id) => {
                            Kernel.system.clearRun(id);
                            const intIdx = activeIntervals.indexOf(id);
                            if (intIdx !== -1) activeIntervals.splice(intIdx, 1);
                            const timeoutIdx = activeTimeouts.indexOf(id);
                            if (timeoutIdx !== -1) activeTimeouts.splice(timeoutIdx, 1);
                        };
                    }
                    const val = Kernel.system[prop];
                    if (typeof val === "function") return val.bind(Kernel.system);
                    return val;
                }
            }),

            world: new Proxy({}, {
                get(dummyTarget, prop) {
                    if (prop === "afterEvents") return cachedAfterEvents;
                    if (prop === "beforeEvents") return cachedBeforeEvents;
                    const val = Kernel.world[prop];
                    if (typeof val === "function") return val.bind(Kernel.world);
                    return val;
                }
            })
        };

        // Attach resources tracking to the context object privately
        context._resources = { activeIntervals, activeTimeouts, activeListeners };
        return context;
    },

    /**
     * Dynamically imports a plugin module and extracts its command definitions.
     * 
     * EXPECTS:
     * - pluginDef: Object containing paths and dynamic loaders.
     * 
     * GUARANTEES:
     * - Imports logic main blocks, validates manifests structure, and extracts exported commands.
     * - Registers the loaded plugin context in the registry setting state to LOADED.
     * - Returns loaded plugin ID on success, null on crash.
     * 
     * @param {Object} pluginDef - Plugin definition config.
     * @returns {Promise<string|null>} Plugin ID.
     */
    async extractCommands(pluginDef) {
        try {
            const module = await pluginDef.loader();
            const manifest = module.manifest;
            const logic = module.main || module.default;

            if (!manifest || !logic) {
                console.error(`[PluginManager] FATAL: Module at '${pluginDef.path}' is missing exports. Check manifest/main.`);
                return null;
            }

            // Extract commands from the plugin's exported command objects
            const commands = [];
            if (typeof module.getCommands === 'function') {
                commands.push(...module.getCommands());
            } else if (typeof logic.getCommands === 'function') {
                commands.push(...logic.getCommands());
            } else {
                // Fallback: scan for exported command objects (convention: *Command.js exports)
                for (const key of Object.keys(module)) {
                    if (key.endsWith('Command') && module[key] && typeof module[key].execute === 'function') {
                        commands.push(module[key]);
                    }
                }
            }

            this._commandManifests.set(manifest.id, { manifest, commands, logic });
            
            // Set initial state
            this._plugins.set(manifest.id, {
                manifest,
                logic,
                context: this._createContext(manifest),
                state: "LOADED"
            });

            return manifest.id;
        } catch (error) {
            console.error(`[PluginManager] IMPORT CRASH '${pluginDef.path}':`, error);
            return null;
        }
    },

    /**
     * Staging phase: Registers all commands to native C++ command registry.
     * 
     * EXPECTS:
     * - CommandRegistry service is active in the Kernel.
     * 
     * GUARANTEES:
     * - Executes optional onStage hooks on logic blocks.
     * - Automatically registers all command schemas through the CommandRegistry.
     * - Updates plugin state to STAGED.
     */
    stageAllSync() {
        for (const [id, data] of this._commandManifests.entries()) {
            const { manifest, commands, logic } = data;
            const plugin = this._plugins.get(id);
            if (!plugin) continue;
            
            const context = plugin.context;

            // Allow manual registration via onStage hook if they prefer it over getCommands
            if (typeof logic.onStage === "function") {
                try {
                    logic.onStage(context);
                } catch(e) {
                    console.error(`[PluginManager] onStage Crash in ${id}: ${e}`);
                }
            }

            // Register extracted commands with the command registry
            for (const cmd of commands) {
                if (!cmd) continue;
                try {
                    cmd.context = context;
                    context.registerCommand(cmd);
                } catch (e) {
                    console.error(`[PluginManager] Failed to register command ${cmd?.name || "unknown"} from ${manifest.id}: ${e}`);
                }
            }
            
            plugin.state = "STAGED";
        }
    },

    /**
     * Enabling phase: Resolves dependencies and enables plugins sequentially.
     * 
     * EXPECTS:
     * - DependencySorter to resolve topological order without error.
     * 
     * GUARANTEES:
     * - Topologically sorts execution sequence based on manifest dependency chains.
     * - Sequentially triggers onEnable lifecycle hooks on all staged modules.
     * - Safely catches initialization rejections setting status to FAILED.
     * 
     * DOES NOT PROMISE:
     * - Successful bootstrapping of modules if circular dependency blocks occur.
     */
    async enableAll() {
        console.log(`[PluginManager] Resolving dependency graph...`);
        let sortedIds = [];
        try {
            sortedIds = this._resolveDependencies();
        } catch (error) {
            console.error(`[PluginManager] DEPENDENCY_RESOLUTION_CRASH: Graph resolution failed due to circular bounds. Falling back to raw load order.`, error);
            sortedIds = Array.from(this._plugins.keys());
        }
        
        let successCount = 0;
        
        // boot sequence. strictly ordered to prevent undefined references.
        for (const id of sortedIds) {
            const plugin = this._plugins.get(id);
            if (!plugin) continue;

            try {
                plugin.state = "ENABLING";
                
                // support both class-based lifecycle hooks and raw functions.
                if (typeof plugin.logic.onEnable === "function") {
                    await plugin.logic.onEnable(plugin.context);
                } else if (typeof plugin.logic === "function") {
                    await plugin.logic(plugin.context);
                }

                plugin.state = "ACTIVE";
                successCount++;
            } catch (error) {
                console.error(`[PluginManager] BOOT FAILURE in '${id}':`, error);
                plugin.state = "FAILED";
            }
        }
        console.log(`[PluginManager] System Online. Active modules: ${successCount}/${this._plugins.size}`);
    },

    /**
     * Calls DependencySorter topological sort algorithm.
     */
    _resolveDependencies() {
        return DependencySorter.sort(Array.from(this._plugins.keys()), {
            getDependencies: (id) => this._plugins.get(id)?.manifest?.dependencies || [],
            hasNode: (id) => this._plugins.has(id),
            onMissingDependency: (id, dep) => {
                console.warn(`[PluginManager] WARNING: '${id}' requires missing module '${dep}'. Expect crashes.`);
            },
            errorMessagePrefix: "CIRCULAR DEPENDENCY DETECTED: "
        });
    },

    /**
     * Hot-reloads an active plugin dynamically purging its registered resources.
     * 
     * EXPECTS:
     * - pluginId: Active plugin identifier (e.g. "aethel:core_economy" or path "CoreEconomy").
     * - PluginLoader modules registry exists in workspace.
     * 
     * GUARANTEES:
     * - Executes onDisable hooks on the active target.
     * - Unregisters all native commands associated with the module.
     * - Safely cancels and clears all registered intervals, timeouts, and listeners for this plugin.
     * - Deletes plugin from all registry maps.
     * - Reloads plugin module via the registered loader.
     * - Instantiates, stages, and enables the new loaded plugin module.
     * 
     * DOES NOT PROMISE:
     * - Restoring state variables stored in memory outside persistent database wrappers.
     * 
     * @param {string} pluginId - Plugin ID or path.
     * @returns {Promise<string>} Reloaded plugin ID.
     */
    async reloadPlugin(pluginId) {
        // Find matching active plugin by id (e.g. "aethel:core_economy") or path (e.g. "CoreEconomy")
        let activePluginId = null;
        let matchedDef = null;

        for (const [id, plugin] of this._plugins.entries()) {
            if (id === pluginId || id.toLowerCase() === pluginId.toLowerCase()) {
                activePluginId = id;
                break;
            }
            if (plugin.manifest.name && plugin.manifest.name.toLowerCase() === pluginId.toLowerCase()) {
                activePluginId = id;
                break;
            }
        }

        // Search in pluginDefs
        const { pluginDefs } = await import("../../plugins/PluginLoader.js");
        for (const def of pluginDefs) {
            if (def.path === pluginId || def.path.toLowerCase() === pluginId.toLowerCase()) {
                matchedDef = def;
                break;
            }
        }

        // If we found an active plugin ID but no matchedDef, match by name mapping
        if (activePluginId && !matchedDef) {
            const suffix = activePluginId.split(":")[1]; // e.g. "core_economy"
            matchedDef = pluginDefs.find(d => {
                const normPath = d.path.toLowerCase().replace(/_/g, "");
                const normSuffix = suffix?.toLowerCase().replace(/_/g, "");
                return normPath === normSuffix || normPath.includes(normSuffix) || normSuffix.includes(normPath);
            });
        }

        if (!matchedDef) {
            throw new Error(`Plugin definition for '${pluginId}' not found in PluginLoader.`);
        }

        const targetId = activePluginId || matchedDef.path;

        // 1. Unload the plugin if it's currently active/staged
        if (this._plugins.has(targetId)) {
            const plugin = this._plugins.get(targetId);
            
            // Run onDisable
            if (plugin.state === "ACTIVE" && typeof plugin.logic.onDisable === "function") {
                try {
                    await plugin.logic.onDisable(plugin.context);
                } catch (e) {
                    console.error(`[PluginManager] Error disabling plugin '${targetId}' during reload: ${e}`);
                }
            }

            // Unregister commands
            const registry = Kernel.get("commandRegistry");
            const commandData = this._commandManifests.get(targetId);
            if (registry && commandData && commandData.commands) {
                for (const cmd of commandData.commands) {
                    if (cmd && cmd.name) {
                        registry.unregister(cmd.name);
                    }
                }
            }

            // Clean up plugin resources (intervals, timeouts, listeners)
            const context = plugin.context;
            if (context && context._resources) {
                const { activeIntervals, activeTimeouts, activeListeners } = context._resources;

                activeIntervals.forEach(id => {
                    try { Kernel.system.clearRun(id); } catch (e) {
                        console.error(`[PluginManager] Failed clearing interval during reload of ${targetId}: ${e}`);
                    }
                });

                activeTimeouts.forEach(id => {
                    try { Kernel.system.clearRun(id); } catch (e) {
                        console.error(`[PluginManager] Failed clearing timeout during reload of ${targetId}: ${e}`);
                    }
                });

                // Collect unsubscribe closures first to avoid mutation while iterating
                const unsubscribes = [];
                for (const eventMap of activeListeners.values()) {
                    for (const unsubscribe of eventMap.values()) {
                        unsubscribes.push(unsubscribe);
                    }
                }
                for (const unsubscribe of unsubscribes) {
                    try { unsubscribe(); } catch (e) {
                        console.error(`[PluginManager] Failed unsubscribing event listener during reload of ${targetId}: ${e}`);
                    }
                }
                activeListeners.clear();
            }


            // Remove from maps
            this._plugins.delete(targetId);
            this._commandManifests.delete(targetId);
            this._apis.delete(targetId);
        }

        // Re-import via the registered loader. Note: Bedrock's QuickJS engine caches
        // modules statically — hot-reloading reflects config/state changes only,
        // not code changes. A full server restart is needed for code changes.
        const module = await matchedDef.loader();

        const manifest = module.manifest;
        const logic = module.main || module.default;

        if (!manifest || !logic) {
            throw new Error(`Plugin module at '${matchedDef.path}' is missing exports (manifest/main).`);
        }

        const newId = manifest.id;

        // Extract commands
        const commands = [];
        if (typeof module.getCommands === 'function') {
            commands.push(...module.getCommands());
        } else if (typeof logic.getCommands === 'function') {
            commands.push(...logic.getCommands());
        } else {
            for (const key of Object.keys(module)) {
                if (key.endsWith('Command') && module[key] && typeof module[key].execute === 'function') {
                    commands.push(module[key]);
                }
            }
        }

        this._commandManifests.set(newId, { manifest, commands, logic });

        const context = this._createContext(manifest);
        this._plugins.set(newId, {
            manifest,
            logic,
            context,
            state: "LOADED"
        });

        // Stage commands (register them)
        if (typeof logic.onStage === "function") {
            try {
                logic.onStage(context);
            } catch(e) {
                console.error(`[PluginManager] onStage Crash in ${newId}: ${e}`);
            }
        }

        // Register extracted commands with the command registry
        for (const cmd of commands) {
            if (!cmd) continue;
            cmd.context = context;
            context.registerCommand(cmd);
        }

        this._plugins.get(newId).state = "STAGED";

        // Enable plugin (onEnable)
        this._plugins.get(newId).state = "ENABLING";
        if (typeof logic.onEnable === "function") {
            await logic.onEnable(context);
        } else if (typeof logic === "function") {
            await logic(context);
        }

        this._plugins.get(newId).state = "ACTIVE";
        console.log(`[PluginManager] Plugin '${newId}' successfully hot-reloaded!`);
        return newId;
    }
}
