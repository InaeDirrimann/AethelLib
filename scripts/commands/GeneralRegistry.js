import { CalculateCommand } from "./general/CalculateCommand.js"
import { CelebrateCommand } from "./general/CelebrateCommand.js"
import { HelpCommand } from "./general/HelpCommand.js"
import { TPSCommand } from "./general/TPSCommand.js"
import { PlayerListCommand } from "./general/PlayerListCommand.js"
import { MessageCommand, ReplyCommand } from "./general/MessageCommand.js"
import { InfoCommand } from "./general/InfoCommand.js"
import { ReportCommand } from "./general/ReportCommand.js"
import { CreditCommand } from "./general/CreditCommand.js"
import { MenuCommand } from "./general/MenuCommand.js"
import { BlockCommand } from "./tpa/BlockCommand.js"
import { RankCommand } from "./social/ranks/rankCommand.js"
import { ClaimCommand } from "./general/ClaimCommand.js"
import { CombatStatusCommand } from "./general/CombatStatusCommand.js"
import { ClaimRadiusCommand, UnclaimCommand, ClaimTrustCommand, ClaimUntrustCommand, ClaimUICommand } from "./general/ClaimCommands.js"

// ----------------------------------------------------------------------------
// | object: GeneralRegistry                                                  |
// | handles registration for public utility and social commands.              |
// | these are commands that every player can generally use.                   |
// ----------------------------------------------------------------------------
export const GeneralRegistry = {
    // ----------------------------------------------------------------------------
    // | method: register                                                         |
    // | pushes command definitions into the core registry.                       |
    // ----------------------------------------------------------------------------
    register(Registry) {
        // ----------------------------------------------------------------------------
        // | Utility Commands                                                         |
        // ----------------------------------------------------------------------------
        
        // system help and documentation.
        Registry.register("help", HelpCommand)
        // ticks-per-second performance check.
        Registry.register("tps", TPSCommand)
        // show online players.
        Registry.register("playerlist", PlayerListCommand)
        // private messaging (multi-alias registration).
        Registry.register("msg", MessageCommand)
        Registry.register("tell", MessageCommand)
        Registry.register("w", MessageCommand)
        // reply to last message.
        Registry.register("reply", ReplyCommand)
        Registry.register("r", ReplyCommand)
        // math calculator.
        Registry.register("calculate", CalculateCommand)
        Registry.register("calc", CalculateCommand)
        // server and plugin information.
        Registry.register("info", InfoCommand)
        // player report submission.
        Registry.register("report", ReportCommand)
        // credits and contributors.
        Registry.register("credit", CreditCommand)
        // main interaction menu.
        Registry.register("menu", MenuCommand)
        Registry.register("gui", MenuCommand)
        // 1k downloads celebration command.
        Registry.register("celebrate", CelebrateCommand)
        Registry.register("1k", CelebrateCommand)

        // ----------------------------------------------------------------------------
        // | Social & Roleplay Commands                                               |
        // ----------------------------------------------------------------------------
        
        // ignore/block players.
        Registry.register("block", BlockCommand)
        // rank and title management.
        Registry.register("rank", RankCommand)
        // land protection and claiming.
        Registry.register("claim", ClaimCommand)
        Registry.register("land", ClaimCommand)
        Registry.register("claimradius", ClaimRadiusCommand)
        Registry.register("unclaim", UnclaimCommand)
        Registry.register("claimtrust", ClaimTrustCommand)
        Registry.register("claimuntrust", ClaimUntrustCommand)
        Registry.register("claimui", ClaimUICommand)
        // combat status and killstreaks.
        Registry.register("combat", CombatStatusCommand)
    }
}
