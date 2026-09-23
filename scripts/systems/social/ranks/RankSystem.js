import { Kernel } from "../../../core/Kernel.js"
import { DEFAULT_RANKS } from "../../../data/RankConfig.js"
import { LifecycleController } from "../../../core/LifecycleController.js"
import { ColorUtils } from "../../../utils/ColorUtils.js"
import { RankFormatter } from "./RankFormatter.js"

/*
 * INDUSTRIAL_HIERARCHY_ORCHESTRATOR
 * ----------------------------------------------------------------------------
 * A high-performance orchestration layer for the management of the 
 * server's industrial hierarchy. Coordinates rank initialization, 
 * lifecycle management (CRUD), and temporal rank-expiration vectors.
 *
 * PHILOSOPHY: Hierarchy is the structure of command. Every entity must 
 * have a defined clearance-level within the industrial manifest.
 */

let initialized = false

export const RankSystem = {
    /* 
     * SYSTEM_BOOTSTRAP_PROTOCOL
     * Initializes the hierarchy-manifest from the data-config and 
     * schedules the temporal expiration maintenance-vector.
     */
    init: () => {
        if (!LifecycleController.boot("rankSystem")) return
        initialized = true

        const RankStore = Kernel.get("rankStore")
        const PermissionManager = Kernel.get("permissions")

        /* DATA_DRIVEN_BOOTSTRAP */
        for (const rank of DEFAULT_RANKS) {
            let rankData = RankStore.getRank(rank.id);
            let requiresSave = false;

            if (!rankData) {
                rankData = {
                    name: rank.name || rank.id,
                    order: rank.id === "member" ? -999 : (rank.order || 0),
                    colorText: rank.chatColor || "\u00A77",
                    colorName: rank.color || "\u00A77",
                    hideRanks: rank.id === "member",
                    permissions: rank.permissions || {}
                };
                requiresSave = true;
            } else {
                // Proactively heal existing DB configuration by merging any missing default permissions!
                if (!rankData.permissions) {
                    rankData.permissions = {};
                }
                for (const [perm, val] of Object.entries(rank.permissions || {})) {
                    if (rankData.permissions[perm] === undefined) {
                        rankData.permissions[perm] = val;
                        requiresSave = true;
                    }
                }
            }

            if (requiresSave) {
                RankStore.setRank(rank.id, rankData);
                RankStore.addRankToList(rank.id);
            }
        }

        // Auto-assign default 'member' rank to players on join if they don't have any rank tags
        // We delay this check by 20 ticks (1 second) to allow Bedrock to load player tags from disk first!
        Kernel.world.afterEvents.playerSpawn.subscribe((ev) => {
            const { player } = ev;
            if (!player || !player.isValid) return;
            
            const playerId = player.id;
            Kernel.system.runTimeout(() => {
                const activePlayer = Kernel.world.getAllPlayers().find(p => p.id === playerId);
                if (!activePlayer || !activePlayer.isValid) return;

                const allRanks = RankStore.getAllRanks() || {};
                const rankKeys = Object.keys(allRanks);
                const tags = activePlayer.getTags();
                const hasRank = tags.some(tag => rankKeys.includes(tag));
                
                if (!hasRank) {
                    activePlayer.addTag("member");
                    console.log(`[RankSystem] Assigned default rank 'member' to joining player: ${activePlayer.name}`);
                    
                    // Force invalidate cache to compute new permissions instantly
                    const PM = Kernel.get("permissions");
                    if (PM) {
                        PM.invalidatePlayerCache(playerId);
                    }
                }
                refreshPlayerNametag(activePlayer);
            }, 20);
        });

        // Scan and auto-assign to online players for hot reloads
        Kernel.system.runTimeout(() => {
            const allRanks = RankStore.getAllRanks() || {};
            const rankKeys = Object.keys(allRanks);
            
            for (const player of Kernel.world.getAllPlayers()) {
                if (!player.isValid) continue;
                const tags = player.getTags();
                const hasRank = tags.some(tag => rankKeys.includes(tag));
                
                if (!hasRank) {
                    player.addTag("member");
                    console.log(`[RankSystem] Verified/Assigned default rank 'member' to online player: ${player.name}`);
                    const PM = Kernel.get("permissions");
                    if (PM) {
                        PM.invalidatePlayerCache(player.id);
                    }
                }
            }
        }, 40);

        // Failsafe: periodically check online players and assign default member rank if they have no rank tag
        Kernel.system.runInterval(() => {
            try {
                const allRanks = RankStore.getAllRanks() || {};
                const rankKeys = Object.keys(allRanks);
                
                for (const player of Kernel.world.getAllPlayers()) {
                    if (!player.isValid) continue;
                    const tags = player.getTags();
                    const hasRank = tags.some(tag => rankKeys.includes(tag));
                    
                    if (!hasRank) {
                        player.addTag("member");
                        console.log(`[RankSystem] Failsafe: Assigned default rank 'member' to player: ${player.name}`);
                        const PM = Kernel.get("permissions");
                        if (PM) {
                            PM.invalidatePlayerCache(player.id);
                        }
                    }
                }
            } catch (e) {
                console.error("[RankSystem] Failsafe rank check error:", e);
            }
        }, 1200); // Check every 60 seconds

        // Synchronize PermissionManager with the persistent store
        PermissionManager.init()

        /* TEMPORAL_EXPIRATION_VECTOR */
        Kernel.system.runInterval(() => {
            const now = Date.now()
            for (const player of Kernel.world.getAllPlayers()) {
                if (!player.isValid) continue
                try {
                    const raw = player.getDynamicProperty("ae:tempranks")
                    if (!raw) continue
                    const list = JSON.parse(String(raw))
                    const remaining = list.filter(r => {
                        if (now >= r.expiresAt) {
                            player.removeTag(String(r.tag));
                            return false
                        }
                        return true
                    })
                    player.setDynamicProperty("ae:tempranks", JSON.stringify(remaining))
                } catch (e) {
                    console.error("[RankSystem] TEMPORAL_MAINTENANCE_FAILURE:", e)
                }
            }
        }, 1200)
    },

    createRank: (tag, rankData) => {
        const RankStore = Kernel.get("rankStore")
        if (!tag || !rankData) return false

        // Safety guard: prevent overwriting existing ranks
        if (RankStore.getRank(tag)) return false

        if (rankData.name) {
            rankData.name = rankData.name.replace(/^\[+|\]+$/g, "").trim();
        }
        if (rankData.colorName) {
            rankData.colorName = ColorUtils.normalizeColorCode(rankData.colorName, "§7");
        }
        if (rankData.colorText) {
            rankData.colorText = ColorUtils.normalizeColorCode(rankData.colorText, "§f");
        }

        const success = RankStore.setRank(tag, rankData)
        if (success) {
            RankStore.addRankToList(tag)
            const PermissionManager = Kernel.get("permissions")
            PermissionManager.init() 
            PermissionManager.invalidatePlayerCache()
        }
        return success
    },

    /* 
     * HIERARCHY_NODE_CALIBRATION
     */
    updateRank: (tag, rankData) => {
        const RankStore = Kernel.get("rankStore")
        if (!tag || !rankData) return false

        if (rankData.name) {
            rankData.name = rankData.name.replace(/^\[+|\]+$/g, "").trim();
        }
        if (rankData.colorName) {
            rankData.colorName = ColorUtils.normalizeColorCode(rankData.colorName, "§7");
        }
        if (rankData.colorText) {
            rankData.colorText = ColorUtils.normalizeColorCode(rankData.colorText, "§f");
        }

        const success = RankStore.setRank(tag, rankData)
        if (success) {
            const PermissionManager = Kernel.get("permissions")
            PermissionManager.init() 
            PermissionManager.invalidatePlayerCache()
        }
        return success
    },

    /* 
     * HIERARCHY_NODE_DECOMMISSION
     */
    deleteRank: (tag) => {
        const RankStore = Kernel.get("rankStore")
        if (!tag) return false

        const success = RankStore.deleteRank(tag)
        if (success) {
            RankStore.removeRankFromList(tag)
            const PermissionManager = Kernel.get("permissions")
            PermissionManager.init() 
            PermissionManager.invalidatePlayerCache()
        }
        return success
    },

    /* 
     * REGISTRY_QUERY_VECTORS
     */
    getRank: (tag) => {
        const RankStore = Kernel.get("rankStore")
        return RankStore.getRank(tag)
    },

    getAllRanks: () => {
        const RankStore = Kernel.get("rankStore")
        return RankStore.getAllRanks()
    },

    /* 
     * CLEARANCE_RESOLVER_PROXY
     */
    getPermission: (player, key) => {
        const PermissionManager = Kernel.get("permissions")
        return PermissionManager.getPermission(player, key)
    },

    /* 
     * TEMPORAL_CLEARANCE_INJECTION
     * Injects a temporary clearance-node with a defined industrial TTL.
     */
    addTempRank: (player, tag, durationMs) => {
        const RankStore = Kernel.get("rankStore")
        if (!RankStore.getRank(tag)) return false

        player.addTag(tag)
        let list = []
        try {
            list = JSON.parse(String(player.getDynamicProperty("ae:tempranks") ?? "[]"))
        } catch { }

        list.push({ tag, expiresAt: Date.now() + durationMs })
        player.setDynamicProperty("ae:tempranks", JSON.stringify(list))
        return true
    }
}

export function refreshPlayerNametag(player) {
    if (!player || !player.isValid) return;
    const SettingsStore = Kernel.get("settings");
    if (SettingsStore && SettingsStore.get("showRankOnNameTag") === false) return;
    const formatted = RankFormatter.formatPlayerNametag(player);
    if (player.nameTag !== formatted) {
        player.nameTag = formatted;
    }
}
