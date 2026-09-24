import { Kernel } from "../Kernel.js"

// DatabaseManager — cache-aside persistence with debounced writes and sharding for Bedrock's 32KB limit.
export class DatabaseManager {
    // constructor: initializes cache, dirtyKeys, write debounce, shard limits, transaction queues, and triggers async init.
    constructor() {
        this.cache = new Map() 
        this.dirtyKeys = new Set() 
        this.writeTimeout = null
        // wait 5 seconds before flushing to disk to avoid lag spikes.
        this.WRITE_DELAY = 5000 
        // bedrock's limit is technically 32kb, but we leave some breathing room.
        this.MAX_PROPERTY_SIZE = 30000 
        // how many items to keep in a single sharded slice.
        this.SHARD_SIZE = 50 
        
        // keeps track of sequential operations for entities to prevent race conditions.
        this.transactionQueues = new Map() 
        
        // tracks if the ghost purger is already running to prevent overlap.
        this.isPurgingGhosts = false
        this._initialized = false
    }

    // initialize: registers periodic cache cleanup, shutdown flush hook, and dispatches WAL recovery + migration.
    initialize() {
        if (this._initialized) return
        this._initialized = true

        // run cleanup every 20 minutes to clear the cache.
        Kernel.system.runInterval(() => {
            this.cleanupExpiredEntries()
        }, 20 * 60 * 20) 

        Kernel.system.beforeEvents.shutdown.subscribe(() => {
            this.flushAll()
        })

        // Recover WAL and run migration on boot!
        Kernel.system.run(async () => {
            await this.resolvePendingWal()
            await this.runOneTimeIndexMigration()
        })
    }

    // get: returns cached value, loads from storage on cache miss, or null if missing/corrupt.
    get(key) {
        if (this.cache.has(key)) {
            return this.cache.get(key)
        }

        const payload = this.loadFromStorage(key)
        if (payload !== null) {
            this.cache.set(key, payload)
        }
        return payload
    }

    // set: updates cache immediately, marks dirty, schedules background write. Returns false on invalid key or error.
    set(key, value) {
        if (value === undefined) {
            return this.delete(key)
        }
        try {
            if (typeof key !== 'string' || !/^[a-zA-Z0-9_:.-]+$/.test(key)) {
                console.error(`[DatabaseManager] Invalid key format: ${key}`)
                return false
            }

            // delete first if it already exists to move it to the end of insertion order.
            if (this.cache.has(key)) {
                this.cache.delete(key)
            }
            this.cache.set(key, value)
            
            // Hard cap cache memory (LRU eviction of clean keys)
            if (this.cache.size > 1500) {
                let evicted = 0
                for (const k of this.cache.keys()) {
                    if (evicted >= 200) break
                    if (k !== key && !this.dirtyKeys.has(k) && !this.isProtectedKey(k)) {
                        this.cache.delete(k)
                        evicted++
                    }
                }
            }

            this.dirtyKeys.add(key)
            this.scheduleWrite()
            return true
        } catch (error) {
            // if we fail here, the data is only in memory and will be lost on crash.
            console.error(`[DatabaseManager] COMMIT_FAILURE for '${key}': ${error}`)
            return false
        }
    }

    // delete: removes key from cache, dirty set, and world storage immediately.
    delete(key) {
        try {
            this.cache.delete(key)
            this.dirtyKeys.delete(key)
            Kernel.world.setDynamicProperty(key, undefined)
            return true
        } catch (error) {
            console.error(`[DatabaseManager] DECOMMISSION_FAILURE for '${key}': ${error}`)
            return false
        }
    }

    // getSharded: retrieves one item by itemId, or all items in a collection via the index.
    getSharded(collectionName, itemId = null) {
        if (itemId) {
            return this.get(`${collectionName}:item:${itemId}`)
        }

        const indexKey = `${collectionName}:index`
        const index = this.get(indexKey) || []
        
        const collection = []
        let hasStale = false
        const validIndex = []
        for (const id of index) {
            const item = this.get(`${collectionName}:item:${id}`)
            if (item !== null && item !== undefined) {
                collection.push(item)
                validIndex.push(id)
            } else {
                hasStale = true
            }
        }

        if (hasStale) {
            this.set(indexKey, validIndex)
        }
        
        return collection
    }

