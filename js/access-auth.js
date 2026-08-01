(function () {
    'use strict';

    const SUPABASE_URL = 'https://bhiwilnsqqjdnhnoeluv.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QDshTa2vNl6LeAMAZV-Cpw_BGIbxgfd';
    const SESSION_KEY = 'tonghuajiAccessSessionV1';
    const DEVICE_KEY = 'tonghuajiAccessDeviceV1';
    const DATA_PREFIX = 'tonghuaji-access-v1:';
    const nativeIndexedDbOpen = indexedDB.open.bind(indexedDB);
    let activeQq = '';
    let appStartRequested = false;
    let appStarted = false;
    let currentSession = null;
    let accessDeviceCheckInFlight = false;
    let accessDeviceMonitorStarted = false;
    let accessDeviceSessionRpcAvailable = true;

    function getRedirectUrl() {
        return `${location.origin}${location.pathname}`;
    }

    function normalizeQq(value) {
        return String(value || '')
            .replace(/[０-９]/g, character => String.fromCharCode(character.charCodeAt(0) - 0xFEE0))
            .replace(/[\s\u200B-\u200D\uFEFF]/g, '');
    }

    function isQq(value) {
        return /^[1-9]\d{4,11}$/.test(normalizeQq(value));
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

    function getBrowserLabel() {
        const userAgent = navigator.userAgent || '';
        const match = userAgent.match(/(Edg|OPR|Chrome|CriOS|Firefox|FxiOS|Version)\/([\d.]+)/);
        if (!match) return '未知浏览器';
        const names = { Edg: 'Microsoft Edge', OPR: 'Opera', Chrome: 'Chrome', CriOS: 'Chrome', Firefox: 'Firefox', FxiOS: 'Firefox', Version: 'Safari' };
        return `${names[match[1]] || match[1]} ${match[2]}`.slice(0, 96);
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

    function getAuthSessionId(accessToken) {
        try {
            const payloadPart = String(accessToken || '').split('.')[1];
            if (!payloadPart) return '';
            const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
            const sessionId = JSON.parse(atob(padded)).session_id;
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(sessionId || '')) ? sessionId : '';
        } catch (error) {
            return '';
        }
    }

    function isMissingSessionDeviceRpc(error) {
        return /could not find the function|function .* does not exist/i.test(String(error && error.message || ''));
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
        const panel = document.querySelector('.app-access-panel');
        if (panel) panel.dataset.accessActiveView = name;
        const tabs = Array.from(document.querySelectorAll('[data-access-tab]'));
        tabs.forEach(tab => {
            const active = tab.dataset.accessTab === name;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        });
        const tabList = document.querySelector('[data-access-tabs]');
        if (tabList) tabList.hidden = name !== 'login' && name !== 'setup';
        setNotice('');
    }

    function setNotice(message, isError) {
        const { notice } = getElements();
        if (!notice) return;
        notice.textContent = message || '';
        notice.classList.toggle('is-error', Boolean(isError));
    }

    function setBusy(form, busy) {
        form.querySelectorAll('button').forEach(element => { element.disabled = busy; });
    }

    function friendlyError(error) {
        if (error && error.message === 'DEVICE_LIMIT') return '已达到两个浏览器上限，请先移除一个旧浏览器。';
        if (error && /资格|paid|开通|entitlement/i.test(error.message)) return '该 QQ 尚未开通登录资格。';
        if (error && /Invalid login credentials/i.test(error.message)) return 'QQ 号或密码不正确。';
        if (error && /New password should be different from the old password/i.test(error.message)) return '新密码不能与当前密码相同。';
        if (error && /Email not confirmed/i.test(error.message)) return '请先到 QQ 邮箱完成验证，再登录。';
        return (error && error.message) || '操作失败，请稍后重试。';
    }

    async function refreshSession(session) {
        if (!session || !session.refresh_token) return null;
        if (Number(session.expires_at || 0) > Math.floor(Date.now() / 1000) + 60) return session;
        const payload = await authRequest('/token?grant_type=refresh_token', 'POST', { refresh_token: session.refresh_token });
        return sessionFromPayload(payload);
    }

    async function claimCurrentAccessDevice(session) {
        const details = {
            p_device_id: getDeviceId(),
            p_device_label: getDeviceLabel(),
            p_device_browser: getBrowserLabel()
        };
        const sessionId = getAuthSessionId(session.access_token);
        if (sessionId && accessDeviceSessionRpcAvailable) {
            try {
                await rpc('claim_my_access_device_with_session', {
                    ...details,
                    p_auth_session_id: sessionId
                }, session.access_token);
                return;
            } catch (error) {
                if (!isMissingSessionDeviceRpc(error)) throw error;
                accessDeviceSessionRpcAvailable = false;
            }
        }
        await rpc('claim_my_access_device_with_details', details, session.access_token);
    }

    async function verifyCurrentAccessDevice() {
        if (accessDeviceCheckInFlight || !currentSession || !currentSession.access_token || !accessDeviceSessionRpcAvailable) return;
        accessDeviceCheckInFlight = true;
        try {
            const session = await refreshSession(currentSession);
            if (!session) return;
            if (session !== currentSession) saveSession(session);
            await rpc('assert_my_access_device', { p_device_id: getDeviceId() }, session.access_token);
        } catch (error) {
            if (isMissingSessionDeviceRpc(error)) {
                accessDeviceSessionRpcAvailable = false;
            } else if (error && error.message === 'DEVICE_REVOKED') {
                logoutAfterStoredSessionValidationFailure();
            } else {
                console.debug('Access-device verification unavailable:', error);
            }
        } finally {
            accessDeviceCheckInFlight = false;
        }
    }

    function startAccessDeviceMonitor() {
        if (accessDeviceMonitorStarted) return;
        accessDeviceMonitorStarted = true;
        const verifyWhenVisible = () => {
            if (document.visibilityState === 'visible') void verifyCurrentAccessDevice();
        };
        window.addEventListener('focus', verifyWhenVisible);
        document.addEventListener('visibilitychange', verifyWhenVisible);
        window.setInterval(verifyWhenVisible, 30000);
        void verifyCurrentAccessDevice();
    }

    function formQq(form) {
        return normalizeQq(new FormData(form).get('qq'));
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
        await claimCurrentAccessDevice(session);
        startAccessDeviceMonitor();
        await copyLegacyDataForAdministrator(qq, Boolean(bound.is_admin));
        document.documentElement.classList.remove('app-access-pending');
        document.documentElement.classList.add('app-access-ready');
        startApplicationIfReady();
    }

    function storedSessionQq(session) {
        const email = session && session.user && session.user.email;
        const match = /^([1-9]\d{4,11})@qq\.com$/i.exec(String(email || ''));
        return match ? match[1] : '';
    }

    function enterApplicationWithStoredSession(session) {
        const qq = storedSessionQq(session);
        if (!isQq(qq)) throw new Error('登录状态已失效，请重新登录。');
        setNamespace(qq);
        saveSession(session);
        document.documentElement.classList.remove('app-access-pending');
        document.documentElement.classList.add('app-access-ready');
        startApplicationIfReady();
    }

    function logoutAfterStoredSessionValidationFailure() {
        clearSession();
        location.reload();
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

    function setLoginSecurityNotice(message, isError) {
        const notice = document.getElementById('loginSecurityNotice');
        if (!notice) return;
        notice.textContent = message || '';
        notice.classList.toggle('is-error', Boolean(isError));
    }

    function setLoginSecurityPasswordNotice(message, isError) {
        const notice = document.getElementById('loginSecurityPasswordNotice');
        if (!notice) return;
        notice.textContent = message || '';
        notice.classList.toggle('is-error', Boolean(isError));
    }

    function formatDeviceTime(value) {
        const timestamp = new Date(value);
        return Number.isNaN(timestamp.getTime()) ? '未记录' : timestamp.toLocaleString('zh-CN');
    }

    async function revokeLoginSecurityDevice(device, button) {
        const message = `确定要退出“${device.device_label || '此设备'}”吗？该设备将返回登录页。`;
        const confirmed = typeof showCustomConfirm === 'function'
            ? await showCustomConfirm('退出设备登录', message, '退出登录', true)
            : window.confirm(message);
        if (!confirmed) return;
        button.disabled = true;
        setLoginSecurityNotice('');
        try {
            await rpc('revoke_my_access_device', { p_device_id: device.device_id }, currentSession.access_token);
            await loadLoginSecurityDevices();
            setLoginSecurityNotice('已退出该设备登录。');
        } catch (error) {
            setLoginSecurityNotice(friendlyError(error), true);
            button.disabled = false;
        }
    }

    function renderLoginSecurityDevices(devices) {
        const container = document.getElementById('loginSecurityDeviceList');
        if (!container) return;
        container.replaceChildren();
        if (!devices.length) {
            const empty = document.createElement('p');
            empty.className = 'login-security-device-empty';
            empty.textContent = '暂无已登录设备';
            container.append(empty);
            return;
        }
        devices.forEach(device => {
            const item = document.createElement('article');
            item.className = 'login-security-device';
            const title = document.createElement('div');
            title.className = 'login-security-device-title';
            const name = document.createElement('span');
            name.textContent = device.device_label || '未知设备';
            title.append(name);
            if (device.is_current) {
                const current = document.createElement('span');
                current.className = 'login-security-device-current';
                current.textContent = '当前设备';
                title.append(current);
            }
            const browser = document.createElement('div');
            browser.className = 'login-security-device-meta';
            browser.textContent = `浏览器：${device.device_browser || '未记录'}`;
            const ip = document.createElement('div');
            ip.className = 'login-security-device-meta';
            ip.textContent = `IP：${device.ip_address || '未记录'}`;
            const lastSeen = document.createElement('div');
            lastSeen.className = 'login-security-device-meta';
            lastSeen.textContent = `最近使用：${formatDeviceTime(device.last_seen_at)}`;
            item.append(title, browser, ip, lastSeen);
            container.append(item);
        });
    }

    async function loadLoginSecurityDevices() {
        if (!currentSession || !currentSession.access_token) throw new Error('登录状态已失效，请重新登录。');
        const devices = await rpc('list_my_access_devices_with_details', {
            p_current_device_id: getDeviceId()
        }, currentSession.access_token);
        renderLoginSecurityDevices(Array.isArray(devices) ? devices : []);
    }

    async function submitLoginSecurityPassword(form) {
        const data = new FormData(form);
        const newPassword = String(data.get('newPassword') || '');
        const confirmedPassword = String(data.get('newPasswordConfirm') || '');
        if (!currentSession || !currentSession.access_token) throw new Error('登录状态已失效，请重新登录。');
        if (newPassword.length < 8) throw new Error('新密码至少需要 8 位。');
        if (newPassword !== confirmedPassword) throw new Error('两次输入的新密码不一致。');
        await authRequest('/user', 'PUT', { password: newPassword }, currentSession.access_token);
        form.reset();
        setLoginSecurityPasswordNotice('密码已更新成功。');
        
        // 密码修改成功后，延迟 1.5 秒自动收起层叠卡片
        setTimeout(() => {
            if (typeof window.closeLsChangePwdSheet === 'function') {
                window.closeLsChangePwdSheet();
            }
            setLoginSecurityPasswordNotice(''); // 清空提示，为下次打开做准备
        }, 1500);
    }

    window.openLoginSecurityApp = function () {
        const page = document.getElementById('loginSecurityUI');
        if (!page) return;
        const qq = document.getElementById('loginSecurityBoundQq');
        if (qq) qq.textContent = activeQq || '--';
        setLoginSecurityNotice('');
        setLoginSecurityPasswordNotice('');
        
        // 每次打开页面时，自动检测并渲染真实设备模型
        if (typeof window.lsRenderCurrentDevice === 'function') {
            window.lsRenderCurrentDevice();
        }

        page.style.display = 'flex';
        page.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => page.classList.add('show'));
        loadLoginSecurityDevices().catch(error => setLoginSecurityNotice(friendlyError(error), true));
    };

    window.closeLoginSecurityApp = function () {
        const page = document.getElementById('loginSecurityUI');
        if (!page) return;
        page.classList.remove('show');
        page.setAttribute('aria-hidden', 'true');
        window.setTimeout(() => { page.style.display = 'none'; }, 300);
    };

    // 全局真实的退出登录逻辑
    window.lsPerformLogout = async function () {
        const confirmed = typeof showCustomConfirm === 'function'
            ? await showCustomConfirm('退出登录', '确定要退出当前账号吗？', '退出', true)
            : window.confirm('确定要退出当前账号吗？');
        if (!confirmed) return;
        
        // 清除本地 Session 凭证并刷新页面，彻底退回登录大门
        clearSession();
        location.reload();
    };

    // --- 登录与安全页面专属 UI 交互与真实设备检测逻辑 ---
    window.openLsChangePwdSheet = function () {
        const mainPage = document.getElementById('lsMainPage');
        const overlay = document.getElementById('lsSheetOverlay');
        const sheet = document.getElementById('lsChangePwdSheet');
        if (mainPage) mainPage.classList.add('scaled');
        if (overlay) overlay.classList.add('show');
        if (sheet) sheet.classList.add('show');
    };

    window.closeLsChangePwdSheet = function () {
        const mainPage = document.getElementById('lsMainPage');
        const overlay = document.getElementById('lsSheetOverlay');
        const sheet = document.getElementById('lsChangePwdSheet');
        if (mainPage) mainPage.classList.remove('scaled');
        if (overlay) overlay.classList.remove('show');
        if (sheet) sheet.classList.remove('show');
    };

    window.checkLsPwdInput = function () {
        const inputs = document.querySelectorAll('.ls-sheet-input-group input');
        const btn = document.getElementById('lsContinueBtn');
        if (!inputs.length || !btn) return;
        if (inputs[0].value.length > 0 || (inputs[1] && inputs[1].value.length > 0)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    };

    window.lsRenderCurrentDevice = function () {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        let deviceType = 'pc';
        let deviceName = '电脑设备';

        if (/iPad|Macintosh/i.test(ua) && 'ontouchend' in document) {
            deviceType = 'ipad';
            deviceName = 'iPad';
        } else if (/iPhone|iPod/i.test(ua)) {
            deviceType = 'ios';
            deviceName = 'iPhone';
        } else if (/Android/i.test(ua)) {
            deviceType = 'android';
            deviceName = 'Android 设备';
        } else if (/Macintosh/i.test(ua)) {
            deviceType = 'pc';
            deviceName = 'MacBook';
        } else if (/Windows/i.test(ua)) {
            deviceType = 'pc';
            deviceName = 'Windows PC';
        }

        const svgs = {
            ios: `<svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="90" height="190" rx="18" fill="#d1d1d6" stroke="#b0b0b5" stroke-width="2"/><rect x="8" y="8" width="84" height="184" rx="14" fill="#000"/><rect x="10" y="10" width="80" height="180" rx="12" fill="url(#lsIosGrad)"/><rect x="35" y="16" width="30" height="8" rx="4" fill="#000"/><rect x="3" y="50" width="2" height="10" rx="1" fill="#b0b0b5"/><rect x="3" y="70" width="2" height="20" rx="1" fill="#b0b0b5"/><rect x="3" y="100" width="2" height="20" rx="1" fill="#b0b0b5"/><rect x="95" y="75" width="2" height="30" rx="1" fill="#b0b0b5"/><rect x="20" y="40" width="60" height="20" rx="4" fill="rgba(255,255,255,0.3)"/><rect x="20" y="70" width="60" height="60" rx="8" fill="rgba(255,255,255,0.2)"/><defs><linearGradient id="lsIosGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4facfe" /><stop offset="100%" stop-color="#00f2fe" /></linearGradient></defs></svg>`,
            android: `<svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="90" height="190" rx="10" fill="#2c2c2e" stroke="#888" stroke-width="1.5"/><rect x="6.5" y="6.5" width="87" height="187" rx="8" fill="#000"/><rect x="8" y="8" width="84" height="184" rx="6" fill="url(#lsAndroidGrad)"/><circle cx="50" cy="15" r="2.5" fill="#000"/><rect x="95" y="45" width="2" height="25" rx="1" fill="#888"/><rect x="95" y="80" width="2" height="12" rx="1" fill="#888"/><rect x="16" y="30" width="40" height="16" rx="8" fill="rgba(255,255,255,0.25)"/><rect x="16" y="170" width="68" height="12" rx="6" fill="rgba(255,255,255,0.3)"/><circle cx="24" cy="150" r="6" fill="rgba(255,255,255,0.2)"/><circle cx="41" cy="150" r="6" fill="rgba(255,255,255,0.2)"/><circle cx="58" cy="150" r="6" fill="rgba(255,255,255,0.2)"/><circle cx="75" cy="150" r="6" fill="rgba(255,255,255,0.2)"/><defs><linearGradient id="lsAndroidGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8E2DE2" /><stop offset="100%" stop-color="#4A00E0" /></linearGradient></defs></svg>`,
            pc: `<svg viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="200" height="120" rx="8" fill="#d1d1d6" stroke="#b0b0b5" stroke-width="2"/><rect x="22" y="22" width="196" height="116" rx="6" fill="#000"/><rect x="24" y="24" width="192" height="106" rx="4" fill="url(#lsMacGrad)"/><path d="M 5 140 L 235 140 L 240 148 L 0 148 Z" fill="#b0b0b5"/><rect x="100" y="140" width="40" height="4" rx="2" fill="#8e8e93"/><rect x="80" y="60" width="80" height="40" rx="4" fill="rgba(255,255,255,0.2)"/><defs><linearGradient id="lsMacGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff9a9e" /><stop offset="100%" stop-color="#fecfef" /></linearGradient></defs></svg>`,
            ipad: `<svg viewBox="0 0 150 200" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="10" width="140" height="180" rx="12" fill="#d1d1d6" stroke="#b0b0b5" stroke-width="2"/><rect x="10" y="15" width="130" height="170" rx="8" fill="#000"/><rect x="12" y="17" width="126" height="166" rx="6" fill="url(#lsIpadGrad)"/><circle cx="75" cy="13.5" r="1.5" fill="#333"/><rect x="30" y="40" width="90" height="30" rx="6" fill="rgba(255,255,255,0.3)"/><rect x="30" y="80" width="40" height="40" rx="6" fill="rgba(255,255,255,0.2)"/><rect x="80" y="80" width="40" height="40" rx="6" fill="rgba(255,255,255,0.2)"/><defs><linearGradient id="lsIpadGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a18cd1" /><stop offset="100%" stop-color="#fbc2eb" /></linearGradient></defs></svg>`
        };

        const iconContainer = document.getElementById('lsDeviceIconContainer');
        const nameLabel = document.getElementById('lsDeviceNameLabel');
        if(iconContainer) iconContainer.innerHTML = svgs[deviceType];
        if(nameLabel) nameLabel.innerText = deviceName;
    };

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

    async function copyLegacyDataForAdministrator(qq, isAdministrator) {
        if (!isAdministrator) return;
        const marker = `${DATA_PREFIX}legacy-copy:${qq}`;
        if (localStorage.getItem(marker)) return;
        await cloneDatabase('iOSDesktopDB', `${DATA_PREFIX}${qq}:iOSDesktopDB`);
        localStorage.setItem(marker, '1');
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
        const passwordForm = document.querySelector('[data-login-security-password-form]');
        if (passwordForm) {
            passwordForm.addEventListener('submit', async event => {
                event.preventDefault();
                const submit = passwordForm.querySelector('button[type="submit"]');
                if (submit) submit.disabled = true;
                setLoginSecurityPasswordNotice('');
                try {
                    await submitLoginSecurityPassword(passwordForm);
                } catch (error) {
                    setLoginSecurityPasswordNotice(friendlyError(error), true);
                } finally {
                    if (submit) submit.disabled = false;
                }
            });
        }
        document.querySelectorAll('[data-access-action]').forEach(button => {
            button.addEventListener('click', async () => {
                const action = button.dataset.accessAction;
                if (action === 'show-login') showView('login');
                if (action === 'show-setup') showView('setup');
                if (action === 'show-recovery') showView('recovery');
                if (action === 'toggle-access-password') {
                    const input = document.getElementById(button.dataset.passwordTarget);
                    if (!input) return;
                    const visible = input.type === 'password';
                    input.type = visible ? 'text' : 'password';
                    button.classList.toggle('is-visible', visible);
                    button.setAttribute('aria-pressed', String(visible));
                    button.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
                    button.title = visible ? '隐藏密码' : '显示密码';
                }
                if (action === 'retry-device') {
                    button.disabled = true;
                    try { await completeAccess(currentSession); } catch (error) {
                        if (error && error.message === 'DEVICE_LIMIT') await showDeviceLimit();
                        else setNotice(friendlyError(error), true);
                    } finally { button.disabled = false; }
                }
            });
        });
        document.querySelectorAll('[data-login-security-action="refresh-devices"]').forEach(button => {
            button.addEventListener('click', async () => {
                button.disabled = true;
                setLoginSecurityNotice('');
                try {
                    await loadLoginSecurityDevices();
                } catch (error) {
                    setLoginSecurityNotice(friendlyError(error), true);
                } finally {
                    button.disabled = false;
                }
            });
        });
        document.querySelectorAll('[data-login-security-action="toggle-password"]').forEach(button => {
            button.addEventListener('click', () => {
                const input = document.getElementById(button.dataset.passwordTarget);
                if (!input) return;
                const visible = input.type === 'password';
                input.type = visible ? 'text' : 'password';
                button.classList.toggle('is-visible', visible);
                button.setAttribute('aria-pressed', String(visible));
                button.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
                button.title = visible ? '隐藏密码' : '显示密码';
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
        try {
            const session = await refreshSession(storedSession);
            enterApplicationWithStoredSession(session);
            completeAccess(session).catch(logoutAfterStoredSessionValidationFailure);
        } catch (error) {
            clearSession();
            if (error && error.message === 'DEVICE_LIMIT') await showDeviceLimit();
            else setNotice('登录状态已失效，请重新登录。', true);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    else bootstrap();
}());
