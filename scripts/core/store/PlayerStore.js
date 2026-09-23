import { Kernel } from "../Kernel.js";
import { JournaledDb } from "../datastore/JournaledDatabase.js"

/*
 * ENTITY_SPECIFIC_STORAGE_PROXY
 */

// Keep name mapping synchronized for offline resolution
Kernel.world.afterEvents.playerSpawn.subscribe((ev) => {
    const { player } = ev
    
    // 1. Maintain case-insensitive name-to-UUID index and handle name changes
    const oldName = JournaledDb.get(`player:${player.id}:name`)
    if (oldName && oldName.toLowerCase() !== player.name.toLowerCase()) {
        JournaledDb.delete(`playername:${oldName.toLowerCase()}`)
    }
    
    JournaledDb.set(`player:${player.id}:name`, player.name)
    JournaledDb.set(`playername:${player.name.toLowerCase()}`, player.id)
    
    // 2. Track registered players list
    const allUuids = JournaledDb.get("ae:player_index") || []
    if (!allUuids.includes(player.id)) {
        allUuids.push(player.id)
        JournaledDb.set("ae:player_index", allUuids)
    }
})

export const PlayerStore = {

    _resolveKey(id, key) {
        if (!key) return `player:${id}`
        if (typeof key !== "string") return `player:${id}:${key}`
        if (key.startsWith(`player:${id}:`)) return key

        let cleaned = key
        while (cleaned.startsWith("player:")) {
            cleaned = cleaned.slice(7)
        }
        while (cleaned.startsWith(`${id}:`)) {
            cleaned = cleaned.slice(id.length + 1)
        }
        if (cleaned.endsWith(`:${id}`)) {
            cleaned = cleaned.slice(0, -(id.length + 1))
        } else if (cleaned.includes(`:${id}:`)) {
            cleaned = cleaned.replace(`:${id}:`, ":")
        }

        return `player:${id}:${cleaned}`
    },

    get(player, key) {
        const id = typeof player === "string" ? player : player?.id
        if (!id) return null
        return JournaledDb.get(this._resolveKey(id, key))
    },

    set(player, key, value) {
        const id = typeof player === "string" ? player : player?.id
        if (!id) return false
        return JournaledDb.set(this._resolveKey(id, key), value)
    },

    delete(player, key) {
        const id = typeof player === "string" ? player : player?.id
        if (!id) return false
        return JournaledDb.delete(this._resolveKey(id, key))
    },

    transaction(player, operation) {
        const id = typeof player === "string" ? player : player?.id
        return JournaledDb.transaction(id, operation)
    }
}
