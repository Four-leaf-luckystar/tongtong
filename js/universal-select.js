    // --- 通用选择弹窗逻辑 ---
    let univSelCallback = null;

    function openUniversalSelect(options) {
        // options: { title, items: [{label, value}], currentValue, searchable, onSelect }
        const titleEl = document.getElementById('univSelTitle');
        if (titleEl) titleEl.innerText = options.title;
        
        const searchWrap = document.getElementById('univSelSearchWrap');
        const searchInput = document.getElementById('univSelSearchInput');
        
        if (options.searchable) {
            searchWrap.style.display = 'block';
            searchInput.value = '';
        } else {
            searchWrap.style.display = 'none';
        }

        window.univSelCurrentItems = options.items;
        window.univSelCurrentValue = options.currentValue;
        univSelCallback = options.onSelect;

        renderUniversalSelectList('');
        document.getElementById('univSelOverlay').classList.add('show');
    }

    function closeUniversalSelect() {
        document.getElementById('univSelOverlay').classList.remove('show');
    }

    function renderUniversalSelectList(query) {
        const container = document.getElementById('univSelListContainer');
        container.innerHTML = '';
        
        const filtered = window.univSelCurrentItems.filter(item => 
            item.label.toLowerCase().includes(query.toLowerCase()) || 
            item.value.toLowerCase().includes(query.toLowerCase())
        );
        
        if (filtered.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#8e8e93; padding: 40px 0; font-size: 14px;">无匹配项</div>';
            document.getElementById('univSelSaveBtn').classList.add('disabled');
            return;
        }

        let html = '';
        filtered.forEach(item => {
            const isSelected = window.univSelCurrentValue === item.value ? 'selected' : '';
            const safeValue = item.value.replace(/'/g, "\\'");
            html += `
                <div class="univ-sel-card ${isSelected}" onclick="selectUniversalItem(this, '${safeValue}')">
                    <div class="univ-sel-radio">
                        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <div class="univ-sel-info">
                        <div class="univ-sel-name">${item.label}</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        
        if (window.univSelCurrentValue !== null && window.univSelCurrentValue !== undefined && window.univSelCurrentValue !== '') {
            document.getElementById('univSelSaveBtn').classList.remove('disabled');
        } else {
            document.getElementById('univSelSaveBtn').classList.add('disabled');
        }
    }

    function handleUniversalSearch() {
        const query = document.getElementById('univSelSearchInput').value.trim();
        renderUniversalSelectList(query);
    }

    function selectUniversalItem(element, value) {
        const cards = document.querySelectorAll('.univ-sel-card');
        cards.forEach(card => card.classList.remove('selected'));
        element.classList.add('selected');
        window.univSelCurrentValue = value;
        document.getElementById('univSelSaveBtn').classList.remove('disabled');
    }

    function saveUniversalSelection() {
        if (window.univSelCurrentValue !== null && window.univSelCurrentValue !== undefined && window.univSelCurrentValue !== '') {
            if (univSelCallback) univSelCallback(window.univSelCurrentValue);
            closeUniversalSelect();
        }
    }

    // --- 各个模块的触发函数 ---
    function openApiModelSelect(mode) {
        if (typeof fetchedModelsCache === 'undefined' || fetchedModelsCache.length === 0) {
            showToast('请先点击“拉取模型”获取列表');
            return;
        }
        const inputEl = document.getElementById(mode === 'add' ? 'api-add-model' : 'api-edit-model');
        const items = fetchedModelsCache.map(m => ({ label: m, value: m }));
        openUniversalSelect({
            title: '选择模型',
            items: items,
            currentValue: inputEl.value,
            searchable: true,
            onSelect: (val) => {
                inputEl.value = val;
            }
        });
    }

    function openAutoBackupModeSelect() {
        const textEl = document.getElementById('autoBackupModeText');
        const items = [
            { label: '每次修改时', value: 'action' },
            { label: '间隔时间备份', value: 'interval' },
            { label: '定时备份', value: 'scheduled' }
        ];
        openUniversalSelect({
            title: '备份模式',
            items: items,
            currentValue: textEl.getAttribute('data-value') || 'action',
            searchable: false,
            onSelect: (val) => {
                textEl.setAttribute('data-value', val);
                textEl.innerText = items.find(i => i.value === val).label;
                changeBackupMode();
            }
        });
    }

    function openBackupIntervalUnitSelect() {
        const textEl = document.getElementById('backupIntervalUnitText');
        const items = [
            { label: '分钟', value: '60000' },
            { label: '小时', value: '3600000' }
        ];
        openUniversalSelect({
            title: '间隔单位',
            items: items,
            currentValue: textEl.getAttribute('data-value') || '60000',
            searchable: false,
            onSelect: (val) => {
                textEl.setAttribute('data-value', val);
                textEl.innerText = items.find(i => i.value === val).label;
                updateBackupSettings();
            }
        });
    }

    function openWbPositionSelect() {
        const textEl = document.getElementById('wbPositionText');
        const items = [
            { label: '前置 (Before)', value: '前置 (Before)' },
            { label: '后置 (After)', value: '后置 (After)' },
            { label: '作者注释 (Author\'s Note)', value: '作者注释 (Author\'s Note)' }
        ];
        openUniversalSelect({
            title: '注入位置',
            items: items,
            currentValue: textEl.getAttribute('data-value') || '后置 (After)',
            searchable: false,
            onSelect: (val) => {
                textEl.setAttribute('data-value', val);
                textEl.innerText = val;
            }
        });
    }

    function openWcAvatarModeSelect() {
        const textEl = document.getElementById('wcAvatarDisplayModeText');
        const items = [
            { label: '全程显示', value: 'all' },
            { label: '首个显示', value: 'first' },
            { label: '末尾显示', value: 'last' }
        ];
        openUniversalSelect({
            title: '显示模式',
            items: items,
            currentValue: textEl.getAttribute('data-value') || 'all',
            searchable: false,
            onSelect: (val) => {
                textEl.setAttribute('data-value', val);
                textEl.innerText = items.find(i => i.value === val).label;
                wcApplyAvatarSettings();
            }
        });
    }

    function openWcBatchGroupSelect() {
        const textEl = document.getElementById('wcBatchGroupSelectText');
        let items = [];
        if (wcEmojiGroups.length === 0) {
            items.push({ label: '默认分组', value: 'new_default' });
        } else {
            items = wcEmojiGroups.map(g => ({ label: g.name, value: g.id }));
        }
        openUniversalSelect({
            title: '选择分组',
            items: items,
            currentValue: textEl.getAttribute('data-value'),
            searchable: true,
            onSelect: (val) => {
                textEl.setAttribute('data-value', val);
                textEl.innerText = items.find(i => i.value === val).label;
            }
        });
    }

initDB();
