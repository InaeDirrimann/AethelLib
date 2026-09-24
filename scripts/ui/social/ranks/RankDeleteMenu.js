import { Kernel } from "../../../core/Kernel.js";
import { UIUtils } from "../../UIUtils.js";
import { RankSystem } from "../../../systems/social/ranks/RankSystem.js";
import { Lang } from "../../Lang.js";

export class RankDeleteMenu {
    static async confirmDeleteRank(player, tag, backCallback) {
        const form = new Kernel.MessageFormData()
            .title(Lang.GRID_M + "§4§lDELETE RANK?")
            .body(`§7Are you sure you want to delete the rank "§e${tag}§7"?\n§cThis will strip the rank tag from all online players!`)
            .button1("§aYes, Delete")
            .button2("§cNo, Cancel");

        const res = await UIUtils.showForm(player, form);
        if (res.canceled || res.selection !== 1) {
            if (backCallback) Kernel.system.runTimeout(backCallback, 5);
            return;
        }

        if (RankSystem.deleteRank(tag)) {
            for (const p of Kernel.world.getAllPlayers()) {
                if (p.isValid && p.getTags().includes(tag)) {
                    p.removeTag(tag);
                }
            }
            player.sendMessage(`§aSuccessfully deleted rank: ${tag}`);
        } else {
            player.sendMessage("§cFailed to delete rank.");
        }

        if (backCallback) Kernel.system.runTimeout(backCallback, 5);
    }
}
