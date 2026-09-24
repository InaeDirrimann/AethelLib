/*
 * CommandRegistry
 * ----------------------------------------------------------------------------
 * Registry store for active command definitions and custom enums.
 */

const commands = new Map();
const enums = new Map();

export const CommandRegistry = {
    /**
     * Registers a custom command enum.
     * 
     * EXPECTS:
     * - name: String key token for the enum namespace.
     * - values: Array of string values representing enum options.
     * 
     * GUARANTEES:
     * - Caches enum values inside local lookup map.
     */
    registerEnum: (name, values) => {
        enums.set(name, values);
    },

    /**
     * Gets a registered enum's values.
     * 
     * EXPECTS:
     * - name: String key token of the enum.
     * 
     * GUARANTEES:
     * - Returns array of enum values or undefined if missing.
     */
    getEnum: (name) => {
        return enums.get(name);
    },

    /**
     * Gets all registered enum names.
     * 
     * GUARANTEES:
     * - Returns array of all registered enum namespace strings.
     */
    getAllEnums: () => {
        return Array.from(enums.keys());
    },

    /**
     * Checks if a custom command enum is registered.
     * 
     * EXPECTS:
     * - name: String key token of the enum.
     * 
     * GUARANTEES:
     * - Returns true if present in registry, false otherwise.
     */
    hasEnum: (name) => {
        return enums.has(name);
    },

    /**
     * Registers a command module under name and aliases.
     * 
     * EXPECTS:
     * - arg1: String custom name or command definition module.
     * - arg2: Command definition module (if arg1 is a custom name string).
     * 
     * GUARANTEES:
     * - Enforces signature check on execution callbacks.
     * - Maps command module to resolution table by lowercase identifier.
     * - Automatically hooks registered command aliases without collisions.
     */
    register: (arg1, arg2) => {
        try {
            const command = arg2 || arg1;
            
            // defensive guard against broken circular imports returning undefined
            if (!command) {
                console.error(`[CommandRegistry] REJECTED: Command module is null or undefined. Check for broken import/export headers!`);
                return;
            }

            const name = arg2 ? arg1 : command.name;

            if (!name || typeof command.execute !== 'function') {
                console.error(`[CommandRegistry] REJECTED: Invalid module signature for '${name || "unnamed"}'. Missing execute() method?`);
                return;
            }

            const lowerName = name.toLowerCase();

            // Defensive check: Don't allow silent overwrites of core commands
            if (commands.has(lowerName)) {
                console.warn(`[CommandRegistry] COLLISION DETECTED: Command '${lowerName}' is already registered. Overwriting...`);
            }

            commands.set(lowerName, command);

            // Dynamically register aliases if they are defined on the command
            if (command.aliases && Array.isArray(command.aliases)) {
                for (const alias of command.aliases) {
                    const lowerAlias = alias.toLowerCase();
                    if (!commands.has(lowerAlias)) {
                        commands.set(lowerAlias, command);
                    } else {
                        console.warn(`[CommandRegistry] ALIAS COLLISION: Alias '${lowerAlias}' of command '${lowerName}' is already registered.`);
                    }
                }
            }
        } catch (error) {
            console.error(`[CommandRegistry] CRITICAL_REGISTRATION_FAILURE:`, error);
        }
    },

    /**
     * Queries registered command definitions with O(1) speed.
     * Supports namespace separation and colon parsing.
     * 
     * EXPECTS:
     * - name: Command query token (e.g. "ae:money" or "money").
     * 
     * GUARANTEES:
     * - Resolves command definition if mapped.
     */
    get: (name) => {
        let cleanName = name.toLowerCase();
        if (cleanName.includes(":")) {
            cleanName = cleanName.split(":")[1];
        }
        return commands.get(cleanName);
    },

    /**
     * Gets all registered command key names.
     * 
     * GUARANTEES:
     * - Returns array of all registered lowercased command name strings.
     */
    getAll: () => {
        return Array.from(commands.keys());
    },

    /**
     * Checks if a command name or alias is registered.
     * 
     * EXPECTS:
     * - name: Command query token.
     * 
     * GUARANTEES:
     * - Returns true if mapped, false otherwise.
     */
    has: (name) => {
        let cleanName = name.toLowerCase();
        if (cleanName.includes(":")) {
            cleanName = cleanName.split(":")[1];
        }
        return commands.has(cleanName);
    },

    /**
     * Deregisters a command module and clears aliases.
     * 
     * EXPECTS:
     * - name: Master identifier string of command to remove.
     * 
     * GUARANTEES:
     * - Wipes name and aliases maps completely.
     * - Returns true if deleted, false if not found.
     */
    unregister: (name) => {
        const lowerName = name.toLowerCase();
        const command = commands.get(lowerName);
        if (command) {
            commands.delete(lowerName);
            if (command.aliases && Array.isArray(command.aliases)) {
                for (const alias of command.aliases) {
                    commands.delete(alias.toLowerCase());
                }
            }
            return true;
        }
        return false;
    }
};
