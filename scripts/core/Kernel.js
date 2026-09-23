import * as mc from "@minecraft/server";
import * as mcui from "@minecraft/server-ui";
import { TickScheduler } from "./scheduler/TickScheduler.js";
import { SignalBus } from "./signalbus/SignalBus.js";

// Kernel: central service registration, plugin lifecycle management, and native API proxies.
export class Kernel {
    // Registry of core system instances
    static #systems = new Map();
    // Registry of shared services exposed by plugins
    static #serviceProviders = new Map();
    // Set of disabled system IDs
    static #disabledSystems = new Set();
    // Cached system proxy instance
    static #systemProxy = null;
    // Cached null function callbacks for disabled systems
    static #nullFunctions = new Map();

    // Global world instance
    static get world() { return mc.world; }

    /**
     * Gets the system proxy for tick management.
     * 
     * EXPECTS:
     * - mc.system to be defined in native environment.
     * 
     * GUARANTEES:
     * - Returns a wrapped system object proxy.
     * - Falls back to a Date-based tick calculation if currentTick throws.
     * - Binds methods to target to avoid execution context loss.
     * 
     * DOES NOT PROMISE:
     * - Match exact game tick timing under server lag.
     * 
     * @returns {Object} The system proxy or raw system object.
     */
    static get system() {
        if (!this.#systemProxy) {
            try {
                this.#systemProxy = new Proxy(mc.system, {
                    get(target, prop) {
                        if (prop === "currentTick") {
                            try {
                                const tick = target.currentTick;
                                if (typeof tick === "number") return tick;
                            } catch (e) {}
                            return Math.floor(Date.now() / 50);
                        }
                        const val = Reflect.get(target, prop);
                        if (typeof val === "function") return val.bind(target);
                        return val;
                    }
                });
                Object.freeze(this.#systemProxy);
            } catch (e) {
                console.error(`[Kernel] FATAL: Failed to create system proxy: ${e}. Falling back to raw mc.system.`);
                return mc.system;
            }
        }
        return this.#systemProxy;
    }

    // Number of active services
    static get size() { return this.#systems.size; }

    // Map of registered systems
    static get systems() { return this.#systems; }

    // Set of disabled systems
    static get disabledSystems() { return this.#disabledSystems; }

    // Native type proxies
    static get ItemStack() { return mc.ItemStack; }
    static get EntityComponentTypes() {
        return mc.EntityComponentTypes || {
            Inventory: "minecraft:inventory",
            Equippable: "minecraft:equippable",
            Health: "minecraft:health"
        };
    }
    static get SignSide() { return mc.SignSide; }
    static get CustomCommandStatus() { return mc.CustomCommandStatus; }
    static get CustomCommandParamType() { return mc.CustomCommandParamType; }
    static get CommandPermissionLevel() { return mc.CommandPermissionLevel; }
    static get GameMode() { return mc.GameMode; }
    static get EquipmentSlot() {
        return mc.EquipmentSlot || {
            Head: "Head",
            Chest: "Chest",
            Legs: "Legs",
            Feet: "Feet",
            Offhand: "Offhand",
            Mainhand: "Mainhand"
        };
    }
    static get BlockPermutation() { return mc.BlockPermutation; }
    static get BlockComponentTypes() { return mc.BlockComponentTypes; }
    static get InputPermissionCategory() { return mc.InputPermissionCategory; }

    // Native UI proxies
    static get ActionFormData() { return mcui.ActionFormData; }
    static get ModalFormData() { return mcui.ModalFormData; }
    static get MessageFormData() { return mcui.MessageFormData; }

    /**
     * Wraps a native entity or player in a stable safe proxy.
     * 
     * EXPECTS:
     * - entity: Object representing a native Bedrock entity or player, or null.
     * 
     * GUARANTEES:
     * - Returns the entity directly if it is falsy, not an object, or already wrapped.
     * - Traps property access on the entity to prevent C++ crashes if the entity is invalid.
     * - Provides dummy/mock fallback values for properties (isValid, location, dimension, name, etc.) if entity is invalid.
     * 
     * DOES NOT PROMISE:
     * - Full functional emulation of arbitrary entity properties that are not trapped when invalid.
     * 
     * @param {Object} entity - The native entity to wrap.
     * @returns {Object} The wrapped entity proxy or original entity.
     */
    static wrapEntity(entity) {
        if (!entity || typeof entity !== "object") return entity;
        
        // Return entity if it is already wrapped in a safe proxy
        if (entity.__rawEntity__) return entity;

        return new Proxy(entity, {
            get(target, prop, receiver) {
                if (prop === "__rawEntity__") return target;

                let isValid = false;
                try {
                    isValid = target.isValid;
                } catch (e) {}

                if (!isValid) {
                    if (prop === "isValid") return false;
                    if (prop === "location") return { x: 0, y: 0, z: 0 };
                    if (prop === "dimension") {
                        return {
                            id: "minecraft:overworld",
                            runCommand: () => ({ successCount: 0 }),
                            runCommandAsync: () => Promise.resolve({ successCount: 0 }),
                            getBlock: () => null,
                            spawnEntity: () => null
                        };
                    }
                    if (prop === "name" || prop === "nameTag" || prop === "id" || prop === "typeId") {
                        try { return target[prop]; } catch (e) { return ""; }
                    }
                    
                    const dummyVal = undefined;
                    try {
                        const original = target[prop];
                        if (typeof original === "function") {
                            return () => dummyVal;
                        }
                    } catch (e) {}
                    return dummyVal;
                }

                const val = Reflect.get(target, prop);
                if (typeof val === "function") {
                    return val.bind(target);
                }
                return val;
            }
        });
    }

    /**
     * Registers a core system instance in the kernel.
     * 
     * EXPECTS:
     * - id: String identifier for the system (must not be empty).
     * - instance: Object representing the system.
     * 
     * GUARANTEES:
     * - Stores the instance in the internal systems map.
     * - Logs a warning if registering over an existing identifier.
     * 
     * DOES NOT PROMISE:
     * - Prevention of service overwrites if identifier collision occurs.
     * 
     * @param {string} id - The system identifier.
     * @param {Object} instance - The system instance.
     */
    static register(id, instance) {
        if (this.#systems.has(id)) {
            console.warn(`[Kernel] Service collision: identifier '${id}' is already registered. Overwriting.`);
        }
        this.#systems.set(id, instance);
        console.log("[Kernel] Service registered: " + id);
    }

    /**
     * Resolves a registered system or service by its identifier.
     * 
     * EXPECTS:
     * - id: String identifier of the target service.
     * 
     * GUARANTEES:
     * - Returns the registered system instance or plugin service provider.
     * - Returns a null object proxy if the system is registered but disabled.
     * - Returns undefined if the service does not exist in any registry.
     * 
     * DOES NOT PROMISE:
     * - Preservation of the same service instance reference if system state changes between active and disabled.
     * 
     * @param {string} id - The service identifier.
     * @returns {Object|undefined} The service instance, null object proxy, or undefined.
     */
    static get(id) {
        if (this.#disabledSystems.has(id)) {
            const instance = this.#systems.get(id) || this.#serviceProviders.get(id);
            return this.#createNullProxy(id, instance);
        }
        return this.#systems.get(id) || this.#serviceProviders.get(id);
    }

    /**
     * Creates a Null Object Pattern proxy to prevent TypeError crashes when calling disabled systems.
     * 
     * EXPECTS:
     * - id: String identifier of the disabled system.
     * - instance: Object representing the disabled service instance, or null.
     * 
     * GUARANTEES:
     * - Returns a Proxy wrapping the instance or an empty object.
     * - Intercepts calls to functions and returns default types (e.g. 0, false, empty array, or resolved promise).
     * - Intercepts property accesses and returns safe defaults based on naming heuristics.
     * 
     * DOES NOT PROMISE:
     * - Complete equivalence to the actual active system's functionality.
     * 
     * @param {string} id - The system identifier.
     * @param {Object|null} instance - The original system instance, if any.
     * @returns {Proxy} A safe proxy returning default values.
     * @private
     */
    static #createNullProxy(id, instance) {
        const target = instance || {};
        
        return new Proxy(target, {
            get(obj, prop, receiver) {
                if (prop === "then") return undefined;
                if (prop === "toJSON") return () => null;
                if (prop === "valueOf") return () => 0;
                if (prop === "toString") return () => `[DisabledSystemProxy:${id}]`;
                if (prop === Symbol.toPrimitive) {
                    return (hint) => {
                        if (hint === "number") return 0;
                        if (hint === "string") return "";
                        return false;
                    };
                }

                let originalValue;
                try {
                    originalValue = obj[prop];
                } catch (e) {}

                if (typeof originalValue === "function") {
                    if (Kernel.#nullFunctions.has(prop)) {
                        return Kernel.#nullFunctions.get(prop);
                    }
                    
                    const fn = (...args) => {
                        const name = String(prop).toLowerCase();
                        
                        if (originalValue.constructor.name === "GeneratorFunction") {
                            return (function*() {})();
                        }

                        const isAsync = originalValue.constructor.name === "AsyncFunction" || 
                                         name.startsWith("async") || 
                                         name.includes("transaction") || 
                                         name.includes("transfer") || 
                                         name.includes("setbalance") || 
                                         name.includes("addmoney") || 
                                         name.includes("removemoney") || 
                                         name.includes("hasenough");

                        let val;
                        if (name.startsWith("get") || name.includes("balance") || name.includes("count") || name.includes("price") || name.includes("size") || name.includes("amount")) {
                            if (name.includes("player") || name.includes("account") || name.includes("system") || name.includes("service")) {
                                val = null;
                            } else if (name.includes("leaderboard") || name.includes("balances") || name.includes("list") || name.includes("all")) {
                                val = [];
                            } else {
                                val = 0;
                            }
                        } else if (name.startsWith("is") || name.startsWith("has") || name.startsWith("can") || name.startsWith("pay") || name.startsWith("charge") || name.startsWith("withdraw") || name.startsWith("deposit") || name.startsWith("save") || name.startsWith("set") || name.startsWith("delete") || name.startsWith("remove") || name.startsWith("add") || name.startsWith("update") || name.startsWith("disable") || name.startsWith("enable") || name.startsWith("transfer")) {
                            val = false;
                        } else {
                            val = undefined;
                        }

                        return isAsync ? Promise.resolve(val) : val;
                    };
                    
                    Kernel.#nullFunctions.set(prop, fn);
                    return fn;
                }

                const name = String(prop).toLowerCase();
                if (name.includes("balance") || name.includes("limit") || name.includes("default")) {
                    return 0;
                }

                return undefined;
            }
        });
    }

    /**
     * Determines whether a service is registered and active.
     * 
     * EXPECTS:
     * - id: String identifier of the service.
     * 
     * GUARANTEES:
     * - Returns false if the system is disabled.
     * - Returns true if the system exists in the systems or service providers maps.
     * - Returns false otherwise.
     * 
     * DOES NOT PROMISE:
     * - Check for underlying instance health or operational status.
     * 
     * @param {string} id - The system identifier.
     * @returns {boolean} Whether the service is registered and active.
     */
    static has(id) {
        if (this.#disabledSystems.has(id)) return false;
        return this.#systems.has(id) || this.#serviceProviders.has(id);
    }

    /**
     * Disables a registered system and executes its shutdown hooks.
     * 
     * EXPECTS:
     * - id: String identifier of the target system to disable.
     * 
     * GUARANTEES:
     * - Returns false if the system is already disabled.
     * - Calls the system's shutdown hook (shutdown, onDisable, or disable) if it exists.
     * - Adds the system identifier to the disabled systems set.
     * - Returns true upon successful disabling.
     * 
     * DOES NOT PROMISE:
     * - Safe recovery if the shutdown hook throws an error.
     * 
     * @param {string} id - The system identifier.
     * @returns {boolean} Whether the system was successfully disabled.
     */
    static disableSystem(id) {
        if (this.#disabledSystems.has(id)) return false;

        const instance = this.#systems.get(id) || this.#serviceProviders.get(id);
        if (instance) {
            try {
                if (typeof instance.shutdown === "function") {
                    instance.shutdown();
                } else if (typeof instance.onDisable === "function") {
                    instance.onDisable();
                } else if (typeof instance.disable === "function") {
                    instance.disable();
                }
            } catch (e) {
                console.error(`[Kernel] Error during system '${id}' shutdown hook: ${e}`);
            }
        }
        this.#disabledSystems.add(id);
        return true;
    }

    /**
     * Enables a disabled system and executes its initialization hooks.
     * 
     * EXPECTS:
     * - id: String identifier of the target system to enable.
     * 
     * GUARANTEES:
     * - Returns false if the system is not currently disabled.
     * - Removes the system identifier from the disabled systems set.
     * - Calls the system's initialization hook (init, onEnable, or enable) if it exists.
     * - Returns true upon successful enabling.
     * 
     * DOES NOT PROMISE:
     * - Prevention of errors if initialization fails.
     * 
     * @param {string} id - The system identifier.
     * @returns {boolean} Whether the system was successfully enabled.
     */
    static enableSystem(id) {
        if (!this.#disabledSystems.has(id)) return false;

        this.#disabledSystems.delete(id);

        const instance = this.#systems.get(id) || this.#serviceProviders.get(id);
        if (instance) {
            try {
                if (typeof instance.init === "function") {
                    instance.init();
                } else if (typeof instance.onEnable === "function") {
                    instance.onEnable();
                } else if (typeof instance.enable === "function") {
                    instance.enable();
                }
            } catch (e) {
                console.error(`[Kernel] Error during system '${id}' init hook: ${e}`);
            }
        }
        return true;
    }
}