    // setSharded: stores an item into a collection and updates its index.
    setSharded(collectionName, itemId, payload) {
        if (payload === undefined || payload === null) {
            return this.deleteSharded(collectionName, itemId)
        }
        try {
            this.set(`${collectionName}:item:${itemId}`, payload)
            
            const indexKey = `${collectionName}:index`
            const index = this.get(indexKey) || []
            
            if (!index.includes(itemId)) {
                index.push(itemId)
                this.set(indexKey, index)
            }
            
            return true
        } catch (error) {
            console.error(`[DatabaseManager] SHARDED_COMMIT_FAILURE: ${error}`)
            return false
        }
    }

    // deleteSharded: removes an item from a sharded collection, cleans up shards, and updates the index.
    deleteSharded(collectionName, itemId) {
        try {
            const key = `${collectionName}:item:${itemId}`
            
            // check if this item was sharded (split across multiple keys).
            const indexPayload = Kernel.world.getDynamicProperty(`${key}:shard_index`)
            if (typeof indexPayload === "string") {
                try {
                    // parse the shard index and nuke all the segments.
                    const index = JSON.parse(indexPayload)
                    for (let i = 0; i < index.shardCount; i++) {
                        Kernel.world.setDynamicProperty(`${key}:shard_${index.version}_${i}`, undefined)
                    }
                    Kernel.world.setDynamicProperty(`${key}:shard_index`, undefined)
                } catch (e) {
                    console.error(`[DatabaseManager] ORPHAN_NUKE_FAILURE for '${key}': ${e}`)
                }
            }
            
            this.delete(key)
            
            const indexKey = `${collectionName}:index`
            let index = this.get(indexKey) || []
            index = index.filter(id => id !== itemId)
            this.set(indexKey, index)
            
            return true
        } catch (error) {
            console.error(`[DatabaseManager] SHARDED_DECOMMISSION_FAILURE: ${error}`)
            return false
        }
    }

    // transaction: chains async operations sequentially per player to prevent race conditions.
    async transaction(playerId, operation) {
        if (!this.transactionQueues.has(playerId)) {
            this.transactionQueues.set(playerId, Promise.resolve())
        }

        const queue = this.transactionQueues.get(playerId)
        
        const newOperation = queue.then(async () => {
            try {
                return await operation()
            } catch (error) {
                // if it fails, log it but keep the chain moving.
                console.error(`[DatabaseManager] TRANSACTION_COLLAPSE for '${playerId}': ${error}`)
                throw error
            }
        })

        this.transactionQueues.set(playerId, newOperation)
        
        // when the operation finishes, check if we can clear the queue entry to save memory.
        newOperation.finally(() => {
            if (this.transactionQueues.get(playerId) === newOperation) {
                this.transactionQueues.delete(playerId)
            }
        })

        return newOperation
    }

    // loadFromStorage: reads and parses from world storage, handling sharding detection. Bypasses cache.
    loadFromStorage(key) {
        try {
            // priority 1: check if this data was split into shards.
            const indexKey = `${key}:shard_index`
            if (Kernel.world.getDynamicProperty(indexKey)) {
                return this.loadSharded(key)
            }

            // priority 2: standard single-key resolution.
            const raw = Kernel.world.getDynamicProperty(key)
            if (typeof raw !== "string") return null
            try {
                return JSON.parse(raw)
            } catch (err) {
                console.error(`[DatabaseManager] JSON_PARSE_CORRUPT for '${key}': ${err}`)
                return null
            }
        } catch (error) {
            // World data APIs are locked during the startup/early-execution phase
            // (e.g. CommandManager's rank-enum read). Expected, not a real failure.
            if (!(error instanceof ReferenceError) || !String(error).includes("early execution")) {
                console.error(`[DatabaseManager] RETRIEVAL_FAILURE for '${key}': ${error}`)
            }
            return null
        }
    }

