import { Kernel } from "../core/Kernel.js";

export class UIUtils {
    // Concurrency set to lock players from opening duplicate forms
    static activeOpens = new Set();

    // Prevent instantiation since this is a pure static utility class
    constructor() {
        throw new Error("UIUtils is a static utility class and cannot be instantiated.");
    }

    /**
     * Shows a form UI to a player, handling busy states, retries, and double-open prevention.
     * 
     * EXPECTS:
     * - player: Player entity object (must be valid and online).
     * - formOrBuilder: ActionForm/MessageForm/ModalForm instance, or a builder function returning one.
     * 
     * GUARANTEES:
     * - Blocks double-opening using static activeOpens mutex lock.
     * - Defers execution via system.runTimeout to allow prior menus to close cleanly (3 ticks for snappy feel).
     * - Loops retrying form presentation if the cancelationReason is UserBusy (chat window open).
     * - Rebuilds native form objects dynamically using the builder function if provided, or re-shows the static instance.
     * - Always releases the player's active open mutex in the finally block.
     * - Returns the native form response, or { canceled: true } on panic.
     * 
     * @param {import("@minecraft/server").Player} player - Executing player.
     * @param {any|function(): any} formOrBuilder - Native form or factory function.
     * @returns {Promise<any>} Native form response object.
     */
    static async showForm(player, formOrBuilder) {
        if (!player || !player.isValid) return { canceled: true };
        
        const playerId = player.id;
        // locks prevent double-open execution loops
        if (this.activeOpens.has(playerId)) {
            return { canceled: true, cancelationReason: "UserBusy" };
        }
        this.activeOpens.add(playerId);

        try {
            // Snappy 3-tick delay to let previous windows close
            await new Promise(resolve => Kernel.system.runTimeout(resolve, 3));

            // loop until chat is fully closed
            while (true) {
                if (!player || !player.isValid) {
                    return { canceled: true };
                }

                // native forms mutate on failure — rebuild if possible
                const form = typeof formOrBuilder === "function" ? formOrBuilder() : formOrBuilder;
                if (!form) return { canceled: true };
                const rawPlayer = player.__rawEntity__ || player;
                const response = await form.show(rawPlayer);
                
                if (response.cancelationReason !== "UserBusy") {
                    return response;
                }
                
                // wait before retry
                await new Promise(resolve => Kernel.system.runTimeout(resolve, 5));
            }
        } catch (error) {
            console.error(`[UIUtils] Form show failed: ${error}`);
            return { canceled: true };
        } finally {
            // always release lock
            this.activeOpens.delete(playerId);
        }
    }

    /**
     * Helper to navigate back to a previous UI menu in a future tick.
     * 
     * EXPECTS:
     * - player: Player entity object.
     * - uiFunc: Navigation callback function.
     * 
     * GUARANTEES:
     * - Defers execution of navigation function to a safe system.run tick.
     * 
     * @param {import("@minecraft/server").Player} player - Target player.
     * @param {function(import("@minecraft/server").Player): void} uiFunc - Back target callback.
     */
    static async showPrevious(player, uiFunc) {
        Kernel.system.run(() => uiFunc(player));
    }

    /**
     * Yields execution until the player's chat window is closed, then executes the callback.
     * Required by claim and protection UI commands.
     * 
     * EXPECTS:
     * - player: Player entity object.
     * - callback: Callback function to execute.
     * 
     * GUARANTEES:
     * - Defers execution by 5 ticks to let chat close, then runs the callback.
     * 
     * @param {import("@minecraft/server").Player} player - Target player.
     * @param {function(import("@minecraft/server").Player): void} callback - Action callback.
     */
    static async waitForChatClose(player, callback) {
        if (!player || !player.isValid) return;
        Kernel.system.runTimeout(() => {
            if (player.isValid) {
                callback(player);
            }
        }, 5);
    }
}

// Clean up locks when players leave the server to prevent permanent lockouts
Kernel.world.afterEvents.playerLeave.subscribe((event) => {
    UIUtils.activeOpens.delete(event.playerId);
});
