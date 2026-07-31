(function () {
    'use strict';

    const SUPABASE_URL = 'https://bhiwilnsqqjdnhnoeluv.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QDshTa2vNl6LeAMAZV-Cpw_BGIbxgfd';
    const SESSION_KEY = 'tonghuajiAccessSessionV1';
    const DEVICE_KEY = 'tonghuajiAccessDeviceV1';
    const DATA_PREFIX = 'tonghuaji-access-v1:';
    const ADMIN_QQS = new Set(['1509048968', '3292315195']);
    const nativeIndexedDbOpen = indexedDB.open.bind(indexedDB);
    let activeQq = '';
    let appStartRequested = false;
    let appStarted = false;
    let currentSession = null;

    function getRedirectUrl() {
        return `${location.origin}${location.pathname}`;
    }

    function isQq(value) {
        return /^[1-9]\d{4,11}$/.test(String(value || '').trim());
    }

    function getDeviceId() {
        let deviceId = localStorage.getItem(DEVICE_KEY);
        if (!deviceId) {
            deviceId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            localStorage.setItem(DEVICE_KEY, deviceId);
        }
        return deviceId;
    }

    function getDeviceLabel() {
        const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '浏览器';
        return String(platform).slice(0, 64) || '浏览器';
    }

    function dataDatabaseName(name) {
        if (!activeQq || typeof name !== 'string' || name.startsWith(DATA_PREFIX)) return name;
        return `${DATA_PREFIX}${activeQq}:${name}`;
    }

    // All existing application modules continue to use their original database names.
    // The namespace is switched before initDB() so their records remain account-isolated.
    indexedDB.open = function scopedIndexedDbOpen(name, version) {
        const scopedName = dataDatabaseName(name);
        return arguments.length > 1 ? nativeIndexedDbOpen(scopedName, version) : nativeIndexedDbOpen(scopedName);
    };

    function setNamespace(qq) {
        activeQq = qq;
        document.documentElement.dataset.accessQq = qq;
    }

    function saveSession(session) {
        currentSession = session;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    function clearSession() {
        currentSession = null;
        localStorage.removeItem(SESSION_KEY);
    }

    function readStoredSession() {
        try {
            const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
            return session && session.access_token && session.refresh_token ? session : null;
        } catch (error) {
            return null;
        }
    }

    function sessionFromPayload(payload) {
        return {
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
            expires_at: payload.expires_at || Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
            user: payload.user || null
        };
    }

    async function request(path, options) {
        const response = await fetch(`${SUPABASE_URL}${path}`, {
            ...options,
            headers: {
                apikey: SUPABASE_PUBLISHABLE_KEY,
                'Content-Type': 'application/json',
                ...(options && options.headers ? options.headers : {})
            }
        });
        const text = await response.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch (error) { body = { message: text }; }
        if (!response.ok) {
            const message = body && (body.msg || body.message || body.error_description || body.error) || '请求失败，请稍后重试。';
            const requestError = new Error(message);
            requestError.code = body && body.code;
            throw requestError;
        }
        return body;
    }

    function authRequest(path, method, body, token) {
        return request(`/auth/v1${path}`, {
            method,
            body: body ? JSON.stringify(body) : undefined,
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
    }

    function rpc(name, body, token) {
        return request(`/rest/v1/rpc/${name}`, {
            method: 'POST',
            body: JSON.stringify(body || {}),
            headers: { Authorization: `Bearer ${token}` }
        });
    }

    function getElements() {
        return {
            gate: document.getElementById('appAccessGate'),
            notice: document.querySelector('[data-access-notice]'),
            forms: Array.from(document.querySelectorAll('[data-access-view]')),
            devices: document.querySelector('[data-access-device-list]')
        };
    }

    function showView(name) {
        const { forms } = getElements();
        forms.forEach(form => { form.hidden = form.dataset.accessView !== name; });
        setNotice('');
    }

    function setNotice(message, isError) {
        const { notice } = getElements();
        if (!notice) return;
        notice.textContent = message || '';
        notice.classList.toggle('is-error', Boolean(isError));
    }

    function setBusy(form, busy) {
        form.querySelectorAll('button, input').forEach(element => { element.disabled = busy; });
    }

    function friendlyError(error) {
        if (error && error.message === 'DEVICE_LIMIT') return '已达到两个浏览器上限，请先移除一个旧浏览器。';
        if (error && /资格|paid|开通|entitlement/i.test(error.message)) return '该 QQ 尚未开通登录资格。';
        if (error && /Invalid login credentials/i.test(error.message)) return 'QQ 号或密码不正确。';
        if (error && /Email not confirmed/i.test(error.message)) return '请先到 QQ 邮箱完成验证，再登录。';
        return (error && error.message) || '操作失败，请稍后重试。';
    }

    async function refreshSession(session) {
        if (!session || !session.refresh_token) return null;
        if (Number(session.expires_at || 0) > Math.floor(Date.now() / 1000) + 60) return session;
        const payload = await authRequest('/token?grant_type=refresh_token', 'POST', { refresh_token: session.refresh_token });
        return sessionFromPayload(payload);
    }

    function formQq(form) {
        return String(new FormData(form).get('qq') || '').trim();
    }

    function formPassword(form, field) {
        return String(new FormData(form).get(field || 'password') || '');
    }

    async function completeAccess(session) {
        const bindResult = await rpc('bind_my_paid_qq', {}, session.access_token);
        const bound = Array.isArray(bindResult) ? bindResult[0] : bindResult;
        const qq = bound && bound.qq;
        if (!isQq(qq)) throw new Error('资格校验失败，请重新登录。');
        setNamespace(qq);
        saveSession(session);
        await rpc('claim_my_access_device', {
            p_device_id: getDeviceId(),
            p_device_label: getDeviceLabel()
        }, session.access_token);
        await copyLegacyDataForAdministrator(qq);
        document.documentElement.classList.remove('app-access-pending');
        document.documentElement.classList.add('app-access-ready');
        startApplicationIfReady();
    }

    async function submitLogin(form) {
        const qq = formQq(form);
        const password = formPassword(form);
        if (!isQq(qq)) throw new Error('请输入正确的 QQ 号。');
        if (password.length < 8) throw new Error('密码至少需要 8 位。');
        const payload = await authRequest('/token?grant_type=password', 'POST', { email: `${qq}@qq.com`, password });
        await completeAccess(sessionFromPayload(payload));
    }

    async function submitSetup(form) {
        const qq = formQq(form);
        const password = formPassword(form);
        const confirmed = formPassword(form, 'passwordConfirm');
        if (!isQq(qq)) throw new Error('请输入正确的 QQ 号。');
        if (password.length < 8) throw new Error('密码至少需要 8 位。');
        if (password !== confirmed) throw new Error('两次输入的密码不一致。');
        const payload = await authRequest('/signup', 'POST', {
            email: `${qq}@qq.com`,
            password,
            data: {},
            redirect_to: getRedirectUrl()
        });
        if (payload && payload.session) {
            await completeAccess(sessionFromPayload(payload.session));
            return;
        }
        showView('login');
        setNotice('验证邮件已发送到 QQ 邮箱。完成验证后请返回登录。');
    }

    async function submitRecovery(form) {
        const qq = formQq(form);
        if (!isQq(qq)) throw new Error('请输入正确的 QQ 号。');
        await authRequest('/recover', 'POST', { email: `${qq}@qq.com`, redirect_to: getRedirectUrl() });
        setNotice('若账号已开通，重置邮件已发送到 QQ 邮箱。');
    }

    async function submitReset(form) {
        const password = formPassword(form);
        const confirmed = formPassword(form, 'passwordConfirm');
        if (password.length < 8) throw new Error('密码至少需要 8 位。');
        if (password !== confirmed) throw new Error('两次输入的密码不一致。');
        await authRequest('/user', 'PUT', { password }, currentSession.access_token);
        const cleanUrl = getRedirectUrl();
        history.replaceState({}, '', cleanUrl);
        clearSession();
        showView('login');
        setNotice('密码已更新，请使用新密码登录。');
    }

    async function listDevices() {
        const devices = await rpc('list_my_access_devices', { p_current_device_id: getDeviceId() }, currentSession.access_token);
        const { devices: container } = getElements();
        if (!container) return;
        container.replaceChildren();
        (Array.isArray(devices) ? devices : []).forEach(device => {
            const item = document.createElement('div');
            item.className = 'app-access-device';
            const text = document.createElement('div');
            const title = document.createElement('strong');
            title.textContent = device.is_current ? `${device.device_label || '当前浏览器'}（当前）` : (device.device_label || '浏览器');
            const time = document.createElement('small');
            time.textContent = `最近使用：${new Date(device.last_seen_at).toLocaleString('zh-CN')}`;
            text.append(title, time);
            item.append(text);
            if (!device.is_current) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = '移除';
                button.addEventListener('click', async () => {
                    button.disabled = true;
                    try {
                        await rpc('revoke_my_access_device', { p_device_id: device.device_id }, currentSession.access_token);
                        await listDevices();
                        setNotice('已移除旧浏览器，现在可以重新校验此浏览器。');
                    } catch (error) {
                        setNotice(friendlyError(error), true);
                    } finally {
                        button.disabled = false;
                    }
                });
                item.append(button);
            }
            container.append(item);
        });
    }

    async function showDeviceLimit() {
        showView('devices');
        setNotice('此账号已在两个浏览器中使用。移除一个旧浏览器后再继续。', true);
        await listDevices();
    }

    function startApplicationIfReady() {
        if (!appStartRequested || appStarted || !activeQq) return;
        appStarted = true;
        if (typeof initDB === 'function') initDB();
    }

    window.startTonghuajiApp = function () {
        appStartRequested = true;
        startApplicationIfReady();
    };

    function openRawDatabase(name, version) {
        return new Promise((resolve, reject) => {
            const request = arguments.length > 1 ? nativeIndexedDbOpen(name, version) : nativeIndexedDbOpen(name);
            request.onerror = () => reject(request.error || new Error('本地数据打开失败。'));
            request.onsuccess = () => resolve(request.result);
        });
    }

    async function rawDatabaseExists(name) {
        if (typeof indexedDB.databases !== 'function') return null;
        const databases = await indexedDB.databases();
        return databases.some(database => database.name === name);
    }

    function readStore(database, storeName) {
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const valuesRequest = store.getAll();
            const keysRequest = store.getAllKeys();
            transaction.onerror = () => reject(transaction.error || new Error('本地数据读取失败。'));
            transaction.oncomplete = () => resolve({
                values: valuesRequest.result || [],
                keys: keysRequest.result || [],
                keyPath: store.keyPath,
                autoIncrement: store.autoIncrement,
                indexes: Array.from(store.indexNames).map(indexName => {
                    const index = store.index(indexName);
                    return { name: index.name, keyPath: index.keyPath, unique: index.unique, multiEntry: index.multiEntry };
                })
            });
        });
    }

    function openTargetDatabase(name, version, stores) {
        return new Promise((resolve, reject) => {
            const request = nativeIndexedDbOpen(name, version);
            request.onerror = () => reject(request.error || new Error('本地数据副本创建失败。'));
            request.onupgradeneeded = () => {
                const database = request.result;
                stores.forEach(store => {
                    if (database.objectStoreNames.contains(store.name)) return;
                    const targetStore = database.createObjectStore(store.name, { keyPath: store.keyPath || undefined, autoIncrement: store.autoIncrement });
                    store.indexes.forEach(index => targetStore.createIndex(index.name, index.keyPath, { unique: index.unique, multiEntry: index.multiEntry }));
                });
            };
            request.onsuccess = () => resolve(request.result);
        });
    }

    async function cloneDatabase(sourceName, targetName) {
        if (await rawDatabaseExists(targetName) === true) return;
        if (await rawDatabaseExists(sourceName) === false) return;
        const source = await openRawDatabase(sourceName);
        try {
            const stores = [];
            for (const name of Array.from(source.objectStoreNames)) {
                stores.push({ name, ...(await readStore(source, name)) });
            }
            const target = await openTargetDatabase(targetName, source.version, stores);
            try {
                for (const store of stores) {
                    await new Promise((resolve, reject) => {
                        const transaction = target.transaction(store.name, 'readwrite');
                        const targetStore = transaction.objectStore(store.name);
                        store.values.forEach((value, index) => {
                            if (store.keyPath === null) targetStore.put(value, store.keys[index]);
                            else targetStore.put(value);
                        });
                        transaction.onerror = () => reject(transaction.error || new Error('本地数据复制失败。'));
                        transaction.oncomplete = () => resolve();
                    });
                }
            } finally {
                target.close();
            }
        } finally {
            source.close();
        }
    }

    async function copyLegacyDataForAdministrator(qq) {
        if (!ADMIN_QQS.has(qq)) return;
        for (const administratorQq of ADMIN_QQS) {
            const marker = `${DATA_PREFIX}legacy-copy:${administratorQq}`;
            if (localStorage.getItem(marker)) continue;
            const targetName = `${DATA_PREFIX}${administratorQq}:iOSDesktopDB`;
            await cloneDatabase('iOSDesktopDB', targetName);
            localStorage.setItem(marker, '1');
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        setBusy(form, true);
        setNotice('');
        try {
            if (form.dataset.accessView === 'login') await submitLogin(form);
            if (form.dataset.accessView === 'setup') await submitSetup(form);
            if (form.dataset.accessView === 'recovery') await submitRecovery(form);
            if (form.dataset.accessView === 'reset') await submitReset(form);
        } catch (error) {
            if (error && error.message === 'DEVICE_LIMIT') await showDeviceLimit();
            else setNotice(friendlyError(error), true);
        } finally {
            setBusy(form, false);
        }
    }

    function bindUi() {
        document.querySelectorAll('[data-access-view]').forEach(form => form.addEventListener('submit', handleFormSubmit));
        document.querySelectorAll('[data-access-action]').forEach(button => {
            button.addEventListener('click', async () => {
                const action = button.dataset.accessAction;
                if (action === 'show-login') showView('login');
                if (action === 'show-setup') showView('setup');
                if (action === 'show-recovery') showView('recovery');
                if (action === 'retry-device') {
                    button.disabled = true;
                    try { await completeAccess(currentSession); } catch (error) {
                        if (error && error.message === 'DEVICE_LIMIT') await showDeviceLimit();
                        else setNotice(friendlyError(error), true);
                    } finally { button.disabled = false; }
                }
            });
        });
    }

    async function bootstrapRecovery() {
        const params = new URLSearchParams(location.hash.replace(/^#/, ''));
        if (params.get('type') !== 'recovery' || !params.get('access_token')) return false;
        currentSession = {
            access_token: params.get('access_token'),
            refresh_token: params.get('refresh_token') || '',
            expires_at: Number(params.get('expires_at') || 0)
        };
        showView('reset');
        setNotice('请设置新的登录密码。');
        return true;
    }

    async function bootstrap() {
        bindUi();
        if (await bootstrapRecovery()) return;
        const storedSession = readStoredSession();
        if (!storedSession) return;
        setNotice('正在校验登录状态…');
        try {
            const session = await refreshSession(storedSession);
            await completeAccess(session);
        } catch (error) {
            clearSession();
            if (error && error.message === 'DEVICE_LIMIT') await showDeviceLimit();
            else setNotice('登录状态已失效，请重新登录。', true);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    else bootstrap();
}());
