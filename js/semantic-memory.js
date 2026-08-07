(function () {
    'use strict';

    const DB_NAME = 'iOSDesktopDB';
    const STORE_NAME = 'layoutStore';
    const STATE_KEY = 'memorySemanticModelV1';
    const CACHE_PREFIX = 'tonghuaji-semantic-model-';
    const DEFAULT_MODEL_SOURCE = 'https://huggingface.co/Xenova/bge-small-zh-v1.5';
    const DEFAULT_MODEL_REVISION = '75c43b069aac4d136ba6bc1122f995fedcfd2781';
    const DEFAULT_MODEL_MANIFEST = {
        version: 'bge-small-zh-v1.5-20260805',
        name: 'BGE Small 中文语义记忆模型',
        engine: 'transformers.js',
        modelId: 'Xenova/bge-small-zh-v1.5',
        files: [
            { path: 'config.json', bytes: 716, sha256: 'd4193ead3a810fd694fa8a31d7fc72fbaebc0668b603e398734bf2f6538ff42f' },
            { path: 'special_tokens_map.json', bytes: 125, sha256: 'b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3' },
            { path: 'tokenizer.json', bytes: 439125, sha256: '48cea5d44424912a6fd1ea647bf4fe50b55ab8b1e5879c3275f80e339e8fae26' },
            { path: 'tokenizer_config.json', bytes: 367, sha256: 'e6f3b96db926a37d4039995fbf5ad17de158dfb8f6343d607e4dbaad18d75f5a' },
            { path: 'vocab.txt', bytes: 109540, sha256: '45bbac6b341c319adc98a532532882e91a9cefc0329aa57bac9ae761c27b291c' },
            { path: 'onnx/model_quantized.onnx', bytes: 24010842, sha256: '15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc' }
        ]
    };
    const REMOTE_STATE_KEY = 'memorySemanticRemoteV1';
    const DEFAULT_REMOTE_CONFIG = {
        provider: 'siliconflow',
        baseUrl: 'https://api.siliconflow.cn/v1',
        apiKey: '',
        model: 'BAAI/bge-m3',
        models: [],
        status: 'not-configured',
        error: ''
    };
    let state = {
        status: 'not-configured',
        manifestUrl: '',
        manifest: null,
        downloadedBytes: 0,
        totalBytes: 0,
        error: ''
    };
    let remoteConfig = { ...DEFAULT_REMOTE_CONFIG };

    function readState() {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => resolve(null);
            request.onsuccess = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.close();
                    resolve(null);
                    return;
                }
                const transaction = database.transaction(STORE_NAME, 'readonly');
                const getRequest = transaction.objectStore(STORE_NAME).get(STATE_KEY);
                getRequest.onsuccess = () => {
                    database.close();
                    resolve(getRequest.result || null);
                };
                getRequest.onerror = () => {
                    database.close();
                    resolve(null);
                };
            };
        });
    }

    function writeState() {
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
                transaction.objectStore(STORE_NAME).put({
                    id: STATE_KEY,
                    schemaVersion: 1,
                    status: state.status,
                    manifestUrl: state.manifestUrl,
                    manifest: state.manifest,
                    downloadedBytes: state.downloadedBytes,
                    totalBytes: state.totalBytes,
                    error: state.error,
                    updatedAt: new Date().toISOString()
                });
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

    function emitStatus() {
        window.dispatchEvent(new CustomEvent('semanticmemory:status', { detail: { ...state } }));
    }

    function readRemoteConfig() {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => resolve(null);
            request.onsuccess = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) { database.close(); resolve(null); return; }
                const getRequest = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(REMOTE_STATE_KEY);
                getRequest.onsuccess = () => { database.close(); resolve(getRequest.result || null); };
                getRequest.onerror = () => { database.close(); resolve(null); };
            };
        });
    }

    function writeRemoteConfig() {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => resolve(false);
            request.onsuccess = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) { database.close(); resolve(false); return; }
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                transaction.objectStore(STORE_NAME).put({ id: REMOTE_STATE_KEY, schemaVersion: 1, ...remoteConfig, updatedAt: new Date().toISOString() });
                transaction.oncomplete = () => { database.close(); resolve(true); };
                transaction.onerror = () => { database.close(); resolve(false); };
            };
        });
    }

    async function initRemote() {
        const saved = await readRemoteConfig();
        if (saved) remoteConfig = { ...DEFAULT_REMOTE_CONFIG, ...saved, models: Array.isArray(saved.models) ? saved.models : [] };
        return { ...remoteConfig, apiKey: remoteConfig.apiKey ? 'configured' : '' };
    }

    async function saveRemoteConfig(next) {
        remoteConfig = { ...remoteConfig, ...(next || {}) };
        if (Array.isArray(next?.models)) remoteConfig.models = next.models.slice(0, 200);
        await writeRemoteConfig();
        return { ...remoteConfig, apiKey: remoteConfig.apiKey ? 'configured' : '' };
    }

    async function pullRemoteModels(next) {
        const config = { ...remoteConfig, ...(next || {}) };
        const baseUrl = String(config.baseUrl || DEFAULT_REMOTE_CONFIG.baseUrl).replace(/\/+$/, '');
        const apiKey = String(config.apiKey || remoteConfig.apiKey || '').trim();
        if (!apiKey) throw new Error('请先填写硅基流动 API Key');
        const response = await fetch(baseUrl + '/models', { headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' }, cache: 'no-store' });
        if (!response.ok) throw new Error('模型列表拉取失败：HTTP ' + response.status);
        const payload = await response.json();
        const models = (Array.isArray(payload) ? payload : payload.data || [])
            .map((item) => typeof item === 'string' ? { id: item, type: '' } : { id: item && (item.id || item.name), type: item && (item.type || item.task || '') })
            .filter((item) => item.id && (/embed|embedding|bge|gte|e5|jina/i.test(String(item.id)) || /embed/i.test(String(item.type))))
            .map((item) => String(item.id));
        remoteConfig = { ...remoteConfig, ...config, models: Array.from(new Set(models)), status: 'ready', error: '' };
        await writeRemoteConfig();
        return { ...remoteConfig, apiKey: remoteConfig.apiKey ? 'configured' : '' };
    }

    async function testRemote(next) {
        try { await pullRemoteModels(next); return true; }
        catch (error) { remoteConfig = { ...remoteConfig, status: 'error', error: String(error.message || error) }; await writeRemoteConfig(); throw error; }
    }

    function setState(patch) {
        state = { ...state, ...patch };
        emitStatus();
        void writeState();
    }

    function normalizeManifest(raw, manifestUrl) {
        if (!raw || typeof raw !== 'object' || !raw.version || !Array.isArray(raw.files) || raw.files.length === 0) {
            throw new Error('模型清单缺少 version 或 files');
        }
        const baseUrl = new URL(manifestUrl, window.location.href);
        const files = raw.files.map((file) => {
            if (!file || !file.path) throw new Error('模型清单存在无效文件');
            return {
                path: String(file.path),
                url: new URL(file.url || file.path, baseUrl).href,
                bytes: Math.max(0, Number(file.bytes) || 0),
                sha256: String(file.sha256 || '').toLowerCase()
            };
        });
        return {
            version: String(raw.version),
            name: String(raw.name || '语义记忆模型'),
            engine: String(raw.engine || 'transformers.js'),
            modelId: String(raw.modelId || ''),
            baseUrl: baseUrl.href,
            files
        };
    }

    async function digestSha256(bytes) {
        if (!window.crypto?.subtle) return '';
        const digest = await window.crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
    }

    async function cacheModel(manifest, onProgress) {
        const totalBytes = manifest.files.reduce((total, file) => total + file.bytes, 0);
        const cache = await caches.open(CACHE_PREFIX + manifest.version);
        let downloadedBytes = 0;
        setState({ manifest, totalBytes });

        for (const file of manifest.files) {
            const fileResponse = await fetch(file.url, { cache: 'no-store' });
            if (!fileResponse.ok) throw new Error('模型文件下载失败：' + file.path);
            const bytes = await fileResponse.arrayBuffer();
            const actualHash = await digestSha256(bytes);
            if (file.sha256 && actualHash && file.sha256 !== actualHash) {
                throw new Error('模型文件校验失败：' + file.path);
            }
            await cache.put(file.url, new Response(bytes, {
                headers: { 'Content-Type': fileResponse.headers.get('Content-Type') || 'application/octet-stream' }
            }));
            downloadedBytes += bytes.byteLength;
            setState({ downloadedBytes });
            if (typeof onProgress === 'function') onProgress(downloadedBytes, totalBytes, file.path);
        }

        setState({ status: 'ready', manifest, downloadedBytes, totalBytes, error: '' });
        return { ...state };
    }

    async function download(manifestUrl, onProgress) {
        const url = String(manifestUrl || state.manifestUrl || '').trim();
        if (!window.caches) throw new Error('当前浏览器不支持模型缓存');
        setState({ status: 'downloading', manifestUrl: url, manifest: null, downloadedBytes: 0, totalBytes: 0, error: '' });
        try {
            if (!url) {
                const manifest = normalizeManifest({
                    ...DEFAULT_MODEL_MANIFEST,
                    files: DEFAULT_MODEL_MANIFEST.files.map((file) => ({
                        ...file,
                        url: DEFAULT_MODEL_SOURCE + '/resolve/' + DEFAULT_MODEL_REVISION + '/' + file.path
                    }))
                }, DEFAULT_MODEL_SOURCE);
                return await cacheModel(manifest, onProgress);
            }
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error('模型清单下载失败：HTTP ' + response.status);
            const manifest = normalizeManifest(await response.json(), url);
            return await cacheModel(manifest, onProgress);
        } catch (error) {
            setState({ status: 'error', error: String(error && error.message || error) });
            throw error;
        }
    }

    async function remove() {
        if (state.manifest) await caches.delete(CACHE_PREFIX + state.manifest.version);
        setState({ status: 'not-configured', manifestUrl: state.manifestUrl, manifest: null, downloadedBytes: 0, totalBytes: 0, error: '' });
    }

    async function getCachedFile(path) {
        if (!state.manifest || !window.caches) return null;
        const file = state.manifest.files.find((entry) => entry.path === path);
        if (!file) return null;
        const cache = await caches.open(CACHE_PREFIX + state.manifest.version);
        return cache.match(file.url);
    }

    async function init() {
        const saved = await readState();
        if (!saved) return { ...state };
        state = {
            ...state,
            status: saved.status === 'ready' ? 'ready' : (saved.status || 'not-configured'),
            manifestUrl: saved.manifestUrl || '',
            manifest: saved.manifest || null,
            downloadedBytes: Number(saved.downloadedBytes) || 0,
            totalBytes: Number(saved.totalBytes) || 0,
            error: saved.error || ''
        };
        emitStatus();
        return { ...state };
    }

    window.SemanticMemory = {
        init,
        getState: () => ({ ...state }),
        download,
        remove,
        getCachedFile,
        initRemote,
        getRemoteConfig: () => ({ ...remoteConfig, apiKey: remoteConfig.apiKey ? 'configured' : '' }),
        saveRemoteConfig,
        pullRemoteModels,
        testRemote
    };

    void init();
})();
