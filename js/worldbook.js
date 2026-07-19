    function openWorldbookApp() {

        const worldbookUI = document.getElementById('worldbookAppUI');
        if (worldbookUI) {
            worldbookUI.style.display = 'flex';
            setTimeout(() => {
                worldbookUI.classList.add('show');
            }, 10);
        } else {
            showCustomAlert('提示', '世界书模块尚未加载');
        }
    }

    function closeWorldbookApp() {
        const worldbookUI = document.getElementById('worldbookAppUI');
        if (worldbookUI) {
            worldbookUI.classList.remove('show');
            setTimeout(() => {
                worldbookUI.style.display = 'none';
            }, 300);
        }
    }

            // show three-dots button; click to expand vertical capsule menu
    // --- 世界书 APP 逻辑 (数据驱动版) ---


    let wbCurrentGroupId = null;
    let wbCurrentEntryId = null;
    let wbIsGridView = false;
    let wbIsEditMode = false;

    function wbCleanUpDeletedEntries() {
        const now = Date.now();
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        let changed = false;
        wbEntries = wbEntries.filter(e => {
            if (e.isDeleted && e.deleteTime) {
                if (now - e.deleteTime > THREE_DAYS_MS) {
                    changed = true;
                    return false; // 超过3天，彻底删除
                }
            }
            return true;
        });
        if (changed) {
            saveWorldbookData();
        }
    }

    function openWorldbookApp() {
        wbCleanUpDeletedEntries(); // 打开时自动清理过期条目
        const worldbookUI = document.getElementById('worldbookAppUI');
        worldbookUI.style.display = 'flex';
        wbRenderAll();
        setTimeout(() => { worldbookUI.classList.add('show'); }, 10);
    }

    function closeWorldbookApp() {
        const worldbookUI = document.getElementById('worldbookAppUI');
        worldbookUI.classList.remove('show');
        setTimeout(() => { worldbookUI.style.display = 'none'; }, 300);
    }

    function wbRenderAll() {
        wbRenderGroups();
        if (wbCurrentGroupId) wbRenderEntries(wbCurrentGroupId);
        wbRenderGlobalEntries();
        wbRenderDeletedEntries();
        wbRenderGroupSelectSheet();
    }

    function wbRenderGroups() {
        const list = document.getElementById('wbGroupList');
        if (!list) return;
        
        // 保留 SVG defs
        const defs = `<svg style="display:none;"><defs><g id="wb-folder-icon"><path d="M3 19V6a2 2 0 0 1 2-2h4.5c.4 0 .8.2 1 .5l1 1.5c.2.3.6.5 1 .5H21a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></g><g id="wb-delete-icon"><circle cx="12" cy="12" r="10"/><rect x="7" y="11" width="10" height="2" fill="#fff"/></g></defs></svg>`;
        
        if (wbGroups.length === 0) {
            list.innerHTML = defs + `<div class="wb-empty-state" style="display:block;">请先添加世界书</div>`;
            list.style.background = 'transparent';
            list.style.boxShadow = 'none';
            return;
        }

        list.style.background = '';
        list.style.boxShadow = '';
        
        // 排序：置顶的在前
        const sortedGroups = [...wbGroups].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
        
        let html = defs;
        sortedGroups.forEach(g => {
            const count = wbEntries.filter(e => e.groupId === g.id && !e.isDeleted).length;
            html += `
                <div class="wb-list-item" onpointerdown="wbHandlePointerDown(event, 'group', '${g.id}', this)" onpointermove="wbHandlePointerMove()" onpointerup="wbHandlePointerUp(event, 'group', '${g.id}', this)" onpointercancel="wbHandlePointerMove()">
                    <div class="wb-delete-btn" onclick="wbDeleteGroup(event, '${g.id}')"><svg><use href="#wb-delete-icon"/></svg></div>
                    <div class="wb-item-icon"><svg><use href="#wb-folder-icon"/></svg></div>
                    <div class="wb-item-content">
                        <div class="wb-item-title">${g.name} ${g.isPinned ? '📌' : ''}</div>
                        <div class="wb-item-right"><span class="wb-item-count">${count}</span><svg class="wb-chevron" viewBox="0 0 8 13"><path d="M1.5 1.5L6.5 6.5L1.5 11.5"/></svg></div>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;
    }

    function wbRenderEntries(groupId) {
        const group = wbGroups.find(g => g.id === groupId);
        if (group) document.getElementById('wbGroupTitle').innerText = group.name;

        const listContainer = document.getElementById('wbGroupEntriesList');
        const gridContainer = document.getElementById('wbGridView');
        if (!listContainer || !gridContainer) return;

        const entries = wbEntries.filter(e => e.groupId === groupId && !e.isDeleted)
                                 .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.updateTime - a.updateTime);

        if (entries.length === 0) {
            listContainer.innerHTML = `<div class="wb-empty-state" style="display:block;">此分组暂无条目</div>`;
            listContainer.style.background = 'transparent';
            listContainer.style.boxShadow = 'none';
            gridContainer.innerHTML = '';
            return;
        }

        listContainer.style.background = '';
        listContainer.style.boxShadow = '';

        let listHtml = '';
        let gridHtml = '';

        entries.forEach(e => {
            const sizeKB = (e.content.length / 1024).toFixed(1);
            const titleDisplay = e.title + (e.isPinned ? ' 📌' : '');
            
            // List View
            listHtml += `
                <div class="wb-doc-list-item" onpointerdown="wbHandlePointerDown(event, 'entry', '${e.id}', this)" onpointermove="wbHandlePointerMove()" onpointerup="wbHandlePointerUp(event, 'entry', '${e.id}', this)" onpointercancel="wbHandlePointerMove()">
                    <div class="wb-doc-thumbnail"><div class="wb-doc-line"></div><div class="wb-doc-line medium"></div><div class="wb-doc-line"></div><div class="wb-doc-line short"></div></div>
                    <div class="wb-doc-info">
                        <div class="wb-doc-title">${titleDisplay}</div>
                        <div class="wb-doc-sub">${sizeKB} KB</div>
                    </div>
                </div>
            `;
            
            // Grid View
            gridHtml += `
                <div class="wb-grid-item" onpointerdown="wbHandlePointerDown(event, 'entry', '${e.id}', this)" onpointermove="wbHandlePointerMove()" onpointerup="wbHandlePointerUp(event, 'entry', '${e.id}', this)" onpointercancel="wbHandlePointerMove()">
                    <div class="wb-grid-preview-box"><div class="wb-mock-text-line"></div><div class="wb-mock-text-line medium"></div><div class="wb-mock-text-line"></div><div class="wb-mock-text-line short"></div><div class="wb-mock-text-line"></div></div>
                    <div class="wb-grid-title">${titleDisplay}</div>
                </div>
            `;
        });

        listContainer.innerHTML = listHtml;
        gridContainer.innerHTML = gridHtml;
    }

    function wbRenderGlobalEntries() {
        const container = document.getElementById('wbGlobalEntriesList');
        if (!container) return;
        const globals = wbEntries.filter(e => e.isGlobal && !e.isDeleted);
        
        if (globals.length === 0) {
            container.innerHTML = `<div class="wb-empty-state" style="display:block;">暂无全局激活的条目</div>`;
            container.style.background = 'transparent';
            container.style.boxShadow = 'none';
            return;
        }
        
        container.style.background = '';
        container.style.boxShadow = '';
        let html = '';
        globals.forEach(e => {
            const sizeKB = (e.content.length / 1024).toFixed(1);
            html += `
                <div class="wb-doc-list-item" onpointerdown="wbHandlePointerDown(event, 'entry', '${e.id}', this)" onpointermove="wbHandlePointerMove()" onpointerup="wbHandlePointerUp(event, 'entry', '${e.id}', this)" onpointercancel="wbHandlePointerMove()">
                    <div class="wb-doc-thumbnail"><div class="wb-doc-line"></div><div class="wb-doc-line medium"></div><div class="wb-doc-line"></div><div class="wb-doc-line short"></div></div>
                    <div class="wb-doc-info">
                        <div class="wb-doc-title">${e.title}</div>
                        <div class="wb-doc-sub">${sizeKB} KB</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function wbRenderDeletedEntries() {
        const container = document.getElementById('wbDeletedEntriesList');
        if (!container) return;
        const deleted = wbEntries.filter(e => e.isDeleted);
        
        if (deleted.length === 0) {
            container.innerHTML = `<div class="wb-empty-state" style="display:block;">暂无最近删除的条目</div>`;
            container.style.background = 'transparent';
            container.style.boxShadow = 'none';
            return;
        }
        
        container.style.background = '';
        container.style.boxShadow = '';
        let html = '';
        deleted.forEach(e => {
            const sizeKB = (e.content.length / 1024).toFixed(1);
            html += `
                <div class="wb-doc-list-item">
                    <div class="wb-doc-thumbnail"><div class="wb-doc-line"></div><div class="wb-doc-line short"></div><div class="wb-doc-line medium"></div><div class="wb-doc-line"></div></div>
                    <div class="wb-doc-info">
                        <div class="wb-doc-title" style="color: #8e8e93;">${e.title}</div>
                        <div class="wb-doc-sub">${sizeKB} KB</div>
                    </div>
                    <div class="wb-doc-action-text" onclick="wbRestoreEntry('${e.id}', event)">恢复</div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    let tempSelectedGroupId = null;
    let entryToChangeGroup = null;

    function wbRenderGroupSelectSheet() {
        const sheetList = document.getElementById('wbGroupSelectList');
        if (!sheetList) return;
        let html = '';
        wbGroups.forEach(g => {
            const isSelected = g.id === tempSelectedGroupId ? 'selected' : '';
            html += `
                <div class="wb-sheet-list-item ${isSelected}" onclick="wbSelectGroup('${g.id}', this)">
                    <span>${g.name}</span><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
            `;
        });
        sheetList.innerHTML = html;
    }

    function wbOpenGroupSelectSheet() { 
        entryToChangeGroup = null;
        tempSelectedGroupId = document.getElementById('wbSelectedGroupName').getAttribute('data-id');
        wbRenderGroupSelectSheet();
        document.getElementById('wbGroupSelectSheetOverlay').classList.add('show'); 
    }
    
    function wbCloseGroupSelectSheet() { 
        document.getElementById('wbGroupSelectSheetOverlay').classList.remove('show'); 
        entryToChangeGroup = null;
    }
    
    function wbSelectGroup(id, element) {
        document.querySelectorAll('.wb-sheet-list-item').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        tempSelectedGroupId = id;
    }

    function wbConfirmGroupSelect() {
        if (tempSelectedGroupId) {
            if (entryToChangeGroup) {
                const entry = wbEntries.find(e => e.id === entryToChangeGroup);
                if (entry) {
                    entry.groupId = tempSelectedGroupId;
                    entry.updateTime = Date.now();
                    saveWorldbookData();
                    wbRenderAll();
                    if (typeof showToast === 'function') showToast('已更换分组');
                }
                entryToChangeGroup = null;
            } else {
                const group = wbGroups.find(g => g.id === tempSelectedGroupId);
                if (group) {
                    document.getElementById('wbSelectedGroupName').innerText = group.name;
                    document.getElementById('wbSelectedGroupName').setAttribute('data-id', group.id);
                }
            }
        }
        wbCloseGroupSelectSheet();
    }

    function wbChangeEntryGroup(id) {
        entryToChangeGroup = id;
        const entry = wbEntries.find(e => e.id === id);
        if (entry) {
            tempSelectedGroupId = entry.groupId;
            wbRenderGroupSelectSheet();
            document.getElementById('wbGroupSelectSheetOverlay').classList.add('show');
        }
    }

    function wbHandleSearch() {
        const query = document.getElementById('wbSearchInput').value.trim().toLowerCase();
        const resultsContainer = document.querySelector('.wb-search-results');
        
        if (!query) {
            resultsContainer.innerHTML = '输入关键字以搜索条目内容、Key 或标题...';
            return;
        }

        const results = wbEntries.filter(e => !e.isDeleted && (
            e.title.toLowerCase().includes(query) || 
            (e.key && e.key.toLowerCase().includes(query)) || 
            (e.content && e.content.toLowerCase().includes(query))
        ));

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div style="text-align:center; margin-top: 20px;">无匹配结果</div>';
            return;
        }

        let html = '<div class="wb-doc-list-card" style="text-align: left;">';
        results.forEach(e => {
            const sizeKB = (e.content.length / 1024).toFixed(1);
            html += `
                <div class="wb-doc-list-item" onclick="wbOpenEditor('${e.id}'); wbCloseSearch();">
                    <div class="wb-doc-thumbnail"><div class="wb-doc-line"></div><div class="wb-doc-line medium"></div><div class="wb-doc-line"></div><div class="wb-doc-line short"></div></div>
                    <div class="wb-doc-info">
                        <div class="wb-doc-title">${e.title}</div>
                        <div class="wb-doc-sub">${sizeKB} KB</div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        resultsContainer.innerHTML = html;
    }

    function wbHandleItemClick(element, id) {
        if (document.getElementById('wbGroupList').classList.contains('wb-edit-mode')) return;
        wbCurrentGroupId = id;
        wbRenderEntries(id);
        
        // 同步更新编辑页默认选中的分组
        const group = wbGroups.find(g => g.id === id);
        if (group) {
            document.getElementById('wbSelectedGroupName').innerText = group.name;
            document.getElementById('wbSelectedGroupName').setAttribute('data-id', group.id);
            document.querySelectorAll('.wb-sheet-list-item').forEach(el => el.classList.remove('selected'));
            document.querySelectorAll('.wb-sheet-list-item span').forEach(span => {
                if(span.innerText === group.name) span.parentElement.classList.add('selected');
            });
        }

        document.getElementById('wbMainPage').classList.remove('active');
        document.getElementById('wbMainPage').classList.add('slide-left');
        document.getElementById('wbGroupPage').classList.remove('slide-right');
        document.getElementById('wbGroupPage').classList.add('active');
    }

    function wbCloseGroup() {
        wbCurrentGroupId = null;
        wbRenderGroups(); // 刷新主页计数
        document.getElementById('wbGroupPage').classList.remove('active'); 
        document.getElementById('wbGroupPage').classList.add('slide-right');
        document.getElementById('wbMainPage').classList.remove('slide-left'); 
        document.getElementById('wbMainPage').classList.add('active');
    }

    function wbOpenEditor(entryId = null) {
        wbCurrentEntryId = entryId;
        const titleInput = document.getElementById('wbEntryTitle');
        const keyInput = document.querySelector('.wb-editor-key-input');
        const contentInput = document.querySelector('.wb-editor-textarea');
        const globalSwitch = document.querySelector('.wb-ios-switch');
        const posSelect = document.getElementById('wbPositionText');
        const depthInput = document.querySelector('.wb-settings-input');
        const groupNameSpan = document.getElementById('wbSelectedGroupName');

        if (entryId) {
            const entry = wbEntries.find(e => e.id === entryId);
            if (entry) {
                titleInput.value = entry.title;
                keyInput.value = entry.key || '';
                contentInput.value = entry.content || '';
                if (entry.isGlobal) globalSwitch.classList.add('active');
                else globalSwitch.classList.remove('active');
                posSelect.innerText = entry.position || '后置 (After)';
                posSelect.setAttribute('data-value', entry.position || '后置 (After)');
                depthInput.value = entry.depth || 4;
                
                const group = wbGroups.find(g => g.id === entry.groupId);
                if (group) {
                    groupNameSpan.innerText = group.name;
                    groupNameSpan.setAttribute('data-id', group.id);
                }
            }
        } else {
            // 新建清空
            titleInput.value = '';
            keyInput.value = '';
            contentInput.value = '';
            globalSwitch.classList.remove('active');
            posSelect.innerText = '后置 (After)';
            posSelect.setAttribute('data-value', '后置 (After)');
            depthInput.value = 4;
            
            // 如果没有选中分组，默认选未分类
            if (!groupNameSpan.getAttribute('data-id')) {
                let unclass = wbGroups.find(g => g.name === '未分类');
                if (!unclass) {
                    unclass = { id: 'default_unclassified', name: '未分类', isPinned: false };
                    wbGroups.push(unclass);
                }
                groupNameSpan.innerText = unclass.name;
                groupNameSpan.setAttribute('data-id', unclass.id);
            }
        }

        document.getElementById('wbBottomBar').style.display = 'none';
        if (document.getElementById('wbGroupPage').classList.contains('active')) {
            document.getElementById('wbGroupPage').classList.remove('active'); 
            document.getElementById('wbGroupPage').classList.add('slide-left');
        } else {
            document.getElementById('wbMainPage').classList.remove('active'); 
            document.getElementById('wbMainPage').classList.add('slide-left');
        }
        document.getElementById('wbEditorPage').classList.remove('slide-right'); 
        document.getElementById('wbEditorPage').classList.add('active');
    }

    function wbSaveEntry() {
        const title = document.getElementById('wbEntryTitle').value.trim() || '未命名条目';
        const key = document.querySelector('.wb-editor-key-input').value.trim();
        const content = document.querySelector('.wb-editor-textarea').value;
        const isGlobal = document.querySelector('.wb-ios-switch').classList.contains('active');
        const position = document.getElementById('wbPositionText').getAttribute('data-value');
        const depth = document.querySelector('.wb-settings-input').value;
        
        let groupId = document.getElementById('wbSelectedGroupName').getAttribute('data-id');
        
        // 确保分组存在
        if (!wbGroups.find(g => g.id === groupId)) {
            let unclass = wbGroups.find(g => g.name === '未分类');
            if (!unclass) {
                unclass = { id: 'default_unclassified', name: '未分类', isPinned: false };
                wbGroups.push(unclass);
            }
            groupId = unclass.id;
        }

        if (wbCurrentEntryId) {
            const entry = wbEntries.find(e => e.id === wbCurrentEntryId);
            if (entry) {
                entry.title = title;
                entry.key = key;
                entry.content = content;
                entry.isGlobal = isGlobal;
                entry.position = position;
                entry.depth = depth;
                entry.groupId = groupId;
                entry.updateTime = Date.now();
            }
        } else {
            wbEntries.push({
                id: 'e_' + Date.now(),
                groupId: groupId,
                title: title,
                key: key,
                content: content,
                isGlobal: isGlobal,
                position: position,
                depth: depth,
                isPinned: false,
                isDeleted: false,
                updateTime: Date.now()
            });
        }

        saveWorldbookData();
        wbRenderAll();
        wbCloseEditor();
        if (typeof showToast === 'function') showToast('保存成功');
    }

    function wbCloseEditor() {
        document.getElementById('wbEditorPage').classList.remove('active'); 
        document.getElementById('wbEditorPage').classList.add('slide-right');
        document.getElementById('wbBottomBar').style.display = 'flex';
        if (document.getElementById('wbGroupPage').classList.contains('slide-left')) {
            document.getElementById('wbGroupPage').classList.remove('slide-left'); 
            document.getElementById('wbGroupPage').classList.add('active');
        } else {
            document.getElementById('wbMainPage').classList.remove('slide-left'); 
            document.getElementById('wbMainPage').classList.add('active');
        }
        wbCurrentEntryId = null;
    }
    function wbOpenFilterMenu(e) {
        const overlay = document.getElementById('wbFilterMenuOverlay');
        const menu = document.getElementById('wbFilterMenu');
        overlay.style.display = 'block';
        const rect = e.currentTarget.getBoundingClientRect();
        menu.style.top = (rect.bottom + 10) + 'px'; menu.style.left = rect.left + 'px';
        menu.style.animation = 'none'; menu.offsetHeight; menu.style.animation = null;
    }
    function wbCloseFilterMenu() {
        document.getElementById('wbFilterMenuOverlay').style.display = 'none';
    }
    function wbSwitchMainView(viewId, text) {
        document.getElementById('wbCurrentFilterText').innerText = text;
        document.getElementById('wb-view-all-groups').style.display = 'none';
        document.getElementById('wb-view-global-entries').style.display = 'none';
        document.getElementById('wb-view-deleted-entries').style.display = 'none';
        if (viewId === 'all') document.getElementById('wb-view-all-groups').style.display = 'block';
        if (viewId === 'global') document.getElementById('wb-view-global-entries').style.display = 'block';
        if (viewId === 'deleted') document.getElementById('wb-view-deleted-entries').style.display = 'block';
        wbCloseFilterMenu();
    }

    function wbRestoreEntry(entryId, event) {
        event.stopPropagation();
        const entry = wbEntries.find(e => e.id === entryId);
        if (entry) {
            entry.isDeleted = false;
            entry.deleteTime = null; // 清除删除时间
            
            // 如果恢复时原分组已被删除，则移至未分类
            if (!wbGroups.find(g => g.id === entry.groupId)) {
                let unclass = wbGroups.find(g => g.name === '未分类');
                if (!unclass) {
                    unclass = { id: 'default_unclassified', name: '未分类', isPinned: false };
                    wbGroups.push(unclass);
                }
                entry.groupId = unclass.id;
            }
            
            saveWorldbookData();
            wbRenderAll();
            if (typeof showToast === 'function') showToast('条目已恢复');
        }
    }

    function wbToggleViewMode() {
        wbIsGridView = !wbIsGridView;
        const listView = document.getElementById('wbListView');
        const gridView = document.getElementById('wbGridView');
        const viewToggleBtn = document.getElementById('wbViewToggleBtn');
        if (wbIsGridView) {
            listView.style.display = 'none'; gridView.style.display = 'grid';
            viewToggleBtn.innerHTML = `<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>`;
        } else {
            listView.style.display = 'block'; gridView.style.display = 'none';
            viewToggleBtn.innerHTML = `<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect>`;
        }
    }

    let wbPressTimer; let wbIsDragging = false; let wbLongPressTriggered = false;
    function wbHandlePointerDown(e, type, id, element) {
        wbIsDragging = false; wbLongPressTriggered = false; element.classList.add('pressing');
        wbPressTimer = setTimeout(() => { wbLongPressTriggered = true; wbShowContextMenu(e, type, id, element); }, 500);
    }
    function wbHandlePointerMove() {
        wbIsDragging = true; clearTimeout(wbPressTimer);
        document.querySelectorAll('.pressing').forEach(el => el.classList.remove('pressing'));
    }
    function wbHandlePointerUp(e, type, id, element) {
        clearTimeout(wbPressTimer); element.classList.remove('pressing');
        if (!wbIsDragging && !wbLongPressTriggered && document.getElementById('wbContextMenuOverlay').style.display !== 'block') {
            if (type === 'group') wbHandleItemClick(element, id);
            else if (type === 'entry') wbOpenEditor(id);
        }
    }

    function wbShowContextMenu(e, type, id, el) {
        if (navigator.vibrate) navigator.vibrate(50);
        const overlay = document.getElementById('wbContextMenuOverlay');
        const menu = document.getElementById('wbContextMenu');
        
        if (type === 'group') {
            const group = wbGroups.find(g => g.id === id);
            if (!group) return;
            menu.innerHTML = `
                <div class="icon-menu-item" onclick="wbTogglePinGroup('${id}'); wbCloseContextMenu();">
                    <svg viewBox="0 0 24 24"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3h0a3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                    <span>${group.isPinned ? '取消置顶' : '置顶分组'}</span>
                </div>
                <div class="icon-menu-item" onclick="wbEditGroupName('${id}'); wbCloseContextMenu();">
                    <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    <span>编辑名称</span>
                </div>
                <div class="icon-menu-item" style="color: #ff3b30;" onclick="wbDeleteGroup(event, '${id}'); wbCloseContextMenu();">
                    <svg style="stroke: #ff3b30;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    <span>删除分组</span>
                </div>
            `;
        } else {
            const entry = wbEntries.find(e => e.id === id);
            if (!entry) return;
            menu.innerHTML = `
                <div class="icon-menu-item" onclick="wbTogglePinEntry('${id}'); wbCloseContextMenu();">
                    <svg viewBox="0 0 24 24"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3h0a3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                    <span>${entry.isPinned ? '取消置顶' : '置顶条目'}</span>
                </div>
                <div class="icon-menu-item" onclick="wbChangeEntryGroup('${id}'); wbCloseContextMenu();">
                    <svg viewBox="0 0 24 24"><path d="M3 19V6a2 2 0 0 1 2-2h4.5c.4 0 .8.2 1 .5l1 1.5c.2.3.6.5 1 .5H21a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                    <span>更换分组</span>
                </div>
                <div class="icon-menu-item" style="color: #ff3b30;" onclick="wbDeleteEntry('${id}'); wbCloseContextMenu();">
                    <svg style="stroke: #ff3b30;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    <span>删除条目</span>
                </div>
            `;
        }
        overlay.style.display = 'block';
        const rect = el.getBoundingClientRect();
        let top = rect.top + 20; let left = e.clientX || rect.left + 20;
        if (top + 160 > window.innerHeight) top = window.innerHeight - 180;
        if (left + 240 > window.innerWidth) left = window.innerWidth - 250;
        menu.style.top = top + 'px'; menu.style.left = left + 'px';
        menu.style.animation = 'none'; menu.offsetHeight; menu.style.animation = null;
    }

    function wbCloseContextMenu() {
        document.getElementById('wbContextMenuOverlay').style.display = 'none';
    }

    function wbTogglePinGroup(id) {
        const group = wbGroups.find(g => g.id === id);
        if (group) {
            group.isPinned = !group.isPinned;
            saveWorldbookData();
            wbRenderAll();
        }
    }

    function wbEditGroupName(id) {
        const group = wbGroups.find(g => g.id === id);
        if (!group) return;
        showCustomPrompt('编辑分组名称', { placeholder: '输入新名称', value: group.name }, '保存').then(newName => {
            if (newName && newName.trim() !== '') {
                group.name = newName.trim();
                saveWorldbookData();
                wbRenderAll();
            }
        });
    }

    function wbTogglePinEntry(id) {
        const entry = wbEntries.find(e => e.id === id);
        if (entry) {
            entry.isPinned = !entry.isPinned;
            saveWorldbookData();
            wbRenderAll();
        }
    }

    function wbDeleteEntry(id) {
        const entry = wbEntries.find(e => e.id === id);
        if (entry) {
            entry.isDeleted = true;
            entry.deleteTime = Date.now(); // 记录删除时间
            saveWorldbookData();
            wbRenderAll();
            if (typeof showToast === 'function') showToast('已移至最近删除');
        }
    }

    function wbToggleEditMode() {
        wbIsEditMode = !wbIsEditMode;
        const editBtn = document.getElementById('wbEditBtn');
        const groupList = document.getElementById('wbGroupList');
        if (wbIsEditMode) {
            editBtn.innerText = '完成'; 
            editBtn.style.color = '#e4af0a'; 
            groupList.classList.add('wb-edit-mode');
        } else {
            editBtn.innerText = '编辑'; 
            editBtn.style.color = ''; 
            groupList.classList.remove('wb-edit-mode');
        }
    }

    function wbDeleteGroup(event, id) {
        if (event) event.stopPropagation(); 
        showCustomConfirm('删除分组', '确定要删除此分组及其包含的所有条目吗？', '删除', true).then(confirmed => {
            if (confirmed) {
                const now = Date.now();
                wbEntries.forEach(e => {
                    if (e.groupId === id) {
                        e.isDeleted = true;
                        e.deleteTime = now; // 连带删除并记录时间
                    }
                });
                wbGroups = wbGroups.filter(g => g.id !== id);
                saveWorldbookData();
                wbRenderAll();
                if (typeof showToast === 'function') showToast('分组及条目已移至最近删除');
            }
        });
    }

    function wbOpenCreateGroupModal() {
        showCustomPrompt('新建文件夹', { placeholder: '请输入此世界书分组的名称。', value: '' }, '存储').then(groupName => {
            if (groupName === null) return;
            if (groupName.trim() !== '') {
                wbGroups.push({ id: 'g_' + Date.now(), name: groupName.trim(), isPinned: false });
                saveWorldbookData();
                wbRenderAll();
            } else {
                showCustomAlert("提示", "名称不能为空！");
            }
        });
    }

    function wbOpenSearch() {
        document.getElementById('wbSearchOverlay').classList.add('show');
        setTimeout(() => document.getElementById('wbSearchInput').focus(), 300);
    }
    function wbCloseSearch() {
        document.getElementById('wbSearchOverlay').classList.remove('show');
        document.getElementById('wbSearchInput').blur();
    }

            // show three-dots button; click to expand vertical capsule menu
