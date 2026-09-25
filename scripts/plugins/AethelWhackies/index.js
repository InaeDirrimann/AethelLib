import { SmiteCommand } from "./commands/SmiteCommand.js";
import { YeetCommand } from "./commands/YeetCommand.js";
import { AtrailCommand, initTrailTicker } from "./commands/AtrailCommand.js";
import { HimmelsspalterCommand } from "./commands/HimmelsspalterCommand.js";
import { LohenCommand } from "./commands/LohenCommand.js";
import { WeaponRegistry } from "./src/WeaponRegistry.js";
import { Kernel } from "../../core/Kernel.js";

// Helper function to build a 100% Mojang-font-compatible progress bar (ASCII segments)
function getProgressBar(current, max, size = 10, fillChar = "|") {
    const pct = Math.min(1.0, Math.max(0, current / max));
    const filledCount = Math.min(size, Math.max(0, Math.floor(pct * size)));
    const emptyCount = size - filledCount;
    
    let color = "\u00A7c"; // Red by default
    if (pct >= 1.0) color = "\u00A76"; // Gold
    else if (pct >= 0.5) color = "\u00A7e"; // Yellow
    
    return `\u00A78[\u00A7r${color}\u00A7l${fillChar.repeat(filledCount)}\u00A7r\u00A78\u00A7l${fillChar.repeat(emptyCount)}\u00A7r\u00A78]`;
}

const FIRE_BEASTS = new Set([
    "minecraft:blaze",
    "minecraft:magma_cube",
    "minecraft:ghast",
    "minecraft:wither_skeleton",
    "minecraft:zombified_piglin",
    "minecraft:husk",
    "minecraft:ender_dragon"
]);

export const manifest = {
    id: "aethel:whackies",
    name: "AethelWhackies",
    version: "1.1.0",
    author: "Aethelgrad Team",
    dependencies: []
};

export function getCommands() {
    return [
        SmiteCommand,
        YeetCommand,
        AtrailCommand,
        HimmelsspalterCommand,
        LohenCommand
    ];
}

