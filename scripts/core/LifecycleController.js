/**
 * LifecycleController
 * ----------------------------------------------------------------------------
 * Prevents double-execution and memory leaks from multiple system 
 * initializations during script reloads.
 */

export class LifecycleController {
    static _locks = new Map();
    static _disposers = new Map();

    /**
     * Attempts to acquire a boot-lock for a system.
     * 
     * EXPECTS:
     * - systemId: Unique string identifier for the system.
     * 
     * GUARANTEES:
     * - Returns true if lock acquired successfully (system wasn't active).
     * - Returns false if system already has an active lock.
     * 
     * @param {string} systemId Unique identifier for the system.
     * @returns {boolean} True if lock acquired, false if already locked.
     */
    static boot(systemId) {
        if (this._locks.has(systemId)) {
            console.warn(`[Lifecycle] System '${systemId}' already active. Blocking re-init.`);
            return false;
        }
        this._locks.set(systemId, true);
        return true;
    }

    /**
     * Registers a disposer function to be called on shutdown.
     * 
     * EXPECTS:
     * - systemId: Unique string identifier for the system.
     * - disposer: Callback function executed during system shutdown.
     * 
     * GUARANTEES:
     * - Saves the disposer function mapped to the systemId.
     * 
     * @param {string} systemId - System identifier.
     * @param {Function} disposer - Cleanup disposer function.
     */
    static registerDisposer(systemId, disposer) {
        this._disposers.set(systemId, disposer);
    }

    /**
     * Shuts down a system and clears its lock.
     * 
     * EXPECTS:
     * - systemId: Unique string identifier for the system.
     * 
     * GUARANTEES:
     * - Executes the registered disposer function safely catching internal errors.
     * - Wipes registered disposer and lock states.
     * 
     * @param {string} systemId - System identifier.
     */
    static shutdown(systemId) {
        const disposer = this._disposers.get(systemId);
        if (disposer) {
            try {
                disposer();
            } catch (e) {
                console.error(`[Lifecycle] Shutdown failure for system '${systemId}': ${e}`);
            }
            this._disposers.delete(systemId);
        }
        this._locks.delete(systemId);
    }

    /**
     * Global shutdown sequence for all registered systems.
     * 
     * GUARANTEES:
     * - Shuts down every active system in the disposer registry.
     */
    static shutdownAll() {
        for (const systemId of this._disposers.keys()) {
            this.shutdown(systemId);
        }
    }
}
