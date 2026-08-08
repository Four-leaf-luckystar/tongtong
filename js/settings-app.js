    function openSettingsApp() {
        const settingsUI = document.getElementById('settingsAppUI');
        settingsUI.style.display = 'flex';
        setTimeout(() => {
            settingsUI.classList.add('show');
        }, 10);
    }

    function closeSettingsApp() {
        const settingsUI = document.getElementById('settingsAppUI');
        settingsUI.classList.remove('show');
        setTimeout(() => {
            settingsUI.style.display = 'none';
            if (typeof window.syncStatusBarAfterReturnHome === 'function') window.syncStatusBarAfterReturnHome();
        }, 300);
    }

    let backgroundKeepAliveWakeLock = null;
    let backgroundKeepAliveLifecycleBound = false;
    let backgroundKeepAliveAudio = null;

    function createBackgroundKeepAliveAudio() {
        const sampleRate = 8000;
        const sampleCount = sampleRate;
        const bytes = new Uint8Array(44 + sampleCount);
        const view = new DataView(bytes.buffer);
        const writeText = (offset, text) => {
            for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index);
        };
        writeText(0, 'RIFF');
        view.setUint32(4, 36 + sampleCount, true);
        writeText(8, 'WAVEfmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate, true);
        view.setUint16(32, 1, true);
        view.setUint16(34, 8, true);
        writeText(36, 'data');
        view.setUint32(40, sampleCount, true);
        bytes.fill(128, 44);

        const chunkSize = 4096;
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        const audio = new Audio(`data:audio/wav;base64,${btoa(binary)}`);
        audio.loop = true;
        audio.preload = 'auto';
        audio.playsInline = true;
        return audio;
    }

    function startBackgroundKeepAliveAudio() {
        if (!appSettings?.background_keep_alive_enabled) return;
        if (!backgroundKeepAliveAudio) backgroundKeepAliveAudio = createBackgroundKeepAliveAudio();
        const playback = backgroundKeepAliveAudio.play();
        if (playback?.catch) {
            playback.catch(error => console.debug('Background keep-alive audio unavailable:', error));
        }
    }

    function stopBackgroundKeepAliveAudio() {
        if (!backgroundKeepAliveAudio) return;
        backgroundKeepAliveAudio.pause();
        backgroundKeepAliveAudio.currentTime = 0;
    }

    async function requestBackgroundKeepAliveWakeLock() {
        if (!appSettings?.background_keep_alive_enabled || document.visibilityState !== 'visible') return;
        if (!('wakeLock' in navigator)) return;
        if (backgroundKeepAliveWakeLock && !backgroundKeepAliveWakeLock.released) return;

        try {
            const wakeLock = await navigator.wakeLock.request('screen');
            if (!appSettings?.background_keep_alive_enabled || document.visibilityState !== 'visible') {
                await wakeLock.release();
                return;
            }
            backgroundKeepAliveWakeLock = wakeLock;
            wakeLock.addEventListener('release', () => {
                backgroundKeepAliveWakeLock = null;
            }, { once: true });
        } catch (error) {
            backgroundKeepAliveWakeLock = null;
            console.debug('Background keep-alive wake lock unavailable:', error);
        }
    }

    async function releaseBackgroundKeepAliveWakeLock() {
        if (!backgroundKeepAliveWakeLock) return;
        const wakeLock = backgroundKeepAliveWakeLock;
        backgroundKeepAliveWakeLock = null;
        try {
            await wakeLock.release();
        } catch (error) {
            console.debug('Background keep-alive wake lock release failed:', error);
        }
    }

    function applyBackgroundKeepAlive() {
        const toggle = document.getElementById('backgroundKeepAliveToggle');
        const enabled = appSettings?.background_keep_alive_enabled === true;
        if (toggle) {
            toggle.classList.toggle('on', enabled);
            toggle.setAttribute('aria-checked', String(enabled));
        }
        if (enabled) {
            void requestBackgroundKeepAliveWakeLock();
            startBackgroundKeepAliveAudio();
        } else {
            void releaseBackgroundKeepAliveWakeLock();
            stopBackgroundKeepAliveAudio();
        }
    }

    function initBackgroundKeepAlive() {
        if (!backgroundKeepAliveLifecycleBound) {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') applyBackgroundKeepAlive();
                else void releaseBackgroundKeepAliveWakeLock();
            });
            window.addEventListener('pageshow', applyBackgroundKeepAlive);
            backgroundKeepAliveLifecycleBound = true;
        }
        applyBackgroundKeepAlive();
    }

    function toggleBackgroundKeepAlive() {
        if (typeof appSettings === 'undefined') return;
        appSettings.background_keep_alive_enabled = appSettings.background_keep_alive_enabled !== true;
        applyBackgroundKeepAlive();
        if (typeof saveAppSettings === 'function') saveAppSettings();
        if (typeof showToast === 'function') {
            showToast(appSettings.background_keep_alive_enabled ? '后台保活已开启' : '后台保活已关闭');
        }
    }

    function applyMessageNotifications() {
        const enabled = appSettings?.message_notifications_enabled === true;
        const toggle = document.getElementById('messageNotificationPageToggle');
        if (toggle) {
            toggle.classList.toggle('on', enabled);
            toggle.setAttribute('aria-checked', String(enabled));
        }
        updateMessageNotificationPermissionStatus();
    }

    function openMessageNotificationSettingsApp() {
        const settingsUI = document.getElementById('messageNotificationSettingsUI');
        if (!settingsUI) return;
        settingsUI.style.display = 'flex';
        applyMessageNotifications();
        setTimeout(() => settingsUI.classList.add('show'), 10);
    }

    function closeMessageNotificationSettingsApp() {
        const settingsUI = document.getElementById('messageNotificationSettingsUI');
        if (!settingsUI) return;
        settingsUI.classList.remove('show');
        setTimeout(() => { settingsUI.style.display = 'none'; }, 300);
    }

    function updateMessageNotificationPermissionStatus() {
        const status = document.getElementById('messageNotificationPermissionStatus');
        if (!status) return;
        if (!('Notification' in window)) {
            status.textContent = '当前浏览器不支持网页通知';
            status.style.color = '#ff3b30';
            return;
        }
        const permission = Notification.permission;
        if (permission === 'granted') {
            status.textContent = appSettings?.message_notifications_enabled === true ? '已开启，浏览器通知权限已获得' : '浏览器通知权限已获得，开关当前关闭';
            status.style.color = '#34c759';
        } else if (permission === 'denied') {
            status.textContent = '浏览器已拒绝通知，请在浏览器设置中重新允许';
            status.style.color = '#ff3b30';
        } else {
            status.textContent = '尚未获得权限，开启开关时会请求';
            status.style.color = '#8e8e93';
        }
    }

    async function toggleMessageNotifications() {
        if (typeof appSettings === 'undefined') return;
        const enabled = appSettings.message_notifications_enabled !== true;
        if (enabled) {
            if (!('Notification' in window)) {
                if (typeof showToast === 'function') showToast('当前浏览器不支持网页通知');
                return;
            }
            if (Notification.permission !== 'granted') {
                let permission = 'denied';
                try {
                    permission = await Notification.requestPermission();
                } catch (error) {
                    console.debug('Web message notification permission unavailable:', error);
                }
                if (permission !== 'granted') {
                    if (typeof showToast === 'function') showToast('未获得消息通知权限');
                    return;
                }
            }
        }
        appSettings.message_notifications_enabled = enabled;
        applyMessageNotifications();
        if (typeof saveAppSettings === 'function') saveAppSettings();
        updateMessageNotificationPermissionStatus();
        if (typeof showToast === 'function') showToast(enabled ? '消息通知已开启' : '消息通知已关闭');
    }

    async function testMessageNotification() {
        const result = document.getElementById('messageNotificationTestResult');
        const button = document.getElementById('messageNotificationTestButton');
        const report = (text, success = false) => {
            if (result) {
                result.textContent = text;
                result.style.color = success ? '#34c759' : '#ff3b30';
            }
        };
        if (button) {
            button.disabled = true;
            button.style.opacity = '0.6';
        }
        try {
            if (typeof appSettings === 'undefined' || appSettings.message_notifications_enabled !== true) {
                report('测试失败：请先打开上方的消息通知开关');
                return;
            }
            if (!('Notification' in window)) {
                report('测试失败：当前浏览器不支持网页通知');
                return;
            }
            if (Notification.permission !== 'granted') {
                report(Notification.permission === 'denied'
                    ? '测试失败：浏览器已拒绝通知，请在浏览器设置中重新允许'
                    : '测试失败：尚未获得通知权限，请先打开消息通知开关');
                return;
            }
            const tag = `wc-notification-test-${Date.now()}`;
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration?.showNotification) {
                    await registration.showNotification('消息通知测试', { body: '如果你看到这条通知，消息通知功能正常。', tag, renotify: true });
                    if (typeof registration.getNotifications === 'function') {
                        const notifications = await registration.getNotifications({ tag });
                        if (!notifications.length) throw new Error('浏览器未返回测试通知，可能被系统通知设置或免打扰模式拦截');
                    }
                } else {
                    const notification = new Notification('消息通知测试', { body: '如果你看到这条通知，消息通知功能正常。', tag });
                    notification.onclick = () => notification.close();
                }
            } else {
                const notification = new Notification('消息通知测试', { body: '如果你看到这条通知，消息通知功能正常。', tag });
                notification.onclick = () => notification.close();
            }
            report('测试成功：浏览器已接受通知请求，请检查系统通知中心', true);
        } catch (error) {
            report(`测试失败：${error?.message || '浏览器未能显示通知'}`);
        } finally {
            if (button) {
                button.disabled = false;
                button.style.opacity = '';
            }
            updateMessageNotificationPermissionStatus();
        }
    }

    // ==========================================
    function openDisplaySettingsApp() {
        const displayUI = document.getElementById('displaySettingsUI');
        displayUI.style.display = 'flex';
        setTimeout(() => {
            displayUI.classList.add('show');
        }, 10);
            // show three-dots button; click to expand vertical capsule menu
        const slider = document.getElementById('dsBrightnessSlider');
        if(slider) updateDsSlider(slider);
    }

    function closeDisplaySettingsApp() {
        const displayUI = document.getElementById('displaySettingsUI');
        displayUI.classList.remove('show');
        setTimeout(() => {
            displayUI.style.display = 'none';
        }, 300);
    }
    function openStandbyDiagnosticsApp() {
        const diagnosticsUI = document.getElementById('standbyDiagnosticsUI');
        diagnosticsUI.style.display = 'flex';
        renderDiagnosticErrorLog();
        setTimeout(() => {
            diagnosticsUI.classList.add('show');
        }, 10);
    }

    function closeStandbyDiagnosticsApp() {
        const diagnosticsUI = document.getElementById('standbyDiagnosticsUI');
        diagnosticsUI.classList.remove('show');
        setTimeout(() => {
            diagnosticsUI.style.display = 'none';
        }, 300);
    }

    function renderDiagnosticErrorLog() {
        const output = document.getElementById('diagnosticErrorText');
        const count = document.getElementById('diagnosticErrorCount');
        const diagnostics = window.tongtongDiagnostics;
        if (diagnostics && typeof diagnostics.flush === 'function') diagnostics.flush();
        const logs = diagnostics && typeof diagnostics.getLogs === 'function' ? diagnostics.getLogs() : [];
        if (count) count.textContent = `${logs.length} 条`;
        if (!output) return;
        output.value = logs.length && diagnostics && typeof diagnostics.toText === 'function'
            ? diagnostics.toText()
            : '';
    }

    function copyDiagnosticErrorLog() {
        renderDiagnosticErrorLog();
        const output = document.getElementById('diagnosticErrorText');
        const text = output ? output.value.trim() : '';
        if (!text) {
            if (typeof showToast === 'function') showToast('暂无报错数据');
            return;
        }
        const fallbackCopy = () => {
            output.focus();
            output.select();
            document.execCommand('copy');
        };
        const done = () => {
            if (typeof showToast === 'function') showToast('报错数据已复制');
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done).catch(() => {
                fallbackCopy();
                done();
            });
        } else {
            fallbackCopy();
            done();
        }
    }

    function clearDiagnosticErrorLog() {
        if (window.tongtongDiagnostics && typeof window.tongtongDiagnostics.clear === 'function') {
            window.tongtongDiagnostics.clear();
        }
        renderDiagnosticErrorLog();
        if (typeof showToast === 'function') showToast('报错数据已清空');
    }

    function toggleDsAppearance(mode) {
        const lightOpt = document.getElementById('dsLightOption');
        const darkOpt = document.getElementById('dsDarkOption');
        const iphone = document.querySelector('.iphone');

        if (mode === 'dark') {
            lightOpt.classList.remove('active');
            darkOpt.classList.add('active');
            iphone.classList.add('dark-mode');
            appSettings.ios_theme_mode = 'dark';
        } else {
            darkOpt.classList.remove('active');
            lightOpt.classList.add('active');
            iphone.classList.remove('dark-mode');
            appSettings.ios_theme_mode = 'light';
        }
        saveAppSettings();
        
            // show three-dots button; click to expand vertical capsule menu
        const slider = document.getElementById('dsBrightnessSlider');
        if(slider) updateDsSlider(slider);
    }

    function updateDsSlider(el) {
        const percentage = (el.value - el.min) / (el.max - el.min) * 100;
        const isDark = document.querySelector('.iphone').classList.contains('dark-mode');
        const trackColor = isDark ? '#39393d' : '#e5e5ea';
        el.style.background = `linear-gradient(to right, #007aff ${percentage}%, ${trackColor} ${percentage}%)`;
        
            // show three-dots button; click to expand vertical capsule menu
        const overlay = document.getElementById('brightnessOverlay');
        if (overlay) {
            const opacity = 0.7 - (percentage / 100) * 0.7; // 最大暗度为 0.7
            overlay.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
        }

            // show three-dots button; click to expand vertical capsule menu
        appSettings.ios_brightness = el.value;
        saveAppSettings();
    }

            // show three-dots button; click to expand vertical capsule menu
    function initThemeAndBrightness() {
        const savedTheme = appSettings.ios_theme_mode;
        if (savedTheme === 'dark') {
            toggleDsAppearance('dark');
        }

            // show three-dots button; click to expand vertical capsule menu
        const savedBrightness = appSettings.ios_brightness;
        const slider = document.getElementById('dsBrightnessSlider');
        if (slider) {
            if (savedBrightness !== null && savedBrightness !== undefined) {
                slider.value = savedBrightness;
            } else {
                slider.value = 100; // 默认最亮
            }
            updateDsSlider(slider);
        }
    }

            // show three-dots button; click to expand vertical capsule menu
    function openAppleIdApp() {
        const appleIdUI = document.getElementById('appleIdUI');
        appleIdUI.style.display = 'flex';
        setTimeout(() => {
            appleIdUI.classList.add('show');
        }, 10);
    }

    function closeAppleIdApp() {
        const appleIdUI = document.getElementById('appleIdUI');
        appleIdUI.classList.remove('show');
        setTimeout(() => {
            appleIdUI.style.display = 'none';
        }, 300);
    }



    let apiEditingId = null;

    let fetchedModelsCache = []; // 缓存拉取到的模型

    async function fetchApiModels(mode) {
        const urlInput = document.getElementById(mode === 'add' ? 'api-add-url' : 'api-edit-url').value.trim();
        const keyInput = document.getElementById(mode === 'add' ? 'api-add-key' : 'api-edit-key').value.trim();
        const inputEl = document.getElementById(mode === 'add' ? 'api-add-model' : 'api-edit-model');

        if (!urlInput || !keyInput) {
            showCustomAlert('提示', '请先填写 URL 和 Key');
            return;
        }

        try {
            showToast('正在拉取模型...');
            const baseUrl = urlInput.endsWith('/') ? urlInput.slice(0, -1) : urlInput;
            
            // show three-dots button; click to expand vertical capsule menu
            const response = await fetch(`${baseUrl}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${keyInput}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP 错误: ${response.status}`);
            }
            
            const data = await response.json();

            if (data && data.data && Array.isArray(data.data)) {
                if (data.data.length === 0) {
                    inputEl.value = '';
                    inputEl.placeholder = '未找到可用模型';
                    fetchedModelsCache = [];
                    showToast('未找到可用模型');
                    return;
                }

                fetchedModelsCache = data.data.map(m => m.id);
                inputEl.value = fetchedModelsCache[0]; // 默认选中第一个
                showToast('模型拉取成功');
                
                // 拉取成功后自动打开选择弹窗
                openApiModelSelect(mode);
            } else {
                throw new Error('接口返回的数据格式不符合 OpenAI 标准');
            }
        } catch (error) {
            console.error("拉取模型失败:", error);
            showCustomAlert('拉取失败', `请检查 URL 和 Key 是否正确，或目标服务器是否存在跨域(CORS)限制。\n\n错误信息: ${error.message}`);
        }
    }

    function saveNewApi() {
        const name = document.getElementById('api-add-name').value.trim();
        const url = document.getElementById('api-add-url').value.trim();
        const key = document.getElementById('api-add-key').value.trim();
        const model = document.getElementById('api-add-model').value;
        const temp = parseFloat(document.getElementById('api-add-temp').value) || 0.8;

        if (!name || !url || !key) {
            showCustomAlert('提示', '请填写完整信息');
            return;
        }

        const newApi = {
            id: Date.now(),
            name, url, key, model: model || '', temperature: temp
        };

        apiDataList.push(newApi);
        if (!apiConnectedId) apiConnectedId = newApi.id; // 如果是第一个，自动连接
        saveApiData();
        renderApiList();
        closeApiAddPage();

            // show three-dots button; click to expand vertical capsule menu
        document.getElementById('api-add-name').value = '';
        document.getElementById('api-add-url').value = '';
        document.getElementById('api-add-key').value = '';
        document.getElementById('api-add-model').value = '';
        document.getElementById('api-add-model').placeholder = '请先拉取模型';
        document.getElementById('api-add-temp').value = 0.8;
        document.getElementById('api-add-temp-val').innerText = '0.8';
    }

    function deleteApiDrawer() {
        if (!apiEditingId) return;
        showCustomConfirm('删除 API', '确定要删除这个 API 预设吗？', '删除', true).then(confirmed => {
            if (confirmed) {
                apiDataList = apiDataList.filter(a => a.id !== apiEditingId);
                if (apiConnectedId === apiEditingId) {
                    apiConnectedId = apiDataList.length > 0 ? apiDataList[0].id : null;
                }
                saveApiData();
                renderApiList();
                closeApiDrawer();
            }
        });
    }

    let apiStreamEnabled = false;

    function toggleApiStream() {
        const toggleBtn = document.getElementById('apiStreamToggle');
        apiStreamEnabled = !apiStreamEnabled;
        if (apiStreamEnabled) {
            toggleBtn.classList.remove('off');
            if(typeof showToast === 'function') showToast("流式输出已开启");
        } else {
            toggleBtn.classList.add('off');
            if(typeof showToast === 'function') showToast("流式输出已关闭");
        }
        if (typeof appSettings !== 'undefined') {
            appSettings.api_stream_enabled = apiStreamEnabled;
            if (typeof saveAppSettings === 'function') saveAppSettings();
        }
    }

    function openApiApp() {
        const apiAppUI = document.getElementById('apiAppUI');
        apiAppUI.style.display = 'flex';
        renderApiList();
        
        if (typeof appSettings !== 'undefined' && appSettings.api_stream_enabled !== undefined) {
            apiStreamEnabled = appSettings.api_stream_enabled;
        }
        const toggleBtn = document.getElementById('apiStreamToggle');
        if (toggleBtn) {
            if (apiStreamEnabled) toggleBtn.classList.remove('off');
            else toggleBtn.classList.add('off');
        }

        setTimeout(() => {
            apiAppUI.classList.add('show');
        }, 10);
    }

    function closeApiApp() {
        const apiAppUI = document.getElementById('apiAppUI');
        apiAppUI.classList.remove('show');
        setTimeout(() => {
            apiAppUI.style.display = 'none';
        }, 300);
    }

    function renderApiList() {
        const connectedContainer = document.getElementById('api-connected-container');
        const presetContainer = document.getElementById('api-preset-container');
        connectedContainer.innerHTML = '';
        presetContainer.innerHTML = '';

        apiDataList.forEach(api => {
            const isConnected = api.id === apiConnectedId;
            const rowAction = isConnected ? `openApiDrawer(event, ${api.id})` : `connectApi(${api.id})`;

            const rowHTML = `
                <div class="api-row clickable" onclick="${rowAction}">
                    <div class="api-row-left">
                        ${isConnected ? '<svg viewBox="0 0 24 24" fill="none" stroke="#007aff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                    <div class="api-row-text">
                        <div class="api-row-title-text">${api.name}</div>
                        ${isConnected ? '<div class="api-row-subtitle-text">已连接</div>' : ''}
                    </div>
                    <div class="api-row-right">
                        <svg class="api-icon-lock" viewBox="0 0 24 24"><path d="M17 10H7V7c0-2.76 2.24-5 5-5s5 2.24 5 5v3zm-2 0V7c0-1.65-1.35-3-3-3S9 5.35 9 7v3h6zM5 12v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2z"/></svg>
                        <svg class="api-icon-wifi" viewBox="0 0 24 24"><path fill="#000000" d="M2.06 10.06c.51.51 1.32.56 1.87.1c4.67-3.84 11.45-3.84 16.13-.01c.56.46 1.38.42 1.89-.09c.59-.59.55-1.57-.1-2.1c-5.71-4.67-13.97-4.67-19.69 0c-.65.52-.7 1.5-.1 2.1zm7.76 7.76l1.47 1.47c.39.39 1.02.39 1.41 0l1.47-1.47c.47-.47.37-1.28-.23-1.59a4.28 4.28 0 0 0-3.91 0c-.57.31-.68 1.12-.21 1.59zm-3.73-3.73c.49.49 1.26.54 1.83.13a7.064 7.064 0 0 1 8.16 0c.57.4 1.34.36 1.83-.13l.01-.01c.6-.6.56-1.62-.13-2.11c-3.44-2.49-8.13-2.49-11.58 0c-.69.5-.73 1.51-.12 2.12z"/></svg>
                        <svg class="api-icon-info" viewBox="0 0 24 24" onclick="openApiDrawer(event, ${api.id})">
                            <circle cx="12" cy="12" r="10" fill="none" stroke="#007aff" stroke-width="1.5"></circle>
                            <circle cx="12" cy="6.8" r="1.3" fill="#007aff" stroke="none"></circle>
                            <path d="M10.5 11 L12 10 V16.5 M10.5 16.5 H13.5" stroke="#007aff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
                        </svg>
                    </div>
                </div>
            `;

            if (isConnected) {
                connectedContainer.innerHTML = rowHTML;
            } else {
                presetContainer.innerHTML += rowHTML;
            }
        });

        presetContainer.innerHTML += `
            <div class="api-row clickable" onclick="openApiAddPage()">
                <div class="api-row-left"></div>
                <div class="api-row-text"><div class="api-row-title-text" style="color: #007aff;">+ 添加API</div></div>
            </div>
        `;
    }

    function connectApi(id) {
        apiConnectedId = id;
        saveApiData();
        renderApiList();
    }

    function openApiDrawer(event, id) {
        event.stopPropagation();
        apiEditingId = id;
        const api = apiDataList.find(a => a.id === id);
        document.getElementById('api-edit-name').value = api.name;
        document.getElementById('api-edit-url').value = api.url;
        document.getElementById('api-edit-key').value = api.key;
        
            // show three-dots button; click to expand vertical capsule menu
        const inputEl = document.getElementById('api-edit-model');
        inputEl.value = api.model || '';
        inputEl.placeholder = api.model ? api.model : '未选择模型';
        
        const temp = api.temperature !== undefined ? api.temperature : 0.8;
        document.getElementById('api-edit-temp').value = temp;
        document.getElementById('api-edit-temp-val').innerText = temp;
        
        document.getElementById('apiDrawerOverlay').classList.add('show');
        document.getElementById('apiDrawer').classList.add('show');
    }

    function closeApiDrawer() {
        document.getElementById('apiDrawerOverlay').classList.remove('show');
        document.getElementById('apiDrawer').classList.remove('show');
        apiEditingId = null;
    }

    function saveApiDrawer() {
        if (apiEditingId) {
            const api = apiDataList.find(a => a.id === apiEditingId);
            api.name = document.getElementById('api-edit-name').value;
            api.url = document.getElementById('api-edit-url').value;
            api.key = document.getElementById('api-edit-key').value;
            api.model = document.getElementById('api-edit-model').value;
            api.temperature = parseFloat(document.getElementById('api-edit-temp').value) || 0.8;
            saveApiData();
            renderApiList();
        }
        closeApiDrawer();
    }

    function openApiAddPage() {
        document.getElementById('api-page-main').classList.remove('active');
        document.getElementById('api-page-main').classList.add('slide-left');
        document.getElementById('api-page-add').classList.remove('slide-right');
        document.getElementById('api-page-add').classList.add('active');
    }

    function closeApiAddPage() {
        document.getElementById('api-page-add').classList.remove('active');
        document.getElementById('api-page-add').classList.add('slide-right');
        document.getElementById('api-page-main').classList.remove('slide-left');
        document.getElementById('api-page-main').classList.add('active');
    }

            // show three-dots button; click to expand vertical capsule menu
    function openIcloudApp() {
        const icloudUI = document.getElementById('icloudAppUI');
        icloudUI.style.display = 'flex';
        updateRealStorage(); // 触发真实储存计算与持久化检测
        loadGithubBackupSettings();
        setTimeout(() => {
            icloudUI.classList.add('show');
        }, 10);
    }

    function closeIcloudApp() {
        const icloudUI = document.getElementById('icloudAppUI');
        icloudUI.classList.remove('show');
        setTimeout(() => {
            icloudUI.style.display = 'none';
            // show three-dots button; click to expand vertical capsule menu
            closeIcStoragePage();
            if (typeof closeLocalDrivePage === 'function') closeLocalDrivePage();
            if (typeof closeCloudBackupPage === 'function') closeCloudBackupPage();
        }, 300);
    }

    function openIcStoragePage() {
        document.getElementById('ic-main-page').classList.remove('active');
        document.getElementById('ic-main-page').classList.add('slide-left');
        document.getElementById('ic-storage-page').classList.remove('slide-right');
        document.getElementById('ic-storage-page').classList.add('active');
    }

    function closeIcStoragePage() {
        document.getElementById('ic-storage-page').classList.remove('active');
        document.getElementById('ic-storage-page').classList.add('slide-right');
        document.getElementById('ic-main-page').classList.remove('slide-left');
        document.getElementById('ic-main-page').classList.add('active');
    }

    const githubBackupSettingsId = 'githubBackupSettings';
    let githubBackupTimerId = null;

    function openCloudBackupPage() {
        document.getElementById('ic-main-page').classList.remove('active');
        document.getElementById('ic-main-page').classList.add('slide-left');
        document.getElementById('ic-cloud-backup-page').classList.remove('slide-right');
        document.getElementById('ic-cloud-backup-page').classList.add('active');
        loadGithubBackupSettings();
    }

    function closeCloudBackupPage() {
        const page = document.getElementById('ic-cloud-backup-page');
        if (!page) return;
        page.classList.remove('active');
        page.classList.add('slide-right');
        document.getElementById('ic-main-page').classList.remove('slide-left');
        document.getElementById('ic-main-page').classList.add('active');
    }

    function getGithubBackupInputs() {
        return {
            token: document.getElementById('githubBackupToken'),
            owner: document.getElementById('githubBackupOwner'),
            repo: document.getElementById('githubBackupRepo'),
            fileName: document.getElementById('githubBackupFileName'),
            scheduledTime: document.getElementById('githubBackupScheduledTime'),
            scheduleToggle: document.getElementById('githubBackupScheduleToggle')
        };
    }

    function getGithubBackupConfigFromForm() {
        const inputs = getGithubBackupInputs();
        const token = inputs.token.value.trim();
        const owner = inputs.owner.value.trim();
        const repo = inputs.repo.value.trim();
        let fileName = inputs.fileName.value.trim().replace(/^\/+|\/+$/g, '');

        if (!token || !owner || !repo || !fileName) {
            showCustomAlert('提示', '请填写 Token、用户名、仓库名和文件名。');
            return null;
        }
        if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) {
            showCustomAlert('提示', 'GitHub 用户名或仓库名格式不正确。');
            return null;
        }
        if (fileName.split('/').some(part => !part || part === '.' || part === '..')) {
            showCustomAlert('提示', '文件名不能包含 . 或 .. 路径。');
            return null;
        }
        fileName = fileName.replace(/\.json$/i, '');
        inputs.fileName.value = fileName;
        return {
            token,
            owner,
            repo,
            fileName,
            scheduledEnabled: inputs.scheduleToggle.classList.contains('on'),
            scheduledTime: inputs.scheduledTime.value || '02:00'
        };
    }

    function readGithubBackupSettings() {
        return new Promise((resolve) => {
            if (!db) return resolve(null);
            const request = db.transaction([storeName], 'readonly').objectStore(storeName).get(githubBackupSettingsId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    }

    function persistGithubBackupSettings(config) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('数据库尚未就绪'));
                return;
            }
            const transaction = db.transaction([storeName], 'readwrite');
            transaction.objectStore(storeName).put({ id: githubBackupSettingsId, ...config });
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error('保存配置失败'));
        });
    }

    async function loadGithubBackupSettings() {
        const config = await readGithubBackupSettings();
        const inputs = getGithubBackupInputs();
        inputs.token.value = config?.token || '';
        inputs.owner.value = config?.owner || '';
        inputs.repo.value = config?.repo || '';
        inputs.fileName.value = config?.fileName || 'tonghuaji-backup';
        inputs.scheduledTime.value = config?.scheduledTime || '02:00';
        inputs.scheduleToggle.classList.toggle('off', config?.scheduledEnabled !== true);
        inputs.scheduleToggle.classList.toggle('on', config?.scheduledEnabled === true);
        updateCloudBackupStatus(config);
        scheduleGithubBackup(config);
    }

    function updateCloudBackupStatus(config) {
        const status = document.getElementById('ic-cloud-backup-status');
        if (!status) return;
        status.textContent = config?.owner && config?.repo ? `${config.owner}/${config.repo}` : '未设置';
    }

    async function saveGithubBackupSettings(options = {}) {
        const { silent = false, reschedule = true } = options;
        const config = getGithubBackupConfigFromForm();
        if (!config) return null;
        try {
            await persistGithubBackupSettings(config);
            updateCloudBackupStatus(config);
            if (reschedule) scheduleGithubBackup(config);
            if (!silent) showToast('GitHub 备份配置已保存');
            return config;
        } catch (error) {
            showCustomAlert('错误', '保存 GitHub 配置失败。');
            return null;
        }
    }

    function stopGithubBackupSchedule() {
        if (githubBackupTimerId !== null) {
            clearTimeout(githubBackupTimerId);
            githubBackupTimerId = null;
        }
    }

    function scheduleGithubBackup(config) {
        stopGithubBackupSchedule();
        if (!config?.scheduledEnabled) return;
        const match = /^(\d{2}):(\d{2})$/.exec(config.scheduledTime || '');
        if (!match) return;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (hour > 23 || minute > 59) return;

        const nextRun = new Date();
        nextRun.setHours(hour, minute, 0, 0);
        if (nextRun.getTime() <= Date.now()) nextRun.setDate(nextRun.getDate() + 1);
        githubBackupTimerId = window.setTimeout(() => {
            uploadGithubBackup(true);
        }, Math.max(1000, nextRun.getTime() - Date.now()));
    }

    async function toggleGithubBackupSchedule() {
        const inputs = getGithubBackupInputs();
        const enabled = !inputs.scheduleToggle.classList.contains('on');
        inputs.scheduleToggle.classList.toggle('on', enabled);
        inputs.scheduleToggle.classList.toggle('off', !enabled);
        const config = getGithubBackupConfigFromForm();
        if (!config) {
            inputs.scheduleToggle.classList.toggle('on', !enabled);
            inputs.scheduleToggle.classList.toggle('off', enabled);
            return;
        }
        try {
            await persistGithubBackupSettings(config);
            scheduleGithubBackup(config);
            showToast(enabled ? `已设置每天 ${config.scheduledTime} 定时备份` : '定时 GitHub 备份已关闭');
        } catch (error) {
            showCustomAlert('错误', '保存定时备份设置失败。');
        }
    }

    async function updateGithubBackupSchedule() {
        const config = getGithubBackupConfigFromForm();
        if (!config) return;
        try {
            await persistGithubBackupSettings(config);
            scheduleGithubBackup(config);
        } catch (error) {
            showCustomAlert('错误', '保存定时备份时间失败。');
        }
    }

    window.initializeGithubBackupSchedule = function () {
        loadGithubBackupSettings();
    };

    function getGithubBackupApiUrl(config, fileName = config.fileName) {
        const path = fileName.split('/').map(encodeURIComponent).join('/');
        return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}`;
    }

    function encodeBackupText(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = '';
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
        }
        return btoa(binary);
    }

    async function githubBackupRequest(config, options, fileName = config.fileName) {
        const response = await fetch(getGithubBackupApiUrl(config, fileName), {
            ...options,
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${config.token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                ...(options.headers || {})
            }
        });
        return response;
    }

    async function uploadGithubBackupFile(config, fileName, text, message) {
        const existing = await githubBackupRequest(config, { method: 'GET' }, fileName);
        let sha = null;
        if (existing.ok) sha = (await existing.json()).sha;
        else if (existing.status !== 404) throw new Error(`无法读取 GitHub 文件（${existing.status}）`);
        const response = await githubBackupRequest(config, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, content: encodeBackupText(text), ...(sha ? { sha } : {}) })
        }, fileName);
        if (!response.ok) throw new Error(`GitHub 文件上传失败（${response.status}）`);
    }

    async function uploadGithubBackup(isScheduled = false) {
        const config = await saveGithubBackupSettings({ silent: isScheduled, reschedule: !isScheduled });
        if (!config) return;
        try {
            if (!isScheduled) showToast('正在准备 GitHub 备份...');
            const data = await getAllDataFromDB();
            const prefix = config.fileName.replace(/\/+$/g, '');
            const files = Object.keys(data).map(id => `${prefix}/${id}.json`);
            await Promise.all(Object.entries(data).map(([id, record]) => uploadGithubBackupFile(config, `${prefix}/${id}.json`, JSON.stringify(record, null, 2), `backup: update ${id}`)));
            await uploadGithubBackupFile(config, `${prefix}/manifest.json`, JSON.stringify({ version: 2, files }, null, 2), 'backup: update manifest');
            showToast(isScheduled ? '定时 GitHub 备份完成' : '已备份到 GitHub');
        } catch (error) {
            console.error('GitHub backup failed:', error);
            if (!isScheduled) showCustomAlert('错误', '无法连接 GitHub，请检查网络后重试。');
        } finally {
            if (isScheduled) scheduleGithubBackup(config);
        }
    }

    async function restoreGithubBackup() {
        const config = getGithubBackupConfigFromForm();
        if (!config) return;
        const confirmed = await showCustomConfirm('从 GitHub 恢复', '恢复会覆盖当前应用数据，GitHub Token 配置将保留在本机。确定继续吗？', '恢复', true);
        if (!confirmed) return;
        try {
            showToast('正在读取 GitHub 备份...');
            const manifestResponse = await githubBackupRequest(config, {
                method: 'GET',
                headers: { Accept: 'application/vnd.github.raw' }
            }, `${config.fileName.replace(/\/+$/g, '')}/manifest.json`);
            if (!manifestResponse.ok) {
                const legacyResponse = await githubBackupRequest(config, { method: 'GET', headers: { Accept: 'application/vnd.github.raw' } }, `${config.fileName}.json`);
                if (legacyResponse.ok) {
                    processJsonImport(await legacyResponse.text());
                    return;
                }
                showCustomAlert('错误', `无法读取 GitHub 备份（${manifestResponse.status}）。请检查备份前缀和仓库权限。`);
                return;
            }
            const manifest = JSON.parse(await manifestResponse.text());
            if (!Array.isArray(manifest.files)) throw new Error('备份清单无效');
            const records = {};
            for (const fileName of manifest.files) {
                const response = await githubBackupRequest(config, { method: 'GET', headers: { Accept: 'application/vnd.github.raw' } }, fileName);
                if (!response.ok) throw new Error(`无法读取 ${fileName}`);
                const record = JSON.parse(await response.text());
                if (record?.id) records[record.id] = record;
            }
            processJsonImport(JSON.stringify(records));
        } catch (error) {
            console.error('GitHub restore failed:', error);
            showCustomAlert('错误', 'GitHub 备份文件无效或无法读取。');
        }
    }

            // show three-dots button; click to expand vertical capsule menu
    async function updateRealStorage() {
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                const usage = estimate.usage || 0;
                const quota = estimate.quota || 1;
                const percentage = Math.max(Math.min((usage / quota) * 100, 100), 1).toFixed(1);
                const mainProgressEl = document.getElementById('ic-main-progress');
                if(mainProgressEl) mainProgressEl.style.width = `${percentage}%`;
            } catch (e) {
                console.error("Storage estimate failed:", e);
            }
        }
        
        if (navigator.storage && navigator.storage.persisted) {
            const isPersisted = await navigator.storage.persisted();
            const persistStatusEl = document.getElementById('ic-persist-status');
            if(persistStatusEl) {
                persistStatusEl.innerHTML = `${isPersisted ? '已开启' : '未开启'} <svg class="ic-chevron" viewBox="0 0 8 13"><path d="M1.5 1.5L6.5 6.5L1.5 11.5"/></svg>`;
                if(isPersisted) persistStatusEl.style.color = '#34c759'; 
            }
        }

        const getStoreSize = (key) => {
            return new Promise((resolve) => {
                if (!db) { resolve(0); return; }
                const transaction = db.transaction([storeName], "readonly");
                const store = transaction.objectStore(storeName);
                const request = store.get(key);
                request.onsuccess = (e) => {
                    const data = e.target.result;
                    if (data) {
                        const jsonString = JSON.stringify(data);
                        resolve(jsonString.length);
                    } else {
                        resolve(0);
                    }
                };
                request.onerror = () => resolve(0);
            });
        };

        // 专门用于读取独立数据库（如 AppleMusicDB）大小的函数
        const getOtherDBSize = (dbName, storeNames) => {
            return new Promise((resolve) => {
                const req = indexedDB.open(dbName);
                req.onsuccess = (e) => {
                    const database = e.target.result;
                    let totalSize = 0;
                    const validStores = storeNames.filter(name => database.objectStoreNames.contains(name));
                    if (validStores.length === 0) {
                        database.close();
                        return resolve(0);
                    }
                    const tx = database.transaction(validStores, 'readonly');
                    let completed = 0;
                    validStores.forEach(storeName => {
                        const store = tx.objectStore(storeName);
                        const getAllReq = store.getAll();
                        getAllReq.onsuccess = (ev) => {
                            const data = ev.target.result;
                            if (data) totalSize += JSON.stringify(data).length;
                            completed++;
                            if (completed === validStores.length) {
                                database.close();
                                resolve(totalSize);
                            }
                        };
                        getAllReq.onerror = () => {
                            completed++;
                            if (completed === validStores.length) {
                                database.close();
                                resolve(totalSize);
                            }
                        }
                    });
                };
                req.onerror = () => resolve(0);
            });
        };

        // 统一使用 formatSizeStr，确保小于 1MB 的数据精确显示为 KB，而不是 0 MB
        const formatSizeStr = (bytes) => {
            if (bytes === 0) return '0 KB';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        };

        const wallpaperSize = await getStoreSize("wallpaperData");
        const presetSize = await getStoreSize("presetData");
        const layoutSize = await getStoreSize("currentLayout");
        const fontSize = await getStoreSize("fontData");
        const profileSize = await getStoreSize("profileData");
        const apiSize = await getStoreSize("apiData");
        
        const worldbookSize = await getStoreSize("worldbookData"); 
        const wechatSize = await getStoreSize("wechatChatData") + await getStoreSize("wechatMomentsData") + await getStoreSize("wechatContactsData") + await getStoreSize("wechatBgData") + await getStoreSize("wechatEmojiData") + await getStoreSize("wechatMomentsProfileData");
        const contactsSize = await getStoreSize("wechatContactsData"); // 通讯录与微信共享数据
        const musicSize = await getOtherDBSize("AppleMusicDB", ["searchHistory", "recentPlays", "favoriteSongs", "customPlaylists", "favoriteArtists"]); // 音乐APP独立数据库
        const meetingSize = await getStoreSize("meetingData") + await getStoreSize("meeting_settings"); 
        const memorySize = await getStoreSize("memoryItemsV1") + await getStoreSize("memoryOutboxV1") + await getStoreSize("memorySummariesV1") + await getStoreSize("memoryAppPreferencesV1");
        const icitySize = await getStoreSize("icity_profile") + await getStoreSize("icity_feeds") + await getStoreSize("icity_diaries");

        const photoSize = wallpaperSize; 
        const appsSize = presetSize + layoutSize + worldbookSize + wechatSize + contactsSize + musicSize + meetingSize + memorySize + icitySize; 
        const chatSize = await getStoreSize("wechatChatData");
        const systemSize = fontSize + profileSize + apiSize; 

        const themeSize = presetSize + wallpaperSize + fontSize;
        const settingsSize = profileSize + apiSize + layoutSize;
        
        const totalBytes = photoSize + appsSize + chatSize + systemSize;
        const totalMB = totalBytes === 0 ? '0.00 MB' : (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';

        const themeStr = formatSizeStr(themeSize);
        const settingsStr = formatSizeStr(settingsSize);
        const worldbookStr = formatSizeStr(worldbookSize); 
        const wechatStr = formatSizeStr(wechatSize);
        const contactsStr = formatSizeStr(contactsSize);
        const musicStr = formatSizeStr(musicSize);
        const meetingStr = formatSizeStr(meetingSize);
        const memoryStr = formatSizeStr(memorySize);
        const icityStr = formatSizeStr(icitySize);
        const zeroStr = '0 KB';

        const mainSizeEl = document.getElementById('ic-main-size');
        if(mainSizeEl) mainSizeEl.innerHTML = `${totalMB} <svg class="ic-chevron" viewBox="0 0 8 13"><path d="M1.5 1.5L6.5 6.5L1.5 11.5"/></svg>`;
        
        const detailSizeEl = document.getElementById('ic-detail-size');
        if(detailSizeEl) detailSizeEl.innerText = `已使用 ${totalMB}`;

        const legendPhoto = document.getElementById('ic-legend-photo');
        if(legendPhoto) legendPhoto.innerText = `照片 ${formatSizeStr(photoSize)}`;
        
        const legendApps = document.getElementById('ic-legend-apps');
        if(legendApps) legendApps.innerText = `应用程序 ${formatSizeStr(appsSize)}`;
        
        const legendChat = document.getElementById('ic-legend-chat');
        if(legendChat) legendChat.innerText = `聊天数据 ${formatSizeStr(chatSize)}`;
        
        const legendSystem = document.getElementById('ic-legend-system');
        if(legendSystem) legendSystem.innerText = `系统数据 ${formatSizeStr(systemSize)}`;

        const getPercent = (part, total) => total === 0 ? 0 : (part / total * 100).toFixed(1);
        
        const segRed = document.getElementById('ic-seg-red');
        const segOrange = document.getElementById('ic-seg-orange');
        const segGray = document.getElementById('ic-seg-gray');
        const segLight = document.getElementById('ic-seg-light');
        
        if(segRed) segRed.style.width = `${getPercent(photoSize, totalBytes)}%`;
        if(segOrange) segOrange.style.width = `${getPercent(appsSize, totalBytes)}%`;
        if(segGray) segGray.style.width = `${getPercent(chatSize, totalBytes)}%`;
        if(segLight) segLight.style.width = `${getPercent(systemSize, totalBytes)}%`;

        const cloudTheme = document.getElementById('ic-cloud-theme-size');
        if (cloudTheme) cloudTheme.innerText = themeStr;
        
        const cloudWorldBook = document.getElementById('ic-cloud-worldbook-size');
        if (cloudWorldBook) cloudWorldBook.innerText = worldbookStr; 

        const cloudWechat = document.getElementById('ic-cloud-wechat-size');
        if (cloudWechat) cloudWechat.innerText = wechatStr;

        const cloudContacts = document.getElementById('ic-cloud-contacts-size');
        if (cloudContacts) cloudContacts.innerText = contactsStr;

        const detailSettings = document.getElementById('ic-detail-settings-size');
        if (detailSettings) detailSettings.innerHTML = `${settingsStr} <svg class="ic-chevron" viewBox="0 0 8 13"><path d="M1.5 1.5L6.5 6.5L1.5 11.5"/></svg>`;

        const detailTheme = document.getElementById('ic-detail-theme-size');
        if (detailTheme) detailTheme.innerHTML = `${themeStr} <svg class="ic-chevron" viewBox="0 0 8 13"><path d="M1.5 1.5L6.5 6.5L1.5 11.5"/></svg>`;

        const detailWorldBook = document.getElementById('ic-detail-worldbook-size');
        if (detailWorldBook) detailWorldBook.innerHTML = `${worldbookStr} <svg class="ic-chevron" viewBox="0 0 8 13"><path d="M1.5 1.5L6.5 6.5L1.5 11.5"/></svg>`; 

        const detailWechat = document.getElementById('ic-detail-wechat-size');
        if (detailWechat) detailWechat.innerHTML = `${wechatStr} <svg class="ic-chevron" viewBox="0 0 8 13"><path d="M1.5 1.5L6.5 6.5L1.5 11.5"/></svg>`;

        const detailContacts = document.getElementById('ic-detail-contacts-size');
        if (detailContacts) detailContacts.innerHTML = `${contactsStr} <svg class="ic-chevron" viewBox="0 0 8 13"><path d="M1.5 1.5L6.5 6.5L1.5 11.5"/></svg>`;

        const detailMusic = document.getElementById('ic-detail-music-size');
        if (detailMusic) detailMusic.innerHTML = `${musicStr} <svg class="ic-chevron" viewBox="0 0 8 13"><path d="M1.5 1.5L6.5 6.5L1.5 11.5"/></svg>`;

        const detailMeeting = document.getElementById('ic-detail-meeting-size');
        if (detailMeeting) detailMeeting.innerHTML = `${meetingStr} <svg class="ic-chevron" viewBox="0 0 8 13"><path d="M1.5 1.5L6.5 6.5L1.5 11.5"/></svg>`;

        const detailMemory = document.getElementById('ic-detail-memory-size');
        if (detailMemory) detailMemory.innerHTML = `${memoryStr} <svg class="ic-chevron" viewBox="0 0 8 13"><path d="M1.5 1.5L6.5 6.5L1.5 11.5"/></svg>`;

        const detailIcity = document.getElementById('ic-detail-icity-size');
        if (detailIcity) detailIcity.innerHTML = `${icityStr} <svg class="ic-chevron" viewBox="0 0 8 13"><path d="M1.5 1.5L6.5 6.5L1.5 11.5"/></svg>`;
    }

    async function requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            const isPersisted = await navigator.storage.persisted();
            if (isPersisted) {
                showToast("数据持久化已开启，数据安全");
                return;
            }
            const granted = await navigator.storage.persist();
            if (granted) {
                showToast("成功开启数据持久化储存！");
            } else {
                showCustomAlert("提示", "浏览器拒绝了持久化请求。建议：\n1. 将本网页添加到主屏幕\n2. 经常与网页互动\n3. 检查浏览器设置");
            }
            updateRealStorage();
        } else {
            showCustomAlert("提示", "当前浏览器不支持数据持久化 API。");
        }
    }

            // show three-dots button; click to expand vertical capsule menu

            // show three-dots button; click to expand vertical capsule menu
            // show three-dots button; click to expand vertical capsule menu
    async function exportAllDataJson() {
        const fileName = await showCustomPrompt('导出 JSON 备份', { placeholder: '输入文件名', value: `童话机` }, '导出');
        if (!fileName) return;
        
        showToast("正在打包数据...");
        const data = await getAllDataFromDB();
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.json') ? fileName : fileName + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("导出 JSON 成功");
    }

            // show three-dots button; click to expand vertical capsule menu
    function importAllDataJson() {
        document.getElementById('importAllDataInput').click();
    }

    function handleImportAllData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.zip')) {
            showToast("正在读取 ZIP 文件...");
            if (typeof JSZip === 'undefined') {
                const script = document.createElement('script');
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
                script.onload = () => processZipImport(file);
                script.onerror = () => showCustomAlert("错误", "无法加载 ZIP 库，请检查网络连接。");
                document.head.appendChild(script);
            } else {
                processZipImport(file);
            }
        } else {
            const reader = new FileReader();
            reader.onload = function(e) {
                processJsonImport(e.target.result);
            };
            reader.readAsText(file);
        }
        event.target.value = '';
    }

    function processZipImport(file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const zip = await JSZip.loadAsync(e.target.result);
            // show three-dots button; click to expand vertical capsule menu
                let jsonFile = zip.file("backup_data.json");
                
            // show three-dots button; click to expand vertical capsule menu
                if (!jsonFile) {
                    const files = Object.keys(zip.files).filter(name => name.endsWith('.json'));
                    if (files.length > 0) {
                        jsonFile = zip.file(files[0]);
                    }
                }

                if (!jsonFile) {
                    showCustomAlert("错误", "ZIP 文件中未找到 JSON 备份数据！");
                    return;
                }

                const content = await jsonFile.async("string");
                processJsonImport(content);
            } catch (err) {
                showCustomAlert("错误", "解析 ZIP 文件失败: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function processJsonImport(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!db) return;
            const transaction = db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            
            // show three-dots button; click to expand vertical capsule menu
            const currentSettings = {
                handle: localDriveHandle,
                mode: localDriveMode,
                fileName: localDriveFileName,
                autoEnabled: autoBackupEnabled,
                backupMode: backupModeType,
                targetName: document.getElementById('ld-target-name').innerText,
                lastTime: document.getElementById('ld-last-time').innerText,
                lastSize: document.getElementById('ld-last-size').innerText,
                intervalValue: document.getElementById('backupIntervalValue').value,
                intervalUnit: document.getElementById('backupIntervalUnitText').getAttribute('data-value'),
                scheduledTime: document.getElementById('backupScheduledTime').value
            };

            // show three-dots button; click to expand vertical capsule menu
            Object.values(data).forEach(record => {
            // show three-dots button; click to expand vertical capsule menu
                if (record.id === 'localDriveSettings' || record.id === githubBackupSettingsId) return;
                store.put(record);
            });
            
            // show three-dots button; click to expand vertical capsule menu
            store.put({
                id: "localDriveSettings",
                ...currentSettings
            });
            
            transaction.oncomplete = () => {
                showToast("恢复数据成功，即将刷新应用");
                setTimeout(() => location.reload(), 1500);
            };
        } catch (err) {
            showCustomAlert("错误", "解析备份文件失败，请确保文件格式正确！");
        }
    }

            // show three-dots button; click to expand vertical capsule menu
    async function exportAllDataZip() {
        const fileName = await showCustomPrompt('导出 ZIP 备份', { placeholder: '输入文件名', value: `童话机` }, '导出');
        if (!fileName) return;

        showToast("正在生成 ZIP...");
        if (typeof JSZip === 'undefined') {
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
            script.onload = () => doZipExport(fileName);
            script.onerror = () => showCustomAlert("错误", "无法加载 ZIP 库，请检查网络连接。");
            document.head.appendChild(script);
        } else {
            doZipExport(fileName);
        }
    }

    async function doZipExport(fileName) {
        try {
            const data = await getAllDataFromDB();
            const zip = new JSZip();
            zip.file("backup_data.json", JSON.stringify(data, null, 2));
            
            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.endsWith('.zip') ? fileName : fileName + '.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast("导出 ZIP 成功");
        } catch (err) {
            showCustomAlert("错误", "生成 ZIP 失败: " + err.message);
        }
    }

            // show three-dots button; click to expand vertical capsule menu

 // 'folder' 或 'file'


    let autoBackupInterval = 0; // 0 表示每次修改时触发
    let autoBackupTimerId = null;

    function saveLocalDriveSettings() {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        
        const targetName = document.getElementById('ld-target-name').innerText;
        const lastTime = document.getElementById('ld-last-time').innerText;
        const lastSize = document.getElementById('ld-last-size').innerText;
        const intervalValue = document.getElementById('backupIntervalValue').value;
        const intervalUnit = document.getElementById('backupIntervalUnitText').getAttribute('data-value');
        const scheduledTime = document.getElementById('backupScheduledTime').value;

        store.put({
            id: "localDriveSettings",
            handle: localDriveHandle,
            mode: localDriveMode,
            fileName: localDriveFileName,
            autoEnabled: autoBackupEnabled,
            backupMode: backupModeType,
            targetName: targetName,
            lastTime: lastTime,
            lastSize: lastSize,
            intervalValue: intervalValue,
            intervalUnit: intervalUnit,
            scheduledTime: scheduledTime
        });
    }

    function syncToLocalDrive() {
        openLocalDrivePage();
    }

    function openLocalDrivePage() {
        document.getElementById('ic-main-page').classList.remove('active');
        document.getElementById('ic-main-page').classList.add('slide-left');
        document.getElementById('ic-local-drive-page').classList.remove('slide-right');
        document.getElementById('ic-local-drive-page').classList.add('active');
    }

    function closeLocalDrivePage() {
        document.getElementById('ic-local-drive-page').classList.remove('active');
        document.getElementById('ic-local-drive-page').classList.add('slide-right');
        document.getElementById('ic-main-page').classList.remove('slide-left');
        document.getElementById('ic-main-page').classList.add('active');
    }

    async function setupFolderMode() {
        if (!('showDirectoryPicker' in window)) {
            showCustomAlert("提示", "您的浏览器不支持文件夹选择，请使用最新版桌面端 Chrome/Edge。");
            return;
        }
        try {
            // show three-dots button; click to expand vertical capsule menu
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            
            localDriveHandle = dirHandle;
            localDriveMode = 'folder';
            
            // show three-dots button; click to expand vertical capsule menu
            const fileName = await showCustomPrompt('设置备份文件名', { placeholder: '输入文件名', value: `童话机备份.json` }, '确定');
            if (fileName) {
                localDriveFileName = fileName.endsWith('.json') ? fileName : fileName + '.json';
            }
            
            // show three-dots button; click to expand vertical capsule menu
            document.getElementById('ld-current-mode').innerText = '文件夹模式';
            document.getElementById('ld-target-name').innerText = dirHandle.name; // 仅显示文件夹名
            document.getElementById('ld-file-name').innerText = localDriveFileName; // 显示文件名
            
            await performLocalBackup();
            saveLocalDriveSettings();
        } catch (err) {
            if (err.name !== 'AbortError') showCustomAlert("错误", "设置文件夹失败: " + err.message);
        }
    }

    async function setupFileMode() {
        if (!('showSaveFilePicker' in window)) {
            showCustomAlert("提示", "您的浏览器不支持单文件保存，请使用最新版桌面端 Chrome/Edge。");
            return;
        }
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: '童话机备份.json',
                types: [{
                    description: 'JSON 备份文件',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            localDriveHandle = fileHandle;
            localDriveMode = 'file';
            localDriveFileName = fileHandle.name;
            
            document.getElementById('ld-current-mode').innerText = '单文件模式';
            document.getElementById('ld-target-name').innerText = '本地指定路径';
            document.getElementById('ld-file-name').innerText = fileHandle.name;
            
            await performLocalBackup();
            saveLocalDriveSettings();
        } catch (err) {
            if (err.name !== 'AbortError') showCustomAlert("错误", "设置文件失败: " + err.message);
        }
    }

    async function performLocalBackup(isAuto = false) {
        if (!localDriveHandle || !localDriveMode) {
            if (!isAuto) showCustomAlert("提示", "请先选择文件夹模式或单文件模式。");
            return;
        }
        
        try {
            // show three-dots button; click to expand vertical capsule menu
            if (typeof localDriveHandle.queryPermission !== 'function') {
                if (isAuto) return;
                showCustomAlert("提示", "授权已失效，请重新点击【文件夹模式】或【单文件模式】选择路径。");
                return;
            }

            // show three-dots button; click to expand vertical capsule menu
            const permission = await localDriveHandle.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
                if (isAuto) {
                    console.warn("自动备份被拦截：浏览器要求用户手动授权。");
                    return; // 自动备份不能触发授权弹窗
                }
                const request = await localDriveHandle.requestPermission({ mode: 'readwrite' });
                if (request !== 'granted') {
                    showCustomAlert("提示", "未获得读写权限，无法备份。");
                    return;
                }
            }

            let fileHandleToWrite;
            if (localDriveMode === 'folder') {
                fileHandleToWrite = await localDriveHandle.getFileHandle(localDriveFileName, { create: true });
            } else {
                fileHandleToWrite = localDriveHandle;
            }

            const writable = await fileHandleToWrite.createWritable();
            const data = await getAllDataFromDB();
            const jsonString = JSON.stringify(data, null, 2);
            await writable.write(jsonString);
            await writable.close();

            // show three-dots button; click to expand vertical capsule menu
            const now = new Date();
            const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
            const sizeMB = (jsonString.length / (1024 * 1024)).toFixed(2);

            document.getElementById('ld-last-time').innerText = timeStr + (isAuto ? ' (自动)' : ' (手动)');
            document.getElementById('ld-last-size').innerText = sizeMB + ' MB';

            if (!isAuto) showToast("备份成功！");
            saveLocalDriveSettings();
        } catch (err) {
            console.error("Local backup failed:", err);
            if (!isAuto) showCustomAlert("错误", "备份失败: " + err.message);
        }
    }

 // 'action', 'interval', 'scheduled'

    function triggerAutoLocalBackup() {
            // show three-dots button; click to expand vertical capsule menu
        if (localDriveHandle && localDriveMode && autoBackupEnabled && backupModeType === 'action') {
            performLocalBackup(true);
        }
    }

    function toggleAutoBackup() {
        const toggleBtn = document.getElementById('autoBackupToggle');
        autoBackupEnabled = !autoBackupEnabled;
        if (autoBackupEnabled) {
            toggleBtn.classList.remove('off');
            startAutoBackupTimer();
            showToast("自动备份已开启");
        } else {
            toggleBtn.classList.add('off');
            stopAutoBackupTimer();
            showToast("自动备份已关闭");
        }
        saveLocalDriveSettings();
    }

    function changeBackupMode() {
        const mode = document.getElementById('autoBackupModeText').getAttribute('data-value');
        backupModeType = mode;
        
            // show three-dots button; click to expand vertical capsule menu
        document.getElementById('intervalSettingsRow').style.display = mode === 'interval' ? 'flex' : 'none';
        document.getElementById('scheduledSettingsRow').style.display = mode === 'scheduled' ? 'flex' : 'none';
        
        if (autoBackupEnabled) {
            startAutoBackupTimer();
        }
        saveLocalDriveSettings();
    }

    function updateBackupSettings() {
        if (autoBackupEnabled) {
            startAutoBackupTimer();
        }
        saveLocalDriveSettings();
    }

    function startAutoBackupTimer() {
        stopAutoBackupTimer();
        if (!autoBackupEnabled) return;

        if (backupModeType === 'interval') {
            const val = parseInt(document.getElementById('backupIntervalValue').value, 10) || 30;
            const unit = parseInt(document.getElementById('backupIntervalUnitText').getAttribute('data-value'), 10) || 60000;
            const intervalMs = val * unit;
            
            autoBackupTimerId = setInterval(() => {
                performLocalBackup(true);
            }, intervalMs);
            showToast(`已设置为每 ${val} ${unit === 60000 ? '分钟' : '小时'} 自动备份`);
            
        } else if (backupModeType === 'scheduled') {
            const timeStr = document.getElementById('backupScheduledTime').value || "02:00";
            const [hours, minutes] = timeStr.split(':').map(Number);
            
            const now = new Date();
            const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
            
            if (now > target) {
                target.setDate(target.getDate() + 1); // 如果今天的时间已过，设定为明天
            }
            
            const delay = target.getTime() - now.getTime();
            autoBackupTimerId = setTimeout(() => {
                performLocalBackup(true);
                startAutoBackupTimer(); // 触发后重新设置第二天的定时器
            }, delay);
            showToast(`已设置为每天 ${timeStr} 自动备份`);
        }
    }

    function stopAutoBackupTimer() {
        if (autoBackupTimerId) {
            clearInterval(autoBackupTimerId);
            clearTimeout(autoBackupTimerId);
            autoBackupTimerId = null;
        }
    }

    async function restoreFromLocalFolder() {
        if (localDriveMode !== 'folder' || !localDriveHandle) {
            showCustomAlert("提示", "请先设置并授权【文件夹模式】。");
            return;
        }
        try {
            // show three-dots button; click to expand vertical capsule menu
            if (typeof localDriveHandle.queryPermission !== 'function') {
                showCustomAlert("提示", "文件夹授权已失效，请重新点击【文件夹模式】选择目标文件夹。");
                return;
            }

            // show three-dots button; click to expand vertical capsule menu
            if (await localDriveHandle.queryPermission({ mode: 'read' }) !== 'granted') {
                if (await localDriveHandle.requestPermission({ mode: 'read' }) !== 'granted') {
                    showCustomAlert("提示", "未获得读取权限。");
                    return;
                }
            }

            let newestFileHandle = null;
            let newestTime = 0;

            // show three-dots button; click to expand vertical capsule menu
            for await (const entry of localDriveHandle.values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                    const file = await entry.getFile();
                    if (file.lastModified > newestTime) {
                        newestTime = file.lastModified;
                        newestFileHandle = entry;
                    }
                }
            }

            if (!newestFileHandle) {
                showCustomAlert("提示", "该文件夹中没有找到任何 JSON 备份文件。");
                return;
            }

            const confirmed = await showCustomConfirm("恢复数据", `找到最新备份文件：\n${newestFileHandle.name}\n\n确定要覆盖当前所有数据吗？`, "恢复", true);
            if (!confirmed) return;

            showToast("正在读取备份文件...");
            const file = await newestFileHandle.getFile();
            const text = await file.text();
            
            // show three-dots button; click to expand vertical capsule menu
            processJsonImport(text);

        } catch (err) {
            console.error("Restore failed:", err);
            showCustomAlert("错误", "恢复失败: " + err.message);
        }
    }

