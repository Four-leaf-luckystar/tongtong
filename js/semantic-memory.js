(function () {
    'use strict';

    const DB_NAME = 'iOSDesktopDB';
    const STORE_NAME = 'layoutStore';
    const STATE_KEY = 'memorySemanticModelV1';
    const CACHE_PREFIX = 'tonghuaji-semantic-model-';
    let state = {
        status: 'not-configured',
        manifestUrl: '',
        manifest: null,
        downloadedBytes: 0,
        totalBytes: 0,
        error: ''
    };

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
                url: new URL(file.path, baseUrl).href,
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

    async function download(manifestUrl, onProgress) {
        const url = String(manifestUrl || state.manifestUrl || '').trim();
        if (!url) throw new Error('请先填写模型清单地址');
        if (!window.caches) throw new Error('当前浏览器不支持模型缓存');
        setState({ status: 'downloading', manifestUrl: url, manifest: null, downloadedBytes: 0, totalBytes: 0, error: '' });
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error('模型清单下载失败：HTTP ' + response.status);
            const manifest = normalizeManifest(await response.json(), url);
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
        getCachedFile
    };

    void init();
})();
