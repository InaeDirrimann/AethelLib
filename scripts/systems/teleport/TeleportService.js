import { Kernel } from "../../core/Kernel.js"

/*
 * Teleport Service
 * ----------------------------------------------------------------------------
 * Handles all player teleportation, including delays, combat checks, 
 * safe location probes, and back-location tracking.
 */

const LAST_POS_STORE = new Map() // VOLATILE_BACK_ANCHOR_REGISTRY

export const TeleportService = {
    /* 
     * RELOCATION_EXECUTION_VECTOR
     */
    teleport(player, destination, dimensionId = null) {
        if (!player || !player.isValid) return false
        const rawPlayer = player.__rawEntity__ || player;

        const prevPos = {
            location: { ...rawPlayer.location },
            dimensionId: rawPlayer.dimension.id
        };

        const targetDimId = dimensionId || rawPlayer.dimension.id;
        if (!this._isLocationSafe(destination, targetDimId)) {
            rawPlayer.sendMessage("\u00A7c\u00A7l» \u00A77Teleport failed: Destination is unsafe or invalid!");
            return false
        }

        try {
            const targetDim = Kernel.world.getDimension(targetDimId);
            if (!targetDim) {
                rawPlayer.sendMessage("\u00A7c\u00A7l» \u00A77Teleport failed: Target dimension is invalid.");
                return false;
            }
            rawPlayer.teleport(destination, {
                dimension: targetDim,
                keepVelocity: false
            })
            LAST_POS_STORE.set(rawPlayer.id, prevPos);
            return true
        } catch (error) {
            console.error(`[TeleportService] MIGRATION_FAILURE: ${error}`)
            return false
        }
    },

    _checkFloorFooting(floor, minY, locationY) {
        if (!floor || !floor.isValid) return true
        const floorTypeId = floor.typeId || ""
        if (floorTypeId.includes("lava") || floorTypeId.includes("fire")) return false

        if (floor.isAir) {
            let hasFooting = false
            let probe = floor
            for (let d = 0; d < 4; d++) {
                if (!probe || !probe.isValid || probe.location.y <= minY) break
                if (probe.isSolid) {
                    hasFooting = true
                    break
                }
                if (probe.typeId.includes("lava") || probe.typeId.includes("fire")) return false
                probe = probe.below(1)
            }
            if (!hasFooting && (locationY - 4 <= minY)) return false
        }
        return true
    },

    /**
     * Essentials-grade 3-point spatial safety check.
     * Verifies feet, head, and floor blocks to prevent suffocation, void drops, and burning.
     */
    _isLocationSafe(location, dimensionId) {
        try {
            if (!location || typeof location.y !== "number") return false
            const isNetherOrEnd = (dimensionId.includes("nether") || dimensionId.includes("the_end"))
            const minY = isNetherOrEnd ? 0 : -64
            const maxY = dimensionId.includes("nether") ? 127 : 320

            if (location.y <= minY || location.y > maxY) return false
            const dim = Kernel.world.getDimension(dimensionId)
            if (!dim) return false

            const blockLoc = {
                x: Math.floor(location.x),
                y: Math.floor(location.y),
                z: Math.floor(location.z)
            }

            if (!dim.isChunkLoaded(blockLoc)) return true

            const feet = dim.getBlock(blockLoc)
            if (!feet || !feet.isValid) return false

            // 1. Suffocation check: feet cannot be a solid block
            if (feet.isSolid) return false

            // 2. Head check: head cannot be a solid block
            const head = feet.above(1)
            if (head && head.isValid && head.isSolid) return false

            // 3. Hazard check: cannot be standing in lava or fire
            const feetTypeId = feet.typeId || ""
            if (feetTypeId.includes("lava") || feetTypeId.includes("fire")) return false

            // 4. Floor & Void check
            return this._checkFloorFooting(feet.below(1), minY, location.y)
        } catch {
            return false // Failsafe: deny on dimension or block query error
        }
    },

    // Executes a delayed teleportation with movement and combat interruption checks.
    async teleportWithWait(player, destination, dimensionId, waitTime) {
        if (!player || !player.isValid) return false
        const rawPlayer = player.__rawEntity__ || player;
        
        const time = Math.max(0, parseInt(waitTime) || 0)
        const startPos = { x: rawPlayer.location.x, y: rawPlayer.location.y, z: rawPlayer.location.z }
        
        for (let i = time; i > 0; i--) {
            if (!rawPlayer.isValid) return false
            
            rawPlayer.onScreenDisplay.setActionBar(`\u00A76\u00A7l» \u00A7eTeleporting in \u00A7f${i}s\u00A7e...`);

            // Wait 1 second (20 ticks)
            await new Promise(resolve => Kernel.system.runTimeout(() => resolve(), 20));

            // Stability Checks
            if (this._hasMoved(rawPlayer, startPos)) {
                rawPlayer.sendMessage("\u00A7c\u00A7l» \u00A77Teleport cancelled: You moved!");
                return false
            }

            if (this._isInCombat(rawPlayer)) {
                rawPlayer.sendMessage("\u00A7c\u00A7l» \u00A77Teleport cancelled: You are in combat!");
                return false
            }
        }

        return new Promise(resolve => {
            Kernel.system.run(() => {
                const success = this.teleport(rawPlayer, destination, dimensionId);
                resolve(success);
            });
        });
    },

    _hasMoved(player, startPos) {
        const dx = Math.abs(player.location.x - startPos.x)
        const dy = Math.abs(player.location.y - startPos.y)
        const dz = Math.abs(player.location.z - startPos.z)
        return dx > 0.5 || dy > 0.5 || dz > 0.5
    },

    _isInCombat(player) {
        const CombatIntegrity = Kernel.get("combatIntegrity")
        return CombatIntegrity?.isInCombat(player.id) || false
    },

    getLastPosition(playerId) {
        return LAST_POS_STORE.get(playerId) || null
    },

    init() {
        Kernel.world.afterEvents.entityDie.subscribe((event) => {
            if (event.deadEntity.typeId === "minecraft:player") {
                const player = event.deadEntity
                LAST_POS_STORE.set(player.id, {
                    location: { ...player.location },
                    dimensionId: player.dimension.id
                })
            }
        })
        Kernel.world.afterEvents.playerLeave.subscribe((event) => {
            LAST_POS_STORE.delete(event.playerId)
        })
        console.log("[TeleportService] Teleport Service online.");
    }
}