    // scheduleWrite: debounces write requests to batch dirty flushes.
    scheduleWrite() {
        if (this.writeTimeout) {
            Kernel.system.clearRun(this.writeTimeout)
        }

        this.writeTimeout = Kernel.system.runTimeout(() => {
            this.flushDirty()
        }, Math.max(1, Math.floor(this.WRITE_DELAY / 50)))
    }

    // flushDirty: writes all dirty keys from cache to world storage, using sharding for large payloads.
    flushDirty() {
        // copy the keys and clear the set so new changes can be tracked.
        const keysToWrite = Array.from(this.dirtyKeys)
        this.dirtyKeys.clear()

        let hasShardedWriteOccurred = false

        for (const key of keysToWrite) {
            if (this.cache.has(key)) {
                try {
                    const payload = this.cache.get(key)
                    if (payload === undefined) {
                        this.cache.delete(key)
                        Kernel.world.setDynamicProperty(key, undefined)
                        continue
                    }
                    const serialized = JSON.stringify(payload)
                    
                    if (serialized.length > this.MAX_PROPERTY_SIZE) {
                        this.shardAndWrite(key, payload)
                        hasShardedWriteOccurred = true
                    } else {
                        Kernel.world.setDynamicProperty(key, serialized)
                    }
                } catch (error) {
                    console.error(`[DatabaseManager] FLUSH_FAILURE for '${key}': ${error}`)
                }
            }
        }

        // Run ghost purge if we sharded something
        if (hasShardedWriteOccurred && !this.isPurgingGhosts) {
            this.isPurgingGhosts = true
            Kernel.system.runJob(this.ghostCleanupGenerator())
        }
    }

    // shardAndWrite: splits large payloads across versioned buffer shards using double-buffering (v1/v2) for atomic commits.
    shardAndWrite(key, payload) {
        const serialized = JSON.stringify(payload)
        const shards = []
        const charLimit = Math.floor(this.MAX_PROPERTY_SIZE / 2) // safe character count for multi-byte UTF-8
        
        // cut the string into safe character-based pieces using surrogate-pair-safe slicing.
        // This avoids converting the entire string to a character array, saving massive memory allocations.
        const len = serialized.length
        for (let i = 0; i < len; ) {
            let end = i + charLimit
            if (end < len) {
                // If the character before the boundary is a high surrogate (0xD800 to 0xDBFF),
                // decrement boundary by 1 to keep the surrogate pair together in the next shard.
                const codeBefore = serialized.charCodeAt(end - 1)
                if (codeBefore >= 0xD800 && codeBefore <= 0xDBFF) {
                    end--
                }
            } else {
                end = len
            }
            shards.push(serialized.slice(i, end))
            i = end
        }

        // check which version is currently active so we can write to the other one.
        const currentIndexRaw = Kernel.world.getDynamicProperty(`${key}:shard_index`)
        let nextVersion = "v1"
        if (typeof currentIndexRaw === "string") {
            try {
                const currentIndex = JSON.parse(currentIndexRaw)
                nextVersion = currentIndex.version === "v1" ? "v2" : "v1"
            } catch (e) { /* fallback to v1 */ }
        }

        // step 1: write all segments to the inactive buffer.
        for (let i = 0; i < shards.length; i++) {
            Kernel.world.setDynamicProperty(`${key}:shard_${nextVersion}_${i}`, shards[i])
        }

        // step 2: update the index to point to the new version.
        Kernel.world.setDynamicProperty(`${key}:shard_index`, JSON.stringify({
            shardCount: shards.length,
            timestamp: Date.now(),
            version: nextVersion
        }))
        
        console.log(`[DatabaseManager] SHARDING_COMPLETE: '${key}' [${nextVersion}] split into ${shards.length} segments.`);
    }

