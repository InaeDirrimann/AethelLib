import { Kernel } from "./core/Kernel.js"
import { init as initEarly } from "./bootstrap/early.js"
import { init as initCore } from "./bootstrap/core.js"
import { init as initCommands } from "./bootstrap/commands.js"
import { initializeSystems } from "./bootstrap/systems.js"
import { initializeServices } from "./bootstrap/services.js"
import { pluginDefs } from "./plugins/PluginLoader.js"
import { PluginManager } from "./core/plugins/PluginManager.js"

// Entry point: first file run by the Bedrock script engine.
// Coordinates the init sequence for the entire library.

// --- Stage 0: Early boot (runs synchronously before first tick) ---
// Register core registries: commandRegistry, commandManager, shop enums, and UI shims.
initEarly()

// Register command definitions with the CommandBootstrap.
// Safe here because CommandBootstrap just populates a Map — no Bedrock API calls.
initCommands()

// --- Stages 1–4: Deferred boot (runs inside first system.run tick) ---
// world, players, and other engine features are available here.
Kernel.system.run(async () => {
    // Stage 1: Extract plugin command definitions and register them with Bedrock's
    // CustomCommandRegistry (which is available via the startup event registered in early.js).
    for (const def of pluginDefs) {
        await PluginManager.extractCommands(def);
    }
    PluginManager.stageAllSync();

    // Stage 2: Core services (database, stores, event listeners).
    initCore()

    // Stage 3: Game systems (combat, killstreaks, land protection).
    initializeSystems()

    // Stage 4: Background services (holograms, scoreboard mirror, etc.).
    initializeServices()

    // Stage 5: Plugins — strictly ordered by dependency graph.
    await PluginManager.enableAll()

    console.log("[AethelLib] Boot complete.");
})
