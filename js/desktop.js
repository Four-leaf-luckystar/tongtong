        const DESKTOP_COLUMNS = 4;
        const DESKTOP_MIN_ROWS = 6;
        const DESKTOP_MAX_ROWS = 7;
        let DESKTOP_ROWS = DESKTOP_MIN_ROWS;
        let DESKTOP_SLOT_COUNT = DESKTOP_COLUMNS * DESKTOP_ROWS;

        function normalizeDesktopRowCount(value, pages) {
            const rows = Number(value);
            if (rows === DESKTOP_MIN_ROWS || rows === DESKTOP_MAX_ROWS) return rows;
            const hasSeventhRow = Array.isArray(pages) && pages.some(page =>
                Array.isArray(page) && page.some(app => Number(app && app.index) >= DESKTOP_COLUMNS * DESKTOP_MIN_ROWS)
            );
            return hasSeventhRow ? DESKTOP_MAX_ROWS : DESKTOP_MIN_ROWS;
        }

        function isIOSDevice() {
            const userAgent = navigator.userAgent || '';
            return /iPad|iPhone|iPod/i.test(userAgent)
                || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        }

        function calculateDesktopRowCount() {
            if (isIOSDevice()) return DESKTOP_MIN_ROWS;

            const grid = document.getElementById('desktopGrid');
            const shell = document.querySelector('.iphone');
            if (!grid || !shell || window.innerWidth > 768) return DESKTOP_MIN_ROWS;

            const gridStyle = window.getComputedStyle(grid);
            const gridTop = grid.getBoundingClientRect().top;
            const paddingTop = parseFloat(gridStyle.paddingTop) || 0;
            const seventhRowBottom = gridTop + paddingTop + DESKTOP_MAX_ROWS * 80 + (DESKTOP_MAX_ROWS - 1) * 15;
            const controls = document.getElementById('desktopPageControls');
            const searchBar = document.getElementById('desktopSearchBar');
            const shellBottom = shell.getBoundingClientRect().bottom;
            const controlsTop = controls ? controls.getBoundingClientRect().top : shellBottom - 175;
            const searchTop = searchBar ? searchBar.getBoundingClientRect().top : shellBottom - 145;
            const availableBottom = Math.min(controlsTop, searchTop);

            return seventhRowBottom + 8 <= availableBottom ? DESKTOP_MAX_ROWS : DESKTOP_MIN_ROWS;
        }

        function applyDesktopRowCount(rows) {
            const normalizedRows = normalizeDesktopRowCount(rows);
            DESKTOP_ROWS = normalizedRows;
            DESKTOP_SLOT_COUNT = DESKTOP_COLUMNS * DESKTOP_ROWS;
            document.documentElement.style.setProperty('--desktop-rows', String(DESKTOP_ROWS));
        }

                function getWidgetDimensions(widgetData) {
            const LEGACY_SLOT_SIZE = 140;
            const COLUMN_GAP = 10;
            const ROW_HEIGHT = 80;
            const ROW_GAP = 15;
            const grid = document.getElementById('desktopGrid');
            const gridStyle = grid ? window.getComputedStyle(grid) : null;
            const horizontalPadding = gridStyle ? parseFloat(gridStyle.paddingLeft) + parseFloat(gridStyle.paddingRight) : 0;
            const gridWidth = grid ? grid.clientWidth - horizontalPadding : 0;
            const columnWidth = gridWidth > 0
                ? (gridWidth - COLUMN_GAP * (DESKTOP_COLUMNS - 1)) / DESKTOP_COLUMNS
                : 80;

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

            columns = Math.min(DESKTOP_COLUMNS, columns);
            rows = Math.min(DESKTOP_ROWS, rows);
            return {
                width: columns * columnWidth + (columns - 1) * COLUMN_GAP,
                height: rows * ROW_HEIGHT + (rows - 1) * ROW_GAP
            };
        }
        window.getWidgetDimensions = getWidgetDimensions;
        function normalizeStoredWidgetContent(content) {
            const original = String(content == null ? '' : content);
            let decoded = original;

            for (let attempt = 0; attempt < 20 && !/<[^>]+>/.test(decoded); attempt++) {
                try {
                    const next = decodeURIComponent(decoded);
                    if (next === decoded) break;
                    decoded = next;
                } catch (error) {
                    return original;
                }
            }

            return /<[^>]+>/.test(decoded) ? decoded : original;
        }

        function buildDesktopWidgetFrameContent(content) {
            const normalizedContent = normalizeStoredWidgetContent(content);
            return typeof window.buildWidgetDesktopContent === 'function'
                ? window.buildWidgetDesktopContent(normalizedContent)
                : normalizedContent;
        }

        function makeDesktopWidgetFrameHTML(content) {
            return makeWidgetFrameHTML(buildDesktopWidgetFrameContent(content), true);
        }

        function buildDesktopWidgetSrcdoc(content) {
            const frameContent = buildDesktopWidgetFrameContent(content);
            return typeof window.buildWidgetFrameSrcdoc === 'function'
                ? window.buildWidgetFrameSrcdoc(frameContent)
                : '<style>html,body{margin:0;padding:0;width:100%;height:100%;box-sizing:border-box;}</style>' + frameContent;
        }

        function createWidgetPickerPreview(widgetData) {
            const previewSize = 60;
            const preview = document.createElement('div');
            preview.style.cssText = "width: 60px; height: 60px; border-radius: 12px; background: rgba(255,255,255,0.55); flex-shrink: 0; overflow: hidden; position: relative; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.45);";

            const widgetContent = normalizeStoredWidgetContent(widgetData && widgetData.content ? widgetData.content : '');
            if (!widgetContent) {
                preview.style.background = (widgetData && widgetData.preview) || 'rgba(255,255,255,0.55)';
                return preview;
            }

            const previewDims = getWidgetDimensions(widgetData || {});
            const previewScale = Math.min(previewSize / previewDims.width, previewSize / previewDims.height);
            const frame = document.createElement('iframe');
            frame.setAttribute('sandbox', 'allow-scripts');
            frame.setAttribute('title', ((widgetData && widgetData.name) || '组件') + '预览');
            frame.style.cssText = "position: absolute; border: 0; background: transparent; transform-origin: top left; pointer-events: none;";
            frame.style.width = previewDims.width + 'px';
            frame.style.height = previewDims.height + 'px';
            frame.style.left = (previewSize - previewDims.width * previewScale) / 2 + 'px';
            frame.style.top = (previewSize - previewDims.height * previewScale) / 2 + 'px';
            frame.style.transform = 'scale(' + previewScale + ')';
            frame.addEventListener('load', function () {
                if (typeof window.syncGlobalFontToWidgetFrame === 'function') {
                    window.syncGlobalFontToWidgetFrame(frame);
                }
            });
            frame.srcdoc = buildDesktopWidgetSrcdoc(widgetContent);
            preview.appendChild(frame);
            return preview;
        }

        function refreshDesktopWidgetFrames() {
            document.querySelectorAll('#desktopGrid .app-item.is-widget').forEach(app => {
                const frame = app.querySelector('.widget-render-frame');
                if (!frame) return;
                const content = app.getAttribute('data-widget-content') || '';
                frame.srcdoc = buildDesktopWidgetSrcdoc(content);
            });
        }
        window.refreshDesktopWidgetFrames = refreshDesktopWidgetFrames;

        let desktopPages = [[]];
        let currentDesktopPage = 0;

        const PLACEHOLDER_DESKTOP_APP_BATCHES = Object.freeze({
            v1: Object.freeze([
                { name: '相逢', appId: 'placeholder-xiangfeng', icon: 'linear-gradient(145deg, #ff7b89, #ffb36b)' },
                { name: '音乐', appId: 'placeholder-music', icon: "url('https://nos.netease.com/ysf/44b1b063945538f0ebf2e1670a156958.jpg')" },
                { name: '吃什么', appId: 'placeholder-food', icon: 'linear-gradient(145deg, #ff9f43, #feca57)' },
                { name: '今日', appId: 'placeholder-today', icon: null },
                { name: '枕上书', appId: 'placeholder-bedtime-book', icon: 'linear-gradient(145deg, #596275, #a4b0be)' },
                { name: '阴阳', appId: 'placeholder-yinyang', icon: 'linear-gradient(145deg, #2f3640, #dcdde1)' },
                { name: 'B站', appId: 'placeholder-bilibili', icon: "url('https://nos.netease.com/ysf/a113c9347d79566ad7ec58c6dd563c98.png')" }
            ]),
            v2: Object.freeze([
                { name: '健康', appId: 'placeholder-health', icon: "url('https://nos.netease.com/ysf/71d2d06f946d0e2edcf1a1db219cc93c.jpg')" },
                { name: '家居', appId: 'placeholder-home', icon: "url('https://nos.netease.com/ysf/09e991e8c030af3963027b3e0d20d243.jpg')" },
                { name: '游戏中心', appId: 'placeholder-game-center', icon: "url('https://nos.netease.com/ysf/f20ff48c726869054a57f61aebbeb278.jpg')" },
                { name: '邮件', appId: 'placeholder-mail', icon: "url('https://nos.netease.com/ysf/e3e0cd38a75d199af2613b0373ef5750.jpg')" },
                { name: '相册', appId: 'placeholder-photos', icon: "url('https://nos.netease.com/ysf/23270ba74c92c441837d98bfb9aa7d6e.jpg')" }
            ]),
            v3: Object.freeze([
                { name: '阅读', appId: 'placeholder-reading', icon: "url('https://nos.netease.com/ysf/48a26bca2ea29a6fb2c3a6ca537c9e2e.jpg')" }
            ]),
            v4: Object.freeze([
                { name: 'icity', appId: 'placeholder-icity', icon: "url('https://nos.netease.com/ysf/1b49764d130e8005ea149180a1d764db.jpg')" }
            ])
        });
        const PLACEHOLDER_DESKTOP_APPS = Object.freeze([
            ...PLACEHOLDER_DESKTOP_APP_BATCHES.v1,
            ...PLACEHOLDER_DESKTOP_APP_BATCHES.v2,
            ...PLACEHOLDER_DESKTOP_APP_BATCHES.v3,
            ...PLACEHOLDER_DESKTOP_APP_BATCHES.v4
        ]);

        function cloneDesktopPage(page) {
            return Array.isArray(page) ? page.map(app => ({ ...app })) : [];
        }

        function normalizeDesktopPages(data, sourceRows = DESKTOP_ROWS) {
            const pages = Array.isArray(data) && data.length > 0 && Array.isArray(data[0])
                ? data
                : [Array.isArray(data) ? data : []];
            const normalizedSourceRows = normalizeDesktopRowCount(sourceRows, pages);
            const sourceSlotCount = DESKTOP_COLUMNS * normalizedSourceRows;
            const preservedPageCount = normalizedSourceRows === DESKTOP_ROWS ? Math.max(1, pages.length) : 1;
            const normalizedPages = Array.from({ length: preservedPageCount }, () => []);
            const occupiedSlots = Array.from({ length: preservedPageCount }, () => new Set());

            function getAppSpan(app) {
                return app && (app.isWidget || app.widgetContent)
                    ? getWidgetGridSpan(app)
                    : { columns: 1, rows: 1 };
            }

            function getAvailableIndexes(startIndex, span, occupied) {
                const indexes = getDesktopAreaIndexes(startIndex, span.columns, span.rows);
                return indexes.length === span.columns * span.rows && indexes.every(index => !occupied.has(index))
                    ? indexes
                    : [];
            }

            const positionedApps = [];
            pages.forEach((page, pageIndex) => {
                cloneDesktopPage(page).forEach((app, itemIndex) => {
                    const storedIndex = Number(app.index);
                    const sourceIndex = Number.isInteger(storedIndex) && storedIndex >= 0
                        ? storedIndex
                        : itemIndex;
                    positionedApps.push({ app, globalIndex: pageIndex * sourceSlotCount + sourceIndex });
                });
            });
            positionedApps.sort((left, right) => left.globalIndex - right.globalIndex);

            positionedApps.forEach(({ app, globalIndex }) => {
                const span = getAppSpan(app);
                let targetPage = Math.floor(globalIndex / DESKTOP_SLOT_COUNT);
                let targetStartIndex = globalIndex % DESKTOP_SLOT_COUNT;
                let placed = false;

                while (!placed) {
                    if (!normalizedPages[targetPage]) {
                        normalizedPages[targetPage] = [];
                        occupiedSlots[targetPage] = new Set();
                    }

                    for (let startIndex = targetStartIndex; startIndex < DESKTOP_SLOT_COUNT; startIndex++) {
                        const indexes = getAvailableIndexes(startIndex, span, occupiedSlots[targetPage]);
                        if (indexes.length === 0) continue;
                        indexes.forEach(index => occupiedSlots[targetPage].add(index));
                        normalizedPages[targetPage].push({ ...app, index: startIndex });
                        placed = true;
                        break;
                    }

                    if (!placed) {
                        targetPage++;
                        targetStartIndex = 0;
                    }
                }
            });

            if (normalizedSourceRows !== DESKTOP_ROWS) {
                while (normalizedPages.length > 1 && normalizedPages[normalizedPages.length - 1].length === 0) {
                    normalizedPages.pop();
                }
            }
            return normalizedPages;
        }

        function serializeAppElement(app, index) {
            const iconEl = app.querySelector('.app-icon');
            const nameEl = app.querySelector('.app-name');
            const iconBg = iconEl ? iconEl.style.backgroundImage : '';
            const isWidget = app.classList.contains('is-widget');
            const appData = {
                index,
                name: nameEl ? nameEl.innerText : '',
                icon: iconBg !== '' && iconBg !== 'none' ? iconBg : null,
                appId: app.getAttribute('data-app-id'),
                isWidget
            };
            if (isWidget) {
                appData.widgetContent = app.getAttribute('data-widget-content') || '';
                appData.width = app.getAttribute('data-widget-width') || '';
                appData.height = app.getAttribute('data-widget-height') || '';
                appData.presetSize = app.getAttribute('data-widget-preset-size') || '';
            }
            return appData;
        }

        function serializeDesktopGrid() {
            const apps = [];
            getCurrentDesktopSlots().forEach((slot, index) => {
                const app = slot.querySelector(':scope > .app-item');
                if (app) apps.push(serializeAppElement(app, index));
            });
            return apps;
        }

        function serializeDockApps() {
            return Array.from(document.querySelectorAll('#dock .app-item')).map((app, index) => serializeAppElement(app, index));
        }

        function commitCurrentDesktopPage() {
            if (!desktopPages.length) desktopPages = [[]];
            desktopPages[currentDesktopPage] = serializeDesktopGrid();
        }

        function getDesktopPagesSnapshot() {
            commitCurrentDesktopPage();
            return desktopPages.map(cloneDesktopPage);
        }

        function getCurrentDesktopPageIndex() {
            return currentDesktopPage;
        }

        function getDesktopRowCount() {
            return DESKTOP_ROWS;
        }

        function addMissingPlaceholderApps(pages, dockData = [], candidateApps = PLACEHOLDER_DESKTOP_APPS) {
            const normalizedPages = normalizeDesktopPages(pages, DESKTOP_ROWS);
            const existingAppIds = new Set();
            normalizedPages.forEach(page => page.forEach(app => {
                if (app && app.appId) existingAppIds.add(app.appId);
            }));
            dockData.forEach(app => {
                if (app && app.appId) existingAppIds.add(app.appId);
            });

            const missingApps = candidateApps.filter(app => !existingAppIds.has(app.appId));
            if (missingApps.length === 0) return { pages: normalizedPages, changed: false };

            const occupiedSlots = normalizedPages.map(page => {
                const occupied = new Set();
                page.forEach(app => {
                    const span = app && (app.isWidget || app.widgetContent)
                        ? getWidgetGridSpan(app)
                        : { columns: 1, rows: 1 };
                    getDesktopAreaIndexes(Number(app.index) || 0, span.columns, span.rows)
                        .forEach(index => occupied.add(index));
                });
                return occupied;
            });

            missingApps.forEach(app => {
                let placed = false;
                for (let pageIndex = 0; !placed; pageIndex++) {
                    if (!normalizedPages[pageIndex]) {
                        normalizedPages[pageIndex] = [];
                        occupiedSlots[pageIndex] = new Set();
                    }
                    for (let index = 0; index < DESKTOP_SLOT_COUNT; index++) {
                        if (occupiedSlots[pageIndex].has(index)) continue;
                        normalizedPages[pageIndex].push({ ...app, index });
                        occupiedSlots[pageIndex].add(index);
                        placed = true;
                        break;
                    }
                }
            });

            return { pages: normalizedPages, changed: true };
        }

        function ensurePlaceholderAppsOnDesktop(batchName) {
            const pages = getDesktopPagesSnapshot();
            const dockData = serializeDockApps();
            const candidateApps = batchName
                ? PLACEHOLDER_DESKTOP_APP_BATCHES[batchName] || []
                : PLACEHOLDER_DESKTOP_APPS;
            const result = addMissingPlaceholderApps(pages, dockData, candidateApps);
            if (!result.changed) return false;
            renderLayout(result.pages, dockData, currentDesktopPage, DESKTOP_ROWS);
            return true;
        }

        function updatePlaceholderAppIcons() {
            const iconByAppId = new Map(
                PLACEHOLDER_DESKTOP_APPS
                    .filter(app => app.icon.startsWith('url('))
                    .map(app => [app.appId, app.icon])
            );
            const pages = getDesktopPagesSnapshot();
            const dockData = serializeDockApps();
            let changed = false;

            const updateIcon = app => {
                const nextIcon = app && iconByAppId.get(app.appId);
                if (!nextIcon || app.icon === nextIcon) return;
                app.icon = nextIcon;
                changed = true;
            };
            pages.forEach(page => page.forEach(updateIcon));
            dockData.forEach(updateIcon);

            if (!changed) return false;
            renderLayout(pages, dockData, currentDesktopPage, DESKTOP_ROWS);
            return true;
        }

        function getDesktopPageElement(pageIndex = currentDesktopPage) {
            const desktopGrid = document.getElementById('desktopGrid');
            return desktopGrid
                ? desktopGrid.querySelector(`:scope > .desktop-page[data-page-index="${pageIndex}"]`)
                : null;
        }

        function getCurrentDesktopSlots() {
            const page = getDesktopPageElement();
            return page ? Array.from(page.querySelectorAll(':scope > .desktop-slot')) : [];
        }

        function createDesktopPageElement(pageIndex, pageData = []) {
            const page = document.createElement('div');
            page.className = 'desktop-page';
            page.dataset.pageIndex = String(pageIndex);
            page.hidden = true;
            for (let i = 0; i < DESKTOP_SLOT_COUNT; i++) {
                const slot = document.createElement('div');
                slot.className = 'desktop-slot' + (isEditMode ? ' show-grid' : '');
                const appData = pageData.find(d => d.index === i);
                if (appData) {
                    const app = appData.isWidget || appData.widgetContent
                        ? createAppElement(appData.name, appData.icon, appData.appId, true, appData.widgetContent, appData.width, appData.height, appData.presetSize)
                        : createAppElement(appData.name, appData.icon, appData.appId);
                    if (isEditMode) app.classList.add('jiggling');
                    slot.appendChild(app);
                }
                page.appendChild(slot);
            }
            document.getElementById('desktopGrid').appendChild(page);
            rebuildDesktopWidgetOccupancy(page);
            return page;
        }

        function ensureDesktopPageElement(pageIndex, pageData = []) {
            return getDesktopPageElement(pageIndex) || createDesktopPageElement(pageIndex, pageData);
        }

        function activateDesktopPage(pageIndex) {
            const desktopGrid = document.getElementById('desktopGrid');
            const activePage = ensureDesktopPageElement(pageIndex, desktopPages[pageIndex]);
            desktopGrid.querySelectorAll(':scope > .desktop-page').forEach(page => {
                const isActive = page === activePage;
                page.hidden = !isActive;
                page.classList.toggle('active', isActive);
            });
            return activePage;
        }

        function removeDesktopPageElement(pageIndex) {
            const page = getDesktopPageElement(pageIndex);
            if (page) page.remove();
            document.querySelectorAll('#desktopGrid > .desktop-page').forEach(pageElement => {
                const storedIndex = Number(pageElement.dataset.pageIndex);
                if (storedIndex > pageIndex) {
                    pageElement.dataset.pageIndex = String(storedIndex - 1);
                }
            });
        }

        function ensureDesktopPageControls() {
            let controls = document.getElementById('desktopPageControls');
            if (controls) return controls;
            controls = document.createElement('div');
            controls.id = 'desktopPageControls';
            controls.className = 'desktop-page-controls';
            controls.innerHTML = `
                <button class="desktop-page-action desktop-page-delete" type="button" aria-label="删除当前空白页" title="删除当前空白页">−</button>
                <div class="desktop-page-dots" aria-label="桌面页面"></div>
                <button class="desktop-page-action desktop-page-add" type="button" aria-label="新增空白页" title="新增空白页">+</button>
            `;
            const iphone = document.querySelector('.iphone');
            if (iphone) iphone.appendChild(controls);
            controls.querySelector('.desktop-page-add').addEventListener('click', addBlankDesktopPage);
            controls.querySelector('.desktop-page-delete').addEventListener('click', deleteCurrentBlankDesktopPage);
            return controls;
        }

        function renderDesktopPageControls() {
            const controls = ensureDesktopPageControls();
            if (!controls) return;
            const dots = controls.querySelector('.desktop-page-dots');
            dots.innerHTML = '';
            desktopPages.forEach((page, index) => {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'desktop-page-dot' + (index === currentDesktopPage ? ' active' : '');
                dot.setAttribute('aria-label', `第 ${index + 1} 页`);
                dot.setAttribute('aria-current', index === currentDesktopPage ? 'page' : 'false');
                dot.addEventListener('click', () => switchDesktopPage(index));
                dots.appendChild(dot);
            });
            controls.classList.toggle('is-editing', isEditMode);
            const deleteButton = controls.querySelector('.desktop-page-delete');
            const currentPageIsEmpty = serializeDesktopGrid().length === 0;
            deleteButton.disabled = desktopPages.length <= 1 || !currentPageIsEmpty;
        }

        function renderDesktopPage(pageData = [], direction = 0) {
            const desktopGrid = document.getElementById('desktopGrid');
            ensureDesktopPageElement(currentDesktopPage, pageData);
            activateDesktopPage(currentDesktopPage);
            if (direction) {
                desktopGrid.classList.remove('page-enter-left', 'page-enter-right');
                void desktopGrid.offsetWidth;
                desktopGrid.classList.add(direction > 0 ? 'page-enter-right' : 'page-enter-left');
            }
            renderDesktopPageControls();
        }

        function switchDesktopPage(pageIndex, options = {}) {
            const nextPage = Math.max(0, Math.min(Number(pageIndex) || 0, desktopPages.length - 1));
            if (nextPage === currentDesktopPage) {
                renderDesktopPageControls();
                return false;
            }
            if (!options.skipCommit) commitCurrentDesktopPage();
            const direction = nextPage > currentDesktopPage ? 1 : -1;
            currentDesktopPage = nextPage;
            renderDesktopPage(desktopPages[currentDesktopPage], direction);
            if (!options.skipSave && typeof window.saveLayout === 'function') window.saveLayout();
            return true;
        }

        function addBlankDesktopPage() {
            commitCurrentDesktopPage();
            desktopPages.push([]);
            currentDesktopPage = desktopPages.length - 1;
            renderDesktopPage(desktopPages[currentDesktopPage], 1);
            if (typeof window.saveLayout === 'function') window.saveLayout();
        }

        function deleteCurrentBlankDesktopPage() {
            commitCurrentDesktopPage();
            if (desktopPages.length <= 1 || desktopPages[currentDesktopPage].length > 0) return false;
            const deletedPage = currentDesktopPage;
            desktopPages.splice(deletedPage, 1);
            removeDesktopPageElement(deletedPage);
            currentDesktopPage = Math.min(currentDesktopPage, desktopPages.length - 1);
            renderDesktopPage(desktopPages[currentDesktopPage], -1);
            if (typeof window.saveLayout === 'function') window.saveLayout();
            return true;
        }

        window.serializeDesktopGrid = serializeDesktopGrid;
        window.serializeDockApps = serializeDockApps;
        window.getDesktopPagesSnapshot = getDesktopPagesSnapshot;
        window.getCurrentDesktopPageIndex = getCurrentDesktopPageIndex;
        window.getDesktopRowCount = getDesktopRowCount;
        window.ensurePlaceholderAppsOnDesktop = ensurePlaceholderAppsOnDesktop;
        window.updatePlaceholderAppIcons = updatePlaceholderAppIcons;
        window.switchDesktopPage = switchDesktopPage;
        window.addBlankDesktopPage = addBlankDesktopPage;
        window.deleteCurrentBlankDesktopPage = deleteCurrentBlankDesktopPage;

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
            return {
                columns: Math.min(DESKTOP_COLUMNS, Math.max(1, columns)),
                rows: Math.min(DESKTOP_ROWS, Math.max(1, rows))
            };
        }

        function getDesktopAreaIndexes(startIndex, columns, rows) {
            const startColumn = startIndex % DESKTOP_COLUMNS;
            const startRow = Math.floor(startIndex / DESKTOP_COLUMNS);
            if (startColumn + columns > DESKTOP_COLUMNS || startRow + rows > DESKTOP_ROWS) return [];
            const indexes = [];
            for (let row = 0; row < rows; row++) {
                for (let column = 0; column < columns; column++) {
                    indexes.push(startIndex + row * DESKTOP_COLUMNS + column);
                }
            }
            return indexes;
        }

        function rebuildDesktopWidgetOccupancy(page = getDesktopPageElement()) {
            const slots = page ? Array.from(page.querySelectorAll(':scope > .desktop-slot')) : [];
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
            const slots = getCurrentDesktopSlots();
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
            const slots = getCurrentDesktopSlots();
            for (let index = 0; index < slots.length; index++) {
                if (isDesktopAreaAvailable(index, columns, rows, null)) return slots[index];
            }
            return null;
        }

        function addDesktopWidget(widgetData) {
        const span = getWidgetGridSpan(widgetData);
        const emptySlot = findAvailableWidgetSlot(span.columns, span.rows);

        if (emptySlot) {
            const widgetContent = normalizeStoredWidgetContent(widgetData.content);
            const app = document.createElement('div');
            app.className = 'app-item is-widget';
            app.setAttribute('data-app-id', 'widget-' + Date.now());
            app.setAttribute('data-widget-content', encodeURIComponent(widgetContent));
            app.setAttribute('data-widget-width', widgetData.width || '');
            app.setAttribute('data-widget-height', widgetData.height || '');
            app.setAttribute('data-widget-preset-size', widgetData.presetSize || '');
            app.setAttribute('data-widget-columns', span.columns);
            app.setAttribute('data-widget-rows', span.rows);

            const dims1 = getWidgetDimensions(widgetData);
            app.style.width = dims1.width + 'px';
            app.style.height = dims1.height + 'px';
            app.innerHTML = `<div class="app-delete-btn" onpointerdown="deleteDesktopApp(this, event)">-</div><div class="widget-edit-hotzone" aria-label="长按进入编辑模式"></div><div class="app-icon" style="background: transparent; box-shadow: none; border-radius: 20px; overflow: hidden; width: ${dims1.width}px; height: ${dims1.height}px; position: absolute; left: 0; top: 0; z-index: 10;">${makeDesktopWidgetFrameHTML(widgetContent)}</div><div class="app-name" style="display:none;">${widgetData.name || "组件"}</div>`;

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
        const layoutWithPlaceholders = addMissingPlaceholderApps([defaultDesktop], defaultDock);
        renderLayout(layoutWithPlaceholders.pages, defaultDock, 0, DESKTOP_ROWS);
        saveLayout();
    }

    const TODAY_CALENDAR_APP_ID = 'placeholder-today';
    const TODAY_CALENDAR_WEEKDAYS = Object.freeze(['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']);
    let todayCalendarRefreshTimer = null;

    function renderTodayCalendarIcon(iconEl, date = new Date()) {
        if (!iconEl) return;
        iconEl.className = 'app-icon today-calendar-icon';
        iconEl.style.backgroundImage = '';
        iconEl.style.backgroundColor = '';
        iconEl.dataset.calendarDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        iconEl.innerHTML = `
            <span class="today-calendar-shine"></span>
            <span class="today-calendar-weekday">${TODAY_CALENDAR_WEEKDAYS[date.getDay()]}</span>
            <span class="today-calendar-day">${date.getDate()}</span>
        `;
    }

    function refreshTodayCalendarIcons() {
        const now = new Date();
        document.querySelectorAll(`[data-app-id="${TODAY_CALENDAR_APP_ID}"] .app-icon`).forEach(iconEl => {
            renderTodayCalendarIcon(iconEl, now);
        });
    }

    function scheduleTodayCalendarRefresh() {
        clearTimeout(todayCalendarRefreshTimer);
        const now = new Date();
        const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        todayCalendarRefreshTimer = setTimeout(() => {
            refreshTodayCalendarIcons();
            scheduleTodayCalendarRefresh();
        }, nextDay.getTime() - now.getTime() + 1000);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        refreshTodayCalendarIcons();
        scheduleTodayCalendarRefresh();
    });
    scheduleTodayCalendarRefresh();

        function createAppElement(name, icon, appId, isWidget=false, widgetContent='', width='', height='', presetSize='') {
        const app = document.createElement('div');
        app.className = isWidget ? 'app-item is-widget' : 'app-item';
        if (appId) {
            app.setAttribute('data-app-id', appId);
        }
        
        if (isWidget) {
            const normalizedWidgetContent = normalizeStoredWidgetContent(widgetContent);
            app.setAttribute('data-widget-content', encodeURIComponent(normalizedWidgetContent));
            app.setAttribute('data-widget-width', width || '');
            app.setAttribute('data-widget-height', height || '');
            app.setAttribute('data-widget-preset-size', presetSize || '');
            const widgetSpan = getWidgetGridSpan({ width, height, presetSize });
            app.setAttribute('data-widget-columns', widgetSpan.columns);
            app.setAttribute('data-widget-rows', widgetSpan.rows);
            const dims2 = getWidgetDimensions({ width, height, presetSize });
            app.style.width = dims2.width + 'px';
            app.style.height = dims2.height + 'px';
            app.innerHTML = `<div class="app-delete-btn" onpointerdown="deleteDesktopApp(this, event)">-</div><div class="widget-edit-hotzone" aria-label="长按进入编辑模式"></div><div class="app-icon" style="background: transparent; box-shadow: none; border-radius: 20px; overflow: hidden; width: ${dims2.width}px; height: ${dims2.height}px; position: absolute; left: 0; top: 0; z-index: 10;">${makeDesktopWidgetFrameHTML(normalizedWidgetContent)}</div><div class="app-name" style="display:none;">组件</div>`;
        } else {
            app.innerHTML = `<div class="app-icon"></div><div class="app-name">${name}</div>`;
            const iconEl = app.querySelector('.app-icon');
            if (appId === TODAY_CALENDAR_APP_ID) {
                renderTodayCalendarIcon(iconEl);
            } else if (icon) {
                iconEl.style.backgroundImage = icon;
                iconEl.style.backgroundColor = 'transparent';
                iconEl.classList.add('has-custom-icon');
            }
        }
        return app;
    }

    function renderLayout(desktopData = [], dockData = [], pageIndex = 0, sourceRows) {
        const dock = document.getElementById('dock');
        const sourcePages = Array.isArray(desktopData) && Array.isArray(desktopData[0])
            ? desktopData
            : [Array.isArray(desktopData) ? desktopData : []];
        const normalizedSourceRows = normalizeDesktopRowCount(sourceRows, sourcePages);
        const sourceSlotCount = DESKTOP_COLUMNS * normalizedSourceRows;
        applyDesktopRowCount(calculateDesktopRowCount());
        dock.innerHTML = '';
        document.getElementById('desktopGrid').innerHTML = '';
        desktopPages = normalizeDesktopPages(sourcePages, normalizedSourceRows);
        const sourcePageIndex = Math.max(0, Number(pageIndex) || 0);
        const mappedPageIndex = Math.floor(sourcePageIndex * sourceSlotCount / DESKTOP_SLOT_COUNT);
        currentDesktopPage = Math.max(0, Math.min(mappedPageIndex, desktopPages.length - 1));

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

        desktopPages.forEach(page => page.forEach(checkAndHeal));
        dockData.forEach(checkAndHeal);

            // show three-dots button; click to expand vertical capsule menu
        if (!hasSettings && desktopPages[0].length > 0) {
            desktopPages[0][0].appId = 'settings';
        }
        if (!hasTheme && dockData.length > 0) {
            dockData[dockData.length - 1].appId = 'theme';
        }
        // ----------------------------------

        renderDesktopPage(desktopPages[currentDesktopPage]);

        dockData.forEach(appData => {
            dock.appendChild(createAppElement(appData.name, appData.icon, appData.appId));
        });
    }

    let desktopResizeTimer = null;

    function reflowDesktopForViewport() {
        if (isEditMode || dragGhost || draggedApp) return;
        const nextRows = calculateDesktopRowCount();
        if (nextRows === DESKTOP_ROWS) return;

        const sourceRows = DESKTOP_ROWS;
        const pages = getDesktopPagesSnapshot();
        const dockApps = serializeDockApps();
        const sourcePage = currentDesktopPage;
        applyDesktopRowCount(nextRows);
        renderLayout(pages, dockApps, sourcePage, sourceRows);
        if (typeof window.saveLayout === 'function') window.saveLayout();
    }

    function scheduleDesktopViewportReflow() {
        clearTimeout(desktopResizeTimer);
        desktopResizeTimer = setTimeout(reflowDesktopForViewport, 180);
    }

    window.addEventListener('resize', scheduleDesktopViewportReflow, { passive: true });
    window.addEventListener('orientationchange', scheduleDesktopViewportReflow, { passive: true });

            // show three-dots button; click to expand vertical capsule menu

            // show three-dots button; click to expand vertical capsule menu
    let isEditMode = false;
    const editPlus = document.getElementById('editPlus');
    const editDone = document.getElementById('editDone');
    const editPlusTouchTarget = document.getElementById('editPlusTouchTarget');
    const editDoneTouchTarget = document.getElementById('editDoneTouchTarget');
    const statusBar = document.getElementById('statusBar');
    const dockContainer = document.getElementById('dock');
    const desktopShell = document.querySelector('.iphone');


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
    window.applyStatusBarVisibility = applyStatusBarVisibility;

    function syncStatusBarAfterReturnHome() {
        requestAnimationFrame(applyStatusBarVisibility);
    }
    window.syncStatusBarAfterReturnHome = syncStatusBarAfterReturnHome;

    window.addEventListener('pageshow', syncStatusBarAfterReturnHome);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) syncStatusBarAfterReturnHome();
    });

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
    let dragOrigin = null;
    let dragEdgeTimer = null;
    let dragEdgeDirection = 0;
    let dragEdgeLocked = false;
    let dragGhostFrame = null;
    let dragGhostX = 0;
    let dragGhostY = 0;
    let dragGridRect = null;
    let desktopPointerSwipe = null;
    let desktopTouchSwipe = null;
    let desktopSwipeHandledUntil = 0;

    function getDesktopGridElement() {
        return document.getElementById('desktopGrid');
    }

    function canStartDesktopSwipeFromTarget(target) {
        if (!target || !target.closest('#desktopGrid')) return false;
        return !isEditMode || !target.closest('.app-item');
    }

    function getDesktopSwipeOffset(deltaX) {
        const isBlockedAtStart = currentDesktopPage <= 0 && deltaX > 0;
        const isBlockedAtEnd = currentDesktopPage >= desktopPages.length - 1 && deltaX < 0;
        return isBlockedAtStart || isBlockedAtEnd ? deltaX * 0.28 : deltaX;
    }

    function applyDesktopSwipeOffset(deltaX) {
        const desktopGrid = getDesktopGridElement();
        if (!desktopGrid) return;
        desktopGrid.classList.add('is-swiping');
        desktopGrid.style.setProperty('--desktop-swipe-offset', `${getDesktopSwipeOffset(deltaX)}px`);
    }

    function resetDesktopSwipeOffset() {
        const desktopGrid = getDesktopGridElement();
        if (!desktopGrid) return;
        desktopGrid.classList.remove('is-swiping');
        desktopGrid.style.removeProperty('--desktop-swipe-offset');
    }

    function updateDesktopSwipeGesture(swipe, clientX, clientY) {
        if (!swipe) return;
        const deltaX = clientX - swipe.clientX;
        const deltaY = clientY - swipe.clientY;
        if (!swipe.isTracking) {
            if (Math.abs(deltaX) <= 8 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.05) return;
            swipe.isTracking = true;
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        }
        applyDesktopSwipeOffset(deltaX);
    }

    function setDragGhostPosition(clientX, clientY) {
        dragGhostX = clientX - offsetX;
        dragGhostY = clientY - offsetY;
        if (dragGhostFrame) return;
        dragGhostFrame = requestAnimationFrame(() => {
            dragGhostFrame = null;
            if (!dragGhost) return;
            dragGhost.style.transform = `translate3d(${dragGhostX}px, ${dragGhostY}px, 0) scale(1.15)`;
        });
    }

    function cancelDragGhostFrame() {
        if (dragGhostFrame) cancelAnimationFrame(dragGhostFrame);
        dragGhostFrame = null;
    }

    function finishDesktopSwipe(deltaX, deltaY) {
        const isHorizontalSwipe = Math.abs(deltaX) >= 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
        resetDesktopSwipeOffset();
        if (!isHorizontalSwipe) return false;
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        if (Date.now() < desktopSwipeHandledUntil) return true;
        desktopSwipeHandledUntil = Date.now() + 120;
        switchDesktopPage(currentDesktopPage + (deltaX < 0 ? 1 : -1));
        return true;
    }

    function enterEditMode() {
        if (isEditMode) return;
        isEditMode = true;
        if (desktopShell) desktopShell.classList.add('desktop-editing');
        statusBar.style.opacity = '0';
        statusBar.style.visibility = 'hidden';
        editPlus.style.display = 'flex';
        editDone.style.display = 'block';

            // show three-dots button; click to expand vertical capsule menu
        document.querySelectorAll('.desktop-slot').forEach(slot => slot.classList.add('show-grid'));
        document.querySelectorAll('.app-item').forEach(app => app.classList.add('jiggling'));
        renderDesktopPageControls();
    }

            window.deleteDesktopApp = function(btn, e) {
            e.stopPropagation();
            e.preventDefault();
            const appItem = btn.closest('.app-item');
            if (appItem && appItem.classList.contains('is-widget')) {
                appItem.remove();
                rebuildDesktopWidgetOccupancy();
                if (typeof window.saveLayout === 'function') {
                    window.saveLayout();
                }
                renderDesktopPageControls();
            }
        };

    function exitEditMode() {
        isEditMode = false;
        if (desktopShell) desktopShell.classList.remove('desktop-editing');
        applyStatusBarVisibility();
        editPlus.style.display = 'none';
        editDone.style.display = 'none';
        
            // show three-dots button; click to expand vertical capsule menu
        document.querySelectorAll('.desktop-slot').forEach(slot => slot.classList.remove('show-grid'));
        document.querySelectorAll('.app-item').forEach(app => app.classList.remove('jiggling'));
        renderDesktopPageControls();
        
            // show three-dots button; click to expand vertical capsule menu
        saveLayout();
        scheduleDesktopViewportReflow();
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
                
                const preview = createWidgetPickerPreview(widget);
                
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

    function forwardEditTouchTarget(event, control) {
        event.preventDefault();
        event.stopPropagation();
        control.click();
    }

    let editPlusTouchHandledAt = 0;

    function handleEditPlusTouchTarget(event) {
        const now = Date.now();
        if (now - editPlusTouchHandledAt < 700) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        editPlusTouchHandledAt = now;
        forwardEditTouchTarget(event, editPlus);
    }

    editPlusTouchTarget.addEventListener('pointerup', handleEditPlusTouchTarget);
    editPlusTouchTarget.addEventListener('touchend', handleEditPlusTouchTarget, { passive: false });
    editPlusTouchTarget.addEventListener('click', handleEditPlusTouchTarget);
    editDoneTouchTarget.addEventListener('click', (event) => {
        forwardEditTouchTarget(event, editDone);
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
            const container = document.getElementById('contactsAppUI');
            if (!container) throw new Error('主页面中未找到联系人页面结构');

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
    window.loadContactsApp = loadContactsApp;

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

    function findDesktopWidgetFrame(sourceWindow) {
        const frames = document.querySelectorAll('#desktopGrid .app-item.is-widget .widget-render-frame');
        for (const frame of frames) {
            if (frame.contentWindow === sourceWindow) return frame;
        }
        return null;
    }

    function getDesktopWidgetPointerPosition(frame, message) {
        const rect = frame.getBoundingClientRect();
        const scaleX = frame.clientWidth ? rect.width / frame.clientWidth : 1;
        const scaleY = frame.clientHeight ? rect.height / frame.clientHeight : 1;
        return {
            x: rect.left + Number(message.clientX || 0) * scaleX,
            y: rect.top + Number(message.clientY || 0) * scaleY
        };
    }

    let pressedWidgetFrame = null;
    let pressedWidgetApp = null;

    window.addEventListener('message', async event => {
        const message = event.data;
        if (!message || (message.type !== 'widget-desktop-pointer' && message.type !== 'widget-desktop-swipe' && message.type !== 'widget-desktop-image-file' && message.type !== 'widget-desktop-content')) return;

        const frame = findDesktopWidgetFrame(event.source);
        if (!frame) return;
        const app = frame.closest('.app-item.is-widget');
        if (!app) return;

        if (message.type === 'widget-desktop-swipe') {
            handleDesktopWidgetSwipe(frame, message);
            return;
        }

        if (message.type === 'widget-desktop-pointer') {
            const position = getDesktopWidgetPointerPosition(frame, message);
            if (message.phase === 'down' && !isEditMode) {
                if (pressTimer) clearTimeout(pressTimer);
                startX = position.x;
                startY = position.y;
                pressedWidgetFrame = frame;
                pressedWidgetApp = app;
                pressTimer = setTimeout(() => {
                    pressTimer = null;
                    if (pressedWidgetFrame === frame && pressedWidgetApp === app) enterEditMode();
                }, 600);
            } else if (message.phase === 'move' && pressedWidgetFrame === frame) {
                if (pressTimer && (Math.abs(position.x - startX) > 10 || Math.abs(position.y - startY) > 10)) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            } else if ((message.phase === 'up' || message.phase === 'cancel') && pressedWidgetFrame === frame) {
                if (message.phase === 'up') {
                    finishDesktopSwipe(position.x - startX, position.y - startY);
                }
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                pressedWidgetFrame = null;
                pressedWidgetApp = null;
            }
            return;
        }

        if (message.type === 'widget-desktop-content') {
            if (typeof message.html !== 'string' || !message.target || typeof window.replaceWidgetEditableContent !== 'function') return;

            const currentContent = normalizeStoredWidgetContent(app.getAttribute('data-widget-content') || '');
            const updatedContent = window.replaceWidgetEditableContent(currentContent, message.target, message.html);
            if (updatedContent == null) return;

            app.setAttribute('data-widget-content', encodeURIComponent(updatedContent));
            if (message.phase === 'blur') saveLayout();
            return;
        }

        if (isEditMode || !(message.file instanceof Blob)) return;
        if (typeof window.prepareWidgetImageData !== 'function' || typeof window.replaceWidgetImageContent !== 'function') return;

        try {
            const imageData = await window.prepareWidgetImageData(message.file);
            const currentContent = normalizeStoredWidgetContent(app.getAttribute('data-widget-content') || '');
            const updatedContent = window.replaceWidgetImageContent(currentContent, message.target, imageData);
            if (updatedContent == null) {
                if (typeof window.showToast === 'function') window.showToast('未能定位这张图片');
                return;
            }

            app.setAttribute('data-widget-content', encodeURIComponent(updatedContent));
            frame.srcdoc = buildDesktopWidgetSrcdoc(updatedContent);
            saveLayout();
            if (typeof window.showToast === 'function') window.showToast('组件图片已替换');
        } catch (error) {
            console.error('Desktop widget image replacement failed:', error);
            if (typeof window.showToast === 'function') window.showToast('图片读取失败');
        }
    });

    function handleDesktopWidgetSwipe(frame, message) {
        if (isEditMode || !frame) return;
        const deltaX = Number(message.deltaX) || 0;
        const deltaY = Number(message.deltaY) || 0;
        if (!finishDesktopSwipe(deltaX, deltaY)) return;
        pressedWidgetFrame = null;
        pressedWidgetApp = null;
    }

    document.addEventListener('pointerdown', (e) => {
        const app = e.target.closest('.app-item');
        const desktopGrid = e.target.closest('#desktopGrid');

        desktopPointerSwipe = canStartDesktopSwipeFromTarget(e.target) ? {
            pointerId: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY,
            isTracking: false
        } : null;

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
            try {
                if (app.setPointerCapture) app.setPointerCapture(e.pointerId);
            } catch (error) {
            }
            const parent = app.parentNode;
            dragOrigin = {
                page: currentDesktopPage,
                inDock: parent && parent.id === 'dock',
                index: parent && parent.classList.contains('desktop-slot')
                    ? getCurrentDesktopSlots().indexOf(parent)
                    : Array.from(dockContainer.querySelectorAll('.app-item')).indexOf(app)
            };

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
            dragGhost.style.transition = 'none';
            dragGhost.style.backfaceVisibility = 'hidden';
            dragGhost.style.contain = 'layout paint style';
            dragGhost.classList.remove('jiggling');
            dragGhost.classList.add('desktop-drag-ghost');
            dragGhost.querySelectorAll('iframe').forEach(frame => {
                frame.style.pointerEvents = 'none';
            });
            document.body.appendChild(dragGhost);
            dragGridRect = desktopGrid ? desktopGrid.getBoundingClientRect() : null;

            app.style.opacity = '0';
        }
    });

    document.addEventListener('pointermove', (e) => {
        if (desktopPointerSwipe && desktopPointerSwipe.pointerId === e.pointerId && !dragGhost) {
            updateDesktopSwipeGesture(desktopPointerSwipe, e.clientX, e.clientY);
        }

        if (!isEditMode) {
            if (pressTimer && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        } else {
            if (!dragGhost) return;
            e.preventDefault();
            setDragGhostPosition(e.clientX, e.clientY);
            scheduleDragEdgeNavigation(e.clientX, e.clientY);
        }
    });

    function clearDragEdgeNavigation() {
        if (dragEdgeTimer) clearTimeout(dragEdgeTimer);
        dragEdgeTimer = null;
        dragEdgeDirection = 0;
    }

    function detachDraggedAppFromDesktopPage() {
        if (!draggedApp || !draggedApp.parentNode || !draggedApp.parentNode.classList.contains('desktop-slot')) return;
        draggedApp.remove();
        rebuildDesktopWidgetOccupancy();
        commitCurrentDesktopPage();
    }

    function scheduleDragEdgeNavigation(clientX, clientY) {
        const grid = document.getElementById('desktopGrid');
        const rect = dragGridRect || grid.getBoundingClientRect();
        const insideVerticalRange = clientY >= rect.top && clientY <= rect.bottom;
        const direction = insideVerticalRange && clientX <= rect.left + 34
            ? -1
            : insideVerticalRange && clientX >= rect.right - 34
                ? 1
                : 0;

        if (!direction) {
            clearDragEdgeNavigation();
            dragEdgeLocked = false;
            return;
        }
        if (dragEdgeLocked || (dragEdgeTimer && dragEdgeDirection === direction)) return;
        clearDragEdgeNavigation();
        dragEdgeDirection = direction;
        dragEdgeTimer = setTimeout(() => {
            dragEdgeTimer = null;
            detachDraggedAppFromDesktopPage();
            if (direction > 0 && currentDesktopPage === desktopPages.length - 1) {
                desktopPages.push([]);
            }
            const targetPage = currentDesktopPage + direction;
            if (targetPage >= 0 && targetPage < desktopPages.length) {
                switchDesktopPage(targetPage, { skipCommit: true, skipSave: true });
                requestAnimationFrame(() => {
                    const nextGrid = document.getElementById('desktopGrid');
                    dragGridRect = nextGrid ? nextGrid.getBoundingClientRect() : null;
                });
            }
            dragEdgeLocked = true;
        }, 520);
    }

    function restoreDraggedAppToOrigin() {
        if (!draggedApp || !dragOrigin) return;
        if (dragOrigin.inDock) {
            const dockItems = Array.from(dockContainer.children);
            dockContainer.insertBefore(draggedApp, dockItems[dragOrigin.index] || null);
            return;
        }
        if (currentDesktopPage !== dragOrigin.page) {
            commitCurrentDesktopPage();
            switchDesktopPage(dragOrigin.page, { skipCommit: true, skipSave: true });
        }
        const slots = getCurrentDesktopSlots();
        const originSlot = slots[dragOrigin.index];
        const fallbackSlot = slots.find(slot => !slot.querySelector(':scope > .app-item') && !slot.getAttribute('data-widget-occupied-by'));
        (originSlot && !originSlot.querySelector(':scope > .app-item') ? originSlot : fallbackSlot)?.appendChild(draggedApp);
        rebuildDesktopWidgetOccupancy();
    }

    document.addEventListener('pointerup', (e) => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }

        let didSwipePage = false;
        if (desktopPointerSwipe && desktopPointerSwipe.pointerId === e.pointerId) {
            didSwipePage = finishDesktopSwipe(
                e.clientX - desktopPointerSwipe.clientX,
                e.clientY - desktopPointerSwipe.clientY
            );
        }
        desktopPointerSwipe = null;

            // show three-dots button; click to expand vertical capsule menu
        if (!isEditMode && !dragGhost && !didSwipePage && Date.now() >= desktopSwipeHandledUntil) {
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
            clearDragEdgeNavigation();
            dragEdgeLocked = false;
            dragGridRect = null;
            cancelDragGhostFrame();
            dragGhost.remove();
            dragGhost = null;
            draggedApp.style.opacity = '1';

            const originalDisplay = draggedApp.style.display;
            draggedApp.style.display = 'none';
            const targetEl = document.elementFromPoint(e.clientX, e.clientY);
            draggedApp.style.display = originalDisplay;
            let dropSucceeded = false;

            if (targetEl) {
                const targetApp = targetEl.closest('.app-item');
                const targetSlot = targetEl.closest('.desktop-slot');
                const targetDock = targetEl.closest('.dock');

                const parent1 = draggedApp.parentNode;
                const crossedPage = !dragOrigin.inDock && currentDesktopPage !== dragOrigin.page;

                const draggedIsWidget = draggedApp.classList.contains('is-widget');
                if (draggedIsWidget) {
                    if (targetSlot) {
                        const slots = getCurrentDesktopSlots();
                        const targetIndex = slots.indexOf(targetSlot);
                        const columns = parseInt(draggedApp.getAttribute('data-widget-columns'), 10) || 1;
                        const rows = parseInt(draggedApp.getAttribute('data-widget-rows'), 10) || 1;
                        if (targetIndex > -1 && isDesktopAreaAvailable(targetIndex, columns, rows, draggedApp)) {
                            targetSlot.appendChild(draggedApp);
                            dropSucceeded = true;
                        }
                    }
                } else if (!crossedPage && parent1 && targetApp && targetApp !== draggedApp && !targetApp.classList.contains('is-widget')) {
                    const parent2 = targetApp.parentNode;
                    const targetOccupied = parent2.getAttribute('data-widget-occupied-by');
                    const sourceOccupied = parent1.getAttribute('data-widget-occupied-by');
                    if (!targetOccupied && !sourceOccupied) {
                        const sibling1 = draggedApp.nextSibling === targetApp ? draggedApp : draggedApp.nextSibling;
                        const sibling2 = targetApp.nextSibling === draggedApp ? targetApp : targetApp.nextSibling;
                        parent2.insertBefore(draggedApp, sibling2);
                        parent1.insertBefore(targetApp, sibling1);
                        dropSucceeded = true;
                    }
                } else if (targetSlot && !targetSlot.querySelector('.app-item') && !targetSlot.getAttribute('data-widget-occupied-by')) {
                    targetSlot.appendChild(draggedApp);
                    dropSucceeded = true;
                } else if (targetDock && (!parent1 || !parent1.classList.contains('dock'))) {
                    if (dockContainer.querySelectorAll('.app-item').length < 4) {
                        dockContainer.appendChild(draggedApp);
                        dropSucceeded = true;
                    }
                }
                rebuildDesktopWidgetOccupancy();
            }
            if (!dropSucceeded) restoreDraggedAppToOrigin();
            renderDesktopPageControls();
            if (typeof window.saveLayout === 'function') window.saveLayout();
            draggedApp = null;
            dragOrigin = null;
        }
    });

    document.addEventListener('pointercancel', () => {
        if (pressTimer) clearTimeout(pressTimer);
        desktopPointerSwipe = null;
        resetDesktopSwipeOffset();
        clearDragEdgeNavigation();
        dragEdgeLocked = false;
        dragGridRect = null;
        if (dragGhost) {
            cancelDragGhostFrame();
            dragGhost.remove();
            dragGhost = null;
            if (draggedApp) {
                draggedApp.style.opacity = '1';
                restoreDraggedAppToOrigin();
            }
            draggedApp = null;
            dragOrigin = null;
        }
    });

    document.addEventListener('touchstart', (event) => {
        if (event.touches.length !== 1 || !canStartDesktopSwipeFromTarget(event.target)) {
            desktopTouchSwipe = null;
            return;
        }
        const touch = event.touches[0];
        desktopTouchSwipe = {
            identifier: touch.identifier,
            clientX: touch.clientX,
            clientY: touch.clientY,
            isTracking: false
        };
    }, { passive: true });

    document.addEventListener('touchmove', (event) => {
        if (!desktopTouchSwipe) return;
        for (let index = 0; index < event.touches.length; index++) {
            const touch = event.touches[index];
            if (touch.identifier === desktopTouchSwipe.identifier) {
                updateDesktopSwipeGesture(desktopTouchSwipe, touch.clientX, touch.clientY);
                break;
            }
        }
    }, { passive: true });

    document.addEventListener('touchend', (event) => {
        if (!desktopTouchSwipe) return;
        let endTouch = null;
        for (let index = 0; index < event.changedTouches.length; index++) {
            if (event.changedTouches[index].identifier === desktopTouchSwipe.identifier) {
                endTouch = event.changedTouches[index];
                break;
            }
        }
        if (endTouch) {
            finishDesktopSwipe(
                endTouch.clientX - desktopTouchSwipe.clientX,
                endTouch.clientY - desktopTouchSwipe.clientY
            );
        }
        desktopTouchSwipe = null;
    }, { passive: true });

    document.addEventListener('touchcancel', () => {
        desktopTouchSwipe = null;
        resetDesktopSwipeOffset();
    }, { passive: true });

            // show three-dots button; click to expand vertical capsule menu