export const main = {
    onEnable(context) {
        context.log("[AethelWhackies] Booting weapon microkernel & combat suite...");

        // 1. Expose the weapon registry to other modules and the core
        Kernel.register("weaponRegistry", WeaponRegistry);

        // 2. Register Himmelsspalter (God Killer)
        WeaponRegistry.register("aethel:himmelsspalter", {
            bypassGodMode: true,
            onAttack(event, attacker, victim, weapon, ctx, registry) {
                const lore = weapon.getLore() || [];
                let kills = 0;
                for (const line of lore) {
                    if (line.includes("Gods Slain:")) {
                        const match = line.replace(/\u00A7./g, "").match(/\d+/);
                        if (match) kills = parseInt(match[0]);
                        break;
                    }
                }
                
                if (kills > 0) {
                    const extraDamage = kills * 2; // +2 damage per god slain
                    registry.applyBonusDamage(victim, extraDamage, {
                        cause: "entityAttack",
                        damagingEntity: attacker
                    });
                }

                // Throttled visual feedback: 1 crisp crit particle every 8 ticks, NOT a particle flood!
                if (registry.canTriggerBurst(victim.id, 8)) {
                    try {
                        const loc = victim.location;
                        victim.dimension.spawnParticle("minecraft:critical_hit_emitter", {
                            x: loc.x,
                            y: loc.y + 1.0,
                            z: loc.z
                        });
                        victim.dimension.playSound("random.orb", loc, { pitch: 1.8, volume: 0.6 });
                    } catch (_) {}
                }
            },
            onKill(event, killer, victim, weapon, ctx) {
                const wasGod = victim.hasTag("ae:god_mode") || victim.getDynamicProperty("ae:is_god") === true;
                if (wasGod) {
                    const lore = weapon.getLore() || [];
                    let kills = 0;
                    for (const line of lore) {
                        if (line.includes("Gods Slain:")) {
                            const match = line.replace(/\u00A7./g, "").match(/\d+/);
                            if (match) kills = parseInt(match[0]);
                            break;
                        }
                    }
                    kills++;

                    const newLore = [
                        "\u00A7c\u00A7lHimmelsspalter",
                        "\u00A77A legendary blade forged in spite.",
                        `\u00A77Gods Slain: \u00A7c${kills}`,
                        `${getProgressBar(kills, 10)} \u00A77(+${kills * 2} ATK)`,
                        "\u00A74Bypasses and slices through God Mode."
                    ];
                    
                    weapon.setLore(newLore);
                    const equippable = killer.getComponent("minecraft:equippable");
                    if (equippable) {
                        equippable.setEquipment("Mainhand", weapon);
                    }
                    
                    ctx.world.sendMessage(`\u00A7c\u00A7l» \u00A7e${killer.name}\u00A7f's \u00A7c\u00A7lHimmelsspalter\u00A7f has devoured a deity! Gods Slain: \u00A7c${kills}\u00A7f.`);
                }
            }
        });

        // 3. Register Lohenklinge (Flame Sword)
        WeaponRegistry.register("aethel:lohenklinge", {
            onAttack(event, attacker, victim, weapon, ctx, registry) {
                const lore = weapon.getLore() || [];
                let kills = 0;
                for (const line of lore) {
                    if (line.includes("Fire Beasts Slain:")) {
                        const match = line.replace(/\u00A7./g, "").match(/\d+/);
                        if (match) kills = parseInt(match[0]);
                        break;
                    }
                }

                // Scaled burn duration and bonus heat damage
                let burnDuration = 4;
                let extraDamage = 3;
                let isMaxHeat = false;

                if (kills >= 5000) {
                    burnDuration = 10;
                    extraDamage = 12;
                    isMaxHeat = true;
                } else if (kills >= 2500) {
                    burnDuration = 8;
                    extraDamage = 9;
                } else if (kills >= 1000) {
                    burnDuration = 6;
                    extraDamage = 6;
                } else if (kills >= 500) {
                    burnDuration = 5;
                    extraDamage = 4;
                }

                // Set ablaze
                try { victim.setOnFire(burnDuration, true); } catch (_) {}

                // Multiplier against fire beasts
                let finalDamage = extraDamage;
                if (victim && FIRE_BEASTS.has(victim.typeId)) {
                    finalDamage = Math.floor(extraDamage * 1.5) + 3;
                }

                // Safe bonus damage application
                registry.applyBonusDamage(victim, finalDamage, {
                    cause: "entityAttack",
                    damagingEntity: attacker
                });

                // Throttled particle burst: Maximum 2 particles per hit (zero client FPS drop!)
                if (registry.canTriggerBurst(victim.id, 8)) {
                    try {
                        const loc = victim.location;
                        const dim = victim.dimension;
                        dim.spawnParticle("minecraft:basic_flame_particle", {
                            x: loc.x,
                            y: loc.y + 0.8,
                            z: loc.z
                        });
                        dim.spawnParticle("minecraft:lava_particle", {
                            x: loc.x,
                            y: loc.y + 0.4,
                            z: loc.z
                        });
                        dim.playSound("random.fizz", loc, { pitch: 1.3, volume: 0.5 });

                        // Max heat burst: 1 explosion particle & localized AOE
                        if (isMaxHeat) {
                            dim.spawnParticle("minecraft:huge_explosion_emitter", { x: loc.x, y: loc.y + 0.5, z: loc.z });
                            dim.playSound("random.explode", loc, { pitch: 1.6, volume: 0.7 });
                            
                            const nearby = dim.getEntities({ location: loc, maxDistance: 2.5 });
                            let hitCount = 0;
                            for (const ent of nearby) {
                                if (ent.isValid && ent.id !== attacker.id && ent.id !== victim.id) {
                                    registry.applyBonusDamage(ent, 4, { cause: "entityAttack", damagingEntity: attacker });
                                    try { ent.setOnFire(4, true); } catch (_) {}
                                    if (++hitCount >= 3) break; // Hard cap AOE targets to protect CPU
                                }
                            }
                        }
                    } catch (_) {}
                }
            },
            onKill(event, killer, victim, weapon, ctx) {
                if (victim && FIRE_BEASTS.has(victim.typeId)) {
                    const lore = weapon.getLore() || [];
                    let kills = 0;
                    for (const line of lore) {
                        if (line.includes("Fire Beasts Slain:")) {
                            const match = line.replace(/\u00A7./g, "").match(/\d+/);
                            if (match) kills = parseInt(match[0]);
                            break;
                        }
                    }

                    let points = 10;
                    if (victim.typeId === "minecraft:husk") points = 15;
                    else if (victim.typeId === "minecraft:blaze") points = 25;
                    else if (victim.typeId === "minecraft:wither_skeleton") points = 25;
                    else if (victim.typeId === "minecraft:magma_cube") points = 30;
                    else if (victim.typeId === "minecraft:ghast") points = 50;
                    else if (victim.typeId === "minecraft:ender_dragon") points = 500;

                    kills += points;

                    let levelStr = "Level I";
                    if (kills >= 5000) levelStr = "MAX HEAT";
                    else if (kills >= 2500) levelStr = "Level IV";
                    else if (kills >= 1000) levelStr = "Level III";
                    else if (kills >= 500) levelStr = "Level II";

                    const newLore = [
                        "\u00A76Lohenklinge",
                        "\u00A77A legendary blade forged in fire.",
                        `\u00A77Fire Beasts Slain: \u00A7e${kills}`,
                        `${getProgressBar(kills, 5000)} \u00A77(${levelStr})`,
                        "\u00A7cSets victims ablaze on contact."
                    ];

                    weapon.setLore(newLore);
                    const equippable = killer.getComponent("minecraft:equippable");
                    if (equippable) {
                        equippable.setEquipment("Mainhand", weapon);
                    }

                    // Milestone toasts
                    if (kills >= 500 && (kills - points) < 500) {
                        killer.sendMessage(`\u00A76\u00A7l» \u00A7fYour \u00A76\u00A7lLohenklinge\u00A7f reached \u00A7cHeat Level II\u00A7f! (Target burn duration increased)`);
                    } else if (kills >= 1000 && (kills - points) < 1000) {
                        killer.sendMessage(`\u00A76\u00A7l» \u00A7fYour \u00A76\u00A7lLohenklinge\u00A7f reached \u00A7cHeat Level III\u00A7f! (Passively grants Fire Resistance I)`);
                    } else if (kills >= 2500 && (kills - points) < 2500) {
                        killer.sendMessage(`\u00A76\u00A7l» \u00A7fYour \u00A76\u00A7lLohenklinge\u00A7f reached \u00A7cHeat Level IV\u00A7f! (Passively grants Fire Resistance II)`);
                    } else if (kills >= 5000 && (kills - points) < 5000) {
                        killer.sendMessage(`\u00A76\u00A7l» \u00A7fYour \u00A76\u00A7lLohenklinge\u00A7f reached \u00A7cHeat Level V (MAX HEAT)\u00A7f! (Combustion Blast unlocked!)`);
                    }
                }
            }
        });

        // 4. Low-overhead passive status effects loop using native Bedrock API (Zero command strings!)
        context.system.runInterval(() => {
            try {
                const players = context.world.getAllPlayers();
                for (const player of players) {
                    if (!player.isValid) continue;
                    const equippable = player.getComponent("minecraft:equippable");
                    const weapon = equippable?.getEquipment("Mainhand");
                    if (!weapon) continue;

                    if (weapon.typeId === "aethel:himmelsspalter") {
                        // Native fast C++ effect application: showParticles: false completely avoids visual lag!
                        player.addEffect("speed", 30, { amplifier: 1, showParticles: false });
                        player.addEffect("strength", 30, { amplifier: 0, showParticles: false });
                        player.addEffect("regeneration", 30, { amplifier: 0, showParticles: false });
                    } else if (weapon.typeId === "aethel:lohenklinge") {
                        const lore = weapon.getLore() || [];
                        let kills = 0;
                        for (const line of lore) {
                            if (line.includes("Fire Beasts Slain:")) {
                                const match = line.replace(/\u00A7./g, "").match(/\d+/);
                                if (match) kills = parseInt(match[0]);
                                break;
                            }
                        }

                        let amp = -1;
                        if (kills >= 5000) amp = 2; // Fire Resistance III
                        else if (kills >= 2500) amp = 1; // Fire Resistance II
                        else if (kills >= 1000) amp = 0; // Fire Resistance I

                        if (amp >= 0) {
                            player.addEffect("fire_resistance", 30, { amplifier: amp, showParticles: false });
                        }
                    }
                }
            } catch (_) {}
        }, 20); // 1Hz check

        // 5. Initialize the particle trail ticker (4-tick low-lag throttle)
        initTrailTicker(context);

        // 6. Initialize weapon microkernel listeners
        WeaponRegistry.init(context);

        context.log("[AethelWhackies] Online: Pristine weapon microkernel activated with zero-lag optimization.");
    }
};