    // loadSharded: reconstructs sharded data from versioned segment buffers.
    loadSharded(key) {
        try {
            const indexRaw = Kernel.world.getDynamicProperty(`${key}:shard_index`)
            if (!indexRaw) return null

            const index = typeof indexRaw === "string" ? JSON.parse(indexRaw) : null
            if (!index || !index.version) return null
            
            const shards = []
            const version = index.version

            // fetch each slice in order.
            for (let i = 0; i < index.shardCount; i++) {
                const shard = Kernel.world.getDynamicProperty(`${key}:shard_${version}_${i}`)
                // if any slice is missing, the whole thing is corrupt.
                if (typeof shard !== "string") {
                    console.error(`[DatabaseManager] CRITICAL_INTEGRITY_FAILURE: Shard ${i} [${version}] missing for '${key}'`)
                    return null
                }
                shards.push(shard)
            }

            return JSON.parse(shards.join(''))
        } catch (error) {
            console.error(`[DatabaseManager] SHARD_LOAD_FAILURE for '${key}': ${error}`)
            return null
        }
    }

    // ghostCleanupGenerator: scans registry for superseded shard versions and purges them with rollback recovery.
    *ghostCleanupGenerator() {
        const allIds = Kernel.world.getDynamicPropertyIds();
        const processedBases = new Set();

        for (let i = 0; i < allIds.length; i++) {
            // Yield every 50 properties to keep TPS at 20.0 kinda
            if (i % 50 === 0) yield;

            const id = allIds[i];
            if (!id.endsWith(":shard_index")) continue;

            const baseKey = id.replace(":shard_index", "");
            if (processedBases.has(baseKey)) continue;
            processedBases.add(baseKey);

            const indexRaw = Kernel.world.getDynamicProperty(id);
            if (typeof indexRaw !== "string") continue;
            
            let index;
            try {
                index = JSON.parse(indexRaw);
            } catch (e) {
                continue;
            }
            
            const activeVersion = index.version; // e.g., "v2"
            if (!activeVersion) continue;
            
            const deadVersion = activeVersion === "v1" ? "v2" : "v1";

            // Verify active version is stable and not corrupted before nuking the dead one
            const testLoad = this.loadSharded(baseKey);
            if (testLoad === null) {
                console.error(`[DatabaseManager] CRITICAL: Active shard [${activeVersion}] for '${baseKey}' is corrupted! Attempting recovery...`);
                const deadShardPattern = `${baseKey}:shard_${deadVersion}_`;
                const deadShards = allIds.filter(sid => sid.startsWith(deadShardPattern));
                
                if (deadShards.length > 0) {
                    try {
                        Kernel.world.setDynamicProperty(id, JSON.stringify({
                            shardCount: deadShards.length,
                            timestamp: Date.now(),
                            version: deadVersion
                        }));
                        console.warn(`[DatabaseManager] ROLLBACK SUCCESSFUL: '${baseKey}' reverted to stable [${deadVersion}] with ${deadShards.length} shards.`);
                    } catch (e) {
                        console.error(`[DatabaseManager] ROLLBACK FAILED for '${baseKey}': ${e}`);
                    }
                }
                continue; // Skip purging dead shards as they are now active recovered shards
            }

            /* 
             * REALITY_SWEEP
             * Find all shards belonging to the DEAD version and nuke them.
             */
            const searchPattern = `${baseKey}:shard_${deadVersion}_`;
            for (const shardId of allIds) {
                if (shardId.startsWith(searchPattern)) {
                    // Double check index did not change mid-yield
                    const currentIndexRaw = Kernel.world.getDynamicProperty(id);
                    if (typeof currentIndexRaw === "string") {
                        try {
                            const curIndex = JSON.parse(currentIndexRaw);
                            if (curIndex.version === deadVersion) {
                                // If the current active version has switched to deadVersion, DO NOT delete it!
                                continue;
                            }
                        } catch {}
                    }
                    Kernel.world.setDynamicProperty(shardId, undefined);
                }
            }
        }
        console.log("[AethelOS] GHOST_PURGE_COMPLETE | Registry Stabilized.");
        this.isPurgingGhosts = false;
    }

