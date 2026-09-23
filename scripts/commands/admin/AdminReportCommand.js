import { Kernel } from "../../core/Kernel.js"

// ----------------------------------------------------------------------------
// | object: AdminReportCommand                                               |
// | command definition for managing the administrative incident queue.         |
// | allows staff to review and resolve player-submitted reports.              |
// ----------------------------------------------------------------------------
export const AdminReportCommand = {
    // internal name.
    name: "reports",
    // human-readable description.
    description: "View and manage player reports",
    // syntax guide.
    usage: "/ae:reports",
    // required permission level (staff only).
    permission: "essentials.admin.reports",
    // command category.
    category: "admin",

    // ----------------------------------------------------------------------------
    // | method: execute                                                          |
    // | the report management vector. performs a secondary permission audit      |
    // | before dynamically importing and launching the UI dashboard.             |
    // ----------------------------------------------------------------------------
    async execute(_data, player, _args) {
        // step 1: permission verification.
        const PermissionManager = Kernel.get("permissions")
        if (PermissionManager && !PermissionManager.hasPermission(player, "essentials.admin.reports")) {
            player.sendMessage("\u00A7c\u00A7l» \u00A77You do not have permission to view reports.");
            return
        }

        // step 2: UI orchestration.
        // we use a dynamic import here to keep the initial command registry 
        // payload lightweight.
        const { showAdminReportUI } = await import("../../ui/admin/AdminReportUI.js")
        Kernel.system.run(() => showAdminReportUI(player))
    }
}
