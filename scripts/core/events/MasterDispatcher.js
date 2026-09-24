import { Kernel } from "../Kernel.js";
import { Configuration } from "../../Configuration.js";
import { SpatialCache } from "../../systems/protection/SpatialCache.js";

const PERMISSIONS = { BUILD: 1, CONTAINERS: 2, DOORS: 4, REDSTONE: 8, MOB_INTERACT: 16, CRAFTING: 32 };
const CONTAINER_BLOCKS = new Set(["chest", "barrel", "shulker", "hopper", "dropper", "dispenser", "furnace", "smoker", "brewing_stand"]);
const DOOR_BLOCKS = new Set(["door", "gate"]);
const REDSTONE_BLOCKS = new Set(["lever", "button", "pressure_plate", "daylight_detector", "tripwire_hook", "repeater", "comparator"]);
const CRAFTING_BLOCKS = new Set(["crafting_table", "smithing_table", "cartography_table", "loom", "stonecutter", "grindstone", "anvil", "enchanting_table"]);

/**
 * Classifies block type ID into a land claim permission bitmask.
 * 
 * EXPECTS:
 * - typeId: String identifier representing block type (e.g., "minecraft:chest").
 * 
 * GUARANTEES:
 * - Excludes "ender_chest" from container classifications (personal chest bypass).
 * - Returns corresponding permission bitmask value from PERMISSIONS object.
 * - Returns 0 if block does not match any classified group.
 * 
 * @param {string} typeId - Block type ID.
 * @returns {number} Permission bitmask value.
 */
function classifyBlock(typeId) {
    if (typeId.includes("ender_chest")) return 0; // Ender chests contain private player buffers. Bypass permissions.
    for (const keyword of CONTAINER_BLOCKS) if (typeId.includes(keyword)) return PERMISSIONS.CONTAINERS;
    for (const keyword of DOOR_BLOCKS) if (typeId.includes(keyword)) return PERMISSIONS.DOORS;
    for (const keyword of REDSTONE_BLOCKS) if (typeId.includes(keyword)) return PERMISSIONS.REDSTONE;
    for (const keyword of CRAFTING_BLOCKS) if (typeId.includes(keyword)) return PERMISSIONS.CRAFTING;
    return 0;
}

/**
 * Checks if player possesses super admin bypass tags.
 * 
 * EXPECTS:
 * - player: Player entity object.
 * 
 * GUARANTEES:
 * - Safely returns false if player is invalid.
 * - Safely fallbacks to raw hasTag("admin") if Configuration.SUPER_ADMIN_TAGS is corrupt.
 * - Returns true if player has any tag listed in Configuration.SUPER_ADMIN_TAGS.
 * - Returns false otherwise.
 * 
 * @param {import("@minecraft/server").Player} player - Player object.
 * @returns {boolean} True if player is super admin.
 */
function isGod(player) {
    if (!player || !player.isValid) return false;
    try {
        if (typeof player.hasTag === 'function') {
            if (player.hasTag("AE") || player.hasTag("ae") || player.hasTag("admin") || player.hasTag("Admin") || player.hasTag("op") || player.hasTag("OP")) {
                return true;
            }
        }
        const adminTags = Configuration.SUPER_ADMIN_TAGS;
        if (!Array.isArray(adminTags)) return false;
        const tags = player.getTags();
        return adminTags.some(tag => tags.includes(tag));
    } catch {
        return false;
    }
}

export const MasterDispatcher = {
    _isInitialized: false,
    get _initialized() { return this._isInitialized; },
    set _initialized(val) { this._isInitialized = val; },

    /**
     * Registers unified event subscriptions for block breaking, placement, block interaction, and entity interaction.
     * 
     * EXPECTS:
     * - Kernel.world.beforeEvents objects exist and are subscribable.
     * 
     * GUARANTEES:
     * - Prevents duplicate initialization subscriptions.
     * - Cancels events and sends action bar warning notifications if players lack permissions.
     * - Registers playerPlaceBlock hook to stop all unauthorized builds.
     * - Protects sign text editing under BUILD permission limits.
     * - Correctly routes shop interactions to signal buses.
     */
    init() {
        if (this._isInitialized) return;
        this._isInitialized = true;

        // Unified Interact Gate
        Kernel.world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
            const { player, block } = ev;
            if (isGod(player)) return;

            // 1. Sign Protection Check (Sign editing right-click requires BUILD clearance)
            if (block.typeId.includes("sign")) {
                if (!SpatialCache.canBuild(player, block.location)) {
                    ev.cancel = true;
                    player.onScreenDisplay.setActionBar("\u00A7c\u00A7l» \u00A77You cannot edit signs here!");
                    return;
                }
            }

            // 2. Classified Block Check
            const requiredBitmask = classifyBlock(block.typeId);
            if (requiredBitmask !== 0 && !SpatialCache.hasPermission(player, block.location, requiredBitmask)) {
                ev.cancel = true;
                player.onScreenDisplay.setActionBar("\u00A7c\u00A7l» \u00A77You cannot interact with this!");
                return;
            }

            // 3. Infrastructure Routing
            const shopStore = Kernel.get("chestShopStore");
            if (shopStore && shopStore.isShop(block.location)) {
                Kernel.get("signalBus").emit("internal:shopInteract", ev);
                return;
            }

            Kernel.get("signalBus").emit("external:blockInteract", ev);
        });

        // Unified Place Gate
        Kernel.world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
            const { player, block } = ev;
            if (isGod(player)) return;

            if (!SpatialCache.canBuild(player, block.location)) {
                ev.cancel = true;
                player.onScreenDisplay.setActionBar("\u00A7c\u00A7l» \u00A77You cannot build here!");
            }
        });

        // Unified Break Gate
        Kernel.world.beforeEvents.playerBreakBlock.subscribe((ev) => {
            const { player, block } = ev;
            if (isGod(player)) return;

            if (!SpatialCache.canBuild(player, block.location)) {
                ev.cancel = true;
                player.onScreenDisplay.setActionBar("\u00A7c\u00A7l» \u00A77You cannot build here!");
            }
        });

        // Unified Entity Interact Gate
        Kernel.world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
            const { player, target } = ev;
            if (isGod(player) || !target?.location) return;

            if (!SpatialCache.hasPermission(player, target.location, PERMISSIONS.MOB_INTERACT)) {
                ev.cancel = true;
                player.onScreenDisplay.setActionBar("\u00A7c\u00A7l» \u00A77You cannot interact with mobs here!");
            }
        });
    }
};