    // flushAll: immediate synchronous write of all dirty keys (used during shutdown).
    flushAll() {
        this.flushDirty()
    }

    // isProtectedKey: returns true if key matches a configuration or core index pattern (preventing cache eviction).
    isProtectedKey(key) {
        if (!key) return false
        const lowerKey = key.toLowerCase()
        return (
            lowerKey.startsWith("ae:settings") ||
            lowerKey.startsWith("settings") ||
            lowerKey.endsWith(":index") ||
            lowerKey.startsWith("ae:ranks") ||
            lowerKey.startsWith("ae:warps") ||
            lowerKey.startsWith("ae:claims") ||
            lowerKey.includes("rank:") ||
            lowerKey.includes("warp:") ||
            lowerKey.includes("claim:")
        )
    }

    // cleanupExpiredEntries: purges clean cache entries when size exceeds 1000, retaining dirty and protected keys.
    cleanupExpiredEntries() {
        if (this.cache.size > 1000) {
            // iterate and delete old entries directly to avoid massive array copies.
            // we keep anything that is dirty (unsaved) regardless of age.
            let count = 0;
            const targetSize = 500;
            const toDelete = this.cache.size - targetSize;
            
            for (const [key, _value] of this.cache) {
                if (count >= toDelete) break;
                if (!this.dirtyKeys.has(key) && !this.isProtectedKey(key)) {
                    this.cache.delete(key);
                    count++;
                }
            }
        }
    }

    // getStats: returns cache/dirtyKeys/transactionQueues sizes for monitoring.
    getStats() {
        return {
            cacheSize: this.cache.size,
            dirtyKeys: this.dirtyKeys.size,
            transactionQueues: this.transactionQueues.size
        }
    }

    // writeWal: writes a WAL entry to persistent storage for crash recovery.
    writeWal(senderId, receiverId, amount, senderOriginalBalance, receiverOriginalBalance) {
        const walEntry = {
            senderId,
            receiverId,
            amount,
            senderOriginalBalance,
            receiverOriginalBalance,
            timestamp: Date.now()
        };
        Kernel.world.setDynamicProperty("ae:wal", JSON.stringify(walEntry));
    }

    // clearWal: removes the active WAL entry from storage.
    clearWal() {
        Kernel.world.setDynamicProperty("ae:wal", undefined);
    }

    // resolvePendingWal: reconciles unresolved WAL transactions — rolls back sender if interrupted mid-transfer.
    async resolvePendingWal() {
        try {
            const rawWal = Kernel.world.getDynamicProperty("ae:wal");
            if (typeof rawWal !== "string") return;

            console.warn(`[DatabaseManager] [WAL] Unresolved write-ahead log entry found! Recovering...`);
            const wal = JSON.parse(rawWal);
            if (!wal || !wal.senderId || !wal.receiverId || !wal.amount) {
                Kernel.world.setDynamicProperty("ae:wal", undefined);
                return;
            }

            const PlayerStore = Kernel.get("playerStore");
            const StoreKeys = Kernel.get("keys");
            if (!PlayerStore || !StoreKeys) {
                console.error(`[DatabaseManager] [WAL] PlayerStore or StoreKeys not available during WAL recovery!`);
                return;
            }

            const sender = { id: wal.senderId };
            const receiver = { id: wal.receiverId };
            const amount = wal.amount;

            const senderBalanceKey = StoreKeys.money(sender.id);
            const receiverBalanceKey = StoreKeys.money(receiver.id);

            const currentSenderBalance = PlayerStore.get(sender, senderBalanceKey) ?? 1000;
            const currentReceiverBalance = PlayerStore.get(receiver, receiverBalanceKey) ?? 1000;

            console.log(`[DatabaseManager] [WAL] Sender '${sender.id}' current balance: ${currentSenderBalance} (expected original: ${wal.senderOriginalBalance})`);
            console.log(`[DatabaseManager] [WAL] Receiver '${receiver.id}' current balance: ${currentReceiverBalance} (expected original: ${wal.receiverOriginalBalance})`);

            if (currentSenderBalance === wal.senderOriginalBalance - amount && currentReceiverBalance === wal.receiverOriginalBalance) {
                console.warn(`[DatabaseManager] [WAL] Transaction was partially completed (sender debited but receiver not credited). Rolling back...`);
                PlayerStore.set(sender, senderBalanceKey, wal.senderOriginalBalance);
                const { JournaledDb } = await import("./JournaledDatabase.js");
                JournaledDb.flush();
                this.flushDirty();
            } else if (currentSenderBalance === wal.senderOriginalBalance - amount && currentReceiverBalance === wal.receiverOriginalBalance + amount) {
                console.log(`[DatabaseManager] [WAL] Transaction was fully completed. Clearing log.`);
            } else if (currentSenderBalance === wal.senderOriginalBalance && currentReceiverBalance === wal.receiverOriginalBalance) {
                console.log(`[DatabaseManager] [WAL] Transaction had not started. Clearing log.`);
            } else {
                console.warn(`[DatabaseManager] [WAL] Mismatched state detected (External changes occurred). Aborting automatic rollback to prevent state corruption.`);
                const { JournaledDb } = await import("./JournaledDatabase.js");
                JournaledDb.flush();
                this.flushDirty();
            }

            Kernel.world.setDynamicProperty("ae:wal", undefined);
            console.log(`[DatabaseManager] [WAL] Recovery complete and WAL cleared.`);
        } catch (error) {
            console.error(`[DatabaseManager] [WAL] Error during recovery process: ${error}`);
        }
    }

