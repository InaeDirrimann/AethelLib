import { showShopUI } from "../../ui/economy/ShopUI.js"
import { Kernel } from "../../core/Kernel.js"

// ----------------------------------------------------------------------------
// | object: ShopCommand                                                      |
// | command definition for accessing the global server marketplace.           |
// | simply routes the player to the main shop UI vector.                     |
// ----------------------------------------------------------------------------
export const ShopCommand = {
    // internal name.
    name: "shop",
    // aliases for flexible player access.
    aliases: ["market", "store"],
    // human-readable description.
    description: "Open the server shop menu",
    // syntax guide.
    usage: "/ae:shop",
    // required permission node.
    permission: "essentials.shop",
    // command category.
    category: "Economy",

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | entry point for the shop command. launches the UI handler safely.        |
    // ----------------------------------------------------------------------------
    execute(_data, player, _args) {
        Kernel.system.run(() => showShopUI(player));
    }
}
