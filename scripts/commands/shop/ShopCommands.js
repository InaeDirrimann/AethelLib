import { Kernel } from "../../core/Kernel.js";
import { Lang } from "../../ui/Lang.js";
import { getItemPrice, getItemDisplayName, searchItems, getItemsByCategory } from "./ShopPrices.js";
import { ShopCartInstance } from "./ShopCart.js";
import { createPendingTransaction } from "./ShopConfirmation.js";
import { parseItemId, executeBuyTransaction, hasInventorySpace } from "./ShopCore.js";
import { MINECRAFT_ITEMS } from "../../data/minecraft-items.js";

const ITEMS_PER_PAGE = 10;

export const ShopListCommand = {
    name: "shoplist",
    description: "List items by category and page",
    usage: "/ae:shoplist [category] [page]",
    permission: "essentials.shop",
    category: "Economy",
    params: [
        { name: "category", type: "shop_categories", optional: true },
        { name: "page", type: "integer", optional: true }
    ],

    execute(_data, player, args) {
        const category = args[0] || "all";
        let page = args[1] || 1;

        let items = [];
        if (category === "all") {
            items = Object.keys(MINECRAFT_ITEMS)
                .filter(id => MINECRAFT_ITEMS[id].category !== "admin")
                .map(id => ({
                id,
                name: getItemDisplayName(id),
                price: getItemPrice(id, 1)
            }));
        } else {
            items = getItemsByCategory(category);
        }

        if (items.length === 0) {
            player.sendMessage(`${Lang.PREFIX}§c[X] No items found in category '${category}'.`);
            return;
        }

        const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
        page = Math.max(1, Math.min(page, totalPages));
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const pageItems = items.slice(startIndex, startIndex + ITEMS_PER_PAGE);

        player.sendMessage(`${Lang.PREFIX}§6§l=== SHOP: ${category.toUpperCase()} (${page}/${totalPages}) ===`);
        pageItems.forEach((item, i) => {
            player.sendMessage(`${Lang.PREFIX}§e${startIndex + i + 1}. §f${item.name} §7- §a$${item.price.toLocaleString()}`);
        });
        player.sendMessage(`${Lang.PREFIX}§7Use §e/ae:shoplist ${category} ${page + 1}§7 to view more.`);
    }
};

export const ShopSearchCommand = {
    name: "shopsearch",
    description: "Find items by query string",
    usage: "/ae:shopsearch <query>",
    permission: "essentials.shop",
    category: "Economy",
    params: [
        { name: "query", type: "string", optional: false }
    ],

    execute(_data, player, args) {
        const query = args[0];
        if (!query) {
            player.sendMessage(`${Lang.PREFIX}§cUsage: /ae:shopsearch <query>`);
            return;
        }

        const results = searchItems(query);
        if (results.length === 0) {
            player.sendMessage(`${Lang.PREFIX}§c[X] No items matched your search query.`);
            return;
        }

        player.sendMessage(`${Lang.PREFIX}§6§l=== SEARCH RESULTS: "${query}" ===`);
        results.slice(0, 15).forEach((item) => {
            player.sendMessage(`${Lang.PREFIX}§f${item.name} §7(§8${item.id}§7) - §a$${item.price.toLocaleString()}`);
        });
    }
};

