import { Kernel } from "../../core/Kernel.js"

/*
 * INDUSTRIAL_PLACEHOLDER_ORCHESTRATOR
 * ----------------------------------------------------------------------------
 * A high-performance resolution engine for dynamic string-tokens.
 */

const registry = new Map()
let currentTPS = 20

export const PlaceholderProvider = {
    init() {
        this.registerPlaceholder("PlayerCount", () => {
            return String(Kernel.world.getAllPlayers().length)
        })

        this.registerPlaceholder("TPS", () => {
            return String(Math.round(currentTPS))
        })

        this.registerPlaceholder("Online", () => {
            return Kernel.world.getAllPlayers().map(p => p.name).join(", ")
        })

        this.registerPlaceholder("PlayerName", (player) => {
            return player?.name || "UNKNOWN_ENTITY"
        })

        this.registerPlaceholder("Money", (player) => {
            if (!player) return "0"
            const EconomyStore = Kernel.get("economy")
            return String(EconomyStore?.getBalance(player) || 0)
        })

        this.registerPlaceholder("Rank", (player) => {
            if (!player) return "NON_RANKED"
            const PermissionManager = Kernel.get("permissions")
            const rank = PermissionManager?.getHighestRank(player)
            if (!rank || !rank.name) return "NON_RANKED"
            return rank.name.replace(/^\[+|\]+$/g, "")
        })
    },

    setTPS(value) {
        currentTPS = Math.min(Math.max(0, value), 20)
    },

    registerPlaceholder(key, resolver) {
        registry.set(key, resolver)
    },

    resolve(text, player) {
        if (!text || !text.includes("{")) return text

        return text.replace(/\{(\w+)\}/g, (match, key) => {
            const resolver = registry.get(key)
            if (!resolver) return match 
            try {
                return resolver(player)
            } catch {
                return match
            }
        })
    },

    getPlaceholderKeys() {
        return Array.from(registry.keys())
    }
}

export function init() {
    PlaceholderProvider.init()
}
