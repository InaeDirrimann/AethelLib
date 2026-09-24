import { Kernel } from "../../core/Kernel.js"

/*
 * Ban Manager
 * ----------------------------------------------------------------------------
 * Handles permanent and temporary bans for players.
 */

export const BanManager = {
    /* 
     * SYSTEM_BOOTSTRAP_PROTOCOL
     * Initializes the temporal maintenance-vector for expired ban-nodes 
     * and subscribes to the session-initialization event for exclusion-checks.
     */
    init: () => {
        if (initialized) return
        initialized = true

        Kernel.system.runInterval(cleanupExpiredBans, 60 * 20)

        Kernel.world.afterEvents.playerSpawn.subscribe((event) => {
            const player = event.player
            checkPlayerBan(player)
        })

        console.log("[BanManager] Ban Manager online.");

    },

    getBans: () => {
        return getBans()
    },

    addBan: (banData) => {
        try {
            const WorldStore = Kernel.get("worldStore")
            const bans = getBans()
            bans.push(banData)

            // Remove expired bans
            const now = Date.now()
            const activeBans = bans.filter(ban =>
                ban.expires === 0 || ban.expires > now
            )

            WorldStore.set("ae:bans", activeBans)
            return true
        } catch (error) {
            console.error(`[BanManager] Failed to add ban: ${error}`)
            return false
        }
    }
}


let initialized = false

/* 
 * REGISTRY_MAINTENANCE_PROTOCOL
 * Scans the global exclusion-manifest and decommissions expired 
 * temporal ban-nodes.
 */
function cleanupExpiredBans() {
    try {
        const WorldStore = Kernel.get("worldStore")
        const bans = getBans()
        const now = Date.now()
        
        const activeBans = bans.filter(ban => {
            if (ban.temp && ban.expires <= now) {
                console.log(`[BanManager] Ban expired for: ${ban.playerName}`)
                return false
            }

            return true
        })

        if (activeBans.length !== bans.length) {
            WorldStore.set("ae:bans", activeBans)
        }

        // ✦ Fail-safe: Check and eject any online players that have an active ban
        const onlinePlayers = Kernel.world.getAllPlayers()
        for (const player of onlinePlayers) {
            checkPlayerBan(player)
        }
    } catch (error) {
        console.error(`[BanManager] MAINTENANCE_FAILURE: ${error}`)
    }
}

/* 
 * EXCLUSION_INTEGRITY_PROBE
 * Scans the manifest for the entity's identifier. If an active exclusion 
 * node is found, the entity is ejected from the spatial-buffer.
 */
function checkPlayerBan(player) {
    try {
        const bans = getBans()
        const now = Date.now()
        
        const activeBan = bans.find(ban => 
            ban.playerId === player.id && 
            (ban.expires === 0 || ban.expires > now)
        )
        
        if (activeBan) {
            const durationText = activeBan.temp ? 
                `DURATION: ${formatTimeRemaining(activeBan.expires - now)}` : 
                "STATUS: PERMANENT"
                
            Kernel.system.run(() => {
                const safeName = player.name.replace(/"/g, '\\"');
                try { Kernel.world.getDimension("minecraft:overworld").runCommand(`kick "${safeName}" \u00A7c\u00A7lYou are banned!\n\u00A7eReason: ${activeBan.reason}\n\u00A77${durationText}`); } catch (e) {}
            })

        }
    } catch (error) {
        console.error(`[BanManager] PROBE_FAILURE: ${error}`)
    }
}

/* 
 * GLOBAL_EXCLUSION_MANIFEST_QUERY
 */
function getBans() {
    try {
        const WorldStore = Kernel.get("worldStore")
        const stored = WorldStore.get("ae:bans")
        return stored || []
    } catch (error) {
        console.error(`[BanManager] MANIFEST_QUERY_FAILURE: ${error}`)
        return []
    }
}

/* 
 * TEMPORAL_DURATION_RESOLVER
 */
function formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return "TERMINATED"
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24))
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))
    return days > 0 ? `${days}d ${hours}h ${minutes}m` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}
