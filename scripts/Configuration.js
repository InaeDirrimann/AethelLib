/*
 * INDUSTRIAL_CONFIGURATION_MANIFEST
 * ----------------------------------------------------------------------------
 * The master manifest of global industrial parameters. Defines the 
 * operational boundaries of every sub-system within the AethelLib ecosystem. 
 *
 * PHILOSOPHY: Constants are immutable reality. Modifying these values 
 * recalibrates the entire empire's operational physics.
 */
import { SettingsStore } from "./core/store/SettingsStore.js"

export const Configuration = {
    /*
     * INTERFACE_TRIGGER_PARAMETERS
     * Defines the hardware identifier for the primary GUI injection.
     */
    get MENU_ITEM_ID() {
        return SettingsStore.get("menuItemId")
    },

    /*
     * SECURITY_AND_AUTHORITY_GATEWAYS
     * SUPER_ADMIN_TAGS: The 'GOD_ADMIN' identifiers. Possession of these 
     * tokens grants absolute bypass of all security-clearance nodes.
     *
     * DEFAULT_RANK_IDENTIFIER: The baseline role assigned to uncalibrated 
     * entity buffers.
     */
    get SUPER_ADMIN_TAGS() {
        return SettingsStore.get("superAdminTags")
    },
    get DEFAULT_RANK() {
        return SettingsStore.get("defaultRank")
    },

    /*
     * SPATIAL_MIGRATION_CONSTRAINTS
     * MAX_HOMES: Hard-limit on persistent spatial-anchor entries per UUID.
     * TPA_EXPIRATION_TTL: The lifespan of a spatial handshake before 
     * buffer-decommissioning (in seconds).
     */
    get MAX_HOMES() {
        return Number(SettingsStore.get("maxHomes"))
    },
    get TPA_EXPIRATION() {
        return Number(SettingsStore.get("tpaExpiration"))
    },

    /*
     * Economy settings
     * CURRENCY_SYMBOL: Currency display symbol (e.g. '$').
     * STARTING_BALANCE: Initial balance for new players on first spawn.
     */
    get CURRENCY_SYMBOL() {
        return SettingsStore.get("currencySymbol")
    },
    get STARTING_BALANCE() {
        return Number(SettingsStore.get("starterMoney"))
    },

    /*
     * SPATIAL_SECURITY_PROTOCOLS
     * DEFAULT_CLAIM_RADIUS: The standard acquisition footprint (chunks).
     * BANNED_ASSET_MANIFEST: Blacklisted items threatening structural integrity.
     * THREAT_ACTOR_MANIFEST: Entities classified as hostile for automated 
     * neutralization protocols.
     */
    get DEFAULT_CLAIM_RADIUS() {
        return Number(SettingsStore.get("defaultClaimRadius"))
    },
    get BANNED_ITEMS() {
        return SettingsStore.get("bannedItems")
    },
    get HOSTILE_MOBS() {
        return SettingsStore.get("hostileMobs")
    }
}
