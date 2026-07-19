        function formatWidgetSizeLabel(widget) {
            if (widget.width && widget.height) {
                return widget.width + '×' + widget.height;
            }
            if (widget.presetSize) {
                return widget.presetSize;
            }
            return '1×1';
        }
        window.formatWidgetSizeLabel = formatWidgetSizeLabel;

        function handleWidgetPresetChange(radio) {
            if (radio.checked) {
                document.getElementById('widgetCustomSizeLabel').innerText = '自定义大小';
                document.getElementById('widgetCustomSizeLabel').style.color = '#8e8e93';
                updateWidgetCodePreview();
            }
        }
        window.handleWidgetPresetChange = handleWidgetPresetChange;

        function openCustomSizePicker() {
            document.getElementById('customSizePicker').classList.add('show');
            const overlay = document.getElementById('widgetOverlay');
            overlay.style.display = 'block';
            overlay.style.zIndex = '350';
            const radios = document.querySelectorAll('input[name="widgetPresetSize"]');
            radios.forEach(r => { r.checked = false; });
        }
        window.openCustomSizePicker = openCustomSizePicker;

        function closeCustomSizePicker() {
            document.getElementById('customSizePicker').classList.remove('show');
            const editor = document.getElementById('widgetEditorModal');
            if (editor && editor.classList.contains('show')) {
                document.getElementById('widgetOverlay').style.zIndex = '250';
            } else {
                document.getElementById('widgetOverlay').style.display = 'none';
            }
        }
        window.closeCustomSizePicker = closeCustomSizePicker;

        function stepCustomSize(type, delta) {
            const el = document.getElementById(type === 'w' ? 'customW' : 'customH');
            let val = parseInt(el.innerText, 10) + delta;
            
            // ??????????????????????
            let maxCols = 4;
            let maxRows = 7;
            const grid = document.getElementById('desktopGrid');
            if (grid) {
                // ?? desktopGrid ????????? (????80+15px = 95px)
                const gridH = grid.clientHeight;
                if (gridH > 100) {
                    maxRows = Math.floor(gridH / 95) || 7;
                }
            }
            if (type === 'w' && val > maxCols) val = maxCols;
            if (type === 'w' && val < 1) val = 1;
            if (type === 'h' && val > maxRows) val = maxRows;
            if (type === 'h' && val < 1) val = 1;
            el.innerText = val;
        }
        window.stepCustomSize = stepCustomSize;

        function confirmCustomSize() {
            const w = document.getElementById('customW').innerText;
            const h = document.getElementById('customH').innerText;
            const label = document.getElementById('widgetCustomSizeLabel');
            label.innerText = w + ' × ' + h;
            label.style.color = '#000';
            updateWidgetCodePreview();
            closeCustomSizePicker();
        }
        window.confirmCustomSize = confirmCustomSize;

        function handleWidgetCustomSizeChange() {
            const radios = document.querySelectorAll('input[name="widgetPresetSize"]');
            radios.forEach(r => { r.checked = false; });
        }
        window.handleWidgetCustomSizeChange = handleWidgetCustomSizeChange;

            // show three-dots button; click to expand vertical capsule menu
    (function () {
        const widgetTrack = document.getElementById('widgetTrack');
        const widgetPagination = document.getElementById('widgetPagination');
        const widgetListContainer = document.getElementById('widgetList');
        const widgetEmptyState = document.getElementById('widgetEmptyState');
        const widgetContentArea = document.getElementById('widgetContentArea');
        const widgetSegmentBtns = document.querySelectorAll('#widgetAppGrid .widget-segment-btn');
        const widgetIndicator = document.getElementById('widgetSegmentIndicator');
        const widgetAppGrid = document.getElementById('widgetAppGrid');
        const themeAppUI = document.getElementById('themeAppUI');

        const officialWidgets = window.officialWidgets || [];
        const customWidgets = window.customWidgets || [];
        window.officialWidgets = officialWidgets;
        window.customWidgets = customWidgets;
        let currentWidgets = officialWidgets;

        let widgetViewMode = 'carousel';     // 'carousel' | 'list'
        let isWidgetEditing = false;
        let currentProgress = 0, targetProgress = 0;
        let isDragging = false, startX = 0, startProgress = 0;
        let activeWidgetIndex = -1;

            // show three-dots button; click to expand vertical capsule menu
        window.renderWidgetViews = renderWidgetViews;

        function hideWidgetChrome() {
            const wg = document.getElementById('widgetAppGrid'); if (wg) wg.style.display = 'none';
            const vb = document.getElementById('widgetViewBtn'); if (vb) vb.style.display = 'none';
            const wgc = document.getElementById('widgetToolbarMenu'); if (wgc) wgc.style.display = 'none';
            const dots = document.getElementById('menuIconDots'); if (dots) dots.style.display = 'none';
            const list = document.getElementById('menuIconList'); if (list) list.style.display = 'block';
            exitWidgetEditMode(true);
        }
        window.hideWidgetChrome = hideWidgetChrome;

        function closeWidgetMenus() {
            const dd = document.getElementById('themeDropdownMenu'); if (dd) dd.classList.remove('show');
            const tbm = document.getElementById('widgetToolbarMenu'); if (tbm) tbm.classList.remove('show');
            const cm = document.getElementById('widgetContextMenu'); if (cm) cm.classList.remove('show');
            const dots = document.getElementById('menuIconDots'); if (dots) dots.style.display = 'block';
            const chev = document.getElementById('menuIconChevron'); if (chev) chev.style.display = 'none';
            const overlay = document.getElementById('widgetOverlay');
            const editor = document.getElementById('widgetEditorModal');
            if (editor && editor.classList.contains('show')) {
                if (overlay) overlay.style.zIndex = '250';
            } else if (overlay) {
                overlay.style.display = 'none';
                overlay.style.zIndex = '105';
            }
        }
        window.closeWidgetMenus = closeWidgetMenus;

            // show three-dots button; click to expand vertical capsule menu
        const originalToggleThemeMenu = window.toggleThemeMenu;
        window.toggleThemeMenu = function () {
            if (currentActiveTab === "widget") {
                const m = document.getElementById("widgetToolbarMenu");
                const ov = document.getElementById("widgetOverlay");
                if (!m.classList.contains("show")) {
                    m.classList.add("show");
                    if (ov) { ov.style.display = "block"; ov.style.zIndex = "240"; }
                    const d = document.getElementById("menuIconDots"); if (d) d.style.display = "none";
                    const c = document.getElementById("menuIconChevron"); if (c) c.style.display = "block";
                } else {
                    closeWidgetMenus();
                }
                return;
            } else if (typeof originalToggleThemeMenu === "function") { originalToggleThemeMenu(); }
        };

        function openWidgetContextMenu(index, event) {
            event.stopPropagation(); activeWidgetIndex = index;
            const menu = document.getElementById('widgetContextMenu');
            const overlay = document.getElementById('widgetOverlay');
            const rect = event.currentTarget.getBoundingClientRect();
            const hostRect = (themeAppUI || document.body).getBoundingClientRect();
            let top = rect.bottom - hostRect.top + 10;
            let left = rect.right - hostRect.left - 140;
            if (top + 200 > hostRect.height) top = rect.top - hostRect.top - 190;
            if (left < 16) left = 16;
            menu.style.top = top + 'px'; menu.style.left = left + 'px';
            menu.classList.add('show');
            overlay.style.display = 'block'; overlay.style.zIndex = '350';
        }
        window.openWidgetContextMenu = openWidgetContextMenu;

        function widgetCtxAction(action) {
            closeWidgetMenus();
            if (activeWidgetIndex === -1) return;

            if (action === 'edit') { openWidgetEditor(activeWidgetIndex); }
            else if (action === 'addToDesktop') {
                const widget = currentWidgets[activeWidgetIndex];
                const added = addDesktopWidget(widget);
                if (added && typeof window.showToast === 'function') window.showToast('已添加到桌面');
            }
            else if (action === 'export') {
                const widget = currentWidgets[activeWidgetIndex];
                const fileName = (widget.name || 'widget') + '.json';
                const dataStr = JSON.stringify(widget, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                if (typeof showToast === 'function') showToast("导出成功");
            }
        }
        window.widgetCtxAction = widgetCtxAction;

        function toggleWidgetViewMode(forceMode) {
            widgetViewMode = forceMode ? forceMode : (widgetViewMode === 'carousel' ? 'list' : 'carousel');
            const iL = document.getElementById('widgetIconList');
            const iC = document.getElementById('widgetIconCard');
            if (iL) iL.style.display = widgetViewMode === 'carousel' ? 'block' : 'none';
            if (iC) iC.style.display = widgetViewMode === 'list' ? 'block' : 'none';
            if (widgetViewMode === 'list') widgetContentArea.classList.add('show-list');
            else { widgetContentArea.classList.remove('show-list'); updateWidgetCardsContinuous(); }
        }
        window.toggleWidgetViewMode = toggleWidgetViewMode;

        function enterWidgetEditMode() {
            closeWidgetMenus(); isWidgetEditing = true;
            if (themeAppUI) themeAppUI.classList.add('is-widget-editing');
            toggleWidgetViewMode('list');
            document.getElementById('topBarTitle').innerText = '管理组件';
            const wgc1 = document.getElementById('widgetToolbarMenu'); if (wgc1) { wgc1.style.display = 'none'; wgc1.classList.remove('show'); }
            const doneBtn = document.getElementById('widgetDoneBtn'); if (doneBtn) doneBtn.style.display = 'block';
            const viewBtn = document.getElementById('widgetViewBtn'); if (viewBtn) viewBtn.style.display = 'none';
            const menuBtn = document.getElementById('themeMenuBtn'); if (menuBtn) menuBtn.style.display = 'none';
        }
        window.enterWidgetEditMode = enterWidgetEditMode;

        function exitWidgetEditMode(silent) {
            isWidgetEditing = false;
            if (themeAppUI) themeAppUI.classList.remove('is-widget-editing');
            if (!silent && currentActiveTab === 'widget') {
                document.getElementById('topBarTitle').innerText = 'Widgets';
                const wgc2 = document.getElementById('widgetToolbarMenu'); if (wgc2) { wgc2.style.display = 'flex'; wgc2.classList.remove('show'); }
                const doneBtn = document.getElementById('widgetDoneBtn'); if (doneBtn) doneBtn.style.display = 'none';
                const viewBtn = document.getElementById('widgetViewBtn'); if (viewBtn) viewBtn.style.display = 'flex';
                const menuBtn = document.getElementById('themeMenuBtn'); if (menuBtn) menuBtn.style.display = 'flex';
            }
        }
        window.exitWidgetEditMode = exitWidgetEditMode;

        function deleteWidget(index, event) {
            event.stopPropagation();
            if (confirm('确定要删除 "' + currentWidgets[index].name + '" 吗？')) {
                currentWidgets.splice(index, 1);
                if (activeWidgetIndex >= currentWidgets.length) activeWidgetIndex = currentWidgets.length - 1;
                renderWidgetViews();
            }
        }
        window.deleteWidget = deleteWidget;


        // import widgets from a .json file (single object or array). Fields: name, preview, content.
        function handleWidgetJsonImport(event) {
            closeWidgetMenus();
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    let parsed = JSON.parse(ev.target.result);
                    if (!Array.isArray(parsed)) parsed = [parsed];
                    let added = 0;
                    parsed.forEach(function (w) {
                        if (!w || typeof w !== 'object') return;
                        customWidgets.push({
                            name: w.name || ('widget ' + (customWidgets.length + 1)),
                            preview: w.preview || 'linear-gradient(135deg,#a1c4fd 0%,#c2e9fb 100%)',
                            content: w.content || w.html || '',
                            width: w.width || '',
                            height: w.height || '',
                            presetSize: w.presetSize || ''
                        });
                        added++;
                    });
                    // switch to custom tab so the user sees imports immediately
                    if (typeof switchWidgetTab === 'function') switchWidgetTab(1);
                    else { currentWidgets = customWidgets; renderWidgetViews(); }
                    alert('imported ' + added + ' widget(s)');
                } catch (err) { alert('JSON parse failed: ' + err.message); }
            };
            reader.readAsText(file);
            event.target.value = '';
        }
        window.handleWidgetJsonImport = handleWidgetJsonImport;

        // export all widgets (official + custom) as a .json download
        function exportWidgetJson() {
            closeWidgetMenus();
            const all = officialWidgets.concat(customWidgets).map(function (w) {
                return { name: w.name || '', preview: w.preview || '', content: w.content || '', width: w.width || '', height: w.height || '', presetSize: w.presetSize || '' };
            });
            const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'widgets.json';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        window.exportWidgetJson = exportWidgetJson;

        function updateWidgetCodePreview() {
            const preview = document.getElementById('widgetCodePreview');
            const stage = document.getElementById('widgetCodePreviewStage');
            const frame = document.getElementById('widgetCodePreviewFrame');
            const sizeLabel = document.getElementById('widgetCodePreviewSize');
            const editor = document.getElementById('widgetEditContent');
            if (!preview || !stage || !frame || !sizeLabel || !editor) return;

            const checkedPreset = document.querySelector('input[name="widgetPresetSize"]:checked');
            let cols = 1;
            let rows = 1;
            if (checkedPreset) {
                const parts = checkedPreset.value.split('x').map(Number);
                cols = parts[0] || 1;
                rows = parts[1] || 1;
            } else if (document.getElementById('widgetCustomSizeLabel').innerText !== '自定义大小') {
                cols = parseInt(document.getElementById('customW').innerText, 10) || 1;
                rows = parseInt(document.getElementById('customH').innerText, 10) || 1;
            }

            const width = cols * 140;
            const height = rows * 140;
            preview.style.display = 'block';
            const availableWidth = stage.clientWidth || 280;
            const scale = Math.min(1, availableWidth / width);
            stage.style.height = Math.round(height * scale) + 'px';
            frame.style.width = width + 'px';
            frame.style.height = height + 'px';
            frame.style.transform = 'scale(' + scale + ')';
            frame.srcdoc = editor.value;
            sizeLabel.innerText = cols + ' × ' + rows;
        }
        window.updateWidgetCodePreview = updateWidgetCodePreview;

        function openWidgetEditor(index) {
            activeWidgetIndex = index; const widget = currentWidgets[index];
            document.getElementById('widgetEditName').value = widget.name;
            document.getElementById('widgetEditContent').value = widget.content || '';
            if (widget.width && widget.height) {
                const cw = Math.round(widget.width / 140) || 1;
                const ch = Math.round(widget.height / 140) || 1;
                document.getElementById('customW').innerText = cw;
                document.getElementById('customH').innerText = ch;
                document.getElementById('widgetCustomSizeLabel').innerText = cw + ' × ' + ch;
                document.getElementById('widgetCustomSizeLabel').style.color = '#000';
            } else {
                document.getElementById('customW').innerText = '1';
                document.getElementById('customH').innerText = '1';
                document.getElementById('widgetCustomSizeLabel').innerText = '自定义大小';
                document.getElementById('widgetCustomSizeLabel').style.color = '#8e8e93';
            }
            const radios = document.querySelectorAll('input[name="widgetPresetSize"]');
            radios.forEach(r => { r.checked = (widget.presetSize && r.value === widget.presetSize); });
            document.getElementById('widgetEditorModal').classList.add('show');
            const overlay = document.getElementById('widgetOverlay');
            overlay.style.display = 'block'; overlay.style.zIndex = '250';
            requestAnimationFrame(updateWidgetCodePreview);
        }
        window.openWidgetEditor = openWidgetEditor;

        function closeWidgetEditor() {
            document.getElementById('widgetEditorModal').classList.remove('show');
            const overlay = document.getElementById('widgetOverlay');
            overlay.style.display = 'none'; overlay.style.zIndex = '105';
            const preview = document.getElementById('widgetCodePreview');
            const frame = document.getElementById('widgetCodePreviewFrame');
            if (preview) preview.style.display = 'none';
            if (frame) frame.srcdoc = '';
            activeWidgetIndex = -1;
        }
        window.closeWidgetEditor = closeWidgetEditor;

        (function() {
            const topBar = document.querySelector('#widgetEditorModal .ios-top-bar');
            const modal = document.getElementById('widgetEditorModal');
            let startY = 0;
            let currentY = 0;
            if (topBar && modal) {
                topBar.addEventListener('touchstart', (e) => {
                    startY = e.touches[0].clientY;
                    modal.style.transition = 'none';
                }, { passive: true });
                topBar.addEventListener('touchmove', (e) => {
                    currentY = e.touches[0].clientY;
                    const delta = currentY - startY;
                    if (delta > 0) {
                        modal.style.transform = `translateY(${delta}px)`;
                    }
                }, { passive: true });
                topBar.addEventListener('touchend', () => {
                    const delta = currentY - startY;
                    modal.style.transition = '';
                    modal.style.transform = '';
                    if (delta > 80) {
                        closeWidgetEditor();
                    }
                });
            }
        })();

        function saveWidgetEditor() {
            if (activeWidgetIndex > -1) {
                const widget = currentWidgets[activeWidgetIndex];
                widget.name = document.getElementById('widgetEditName').value.trim() || '未命名组件';
                widget.content = document.getElementById('widgetEditContent').value;
                const lbl = document.getElementById('widgetCustomSizeLabel').innerText;
                const widthVal = lbl !== '自定义大小' ? parseInt(document.getElementById('customW').innerText, 10) * 140 : null;
                const heightVal = lbl !== '自定义大小' ? parseInt(document.getElementById('customH').innerText, 10) * 140 : null;
                const checkedPreset = document.querySelector('input[name="widgetPresetSize"]:checked');
                if (widthVal && heightVal) {
                    widget.width = widthVal;
                    widget.height = heightVal;
                    widget.presetSize = '';
                } else if (checkedPreset) {
                    widget.width = '';
                    widget.height = '';
                    widget.presetSize = checkedPreset.value;
                } else {
                    widget.width = '';
                    widget.height = '';
                    widget.presetSize = '';
                }
                renderWidgetViews();
            }
            closeWidgetEditor();
        }
        window.saveWidgetEditor = saveWidgetEditor;

        function switchWidgetTab(index) {
            if (isWidgetEditing) return;
            widgetSegmentBtns.forEach((btn, i) => btn.classList.toggle('active', i === index));
            if (widgetIndicator) widgetIndicator.style.transform = 'translateX(' + (index * 100) + '%)';
            currentWidgets = index === 0 ? officialWidgets : customWidgets;
            currentProgress = 0; targetProgress = 0;
            renderWidgetViews();
        }
        window.switchWidgetTab = switchWidgetTab;

        function handleAddWidget() {
            closeWidgetMenus();
            currentWidgets.push({
                name: '自定义组件 ' + (currentWidgets.length + 1),
                content: '',
                width: '',
                height: '',
                presetSize: ''
            });
            targetProgress = currentWidgets.length - 1;
            renderWidgetViews();
            openWidgetEditor(targetProgress);
        }
        window.handleAddWidget = handleAddWidget;

        function renderWidgetViews() {
            widgetTrack.innerHTML = ''; widgetPagination.innerHTML = ''; widgetListContainer.innerHTML = '';
            if (currentWidgets.length === 0) {
                widgetEmptyState.style.display = 'block';
                widgetContentArea.style.display = 'none';
                return;
            }
            widgetEmptyState.style.display = 'none';
            widgetContentArea.style.display = 'flex';

            currentWidgets.forEach((widget, i) => {
                const card = document.createElement('div'); card.className = 'widget-card';
                card.innerHTML = '<div class="widget-card-more-btn" onclick="openWidgetContextMenu(' + i + ', event)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg></div><div class="widget-card-preview">' + (widget.content || '') + '</div><div class="widget-card-name">' + widget.name + '</div><div class="widget-card-size">' + formatWidgetSizeLabel(widget) + '</div>';
                widgetTrack.appendChild(card);

                const dot = document.createElement('div'); dot.className = 'widget-dot'; widgetPagination.appendChild(dot);

                const listItem = document.createElement('div'); listItem.className = 'widget-list-item';
                listItem.onclick = function () {
                    if (isWidgetEditing) openWidgetEditor(i);
                    else { targetProgress = i; currentProgress = i; toggleWidgetViewMode('carousel'); }
                };
                listItem.innerHTML = '<div class="widget-delete-btn-left" onclick="deleteWidget(' + i + ', event)"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg></div><div class="widget-list-item-icon"></div><div class="widget-list-item-info"><div class="widget-title-wrapper"><div class="widget-list-item-title">' + widget.name + '</div><svg class="widget-edit-pencil" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></div><div class="widget-list-item-sub">Widget</div></div><div class="widget-list-action-trigger" onclick="openWidgetContextMenu(' + i + ', event)"><svg width="20" height="20" viewBox="0 0 24 24" fill="#c7c7cc" stroke="none"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg></div>';
                const listPreviewHost = listItem.querySelector('.widget-list-item-icon');
                const listPreviewFrame = document.createElement('iframe');
                const listPreviewDims = getWidgetDimensions(widget);
                const listPreviewScale = Math.min(48 / listPreviewDims.width, 48 / listPreviewDims.height);
                listPreviewFrame.className = 'widget-list-preview-frame';
                listPreviewFrame.setAttribute('sandbox', 'allow-scripts');
                listPreviewFrame.setAttribute('title', (widget.name || '组件') + '预览');
                listPreviewFrame.style.width = listPreviewDims.width + 'px';
                listPreviewFrame.style.height = listPreviewDims.height + 'px';
                listPreviewFrame.style.left = (48 - listPreviewDims.width * listPreviewScale) / 2 + 'px';
                listPreviewFrame.style.top = (48 - listPreviewDims.height * listPreviewScale) / 2 + 'px';
                listPreviewFrame.style.transform = 'scale(' + listPreviewScale + ')';
                listPreviewFrame.srcdoc = widget.content || '';
                listPreviewHost.appendChild(listPreviewFrame);
                widgetListContainer.appendChild(listItem);
            });
            updateWidgetCardsContinuous();
        }


        function updateWidgetCardsContinuous() {
            if (currentWidgets.length === 0 || widgetViewMode === 'list') return;
            const cards = document.querySelectorAll('#widgetAppGrid .widget-card');
            const dots = document.querySelectorAll('#widgetPagination .widget-dot');
            cards.forEach((card, i) => {
                const rel = i - currentProgress; const absRel = Math.abs(rel);
                const translateX = rel * 110; const rotateY = -rel * 45; const translateZ = -absRel * 100;
                const scale = Math.max(0.8, 1 - absRel * 0.1); const opacity = Math.max(0, 1 - absRel * 0.6);
                card.style.transform = 'translateX(' + translateX + '%) translateZ(' + translateZ + 'px) rotateY(' + rotateY + 'deg) scale(' + scale + ')';
                card.style.opacity = opacity; card.style.zIndex = 100 - Math.round(absRel * 100);
            });
            dots.forEach((dot, i) => {
                dot.style.opacity = Math.max(0.3, 1 - Math.abs(i - currentProgress));
                dot.classList.toggle('active', Math.round(currentProgress) === i);
            });
        }

            // show three-dots button; click to expand vertical capsule menu
        const wCarouselArea = document.getElementById('widgetCarousel');
        if (wCarouselArea) {
            wCarouselArea.addEventListener('touchstart', function (e) {
                if (currentWidgets.length <= 1 || widgetViewMode === 'list') return;
                isDragging = true; startX = e.touches[0].clientX; startProgress = currentProgress;
            }, { passive: true });
            wCarouselArea.addEventListener('touchmove', function (e) {
                if (!isDragging || widgetViewMode === 'list') return;
                e.preventDefault();
                let newProgress = startProgress - ((e.touches[0].clientX - startX) / window.innerWidth) * 1.8;
                if (newProgress < 0) newProgress *= 0.3;
                else if (newProgress > currentWidgets.length - 1) newProgress = (currentWidgets.length - 1) + (newProgress - (currentWidgets.length - 1)) * 0.3;
                currentProgress = newProgress; updateWidgetCardsContinuous();
            }, { passive: false });
            wCarouselArea.addEventListener('touchend', function () {
                if (!isDragging || widgetViewMode === 'list') return;
                isDragging = false; targetProgress = Math.round(currentProgress);
                if (targetProgress < 0) targetProgress = 0;
                if (targetProgress > currentWidgets.length - 1) targetProgress = currentWidgets.length - 1;
            });
        }

            // show three-dots button; click to expand vertical capsule menu
        function animateWidget() {
            if (!isDragging && widgetViewMode === 'carousel') {
                currentProgress += (targetProgress - currentProgress) * 0.15;
                if (Math.abs(targetProgress - currentProgress) < 0.001) currentProgress = targetProgress;
                updateWidgetCardsContinuous();
            }
            requestAnimationFrame(animateWidget);
        }
        animateWidget();
    })();
            // show three-dots button; click to expand vertical capsule menu
