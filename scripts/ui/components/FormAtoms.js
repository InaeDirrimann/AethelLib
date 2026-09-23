import { ThemeTokens } from "../theme/ThemeTokens.js"

/**
 * FormAtoms
 * ----------------------------------------------------------------------------
 * Atomic and molecular UI component builders for Minecraft Action and Modal forms.
 * Enforces visual consistency and eliminates duplicate button/header rendering.
 * Strictly ZERO emojis and ZERO unrendered unicode symbols.
 */

export const FormAtoms = {
    /**
     * Applies standard market header layout to an ActionFormData instance.
     * @param {any} form - ActionFormData instance
     * @param {string} title - Window title
     * @param {number} balance - Current player balance
     * @param {string} [subtitle] - Optional description text
     */
    applyHeader(form, title, balance, subtitle = "Select a department to browse goods:") {
        form.title(`\u00A76\u00A7l\u00BB \u00A7e${title.toUpperCase()} \u00A76\u00A7l\u00AB`)
        const balanceLine = `\u00A77Your Balance: \u00A7a${ThemeTokens.Format.money(balance)}`
        form.body(`${balanceLine}\n\u00A78${subtitle}`)
        return form
    },

    /**
     * Adds a standard search action button.
     * @param {any} form
     */
    addSearchButton(form) {
        form.button(
            ThemeTokens.Format.buttonLabel("SEARCH MARKET", "Find items by name", ThemeTokens.Colors.GoldBold),
            ThemeTokens.Textures.Search
        )
        return form
    },

    /**
     * Adds an inventory sell action button.
     * @param {any} form
     */
    addSellInventoryButton(form) {
        form.button(
            ThemeTokens.Format.buttonLabel("SELL INVENTORY", "Sell all tradeable items in bag", ThemeTokens.Colors.GreenBold),
            ThemeTokens.Textures.GoldCoin
        )
        return form
    },

    /**
     * Adds a quick-sell main hand action button.
     * @param {any} form
     */
    addQuickSellButton(form) {
        form.button(
            ThemeTokens.Format.buttonLabel("QUICK SELL HAND", "Sell item in your main hand", ThemeTokens.Colors.YellowBold),
            ThemeTokens.Textures.Paper
        )
        return form
    },

    /**
     * Adds a department / category selection button.
     * @param {any} form
     * @param {string} name - Category display name
     * @param {string} subtitle - Category description
     * @param {string} icon - Texture path
     */
    addCategoryButton(form, name, subtitle, icon) {
        form.button(
            ThemeTokens.Format.buttonLabel(name, subtitle, ThemeTokens.Colors.WhiteBold),
            icon || ThemeTokens.Textures.Misc
        )
        return form
    },

    /**
     * Adds an item card button in category listings.
     * @param {any} form
     * @param {{ name: string, buy?: number, sell?: number }} item
     * @param {string} icon
     */
    addItemCard(form, item, icon) {
        const buyPrice = item.buy !== undefined ? `Buy: \u00A7a${ThemeTokens.Format.money(item.buy)}` : ""
        const sellPrice = item.sell !== undefined ? `Sell: \u00A7e${ThemeTokens.Format.money(item.sell)}` : ""
        const priceInfo = [buyPrice, sellPrice].filter(Boolean).join(" \u00A78| ")

        form.button(
            `${ThemeTokens.Colors.WhiteBold}${item.name}\n${priceInfo}`,
            icon || ThemeTokens.Textures.Misc
        )
        return form
    },

    /**
     * Adds a standardized back navigation button.
     * @param {any} form
     * @param {string} [label]
     */
    addBackButton(form, label = "BACK") {
        form.button(
            ThemeTokens.Format.buttonLabel(label, "Return to previous menu", ThemeTokens.Colors.RedBold),
            ThemeTokens.Textures.Back
        )
        return form
    }
}
