import { Kernel } from "../../core/Kernel.js"

// In-memory registries
const cooldowns = new Map();
const activeRtpPlayers = new Set();

const UNSAFE_BLOCK_TYPES = new Set([
    "minecraft:lava",
    "minecraft:flowing_lava",
    "minecraft:water",
    "minecraft:flowing_water",
    "minecraft:fire",
    "minecraft:soul_fire",
    "minecraft:magma",
    "minecraft:bedrock",
    "minecraft:cactus",
    "minecraft:sweet_berry_bush"
]);

export const RTPCommand = {
    name: "rtp",
    aliases: ["wild", "randomtp"],
    description: "Teleport to a random safe wilderness location",
    usage: "/ae:rtp [range]",
    permission: "essentials.rtp",
    category: "Teleport",
    parameters: [
        { name: "range", type: "int", optional: true }
    ],

    execute(_data, player, args) {
        if (!player || !player.isValid) return;

        if (activeRtpPlayers.has(player.id)) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77RTP is already in progress. Please wait...");
            return;
        }

        const PermissionManager = Kernel.get("permissions");
        const cdSeconds = PermissionManager ? (PermissionManager.getPermission(player, "rtp.cooldown") ?? 10) : 10;
        const cdTicks = cdSeconds * 20;
        const lastTick = cooldowns.get(player.id) ?? 0;

        if (Kernel.system.currentTick - lastTick < cdTicks) {
            const waitTime = Math.ceil((cdTicks - (Kernel.system.currentTick - lastTick)) / 20);
            player.sendMessage(`\u00A7c\u00A7l» \u00A77Teleport on cooldown. Wait \u00A7e${waitTime}s\u00A77.`);
            return;
        }

        const SettingsStore = Kernel.get("settings");
        const defaultRange = SettingsStore ? Number(SettingsStore.get("RTPRange") || 1000) : 1000;
        let range = args[0] ? parseInt(args[0]) : defaultRange;

        if (isNaN(range) || range < 200 || range > 10000) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77Range must be between 200 and 10000.");
            return;
        }

        cooldowns.set(player.id, Kernel.system.currentTick);
        activeRtpPlayers.add(player.id);

        player.sendMessage("\u00A76\u00A7l» \u00A7eSearching for a safe wilderness landing zone...");
        executeRtpWorkflow(player, range);
    }
};

async function executeRtpWorkflow(player, maxRange) {
    const rawPlayer = player.__rawEntity__ || player;
    const initialLocation = { ...rawPlayer.location };
    const dimension = rawPlayer.dimension;
    const minDistance = 200;
    const maxAttempts = 6;

    try {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (!rawPlayer.isValid) return;

            const angle = Math.random() * 2 * Math.PI;
            const distance = minDistance + Math.random() * (maxRange - minDistance);
            const targetX = Math.floor(initialLocation.x + Math.cos(angle) * distance);
            const targetZ = Math.floor(initialLocation.z + Math.sin(angle) * distance);

            // Stage player high above the candidate to trigger Bedrock chunk stream
            rawPlayer.addEffect?.("resistance", 160, { showParticles: false, amplifier: 255 });
            rawPlayer.addEffect?.("slow_falling", 160, { showParticles: false, amplifier: 1 });
            rawPlayer.teleport({ x: targetX + 0.5, y: 319, z: targetZ + 0.5 }, { dimension });

            // Allow Bedrock chunk to load
            await new Promise(resolve => Kernel.system.runTimeout(resolve, 4));
            if (!rawPlayer.isValid) return;

            // Query topmost block of the loaded chunk
            const topBlock = dimension.getTopmostBlock?.({ x: targetX, z: targetZ });
            if (topBlock && isValidGround(topBlock)) {
                const safeY = topBlock.y + 1;
                const TeleportService = Kernel.get("teleportService");

                if (TeleportService) {
                    TeleportService.teleport(rawPlayer, { x: targetX + 0.5, y: safeY, z: targetZ + 0.5 }, dimension.id);
                } else {
                    rawPlayer.teleport({ x: targetX + 0.5, y: safeY, z: targetZ + 0.5 }, { dimension });
                }

                rawPlayer.onScreenDisplay?.setActionBar(`\u00A7a\u00A7l» \u00A7fTeleported to \u00A7e(${targetX}, ${safeY}, ${targetZ})`);
                rawPlayer.sendMessage(`\u00A7a\u00A7l» \u00A7fTeleported to \u00A7e(${targetX}, ${safeY}, ${targetZ})\u00A7f in \u00A7a${attempt}\u00A7f attempt(s)!`);
                return;
            }
        }

        // Fallback: restore player to starting point
        if (rawPlayer.isValid) {
            rawPlayer.teleport(initialLocation, { dimension });
            rawPlayer.sendMessage("\u00A7c\u00A7l» \u00A77Could not find a safe solid surface. Returned to safety.");
        }
    } catch (err) {
        console.error(`[RTPCommand] Error during search: ${err}`);
        if (rawPlayer.isValid) {
            rawPlayer.teleport(initialLocation, { dimension });
            rawPlayer.sendMessage("\u00A7c\u00A7l» \u00A77Teleport failed. Returned to starting location.");
        }
    } finally {
        activeRtpPlayers.delete(player.id);
    }
}

function isValidGround(block) {
    if (!block || block.isAir || block.isLiquid) return false;
    const typeId = block.typeId;

    if (UNSAFE_BLOCK_TYPES.has(typeId)) return false;
    if (typeId.includes("leaves") || typeId.includes("water") || typeId.includes("lava")) return false;

    // Check clearance above
    const above = block.above?.();
    if (!above || !above.isAir) return false;

    return true;
}
