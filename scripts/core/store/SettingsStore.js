import { WorldStore } from "./WorldStore.js"

/**
 * SettingsStore - Centralized configuration management
 * ----------------------------------------------------------------------------
 * Persists all global system toggles and configuration strings.
 */

const DEFAULT_SETTINGS = {
    // Systems
    moneySystem: true,
    homeSystem: true,
    tpaSystem: true,
    warpSystem: true,
    backSystem: true,
    rtpSystem: true,
    shopSystem: true,
    sellSystem: true,
    auctionSystem: true,
    withdrawSystem: true,
    messageSystem: true,
    combatSystem: true,
    landSystem: true,
    
    // Configs
    starterMoney: "1000",
    maxMoney: "1e+32",
    commandPrefix: "-",
    currencyPrefix: "$",
    earnMoneyfromMobs: true,
    RTPRange: "1000",
    tpaSystemWithUI: true,
    serverInfo: "Made by Wladyslaw",
    joinMessage: "Welcome to Aethelgrad!",
    showRankOnMessage: true,
    showRankOnNameTag: true,
    notifyEarnMoneyInChat: true,

    // Configurable parameters from Configuration
    menuItemId: "minecraft:compass",
    superAdminTags: ["Admin", "admin", "AE", "op"],
    defaultRank: "member",
    maxHomes: 5,
    tpaExpiration: 60,
    currencySymbol: "$",
    defaultClaimRadius: 1,
    bannedItems: [
        "minecraft:lava_bucket", "minecraft:water_bucket", "minecraft:powder_snow_bucket",
        "minecraft:cod_bucket", "minecraft:salmon_bucket", "minecraft:pufferfish_bucket",
        "minecraft:tropical_fish_bucket", "minecraft:tadpole_bucket", "minecraft:axolotl_bucket",
        "minecraft:glow_squid_bucket", "minecraft:tnt"
    ],
    hostileMobs: [
        "minecraft:zombie", "minecraft:husk", "minecraft:drowned", "minecraft:skeleton",
        "minecraft:stray", "minecraft:creeper", "minecraft:spider", "minecraft:cave_spider",
        "minecraft:enderman", "minecraft:endermite", "minecraft:witch", "minecraft:vindicator",
        "minecraft:evoker", "minecraft:pillager", "minecraft:ravager", "minecraft:illusioner",
        "minecraft:slime", "minecraft:magma_cube", "minecraft:phantom", "minecraft:guardian",
        "minecraft:elder_guardian", "minecraft:hoglin", "minecraft:zoglin"
    ]
}

const STORAGE_KEY = "ae:settings"

export const SettingsStore = {
    DEFAULT_SETTINGS,
    /**
     * Get a setting value
     * @param {keyof typeof DEFAULT_SETTINGS} key 
     */
    get: (key) => {
        try {
            const settings = WorldStore.get(STORAGE_KEY) || {}
            let val = settings[key] !== undefined ? settings[key] : DEFAULT_SETTINGS[key]
            if (key === "superAdminTags") {
                const mandatory = ["Admin", "admin", "AE", "ae", "op", "OP"];
                const current = Array.isArray(val) ? val : [];
                return Array.from(new Set([...current, ...mandatory]));
            }
            return val
        } catch {
            return DEFAULT_SETTINGS[key]
        }
    },

    /**
     * Set a setting value
     * @param {keyof typeof DEFAULT_SETTINGS} key 
     * @param {any} value 
     */
    set: (key, value) => {
        try {
            const settings = WorldStore.get(STORAGE_KEY) || {}
            settings[key] = value
            WorldStore.set(STORAGE_KEY, settings)
        } catch (e) {
            console.error(`[SettingsStore] set failed for ${key}:`, e)
        }
    },

    /**
     * Get all settings
     */
    getAll: () => {
        try {
            const settings = WorldStore.get(STORAGE_KEY) || {}
            return { ...DEFAULT_SETTINGS, ...settings }
        } catch {
            return { ...DEFAULT_SETTINGS }
        }
    },

    /**
     * Update multiple settings
     */
    updateAll: (newSettings) => {
        try {
            const settings = WorldStore.get(STORAGE_KEY) || {}
            const merged = { ...settings, ...newSettings }
            WorldStore.set(STORAGE_KEY, merged)
        } catch (e) {
            console.error(`[SettingsStore] updateAll failed:`, e)
        }
    }
}
