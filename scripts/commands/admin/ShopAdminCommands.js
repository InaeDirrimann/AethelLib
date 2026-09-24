import { Kernel } from "../../core/Kernel.js";
import { ShopRegistry } from "../../systems/shop/ShopRegistry.js";
import { ValidationHelper } from "../../utils/ValidationHelper.js";

/**
 * SHOP_ADMIN_VECTORS
 * ----------------------------------------------------------------------------
 * Administrative tools for live shop orchestration.
 */
export const ShopAdminCommands = [
    {
        name: "shopadd",
        description: "Registers the held item to the industrial shop manifest.",
        usage: "/ae:shopadd <category> <price> [priority]",
        permission: "admin.shop",
        category: "ADMIN",
        params: [
            { name: "category", type: "string", optional: false },
            { name: "price", type: "integer", optional: false },
            { name: "priority", type: "integer", optional: true }
        ],
        execute(_data, player, args) {
            if (args.length < 2) {
                player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:shopadd <category> <price> [priority]");
                return;
            }

            const category = args[0].toUpperCase();
            const price = parseInt(args[1]);
            const priority = parseInt(args[2]) || 99;

            if (isNaN(price) || price < 0) {
                player.sendMessage("\u00A7c\u00A7l» \u00A77Invalid price calibration.");
                return;
            }

            // GET HELD ITEM
            const equippable = player.getComponent(Kernel.EntityComponentTypes.Equippable);
            const slot = Kernel.EquipmentSlot?.Mainhand || "Mainhand";
            const item = equippable?.getEquipment ? equippable.getEquipment(slot) : null;

            if (!item) {
                player.sendMessage("\u00A7c\u00A7l» \u00A77No asset detected in hand buffer.");
                return;
            }

            const itemId = item.typeId;
            
            // REGISTER
            ShopRegistry.registerAsset(category, itemId, {
                price: price,
                priority: priority,
                name: item.nameTag || itemId.split(":")[1].replace(/_/g, " ").toUpperCase(),
                timestamp: Date.now()
            });

            player.sendMessage(`\u00A7a\u00A7l» \u00A7fSuccessfully registered \u00A7e${itemId} \u00A7fto \u00A7b${category} \u00A7ffor \u00A7a$${price.toLocaleString()} \u00A7f(Priority: ${priority}).`);
        }
    },
    {
        name: "shopcatmk",
        description: "Creates a new shop category with a custom icon and priority.",
        usage: "/ae:shopcatmk <id> [icon_texture] [priority]",
        permission: "admin.shop",
        category: "ADMIN",
        params: [
            { name: "id", type: "string", optional: false },
            { name: "icon_texture", type: "string", optional: true },
            { name: "priority", type: "integer", optional: true }
        ],
        execute(_data, player, args) {
            if (args.length < 1) {
                player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:shopcatmk <id> [icon] [priority]");
                return;
            }

            const id = args[0].toUpperCase();
            const icon = args[1] || "textures/items/bucket";
            const priority = parseInt(args[2]) || 99;

            ShopRegistry.addCategory(id, icon, priority);

            player.sendMessage(`\u00A7a\u00A7l» \u00A7fSuccessfully created category \u00A7b${id} \u00A7fwith icon \u00A7e${icon} \u00A7f(Priority: ${priority}).`);
        }
    },
    {
        name: "shopcatrm",
        description: "Removes a shop category and all of its assets.",
        usage: "/ae:shopcatrm <id>",
        permission: "admin.shop",
        category: "ADMIN",
        params: [
            { name: "id", type: "string", optional: false }
        ],
        execute(_data, player, args) {
            if (args.length < 1) {
                player.sendMessage("\u00A7c\u00A7l» \u00A77Usage: /ae:shopcatrm <id>");
                return;
            }

            const id = args[0].toUpperCase();
            const success = ShopRegistry.removeCategory(id);

            if (success) {
                player.sendMessage(`\u00A7a\u00A7l» \u00A7fSuccessfully removed category \u00A7b${id} \u00A7fand all its registered assets.`);
            } else {
                player.sendMessage(`\u00A7c\u00A7l» \u00A77Category \u00A7e${id} \u00A77not found.`);
            }
        }
    },
    {
        name: "shopcatls",
        description: "Lists all active shop categories.",
        usage: "/ae:shopcatls",
        permission: "admin.shop",
        category: "ADMIN",
        params: [],
        execute(_data, player, args) {
            const categories = ShopRegistry.getCategories();
            if (categories.length === 0) {
                player.sendMessage("\u00A7c\u00A7l» \u00A77No shop categories registered.");
                return;
            }

            player.sendMessage("\u00A76\u00A7l=== ACTIVE SHOP CATEGORIES ===");
            categories.forEach(cat => {
                player.sendMessage(`\u00A7e- \u00A7b${cat.id} \u00A77(Priority: ${cat.priority}, Icon: ${cat.icon})`);
            });
        }
    }
];
