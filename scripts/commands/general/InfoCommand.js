import { Kernel } from "../../core/Kernel.js";

// ----------------------------------------------------------------------------
// | object: InfoCommand                                                      |
// | command definition for displaying server health and versioning metadata.  |
// | provides a high-level overview of active sub-systems.                    |
// ----------------------------------------------------------------------------
export const InfoCommand = {
    // internal name.
    name: "info",
    // human-readable description.
    description: "View server information and status",
    // syntax guide.
    usage: "/ae:info",
    // required permission node.
    permission: "essentials.info",
    // command category.
    category: "Utility",

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | collects real-time metrics (player counts, uptime) and formats them into |
    // | a branded information card.                                              |
    // ----------------------------------------------------------------------------
    execute(_data, player, _args) {
        // query the native engine for current player count.
        const playerCount = Kernel.world.getAllPlayers().length
        // resolve human-readable uptime from the internal tick counter.
        const uptime = getUptime()
        // hardcoded version identifier (needs manual update per release).
        const version = getServerVersion()
        
        // aesthetic output.
        player.sendMessage(" ")
        player.sendMessage("\u00A7f\u00A7lAETHELGRAD \u00A7r\u00A77| \u00A76\u00A7lSERVER INFO")
        player.sendMessage("\u00A78━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        player.sendMessage(`\u00A77» \u00A7fVersion:    \u00A7b${version}`)
        player.sendMessage(`\u00A77» \u00A7fUptime:     \u00A7d${uptime}`)
        player.sendMessage(`\u00A77» \u00A7fPlayers:    \u00A73${playerCount}\u00A78/\u00A7320`)
        player.sendMessage(`\u00A77» \u00A7fCore:       \u00A7aAethelLib`)
        player.sendMessage("\u00A78━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        // status checklist for major engine modules.
        // currently these are static indicators as these systems are kernel-critical.
        player.sendMessage("\u00A76\u00A7l[ SYSTEMS ]")
        player.sendMessage("\u00A77• \u00A7fEconomy System \u00A78(Active)")
        player.sendMessage("\u00A77• \u00A7fTeleport System \u00A78(Active)")
        player.sendMessage("\u00A77• \u00A7fSocial System \u00A78(Active)")
        player.sendMessage("\u00A77• \u00A7fUtility System \u00A78(Active)")
        player.sendMessage("\u00A78━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        player.sendMessage(" ")
    }
}

// ----------------------------------------------------------------------------
// | function: getUptime                                                      |
// | converts the current engine tick count into a formatted temporal string.  |
// | assumes 20 ticks per second (50ms delta).                                |
// ----------------------------------------------------------------------------
function getUptime() {
    // calculate total milliseconds.
    const uptime = Kernel.system.currentTick * 50
    // break down into days, hours, and minutes.
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24))
    const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))
    
    // return the most significant units.
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
}

// ----------------------------------------------------------------------------
// | function: getServerVersion                                               |
// | returns the hardcoded release string for the current deployment.          |
// ----------------------------------------------------------------------------
function getServerVersion() {
    return "1.5.0 (Bedrock 1.26.51)"
}
