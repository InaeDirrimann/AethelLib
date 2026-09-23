/**
 * ThemeTokens
 * ----------------------------------------------------------------------------
 * Central design tokens and visual constants for AethelLib UI components.
 * Single source of truth for color codes, texture paths, and formatting.
 * Strictly ZERO emojis and ZERO unrendered unicode symbols (no tofu boxes).
 */

export const ThemeTokens = {
    // Bedrock Minecraft Formatting Codes
    Colors: {
        Gold: "\u00A76",
        GoldBold: "\u00A76\u00A7l",
        Yellow: "\u00A7e",
        YellowBold: "\u00A7e\u00A7l",
        Green: "\u00A7a",
        GreenBold: "\u00A7a\u00A7l",
        Aqua: "\u00A7b",
        AquaBold: "\u00A7b\u00A7l",
        White: "\u00A7f",
        WhiteBold: "\u00A7f\u00A7l",
        Gray: "\u00A77",
        DarkGray: "\u00A78",
        Red: "\u00A7c",
        RedBold: "\u00A7c\u00A7l",
        Purple: "\u00A7d",
        PurpleBold: "\u00A7d\u00A7l",
        Reset: "\u00A7r"
    },

    // Vanilla-safe ASCII glyphs (guaranteed to render cleanly on all Bedrock clients)
    Glyphs: {
        ArrowRight: "\u00BB", // »
        ArrowLeft: "\u00AB",  // «
        Check: "[+]",
        Cross: "[-]",
        Alert: "[!]",
        Bullet: "-",
        Separator: "\u00A78|"
    },

    // Standard Vanilla & Resource Pack Texture Paths
    Textures: {
        // UI Icons
        Search: "textures/ui/magnifying_glass",
        Refresh: "textures/ui/refresh",
        Back: "textures/ui/refresh",
        Close: "textures/ui/cancel",
        Settings: "textures/ui/settings_glyph_color_2x",
        Plus: "textures/ui/plus",
        Minus: "textures/ui/minus",

        // Commerce & Currency
        GoldCoin: "textures/items/gold_ingot",
        GoldBlock: "textures/items/gold_block",
        Emerald: "textures/items/emerald",
        Paper: "textures/items/paper",

        // Categories
        Weapons: "textures/items/diamond_sword",
        Armor: "textures/items/diamond_chestplate",
        Tools: "textures/items/diamond_pickaxe",
        Food: "textures/items/apple",
        Blocks: "textures/items/stone_bricks",
        Materials: "textures/items/iron_ingot",
        Arcane: "textures/items/book_enchanted",
        Misc: "textures/items/bucket"
    },

    // Helper formatter functions
    Format: {
        money(amount) {
            const num = Number(amount) || 0
            return `$${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
        },

        header(title, balance = null) {
            const parts = [`\u00A76\u00A7l\u00BB \u00A7e${title.toUpperCase()} \u00A76\u00A7l\u00AB\u00A7r`]
            if (balance !== null && balance !== undefined) {
                parts.push(`\n\u00A77Balance: \u00A7a${this.money(balance)}\u00A7r`)
            }
            return parts.join("")
        },

        buttonLabel(title, subtitle = null, color = "\u00A7f\u00A7l") {
            if (!subtitle) return `${color}${title}`
            return `${color}${title}\n\u00A78${subtitle}`
        }
    }
}