    // runOneTimeIndexMigration: builds player name maps and audit indexes, runs once on first boot.
    async runOneTimeIndexMigration() {
        try {
            const isMigrated = this.get("ae:index_migrated")
            if (isMigrated) return

            console.warn("[DatabaseManager] [Migration] Running one-time database index migration...");
            const allIds = Kernel.world.getDynamicPropertyIds()
            
            const playerIndex = new Set()
            const namePattern = /^player:(.+):name$/
            const msgPattern = /^audit:msg:(.+)$/

            for (let i = 0; i < allIds.length; i++) {
                // Yield periodically to prevent blocking the tick
                if (i % 100 === 0) {
                    await new Promise(resolve => Kernel.system.run(resolve))
                }

                const propId = allIds[i]
                
                const nameMatch = propId.match(namePattern)
                if (nameMatch) {
                    const uuid = nameMatch[1]
                    const name = this.get(propId)
                    if (typeof name === "string" && name.trim().length > 0) {
                        this.set(`playername:${name.toLowerCase()}`, uuid)
                        playerIndex.add(uuid)
                    }
                }

                const msgMatch = propId.match(msgPattern)
                if (msgMatch) {
                    const pairId = msgMatch[1]
                    const parts = pairId.split("_")
                    if (parts.length === 2) {
                        const [idA, idB] = parts
                        
                        const convsA = this.get(`audit:convs:${idA}`) || []
                        if (!convsA.includes(idB)) {
                            convsA.push(idB)
                            this.set(`audit:convs:${idA}`, convsA)
                        }
                        
                        const convsB = this.get(`audit:convs:${idB}`) || []
                        if (!convsB.includes(idA)) {
                            convsB.push(idA)
                            this.set(`audit:convs:${idB}`, convsB)
                        }
                    }
                }
            }

            if (playerIndex.size > 0) {
                const existingIndex = this.get("ae:player_index") || []
                const mergedIndex = Array.from(new Set([...existingIndex, ...playerIndex]))
                this.set("ae:player_index", mergedIndex)
            }

            this.set("ae:index_migrated", true)
            this.flushDirty()
            console.warn("[DatabaseManager] [Migration] Database index migration completed successfully!");
        } catch (error) {
            console.error(`[DatabaseManager] [Migration] Index migration failed: ${error}`)
        }
    }
}

// export the singleton instance.
export const Database = new DatabaseManager()
