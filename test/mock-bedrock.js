/**
 * test/mock-bedrock.js
 * Drop-in mock for @minecraft/server and @minecraft/server-ui.
 * Registered via --import flag or imported before any game code.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

// ── In-memory dynamic property store ──────────────────────────────────────────
export const dynamicProps = new Map();

export const mockWorld = {
    getAllPlayers: () => [],
    getDynamicProperty: (key) => dynamicProps.get(key) ?? undefined,
    setDynamicProperty: (key, value) => {
        if (value === undefined) dynamicProps.delete(key);
        else dynamicProps.set(key, value);
    },
    getDynamicPropertyIds: () => [...dynamicProps.keys()],
    afterEvents: {
        playerSpawn: { subscribe: () => {} },
        chatSend:    { subscribe: () => {} },
    },
    beforeEvents: {
        shutdown: { subscribe: () => {} },
        chatSend: { subscribe: () => {} },
    },
};

export const mockSystem = {
    currentTick: 0,
    run:         (fn) => { Promise.resolve().then(fn); return 0; },
    runTimeout:  (fn, t) => { setTimeout(fn, t * 50); return 0; },
    runInterval: (fn, t) => { setInterval(fn, t * 50); return 0; },
    clearRun:    (id) => { clearTimeout(id); clearInterval(id); },
    beforeEvents: { shutdown: { subscribe: () => {} } },
};

// ── Kernel stub ────────────────────────────────────────────────────────────────
// Populated by each test before importing game modules.
export const mockKernel = {
    world: mockWorld,
    system: mockSystem,
    _registry: new Map(),
    get(name) { return this._registry.get(name); },
    register(name, val) { this._registry.set(name, val); },
};

// ── Module resolver hook ───────────────────────────────────────────────────────
// Maps bare specifiers to their mock files.
export const MOCK_MAP = {
    "@minecraft/server":    pathToFileURL(new URL("./stubs/mc-server.js",    import.meta.url).pathname).href,
    "@minecraft/server-ui": pathToFileURL(new URL("./stubs/mc-server-ui.js", import.meta.url).pathname).href,
};
