/**
 * test/stubs/mc-server.js
 * Minimal stub for @minecraft/server used by game code under test.
 * All properties that game modules access are present here.
 */

export const world = {
    getAllPlayers: () => [],
    getDynamicProperty: () => undefined,
    setDynamicProperty: () => {},
    getDynamicPropertyIds: () => [],
    afterEvents:  { playerSpawn: { subscribe: () => {} }, chatSend: { subscribe: () => {} } },
    beforeEvents: { shutdown:    { subscribe: () => {} }, chatSend: { subscribe: () => {} } },
};

export const system = {
    currentTick: 0,
    run:         (fn) => { Promise.resolve().then(fn); return 0; },
    runTimeout:  (fn, _t) => setTimeout(fn, 0),
    runInterval: (_fn, _t) => 0,
    clearRun:    (id) => clearTimeout(id),
    beforeEvents: { shutdown: { subscribe: () => {} } },
};

export class ItemStack {
    constructor(typeId, amount = 1) {
        this.typeId = typeId;
        this.amount = amount;
    }
}

export class Vector3 {}

// Enums / constants game modules may import
export const GameMode = { survival: "survival", creative: "creative" };
export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand", Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" };
export const EntityDamageCause = { entityAttack: "entityAttack", fall: "fall" };
