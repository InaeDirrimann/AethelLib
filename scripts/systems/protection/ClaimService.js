import { Kernel } from "../../core/Kernel.js"

import { SpatialCache } from "./SpatialCache.js"

/*
 * Land Protection System
 * ----------------------------------------------------------------------------
 * Handles chunk claims, permissions, and interaction protection.
 */


// AUTH_CLEARANCE_BITMASKS
const PERMISSIONS = {
    BUILD: 1,
    CONTAINERS: 2,
    DOORS: 4,
    REDSTONE: 8,
    MOB_INTERACT: 16,
    CRAFTING: 32
}



/* 
 * SERVICE_INITIALIZATION_PROTOCOL
 * Standard startup logging. Event interception is handled globally by MasterDispatcher.
 */
export function init() {
    console.log("[Aethelgrad Essentials] Spatial Security Engine operational.");
}

/* 
 * SPATIAL_ACQUISITION_PROTOCOL
 * Performs a collision-scan across the target radius before committing 
 * the claim to the registry.
 */
export function createClaim(player, location, radius = 1) {
    const ClaimStore = Kernel.get("claimStore")
    const centerChunk = ClaimStore.locationToChunkKey(location)
    const playerId = player.id

    for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
            const chunkKey = centerChunk.split(/[_,]/).map((coord, i) => 
                parseInt(coord) + (i === 0 ? x : z)
            ).join(',')
            
            if (ClaimStore.getClaim(chunkKey)) {
                player.sendMessage("\u00A7c\u00A7l» \u00A77This area is already claimed!");
                return false
            }

        }
    }

    for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
            const chunkKey = centerChunk.split(/[_,]/).map((coord, i) => 
                parseInt(coord) + (i === 0 ? x : z)
            ).join(',')
            
            ClaimStore.setClaim(chunkKey, {
                ownerId: playerId,
                trusted: {},
                flags: 0
            })
        }
    }

    // Invalidate local player cache
    SpatialCache.invalidate(playerId);
    player.sendMessage(`\u00A7a\u00A7l» \u00A7fLand claimed! \u00A7e(Radius: ${radius} chunks)\u00A7f.`);

    return true
}

/* 
 * SPATIAL_DECOMMISSION_PROTOCOL
 */
export function removeClaim(player, location) {
    const ClaimStore = Kernel.get("claimStore")
    if (!ClaimStore) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77Claim system is currently unavailable.");
        return false;
    }
    const chunkKey = ClaimStore.locationToChunkKey(location)
    const playerId = player.id

    if (!ClaimStore.isOwner(chunkKey, playerId)) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77You do not own this claim!");
        return false
    }

    ClaimStore.removeClaim(chunkKey)
    SpatialCache.invalidate(playerId);
    player.sendMessage("\u00A7a\u00A7l» \u00A7fLand unclaimed.");

    return true
}

/* 
 * TRUST_PROFILE_ORCHESTRATOR
 */
export function trustPlayer(player, targetName, permissions = PERMISSIONS.BUILD) {
    const target = Kernel.world.getAllPlayers().find(p => p.name === targetName)
    if (!target) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Player '${targetName}' not found.`);
        return
    }

    const ClaimStore = Kernel.get("claimStore")
    const playerClaims = ClaimStore.getPlayerClaims(player.id)
    if (playerClaims.length === 0) {
        player.sendMessage("\u00A7c\u00A7l» \u00A77You don't have any claims.");
        return
    }

    for (const claim of playerClaims) {
        ClaimStore.addTrusted(claim.chunkKey, player.id, target.id, permissions)
    }

    // Invalidate target player permission cache
    SpatialCache.invalidate(target.id);
    player.sendMessage(`\u00A7a\u00A7l» \u00A7e${targetName} \u00A7fhas been trusted.`);
}

/* 
 * TRUST_PROFILE_DECOMMISSIONER
 */
export function untrustPlayer(player, targetName) {
    const target = Kernel.world.getAllPlayers().find(p => p.name === targetName)
    if (!target) {
        player.sendMessage(`\u00A7c\u00A7l» \u00A77Player '${targetName}' not found.`);
        return
    }

    const ClaimStore = Kernel.get("claimStore")
    const playerClaims = ClaimStore.getPlayerClaims(player.id)
    for (const claim of playerClaims) {
        ClaimStore.removeTrusted(claim.chunkKey, target.id)
    }

    // Invalidate target player permission cache
    SpatialCache.invalidate(target.id);
    player.sendMessage(`\u00A7a\u00A7l» \u00A7e${targetName} \u00A7fhas been untrusted.`);
}

export { PERMISSIONS }