export const ShopBuyCommand = {
    name: "shopbuy",
    description: "Buy an item by name and quantity",
    usage: "/ae:shopbuy <item> [quantity]",
    permission: "essentials.shop",
    category: "Economy",
    params: [
        { name: "item", type: "shop_items", optional: false },
        { name: "quantity", type: "integer", optional: true }
    ],

    execute(_data, player, args) {
        const itemInput = args[0];
        const qtyOverride = args[1];

        if (!itemInput) {
            player.sendMessage(`${Lang.PREFIX}§cUsage: /ae:shopbuy <item> [quantity]`);
            return;
        }

        const itemId = parseItemId(itemInput);
        const quantity = qtyOverride !== undefined ? qtyOverride : 1;

        if (MINECRAFT_ITEMS[itemId]?.category === "admin") {
            player.sendMessage(`${Lang.PREFIX}§c[X] You cannot purchase restricted items.`);
            return;
        }

        if (quantity <= 0 || quantity > 999) {
            player.sendMessage(`${Lang.PREFIX}§c[X] Quantity must be between 1 and 999.`);
            return;
        }

        const price = getItemPrice(itemId, quantity);
        const name = getItemDisplayName(itemId);

        const EconomyStore = Kernel.get("economy");
        const balance = EconomyStore.getBalance(player);
        if (balance < price) {
            player.sendMessage(`${Lang.PREFIX}§c[X] Insufficient liquidity. Need §e$${price.toLocaleString()}§c but you got §e$${balance.toLocaleString()}§c.`);
            return;
        }

        createPendingTransaction(player, {
            summary: `${quantity}x ${name}`,
            totalCost: price
        }, async (p, confirmed) => {
            if (confirmed) {
                await executeBuyTransaction(p, itemId, quantity);
            }
        });
    }
};

export const ShopInfoCommand = {
    name: "shopinfo",
    description: "Show information for an item",
    usage: "/ae:shopinfo <item>",
    permission: "essentials.shop",
    category: "Economy",
    params: [
        { name: "item", type: "shop_items", optional: false }
    ],

    execute(_data, player, args) {
        const itemInput = args[0];
        if (!itemInput) {
            player.sendMessage(`${Lang.PREFIX}§cUsage: /ae:shopinfo <item>`);
            return;
        }
        const itemId = parseItemId(itemInput);
        const unitPrice = getItemPrice(itemId, 1);
        const name = getItemDisplayName(itemId);

        player.sendMessage(`${Lang.PREFIX}§6§l=== ITEM INFO ===`);
        player.sendMessage(`${Lang.PREFIX}§7Name: §f${name}`);
        player.sendMessage(`${Lang.PREFIX}§7ID: §8${itemId}`);
        player.sendMessage(`${Lang.PREFIX}§7Unit Price: §a$${unitPrice.toLocaleString()}`);
        player.sendMessage(`${Lang.PREFIX}§7Stack Price (64): §a$${(unitPrice * 64).toLocaleString()}`);
    }
};

export const ShopCartCommand = {
    name: "shopcart",
    description: "Manage shopping cart items",
    usage: "/ae:shopcart <action> [item] [quantity]",
    permission: "essentials.shop",
    category: "Economy",
    params: [
        { name: "action", type: "cart_actions", optional: false },
        { name: "item", type: "shop_items", optional: true },
        { name: "quantity", type: "integer", optional: true }
    ],

    execute(_data, player, args) {
        const action = args[0]?.toLowerCase();
        if (!action) {
            player.sendMessage(`${Lang.PREFIX}§cUsage: ${this.usage}`);
            return;
        }
        const itemInput = args[1];
        const quantity = args[2] || 1;

        if (action === "list") {
            const summary = ShopCartInstance.getCartSummary(player);
            if (summary.count === 0) {
                player.sendMessage(`${Lang.PREFIX}§7Your cart is empty.`);
                return;
            }

            player.sendMessage(`${Lang.PREFIX}§6§l=== SHOPPING CART ===`);
            summary.items.forEach(item => {
                player.sendMessage(`${Lang.PREFIX}§e${item.quantity}x §f${item.name} §7- §a$${item.totalPrice.toLocaleString()}`);
            });
            player.sendMessage(`${Lang.PREFIX}§6§lTOTAL: §a$${summary.totalPrice.toLocaleString()}`);
            player.sendMessage(`${Lang.PREFIX}§7Use §e/ae:shopcheckout§7 to checkout.`);
            return;
        }

        if (action === "clear") {
            const result = ShopCartInstance.clearCart(player);
            player.sendMessage(`${Lang.PREFIX}${result.message}`);
            return;
        }

        if (!itemInput) {
            player.sendMessage(`${Lang.PREFIX}§cUsage: /ae:shopcart <add|remove> <item> [quantity]`);
            return;
        }

        const itemId = parseItemId(itemInput);
        const qty = args[2] !== undefined ? quantity : 1;

        if (action === "add") {
            const result = ShopCartInstance.addToCart(player, itemId, qty);
            player.sendMessage(`${Lang.PREFIX}${result.message}`);
        } else if (action === "remove") {
            const result = ShopCartInstance.removeFromCart(player, itemId, qty);
            player.sendMessage(`${Lang.PREFIX}${result.message}`);
        } else {
            player.sendMessage(`${Lang.PREFIX}§c[X] Unknown cart action.`);
        }
    }
};

