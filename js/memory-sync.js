(function () {
    'use strict';

    const DB_NAME = 'iOSDesktopDB';
    const STORE_NAME = 'layoutStore';
    const SETTINGS_KEY = 'memoryExternalSettingsV1';
    const CREDENTIALS_KEY = 'memoryExternalCredentialsV1';
    const STATE_KEY = 'memoryExternalSyncStateV1';
    let settings = { enabled: false, provider: 'http', baseUrl: '', namespace: '', scope: { roles: 'current', tiers: ['L1'], includeChat: false, includeArchived: false }, autoSync: true };
    let credentials = {};
    let state = { records: {}, conflicts: [], bindingIds: [], lastSyncAt: '', pending: false, error: '' };
    let timer = 0;
    let initialized = false;

    function read(key) {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => resolve(null);
            request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) { db.close(); resolve(null); return; }
                const tx = db.transaction(STORE_NAME, 'readonly');
                const get = tx.objectStore(STORE_NAME).get(key);
                get.onsuccess = () => resolve(get.result || null);
                tx.oncomplete = () => db.close();
                tx.onerror = () => { db.close(); resolve(null); };
            };
        });
    }
    function write(record) {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => resolve(false);
            request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) { db.close(); resolve(false); return; }
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put(record);
                tx.oncomplete = () => { db.close(); resolve(true); };
                tx.onerror = () => { db.close(); resolve(false); };
            };
        });
    }
    const json = (value) => JSON.stringify(value || {});
    const fingerprint = (record) => json({ id: record.id, status: record.status || 'active', content: String(record.content || ''), sections: record.sections || null });
    const safeUrl = (base, path) => String(base || '').replace(/\/$/, '') + '/' + String(path || '').replace(/^\//, '');
    function scopeFor(bindingId) { const root = settings.namespace || 'tonghuaji-user'; return { ...settings.scope, bindingId, namespace: root + ':' + bindingId }; }
    function authHeaders() {
        const token = credentials.token || credentials.apiKey || '';
        return token ? { Authorization: 'Bearer ' + token } : {};
    }
    function zepHeaders() { const token = credentials.apiKey || credentials.token || ''; return token ? { Authorization: 'Api-Key ' + token } : {}; }
    async function request(url, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Number(options.timeout || 9000));
        try {
            const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
            const response = await fetch(url, { ...options, headers, signal: controller.signal });
            const text = await response.text();
            let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
            if (!response.ok) throw new Error((data && (data.message || data.error)) || ('HTTP ' + response.status));
            return data;
        } finally { clearTimeout(timeout); }
    }
    function canonicalRemote(item) {
        if (!item) return null;
        let dataPayload = {};
        if (typeof item.data === 'string' && item.data.trim().startsWith('{')) { try { dataPayload = JSON.parse(item.data); } catch (_) {} }
        const payload = item.payload && typeof item.payload === 'object' ? item.payload : (item.metadata?.tonghuaji_payload || dataPayload || {});
        const metadata = item.metadata || {};
        const id = payload.id || item.clientId || item.client_id || metadata.tonghuaji_id || item.id || item.uuid;
        if (!id) return null;
        return { ...item, ...metadata, ...payload, id: String(id), remoteId: String(item.id || item.uuid || id), bindingId: payload.bindingId || item.bindingId || item.binding_id || metadata.bindingId, content: String(payload.content || item.content || item.text || item.data || ''), status: payload.status || metadata.status || item.status || 'active', updatedAt: payload.updatedAt || metadata.updatedAt || item.updatedAt || item.updated_at || item.createdAt || new Date().toISOString(), metadata };
    }
    function provider() {
        const type = settings.provider;
        if (type === 'mem0') return {
            async test() { return request(safeUrl(settings.baseUrl || 'https://api.mem0.ai', '/v3/memories/search/'), { method: 'POST', headers: { Authorization: 'Token ' + (credentials.apiKey || credentials.token) }, body: json({ query: 'healthcheck', filters: { user_id: scopeFor('health').namespace }, top_k: 1 }) }); },
            async list(scope) { const r = await request(safeUrl(settings.baseUrl || 'https://api.mem0.ai', '/v3/memories/?page=1&page_size=100'), { method: 'POST', headers: { Authorization: 'Token ' + (credentials.apiKey || credentials.token) }, body: json({ filters: { user_id: scope.namespace } }) }); return (Array.isArray(r) ? r : (r.results || r.memories || [])).map(canonicalRemote).filter(Boolean); },
            async search(query, scope) { const r = await request(safeUrl(settings.baseUrl || 'https://api.mem0.ai', '/v3/memories/search/'), { method: 'POST', headers: { Authorization: 'Token ' + (credentials.apiKey || credentials.token) }, body: json({ query, filters: { user_id: scope.namespace }, top_k: 6 }) }); return (Array.isArray(r) ? r : (r.results || r.memories || [])).map(canonicalRemote).filter(Boolean); },
            async upsert(record, scope, remote) { const metadata = { tonghuaji_id: record.id, tonghuaji_payload: record, bindingId: record.bindingId, kind: record.kind, tier: record.tier, status: record.status, updatedAt: record.updatedAt }; if (remote && remote.remoteId) return request(safeUrl(settings.baseUrl || 'https://api.mem0.ai', '/v1/memories/' + encodeURIComponent(remote.remoteId) + '/'), { method: 'PUT', headers: { Authorization: 'Token ' + (credentials.apiKey || credentials.token) }, body: json({ text: record.content, metadata, user_id: scope.namespace }) }); return request(safeUrl(settings.baseUrl || 'https://api.mem0.ai', '/v3/memories/add/'), { method: 'POST', headers: { Authorization: 'Token ' + (credentials.apiKey || credentials.token) }, body: json({ messages: [{ role: 'user', content: record.content }], user_id: scope.namespace, infer: false, metadata }) }); },
            async remove(remote) { if (!remote?.remoteId) return true; await request(safeUrl(settings.baseUrl || 'https://api.mem0.ai', '/v1/memories/' + encodeURIComponent(remote.remoteId) + '/'), { method: 'DELETE', headers: { Authorization: 'Token ' + (credentials.apiKey || credentials.token) } }); return true; }
        };
        if (type === 'zep') return {
            async test() { const scope = scopeFor('health'); return request(safeUrl(settings.baseUrl || 'https://api.getzep.com/api/v2', '/users/' + encodeURIComponent(scope.namespace)), { headers: zepHeaders() }).catch(() => request(safeUrl(settings.baseUrl || 'https://api.getzep.com/api/v2', '/users'), { method: 'POST', headers: zepHeaders(), body: json({ user_id: scope.namespace, email: scope.namespace + '@local.invalid' }) })); },
            async list(scope) { const r = await request(safeUrl(settings.baseUrl || 'https://api.getzep.com/api/v2', '/graph/episodes/user/' + encodeURIComponent(scope.namespace) + '?lastn=1000'), { headers: zepHeaders() }); return (Array.isArray(r) ? r : (r.episodes || r.data || [])).map(canonicalRemote).filter(Boolean); },
            async search(query, scope) { const r = await request(safeUrl(settings.baseUrl || 'https://api.getzep.com/api/v2', '/graph/search'), { method: 'POST', headers: zepHeaders(), body: json({ user_id: scope.namespace, query, limit: 6 }) }); return (Array.isArray(r) ? r : (r.results || r.data || [])).map(canonicalRemote).filter(Boolean); },
            async upsert(record, scope, remote) { await request(safeUrl(settings.baseUrl || 'https://api.getzep.com/api/v2', '/users'), { method: 'POST', headers: zepHeaders(), body: json({ user_id: scope.namespace, email: scope.namespace + '@local.invalid' }) }).catch(() => null); if (remote?.remoteId) await this.remove(remote); return request(safeUrl(settings.baseUrl || 'https://api.getzep.com/api/v2', '/graph'), { method: 'POST', headers: zepHeaders(), body: json({ data: JSON.stringify(record), type: 'text', user_id: scope.namespace, metadata: { tonghuaji_id: record.id, bindingId: record.bindingId, kind: record.kind, tier: record.tier, status: record.status, updatedAt: record.updatedAt } }) }); },
            async remove(remote) { if (!remote?.remoteId) return true; await request(safeUrl(settings.baseUrl || 'https://api.getzep.com/api/v2', '/graph/episodes/' + encodeURIComponent(remote.remoteId)), { method: 'DELETE', headers: zepHeaders() }); return true; }
        };
        if (type === 'supabase') return {
            headers() { return { apikey: credentials.apiKey || '', ...(credentials.token ? { Authorization: 'Bearer ' + credentials.token } : {}) }; },
            async test() { return request(safeUrl(settings.baseUrl, '/rest/v1/' + (credentials.table || 'tonghuaji_memories') + '?select=id&limit=1'), { headers: this.headers() }); },
            async list(scope) { const r = await request(safeUrl(settings.baseUrl, '/rest/v1/' + (credentials.table || 'tonghuaji_memories') + '?user_id=eq.' + encodeURIComponent(scope.namespace) + '&select=*'), { headers: this.headers() }); return (r || []).map(canonicalRemote).filter(Boolean); },
            async search(query, scope) { const all = await this.list(scope); return all.filter((item) => item.content.toLowerCase().includes(String(query || '').toLowerCase())).slice(0, 6); },
            async upsert(record, scope) { const table = credentials.table || 'tonghuaji_memories'; const body = { id: record.id, client_id: record.id, user_id: scope.namespace, binding_id: record.bindingId, kind: record.kind, tier: record.tier, status: record.status, content: record.content, payload: record, updated_at: record.updatedAt }; return request(safeUrl(settings.baseUrl, '/rest/v1/' + table + '?on_conflict=owner_id%2Cid'), { method: 'POST', headers: { ...this.headers(), Prefer: 'resolution=merge-duplicates,return=representation' }, body: json(body) }); },
            async remove(remote) { if (!remote?.remoteId) return true; await request(safeUrl(settings.baseUrl, '/rest/v1/' + (credentials.table || 'tonghuaji_memories') + '?id=eq.' + encodeURIComponent(remote.remoteId)), { method: 'DELETE', headers: this.headers() }); return true; }
        };
        return {
            async test() { return request(safeUrl(settings.baseUrl, '/health'), { headers: authHeaders() }); },
            async list(scope) { const r = await request(safeUrl(settings.baseUrl, '/list?scope=' + encodeURIComponent(scope.namespace)), { headers: authHeaders() }); return (Array.isArray(r) ? r : (r.records || r.data || [])).map(canonicalRemote).filter(Boolean); },
            async search(query, scope) { const r = await request(safeUrl(settings.baseUrl, '/search'), { method: 'POST', headers: authHeaders(), body: json({ query, scope, limit: 6 }) }); return (Array.isArray(r) ? r : (r.records || r.results || r.data || [])).map(canonicalRemote).filter(Boolean); },
            async upsert(record, scope) { return request(safeUrl(settings.baseUrl, '/records/' + encodeURIComponent(record.id)), { method: 'PUT', headers: authHeaders(), body: json({ ...record, scope: scope.namespace }) }); },
            async remove(record) { const scope = record.scope?.namespace || record.scope || ''; await request(safeUrl(settings.baseUrl, '/records/' + encodeURIComponent(record.id) + '?scope=' + encodeURIComponent(scope)), { method: 'DELETE', headers: authHeaders() }); return true; }
        };
    }
    async function init() { if (initialized) return; initialized = true; const [s, c, st] = await Promise.all([read(SETTINGS_KEY), read(CREDENTIALS_KEY), read(STATE_KEY)]); settings = { ...settings, ...(s || {}), scope: { ...settings.scope, ...(s?.scope || {}) } }; credentials = c?.value || {}; state = { ...state, ...(st || {}), records: st?.records || {}, conflicts: Array.isArray(st?.conflicts) ? st.conflicts : [], bindingIds: Array.isArray(st?.bindingIds) ? st.bindingIds : [] }; }
    async function saveConfig(next, secret) { await init(); settings = { ...settings, ...next }; credentials = { ...credentials, ...(secret || {}) }; await Promise.all([write({ id: SETTINGS_KEY, ...settings }), write({ id: CREDENTIALS_KEY, value: credentials }), write({ id: STATE_KEY, ...state })]); return settings; }
    function selectedRecords(bindingId) { const selectedBinding = settings.scope?.roles === 'all' ? '' : bindingId; const snapshot = window.MemoryApp?.getSyncSnapshot ? window.MemoryApp.getSyncSnapshot(selectedBinding, settings.scope) : []; return Array.isArray(snapshot) ? snapshot : []; }
    async function syncNow(bindingId) {
        await init(); if (!settings.enabled || !settings.baseUrl) return { skipped: true };
        state.pending = true; state.error = ''; await write({ id: STATE_KEY, ...state });
        const adapter = provider();
        try {
            const local = selectedRecords(bindingId);
            const bindingIds = Array.from(new Set(local.map((record) => record.bindingId).filter(Boolean)));
            if (!bindingIds.length && bindingId) bindingIds.push(bindingId);
            state.bindingIds = Array.from(new Set([...(state.bindingIds || []), ...bindingIds]));
            let restored = 0;
            for (const currentBindingId of bindingIds) {
                const scope = scopeFor(currentBindingId);
                const localGroup = local.filter((record) => record.bindingId === currentBindingId);
                const remote = await adapter.list(scope);
                const remoteById = new Map(remote.map((item) => [String(item.id), item]));
                for (const record of localGroup) {
                    const previous = state.records[record.id];
                    const remoteItem = remoteById.get(record.id);
                    if (record.status === 'archived' || record.status === 'superseded') { if (remoteItem || previous) await adapter.remove({ remoteId: remoteItem?.remoteId || previous?.remoteId || record.id, id: record.id, scope }); delete state.records[record.id]; continue; }
                    const localFingerprint = fingerprint(record);
                    const remoteFingerprint = remoteItem ? fingerprint(remoteItem) : '';
                    const localChanged = Boolean(previous && previous.fingerprint !== localFingerprint);
                    const remoteChanged = Boolean(previous && remoteItem && previous.remoteFingerprint !== remoteFingerprint);
                    if (previous?.remoteConfirmed && !remoteItem && !localChanged) {
                        await window.MemoryApp?.mergeSyncRecords?.([{ ...record, status: 'archived', archiveReason: 'remote_deleted', updatedAt: new Date().toISOString() }], scope);
                        delete state.records[record.id];
                        continue;
                    }
                    if (previous && remoteItem && !localChanged && remoteChanged) {
                        await window.MemoryApp?.mergeSyncRecords?.([remoteItem], scope);
                        state.records[record.id] = { fingerprint: remoteFingerprint, remoteFingerprint, remoteId: remoteItem.remoteId || remoteItem.id, remoteConfirmed: true, lastSyncedAt: new Date().toISOString() };
                        continue;
                    }
                    if (previous && remoteItem && localChanged && remoteChanged) {
                        state.conflicts = [{ id: record.id, bindingId: record.bindingId, local: record, remote: remoteItem, resolved: 'local', createdAt: new Date().toISOString() }, ...state.conflicts.filter((item) => item.id !== record.id)].slice(0, 50);
                    }
                    if (remoteItem && !localChanged && !remoteChanged) {
                        state.records[record.id] = { ...previous, remoteId: remoteItem.remoteId || remoteItem.id, remoteConfirmed: true, lastSyncedAt: new Date().toISOString() };
                        continue;
                    }
                    // Mem0 and Zep can acknowledge a write before it appears in list results.
                    // Keep the accepted local version pending instead of creating duplicates.
                    if (!remoteItem && previous && !localChanged && !previous.remoteConfirmed) continue;
                    const result = await adapter.upsert(record, scope, remoteItem ? { remoteId: remoteItem.remoteId || remoteItem.id } : previous);
                    const responseRecord = canonicalRemote(Array.isArray(result) ? result[0] : result);
                    const stableId = responseRecord?.remoteId || remoteItem?.remoteId || previous?.remoteId || record.id;
                    state.records[record.id] = { fingerprint: localFingerprint, remoteFingerprint: localFingerprint, remoteId: stableId, remoteConfirmed: Boolean(responseRecord || remoteItem || settings.provider === 'http' || settings.provider === 'supabase'), pendingUntil: (!responseRecord && !remoteItem && (settings.provider === 'mem0' || settings.provider === 'zep')) ? new Date(Date.now() + 60000).toISOString() : '', lastSyncedAt: new Date().toISOString() };
                }
                const remoteOnly = remote.filter((item) => !localGroup.some((record) => record.id === item.id));
                if (remoteOnly.length && window.MemoryApp?.mergeSyncRecords) restored += await window.MemoryApp.mergeSyncRecords(remoteOnly, scope);
            }
            state.lastSyncAt = new Date().toISOString(); state.pending = false; await write({ id: STATE_KEY, ...state });
            return { uploaded: local.filter((record) => record.status === 'active').length, restored, conflicts: state.conflicts.length };
        } catch (error) { state.pending = false; state.error = String(error.message || error); await write({ id: STATE_KEY, ...state }); throw error; }
    }
    async function restoreNow(bindingId) { await init(); if (!settings.enabled || !settings.baseUrl) return { skipped: true }; const adapter = provider(); const local = selectedRecords(bindingId); const bindingIds = settings.scope?.roles === 'all' ? Array.from(new Set([...(state.bindingIds || []), ...local.map((record) => record.bindingId).filter(Boolean)])) : [bindingId]; let restored = 0; for (const currentBindingId of bindingIds.filter(Boolean)) { const remote = await adapter.list(scopeFor(currentBindingId)); if (remote.length && window.MemoryApp?.mergeSyncRecords) restored += await window.MemoryApp.mergeSyncRecords(remote, scopeFor(currentBindingId)); } state.lastSyncAt = new Date().toISOString(); state.error = ''; await write({ id: STATE_KEY, ...state }); return { restored }; }
    function schedule(bindingId) { if (settings.autoSync === false) return; clearTimeout(timer); timer = setTimeout(() => void syncNow(bindingId).catch(() => null), 2200); }
    async function search(bindingId, query) { await init(); if (!settings.enabled || !settings.baseUrl || !query) return []; try { return await provider().search(query, scopeFor(bindingId)); } catch (_) { return []; } }
    window.MemorySync = { init, getSettings: () => ({ ...settings, scope: { ...settings.scope, tiers: [...(settings.scope?.tiers || ['L1'])] } }), saveConfig, testConnection: async () => { await init(); return provider().test(); }, syncNow, restoreNow, schedule, search, getStatus: () => ({ ...state, conflicts: state.conflicts.length }) };
    void init();
})();
