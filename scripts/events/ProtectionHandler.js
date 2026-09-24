/*
 * SPATIAL_PROTECTION_INTERCEPTOR
 * ----------------------------------------------------------------------------
 * Implements the front-line security checks for land-integrity. We use 
 * a Cache-Aside strategy (JS Map) to minimize the overhead of 
 * permission resolution during high-frequency block interactions.
 *
 * IDENTITY_RULE: Every check is resolved via UUID strings. Zero reliance 
 * on volatile entity references.
 */

import { ClaimStore } from "../systems/protection/ClaimStore.js"

/*
 * SERVICE_BOOTSTRAP
 */
export function init() {
    console.log("[ProtectionHandler] SPATIAL_INTEGRITY_ONLINE");
}

/*
 * BLOCK_INTEGRITY_VERIFICATION
 * ----------------------------------------------------------------------------
 * Resolves the chunk-key for the target block and queries the ClaimStore. 
 * If a claim exists, we check the player's UUID against the authorized 
 * access list for the required permission node.
 *
 * @param {Block} block - The spatial target.
 * @param {string} playerId - The actor's UUID.
 * @param {number} requiredPermission - The numeric auth-node required.
 */
function isBlockProtected(block, playerId, requiredPermission) {
    const chunkKey = ClaimStore.locationToChunkKey(block.location, block.dimension?.id)
    const claim = ClaimStore.getClaim(chunkKey)
    
    /* 
     * FALLBACK_BYPASS
     * If no claim is registered for this chunk-key, the zone is 
     * considered 'Open Industrial' and protection is waived.
     */
    if (!claim) return false 
    
    return !ClaimStore.hasPermission(chunkKey, playerId, requiredPermission)
}

/*
 * ENTITY_INTERACTION_VERIFICATION
 */
function isEntityProtected(entity, playerId, requiredPermission) {
    if (!entity.location) return false
    
    const chunkKey = ClaimStore.locationToChunkKey(entity.location, entity.dimension?.id)
    const claim = ClaimStore.getClaim(chunkKey)
    
    if (!claim) return false 
    return !ClaimStore.hasPermission(chunkKey, playerId, requiredPermission)
}

export { isBlockProtected, isEntityProtected }
