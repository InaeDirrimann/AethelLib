// ----------------------------------------------------------------------------
// | object: CreditCommand                                                    |
// | command definition for displaying project contributors and metadata.      |
// | purely informational static output.                                       |
// ----------------------------------------------------------------------------
export const CreditCommand = {
    // internal name.
    name: "credit",
    // human-readable description.
    description: "View the project credits",
    // syntax guide.
    usage: "/ae:credit",
    // required permission node.
    permission: "essentials.credit",
    // command category.
    category: "Utility",

    /**
     * Executes the credit command.
     * 
     * EXPECTS:
     * - player: The Player object executing this command.
     * 
     * GUARANTEES:
     * - Prints credit information and build version metadata to the player's chat.
     * 
     * @param {any} _data - Unused command context data.
     * @param {import("@minecraft/server").Player} player - Executing player.
     * @param {string[]} _args - Unused command arguments.
     */
    execute(_data, player, _args) {
        player.sendMessage(" ");
        player.sendMessage("\u00A76\u00A7lAethel\u00A7fLib \u00A77- Credits");
        player.sendMessage("\u00A78━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        player.sendMessage(" ");
        // credit to the lead architect.
        player.sendMessage("\u00A76\u00A7lLead Architect");
        player.sendMessage("\u00A7f- Wladyslaw");
        player.sendMessage(" ");
        // list of core technical pillars.
        player.sendMessage("\u00A76\u00A7lCore Systems");
        player.sendMessage("\u00A7f- Economy & Auction House");
        player.sendMessage("\u00A7f- Advanced Teleportation");
        player.sendMessage("\u00A7f- Social & Chat Security");
        player.sendMessage("\u00A7f- Administrative Tools");
        player.sendMessage(" ");
        player.sendMessage("\u00A78━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        // system philosophy footer.
        player.sendMessage("\u00A77Optimized for high-performance survival gameplay.");
        player.sendMessage("\u00A77Version: \u00A7e1.5.0 \u00A77| Game: \u00A7b1.26.51 \u00A77| \u00A7fClean Build");
        player.sendMessage(" ");
    }
};
