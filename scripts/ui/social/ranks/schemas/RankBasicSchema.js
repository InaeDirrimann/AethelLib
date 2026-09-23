import { Lang } from "../../../Lang.js";

export const RankBasicSchema = {
    title: Lang.GRID_M + "\u00A76\u00A7lBASIC SETTINGS",
    fields: [
        { type: "textField", label: "Display Name:", placeholder: "e.g. VIP", prop: "name", default: "" },
        { type: "textField", label: "Name/Display Color:", placeholder: "e.g. §b, &6, or S1", prop: "colorName", default: "§7" },
        { type: "textField", label: "Chat Message Color:", placeholder: "e.g. §f, &a, or Sa", prop: "colorText", default: "§f" },
        { type: "textField", label: "Order:", placeholder: "e.g. 10", prop: "order", default: "0", transform: Number },
        { type: "toggle", label: "Hide Rank Tag", prop: "hideRanks", default: false }
        // Inherit permissions is handled via dynamic dropdown in the UI component
    ]
};
