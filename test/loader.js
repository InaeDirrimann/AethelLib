/**
 * test/loader.js
 * Node.js ESM custom loader hook.
 * Intercepts @minecraft/server and @minecraft/server-ui and redirects
 * them to our local stubs so game modules can be imported in Node.js.
 *
 * Usage: node --import ./test/loader.js ...
 */

import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STUB_MAP = {
    "@minecraft/server":    pathToFileURL(path.join(__dirname, "stubs/mc-server.js")).href,
    "@minecraft/server-ui": pathToFileURL(path.join(__dirname, "stubs/mc-server-ui.js")).href,
};

export async function resolve(specifier, context, nextResolve) {
    if (STUB_MAP[specifier]) {
        return { shortCircuit: true, url: STUB_MAP[specifier] };
    }
    return nextResolve(specifier, context);
}
