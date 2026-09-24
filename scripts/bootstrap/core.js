import { Kernel } from "../core/Kernel.js"
import { RankSystem } from "../systems/social/ranks/RankSystem.js"
import { ChatSystem } from "../systems/social/chat/ChatSystem.js"
import { BanManager } from "../systems/admin/BanManager.js"
import { Database } from "../core/datastore/DatabaseManager.js"
import { EconomyStore } from "../systems/economy/EconomyStore.js"
import { PlayerStore } from "../core/store/PlayerStore.js"
import { WorldStore } from "../core/store/WorldStore.js"
import { RankStore } from "../systems/social/ranks/RankStore.js"
import { StoreKeys } from "../core/store/StoreKeys.js"
import { MessageStore } from "../core/store/MessageStore.js"
import { PermissionManagerInstance } from "../core/permissions/PermissionManager.js"
import { RankFormatter } from "../systems/social/ranks/RankFormatter.js"
import { MuteStore } from "../systems/social/MuteStore.js"
import { SignalBus } from "../core/signalbus/SignalBus.js"
import { HomeStore } from "../systems/teleport/HomeStore.js"
import { WarpStore } from "../systems/teleport/WarpStore.js"
import { ChestShopStore } from "../systems/shop/ChestShopStore.js"
import { PlaceholderProvider } from "../systems/placeholders/PlaceholderProvider.js"
import { ClaimStore } from "../systems/protection/ClaimStore.js"
import { FloatingTextStore } from "../systems/floatingtext/FloatingTextStore.js"
import { TPAStore } from "../systems/tpa/TpaStore.js"
import { TpaHandshake } from "../systems/tpa/TpaHandshake.js"
import { TpaService } from "../systems/tpa/TpaService.js"
import { TeleportService } from "../systems/teleport/TeleportService.js"
import { initPlayerCache } from "../utils/PlayerUtils.js"
import { ShopStore } from "../systems/economy/ShopStore.js"
import { MasterDispatcher } from "../core/events/MasterDispatcher.js"
import { SpatialCache } from "../systems/protection/SpatialCache.js"
import { SettingsStore } from "../core/store/SettingsStore.js"
import { CommandHandler } from "../commands/base/CommandHandler.js"
import { CleanupServiceInstance } from "../core/services/CleanupService.js"
import { LogStore } from "../systems/general/LogStore.js"
import { initShopConfirmation } from "../commands/shop/ShopConfirmation.js"
import { init as initGodMode } from "../commands/admin/GodCommand.js"
import { UIUtils } from "../ui/UIUtils.js"


let isInitialized = false

/**
 * Registers all core services with Kernel and runs their init() methods.
 * Called during Stage 2 (inside the first system.run tick) from main.js.
 */
export function init() {
    if (isInitialized) return
    
    isInitialized = true

    // Data layer
    Kernel.register("database",    Database)
    Kernel.register("playerStore", PlayerStore)
    Kernel.register("worldStore",  WorldStore)
    Kernel.register("rankStore",   RankStore)
    Kernel.register("keys",        StoreKeys)
    Kernel.register("settings",    SettingsStore)

    // Economy
    Kernel.register("economy",     EconomyStore)
    Kernel.register("shopStore",   ShopStore)
    Kernel.register("chestShopStore", ChestShopStore)

    // Social & Permissions
    Kernel.register("ranks",       RankSystem)
    Kernel.register("chat",        ChatSystem)
    Kernel.register("banManager",  BanManager)
    Kernel.register("permissions", PermissionManagerInstance)
    Kernel.register("formatter",   RankFormatter)
    Kernel.register("muteStore",   MuteStore)
    Kernel.register("messageStore", MessageStore)

    // Teleportation
    Kernel.register("homeStore",   HomeStore)
    Kernel.register("warpStore",   WarpStore)
    Kernel.register("tpaStore",    TPAStore)
    Kernel.register("tpaHandshake", TpaHandshake)
    Kernel.register("tpaService",  TpaService)
    Kernel.register("teleportService", TeleportService)

    // Utility
    Kernel.register("signalBus",   SignalBus)
    Kernel.register("placeholders", PlaceholderProvider)
    Kernel.register("claimStore",  ClaimStore)
    Kernel.register("floatingTextStore", FloatingTextStore)
    Kernel.register("cleanupService", CleanupServiceInstance)
    Kernel.register("logStore", LogStore)

    // Start event-driven subsystems
    MasterDispatcher.init()
    SpatialCache.init()
    initPlayerCache()          // player name cache + GC interval
    initShopConfirmation()     // Y/N chat confirmation for shop transactions
    initGodMode()              // entityHurt cancellation for god mode players
    UIUtils.init()              // playerLeave cleanup for UI mutex locks
    TpaService.init()
    TeleportService.init()
    RankSystem.init()
    ChatSystem.init()
    BanManager.init()
    CommandHandler.init()
    CleanupServiceInstance.init()

    console.log("[AethelLib] Core services ready. Total: " + Kernel.size);
}



