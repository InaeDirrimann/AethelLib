import { Kernel } from "../../core/Kernel.js";

/**
 * INDUSTRIAL_ASSET_POINTER_REGISTRY
 * ----------------------------------------------------------------------------
 * Stores only pointers (categories/metadata). 
 * Full item definitions are pulled from the Database only when queried.
 *
 * PHILOSOPHY: Why load 500 items into RAM when the player can only 
 * see 10? Lazy-loading ensures the engine remains zero-latency.
 */
export const ShopRegistry = {
    _categories: null, // VOLATILE_CACHE

    /**
     * Initializes the category manifest from the persistent store.
     */
    _loadCategories() {
        if (this._categories) return this._categories;
        
        const Database = Kernel.get("database");
        const stored = Database ? Database.get("shop:categories") : null;
        
        if (stored) {
            this._categories = new Map(Object.entries(stored));
        } else {
            // BOOTSTRAP_DEFAULTS
            this._categories = new Map([
                ["BUILDING", { icon: "textures/blocks/stone", priority: 1 }],
                ["MATERIALS", { icon: "textures/items/iron_ingot", priority: 2 }],
                ["EQUIPMENT", { icon: "textures/items/diamond_sword", priority: 3 }],
                ["CONSUMABLES", { icon: "textures/items/apple", priority: 4 }],
                ["BLOCKS", { icon: "textures/blocks/dirt", priority: 5 }],
                ["MISC", { icon: "textures/items/bucket", priority: 6 }]
            ]);
            this._saveCategories();
        }
        return this._categories;
    },

    _saveCategories() {
        const Database = Kernel.get("database");
        if (!Database) return;
        const obj = Object.fromEntries(this._categories);
        Database.set("shop:categories", obj);
    },

    /**
     * Adds a new category to the industrial manifest.
     */
    addCategory(id, icon = "textures/items/bucket", priority = 99) {
        this._loadCategories();
        this._categories.set(id.toUpperCase(), { icon, priority });
        this._saveCategories();
    },

    /**
     * Removes a category from the industrial manifest.
     */
    removeCategory(id) {
        this._loadCategories();
        const upperId = id.toUpperCase();
        if (this._categories.has(upperId)) {
            this._categories.delete(upperId);
            this._saveCategories();

            // Clean up all sharded assets and prices in the category
            const Database = Kernel.get("database");
            if (Database) {
                const collectionName = `shop:assets:${upperId}`;
                const indexKey = `${collectionName}:index`;
                const itemIds = Database.get(indexKey) || [];
                itemIds.forEach(itemId => {
                    Database.deleteSharded(collectionName, itemId);
                    Database.delete(`shop:price:${itemId}`);
                });
                Database.delete(indexKey);
            }
            return true;
        }
        return false;
    },

    /**
     * Registers an asset via a light pointer directly into the database.
     * @param {string} category 
     * @param {string} itemId 
     * @param {object} metadata { price: number, name?: string }
     */
    registerAsset(category, itemId, metadata) {
        const Database = Kernel.get("database");
        Database.setSharded(`shop:assets:${category}`, itemId, {
            ...metadata,
            itemId: itemId
        });
        
        // Global price lookup for transactional efficiency
        Database.set(`shop:price:${itemId}`, metadata.price);
    },

    /**
     * O(1) Lookup: Only get the category's assets when the UI is opened.
     * @param {string} category 
     * @returns {Promise<Array>}
     */
    async getAssetsByCategory(category) {
        const Database = Kernel.get("database");
        return Database.getSharded(`shop:assets:${category}`);
    },

    /**
     * Returns all registered categories.
     */
    getCategories() {
        this._loadCategories();
        return Array.from(this._categories.entries())
            .sort((a, b) => a[1].priority - b[1].priority)
            .map(([id, data]) => ({ id, ...data }));
    }
}
