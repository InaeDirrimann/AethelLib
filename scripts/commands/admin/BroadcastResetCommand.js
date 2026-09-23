import { BroadcastStore } from "../../systems/broadcasts/BroadcastStore.js"

// ----------------------------------------------------------------------------
// | object: BroadcastResetCommand                                            |
// | emergency command definition for purging all custom broadcast messages.    |
// | reverts the broadcast system to an empty/default state.                   |
// ----------------------------------------------------------------------------
export const BroadcastResetCommand = {
    // internal name (Order 66 style).
    name: "bc66",
    // human-readable description.
    description: "Reset all custom broadcasts to default",
    // syntax guide.
    usage: "/ae:bc66",
    // required permission node (staff only).
    permission: "admin.broadcast.reset",
    // command category.
    category: "ADMIN",

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | the purge vector. resets broadcast configuration to defaults.            |
    // ----------------------------------------------------------------------------
    execute(_data, player, _args) {
        try {
            BroadcastStore.setConfig(BroadcastStore.getDefaultConfig());
            player.sendMessage("\u00A7a\u00A7l» \u00A7fBroadcast system has been reset to defaults.");
        } catch (e) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Failed to reset broadcast configuration.");
        }
    }
}
