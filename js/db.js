    let appSettings = {
        simulatedStatusBarVisible: true,
        ios_theme_mode: 'light',
        ios_brightness: 100,
        wc_presets: [],
        wc_current_preset_id: null,
        wc_custom_css: '',
        wc_timestamp_enabled: true,
        wc_bubble_theme: 'image',
        wc_bubble_color: 'default',
        wc_avatar_settings: { enabled: false, displayMode: 'all', size: 40, radius: 50, frameUrlChat: '', frameUrlUser: '', savedFrames: [] },
        wc_font_settings: null
    };
    let currentActiveTab = 'theme';
    let wallpapers = [
        { id: 'add', isAdd: true }
    ];
    let presets = [];
    let customFontCount = 0;
    let customFonts = [];
    let currentSelectedFont = 'default';
    let wcMomentsList = [];
    let wcMomentsProfile = {
        bg: '',
        avatar: '',
        name: '早虞春',
        id: '@zoouiy',
        bio: 'i luv u <3…🤍'
    };
    let wcContactGroups = [];
    let wcContactsList = [];
    let wcPresets = [];
    let wcCurrentPresetId = null;
    let wcTimestampEnabled = true;
    let wcCurrentBubbleTheme = 'image';
    let wcCurrentColorScheme = 'default';
    let wcAvatarSettings = { enabled: false, displayMode: 'all', size: 40, radius: 50, frameUrlChat: '', frameUrlUser: '', savedFrames: [] };
    let wcCurrentFontFamily = 'default';
    let wcChatBgList = [];
    let wcCurrentChatBg = '';
    let wcEmojiGroups = [];
    let wbGroups = [];
    let wbEntries = [];
    window.getWorldbookGroups = function () {
        return Array.isArray(wbGroups)
            ? wbGroups.filter(group => group && group.id).map(group => ({ id: group.id, name: group.name }))
            : [];
    };
    let apiDataList = [];
    let apiConnectedId = null;
    let localDriveHandle = null;
    let localDriveMode = null;
    let localDriveFileName = '童话机备份.json';
    let autoBackupEnabled = false;
    let backupModeType = 'action';
    const dbName = "iOSDesktopDB";
    const storeName = "layoutStore";
    let db;

    function initDB() {
            // show three-dots button; click to expand vertical capsule menu
        const request = indexedDB.open(dbName); 
        
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "id" });
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            // show three-dots button; click to expand vertical capsule menu
            if (!db.objectStoreNames.contains(storeName)) {
                const currentVersion = db.version;
                db.close();
                const upgradeRequest = indexedDB.open(dbName, currentVersion + 1);
                upgradeRequest.onupgradeneeded = (e2) => {
                    const db2 = e2.target.result;
                    if (!db2.objectStoreNames.contains(storeName)) {
                        db2.createObjectStore(storeName, { keyPath: "id" });
                    }
                };
                upgradeRequest.onsuccess = (e2) => {
                    db = e2.target.result;
                    loadLayout();
                };
                upgradeRequest.onerror = (e2) => {
                    console.error("IndexedDB upgrade error:", e2);
                    renderDefaultLayout();
                };
                return;
            }
            loadLayout();
        };

        request.onerror = (e) => {
            console.error("IndexedDB error:", e);
            renderDefaultLayout(); // 发生错误时降级显示默认布局
        };
    }

    function saveLayout() {
        if (!db) return;
        const desktopApps = [];
        document.querySelectorAll('#desktopGrid .desktop-slot').forEach((slot, index) => {
            const app = slot.querySelector('.app-item');
            if (app) {
                const iconEl = app.querySelector('.app-icon');
                const iconBg = iconEl.style.backgroundImage;
                const appId = app.getAttribute('data-app-id');
                const isWidget = app.classList.contains('is-widget');
                const appData = { 
                    index, 
                    name: app.querySelector('.app-name').innerText,
                    icon: iconBg !== '' && iconBg !== 'none' ? iconBg : null,
                    appId: appId,
                    isWidget: isWidget
                };
                if (isWidget) {
                    appData.widgetContent = app.getAttribute('data-widget-content') || '';
                    appData.width = app.getAttribute('data-widget-width') || '';
                    appData.height = app.getAttribute('data-widget-height') || '';
                    appData.presetSize = app.getAttribute('data-widget-preset-size') || '';
                }
                desktopApps.push(appData);
            }
        });

        const dockApps = [];
        document.querySelectorAll('#dock .app-item').forEach((app, index) => {
            const iconEl = app.querySelector('.app-icon');
            const iconBg = iconEl.style.backgroundImage;
            const appId = app.getAttribute('data-app-id');
            const isDockWidget = app.classList.contains('is-widget');
            const dockAppData = { 
                index, 
                name: app.querySelector('.app-name').innerText,
                icon: iconBg !== '' && iconBg !== 'none' ? iconBg : null,
                appId: appId,
                isWidget: isDockWidget
            };
            if (isDockWidget) {
                dockAppData.widgetContent = app.getAttribute('data-widget-content') || '';
                dockAppData.width = app.getAttribute('data-widget-width') || '';
                dockAppData.height = app.getAttribute('data-widget-height') || '';
                dockAppData.presetSize = app.getAttribute('data-widget-preset-size') || '';
            }
            dockApps.push(dockAppData);
        });

        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: "currentLayout", desktop: desktopApps, dock: dockApps });
        
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }

    function loadLayout() {
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get("currentLayout");

        request.onsuccess = (e) => {
            const data = e.target.result;
            // show three-dots button; click to expand vertical capsule menu
            if (data && Array.isArray(data.desktop) && Array.isArray(data.dock)) {
                renderLayout(data.desktop, data.dock);
            } else {
            // show three-dots button; click to expand vertical capsule menu
                renderDefaultLayout();
            }
        };

            // show three-dots button; click to expand vertical capsule menu
        const wpRequest = store.get("wallpaperData");
        wpRequest.onsuccess = (e) => {
            const wpData = e.target.result;
            if (wpData && wpData.wallpapers) {
                wallpapers = wpData.wallpapers;
                if (wpData.current) {
                    applyWallpaperToDesktop(wpData.current);
                }
            }
            renderWallpapers();
        };

            // show three-dots button; click to expand vertical capsule menu
        const presetRequest = store.get("presetData");
        presetRequest.onsuccess = (e) => {
            const pData = e.target.result;
            if (pData && pData.presets) {
                presets = pData.presets;
            }
            
            // show three-dots button; click to expand vertical capsule menu
            const hasDefault = presets.find(p => p.id === "default_theme_001");
            if (!hasDefault) {
                const defaultPreset = {
                    id: "default_theme_001",
                    name: "默认主题",
                    date: "系统内置",
                    wallpaper: null,
                    sizeMB: 0.01,
                    desktop: [
                        { index: 0, name: '设置', appId: 'settings', icon: "url('https://cac.opple.com/yc-media/getFile?id=5b0f2ceab564421096b8a761f125b9f8#.jpg')" }, 
                        { index: 1, name: 'wechat', icon: "url('https://www.yn12377.cn/jubao/upload/smjb/2026/07/13/e4b01d48b8ad4a5b82879231b5376827.png')" },
                        { index: 2, name: 'Contacts', appId: 'contacts', icon: "url('https://nos.netease.com/ysf/1390642a446f8db21a89e22b6cc5dc97.png')" }, 
                        { index: 3, name: '世界书', appId: 'worldbook', icon: "url('https://wxkb-res-1258476243.cos.ap-shanghai.myqcloud.com/web/img/8848100788856671/1L7mKgmQ7qzXUq1S34ehFM_20260713082207#.png')" }
                    ],
                    dock: [
                        { index: 0, name: '电话', icon: "url('https://xffkws.iflytek.com/group1/M01/09/0B/rB_aXmpUoCqAUSc8AAHTcnjGP3Q336.png')" }, 
                        { index: 1, name: '信息', icon: "url('https://wxkb-res-1258476243.cos.ap-shanghai.myqcloud.com/web/img/8848100788856671/jRVvCDUWmZhAzGjBjgMKqg_20260713082218#.png')" }, 
                        { index: 2, name: '主题', appId: 'theme', icon: "url('https://nos.netease.com/ysf/edecff66f1f78185763da92dcc2bd617.png')" }
                    ]
                };
                presets.unshift(defaultPreset); // 插入到最前面
                savePresetData(); // 保存到数据库
            }
        };

            // show three-dots button; click to expand vertical capsule menu
        const fontRequest = store.get("fontData");
        fontRequest.onsuccess = (e) => {
            const fData = e.target.result;
            if (fData && fData.fonts) {
                customFonts = fData.fonts;
                currentSelectedFont = fData.current || 'default';
                restoreFonts();
            } else {
            // show three-dots button; click to expand vertical capsule menu
                selectFont('default', document.querySelector('.font-list-item[data-font="default"]'), true);
            }
        };

            // show three-dots button; click to expand vertical capsule menu
        const apiRequest = store.get("apiData");
        apiRequest.onsuccess = (e) => {
            const aData = e.target.result;
            if (aData && aData.list) {
                apiDataList = aData.list;
                apiConnectedId = aData.connectedId;
            }
        };

            // show three-dots button; click to expand vertical capsule menu
        const profileRequest = store.get("profileData");
        profileRequest.onsuccess = (e) => {
            const pData = e.target.result;
            if (pData && pData.avatar) {
                const appleIdAvatar = document.getElementById('appleIdAvatarPreview');
                const settingsAvatar = document.getElementById('settingsAvatarPreview');
                if (appleIdAvatar) {
                    appleIdAvatar.innerHTML = '';
                    appleIdAvatar.style.backgroundImage = `url('${pData.avatar}')`;
                    appleIdAvatar.style.backgroundSize = 'cover';
                    appleIdAvatar.style.backgroundPosition = 'center';
                }
                if (settingsAvatar) {
                    settingsAvatar.innerHTML = '';
                    settingsAvatar.style.backgroundImage = `url('${pData.avatar}')`;
                    settingsAvatar.style.backgroundSize = 'cover';
                    settingsAvatar.style.backgroundPosition = 'center';
                }
            }
        };

            // show three-dots button; click to expand vertical capsule menu
        const ldRequest = store.get("localDriveSettings");
        ldRequest.onsuccess = (e) => {
            const ldData = e.target.result;
            if (ldData) {
                localDriveHandle = ldData.handle;
                localDriveMode = ldData.mode;
                localDriveFileName = ldData.fileName;
                autoBackupEnabled = ldData.autoEnabled;
                backupModeType = ldData.backupMode;
                
            // show three-dots button; click to expand vertical capsule menu
                document.getElementById('ld-current-mode').innerText = ldData.mode === 'folder' ? '文件夹模式' : (ldData.mode === 'file' ? '单文件模式' : '未设置');
                document.getElementById('ld-target-name').innerText = ldData.targetName || '--';
                document.getElementById('ld-file-name').innerText = ldData.fileName || '--';
                document.getElementById('ld-last-time').innerText = ldData.lastTime || '--';
                document.getElementById('ld-last-size').innerText = ldData.lastSize || '--';
                
                const modeMap = { 'action': '每次修改时', 'interval': '间隔时间备份', 'scheduled': '定时备份' };
                const unitMap = { '60000': '分钟', '3600000': '小时' };
                const modeVal = ldData.backupMode || 'action';
                const unitVal = ldData.intervalUnit || '60000';
                
                const modeTextEl = document.getElementById('autoBackupModeText');
                if(modeTextEl) { modeTextEl.setAttribute('data-value', modeVal); modeTextEl.innerText = modeMap[modeVal]; }
                
                document.getElementById('backupIntervalValue').value = ldData.intervalValue || '30';
                
                const unitTextEl = document.getElementById('backupIntervalUnitText');
                if(unitTextEl) { unitTextEl.setAttribute('data-value', unitVal); unitTextEl.innerText = unitMap[unitVal]; }
                
                document.getElementById('backupScheduledTime').value = ldData.scheduledTime || '02:00';
                
                const toggleBtn = document.getElementById('autoBackupToggle');
                if (autoBackupEnabled) {
                    toggleBtn.classList.remove('off');
                } else {
                    toggleBtn.classList.add('off');
                }
                
            // show three-dots button; click to expand vertical capsule menu
                changeBackupMode(); 
            }
        };

        // --- 新增：加载世界书数据 ---
        const wbRequest = store.get("worldbookData");
        wbRequest.onsuccess = (e) => {
            const wbData = e.target.result;
            if (wbData) {
                wbGroups = wbData.groups || [];
                wbEntries = wbData.entries || [];
            } else {
                // 默认初始化一个未分类分组
                wbGroups = [{ id: 'default_unclassified', name: '未分类', isPinned: false }];
                wbEntries = [];
            }
        };

        // --- 新增：加载微信聊天壁纸数据 ---
        const wcBgRequest = store.get("wechatBgData");
        wcBgRequest.onsuccess = (e) => {
            const data = e.target.result;
            if (data) {
                wcChatBgList = data.list || [];
                wcCurrentChatBg = data.current || '';
                if (typeof wcApplyChatBg === 'function') wcApplyChatBg();
            }
        };

        // --- 加载微信朋友圈数据 ---
        const wcMomentsRequest = store.get("wechatMomentsData");
        wcMomentsRequest.onsuccess = (e) => {
            const data = e.target.result;
            if (data) {
                wcMomentsList = data.list || [];
            } else {
                wcMomentsList = [
                    {
                        id: 'm1',
                        name: '早虞春',
                        avatar: '<svg viewBox="0 0 24 24" width="24" height="24" fill="#999"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
                        text: '今天的天气很好，适合散步。',
                        time: '10分钟前',
                        images: [],
                        likes: ['音无结弦', '仲村由理'],
                        comments: [
                            { name: '音无结弦', content: '一起去吃麻婆豆腐吧！' }
                        ]
                    },
                    {
                        id: 'm2',
                        name: '早虞春',
                        avatar: '<svg viewBox="0 0 24 24" width="24" height="24" fill="#999"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
                        text: '分享一些最近的随手拍。',
                        time: '昨天',
                        images: [
                            '<svg viewBox="0 0 24 24" width="24" height="24" stroke="#adb5bd" stroke-width="1.5" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><polyline points="21 15 16 10 5 21"></polyline></svg>',
                            '<svg viewBox="0 0 24 24" width="24" height="24" stroke="#adb5bd" stroke-width="1.5" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><polyline points="21 15 16 10 5 21"></polyline></svg>',
                            '<svg viewBox="0 0 24 24" width="24" height="24" stroke="#adb5bd" stroke-width="1.5" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><polyline points="21 15 16 10 5 21"></polyline></svg>'
                        ],
                        likes: [],
                        comments: []
                    }
                ];
            }
            if (typeof wcRenderMoments === 'function') {
                wcRenderMoments();
            }
        };

        // --- 加载微信朋友圈个人资料数据 ---
        const wcMomentsProfileReq = store.get("wechatMomentsProfileData");
        wcMomentsProfileReq.onsuccess = (e) => {
            const data = e.target.result;
            if (data && data.profile) {
                wcMomentsProfile = data.profile;
            }
            if (typeof wcRenderMomentsProfile === 'function') wcRenderMomentsProfile();
        };

        // --- 加载微信联系人数据 ---
        const wcContactsRequest = store.get("wechatContactsData");
        wcContactsRequest.onsuccess = (e) => {
            const data = e.target.result;
            if (data) {
                const sampleIds = new Set(['c1', 'c2', 'c3', 'c4']);
                wcContactsList = (Array.isArray(data.contacts) ? data.contacts : []).filter(contact => !sampleIds.has(contact?.id));
                wcContactGroups = Array.isArray(data.groups) ? data.groups.slice() : [];
                const groupUsed = wcContactsList.some(contact => contact.groupId === 'g_group');
                if (!groupUsed) wcContactGroups = wcContactGroups.filter(group => group.id !== 'g_group');
                if (!wcContactGroups.some(group => group.id === 'g_member')) wcContactGroups.unshift({ id: 'g_member', name: 'Member' });
                const cleaned = wcContactsList.length !== (Array.isArray(data.contacts) ? data.contacts.length : 0)
                    || wcContactGroups.length !== (Array.isArray(data.groups) ? data.groups.length : 0);
                if (cleaned) wcSaveContactsData();
            } else {
                wcContactGroups = [{ id: 'g_member', name: 'Member' }];
                wcContactsList = [];
            }
            if (typeof wcRenderContactTabs === 'function') {
                wcRenderContactTabs();
                wcRenderContactList();
            }
        };

        // --- 加载微信表情包数据 ---
        const wcEmojiRequest = store.get("wechatEmojiData");
        wcEmojiRequest.onsuccess = (e) => {
            const data = e.target.result;
            if (data && data.groups) {
                wcEmojiGroups = data.groups;
            } else {
                // 默认数据 (已清空占位)
                wcEmojiGroups = [];
            }
        };

        // --- 加载全局设置数据 ---
        const settingsRequest = store.get("appSettings");
        settingsRequest.onsuccess = (e) => {
            const sData = e.target.result;
            if (sData && sData.data) {
                appSettings = Object.assign(appSettings, sData.data);
            }
            
            // 在数据加载完成后执行初始化
            applyStatusBarVisibility();
            initThemeAndBrightness();
            
            wcPresets = appSettings.wc_presets || [];
            wcCurrentPresetId = appSettings.wc_current_preset_id;
            
            if (appSettings.wc_custom_css) {
                const cssInput = document.getElementById('wc-custom-css-input');
                if (cssInput) cssInput.value = appSettings.wc_custom_css;
                wcApplyCustomCss(appSettings.wc_custom_css);
            }

            wcTimestampEnabled = appSettings.wc_timestamp_enabled;
            wcApplyTimestampSettings();
            
            wcCurrentBubbleTheme = appSettings.wc_bubble_theme || 'image';
            wcCurrentColorScheme = appSettings.wc_bubble_color || 'default';
            wcApplyBubbleTheme();
            
            if (appSettings.wc_avatar_settings) {
                wcAvatarSettings = appSettings.wc_avatar_settings;
            }
            initWcAvatarSettings();
            initWcFontSettings();
        };
    }

    let currentWallpaperSrc = null;

    function saveWallpaperData() {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: "wallpaperData", wallpapers: wallpapers, current: currentWallpaperSrc });
        
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }

    function saveProfileData(avatarUrl) {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: "profileData", avatar: avatarUrl });
        
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }


    function saveAppSettings() {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: "appSettings", data: appSettings });
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }


    function savePresetData() {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: "presetData", presets: presets });
        
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }


    function saveFontData() {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const currentSize = document.getElementById('fontSizeSlider').value;
        store.put({ id: "fontData", fonts: customFonts, current: currentSelectedFont, size: currentSize });
        
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }


    function wcSaveMomentsData() {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: "wechatMomentsData", list: wcMomentsList });
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }


    function wcSaveMomentsProfileData() {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: "wechatMomentsProfileData", profile: wcMomentsProfile });
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }


    function wcSaveContactsData() {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: "wechatContactsData", groups: wcContactGroups, contacts: wcContactsList });
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }


    function wcSaveChatBgDataToDB() {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: "wechatBgData", list: wcChatBgList, current: wcCurrentChatBg });
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }


    function wcSaveEmojiData() {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: "wechatEmojiData", groups: wcEmojiGroups });
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }


    function saveWorldbookData() {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: "worldbookData", groups: wbGroups, entries: wbEntries });
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }


    function saveApiData() {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: "apiData", list: apiDataList, connectedId: apiConnectedId });
        
        if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
    }


    async function getAllDataFromDB() {
        return new Promise((resolve) => {
            if (!db) return resolve({});
            const transaction = db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = (e) => {
                const allRecords = e.target.result;
                const dataObj = {};
                allRecords.forEach(record => {
                    dataObj[record.id] = record;
                });
                resolve(dataObj);
            };
        });
    }

