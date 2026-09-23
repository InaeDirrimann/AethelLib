import { Kernel } from "../../core/Kernel.js"
import { StoreKeys } from "../../core/store/StoreKeys.js"
import { Configuration } from "../../Configuration.js"
import { PlayerStore } from "../../core/store/PlayerStore.js"

const PENDING_CONFIRMATIONS = new Map() // playerId -> { name, timestamp }

Kernel.world.afterEvents.playerLeave.subscribe((ev) => {
    PENDING_CONFIRMATIONS.delete(ev.playerId)
})

function resolvePlayerId(player) {
    if (!player) return null
    return typeof player === "string" ? player : (player.id || null)
}

export const HomeStore = {
    async getHomes(player) {
        const id = resolvePlayerId(player)
        if (!id) return {}
        const store = Kernel.get("playerStore") || PlayerStore
        return store.get(id, StoreKeys.homeList(id)) || {}
    },

    async getHome(player, name) {
        const homes = await this.getHomes(player)
        return homes[name] || null
    },

    /**
     * Checks if setting this home requires an overwrite confirmation.
     * Returns true if confirmation is required (first attempt), false if confirmed or new home.
     */
    async checkOverwriteConfirmation(player, name) {
        const id = resolvePlayerId(player)
        if (!id) return false

        const hasExisting = await this.hasHome(player, name)
        if (!hasExisting) return false

        const pending = PENDING_CONFIRMATIONS.get(id)
        if (pending && pending.name === name && (Date.now() - pending.timestamp) <= 60000) {
            PENDING_CONFIRMATIONS.delete(id)
            return false // Confirmed within 60 seconds
        }

        PENDING_CONFIRMATIONS.set(id, { name, timestamp: Date.now() })
        return true // First attempt, needs confirmation
    },

    async setHome(player, name, location, dimension) {
        const id = resolvePlayerId(player)
        if (!id || !name || name.length < 1 || name.length > 16) return false

        const homes = await this.getHomes(player)
        const PM = Kernel.get("permissions")
        const permLimit = PM ? PM.getPermission(player, "home.limit") : null
        const maxHomes = (permLimit !== null && permLimit !== undefined && typeof permLimit === "number")
            ? (permLimit < 0 ? Infinity : permLimit)
            : (Configuration.MAX_HOMES || 5)

        // Only enforce quota when adding a brand new home (Essentials pattern)
        if (!homes[name] && Object.keys(homes).length >= maxHomes) return false

        homes[name] = {
            x: Math.floor(location.x),
            y: Math.floor(location.y),
            z: Math.floor(location.z),
            dimension: dimension,
            created: Date.now()
        }

        const store = Kernel.get("playerStore") || PlayerStore
        return store.set(id, StoreKeys.homeList(id), homes)
    },

    async deleteHome(player, name) {
        const id = resolvePlayerId(player)
        if (!id) return false

        const homes = await this.getHomes(player)
        if (!homes[name]) return false
        delete homes[name]
        const store = Kernel.get("playerStore") || PlayerStore
        return store.set(id, StoreKeys.homeList(id), homes)
    },

    async hasHome(player, name) {
        const homes = await this.getHomes(player)
        return Object.prototype.hasOwnProperty.call(homes, name)
    },

    async getHomeCount(player) {
        const homes = await this.getHomes(player)
        return Object.keys(homes).length
    }
}
