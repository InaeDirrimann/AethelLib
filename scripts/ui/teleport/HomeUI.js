import { Kernel } from "../../core/Kernel.js"
import { Lang } from "../Lang.js"
import { UIUtils } from "../UIUtils.js"

/*
 * HOME_UI_CONTROLLER
 * ----------------------------------------------------------------------------
 * Handles spatial anchor navigation and management.
 */

export async function showHomeUI(player) {
    const HomeStore = Kernel.get("homeStore")
    if (!HomeStore) {
        player.sendMessage("\u00A7c[Error] Home service is unavailable.");
        return;
    }
    const homes = await HomeStore.getHomes(player)
    const homeNames = Object.keys(homes)

    const form = new Kernel.ActionFormData()
        .title(Lang.UI.HOMES_TITLE)
        .body(homeNames.length > 0
            ? `\u00A77Active Anchors: \u00A7e${homeNames.length}`
            : "\u00A7cNO HOMES FOUND.")

    form.button("\u00A7c\u00A7l[BACK]", "textures/ui/refresh")
    form.button("\u00A7a\u00A7l+ SET NEW HOME", "textures/ui/plus")

    for (const name of homeNames) {
        const home = homes[name]
        form.button(`\u00A7f\u00A7l${name.toUpperCase()}\n\u00A78COORD: ${Math.floor(home.x)}, ${Math.floor(home.y)}, ${Math.floor(home.z)}`, "textures/items/map_filled")
    }

    const response = await UIUtils.showForm(player, form)
    if (response.canceled) return

    if (response.selection === 0) {
        const { showMainGUI } = await import("../MainGUI.js")
        Kernel.system.run(() => showMainGUI(player))
        return
    }

    if (response.selection === 1) {
        const { showCreateHomeUI } = await import("./HomeActionUI.js")
        Kernel.system.run(() => showCreateHomeUI(player))
        return
    }

    const selectedIndex = response.selection - 2
    const selectedName = homeNames[selectedIndex]
    if (!selectedName) return

    Kernel.system.run(() => showHomeActions(player, selectedName, homes[selectedName]))
}

async function showHomeActions(player, name, home) {
    const form = new Kernel.ActionFormData()
        .title(Lang.GOLD + "DETAILS: " + name.toUpperCase())
        .body(`\u00A77Target: \u00A7e${Math.floor(home.x)}, ${Math.floor(home.y)}, ${Math.floor(home.z)}\n\u00A77Dim: \u00A7e${home.dimension}`)
        .button("\u00A7a\u00A7lTELEPORT\n\u00A78Relocate to anchor", "textures/items/ender_pearl")
        .button("\u00A7c\u00A7lDELETE\n\u00A78Remove anchor", "textures/ui/cancel")
        .button("\u00A77\u00A7l[BACK]", "textures/ui/refresh")

    const response = await UIUtils.showForm(player, form)
    if (response.canceled) return

    switch (response.selection) {
        case 0: {
            Kernel.system.run(() => {
                try {
                    const targetDim = Kernel.world.getDimension(home.dimension)
                    player.teleport(
                        { x: home.x + 0.5, y: home.y, z: home.z + 0.5 },
                        { dimension: targetDim }
                    )
                    player.sendMessage(Lang.SUCCESS + `TELEPORTED: Arrived at ${name}.`);
                } catch (error) {
                    player.sendMessage(Lang.ERROR + "TELEPORT FAILURE.");
                }
            })
            break
        }
        case 1: {
            const HomeStore = Kernel.get("homeStore")
            const success = await HomeStore.deleteHome(player, name)
            player.sendMessage(success
                ? Lang.SUCCESS + `DELETED: Anchor ${name} removed.`
                : Lang.ERROR + "DELETE FAILURE.");
            Kernel.system.run(() => showHomeUI(player))
            break
        }
        case 2: {
            Kernel.system.run(() => showHomeUI(player))
            break
        }
    }
}

