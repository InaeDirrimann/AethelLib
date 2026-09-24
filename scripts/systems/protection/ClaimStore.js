import { WorldStore } from "../../core/store/WorldStore.js"

// Chunk claim persistence with cache-aside strategy and player index.

const claimCache = new Map()
const CACHE_TTL = 300000 // 5m

export const ClaimStore = {
    locationToChunkKey(location, dimensionId = null) {
        const dim = dimensionId || location?.dimension?.id || location?.dimensionId || "minecraft:overworld"
        const chunkX = Math.floor(location.x >> 4)
        const chunkZ = Math.floor(location.z >> 4)
        return `${dim}:${chunkX},${chunkZ}`
    },

    parseChunkKey(chunkKey) {
        if (!chunkKey) return { dimensionId: "minecraft:overworld", chunkX: 0, chunkZ: 0 }
        const lastColon = chunkKey.lastIndexOf(":")
        const dim = lastColon !== -1 ? chunkKey.slice(0, lastColon) : "minecraft:overworld"
        const coords = lastColon !== -1 ? chunkKey.slice(lastColon + 1) : chunkKey
        const [chunkX, chunkZ] = coords.split(",").map(Number)
        return { dimensionId: dim, chunkX: isNaN(chunkX) ? 0 : chunkX, chunkZ: isNaN(chunkZ) ? 0 : chunkZ }
    },

    getClaim(chunkKey) {
        const cached = claimCache.get(chunkKey)
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data
        }

        const stored = WorldStore.get(`claim:${chunkKey}`)
        if (stored) {
            claimCache.set(chunkKey, {
                data: stored,
                timestamp: Date.now()
            })
            return stored
        }

        return null
    },

    setClaim(chunkKey, claimData) {
        claimCache.set(chunkKey, {
            data: claimData,
            timestamp: Date.now()
        })

        WorldStore.set(`claim:${chunkKey}`, claimData)

        const indexKey = `playerClaims:${claimData.ownerId}`
        const index = WorldStore.get(indexKey) || []
        if (!index.includes(chunkKey)) {
            index.push(chunkKey)
            WorldStore.set(indexKey, index)
        }
    },

    removeClaim(chunkKey) {
        const claim = this.getClaim(chunkKey)
        if (claim) {
            const indexKey = `playerClaims:${claim.ownerId}`
            let index = WorldStore.get(indexKey) || []
            index = index.filter(k => k !== chunkKey)
            WorldStore.set(indexKey, index)
        }

        claimCache.delete(chunkKey)
        WorldStore.delete(`claim:${chunkKey}`)
    },

    isOwner(chunkKey, playerId) {
        const claim = this.getClaim(chunkKey)
        return claim?.ownerId === playerId
    },

    hasPermission(chunkKey, playerId, permission) {
        const claim = this.getClaim(chunkKey)
        if (!claim) return false

        if (claim.ownerId === playerId) return true

        return (claim.trusted?.[playerId] & permission) === permission
    },

    addTrusted(chunkKey, ownerId, trustedId, permissions) {
        const claim = this.getClaim(chunkKey) || {
            ownerId,
            trusted: {},
            flags: 0
        }

        claim.trusted[trustedId] = permissions
        this.setClaim(chunkKey, claim)
    },

    removeTrusted(chunkKey, trustedId) {
        const claim = this.getClaim(chunkKey)
        if (claim?.trusted) {
            delete claim.trusted[trustedId]
            this.setClaim(chunkKey, claim)
        }
    },

    getPlayerClaims(playerId) {
        const indexKey = `playerClaims:${playerId}`
        const index = WorldStore.get(indexKey) || []
        
        return index.map(chunkKey => ({
            chunkKey,
            ...this.getClaim(chunkKey)
        })).filter(c => c.ownerId === playerId)
    },

    cleanup() {
        const now = Date.now()
        for (const [key, value] of claimCache.entries()) {
            if (now - value.timestamp >= CACHE_TTL) {
                claimCache.delete(key)
            }
        }
    }
}
