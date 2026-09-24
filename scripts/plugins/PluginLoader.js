// master module manifest.
// yes, it's hardcoded. no, we can't use fs.readdir in bedrock. deal with it.
export const pluginDefs = [
    { path: "CoreEconomy", loader: () => import("./CoreEconomy/index.js") },
    // { path: "Clans", loader: () => import("./Clans/index.js") }, // Placeholder - unreleased
    { path: "AethelEssentials", loader: () => import("./AethelEssentials/index.js") },
    { path: "BountyHunter", loader: () => import("./BountyHunter/index.js") }
    // ExamplePlugin not registered — reference only
];
