// Initializes high-level game systems after the first tick.
// All systems here must be active before the first player interaction.

import { init as initCombatIntegrity } from "../systems/combat/CombatIntegrity.js"
import { init as initKillstreaks } from "../systems/combat/Killstreaks.js"
import { init as initLandProtection } from "../systems/protection/ClaimService.js"
import { initTpsSampler } from "../commands/general/TPSCommand.js"
import { initBanknoteCleanup } from "../systems/banknote/BanknoteStore.js"

let systemsInitialized = false

export const initializeSystems = () => {
    if (systemsInitialized) return
    systemsInitialized = true

    initCombatIntegrity()   // damage event filtering for combat tracking
    initKillstreaks()       // killstreak event tracking
    initLandProtection()    // claim protection listeners
    initTpsSampler()        // per-tick timestamp sampler for /tps
    initBanknoteCleanup()   // hourly cleanup of redeemed banknotes

    console.log("[AethelLib] Game systems online.")
}
