// ----------------------------------------------------------------------------
// | ChestShopStore                                                            |
// | manages player-created chest shops.                                       |
// | uses chunk-based sharding to keep data access localized and fast.         |
// | data model: { ownerId, itemId, price, quantity, type, chestLoc, signLoc } |
// ----------------------------------------------------------------------------

import { WorldStore } from "../../core/store/WorldStore.js"

export const ChestShopStore = {
    // ----------------------------------------------------------------------------
    // | locationToKey                                                            |
    // | converts a 3d vector into a flat string key for map indexing.            |
    // ----------------------------------------------------------------------------
    locationToKey(loc, dimensionId = null) {
        const dim = dimensionId || loc?.dimensionId || loc?.dimension?.id || "minecraft:overworld"
        return `${dim}:${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`
    },

    // ----------------------------------------------------------------------------
    // | locationToChunkKey                                                       |
    // | maps a world coordinate to its corresponding 16x16 chunk grid.           |
    // | used to shard the shop database so we don't load 10,000 shops at once.    |
    // ----------------------------------------------------------------------------
    locationToChunkKey(loc, dimensionId = null) {
        const dim = dimensionId || loc?.dimensionId || loc?.dimension?.id || "minecraft:overworld"
        return `${dim}:${Math.floor(loc.x) >> 4},${Math.floor(loc.z) >> 4}`
    },

    // ----------------------------------------------------------------------------
    // | getShopsInChunk                                                          |
    // | fetches all shop definitions for a specific chunk.                       |
    // ----------------------------------------------------------------------------
    getShopsInChunk(chunkKey) {
        // load the chunk's shop map from the world store.
        return WorldStore.get(`chestshop:${chunkKey}`) || {}
    },

    // ----------------------------------------------------------------------------
    // | saveChunk                                                                |
    // | persists a chunk's shop map back to storage.                             |
    // | if the chunk is empty, we delete the key entirely to save space.         |
    // ----------------------------------------------------------------------------
    saveChunk(chunkKey, shops) {
        // check if there are actually any shops left in this chunk.
        if (Object.keys(shops).length === 0) {
            // nuke the key from orbit.
            WorldStore.delete(`chestshop:${chunkKey}`)
        } else {
            // save the updated map.
            WorldStore.set(`chestshop:${chunkKey}`, shops)
        }
    },

    // ----------------------------------------------------------------------------
    // | getShop                                                                  |
    // | finds a shop definition by the location of its sign.                     |
    // ----------------------------------------------------------------------------
    getShop(signLocation, dimensionId = null) {
        const dim = dimensionId || signLocation?.dimensionId || signLocation?.dimension?.id || "minecraft:overworld"
        // find which chunk this sign belongs to.
        const chunkKey = this.locationToChunkKey(signLocation, dim)
        // get all shops in that chunk.
        const shops = this.getShopsInChunk(chunkKey)
        // look up the specific sign location in the chunk's map.
        return shops[this.locationToKey(signLocation, dim)] || null
    },

    // ----------------------------------------------------------------------------
    // | isShop                                                                   |
    // | checks if a shop exists at the given sign location.                      |
    // ----------------------------------------------------------------------------
    isShop(signLocation, dimensionId = null) {
        return this.getShop(signLocation, dimensionId) !== null
    },

    // ----------------------------------------------------------------------------
    // | createShop                                                                |
    // | registers a new chest shop in the database.                              |
    // ----------------------------------------------------------------------------
    createShop(data) {
        const dim = data.dimensionId || data.signLocation?.dimensionId || data.signLocation?.dimension?.id || "minecraft:overworld"
        // figure out the sharding key.
        const chunkKey = this.locationToChunkKey(data.signLocation, dim)
        const shops = this.getShopsInChunk(chunkKey)
        const signKey = this.locationToKey(data.signLocation, dim)

        // don't allow duplicate shops at the same location.
        if (shops[signKey]) return false 

        // build the shop record.
        shops[signKey] = {
            ownerId: data.ownerId,
            ownerName: data.ownerName,
            itemId: data.itemId,
            price: data.price,
            // default to 1 if quantity is missing.
            quantity: data.quantity || 1,
            // 'buy' (player buys from shop) or 'sell' (player sells to shop).
            type: data.type, 
            dimensionId: dim,
            chestLocation: {
                x: Math.floor(data.chestLocation.x),
                y: Math.floor(data.chestLocation.y),
                z: Math.floor(data.chestLocation.z),
                dimensionId: dim
            },
            signLocation: {
                x: Math.floor(data.signLocation.x),
                y: Math.floor(data.signLocation.y),
                z: Math.floor(data.signLocation.z),
                dimensionId: dim
            },
            // record when this thing was created for logs.
            created: Date.now()
        }

        // save the whole chunk map.
        this.saveChunk(chunkKey, shops)
        return true
    },

    // ----------------------------------------------------------------------------
    // | removeShop                                                               |
    // | deletes a shop record.                                                   |
    // ----------------------------------------------------------------------------
    removeShop(signLocation, dimensionId = null) {
        const dim = dimensionId || signLocation?.dimensionId || signLocation?.dimension?.id || "minecraft:overworld"
        const chunkKey = this.locationToChunkKey(signLocation, dim)
        const shops = this.getShopsInChunk(chunkKey)
        const signKey = this.locationToKey(signLocation, dim)

        // if it doesn't exist, we can't delete it.
        if (!shops[signKey]) return false

        // remove from the map.
        delete shops[signKey]
        // save the chunk.
        this.saveChunk(chunkKey, shops)
        return true
    },

    // ----------------------------------------------------------------------------
    // | updateShop                                                               |
    // | pushes changes to an existing shop back to the database.                 |
    // | very important for syncing stock changes.                                |
    // ----------------------------------------------------------------------------
    updateShop(shop) {
        // sanity check.
        if (!shop || !shop.signLocation) return false
        
        const dim = shop.dimensionId || shop.signLocation?.dimensionId || "minecraft:overworld"
        const chunkKey = this.locationToChunkKey(shop.signLocation, dim)
        const shops = this.getShopsInChunk(chunkKey)
        const signKey = this.locationToKey(shop.signLocation, dim)

        // if the shop was deleted while we were processing, bail.
        if (!shops[signKey]) return false

        // overwrite the entry with the new data.
        shops[signKey] = shop
        // flush to storage.
        this.saveChunk(chunkKey, shops)
        return true
    },

    // ----------------------------------------------------------------------------
    // | findShopByChestLocation                                                  |
    // | helper to find a shop by its chest instead of its sign.                  |
    // | used for protecting chests from being broken by non-owners.              |
    // ----------------------------------------------------------------------------
    findShopByChestLocation(location, dimensionId = null) {
        const dim = dimensionId || location?.dimensionId || location?.dimension?.id || "minecraft:overworld"
        const chunkKey = this.locationToChunkKey(location, dim)
        const shops = this.getShopsInChunk(chunkKey)
        const locKey = this.locationToKey(location, dim)

        // we have to loop through all shops in the chunk because multiple signs 
        // could potentially point to the same chest (though we try to prevent that).
        for (const shop of Object.values(shops)) {
            if (this.locationToKey(shop.chestLocation, shop.dimensionId || dim) === locKey) {
                return shop
            }
        }
        return null
    }
}