export const ShopCheckoutCommand = {
    name: "shopcheckout",
    description: "Purchase all items in your cart",
    usage: "/ae:shopcheckout",
    permission: "essentials.shop",
    category: "Economy",
    params: [],

    execute(_data, player, _args) {
        const summary = ShopCartInstance.getCartSummary(player);
        if (summary.count === 0) {
            player.sendMessage(`${Lang.PREFIX}§c[X] Your cart is empty!`);
            return;
        }

        const EconomyStore = Kernel.get("economy");
        const balance = EconomyStore.getBalance(player);
        if (balance < summary.totalPrice) {
            player.sendMessage(`${Lang.PREFIX}§c[X] Insufficient liquidity. Need §e$${summary.totalPrice.toLocaleString()}§c, have §e$${balance.toLocaleString()}§c.`);
            return;
        }

        const inventoryComp = player.getComponent("minecraft:inventory") || player.getComponent("inventory");
        const inventory = inventoryComp?.container;
        if (!inventory) {
            player.sendMessage(`${Lang.PREFIX}§c[X] Transaction failed: Cannot access inventory.`);
            return;
        }

        const cart = ShopCartInstance.getCart(player);
        const demands = {};
        for (const [itemId, qty] of cart) {
            demands[itemId] = (demands[itemId] || 0) + qty;
        }

        if (!hasInventorySpace(inventory, demands)) {
            player.sendMessage(`${Lang.PREFIX}§c[X] Transaction failed: Not enough inventory space for all cart items.`);
            return;
        }

        createPendingTransaction(player, {
            summary: `${summary.count} distinct cart item stacks`,
            totalCost: summary.totalPrice
        }, async (p, confirmed) => {
            if (!confirmed) return;

            const innerInvComp = p.getComponent("minecraft:inventory") || p.getComponent("inventory");
            const innerInv = innerInvComp?.container;
            if (!innerInv) {
                p.sendMessage(`${Lang.PREFIX}§c[X] Transaction failed: Cannot access inventory.`);
                return;
            }

            const innerCart = ShopCartInstance.getCart(p);
            const innerDemands = {};
            for (const [itemId, qty] of innerCart) {
                innerDemands[itemId] = (innerDemands[itemId] || 0) + qty;
            }

            if (!hasInventorySpace(innerInv, innerDemands)) {
                p.sendMessage(`${Lang.PREFIX}§c[X] Transaction failed: Not enough inventory space for all cart items.`);
                return;
            }

            let successCount = 0;

            for (const [itemId, qty] of innerCart) {
                const ok = await executeBuyTransaction(p, itemId, qty);
                if (ok) {
                    successCount++;
                }
            }

            if (successCount === innerCart.size) {
                ShopCartInstance.clearCart(p);
                p.sendMessage(`${Lang.PREFIX}§a§l[OK] Cart checkout completed successfully!`);
            } else {
                p.sendMessage(`${Lang.PREFIX}§e[!] Partial checkout completed. Remaining items kept in cart.`);
            }
        });
    }
};
