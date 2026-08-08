(function () {
    'use strict';

    const DB_NAME = 'iOSDesktopDB';
    const STORE_NAME = 'layoutStore';
    const PREFERENCES_KEY = 'memoryAppPreferencesV1';
    const MEMORY_ITEMS_KEY = 'memoryItemsV1';
    const MEMORY_OUTBOX_KEY = 'memoryOutboxV1';
    const MEMORY_SUMMARIES_KEY = 'memorySummariesV1';
    const CONTACTS_KEY = 'wechatContactsData';
    const CHATS_KEY = 'wechatChatData';
    const DEFAULT_SUMMARY_INTERVAL = 200;
    const MIN_SUMMARY_INTERVAL = 1;
    const MAX_SUMMARY_INTERVAL = 500;
    const SUMMARY_PREFERENCES_VERSION = 3;
    const SUMMARY_PROMPT_MODE_BUILTIN = 'builtin';
    const SUMMARY_PROMPT_MODE_CUSTOM = 'custom';
    const MAX_SUMMARY_LENGTH = 12000;
    const MAX_SUMMARY_PROMPT_LENGTH = 12000;
    const MAX_SUMMARY_PROMPT_INJECTION_LENGTH = 6000;
    const MAX_SUMMARY_SOURCE_MESSAGES = 160;
    const MEMORY_SCHEMA_VERSION = 2;
    const OUTBOX_MAX_ATTEMPTS = 8;
    const OUTBOX_MAX_RETRY_DELAY_MS = 60 * 60 * 1000;
    const RETRIEVAL_COOLDOWN_MS = 8 * 60 * 1000;
    const RETRIEVAL_PRIORITY = Object.freeze({ low: -3, normal: 0, pinned: 6 });
    const VECTOR_INDEX_VERSION = 'local-ngram-v1';
    const VECTOR_DIMENSIONS = 256;
    const VECTOR_MIN_SIMILARITY = 0.12;
    const SEMANTIC_RETRIEVAL_TIMEOUT_MS = 180;
    const SEMANTIC_MIN_SIMILARITY = 0.28;
    const REFERENCE_DOCUMENT_GZIP_BASE64 = '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';
    let root = null;
    let selectedContactId = '';
    let activeTab = 'memory';
    let editingMemoryId = '';
    let cachedContacts = [];
    let cachedConversations = {};
    let cachedMemoryItems = [];
    let cachedOutbox = [];
    let cachedSummaries = [];
    let summaryIntervalMessages = DEFAULT_SUMMARY_INTERVAL;
    let summaryPromptMode = SUMMARY_PROMPT_MODE_BUILTIN;
    let customSummaryPrompt = '';
    let semanticIndexScheduled = false;
    let memorySearchQuery = '';
    const invalidatedSourceIds = new Set();

    function readRecords(keys) {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => resolve({});
            request.onsuccess = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.close();
                    resolve({});
                    return;
                }

                const result = {};
                const transaction = database.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                keys.forEach((key) => {
                    const getRequest = store.get(key);
                    getRequest.onsuccess = () => { result[key] = getRequest.result || null; };
                });
                transaction.oncomplete = () => {
                    database.close();
                    resolve(result);
                };
                transaction.onerror = () => {
                    database.close();
                    resolve({});
                };
            };
        });
    }

    function writeRecord(record) {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => resolve(false);
            request.onsuccess = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.close();
                    resolve(false);
                    return;
                }
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                transaction.objectStore(STORE_NAME).put(record);
                transaction.oncomplete = () => {
                    database.close();
                    resolve(true);
                };
                transaction.onerror = () => {
                    database.close();
                    resolve(false);
                };
            };
        });
    }

    function writeMemoryState(items, outbox, summaries = null) {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => resolve(false);
            request.onsuccess = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.close();
                    resolve(false);
                    return;
                }
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.put({ id: MEMORY_ITEMS_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items });
                store.put({ id: MEMORY_OUTBOX_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items: outbox });
                if (Array.isArray(summaries)) {
                    store.put({ id: MEMORY_SUMMARIES_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items: summaries });
                }
                transaction.oncomplete = () => {
                    database.close();
                    resolve(true);
                };
                transaction.onerror = () => {
                    database.close();
                    resolve(false);
                };
            };
        });
    }

    function savePreferences() {
        return writeRecord({
            id: PREFERENCES_KEY,
            selectedContactId,
            summaryIntervalMessages,
            summaryPromptMode,
            customSummaryPrompt,
            summaryPreferencesVersion: SUMMARY_PREFERENCES_VERSION
        });
    }

    function normalizeSummaryInterval(value) {
        const numericValue = Number.parseInt(value, 10);
        if (!Number.isFinite(numericValue)) return DEFAULT_SUMMARY_INTERVAL;
        return Math.max(MIN_SUMMARY_INTERVAL, Math.min(MAX_SUMMARY_INTERVAL, numericValue));
    }

    function readSummaryInterval(preferences) {
        if (!preferences) {
            return DEFAULT_SUMMARY_INTERVAL;
        }
        return normalizeSummaryInterval(preferences.summaryIntervalMessages);
    }

    function readSummaryPromptPreferences(preferences) {
        return {
            mode: preferences && preferences.summaryPromptMode === SUMMARY_PROMPT_MODE_CUSTOM
                ? SUMMARY_PROMPT_MODE_CUSTOM
                : SUMMARY_PROMPT_MODE_BUILTIN,
            customPrompt: String(preferences && preferences.customSummaryPrompt || '').trim().slice(0, MAX_SUMMARY_PROMPT_LENGTH)
        };
    }

    function getContactMessages(contactId) {
        const messages = cachedConversations && cachedConversations[contactId];
        return Array.isArray(messages) ? messages : [];
    }

    function parseMessageTime(message) {
        for (const key of ['timestamp', 'time', 'createdAt', 'date']) {
            const value = message && message[key];
            if (typeof value === 'number' && Number.isFinite(value)) return value < 100000000000 ? value * 1000 : value;
            if (typeof value === 'string') {
                const timestamp = Date.parse(value);
                if (Number.isFinite(timestamp)) return timestamp;
            }
        }
        return 0;
    }

    function getKnownDays(messages) {
        const firstTimestamp = messages.reduce((earliest, message) => {
            const timestamp = parseMessageTime(message);
            return timestamp && (!earliest || timestamp < earliest) ? timestamp : earliest;
        }, 0);
        if (!firstTimestamp) return 0;
        return Math.max(1, Math.floor((Date.now() - firstTimestamp) / 86400000) + 1);
    }

    function setAvatar(contact) {
        const avatar = root.querySelector('[data-memory-avatar]');
        const monogram = root.querySelector('[data-memory-monogram]');
        const image = root.querySelector('[data-memory-avatar-image]');
        const name = contact && contact.name ? contact.name.trim() : '';
        monogram.textContent = name ? name.slice(0, 1) : '记';
        image.removeAttribute('src');
        avatar.classList.remove('has-image');
        if (contact && contact.avatar) {
            image.src = contact.avatar;
            image.onload = () => avatar.classList.add('has-image');
            image.onerror = () => avatar.classList.remove('has-image');
        }
    }

    function getEmptyCopy() {
        const copy = {
            memory: ['暂无记忆', '这里会收纳你们确认过的共同记忆。'],
            relationship: ['暂无近期摘要', '累计足够的新对话后，会在后台生成可核对的摘要。'],
            fragment: ['暂无聊天片段', '非敏感的对话原话会在这里建立本地索引。'],
            archive: ['档案尚未建立', '档案只保存你主动留下的长期信息。']
        };
        return copy[activeTab] || copy.memory;
    }

    function getTabLabel(tab = activeTab) {
        return ({ memory: '记忆', relationship: '关系', fragment: '片段', archive: '档案' })[tab] || '记忆';
    }

    function getActiveItems(contactId, kind) {
        return cachedMemoryItems
            .filter((item) => item && item.bindingId === contactId && item.status === 'active')
            .filter((item) => !kind || item.kind === kind)
            .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
    }

    function normalizeMemoryText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function isSensitiveAutomaticMemory(value) {
        return /(过敏|疾病|病史|诊断|药物|医院|怀孕|流产|住址|地址|身份证|银行卡|工资|收入|债务|欠债|性经历|创伤|自杀)/i.test(value);
    }

    function getSourceIds(item) {
        return Array.isArray(item && item.sourceRefs)
            ? item.sourceRefs.map((source) => String(source && source.messageId || '')).filter(Boolean)
            : [];
    }

    function getArchiveReason(item) {
        const reason = String(item && item.archiveReason || '').trim();
        return ({ user_deleted: '用户归档', source_removed: '来源已删除', superseded: '已被新记忆替代' })[reason] || reason;
    }

    function getSourceLabel(item) {
        const source = Array.isArray(item && item.sourceRefs) ? item.sourceRefs[0] : null;
        if (!source) return '来源：未标注';
        if (source.type === 'manual') return '来源：手动添加';
        if (source.type === 'manual_edit') return '来源：手动修订';
        if (source.messageId) return '来源：聊天记录';
        return '来源：已记录';
    }

    function getRetrievalCount(item) {
        return Math.max(0, Number(item && item.retrievalStats && item.retrievalStats.injectedCount) || 0);
    }

    function getRetrievalPriority(item) {
        const priority = Number(item && item.retrievalPriority);
        if (priority === RETRIEVAL_PRIORITY.pinned || priority === RETRIEVAL_PRIORITY.low) return priority;
        return item && item.pinned ? RETRIEVAL_PRIORITY.pinned : RETRIEVAL_PRIORITY.normal;
    }

    function getRetrievalPriorityLabel(item) {
        const priority = getRetrievalPriority(item);
        if (priority === RETRIEVAL_PRIORITY.pinned) return '置顶';
        if (priority === RETRIEVAL_PRIORITY.low) return '降低优先级';
        return '普通';
    }

    function hydrateMemoryItem(item) {
        if (!item || !item.id || !item.bindingId || !item.content) return null;
        return {
            ...item,
            schemaVersion: Math.max(Number(item.schemaVersion) || 1, MEMORY_SCHEMA_VERSION),
            revision: Math.max(1, Number(item.revision) || 1),
            retrievalPriority: getRetrievalPriority(item),
            sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
            retrievalStats: item.retrievalStats && typeof item.retrievalStats === 'object'
                ? item.retrievalStats
                : { injectedCount: 0, lastInjectedAt: '', lastInjectedTurn: '', lastScore: 0, lastReasons: [] }
        };
    }

    function hydrateOutboxItem(item) {
        if (!item || !item.id || !item.bindingId || !Array.isArray(item.sourceMessages)) return null;
        return {
            ...item,
            schemaVersion: Math.max(Number(item.schemaVersion) || 1, MEMORY_SCHEMA_VERSION),
            status: item.status === 'failed' ? 'failed' : 'pending',
            attempts: Math.max(0, Number(item.attempts) || 0),
            nextAttemptAt: item.nextAttemptAt || '',
            lastError: item.lastError || '',
            updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
        };
    }

    function createTextTerms(value) {
        const text = normalizeMemoryText(value).toLowerCase();
        const terms = new Set();
        const stopTerms = new Set(['我们', '你们', '他们', '这个', '那个', '就是', '因为', '所以', '还是', '已经', '可以', '不是', '没有', '一个', '什么', '怎么', '现在', '今天', '真的', '感觉', '知道', '觉得', '然后']);
        (text.match(/[a-z0-9]{2,}/g) || []).forEach((term) => terms.add(term));
        (text.match(/[\u4e00-\u9fff]+/g) || []).forEach((block) => {
            for (let index = 0; index < block.length - 1; index += 1) {
                const term = block.slice(index, index + 2);
                if (!stopTerms.has(term)) terms.add(term);
            }
        });
        return Array.from(terms).slice(0, 40);
    }

    function hashVectorToken(value) {
        let hash = 2166136261;
        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function createLocalMemoryVector(value) {
        const text = normalizeMemoryText(value).toLowerCase().replace(/\s+/g, '');
        const values = new Float32Array(VECTOR_DIMENSIONS);
        if (!text) return { version: VECTOR_INDEX_VERSION, dimensions: VECTOR_DIMENSIONS, values };

        const addToken = (token, weight) => {
            const hash = hashVectorToken(token);
            const slot = hash % VECTOR_DIMENSIONS;
            values[slot] += (hash & 1) === 0 ? weight : -weight;
        };
        for (let index = 0; index < text.length; index += 1) addToken(text[index], 0.5);
        for (let size = 2; size <= 3; size += 1) {
            for (let index = 0; index <= text.length - size; index += 1) addToken(text.slice(index, index + size), 1);
        }
        let norm = 0;
        values.forEach((entry) => { norm += entry * entry; });
        if (norm > 0) {
            const scale = 1 / Math.sqrt(norm);
            for (let index = 0; index < values.length; index += 1) values[index] *= scale;
        }
        return { version: VECTOR_INDEX_VERSION, dimensions: VECTOR_DIMENSIONS, values };
    }

    function getVectorValues(vector) {
        const values = vector && vector.values;
        if (!values || Number(vector.dimensions) !== VECTOR_DIMENSIONS || vector.version !== VECTOR_INDEX_VERSION) return null;
        if (!Array.isArray(values) && !(values instanceof Float32Array)) return null;
        return values.length === VECTOR_DIMENSIONS ? values : null;
    }

    function getSemanticVectorValues(vector) {
        const values = vector && vector.values;
        const expectedVersion = typeof window.SemanticMemory?.getVectorVersion === 'function'
            ? window.SemanticMemory.getVectorVersion()
            : '';
        if (!expectedVersion || !vector || vector.version !== expectedVersion || !Number.isFinite(Number(vector.dimensions))) return null;
        if (!Array.isArray(values) && !(values instanceof Float32Array)) return null;
        return values.length === Number(vector.dimensions) && values.length > 0 ? values : null;
    }

    function cosineSimilarity(leftVector, rightVector) {
        const left = getVectorValues(leftVector);
        const right = getVectorValues(rightVector);
        if (!left || !right) return 0;
        let score = 0;
        for (let index = 0; index < VECTOR_DIMENSIONS; index += 1) score += left[index] * right[index];
        return Math.max(0, Math.min(1, score));
    }

    function semanticCosineSimilarity(left, right) {
        if (!left || !right || left.length !== right.length) return 0;
        let score = 0;
        for (let index = 0; index < left.length; index += 1) score += left[index] * right[index];
        return Math.max(0, Math.min(1, score));
    }

    function ensureLocalVector(item) {
        const existing = getVectorValues(item && item.vectorIndex);
        if (existing) return item.vectorIndex;
        const vectorIndex = createLocalMemoryVector(item && item.content);
        if (item) item.vectorIndex = vectorIndex;
        return vectorIndex;
    }

    function scheduleSemanticIndex() {
        if (semanticIndexScheduled || typeof window.SemanticMemory?.embed !== 'function') return;
        if (window.SemanticMemory.getState?.().status !== 'ready') return;
        semanticIndexScheduled = true;
        const schedule = typeof window.requestIdleCallback === 'function'
            ? (callback) => window.requestIdleCallback(callback, { timeout: 3000 })
            : (callback) => setTimeout(callback, 250);
        schedule(() => void populateSemanticVectors());
    }

    async function populateSemanticVectors() {
        semanticIndexScheduled = false;
        if (typeof window.SemanticMemory?.embed !== 'function') return;
        try {
            if (!await window.SemanticMemory.warmup?.()) return;
            const missing = cachedMemoryItems
                .filter((item) => item && item.tier === 'L3' && item.kind === 'fragment' && item.status === 'active' && !getSemanticVectorValues(item.semanticVector))
                .slice(0, 8);
            if (!missing.length) return;
            const nextById = new Map();
            for (const item of missing) {
                const semanticVector = await window.SemanticMemory.embed(item.content);
                if (semanticVector) nextById.set(item.id, semanticVector);
            }
            if (!nextById.size) return;
            const now = new Date().toISOString();
            const nextItems = cachedMemoryItems.map((item) => {
                const semanticVector = nextById.get(item && item.id);
                return semanticVector ? { ...item, semanticVector } : item;
            });
            const saved = await writeRecord({ id: MEMORY_ITEMS_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items: nextItems });
            if (saved) cachedMemoryItems = nextItems;
            if (missing.length === 8) scheduleSemanticIndex();
        } catch (error) {
            console.debug('语义记忆索引暂不可用，已保留本地 n-gram 检索：', error);
        }
    }

    function getActiveSummary(bindingId) {
        return cachedSummaries.find((summary) => summary && summary.bindingId === bindingId && summary.status === 'active') || null;
    }

    function getPromptSummary(bindingId) {
        const summary = getActiveSummary(bindingId);
        if (!summary || !Array.isArray(summary.sections)) return '';
        return summary.sections
            .map((section) => normalizeMemoryText(section && section.content))
            .filter(Boolean)
            .join('\n')
            .slice(0, MAX_SUMMARY_PROMPT_INJECTION_LENGTH);
    }

    function getSummaryPromptConfig() {
        return {
            mode: summaryPromptMode,
            customPrompt: summaryPromptMode === SUMMARY_PROMPT_MODE_CUSTOM ? customSummaryPrompt : ''
        };
    }

    function writeSyncedMemoryState(items, summaries, conversations) {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => resolve(false);
            request.onsuccess = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) { database.close(); resolve(false); return; }
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.put({ id: MEMORY_ITEMS_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items });
                store.put({ id: MEMORY_SUMMARIES_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items: summaries });
                store.put({ id: CHATS_KEY, conversations });
                transaction.oncomplete = () => { database.close(); resolve(true); };
                transaction.onerror = () => { database.close(); resolve(false); };
            };
        });
    }

    function getSummaryOverview(bindingId, messages = []) {
        const sourceMessages = (Array.isArray(messages) ? messages : [])
            .filter((message) => message && message.id && (message.type === 'sent' || message.type === 'received') && normalizeMemoryText(message.text))
            .map((message) => ({
                id: String(message.id),
                type: message.type,
                text: normalizeMemoryText(message.text),
                timestamp: parseMessageTime(message)
            }));
        const summary = getActiveSummary(bindingId);
        let newMessageCount = sourceMessages.length;
        if (summary) {
            const lastProcessedIndex = sourceMessages.findIndex((message) => message.id === String(summary.lastProcessedMessageId || ''));
            if (lastProcessedIndex >= 0) {
                newMessageCount = sourceMessages.length - lastProcessedIndex - 1;
            } else {
                const priorSourceIds = new Set((summary.sourceMessageIds || []).map(String));
                newMessageCount = sourceMessages.filter((message) => !priorSourceIds.has(message.id)).length;
            }
        }
        const citedIds = new Set((summary && Array.isArray(summary.sourceMessageIds) ? summary.sourceMessageIds : []).map(String));
        return {
            hasSummary: Boolean(summary),
            summary,
            text: summary ? getPromptSummary(bindingId) : '',
            updatedAt: summary && summary.updatedAt || '',
            revision: summary && Number(summary.revision) || 0,
            totalMessageCount: sourceMessages.length,
            newMessageCount,
            interval: summaryIntervalMessages,
            remainingMessageCount: Math.max(0, summaryIntervalMessages - newMessageCount),
            progress: Math.min(1, newMessageCount / summaryIntervalMessages),
            sourceMessages: sourceMessages.filter((message) => citedIds.has(message.id))
        };
    }

    async function saveSummaryOverride(bindingId, value) {
        const summary = getActiveSummary(bindingId);
        const content = normalizeMemoryText(value);
        if (!summary || !content || content.length > MAX_SUMMARY_LENGTH) return false;
        const now = new Date().toISOString();
        const priorHistory = [{
            revision: summary.revision,
            sections: summary.sections,
            sourceMessageIds: summary.sourceMessageIds,
            updatedAt: summary.updatedAt
        }, ...(Array.isArray(summary.history) ? summary.history : [])].slice(0, 20);
        const nextSummary = {
            ...summary,
            authority: 'user_confirmed',
            revision: Math.max(1, Number(summary.revision) || 1) + 1,
            sections: [{
                ...(summary.sections[0] || {}),
                title: normalizeMemoryText(summary.sections[0] && summary.sections[0].title).slice(0, 20) || '近况',
                content,
                sourceMessageIds: Array.isArray(summary.sourceMessageIds) ? summary.sourceMessageIds.slice() : []
            }],
            history: priorHistory,
            updatedAt: now
        };
        const nextSummaries = cachedSummaries.map((item) => item && item.id === summary.id ? nextSummary : item);
        const saved = await writeRecord({ id: MEMORY_SUMMARIES_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items: nextSummaries });
        if (saved) cachedSummaries = nextSummaries;
        if (saved) window.MemorySync?.schedule(bindingId);
        return saved;
    }

    function getRelevantFragmentMatches(bindingId, query, limit = 3, turnId = '') {
        const queryTerms = new Set(createTextTerms(query));
        const queryVector = createLocalMemoryVector(query);
        if (queryTerms.size === 0 && !getVectorValues(queryVector)) return [];
        const maxItems = Math.max(1, Math.min(Number(limit) || 3, 4));
        const now = Date.now();
        let upgradedVectorIndex = false;
        const matches = cachedMemoryItems
            .filter((item) => item && item.bindingId === bindingId && item.tier === 'L3' && item.kind === 'fragment' && item.status === 'active')
            .map((item) => {
                const terms = Array.isArray(item.keywords) ? item.keywords : createTextTerms(item.content);
                const matchedTerms = terms.filter((term) => queryTerms.has(term));
                const hadVector = Boolean(getVectorValues(item.vectorIndex));
                const vectorSimilarity = cosineSimilarity(queryVector, ensureLocalVector(item));
                if (!hadVector) upgradedVectorIndex = true;
                const stats = item.retrievalStats || {};
                const lastInjectedAt = Date.parse(stats.lastInjectedAt || '');
                const ageDays = Math.max(0, (now - Date.parse(item.updatedAt || item.createdAt || now)) / 86400000);
                const recencyScore = Math.max(0, 3 - Math.floor(ageDays / 21));
                const authorityScore = item.authority === 'user_confirmed' ? 4 : 1;
                const priorityScore = getRetrievalPriority(item);
                const repeatPenalty = Math.min(4, Math.floor(getRetrievalCount(item) / 3));
                const inCooldown = Number.isFinite(lastInjectedAt) && now - lastInjectedAt < RETRIEVAL_COOLDOWN_MS;
                const vectorScore = vectorSimilarity >= VECTOR_MIN_SIMILARITY ? Math.round(vectorSimilarity * 12) : 0;
                const score = matchedTerms.length * 8 + vectorScore + recencyScore + authorityScore + priorityScore - repeatPenalty;
                const reasons = [
                    matchedTerms.length ? '命中 ' + matchedTerms.slice(0, 3).join('、') : '',
                    vectorScore ? '向量相似 ' + Math.round(vectorSimilarity * 100) + '%' : '',
                    recencyScore ? '近期记录' : '',
                    priorityScore === RETRIEVAL_PRIORITY.pinned ? '已置顶' : '',
                    priorityScore === RETRIEVAL_PRIORITY.low ? '降低优先级' : '',
                    inCooldown ? '冷却中' : ''
                ].filter(Boolean);
                return { item, score, reasons, inCooldown, vectorSimilarity, hasSignal: matchedTerms.length > 0 || vectorScore > 0 };
            })
            .filter(({ score, inCooldown, hasSignal }) => score > 0 && hasSignal && !inCooldown)
            .sort((left, right) => right.score - left.score || String(right.item.createdAt || '').localeCompare(String(left.item.createdAt || '')))
            .slice(0, maxItems)
            .filter(({ item }) => normalizeMemoryText(item.content).length <= 220)
            .map(({ item, score, reasons, vectorSimilarity }) => ({ id: item.id, content: normalizeMemoryText(item.content), score, reasons, vectorSimilarity }));
        if (upgradedVectorIndex && matches.length === 0) {
            void writeRecord({ id: MEMORY_ITEMS_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items: cachedMemoryItems });
        }
        return matches;
    }

    function recordFragmentInjection(matches, turnId = '') {
        const matchById = new Map((Array.isArray(matches) ? matches : []).map((match) => [match && match.id, match]).filter(([id]) => Boolean(id)));
        if (matchById.size === 0) return;
        const now = new Date().toISOString();
        const nextItems = cachedMemoryItems.map((item) => {
            const match = matchById.get(item && item.id);
            if (!match) return item;
            const previousStats = item.retrievalStats || {};
            return {
                ...item,
                revision: Math.max(1, Number(item.revision) || 1) + 1,
                updatedAt: now,
                retrievalStats: {
                    ...previousStats,
                    injectedCount: getRetrievalCount(item) + 1,
                    lastInjectedAt: now,
                    lastInjectedTurn: String(turnId || ''),
                    lastScore: match.score,
                    lastVectorSimilarity: Number(match.vectorSimilarity) || 0,
                    lastReasons: Array.isArray(match.reasons) ? match.reasons.slice(0, 4) : []
                }
            };
        });
        cachedMemoryItems = nextItems;
        // The prompt is already assembled. Persist observability without delaying the chat request.
        void writeRecord({ id: MEMORY_ITEMS_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items: nextItems });
    }

    function getRelevantFragments(bindingId, query, limit = 3, turnId = '') {
        const matches = getRelevantFragmentMatches(bindingId, query, limit, turnId);
        if (matches.length) recordFragmentInjection(matches, turnId);
        return matches.map((match) => match.content);
    }

    async function getSemanticFragmentMatches(bindingId, query, limit = 3) {
        const queryVector = getSemanticVectorValues(await window.SemanticMemory.embed(query));
        if (!queryVector) return [];
        const queryTerms = new Set(createTextTerms(query));
        const maxItems = Math.max(1, Math.min(Number(limit) || 3, 4));
        const now = Date.now();
        return cachedMemoryItems
            .filter((item) => item && item.bindingId === bindingId && item.tier === 'L3' && item.kind === 'fragment' && item.status === 'active')
            .map((item) => {
                const semanticSimilarity = semanticCosineSimilarity(queryVector, getSemanticVectorValues(item.semanticVector));
                const terms = Array.isArray(item.keywords) ? item.keywords : createTextTerms(item.content);
                const matchedTerms = terms.filter((term) => queryTerms.has(term));
                const localSimilarity = cosineSimilarity(createLocalMemoryVector(query), ensureLocalVector(item));
                const stats = item.retrievalStats || {};
                const lastInjectedAt = Date.parse(stats.lastInjectedAt || '');
                const ageDays = Math.max(0, (now - Date.parse(item.updatedAt || item.createdAt || now)) / 86400000);
                const recencyScore = Math.max(0, 3 - Math.floor(ageDays / 21));
                const authorityScore = item.authority === 'user_confirmed' ? 4 : 1;
                const priorityScore = getRetrievalPriority(item);
                const repeatPenalty = Math.min(4, Math.floor(getRetrievalCount(item) / 3));
                const inCooldown = Number.isFinite(lastInjectedAt) && now - lastInjectedAt < RETRIEVAL_COOLDOWN_MS;
                const semanticScore = semanticSimilarity >= SEMANTIC_MIN_SIMILARITY ? Math.round(semanticSimilarity * 22) : 0;
                const localScore = localSimilarity >= VECTOR_MIN_SIMILARITY ? Math.round(localSimilarity * 6) : 0;
                const score = semanticScore + localScore + matchedTerms.length * 8 + recencyScore + authorityScore + priorityScore - repeatPenalty;
                const reasons = [
                    semanticScore ? '语义相似 ' + Math.round(semanticSimilarity * 100) + '%' : '',
                    matchedTerms.length ? '命中 ' + matchedTerms.slice(0, 3).join('、') : '',
                    priorityScore === RETRIEVAL_PRIORITY.pinned ? '已置顶' : '',
                    inCooldown ? '冷却中' : ''
                ].filter(Boolean);
                return { item, score, reasons, inCooldown, semanticSimilarity, vectorSimilarity: localSimilarity, hasSignal: semanticScore > 0 || matchedTerms.length > 0 };
            })
            .filter(({ score, inCooldown, hasSignal, item }) => score > 0 && hasSignal && !inCooldown && normalizeMemoryText(item.content).length <= 220)
            .sort((left, right) => right.score - left.score || String(right.item.createdAt || '').localeCompare(String(left.item.createdAt || '')))
            .slice(0, maxItems)
            .map(({ item, score, reasons, semanticSimilarity, vectorSimilarity }) => ({ id: item.id, content: normalizeMemoryText(item.content), score, reasons, semanticSimilarity, vectorSimilarity }));
    }

    async function getRelevantFragmentsAsync(bindingId, query, limit = 3, turnId = '') {
        const fallbackMatches = () => getRelevantFragmentMatches(bindingId, query, limit, turnId);
        if (typeof window.SemanticMemory?.embed !== 'function' || window.SemanticMemory.getState?.().status !== 'ready') {
            scheduleSemanticIndex();
            const matches = fallbackMatches();
            if (matches.length) recordFragmentInjection(matches, turnId);
            return matches.map((match) => match.content);
        }
        const semanticMatches = await Promise.race([
            getSemanticFragmentMatches(bindingId, query, limit).catch(() => []),
            new Promise((resolve) => setTimeout(() => resolve([]), SEMANTIC_RETRIEVAL_TIMEOUT_MS))
        ]);
        const matches = Array.isArray(semanticMatches) && semanticMatches.length ? semanticMatches : fallbackMatches();
        if (matches.length) recordFragmentInjection(matches, turnId);
        return matches.map((match) => match.content);
    }

    async function setMemoryRetrievalPriority(itemId, priority) {
        const item = cachedMemoryItems.find((memory) => memory && memory.id === itemId && memory.bindingId === selectedContactId && memory.status === 'active' && memory.tier === 'L3');
        if (!item || !Object.values(RETRIEVAL_PRIORITY).includes(priority)) return false;
        const now = new Date().toISOString();
        const nextItems = cachedMemoryItems.map((memory) => memory.id === itemId ? {
            ...memory,
            retrievalPriority: priority,
            pinned: priority === RETRIEVAL_PRIORITY.pinned,
            revision: Math.max(1, Number(memory.revision) || 1) + 1,
            updatedAt: now
        } : memory);
        const saved = await writeRecord({ id: MEMORY_ITEMS_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items: nextItems });
        if (saved) {
            cachedMemoryItems = nextItems;
            render();
            window.MemorySync?.schedule(selectedContactId);
        }
        return saved;
    }

    function runRetrievalEvaluation() {
        const originalItems = cachedMemoryItems;
        const now = new Date().toISOString();
        const fixture = (id, bindingId, content, extras = {}) => hydrateMemoryItem({
            id, bindingId, content, kind: 'fragment', tier: 'L3', status: 'active', authority: 'user_quote',
            keywords: ['coffee'], createdAt: now, updatedAt: now, sourceRefs: [], ...extras
        });
        cachedMemoryItems = [
            fixture('plain', 'role-a', 'coffee at the corner shop'),
            fixture('vector-only', 'role-a', 'coffee with no lexical index', { keywords: [] }),
            fixture('pinned', 'role-a', 'coffee from the usual cafe', { retrievalPriority: RETRIEVAL_PRIORITY.pinned }),
            fixture('other-role', 'role-b', 'coffee for another role', { retrievalPriority: RETRIEVAL_PRIORITY.pinned }),
            fixture('archived', 'role-a', 'archived coffee', { status: 'archived', retrievalPriority: RETRIEVAL_PRIORITY.pinned }),
            fixture('cooling', 'role-a', 'coffee just used', { retrievalStats: { injectedCount: 1, lastInjectedAt: now } })
        ];
        try {
            const matches = getRelevantFragmentMatches('role-a', 'coffee', 4);
            const ids = matches.map((match) => match.id);
            const cases = [
                { name: '角色隔离', pass: !ids.includes('other-role') },
                { name: '归档不召回', pass: !ids.includes('archived') },
                { name: '冷却不重复', pass: !ids.includes('cooling') },
                { name: '置顶优先', pass: ids[0] === 'pinned' },
                { name: '向量召回', pass: ids.includes('vector-only') }
            ];
            return { passed: cases.every((entry) => entry.pass), cases };
        } finally {
            cachedMemoryItems = originalItems;
        }
    }

    function getSummaryJob(bindingId, messages, options = {}) {
        const force = options && options.force === true;
        const allSourceMessages = (Array.isArray(messages) ? messages : [])
            .filter((message) => message && message.id && (message.type === 'sent' || message.type === 'received') && normalizeMemoryText(message.text))
            .map((message) => ({
                id: String(message.id),
                type: message.type,
                text: normalizeMemoryText(message.text).slice(0, 240),
                time: message.timestamp || message.time || message.createdAt || message.date || ''
            }));
        if (allSourceMessages.length === 0 || (!force && allSourceMessages.length < summaryIntervalMessages)) return null;

        const previous = getActiveSummary(bindingId);
        let newMessageCount = allSourceMessages.length;
        if (previous) {
            const lastProcessedIndex = allSourceMessages.findIndex((message) => message.id === previous.lastProcessedMessageId);
            if (lastProcessedIndex >= 0) {
                newMessageCount = allSourceMessages.length - lastProcessedIndex - 1;
            } else {
                const previousSourceIds = new Set(Array.isArray(previous.sourceMessageIds) ? previous.sourceMessageIds.map(String) : []);
                newMessageCount = allSourceMessages.filter((message) => !previousSourceIds.has(message.id)).length;
            }
        }
        if (!force && previous && newMessageCount < summaryIntervalMessages) return null;

        const sourceMessages = allSourceMessages.slice(-Math.min(MAX_SUMMARY_SOURCE_MESSAGES, Math.max(summaryIntervalMessages, 48)));

        return {
            id: 'summary_job_' + bindingId + '_' + sourceMessages[sourceMessages.length - 1].id + (force ? '_manual_' + Date.now() : ''),
            bindingId,
            sourceMessages,
            lastProcessedMessageId: allSourceMessages[allSourceMessages.length - 1].id,
            previousSummary: previous ? {
                id: previous.id,
                text: getPromptSummary(bindingId),
                sourceMessageIds: previous.sourceMessageIds || []
            } : null,
            minimumLength: summaryPromptMode === SUMMARY_PROMPT_MODE_BUILTIN ? 500 : 1
        };
    }

    function hasVerifiedMilestone(bindingId, value) {
        const milestones = ['恋人', '分手', '复合', '同居', '订婚', '结婚', '怀孕', '患病', '创伤'];
        const matched = milestones.filter((milestone) => value.includes(milestone));
        if (matched.length === 0) return true;
        const facts = cachedMemoryItems.filter((item) => item && item.bindingId === bindingId && item.tier === 'L1' && item.status === 'active')
            .filter((item) => item.authority === 'user_confirmed' || item.authority === 'user_quote');
        return matched.every((milestone) => facts.some((item) => String(item.content || '').includes(milestone)));
    }

    async function completeSummary(job, candidate) {
        if (!job || !job.bindingId || !candidate || !Array.isArray(candidate.sections)) return false;
        if (job.sourceMessages.some((message) => invalidatedSourceIds.has(String(message.id)))) return false;
        const previous = getActiveSummary(job.bindingId);
        // A section may only cite messages present in this generation input.
        // Previous summaries provide context, but are never evidence for a new revision.
        const validSourceIds = new Set(job.sourceMessages.map((message) => String(message.id)));
        const sections = candidate.sections.slice(0, 1).map((section) => {
            const content = normalizeMemoryText(section && section.content);
            const reportedSourceIds = (Array.isArray(section && section.sourceMessageIds) ? section.sourceMessageIds : []).map(String);
            if (reportedSourceIds.length === 0 || reportedSourceIds.some((id) => !validSourceIds.has(id))) return null;
            const sourceMessageIds = Array.from(new Set(reportedSourceIds));
            if (!content || content.length < (Number(job.minimumLength) || 1) || content.length > MAX_SUMMARY_LENGTH || sourceMessageIds.length === 0 || isSensitiveAutomaticMemory(content) || !hasVerifiedMilestone(job.bindingId, content)) return null;
            return { title: normalizeMemoryText(section && section.title).slice(0, 20) || '近况', content, sourceMessageIds };
        }).filter(Boolean);
        if (sections.length === 0) return false;

        const now = new Date().toISOString();
        const sourceMessageIds = Array.from(new Set(sections.flatMap((section) => section.sourceMessageIds)));
        const priorHistory = previous ? [{
            revision: previous.revision,
            sections: previous.sections,
            sourceMessageIds: previous.sourceMessageIds,
            updatedAt: previous.updatedAt
        }, ...(Array.isArray(previous.history) ? previous.history : [])] : [];
        const nextSummary = {
            id: previous ? previous.id : 'summary_' + job.bindingId,
            schemaVersion: MEMORY_SCHEMA_VERSION,
            bindingId: job.bindingId,
            tier: 'L2',
            status: 'active',
            revision: (previous && Number(previous.revision) || 0) + 1,
            sourceMessageIds,
            lastProcessedMessageId: job.lastProcessedMessageId,
            inputHash: sourceMessageIds.join('|'),
            sections,
            history: priorHistory.slice(0, 20),
            createdAt: previous ? previous.createdAt : now,
            updatedAt: now
        };
        const nextSummaries = [...cachedSummaries.filter((summary) => summary && summary.bindingId !== job.bindingId), nextSummary];
        const saved = await writeRecord({ id: MEMORY_SUMMARIES_KEY, schemaVersion: 1, items: nextSummaries });
        if (saved) cachedSummaries = nextSummaries;
        if (saved) window.MemorySync?.schedule(job.bindingId);
        return saved;
    }

    async function invalidateSources(bindingId, messageIds) {
        const invalidIds = new Set((Array.isArray(messageIds) ? messageIds : []).map(String).filter(Boolean));
        if (!bindingId || invalidIds.size === 0) return false;
        invalidIds.forEach((id) => invalidatedSourceIds.add(id));
        let changed = false;
        const now = new Date().toISOString();
        const nextItems = cachedMemoryItems.map((item) => {
            if (!item || item.bindingId !== bindingId || item.status !== 'active') return item;
            if (!getSourceIds(item).some((id) => invalidIds.has(id))) return item;
            changed = true;
            return { ...item, status: 'archived', archiveReason: 'source_removed', updatedAt: now, revision: Math.max(1, Number(item.revision) || 1) + 1 };
        });
        const nextSummaries = cachedSummaries.map((summary) => {
            if (!summary || summary.bindingId !== bindingId || summary.status !== 'active') return summary;
            if (!Array.isArray(summary.sourceMessageIds) || !summary.sourceMessageIds.some((id) => invalidIds.has(String(id)))) return summary;
            changed = true;
            return { ...summary, status: 'dirty', updatedAt: now };
        });
        const nextOutbox = cachedOutbox
            .map((turn) => {
                if (!turn || turn.bindingId !== bindingId) return turn;
                const sourceMessages = turn.sourceMessages.filter((message) => !invalidIds.has(String(message && message.id || '')));
                if (sourceMessages.length !== turn.sourceMessages.length) changed = true;
                return sourceMessages.length ? { ...turn, sourceMessages } : null;
            })
            .filter(Boolean);
        if (!changed) return false;
        const saved = await writeMemoryState(nextItems, nextOutbox, nextSummaries);
        if (saved) {
            cachedMemoryItems = nextItems;
            cachedSummaries = nextSummaries;
            cachedOutbox = nextOutbox;
            window.MemorySync?.schedule(bindingId);
        }
        return saved;
    }

    function getPromptMemories(contactId, limit = 6) {
        const maxItems = Math.max(1, Math.min(Number(limit) || 6, 8));
        return cachedMemoryItems
            .filter((item) => item && item.bindingId === contactId && item.tier === 'L1' && item.status === 'active')
            .filter((item) => item.authority === 'user_confirmed' || item.authority === 'user_quote')
            .sort((left, right) => {
                const authorityWeight = (item) => item.authority === 'user_confirmed' ? 1 : 0;
                return authorityWeight(right) - authorityWeight(left);
            })
            .map((item) => normalizeMemoryText(item.content))
            .filter((content) => content && content.length <= 180)
            .slice(0, maxItems);
    }

    function getSyncSnapshot(bindingId, scope = {}) {
        const tiers = Array.isArray(scope.tiers) && scope.tiers.length ? new Set(scope.tiers) : new Set(['L1']);
        const includeArchived = scope.includeArchived === true;
        const records = cachedMemoryItems
            .filter((item) => item && (!bindingId || item.bindingId === bindingId))
            .filter((item) => includeArchived || item.status === 'active' || item.archiveReason === 'user_deleted' || item.status === 'superseded')
            .filter((item) => tiers.has(item.tier))
            .map((item) => ({ ...item, recordType: 'memory' }));
        cachedSummaries.filter((summary) => summary && (!bindingId || summary.bindingId === bindingId) && (includeArchived || summary.status === 'active') && tiers.has('L2')).forEach((summary) => {
            records.push({ ...summary, id: summary.id, kind: 'summary', tier: 'L2', content: (summary.sections || []).map((section) => section.content).join('\n'), recordType: 'summary' });
        });
        if (scope.includeChat === true) Object.entries(cachedConversations || {}).forEach(([contactId, messages]) => {
            if (bindingId && contactId !== bindingId) return;
            (Array.isArray(messages) ? messages : []).slice(-200).forEach((message) => records.push({ ...message, id: 'chat_' + contactId + '_' + String(message.id), localMessageId: String(message.id), bindingId: contactId, kind: 'chat', tier: 'L3', status: 'active', content: String(message.text || ''), sourceMessageId: message.id, updatedAt: message.updatedAt || message.createdAt || message.timestamp || new Date().toISOString(), recordType: 'chat' }));
        });
        return records.filter((record) => record.content);
    }

    async function mergeSyncRecords(records) {
        const incoming = Array.isArray(records) ? records : [];
        if (!incoming.length) return 0;
        const nextItems = [...cachedMemoryItems];
        const nextSummaries = [...cachedSummaries];
        const nextConversations = Object.fromEntries(Object.entries(cachedConversations || {}).map(([key, value]) => [key, Array.isArray(value) ? [...value] : []]));
        incoming.filter((record) => record.recordType !== 'summary' && record.kind !== 'summary' && record.recordType !== 'chat' && record.kind !== 'chat').forEach((record) => {
            const index = nextItems.findIndex((item) => item.id === record.id || item.externalId === record.id);
            const normalized = { ...record, id: index >= 0 ? nextItems[index].id : String(record.id), externalId: String(record.id), authority: record.authority || 'user_quote', visibility: record.visibility || 'current_binding', schemaVersion: MEMORY_SCHEMA_VERSION, revision: Math.max(1, Number(record.revision) || 1) };
            if (index >= 0) nextItems[index] = { ...nextItems[index], ...normalized };
            else nextItems.push(normalized);
        });
        incoming.filter((record) => record.recordType === 'summary' || record.kind === 'summary').forEach((record) => {
            const index = nextSummaries.findIndex((summary) => summary.id === record.id);
            const sections = Array.isArray(record.sections) && record.sections.length ? record.sections : [{ title: '近况', content: record.content, sourceMessageIds: [] }];
            const normalized = { ...record, sections, tier: 'L2', status: record.status || 'active', revision: Math.max(1, Number(record.revision) || 1) };
            if (index >= 0) nextSummaries[index] = { ...nextSummaries[index], ...normalized };
            else nextSummaries.push(normalized);
        });
        incoming.filter((record) => record.recordType === 'chat' || record.kind === 'chat').forEach((record) => {
            if (!record.bindingId) return;
            const messages = nextConversations[record.bindingId] || (nextConversations[record.bindingId] = []);
            const messageId = String(record.localMessageId || record.sourceMessageId || record.id).replace(/^chat_[^_]+_/, '');
            if (record.status === 'archived') {
                nextConversations[record.bindingId] = messages.filter((message) => String(message.id) !== messageId);
                return;
            }
            const normalized = { ...record, id: messageId, text: record.text || record.content, type: record.type === 'sent' ? 'sent' : 'received' };
            delete normalized.kind; delete normalized.tier; delete normalized.status; delete normalized.recordType; delete normalized.bindingId; delete normalized.content;
            const index = messages.findIndex((message) => String(message.id) === messageId);
            if (index >= 0) messages[index] = { ...messages[index], ...normalized };
            else messages.push(normalized);
        });
        const saved = await writeSyncedMemoryState(nextItems, nextSummaries, nextConversations);
        if (saved) { cachedMemoryItems = nextItems; cachedSummaries = nextSummaries; cachedConversations = nextConversations; render(); }
        return saved ? incoming.length : 0;
    }

    async function preload() {
        const records = await readRecords([PREFERENCES_KEY, MEMORY_ITEMS_KEY, MEMORY_OUTBOX_KEY, MEMORY_SUMMARIES_KEY]);
        cachedMemoryItems = Array.isArray(records[MEMORY_ITEMS_KEY] && records[MEMORY_ITEMS_KEY].items)
            ? records[MEMORY_ITEMS_KEY].items.map(hydrateMemoryItem).filter(Boolean)
            : [];
        cachedOutbox = Array.isArray(records[MEMORY_OUTBOX_KEY] && records[MEMORY_OUTBOX_KEY].items)
            ? records[MEMORY_OUTBOX_KEY].items.map(hydrateOutboxItem).filter(Boolean)
            : [];
        cachedSummaries = Array.isArray(records[MEMORY_SUMMARIES_KEY] && records[MEMORY_SUMMARIES_KEY].items)
            ? records[MEMORY_SUMMARIES_KEY].items.filter((item) => item && item.id && item.bindingId && Array.isArray(item.sections))
            : [];
        summaryIntervalMessages = readSummaryInterval(records[PREFERENCES_KEY]);
        ({ mode: summaryPromptMode, customPrompt: customSummaryPrompt } = readSummaryPromptPreferences(records[PREFERENCES_KEY]));
        return cachedMemoryItems;
    }

    async function enqueueChatTurn({ bindingId, turnId, sourceMessages }) {
        if (!bindingId || !turnId || !Array.isArray(sourceMessages)) return false;
        if (cachedOutbox.some((item) => item.id === turnId)) return true;

        const item = {
            id: turnId,
            schemaVersion: MEMORY_SCHEMA_VERSION,
            bindingId,
            status: 'pending',
            attempts: 0,
            nextAttemptAt: '',
            lastError: '',
            sourceMessages: sourceMessages
                .filter((message) => message && message.id && (message.type === 'sent' || message.type === 'received') && normalizeMemoryText(message.text))
                .map((message) => ({ id: String(message.id), type: message.type, text: String(message.text) }))
                .slice(-12),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        if (item.sourceMessages.length === 0) return false;

        const nextOutbox = [...cachedOutbox, item].slice(-60);
        const saved = await writeRecord({ id: MEMORY_OUTBOX_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items: nextOutbox });
        if (saved) cachedOutbox = nextOutbox;
        return saved;
    }

    function getPendingChatTurns(bindingId, limit = 1) {
        const now = Date.now();
        return cachedOutbox
            .filter((item) => item && item.status === 'pending' && Number(item.attempts || 0) < OUTBOX_MAX_ATTEMPTS)
            .filter((item) => !bindingId || item.bindingId === bindingId)
            .filter((item) => !item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= now)
            .sort((left, right) => String(left.createdAt || '').localeCompare(String(right.createdAt || '')))
            .slice(0, Math.max(1, Number(limit) || 1))
            .map((item) => ({ ...item, sourceMessages: item.sourceMessages.map((message) => ({ ...message })) }));
    }

    async function markChatTurnFailed(turnId, error) {
        const queuedTurn = cachedOutbox.find((item) => item && item.id === turnId);
        if (!queuedTurn) return false;
        const attempts = Math.max(0, Number(queuedTurn.attempts) || 0) + 1;
        const delayMs = Math.min(OUTBOX_MAX_RETRY_DELAY_MS, Math.pow(2, Math.min(attempts, 7)) * 15000);
        const now = new Date().toISOString();
        const nextStatus = attempts >= OUTBOX_MAX_ATTEMPTS ? 'failed' : 'pending';
        const nextOutbox = cachedOutbox.map((item) => item.id === turnId ? {
            ...item,
            status: nextStatus,
            attempts,
            lastError: String(error && error.message || error || 'unknown error').slice(0, 240),
            nextAttemptAt: nextStatus === 'pending' ? new Date(Date.now() + delayMs).toISOString() : '',
            updatedAt: now
        } : item);
        const saved = await writeRecord({ id: MEMORY_OUTBOX_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items: nextOutbox });
        if (saved) cachedOutbox = nextOutbox;
        return saved;
    }

    async function completeChatTurn(turnId, candidates) {
        const queuedTurn = cachedOutbox.find((item) => item.id === turnId);
        if (!queuedTurn) return false;

        const sourceById = new Map(queuedTurn.sourceMessages.map((message) => [String(message.id), message]));
        const existingContents = new Set(
            cachedMemoryItems
                .filter((item) => item.bindingId === queuedTurn.bindingId)
                .map((item) => normalizeMemoryText(item.content).toLowerCase())
        );
        const existingFragmentSources = new Set(
            cachedMemoryItems
                .filter((item) => item.bindingId === queuedTurn.bindingId && item.tier === 'L3')
                .flatMap((item) => getSourceIds(item))
        );
        const now = new Date().toISOString();
        const newItems = [];

        (Array.isArray(candidates) ? candidates : []).slice(0, 2).forEach((candidate) => {
            const message = sourceById.get(String(candidate && candidate.messageId || ''));
            const quote = normalizeMemoryText(candidate && candidate.quote);
            if (!message || message.type !== 'sent' || !quote || quote.length < 4 || quote.length > 180) return;
            if (!String(message.text).includes(quote) || isSensitiveAutomaticMemory(quote)) return;
            const normalizedQuote = quote.toLowerCase();
            if (existingContents.has(normalizedQuote)) return;

            existingContents.add(normalizedQuote);
            newItems.push({
                id: 'memory_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                schemaVersion: MEMORY_SCHEMA_VERSION,
                bindingId: queuedTurn.bindingId,
                kind: 'memory',
                tier: 'L1',
                status: 'active',
                authority: 'user_quote',
                subjectType: 'user_persona',
                visibility: 'current_binding',
                content: quote,
                sourceRefs: [{ type: 'chat_quote', messageId: message.id, quote, createdAt: now }],
                revision: 1,
                retrievalStats: { injectedCount: 0, lastInjectedAt: '', lastInjectedTurn: '', lastScore: 0, lastReasons: [] },
                createdAt: now,
                updatedAt: now
            });
        });

        queuedTurn.sourceMessages.forEach((message) => {
            const content = normalizeMemoryText(message && message.text);
            if (!message || existingFragmentSources.has(String(message.id)) || content.length < 8 || content.length > 220 || isSensitiveAutomaticMemory(content)) return;
            existingFragmentSources.add(String(message.id));
            newItems.push({
                id: 'fragment_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                schemaVersion: MEMORY_SCHEMA_VERSION,
                bindingId: queuedTurn.bindingId,
                kind: 'fragment',
                tier: 'L3',
                status: 'active',
                authority: 'user_quote',
                subjectType: 'user_persona',
                visibility: 'current_binding',
                content,
                keywords: createTextTerms(content),
                vectorIndex: createLocalMemoryVector(content),
                sourceRefs: [{ type: 'chat_fragment', messageId: message.id, quote: content, createdAt: now }],
                revision: 1,
                retrievalStats: { injectedCount: 0, lastInjectedAt: '', lastInjectedTurn: '', lastScore: 0, lastReasons: [] },
                createdAt: now,
                updatedAt: now
            });
        });

        const nextItems = newItems.length ? [...cachedMemoryItems, ...newItems] : cachedMemoryItems;
        const nextOutbox = cachedOutbox.filter((item) => item.id !== turnId);
        const saved = await writeMemoryState(nextItems, nextOutbox);
        if (!saved) return false;
        cachedMemoryItems = nextItems;
        cachedOutbox = nextOutbox;
        scheduleSemanticIndex();
        window.MemorySync?.schedule(queuedTurn.bindingId);
        return true;
    }

    function formatMemoryDate(value) {
        const timestamp = Date.parse(value || '');
        if (!Number.isFinite(timestamp)) return '';
        return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(timestamp);
    }

    function appendMemoryEntry(list, item) {
        const entry = document.createElement('article');
        entry.className = 'memory-entry memory-card';
        const entryHeader = document.createElement('div');
        entryHeader.className = 'memory-entry-header memory-card-header';
        const meta = document.createElement('span');
        meta.className = 'memory-entry-meta badge ' + (item.tier === 'L2' ? 'summary' : 'manual');
        meta.textContent = item.tier === 'L3'
            ? 'L3 片段 · ' + (formatMemoryDate(item.createdAt) || '聊天记录')
            : (formatMemoryDate(item.createdAt) || '手动记录');
        const actions = document.createElement('div');
        actions.className = 'memory-entry-actions';
        if (item.status === 'archived' && item.archiveReason !== 'source_removed') {
            const restoreButton = document.createElement('button');
            restoreButton.type = 'button';
            restoreButton.textContent = '恢复';
            restoreButton.addEventListener('click', () => void restoreMemory(item.id));
            actions.append(restoreButton);
        } else {
            if (item.tier === 'L3') {
                const prioritySelect = document.createElement('select');
                prioritySelect.className = 'memory-priority-action';
                prioritySelect.setAttribute('aria-label', '片段召回优先级');
                [
                    [RETRIEVAL_PRIORITY.pinned, '置顶'],
                    [RETRIEVAL_PRIORITY.normal, '普通'],
                    [RETRIEVAL_PRIORITY.low, '降低']
                ].forEach(([value, label]) => {
                    const option = document.createElement('option');
                    option.value = String(value);
                    option.textContent = label;
                    option.selected = value === getRetrievalPriority(item);
                    prioritySelect.appendChild(option);
                });
                prioritySelect.addEventListener('change', () => void setMemoryRetrievalPriority(item.id, Number(prioritySelect.value)));
                actions.append(prioritySelect);
            }
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.textContent = '编辑';
            editButton.addEventListener('click', () => openComposer(item));
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'memory-delete-action';
            deleteButton.textContent = '删除';
            deleteButton.addEventListener('click', () => requestArchiveMemory(item.id));
            actions.append(editButton, deleteButton);
        }
        entryHeader.append(meta, actions);
        const text = document.createElement('p');
        text.textContent = item.content || '';
        const provenance = document.createElement('p');
        provenance.className = 'memory-entry-provenance';
        const recallReasons = Array.isArray(item.retrievalStats && item.retrievalStats.lastReasons) ? item.retrievalStats.lastReasons : [];
        const priorityCopy = item.tier === 'L3' ? '优先级：' + getRetrievalPriorityLabel(item) : '';
        const vectorCopy = item.tier === 'L3'
            ? (getVectorValues(item.vectorIndex) ? '本地向量已建立' : '本地向量待建立')
            : '';
        const recallCopy = getRetrievalCount(item) > 0
            ? ' · 召回 ' + getRetrievalCount(item) + ' 次' + (recallReasons.length ? '（' + recallReasons.join('、') + '）' : '')
            : '';
        provenance.textContent = (item.status === 'archived' || item.status === 'superseded')
            ? ('状态：' + (getArchiveReason(item) || '已归档'))
            : [getSourceLabel(item), priorityCopy, vectorCopy].filter(Boolean).join(' · ') + recallCopy;
        entry.append(entryHeader, text, provenance);
        list.appendChild(entry);
    }

    function renderMemoryContent(contact) {
        const content = root.querySelector('[data-memory-content]');
        const title = root.querySelector('[data-memory-card-title]');
        const allItems = contact
            ? (activeTab === 'archive'
                ? cachedMemoryItems.filter((item) => item && item.bindingId === contact.id && (item.status === 'archived' || item.status === 'superseded')).sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))
                : getActiveItems(contact.id, activeTab))
            : [];
        const searchQuery = memorySearchQuery.trim().toLocaleLowerCase();
        const items = searchQuery
            ? allItems.filter((item) => String(item.content || '').toLocaleLowerCase().includes(searchQuery))
            : allItems;
        const summary = contact && activeTab === 'relationship' ? getActiveSummary(contact.id) : null;
        const [emptyTitle, emptyText] = getEmptyCopy();
        title.textContent = activeTab === 'memory' ? '\u8fd1\u671f\u8bb0\u5fc6' : getTabLabel();
        content.replaceChildren();

        if (summary || items.length > 0) {
            const list = document.createElement('div');
            list.className = 'memory-entry-list memory-list';

            if (summary) {
                summary.sections.forEach((section) => {
                    const entry = document.createElement('article');
                    entry.className = 'memory-entry memory-card';
                    const meta = document.createElement('span');
                    meta.className = 'memory-entry-meta badge summary';
                    meta.textContent = 'L2 摘要 · ' + (section.title || '近况');
                    const text = document.createElement('p');
                    text.textContent = section.content || '';
                    entry.append(meta, text);
                    list.appendChild(entry);
                });
            }

            items.forEach((item) => appendMemoryEntry(list, item));
            content.appendChild(list);
            return;
        }

        {
            const empty = document.createElement('div');
            empty.className = 'memory-empty-state';
            empty.innerHTML = '<span class="memory-empty-mark">✦</span><h2></h2><p></p>';
            empty.querySelector('h2').textContent = emptyTitle;
            empty.querySelector('p').textContent = emptyText;
            content.appendChild(empty);
        }
    }

    function renderRolePicker() {
        const list = root.querySelector('[data-memory-role-list]');
        const empty = root.querySelector('[data-memory-role-empty]');
        list.replaceChildren();
        const hasContacts = cachedContacts.length > 0;
        empty.hidden = hasContacts;
        list.hidden = !hasContacts;
        if (!hasContacts) return;

        cachedContacts.forEach((contact) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'memory-role-option' + (contact.id === selectedContactId ? ' is-selected' : '');
            const avatar = document.createElement('span');
            avatar.className = 'memory-role-avatar';
            const monogram = document.createElement('span');
            monogram.textContent = (contact.name || '记').trim().slice(0, 1);
            avatar.appendChild(monogram);
            if (contact.avatar) {
                const image = document.createElement('img');
                image.alt = '';
                image.src = contact.avatar;
                image.onload = () => avatar.classList.add('has-image');
                image.onerror = () => avatar.classList.remove('has-image');
                avatar.appendChild(image);
            }
            const label = document.createElement('span');
            label.className = 'memory-role-name';
            label.textContent = contact.name || '未命名角色';
            const hint = document.createElement('span');
            hint.className = 'memory-role-hint';
            hint.textContent = '进入记忆';
            button.append(avatar, label, hint);
            button.addEventListener('click', () => selectRole(contact.id));
            list.appendChild(button);
        });
    }

    function showRolePicker() {
        if (!root) return;
        renderRolePicker();
        root.classList.add('is-picking-role');
        root.querySelector('[data-memory-role-picker]').setAttribute('aria-hidden', 'false');
    }

    function hideRolePicker() {
        root.classList.remove('is-picking-role');
        root.querySelector('[data-memory-role-picker]').setAttribute('aria-hidden', 'true');
    }

    function selectRole(contactId) {
        selectedContactId = contactId;
        activeTab = 'memory';
        savePreferences();
        if (getReferenceFrame()) {
            getReferenceFrame().contentDocument?.getElementById('switcherOverlay')?.classList.remove('is-visible');
            renderReferenceDocument();
            return;
        }
        hideRolePicker();
        render();
    }

    function openComposer(item = null) {
        const contact = cachedContacts.find((item) => item.id === selectedContactId);
        if (!contact) {
            const referenceFrame = getReferenceFrame();
            if (referenceFrame?.contentDocument) {
                showReferenceRolePicker(referenceFrame.contentDocument);
                return;
            }
            showRolePicker();
            return;
        }
        editingMemoryId = item && item.id ? item.id : '';
        root.classList.add('is-composing');
        root.querySelector('[data-memory-composer]').setAttribute('aria-hidden', 'false');
        root.querySelector('[data-memory-composer-title]').textContent = editingMemoryId ? '修改记忆' : '新增' + getTabLabel();
        root.querySelector('[data-memory-composer-role]').textContent = contact.name || '未命名角色';
        const input = root.querySelector('[data-memory-composer-input]');
        const error = root.querySelector('[data-memory-composer-error]');
        input.value = item && item.content ? item.content : '';
        error.textContent = '';
        requestAnimationFrame(() => input.focus());
    }

    function closeComposer() {
        if (!root) return;
        root.classList.remove('is-composing');
        root.querySelector('[data-memory-composer]').setAttribute('aria-hidden', 'true');
        editingMemoryId = '';
    }

    function formatSummaryTimestamp(value) {
        const timestamp = Date.parse(value || '');
        if (!Number.isFinite(timestamp)) return '尚未更新';
        return new Intl.DateTimeFormat('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(timestamp));
    }

    function renderSummaryPanel(message = '') {
        if (!root) return;
        const contact = cachedContacts.find((item) => item.id === selectedContactId) || null;
        const overview = getSummaryOverview(selectedContactId, contact ? getContactMessages(contact.id) : []);
        const role = root.querySelector('[data-memory-summary-role]');
        const text = root.querySelector('[data-memory-summary-text]');
        const input = root.querySelector('[data-memory-summary-input]');
        const meta = root.querySelector('[data-memory-summary-meta]');
        const progress = root.querySelector('[data-memory-summary-progress]');
        const progressCopy = root.querySelector('[data-memory-summary-progress-copy]');
        const sourceCount = root.querySelector('[data-memory-summary-source-count]');
        const sourceList = root.querySelector('[data-memory-summary-sources]');
        const editButton = root.querySelector('[data-memory-action="edit-summary"]');
        const refreshButton = root.querySelector('[data-memory-action="refresh-summary"]');
        const status = root.querySelector('[data-memory-summary-status]');

        role.textContent = contact ? contact.name || '未命名角色' : '尚未选择角色';
        text.textContent = overview.text || '还没有近期摘要';
        text.classList.toggle('is-empty', !overview.text);
        input.value = overview.text;
        meta.textContent = overview.hasSummary
            ? '更新于 ' + formatSummaryTimestamp(overview.updatedAt) + ' · 第 ' + overview.revision + ' 版'
            : '累计足够的对话后会自动生成';
        progress.max = overview.interval;
        progress.value = Math.min(overview.newMessageCount, overview.interval);
        progressCopy.textContent = overview.totalMessageCount === 0
            ? '还没有可用于摘要的对话'
            : overview.hasSummary
                ? '新增 ' + overview.newMessageCount + ' / ' + overview.interval + ' 条'
                : '已积累 ' + Math.min(overview.newMessageCount, overview.interval) + ' / ' + overview.interval + ' 条';
        sourceCount.textContent = overview.sourceMessages.length + ' 条';
        sourceList.replaceChildren();
        overview.sourceMessages.forEach((source) => {
            const item = document.createElement('div');
            item.className = 'memory-summary-source';
            const label = document.createElement('span');
            label.textContent = source.type === 'sent' ? '我' : (contact && contact.name || '角色');
            const copy = document.createElement('p');
            copy.textContent = source.text;
            item.append(label, copy);
            sourceList.appendChild(item);
        });
        if (!overview.sourceMessages.length) {
            const empty = document.createElement('p');
            empty.className = 'memory-summary-source-empty';
            empty.textContent = overview.hasSummary ? '这版摘要没有可显示的来源消息' : '生成摘要后可在这里核对来源';
            sourceList.appendChild(empty);
        }
        editButton.disabled = !overview.hasSummary;
        refreshButton.disabled = !contact || overview.totalMessageCount === 0;
        status.textContent = message;
    }

    async function openSummaryPanel() {
        if (!root) return;
        closeSummarySettings();
        closeComposer();
        await refresh();
        root.classList.add('is-viewing-summary');
        root.querySelector('[data-memory-summary-panel]').setAttribute('aria-hidden', 'false');
        renderSummaryPanel();
    }

    function closeSummaryPanel() {
        if (!root) return;
        root.classList.remove('is-viewing-summary', 'is-editing-summary');
        const panel = root.querySelector('[data-memory-summary-panel]');
        if (panel) panel.setAttribute('aria-hidden', 'true');
        const sources = root.querySelector('[data-memory-summary-sources]');
        if (sources) sources.hidden = true;
        const sourceToggle = root.querySelector('[data-memory-action="toggle-summary-sources"]');
        if (sourceToggle) sourceToggle.textContent = '查看依据';
    }

    function toggleSummarySources() {
        const sources = root && root.querySelector('[data-memory-summary-sources]');
        const button = root && root.querySelector('[data-memory-action="toggle-summary-sources"]');
        if (!sources || !button) return;
        sources.hidden = !sources.hidden;
        button.textContent = sources.hidden ? '查看依据' : '收起依据';
    }

    function startSummaryEdit() {
        if (!root || !getActiveSummary(selectedContactId)) return;
        root.classList.add('is-editing-summary');
        const input = root.querySelector('[data-memory-summary-input]');
        input.value = getPromptSummary(selectedContactId);
        root.querySelector('[data-memory-summary-status]').textContent = '';
        requestAnimationFrame(() => input.focus());
    }

    function cancelSummaryEdit() {
        if (!root) return;
        root.classList.remove('is-editing-summary');
        renderSummaryPanel();
    }

    async function saveEditedSummary() {
        const input = root && root.querySelector('[data-memory-summary-input]');
        const status = root && root.querySelector('[data-memory-summary-status]');
        const value = normalizeMemoryText(input && input.value);
        if (!value) {
            if (status) status.textContent = '摘要不能为空。';
            return;
        }
        if (value.length > MAX_SUMMARY_LENGTH) {
            if (status) status.textContent = '摘要不能超过 ' + MAX_SUMMARY_LENGTH + ' 个字符。';
            return;
        }
        const saved = await saveSummaryOverride(selectedContactId, value);
        if (!saved) {
            if (status) status.textContent = '摘要保存失败，请稍后重试。';
            return;
        }
        root.classList.remove('is-editing-summary');
        renderSummaryPanel('已保存人工修正。');
        renderReferenceDocument();
    }

    async function refreshSummaryNow() {
        const button = root && root.querySelector('[data-memory-action="refresh-summary"]');
        const status = root && root.querySelector('[data-memory-summary-status]');
        if (!button || !status || typeof window.wcRegenerateMemorySummary !== 'function') {
            if (status) status.textContent = '当前聊天模块暂不支持立即更新。';
            return;
        }
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        status.textContent = '正在更新摘要...';
        try {
            await window.wcRegenerateMemorySummary(selectedContactId);
            await refresh();
            renderSummaryPanel('摘要已更新。');
            renderReferenceDocument();
        } catch (error) {
            renderSummaryPanel(error && error.message ? error.message : '摘要更新失败，请稍后重试。');
        } finally {
            button.removeAttribute('aria-busy');
            button.disabled = false;
        }
    }

    function openSummarySettings() {
        if (!root) return;
        const sheet = root.querySelector('[data-memory-summary-settings]');
        const input = root.querySelector('[data-memory-summary-interval]');
        const error = root.querySelector('[data-memory-summary-error]');
        input.value = String(summaryIntervalMessages);
        renderSummaryPromptSettings();
        error.textContent = '';
        const semanticState = getSemanticModelState();
        const modelUrl = root.querySelector('[data-semantic-model-url]');
        if (modelUrl) modelUrl.value = semanticState.manifestUrl || '';
        renderSemanticModelState(semanticState);
        root.classList.add('is-configuring-summary');
        sheet.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => input.focus());
    }

    function closeSummarySettings() {
        if (!root) return;
        closeMemorySyncProviderDialog();
        root.classList.remove('is-configuring-summary');
        const sheet = root.querySelector('[data-memory-summary-settings]');
        if (sheet) sheet.setAttribute('aria-hidden', 'true');
        requestAnimationFrame(() => getReferenceFrame()?.contentDocument?.querySelector('.btn-capsule')?.focus());
    }

    function openMemorySyncProviderDialog() {
        const dialog = root && root.querySelector('[data-memory-sync-provider-dialog]');
        if (!dialog) return;
        dialog.setAttribute('aria-hidden', 'false');
        dialog.classList.add('is-visible');
    }

    function closeMemorySyncProviderDialog() {
        const dialog = root && root.querySelector('[data-memory-sync-provider-dialog]');
        if (!dialog) return;
        dialog.setAttribute('aria-hidden', 'true');
        dialog.classList.remove('is-visible');
    }

    function selectMemorySyncProvider(provider) {
        const section = root && root.querySelector('.memory-external-section');
        if (!section) return;
        const input = section.querySelector('[data-memory-sync-provider]');
        const label = section.querySelector('[data-memory-sync-provider-label]');
        const option = root.querySelector('[data-memory-sync-provider-option="' + provider + '"]');
        if (!input || !label || !option) return;
        input.value = provider;
        label.textContent = option.dataset.label;
        root.querySelectorAll('[data-memory-sync-provider-option]').forEach((item) => {
            const selected = item === option;
            item.classList.toggle('is-selected', selected);
            item.setAttribute('aria-checked', String(selected));
        });
        closeMemorySyncProviderDialog();
    }

    function makeMemorySettingsCollapsible(section, title, description, icon, status = '未配置') {
        if (!section || section.classList.contains('memory-settings-collapsible')) return;
        const heading = section.querySelector(':scope > h3');
        if (!heading) return;
        const body = document.createElement('div');
        body.className = 'memory-settings-collapsible-body';
        while (heading.nextSibling) body.appendChild(heading.nextSibling);
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'memory-settings-collapsible-header';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = '<span class="memory-source-icon" aria-hidden="true">' + icon + '</span><span class="memory-source-copy"><strong>' + title + '</strong><small>' + description + '</small></span><span class="memory-source-status" data-memory-section-status>' + status + '</span><svg class="memory-settings-chevron" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';
        toggle.addEventListener('click', () => {
            const expanded = section.classList.toggle('is-expanded');
            toggle.setAttribute('aria-expanded', String(expanded));
        });
        section.classList.add('memory-settings-collapsible');
        section.replaceChildren(toggle, body);
    }

    function buildRemoteVectorSection(settings) {
        const section = document.createElement('section');
        section.className = 'memory-settings-section memory-remote-vector-section';
        section.innerHTML = '<h3>其他向量模型</h3><div class="memory-settings-collapsible-body"><p class="memory-semantic-settings-copy">连接第三方向量服务，模型列表和密钥只保存在本机。</p><label class="memory-semantic-settings-input"><span>服务地址</span><input type="url" data-memory-remote-url placeholder="https://api.example.com/v1"></label><label class="memory-semantic-settings-input"><span>API Key</span><input type="password" data-memory-remote-key autocomplete="off" placeholder="用户自己的密钥"></label><label class="memory-semantic-settings-input"><span>模型</span><button type="button" class="memory-remote-model-button" data-memory-action="choose-memory-remote-model" aria-haspopup="dialog"><span data-memory-remote-model-label>未配置</span><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg></button><input type="hidden" data-memory-remote-model value="BAAI/bge-m3"></label><div class="memory-sync-actions"><button type="button" data-memory-action="pull-memory-remote-model">拉取模型</button><button type="button" data-memory-action="save-memory-remote-model">保存配置</button></div><p class="memory-composer-error" data-memory-remote-status aria-live="polite"></p></div>';
        return section;
    }

    function remoteVectorConfigFromUi() {
        const section = root.querySelector('.memory-remote-vector-section');
        return {
            provider: 'siliconflow',
            baseUrl: section.querySelector('[data-memory-remote-url]').value.trim(),
            ...(section.querySelector('[data-memory-remote-key]').value.trim() ? { apiKey: section.querySelector('[data-memory-remote-key]').value.trim() } : {}),
            model: section.querySelector('[data-memory-remote-model]').value.trim()
        };
    }

    function renderRemoteVectorConfig(config) {
        const section = root.querySelector('.memory-remote-vector-section');
        if (!section || !config) return;
        section.querySelector('[data-memory-remote-url]').value = config.baseUrl || '';
        if (config.apiKey !== 'configured') section.querySelector('[data-memory-remote-key]').value = config.apiKey || '';
        const models = Array.from(new Set([...(Array.isArray(config.models) ? config.models : []), config.model || 'BAAI/bge-m3'])).filter(Boolean);
        const input = section.querySelector('[data-memory-remote-model]');
        input.value = config.model || models[0] || 'BAAI/bge-m3';
        section.dataset.models = JSON.stringify(models);
        section.querySelector('[data-memory-remote-model-label]').textContent = input.value || '未配置';
        const sourceStatus = section.querySelector('[data-memory-section-status]');
        if (sourceStatus) sourceStatus.textContent = config.apiKey === 'configured' ? '已配置' : '未配置';
        section.querySelector('[data-memory-remote-status]').textContent = config.status === 'error' ? (config.error || '模型拉取失败') : config.models?.length ? ('已保存 ' + config.models.length + ' 个模型') : '';
    }

    async function loadRemoteVectorSettings() {
        const config = await window.SemanticMemory?.initRemote?.().catch(() => null);
        if (config) renderRemoteVectorConfig(config);
    }

    async function pullRemoteVectorModels() {
        const section = root.querySelector('.memory-remote-vector-section');
        const status = section.querySelector('[data-memory-remote-status]');
        status.textContent = '正在拉取模型列表…';
        try {
            const config = await window.SemanticMemory.pullRemoteModels(remoteVectorConfigFromUi());
            renderRemoteVectorConfig(config);
            status.textContent = '模型列表已更新，共 ' + (config.models?.length || 0) + ' 个。';
        } catch (error) { status.textContent = '拉取失败：' + String(error.message || error); }
    }

    async function saveRemoteVectorSettings() {
        const section = root.querySelector('.memory-remote-vector-section');
        const status = section.querySelector('[data-memory-remote-status]');
        try {
            const config = await window.SemanticMemory.saveRemoteConfig(remoteVectorConfigFromUi());
            renderRemoteVectorConfig(config);
            status.textContent = '远程向量模型设置已保存。';
        } catch (error) { status.textContent = '保存失败：' + String(error.message || error); }
    }

    function openRemoteVectorModelDialog() {
        const section = root.querySelector('.memory-remote-vector-section');
        const dialog = root.querySelector('[data-memory-remote-model-dialog]');
        if (!section || !dialog) return;
        let models = [];
        try { models = JSON.parse(section.dataset.models || '[]'); } catch (_) {}
        const current = section.querySelector('[data-memory-remote-model]').value;
        const list = dialog.querySelector('.memory-choice-list');
        list.replaceChildren(...models.map((model) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'memory-choice-option' + (model === current ? ' is-selected' : '');
            button.innerHTML = '<span></span><span class="memory-choice-check" aria-hidden="true">✓</span>';
            button.querySelector('span').textContent = model;
            button.addEventListener('click', () => {
                section.querySelector('[data-memory-remote-model]').value = model;
                section.querySelector('[data-memory-remote-model-label]').textContent = model;
                dialog.classList.remove('is-visible');
                dialog.setAttribute('aria-hidden', 'true');
            });
            return button;
        }));
        dialog.classList.add('is-visible');
        dialog.setAttribute('aria-hidden', 'false');
    }

    function adjustSummaryInterval(delta) {
        const input = root && root.querySelector('[data-memory-summary-interval]');
        if (!input) return;
        const current = Number.parseInt(input.value, 10) || summaryIntervalMessages;
        input.value = String(Math.max(MIN_SUMMARY_INTERVAL, Math.min(MAX_SUMMARY_INTERVAL, current + delta)));
    }

    function renderSummaryPromptSettings() {
        if (!root) return;
        const toggle = root.querySelector('[data-memory-summary-prompt-custom]');
        const input = root.querySelector('[data-memory-summary-custom-prompt]');
        const customSection = root.querySelector('[data-memory-summary-custom-prompt-section]');
        if (!toggle || !input || !customSection) return;
        const usesCustomPrompt = summaryPromptMode === SUMMARY_PROMPT_MODE_CUSTOM;
        toggle.checked = usesCustomPrompt;
        toggle.closest('.memory-sync-toggle-row')?.classList.toggle('is-on', usesCustomPrompt);
        input.value = customSummaryPrompt;
        customSection.hidden = !usesCustomPrompt;
        const sectionStatus = root.querySelector('.memory-summary-prompt-section [data-memory-section-status]');
        if (sectionStatus) sectionStatus.textContent = usesCustomPrompt ? '自定义' : '内置';
    }

    function getSemanticModelState() {
        return typeof window.SemanticMemory?.getState === 'function'
            ? window.SemanticMemory.getState()
            : { status: 'unavailable', manifestUrl: '', downloadedBytes: 0, totalBytes: 0, error: '' };
    }

    function renderSemanticModelState(state = getSemanticModelState()) {
        if (!root) return;
        const status = root.querySelector('[data-semantic-model-status]');
        const progress = root.querySelector('[data-semantic-model-progress]');
        const removeButton = root.querySelector('[data-memory-action="remove-semantic-model"]');
        if (!status || !progress || !removeButton) return;
        const labels = {
            'not-configured': '本地语义模型未下载；当前检索使用本地 n-gram',
            downloading: '正在下载',
            ready: state.runtimeStatus === 'ready' ? '语义模型已启用，聊天检索优先使用语义相似度' : (state.runtimeStatus === 'error' ? '语义模型初始化失败；当前检索使用本地 n-gram' : '模型已下载，正在后台初始化语义检索'),
            error: '下载失败',
            unavailable: '当前浏览器不支持'
        };
        const downloaded = Math.max(0, Number(state.downloadedBytes) || 0);
        const total = Math.max(0, Number(state.totalBytes) || 0);
        status.textContent = state.error ? (labels[state.status] || '下载失败') + '：' + state.error : (state.runtimeError ? (labels[state.status] || '语义模型初始化失败') + '：' + state.runtimeError : (labels[state.status] || '未配置模型'));
        progress.max = total || 1;
        progress.value = Math.min(downloaded, progress.max);
        progress.hidden = state.status !== 'downloading' && state.status !== 'ready';
        removeButton.hidden = state.status !== 'ready';
        const sourceStatus = root.querySelector('.memory-settings-collapsible .memory-semantic-model-status')?.closest('.memory-settings-collapsible')?.querySelector('[data-memory-section-status]');
        if (sourceStatus) sourceStatus.textContent = state.status === 'ready'
            ? (state.runtimeStatus === 'ready' ? '语义检索已启用' : (state.runtimeStatus === 'error' ? '已回退 n-gram' : '正在初始化'))
            : 'n-gram 检索中';
    }

    function openSemanticSettings() {
        if (!root) return;
        const state = getSemanticModelState();
        const input = root.querySelector('[data-semantic-model-url]');
        input.value = state.manifestUrl || '';
        renderSemanticModelState(state);
        root.classList.add('is-configuring-semantic');
        root.querySelector('[data-memory-semantic-settings]').setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => input.focus());
    }

    function closeSemanticSettings() {
        if (!root) return;
        root.classList.remove('is-configuring-semantic');
        root.querySelector('[data-memory-semantic-settings]').setAttribute('aria-hidden', 'true');
    }

    async function downloadSemanticModel() {
        const input = root.querySelector('[data-semantic-model-url]');
        if (!window.SemanticMemory?.download) {
            renderSemanticModelState({ status: 'unavailable', error: '' });
            return;
        }
        try {
            await window.SemanticMemory.download(input.value.trim(), (downloaded, total) => {
                renderSemanticModelState({ ...window.SemanticMemory.getState(), downloadedBytes: downloaded, totalBytes: total, status: 'downloading' });
            });
            renderSemanticModelState(window.SemanticMemory.getState());
        } catch (error) {
            renderSemanticModelState();
        }
    }

    async function removeSemanticModel() {
        if (!window.SemanticMemory?.remove) return;
        await window.SemanticMemory.remove();
        renderSemanticModelState();
    }

    async function saveSummarySettings() {
        const input = root.querySelector('[data-memory-summary-interval]');
        const error = root.querySelector('[data-memory-summary-error]');
        const rawValue = Number.parseInt(input.value, 10);
        if (!Number.isFinite(rawValue) || rawValue < MIN_SUMMARY_INTERVAL || rawValue > MAX_SUMMARY_INTERVAL) {
            error.textContent = '请输入 ' + MIN_SUMMARY_INTERVAL + ' 到 ' + MAX_SUMMARY_INTERVAL + ' 之间的整数。';
            input.focus();
            return;
        }
        const customToggle = root.querySelector('[data-memory-summary-prompt-custom]');
        const customPromptInput = root.querySelector('[data-memory-summary-custom-prompt]');
        const nextPromptMode = customToggle && customToggle.checked ? SUMMARY_PROMPT_MODE_CUSTOM : SUMMARY_PROMPT_MODE_BUILTIN;
        const nextCustomPrompt = String(customPromptInput && customPromptInput.value || '').trim();
        if (nextPromptMode === SUMMARY_PROMPT_MODE_CUSTOM && !nextCustomPrompt) {
            error.textContent = '启用自定义提示词前，请先填写提示词。';
            customPromptInput.focus();
            return;
        }
        if (nextCustomPrompt.length > MAX_SUMMARY_PROMPT_LENGTH) {
            error.textContent = '自定义提示词不能超过 ' + MAX_SUMMARY_PROMPT_LENGTH + ' 个字符。';
            customPromptInput.focus();
            return;
        }
        summaryIntervalMessages = normalizeSummaryInterval(rawValue);
        summaryPromptMode = nextPromptMode;
        customSummaryPrompt = nextCustomPrompt;
        const saved = await savePreferences();
        if (!saved) {
            error.textContent = '暂时无法保存，请稍后重试。';
            return;
        }
        closeSummarySettings();
    }

    async function saveManualMemory() {
        const input = root.querySelector('[data-memory-composer-input]');
        const error = root.querySelector('[data-memory-composer-error]');
        const content = input.value.trim();
        if (!content) {
            error.textContent = '先写下一条记忆。';
            input.focus();
            return;
        }
        if (content.length > 30000) {
            error.textContent = '单条记忆不能超过 30000 字。';
            input.focus();
            return;
        }
        const now = new Date().toISOString();
        const existingItem = editingMemoryId && cachedMemoryItems.find((item) => item.id === editingMemoryId && item.bindingId === selectedContactId);
        const item = {
            id: 'memory_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            schemaVersion: MEMORY_SCHEMA_VERSION,
            bindingId: selectedContactId,
            kind: existingItem ? existingItem.kind : (activeTab === 'archive' ? 'memory' : activeTab),
            tier: 'L1',
            status: 'active',
            authority: 'user_confirmed',
            visibility: 'current_binding',
            content,
            sourceRefs: [{ type: existingItem ? 'manual_edit' : 'manual', createdAt: now }],
            supersedes: existingItem ? existingItem.id : '',
            revision: 1,
            retrievalStats: { injectedCount: 0, lastInjectedAt: '', lastInjectedTurn: '', lastScore: 0, lastReasons: [] },
            createdAt: now,
            updatedAt: now
        };
        const nextItems = existingItem
            ? [...cachedMemoryItems.map((memory) => memory.id === existingItem.id ? {
                ...memory,
                status: 'superseded',
                archiveReason: 'superseded',
                supersededBy: item.id,
                updatedAt: now,
                revision: Math.max(1, Number(memory.revision) || 1) + 1
            } : memory), item]
            : [...cachedMemoryItems, item];
        const nextSummaries = existingItem
            ? cachedSummaries.map((summary) => summary.bindingId === selectedContactId && summary.status === 'active'
                ? { ...summary, status: 'dirty', updatedAt: now }
                : summary)
            : null;
        const saved = existingItem
            ? await writeMemoryState(nextItems, cachedOutbox, nextSummaries)
            : await writeRecord({ id: MEMORY_ITEMS_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items: nextItems });
        if (!saved) {
            error.textContent = '暂时无法保存，请稍后重试。';
            return;
        }
        cachedMemoryItems = nextItems;
        if (nextSummaries) cachedSummaries = nextSummaries;
        closeComposer();
        render();
        window.MemorySync?.schedule(selectedContactId);
    }

    async function archiveMemory(itemId) {
        const item = cachedMemoryItems.find((memory) => memory.id === itemId && memory.bindingId === selectedContactId && memory.status === 'active');
        if (!item) return false;
        const now = new Date().toISOString();
        const nextItems = cachedMemoryItems.map((memory) => memory.id === itemId ? {
            ...memory,
            status: 'archived',
            archiveReason: 'user_deleted',
            updatedAt: now,
            revision: Math.max(1, Number(memory.revision) || 1) + 1
        } : memory);
        const nextSummaries = cachedSummaries.map((summary) => summary.bindingId === selectedContactId && summary.status === 'active'
            ? { ...summary, status: 'dirty', updatedAt: now }
            : summary);
        const saved = await writeMemoryState(nextItems, cachedOutbox, nextSummaries);
        if (!saved) return false;
        cachedMemoryItems = nextItems;
        cachedSummaries = nextSummaries;
        render();
        window.MemorySync?.schedule(selectedContactId);
        return true;
    }

    async function restoreMemory(itemId) {
        const item = cachedMemoryItems.find((memory) => memory && memory.id === itemId && memory.bindingId === selectedContactId && memory.status === 'archived' && memory.archiveReason !== 'source_removed');
        if (!item) return false;
        const now = new Date().toISOString();
        const nextItems = cachedMemoryItems.map((memory) => memory.id === itemId ? {
            ...memory,
            status: 'active',
            archiveReason: '',
            updatedAt: now,
            revision: Math.max(1, Number(memory.revision) || 1) + 1
        } : memory);
        const saved = await writeRecord({ id: MEMORY_ITEMS_KEY, schemaVersion: MEMORY_SCHEMA_VERSION, items: nextItems });
        if (saved) {
            cachedMemoryItems = nextItems;
            render();
            window.MemorySync?.schedule(selectedContactId);
        }
        return saved;
    }

    function requestArchiveMemory(itemId) {
        const archive = async () => {
            const saved = await archiveMemory(itemId);
            if (!saved && typeof showToast === 'function') showToast('暂时无法删除，请稍后重试。');
        };
        if (typeof showCustomConfirm === 'function') {
            showCustomConfirm('删除记忆', '删除后不会再被角色引用。', '删除', true).then((confirmed) => {
                if (confirmed) void archive();
            });
        } else if (window.confirm('删除后不会再被角色引用，确定删除吗？')) {
            void archive();
        }
    }

    function render() {
        if (!root) return;
        if (getReferenceFrame()) {
            renderReferenceDocument();
            return;
        }
        const contact = cachedContacts.find((item) => item.id === selectedContactId) || null;
        const messages = contact ? getContactMessages(contact.id) : [];
        const name = contact && contact.name ? contact.name.trim() : '尚未选择角色';
        const memoryItems = contact ? getActiveItems(contact.id) : [];

        root.querySelector('[data-memory-name]').textContent = name;
        root.querySelector('[data-memory-status]').textContent = contact ? (memoryItems.length ? '共同记忆档案' : '等待第一条记忆') : '等待选择角色';
        root.querySelector('[data-memory-subtitle]').textContent = contact
            ? '记忆总数：' + memoryItems.length + ' 条'
            : '记忆总数：0 条';
        const memoryCount = root.querySelector('[data-memory-count]');
        if (memoryCount) memoryCount.textContent = String(memoryItems.length);
        root.querySelector('[data-memory-chat-count]').textContent = String(messages.length);
        root.querySelector('[data-memory-days]').textContent = String(getKnownDays(messages));
        root.querySelector('[data-memory-action="add"]').hidden = activeTab === 'archive';
        root.querySelectorAll('[data-memory-tab]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.memoryTab === activeTab);
            button.classList.toggle('active', button.dataset.memoryTab === activeTab);
            button.setAttribute('aria-selected', String(button.dataset.memoryTab === activeTab));
        });
        setAvatar(contact);
        renderMemoryContent(contact);
        renderRolePicker();
    }

    async function refresh() {
        const records = await readRecords([PREFERENCES_KEY, MEMORY_ITEMS_KEY, MEMORY_OUTBOX_KEY, MEMORY_SUMMARIES_KEY, CONTACTS_KEY, CHATS_KEY]);
        const contactsData = records[CONTACTS_KEY];
        cachedContacts = Array.isArray(contactsData && contactsData.contacts)
            ? contactsData.contacts.filter((contact) => contact && contact.id)
            : [];
        cachedConversations = records[CHATS_KEY] && records[CHATS_KEY].conversations && typeof records[CHATS_KEY].conversations === 'object'
            ? records[CHATS_KEY].conversations
            : {};
        cachedMemoryItems = Array.isArray(records[MEMORY_ITEMS_KEY] && records[MEMORY_ITEMS_KEY].items)
            ? records[MEMORY_ITEMS_KEY].items.map(hydrateMemoryItem).filter(Boolean)
            : [];
        cachedOutbox = Array.isArray(records[MEMORY_OUTBOX_KEY] && records[MEMORY_OUTBOX_KEY].items)
            ? records[MEMORY_OUTBOX_KEY].items.map(hydrateOutboxItem).filter(Boolean)
            : [];
        cachedSummaries = Array.isArray(records[MEMORY_SUMMARIES_KEY] && records[MEMORY_SUMMARIES_KEY].items)
            ? records[MEMORY_SUMMARIES_KEY].items.filter((item) => item && item.id && item.bindingId && Array.isArray(item.sections))
            : [];

        summaryIntervalMessages = readSummaryInterval(records[PREFERENCES_KEY]);
        ({ mode: summaryPromptMode, customPrompt: customSummaryPrompt } = readSummaryPromptPreferences(records[PREFERENCES_KEY]));

        const preferredId = records[PREFERENCES_KEY] && records[PREFERENCES_KEY].selectedContactId;
        if (cachedContacts.some((contact) => contact.id === selectedContactId)) {
            // Keep the current in-app selection while refreshing.
        } else if (cachedContacts.some((contact) => contact.id === preferredId)) {
            selectedContactId = preferredId;
        } else {
            selectedContactId = cachedContacts[0] ? cachedContacts[0].id : '';
        }
        render();
    }

    async function decodeReferenceDocument() {
        const binary = atob(REFERENCE_DOCUMENT_GZIP_BASE64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        if (!window.DecompressionStream) throw new Error('当前浏览器不支持参考界面解压');
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        return new Response(stream).text();
    }

    function getReferenceFrame() {
        return root && root.querySelector('[data-memory-reference-frame]');
    }

    function openMemoryPriorityDialog(item) {
        const overlay = document.getElementById('customDialogOverlay');
        const dialog = document.getElementById('customDialog');
        if (!overlay || !dialog) return;
        dialog.replaceChildren();
        const text = document.createElement('div');
        text.className = 'custom-dialog-text';
        const title = document.createElement('div');
        title.className = 'custom-dialog-title';
        title.textContent = '片段权重';
        const message = document.createElement('div');
        message.className = 'custom-dialog-message';
        message.textContent = '选择这条片段在对话中的召回优先级';
        text.append(title, message);
        const buttons = document.createElement('div');
        buttons.className = 'custom-dialog-btns';
        [[RETRIEVAL_PRIORITY.pinned, '置顶'], [RETRIEVAL_PRIORITY.normal, '普通'], [RETRIEVAL_PRIORITY.low, '降低']].forEach(([value, label]) => {
            const button = document.createElement('button');
            button.className = 'custom-dialog-btn' + (value === getRetrievalPriority(item) ? ' bold' : '');
            button.textContent = label;
            button.addEventListener('click', () => {
                overlay.classList.remove('show');
                void setMemoryRetrievalPriority(item.id, value);
            });
            buttons.appendChild(button);
        });
        dialog.append(text, buttons);
        overlay.classList.add('show');
    }

    function renderReferenceDocument() {
        const frame = getReferenceFrame();
        const documentRef = frame && frame.contentDocument;
        if (!documentRef || !documentRef.body) return;
        const contact = cachedContacts.find((item) => item.id === selectedContactId) || null;
        const messages = contact ? getContactMessages(contact.id) : [];
        const items = contact ? getActiveItems(contact.id, activeTab) : [];
        const summaryItems = contact && activeTab === 'relationship'
            ? (getActiveSummary(contact.id)?.sections || []).map((section) => ({
                tier: 'L2',
                content: section.content || '',
                createdAt: getActiveSummary(contact.id)?.updatedAt || ''
            }))
            : [];
        const query = memorySearchQuery.trim().toLocaleLowerCase();
        const displayItems = summaryItems.length ? summaryItems : items;
        const filteredItems = query ? displayItems.filter((item) => String(item.content || '').toLocaleLowerCase().includes(query)) : displayItems;
        documentRef.getElementById('mainProfileName').textContent = contact?.name || '尚未选择角色';
        documentRef.querySelector('.profile-stat-line1').textContent = '记忆总数：' + (contact ? getActiveItems(contact.id).length : 0) + ' 条';
        documentRef.querySelector('.profile-stat-line2').textContent = '共同对话：' + messages.length + ' 轮 | 认识天数：' + getKnownDays(messages) + ' 天';
        const avatar = documentRef.querySelector('.profile-avatar');
        avatar.style.backgroundImage = contact?.avatar ? 'url(' + JSON.stringify(contact.avatar) + ')' : '';
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
        const tabs = ['memory', 'relationship', 'fragment', 'archive'];
        documentRef.querySelectorAll('.segment-btn').forEach((button, index) => button.classList.toggle('active', tabs[index] === activeTab));
        const list = documentRef.querySelector('.memory-list');
        list.replaceChildren();
        filteredItems.forEach((item) => {
            const card = documentRef.createElement('div');
            card.className = 'memory-card';
            const header = documentRef.createElement('div');
            header.className = 'memory-card-header';
            const badge = documentRef.createElement('span');
            badge.className = 'badge ' + (item.tier === 'L2' ? 'summary' : 'manual');
            badge.textContent = item.tier === 'L2' ? 'L2 摘要 · 近况' : '手动记录';
            const date = documentRef.createElement('span');
            date.className = 'memory-date';
            date.textContent = formatMemoryDate(item.createdAt) || '刚刚';
            const text = documentRef.createElement('p');
            text.className = 'memory-text';
            text.textContent = item.content || '';
            header.append(badge, date);
            if (item.tier === 'L3') {
                const priority = documentRef.createElement('button');
                priority.type = 'button';
                priority.innerHTML = getRetrievalPriorityLabel(item) + '<svg style="width: 12px; height: 12px; margin-left: 2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
                priority.style.cssText = 'margin-left:auto;border:0;background:transparent;color:#007AFF;font:500 14px -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif; display: flex; align-items: center;';
                priority.addEventListener('click', (event) => {
                    event.stopPropagation();
                    openMemoryPriorityDialog(item);
                });
                header.appendChild(priority);
            }
            if (item.id && item.authority === 'user_confirmed') {
                const edit = documentRef.createElement('button');
                edit.type = 'button';
                edit.textContent = '编辑';
                edit.style.cssText = 'margin-left:12px;border:0;background:transparent;color:#007AFF;font:500 14px -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif';
                edit.addEventListener('click', (event) => {
                    event.stopPropagation();
                    openReferenceComposer(documentRef, item);
                });
                header.appendChild(edit);
            }
            card.append(header, text);
            list.appendChild(card);
        });
        if (!filteredItems.length) {
            const card = documentRef.createElement('div');
            card.className = 'memory-card';
            card.textContent = query ? '没有匹配的记忆' : getEmptyCopy()[0];
            list.appendChild(card);
        }
    }

    function openReferenceComposer(documentRef, item = null) {
        const contact = cachedContacts.find((item) => item.id === selectedContactId);
        if (!contact) {
            showReferenceRolePicker(documentRef);
            return;
        }
        const overlay = documentRef.createElement('div');
        overlay.className = 'switcher-overlay is-visible';
        const sheet = documentRef.createElement('div');
        sheet.className = 'modal-card';
        sheet.style.cssText = 'height:auto;min-height:220px;width:310px;display:block;padding:18px 16px;box-sizing:border-box';
        const title = documentRef.createElement('h3');
        title.className = 'modal-card-title';
        editingMemoryId = item && item.id ? item.id : '';
        title.textContent = editingMemoryId ? '编辑记忆' : '新增记忆';
        const input = documentRef.createElement('textarea');
        input.placeholder = '写下想让角色记住的事...';
        input.maxLength = 30000;
        input.value = item && item.content ? item.content : '';
        input.style.cssText = 'width:100%;height:110px;margin-top:14px;padding:10px;box-sizing:border-box;border:0;border-radius:10px;background:#f2f2f7;resize:none;font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;outline:0';
        const actions = documentRef.createElement('div');
        actions.style.cssText = 'display:flex;justify-content:flex-end;gap:18px;margin-top:14px';
        const cancel = documentRef.createElement('button');
        cancel.type = 'button';
        cancel.textContent = '取消';
        const save = documentRef.createElement('button');
        save.type = 'button';
        save.textContent = '保存';
        [cancel, save].forEach((button) => { button.style.cssText = 'border:0;background:transparent;color:#007AFF;font:500 15px -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif'; });
        cancel.addEventListener('click', () => overlay.remove());
        save.addEventListener('click', async () => {
            const hostInput = root.querySelector('[data-memory-composer-input]');
            const hostError = root.querySelector('[data-memory-composer-error]');
            hostInput.value = input.value;
            hostError.textContent = '';
            await saveManualMemory();
            if (!hostError.textContent) {
                overlay.remove();
            } else {
                input.setCustomValidity(hostError.textContent);
                input.reportValidity();
                input.setCustomValidity('');
            }
        });
        actions.append(cancel, save);
        sheet.append(title, input, actions);
        overlay.appendChild(sheet);
        overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
        documentRef.body.appendChild(overlay);
        requestAnimationFrame(() => input.focus());
    }

    function attachReferenceDocument(frame) {
        const documentRef = frame.contentDocument;
        const chromeOverride = documentRef.createElement('style');
        chromeOverride.textContent = 'html,body{width:100%;height:100%;background:#fff}body{display:block}.iphone-mockup{width:100%;height:100%;border-radius:0;box-shadow:none}.notch{display:none}.modal-card-avatar{background-size:cover;background-position:center;background-repeat:no-repeat}';
        documentRef.head.appendChild(chromeOverride);
        const tabs = ['memory', 'relationship', 'fragment', 'archive'];
        const exitButton = documentRef.querySelector('.btn-circle');
        exitButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            close();
        }, true);
        documentRef.querySelector('.btn-capsule').addEventListener('click', openSummarySettings);
        documentRef.querySelector('.avatar-switch-badge').addEventListener('click', () => void showReferenceRolePicker(documentRef), true);
        documentRef.querySelectorAll('.segment-btn').forEach((button, index) => button.addEventListener('click', () => {
            activeTab = tabs[index] || 'memory';
            renderReferenceDocument();
        }, true));
        documentRef.querySelector('.search-box input').addEventListener('input', (event) => {
            memorySearchQuery = event.target.value || '';
            renderReferenceDocument();
        });
        const actions = documentRef.querySelectorAll('.icon-action-btn');
        actions[0]?.addEventListener('click', openSummaryPanel, true);
        if (actions[1]) {
            actions[1].onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                void refresh().then(() => openReferenceComposer(documentRef));
            };
        }
        renderReferenceDocument();
    }

    async function showReferenceRolePicker(documentRef) {
        await refresh();
        const overlay = documentRef.getElementById('switcherOverlay');
        const list = overlay.querySelector('.modal-list-container');
        list.replaceChildren();
        if (!cachedContacts.length) {
            const emptyCard = documentRef.createElement('div');
            emptyCard.className = 'modal-card';
            emptyCard.style.cssText = 'height:auto;min-height:110px;display:block;padding:16px';
            const title = documentRef.createElement('h3');
            title.className = 'modal-card-title';
            title.textContent = '暂无可选角色';
            const copy = documentRef.createElement('p');
            copy.className = 'modal-card-subtitle';
            copy.textContent = '先在联系人中创建角色，再为其新增记忆。';
            const button = documentRef.createElement('button');
            button.type = 'button';
            button.textContent = '前往联系人';
            button.style.cssText = 'margin-top:12px;border:0;background:transparent;color:#007AFF;font:500 15px -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;padding:0';
            button.addEventListener('click', () => {
                overlay.classList.remove('is-visible');
                close();
                if (typeof window.openContactsApp === 'function') window.openContactsApp();
            });
            emptyCard.append(title, copy, button);
            list.appendChild(emptyCard);
            overlay.classList.add('is-visible');
            return;
        }
        cachedContacts.forEach((contact) => {
            const card = documentRef.createElement('button');
            card.type = 'button';
            card.className = 'modal-card';
            const avatar = documentRef.createElement('div');
            avatar.className = 'modal-card-avatar';
            if (contact.avatar) {
                avatar.style.backgroundImage = 'url(' + JSON.stringify(contact.avatar) + ')';
                avatar.style.backgroundSize = 'cover';
                avatar.style.backgroundPosition = 'center';
            }
            const info = documentRef.createElement('div');
            info.className = 'modal-card-info';
            const title = documentRef.createElement('h3');
            title.className = 'modal-card-title';
            title.textContent = contact.name || '未命名角色';
            const subtitle = documentRef.createElement('p');
            subtitle.className = 'modal-card-subtitle';
            subtitle.textContent = '共同记忆档案';
            info.append(title, subtitle);
            card.append(avatar, info);
            card.addEventListener('click', () => selectRole(contact.id));
            list.appendChild(card);
        });
        overlay.classList.add('is-visible');
    }

    function buildReferenceSummaryPanel() {
        const panel = document.createElement('section');
        panel.className = 'memory-summary-panel';
        panel.setAttribute('data-memory-summary-panel', '');
        panel.setAttribute('aria-hidden', 'true');
        panel.innerHTML = '<div class="memory-summary-panel-sheet" role="dialog" aria-modal="true" aria-labelledby="memorySummaryPanelTitle">'
            + '<div class="memory-composer-header"><button type="button" data-memory-action="close-summary-panel">完成</button><h2 id="memorySummaryPanelTitle">近期摘要</h2><button type="button" data-memory-action="refresh-summary">立即更新</button></div>'
            + '<div class="memory-summary-panel-scroll">'
            + '<p class="memory-summary-role" data-memory-summary-role></p>'
            + '<section class="memory-summary-current"><div class="memory-summary-section-header"><h3>当前摘要</h3><button type="button" data-memory-action="edit-summary">编辑</button></div><p class="memory-summary-text" data-memory-summary-text></p><textarea data-memory-summary-input maxlength="12000" aria-label="修改当前摘要"></textarea><div class="memory-summary-edit-actions"><button type="button" data-memory-action="cancel-summary-edit">取消</button><button type="button" data-memory-action="save-summary-edit">保存修正</button></div><p class="memory-summary-meta" data-memory-summary-meta></p></section>'
            + '<section class="memory-summary-progress-section"><div class="memory-summary-section-header"><h3>自动更新进度</h3><span data-memory-summary-progress-copy></span></div><progress data-memory-summary-progress max="200" value="0"></progress></section>'
            + '<section class="memory-summary-source-section"><div class="memory-summary-section-header"><h3>摘要依据</h3><div><span data-memory-summary-source-count>0 条</span><button type="button" data-memory-action="toggle-summary-sources">查看依据</button></div></div><div class="memory-summary-sources" data-memory-summary-sources hidden></div></section>'
            + '<p class="memory-summary-status" data-memory-summary-status aria-live="polite"></p>'
            + '</div></div>';
        root.appendChild(panel);
        panel.querySelector('[data-memory-action="close-summary-panel"]').addEventListener('click', closeSummaryPanel);
        panel.querySelector('[data-memory-action="refresh-summary"]').addEventListener('click', refreshSummaryNow);
        panel.querySelector('[data-memory-action="edit-summary"]').addEventListener('click', startSummaryEdit);
        panel.querySelector('[data-memory-action="cancel-summary-edit"]').addEventListener('click', cancelSummaryEdit);
        panel.querySelector('[data-memory-action="save-summary-edit"]').addEventListener('click', saveEditedSummary);
        panel.querySelector('[data-memory-action="toggle-summary-sources"]').addEventListener('click', toggleSummarySources);
        panel.addEventListener('click', (event) => { if (event.target === panel) closeSummaryPanel(); });
        panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSummaryPanel(); });
    }

    function buildReferenceSettings() {
        const settings = document.createElement('section');
        settings.className = 'memory-summary-settings';
        settings.setAttribute('data-memory-summary-settings', '');
        settings.setAttribute('aria-hidden', 'true');
        settings.innerHTML = '<div class="memory-summary-settings-sheet" role="dialog" aria-modal="true">'
            + '<div class="memory-composer-header"><button type="button" data-memory-action="close-summary-settings">取消</button><h2>记忆设置</h2><button type="button" data-memory-action="save-summary-settings">保存</button></div>'
            + '<p class="memory-settings-intro">让故事，不会忘记来时的路。</p>'
            + '<section class="memory-summary-control-card"><span class="memory-summary-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><polyline points="12 7 12 12 15 14"></polyline></svg></span><span class="memory-summary-card-copy"><strong>近期记忆摘要</strong><small>每累计多少条新消息，更新一次近期摘要</small></span><span class="memory-summary-stepper"><button type="button" data-memory-action="decrease-summary-interval" aria-label="减少条数">−</button><label><input type="number" inputmode="numeric" min="1" max="500" step="1" data-memory-summary-interval><small>条新消息</small></label><button type="button" data-memory-action="increase-summary-interval" aria-label="增加条数">＋</button></span></section><h3 class="memory-source-group-title">记忆来源</h3>'
            + '<section class="memory-settings-section"><h3>向量模型</h3><p class="memory-semantic-settings-copy">下载到本机后，聊天内容不会上传。</p><label class="memory-semantic-settings-input"><span>自定义清单</span><input type="url" data-semantic-model-url placeholder="可选：manifest 地址"></label><button class="memory-model-download" type="button" data-memory-action="download-semantic-model">下载向量模型</button><progress class="memory-semantic-model-progress" data-semantic-model-progress max="1" value="0" hidden></progress><p class="memory-semantic-model-status" data-semantic-model-status>模型未下载</p><button class="memory-semantic-remove" type="button" data-memory-action="remove-semantic-model" hidden>删除本地模型</button></section>'
            + '<section class="memory-settings-section memory-external-section"><h3>外接记忆库</h3><p class="memory-semantic-settings-copy">本地 IndexedDB 是主数据源；数据只会以明文上传到你配置的用户云端，凭据仅保存在本机。</p><div class="memory-external-fields"><label class="memory-semantic-settings-input memory-sync-provider-field"><span>服务</span><button type="button" class="memory-sync-provider-button" data-memory-action="choose-memory-sync-provider" aria-haspopup="dialog"><span data-memory-sync-provider-label>通用 HTTP / Cloudflare Worker</span><span class="memory-sync-chevron" aria-hidden="true">›</span></button><input type="hidden" data-memory-sync-provider value="http"></label><label class="memory-semantic-settings-input"><span>地址</span><input type="url" data-memory-sync-url placeholder="用户自己的服务地址；Mem0/Zep 可留空"></label><label class="memory-semantic-settings-input"><span>API Key</span><input type="password" data-memory-sync-key autocomplete="off"></label><label class="memory-semantic-settings-input"><span>访问令牌</span><input type="password" data-memory-sync-token autocomplete="off" placeholder="Supabase/HTTP 可选"></label><label class="memory-semantic-settings-input"><span>Supabase 表</span><input type="text" data-memory-sync-table placeholder="tonghuaji_memories"></label><label class="memory-semantic-settings-input"><span>命名空间</span><input type="text" data-memory-sync-namespace placeholder="用于隔离角色数据"></label></div><label class="memory-sync-toggle-row is-on"><span><strong>自动同步</strong><small>后台静默执行</small></span><input type="checkbox" data-memory-sync-auto checked><span class="memory-sync-switch" aria-hidden="true"></span></label><fieldset class="memory-sync-scope"><legend>上传范围</legend><label><input type="checkbox" data-memory-sync-tier="L1"> L1 确认记忆</label><label><input type="checkbox" data-memory-sync-tier="L2"> L2 摘要</label><label><input type="checkbox" data-memory-sync-tier="L3"> L3 片段</label><label><input type="checkbox" data-memory-sync-chat> 聊天记录</label><label><input type="checkbox" data-memory-sync-archived> 包含归档</label><label><input type="radio" name="memory-sync-roles" value="current" checked> 当前角色</label><label><input type="radio" name="memory-sync-roles" value="all"> 全部角色</label></fieldset><div class="memory-sync-actions"><button type="button" data-memory-action="test-memory-sync">测试连接</button><button type="button" data-memory-action="save-memory-sync">保存同步设置</button><button type="button" data-memory-action="sync-memory-now">立即同步</button><button type="button" data-memory-action="restore-memory-sync">下载恢复</button><a href="cloud-memory/README.md" target="_blank" rel="noopener">部署说明</a></div><p class="memory-composer-error" data-memory-sync-status aria-live="polite"></p></section><p class="memory-composer-error" data-memory-summary-error aria-live="polite"></p></div>';
            + '<section class="memory-settings-section memory-external-section"><h3>外接记忆库</h3><p class="memory-semantic-settings-copy">本地 IndexedDB 是主数据源；数据只会以明文上传到你配置的用户云端，凭据仅保存在本机。</p><div class="memory-external-fields"><label class="memory-semantic-settings-input memory-sync-provider-field"><span>服务</span><button type="button" class="memory-sync-provider-button" data-memory-action="choose-memory-sync-provider" aria-haspopup="dialog"><span data-memory-sync-provider-label>通用 HTTP / Cloudflare Worker</span><span class="memory-sync-chevron" aria-hidden="true">›</span></button><input type="hidden" data-memory-sync-provider value="http"></label><label class="memory-semantic-settings-input"><span>地址</span><input type="url" data-memory-sync-url placeholder="用户自己的服务地址；Mem0/Zep 可留空"></label><label class="memory-semantic-settings-input"><span>API Key</span><input type="password" data-memory-sync-key autocomplete="off"></label><label class="memory-semantic-settings-input"><span>访问令牌</span><input type="password" data-memory-sync-token autocomplete="off" placeholder="Supabase/HTTP 可选"></label><label class="memory-semantic-settings-input"><span>Supabase 表</span><input type="text" data-memory-sync-table placeholder="tonghuaji_memories"></label><label class="memory-semantic-settings-input"><span>命名空间</span><input type="text" data-memory-sync-namespace placeholder="用于隔离角色数据"></label></div><label class="memory-sync-toggle-row is-on"><span><strong>自动同步</strong><small>后台静默执行</small></span><input type="checkbox" data-memory-sync-auto checked><span class="memory-sync-switch" aria-hidden="true"></span></label><fieldset class="memory-sync-scope"><legend>上传范围</legend><label><input type="checkbox" data-memory-sync-tier="L1"> L1 确认记忆</label><label><input type="checkbox" data-memory-sync-tier="L2"> L2 摘要</label><label><input type="checkbox" data-memory-sync-tier="L3"> L3 片段</label><label><input type="checkbox" data-memory-sync-chat> 聊天记录</label><label><input type="checkbox" data-memory-sync-archived> 包含归档</label><label><input type="radio" name="memory-sync-roles" value="current" checked> 当前角色</label><label><input type="radio" name="memory-sync-roles" value="all"> 全部角色</label></fieldset><div class="memory-sync-actions"><button type="button" data-memory-action="test-memory-sync">测试连接</button><button type="button" data-memory-action="save-memory-sync">保存同步设置</button><button type="button" data-memory-action="sync-memory-now">立即同步</button><button type="button" data-memory-action="restore-memory-sync">下载恢复</button><a href="cloud-memory/README.md" target="_blank" rel="noopener">部署说明</a></div><p class="memory-composer-error" data-memory-sync-status aria-live="polite"></p></section><div class="memory-settings-privacy"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>你的记忆数据仅存储在你自己的设备或服务中</div><p class="memory-composer-error" data-memory-summary-error aria-live="polite"></p></div>';
        const localSection = settings.querySelector('.memory-settings-section:not(.memory-external-section)');
        const externalSection = settings.querySelector('.memory-external-section');
        const summaryPromptSection = document.createElement('section');
        summaryPromptSection.className = 'memory-settings-section memory-summary-prompt-section';
        summaryPromptSection.innerHTML = '<h3>摘要提示词</h3><p class="memory-semantic-settings-copy">内置提示词默认启用且不会显示。开启后使用你填写的自定义提示词。</p><label class="memory-sync-toggle-row"><span><strong>使用自定义提示词</strong><small>关闭时使用内置日记提示词</small></span><input type="checkbox" data-memory-summary-prompt-custom><span class="memory-sync-switch" aria-hidden="true"></span></label><label class="memory-summary-custom-prompt" data-memory-summary-custom-prompt-section hidden><span>自定义提示词</span><textarea data-memory-summary-custom-prompt maxlength="12000" placeholder="输入用于生成摘要的自定义提示词"></textarea></label>';
        localSection.parentNode.insertBefore(summaryPromptSection, localSection);
        makeMemorySettingsCollapsible(summaryPromptSection, '摘要提示词', '选择内置提示词或填写自定义内容', '<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"></path><path d="M8 9h8M8 13h5"></path></svg>', '内置');
        makeMemorySettingsCollapsible(localSection, '本地向量模型', '用于快速检索本地记忆', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"></circle><path d="M12 5v14M5 12h14"></path></svg>');
        const remoteSection = buildRemoteVectorSection(settings);
        externalSection.parentNode.insertBefore(remoteSection, externalSection);
        makeMemorySettingsCollapsible(remoteSection, '其他向量模型', '连接第三方向量服务', '<svg viewBox="0 0 24 24"><circle cx="7" cy="12" r="2"></circle><circle cx="17" cy="7" r="2"></circle><circle cx="17" cy="17" r="2"></circle><path d="m9 11 6-3M9 13l6 3"></path></svg>');
        makeMemorySettingsCollapsible(externalSection, '外接记忆库', '连接自己的记忆服务器', '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="5" rx="1"></rect><rect x="4" y="14" width="16" height="5" rx="1"></rect><path d="M8 7.5h.01M8 16.5h.01"></path></svg>', '未连接');
        root.appendChild(settings);
        settings.querySelector('[data-memory-action="close-summary-settings"]').addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            closeSummarySettings();
        });
        settings.addEventListener('click', (event) => { if (event.target === settings) closeSummarySettings(); });
        settings.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSummarySettings(); });
        settings.querySelector('[data-memory-action="save-summary-settings"]').addEventListener('click', saveSummarySettings);
        settings.querySelector('[data-memory-action="decrease-summary-interval"]').addEventListener('click', () => adjustSummaryInterval(-1));
        settings.querySelector('[data-memory-action="increase-summary-interval"]').addEventListener('click', () => adjustSummaryInterval(1));
        settings.querySelector('[data-memory-summary-prompt-custom]').addEventListener('change', (event) => {
            const enabled = event.currentTarget.checked;
            event.currentTarget.closest('.memory-sync-toggle-row')?.classList.toggle('is-on', enabled);
            settings.querySelector('[data-memory-summary-custom-prompt-section]').hidden = !enabled;
        });
        settings.querySelector('[data-memory-action="download-semantic-model"]').addEventListener('click', downloadSemanticModel);
        settings.querySelector('[data-memory-action="remove-semantic-model"]').addEventListener('click', removeSemanticModel);
        settings.querySelector('[data-memory-action="test-memory-sync"]').addEventListener('click', testMemorySync);
        settings.querySelector('[data-memory-action="save-memory-sync"]').addEventListener('click', saveMemorySyncSettings);
        settings.querySelector('[data-memory-action="sync-memory-now"]').addEventListener('click', syncMemoryNow);
        settings.querySelector('[data-memory-action="restore-memory-sync"]').addEventListener('click', restoreMemorySync);
        settings.querySelector('[data-memory-action="pull-memory-remote-model"]').addEventListener('click', pullRemoteVectorModels);
        settings.querySelector('[data-memory-action="save-memory-remote-model"]').addEventListener('click', saveRemoteVectorSettings);
        settings.querySelector('[data-memory-action="choose-memory-remote-model"]').addEventListener('click', openRemoteVectorModelDialog);
        settings.querySelector('[data-memory-action="choose-memory-sync-provider"]').addEventListener('click', openMemorySyncProviderDialog);
        settings.querySelector('[data-memory-sync-auto]').addEventListener('change', (event) => event.currentTarget.closest('.memory-sync-toggle-row').classList.toggle('is-on', event.currentTarget.checked));
        const providerDialog = document.createElement('section');
        providerDialog.className = 'memory-choice-dialog';
        providerDialog.setAttribute('data-memory-sync-provider-dialog', '');
        providerDialog.setAttribute('aria-hidden', 'true');
        providerDialog.innerHTML = '<div class="memory-choice-backdrop" data-memory-action="close-memory-sync-provider"></div><div class="memory-choice-sheet" role="dialog" aria-modal="true" aria-labelledby="memorySyncProviderTitle"><div class="memory-composer-header"><button type="button" data-memory-action="close-memory-sync-provider">取消</button><h2 id="memorySyncProviderTitle">选择服务</h2><span></span></div><div class="memory-choice-list">' + [['http', '通用 HTTP / Cloudflare Worker'], ['mem0', 'Mem0 Platform'], ['zep', 'Zep'], ['supabase', 'Supabase']].map(([value, label]) => '<button type="button" class="memory-choice-option" data-memory-sync-provider-option="' + value + '" data-label="' + label + '" aria-checked="false"><span>' + label + '</span><span class="memory-choice-check" aria-hidden="true">✓</span></button>').join('') + '</div></div>';
        settings.appendChild(providerDialog);
        providerDialog.querySelectorAll('[data-memory-action="close-memory-sync-provider"]').forEach((button) => button.addEventListener('click', closeMemorySyncProviderDialog));
        providerDialog.querySelectorAll('[data-memory-sync-provider-option]').forEach((button) => button.addEventListener('click', () => selectMemorySyncProvider(button.dataset.memorySyncProviderOption)));
        const remoteModelDialog = document.createElement('section');
        remoteModelDialog.className = 'memory-choice-dialog';
        remoteModelDialog.setAttribute('data-memory-remote-model-dialog', '');
        remoteModelDialog.setAttribute('aria-hidden', 'true');
        remoteModelDialog.innerHTML = '<div class="memory-choice-backdrop" data-memory-action="close-memory-remote-model"></div><div class="memory-choice-sheet" role="dialog" aria-modal="true" aria-labelledby="memoryRemoteModelTitle"><div class="memory-composer-header"><button type="button" data-memory-action="close-memory-remote-model">取消</button><h2 id="memoryRemoteModelTitle">选择模型</h2><span></span></div><div class="memory-choice-list"></div></div>';
        settings.appendChild(remoteModelDialog);
        remoteModelDialog.querySelectorAll('[data-memory-action="close-memory-remote-model"]').forEach((button) => button.addEventListener('click', () => { remoteModelDialog.classList.remove('is-visible'); remoteModelDialog.setAttribute('aria-hidden', 'true'); }));
        void loadMemorySyncSettings();
        void loadRemoteVectorSettings();
    }

    async function loadMemorySyncSettings() {
        const config = await window.MemorySync?.init?.().then(() => window.MemorySync.getSettings()).catch(() => null);
        if (!config || !root) return;
        const section = root.querySelector('.memory-external-section'); if (!section) return;
        const provider = config.provider || 'http';
        section.querySelector('[data-memory-sync-provider]').value = provider;
        const providerOption = root.querySelector('[data-memory-sync-provider-option="' + provider + '"]');
        if (providerOption) selectMemorySyncProvider(provider);
        section.querySelector('[data-memory-sync-url]').value = config.baseUrl || '';
        section.querySelector('[data-memory-sync-namespace]').value = config.namespace || '';
        (config.scope?.tiers || ['L1']).forEach((tier) => { const input = section.querySelector('[data-memory-sync-tier="' + tier + '"]'); if (input) input.checked = true; });
        section.querySelector('[data-memory-sync-chat]').checked = config.scope?.includeChat === true;
        section.querySelector('[data-memory-sync-archived]').checked = config.scope?.includeArchived === true;
        section.querySelector('[data-memory-sync-auto]').checked = config.autoSync !== false;
        section.querySelector('.memory-sync-toggle-row').classList.toggle('is-on', config.autoSync !== false);
        const role = section.querySelector('[name="memory-sync-roles"][value="' + (config.scope?.roles || 'current') + '"]'); if (role) role.checked = true;
        const syncState = window.MemorySync.getStatus();
        section.querySelector('[data-memory-sync-status]').textContent = syncState.error ? ('上次同步失败：' + syncState.error) : syncState.lastSyncAt ? ('上次同步：' + new Date(syncState.lastSyncAt).toLocaleString() + (syncState.conflicts ? '，本地优先合并 ' + syncState.conflicts + ' 个冲突' : '')) : '';
        const sourceStatus = section.querySelector('[data-memory-section-status]');
        if (sourceStatus) sourceStatus.textContent = config.enabled ? '已连接' : '未连接';
    }
    function memorySyncConfigFromUi() { const section = root.querySelector('.memory-external-section'); const provider = section.querySelector('[data-memory-sync-provider]').value; const enteredUrl = section.querySelector('[data-memory-sync-url]').value.trim(); const baseUrl = enteredUrl || (provider === 'mem0' ? 'https://api.mem0.ai' : provider === 'zep' ? 'https://api.getzep.com/api/v2' : ''); return { enabled: Boolean(baseUrl), autoSync: section.querySelector('[data-memory-sync-auto]').checked, provider, baseUrl, namespace: section.querySelector('[data-memory-sync-namespace]').value.trim(), scope: { roles: section.querySelector('[name="memory-sync-roles"]:checked')?.value || 'current', tiers: Array.from(section.querySelectorAll('[data-memory-sync-tier]:checked')).map((input) => input.getAttribute('data-memory-sync-tier')), includeChat: section.querySelector('[data-memory-sync-chat]').checked, includeArchived: section.querySelector('[data-memory-sync-archived]').checked } }; }
    async function saveMemorySyncSettings() { const section = root.querySelector('.memory-external-section'); const status = section.querySelector('[data-memory-sync-status]'); const apiKey = section.querySelector('[data-memory-sync-key]').value.trim(); const token = section.querySelector('[data-memory-sync-token]').value.trim(); const table = section.querySelector('[data-memory-sync-table]').value.trim(); await window.MemorySync.saveConfig(memorySyncConfigFromUi(), { ...(apiKey ? { apiKey } : {}), ...(token ? { token } : {}), ...(table ? { table } : {}) }); status.textContent = '同步设置已保存。'; }
    async function testMemorySync() { const section = root.querySelector('.memory-external-section'); const status = section.querySelector('[data-memory-sync-status]'); try { await saveMemorySyncSettings(); await window.MemorySync.testConnection(); status.textContent = '连接成功。'; } catch (error) { status.textContent = '连接失败：' + String(error.message || error); } }
    async function syncMemoryNow() { const status = root.querySelector('[data-memory-sync-status]'); try { const result = await window.MemorySync.syncNow(selectedContactId); status.textContent = '同步完成：上传 ' + (result.uploaded || 0) + ' 条，恢复 ' + (result.restored || 0) + ' 条' + (result.conflicts ? '，本地优先合并 ' + result.conflicts + ' 个冲突' : '') + '。'; await preload(); render(); } catch (error) { status.textContent = '同步失败：' + String(error.message || error); } }
    async function restoreMemorySync() { const status = root.querySelector('[data-memory-sync-status]'); try { const result = await window.MemorySync.restoreNow(selectedContactId); status.textContent = '下载恢复完成：恢复 ' + (result.restored || 0) + ' 条。'; await preload(); render(); } catch (error) { status.textContent = '恢复失败：' + String(error.message || error); } }

    function buildReferenceComposer() {
        const composer = document.createElement('section');
        composer.className = 'memory-composer';
        composer.style.zIndex = '7202';
        composer.setAttribute('data-memory-composer', '');
        composer.setAttribute('aria-hidden', 'true');
        composer.innerHTML = '<div class="memory-composer-sheet" role="dialog" aria-modal="true">'
            + '<div class="memory-composer-header"><button type="button" data-memory-action="close-composer">取消</button><h2 data-memory-composer-title>新增记忆</h2><button type="button" data-memory-action="save-memory">保存</button></div>'
            + '<p class="memory-composer-role">写入 <span data-memory-composer-role></span> 的独立档案</p>'
            + '<textarea data-memory-composer-input maxlength="30000" placeholder="写下想让角色记住的事..."></textarea><p class="memory-composer-error" data-memory-composer-error aria-live="polite"></p></div>';
        root.appendChild(composer);
        composer.querySelector('[data-memory-action="close-composer"]').addEventListener('click', closeComposer);
        composer.querySelector('[data-memory-action="save-memory"]').addEventListener('click', saveManualMemory);
    }

    function buildRoot() {
        root = document.createElement('section');
        root.id = 'memoryAppUI';
        root.className = 'memory-app-container';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = '<iframe data-memory-reference-frame title="记忆库" style="width:100%;height:100%;border:0;display:block"></iframe>';
        const referenceFrame = getReferenceFrame();
        const referenceHost = document.querySelector('.iphone') || document.body;
        referenceHost.appendChild(root);
        buildReferenceSummaryPanel();
        buildReferenceSettings();
        buildReferenceComposer();
        window.addEventListener('semanticmemory:status', (event) => renderSemanticModelState(event.detail));
        decodeReferenceDocument().then((documentText) => {
            referenceFrame.addEventListener('load', () => attachReferenceDocument(referenceFrame), { once: true });
            referenceFrame.srcdoc = documentText;
        }).catch(() => { referenceFrame.srcdoc = '<!doctype html><p>记忆库界面加载失败</p>'; });
        return;
        root.innerHTML = `
            <div class="memory-app-scroll">
                <header class="memory-profile-header">
                    <button class="memory-back" type="button" data-memory-action="close" aria-label="返回桌面">‹</button>
                    <div class="memory-header-actions">
                        <button class="memory-switch-role" type="button" data-memory-action="switch-role">切换</button>
                        <button class="memory-summary-settings-button" type="button" data-memory-action="summary-settings" aria-label="摘要更新频率" title="摘要更新频率">•••</button>
                        <button class="memory-summary-settings-button" type="button" data-memory-action="semantic-settings" aria-label="语义模型" title="语义模型">◇</button>
                        <button class="memory-add" type="button" data-memory-action="add" aria-label="新增记忆" title="新增记忆">+</button>
                    </div>
                </header>
                <main class="memory-profile-main">
                    <div class="memory-avatar-shell">
                        <div class="memory-avatar" data-memory-avatar><img data-memory-avatar-image alt=""><span data-memory-monogram>记</span></div>
                    </div>
                    <div class="memory-heading">
                        <div class="memory-name-line"><h1 data-memory-name>记忆</h1><span data-memory-status>读取中</span></div>
                        <p data-memory-subtitle>正在读取本地档案。</p>
                    </div>
                    <section class="memory-stats" aria-label="记忆统计">
                        <article><b data-memory-count>0</b><span>记忆总条数</span></article>
                        <article><b data-memory-chat-count>0</b><span>共同对话</span></article>
                        <article><b data-memory-days>0</b><span>认识天数</span></article>
                    </section>
                    <section class="memory-content-card">
                        <div class="memory-card-kicker" data-memory-card-title>@ 记忆</div>
                        <div data-memory-content></div>
                    </section>
                </main>
                <nav class="memory-tabs" role="tablist" aria-label="记忆视图">
                    <button type="button" data-memory-tab="memory" class="is-active" role="tab" aria-selected="true">记忆</button>
                    <button type="button" data-memory-tab="relationship" role="tab" aria-selected="false">关系</button>
                    <button type="button" data-memory-tab="fragment" role="tab" aria-selected="false">片段</button>
                    <button type="button" data-memory-tab="archive" role="tab" aria-selected="false">档案</button>
                </nav>
            </div>`;

        // Reference layout replaces the legacy centered profile before overlays are attached.
        root.innerHTML = `
            <div class="memory-app-scroll scroll-content">
                <header class="memory-profile-header top-actions">
                    <button class="memory-back btn-circle" type="button" data-memory-action="close" aria-label="\u8fd4\u56de\u684c\u9762">\u2039</button>
                    <button class="memory-settings-button btn-capsule" type="button" data-memory-action="summary-settings">\u8bbe\u7f6e</button>
                </header>
                <main class="memory-profile-main">
                    <section class="memory-profile-section profile-section">
                        <div class="memory-avatar-shell profile-avatar-wrapper">
                            <div class="memory-avatar profile-avatar" data-memory-avatar><img data-memory-avatar-image alt=""><span data-memory-monogram>\u8bb0</span></div>
                            <button class="memory-avatar-switch" type="button" data-memory-action="switch-role" aria-label="\u5207\u6362\u89d2\u8272">\u21c4</button>
                        </div>
                        <div class="memory-heading profile-info">
                            <div class="memory-name-line"><h1 class="profile-name" data-memory-name>\u8bb0\u5fc6</h1></div>
                            <p class="profile-stat-line1" data-memory-subtitle>\u8bb0\u5fc6\u603b\u6570\uff1a0 \u6761</p>
                            <p class="memory-profile-stat profile-stat-line2"><span>\u5171\u540c\u5bf9\u8bdd\uff1a<b data-memory-chat-count>0</b> \u8f6e</span><i></i><span>\u8ba4\u8bc6\u5929\u6570\uff1a<b data-memory-days>0</b> \u5929</span></p>
                            <span class="memory-profile-status" data-memory-status>\u8bfb\u53d6\u4e2d</span>
                        </div>
                    </section>
                    <nav class="memory-tabs segmented-control" role="tablist" aria-label="\u8bb0\u5fc6\u89c6\u56fe">
                        <button type="button" data-memory-tab="memory" class="is-active active segment-btn" role="tab" aria-selected="true">\u8bb0\u5fc6</button>
                        <button type="button" data-memory-tab="relationship" class="segment-btn" role="tab" aria-selected="false">\u5173\u7cfb</button>
                        <button type="button" data-memory-tab="fragment" class="segment-btn" role="tab" aria-selected="false">\u7247\u6bb5</button>
                        <button type="button" data-memory-tab="archive" class="segment-btn" role="tab" aria-selected="false">\u6863\u6848</button>
                    </nav>
                    <div class="ios-search-bar"><label class="memory-search search-box"><span aria-hidden="true">\u2315</span><input type="search" data-memory-search placeholder="\u641c\u7d22\u8bb0\u5fc6..."></label></div>
                    <div class="memory-list-header ios-list-header"><h2 class="ios-list-title" data-memory-card-title>\u8fd1\u671f\u8bb0\u5fc6</h2><div class="ios-list-actions"><button class="icon-action-btn" type="button" data-memory-action="summary-settings">\u6458\u8981</button><button class="icon-action-btn" type="button" data-memory-action="add">\uff0b \u65b0\u589e</button></div></div>
                    <section class="memory-content-card"><div data-memory-content></div></section>
                </main>
            </div>`;

        const rolePicker = document.createElement('section');
        rolePicker.className = 'memory-role-picker';
        rolePicker.setAttribute('data-memory-role-picker', '');
        rolePicker.setAttribute('aria-hidden', 'true');
        rolePicker.innerHTML = `
            <header class="memory-picker-header">
                <button class="memory-back" type="button" data-memory-action="close" aria-label="返回桌面">‹</button>
                <span>选择角色</span>
            </header>
            <div class="memory-picker-intro"><h1>进入谁的记忆</h1><p>每位角色拥有独立的记忆档案。</p></div>
            <div class="memory-role-list" data-memory-role-list></div>
            <div class="memory-role-empty" data-memory-role-empty hidden><h2>还没有可选角色</h2><p>先在联系人中创建角色，再回来建立记忆。</p><button type="button" data-memory-action="open-contacts">前往联系人</button></div>`;
        root.appendChild(rolePicker);

        const composer = document.createElement('section');
        composer.className = 'memory-composer';
        composer.setAttribute('data-memory-composer', '');
        composer.setAttribute('aria-hidden', 'true');
        composer.innerHTML = `
            <div class="memory-composer-sheet" role="dialog" aria-modal="true" aria-labelledby="memoryComposerTitle">
                <div class="memory-composer-header"><button type="button" data-memory-action="close-composer">取消</button><h2 id="memoryComposerTitle" data-memory-composer-title>新增记忆</h2><button type="button" data-memory-action="save-memory">保存</button></div>
                <p class="memory-composer-role">写入 <span data-memory-composer-role></span> 的独立档案</p>
                <textarea data-memory-composer-input maxlength="30000" placeholder="写下想让角色记住的事…"></textarea>
                <p class="memory-composer-error" data-memory-composer-error aria-live="polite"></p>
            </div>`;
        root.appendChild(composer);

        const summarySettings = document.createElement('section');
        summarySettings.className = 'memory-summary-settings';
        summarySettings.setAttribute('data-memory-summary-settings', '');
        summarySettings.setAttribute('aria-hidden', 'true');
        summarySettings.innerHTML = `
            <div class="memory-summary-settings-sheet" role="dialog" aria-modal="true" aria-labelledby="memorySummarySettingsTitle">
                <div class="memory-composer-header"><button type="button" data-memory-action="close-summary-settings">取消</button><h2 id="memorySummarySettingsTitle">摘要更新</h2><button type="button" data-memory-action="save-summary-settings">保存</button></div>
                <p class="memory-summary-settings-copy">每累计多少条新消息，更新一次近期摘要</p>
                <label class="memory-summary-settings-input"><input type="number" inputmode="numeric" min="1" max="500" step="1" data-memory-summary-interval><span>条新消息</span></label>
                <p class="memory-summary-settings-note">可设置 1–500 条。摘要在后台更新，不影响聊天发送。</p>
                <p class="memory-composer-error" data-memory-summary-error aria-live="polite"></p>
            </div>`;
        root.appendChild(summarySettings);
        summarySettings.querySelector('.memory-summary-settings-sheet').insertAdjacentHTML('beforeend', `
            <section class="memory-settings-section">
                <h3>\u5411\u91cf\u6a21\u578b</h3>
                <p class="memory-semantic-settings-copy">\u4e0b\u8f7d\u5230\u672c\u673a\u540e\uff0c\u804a\u5929\u5185\u5bb9\u4e0d\u4f1a\u4e0a\u4f20\u3002</p>
                <label class="memory-semantic-settings-input"><span>\u81ea\u5b9a\u4e49\u6e05\u5355</span><input type="url" data-semantic-model-url placeholder="\u53ef\u9009\uff1amanifest \u5730\u5740"></label>
                <button class="memory-model-download" type="button" data-memory-action="download-semantic-model">\u4e0b\u8f7d\u5411\u91cf\u6a21\u578b</button>
                <progress class="memory-semantic-model-progress" data-semantic-model-progress max="1" value="0" hidden></progress>
                <p class="memory-semantic-model-status" data-semantic-model-status>\u6a21\u578b\u672a\u4e0b\u8f7d</p>
                <button class="memory-semantic-remove" type="button" data-memory-action="remove-semantic-model" hidden>\u5220\u9664\u672c\u5730\u6a21\u578b</button>
            </section>`);

        const semanticSettings = document.createElement('section');
        semanticSettings.className = 'memory-semantic-settings';
        semanticSettings.setAttribute('data-memory-semantic-settings', '');
        semanticSettings.setAttribute('aria-hidden', 'true');
        semanticSettings.innerHTML = '<div class="memory-semantic-settings-sheet" role="dialog" aria-modal="true" aria-labelledby="memorySemanticSettingsTitle">'
            + '<div class="memory-composer-header"><button type="button" data-memory-action="close-semantic-settings">取消</button><h2 id="memorySemanticSettingsTitle">语义模型</h2><button type="button" data-memory-action="download-semantic-model">下载</button></div>'
            + '<p class="memory-semantic-settings-copy">默认从 Hugging Face 直连下载中文模型到本机；聊天内容不会上传。</p>'
            + '<label class="memory-semantic-settings-input"><span>自定义清单</span><input type="url" data-semantic-model-url placeholder="可选：粘贴自定义 manifest 地址"></label>'
            + '<progress class="memory-semantic-model-progress" data-semantic-model-progress max="1" value="0" hidden></progress>'
            + '<p class="memory-semantic-model-status" data-semantic-model-status>未配置模型</p>'
            + '<button class="memory-semantic-remove" type="button" data-memory-action="remove-semantic-model" hidden>删除本地模型</button>'
            + '<p class="memory-summary-settings-note">直接点下载即可获取 BGE Small 中文模型。填写自定义清单时才使用其他模型来源；未下载时继续使用当前轻量本地向量。</p>'
            + '</div>';
        root.appendChild(semanticSettings);

        root.querySelectorAll('[data-memory-action="close"]').forEach((button) => button.addEventListener('click', close));
        root.querySelector('[data-memory-action="switch-role"]').addEventListener('click', showRolePicker);
        root.querySelectorAll('[data-memory-action="summary-settings"]').forEach((button) => button.addEventListener('click', openSummarySettings));
        root.querySelector('[data-memory-action="add"]').addEventListener('click', openComposer);
        root.querySelector('[data-memory-action="close-composer"]').addEventListener('click', closeComposer);
        root.querySelector('[data-memory-action="save-memory"]').addEventListener('click', saveManualMemory);
        root.querySelector('[data-memory-action="close-summary-settings"]').addEventListener('click', closeSummarySettings);
        root.querySelector('[data-memory-action="save-summary-settings"]').addEventListener('click', saveSummarySettings);
        root.querySelector('[data-memory-action="close-semantic-settings"]').addEventListener('click', closeSemanticSettings);
        root.querySelector('[data-memory-action="download-semantic-model"]').addEventListener('click', downloadSemanticModel);
        root.querySelector('[data-memory-action="remove-semantic-model"]').addEventListener('click', removeSemanticModel);
        root.querySelector('[data-memory-search]').addEventListener('input', (event) => {
            memorySearchQuery = event.target.value || '';
            renderMemoryContent(cachedContacts.find((item) => item.id === selectedContactId) || null);
        });
        root.querySelector('[data-memory-action="open-contacts"]').addEventListener('click', () => {
            close();
            if (typeof window.openContactsApp === 'function') window.openContactsApp();
        });
        root.querySelectorAll('[data-memory-tab]').forEach((button) => {
            button.addEventListener('click', () => {
                activeTab = button.dataset.memoryTab || 'memory';
                render();
            });
        });
        root.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (root.classList.contains('is-composing')) closeComposer();
            else if (root.classList.contains('is-configuring-summary')) closeSummarySettings();
            else if (root.classList.contains('is-configuring-semantic')) closeSemanticSettings();
            else close();
        });
        window.addEventListener('semanticmemory:status', (event) => renderSemanticModelState(event.detail));
        const host = document.querySelector('.iphone') || document.body;
        host.appendChild(root);
    }

    function ensureStyles() {
        if (document.getElementById('memoryAppStyles')) return;
        const style = document.createElement('style');
        style.id = 'memoryAppStyles';
        style.textContent = `
            .memory-app-container { --memory-blue: #1c1c1e; --memory-background: #f2f2f7; --memory-card: #ffffff; --memory-label: #3c3c43; --memory-secondary: #8e8e93; --memory-separator: #c6c6c8; position: absolute; inset: 0; z-index: 7200; display: none; overflow: hidden; background: var(--memory-background); color: #000; font-family: "Noto Serif SC", "STSong", "SimSun", serif; }
            .memory-app-container.is-open { display: block; }
            .memory-app-scroll { box-sizing: border-box; display: flex; flex-direction: column; height: 100%; min-height: 100%; overflow-y: auto; overscroll-behavior: contain; padding: max(46px, calc(env(safe-area-inset-top) + 13px)) 20px calc(18px + env(safe-area-inset-bottom)); background: var(--memory-background); }
            .memory-profile-header, .memory-picker-header { display: flex; align-items: center; justify-content: space-between; min-height: 46px; }
            .memory-back { width: 42px; height: 42px; border: 0; padding: 0 0 5px; border-radius: 50%; background: rgba(255,255,255,.72); color: var(--memory-blue); box-shadow: 0 2px 8px rgba(60,60,67,.08); font: 37px/37px Georgia, serif; cursor: pointer; }
            .memory-header-actions { display: flex; align-items: center; gap: 9px; }
            .memory-switch-role { min-width: 46px; height: 34px; border: 0; border-radius: 17px; padding: 0 11px; background: rgba(255,255,255,.72); color: var(--memory-blue); font: 13px/1 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-summary-settings-button { width: 34px; height: 34px; border: 0; border-radius: 50%; padding: 0 0 6px; background: rgba(255,255,255,.72); color: var(--memory-blue); box-shadow: 0 2px 8px rgba(60,60,67,.08); font: 16px/1 Arial, sans-serif; letter-spacing: 2px; cursor: pointer; }
            .memory-add { width: 34px; height: 34px; border: 0; border-radius: 50%; padding: 0 0 2px; background: var(--memory-blue); color: #fff; box-shadow: 0 4px 10px rgba(28,28,30,.22); font: 25px/30px Arial, sans-serif; cursor: pointer; }
            .memory-profile-main { flex: 1 0 auto; display: flex; flex-direction: column; align-items: center; padding: 24px 0 16px; }
            .memory-avatar-shell { display: grid; width: 150px; height: 150px; padding: 7px; border: 5px solid #d1d1d6; border-radius: 50%; box-sizing: border-box; background: var(--memory-background); box-shadow: 0 3px 10px rgba(60,60,67,.08); }
            .memory-avatar { width: 100%; height: 100%; border: 3px solid #fff; border-radius: 50%; overflow: hidden; box-sizing: border-box; background: #e5e5ea; display: grid; place-items: center; color: var(--memory-blue); font-size: 43px; font-weight: 700; }
            .memory-avatar img { display: none; width: 100%; height: 100%; object-fit: cover; }
            .memory-avatar.has-image img { display: block; }
            .memory-avatar.has-image span { display: none; }
            .memory-heading { width: 100%; margin-top: 23px; text-align: center; }
            .memory-name-line { display: flex; align-items: center; justify-content: center; gap: 10px; min-width: 0; }
            .memory-name-line h1 { margin: 0; max-width: 68%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 32px; line-height: 1.25; font-weight: 700; letter-spacing: 0; }
            .memory-name-line span { padding: 5px 9px; border-radius: 999px; background: #e5e5ea; color: var(--memory-blue); font-family: "Noto Serif SC", "STSong", "SimSun", serif; font-size: 12px; line-height: 1; white-space: nowrap; }
            .memory-heading p { margin: 8px 0 0; color: var(--memory-secondary); font-size: 14px; line-height: 1.55; }
            .memory-stats { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; gap: 12px; margin-top: 28px; }
            .memory-stats article { display: grid; min-width: 0; min-height: 92px; place-content: center; padding: 10px 6px; border-radius: 20px; background: var(--memory-card); box-shadow: 0 6px 18px rgba(60,60,67,.06); text-align: center; }
            .memory-stats b { display: block; color: var(--memory-blue); font-size: 25px; line-height: 1.05; font-variant-numeric: tabular-nums; }
            .memory-stats span { display: block; margin-top: 9px; color: var(--memory-secondary); font-size: 11px; white-space: nowrap; }
            .memory-content-card { display: flex; flex: 1 0 300px; flex-direction: column; width: 100%; min-height: 300px; margin-top: 23px; padding: 25px 25px 30px; border-radius: 24px; box-sizing: border-box; background: var(--memory-card); box-shadow: 0 10px 24px rgba(60,60,67,.055); }
            .memory-content-card [data-memory-content] { display: flex; flex: 1; min-height: 0; }
            .memory-card-kicker { color: var(--memory-secondary); font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; font-weight: 600; letter-spacing: 0; }
            .memory-empty-state { display: grid; flex: 1; width: 100%; align-content: center; justify-items: center; padding: 36px 12px; box-sizing: border-box; text-align: center; }
            .memory-empty-mark { color: var(--memory-blue); font-size: 22px; line-height: 1; }
            .memory-empty-state h2 { margin: 20px 0 0; font-size: 25px; line-height: 1.45; font-weight: 700; letter-spacing: 0; }
            .memory-empty-state p { max-width: 240px; margin: 9px 0 0; color: var(--memory-secondary); font-size: 14px; line-height: 1.75; }
            .memory-entry-list { display: grid; width: 100%; align-content: start; gap: 10px; padding: 20px 0 0; overflow-y: auto; }
            .memory-entry { padding: 14px 15px; border-radius: 14px; background: #f2f2f7; }
            .memory-entry-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
            .memory-entry-meta { display: block; color: var(--memory-blue); font-size: 11px; }
            .memory-entry-actions { display: flex; flex: 0 0 auto; gap: 6px; }
            .memory-entry-actions button { border: 0; padding: 3px 0; background: transparent; color: var(--memory-secondary); font: 12px/1 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-entry-actions .memory-delete-action { color: #ff3b30; }
            .memory-entry-actions .memory-priority-action { max-width: 58px; border: 0; padding: 2px 0; background: transparent; color: var(--memory-blue); font: 12px/1 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-entry p { margin: 7px 0 0; color: #1c1c1e; font-size: 15px; line-height: 1.62; white-space: pre-wrap; }
            .memory-entry .memory-entry-provenance { margin-top: 9px; color: var(--memory-secondary); font-size: 11px; line-height: 1.45; }
            .memory-tabs { position: sticky; bottom: 0; display: grid; grid-template-columns: repeat(4, 1fr); width: 100%; margin: 8px 0 0; padding: 5px; border-radius: 24px; box-sizing: border-box; background: rgba(255,255,255,.94); box-shadow: 0 7px 20px rgba(60,60,67,.08); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
            .memory-tabs button { height: 44px; border: 0; border-radius: 19px; padding: 0; background: transparent; color: var(--memory-secondary); font: 14px/1 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-tabs button.is-active { background: var(--memory-blue); color: #fff; font-weight: 700; }
            .memory-role-picker { position: absolute; inset: 0; z-index: 3; display: none; flex-direction: column; overflow-y: auto; padding: max(46px, calc(env(safe-area-inset-top) + 13px)) 20px calc(22px + env(safe-area-inset-bottom)); box-sizing: border-box; background: var(--memory-background); }
            .memory-app-container.is-picking-role .memory-role-picker { display: flex; }
            .memory-picker-header span { color: var(--memory-secondary); font-size: 14px; }
            .memory-picker-intro { margin-top: 35px; }
            .memory-picker-intro h1 { margin: 0; font-size: 30px; line-height: 1.3; }
            .memory-picker-intro p { margin: 9px 0 0; color: var(--memory-secondary); font-size: 14px; line-height: 1.65; }
            .memory-role-list { display: grid; gap: 11px; margin-top: 30px; }
            .memory-role-option { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; align-items: center; gap: 13px; width: 100%; min-height: 78px; border: 0; border-radius: 18px; padding: 12px 15px; box-sizing: border-box; background: var(--memory-card); box-shadow: 0 5px 16px rgba(60,60,67,.05); color: #000; text-align: left; cursor: pointer; }
            .memory-role-option.is-selected { outline: 2px solid var(--memory-blue); outline-offset: -2px; }
            .memory-role-avatar { position: relative; display: grid; width: 52px; height: 52px; overflow: hidden; border-radius: 50%; background: #e5e5ea; place-items: center; color: var(--memory-blue); font-size: 19px; font-weight: 700; }
            .memory-role-avatar img { display: none; width: 100%; height: 100%; object-fit: cover; }
            .memory-role-avatar.has-image img { display: block; }
            .memory-role-avatar.has-image span { display: none; }
            .memory-role-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 18px; font-weight: 700; }
            .memory-role-hint { color: var(--memory-blue); font-size: 13px; white-space: nowrap; }
            .memory-role-empty { display: grid; flex: 1; align-content: center; justify-items: center; padding: 40px 20px; text-align: center; }
            .memory-role-empty h2 { margin: 0; font-size: 22px; }
            .memory-role-empty p { margin: 10px 0 22px; color: var(--memory-secondary); font-size: 14px; line-height: 1.65; }
            .memory-role-empty button { border: 0; border-radius: 18px; padding: 11px 15px; background: var(--memory-blue); color: #fff; font: 14px/1 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-composer { position: absolute; inset: 0; z-index: 4; display: none; align-items: flex-end; background: rgba(0,0,0,.28); }
            .memory-app-container.is-composing .memory-composer { display: flex; }
            .memory-composer-sheet { width: 100%; padding: 14px 20px calc(25px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; box-sizing: border-box; background: var(--memory-card); box-shadow: 0 -12px 28px rgba(0,0,0,.12); }
            .memory-composer-header { display: grid; grid-template-columns: 60px 1fr 60px; align-items: center; }
            .memory-composer-header h2 { margin: 0; text-align: center; font-size: 17px; }
            .memory-composer-header button { border: 0; padding: 9px 0; background: transparent; color: var(--memory-blue); font: 15px/1 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-composer-header button:last-child { font-weight: 700; text-align: right; }
            .memory-composer-role { margin: 18px 0 10px; color: var(--memory-secondary); font-size: 13px; }
            .memory-composer-role span { color: #1c1c1e; }
            .memory-composer textarea { display: block; width: 100%; min-height: 142px; resize: none; border: 0; border-radius: 14px; padding: 14px; box-sizing: border-box; outline: 0; background: #f2f2f7; color: #1c1c1e; font: 16px/1.6 "Noto Serif SC", "STSong", "SimSun", serif; }
            .memory-composer textarea::placeholder { color: #8e8e93; }
            .memory-composer-error { min-height: 18px; margin: 7px 0 0; color: #ff3b30; font-size: 12px; }
            .memory-summary-panel { position: absolute; inset: 0; z-index: 7203; display: none; align-items: flex-end; background: rgba(0,0,0,.28); }
            .memory-app-container.is-viewing-summary .memory-summary-panel { display: flex; }
            .memory-summary-panel-sheet { display: flex; width: 100%; max-height: min(82vh, 720px); flex-direction: column; overflow: hidden; border-radius: 18px 18px 0 0; padding: 14px 20px calc(22px + env(safe-area-inset-bottom)); box-sizing: border-box; background: #fff; box-shadow: 0 -12px 28px rgba(0,0,0,.14); }
            .memory-summary-panel-scroll { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
            .memory-summary-role { margin: 18px 0 4px; color: #8e8e93; font-size: 13px; font-weight: 500; }
            .memory-summary-current, .memory-summary-progress-section, .memory-summary-source-section { padding: 18px 0; border-bottom: 1px solid #e5e5ea; }
            .memory-summary-section-header { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 12px; }
            .memory-summary-section-header h3 { margin: 0; color: #000; font-size: 17px; font-weight: 600; letter-spacing: 0; }
            .memory-summary-section-header > span, .memory-summary-section-header > div { color: #8e8e93; font-size: 12px; }
            .memory-summary-section-header > div { display: flex; align-items: center; gap: 12px; }
            .memory-summary-section-header button, .memory-summary-edit-actions button { border: 0; padding: 0; background: transparent; color: #007aff; font: 500 14px/20px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; cursor: pointer; }
            .memory-summary-section-header button:disabled { color: #c7c7cc; cursor: default; }
            .memory-summary-text { margin: 13px 0 0; color: #000; font-size: 17px; line-height: 1.6; overflow-wrap: anywhere; }
            .memory-summary-text.is-empty { color: #8e8e93; }
            .memory-summary-panel textarea { display: none; width: 100%; min-height: 92px; margin-top: 12px; resize: vertical; border: 0; border-radius: 10px; padding: 12px; box-sizing: border-box; outline: 0; background: #f2f2f7; color: #000; font: 16px/1.55 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
            .memory-summary-edit-actions { display: none; justify-content: flex-end; gap: 20px; margin-top: 10px; }
            .memory-app-container.is-editing-summary .memory-summary-text { display: none; }
            .memory-app-container.is-editing-summary .memory-summary-panel textarea { display: block; }
            .memory-app-container.is-editing-summary .memory-summary-edit-actions { display: flex; }
            .memory-summary-meta { margin: 9px 0 0; color: #8e8e93; font-size: 12px; line-height: 1.4; }
            .memory-summary-progress-section progress { display: block; width: 100%; height: 6px; margin-top: 14px; border: 0; border-radius: 3px; overflow: hidden; accent-color: #007aff; }
            .memory-summary-sources { display: grid; gap: 10px; margin-top: 14px; }
            .memory-summary-source { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 9px; align-items: start; }
            .memory-summary-source span { color: #8e8e93; font-size: 12px; line-height: 1.5; }
            .memory-summary-source p, .memory-summary-source-empty { margin: 0; color: #3c3c43; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
            .memory-summary-status { min-height: 18px; margin: 12px 0 0; color: #8e8e93; font-size: 12px; line-height: 1.5; }
            .memory-summary-settings { position: absolute; inset: 0; z-index: 5; display: none; align-items: flex-end; background: rgba(0,0,0,.28); }
            .memory-app-container.is-configuring-summary .memory-summary-settings { display: flex; }
            .memory-summary-settings-sheet { width: 100%; max-height: 92%; overflow-y: auto; padding: 14px 20px calc(25px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; box-sizing: border-box; background: var(--memory-card); box-shadow: 0 -12px 28px rgba(0,0,0,.12); }
            .memory-summary-settings-copy { margin: 24px 0 12px; color: #1c1c1e; font-size: 16px; line-height: 1.6; }
            .memory-summary-settings-input { display: flex; align-items: center; gap: 10px; width: 100%; padding: 13px 14px; border-radius: 14px; box-sizing: border-box; background: #f2f2f7; color: var(--memory-secondary); font-size: 15px; }
            .memory-summary-settings-input input { width: 78px; border: 0; padding: 0; outline: 0; background: transparent; color: #1c1c1e; font: 24px/1.2 Georgia, "Noto Serif SC", "STSong", "SimSun", serif; }
            .memory-summary-settings-note { margin: 11px 0 0; color: var(--memory-secondary); font-size: 13px; line-height: 1.6; }
            .memory-semantic-settings { position: absolute; inset: 0; z-index: 6; display: none; align-items: flex-end; background: rgba(0,0,0,.28); }
            .memory-app-container.is-configuring-semantic .memory-semantic-settings { display: flex; }
            .memory-semantic-settings-sheet { width: 100%; padding: 14px 20px calc(25px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; box-sizing: border-box; background: var(--memory-card); box-shadow: 0 -12px 28px rgba(0,0,0,.12); }
            .memory-semantic-settings-copy { margin: 24px 0 12px; color: #1c1c1e; font-size: 16px; line-height: 1.6; }
            .memory-semantic-settings-input { display: flex; align-items: center; gap: 10px; width: 100%; padding: 13px 14px; border-radius: 14px; box-sizing: border-box; background: #f2f2f7; color: var(--memory-secondary); font-size: 13px; }
            .memory-semantic-settings-input span { flex: 0 0 auto; }
            .memory-semantic-settings-input input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: #1c1c1e; font: 14px/1.4 Arial, sans-serif; }
            .memory-semantic-model-progress { display: block; width: 100%; height: 6px; margin: 16px 0 0; accent-color: #1c1c1e; }
            .memory-semantic-model-status { min-height: 20px; margin: 12px 0 0; color: var(--memory-secondary); font-size: 13px; line-height: 1.5; }
            .memory-semantic-remove { border: 0; padding: 0; background: transparent; color: #ff3b30; font: 13px/1.5 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            /* Reference memory-library layout. */
            .memory-app-container { --memory-blue: #007aff; --memory-background: #fff; --memory-card: #f6f6f6; --memory-secondary: #8e8e93; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; }
            .memory-app-scroll { display: block; height: 100%; padding: max(54px, calc(env(safe-area-inset-top) + 20px)) 20px calc(28px + env(safe-area-inset-bottom)); background: #fff; }
            .memory-profile-header { min-height: 34px; }
            .memory-back { width: 34px; height: 34px; padding: 0 2px 4px 0; border-radius: 50%; background: rgba(142,142,147,.12); box-shadow: none; color: #000; font: 31px/31px Arial, sans-serif; }
            .memory-settings-button { height: 34px; border: 0; border-radius: 17px; padding: 0 16px; background: rgba(142,142,147,.12); color: #000; font: 500 15px/34px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; cursor: pointer; }
            .memory-profile-main { display: block; padding: 0; }
            .memory-profile-section { display: flex; align-items: center; min-width: 0; padding: 22px 0 24px; }
            .memory-avatar-shell { position: relative; display: block; width: 88px; height: 88px; padding: 0; border: 0; border-radius: 20px; background: #d1d1d6; box-shadow: none; flex: 0 0 auto; }
            .memory-avatar { border: 0; border-radius: 20px; background: #d1d1d6; color: #fff; font-size: 32px; }
            .memory-avatar-switch { position: absolute; right: -6px; bottom: -6px; display: grid; width: 30px; height: 30px; border: 1px solid rgba(0,0,0,.05); border-radius: 50%; padding: 0; place-items: center; background: #fff; color: #000; box-shadow: 0 2px 10px rgba(0,0,0,.15); font: 17px/1 Arial, sans-serif; cursor: pointer; }
            .memory-heading { width: auto; min-width: 0; margin: 0 0 0 18px; text-align: left; }
            .memory-name-line { display: block; }
            .memory-name-line h1 { max-width: 100%; font-size: 24px; line-height: 1.2; font-weight: 600; letter-spacing: 0; }
            .memory-heading p { margin: 7px 0 0; color: #c7c7cc; font-size: 13px; line-height: 1.35; }
            .memory-profile-stat { display: flex; align-items: center; gap: 7px; color: #8e8e93 !important; font-size: 12px !important; white-space: nowrap; }
            .memory-profile-stat b { color: inherit; font-weight: 400; }
            .memory-profile-stat i { width: 1px; height: 11px; background: #c7c7cc; }
            .memory-profile-status { display: none; }
            .memory-tabs { position: static; display: grid; grid-template-columns: repeat(4, 1fr); width: 100%; margin: 0 0 16px; padding: 4px; border-radius: 10px; background: #f2f2f7; box-shadow: none; backdrop-filter: none; }
            .memory-tabs button { height: 28px; border-radius: 7px; color: #8e8e93; font: 500 13px/28px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
            .memory-tabs button.is-active { background: #fff; color: #000; box-shadow: 0 3px 8px rgba(0,0,0,.04), 0 1px 1px rgba(0,0,0,.04); font-weight: 600; }
            .memory-search { display: flex; align-items: center; height: 36px; margin-bottom: 20px; border-radius: 10px; padding: 0 8px; background: rgba(142,142,147,.12); color: #8e8e93; }
            .memory-search span { margin-right: 6px; font: 21px/1 Arial, sans-serif; transform: rotate(-20deg); }
            .memory-search input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: #000; font: 17px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
            .memory-search input::placeholder { color: #8e8e93; }
            .memory-list-header { display: flex; align-items: center; justify-content: space-between; min-height: 25px; margin-bottom: 12px; }
            .memory-list-header h2 { margin: 0; color: #000; font-size: 18px; font-weight: 600; }
            .memory-list-header > div { display: flex; align-items: center; gap: 16px; }
            .memory-list-header button { border: 0; padding: 0; background: transparent; color: #007aff; font: 500 14px/20px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; cursor: pointer; }
            .memory-content-card { display: block; width: 100%; min-height: 0; margin: 0; padding: 0; border-radius: 0; background: transparent; box-shadow: none; }
            .memory-content-card [data-memory-content] { display: block; min-height: 0; }
            .memory-entry-list { display: grid; gap: 16px; padding: 0; overflow: visible; }
            .memory-entry { padding: 16px; border-radius: 16px; background: #f6f6f6; }
            .memory-entry-meta { display: inline-flex; align-items: center; border-radius: 6px; padding: 4px 8px; background: rgba(0,122,255,.12); color: #007aff; font-size: 12px; font-weight: 600; }
            .memory-entry p { margin-top: 8px; color: #000; font-size: 15px; line-height: 1.5; }
            .memory-entry .memory-entry-provenance { color: #8e8e93; font-size: 11px; }
            .memory-empty-state { min-height: 180px; padding: 25px 12px; }
            .memory-empty-state h2 { font-size: 21px; }
            .memory-composer, .memory-summary-panel, .memory-summary-settings, .memory-semantic-settings { background: rgba(0,0,0,.3); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
            .memory-summary-settings-sheet { border-radius: 18px 18px 0 0; background: #fff; }
            .memory-settings-section { margin-top: 26px; padding-top: 20px; border-top: 1px solid #e5e5ea; }
            .memory-settings-section h3 { margin: 0; color: #000; font-size: 17px; font-weight: 600; }
            .memory-summary-settings-sheet { max-height: 94%; padding: 14px 16px calc(25px + env(safe-area-inset-bottom)); background: #f2f2f7; box-shadow: 0 -8px 24px rgba(0,0,0,.12); }
            .memory-summary-settings-sheet > .memory-composer-header { min-height: 42px; padding: 0 4px; }
            .memory-summary-settings-sheet > .memory-composer-header h2 { font: 600 17px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
            .memory-summary-settings-sheet > .memory-composer-header button { color: #007aff; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
            .memory-settings-intro { margin: 14px 0 22px; color: #8e8e93; font: 13px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; text-align: center; }
            .memory-summary-control-card { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 14px; border-radius: 14px; background: #fff; }
            .memory-summary-card-icon { display: grid; width: 40px; height: 40px; border-radius: 10px; place-items: center; background: #fbf0de; color: #b27b38; }
            .memory-summary-card-icon svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
            .memory-summary-card-copy { display: grid; min-width: 0; gap: 3px; }
            .memory-summary-card-copy strong { color: #1c1c1e; font: 600 15px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
            .memory-summary-card-copy small { color: #8e8e93; font: 12px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
            .memory-summary-stepper { display: flex; align-items: center; gap: 5px; }
            .memory-summary-stepper button { display: grid; width: 27px; height: 27px; border: 0; border-radius: 50%; place-items: center; background: #f2f2f7; color: #007aff; font: 20px/1 -apple-system, BlinkMacSystemFont, sans-serif; cursor: pointer; }
            .memory-summary-stepper label { display: grid; justify-items: center; min-width: 38px; }
            .memory-summary-stepper input { width: 38px; border: 0; padding: 0; background: transparent; color: #1c1c1e; font: 600 15px/1 -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; outline: 0; }
            .memory-summary-stepper small { color: #8e8e93; font: 10px/1.3 -apple-system, BlinkMacSystemFont, sans-serif; white-space: nowrap; }
            .memory-source-group-title { margin: 26px 12px 8px; color: #6e6e73; font: 400 13px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
            .memory-settings-collapsible { margin: 0; padding: 0; overflow: hidden; border: 0; background: #fff; }
            .memory-settings-collapsible:first-of-type { border-radius: 12px 12px 0 0; }
            .memory-settings-collapsible-header { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto 18px; align-items: center; gap: 11px; width: 100%; min-height: 66px; border: 0; border-bottom: 1px solid #e5e5ea; padding: 10px 13px; background: #fff; color: #000; text-align: left; cursor: pointer; }
            .memory-source-icon { display: grid; width: 30px; height: 30px; border-radius: 8px; place-items: center; background: #e9f2ff; color: #007aff; }
            .memory-source-icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
            .memory-source-copy { display: grid; min-width: 0; gap: 3px; }
            .memory-source-copy strong { color: #1c1c1e; font: 500 15px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
            .memory-source-copy small { overflow: hidden; color: #8e8e93; font: 12px/1.35 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; text-overflow: ellipsis; white-space: nowrap; }
            .memory-source-status { color: #8e8e93; font: 13px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; white-space: nowrap; }
            .memory-settings-chevron { width: 15px; height: 15px; fill: none; stroke: #c7c7cc; stroke-width: 2.3; stroke-linecap: round; stroke-linejoin: round; transition: transform 180ms ease; }
            .memory-settings-collapsible.is-expanded .memory-settings-chevron { transform: rotate(180deg); }
            .memory-settings-collapsible-body { display: grid; gap: 10px; padding: 4px 13px 16px; background: #fff; }
            .memory-settings-collapsible:not(.is-expanded) .memory-settings-collapsible-body { display: none; }
            .memory-settings-collapsible + .memory-settings-collapsible { border-top: 1px solid #e5e5ea; }
            .memory-settings-collapsible:last-of-type { border-radius: 0 0 12px 12px; }
            .memory-remote-vector-section strong { color: #1c1c1e; font-size: 14px; font-weight: 500; }
            .memory-remote-vector-section .memory-sync-actions { margin-top: 2px; }
            .memory-remote-model-button { display: flex; min-width: 0; flex: 1; align-items: center; justify-content: flex-end; gap: 5px; border: 0; padding: 0; background: transparent; color: #1c1c1e; font: 14px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; cursor: pointer; }
            .memory-remote-model-button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .memory-remote-model-button svg { width: 15px; height: 15px; flex: 0 0 auto; fill: none; stroke: #c7c7cc; stroke-width: 2.3; stroke-linecap: round; stroke-linejoin: round; }
            .memory-settings-privacy { display: flex; align-items: center; gap: 8px; margin: 18px 0 6px; padding: 11px 12px; border-radius: 11px; background: rgba(142,142,147,.12); color: #8e8e93; font: 12px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
            .memory-settings-privacy svg { width: 16px; height: 16px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
            @media (prefers-reduced-motion: reduce) { .memory-settings-chevron, .memory-sync-switch, .memory-sync-switch::after { transition: none; } }
            .memory-external-fields { display: grid; min-width: 0; gap: 10px; }
            .memory-external-section .memory-semantic-settings-input { min-width: 0; overflow: hidden; }
            .memory-external-section input[type="text"], .memory-external-section input[type="password"], .memory-external-section input[type="url"] { width: 100%; min-width: 0; border: 0; padding: 0; box-sizing: border-box; background: transparent; color: #111; text-align: right; font: 400 14px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
            .memory-external-section input::placeholder { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .memory-sync-provider-button { display: flex; min-width: 0; flex: 1; align-items: center; justify-content: flex-end; gap: 8px; border: 0; padding: 0; background: transparent; color: #111; font: 500 14px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; cursor: pointer; }
            .memory-sync-provider-button span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .memory-sync-chevron { color: #8e8e93; font-size: 22px; line-height: 1; }
            .memory-sync-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 10px; padding: 13px 14px; border-radius: 14px; background: #f2f2f7; cursor: pointer; }
            .memory-sync-toggle-row > span:first-child { display: grid; gap: 2px; color: #1c1c1e; font-size: 15px; }
            .memory-sync-toggle-row small { color: #8e8e93; font-size: 12px; }
            .memory-sync-toggle-row input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
            .memory-sync-switch { position: relative; width: 51px; height: 31px; flex: 0 0 auto; border-radius: 16px; background: #d1d1d6; transition: background-color 180ms ease; }
            .memory-sync-switch::after { position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,.18); content: ""; transition: transform 180ms ease; }
            .memory-sync-toggle-row.is-on .memory-sync-switch { background: #34c759; }
            .memory-sync-toggle-row.is-on .memory-sync-switch::after { transform: translateX(20px); }
            .memory-summary-custom-prompt { display: grid; gap: 8px; margin-top: 12px; color: #1c1c1e; font-size: 14px; }
            .memory-summary-prompt-section .memory-sync-toggle-row { margin-top: 0; }
            .memory-summary-custom-prompt > span { color: #6e6e73; font-size: 13px; }
            .memory-summary-custom-prompt textarea { width: 100%; min-height: 150px; box-sizing: border-box; resize: vertical; border: 0; border-radius: 12px; padding: 12px; background: #f2f2f7; color: #1c1c1e; font: 14px/1.55 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; outline: 0; }
            .memory-choice-dialog { position: absolute; inset: 0; z-index: 2; display: none; align-items: flex-end; background: rgba(0,0,0,.28); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
            .memory-choice-dialog.is-visible { display: flex; }
            .memory-choice-backdrop { position: absolute; inset: 0; }
            .memory-choice-sheet { position: relative; width: 100%; padding: 14px 20px calc(25px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; background: rgba(255,255,255,.94); box-shadow: 0 -12px 28px rgba(0,0,0,.14); }
            .memory-choice-list { display: grid; gap: 8px; margin-top: 14px; }
            .memory-choice-option { display: flex; align-items: center; justify-content: space-between; min-height: 48px; border: 0; border-radius: 13px; padding: 0 14px; background: #f2f2f7; color: #1c1c1e; font: 500 15px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; text-align: left; cursor: pointer; }
            .memory-choice-option:active { transform: scale(.985); }
            .memory-choice-check { color: #007aff; opacity: 0; }
            .memory-choice-option.is-selected .memory-choice-check { opacity: 1; }
            .memory-sync-scope { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 14px 0 0; padding: 12px; border: 1px solid #e5e5ea; border-radius: 10px; }
            .memory-sync-scope legend { padding: 0 5px; color: #6e6e73; font-size: 12px; }
            .memory-sync-scope label { color: #1c1c1e; font-size: 13px; line-height: 20px; }
            .memory-sync-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
            .memory-sync-actions button, .memory-sync-actions a { display: flex; align-items: center; justify-content: center; min-height: 40px; border: 0; border-radius: 10px; background: #e9f2ff; color: #007aff; text-decoration: none; font: 500 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; cursor: pointer; }
            .memory-model-download { width: 100%; height: 42px; margin-top: 14px; border: 0; border-radius: 10px; background: #007aff; color: #fff; font: 500 15px/42px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; cursor: pointer; }
            .memory-semantic-model-progress { width: 100%; margin-top: 12px; }
            @media (prefers-reduced-transparency: reduce) { .memory-composer, .memory-summary-panel, .memory-summary-settings, .memory-semantic-settings { background: rgba(0,0,0,.52); backdrop-filter: none; -webkit-backdrop-filter: none; } }
            @media (max-width: 360px) { .memory-app-scroll, .memory-role-picker { padding-right: 15px; padding-left: 15px; } .memory-profile-section { padding-top: 18px; } .memory-avatar-shell { width: 78px; height: 78px; } .memory-heading { margin-left: 14px; } .memory-profile-stat { gap: 5px; font-size: 11px !important; } }
        `;
        document.head.appendChild(style);
    }

    async function installReferenceStyles() {
        if (document.getElementById('memoryReferenceStyles')) return;
        const documentText = await decodeReferenceDocument();
        const styleMatch = documentText.match(/<style>([\s\S]*?)<\/style>/i);
        if (!styleMatch) return;
        const style = document.createElement('style');
        style.id = 'memoryReferenceStyles';
        style.textContent = styleMatch[1].replace(/body, html\s*\{[\s\S]*?\}/, '')
            + '#memoryAppUI .memory-app-scroll{width:100%;height:100%;overflow-y:auto;background:#fff}'
            + '#memoryAppUI .profile-avatar{overflow:hidden;position:relative}'
            + '#memoryAppUI .profile-avatar img{display:none;width:100%;height:100%;object-fit:cover}'
            + '#memoryAppUI .profile-avatar.has-image img{display:block}'
            + '#memoryAppUI .profile-avatar.has-image [data-memory-monogram]{display:none}'
            + '#memoryAppUI .memory-entry-actions{display:flex;gap:8px;align-items:center}'
            + '#memoryAppUI .memory-entry-actions button,#memoryAppUI .memory-entry-actions select{border:0;background:transparent;color:#007AFF;font:500 12px -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}'
            + '#memoryAppUI .memory-entry-actions .memory-delete-action{color:#ff3b30}';
        document.head.appendChild(style);
    }

    function init() {
        ensureStyles();
        if (!root) buildRoot();
        if (!getReferenceFrame()) void installReferenceStyles();
        return Promise.resolve();
    }

    function open() {
        if (!root) init();
        root.setAttribute('aria-hidden', 'false');
        root.classList.add('is-open');
        void refresh().then(() => window.MemorySync?.schedule(selectedContactId));
    }

    function close() {
        if (!root) return;
        closeSummaryPanel();
        closeComposer();
        closeSummarySettings();
        closeSemanticSettings();
        if (getReferenceFrame()) {
            root.classList.remove('is-open');
            root.setAttribute('aria-hidden', 'true');
            return;
        }
        root.classList.remove('is-picking-role');
        root.querySelector('[data-memory-role-picker]').setAttribute('aria-hidden', 'true');
        root.classList.remove('is-open');
        root.setAttribute('aria-hidden', 'true');
    }

    window.MemoryApp = {
        init,
        open,
        close,
        refresh,
        preload,
        getPromptMemories,
        enqueueChatTurn,
        getPendingChatTurns,
        completeChatTurn,
        markChatTurnFailed,
        getPromptSummary,
        getSummaryPromptConfig,
        getSummaryOverview,
        saveSummaryOverride,
        getRelevantFragments,
        getRelevantFragmentsAsync,
        runRetrievalEvaluation,
        getSummaryJob,
        completeSummary,
        invalidateSources,
        getSyncSnapshot,
        mergeSyncRecords
    };

    // The chat path reads this in-memory cache only. IndexedDB is warmed in the background.
    void preload().then(() => scheduleSemanticIndex());
    window.addEventListener('semanticmemory:status', (event) => {
        if (event.detail && event.detail.status === 'ready') scheduleSemanticIndex();
    });
    void window.MemorySync?.init?.();
})();
