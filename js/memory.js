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
    const SUMMARY_PREFERENCES_VERSION = 2;
    const MAX_SUMMARY_SOURCE_MESSAGES = 160;
    const MEMORY_SCHEMA_VERSION = 2;
    const OUTBOX_MAX_ATTEMPTS = 8;
    const OUTBOX_MAX_RETRY_DELAY_MS = 60 * 60 * 1000;
    const RETRIEVAL_COOLDOWN_MS = 8 * 60 * 1000;
    const RETRIEVAL_PRIORITY = Object.freeze({ low: -3, normal: 0, pinned: 6 });
    const VECTOR_INDEX_VERSION = 'local-ngram-v1';
    const VECTOR_DIMENSIONS = 256;
    const VECTOR_MIN_SIMILARITY = 0.12;
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
            summaryPreferencesVersion: SUMMARY_PREFERENCES_VERSION
        });
    }

    function normalizeSummaryInterval(value) {
        const numericValue = Number.parseInt(value, 10);
        if (!Number.isFinite(numericValue)) return DEFAULT_SUMMARY_INTERVAL;
        return Math.max(MIN_SUMMARY_INTERVAL, Math.min(MAX_SUMMARY_INTERVAL, numericValue));
    }

    function readSummaryInterval(preferences) {
        if (!preferences || preferences.summaryPreferencesVersion !== SUMMARY_PREFERENCES_VERSION) {
            return DEFAULT_SUMMARY_INTERVAL;
        }
        return normalizeSummaryInterval(preferences.summaryIntervalMessages);
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

    function cosineSimilarity(leftVector, rightVector) {
        const left = getVectorValues(leftVector);
        const right = getVectorValues(rightVector);
        if (!left || !right) return 0;
        let score = 0;
        for (let index = 0; index < VECTOR_DIMENSIONS; index += 1) score += left[index] * right[index];
        return Math.max(0, Math.min(1, score));
    }

    function ensureLocalVector(item) {
        const existing = getVectorValues(item && item.vectorIndex);
        if (existing) return item.vectorIndex;
        const vectorIndex = createLocalMemoryVector(item && item.content);
        if (item) item.vectorIndex = vectorIndex;
        return vectorIndex;
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
            .slice(0, 900);
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

    function getSummaryJob(bindingId, messages) {
        const allSourceMessages = (Array.isArray(messages) ? messages : [])
            .filter((message) => message && message.id && (message.type === 'sent' || message.type === 'received') && normalizeMemoryText(message.text))
            .map((message) => ({ id: String(message.id), type: message.type, text: normalizeMemoryText(message.text).slice(0, 240) }));
        if (allSourceMessages.length < summaryIntervalMessages) return null;

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
        if (previous && newMessageCount < summaryIntervalMessages) return null;

        const sourceMessages = allSourceMessages.slice(-Math.min(MAX_SUMMARY_SOURCE_MESSAGES, Math.max(summaryIntervalMessages, 48)));

        return {
            id: 'summary_job_' + bindingId + '_' + sourceMessages[sourceMessages.length - 1].id,
            bindingId,
            sourceMessages,
            lastProcessedMessageId: allSourceMessages[allSourceMessages.length - 1].id,
            previousSummary: previous ? {
                id: previous.id,
                text: getPromptSummary(bindingId),
                sourceMessageIds: previous.sourceMessageIds || []
            } : null
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
            if (!content || content.length > 30 || sourceMessageIds.length === 0 || isSensitiveAutomaticMemory(content) || !hasVerifiedMilestone(job.bindingId, content)) return null;
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
        return true;
    }

    function formatMemoryDate(value) {
        const timestamp = Date.parse(value || '');
        if (!Number.isFinite(timestamp)) return '';
        return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(timestamp);
    }

    function appendMemoryEntry(list, item) {
        const entry = document.createElement('article');
        entry.className = 'memory-entry';
        const entryHeader = document.createElement('div');
        entryHeader.className = 'memory-entry-header';
        const meta = document.createElement('span');
        meta.className = 'memory-entry-meta';
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
            list.className = 'memory-entry-list';

            if (summary) {
                summary.sections.forEach((section) => {
                    const entry = document.createElement('article');
                    entry.className = 'memory-entry';
                    const meta = document.createElement('span');
                    meta.className = 'memory-entry-meta';
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
        hideRolePicker();
        render();
    }

    function openComposer(item = null) {
        const contact = cachedContacts.find((item) => item.id === selectedContactId);
        if (!contact) {
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

    function openSummarySettings() {
        if (!root) return;
        const sheet = root.querySelector('[data-memory-summary-settings]');
        const input = root.querySelector('[data-memory-summary-interval]');
        const error = root.querySelector('[data-memory-summary-error]');
        input.value = String(summaryIntervalMessages);
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
        root.classList.remove('is-configuring-summary');
        root.querySelector('[data-memory-summary-settings]').setAttribute('aria-hidden', 'true');
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
            'not-configured': '默认中文模型待下载',
            downloading: '正在下载',
            ready: '已下载，等待语义运行时接入',
            error: '下载失败',
            unavailable: '当前浏览器不支持'
        };
        const downloaded = Math.max(0, Number(state.downloadedBytes) || 0);
        const total = Math.max(0, Number(state.totalBytes) || 0);
        status.textContent = state.error ? (labels[state.status] || '下载失败') + '：' + state.error : (labels[state.status] || '未配置模型');
        progress.max = total || 1;
        progress.value = Math.min(downloaded, progress.max);
        progress.hidden = state.status !== 'downloading' && state.status !== 'ready';
        removeButton.hidden = state.status !== 'ready';
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
        summaryIntervalMessages = normalizeSummaryInterval(rawValue);
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

    function buildRoot() {
        root = document.createElement('section');
        root.id = 'memoryAppUI';
        root.className = 'memory-app-container';
        root.setAttribute('aria-hidden', 'true');
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
            <div class="memory-app-scroll">
                <header class="memory-profile-header">
                    <button class="memory-back" type="button" data-memory-action="close" aria-label="\u8fd4\u56de\u684c\u9762">\u2039</button>
                    <button class="memory-settings-button" type="button" data-memory-action="summary-settings">\u8bbe\u7f6e</button>
                </header>
                <main class="memory-profile-main">
                    <section class="memory-profile-section">
                        <div class="memory-avatar-shell">
                            <div class="memory-avatar" data-memory-avatar><img data-memory-avatar-image alt=""><span data-memory-monogram>\u8bb0</span></div>
                            <button class="memory-avatar-switch" type="button" data-memory-action="switch-role" aria-label="\u5207\u6362\u89d2\u8272">\u21c4</button>
                        </div>
                        <div class="memory-heading">
                            <div class="memory-name-line"><h1 data-memory-name>\u8bb0\u5fc6</h1></div>
                            <p data-memory-subtitle>\u8bb0\u5fc6\u603b\u6570\uff1a0 \u6761</p>
                            <p class="memory-profile-stat"><span>\u5171\u540c\u5bf9\u8bdd\uff1a<b data-memory-chat-count>0</b> \u8f6e</span><i></i><span>\u8ba4\u8bc6\u5929\u6570\uff1a<b data-memory-days>0</b> \u5929</span></p>
                            <span class="memory-profile-status" data-memory-status>\u8bfb\u53d6\u4e2d</span>
                        </div>
                    </section>
                    <nav class="memory-tabs" role="tablist" aria-label="\u8bb0\u5fc6\u89c6\u56fe">
                        <button type="button" data-memory-tab="memory" class="is-active" role="tab" aria-selected="true">\u8bb0\u5fc6</button>
                        <button type="button" data-memory-tab="relationship" role="tab" aria-selected="false">\u5173\u7cfb</button>
                        <button type="button" data-memory-tab="fragment" role="tab" aria-selected="false">\u7247\u6bb5</button>
                        <button type="button" data-memory-tab="archive" role="tab" aria-selected="false">\u6863\u6848</button>
                    </nav>
                    <label class="memory-search"><span aria-hidden="true">\u2315</span><input type="search" data-memory-search placeholder="\u641c\u7d22\u8bb0\u5fc6..."></label>
                    <div class="memory-list-header"><h2 data-memory-card-title>\u8fd1\u671f\u8bb0\u5fc6</h2><div><button type="button" data-memory-action="summary-settings">\u6458\u8981</button><button type="button" data-memory-action="add">\uff0b \u65b0\u589e</button></div></div>
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
            .memory-summary-settings { position: absolute; inset: 0; z-index: 5; display: none; align-items: flex-end; background: rgba(0,0,0,.28); }
            .memory-app-container.is-configuring-summary .memory-summary-settings { display: flex; }
            .memory-summary-settings-sheet { width: 100%; padding: 14px 20px calc(25px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; box-sizing: border-box; background: var(--memory-card); box-shadow: 0 -12px 28px rgba(0,0,0,.12); }
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
            .memory-composer, .memory-summary-settings, .memory-semantic-settings { background: rgba(0,0,0,.3); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
            .memory-summary-settings-sheet { border-radius: 18px 18px 0 0; background: #fff; }
            .memory-settings-section { margin-top: 26px; padding-top: 20px; border-top: 1px solid #e5e5ea; }
            .memory-settings-section h3 { margin: 0; color: #000; font-size: 17px; font-weight: 600; }
            .memory-model-download { width: 100%; height: 42px; margin-top: 14px; border: 0; border-radius: 10px; background: #007aff; color: #fff; font: 500 15px/42px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; cursor: pointer; }
            .memory-semantic-model-progress { width: 100%; margin-top: 12px; }
            @media (max-width: 360px) { .memory-app-scroll, .memory-role-picker { padding-right: 15px; padding-left: 15px; } .memory-profile-section { padding-top: 18px; } .memory-avatar-shell { width: 78px; height: 78px; } .memory-heading { margin-left: 14px; } .memory-profile-stat { gap: 5px; font-size: 11px !important; } }
        `;
        document.head.appendChild(style);
    }

    function init() {
        ensureStyles();
        if (!root) buildRoot();
        return Promise.resolve();
    }

    function open() {
        if (!root) init();
        root.setAttribute('aria-hidden', 'false');
        root.classList.add('is-open');
        refresh().then(showRolePicker);
    }

    function close() {
        if (!root) return;
        closeComposer();
        closeSummarySettings();
        closeSemanticSettings();
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
        getRelevantFragments,
        runRetrievalEvaluation,
        getSummaryJob,
        completeSummary,
        invalidateSources
    };

    // The chat path reads this in-memory cache only. IndexedDB is warmed in the background.
    void preload();
})();
