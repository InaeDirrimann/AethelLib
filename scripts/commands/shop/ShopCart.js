import { Kernel } from "../../core/Kernel.js";
import { getItemPrice, getItemDisplayName } from "./ShopPrices.js";

class ShopCart {
    getCart(player) {
        const PlayerStore = Kernel.get("playerStore");
        if (!PlayerStore) return new Map();
        const data = PlayerStore.get(player, "shop:cart");
        if (!data) return new Map();
        return new Map(Object.entries(data));
    }

    saveCart(player, cartMap) {
        const PlayerStore = Kernel.get("playerStore");
        if (!PlayerStore) return;
        const obj = Object.fromEntries(cartMap);
        PlayerStore.set(player, "shop:cart", obj);
    }

    addToCart(player, itemId, quantity) {
        if (quantity <= 0) return { success: false, message: "[!] Quantity must be positive!" };
        const cart = this.getCart(player);
        const current = cart.get(itemId) || 0;
        const total = current + quantity;

        if (total > 999) return { success: false, message: "[!] Cannot exceed 999 units of a single item type!" };

        cart.set(itemId, total);
        this.saveCart(player, cart);
        return {
            success: true,
            message: `[!] Added ${quantity}x ${getItemDisplayName(itemId)} to cart. Total: ${total}`,
            newQty: total
        };
    }

    removeFromCart(player, itemId, quantity = null) {
        const cart = this.getCart(player);
        if (!cart.has(itemId)) return { success: false, message: "[!] Item is not in your cart!" };

        const current = cart.get(itemId);
        if (quantity === null || quantity >= current) {
            cart.delete(itemId);
            this.saveCart(player, cart);
            return { success: true, message: `[!] Removed ${getItemDisplayName(itemId)} from cart.` };
        }

        const remaining = current - quantity;
        cart.set(itemId, remaining);
        this.saveCart(player, cart);
        return {
            success: true,
            message: `[!] Removed ${quantity}x ${getItemDisplayName(itemId)}. Remaining: ${remaining}`
        };
    }

    clearCart(player) {
        const PlayerStore = Kernel.get("playerStore");
        PlayerStore.set(player, "shop:cart", {});
        return { success: true, message: "[!] Cart cleared. Fresh start!" };
    }

    getCartSummary(player) {
        const cart = this.getCart(player);
        const items = [];
        let totalPrice = 0;

        for (const [itemId, quantity] of cart) {
            const cost = getItemPrice(itemId, quantity);
            totalPrice += cost;
            items.push({
                id: itemId,
                name: getItemDisplayName(itemId),
                quantity,
                totalPrice: cost
            });
        }

        return { items, totalPrice, count: items.length };
    }
}

export const ShopCartInstance = new ShopCart();
