import { Kernel } from "../../core/Kernel.js"

/*
 * Combat Integrity
 * ----------------------------------------------------------------------------
 * Handles combat tagging and penalizing players who combat-log.
 */


const combatState = new Map() // Active combat participants
const COMBAT_DURATION = 200 // Combat duration (10 seconds)

/* 
 * System Initialization
 */
export function init() {
    /* 
     * Combat Detection
     * Subscribes to the entityHurt event to tag participants in combat.
     */
    Kernel.world.afterEvents.entityHurt.subscribe((event) => {

        const hurtEntity = event.hurtEntity
        const damagingEntity = event.damageSource?.damagingEntity

        if (hurtEntity?.typeId === "minecraft:player" && damagingEntity?.typeId === "minecraft:player") {
            const currentTick = Kernel.system.currentTick
            combatState.set(hurtEntity.id, currentTick + COMBAT_DURATION)
            combatState.set(damagingEntity.id, currentTick + COMBAT_DURATION)

            Kernel.system.run(() => {
                if (hurtEntity.isValid && hurtEntity.typeId === "minecraft:player") {
                    /** @type {import("@minecraft/server").Player} */ (hurtEntity).onScreenDisplay.setActionBar("\u00A7c\u00A7l» \u00A7eIn Combat! \u00A7cDo not leave! \u00A7l«")
                }
                if (damagingEntity.isValid && damagingEntity.typeId === "minecraft:player") {
                    /** @type {import("@minecraft/server").Player} */ (damagingEntity).onScreenDisplay.setActionBar("\u00A7c\u00A7l» \u00A7eIn Combat! \u00A7cDo not leave! \u00A7l«")
                }
            })
        }
    })

    /* 
     * Combat Logging Detection
     * Monitors the playerLeave event. If a player leaves while 
     * tagged, they are marked for a penalty.
     */
    Kernel.world.afterEvents.playerLeave.subscribe((event) => {
        const playerId = event.playerId
        const combatTick = combatState.get(playerId)
        const currentTick = Kernel.system.currentTick

        if (combatTick && currentTick < combatTick) {
            const PlayerStore = Kernel.get("playerStore")
            PlayerStore.set({ id: playerId }, "deathDebt", true)
            combatState.delete(playerId)
        }
    })

    /* 
     * Combat Log Penalty
     * Handles players who log back in after combat logging.
     */
    Kernel.world.afterEvents.playerSpawn.subscribe((event) => {

        if (!event.initialSpawn) return

        const player = event.player
        const PlayerStore = Kernel.get("playerStore")
        const deathDebt = PlayerStore.get(player, "deathDebt")

        if (deathDebt === true) {
            Kernel.system.runTimeout(() => {
                if (!player.isValid) return

                try {
                    const inventory = player.getComponent(Kernel.EntityComponentTypes.Inventory)
                    if (inventory?.container) {
                        inventory.container.clearAll()
                    }

                    player.kill()

                    PlayerStore.set(player, "deathDebt", false)
                    player.sendMessage("\u00A7c\u00A7l» \u00A7eCombat Logging Detected! \u00A77Your items have been removed.");

                } catch (error) {
                    console.error(`[CombatIntegrity] PENALTY_ORCHESTRATION_FAILURE for ${player.id}:`, error)
                }
            }, 20)
        }
    })

    Kernel.system.runInterval(cleanup, 200)
}

/* 
 * ENGAGEMENT_STATUS_QUERY
 */
export function isInCombat(playerId) {
    const combatTick = combatState.get(playerId)
    return combatTick && Kernel.system.currentTick < combatTick
}

/* 
 * TEMPORAL_ENGAGEMENT_METRIC
 */
export function getCombatTime(playerId) {
    const combatTick = combatState.get(playerId)
    if (!combatTick) return 0
    return Math.max(0, combatTick - Kernel.system.currentTick)
}

/* 
 * REGISTRY_MAINTENANCE_PROTOCOL
 * Decommissions expired engagement nodes from the volatile buffer.
 */
export function cleanup() {
    const currentTick = Kernel.system.currentTick
    for (const [playerId, combatTick] of combatState.entries()) {
        if (currentTick >= combatTick) {
            combatState.delete(playerId)
        }
    }
}


