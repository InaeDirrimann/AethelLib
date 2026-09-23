/**
 * Admin Report UI — Full report management GUI
 * List, detail view, delete, ban, teleport
 */

import { Kernel } from "../../core/Kernel.js"
import { ReportStore } from "../../systems/general/ReportStore.js"
import { UIUtils } from "../UIUtils.js"

/**
 * Show report management list
 * @param {import("@minecraft/server").Player} admin
 */
export async function showAdminReportUI(admin) {
    const reports = ReportStore.getReports()

    const reportEntries = Object.entries(reports)
        .sort(([, a], [, b]) => (b.timestamp || 0) - (a.timestamp || 0))

    const form = new Kernel.ActionFormData()
        .title("\u00A7c\u00A7lReport Manager")
        .body(reportEntries.length > 0
            ? `\u00A77${reportEntries.length} report(s)`
            : "\u00A7aNo open reports.")

    // Back button
    form.button("\u00A7cBACK", "textures/ui/refresh")

    // Report buttons
    for (const [_id, report] of reportEntries) {
        const timeAgo = getTimeAgo(report.timestamp)
        const typeColor = report.type === "server" ? "\u00A7c" : "\u00A7e"
        const typeLabel = report.type === "server" ? "SERVER" : "PLAYER"
        const targetLabel = report.target ? ` >> ${report.target}` : ""
        form.button(`${typeColor}[${typeLabel}] \u00A7f${report.reporter}${targetLabel}\n\u00A78${timeAgo}`)
    }

    const response = await UIUtils.showForm(admin, form)
    if (response.canceled) return

    if (response.selection === 0) return // Back

    const selectedIndex = response.selection - 1
    const [reportId, reportData] = reportEntries[selectedIndex]
    if (!reportId) return

    await showReportDetail(admin, reportId, reportData)
}

/**
 * Show detailed report view with action buttons
 * @param {import("@minecraft/server").Player} admin
 * @param {string} reportId
 * @param {Object} report
 */
async function showReportDetail(admin, reportId, report) {
    const timeAgo = getTimeAgo(report.timestamp)
    const typeLabel = report.type === "server" ? "\u00A7cServer Issue" : "\u00A7ePlayer Report"

    let body = `\u00A76Type: ${typeLabel}\n`
    body += `\u00A77Reporter: \u00A7f${report.reporter}\n`
    if (report.target) body += `\u00A77Target: \u00A7c${report.target}\n`
    body += `\u00A77Time: \u00A7f${timeAgo}\n`
    body += `\u00A77Status: \u00A7f${report.status || "open"}\n`
    body += `\u00A7r\n\u00A77Message:\n\u00A7f${report.message}`

    const form = new Kernel.ActionFormData()
        .title("\u00A7c\u00A7lReport Detail")
        .body(body)
        .button("\u00A7cDelete Report", "textures/ui/cancel")
        .button("\u00A74Ban Target", "textures/items/iron_axe")
        .button("\u00A77Back to Reports", "textures/ui/refresh")

    const response = await UIUtils.showForm(admin, form)
    if (response.canceled) return

    switch (response.selection) {
        case 0: {
            // Delete report
            ReportStore.deleteReport(reportId)
            admin.sendMessage(`\u00A7aReport \u00A7e${reportId.slice(0, 8)}... \u00A7adeleted.`)
            Kernel.system.run(() => showAdminReportUI(admin))
            break
        }
        case 1: {
            // Ban target
            if (!report.target) {
                admin.sendMessage("\u00A7cNo target player to ban (this is a server report).")
                Kernel.system.run(() => showReportDetail(admin, reportId, report))
                return
            }

            const target = Kernel.world.getAllPlayers().find(p => p.name === report.target)
            if (!target) {
                admin.sendMessage(`\u00A7cPlayer '${report.target}' is not online.`)
                Kernel.system.run(() => showReportDetail(admin, reportId, report))
                return
            }

            // FIX: Locate "banManager" and execute .addBan with full session kick
            Kernel.system.run(() => {
                try {
                    const BanManager = Kernel.get("banManager")
                    if (BanManager) {
                        const banData = {
                            playerId: target.id,
                            playerName: target.name,
                            bannedBy: admin.name,
                            bannedById: admin.id,
                            reason: `Report: ${report.message}`,
                            timestamp: Date.now(),
                            duration: 0, // Permanent
                            expires: 0
                        }

                        BanManager.addBan(banData)

                        // Terminate target session
                        try {
                            /* try */ Kernel.world.getDimension("overworld").runCommand(`kick "${target.name}" §c[BAN]\n§eREASON: Report: ${report.message}`)
                        } catch {}

                        admin.sendMessage(`§a${report.target} has been banned.`)
                    } else {
                        admin.sendMessage("§cBan system unavailable.")
                    }
                } catch (error) {
                    admin.sendMessage(`§cFailed to ban: ${error}`)
                }
            })

            // Auto-delete the report after ban
            ReportStore.deleteReport(reportId)
            break
        }
        case 2: {
            // Back
            Kernel.system.run(() => showAdminReportUI(admin))
            break
        }
    }
}

/**
 * Get human-readable time difference
 * @param {number} timestamp
 * @returns {string}
 */
function getTimeAgo(timestamp) {
    if (!timestamp) return "Unknown"
    const diff = Date.now() - timestamp
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}
