import { Kernel } from "../../core/Kernel.js";

// Track spawned entities (shared with PlaceholderScheduler)
export const activeProjections = new Map()

/**
 * Initialize floating text service
 */
export function init() {
    console.log("[FloatingTextService] Proximity Projection Engine online.");
}

/**
 * Spawn floating text entity
 * @param {Object} entry - Text entry data
 */
export function spawnFloatingText(entry) {
    try {
        if (!entry.id || activeProjections.has(entry.id)) return
        const dim = Kernel.world.getDimension(entry.dimension)
        let entity;
        try {
            entity = dim.spawnEntity("ael:floating_text", { x: entry.x, y: entry.y, z: entry.z });
        } catch {
            entity = dim.spawnEntity("minecraft:armor_stand", { x: entry.x, y: entry.y, z: entry.z });
            try {
                entity.addEffect("invisibility", 20000000, { showParticles: false });
                entity.addTag("ae:floating_text");
            } catch {}
        }
        if (entity) {
            entity.nameTag = entry.text;
            activeProjections.set(entry.id, entity);
        }
    } catch (error) {
        console.error(`Failed to spawn floating text: ${error}`)
    }
}

/**
 * Remove floating text entity
 * @param {string} id - Entry ID
 */
export function removeFloatingText(id) {
    try {
        const entity = activeProjections.get(id)
        if (entity?.isValid) {
            entity.remove()
        }
        activeProjections.delete(id)
    } catch (error) {
        console.error(`Failed to remove floating text: ${error}`)
    }
}

/**
 * Clear all floating text entities
 */
export function clearAll() {
    try {
        for (const [_id, entity] of activeProjections.entries()) {
            if (entity?.isValid) {
                entity.remove()
            }
        }
        activeProjections.clear()
    } catch (error) {
        console.error(`Failed to clear floating texts: ${error}`)
    }
}

