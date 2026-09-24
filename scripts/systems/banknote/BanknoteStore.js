/**
 * Banknote Store - Manages physical paper money items
 */

import { Kernel } from "../../core/Kernel.js"

export class BanknoteStore {
    static getBanknoteId() {
        return "minecraft:paper"
    }

    static createBanknote(amount, creatorId, creatorName) {
        const timestamp = Date.now()
        const noteId = this.generateNoteId(timestamp, creatorId)
        
        return {
            id: noteId,
            amount: amount,
            creator: creatorName,
            creatorId: creatorId,
            timestamp: timestamp,
            redeemed: false
        }
    }

    static generateNoteId(timestamp, creatorId) {
        return `banknote_${timestamp}_${creatorId.slice(0, 8)}_${Math.random().toString(36).substr(2, 6)}`
    }

    static serializeBanknote(banknote) {
        return JSON.stringify(banknote)
    }

    static deserializeBanknote(data) {
        try {
            return JSON.parse(data)
        } catch (error) {
            console.error(`Failed to deserialize banknote: ${error}`)
            return null
        }
    }

    static getBanknoteLore(banknote) {
        const date = new Date(banknote.timestamp).toLocaleDateString()
        const time = new Date(banknote.timestamp).toLocaleTimeString()
        
        return [
            `\u00A76Value: \u00A7e${this.formatMoney(banknote.amount)}`,
            `\u00A77Created: ${date} ${time}`,
            `\u00A77By: \u00A7f${banknote.creator}`,
            `\u00A78ID: ${banknote.id}`,
            `\u00A77\u00A7oRight-click to redeem`
        ]
    }

    static formatMoney(amount) {
        return `\u00A76$\u00A7e${amount.toLocaleString()}`
    }

    static getBanknoteName(amount) {
        if (amount >= 1000000) return `\u00A76\u00A7lBanknote \u00A7e\u00A7l${(amount / 1000000).toFixed(1)}M`
        if (amount >= 1000) return `\u00A76\u00A7lBanknote \u00A7e\u00A7l${(amount / 1000).toFixed(1)}K`
        return `\u00A76\u00A7lBanknote \u00A7e\u00A7l${amount}`
    }

    static isBanknoteItem(item) {
        if (!item || item.typeId !== this.getBanknoteId()) return false
        if (!item.nameTag || !item.nameTag.startsWith("\u00A76\u00A7lBanknote")) return false
        if (!item.getLore() || item.getLore().length === 0) return false
        return true
    }

    static extractBanknoteData(item) {
        if (!this.isBanknoteItem(item)) return null
        
        let noteId = null;
        try { noteId = item.getDynamicProperty("ae:banknote_id") } catch (e) {}

        if (!noteId) {
            const lore = item.getLore()
            const idLine = lore?.find(line => line.startsWith("\u00A78ID: "))
            if (idLine) noteId = idLine.replace("\u00A78ID: ", "")
        }
        
        if (!noteId) return null
        return this.getBanknoteData(noteId)
    }

    static storeBanknoteData(banknote) {
        try {
            const Database = Kernel.get("database")
            const banknotes = this.getAllBanknotes()
            banknotes[banknote.id] = banknote
            
            Database.set("ae:banknotes", banknotes)
            return true
        } catch (error) {
            console.error(`Failed to store banknote data: ${error}`)
            return false
        }
    }

    static getBanknoteData(noteId) {
        try {
            const banknotes = this.getAllBanknotes()
            return banknotes[noteId] || null
        } catch (error) {
            console.error(`Failed to get banknote data: ${error}`)
            return null
        }
    }

    static getAllBanknotes() {
        try {
            const Database = Kernel.get("database")
            const stored = Database.get("ae:banknotes")
            return stored || {}
        } catch (error) {
            console.error(`Failed to load banknotes: ${error}`)
            return {}
        }
    }

    static markRedeemed(noteId) {
        try {
            const Database = Kernel.get("database")
            const banknotes = this.getAllBanknotes()
            if (banknotes[noteId]) {
                banknotes[noteId].redeemed = true
                banknotes[noteId].redeemedAt = Date.now()
                Database.set("ae:banknotes", banknotes)
                return true
            }
            return false
        } catch (error) {
            console.error(`Failed to mark banknote as redeemed: ${error}`)
            return false
        }
    }

    static cleanupOldBanknotes() {
        const banknotes = this.getAllBanknotes()
        const now = Date.now()
        const thirtyDays = 30 * 24 * 60 * 60 * 1000
        
        let cleaned = 0
        
        for (const [noteId, banknote] of Object.entries(banknotes)) {
            // Remove redeemed banknotes older than 30 days
            if (banknote.redeemed && (now - banknote.redeemedAt) > thirtyDays) {
                delete banknotes[noteId]
                cleaned++
            }
        }
        
        if (cleaned > 0) {
            const Database = Kernel.get("database")
            Database.set("ae:banknotes", banknotes)
            console.log(`Cleaned up ${cleaned} old redeemed banknotes`)
        }
    }
}

// Called during boot (Stage 3) to start periodic cleanup.
// Must NOT run at module import time — Bedrock throws in early-execution mode.
export function initBanknoteCleanup() {
    Kernel.system.runInterval(() => {
        BanknoteStore.cleanupOldBanknotes()
    }, 20 * 60 * 60) // Every hour
}
