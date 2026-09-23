import { Kernel } from "../Kernel.js";
import { JournaledDb } from "../datastore/JournaledDatabase.js";

/*
 * INDUSTRIAL_CLEANUP_ORCHESTRATOR
 * ----------------------------------------------------------------------------
 * A high-performance maintenance engine designed to prevent memory-leaks 
 * and data-buffer saturation. Orchestrates the de-registration of entity 
 * data across multiple industrial sub-systems upon session termination.
 *
 * PHILOSOPHY: Stale data is technical debt. When an entity leaves the 
 * buffer, its associated state must be purged to maintain Kernel.system 
 * integrity.
 */
export class CleanupService {
    /**
     * EXPECTS:
     * - None.
     * 
     * GUARANTEES:
     * - Instantiates the cleanupHandlers registry Map.
     * - Binds default values to initialization and listener trackers.
     */
    constructor() {
        this.cleanupHandlers = new Map() // REGISTRY_OF_PURGE_VECTORS
        this._isInitialized = false
        this.playerLeaveSubscription = null
        this.cleanupIntervalId = null
    }

    get _initialized() { return this._isInitialized; }
    set _initialized(val) { this._isInitialized = val; }

    /**
     * Registers unified playerLeave event subscription and schedules maintenance interval.
     * 
     * EXPECTS:
     * - Kernel.world.afterEvents.playerLeave exists.
     * - Kernel.system exists.
     * 
     * GUARANTEES:
     * - Prevents duplicate initialization subscriptions.
     * - Registers playerLeave listener and records reference to prevent leaks.
     * - Runs performPeriodicCleanup recurringly every 5 minutes (6000 ticks) and records interval ID.
     */
    init() {
        if (this._isInitialized) return;
        this._isInitialized = true;

        this.playerLeaveSubscription = Kernel.world.afterEvents.playerLeave.subscribe((event) => {
            this.handlePlayerLeave(event.playerId, event.playerName)
        })

        this.cleanupIntervalId = Kernel.system.runInterval(() => {
            this.performPeriodicCleanup()
        }, 5 * 60 * 20) // 5-minute industrial interval

        console.log("[CleanupService] Maintenance engine active.");
    }

    /**
     * Registers a custom system cleanup handler callback.
     * 
     * EXPECTS:
     * - systemName: String key naming the subsystem.
     * - cleanupFunction: Function callback accepting playerId.
     * 
     * GUARANTEES:
     * - Throws TypeError if cleanupFunction is not a function.
     * - Stores callback in cleanupHandlers map key by systemName.
     * 
     * @param {string} systemName - Target subsystem name.
     * @param {function(string): void} cleanupFunction - Subsystem cleanup logic.
     */
    registerCleanupHandler(systemName, cleanupFunction) {
        if (typeof cleanupFunction !== "function") {
            throw new TypeError(`Cleanup handler for '${systemName}' must be a function. Got type: ${typeof cleanupFunction}`);
        }
        this.cleanupHandlers.set(systemName, cleanupFunction)
    }

    /**
     * Checks if a cleanup handler is registered for a subsystem.
     * 
     * EXPECTS:
     * - systemName: Subsystem identifier.
     * 
     * GUARANTEES:
     * - Returns true if a handler exists, false otherwise.
     * 
     * @param {string} systemName - Subsystem name.
     * @returns {boolean} True if handler exists.
     */
    hasCleanupHandler(systemName) {
        return this.cleanupHandlers.has(systemName);
    }

    /**
     * Removes a subsystem's registered cleanup handler.
     * 
     * EXPECTS:
     * - systemName: Subsystem identifier.
     * 
     * GUARANTEES:
     * - Deletes subsystem name entry from the cleanupHandlers map.
     * - Returns true if deleted, false otherwise.
     * 
     * @param {string} systemName - Target subsystem name.
     * @returns {boolean} True if handler was found and deleted.
     */
    unregisterCleanupHandler(systemName) {
        return this.cleanupHandlers.delete(systemName)
    }

    /**
     * Executes all registered cleanup callbacks for a player ID.
     * 
     * EXPECTS:
     * - playerId: Unique string player ID.
     * - playerName: Display name tag string.
     * 
     * GUARANTEES:
     * - Loops through all cleanupHandlers invoking them with player ID parameter.
     * - Safely catches exceptions preventing failure propagation.
     * - Calls local player data cleanup routine wrapped in safety guards.
     * 
     * @param {string} playerId - Player ID.
     * @param {string} playerName - Player name.
     */
    handlePlayerLeave(playerId, playerName) {
        console.log(`[CleanupService] TERMINATING_SESSION: ${playerName} [ID: ${playerId}]`);

        for (const [systemName, cleanupFunction] of this.cleanupHandlers) {
            try {
                cleanupFunction(playerId)
            } catch (error) {
                console.error(`[CleanupService] PURGE_FAILURE for '${systemName}': ${error}`);
            }
        }

        try {
            this.cleanupPlayerData(playerId)
        } catch (error) {
            console.error(`[CleanupService] playerLeave player data cleanup failed for ${playerId}: ${error}`);
        }
    }

