                function getWidgetDimensions(widgetData) {
            const LEGACY_SLOT_SIZE = 140;
            const COLUMN_GAP = 10;
            const ROW_HEIGHT = 80;
            const ROW_GAP = 15;
            const grid = document.getElementById('desktopGrid');
            const gridStyle = grid ? window.getComputedStyle(grid) : null;
            const horizontalPadding = gridStyle ? parseFloat(gridStyle.paddingLeft) + parseFloat(gridStyle.paddingRight) : 0;
            const gridWidth = grid ? grid.clientWidth - horizontalPadding : 0;
            const columnWidth = gridWidth > 0 ? (gridWidth - COLUMN_GAP * 3) / 4 : 80;

            let columns = 1;
            let rows = 1;
            const legacyWidth = parseInt(widgetData.width, 10);
            const legacyHeight = parseInt(widgetData.height, 10);
            if (legacyWidth > 0 && legacyHeight > 0) {
                columns = Math.max(1, Math.round(legacyWidth / LEGACY_SLOT_SIZE));
                rows = Math.max(1, Math.round(legacyHeight / LEGACY_SLOT_SIZE));
            } else if (widgetData.presetSize) {
                const parts = widgetData.presetSize.split('x').map(Number);
                if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
                    columns = parts[0];
                    rows = parts[1];
                }
            }

            columns = Math.min(4, columns);
            rows = Math.min(7, rows);
            return {
                width: columns * columnWidth + (columns - 1) * COLUMN_GAP,
                height: rows * ROW_HEIGHT + (rows - 1) * ROW_GAP
            };
        }
        window.getWidgetDimensions = getWidgetDimensions;
        function getWidgetGridSpan(widgetData) {
            const legacyWidth = parseInt(widgetData.width, 10);
            const legacyHeight = parseInt(widgetData.height, 10);
            let columns = 1;
            let rows = 1;
            if (legacyWidth > 0 && legacyHeight > 0) {
                columns = Math.round(legacyWidth / 140) || 1;
                rows = Math.round(legacyHeight / 140) || 1;
            } else if (widgetData.presetSize) {
                const parts = widgetData.presetSize.split('x').map(Number);
                columns = parts[0] || 1;
                rows = parts[1] || 1;
            }
            return { columns: Math.min(4, Math.max(1, columns)), rows: Math.min(7, Math.max(1, rows)) };
        }

        function getDesktopAreaIndexes(startIndex, columns, rows) {
            const startColumn = startIndex % 4;
            const startRow = Math.floor(startIndex / 4);
            if (startColumn + columns > 4 || startRow + rows > 7) return [];
            const indexes = [];
            for (let row = 0; row < rows; row++) {
                for (let column = 0; column < columns; column++) {
                    indexes.push(startIndex + row * 4 + column);
                }
            }
            return indexes;
        }

        function rebuildDesktopWidgetOccupancy() {
            const slots = Array.from(document.querySelectorAll('#desktopGrid .desktop-slot'));
            slots.forEach(slot => slot.removeAttribute('data-widget-occupied-by'));
            slots.forEach((slot, startIndex) => {
                const widget = slot.querySelector(':scope > .app-item.is-widget');
                if (!widget) return;
                const columns = parseInt(widget.getAttribute('data-widget-columns'), 10) || 1;
                const rows = parseInt(widget.getAttribute('data-widget-rows'), 10) || 1;
                const widgetId = widget.getAttribute('data-app-id') || '';
                getDesktopAreaIndexes(startIndex, columns, rows).forEach(index => {
                    if (index !== startIndex && slots[index]) slots[index].setAttribute('data-widget-occupied-by', widgetId);
                });
            });
        }

        function isDesktopAreaAvailable(startIndex, columns, rows, ignoredWidget) {
            const slots = Array.from(document.querySelectorAll('#desktopGrid .desktop-slot'));
            const indexes = getDesktopAreaIndexes(startIndex, columns, rows);
            if (indexes.length !== columns * rows) return false;
            const ignoredId = ignoredWidget ? ignoredWidget.getAttribute('data-app-id') : '';
            return indexes.every(index => {
                const slot = slots[index];
                const app = slot ? slot.querySelector(':scope > .app-item') : null;
                const occupiedBy = slot ? slot.getAttribute('data-widget-occupied-by') : '';
                return slot && (!app || app === ignoredWidget) && (!occupiedBy || occupiedBy === ignoredId);
            });
        }

        function findAvailableWidgetSlot(columns, rows) {
            rebuildDesktopWidgetOccupancy();
            const slots = Array.from(document.querySelectorAll('#desktopGrid .desktop-slot'));
            for (let index = 0; index < slots.length; index++) {
                if (isDesktopAreaAvailable(index, columns, rows, null)) return slots[index];
            }
            return null;
        }

        function addDesktopWidget(widgetData) {
        const span = getWidgetGridSpan(widgetData);
        const emptySlot = findAvailableWidgetSlot(span.columns, span.rows);

        if (emptySlot) {
            const app = document.createElement('div');
            app.className = 'app-item is-widget';
            app.setAttribute('data-app-id', 'widget-' + Date.now());
            app.setAttribute('data-widget-content', encodeURIComponent(widgetData.content || ''));
            app.setAttribute('data-widget-width', widgetData.width || '');
            app.setAttribute('data-widget-height', widgetData.height || '');
            app.setAttribute('data-widget-preset-size', widgetData.presetSize || '');
            app.setAttribute('data-widget-columns', span.columns);
            app.setAttribute('data-widget-rows', span.rows);

            const dims1 = getWidgetDimensions(widgetData);
            app.style.width = dims1.width + 'px';
            app.style.height = dims1.height + 'px';
            app.innerHTML = `<div class="app-delete-btn" onpointerdown="deleteDesktopApp(this, event)">-</div><div class="app-icon" style="background: transparent; box-shadow: none; border-radius: 20px; overflow: hidden; width: ${dims1.width}px; height: ${dims1.height}px; position: absolute; left: 0; top: 0; z-index: 10;">${widgetData.content}</div><div class="app-name" style="display:none;">${widgetData.name || "组件"}</div>`;

            if (isEditMode) app.classList.add('jiggling');
            emptySlot.appendChild(app);
            rebuildDesktopWidgetOccupancy();
            saveLayout();
            return true;
        } else {
            alert('桌面没有足够的连续空间，请先清理或更换位置');
            return false;
        }
    }

    function applyWallpaperToDesktop(src) {
        currentWallpaperSrc = src;
        const iphoneEl = document.querySelector('.iphone');
        if (src) {
            iphoneEl.style.backgroundImage = `url('${src}')`;
            iphoneEl.style.backgroundSize = 'cover';
            iphoneEl.style.backgroundPosition = 'center';
        } else {
            iphoneEl.style.backgroundImage = ''; // 清空内联样式，让 CSS 类接管深浅色渐变
        }
    }

    function renderDefaultLayout() {
        const iconMap = {
            '设置': "url('https://cac.opple.com/yc-media/getFile?id=5b0f2ceab564421096b8a761f125b9f8#.jpg')",
            'wechat': "url('https://www.yn12377.cn/jubao/upload/smjb/2026/07/13/e4b01d48b8ad4a5b82879231b5376827.png')",
            'Contacts': "url('https://nos.netease.com/ysf/1390642a446f8db21a89e22b6cc5dc97.png')",
            '世界书': "url('https://wxkb-res-1258476243.cos.ap-shanghai.myqcloud.com/web/img/8848100788856671/1L7mKgmQ7qzXUq1S34ehFM_20260713082207#.png')",
            '电话': "url('https://xffkws.iflytek.com/group1/M01/09/0B/rB_aXmpUoCqAUSc8AAHTcnjGP3Q336.png')",
            '信息': "url('https://wxkb-res-1258476243.cos.ap-shanghai.myqcloud.com/web/img/8848100788856671/jRVvCDUWmZhAzGjBjgMKqg_20260713082218#.png')",
            '主题': "url('https://nos.netease.com/ysf/edecff66f1f78185763da92dcc2bd617.png')"
        };

        const defaultDesktop = [
            { index: 0, name: '设置', appId: 'settings', icon: iconMap['设置'] }, 
            { index: 1, name: 'wechat', appId: 'wechat', icon: iconMap['wechat'] },
            { index: 2, name: 'Contacts', appId: 'contacts', icon: iconMap['Contacts'] }, 
            { index: 3, name: '世界书', appId: 'worldbook', icon: iconMap['世界书'] }
        ];
        const defaultDock = [
            { index: 0, name: '电话', icon: iconMap['电话'] }, 
            { index: 1, name: '信息', icon: iconMap['信息'] }, 
            { index: 2, name: '主题', appId: 'theme', icon: iconMap['主题'] }
        ];
        renderLayout(defaultDesktop, defaultDock);
        saveLayout();
    }

        function createAppElement(name, icon, appId, isWidget=false, widgetContent='', width='', height='', presetSize='') {
        const app = document.createElement('div');
        app.className = isWidget ? 'app-item is-widget' : 'app-item';
        if (appId) {
            app.setAttribute('data-app-id', appId);
        }
        
        if (isWidget) {
            app.setAttribute('data-widget-content', encodeURIComponent(widgetContent));
            app.setAttribute('data-widget-width', width || '');
            app.setAttribute('data-widget-height', height || '');
            app.setAttribute('data-widget-preset-size', presetSize || '');
            const widgetSpan = getWidgetGridSpan({ width, height, presetSize });
            app.setAttribute('data-widget-columns', widgetSpan.columns);
            app.setAttribute('data-widget-rows', widgetSpan.rows);
            const dims2 = getWidgetDimensions({ width, height, presetSize });
            app.style.width = dims2.width + 'px';
            app.style.height = dims2.height + 'px';
            app.innerHTML = `<div class="app-delete-btn" onpointerdown="deleteDesktopApp(this, event)">-</div><div class="app-icon" style="background: transparent; box-shadow: none; border-radius: 20px; overflow: hidden; width: ${dims2.width}px; height: ${dims2.height}px; position: absolute; left: 0; top: 0; z-index: 10;">${widgetContent}</div><div class="app-name" style="display:none;">组件</div>`;
        } else {
            app.innerHTML = `<div class="app-delete-btn" onpointerdown="deleteDesktopApp(this, event)">-</div><div class="app-icon"></div><div class="app-name">${name}</div>`;
            if (icon) {
                const iconEl = app.querySelector('.app-icon');
                iconEl.style.backgroundImage = icon;
                iconEl.style.backgroundColor = 'transparent';
                iconEl.classList.add('has-custom-icon');
            }
        }
        return app;
    }

    function renderLayout(desktopData = [], dockData = []) {
        const desktopGrid = document.getElementById('desktopGrid');
        const dock = document.getElementById('dock');
        desktopGrid.innerHTML = '';
        dock.innerHTML = '';

            // show three-dots button; click to expand vertical capsule menu
        let hasSettings = false;
        let hasTheme = false;

        const checkAndHeal = (app) => {
            if (app.appId === 'settings') hasSettings = true;
            if (app.appId === 'theme') hasTheme = true;
            // show three-dots button; click to expand vertical capsule menu
            if (!app.appId) {
                if (app.name === '设置' || (app.icon && app.icon.includes('5b0f2ceab564421096b8a761f125b9f8'))) {
                    app.appId = 'settings';
                    hasSettings = true;
                }
                if (app.name === '主题' || (app.icon && app.icon.includes('6a54a036dfcc02hklfme5i6442'))) {
                    app.appId = 'theme';
                    hasTheme = true;
                }
                if (app.name === '世界书' || (app.icon && app.icon.includes('1L7mKgmQ7qzXUq1S34ehFM_20260713082207'))) {
                    app.appId = 'worldbook';
                }
                if (app.name === 'wechat' || app.name === '微信' || (app.icon && app.icon.includes('e4b01d48b8ad4a5b82879231b5376827'))) {
                    app.appId = 'wechat';
                }
                if (app.name === 'Contacts' || (app.icon && app.icon.includes('1390642a446f8db21a89e22b6cc5dc97'))) {
                    app.appId = 'contacts';
                }
            }
        };

        desktopData.forEach(checkAndHeal);
        dockData.forEach(checkAndHeal);

            // show three-dots button; click to expand vertical capsule menu
        if (!hasSettings && desktopData.length > 0) {
            desktopData[0].appId = 'settings';
        }
        if (!hasTheme && dockData.length > 0) {
            dockData[dockData.length - 1].appId = 'theme';
        }
        // ----------------------------------

            // show three-dots button; click to expand vertical capsule menu
        for (let i = 0; i < 28; i++) {
            const slot = document.createElement('div');
            slot.className = 'desktop-slot';
            const appData = desktopData.find(d => d.index === i);
            if (appData) {
                            if (appData.isWidget || appData.widgetContent) {
                slot.appendChild(createAppElement(appData.name, appData.icon, appData.appId, true, appData.widgetContent, appData.width, appData.height, appData.presetSize));
            } else {
                slot.appendChild(createAppElement(appData.name, appData.icon, appData.appId));
            }
            }
            desktopGrid.appendChild(slot);
        }

            // show three-dots button; click to expand vertical capsule menu
        rebuildDesktopWidgetOccupancy();

        dockData.forEach(appData => {
            dock.appendChild(createAppElement(appData.name, appData.icon, appData.appId));
        });
    }

            // show three-dots button; click to expand vertical capsule menu

            // show three-dots button; click to expand vertical capsule menu
    let isEditMode = false;
    const editPlus = document.getElementById('editPlus');
    const editDone = document.getElementById('editDone');
    const statusBar = document.getElementById('statusBar');
    const dockContainer = document.getElementById('dock');


    function isStatusBarVisible() {
        return appSettings.simulatedStatusBarVisible;
    }

    function applyStatusBarVisibility() {
        const shouldShow = isStatusBarVisible();
        const toggle = document.getElementById('statusBarToggle');
        const isActuallyVisible = shouldShow && !isEditMode;

        statusBar.style.opacity = isActuallyVisible ? '1' : '0';
        statusBar.style.visibility = isActuallyVisible ? 'visible' : 'hidden';
        if (toggle) {
            toggle.classList.toggle('on', shouldShow);
            toggle.setAttribute('aria-checked', String(shouldShow));
        }
    }

    function toggleStatusBarVisibility() {
        appSettings.simulatedStatusBarVisible = !isStatusBarVisible();
        saveAppSettings();
        applyStatusBarVisibility();
    }

    let pressTimer = null;
    let startX = 0, startY = 0;
    let draggedApp = null;
    let dragGhost = null;
    let offsetX = 0, offsetY = 0;

    function enterEditMode() {
        if (isEditMode) return;
        isEditMode = true;
        statusBar.style.opacity = '0';
        statusBar.style.visibility = 'hidden';
        editPlus.style.display = 'flex';
        editDone.style.display = 'block';
        
            // show three-dots button; click to expand vertical capsule menu
        document.querySelectorAll('.desktop-slot').forEach(slot => slot.classList.add('show-grid'));
        document.querySelectorAll('.app-item').forEach(app => app.classList.add('jiggling'));
    }

            window.deleteDesktopApp = function(btn, e) {
            e.stopPropagation();
            e.preventDefault();
            const appItem = btn.closest('.app-item');
            if (appItem) {
                appItem.remove();
                rebuildDesktopWidgetOccupancy();
                if (typeof window.saveLayout === 'function') {
                    window.saveLayout();
                }
            }
        };

    function exitEditMode() {
        isEditMode = false;
        applyStatusBarVisibility();
        editPlus.style.display = 'none';
        editDone.style.display = 'none';
        
            // show three-dots button; click to expand vertical capsule menu
        document.querySelectorAll('.desktop-slot').forEach(slot => slot.classList.remove('show-grid'));
        document.querySelectorAll('.app-item').forEach(app => app.classList.remove('jiggling'));
        
            // show three-dots button; click to expand vertical capsule menu
        saveLayout();
    }

    editDone.addEventListener('click', exitEditMode);
    editPlus.addEventListener('click', () => {
        const modal = document.getElementById('widgetPickerModal');
        const list = document.getElementById('widgetPickerList');
        list.innerHTML = '';
        
        const allWidgets = [...officialWidgets, ...customWidgets];
        
        if (allWidgets.length === 0) {
            list.innerHTML = '<div style="color: white; text-align: center; margin-top: 40px;">暂无小组件</div>';
        } else {
            allWidgets.forEach((widget, index) => {
                const item = document.createElement('div');
                item.style.cssText = "background: rgba(255,255,255,0.8); border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 16px; cursor: pointer; backdrop-filter: blur(10px);";
                
                const preview = document.createElement('div');
                preview.style.cssText = "width: 60px; height: 60px; border-radius: 12px; background: " + (widget.preview || '#ccc') + "; flex-shrink: 0;";
                
                const name = document.createElement('div');
                name.style.cssText = "flex: 1; font-weight: bold; color: black; font-size: 16px;";
                name.innerText = widget.name || '未命名组件';
                
                const sizeLabel = document.createElement('div');
                sizeLabel.style.cssText = "background: rgba(0,122,255,0.15); color: #007aff; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px;";
                sizeLabel.innerText = formatWidgetSizeLabel(widget);
                
                item.appendChild(preview);
                item.appendChild(name);
                item.appendChild(sizeLabel);
                
                item.onclick = () => {
                    modal.style.display = 'none';
                    addDesktopWidget(widget);
                };
                
                list.appendChild(item);
            });
        }
        
        modal.style.display = 'flex';
    });


    let contactsAppLoadPromise = null;

    function loadContactsAppScript() {
        if (window.ContactsApp) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const existingScript = document.getElementById('contactsAppScript');
            if (existingScript) {
                existingScript.addEventListener('load', resolve, { once: true });
                existingScript.addEventListener('error', () => reject(new Error('联系人脚本加载失败')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.id = 'contactsAppScript';
            script.src = 'js/contacts.js';
            script.onload = resolve;
            script.onerror = () => {
                script.remove();
                reject(new Error('联系人脚本加载失败'));
            };
            document.body.appendChild(script);
        });
    }

    function loadContactsApp() {
        if (window.ContactsApp && document.getElementById('contactsAppUI')) {
            return Promise.resolve(window.ContactsApp);
        }
        if (contactsAppLoadPromise) return contactsAppLoadPromise;

        contactsAppLoadPromise = (async () => {
            if (!document.getElementById('contactsAppStyles')) {
                const link = document.createElement('link');
                link.id = 'contactsAppStyles';
                link.rel = 'stylesheet';
                link.href = 'css/contacts.css';
                document.head.appendChild(link);
            }

            let container = document.getElementById('contactsAppUI');
            if (!container) {
                const response = await fetch('pages/contacts.html', { cache: 'no-store' });
                if (!response.ok) throw new Error('联系人页面加载失败 (' + response.status + ')');

                const template = document.createElement('template');
                template.innerHTML = (await response.text()).trim();
                container = template.content.firstElementChild;
                if (!container || container.id !== 'contactsAppUI') {
                    throw new Error('联系人页面结构无效');
                }

                const iphone = document.querySelector('.iphone');
                if (!iphone) throw new Error('未找到桌面容器');
                iphone.appendChild(container);
            }

            await loadContactsAppScript();
            if (!window.ContactsApp) throw new Error('联系人模块未正确初始化');
            await window.ContactsApp.init(container);
            return window.ContactsApp;
        })().catch(error => {
            contactsAppLoadPromise = null;
            throw error;
        });

        return contactsAppLoadPromise;
    }

    function openContactsApp() {
        loadContactsApp()
            .then(app => app.open())
            .catch(error => {
                console.error('Contacts app could not be opened:', error);
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert('加载失败', '联系人页面暂时无法打开，请稍后重试。');
                } else {
                    alert('联系人页面暂时无法打开，请稍后重试。');
                }
            });
    }
    window.openContactsApp = openContactsApp;

    document.addEventListener('pointerdown', (e) => {
        const app = e.target.closest('.app-item');
        
        if (!isEditMode) {
            if (!app) return;
            startX = e.clientX;
            startY = e.clientY;
            pressTimer = setTimeout(() => {
                enterEditMode();
            }, 600);
        } else {
            if (!app) return;
            e.preventDefault();
            draggedApp = app;

            const rect = app.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;

            dragGhost = app.cloneNode(true);
            dragGhost.style.position = 'fixed';
            dragGhost.style.left = '0px';
            dragGhost.style.top = '0px';
            dragGhost.style.width = rect.width + 'px';
            dragGhost.style.height = rect.height + 'px';
            dragGhost.style.opacity = '0.8';
            dragGhost.style.pointerEvents = 'none';
            dragGhost.style.zIndex = '1000';
            dragGhost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0) scale(1.15)`;
            dragGhost.style.willChange = 'transform';
            dragGhost.classList.remove('jiggling');
            document.body.appendChild(dragGhost);

            app.style.opacity = '0';
        }
    });

    document.addEventListener('pointermove', (e) => {
        if (!isEditMode) {
            if (pressTimer && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        } else {
            if (!dragGhost) return;
            e.preventDefault();
            dragGhost.style.transform = `translate3d(${e.clientX - offsetX}px, ${e.clientY - offsetY}px, 0) scale(1.15)`;
        }
    });

    document.addEventListener('pointerup', (e) => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }

            // show three-dots button; click to expand vertical capsule menu
        if (!isEditMode && !dragGhost) {
            const app = e.target.closest('.app-item');
            if (app) {
                const appId = app.getAttribute('data-app-id');
                if (appId === 'theme') {
                    openThemeApp();
                } else if (appId === 'settings') {
                    openSettingsApp();
                } else if (appId === 'worldbook') {
                    openWorldbookApp();
                } else if (appId === 'wechat') {
                    openWechatApp();
                } else if (appId === 'contacts') {
                    openContactsApp();
                }
            }
        }

        if (isEditMode && dragGhost && draggedApp) {
            dragGhost.remove();
            dragGhost = null;
            draggedApp.style.opacity = '1';

            draggedApp.style.display = 'none';
            const targetEl = document.elementFromPoint(e.clientX, e.clientY);
            draggedApp.style.display = '';

            if (targetEl) {
                const targetApp = targetEl.closest('.app-item');
                const targetSlot = targetEl.closest('.desktop-slot');
                const targetDock = targetEl.closest('.dock');

                const parent1 = draggedApp.parentNode;

                const draggedIsWidget = draggedApp.classList.contains('is-widget');
                if (draggedIsWidget) {
                    if (targetSlot) {
                        const slots = Array.from(document.querySelectorAll('#desktopGrid .desktop-slot'));
                        const targetIndex = slots.indexOf(targetSlot);
                        const columns = parseInt(draggedApp.getAttribute('data-widget-columns'), 10) || 1;
                        const rows = parseInt(draggedApp.getAttribute('data-widget-rows'), 10) || 1;
                        if (targetIndex > -1 && isDesktopAreaAvailable(targetIndex, columns, rows, draggedApp)) {
                            targetSlot.appendChild(draggedApp);
                        }
                    }
                } else if (targetApp && targetApp !== draggedApp && !targetApp.classList.contains('is-widget')) {
                    const parent2 = targetApp.parentNode;
                    const targetOccupied = parent2.getAttribute('data-widget-occupied-by');
                    const sourceOccupied = parent1.getAttribute('data-widget-occupied-by');
                    if (!targetOccupied && !sourceOccupied) {
                        const sibling1 = draggedApp.nextSibling === targetApp ? draggedApp : draggedApp.nextSibling;
                        const sibling2 = targetApp.nextSibling === draggedApp ? targetApp : targetApp.nextSibling;
                        parent2.insertBefore(draggedApp, sibling2);
                        parent1.insertBefore(targetApp, sibling1);
                    }
                } else if (targetSlot && !targetSlot.querySelector('.app-item') && !targetSlot.getAttribute('data-widget-occupied-by')) {
                    targetSlot.appendChild(draggedApp);
                } else if (targetDock && !parent1.classList.contains('dock')) {
                    if (dockContainer.querySelectorAll('.app-item').length < 4) {
                        dockContainer.appendChild(draggedApp);
                    }
                }
                rebuildDesktopWidgetOccupancy();
            }
            draggedApp = null;
        }
    });

    document.addEventListener('pointercancel', () => {
        if (pressTimer) clearTimeout(pressTimer);
        if (dragGhost) {
            dragGhost.remove();
            dragGhost = null;
            if (draggedApp) draggedApp.style.opacity = '1';
            draggedApp = null;
        }
    });

            // show three-dots button; click to expand vertical capsule menu
