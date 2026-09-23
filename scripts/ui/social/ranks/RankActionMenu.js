import { Kernel } from "../../../core/Kernel.js";
import { UIUtils } from "../../UIUtils.js";
import { RankSystem } from "../../../systems/social/ranks/RankSystem.js";
import { Lang } from "../../Lang.js";
import { SchemaRenderer } from "../../core/SchemaRenderer.js";
import { ColorUtils } from "../../../utils/ColorUtils.js";

import { RankBasicSchema } from "./schemas/RankBasicSchema.js";
import { RankCostsSchema } from "./schemas/RankCostsSchema.js";
import { RankCooldownsSchema } from "./schemas/RankCooldownsSchema.js";
import { RankPermissionsMenu } from "./RankPermissionsMenu.js";
import { BasicPermissionsNodes, AdminPermissionsNodes } from "./RankPermissionNodes.js";

export class RankActionMenu {
    static async showRankActions(player, tag, backCallback = null) {
        const rank = RankSystem.getRank(tag);
        if (!rank) {
            player.sendMessage("§cRank not found.");
            const { RankManagerMenu } = await import("./RankManagerMenu.js");
            return RankManagerMenu.showRankList(player, backCallback);
        }

        const form = new Kernel.ActionFormData()
            .title(Lang.GRID_L + `§6§lEDIT RANK: ${tag}`)
            .body(`§7Display: ${rank.name || tag}\n§7Order: ${rank.order || 0}`)
            .button("§eBasic Settings", "textures/items/feather")
            .button("§bBasic Permissions", "textures/items/book_writable")
            .button("§aAdmin Permissions", "textures/items/iron_chestplate")
            .button("§dCommand Costs", "textures/items/gold_nugget")
            .button("§cCooldowns & Limits", "textures/items/clock")
            .button("§4Delete Rank", "textures/blocks/barrier")
            .button("§cBACK", "textures/ui/refresh");

        const res = await UIUtils.showForm(player, form);
        if (res.canceled) {
            const { RankManagerMenu } = await import("./RankManagerMenu.js");
            Kernel.system.runTimeout(() => RankManagerMenu.showRankList(player, backCallback), 5);
            return;
        }

        const back = () => Kernel.system.runTimeout(() => this.showRankActions(player, tag, backCallback), 5);

        switch (res.selection) {
            case 0: return this.showBasicSettings(player, tag, rank, back);
            case 1: return RankPermissionsMenu._buildPermissions(player, tag, rank, BasicPermissionsNodes, Lang.GRID_M + "§6§lBASIC PERMISSIONS", `§aUpdated basic permissions for rank: ${tag}`, back);
            case 2: return RankPermissionsMenu._buildPermissions(player, tag, rank, AdminPermissionsNodes, Lang.GRID_M + "§c§lADMIN PERMISSIONS", `§aUpdated admin permissions for rank: ${tag}`, back);
            case 3: return SchemaRenderer.render(player, RankCostsSchema, rank.permissions || {}, back, (updated) => {
                rank.permissions = { ...rank.permissions, ...updated };
                RankSystem.updateRank(tag, rank);
                player.sendMessage(`§aUpdated costs for rank: ${tag}`);
            });
            case 4: return SchemaRenderer.render(player, RankCooldownsSchema, rank.permissions || {}, back, (updated) => {
                rank.permissions = { ...rank.permissions, ...updated };
                RankSystem.updateRank(tag, rank);
                player.sendMessage(`§aUpdated cooldowns & limits for rank: ${tag}`);
            });
            case 5: {
                const { RankDeleteMenu } = await import("./RankDeleteMenu.js");
                return Kernel.system.runTimeout(() => RankDeleteMenu.confirmDeleteRank(player, tag, async () => {
                    const { RankManagerMenu } = await import("./RankManagerMenu.js");
                    RankManagerMenu.showRankList(player, backCallback);
                }), 5);
            }
            case 6: {
                const { RankManagerMenu } = await import("./RankManagerMenu.js");
                return Kernel.system.runTimeout(() => RankManagerMenu.showRankList(player, backCallback), 5);
            }
        }
    }

    static async showBasicSettings(player, tag, rank, backCallback) {
        // Because BasicSettings needs a dynamic dropdown based on other ranks, we dynamically inject it into the schema clone
        const ranks = RankSystem.getAllRanks();
        const otherRankKeys = Object.keys(ranks).filter(r => r !== tag);
        const options = ["None (Default)", ...otherRankKeys];
        
        let defaultValueIndex = 0;
        if (rank.inherits && otherRankKeys.includes(rank.inherits)) {
            defaultValueIndex = otherRankKeys.indexOf(rank.inherits) + 1;
        }
        
        const schema = { ...RankBasicSchema, fields: [...RankBasicSchema.fields] };
        schema.fields.push(/** @type {any} */({
            type: "dropdown_action",
            label: "Inherit Permissions From:",
            options: options,
            defaultIndex: defaultValueIndex,
            action: (v) => {
                rank.inherits = v === 0 ? null : otherRankKeys[v - 1];
            }
        }));

        return SchemaRenderer.render(player, schema, rank, backCallback, (updated) => {
            if (updated.name) {
                updated.name = updated.name.replace(/^\[+|\]+$/g, "").trim();
            }
            if (updated.colorName !== undefined) {
                updated.colorName = ColorUtils.normalizeColorCode(updated.colorName, "§7");
            }
            if (updated.colorText !== undefined) {
                updated.colorText = ColorUtils.normalizeColorCode(updated.colorText, "§f");
            }
            RankSystem.updateRank(tag, updated);
            player.sendMessage(`§aUpdated basic settings for rank: ${tag}`);
        });
    }
}