    /**
     * Core player database record purge helper.
     */
    cleanupPlayerData(playerId) {
        // Run registered cleanup handlers for this specific player
        for (const [systemName, cleanupFunction] of this.cleanupHandlers) {
            try {
                cleanupFunction(playerId);
            } catch (error) {
                console.error(`[CleanupService] PLAYER_CLEANUP_FAILURE for '${systemName}': ${error}`);
            }
        }

        // Clear per-player cached data
        try {
            const CacheManager = Kernel.get("cache");
            if (CacheManager && typeof CacheManager.invalidate === "function") {
                const playerCaches = ["playerCache", "PlayerCache"];
                for (const cacheName of playerCaches) {
                    try {
                        CacheManager.invalidate(cacheName, playerId);
                    } catch (_) {}
                }
            }
        } catch (error) {
            console.error(`[CleanupService] PLAYER_CACHE_CLEAR_FAILURE for ${playerId}: ${error}`);
        }

        // Clear per-player dynamic properties
        try {
            const onlinePlayer = Kernel.world.getAllPlayers().find(p => p.id === playerId);
            if (onlinePlayer) {
                const props = ["ae:last_cmd_tick", "ae:reply_target", "ae:back_coords"];
                for (const prop of props) {
                    try { onlinePlayer.setDynamicProperty(prop, undefined); } catch (_) {}
                }
            }
        } catch (error) {
            console.error(`[CleanupService] PLAYER_PROP_CLEAR_FAILURE for ${playerId}: ${error}`);
        }
    }

    /**
     * Performs background garbage collection checks.
     */
    performPeriodicCleanup() {
        let handlerCount = 0;

        // Call each registered cleanup handler with a global marker
        for (const [systemName, cleanupFunction] of this.cleanupHandlers) {
            try {
                cleanupFunction("*");
                handlerCount++;
            } catch (error) {
                console.error(`[CleanupService] PERIODIC_CLEANUP_FAILURE for '${systemName}': ${error}`);
            }
        }

        // Purge expired ban data
        try {
            const WorldStore = Kernel.get("worldStore");
            if (WorldStore) {
                const bans = WorldStore.get("ae:bans") || [];
                const now = Date.now();
                const activeBans = bans.filter(ban => ban.expires === 0 || ban.expires > now);
                if (activeBans.length !== bans.length) {
                    WorldStore.set("ae:bans", activeBans);
                }
            }
        } catch (error) {
            console.error(`[CleanupService] BAN_PURGE_FAILURE: ${error}`);
        }

        // Purge expired mute data
        try {
            const MuteStore = Kernel.get("muteStore");
            if (MuteStore) {
                // Checking online players triggers auto-unmute for expired mutes
                const players = Kernel.world.getAllPlayers();
                for (const player of players) {
                    MuteStore.isMuted(player);
                }
            }
        } catch (error) {
            console.error(`[CleanupService] MUTE_PURGE_FAILURE: ${error}`);
        }

        console.log(`[CleanupService] Periodic cleanup complete. Handlers executed: ${handlerCount}`);
    }

    /**
     * Compiles statistical metrics reporting registry size.
     */
    getStats() {
        return {
            registeredHandlers: this.cleanupHandlers.size
        }
    }

    /**
     * Forces emergency purge of all loaded session data.
     */
    forceCleanupAll() {
        console.log("[CleanupService] EMERGENCY_TOTAL_PURGE_TRIGGERED");

        // Run periodic cleanup first
        this.performPeriodicCleanup();

        // Flush all database stores
        try {
            const db = Kernel.get("database");
            if (db && typeof db.flushAll === "function") {
                db.flushAll();
            }
        } catch (error) {
            console.error(`[CleanupService] FLUSH_FAILURE: ${error}`);
        }

        // Flush JournaledDatabase if available
        try {
            if (JournaledDb && typeof JournaledDb.flush === "function") {
                JournaledDb.flush();
            }
        } catch (error) {
            console.error(`[CleanupService] JOURNAL_FLUSH_FAILURE: ${error}`);
        }

        // Run cleanup on all registered handlers with force marker
        for (const [systemName, cleanupFunction] of this.cleanupHandlers) {
            try {
                cleanupFunction("*");
            } catch (error) {
                console.error(`[CleanupService] FORCE_CLEANUP_FAILURE for '${systemName}': ${error}`);
            }
        }

        // Notify CacheManager to clear all caches
        try {
            const CacheManager = Kernel.get("cache");
            if (CacheManager && typeof CacheManager.clearAll === "function") {
                CacheManager.clearAll();
            }
        } catch (error) {
            console.error(`[CleanupService] CACHE_FLUSH_FAILURE: ${error}`);
        }

        const stats = this.getStats();
        console.log(`[CleanupService] Emergency purge complete. Registered handlers: ${stats.registeredHandlers}`);
    }

    /**
     * Wipes active listeners and resets the initialization state.
     * 
     * EXPECTS:
     * - None.
     * 
     * GUARANTEES:
     * - Unsubscribes playerLeave event listener.
     * - Clears cleanupIntervalId timer.
     * - Sets _isInitialized back to false.
     */
    shutdown() {
        if (this.playerLeaveSubscription) {
            try { Kernel.world.afterEvents.playerLeave.unsubscribe(this.playerLeaveSubscription); } catch(e) {}
            this.playerLeaveSubscription = null;
        }
        if (this.cleanupIntervalId) {
            try { Kernel.system.clearRun(this.cleanupIntervalId); } catch(e) {}
            this.cleanupIntervalId = null;
        }
        this._isInitialized = false;
        console.log("[CleanupService] Offline.");
    }
}

export const CleanupServiceInstance = new CleanupService()
