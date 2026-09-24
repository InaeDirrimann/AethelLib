import { Kernel } from "../core/Kernel.js";

// ----------------------------------------------------------------------------
// | PlayerUtils                                                              |
// | high-performance helper for finding player entities by name or id.       |
// | uses a memory-based cache to avoid scanning every entity on the server.  |
// ----------------------------------------------------------------------------

// in-memory map for name-based lookups. lower-case keys for case-insensitivity.
const nameCache = new Map() 
// helper map to find a name from a player id (used for cleanup on disconnect).
const idToNameCache = new Map() 
// reverse helper map to find player id from a lower name (enables O(1) garbage collection).
const nameToIdCache = new Map()
// garbage-collection interval handle (see shutdown())
let _gcIntervalId = null;

// Called during core boot (Stage 2) to register player tracking listeners.
// Must NOT run at module import time — Bedrock throws in early-execution mode.
export function initPlayerCache() {
    // Seed cache with players already online when the script boots.
    Kernel.world.getAllPlayers().forEach(p => {
        const lowerName = p.name.toLowerCase()
        nameCache.set(lowerName, p)
        idToNameCache.set(p.id, lowerName)
        nameToIdCache.set(lowerName, p.id)
    })

    // Add players to the cache as soon as they spawn.
    Kernel.world.afterEvents.playerSpawn.subscribe((ev) => {
        const { player } = ev
        const lowerName = player.name.toLowerCase()
        nameCache.set(lowerName, player)
        idToNameCache.set(player.id, lowerName)
        nameToIdCache.set(lowerName, player.id)
    })

    // Remove players when they leave so we don't hold onto stale references.
    Kernel.world.afterEvents.playerLeave.subscribe((ev) => {
        const { playerId } = ev
        const lowerName = idToNameCache.get(playerId)
        if (lowerName) {
            nameCache.delete(lowerName)
            nameToIdCache.delete(lowerName)
        }
        idToNameCache.delete(playerId)
    })

    // Sweep caches for dead entity references every ~60 seconds.
    _gcIntervalId = Kernel.system.runInterval(() => {
        const namesToDelete = []
        for (const [lowerName, player] of nameCache.entries()) {
            if (!player || !player.isValid) {
                namesToDelete.push(lowerName)
            }
        }
        for (const lowerName of namesToDelete) {
            nameCache.delete(lowerName)
            const id = nameToIdCache.get(lowerName)
            if (id) {
                idToNameCache.delete(id)
            }
            nameToIdCache.delete(lowerName)
        }
    }, 1200) // 1200 ticks = ~60 seconds
}

