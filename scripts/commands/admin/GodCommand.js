import { Kernel } from "../../core/Kernel.js";
import { PlayerUtils } from "../../utils/PlayerUtils.js";

export const GodCommand = {
    name: "agod",
    aliases: ["god"],
    description: "Toggles invulnerability for a player",
    usage: "/ae:agod [player]",
    permission: "essentials.admin.god",
    category: "Admin",
    parameters: [
        { name: "player", type: "player", optional: true }
    ],
    execute(data, player, args) {
        const { player: target } = PlayerUtils.resolveFromArgs(args);
        const finalTarget = target || player;
        
        if (!finalTarget) {
            player.sendMessage("\u00A7cPlayer not found.");
            return;
        }

        const isGod = finalTarget.getDynamicProperty("ae:is_god") ?? false;
        const newState = !isGod;
        
        finalTarget.setDynamicProperty("ae:is_god", newState);
        
        if (newState) {
            finalTarget.addTag("ae:god_mode");
        } else {
            finalTarget.removeTag("ae:god_mode");
        }

        player.sendMessage(`\u00A7a\u00A7l» \u00A7fGod mode \u00A7e${newState ? "enabled" : "disabled"}\u00A7f for \u00A7e${finalTarget.name}\u00A7f.`);
        if (finalTarget.id !== player.id) {
            finalTarget.sendMessage(`\u00A7a\u00A7l» \u00A7fGod mode was \u00A7e${newState ? "enabled" : "disabled"}\u00A7f by \u00A7e${player.name}\u00A7f.`);
        }
    }
};

// Called during core boot (Stage 2) to register the damage listener.
// Must NOT run at module import time — Bedrock throws in early-execution mode.
export function init() {
    Kernel.world.beforeEvents.entityHurt.subscribe((event) => {
        const { hurtEntity, damageSource } = event;
        if (hurtEntity && hurtEntity.typeId === "minecraft:player") {
            if (hurtEntity.hasTag("ae:god_mode") || hurtEntity.getDynamicProperty("ae:is_god") === true) {
                // Check if the attacker is using the God Killer (Slasher of Heavens)
                const attacker = damageSource?.damagingEntity;
                if (attacker && attacker.typeId === "minecraft:player") {
                    try {
                        const equippable = attacker.getComponent("minecraft:equippable");
                        const weapon = equippable?.getEquipment("Mainhand");
                        if (weapon) {
                            const weaponRegistry = Kernel.get("weaponRegistry");
                            if (weaponRegistry && typeof weaponRegistry.shouldBypassGodMode === "function" && weaponRegistry.shouldBypassGodMode(weapon)) {
                                // Bypasses god mode invulnerability via microkernel registration!
                                return;
                            }
                            // Fallback check for legacy/standard named items
                            if (weapon.typeId === "aethel:himmelsspalter" || (weapon.nameTag && weapon.nameTag.toLowerCase().includes("himmelsspalter"))) {
                                return;
                            }
                        }
                    } catch (e) {}
                }
                event.cancel = true;
            }
        }
    });
}
