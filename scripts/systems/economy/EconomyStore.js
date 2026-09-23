import { Kernel } from "../../core/Kernel.js"
import { SignalBus } from "../../core/signalbus/SignalBus.js"
import { Configuration } from "../../Configuration.js"
import { ValidationHelper } from "../../utils/ValidationHelper.js"

// @typedef {import("@minecraft/server").Player} Player
// EconomyStore — handles money logic: atomic transactions, balance checks, leaderboard generation.

// small cache to store the top 10 richest players so we don't scan the db every frame.
let cachedLeaderboard = []

function resolvePlayer(player) {
    if (!player) return null
    if (typeof player === "string") {
        const online = Kernel.world.getAllPlayers().find(p => p.id === player)
        if (online) return online
        return { id: player }
    }
    if (typeof player === "object") {
        if (player.id && !player.isValid) {
            const online = Kernel.world.getAllPlayers().find(p => p.id === player.id)
            if (online) return online
        }
        return player
    }
    return player
}

export const EconomyStore = {
    // how much cash a new player gets. enough for a sandwich.
    get DEFAULT_BALANCE() {
        return Number(Configuration.STARTING_BALANCE)
    }, 

    // getBalance — fetches a player's current credit balance.
    getBalance(player) {
        player = resolvePlayer(player)
        if (!player || !player.id) return this.DEFAULT_BALANCE

        const PlayerStore = Kernel.get("playerStore")
        const StoreKeys = Kernel.get("keys")
        if (!PlayerStore || !StoreKeys) return this.DEFAULT_BALANCE
        
        const balance = PlayerStore.get(player, StoreKeys.money(player.id))
        return typeof balance === 'number' ? Math.round(balance * 100) / 100 : this.DEFAULT_BALANCE
    },

    // setBalance — forces a player's balance to a specific value. Uses a transaction to avoid race conditions.
    async setBalance(player, amount) {
        player = resolvePlayer(player)
        if (!player || !player.id) return false

        if (!ValidationHelper.isValidMoney(amount)) return false

        const PlayerStore = Kernel.get("playerStore")
        const StoreKeys = Kernel.get("keys")

        const finalAmount = Math.round(amount * 100) / 100
        return await PlayerStore.transaction(player, async () => {
            const success = PlayerStore.set(player, StoreKeys.money(player.id), finalAmount)
            if (success) {
                SignalBus.emit("economy:balanceChanged", { player, newBalance: finalAmount })
            }
            return success
        })
    },

    // addMoney — increments a player's balance.
    async addMoney(player, amount) {
        player = resolvePlayer(player)
        if (!player || !player.id) return false

        if (typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
            return false
        }

        const PlayerStore = Kernel.get("playerStore")
        const StoreKeys = Kernel.get("keys")

        return await PlayerStore.transaction(player, async () => {
            const currentBalance = this.getBalance(player)
            const newBalance = Math.round((currentBalance + amount) * 100) / 100

            const success = PlayerStore.set(player, StoreKeys.money(player.id), newBalance)
            if (success) {
                SignalBus.emit("economy:balanceChanged", { player, newBalance })
            }
            return success
        })
    },

    // removeMoney — decrements a player's balance. Checks if they are broke first.
    async removeMoney(player, amount) {
        player = resolvePlayer(player)
        if (!player || !player.id) return false

        if (typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
            return false
        }

        const PlayerStore = Kernel.get("playerStore")
        const StoreKeys = Kernel.get("keys")

        return await PlayerStore.transaction(player, async () => {
            const currentBalance = this.getBalance(player)

            if (currentBalance < amount) {
                return false 
            }

            const newBalance = Math.round((currentBalance - amount) * 100) / 100
            const success = PlayerStore.set(player, StoreKeys.money(player.id), newBalance)
            if (success) {
                SignalBus.emit("economy:balanceChanged", { player, newBalance })
            }
            return success
        })
    },

    // _commitTransfer — performs balance adjustments, signal bus notifications, and WAL cleanup.
    async _commitTransfer(sender, receiver, amount, senderBalance, receiverBalance) {
        const PlayerStore = Kernel.get("playerStore")
        const StoreKeys = Kernel.get("keys")
        const Database = Kernel.get("database")

        const newSenderBalance = Math.round((senderBalance - amount) * 100) / 100
        const senderSuccess = await PlayerStore.set(sender, StoreKeys.money(sender.id), newSenderBalance)
        if (!senderSuccess) {
            Database?.flushDirty()
            Database?.clearWal()
            return false
        }

        try {
            const newReceiverBalance = Math.round((receiverBalance + amount) * 100) / 100
            const receiverSuccess = await PlayerStore.set(receiver, StoreKeys.money(receiver.id), newReceiverBalance)
            if (!receiverSuccess) {
                await PlayerStore.set(sender, StoreKeys.money(sender.id), senderBalance)
                Database?.flushDirty()
                Database?.clearWal()
                return false
            }

            SignalBus.emit("economy:balanceChanged", { player: sender, newBalance: newSenderBalance })
            SignalBus.emit("economy:balanceChanged", { player: receiver, newBalance: newReceiverBalance })
            Database?.flushDirty()
            Database?.clearWal()
            return true
        } catch {
            await PlayerStore.set(sender, StoreKeys.money(sender.id), senderBalance)
            Database?.flushDirty()
            Database?.clearWal()
            return false
        }
    },

    // transferMoney — moves money between two players. Locks alphabetically to prevent deadlocks. Manual rollback on failure.
    async transferMoney(sender, receiver, amount) {
        sender = resolvePlayer(sender)
        receiver = resolvePlayer(receiver)
        if (!sender || !sender.id || !receiver || !receiver.id) return false

        if (typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
            return false
        }

        if (sender.id === receiver.id) {
            return false 
        }

        const PlayerStore = Kernel.get("playerStore")
        const Database = Kernel.get("database")

        const senderBalance = this.getBalance(sender)
        const receiverBalance = this.getBalance(receiver)

        if (senderBalance < amount) {
            return false 
        }

        const first = sender.id < receiver.id ? sender : receiver
        const second = sender.id < receiver.id ? receiver : sender

        if (Database) {
            Database.writeWal(sender.id, receiver.id, amount, senderBalance, receiverBalance)
        }

        return await PlayerStore.transaction(first, async () => {
            return await PlayerStore.transaction(second, async () => {
                return await this._commitTransfer(sender, receiver, amount, senderBalance, receiverBalance)
            })
        })
    },

    // hasEnough — quick check if a player can afford something.
    async hasEnough(player, amount) {
        player = resolvePlayer(player)
        if (!player || !player.id) return false

        if (typeof amount !== 'number' || amount < 0 || !Number.isFinite(amount)) {
            return false
        }

        const balance = this.getBalance(player)
        return balance >= amount
    },

    // returns all player balances for leaderboard queries
    getAllBalances() {
        const Database = Kernel.get("database")
        if (!Database) return []
        const uuids = Database.get("ae:player_index") || []
        const balances = []
        for (const uuid of uuids) {
            const name = Database.get(`player:${uuid}:name`) || `ID:${uuid.slice(0, 5)}`
            const balance = Database.get(`player:${uuid}:money`) ?? this.DEFAULT_BALANCE
            balances.push({ name, balance })
        }
        return balances
    },

    // returns the last generated leaderboard.
    getCachedLeaderboard() {
        return cachedLeaderboard
    },

    // updateLeaderboardGenerator — scans the database for money values, yielding every 50 keys to prevent freezing.
    *updateLeaderboardGenerator() {
        const Database = Kernel.get("database")
        const ids = Kernel.world.getDynamicPropertyIds()
        // looking for keys that look like 'player:<id>:money'.
        const moneyPattern = /^player:(.+):money$/
        const newLeaderboard = []
        
        for (let i = 0; i < ids.length; i++) {
            // yield control back to the engine every 50 entries to keep tps high.
            if (i % 50 === 0) yield
            
            const match = ids[i].match(moneyPattern)
            if (match) {
                const playerId = match[1]
                const balance = Database.get(ids[i])
                // try to find their display name, otherwise use a slice of their id.
                const name = Database.get(`player:${playerId}:name`) || `ID:${playerId.slice(0, 5)}`
                
                if (typeof balance === 'number') {
                    newLeaderboard.push({ name, balance })
                }
            }
        }
        
        // sort by balance (descending).
        newLeaderboard.sort((a, b) => b.balance - a.balance)
        // take the top 10 and save them to the cache.
        cachedLeaderboard = newLeaderboard.slice(0, 10)
    }
}
