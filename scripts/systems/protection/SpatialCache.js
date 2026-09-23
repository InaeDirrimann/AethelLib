import { Kernel } from "../../core/Kernel.js";
import { ClaimStore } from "./ClaimStore.js";

const PERMISSIONS = {
    BUILD: 1,
    CONTAINERS: 2,
    DOORS: 4,
    REDSTONE: 8,
    MOB_INTERACT: 16,
    CRAFTING: 32
};

const ALL_PERMS = PERMISSIONS.BUILD | PERMISSIONS.CONTAINERS | PERMISSIONS.DOORS | PERMISSIONS.REDSTONE | PERMISSIONS.MOB_INTERACT | PERMISSIONS.CRAFTING;

function spawnChunkBorderParticles(player, chunkKey, isOwner, isTrusted) {
    try {
        const dim = player.dimension;
        const [chunkX, chunkZ] = chunkKey.split(/[_,]/).map(Number);
        const minX = chunkX * 16;
        const maxX = minX + 16;
        const minZ = chunkZ * 16;
        const maxZ = minZ + 16;

        const playerY = Math.floor(player.location.y);
        const minY = playerY;
        const maxY = playerY + 2;

        const particleName = isOwner 
            ? "minecraft:villager_happy" 
            : (isTrusted ? "minecraft:basic_portal_particle" : "minecraft:basic_flame_particle");

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x += 4) {
                dim.spawnParticle(particleName, { x, y: y + 0.1, z: minZ });
                dim.spawnParticle(particleName, { x, y: y + 0.1, z: maxZ });
            }
            for (let z = minZ + 4; z < maxZ; z += 4) {
                dim.spawnParticle(particleName, { x: minX, y: y + 0.1, z });
                dim.spawnParticle(particleName, { x: maxX, y: y + 0.1, z });
            }
        }
    } catch (e) {
        console.error(`[SpatialCache] Particle draw error: ${e}`);
    }
}

/**
 * Volatile cache for chunk-based permissions.
 * Prevents redundant bit-shifting and key string generation on every block interaction.
 */
export const SpatialCache = {
    // Maps PlayerID -> { chunkKey: string, permissions: number }
    playerChunkStates: new Map(),
    // Maps PlayerID -> { x: number, z: number, time: number }
    lastStickRenders: new Map(),

    init() {
        // Trace player coordinate updates at 20 ticks frequency
        Kernel.system.runInterval(() => {
            for (const player of Kernel.world.getAllPlayers()) {
                const currentKey = ClaimStore.locationToChunkKey(player.location);
                const cached = this.playerChunkStates.get(player.id);
                const claim = ClaimStore.getClaim(currentKey);
                const isOwner = claim ? claim.ownerId === player.id : false;
                const isTrusted = claim ? claim.trusted?.[player.id] !== undefined : false;

                if (!cached || cached.chunkKey !== currentKey) {
                    const perms = this._resolvePermissions(currentKey, player.id);
                    this.playerChunkStates.set(player.id, {
                        chunkKey: currentKey,
                        permissions: perms
                    });

                    if (claim) {
                        const ownerName = Kernel.get("database")?.get(`player:${claim.ownerId}:name`) || "Someone";
                        const relation = isOwner ? "§aYour Claim" : (isTrusted ? "§bTrusted Area" : `§cOwner: ${ownerName}`);
                        player.onScreenDisplay.setActionBar(`§6§lEntering Claim §r§7(${relation}§7)`);
                        spawnChunkBorderParticles(player, currentKey, isOwner, isTrusted);
                    } else if (cached && ClaimStore.getClaim(cached.chunkKey)) {
                        player.onScreenDisplay.setActionBar(`§e§lEntering Unclaimed Territory`);
                    }
                }

                // Only check for stick/inventory when player is near a claim —
                // saves a getComponent call per player per tick in unclaimed areas.
                if (claim) {
                    try {
                        const inventory = player.getComponent("minecraft:inventory");
                        const container = inventory?.container;
                        const item = container?.getItem(player.selectedSlotIndex);
                        if (item && item.typeId === "minecraft:stick") {
                            const loc = player.location;
                            const lastRender = this.lastStickRenders.get(player.id);
                            const now = Date.now();
                            
                            const distance = lastRender 
                                ? Math.hypot(loc.x - lastRender.x, loc.z - lastRender.z)
                                : Infinity;
                            const timeSinceLast = lastRender ? (now - lastRender.time) : Infinity;

                            // Only spawn stick particles if player moved > 2 blocks or every 5 seconds (5000ms)
                            if (distance > 2.0 || timeSinceLast > 5000) {
                                this.lastStickRenders.set(player.id, { x: loc.x, z: loc.z, time: now });
                                
                                // Render borders of claimed chunks in 3x3 grid around player
                                const [currentX, currentZ] = currentKey.split(/[_,]/).map(Number);
                                for (let dx = -1; dx <= 1; dx++) {
                                    for (let dz = -1; dz <= 1; dz++) {
                                        const nearbyKey = `${currentX + dx},${currentZ + dz}`;
                                        const nearbyClaim = ClaimStore.getClaim(nearbyKey);
                                        if (nearbyClaim) {
                                            const nbOwner = nearbyClaim.ownerId === player.id;
                                            const nbTrusted = nearbyClaim.trusted?.[player.id] !== undefined;
                                            spawnChunkBorderParticles(player, nearbyKey, nbOwner, nbTrusted);
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.warn(`[SpatialCache] Could not query inventory for ${player.id}: ${e}`);
                    }
                }
            }
        }, 20);

        // Invalidate on player leave to keep memory pristine
        Kernel.world.afterEvents.playerLeave.subscribe((ev) => {
            this.playerChunkStates.delete(ev.playerId);
        });
    },

    _resolvePermissions(chunkKey, playerId) {
        const claim = ClaimStore.getClaim(chunkKey);
        if (!claim) return ALL_PERMS;
        if (claim.ownerId === playerId) return ALL_PERMS;
        return claim.trusted?.[playerId] || 0;
    },

    invalidate(playerId = null) {
        if (playerId) {
            this.playerChunkStates.delete(playerId);
        } else {
            this.playerChunkStates.clear();
        }
    },

    hasPermission(player, location, requiredPermission) {
        const targetKey = ClaimStore.locationToChunkKey(location);
        const cached = this.playerChunkStates.get(player.id);

        if (cached && cached.chunkKey === targetKey) {
            return (cached.permissions & requiredPermission) === requiredPermission;
        }

        const perms = this._resolvePermissions(targetKey, player.id);
        return (perms & requiredPermission) === requiredPermission;
    },

    canBuild(player, location) {
        return this.hasPermission(player, location, PERMISSIONS.BUILD);
    }
};
