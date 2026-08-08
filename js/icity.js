(() => {
    // 1. 划定势力范围：只在这个容器内寻找元素，绝对防止冲突
    const icityRoot = document.getElementById('icityNewAppUI');
    const $ = (selector) => icityRoot ? icityRoot.querySelector(selector) : null;
    const $$ = (selector) => icityRoot ? icityRoot.querySelectorAll(selector) : [];

    // ================= 暴露给全局的打开/关闭方法 =================
    window.openICityApp = function() {
        const ui = document.getElementById('icityNewAppUI');
        if (ui) {
            ui.style.display = 'block';
            loadData();
        }
    };

    window.closeICityApp = function() {
        const ui = document.getElementById('icityNewAppUI');
        if (ui) {
            ui.style.display = 'none';
        }
    };

    // ================= 数据存储逻辑 (接入全局 layoutStore) =================
    async function getIcityData(key, defaultVal) {
        return new Promise((resolve) => {
            if (!window.db) return resolve(defaultVal);
            const tx = window.db.transaction(['layoutStore'], 'readonly');
            const req = tx.objectStore('layoutStore').get(key);
            req.onsuccess = () => resolve(req.result ? req.result.data : defaultVal);
            req.onerror = () => resolve(defaultVal);
        });
    }

    async function saveIcityData(key, data) {
        return new Promise((resolve) => {
            if (!window.db) {
                console.warn('全局数据库尚未准备好，保存操作已跳过:', key);
                return resolve(false);
            }
            try {
                const tx = window.db.transaction(['layoutStore'], 'readwrite');
                const req = tx.objectStore('layoutStore').put({ id: key, data: data });
                req.onsuccess = () => {
                    if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
                    resolve(true);
                };
                req.onerror = (e) => {
                    console.error('iCity 数据保存失败:', e);
                    resolve(false);
                };
            } catch (error) {
                console.error('iCity 数据库事务异常:', error);
                resolve(false);
            }
        });
    }

    function getProfile() { return getIcityData('icity_profile', {}); }
    function getFeeds() { return getIcityData('icity_feeds', []); }
    
    async function saveFeed(feed) {
        const feeds = await getFeeds();
        const index = feeds.findIndex(f => f.id === feed.id);
        if (index !== -1) feeds[index] = feed;
        else feeds.push(feed);
        await saveIcityData('icity_feeds', feeds);
    }
    
    async function deleteFeed(id) {
        let feeds = await getFeeds();
        feeds = feeds.filter(f => f.id !== Number(id));
        await saveIcityData('icity_feeds', feeds);
    }
    
    async function saveProfileData(key, value) {
        const profile = await getProfile();
        profile[key] = value;
        await saveIcityData('icity_profile', profile);
    }
    
    async function getDiaries() { return getIcityData('icity_diaries', []); }
    
    async function saveDiary(diary) {
        const diaries = await getDiaries();
        if (!diary.id) {
            diary.id = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            diaries.push(diary);
        } else {
            const index = diaries.findIndex(d => d.id === diary.id);
            if (index !== -1) diaries[index] = diary;
            else diaries.push(diary);
        }
        await saveIcityData('icity_diaries', diaries);
    }
    
    async function deleteDiary(id) {
        let diaries = await getDiaries();
        diaries = diaries.filter(d => d.id !== id);
        await saveIcityData('icity_diaries', diaries);
    }

    // 数据迁移逻辑 (将旧版独立的 iCityDB 数据自动迁移到全局 layoutStore)
    function migrateOldICityDB() {
        if (!window.db) {
            setTimeout(migrateOldICityDB, 100);
            return;
        }
        const req = indexedDB.open('iCityDB', 2);
        req.onsuccess = (e) => {
            const oldDb = e.target.result;
            if (!oldDb.objectStoreNames.contains('profile')) return;
            getIcityData('icity_migrated', false).then(migrated => {
                if (migrated) return;
                try {
                    const tx1 = oldDb.transaction('profile', 'readonly');
                    tx1.objectStore('profile').get('me').onsuccess = (e) => { if (e.target.result) saveIcityData('icity_profile', e.target.result); };
                    const tx2 = oldDb.transaction('feeds', 'readonly');
                    tx2.objectStore('feeds').getAll().onsuccess = (e) => { if (e.target.result && e.target.result.length > 0) saveIcityData('icity_feeds', e.target.result); };
                    const tx3 = oldDb.transaction('diaries', 'readonly');
                    tx3.objectStore('diaries').getAll().onsuccess = (e) => { if (e.target.result && e.target.result.length > 0) saveIcityData('icity_diaries', e.target.result); };
                    saveIcityData('icity_migrated', true);
                } catch(err) {}
            });
        };
    }
    migrateOldICityDB();

    function loadData() {
        const currentMonth = new Date().getMonth() + 1;
        const recordTag = $('#view-home .record-tag');
        if (recordTag) {
            recordTag.textContent = `${currentMonth}月记录`;
        }

        getProfile().then((data) => {
            if (data && Object.keys(data).length > 0) {
                if (data.nickname) {
                    const settingsNicknameVal = $('#settings-nickname-val');
                    if(settingsNicknameVal) settingsNicknameVal.textContent = data.nickname;
                    const userName = $('.user-name');
                    if(userName) userName.textContent = data.nickname;
                    const appSettingsName = $('#app-settings-nickname');
                    if(appSettingsName) appSettingsName.textContent = data.nickname;
                }
                if (data.avatar) {
                    const settingsAvatarPreview = $('#settings-avatar-preview');
                    if(settingsAvatarPreview) {
                        settingsAvatarPreview.style.backgroundImage = data.avatar;
                        settingsAvatarPreview.innerHTML = '';
                    }
                    const avatarWrapper = $('.avatar-wrapper');
                    if(avatarWrapper) {
                        avatarWrapper.style.backgroundImage = data.avatar;
                        avatarWrapper.style.backgroundSize = 'cover';
                        avatarWrapper.style.backgroundPosition = 'center';
                    }
                    
                    $$('.sync-avatar').forEach(el => {
                        el.style.backgroundImage = data.avatar;
                        el.style.backgroundSize = 'cover';
                        el.style.backgroundPosition = 'center';
                        el.innerHTML = '';
                    });
                    const navAvatar = $('#tab-profile .nav-avatar');
                    if (navAvatar) {
                        navAvatar.style.backgroundImage = data.avatar;
                        navAvatar.style.backgroundSize = 'cover';
                        navAvatar.style.backgroundPosition = 'center';
                    }
                } else {
                    $$('.sync-avatar').forEach(el => {
                        el.style.backgroundImage = 'linear-gradient(to bottom right, #888, #ccc)';
                        el.innerHTML = '';
                    });
                    const navAvatar = $('#tab-profile .nav-avatar');
                    if (navAvatar) {
                        navAvatar.style.backgroundImage = 'linear-gradient(to bottom right, #888, #ccc)';
                    }
                }
                if (data.bg) {
                    const settingsBgPreview = $('#settings-bg-preview');
                    if(settingsBgPreview) {
                        settingsBgPreview.style.backgroundImage = data.bg;
                        settingsBgPreview.innerHTML = '';
                    }
                    const profileHeaderBg = $('.profile-header-bg');
                    if(profileHeaderBg) {
                        profileHeaderBg.style.backgroundImage = data.bg;
                        profileHeaderBg.style.backgroundSize = 'cover';
                        profileHeaderBg.style.backgroundPosition = 'center';
                    }
                }
                if (data.bio) {
                    const settingsBioVal = $('#settings-bio-val');
                    if(settingsBioVal) {
                        settingsBioVal.textContent = data.bio;
                        settingsBioVal.style.color = data.bio === '介绍一下自己' ? 'var(--text-light)' : 'var(--text-main)';
                    }
                }
                if (data.icityId) {
                    const settingsIcityIdVal = $('#settings-icity-id-val');
                    if(settingsIcityIdVal) settingsIcityIdVal.textContent = data.icityId;
                    const userHandle = $('.user-handle');
                    if(userHandle) userHandle.textContent = '@' + data.icityId;
                    const appSettingsId = $('#app-settings-icity-id');
                    if(appSettingsId) appSettingsId.textContent = data.icityId;
                }
                if (data.autoHd) {
                    const valAutoHd = $('#val-setting-auto-hd');
                    if(valAutoHd) valAutoHd.textContent = data.autoHd;
                }
                if (data.uploadSize) {
                    const valUploadSize = $('#val-setting-upload-size');
                    if(valUploadSize) valUploadSize.textContent = data.uploadSize;
                }
                if (data.email) {
                    const settingsEmailVal = $('#settings-email-val');
                    if(settingsEmailVal) settingsEmailVal.textContent = data.email;
                }
                if (data.gender) {
                    const settingsGenderVal = $('#settings-gender-val');
                    if(settingsGenderVal) settingsGenderVal.textContent = data.gender;
                }
                if (data.location) {
                    const settingsLocationVal = $('#settings-location-val');
                    if(settingsLocationVal) {
                        settingsLocationVal.textContent = data.location;
                        settingsLocationVal.style.color = data.location === '可选' ? 'var(--text-light)' : 'var(--text-main)';
                    }
                    const userLocation = $('.user-location');
                    if (userLocation && data.location !== '可选') {
                        userLocation.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path></svg> ' + data.location;
                    }
                }
                
                const valSettings = $('#val-settings-earth-day');
                const valAppSettings = $('#val-app-settings-earth-day');
                const statusText = data.birthDate ? '已设置' : '未设置';
                if (valSettings) valSettings.textContent = statusText;
                if (valAppSettings) valAppSettings.textContent = statusText;
            }
            if (typeof renderAllFeeds === 'function') renderAllFeeds();
        });

        refreshDiaryList();
    }

    function refreshDiaryList() {
        const scrollArea = $('.diary-books-scroll');
        const newBtn = $('#btn-create-diary');
        const profileBooksContainer = $('#profile-diary-books-container');
        const profileMoreBookCount = $('#profile-more-book-count');

        if (scrollArea && newBtn) {
            scrollArea.innerHTML = '';
            scrollArea.appendChild(newBtn);
        }
        
        if (profileBooksContainer) {
            profileBooksContainer.innerHTML = '';
        }
        
        getDiaries().then((diaries) => {
            diaries.sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return b.createdAt - a.createdAt;
            });
            
            if (profileMoreBookCount) {
                profileMoreBookCount.textContent = diaries.length;
            }

            diaries.forEach(diary => {
                if (scrollArea && newBtn) {
                    renderDiaryCard(diary, scrollArea, newBtn);
                }
                if (profileBooksContainer) {
                    renderDiaryCard(diary, profileBooksContainer, null);
                }
            });
            
            if (profileBooksContainer && diaries.length === 0) {
                profileBooksContainer.innerHTML = '<div style="width: 100%; text-align: center; color: var(--text-light); font-size: 13px; padding: 10px 0;">暂无日记本</div>';
            }
        });
    }

    function renderDiaryCard(diary, container, insertAfterElement) {
        const newCard = document.createElement('div');
        newCard.className = 'diary-book-card';
        newCard.style.cursor = 'pointer';
        newCard.style.background = diary.coverBg;
        newCard.style.color = 'white';
        newCard.style.alignItems = 'flex-start';
        newCard.style.justifyContent = 'flex-start';
        newCard.style.padding = '12px';
        
        newCard.innerHTML = `
            <div class="stamp" style="position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; background-color: rgba(255,255,255,0.9); border-radius: 2px; display: flex; align-items: center; justify-content: center; color: #3A90C2; transform: rotate(10deg);">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 2.5-1.06 4.85-2.95 6.64-3.83 3.79-10.05 3.79-13.88 0-3.83-3.79-3.83-9.95 0-13.74 3.83-3.79 10.05-3.79 13.88 0l2.95-3.04V10.12zM12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5z"></path></svg>
            </div>
            <div class="title" style="font-size: 15px; font-weight: 600; margin-top: 30px; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">${diary.name}</div>
            <div class="bottom-info" style="position: absolute; bottom: 8px; left: 12px; right: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; opacity: 0.9;">
                <span>0</span>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path></svg>
            </div>
        `;
        
        newCard.addEventListener('click', () => {
            if (typeof openDiaryDetail === 'function') openDiaryDetail(diary);
        });
        
        if (insertAfterElement) {
            insertAfterElement.insertAdjacentElement('afterend', newCard);
        } else {
            container.appendChild(newCard);
        }
    }

    // 移除旧的 initDB 调用，因为现在依赖全局 window.db
    // ================= 视图切换逻辑 =================
    const tabHome = $('#tab-home');
    const tabWorld = $('#tab-world');
    const tabMessage = $('#tab-message');
    const tabProfile = $('#tab-profile');
    
    const viewHome = $('#view-home');
    const viewWorld = $('#view-world');
    const viewMessage = $('#view-message');
    const viewProfile = $('#view-profile');

    function switchView(viewName) {
        if(tabHome) tabHome.classList.remove('active');
        if(tabWorld) tabWorld.classList.remove('active');
        if(tabMessage) tabMessage.classList.remove('active');
        if(tabProfile) tabProfile.classList.remove('active');
        
        if(viewHome) viewHome.classList.remove('active');
        if(viewWorld) viewWorld.classList.remove('active');
        if(viewMessage) viewMessage.classList.remove('active');
        if(viewProfile) viewProfile.classList.remove('active');

        if (viewName === 'home') {
            if(tabHome) tabHome.classList.add('active');
            if(viewHome) viewHome.classList.add('active');
        } else if (viewName === 'world') {
            if(tabWorld) tabWorld.classList.add('active');
            if(viewWorld) viewWorld.classList.add('active');
        } else if (viewName === 'message') {
            if(tabMessage) tabMessage.classList.add('active');
            if(viewMessage) viewMessage.classList.add('active');
        } else if (viewName === 'profile') {
            if(tabProfile) tabProfile.classList.add('active');
            if(viewProfile) viewProfile.classList.add('active');
        }
    }

    if(tabHome) tabHome.addEventListener('click', () => switchView('home'));
    if(tabWorld) tabWorld.addEventListener('click', () => switchView('world'));
    if(tabMessage) tabMessage.addEventListener('click', () => switchView('message'));
    if(tabProfile) tabProfile.addEventListener('click', () => switchView('profile'));

    // ================= 交互 1：主页「写点什么」卡片展开与收起 =================
    const inlineEditor = $('#inline-editor');
    const collapseIcon = $('#collapse-editor');

    if (inlineEditor) {
        inlineEditor.addEventListener('click', function(e) {
            if (!this.classList.contains('expanded')) {
                this.classList.add('expanded');
                setTimeout(() => {
                    const textarea = this.querySelector('.editor-textarea');
                    if(textarea) textarea.focus();
                }, 300);
            }
        });
    }

    if (collapseIcon) {
        collapseIcon.addEventListener('click', function(e) {
            e.stopPropagation(); 
            if(inlineEditor) inlineEditor.classList.remove('expanded');
        });
    }

    document.addEventListener('click', function(e) {
        if (inlineEditor && inlineEditor.classList.contains('expanded') && !inlineEditor.contains(e.target)) {
            inlineEditor.classList.remove('expanded');
        }
    });

    // ================= 交互 1.5：详情页「写点什么」卡片展开与收起 =================
    const inlineEditorDetail = $('#inline-editor-detail');
    const collapseIconDetail = $('#collapse-editor-detail');

    if (inlineEditorDetail && collapseIconDetail) {
        inlineEditorDetail.addEventListener('click', function(e) {
            if (!this.classList.contains('expanded')) {
                this.classList.add('expanded');
                setTimeout(() => {
                    const textarea = this.querySelector('.editor-textarea');
                    if(textarea) textarea.focus();
                }, 300);
            }
        });

        collapseIconDetail.addEventListener('click', function(e) {
            e.stopPropagation(); 
            inlineEditorDetail.classList.remove('expanded');
        });

        document.addEventListener('click', function(e) {
            if (inlineEditorDetail.classList.contains('expanded') && !inlineEditorDetail.contains(e.target)) {
                inlineEditorDetail.classList.remove('expanded');
            }
        });
    }

    // ================= 交互 2：点击钢笔弹出居中弹窗 =================
    const btnPublish = $('#btn-publish');
    const publishModal = $('#publish-modal');
    const closeModal = $('#close-modal');

    if (btnPublish && publishModal) {
        btnPublish.addEventListener('click', () => {
            publishModal.classList.add('active');
        });
    }

    if (closeModal && publishModal) {
        closeModal.addEventListener('click', () => {
            publishModal.classList.remove('active');
        });
    }

    if (publishModal) {
        publishModal.addEventListener('click', (e) => {
            if (e.target === publishModal) {
                publishModal.classList.remove('active');
            }
        });
    }

    // ================= 交互 3：点击新建日记本弹出居中弹窗 =================
    const btnCreateDiary = $('#btn-create-diary');
    const createDiaryModal = $('#create-diary-modal');
    const closeCreateDiary = $('#close-create-diary');

    if (btnCreateDiary && createDiaryModal) {
        btnCreateDiary.addEventListener('click', () => {
            createDiaryModal.classList.add('active');
        });
    }

    if (closeCreateDiary && createDiaryModal) {
        closeCreateDiary.addEventListener('click', () => {
            createDiaryModal.classList.remove('active');
        });
    }

    if (createDiaryModal) {
        createDiaryModal.addEventListener('click', (e) => {
            if (e.target === createDiaryModal) {
                createDiaryModal.classList.remove('active');
            }
        });
    }

    // ================= 交互 4：自选封面上传与预览逻辑 =================
    const btnCustomCover = $('#btn-custom-cover');
    const inputCustomCover = $('#input-custom-cover');

    if (btnCustomCover && inputCustomCover) {
        btnCustomCover.addEventListener('click', () => {
            inputCustomCover.click();
        });

        inputCustomCover.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    btnCustomCover.style.backgroundImage = `url(${event.target.result})`;
                    btnCustomCover.style.backgroundSize = 'cover';
                    btnCustomCover.style.backgroundPosition = 'center';
                    btnCustomCover.innerHTML = ''; 
                    
                    selectedCoverBg = `url(${event.target.result}) center/cover`;
                    $$('.create-diary-cover-item').forEach(c => c.classList.remove('selected'));
                    btnCustomCover.classList.add('selected');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // ================= 交互 5：真实创建日记本逻辑 =================
    const btnVisibility = $('#btn-visibility');
    const textVisibility = $('#text-visibility');
    const visibilityOptions = ['仅自己', '公开', '仅好友可见'];
    let currentVisibilityIndex = 0;

    if (btnVisibility && textVisibility) {
        btnVisibility.addEventListener('click', () => {
            currentVisibilityIndex = (currentVisibilityIndex + 1) % visibilityOptions.length;
            textVisibility.textContent = visibilityOptions[currentVisibilityIndex];
        });
    }

    let selectedCoverBg = 'linear-gradient(to bottom, #5AB1D8, #3A90C2)'; 
    const coverItems = $$('.create-diary-cover-item');
    
    coverItems.forEach(item => {
        item.addEventListener('click', function() {
            if(this.id !== 'btn-custom-cover') {
                coverItems.forEach(c => c.classList.remove('selected'));
                this.classList.add('selected');
                selectedCoverBg = window.getComputedStyle(this).background;
            }
        });
    });

    const btnDoneTop = $('#btn-done-top');
    const btnDoneBottom = $('#btn-done-bottom');
    const inputDiaryName = $('#input-diary-name');

    function createNewDiary() {
        if (!inputDiaryName) return;
        const diaryName = inputDiaryName.value.trim() || '未命名日记本';
        const visibility = visibilityOptions[currentVisibilityIndex];
        
        if (window.editingDiaryBookId) {
            getDiaries().then(diaries => {
                const diary = diaries.find(d => d.id === window.editingDiaryBookId);
                if (diary) {
                    diary.name = diaryName;
                    diary.coverBg = selectedCoverBg;
                    diary.visibility = visibility;
                    saveDiary(diary).then(() => {
                        refreshDiaryList();
                        if (window.currentDiaryBook && window.currentDiaryBook.id === diary.id) {
                            window.currentDiaryBook = diary;
                            const detailPageTitle = $('#detail-page-title');
                            const detailPageCover = $('#detail-page-cover');
                            const detailPageVisibility = $('#detail-page-visibility');
                            if(detailPageTitle) detailPageTitle.textContent = diary.name;
                            if(detailPageCover) detailPageCover.style.background = diary.coverBg;
                            if(detailPageVisibility) detailPageVisibility.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> ' + diary.visibility;
                        }
                        if(createDiaryModal) createDiaryModal.classList.remove('active');
                        inputDiaryName.value = '';
                        window.editingDiaryBookId = null;
                    });
                }
            });
        } else {
            const newDiary = {
                name: diaryName,
                coverBg: selectedCoverBg,
                visibility: visibility,
                createdAt: new Date().getTime(),
                isPinned: false
            };
            saveDiary(newDiary).then(() => {
                refreshDiaryList();
                if(createDiaryModal) createDiaryModal.classList.remove('active');
                inputDiaryName.value = '';
                switchView('message');
            });
        }
    }

    if (btnDoneTop) btnDoneTop.addEventListener('click', createNewDiary);
    if (btnDoneBottom) btnDoneBottom.addEventListener('click', createNewDiary);
    // ================= 交互 6：日记本详情页跳转逻辑 =================
    const viewDiaryDetail = $('#view-diary-detail');
    const mainBottomNav = $('#main-bottom-nav');
    const btnBackDiaryDetail = $('#btn-back-diary-detail');
    
    const detailPageTitle = $('#detail-page-title');
    const detailPageCover = $('#detail-page-cover');

    window.openDiaryDetail = function(diary) {
        window.currentDiaryBook = diary; 
        const title = diary.name;
        const bg = diary.coverBg;
        const visibility = diary.visibility;
        
        $$('.view-container').forEach(v => v.classList.remove('active'));
        if(mainBottomNav) mainBottomNav.style.display = 'none';
        
        const userNameElement = $('.user-name');
        const userName = userNameElement ? userNameElement.textContent : '我';
        const headerTitle = $('#detail-page-header-title');
        if(headerTitle) headerTitle.textContent = userName + '的日记本';

        if(detailPageTitle) detailPageTitle.textContent = title;
        if(detailPageCover) detailPageCover.style.background = bg;
        
        const countEl = $('#detail-page-count');
        const timeEl = $('#detail-page-time');
        const visibilityEl = $('#detail-page-visibility');
        
        if(countEl) countEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> 0日记';
        if(timeEl) timeEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 刚刚';
        if(visibilityEl) visibilityEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> ' + (visibility || '仅自己');

        if(viewDiaryDetail) viewDiaryDetail.classList.add('active');
    };

    if (btnBackDiaryDetail) {
        btnBackDiaryDetail.addEventListener('click', () => {
            if(viewDiaryDetail) viewDiaryDetail.classList.remove('active');
            if(mainBottomNav) mainBottomNav.style.display = 'flex';
            switchView('message');
        });
    }

    // ================= 交互 7：个人设置页跳转逻辑 =================
    const btnEditProfile = $('#btn-edit-profile');
    const viewSettings = $('#view-settings');
    const btnBackSettings = $('#btn-back-settings');
    const btnDoneSettings = $('#btn-done-settings');

    if (btnEditProfile) {
        btnEditProfile.addEventListener('click', () => {
            $$('.view-container').forEach(v => v.classList.remove('active'));
            if(mainBottomNav) mainBottomNav.style.display = 'none';
            if(viewSettings) viewSettings.classList.add('active');
        });
    }

    function closeSettings() {
        if(viewSettings) viewSettings.classList.remove('active');
        if(mainBottomNav) mainBottomNav.style.display = 'flex';
        switchView('profile');
    }

    if (btnBackSettings) btnBackSettings.addEventListener('click', closeSettings);
    if (btnDoneSettings) btnDoneSettings.addEventListener('click', closeSettings);

    // ================= 交互 7.5：程序设置页跳转逻辑 =================
    const btnAppSettingsTop = $('#btn-app-settings-top');
    const btnAppSettingsBottom = $('#btn-app-settings-bottom');
    const viewAppSettings = $('#view-app-settings');
    const btnBackAppSettings = $('#btn-back-app-settings');
    const btnDoneAppSettings = $('#btn-done-app-settings');

    function openAppSettings() {
        $$('.view-container').forEach(v => v.classList.remove('active'));
        if(mainBottomNav) mainBottomNav.style.display = 'none';
        if(viewAppSettings) viewAppSettings.classList.add('active');
    }

    function closeAppSettings() {
        if(viewAppSettings) viewAppSettings.classList.remove('active');
        if(mainBottomNav) mainBottomNav.style.display = 'flex';
        switchView('profile');
    }

    if (btnAppSettingsTop) btnAppSettingsTop.addEventListener('click', openAppSettings);
    if (btnAppSettingsBottom) btnAppSettingsBottom.addEventListener('click', openAppSettings);
    if (btnBackAppSettings) btnBackAppSettings.addEventListener('click', closeAppSettings);
    if (btnDoneAppSettings) btnDoneAppSettings.addEventListener('click', closeAppSettings);

    const btnAppSettingsProfile = $('#btn-app-settings-profile');
    if (btnAppSettingsProfile) {
        btnAppSettingsProfile.addEventListener('click', () => {
            if(viewAppSettings) viewAppSettings.classList.remove('active');
            if(viewSettings) viewSettings.classList.add('active');
        });
    }

    const btnClearListCache = $('#btn-clear-list-cache');
    const valListCache = $('#val-list-cache');
    if (btnClearListCache && valListCache) {
        btnClearListCache.addEventListener('click', () => {
            if (valListCache.textContent === '0.0 MB') {
                alert('列表缓存已是最新，无需清理');
                return;
            }
            if (confirm('确定要清空列表缓存吗？')) {
                valListCache.textContent = '0.0 MB';
                alert('列表缓存已清空');
            }
        });
    }

    const btnClearImgCache = $('#btn-clear-img-cache');
    const valImgCache = $('#val-img-cache');
    if (btnClearImgCache && valImgCache) {
        btnClearImgCache.addEventListener('click', () => {
            if (valImgCache.textContent === '0.0 MB') {
                alert('图片缓存已是最新，无需清理');
                return;
            }
            if (confirm('确定要清空图片缓存吗？')) {
                valImgCache.textContent = '0.0 MB';
                alert('图片缓存已清空');
            }
        });
    }

    const btnSettingAutoHd = $('#btn-setting-auto-hd');
    const valSettingAutoHd = $('#val-setting-auto-hd');
    if (btnSettingAutoHd && valSettingAutoHd) {
        btnSettingAutoHd.addEventListener('click', () => {
            const options = ['不加载', '仅 Wi-Fi', '始终加载'];
            let current = valSettingAutoHd.textContent;
            let nextIdx = (options.indexOf(current) + 1) % options.length;
            valSettingAutoHd.textContent = options[nextIdx];
            saveProfileData('autoHd', options[nextIdx]); 
        });
    }

    const btnSettingUploadSize = $('#btn-setting-upload-size');
    const valSettingUploadSize = $('#val-setting-upload-size');
    if (btnSettingUploadSize && valSettingUploadSize) {
        btnSettingUploadSize.addEventListener('click', () => {
            const options = ['高清 (约600KB)', '原图', '标清 (约200KB)'];
            let current = valSettingUploadSize.textContent;
            let nextIdx = (options.indexOf(current) + 1) % options.length;
            valSettingUploadSize.textContent = options[nextIdx];
            saveProfileData('uploadSize', options[nextIdx]); 
        });
    }

    // ================= 交互 8：真实修改资料逻辑 =================
    const btnEditAvatar = $('#btn-edit-avatar');
    const inputSettingsAvatar = $('#input-settings-avatar');
    const settingsAvatarPreview = $('#settings-avatar-preview');
    const profileAvatar = $('.avatar-wrapper'); 

    const btnEditBg = $('#btn-edit-bg');
    const inputSettingsBg = $('#input-settings-bg');
    const settingsBgPreview = $('#settings-bg-preview');
    const profileBg = $('.profile-header-bg'); 

    const btnEditNickname = $('#btn-edit-nickname');
    const settingsNicknameVal = $('#settings-nickname-val');
    const profileName = $('.user-name'); 

    const btnEditBio = $('#btn-edit-bio');
    const settingsBioVal = $('#settings-bio-val');
    const profileHandle = $('.user-handle'); 

    if (btnEditAvatar && inputSettingsAvatar) {
        btnEditAvatar.addEventListener('click', () => inputSettingsAvatar.click());
        inputSettingsAvatar.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const imgUrl = `url(${event.target.result})`;
                    if(settingsAvatarPreview) {
                        settingsAvatarPreview.style.backgroundImage = imgUrl;
                        settingsAvatarPreview.innerHTML = ''; 
                    }
                    if (profileAvatar) {
                        profileAvatar.style.backgroundImage = imgUrl;
                        profileAvatar.style.backgroundSize = 'cover';
                        profileAvatar.style.backgroundPosition = 'center';
                    }
                    const navAvatar = $('#tab-profile .nav-avatar');
                    if (navAvatar) {
                        navAvatar.style.backgroundImage = imgUrl;
                        navAvatar.style.backgroundSize = 'cover';
                        navAvatar.style.backgroundPosition = 'center';
                    }
                    saveProfileData('avatar', imgUrl); 
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (btnEditBg && inputSettingsBg) {
        btnEditBg.addEventListener('click', () => inputSettingsBg.click());
        inputSettingsBg.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const imgUrl = `url(${event.target.result})`;
                    if(settingsBgPreview) {
                        settingsBgPreview.style.backgroundImage = imgUrl;
                        settingsBgPreview.innerHTML = ''; 
                    }
                    if (profileBg) {
                        profileBg.style.backgroundImage = imgUrl;
                        profileBg.style.backgroundSize = 'cover';
                        profileBg.style.backgroundPosition = 'center';
                    }
                    saveProfileData('bg', imgUrl); 
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (btnEditNickname && settingsNicknameVal) {
        btnEditNickname.addEventListener('click', () => {
            const currentName = settingsNicknameVal.textContent;
            const newName = prompt('请输入新昵称', currentName);
            if (newName !== null && newName.trim() !== '') {
                settingsNicknameVal.textContent = newName.trim();
                if (profileName) profileName.textContent = newName.trim();
                saveProfileData('nickname', newName.trim()); 
            }
        });
    }

    if (btnEditBio && settingsBioVal) {
        btnEditBio.addEventListener('click', () => {
            const currentBio = settingsBioVal.textContent === '介绍一下自己' ? '' : settingsBioVal.textContent;
            const newBio = prompt('请输入关于我', currentBio);
            if (newBio !== null) {
                const finalBio = newBio.trim() === '' ? '介绍一下自己' : newBio.trim();
                settingsBioVal.textContent = finalBio;
                settingsBioVal.style.color = finalBio === '介绍一下自己' ? 'var(--text-light)' : 'var(--text-main)';
                saveProfileData('bio', finalBio); 
            }
        });
    }

    const btnEditIcityId = $('#btn-edit-icity-id');
    const settingsIcityIdVal = $('#settings-icity-id-val');
    if (btnEditIcityId && settingsIcityIdVal) {
        btnEditIcityId.addEventListener('click', () => {
            const currentId = settingsIcityIdVal.textContent;
            const newId = prompt('请输入新的 iCity ID (需要消耗转生卡)', currentId);
            if (newId !== null && newId.trim() !== '') {
                settingsIcityIdVal.textContent = newId.trim();
                if (profileHandle) profileHandle.textContent = '@' + newId.trim();
                saveProfileData('icityId', newId.trim()); 
            }
        });
    }

    const btnEditEmail = $('#btn-edit-email');
    const settingsEmailVal = $('#settings-email-val');
    if (btnEditEmail && settingsEmailVal) {
        btnEditEmail.addEventListener('click', () => {
            const currentEmail = settingsEmailVal.textContent;
            const newEmail = prompt('请输入新的 Email', currentEmail);
            if (newEmail !== null && newEmail.trim() !== '') {
                settingsEmailVal.textContent = newEmail.trim();
                saveProfileData('email', newEmail.trim()); 
            }
        });
    }

    const btnEditGender = $('#btn-edit-gender');
    const settingsGenderVal = $('#settings-gender-val');
    if (btnEditGender && settingsGenderVal) {
        btnEditGender.addEventListener('click', () => {
            const currentGender = settingsGenderVal.textContent;
            const newGender = prompt('请输入性别 (男生/女生/保密)', currentGender);
            if (newGender !== null && newGender.trim() !== '') {
                settingsGenderVal.textContent = newGender.trim();
                saveProfileData('gender', newGender.trim()); 
            }
        });
    }

    const btnEditLocation = $('#btn-edit-location');
    const settingsLocationVal = $('#settings-location-val');
    const profileLocation = $('.user-location'); 
    if (btnEditLocation && settingsLocationVal) {
        btnEditLocation.addEventListener('click', () => {
            const currentLocation = settingsLocationVal.textContent === '可选' ? '' : settingsLocationVal.textContent;
            const newLocation = prompt('请输入所在地', currentLocation);
            if (newLocation !== null) {
                const finalLocation = newLocation.trim() === '' ? '可选' : newLocation.trim();
                settingsLocationVal.textContent = finalLocation;
                settingsLocationVal.style.color = finalLocation === '可选' ? 'var(--text-light)' : 'var(--text-main)';
                
                if (profileLocation && finalLocation !== '可选') {
                    profileLocation.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path></svg> ' + finalLocation;
                }
                saveProfileData('location', finalLocation); 
            }
        });
    }
    // ================= 统一编辑器与真实发布逻辑 =================
    function loadDiariesToModal() {
        const diaryScrollArea = $('#modal-diary .diary-scroll-area');
        if(!diaryScrollArea) return;
        
        const newBtnHtml = `
            <div class="diary-item-wrapper" id="modal-btn-create-diary">
                <div class="diary-book diary-new">
                    <div class="plus-circle">+</div>
                    <div class="text">新建<br>日记本</div>
                </div>
                <div style="height: 18px;"></div>
            </div>
        `;
        diaryScrollArea.innerHTML = newBtnHtml;
        
        const modalBtnCreateDiary = $('#modal-btn-create-diary');
        if(modalBtnCreateDiary) {
            modalBtnCreateDiary.addEventListener('click', () => {
                const modalDiary = $('#modal-diary');
                const createDiaryModal = $('#create-diary-modal');
                if(modalDiary) modalDiary.classList.remove('active');
                if(createDiaryModal) createDiaryModal.classList.add('active');
            });
        }

        getDiaries().then((diaries) => {
            diaries.forEach(diary => {
                const div = document.createElement('div');
                div.className = 'diary-item-wrapper diary-selectable';
                div.dataset.name = diary.name;
                div.innerHTML = `
                    <div class="diary-book diary-blue" style="background: ${diary.coverBg}">
                        <div class="stamp">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 2.5-1.06 4.85-2.95 6.64-3.83 3.79-10.05 3.79-13.88 0-3.83-3.79-3.83-9.95 0-13.74 3.83-3.79 10.05-3.79 13.88 0l2.95-3.04V10.12zM12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5z"></path></svg>
                        </div>
                        <div class="title">${diary.name}</div>
                        <div class="bottom-info">
                            <span>0</span>
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path></svg>
                        </div>
                    </div>
                    <div class="radio-circle"></div>
                `;
                
                div.addEventListener('click', function() {
                    $$('.diary-selectable').forEach(el => el.classList.remove('selected'));
                    this.classList.add('selected');
                    window.tempSelectedDiary = this.dataset.name;
                    const statusText = $('#diary-status-text');
                    if(statusText) {
                        statusText.textContent = `已选择：${window.tempSelectedDiary}`;
                        statusText.style.color = 'var(--text-main)';
                    }
                });
                diaryScrollArea.appendChild(div);
            });
        });
    }
    
    let currentActiveEditor = null; 
    
    $$('.editor-wrapper').forEach(editor => {
        const btnCamera = editor.querySelector('.btn-camera');
        const inputCamera = editor.querySelector('.input-camera');
        const previewArea = editor.querySelector('.image-preview-area');
        const previewImg = editor.querySelector('.preview-img');
        const btnRemoveImg = editor.querySelector('.remove-img-btn');
        
        const btnLocation = editor.querySelector('.btn-location');
        const locDisplay = editor.querySelector('.selected-location-display');
        const locText = editor.querySelector('.location-text-top');
        const clearLocBtn = editor.querySelector('.clear-loc-btn');
        
        const btnDiary = editor.querySelector('.btn-diary');
        const displayDiary = editor.querySelector('.display-diary');
        
        const btnSend = editor.querySelector('.btn-send');
        const textarea = editor.querySelector('.editor-textarea');

        const publicStatus = editor.querySelector('.public-status');
        if (publicStatus) {
            const statusOptions = [
                {
                    text: '公开',
                    svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>`
                },
                {
                    text: '仅好友可见',
                    svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>`
                },
                {
                    text: '私人',
                    svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>`
                }
            ];
            let currentStatusIndex = 0;
            publicStatus.style.cursor = 'pointer';
            publicStatus.addEventListener('click', () => {
                currentStatusIndex = (currentStatusIndex + 1) % statusOptions.length;
                const status = statusOptions[currentStatusIndex];
                publicStatus.innerHTML = `${status.svg}\n${status.text}`;
            });
        }

        if(btnCamera && inputCamera) {
            btnCamera.addEventListener('click', () => inputCamera.click());
            inputCamera.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        previewImg.src = event.target.result;
                        previewArea.style.display = 'block';
                        btnCamera.classList.add('active');
                    };
                    reader.readAsDataURL(file);
                }
            });
            btnRemoveImg.addEventListener('click', () => {
                previewImg.src = '';
                previewArea.style.display = 'none';
                inputCamera.value = ''; 
                btnCamera.classList.remove('active');
            });
        }

        if(btnLocation) {
            btnLocation.addEventListener('click', () => {
                currentActiveEditor = editor;
                const modalLocation = $('#modal-location');
                if(modalLocation) {
                    modalLocation.classList.add('active');
                    setTimeout(() => { initMap(); if(map) map.invalidateSize(); }, 250);
                }
            });
            clearLocBtn.addEventListener('click', () => {
                locText.textContent = '';
                locDisplay.style.display = 'none';
                btnLocation.classList.remove('active');
            });
        }

        if(btnDiary) {
            btnDiary.addEventListener('click', () => {
                currentActiveEditor = editor;
                loadDiariesToModal(); 
                const modalDiary = $('#modal-diary');
                if(modalDiary) modalDiary.classList.add('active');
            });
        }

        if(btnSend) {
            btnSend.addEventListener('click', async () => {
                const text = textarea.value.trim();
                const imgSrc = previewImg.getAttribute('src');
                const hasImg = imgSrc && imgSrc !== '';
                const loc = locText.textContent;
                const diary = displayDiary.textContent;

                if (!text && !hasImg) {
                    alert('写点什么或者发张图片吧！');
                    return;
                }

                const now = new Date();
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const timeString = `${hours}:${minutes}`;

                const visibilityText = editor.querySelector('.public-status') ? editor.querySelector('.public-status').textContent.trim() : '公开';
                const userNameEl = $('.user-name');
                const userHandleEl = $('.user-handle');

                const post = {
                    id: Date.now(),
                    text: text,
                    img: hasImg ? imgSrc : '',
                    location: loc,
                    diary: diary,
                    time: timeString,
                    visibility: visibilityText, 
                    user: userNameEl ? userNameEl.textContent : '我',
                    handle: userHandleEl ? userHandleEl.textContent : '@me'
                };

                if (window.editingPostId) {
                    let feeds = await getFeeds();
                    const index = feeds.findIndex(p => p.id == window.editingPostId);
                    if (index !== -1) {
                        feeds[index].text = text;
                        feeds[index].img = hasImg ? imgSrc : '';
                        feeds[index].location = loc;
                        feeds[index].diary = diary;
                        feeds[index].visibility = visibilityText;
                        await saveFeed(feeds[index]);
                    }
                    window.editingPostId = null;
                    
                    const viewSinglePost = $('#view-single-post');
                    if (viewSinglePost && viewSinglePost.classList.contains('active')) {
                        const singlePostText = $('#single-post-text');
                        if(singlePostText) singlePostText.textContent = text;
                        const imgContainer = $('#single-post-img-container');
                        if(imgContainer) {
                            if (hasImg) {
                                imgContainer.innerHTML = `<img src="${imgSrc}" style="width:100%; border-radius:8px; margin-bottom:16px;">`;
                            } else {
                                imgContainer.innerHTML = '';
                            }
                        }
                    }
                } else {
                    await saveFeed(post);
                }

                renderAllFeeds();

                textarea.value = '';
                if(btnRemoveImg) btnRemoveImg.click();
                if(clearLocBtn) clearLocBtn.click();
                displayDiary.textContent = '';
                btnDiary.classList.remove('active');
                
                editor.classList.remove('expanded');
                const publishModal = $('#publish-modal');
                if(publishModal) publishModal.classList.remove('active');
            });
        }
    });

    // 3. 全局位置弹窗逻辑
    let map = null, marker = null, searchTimeout = null;

    function initMap() {
        if (typeof L === 'undefined') {
            const mapArea = $('#real-map');
            if (mapArea) mapArea.innerHTML = '<div style="display:flex; height:100%; justify-content:center; align-items:center; color:#888; font-size:14px; background:#EAE6DF;">正在重新加载地图引擎...</div>';
            
            const script = document.createElement('script');
            script.src = 'https://npm.elemecdn.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => {
                if (mapArea) mapArea.innerHTML = ''; 
                buildMap(); 
            };
            script.onerror = () => {
                if (mapArea) mapArea.innerHTML = '<div style="display:flex; height:100%; justify-content:center; align-items:center; color:#888; font-size:14px; background:#EAE6DF;">地图加载失败，请检查网络或运行环境</div>';
            };
            document.head.appendChild(script);
            return; 
        }
        buildMap();
    }

    function buildMap() {
        if (map) return; 
        const realMapEl = $('#real-map');
        if(!realMapEl) return;
        map = L.map(realMapEl).setView([39.9042, 116.4074], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        
        const avatarEl = $('.avatar-wrapper');
        let bgImage = 'linear-gradient(to bottom right, #888, #ccc)';
        if (avatarEl && avatarEl.style.backgroundImage) {
            bgImage = avatarEl.style.backgroundImage;
        }
        
        const userAvatarIcon = L.divIcon({
            className: 'custom-pin',
            html: `<div style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background-image: ${bgImage}; background-size: cover; background-position: center; transform: translate(-8px, -16px);"></div>`,
            iconSize: [16, 16], iconAnchor: [8, 16]
        });

        marker = L.marker([39.9042, 116.4074], {icon: userAvatarIcon}).addTo(map);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    map.setView([pos.coords.latitude, pos.coords.longitude], 14);
                    marker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
                }, () => {}
            );
        }
    }

    $$('.close-location').forEach(btn => btn.addEventListener('click', () => {
        const modalLocation = $('#modal-location');
        if(modalLocation) modalLocation.classList.remove('active');
    }));
    
    function selectLocation(name, lat, lon) {
        if(currentActiveEditor) {
            const locText = currentActiveEditor.querySelector('.location-text-top');
            const locDisplay = currentActiveEditor.querySelector('.selected-location-display');
            const btnLoc = currentActiveEditor.querySelector('.btn-location');
            
            if (name) {
                if(locText) locText.textContent = name;
                if(locDisplay) locDisplay.style.display = 'flex';
                if(btnLoc) btnLoc.classList.add('active');
                if (lat && lon && map) {
                    map.setView([lat, lon], 15);
                    marker.setLatLng([lat, lon]);
                }
            } else {
                if(locText) locText.textContent = '';
                if(locDisplay) locDisplay.style.display = 'none';
                if(btnLoc) btnLoc.classList.remove('active');
            }
        }
        const modalLocation = $('#modal-location');
        if(modalLocation) modalLocation.classList.remove('active');
    }

    const locSelectableEmpty = $('.loc-selectable[data-name=""]');
    if(locSelectableEmpty) locSelectableEmpty.addEventListener('click', () => selectLocation(''));
    
    const locSearchInput = $('#loc-search-input');
    if(locSearchInput) {
        locSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            const searchResults = $('#search-results');
            if(!searchResults) return;
            const defaultOption = `<div class="loc-item loc-selectable" data-name=""><div class="loc-title" style="color: var(--theme-blue);">不显示地理位置</div></div>`;
            
            if (!query) { searchResults.innerHTML = defaultOption; return; }
            searchResults.innerHTML = defaultOption + `<div class="loading-text">搜索中...</div>`;

            searchTimeout = setTimeout(() => {
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&accept-language=zh-CN`)
                .then(res => res.json())
                .then(data => {
                    searchResults.innerHTML = defaultOption;
                    if (data.length === 0) { searchResults.innerHTML += `<div class="loading-text">未找到相关位置</div>`; return; }
                    data.forEach(item => {
                        const shortName = item.name || item.display_name.split(',')[0];
                        const div = document.createElement('div');
                        div.className = 'loc-item loc-selectable';
                        div.innerHTML = `<div class="loc-info"><div class="loc-title">${shortName}</div><div class="loc-subtitle">${item.display_name}</div></div>`;
                        div.addEventListener('click', () => selectLocation(shortName, item.lat, item.lon));
                        searchResults.appendChild(div);
                    });
                }).catch(() => { searchResults.innerHTML = defaultOption + `<div class="loading-text">搜索失败</div>`; });
            }, 600); 
        });
    }

    // 4. 全局日记本弹窗逻辑
    $$('.close-diary').forEach(btn => btn.addEventListener('click', () => {
        const modalDiary = $('#modal-diary');
        if(modalDiary) modalDiary.classList.remove('active');
    }));
    
    const btnConfirmDiary = $('#btn-confirm-diary');
    if(btnConfirmDiary) {
        btnConfirmDiary.addEventListener('click', () => {
            if (window.tempSelectedDiary && currentActiveEditor) {
                const displayDiary = currentActiveEditor.querySelector('.display-diary');
                const btnDiary = currentActiveEditor.querySelector('.btn-diary');
                if(displayDiary) displayDiary.textContent = window.tempSelectedDiary;
                if(btnDiary) btnDiary.classList.add('active');
            }
            const modalDiary = $('#modal-diary');
            if(modalDiary) modalDiary.classList.remove('active');
        });
    }

    // 5. 渲染动态流
    async function renderAllFeeds() {
        let feeds = await getFeeds();
        
        feeds.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.id - a.id; 
        });

        const homeFeed = $('#home-feed');
        const worldFeed = $('#world-feed');
        const profileFeed = $('#profile-feed');
        const detailFeed = $('#diary-detail-feed');
        
        if(homeFeed) homeFeed.classList.remove('card-box');
        if(worldFeed) worldFeed.classList.remove('card-box');
        if(profileFeed) profileFeed.classList.remove('card-box');
        if(detailFeed) detailFeed.classList.remove('card-box');

        if (feeds.length === 0) {
            const emptyHtml = '<div class="card-box" style="padding: 30px; text-align: center; color: var(--text-light);">还没有日记，快去写一篇吧~</div>';
            if(homeFeed) homeFeed.innerHTML = emptyHtml;
            if(worldFeed) worldFeed.innerHTML = emptyHtml;
            if(profileFeed) profileFeed.innerHTML = emptyHtml;
            if(detailFeed) detailFeed.innerHTML = emptyHtml;
            return;
        }

        const profileData = await getProfile();
        const userName = profileData.nickname || '未命名市民';
        const userHandle = profileData.icityId ? '@' + profileData.icityId : '@icity_user';
        
        let avatarStyle = 'background-image: linear-gradient(to bottom right, #888, #ccc);';
        if (profileData.avatar) {
            avatarStyle = `background-image: ${profileData.avatar}; background-size: cover; background-position: center;`;
        }

        let homeHtml = '';
        let profileHtml = '';
        let detailHtml = '';
        let worldHtml = '';

        let lastDateStr = '';
        let currentGroupHtml = '';
        let currentProfileGroupHtml = '';
        let currentDetailGroupHtml = '';

        const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

        feeds.forEach((post) => {
            const postDate = new Date(Number(post.id));
            const dateKey = `${postDate.getFullYear()}-${postDate.getMonth() + 1}-${postDate.getDate()}`;
            const displayDateStr = `${postDate.getMonth() + 1}月${postDate.getDate()}日 · ${days[postDate.getDay()]}<br>${postDate.getFullYear()}`;

            let imgHtml = (post.img && post.img.startsWith('data:image')) ? `<img src="${post.img}" style="width:100%; border-radius:8px; margin-bottom:12px; max-height:300px; object-fit:cover;">` : '';
            let locHtml = post.location ? `
                <div class="entry-location" style="color: var(--text-light); font-size: 13px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 2px; transform: translateY(1px);"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>
                    ${post.location} 23°C
                </div>` : '<div></div>';
            
            let likeSvg = post.isLiked 
                ? `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #FF3B30; stroke: #FF3B30; stroke-width: 2;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`
                : `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`;

            let noteSvg = (post.notes && post.notes.length > 0)
                ? `<div style="display: flex; align-items: center; gap: 2px; color: #8AB4F8;">
                      <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #8AB4F8; stroke: #8AB4F8; stroke-width: 1.5; stroke-linejoin: round;"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"></path></svg>
                      <span style="font-size: 12px; font-weight: 600;">${post.notes.length}</span>
                   </div>`
                : '';

            const entryBody = `
                <div class="entry-content">${post.text}</div>
                ${imgHtml}
                <div class="entry-footer">
                    ${locHtml}
                    <div class="entry-actions">
                        ${likeSvg}
                        ${noteSvg}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 16 16" style="width: 18px; height: 18px; fill: none; stroke: currentColor;"><path stroke-linecap="round" stroke-linejoin="round" d="M11.875 2.5H3.125a1.25 1.25 0 0 0 -1.25 1.25v6.25a1.25 1.25 0 0 0 1.25 1.25h1.9925000000000002c0.625 0 1.1325 0.5068750000000001 1.1325 1.1325 0 0.505 0.61 0.7575 0.9668749999999999 0.400625l1.166875 -1.166875A1.25 1.25 0 0 1 9.2675 11.25H11.875a1.25 1.25 0 0 0 1.25 -1.25V3.75a1.25 1.25 0 0 0 -1.25 -1.25z" stroke-width="1.2"></path></svg>
                        <div class="entry-time">
                            <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            ${post.time}
                        </div>
                        <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor; stroke: none;"><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                    </div>
                </div>
            `;

            const plainEntry = `<div class="entry-item" data-id="${post.id}" style="cursor: pointer;">${entryBody}</div>`;

            if (dateKey !== lastDateStr) {
                if (lastDateStr !== '') {
                    homeHtml += currentGroupHtml + `</div>`;
                    profileHtml += currentProfileGroupHtml + `</div>`;
                    detailHtml += currentDetailGroupHtml + `</div>`;
                }

                const headerHtml = `
                    <div class="feed-header-home">
                        <div class="avatar" style="${avatarStyle}"></div>
                        <div class="user-info">
                            <div class="name">${userName}</div>
                            <div class="username">${userHandle}</div>
                        </div>
                        <div class="feed-date">
                            ${displayDateStr}
                        </div>
                    </div>
                `;

                currentGroupHtml = `<div class="card-box">${headerHtml}${plainEntry}`;
                currentProfileGroupHtml = `<div class="card-box">${plainEntry}`; 
                currentDetailGroupHtml = `<div class="card-box">${plainEntry}`; 
                lastDateStr = dateKey;
            } else {
                currentGroupHtml += plainEntry;
                currentProfileGroupHtml += plainEntry;
                currentDetailGroupHtml += plainEntry;
            }

            worldHtml += `
            <div class="card-box entry-item" data-id="${post.id}" style="cursor: pointer; border-bottom: none;">
                <div class="entry-user-header">
                    <div class="avatar" style="${avatarStyle}"></div>
                    <div class="user-info">
                        <div class="name">${post.user}</div>
                        <div class="username">${post.handle} ${post.diary ? '· ' + post.diary : ''}</div>
                    </div>
                </div>
                ${entryBody}
            </div>
            `;
        });
        
        if (lastDateStr !== '') {
            homeHtml += currentGroupHtml + `</div>`;
            detailHtml += currentDetailGroupHtml + `</div>`;
        }

        if(homeFeed) homeFeed.innerHTML = homeHtml;
        if(detailFeed) detailFeed.innerHTML = detailHtml;
        if(worldFeed) worldFeed.innerHTML = worldHtml;

        const profileRecentContainer = $('#profile-recent-posts');
        const profileStatCount = $('#profile-stat-diary-count');
        const profileMoreCount = $('#profile-more-diary-count');
        
        if (profileRecentContainer) {
            if (feeds.length === 0) {
                profileRecentContainer.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-light); font-size: 14px;">还没有日记，快去写一篇吧~</div>';
            } else {
                const recentFeeds = feeds.slice(0, 2);
                let recentHtml = '';
                
                recentFeeds.forEach(post => {
                    let imgHtml = (post.img && post.img.startsWith('data:image')) ? `<img src="${post.img}" style="width:100%; border-radius:8px; margin-bottom:12px; max-height:300px; object-fit:cover;">` : '';
                    let locHtml = post.location ? `
                        <div class="entry-location" style="color: var(--text-light); font-size: 13px;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 2px; transform: translateY(1px);"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>
                            ${post.location} 23°C
                        </div>` : '<div></div>';
                    
                    let likeSvg = post.isLiked 
                        ? `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #FF3B30; stroke: #FF3B30; stroke-width: 2;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`
                        : `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`;

                    let noteSvg = (post.notes && post.notes.length > 0)
                        ? `<div style="display: flex; align-items: center; gap: 2px; color: #8AB4F8;">
                              <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #8AB4F8; stroke: #8AB4F8; stroke-width: 1.5; stroke-linejoin: round;"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"></path></svg>
                              <span style="font-size: 12px; font-weight: 600;">${post.notes.length}</span>
                           </div>`
                        : '';

                    const entryBody = `
                        <div class="entry-content">${post.text}</div>
                        ${imgHtml}
                        <div class="entry-footer">
                            ${locHtml}
                            <div class="entry-actions">
                                ${likeSvg}
                                ${noteSvg}
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 16 16" style="width: 18px; height: 18px; fill: none; stroke: currentColor;"><path stroke-linecap="round" stroke-linejoin="round" d="M11.875 2.5H3.125a1.25 1.25 0 0 0 -1.25 1.25v6.25a1.25 1.25 0 0 0 1.25 1.25h1.9925000000000002c0.625 0 1.1325 0.5068750000000001 1.1325 1.1325 0 0.505 0.61 0.7575 0.9668749999999999 0.400625l1.166875 -1.166875A1.25 1.25 0 0 1 9.2675 11.25H11.875a1.25 1.25 0 0 0 1.25 -1.25V3.75a1.25 1.25 0 0 0 -1.25 -1.25z" stroke-width="1.2"></path></svg>
                                <div class="entry-time">
                                    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    ${post.time}
                                </div>
                                <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor; stroke: none;"><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                            </div>
                        </div>
                    `;

                    recentHtml += `<div class="entry-item" data-id="${post.id}" style="cursor: pointer;">${entryBody}</div>`;
                });
                profileRecentContainer.innerHTML = recentHtml;
            }
            
            if (profileStatCount) profileStatCount.textContent = feeds.length;
            if (profileMoreCount) profileMoreCount.textContent = feeds.length;
        }
    }

    // ================= 交互 9：点击帖子进入单篇详情页 =================
    const viewSinglePost = $('#view-single-post');
    const btnBackSinglePost = $('#btn-back-single-post');
    let previousView = 'home'; 
    window.currentSinglePostId = null; 

    $$('.content-scroll').forEach(scrollArea => {
        scrollArea.addEventListener('click', function(e) {
            const entryItem = e.target.closest('.entry-item');
            if (entryItem) {
                const postId = entryItem.getAttribute('data-id');
                if (postId) {
                    openSinglePost(postId);
                }
            }
        });
    });

    async function openSinglePost(postId) {
        const feeds = await getFeeds();
        const post = feeds.find(p => p.id == postId);
        if (!post) return;

        window.currentSinglePostId = postId;

        const activeView = $('.view-container.active');
        if (activeView && activeView.id !== 'view-single-post') {
            previousView = activeView.id.replace('view-', '');
        }

        $$('.view-container').forEach(v => v.classList.remove('active'));
        if(mainBottomNav) mainBottomNav.style.display = 'none';

        const singlePostHeaderTitle = $('#single-post-header-title');
        const singlePostName = $('#single-post-name');
        const singlePostHandle = $('#single-post-handle');
        const singlePostText = $('#single-post-text');
        if(singlePostHeaderTitle) singlePostHeaderTitle.textContent = `${post.user} · 日记`;
        if(singlePostName) singlePostName.textContent = post.user;
        if(singlePostHandle) singlePostHandle.textContent = post.handle;
        if(singlePostText) singlePostText.textContent = post.text;
        
        const imgContainer = $('#single-post-img-container');
        if(imgContainer) {
            if (post.img) {
                imgContainer.innerHTML = `<img src="${post.img}" style="width:100%; border-radius:8px; margin-bottom:16px;">`;
            } else {
                imgContainer.innerHTML = '';
            }
        }

        const date = new Date(Number(post.id));
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const singlePostTime = $('#single-post-time');
        if(singlePostTime) singlePostTime.textContent = `${yyyy}-${mm}-${dd} ${hh}:${min}`;

        const locContainer = $('#single-post-location-container');
        const locText = $('#single-post-location');
        if(locContainer && locText) {
            if (post.location) {
                locText.textContent = post.location + ' 23°C';
                locContainer.style.display = 'flex';
                locContainer.style.alignItems = 'center';
                locContainer.style.gap = '4px';
            } else {
                locContainer.style.display = 'none';
            }
        }

        const earthDayContainer = $('#single-post-earth-day');
        if (earthDayContainer) {
            const profileData = await getProfile();
            const earthDayEnabled = profileData.earthDayEnabled !== false; 
            const earthDayText = profileData.earthDayText || '来到地球第';
            const birthDateStr = profileData.birthDate;

            if (earthDayEnabled && birthDateStr) {
                const birthDate = new Date(birthDateStr);
                const postDate = new Date(Number(post.id));
                const diffTime = postDate - birthDate;
                if (diffTime >= 0) {
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    earthDayContainer.innerHTML = `<span style="color: #E0E0E0; margin: 0 4px;">|</span> ${earthDayText} ${diffDays} 天`;
                    earthDayContainer.style.display = 'inline';
                } else {
                    earthDayContainer.style.display = 'none';
                }
            } else {
                earthDayContainer.style.display = 'none';
            }
        }

        const visibilityContainer = $('#single-post-visibility');
        if (visibilityContainer) {
            let visibilitySvg = '';
            if (post.visibility === '仅好友可见') {
                visibilitySvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>`;
            } else if (post.visibility === '私人') {
                visibilitySvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>`;
            } else {
                visibilitySvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>`;
            }
            visibilityContainer.innerHTML = `${visibilitySvg} <span>${post.visibility || '公开'}</span>`;
        }

        const avatarEl = $('.avatar-wrapper');
        const singleAvatar = $('#single-post-avatar');
        if(singleAvatar) {
            if (avatarEl && avatarEl.style.backgroundImage) {
                singleAvatar.style.backgroundImage = avatarEl.style.backgroundImage;
                singleAvatar.style.backgroundSize = 'cover';
                singleAvatar.style.backgroundPosition = 'center';
                singleAvatar.innerHTML = '';
            } else {
                singleAvatar.style.backgroundImage = 'linear-gradient(to bottom right, #888, #ccc)';
                singleAvatar.innerHTML = '';
            }
        }

        const commentsSection = $('#comments-section');
        const commentsContainer = $('#single-post-comments-container');
        const commentsCount = $('#comments-count');
        
        if (commentsSection && commentsContainer && commentsCount) {
            if (post.comments && post.comments.length > 0) {
                commentsSection.style.display = 'block'; 
                commentsCount.textContent = `${post.comments.length} 条评论`;
                let commentsHtml = '';
                
                post.comments.sort((a, b) => {
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return 0;
                });

                post.comments.forEach(comment => {
                    const isPinnedText = comment.isPinned ? '取消置顶' : '置顶';
                    const pinTag = comment.isPinned ? '<span style="color: var(--theme-green); font-weight: 600;">已置顶 · </span>' : '';
                    
                    commentsHtml += `
                        <div class="comment-item">
                            <div class="comment-avatar" style="${comment.avatarStyle || 'background-image: linear-gradient(to bottom right, #888, #ccc); background-size: cover; background-position: center;'}"></div>
                            <div class="comment-main">
                                <div class="comment-header-row">
                                    <div class="comment-name">${comment.user}</div>
                                    <div class="comment-actions">
                                        <div class="time" style="color: var(--text-light);">${pinTag}${comment.time}</div>
                                        <div style="position: relative; display: flex; align-items: center;">
                                            <div class="more-btn comment-more-btn" data-comment-id="${comment.id}">
                                                <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor; stroke: none;"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                                            </div>
                                            
                                            <div class="popover-menu comment-popover-menu" id="comment-menu-${comment.id}" style="display: none; width: 140px; z-index: 101; right: 0; top: 100%; transform: none; margin-top: 8px;">
                                                <div class="menu-row">
                                                    <div class="menu-item text-red comment-menu-delete" data-comment-id="${comment.id}">
                                                        <svg class="icon-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                        删除
                                                    </div>
                                                    <div class="menu-item comment-menu-edit" data-comment-id="${comment.id}">
                                                        <svg class="icon-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                        编辑
                                                    </div>
                                                </div>
                                                <div class="menu-row">
                                                    <div class="menu-item comment-menu-pin" data-comment-id="${comment.id}">
                                                        <svg class="icon-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.6V6a3 3 0 0 0-3-3h0a3 3 0 0 0-3 3v4.6a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
                                                        ${isPinnedText}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="comment-content">${comment.text}</div>
                            </div>
                        </div>
                    `;
                });
                commentsContainer.innerHTML = commentsHtml;
            } else {
                commentsSection.style.display = 'none'; 
                commentsContainer.innerHTML = '';
            }
        }

        const btnLike = $('.single-action-btn.btn-like');
        if(btnLike) {
            const likeSvg = btnLike.querySelector('svg');
            if (post.isLiked) {
                btnLike.classList.add('liked');
                likeSvg.style.fill = '#FF3B30';
                likeSvg.style.stroke = '#FF3B30';
                btnLike.style.color = '#FF3B30';
            } else {
                btnLike.classList.remove('liked');
                likeSvg.style.fill = 'none';
                likeSvg.style.stroke = 'currentColor';
                btnLike.style.color = '#B3B3B3';
            }
        }

        const menuPin = $('#menu-pin');
        if (menuPin) {
            menuPin.innerHTML = `<svg class="icon-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.6V6a3 3 0 0 0-3-3h0a3 3 0 0 0-3 3v4.6a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
                                ${post.isPinned ? '取消置顶' : '置顶日记'}`;
        }

        const notesContainer = $('#single-post-notes-container');
        const actionsContainer = $('.single-post-actions'); 
        
        if (notesContainer) {
            if (post.notes && post.notes.length > 0) {
                let notesHtml = '';
                
                let needsSave = false;
                post.notes.forEach((note, idx) => { 
                    if (!note.id) {
                        note.id = 'old_' + Date.now() + '_' + idx; 
                        needsSave = true;
                    }
                });
                if (needsSave) {
                    saveFeed(post);
                }

                post.notes.sort((a, b) => {
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return 0;
                });

                post.notes.forEach(note => {
                    let noteImgHtml = (note.img && note.img.startsWith('data:image')) ? `<img src="${note.img}" style="width:100%; border-radius:8px; margin-bottom:12px; max-height:300px; object-fit:cover;">` : '';
                    let noteLocHtml = note.location ? `
                        <div class="single-post-note-meta-left">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>
                            ${note.location} 23°C
                        </div>` : '<div></div>';
                        
                    notesHtml += `
                        <div class="ticket-divider has-notch"><div class="ticket-divider-left"></div></div>
                        <div class="single-post-note-item">
                            <div class="single-post-note-text">${note.text}</div>
                            ${noteImgHtml}
                            <div class="single-post-note-meta">
                                ${noteLocHtml}
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="${note.isPinned ? 'color: var(--theme-green); font-weight: 600;' : ''}">${note.isPinned ? '已置顶 · ' : ''}${note.time}</span>
                                    
                                    <div style="position: relative; display: flex; align-items: center;">
                                        <svg class="note-more-btn" data-note-id="${note.id}" viewBox="0 0 24 24" fill="currentColor" style="width:16px; height:16px; color:var(--text-light); cursor:pointer;"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                                        
                                        <div class="popover-menu note-popover-menu" id="note-menu-${note.id}" style="display: none; width: 140px; z-index: 101;">
                                            <div class="menu-row">
                                                <div class="menu-item text-red note-menu-delete" data-note-id="${note.id}">
                                                    <svg class="icon-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                    删除
                                                </div>
                                                <div class="menu-item note-menu-edit" data-note-id="${note.id}">
                                                    <svg class="icon-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                    编辑
                                                </div>
                                            </div>
                                            <div class="menu-row">
                                                <div class="menu-item note-menu-pin" data-note-id="${note.id}">
                                                    <svg class="icon-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.6V6a3 3 0 0 0-3-3h0a3 3 0 0 0-3 3v4.6a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
                                                    ${note.isPinned ? '取消置顶' : '置顶'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                notesHtml += `<div class="ticket-divider"></div>`;
                notesContainer.innerHTML = notesHtml;
                
                if (actionsContainer) actionsContainer.style.borderTop = 'none';
            } else {
                notesContainer.innerHTML = '';
                if (actionsContainer) actionsContainer.style.borderTop = '0.5px solid var(--border-color)';
            }
        }

        if(viewSinglePost) viewSinglePost.classList.add('active');
    }

    if (btnBackSinglePost) {
        btnBackSinglePost.addEventListener('click', () => {
            if(viewSinglePost) viewSinglePost.classList.remove('active');
            if (previousView === 'diary-detail') {
                const viewDiaryDetail = $('#view-diary-detail');
                if(viewDiaryDetail) viewDiaryDetail.classList.add('active');
                if(mainBottomNav) mainBottomNav.style.display = 'none';
            } else {
                if(mainBottomNav) mainBottomNav.style.display = 'flex';
                switchView(previousView);
            }
        });
    }

    // ================= 交互 10：详情页更多操作菜单 =================
    const btnMoreAction = $('.single-action-btn.btn-more');
    const popoverMenu = $('#popoverMenu');
    const menuOverlay = $('#menuOverlay');

    if (btnMoreAction && popoverMenu && menuOverlay) {
        btnMoreAction.addEventListener('click', (e) => {
            e.stopPropagation(); 
            if (popoverMenu.style.display === 'none' || popoverMenu.style.display === '') {
                popoverMenu.style.display = 'flex';
                menuOverlay.style.display = 'block'; 
            } else {
                popoverMenu.style.display = 'none';
                menuOverlay.style.display = 'none'; 
            }
        });

        menuOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
            popoverMenu.style.display = 'none';
            menuOverlay.style.display = 'none';
            $$('.note-popover-menu, .comment-popover-menu').forEach(m => m.style.display = 'none');
        });

        document.addEventListener('click', () => {
            popoverMenu.style.display = 'none';
            menuOverlay.style.display = 'none';
            $$('.note-popover-menu, .comment-popover-menu').forEach(m => m.style.display = 'none');
        });

        popoverMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    const btnNoteAction = $('.single-action-btn.btn-note');
    const modalNote = $('#modal-note');
    const closeNote = $('#close-note');
    const btnSendNote = $('#btn-send-note');

    if (btnNoteAction && modalNote) {
        btnNoteAction.addEventListener('click', () => {
            modalNote.classList.add('active');
            setTimeout(() => {
                const textarea = modalNote.querySelector('.note-textarea');
                if(textarea) textarea.focus();
            }, 100);
        });

        if(closeNote) {
            closeNote.addEventListener('click', () => {
                modalNote.classList.remove('active');
            });
        }

        if(btnSendNote) {
            btnSendNote.addEventListener('click', async () => {
                const text = modalNote.querySelector('.note-textarea').value.trim();
                const imgSrc = modalNote.querySelector('.preview-img').getAttribute('src');
                const loc = modalNote.querySelector('.location-text-top').textContent;
                
                if (!text && (!imgSrc || imgSrc === '')) {
                    alert('写点什么或者发张图片吧！');
                    return;
                }
                
                if (!window.currentSinglePostId) return;
                
                let feeds = await getFeeds();
                const index = feeds.findIndex(p => p.id == window.currentSinglePostId);
                if (index !== -1) {
                    if (!feeds[index].notes) feeds[index].notes = [];
                    
                    if (window.editingNoteId) {
                        const noteIndex = feeds[index].notes.findIndex(n => n.id == window.editingNoteId);
                        if (noteIndex !== -1) {
                            feeds[index].notes[noteIndex].text = text;
                            feeds[index].notes[noteIndex].img = imgSrc;
                            feeds[index].notes[noteIndex].location = loc;
                        }
                        window.editingNoteId = null;
                    } else {
                        const now = new Date();
                        const hours = String(now.getHours()).padStart(2, '0');
                        const minutes = String(now.getMinutes()).padStart(2, '0');
                        const timeString = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${hours}:${minutes}`;
                        
                        feeds[index].notes.push({
                            id: Date.now(), 
                            text: text,
                            img: imgSrc,
                            location: loc,
                            time: timeString,
                            isPinned: false 
                        });
                    }
                    
                    await saveFeed(feeds[index]);
                    
                    openSinglePost(window.currentSinglePostId);
                    renderAllFeeds(); 
                }
                
                modalNote.querySelector('.note-textarea').value = '';
                modalNote.querySelector('.note-title-input').value = '';
                const btnRemoveImg = modalNote.querySelector('.remove-img-btn');
                if(btnRemoveImg) btnRemoveImg.click();
                const clearLocBtn = modalNote.querySelector('.clear-loc-btn');
                if(clearLocBtn) clearLocBtn.click();
                
                modalNote.classList.remove('active');
            });
        }
    }

    const btnLikeAction = $('.single-action-btn.btn-like');
    if (btnLikeAction) {
        btnLikeAction.addEventListener('click', async function() {
            if (!window.currentSinglePostId) return;
            let feeds = await getFeeds();
            const index = feeds.findIndex(p => p.id == window.currentSinglePostId);
            if (index === -1) return;

            const svg = this.querySelector('svg');
            if (this.classList.contains('liked')) {
                this.classList.remove('liked');
                svg.style.fill = 'none';
                svg.style.stroke = 'currentColor';
                this.style.color = '#B3B3B3';
                feeds[index].isLiked = false;
            } else {
                this.classList.add('liked');
                svg.style.fill = '#FF3B30';
                svg.style.stroke = '#FF3B30';
                this.style.color = '#FF3B30';
                feeds[index].isLiked = true;
            }
            await saveFeed(feeds[index]);
            renderAllFeeds();
        });
    }

    const menuDelete = $('#menu-delete');
    if (menuDelete) {
        menuDelete.addEventListener('click', async () => {
            if (!window.currentSinglePostId) return;
            if (confirm('确定要删除这篇日记吗？')) {
                await deleteFeed(window.currentSinglePostId);
                renderAllFeeds();
                
                if(popoverMenu) popoverMenu.style.display = 'none';
                if(menuOverlay) menuOverlay.style.display = 'none';
                const viewSinglePost = $('#view-single-post');
                if(viewSinglePost) viewSinglePost.classList.remove('active');
                if(mainBottomNav) mainBottomNav.style.display = 'flex';
                switchView(previousView);
            }
        });
    }

    const menuEdit = $('#menu-edit');
    if (menuEdit) {
        menuEdit.addEventListener('click', async () => {
            if (!window.currentSinglePostId) return;
            const feeds = await getFeeds();
            const post = feeds.find(p => p.id == window.currentSinglePostId);
            if (post) {
                window.editingPostId = post.id;
                const publishModal = $('#publish-modal');
                if(publishModal) {
                    const textarea = publishModal.querySelector('.editor-textarea');
                    if(textarea) textarea.value = post.text;
                    
                    const previewArea = publishModal.querySelector('.image-preview-area');
                    const previewImg = publishModal.querySelector('.preview-img');
                    const btnCamera = publishModal.querySelector('.btn-camera');
                    if (post.img) {
                        if(previewImg) previewImg.src = post.img;
                        if(previewArea) previewArea.style.display = 'block';
                        if(btnCamera) btnCamera.classList.add('active');
                    } else {
                        if(previewImg) previewImg.src = '';
                        if(previewArea) previewArea.style.display = 'none';
                        if(btnCamera) btnCamera.classList.remove('active');
                    }

                    const locDisplay = publishModal.querySelector('.selected-location-display');
                    const locText = publishModal.querySelector('.location-text-top');
                    const btnLocation = publishModal.querySelector('.btn-location');
                    if (post.location) {
                        if(locText) locText.textContent = post.location;
                        if(locDisplay) locDisplay.style.display = 'flex';
                        if(btnLocation) btnLocation.classList.add('active');
                    } else {
                        if(locText) locText.textContent = '';
                        if(locDisplay) locDisplay.style.display = 'none';
                        if(btnLocation) btnLocation.classList.remove('active');
                    }

                    const displayDiary = publishModal.querySelector('.display-diary');
                    const btnDiary = publishModal.querySelector('.btn-diary');
                    if (post.diary) {
                        if(displayDiary) displayDiary.textContent = post.diary;
                        if(btnDiary) btnDiary.classList.add('active');
                    } else {
                        if(displayDiary) displayDiary.textContent = '';
                        if(btnDiary) btnDiary.classList.remove('active');
                    }

                    publishModal.classList.add('active');
                }
                if(popoverMenu) popoverMenu.style.display = 'none';
                if(menuOverlay) menuOverlay.style.display = 'none';
            }
        });
    }

    const menuPin = $('#menu-pin');
    if (menuPin) {
        menuPin.addEventListener('click', async () => {
            if (!window.currentSinglePostId) return;
            let feeds = await getFeeds();
            const index = feeds.findIndex(p => p.id == window.currentSinglePostId);
            if (index !== -1) {
                feeds[index].isPinned = !feeds[index].isPinned;
                await saveFeed(feeds[index]);
                renderAllFeeds();
                
                menuPin.innerHTML = `<svg class="icon-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.6V6a3 3 0 0 0-3-3h0a3 3 0 0 0-3 3v4.6a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
                                    ${feeds[index].isPinned ? '取消置顶' : '置顶日记'}`;
                alert(feeds[index].isPinned ? '已置顶' : '已取消置顶');
            }
            if(popoverMenu) popoverMenu.style.display = 'none';
            if(menuOverlay) menuOverlay.style.display = 'none';
        });
    }

    const menuDiary = $('#menu-diary');
    if (menuDiary) {
        menuDiary.addEventListener('click', () => {
            if (!window.currentSinglePostId) return;
            window.modifyingDiaryPostId = window.currentSinglePostId;
            loadDiariesToModal();
            const modalDiary = $('#modal-diary');
            if(modalDiary) modalDiary.classList.add('active');
            if(popoverMenu) popoverMenu.style.display = 'none';
            if(menuOverlay) menuOverlay.style.display = 'none';
        });
    }

    const btnConfirmDiaryReplace = $('#btn-confirm-diary');
    if(btnConfirmDiaryReplace) {
        const newBtnConfirmDiary = btnConfirmDiaryReplace.cloneNode(true);
        btnConfirmDiaryReplace.parentNode.replaceChild(newBtnConfirmDiary, btnConfirmDiaryReplace);
        
        newBtnConfirmDiary.addEventListener('click', async () => {
            if (window.tempSelectedDiary) {
                if (window.modifyingDiaryPostId) {
                    let feeds = await getFeeds();
                    const index = feeds.findIndex(p => p.id == window.modifyingDiaryPostId);
                    if (index !== -1) {
                        feeds[index].diary = window.tempSelectedDiary;
                        await saveFeed(feeds[index]);
                        renderAllFeeds();
                        alert('已修改日记本为：' + window.tempSelectedDiary);
                    }
                    window.modifyingDiaryPostId = null;
                } else if (currentActiveEditor) {
                    const displayDiary = currentActiveEditor.querySelector('.display-diary');
                    const btnDiary = currentActiveEditor.querySelector('.btn-diary');
                    if(displayDiary) displayDiary.textContent = window.tempSelectedDiary;
                    if(btnDiary) btnDiary.classList.add('active');
                }
            }
            const modalDiary = $('#modal-diary');
            if(modalDiary) modalDiary.classList.remove('active');
        });
    }

    const menuVisibility = $('#menu-visibility');
    if (menuVisibility) {
        menuVisibility.addEventListener('click', async () => {
            if (!window.currentSinglePostId) return;
            let feeds = await getFeeds();
            const index = feeds.findIndex(p => p.id == window.currentSinglePostId);
            if (index !== -1) {
                const options = ['公开', '仅好友可见', '私人'];
                let currentIdx = options.indexOf(feeds[index].visibility);
                if (currentIdx === -1) currentIdx = 0;
                const nextIdx = (currentIdx + 1) % options.length;
                feeds[index].visibility = options[nextIdx];
                
                await saveFeed(feeds[index]);
                renderAllFeeds();
                alert('权限已修改为：' + options[nextIdx]);
            }
            if(popoverMenu) popoverMenu.style.display = 'none';
            if(menuOverlay) menuOverlay.style.display = 'none';
        });
    }

    // ================= 交互 11：日记本详情页更多操作菜单 =================
    const btnDiaryDetailMore = $('#btn-diary-detail-more');
    const diaryDetailMenu = $('#diary-detail-menu');
    
    if (btnDiaryDetailMore && diaryDetailMenu) {
        btnDiaryDetailMore.addEventListener('click', (e) => {
            e.stopPropagation();
            if (diaryDetailMenu.style.display === 'none') {
                diaryDetailMenu.style.display = 'flex';
                if(menuOverlay) menuOverlay.style.display = 'block';
            } else {
                diaryDetailMenu.style.display = 'none';
                if(menuOverlay) menuOverlay.style.display = 'none';
            }
        });

        const menuDiaryDelete = $('#menu-diary-delete');
        if(menuDiaryDelete) {
            menuDiaryDelete.addEventListener('click', () => {
                if (!window.currentDiaryBook) return;
                if (confirm('确定要删除这个日记本吗？')) {
                    deleteDiary(window.currentDiaryBook.id).then(() => {
                        refreshDiaryList();
                        const viewDiaryDetail = $('#view-diary-detail');
                        if(viewDiaryDetail) viewDiaryDetail.classList.remove('active');
                        if(mainBottomNav) mainBottomNav.style.display = 'flex';
                        switchView('message');
                    });
                }
                diaryDetailMenu.style.display = 'none';
                if(menuOverlay) menuOverlay.style.display = 'none';
            });
        }

        const menuDiaryEdit = $('#menu-diary-edit');
        if(menuDiaryEdit) {
            menuDiaryEdit.addEventListener('click', () => {
                if (!window.currentDiaryBook) return;
                
                const inputDiaryName = $('#input-diary-name');
                const textVisibility = $('#text-visibility');
                if(inputDiaryName) inputDiaryName.value = window.currentDiaryBook.name;
                if(textVisibility) textVisibility.textContent = window.currentDiaryBook.visibility;
                currentVisibilityIndex = visibilityOptions.indexOf(window.currentDiaryBook.visibility);
                if(currentVisibilityIndex === -1) currentVisibilityIndex = 0;
                
                selectedCoverBg = window.currentDiaryBook.coverBg;
                $$('.create-diary-cover-item').forEach(c => c.classList.remove('selected'));
                let found = false;
                $$('.create-diary-cover-item').forEach(c => {
                    if (c.id !== 'btn-custom-cover' && window.getComputedStyle(c).background === selectedCoverBg) {
                        c.classList.add('selected');
                        found = true;
                    }
                });
                if (!found) {
                    const btnCustom = $('#btn-custom-cover');
                    if(btnCustom) {
                        btnCustom.classList.add('selected');
                        btnCustom.style.backgroundImage = selectedCoverBg;
                        btnCustom.innerHTML = '';
                    }
                }
                
                window.editingDiaryBookId = window.currentDiaryBook.id;
                
                const createDiaryModal = $('#create-diary-modal');
                if(createDiaryModal) createDiaryModal.classList.add('active');
                
                diaryDetailMenu.style.display = 'none';
                if(menuOverlay) menuOverlay.style.display = 'none';
            });
        }

        const menuDiaryPin = $('#menu-diary-pin');
        if(menuDiaryPin) {
            menuDiaryPin.addEventListener('click', () => {
                if (!window.currentDiaryBook) return;
                window.currentDiaryBook.isPinned = !window.currentDiaryBook.isPinned;
                saveDiary(window.currentDiaryBook).then(() => {
                    refreshDiaryList();
                    
                    menuDiaryPin.innerHTML = `<svg class="icon-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.6V6a3 3 0 0 0-3-3h0a3 3 0 0 0-3 3v4.6a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
                                        ${window.currentDiaryBook.isPinned ? '取消置顶' : '置顶日记本'}`;
                    alert(window.currentDiaryBook.isPinned ? '已置顶日记本' : '已取消置顶');
                });
                diaryDetailMenu.style.display = 'none';
                if(menuOverlay) menuOverlay.style.display = 'none';
            });
        }

        const menuDiaryVisibility = $('#menu-diary-visibility');
        if(menuDiaryVisibility) {
            menuDiaryVisibility.addEventListener('click', () => {
                if (!window.currentDiaryBook) return;
                const options = ['仅自己', '公开', '仅好友可见'];
                let currentIdx = options.indexOf(window.currentDiaryBook.visibility);
                if (currentIdx === -1) currentIdx = 0;
                const nextIdx = (currentIdx + 1) % options.length;
                window.currentDiaryBook.visibility = options[nextIdx];
                
                saveDiary(window.currentDiaryBook).then(() => {
                    const visibilityEl = $('#detail-page-visibility');
                    if(visibilityEl) visibilityEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> ' + window.currentDiaryBook.visibility;
                    alert('日记本权限已修改为：' + options[nextIdx]);
                });
                diaryDetailMenu.style.display = 'none';
                if(menuOverlay) menuOverlay.style.display = 'none';
            });
        }

        const menuDiaryInvite = $('#menu-diary-invite');
        if(menuDiaryInvite) {
            menuDiaryInvite.addEventListener('click', () => {
                alert('邀请链接已复制，快去分享给好友吧！');
                diaryDetailMenu.style.display = 'none';
                if(menuOverlay) menuOverlay.style.display = 'none';
            });
        }
    }

    // ================= 交互 12：小纸条菜单全局事件委托 =================
    document.addEventListener('click', function(e) {
        if (e.target.closest('.note-popover-menu') && !e.target.closest('.menu-item')) {
            e.stopPropagation();
            return;
        }

        const moreBtn = e.target.closest('.note-more-btn');
        if (moreBtn) {
            e.stopPropagation();
            const noteId = moreBtn.getAttribute('data-note-id');
            const menu = $('#note-menu-' + noteId);
            const overlay = $('#menuOverlay');
            
            $$('.note-popover-menu').forEach(m => m.style.display = 'none');
            
            if (menu && menu.style.display === 'none') {
                menu.style.display = 'flex';
                if(overlay) overlay.style.display = 'block';
            } else if(menu) {
                menu.style.display = 'none';
                if(overlay) overlay.style.display = 'none';
            }
            return;
        }

        const deleteBtn = e.target.closest('.note-menu-delete');
        if (deleteBtn) {
            e.stopPropagation();
            const noteId = deleteBtn.getAttribute('data-note-id');
            if (confirm('确定要删除这张小纸条吗？')) {
                getFeeds().then(feeds => {
                    const postIndex = feeds.findIndex(p => p.id == window.currentSinglePostId);
                    if (postIndex !== -1) {
                        feeds[postIndex].notes = feeds[postIndex].notes.filter(n => n.id != noteId);
                        saveFeed(feeds[postIndex]).then(() => {
                            openSinglePost(window.currentSinglePostId);
                            renderAllFeeds(); 
                        });
                    }
                });
            }
            $$('.note-popover-menu').forEach(m => m.style.display = 'none');
            const overlay = $('#menuOverlay');
            if(overlay) overlay.style.display = 'none';
            return;
        }

        const pinBtn = e.target.closest('.note-menu-pin');
        if (pinBtn) {
            e.stopPropagation();
            const noteId = pinBtn.getAttribute('data-note-id');
            getFeeds().then(feeds => {
                const postIndex = feeds.findIndex(p => p.id == window.currentSinglePostId);
                if (postIndex !== -1) {
                    const noteIndex = feeds[postIndex].notes.findIndex(n => n.id == noteId);
                    if (noteIndex !== -1) {
                        feeds[postIndex].notes[noteIndex].isPinned = !feeds[postIndex].notes[noteIndex].isPinned;
                        saveFeed(feeds[postIndex]).then(() => {
                            openSinglePost(window.currentSinglePostId);
                        });
                    }
                }
            });
            $$('.note-popover-menu').forEach(m => m.style.display = 'none');
            const overlay = $('#menuOverlay');
            if(overlay) overlay.style.display = 'none';
            return;
        }

        const editBtn = e.target.closest('.note-menu-edit');
        if (editBtn) {
            e.stopPropagation();
            const noteId = editBtn.getAttribute('data-note-id');
            getFeeds().then(feeds => {
                const postIndex = feeds.findIndex(p => p.id == window.currentSinglePostId);
                if (postIndex !== -1) {
                    const note = feeds[postIndex].notes.find(n => n.id == noteId);
                    if (note) {
                        window.editingNoteId = noteId; 
                        
                        const modalNote = $('#modal-note');
                        if(modalNote) {
                            const textarea = modalNote.querySelector('.note-textarea');
                            if(textarea) textarea.value = note.text || '';
                            
                            const previewArea = modalNote.querySelector('.image-preview-area');
                            const previewImg = modalNote.querySelector('.preview-img');
                            const btnCamera = modalNote.querySelector('.btn-camera');
                            if (note.img) {
                                if(previewImg) previewImg.src = note.img;
                                if(previewArea) previewArea.style.display = 'block';
                                if(btnCamera) btnCamera.classList.add('active');
                            } else {
                                if(previewImg) previewImg.src = '';
                                if(previewArea) previewArea.style.display = 'none';
                                if(btnCamera) btnCamera.classList.remove('active');
                            }

                            const locDisplay = modalNote.querySelector('.selected-location-display');
                            const locText = modalNote.querySelector('.location-text-top');
                            const btnLocation = modalNote.querySelector('.btn-location');
                            if (note.location) {
                                if(locText) locText.textContent = note.location;
                                if(locDisplay) locDisplay.style.display = 'flex';
                                if(btnLocation) btnLocation.classList.add('active');
                            } else {
                                if(locText) locText.textContent = '';
                                if(locDisplay) locDisplay.style.display = 'none';
                                if(btnLocation) btnLocation.classList.remove('active');
                            }

                            modalNote.classList.add('active');
                        }
                    }
                }
            });
            $$('.note-popover-menu').forEach(m => m.style.display = 'none');
            const overlay = $('#menuOverlay');
            if(overlay) overlay.style.display = 'none';
            return;
        }
    });

    // ================= 交互 13：发送评论 =================
    const btnSendComment = $('.single-post-comment-send');
    const inputComment = $('.single-post-comment-input');
    
    if (btnSendComment && inputComment) {
        btnSendComment.addEventListener('click', async () => {
            const text = inputComment.value.trim();
            if (!text) {
                alert('请输入评论内容');
                return;
            }
            if (!window.currentSinglePostId) return;
            
            let feeds = await getFeeds();
            const index = feeds.findIndex(p => p.id == window.currentSinglePostId);
            if (index !== -1) {
                if (!feeds[index].comments) feeds[index].comments = [];
                
                const now = new Date();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                const hh = String(now.getHours()).padStart(2, '0');
                const min = String(now.getMinutes()).padStart(2, '0');
                const timeString = `${mm}-${dd} ${hh}:${min}`;
                
                const userNameEl = $('.user-name');
                const userName = userNameEl ? userNameEl.textContent : '我';
                
                const avatarEl = $('.avatar-wrapper');
                let avatarStyle = 'background-image: linear-gradient(to bottom right, #888, #ccc);';
                if (avatarEl && avatarEl.style.backgroundImage) {
                    avatarStyle = `background-image: ${avatarEl.style.backgroundImage}; background-size: cover; background-position: center;`;
                }

                feeds[index].comments.push({
                    id: Date.now(),
                    text: text,
                    user: userName,
                    avatarStyle: avatarStyle,
                    time: timeString
                });
                
                await saveFeed(feeds[index]);
                
                inputComment.value = '';
                openSinglePost(window.currentSinglePostId);
                
                setTimeout(() => {
                    const scrollArea = $('#view-single-post .content-scroll');
                    if(scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
                }, 100);
            }
        });
    }

    // ================= 交互 14：评论区折叠与菜单操作 =================
    document.addEventListener('click', function(e) {
        const commentsHeader = e.target.closest('.comments-header');
        if (commentsHeader) {
            const container = $('#single-post-comments-container');
            const icon = commentsHeader.querySelector('.toggle-icon');
            if(container && icon) {
                if (container.style.display === 'none') {
                    container.style.display = 'block';
                    icon.style.transform = 'rotate(0deg)';
                } else {
                    container.style.display = 'none';
                    icon.style.transform = 'rotate(-90deg)'; 
                }
            }
            return;
        }

        const commentMoreBtn = e.target.closest('.comment-more-btn');
        if (commentMoreBtn) {
            e.stopPropagation();
            const commentId = commentMoreBtn.getAttribute('data-comment-id');
            const menu = $('#comment-menu-' + commentId);
            const overlay = $('#menuOverlay');
            
            $$('.comment-popover-menu, .note-popover-menu, #popoverMenu, #diary-detail-menu').forEach(m => m.style.display = 'none');
            
            if (menu && menu.style.display === 'none') {
                menu.style.display = 'flex';
                if(overlay) overlay.style.display = 'block';
            } else if(menu) {
                menu.style.display = 'none';
                if(overlay) overlay.style.display = 'none';
            }
            return;
        }

        const commentDeleteBtn = e.target.closest('.comment-menu-delete');
        if (commentDeleteBtn) {
            e.stopPropagation();
            const commentId = commentDeleteBtn.getAttribute('data-comment-id');
            if (confirm('确定要删除这条评论吗？')) {
                getFeeds().then(feeds => {
                    const postIndex = feeds.findIndex(p => p.id == window.currentSinglePostId);
                    if (postIndex !== -1 && feeds[postIndex].comments) {
                        feeds[postIndex].comments = feeds[postIndex].comments.filter(c => c.id != commentId);
                        saveFeed(feeds[postIndex]).then(() => {
                            openSinglePost(window.currentSinglePostId);
                        });
                    }
                });
            }
            $$('.comment-popover-menu').forEach(m => m.style.display = 'none');
            const overlay = $('#menuOverlay');
            if(overlay) overlay.style.display = 'none';
            return;
        }

        const commentEditBtn = e.target.closest('.comment-menu-edit');
        if (commentEditBtn) {
            e.stopPropagation();
            const commentId = commentEditBtn.getAttribute('data-comment-id');
            getFeeds().then(feeds => {
                const postIndex = feeds.findIndex(p => p.id == window.currentSinglePostId);
                if (postIndex !== -1 && feeds[postIndex].comments) {
                    const comment = feeds[postIndex].comments.find(c => c.id == commentId);
                    if (comment) {
                        const newText = prompt('编辑评论', comment.text);
                        if (newText !== null && newText.trim() !== '') {
                            comment.text = newText.trim();
                            saveFeed(feeds[postIndex]).then(() => {
                                openSinglePost(window.currentSinglePostId);
                            });
                        }
                    }
                }
            });
            $$('.comment-popover-menu').forEach(m => m.style.display = 'none');
            const overlay = $('#menuOverlay');
            if(overlay) overlay.style.display = 'none';
            return;
        }

        const commentPinBtn = e.target.closest('.comment-menu-pin');
        if (commentPinBtn) {
            e.stopPropagation();
            const commentId = commentPinBtn.getAttribute('data-comment-id');
            getFeeds().then(feeds => {
                const postIndex = feeds.findIndex(p => p.id == window.currentSinglePostId);
                if (postIndex !== -1 && feeds[postIndex].comments) {
                    const commentIndex = feeds[postIndex].comments.findIndex(c => c.id == commentId);
                    if (commentIndex !== -1) {
                        feeds[postIndex].comments[commentIndex].isPinned = !feeds[postIndex].comments[commentIndex].isPinned;
                        saveFeed(feeds[postIndex]).then(() => {
                            openSinglePost(window.currentSinglePostId);
                        });
                    }
                }
            });
            $$('.comment-popover-menu').forEach(m => m.style.display = 'none');
            const overlay = $('#menuOverlay');
            if(overlay) overlay.style.display = 'none';
            return;
        }
    });

    // ================= 交互 15：世界页面顶栏 Tab 切换逻辑 =================
    const tabWorldAll = $('#tab-world-all');
    const tabWorldFriends = $('#tab-world-friends');
    const tabWorldNotices = $('#tab-world-notices');
    const tabWorldLikes = $('#tab-world-likes');

    const contentWorldAll = $('#content-world-all');
    const contentWorldFriends = $('#content-world-friends');
    const contentWorldNotices = $('#content-world-notices');
    const contentWorldLikes = $('#content-world-likes');

    const worldTabs = [tabWorldAll, tabWorldFriends, tabWorldNotices, tabWorldLikes];
    const worldContents = [contentWorldAll, contentWorldFriends, contentWorldNotices, contentWorldLikes];

    function switchWorldTab(activeIndex) {
        worldTabs.forEach((tab, index) => {
            if (tab) {
                if (index === activeIndex) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            }
        });

        worldContents.forEach((content, index) => {
            if (content) {
                content.style.display = (index === activeIndex) ? 'block' : 'none';
            }
        });
    }

    if (tabWorldAll) tabWorldAll.addEventListener('click', () => switchWorldTab(0));
    if (tabWorldFriends) tabWorldFriends.addEventListener('click', () => switchWorldTab(1));
    if (tabWorldNotices) tabWorldNotices.addEventListener('click', () => switchWorldTab(2));
    if (tabWorldLikes) tabWorldLikes.addEventListener('click', () => switchWorldTab(3));

    // ================= 交互 16：通讯录/私信页面顶栏 Tab 切换逻辑 =================
    const tabMsgContacts = $('#tab-msg-contacts');
    const tabMsgDms = $('#tab-msg-dms');
    const contentMsgContacts = $('#content-msg-contacts');
    const contentMsgDms = $('#content-msg-dms');
    const iconMsgContacts = $('#icon-msg-contacts');
    const iconMsgDms = $('#icon-msg-dms');

    function switchMsgTab(tabName) {
        if (tabName === 'contacts') {
            if(tabMsgContacts) tabMsgContacts.classList.add('active');
            if(tabMsgDms) tabMsgDms.classList.remove('active');
            if(contentMsgContacts) contentMsgContacts.style.display = 'block';
            if(contentMsgDms) contentMsgDms.style.display = 'none';
            if (iconMsgContacts) iconMsgContacts.style.display = 'block';
            if (iconMsgDms) iconMsgDms.style.display = 'none';
        } else if (tabName === 'dms') {
            if(tabMsgDms) tabMsgDms.classList.add('active');
            if(tabMsgContacts) tabMsgContacts.classList.remove('active');
            if(contentMsgDms) contentMsgDms.style.display = 'block';
            if(contentMsgContacts) contentMsgContacts.style.display = 'none';
            if (iconMsgContacts) iconMsgContacts.style.display = 'none';
            if (iconMsgDms) iconMsgDms.style.display = 'block';
        }
    }

    if (tabMsgContacts) tabMsgContacts.addEventListener('click', () => switchMsgTab('contacts'));
    if (tabMsgDms) tabMsgDms.addEventListener('click', () => switchMsgTab('dms'));

    // ================= 交互 20：日历页逻辑 =================
    const btnProfileCalendar = $('#btn-profile-calendar');
    const btnHomeCalendar = $('#btn-home-calendar');
    const viewCalendar = $('#view-calendar');
    const btnBackCalendar = $('#btn-back-calendar');
    const calendarFeed = $('#calendar-feed');
    const calCurrentYearDisplay = $('#cal-current-year-display');
    const btnCalPrevYear = $('#btn-cal-prev-year');
    const btnCalNextYear = $('#btn-cal-next-year');

    let currentCalendarYear = new Date().getFullYear();

    async function openCalendarView() {
        $$('.view-container').forEach(v => v.classList.remove('active'));
        if(mainBottomNav) mainBottomNav.style.display = 'none';
        
        currentCalendarYear = new Date().getFullYear();
        await renderCalendar(currentCalendarYear);
        
        if(viewCalendar) viewCalendar.classList.add('active');
    }

    if (btnProfileCalendar) btnProfileCalendar.addEventListener('click', openCalendarView);
    if (btnHomeCalendar) btnHomeCalendar.addEventListener('click', openCalendarView);

    if (btnBackCalendar) {
        btnBackCalendar.addEventListener('click', () => {
            if(viewCalendar) viewCalendar.classList.remove('active');
            if(mainBottomNav) mainBottomNav.style.display = 'flex';
            switchView('home');
        });
    }

    if (btnCalPrevYear) {
        btnCalPrevYear.addEventListener('click', () => {
            currentCalendarYear--;
            renderCalendar(currentCalendarYear);
        });
    }
    if (btnCalNextYear) {
        btnCalNextYear.addEventListener('click', () => {
            currentCalendarYear++;
            renderCalendar(currentCalendarYear);
        });
    }

    async function renderCalendar(targetYear) {
        if (calCurrentYearDisplay) {
            calCurrentYearDisplay.textContent = targetYear;
        }

        let feeds = await getFeeds();
        
        const diaryDates = new Set();
        feeds.forEach(post => {
            const date = new Date(Number(post.id));
            const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
            diaryDates.add(dateStr);
        });

        const today = new Date();
        const realCurrentYear = today.getFullYear();
        const realCurrentMonth = today.getMonth() + 1;
        const todayStr = `${realCurrentYear}-${realCurrentMonth}-${today.getDate()}`;

        const monthsToRender = [];
        for (let m = 1; m <= 12; m++) {
            monthsToRender.push({
                year: targetYear,
                month: m,
                en: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][m-1],
                cn: ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'][m-1]
            });
        }

        let html = '<div class="card-box" style="margin-bottom: 20px;">';

        monthsToRender.forEach(m => {
            const firstDay = new Date(m.year, m.month - 1, 1).getDay(); 
            const daysInMonth = new Date(m.year, m.month, 0).getDate();
            
            let gridHtml = '';
            for (let i = 0; i < firstDay; i++) {
                gridHtml += `<div class="calendar-day empty"></div>`;
            }
            
            let diaryCount = 0;
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${m.year}-${m.month}-${i}`;
                const hasDiary = diaryDates.has(dateStr);
                const isToday = (dateStr === todayStr);
                
                if (hasDiary) diaryCount++;
                
                let className = 'calendar-day';
                if (hasDiary) {
                    className += ' has-diary';
                } else if (isToday) {
                    className += ' is-today';
                }
                
                gridHtml += `<div class="${className}">${i}</div>`;
            }

            const monthId = `cal-month-${m.year}-${m.month}`;

            html += `
            <div class="calendar-month-block" id="${monthId}">
                <div class="calendar-month-header">
                    <div class="calendar-month-tag">月度记录</div>
                    <div class="calendar-month-desc">写点什么... 本月大事记、心情、感受...</div>
                    <svg class="calendar-month-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
                <div class="calendar-body">
                    <div class="calendar-left-info">
                        <div class="calendar-month-en">${m.en}</div>
                        <div class="calendar-month-cn">${m.cn}</div>
                        <div class="calendar-year-text">${m.year}</div>
                        <div class="calendar-diary-count">
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" stroke="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                            ${diaryCount}
                        </div>
                    </div>
                    <div class="calendar-grid">
                        ${gridHtml}
                    </div>
                </div>
            </div>
            `;
        });

        html += '</div>';
        if(calendarFeed) calendarFeed.innerHTML = html;

        setTimeout(() => {
            const viewCalendarEl = $('#view-calendar');
            if(!viewCalendarEl) return;
            const scrollContainer = viewCalendarEl.querySelector('.content-scroll');
            if(!scrollContainer) return;
            
            if (targetYear === realCurrentYear) {
                const currentMonthEl = $(`#cal-month-${realCurrentYear}-${realCurrentMonth}`);
                if (currentMonthEl) {
                    scrollContainer.scrollTop = currentMonthEl.offsetTop - 105;
                }
            } else {
                scrollContainer.scrollTop = 0;
            }
        }, 50);
    }

    // ================= 交互 16.5：我来到地球的日子设置页 =================
    const viewEarthDay = $('#view-earth-day');
    const btnBackEarthDay = $('#btn-back-earth-day');
    const btnSaveEarthDay = $('#btn-save-earth-day');
    const btnSettingsEarthDay = $('#btn-settings-earth-day');
    const btnAppSettingsEarthDay = $('#btn-app-settings-earth-day');
    
    const switchEarthDayShow = $('#switch-earth-day-show');
    const inputEarthDayText = $('#input-earth-day-text');
    const inputEarthDayBirth = $('#input-earth-day-birth');
    const previewEarthDayContainer = $('#preview-earth-day-container');
    const previewEarthDayText = $('#preview-earth-day-text');
    const btnClearBirth = $('#btn-clear-birth');

    function updateEarthDayPreview() {
        if(!inputEarthDayText || !inputEarthDayBirth || !switchEarthDayShow || !previewEarthDayText) return;
        const text = inputEarthDayText.value || '来到地球第';
        const birthStr = inputEarthDayBirth.value;
        if (switchEarthDayShow.checked && birthStr) {
            const birthDate = new Date(birthStr);
            const today = new Date();
            const diffTime = today - birthDate;
            if (diffTime >= 0) {
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                previewEarthDayText.textContent = `${text} ${diffDays} 天`;
                previewEarthDayText.previousElementSibling.style.display = 'inline'; 
                previewEarthDayText.style.display = 'inline';
            } else {
                previewEarthDayText.textContent = `${text} 0 天`;
                previewEarthDayText.previousElementSibling.style.display = 'inline';
                previewEarthDayText.style.display = 'inline';
            }
        } else {
            previewEarthDayText.previousElementSibling.style.display = 'none'; 
            previewEarthDayText.style.display = 'none';
        }
    }

    async function openEarthDaySettings() {
        const profileData = await getProfile();
        if(switchEarthDayShow) switchEarthDayShow.checked = profileData.earthDayEnabled !== false;
        if(inputEarthDayText) inputEarthDayText.value = profileData.earthDayText || '来到地球第';
        if(inputEarthDayBirth) inputEarthDayBirth.value = profileData.birthDate || '';
        
        updateEarthDayPreview();

        $$('.view-container').forEach(v => v.classList.remove('active'));
        if(mainBottomNav) mainBottomNav.style.display = 'none';
        if(viewEarthDay) viewEarthDay.classList.add('active');
    }

    if (btnSettingsEarthDay) btnSettingsEarthDay.addEventListener('click', openEarthDaySettings);
    if (btnAppSettingsEarthDay) btnAppSettingsEarthDay.addEventListener('click', openEarthDaySettings);

    if (btnBackEarthDay) {
        btnBackEarthDay.addEventListener('click', () => {
            if(viewEarthDay) viewEarthDay.classList.remove('active');
            const viewSettings = $('#view-settings');
            if(viewSettings) viewSettings.classList.add('active');
        });
    }

    if (btnSaveEarthDay) {
        btnSaveEarthDay.addEventListener('click', () => {
            if(switchEarthDayShow) saveProfileData('earthDayEnabled', switchEarthDayShow.checked);
            if(inputEarthDayText) saveProfileData('earthDayText', inputEarthDayText.value);
            if(inputEarthDayBirth) saveProfileData('birthDate', inputEarthDayBirth.value);
            
            const statusText = (inputEarthDayBirth && inputEarthDayBirth.value) ? '已设置' : '未设置';
            const valSettings = $('#val-settings-earth-day');
            const valAppSettings = $('#val-app-settings-earth-day');
            if (valSettings) valSettings.textContent = statusText;
            if (valAppSettings) valAppSettings.textContent = statusText;

            alert('保存成功');
            if(viewEarthDay) viewEarthDay.classList.remove('active');
            const viewSettings = $('#view-settings');
            if(viewSettings) viewSettings.classList.add('active');
        });
    }

    if (switchEarthDayShow) switchEarthDayShow.addEventListener('change', updateEarthDayPreview);
    if (inputEarthDayText) inputEarthDayText.addEventListener('input', updateEarthDayPreview);
    if (inputEarthDayBirth) inputEarthDayBirth.addEventListener('change', updateEarthDayPreview);
    
    if (btnClearBirth) {
        btnClearBirth.addEventListener('click', () => {
            if(inputEarthDayBirth) inputEarthDayBirth.value = '';
            updateEarthDayPreview();
        });
    }

    // ================= 交互 17：个人主页私信按钮跳转独立聊天页 =================
    const btnProfileDm = $('#btn-profile-dm');
    const viewChat = $('#view-chat');
    const btnBackChat = $('#btn-back-chat');

    if (btnProfileDm && viewChat) {
        btnProfileDm.addEventListener('click', () => {
            $$('.view-container').forEach(v => v.classList.remove('active'));
            if(mainBottomNav) mainBottomNav.style.display = 'none';
            viewChat.classList.add('active');
        });
    }

    if (btnBackChat) {
        btnBackChat.addEventListener('click', () => {
            if(viewChat) viewChat.classList.remove('active');
            if(mainBottomNav) mainBottomNav.style.display = 'flex';
            switchView('profile'); 
        });
    }

    // ================= 交互 18：通讯录 Q&A 卡片跳转独立问答页 =================
    const btnOpenQa = $('#btn-open-qa');
    const viewQaPage = $('#view-qa-page');
    const btnBackQaPage = $('#btn-back-qa-page');

    if (btnOpenQa && viewQaPage) {
        btnOpenQa.addEventListener('click', () => {
            $$('.view-container').forEach(v => v.classList.remove('active'));
            if(mainBottomNav) mainBottomNav.style.display = 'none';
            viewQaPage.classList.add('active');
        });
    }

    if (btnBackQaPage) {
        btnBackQaPage.addEventListener('click', () => {
            if(viewQaPage) viewQaPage.classList.remove('active');
            if(mainBottomNav) mainBottomNav.style.display = 'flex';
            switchView('message'); 
        });
    }

    // ================= 交互 19：日记列表/封存页逻辑 =================
    const btnProfileMoreDiary = $('#btn-profile-more-diary');
    const btnProfileArchived = $('#btn-profile-archived');
    const viewDiaryList = $('#view-diary-list');
    const btnBackDiaryList = $('#btn-back-diary-list');
    const diaryListHeaderTitle = $('#diary-list-header-title');
    const filterTabs = $$('.filter-tab');
    const diaryListFeed = $('#diary-list-feed');

    async function openDiaryListView(initialFilter) {
        $$('.view-container').forEach(v => v.classList.remove('active'));
        if(mainBottomNav) mainBottomNav.style.display = 'none';
        
        const profileData = await getProfile();
        const userName = profileData.nickname || '未命名市民';
        const titleSuffix = initialFilter === 'archived' ? '封存日记' : '全部日记';
        if(diaryListHeaderTitle) diaryListHeaderTitle.textContent = `${userName} · ${titleSuffix}`;

        filterTabs.forEach(tab => {
            if (tab.getAttribute('data-filter') === initialFilter) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        await renderDiaryListFeed(initialFilter);

        if(viewDiaryList) viewDiaryList.classList.add('active');
    }

    if (btnProfileMoreDiary) {
        btnProfileMoreDiary.addEventListener('click', () => openDiaryListView('all'));
    }
    if (btnProfileArchived) {
        btnProfileArchived.addEventListener('click', () => openDiaryListView('archived'));
    }

    if (btnBackDiaryList) {
        btnBackDiaryList.addEventListener('click', () => {
            if(viewDiaryList) viewDiaryList.classList.remove('active');
            if(mainBottomNav) mainBottomNav.style.display = 'flex';
            switchView('profile');
        });
    }

    filterTabs.forEach(tab => {
        tab.addEventListener('click', async function() {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const filterType = this.getAttribute('data-filter');
            
            const profileData = await getProfile();
            const userName = profileData.nickname || '未命名市民';
            const titleSuffix = filterType === 'archived' ? '封存日记' : '全部日记';
            if(diaryListHeaderTitle) diaryListHeaderTitle.textContent = `${userName} · ${titleSuffix}`;

            await renderDiaryListFeed(filterType);
        });
    });

    async function renderDiaryListFeed(filterType) {
        let feeds = await getFeeds();
        
        let filteredFeeds = feeds.filter(post => {
            if (filterType === 'all') return !post.isArchived;
            if (filterType === 'public') return post.visibility === '公开' && !post.isArchived;
            if (filterType === 'friends') return post.visibility === '仅好友可见' && !post.isArchived;
            if (filterType === 'private') return post.visibility === '私人' && !post.isArchived;
            if (filterType === 'archived') return post.isArchived === true; 
            if (filterType === 'retro') return false; 
            return true;
        });

        filteredFeeds.sort((a, b) => b.id - a.id);

        if (filteredFeeds.length === 0) {
            let emptyText = '没有日记';
            if (filterType === 'archived') emptyText = '没有封存的日记';
            else if (filterType === 'private') emptyText = '没有私密日记';
            
            if(diaryListFeed) {
                diaryListFeed.innerHTML = `
                    <div class="card-box" style="padding: 30px; text-align: center; display: flex; flex-direction: column; gap: 8px;">
                        <div style="font-size: 15px; font-weight: 600; color: #4A90E2;">${emptyText}</div>
                        <div style="font-size: 13px; color: var(--text-light);">卷轴空空如也</div>
                    </div>
                `;
            }
            return;
        }

        let html = '';
        filteredFeeds.forEach(post => {
            let imgHtml = (post.img && post.img.startsWith('data:image')) ? `<img src="${post.img}" style="width:100%; border-radius:8px; margin-bottom:12px; max-height:300px; object-fit:cover;">` : '';
            let locHtml = post.location ? `
                <div class="entry-location" style="color: var(--text-light); font-size: 13px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 2px; transform: translateY(1px);"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>
                    ${post.location} 23°C
                </div>` : '<div></div>';
            
            let likeSvg = post.isLiked 
                ? `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #FF3B30; stroke: #FF3B30; stroke-width: 2;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`
                : `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`;

            let noteSvg = (post.notes && post.notes.length > 0)
                ? `<div style="display: flex; align-items: center; gap: 2px; color: #8AB4F8;">
                      <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #8AB4F8; stroke: #8AB4F8; stroke-width: 1.5; stroke-linejoin: round;"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"></path></svg>
                      <span style="font-size: 12px; font-weight: 600;">${post.notes.length}</span>
                   </div>`
                : '';

            const entryBody = `
                <div class="entry-content">${post.text}</div>
                ${imgHtml}
                <div class="entry-footer">
                    ${locHtml}
                    <div class="entry-actions">
                        ${likeSvg}
                        ${noteSvg}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 16 16" style="width: 18px; height: 18px; fill: none; stroke: currentColor;"><path stroke-linecap="round" stroke-linejoin="round" d="M11.875 2.5H3.125a1.25 1.25 0 0 0 -1.25 1.25v6.25a1.25 1.25 0 0 0 1.25 1.25h1.9925000000000002c0.625 0 1.1325 0.5068750000000001 1.1325 1.1325 0 0.505 0.61 0.7575 0.9668749999999999 0.400625l1.166875 -1.166875A1.25 1.25 0 0 1 9.2675 11.25H11.875a1.25 1.25 0 0 0 1.25 -1.25V3.75a1.25 1.25 0 0 0 -1.25 -1.25z" stroke-width="1.2"></path></svg>
                        <div class="entry-time">
                            <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            ${post.time}
                        </div>
                        <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor; stroke: none;"><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                    </div>
                </div>
            `;

            html += `<div class="card-box entry-item" data-id="${post.id}" style="cursor: pointer; border-bottom: none;">${entryBody}</div>`;
        });

        if(diaryListFeed) diaryListFeed.innerHTML = html;
    }

})();
