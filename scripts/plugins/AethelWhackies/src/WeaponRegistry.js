import { Kernel } from "../../../core/Kernel.js";

/**
 * Structure of Arrays (SoA) layout for high performance weapon metadata.
 * Handles weapon combat lifecycle with strict re-entrancy and spam protection.
 */
class WeaponRegistryService {
    constructor() {
        this.definitions = new Map();
        this._applyingBonus = false;
        this._victimCooldowns = new Map();
    }

    register(itemTypeId, definition) {
        this.definitions.set(itemTypeId, {
            bypassGodMode: Boolean(definition.bypassGodMode),
            onAttack: typeof definition.onAttack === "function" ? definition.onAttack : null,
            onKill: typeof definition.onKill === "function" ? definition.onKill : null
        });
        console.log(`[AethelWhackies] Registered custom weapon: ${itemTypeId}`);
    }

    shouldBypassGodMode(weapon) {
        if (!weapon) return false;
        const def = this.definitions.get(weapon.typeId);
        return def ? def.bypassGodMode : false;
    }

    /**
     * Safely applies extra bonus damage without re-triggering the weapon attack pipeline.
     */
    applyBonusDamage(victim, amount, options = {}) {
        if (!victim || !victim.isValid || amount <= 0) return;
        this._applyingBonus = true;
        try {
            victim.applyDamage(amount, options);
        } catch (_) {
        } finally {
            this._applyingBonus = false;
        }
    }

    /**
     * Checks if a target is ready for a throttled particle/sound burst (prevents packet flood).
     * @param {string} victimId
     * @param {number} cooldownTicks
     * @returns {boolean}
     */
    canTriggerBurst(victimId, cooldownTicks = 6) {
        const now = Date.now();
        const last = this._victimCooldowns.get(victimId) || 0;
        if (now - last < cooldownTicks * 50) return false;
        this._victimCooldowns.set(victimId, now);
        // Garbage collection if map grows large
        if (this._victimCooldowns.size > 500) {
            for (const [id, time] of this._victimCooldowns) {
                if (now - time > 10000) this._victimCooldowns.delete(id);
            }
        }
        return true;
    }

    init(context) {
        // Event hook: Hurt listener to execute custom attack hooks with strict re-entrancy guard
        context.world.beforeEvents.entityHurt.subscribe((event) => {
            if (this._applyingBonus) return; // Prevent infinite damage feedback loops!

            try {
                const victim = event.hurtEntity;
                const damageSource = event.damageSource;
                const attacker = damageSource?.damagingEntity;

                if (attacker && attacker.typeId === "minecraft:player" && victim && victim.isValid) {
                    const equippable = attacker.getComponent("minecraft:equippable");
                    const weapon = equippable?.getEquipment("Mainhand");

                    if (weapon) {
                        const def = this.definitions.get(weapon.typeId);
                        if (def && def.onAttack) {
                            def.onAttack(event, attacker, victim, weapon, context, this);
                        }
                    }
                }
            } catch (e) {
                context.error(`[WeaponRegistry] entityHurt error: ${e}`);
            }
        });

        // Event hook: Kill listener to execute custom kill hooks (e.g. leveling up weapons)
        context.world.afterEvents.entityDie.subscribe((event) => {
            try {
                const victim = event.deadEntity;
                const damageSource = event.damageSource;
                const killer = damageSource?.damagingEntity;

                if (killer && killer.typeId === "minecraft:player" && victim) {
                    const equippable = killer.getComponent("minecraft:equippable");
                    const weapon = equippable?.getEquipment("Mainhand");

                    if (weapon) {
                        const def = this.definitions.get(weapon.typeId);
                        if (def && def.onKill) {
                            def.onKill(event, killer, victim, weapon, context, this);
                        }
                    }
                }
            } catch (e) {
                context.error(`[WeaponRegistry] entityDie error: ${e}`);
            }
        });

        context.log("[WeaponRegistry] Pristine microkernel listeners online with recursion guard.");
    }
}

export const WeaponRegistry = new WeaponRegistryService();
