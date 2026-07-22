    const themeAppUI = document.getElementById('themeAppUI');
    const themeAppGrid = document.getElementById('themeAppGrid');
    let currentEditingApps = [];

    function openThemeApp() {
        themeAppUI.style.display = 'flex';
            // show three-dots button; click to expand vertical capsule menu
        setTimeout(() => {
            themeAppUI.classList.add('show');
        }, 10);
        loadAppsIntoThemeUI();
    }

    function closeThemeApp() {
        themeAppUI.classList.remove('show');
        setTimeout(() => {
            themeAppUI.style.display = 'none';
        }, 300);
    }

    function loadAppsIntoThemeUI() {
        themeAppGrid.innerHTML = '';
        currentEditingApps = [];
        
            // show three-dots button; click to expand vertical capsule menu
        const allApps = document.querySelectorAll('#desktopGrid .app-item:not(.is-widget), #dock .app-item:not(.is-widget)');
        allApps.forEach((appEl, index) => {
            const nameEl = appEl.querySelector('.app-name');
            const iconEl = appEl.querySelector('.app-icon');
            if (!nameEl) return; // 排除可能异常的节点
            
            const appName = nameEl.innerText;
            const appIcon = iconEl.style.backgroundImage;
            
            // show three-dots button; click to expand vertical capsule menu
            currentEditingApps.push({
                element: appEl,
                originalName: appName,
                currentName: appName,
                currentIcon: appIcon
            });

            renderThemeAppCard(appName, appIcon, index);
        });
    }

    function renderThemeAppCard(name, icon, index) {
        const card = document.createElement('div');
        card.className = 'theme-app-card';
        
        const cameraSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`;
        const themeSvg = `<svg class="theme-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`;
        const resetSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;

            // show three-dots button; click to expand vertical capsule menu
        const safeIcon = icon ? icon.replace(/"/g, "'") : '';
        const iconStyle = safeIcon && safeIcon !== 'none' ? `background-image: ${safeIcon}; background-color: transparent;` : '';

        card.innerHTML = `
            <div class="theme-original-name">${name}</div>
            <div class="theme-reset-btn" onclick="resetThemeApp(${index})" title="恢复默认">${resetSvg}</div>
            <div class="theme-icon-wrapper">
                <div class="theme-app-icon" id="theme-icon-${index}" style="${iconStyle}" onclick="openIconMenu(event, ${index})"></div>
            </div>
            <div class="theme-text-wrapper">
                ${themeSvg}
                <span class="theme-app-name-input" id="theme-name-${index}" contenteditable="true" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" onblur="updateThemeAppName(${index}, this.innerText)">${name}</span>
            </div>
        `;
        themeAppGrid.appendChild(card);
    }

            // show three-dots button; click to expand vertical capsule menu
    let currentIconIndex = null;

    function openIconMenu(event, index) {
        currentIconIndex = index;
        const overlay = document.getElementById('iconMenuOverlay');
        const menu = document.getElementById('iconMenu');
        
        overlay.style.display = 'block';
        
            // show three-dots button; click to expand vertical capsule menu
        const rect = event.target.getBoundingClientRect();
            // show three-dots button; click to expand vertical capsule menu
        let top = rect.bottom - 15;
        let left = rect.left;
        
            // show three-dots button; click to expand vertical capsule menu
        if (left + 240 > window.innerWidth) {
            left = window.innerWidth - 250;
        }
        if (top + 130 > window.innerHeight) {
            // show three-dots button; click to expand vertical capsule menu
            top = rect.top - 120;
        }
        
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
    }

    function closeIconMenu() {
        document.getElementById('iconMenuOverlay').style.display = 'none';
    }

    function handleIconLocalUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                if (currentIconIndex === 'wcMomentsBg' || currentIconIndex === 'wcMomentsAvatar') {
                    // 朋友圈背景和头像不压缩，直接使用原图
                    applyIconToApp(e.target.result);
                } else {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        const MAX_SIZE = 256;
                        let width = img.width;
                        let height = img.height;
                        
                        if (width > height) {
                            if (width > MAX_SIZE) {
                                height *= MAX_SIZE / width;
                                width = MAX_SIZE;
                            }
                        } else {
                            if (height > MAX_SIZE) {
                                width *= MAX_SIZE / height;
                                height = MAX_SIZE;
                            }
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        const base64Url = canvas.toDataURL('image/webp', 0.95);
                        applyIconToApp(base64Url);
                    };
                    img.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);
        }
        event.target.value = '';
        closeIconMenu();
    }

    function openIconUrlModal() {
        closeIconMenu();
        showCustomPrompt('使用 URL 上传图标', 'https://...', '确定').then(url => {
            if (url && url.trim()) applyIconToApp(url.trim());
        });
    }

    function applyIconToApp(url) {
        if (currentIconIndex === null) return;
        
        if (currentIconIndex === 'wcMomentsBg') {
            wcMomentsProfile.bg = url;
            document.getElementById('wcMomentsEditBgPreview').style.backgroundImage = `url('${url}')`;
            return;
        }
        if (currentIconIndex === 'wcMomentsAvatar') {
            wcMomentsProfile.avatar = url;
            const avatarPreview = document.getElementById('wcMomentsEditAvatarPreview');
            avatarPreview.innerHTML = '';
            avatarPreview.style.backgroundImage = `url('${url}')`;
            avatarPreview.style.backgroundSize = 'cover';
            avatarPreview.style.backgroundPosition = 'center';
            return;
        }

            // show three-dots button; click to expand vertical capsule menu
        if (currentIconIndex === 'appleIdAvatar') {
            const appleIdAvatar = document.getElementById('appleIdAvatarPreview');
            const settingsAvatar = document.getElementById('settingsAvatarPreview');
            
            if (appleIdAvatar) {
                appleIdAvatar.innerHTML = ''; // 清空默认的 SVG
                appleIdAvatar.style.backgroundImage = `url('${url}')`;
                appleIdAvatar.style.backgroundSize = 'cover';
                appleIdAvatar.style.backgroundPosition = 'center';
            }
            if (settingsAvatar) {
                settingsAvatar.innerHTML = ''; // 同步清空设置页面的 SVG
                settingsAvatar.style.backgroundImage = `url('${url}')`;
                settingsAvatar.style.backgroundSize = 'cover';
                settingsAvatar.style.backgroundPosition = 'center';
            }
            saveProfileData(url);
            return;
        }

            // show three-dots button; click to expand vertical capsule menu
        const iconElement = document.getElementById(`theme-icon-${currentIconIndex}`);
        iconElement.style.backgroundImage = `url('${url}')`;
        iconElement.style.backgroundColor = 'transparent';
        currentEditingApps[currentIconIndex].currentIcon = `url('${url}')`;
    }

    function updateThemeAppName(index, newName) {
        currentEditingApps[index].currentName = newName.trim() || currentEditingApps[index].originalName;
    }

    function resetThemeApp(index) {
        const appData = currentEditingApps[index];
        appData.currentName = appData.originalName;
        
            // show three-dots button; click to expand vertical capsule menu
        const iconMap = {
            '设置': "url('https://cac.opple.com/yc-media/getFile?id=5b0f2ceab564421096b8a761f125b9f8#.jpg')",
            'wechat': "url('https://www.yn12377.cn/jubao/upload/smjb/2026/07/13/e4b01d48b8ad4a5b82879231b5376827.png')",
            'Contacts': "url('https://nos.netease.com/ysf/1390642a446f8db21a89e22b6cc5dc97.png')",
            '世界书': "url('https://wxkb-res-1258476243.cos.ap-shanghai.myqcloud.com/web/img/8848100788856671/1L7mKgmQ7qzXUq1S34ehFM_20260713082207#.png')",
            '电话': "url('https://xffkws.iflytek.com/group1/M01/09/0B/rB_aXmpUoCqAUSc8AAHTcnjGP3Q336.png')",
            '信息': "url('https://wxkb-res-1258476243.cos.ap-shanghai.myqcloud.com/web/img/8848100788856671/jRVvCDUWmZhAzGjBjgMKqg_20260713082218#.png')",
            '主题': "url('https://nos.netease.com/ysf/edecff66f1f78185763da92dcc2bd617.png')"
        };

        const defaultIcon = iconMap[appData.originalName];

        if (defaultIcon) {
            // show three-dots button; click to expand vertical capsule menu
            appData.currentIcon = defaultIcon;
            document.getElementById(`theme-icon-${index}`).style.backgroundImage = defaultIcon;
            document.getElementById(`theme-icon-${index}`).style.backgroundColor = 'transparent';
        } else {
            // show three-dots button; click to expand vertical capsule menu
            appData.currentIcon = '';
            document.getElementById(`theme-icon-${index}`).style.backgroundImage = 'none';
            document.getElementById(`theme-icon-${index}`).style.backgroundColor = '#e5e5ea';
        }
        
        document.getElementById(`theme-name-${index}`).innerText = appData.originalName;
    }

    function saveThemeChanges() {
            // show three-dots button; click to expand vertical capsule menu
        currentEditingApps.forEach(appData => {
            const nameEl = appData.element.querySelector('.app-name');
            const iconEl = appData.element.querySelector('.app-icon');
            
            if (nameEl) nameEl.innerText = appData.currentName;
            if (iconEl) {
                if (appData.currentIcon && appData.currentIcon !== 'none') {
                    iconEl.style.backgroundImage = appData.currentIcon;
                    iconEl.style.backgroundColor = 'transparent';
                    iconEl.classList.add('has-custom-icon');
                } else {
                    iconEl.style.backgroundImage = 'none';
                    iconEl.style.backgroundColor = ''; // 恢复默认 CSS 样式
                    iconEl.classList.remove('has-custom-icon');
                }
            }
        });
        
            // show three-dots button; click to expand vertical capsule menu
        saveLayout();
        
            // show three-dots button; click to expand vertical capsule menu
        closeThemeApp();
    }

            // show three-dots button; click to expand vertical capsule menu
 // 记录当前所在的 Tab

    function switchThemeTab(tabName, element) {
        currentActiveTab = tabName;
            // show three-dots button; click to expand vertical capsule menu
        const tabs = document.querySelectorAll('#themeTopTabs .theme-tab-item');
        tabs.forEach(tab => tab.classList.remove('active'));
        element.classList.add('active');

        const themeGrid = document.getElementById('themeAppGrid');
        const wallpaperGrid = document.getElementById('wallpaperAppGrid');
        const presetGrid = document.getElementById('presetAppGrid');
        const fontGrid = document.getElementById('fontAppGrid');
        const topBarTitle = document.getElementById('topBarTitle');
        const topRightBtn = document.getElementById('topRightBtn');

            // show three-dots button; click to expand vertical capsule menu
        if (isPresetEditMode) togglePresetEditMode();
            // show three-dots button; click to expand vertical capsule menu
        if (isFontEditMode) toggleFontEditMode();

            // show three-dots button; click to expand vertical capsule menu
        document.getElementById('themeDropdownMenu').classList.remove('show');
        if (document.getElementById('menuIconList')) {
            document.getElementById('menuIconList').style.display = 'block';
            document.getElementById('menuIconChevron').style.display = 'none';
        }

        if (tabName === 'theme') {
            topBarTitle.innerText = 'Icons';
            topRightBtn.innerText = 'Save';
            topRightBtn.style.display = 'block';
            document.getElementById('themeMenuBtn').style.display = 'none';
            themeGrid.style.display = 'grid';
            wallpaperGrid.style.display = 'none';
            presetGrid.style.display = 'none';
            if(fontGrid) fontGrid.style.display = 'none';
            hideWidgetChrome();
        } else if (tabName === 'wallpaper') {
            topBarTitle.innerText = 'Wallpapers';
            topRightBtn.style.display = 'none'; // 壁纸页不需要右上角按钮
            document.getElementById('themeMenuBtn').style.display = 'none';
            themeGrid.style.display = 'none';
            wallpaperGrid.style.display = 'flex';
            presetGrid.style.display = 'none';
            if(fontGrid) fontGrid.style.display = 'none';
            hideWidgetChrome();
            renderWallpapers();
            
            const now = new Date();
            document.getElementById('infoClock').textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        } else if (tabName === 'preset') {
            topBarTitle.innerText = 'Themes';
            topRightBtn.style.display = 'none';
            document.getElementById('themeMenuBtn').style.display = 'flex';
            themeGrid.style.display = 'none';
            wallpaperGrid.style.display = 'none';
            presetGrid.style.display = 'flex';
            if(fontGrid) fontGrid.style.display = 'none';
            hideWidgetChrome();
            renderPresets();
        } else if (tabName === 'font') {
            topBarTitle.innerText = 'Fonts';
            topRightBtn.innerText = 'Edit';
            topRightBtn.style.display = 'block';
            document.getElementById('themeMenuBtn').style.display = 'none';
            themeGrid.style.display = 'none';
            wallpaperGrid.style.display = 'none';
            presetGrid.style.display = 'none';
            if(fontGrid) fontGrid.style.display = 'flex';
            hideWidgetChrome();
        } else if (tabName === 'widget') {
            topBarTitle.innerText = "Widgets";
            topRightBtn.style.display = "none";
            document.getElementById("widgetDoneBtn").style.display = "none";
            // show three-dots button; click to expand vertical capsule menu
            const mb = document.getElementById("themeMenuBtn"); if (mb) mb.style.display = "flex";
            const di = document.getElementById("menuIconDots"); if (di) di.style.display = "block";
            const vb = document.getElementById('widgetViewBtn'); if (vb) vb.style.display = 'flex';
            const li = document.getElementById("menuIconList"); if (li) li.style.display = "none";
            const ch = document.getElementById("menuIconChevron"); if (ch) ch.style.display = "none";
            const wgc = document.getElementById("widgetToolbarMenu"); if (wgc) { wgc.style.display = "flex"; wgc.classList.remove("show"); }
            themeGrid.style.display = "none";
            wallpaperGrid.style.display = "none";
            presetGrid.style.display = "none";
            if(fontGrid) fontGrid.style.display = "none";
            document.getElementById("widgetAppGrid").style.display = "flex";
            if (typeof renderWidgetViews === "function") renderWidgetViews();
        }
    }

            // show three-dots button; click to expand vertical capsule menu


    function renderWallpapers() {
        const carouselScroll = document.getElementById('carouselScroll');
        const pagination = document.getElementById('pagination');
        if (!carouselScroll || !pagination) return;
        
        carouselScroll.innerHTML = '';
        pagination.innerHTML = '';

        wallpapers.forEach((wp, index) => {
            const card = document.createElement('div');
            card.className = 'wallpaper-card';

            if (wp.isAdd) {
                card.innerHTML = `
                    <div class="card-title">新墙纸</div>
                    <div class="screens-container">
                        <div class="screen-preview">
                            <div class="add-btn" onclick="openWallpaperMenu(event)">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </div>
                        </div>
                        <div class="screen-preview"></div>
                    </div>
                `;
            } else {
                const isSelected = currentWallpaperSrc === wp.src ? 'selected' : '';
                card.innerHTML = `
                    <div class="delete-btn" onclick="deleteWallpaper('${wp.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </div>
                    <div class="card-title">已存墙纸</div>
                    <div class="screens-container">
                        <div class="screen-preview ${isSelected}" style="background-image: url('${wp.src}')" onclick="setDesktopWallpaper('${wp.src}')"></div>
                        <div class="screen-preview ${isSelected}" style="background-image: url('${wp.src}')" onclick="setDesktopWallpaper('${wp.src}')"></div>
                    </div>
                `;
            }
            carouselScroll.appendChild(card);

            const dot = document.createElement('div');
            dot.className = 'dot';
            if (index === 0) dot.classList.add('active');
            pagination.appendChild(dot);
        });

        updatePagination();
    }

    function handleWallpaperUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
            // show three-dots button; click to expand vertical capsule menu
            // show three-dots button; click to expand vertical capsule menu
                    const MAX_WIDTH = 1170;
                    const MAX_HEIGHT = 2532;
                    
                    let width = img.width;
                    let height = img.height;
                    
            // show three-dots button; click to expand vertical capsule menu
                    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
            // show three-dots button; click to expand vertical capsule menu
                    const base64Url = canvas.toDataURL('image/jpeg', 0.95);
                    
                    const newWallpaper = {
                        id: Date.now().toString(),
                        isAdd: false,
                        src: base64Url
                    };
                    wallpapers.splice(1, 0, newWallpaper); // 插入到添加按钮后面
                    renderWallpapers();
                    saveWallpaperData();
                    
                    const carouselScroll = document.getElementById('carouselScroll');
                    setTimeout(() => {
                        carouselScroll.scrollTo({ left: carouselScroll.clientWidth, behavior: 'smooth' });
                    }, 100);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
        event.target.value = '';
    }

    function openWallpaperMenu(event) {
        const overlay = document.getElementById('wallpaperMenuOverlay');
        const menu = document.getElementById('wallpaperMenu');
        
        overlay.style.display = 'block';
        
            // show three-dots button; click to expand vertical capsule menu
        const rect = event.target.closest('.add-btn').getBoundingClientRect();
        let top = rect.bottom + 10;
        let left = rect.left - 100; // 稍微往左偏移一点，避免超出屏幕
        
        if (left + 240 > window.innerWidth) {
            left = window.innerWidth - 250;
        }
        if (top + 130 > window.innerHeight) {
            top = rect.top - 120;
        }
        
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
    }

    function closeWallpaperMenu() {
        document.getElementById('wallpaperMenuOverlay').style.display = 'none';
    }

    function openWallpaperUrlModal() {
        closeWallpaperMenu();
        showCustomPrompt('使用 URL 上传壁纸', 'https://...', '确定').then(url => {
            if (url && url.trim()) {
                const newWallpaper = { id: Date.now().toString(), isAdd: false, src: url.trim() };
                wallpapers.splice(1, 0, newWallpaper);
                renderWallpapers();
                saveWallpaperData();
                const carouselScroll = document.getElementById('carouselScroll');
                setTimeout(() => { carouselScroll.scrollTo({ left: carouselScroll.clientWidth, behavior: 'smooth' }); }, 100);
            }
        });
    }

    function deleteWallpaper(id) {
        showCustomConfirm('删除墙纸', '确定要删除这张壁纸吗？', '删除', true).then(confirmed => {
            if(confirmed) {
                const wpToDelete = wallpapers.find(wp => wp.id === id);
                wallpapers = wallpapers.filter(wp => wp.id !== id);
                
            // show three-dots button; click to expand vertical capsule menu
                if (wpToDelete && currentWallpaperSrc === wpToDelete.src) {
                    applyWallpaperToDesktop(null);
                }
                
                renderWallpapers();
                saveWallpaperData();
            }
        });
    }

    function setDesktopWallpaper(src) {
        applyWallpaperToDesktop(src);
        renderWallpapers(); // 重新渲染以更新选中状态边框
        saveWallpaperData();
    }

    let paginationRafId = null;
    function updatePagination() {
        if (paginationRafId) return;
        paginationRafId = requestAnimationFrame(() => {
            const carouselScroll = document.getElementById('carouselScroll');
            const pagination = document.getElementById('pagination');
            if (!carouselScroll || !pagination) {
                paginationRafId = null;
                return;
            }

            const scrollLeft = carouselScroll.scrollLeft;
            const cardWidth = carouselScroll.clientWidth;
            const currentIndex = Math.round(scrollLeft / cardWidth);
            
            const dots = pagination.querySelectorAll('.dot');
            dots.forEach((dot, index) => {
                if (index === currentIndex) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
            paginationRafId = null;
        });
    }

            // show three-dots button; click to expand vertical capsule menu

    let isPresetEditMode = false;
    let selectedPresets = new Set();

            // show three-dots button; click to expand vertical capsule menu
    function handleTopRightBtn() {
        if (currentActiveTab === 'theme') {
            saveThemeChanges(); // 在 Icons 页面，执行保存
        } else if (currentActiveTab === 'preset') {
            togglePresetEditMode(); // 在 Themes 页面，切换编辑模式
        } else if (currentActiveTab === 'font') {
            toggleFontEditMode(); // 在 Fonts 页面，切换编辑模式
        }
    }

            // show three-dots button; click to expand vertical capsule menu
    function toggleThemeMenu() {
        const menu = document.getElementById('themeDropdownMenu');
        const isShowing = menu.classList.toggle('show');
        
        const iconList = document.getElementById('menuIconList');
        const iconChevron = document.getElementById('menuIconChevron');
        if (iconList && iconChevron) {
            if (isShowing) {
                iconList.style.display = 'none';
                iconChevron.style.display = 'block';
            } else {
                iconList.style.display = 'block';
                iconChevron.style.display = 'none';
            }
        }
    }

            // show three-dots button; click to expand vertical capsule menu
    function togglePresetEditMode() {
        isPresetEditMode = !isPresetEditMode;
        selectedPresets.clear(); // 清空选中状态
        
        const topRightBtn = document.getElementById('topRightBtn');
        const menuBtn = document.getElementById('themeMenuBtn');
        const actionBtn = document.getElementById('presetActionBtn');
        
        if (isPresetEditMode) {
            topRightBtn.innerText = 'Cancel';
            topRightBtn.style.display = 'block';
            menuBtn.style.display = 'none';
            actionBtn.innerText = '删除所选预设';
            actionBtn.classList.add('delete-mode');
        } else {
            topRightBtn.style.display = 'none';
            menuBtn.style.display = 'flex';
            actionBtn.innerText = '+ 保存主题为预设';
            actionBtn.classList.remove('delete-mode');
        }
        renderPresets();
    }

            // show three-dots button; click to expand vertical capsule menu
    function handlePresetAction() {
        if (isPresetEditMode) {
            // show three-dots button; click to expand vertical capsule menu
            if (selectedPresets.size === 0) return;
            showCustomConfirm('删除预设', `确定要删除选中的 ${selectedPresets.size} 个预设吗？`, '删除', true).then(confirmed => {
                if (confirmed) {
                    presets = presets.filter(p => !selectedPresets.has(p.id));
                    savePresetData();
                    togglePresetEditMode(); // 删除后退出编辑模式
                }
            });
        } else {
            // show three-dots button; click to expand vertical capsule menu
            openPresetModal();
        }
    }

    function calculatePresetSize(preset) {
            // show three-dots button; click to expand vertical capsule menu
            // show three-dots button; click to expand vertical capsule menu
            // show three-dots button; click to expand vertical capsule menu
        const jsonString = JSON.stringify(preset);
        const totalBytes = jsonString.length;
        const sizeMB = totalBytes / (1024 * 1024);
        return sizeMB < 0.01 && sizeMB > 0 ? 0.01 : sizeMB;
    }

    function renderPresets() {
        const presetGridContent = document.getElementById('presetGridContent');
        const emptyHint = document.getElementById('presetEmptyHint');
        if (!presetGridContent) return;
        presetGridContent.innerHTML = '';

        if (presets.length === 0) {
            if(emptyHint) emptyHint.style.display = 'block';
        } else {
            if(emptyHint) emptyHint.style.display = 'none';
        }

        presets.forEach(preset => {
            const card = document.createElement('div');
            card.className = `preset-card ${isPresetEditMode ? 'edit-mode' : ''} ${selectedPresets.has(preset.id) ? 'selected' : ''}`;
            
            card.onclick = () => {
                if (isPresetEditMode) {
            // show three-dots button; click to expand vertical capsule menu
                    if (selectedPresets.has(preset.id)) {
                        selectedPresets.delete(preset.id);
                        card.classList.remove('selected');
                    } else {
                        selectedPresets.add(preset.id);
                        card.classList.add('selected');
                    }
            // show three-dots button; click to expand vertical capsule menu
                    const actionBtn = document.getElementById('presetActionBtn');
                    actionBtn.innerText = selectedPresets.size > 0 ? `删除所选预设 (${selectedPresets.size})` : '删除所选预设';
                } else {
            // show three-dots button; click to expand vertical capsule menu
                    openPresetDetail(preset.id);
                }
            };

            const hasWallpaper = !!preset.wallpaper;
            const bgStyle = hasWallpaper ? `background-image: url('${preset.wallpaper}')` : '';
            const bgClass = hasWallpaper ? 'preset-bg' : 'preset-bg default-bg';
            const timeClass = hasWallpaper ? 'preset-lock-time has-bg' : 'preset-lock-time';
            const timeStr = "09:41"; // 模拟 iOS 经典锁屏时间

            card.innerHTML = `
                <div class="preset-img-wrapper">
                    <div class="${bgClass}" style="${bgStyle}"></div>
                    <div class="${timeClass}">${timeStr}</div>
                    <div class="preset-check-circle"></div>
                </div>
                <div class="preset-name">${preset.name}</div>
            `;
            presetGridContent.appendChild(card);
        });
    }

    function openPresetModal() {
        showCustomPrompt('主题预设', '输入预设名称...', '保存').then(inputVal => {
            if (inputVal === null) return;
            if (!inputVal.trim()) {
                showCustomAlert("提示", "请输入预设名称！");
                return;
            }
            saveCurrentAsPreset(inputVal.trim());
        });
    }

    function saveCurrentAsPreset(inputVal) {
            // show three-dots button; click to expand vertical capsule menu
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

            // show three-dots button; click to expand vertical capsule menu
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

        const now = new Date();
        const dateStr = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日`;

        const newPreset = {
            id: Date.now(),
            name: inputVal,
            date: dateStr,
            wallpaper: currentWallpaperSrc,
            desktop: desktopApps,
            dock: dockApps
        };
        
            // show three-dots button; click to expand vertical capsule menu
        newPreset.sizeMB = calculatePresetSize(newPreset);

        presets.push(newPreset);
        savePresetData();
        renderPresets();
        
        const scrollArea = document.querySelector('.preset-scroll-area');
        setTimeout(() => {
            scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'smooth' });
        }, 100);
    }

    let currentDetailPresetId = null;

    function openPresetDetail(id) {
        const preset = presets.find(p => p.id === id);
        if (!preset) return;
        
        currentDetailPresetId = id;
        
        document.getElementById('detailName').innerText = preset.name;
        document.getElementById('detailDate').innerText = '创建于：' + (preset.date || '未知时间');
        
            // show three-dots button; click to expand vertical capsule menu
        let sizeMB = preset.sizeMB || 15.0;
        let sizeKB = sizeMB * 1024;
        document.getElementById('detailSize').innerText = sizeKB < 1024 ? sizeKB.toFixed(2) + ' KB' : sizeMB.toFixed(2) + ' MB';
        
        const container = document.getElementById('previewScaleContainer');
        container.style.backgroundImage = preset.wallpaper ? `url('${preset.wallpaper}')` : ''; // 清空内联样式，跟随 CSS 深浅色
        
            // show three-dots button; click to expand vertical capsule menu
        let desktopHTML = '<div class="desktop-grid" style="height: calc(100% - 180px);">';
        for (let i = 0; i < 28; i++) {
            const appData = preset.desktop ? preset.desktop.find(d => d.index === i) : null;
            if (appData) {
            // show three-dots button; click to expand vertical capsule menu
                const safeIcon = appData.icon ? appData.icon.replace(/"/g, "'") : '';
                const iconStyle = safeIcon ? `background-image: ${safeIcon};` : '';
                const customClass = appData.icon ? 'has-custom-icon' : '';
                desktopHTML += `<div class="desktop-slot"><div class="app-item"><div class="app-delete-btn" onpointerdown="deleteDesktopApp(this, event)">-</div><div class="app-icon ${customClass}" style="${iconStyle}"></div><div class="app-name">${appData.name}</div></div></div>`;
            } else {
                desktopHTML += `<div class="desktop-slot"></div>`;
            }
        }
        desktopHTML += '</div>';

            // show three-dots button; click to expand vertical capsule menu
        let dockHTML = '<div class="dock" style="bottom: 15px;">';
        if (preset.dock) {
            preset.dock.forEach(appData => {
            // show three-dots button; click to expand vertical capsule menu
                const safeIcon = appData.icon ? appData.icon.replace(/"/g, "'") : '';
                const iconStyle = safeIcon ? `background-image: ${safeIcon};` : '';
                const customClass = appData.icon ? 'has-custom-icon' : '';
                dockHTML += `<div class="app-item"><div class="app-icon ${customClass}" style="${iconStyle}"></div><div class="app-name" style="display:none;">${appData.name}</div></div>`;
            });
        }
        dockHTML += '</div>';

        container.innerHTML = desktopHTML + dockHTML;
        
        const detailPage = document.getElementById('presetDetailPage');
        detailPage.style.display = 'flex';
        setTimeout(() => {
            detailPage.classList.add('show');
        }, 10);
    }

    function toggleDetailMenu() {
        const menu = document.getElementById('detailDropdownMenu');
        const isShowing = menu.classList.toggle('show');
        
        const iconList = document.getElementById('detailMenuIconList');
        const iconChevron = document.getElementById('detailMenuIconChevron');
        if (iconList && iconChevron) {
            if (isShowing) {
                iconList.style.display = 'none';
                iconChevron.style.display = 'block';
            } else {
                iconList.style.display = 'block';
                iconChevron.style.display = 'none';
            }
        }
    }

    function closePresetDetail() {
        const detailPage = document.getElementById('presetDetailPage');
        document.getElementById('detailDropdownMenu').classList.remove('show'); // 关闭时隐藏菜单
        
            // show three-dots button; click to expand vertical capsule menu
        const iconList = document.getElementById('detailMenuIconList');
        const iconChevron = document.getElementById('detailMenuIconChevron');
        if (iconList && iconChevron) {
            iconList.style.display = 'block';
            iconChevron.style.display = 'none';
        }

        detailPage.classList.remove('show');
        setTimeout(() => {
            detailPage.style.display = 'none';
            currentDetailPresetId = null;
        }, 300);
    }

    let isExportingCurrentTheme = false;

    function openExportCurrentThemeModal() {
        isExportingCurrentTheme = true;
        showCustomPrompt('导出主题', { placeholder: '输入导出文件名称...', value: '当前主题' }, '导出').then(fileName => {
            if (fileName === null) return;
            exportCurrentUsingTheme(fileName.trim() || '当前主题');
        });
    }

    function openExportModal() {
        isExportingCurrentTheme = false;
        if (!currentDetailPresetId) return;
        const preset = presets.find(p => p.id === currentDetailPresetId);
        if (!preset) return;
        
        showCustomPrompt('导出主题', { placeholder: '输入导出文件名称...', value: preset.name }, '导出').then(fileName => {
            if (fileName === null) return;
            exportCurrentPreset(fileName.trim() || preset.name);
        });
    }

    function exportCurrentPreset(fileName) {
        if (!currentDetailPresetId) return;
        const preset = presets.find(p => p.id === currentDetailPresetId);
        if (!preset) return;
        
        const jsonString = JSON.stringify(preset, null, 2);
        const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", fileName + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        document.body.removeChild(downloadAnchorNode);
        URL.revokeObjectURL(url);
    }

    function extractBase64FromUrl(cssUrl) {
        if (!cssUrl) return null;
        const match = cssUrl.match(/url\(['"]?(data:image\/[^'"]+)['"]?\)/);
        return match ? match[1] : null;
    }

    function compressImageBase64(base64Str, maxWidth, quality, callback) {
        if (!base64Str || !base64Str.startsWith('data:image')) {
            callback(base64Str);
            return;
        }
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            callback(canvas.toDataURL('image/webp', quality));
        };
        img.onerror = function() {
            callback(base64Str);
        };
        img.src = base64Str;
    }

    function compressPreset() {
        if (!currentDetailPresetId) return;
        const preset = presets.find(p => p.id === currentDetailPresetId);
        if (!preset) return;

        const sizeEl = document.getElementById('detailSize');
        sizeEl.innerText = '压缩中...';

        let tasks = [];

            // show three-dots button; click to expand vertical capsule menu
        if (preset.wallpaper && preset.wallpaper.startsWith('data:image')) {
            tasks.push(new Promise(resolve => {
                compressImageBase64(preset.wallpaper, 1080, 0.8, (newBase64) => {
                    preset.wallpaper = newBase64;
                    resolve();
                });
            }));
        }

            // show three-dots button; click to expand vertical capsule menu
        if (preset.desktop) {
            preset.desktop.forEach(app => {
                if (app.icon) {
                    const base64 = extractBase64FromUrl(app.icon);
                    if (base64) {
                        tasks.push(new Promise(resolve => {
                            compressImageBase64(base64, 256, 0.9, (newBase64) => {
                                app.icon = `url('${newBase64}')`;
                                resolve();
                            });
                        }));
                    }
                }
            });
        }

            // show three-dots button; click to expand vertical capsule menu
        if (preset.dock) {
            preset.dock.forEach(app => {
                if (app.icon) {
                    const base64 = extractBase64FromUrl(app.icon);
                    if (base64) {
                        tasks.push(new Promise(resolve => {
                            compressImageBase64(base64, 256, 0.9, (newBase64) => {
                                app.icon = `url('${newBase64}')`;
                                resolve();
                            });
                        }));
                    }
                }
            });
        }

        Promise.all(tasks).then(() => {
            // show three-dots button; click to expand vertical capsule menu
            preset.sizeMB = calculatePresetSize(preset);
            
            // show three-dots button; click to expand vertical capsule menu
            let finalSizeKB = preset.sizeMB * 1024;
            document.getElementById('detailSize').innerText = finalSizeKB < 1024 ? finalSizeKB.toFixed(2) + ' KB' : preset.sizeMB.toFixed(2) + ' MB';
            
            savePresetData();
            
            showToast('压缩完成');
        });
    }

    function applyCurrentDetailTheme() {
        if (currentDetailPresetId) {
            applyPreset(currentDetailPresetId);
            closePresetDetail();
        }
    }

    function applyPreset(id) {
        const preset = presets.find(p => p.id === id);
        if (!preset) return;

            // show three-dots button; click to expand vertical capsule menu
        applyWallpaperToDesktop(preset.wallpaper);
        saveWallpaperData();

            // show three-dots button; click to expand vertical capsule menu
        if (preset.desktop && preset.dock) {
            renderLayout(preset.desktop, preset.dock);
        }

        saveLayout();
        
        if (document.getElementById('themeAppUI').classList.contains('show')) {
            loadAppsIntoThemeUI();
        }
        
        showToast("已应用预设主题！");
    }

    function importPreset(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData && importedData.name && (importedData.desktop || importedData.dock)) {
                    importedData.id = Date.now(); // 重新分配ID避免冲突
                    const now = new Date();
                    importedData.date = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日`;
                    importedData.sizeMB = calculatePresetSize(importedData);
                    presets.push(importedData);
                    savePresetData();
                    renderPresets();
                    showToast('导入成功！');
                } else {
                    showCustomAlert('错误', '无效的主题文件！');
                }
            } catch (err) {
                showCustomAlert('错误', '解析文件失败！');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function exportCurrentUsingTheme(themeName) {
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

        const currentTheme = {
            name: themeName,
            wallpaper: currentWallpaperSrc,
            desktop: desktopApps,
            dock: dockApps
        };

        const jsonString = JSON.stringify(currentTheme, null, 2);
        const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", themeName + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        document.body.removeChild(downloadAnchorNode);
        URL.revokeObjectURL(url);
    }

    function editPresetName() {
        if (!currentDetailPresetId) return;
        const preset = presets.find(p => p.id === currentDetailPresetId);
        if (!preset) return;
        
        showCustomPrompt('编辑主题名称', { placeholder: '输入新的主题名称...', value: preset.name }, '保存').then(newName => {
            if (newName === null) return;
            if (newName.trim() !== "") {
                preset.name = newName.trim();
                document.getElementById('detailName').innerText = preset.name;
                savePresetData();
                renderPresets();
            } else {
                showCustomAlert("提示", "名称不能为空！");
            }
        });
    }

            // show three-dots button; click to expand vertical capsule menu

    let isFontEditMode = false;
 // 存储字体数据
 // 当前选中的字体

            // show three-dots button; click to expand vertical capsule menu
            // show three-dots button; click to expand vertical capsule menu
    async function restoreFonts() {
        for (const font of customFonts) {
            try {
            // show three-dots button; click to expand vertical capsule menu
                const num = parseInt(font.id.split('_')[1]);
                if (num > customFontCount) customFontCount = num;

                let source = font.type === 'local' ? font.data : `url(${font.url})`;
                const newFont = new FontFace(font.id, source);
                const loadedFont = await newFont.load();
                document.fonts.add(loadedFont);
                
            // show three-dots button; click to expand vertical capsule menu
                addFontToList(font.name, font.id, true);
            } catch (err) {
                console.error("恢复字体失败:", font.name, err);
            }
        }
        
            // show three-dots button; click to expand vertical capsule menu
        const targetItem = document.querySelector(`.font-list-item[data-font="${currentSelectedFont}"]`);
        if (targetItem) {
            selectFont(currentSelectedFont, targetItem, true);
        } else {
            const defaultItem = document.querySelector('.font-list-item[data-font="default"]');
            if (defaultItem) selectFont('default', defaultItem, true);
        }

            // show three-dots button; click to expand vertical capsule menu
        const fontRequest = db.transaction([storeName], "readonly").objectStore(storeName).get("fontData");
        fontRequest.onsuccess = (e) => {
            const fData = e.target.result;
            if (fData && fData.size) {
                document.getElementById('fontSizeSlider').value = fData.size;
                updateFontSize(true); // 传入 true 表示是恢复阶段，不触发重复保存
            }
        };
    }

    function toggleFontEditMode() {
        isFontEditMode = !isFontEditMode;
        const topRightBtn = document.getElementById('topRightBtn');
        const previewText = document.getElementById('fontPreviewText');
        const fontList = document.getElementById('fontListContainer');

        if (isFontEditMode) {
            topRightBtn.innerText = 'Done';
            topRightBtn.style.color = '#ff3b30';
            previewText.contentEditable = "true";
            previewText.classList.add('editable');
            fontList.classList.add('font-edit-mode');
        } else {
            topRightBtn.innerText = 'Edit';
            topRightBtn.style.color = '#000';
            previewText.contentEditable = "false";
            previewText.classList.remove('editable');
            fontList.classList.remove('font-edit-mode');
        }
    }

    function updateFontSize(isRestore = false) {
        const size = document.getElementById('fontSizeSlider').value;
        document.getElementById('fontPreviewText').style.fontSize = size + 'px';

            // show three-dots button; click to expand vertical capsule menu
        const scale = size / 18;
        
        let styleTag = document.getElementById('dynamic-global-font-size');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'dynamic-global-font-size';
            document.head.appendChild(styleTag);
        }
        
            // show three-dots button; click to expand vertical capsule menu
        styleTag.innerHTML = `
            .app-name { font-size: ${12 * scale}px !important; }
            .theme-app-name-input { font-size: ${13 * scale}px !important; }
            .font-item-title, .font-name-text { font-size: ${16 * scale}px !important; }
            .font-item-subtitle, .font-preview-subtext { font-size: ${13 * scale}px !important; }
            .preset-name { font-size: ${12 * scale}px !important; }
            .card-title { font-size: ${16 * scale}px !important; }
            .info-title { font-size: ${15 * scale}px !important; }
            .info-desc { font-size: ${13 * scale}px !important; }
            .detail-title { font-size: ${17 * scale}px !important; }
            .info-name { font-size: ${22 * scale}px !important; }
            .save-preset-btn { font-size: ${15 * scale}px !important; }
        `;

        if (!isRestore) {
            saveFontData(); // 拖动滑块时保存数据
        }
    }

    function selectFont(fontFamily, element, isRestore = false) {
        if (isFontEditMode) return;

        document.querySelectorAll('#fontListContainer .font-list-item').forEach(el => el.classList.remove('active'));
        if (element) element.classList.add('active');

        currentSelectedFont = fontFamily;
        if (!isRestore) saveFontData(); // 如果不是恢复阶段，则保存状态

        const previewBox = document.getElementById('globalFontPreview');
        
        let styleTag = document.getElementById('dynamic-global-font');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'dynamic-global-font';
            document.head.appendChild(styleTag);
        }

        if (fontFamily === 'default') {
            previewBox.style.fontFamily = '"Geomini", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
            styleTag.innerHTML = `*, *::before, *::after, input, button, textarea, select { font-family: "Geomini", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif !important; }`;
        } else {
            previewBox.style.fontFamily = `"${fontFamily}", "Geomini", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`;
            styleTag.innerHTML = `*, *::before, *::after, input, button, textarea, select { font-family: "${fontFamily}", "Geomini", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif !important; }`;
        }
    }

    function addFontToList(fontName, fontFamily, isRestore = false) {
        const fontList = document.getElementById('fontListContainer');
        const newItem = document.createElement('div');
        newItem.className = 'font-list-item font-item-padding';
        newItem.setAttribute('data-font', fontFamily);
        newItem.onclick = function(e) { 
            if(e.target.closest('.delete-font-btn') || e.target.closest('.font-swipe-btn')) return;
            if(this.classList.contains('swiped')) {
                this.querySelector('.font-item-inner').style.transform = 'translateX(0)';
                this.classList.remove('swiped');
                currentFontSwipeItem = null;
                return;
            }
            selectFont(fontFamily, this); 
        };
        
        newItem.innerHTML = `
            <div class="font-swipe-actions">
                <div class="font-swipe-btn font-swipe-edit" onclick="openEditFontModal('${fontFamily}')">编辑</div>
                <div class="font-swipe-btn font-swipe-delete" onclick="deleteFont(this, '${fontFamily}')">删除</div>
            </div>
            <div class="font-item-inner">
                <div class="font-item-content">
                    <div class="font-name-text" style="font-family: '${fontFamily}', 'Geomini', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif">${fontName}</div>
                    <div class="font-preview-subtext" style="font-family: '${fontFamily}', 'Geomini', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif">The quick brown fox / 探索宇宙</div>
                </div>
                <div class="font-checkmark">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div class="delete-font-btn" onclick="deleteFont(this, '${fontFamily}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </div>
            </div>
        `;
        fontList.appendChild(newItem);
        
        if (!isRestore) {
            selectFont(fontFamily, newItem);
        }
    }

    function deleteFont(btnElement, fontFamily) {
        const listItem = btnElement.closest('.font-list-item');
        const isActive = listItem.classList.contains('active');
        listItem.remove();

            // show three-dots button; click to expand vertical capsule menu
        customFonts = customFonts.filter(f => f.id !== fontFamily);
        saveFontData();

        if (isActive) {
            const defaultItem = document.querySelector('#fontListContainer .font-list-item[data-font="default"]');
            if (defaultItem) selectFont('default', defaultItem);
        }
    }

    function handleLocalFont(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const fontData = e.target.result;
            customFontCount++;
            const fontFamily = `CustomFont_${customFontCount}`;
            const fontName = file.name.split('.')[0];

            const newFont = new FontFace(fontFamily, fontData);
            newFont.load().then(function(loadedFont) {
                document.fonts.add(loadedFont);
                
            // show three-dots button; click to expand vertical capsule menu
                customFonts.push({ id: fontFamily, name: fontName, type: 'local', data: fontData });
                saveFontData();
                
                addFontToList(fontName, fontFamily);
            }).catch(function(error) {
                showCustomAlert('错误', '字体加载失败，请检查文件格式！');
                console.error(error);
            });
        };
        reader.readAsArrayBuffer(file);
        event.target.value = ''; 
    }

    function openUrlFontModal() {
        showCustomPrompt('导入字体', [
            { placeholder: '输入字体名称 (选填)' },
            { placeholder: 'https://...' }
        ], '安装').then(res => {
            if (res === null) return;
            let fontName = res[0].trim();
            const url = res[1].trim();

            if (!url) {
                showCustomAlert('提示', '请输入字体 URL！');
                return;
            }

            customFontCount++;
            const fontFamily = `UrlFont_${customFontCount}`;
            if (!fontName) fontName = `网络字体 ${customFontCount}`;

            const newFont = new FontFace(fontFamily, `url(${url})`);
            newFont.load().then(function(loadedFont) {
                document.fonts.add(loadedFont);
                customFonts.push({ id: fontFamily, name: fontName, type: 'url', url: url });
                saveFontData();
                addFontToList(fontName, fontFamily);
            }).catch(function(error) {
                showCustomAlert('错误', '字体加载失败，请确保 URL 直接指向字体文件且允许跨域访问！');
                console.error(error);
            });
        });
    }

            // show three-dots button; click to expand vertical capsule menu
    let fontTouchStartX = 0;
    let currentFontSwipeItem = null;
    let currentEditFontId = null;

    document.addEventListener('touchstart', function(e) {
        const item = e.target.closest('#fontListContainer .font-list-item');
        if (item && !isFontEditMode && item.getAttribute('data-font') !== 'default') {
            fontTouchStartX = e.touches[0].clientX;
            if (currentFontSwipeItem && currentFontSwipeItem !== item) {
                currentFontSwipeItem.querySelector('.font-item-inner').style.transform = 'translateX(0)';
                currentFontSwipeItem.classList.remove('swiped');
                currentFontSwipeItem = null;
            }
        } else if (currentFontSwipeItem) {
            currentFontSwipeItem.querySelector('.font-item-inner').style.transform = 'translateX(0)';
            currentFontSwipeItem.classList.remove('swiped');
            currentFontSwipeItem = null;
        }
    });

    document.addEventListener('touchmove', function(e) {
        if (!fontTouchStartX) return;
        const item = e.target.closest('#fontListContainer .font-list-item');
        if (item && !isFontEditMode && item.getAttribute('data-font') !== 'default') {
            const touchCurrentX = e.touches[0].clientX;
            const diff = touchCurrentX - fontTouchStartX;
            if (diff < -30) { // 左滑展开
                if (e.cancelable) e.preventDefault();
                item.querySelector('.font-item-inner').style.transform = 'translateX(-130px)';
                item.classList.add('swiped');
                currentFontSwipeItem = item;
            } else if (diff > 30 && currentFontSwipeItem === item) { // 右滑收起
                if (e.cancelable) e.preventDefault();
                item.querySelector('.font-item-inner').style.transform = 'translateX(0)';
                item.classList.remove('swiped');
                currentFontSwipeItem = null;
            }
        }
    }, { passive: false });

    document.addEventListener('touchend', function(e) {
        fontTouchStartX = 0;
    });

    function openEditFontModal(fontId) {
        currentEditFontId = fontId;
        const fontData = customFonts.find(f => f.id === fontId);
        if (!fontData) return;
        
        if (currentFontSwipeItem) {
            currentFontSwipeItem.querySelector('.font-item-inner').style.transform = 'translateX(0)';
            currentFontSwipeItem.classList.remove('swiped');
            currentFontSwipeItem = null;
        }

        showCustomPrompt('编辑字体名称', { placeholder: '输入新的字体名称...', value: fontData.name }, '保存').then(newName => {
            if (newName === null) {
                currentEditFontId = null;
                return;
            }
            if (newName.trim() !== "") {
                fontData.name = newName.trim();
                saveFontData();
                const listItem = document.querySelector(`.font-list-item[data-font="${currentEditFontId}"]`);
                if (listItem) {
                    const nameEl = listItem.querySelector('.font-name-text');
                    if (nameEl) nameEl.innerText = fontData.name;
                }
                currentEditFontId = null;
            } else {
                showCustomAlert("提示", "名称不能为空！");
                currentEditFontId = null;
            }
        });
    }

            // show three-dots button; click to expand vertical capsule menu
