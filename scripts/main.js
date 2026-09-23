import { Kernel } from "./core/Kernel.js"
import { init as initEarly } from "./bootstrap/early.js"
import { init as initCore } from "./bootstrap/core.js"
import { init as initCommands } from "./bootstrap/commands.js"
import { initializeSystems } from "./bootstrap/systems.js"
import { initializeServices } from "./bootstrap/services.js"
import { pluginDefs } from "./plugins/PluginLoader.js"
import { PluginManager } from "./core/plugins/PluginManager.js"
// import { VerificationSuite } from "./utils/VerificationSuite.js"

// ----------------------------------------------------------------------------
// | entry point: main.js                                                     |
// | the first file executed by the bedrock script engine.                    |
// | coordinates the initialization sequence for the entire library.          |
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// | initialization (stage 0)                                                 |
// | these run immediately before the first tick.                             |
// | used to set up global variables and register command definitions.        |
// ----------------------------------------------------------------------------

// stage 0.1: register basic registries (services, events).
initEarly()

// Phase 0 – Synchronous command extraction
// We await here, but because it is top-level before the first tick, 
// the extracted commands are ready before the startup event fires.
for (const def of pluginDefs) {
    await PluginManager.extractCommands(def);
}

// Map the extracted commands to the Native C++ engine synchronously
PluginManager.stageAllSync();

// stage 0.2: sync command definitions with Bedrock's CustomCommandRegistry.
initCommands()

// ----------------------------------------------------------------------------
// | asynchronous boot sequence                                               |
// | runs inside a Kernel.system.run loop to ensure we have access to the world      |
// | and other engine features that aren't ready at instant-zero.             |
// ----------------------------------------------------------------------------
Kernel.system.run(async () => {
    // stage 1: core boot.
    // initializes managers (database, cache, etc) and sets up event listeners.
    initCore()

    // stage 2: foundational game systems (combat, killstreaks, land protection).
    initializeSystems()

    // stage 3: staggered background services (holograms, scoreboard mirror, etc).
    initializeServices()

    // stage 4: plugins.
    // boot sequence. strictly ordered to prevent undefined references.
    await PluginManager.enableAll()

    // and we're done. hopefully nothing crashed.
    console.log("[AethelLib] systems active.");
})
