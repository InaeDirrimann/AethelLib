import { PermissionData } from "./PermissionData.js"
import { Kernel } from "../Kernel.js"
import { Configuration } from "../../Configuration.js"
import { DEFAULT_RANKS } from "../../data/RankConfig.js"
export class PermissionManager {
    static #instance = null
    static #data = new PermissionData() // Master storage for all rank data
    static #playerCache = new Map() // Cache for resolved player permissions
    static #resolvedRanks = new Map() // Pre-computed rank inheritance tree
    static #CACHE_TTL = 30000 
    static #aliases = {
        "essentials.admin": "admin.panel",
        "essentials.ban": "admin.ban",
        "essentials.admin.ban": "admin.ban",
        "essentials.kick": "admin.kick",
        "essentials.admin.mute": "admin.mute",
        "essentials.admin.reports": "admin.reports",
        "essentials.admin.ft": "admin.floatingtext",
        "essentials.admin.invsee": "admin.invsee",
        "essentials.admin.ranks": "admin.ranks",
        "essentials.admin.economy": "admin.economy",
        "admin.shop": "admin.shopsetting",
        "admin.system": "admin.setting",
        "admin.plugin": "admin.setting",
        "admin.broadcast.reset": "admin.broadcast",
        "home.limit": "limit.home",
        "limit.home": "home.limit",
        "limit.land": "land.limit",
        "land.limit": "limit.land"
    }
    static #stats = {
        cacheHits: 0,
        cacheMisses: 0,
        totalChecks: 0
    }
    
    /** Returns the PermissionManager singleton (lazy-init). */
    static getInstance() {
        if (!this.#instance) {
            this.#instance = new PermissionManager()
        }
        return this.#instance
    }
    
    /** Starts background cache pruning. Binds disconnect listener to invalidate player cache to prevent ID-hijacking. */
    constructor() {
        this.startCleanupTask()
        
        // Clear permission cache on player disconnect to prevent ID-reuse hijacking and memory leaks!
        Kernel.world.afterEvents.playerLeave.subscribe((ev) => {
            this.invalidatePlayerCache(ev.playerId);
            PermissionManager.#data.purgePlayer(ev.playerId);
        });
    }


    /** Loads all rank definitions, flushes existing data, pre-computes inheritance trees. */
    init() {
        const RankStore = Kernel.get("rankStore")
        if (!RankStore) {
            console.error("[PermissionManager] FATAL: RankStore registry unreachable.");
            return
        }

        let allRanks = RankStore.getAllRanks()
        if (!allRanks || Object.keys(allRanks).length === 0) {
            allRanks = {}
            for (const rank of DEFAULT_RANKS) {
                allRanks[rank.id] = {
                    name: rank.name || rank.id,
                    order: rank.order || 0,
                    colorText: rank.chatColor || "\u00A77",
                    colorName: rank.color || "\u00A77",
                    hideRanks: rank.id === "member",
                    permissions: rank.permissions || {}
                }
            }
        }

        // 1. Wipe memory of deleted/superseded ranks to synchronize layout state
        PermissionManager.#data = new PermissionData()

        for (const [tag, data] of Object.entries(allRanks)) {
            // 2. Safety guard: ignore undefined rank definitions
            if (!data) continue

            PermissionManager.#data.addRank(
                tag, 
                data.order || 0, 
                data.name || tag, 
                data.colorName || "\u00A77", 
                data.colorText || "\u00A77",
                data.hideRanks ?? data.shouldHideRanks ?? false
            )

            if (data.permissions) {
                for (const [perm, value] of Object.entries(data.permissions)) {
                    PermissionManager.#data.setPermission(tag, perm, value)
                }
            }
        }

        // 3. Pre-compute full inheritance tree for O(1) resolution
        PermissionManager.#resolvedRanks.clear()
        
        const resolveRank = (rankId, visited = new Set()) => {
            if (visited.has(rankId)) return {}
            visited.add(rankId)

            const rankData = allRanks[rankId]
            if (!rankData) return {}

            const merged = {}
            if (rankData.inherits) {
                Object.assign(merged, resolveRank(rankData.inherits, visited))
            }

            if (rankData.permissions) {
                for (const [perm, value] of Object.entries(rankData.permissions)) {
                    merged[perm] = value
                }
            }
            return merged
        }

        for (const rankId of Object.keys(allRanks)) {
            PermissionManager.#resolvedRanks.set(rankId, resolveRank(rankId))
        }

        this.invalidatePlayerCache()

        console.log(`[PermissionManager] RBAC_NODES_INJECTED: ${Object.keys(allRanks).length}`);
    }


    /** Resolves player permission cache or re-computes if expired. */
    _getOrComputeCache(player) {
        let cache = PermissionManager.#playerCache.get(player.id)
        if (cache && Date.now() - cache.timestamp < PermissionManager.#CACHE_TTL) {
            PermissionManager.#stats.cacheHits++
            return cache
        }
        
        PermissionManager.#stats.cacheMisses++
        
        const isSuperAdmin = this._isSuperAdmin(player)
        if (isSuperAdmin) {
            cache = {
                permissions: new Map(),
                isSuperAdmin: true,
                timestamp: Date.now()
            }
            PermissionManager.#playerCache.set(player.id, cache)
            return cache
        }

        this.syncPlayerRanks(player)
        const permissions = this.#computePermissions(player)
        
        cache = {
            permissions,
            isSuperAdmin: false,
            timestamp: Date.now()
        }
        PermissionManager.#playerCache.set(player.id, cache)
        return cache
    }

    /** Resolves value of a permission key for a player. Admins get unlimited limits / 0 cooldowns. */
    getPermission(player, key) {
        if (this._isSuperAdmin(player)) {
            if (key.endsWith(".limit") || key.startsWith("limit.") || key.includes("limit") || key === "limit") {
                return -1;
            }
            if (key.endsWith(".cooldown") || key.includes("cooldown") || 
                key.endsWith(".wait") || key.includes("wait") || 
                key.endsWith(".cost") || key.includes("cost")) {
                return 0;
            }
            return true;
        }

        const cache = this._getOrComputeCache(player)
        
        const isAdmin = cache.isSuperAdmin || cache.permissions.get("admin") === true
        
        if (isAdmin) {
            // Use -1 as sentinel for "unlimited" — safer than Infinity.
            if (key.endsWith(".limit") || key.startsWith("limit.") || key.includes("limit") || key === "limit") {
                return -1
            }
            // Cooldowns, waits, and costs are free (0) for admins.
            if (key.endsWith(".cooldown") || key.includes("cooldown") || 
                key.endsWith(".wait") || key.includes("wait") || 
                key.endsWith(".cost") || key.includes("cost")) {
                return 0
            }
            return true
        }
        
        // Non-admin: check explicit numeric permission values from rank config first.
        // -1 in config means unlimited; translate to Infinity for downstream consumers.
        const explicitVal = cache.permissions.get(key)
        if (explicitVal !== undefined) {
            const _isNumeric = (k) => k.includes("limit") || k.includes("cooldown") || k.includes("wait") || k.includes("cost")
            if (_isNumeric(key) && typeof explicitVal === 'number') {
                return explicitVal === -1 ? Infinity : explicitVal
            }
            if (typeof explicitVal !== 'number') return explicitVal
        }
        
        let val = cache.permissions.get(key)
        
        if (val === undefined) {
            const alias = PermissionManager.#aliases[key]
            if (alias) {
                val = cache.permissions.get(alias)
            }
        }

        if (val === undefined && key === "essentials.gamemode") {
            if (cache.permissions.get("admin.gm.c") === true ||
                cache.permissions.get("admin.gm.s") === true ||
                cache.permissions.get("admin.gm.sp") === true ||
                cache.permissions.get("admin.gm.a") === true) {
                val = true
            }
        }

        return val
    }

    /** Checks boolean permission node for a player, tracking metrics. */
    hasPermission(player, permission) {
        PermissionManager.#stats.totalChecks++
        const val = this.getPermission(player, permission)
        return val ?? false
    }

    /** Syncs player rank tags to PermissionData. */
    syncPlayerRanks(player) {
        if (!player || !player.id || typeof player.getTags !== 'function') return;
        const tags = player.getTags()
        PermissionManager.#data.setPlayerRanks(player.id, tags)
    }

    /** Returns the highest rank info for a player. */
    getHighestRank(player) {
        if (!player) return null
        this.syncPlayerRanks(player)
        return PermissionManager.#data.getHighestRank(player.id)
    }


    /** Checks if actor has hierarchy clearance over target (super admin check + rank weights). */
    canActOn(actor, target) {
        const isActorSuperAdmin = this._isSuperAdmin(actor)
        const isTargetSuperAdmin = this._isSuperAdmin(target)
        
        if (isActorSuperAdmin) return true
        if (isTargetSuperAdmin) return false

        this.syncPlayerRanks(actor)
        this.syncPlayerRanks(target)

        return PermissionManager.#data.canActOn(actor.id, target.id)
    }

    /** Compiles a flat permissions map from the player's rank hierarchy (highest priority wins, member rank fallback). */
    #computePermissions(player) {
        const permissions = new Map()
        const playerRanks = PermissionManager.#data.getPlayerRanks(player.id)
        
        const isNumeric = (k) => k.includes("limit") || k.includes("cooldown") || k.includes("wait") || k.includes("cost");

        // SCAN_HIERARCHY: Highest rank takes priority
        for (const rankId of playerRanks) {
            const rankPerms = PermissionManager.#resolvedRanks.get(rankId) || {}
            
            for (const [perm, value] of Object.entries(rankPerms)) {
                if (permissions.has(perm)) continue

                if (isNumeric(perm)) {
                    if (typeof value === 'number') {
                        permissions.set(perm, value)
                    }
                } else {
                    // 3-STATE_LOGIC_RESOLUTION
                    // 1 or true IS ALLOW
                    // 2 or false IS DENY
                    // 0 or null IS NO_ACTION (inherit)
                    if (value === 1 || value === true) {
                        permissions.set(perm, true)
                    } else if (value === 2 || value === false) {
                        permissions.set(perm, false)
                    } else if (typeof value === 'number' && value !== 0) {
                        permissions.set(perm, value)
                    }
                }
            }
        }

        
        // BASELINE_FALLBACK: If node is still unresolved, check the 'member' rank
        const memberRank = PermissionManager.#resolvedRanks.get("member") || {}
        for (const [perm, value] of Object.entries(memberRank)) {
            if (!permissions.has(perm)) {
                if (isNumeric(perm)) {
                    if (typeof value === 'number') {
                        permissions.set(perm, value)
                    }
                } else {
                    if (typeof value === 'number') {
                        if (value > 2) {
                            permissions.set(perm, value)
                        } else if (value === 1) {
                            permissions.set(perm, true)   // 1 = Allow
                        } else if (value === 2) {
                            permissions.set(perm, false)  // 2 = Deny
                        }
                    } else if (typeof value === 'boolean') {
                        permissions.set(perm, value)
                    }
                }
            }
        }

        return permissions
    }
    
    invalidatePlayerCache(playerId = null) {
        if (playerId) {
            PermissionManager.#playerCache.delete(playerId)
            PermissionManager.#data.invalidatePlayerCache(playerId)
        } else {
            PermissionManager.#playerCache.clear()
            PermissionManager.#data.invalidatePlayerCache(null)
        }
    }

    
    /** Registers recurring interval for stale cache cleanup. */
    startCleanupTask() {
        Kernel.system.runInterval(() => {
            PermissionManager.#data.cleanup()
            this.cleanupExpiredCache()
        }, 6000) 
    }
    
    /** Removes expired entries from the player cache Map. */
    cleanupExpiredCache() {
        const now = Date.now()
        const keysToDelete = []

        for (const [playerId, cache] of PermissionManager.#playerCache) {
            if (now - cache.timestamp > PermissionManager.#CACHE_TTL) {
                keysToDelete.push(playerId)
            }
        }

        for (const playerId of keysToDelete) {
            PermissionManager.#playerCache.delete(playerId)
        }
    }

    /** Checks if player has operator status or super admin tags (including unified AE tag). */
    _isSuperAdmin(player) {
        if (!player) return false;
        try {
            if (player.isValid === false) return false;
            if (typeof player.isOp === 'function' && player.isOp()) return true;
            if (typeof player.hasTag === 'function') {
                if (player.hasTag("AE") || player.hasTag("ae") || player.hasTag("admin") || player.hasTag("Admin") || player.hasTag("op") || player.hasTag("OP")) {
                    return true;
                }
            }
            if (typeof player.getTags === 'function') {
                const tags = player.getTags();
                if (tags.some(t => ["AE", "ae", "admin", "Admin", "op", "OP"].includes(t))) return true;
                const configTags = Configuration.SUPER_ADMIN_TAGS;
                if (Array.isArray(configTags) && configTags.some(tag => tags.includes(tag))) return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    getStats() {
        const cacheHitRate = PermissionManager.#stats.totalChecks > 0 ? 
            Math.round((PermissionManager.#stats.cacheHits / PermissionManager.#stats.totalChecks) * 100) : 0
            
        return {
            ...PermissionManager.#stats,
            cacheHitRate,
            cachedPlayers: PermissionManager.#playerCache.size,
            dataStats: PermissionManager.#data.getStats()
        }
    }
}

export const PermissionManagerInstance = PermissionManager.getInstance()
