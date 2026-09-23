import { MoneyCommand } from "./economy/MoneyCommand.js"
import { PayCommand } from "./economy/PayCommand.js"
import { TopMoneyCommand } from "./economy/TopMoneyCommand.js"
import { ShopCommand } from "./economy/ShopCommand.js"
import { ShopListCommand, ShopSearchCommand, ShopBuyCommand, ShopInfoCommand, ShopCartCommand, ShopCheckoutCommand } from "./shop/ShopCommands.js"
import { SellCommand } from "./sell/SellCommand.js"
import { AuctionCommand } from "./auction/AuctionCommand.js"
import { WithdrawCommand } from "./banknote/WithdrawCommand.js"

// ----------------------------------------------------------------------------
// | object: EconomyRegistry                                                  |
// | handles registration for all financial and commerce-related commands.    |
// ----------------------------------------------------------------------------
export const EconomyRegistry = {
    // ----------------------------------------------------------------------------
    // | method: register                                                         |
    // | pushes command definitions into the core registry.                       |
    // ----------------------------------------------------------------------------
    register(Registry) {
        // global marketplace GUI.
        Registry.register("shop", ShopCommand)
        // check current balance.
        Registry.register("money", MoneyCommand)
        // transfer funds to another player.
        Registry.register("pay", PayCommand)
        // show the richest players leaderboard.
        Registry.register("topmoney", TopMoneyCommand)
        // list shop items by category.
        Registry.register("shoplist", ShopListCommand)
        // search shop items.
        Registry.register("shopsearch", ShopSearchCommand)
        // buy an item from the shop.
        Registry.register("shopbuy", ShopBuyCommand)
        // show information for a shop item.
        Registry.register("shopinfo", ShopInfoCommand)
        // manage shopping cart.
        Registry.register("shopcart", ShopCartCommand)
        // checkout shopping cart.
        Registry.register("shopcheckout", ShopCheckoutCommand)
        // liquidate inventory for credits.
        Registry.register("sell", SellCommand)
        // interact with the player-to-player auction house.
        Registry.register("auction", AuctionCommand)
        // withdraw money into physical banknotes.
        Registry.register("withdraw", WithdrawCommand)
    }
}