export const PlayerUtils = {
    /**
     * Bootstraps the in-memory cache with all currently online players.
     * 
     * EXPECTS:
     * - Kernel.world.getAllPlayers() exists and returns active player array.
     * 
     * GUARANTEES:
     * - Populates nameCache, idToNameCache, and nameToIdCache for all online players.
     */
    init() {
        Kernel.world.getAllPlayers().forEach(p => {
            const lowerName = p.name.toLowerCase()
            nameCache.set(lowerName, p)
            idToNameCache.set(p.id, lowerName)
            nameToIdCache.set(lowerName, p.id)
        })
    },

    /**
     * Resolves a player entity object from a string or object identifier.
     * 
     * EXPECTS:
     * - identifier: String player ID, player name, or existing Player object.
     * 
     * GUARANTEES:
     * - Returns the player object if the input is already a player.
     * - Heals stale/invalid cached player objects by scanning active world players.
     * - Resolves exact case-insensitive name matches in O(1).
     * - Resolves exact player ID/UUID matches in O(1).
     * - Resolves partial name matches (contains query) if exactly one player matches.
     * - Returns wrapped entity proxy to prevent receiver crashes.
     * - Returns null if no matching player was found or identifier is offline.
     * - Bails out early with null on empty/whitespace name queries to prevent random online match resolution.
     * 
     * @param {string|import("@minecraft/server").Player} identifier - Target selector.
     * @returns {import("@minecraft/server").Player|null} Resolved player proxy.
     */
    findPlayer(identifier) {
        if (!identifier) return null
        
        if (identifier !== null && typeof identifier === 'object' && (typeof identifier.name === 'string' || typeof identifier.id === 'string' || typeof identifier.isValid === 'boolean')) {
            if (!identifier.isValid) {
                const activePlayer = Kernel.world.getAllPlayers().find(p => p.id === identifier.id);
                if (activePlayer) return Kernel.wrapEntity(activePlayer);
                return null;
            }
            return Kernel.wrapEntity(identifier);
        }
        
        if (typeof identifier !== 'string') return null;

        // Clean quotes from the identifier if present (Bedrock quotes names with numbers/special chars)
        let cleanId = identifier.trim();
        if (cleanId.length >= 2) {
            const first = cleanId[0];
            const last = cleanId[cleanId.length - 1];
            if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
                cleanId = cleanId.slice(1, -1).trim();
            }
        }

        const lowerId = cleanId.toLowerCase()
        if (!lowerId) return null; // Prevent empty/whitespace queries matching parts of all names

        // step 1: O(1) lookup for exact name.
        let nameMatch = nameCache.get(lowerId)
        if (nameMatch && !nameMatch.isValid) {
            // Stale reference detected! Try to heal it from the active world players list.
            const activePlayer = Kernel.world.getAllPlayers().find(p => p.name.toLowerCase() === lowerId);
            if (activePlayer) {
                nameCache.set(lowerId, activePlayer);
                idToNameCache.set(activePlayer.id, lowerId);
                nameToIdCache.set(lowerId, activePlayer.id);
                nameMatch = activePlayer;
            }
        }
        if (nameMatch?.isValid) return Kernel.wrapEntity(nameMatch)

        // step 2: O(1) look for an exact ID match.
        const foundName = idToNameCache.get(cleanId);
        if (foundName) {
            let p = nameCache.get(foundName)
            if (p && !p.isValid) {
                const activePlayer = Kernel.world.getAllPlayers().find(pl => pl.id === cleanId);
                if (activePlayer) {
                    const lowerName = activePlayer.name.toLowerCase();
                    nameCache.set(lowerName, activePlayer);
                    idToNameCache.set(activePlayer.id, lowerName);
                    nameToIdCache.set(lowerName, activePlayer.id);
                    p = activePlayer;
                }
            }
            if (p?.isValid) return Kernel.wrapEntity(p)
        }

        // step 3: fallback to exact name matching from active players list directly (bypasses stale cache)
        const activePlayers = Kernel.world.getAllPlayers()
        const exactMatch = activePlayers.find(p => p.name.toLowerCase() === lowerId)
        if (exactMatch) {
            nameCache.set(lowerId, exactMatch);
            idToNameCache.set(exactMatch.id, lowerId);
            nameToIdCache.set(lowerId, exactMatch.id);
            return Kernel.wrapEntity(exactMatch);
        }

        // step 4: fallback to partial matching.
        const partial = activePlayers.filter(p => p.name.toLowerCase().includes(lowerId))
        if (partial.length === 1) return Kernel.wrapEntity(partial[0])

        return null
    },

    /**
     * Parses command arguments to resolve a player matching spaces/quotes.
     * 
     * EXPECTS:
     * - args: Array of string arguments.
     * 
     * GUARANTEES:
     * - Resolves player target from selector array if passed.
     * - Resolves bounding quotes string parsing space-split player names.
     * - Greedily checks combined arguments.
     * - Returns resolved player object and count of arguments consumed.
     * 
     * @param {string[]} args - Input arguments.
     * @returns {{player: import("@minecraft/server").Player|null, consumedArgs: number}} Match result.
     */
    resolveFromArgs(args) {
        if (!args || args.length === 0) return { player: null, consumedArgs: 0 }

        // if the native command parser already gave us a player object.
        const possiblePlayer = Array.isArray(args[0]) ? args[0][0] : args[0];
        if (typeof possiblePlayer === 'object' && possiblePlayer !== null && possiblePlayer.name) {
            let p = possiblePlayer;
            if (!p.isValid) {
                const activePlayer = Kernel.world.getAllPlayers().find(pl => pl.id === p.id);
                if (activePlayer) {
                    p = activePlayer;
                } else {
                    return { player: null, consumedArgs: 1 };
                }
            }
            return { player: Kernel.wrapEntity(p), consumedArgs: 1 }
        }

        // Quote parsing: detect if the first argument starts with a quote
        if (typeof args[0] === 'string' && (args[0].startsWith('"') || args[0].startsWith("'"))) {
            const quoteChar = args[0][0];
            let closingIndex = -1;
            for (let i = 0; i < args.length; i++) {
                if (i === 0 && args[i].length > 1 && args[i].endsWith(quoteChar)) {
                    closingIndex = 0;
                    break;
                } else if (i > 0 && args[i].endsWith(quoteChar)) {
                    closingIndex = i;
                    break;
                }
            }
            if (closingIndex !== -1) {
                const joined = args.slice(0, closingIndex + 1).join(" ");
                const stripped = joined.slice(1, -1);
                const target = this.findPlayer(stripped);
                if (target) {
                    return { player: Kernel.wrapEntity(target), consumedArgs: closingIndex + 1 };
                }
            }
        }

        let longestExactMatch = null
        let consumedExact = 0
        let longestPartialMatch = null
        let consumedPartial = 0

        // greedy matching. try to join as many words as possible to find a valid name.
        for (let i = 1; i <= args.length; i++) {
            const potentialName = args.slice(0, i).join(" ")
            const target = this.findPlayer(potentialName)
            
            if (target) {
                const isExact = target.name.toLowerCase() === potentialName.toLowerCase() || target.id === potentialName;
                if (isExact) {
                    longestExactMatch = target
                    consumedExact = i
                } else {
                    longestPartialMatch = target
                    consumedPartial = i
                }
            }
        }

        if (longestExactMatch) {
            return { player: Kernel.wrapEntity(longestExactMatch), consumedArgs: consumedExact }
        }
        if (longestPartialMatch) {
            return { player: Kernel.wrapEntity(longestPartialMatch), consumedArgs: consumedPartial }
        }

        return { player: null, consumedArgs: 0 }
    },

    /**
     * Performs inverse lookup resolving player ID from name.
     * 
     * EXPECTS:
     * - name: Player display name.
     * 
     * GUARANTEES:
     * - Searches active memory caches first.
     * - Queries playername index database registry.
     * - Scans legacy fallback properties if index migration is uncompleted.
     * - Returns string player ID (UUID), or null if not found.
     * 
     * @param {string} name - Player name.
     * @returns {string|null} Resolved player ID.
     */
    getIdByName(name) {
        if (!name) return null;
        const lowerName = name.toLowerCase();
        
        // 1. Check in-memory caches for online players first
        const onlinePlayer = nameCache.get(lowerName);
        if (onlinePlayer?.isValid) {
            return onlinePlayer.id;
        }
        
        const cachedId = nameToIdCache.get(lowerName);
        if (cachedId) {
            return cachedId;
        }
        
        // 2. Query name-to-UUID index in O(1)
        try {
            const db = Kernel.get("database");
            const uuid = db ? db.get(`playername:${lowerName}`) : Kernel.world.getDynamicProperty(`playername:${lowerName}`);
            if (uuid) return uuid;

            // Fallback for pre-migration state only
            const isMigrated = db ? db.get("ae:index_migrated") : Kernel.world.getDynamicProperty("ae:index_migrated");
            if (!isMigrated) {
                const allIds = Kernel.world.getDynamicPropertyIds();
                for (const propId of allIds) {
                    if (propId.startsWith("player:") && propId.endsWith(":name")) {
                        const storedName = Kernel.world.getDynamicProperty(propId);
                        if (typeof storedName === "string" && storedName.toLowerCase() === lowerName) {
                            const parts = propId.split(":");
                            return parts[1]; // UUID
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`[PlayerUtils] getIdByName query failure: ${error}`);
        }
        
        return null;
    },

    /**
     * Mocks registration helper for unit testing.
     */
    registerMock(player) {
        const lowerName = player.name.toLowerCase();
        nameCache.set(lowerName, player);
        idToNameCache.set(player.id, lowerName);
        nameToIdCache.set(lowerName, player.id);
    },

    /**
     * Mocks un-registration helper for unit testing.
     */
    unregisterMock(player) {
        const lowerName = player.name.toLowerCase();
        nameCache.delete(lowerName);
        idToNameCache.delete(player.id);
        nameToIdCache.delete(lowerName);
    },

    /**
     * Clears all mock records from cache registries.
     */
    clearMocks() {
        const idsToDelete = []
        for (const id of idToNameCache.keys()) {
            if (id.startsWith("mock-id-") || id === "mock-player-id") {
                idsToDelete.push(id)
            }
        }
        for (const id of idsToDelete) {
            const lowerName = idToNameCache.get(id)
            if (lowerName) {
                nameCache.delete(lowerName)
                nameToIdCache.delete(lowerName)
            }
            idToNameCache.delete(id)
        }
    },

    /**
     * Shuts down the GC interval and clears all caches.
     * Call this during module cleanup to prevent stale interval handles.
     */
    shutdown() {
        if (_gcIntervalId !== null) {
            Kernel.system.clearRun(_gcIntervalId);
            _gcIntervalId = null;
        }
        nameCache.clear();
        idToNameCache.clear();
        nameToIdCache.clear();
    }
}

