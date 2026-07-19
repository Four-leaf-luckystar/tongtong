    const searchableItems = [
        { name: '设置', desc: '系统设置、网络、通用', iconBg: '#8e8e93', actionKey: 'settings' },
        { name: '主题', desc: '壁纸、图标、字体、预设', iconBg: '#ff9500', actionKey: 'theme' },
        { name: '账户信息', desc: '云端、登陆管理', iconBg: '#007aff', actionKey: 'appleId' },
        { name: 'API连接', desc: '模型配置、流式输出', iconBg: '#34c759', actionKey: 'api' }
    ];

    const searchActions = {
        'settings': openSettingsApp,
        'theme': openThemeApp,
        'appleId': openAppleIdApp,
        'api': openApiApp
    };

    function openSearchDrawer() {
        // 终极防御：确保只有在纯桌面状态下才能呼出搜索抽屉
        const appContainers = [
            'themeAppUI', 'settingsAppUI', 'appleIdUI', 
            'icloudAppUI', 'displaySettingsUI', 'apiAppUI', 'worldbookAppUI'
        ];
        for (let id of appContainers) {
            const el = document.getElementById(id);
            // 使用 getComputedStyle 获取真实的渲染状态，防止动画延迟导致的误判
            if (el && window.getComputedStyle(el).display !== 'none') {
                return; // 如果有任何APP处于显示状态，直接拦截
            }
        }

        document.getElementById('searchDrawerOverlay').classList.add('show');
        document.getElementById('searchDrawer').classList.add('show');
        document.getElementById('globalSearchInput').value = '';
        renderSearchResults(''); // 默认显示全部推荐
        setTimeout(() => {
            document.getElementById('globalSearchInput').focus();
        }, 300);
    }

    // 修复 WebView 幽灵点击 Bug：使用 JS 绑定事件，避开浏览器的错误启发式扫描
    setTimeout(() => {
        const desktopSearchBar = document.getElementById('desktopSearchBar');
        if (desktopSearchBar) {
            desktopSearchBar.addEventListener('click', openSearchDrawer);
        }
    }, 0);

    function closeSearchDrawer() {
        document.getElementById('searchDrawerOverlay').classList.remove('show');
        document.getElementById('searchDrawer').classList.remove('show');
        document.getElementById('globalSearchInput').blur();
    }

    function handleGlobalSearch() {
        const query = document.getElementById('globalSearchInput').value.trim().toLowerCase();
        renderSearchResults(query);
    }

    function renderSearchResults(query) {
        const area = document.getElementById('searchResultsArea');
        area.innerHTML = '';

        const filtered = searchableItems.filter(item => 
            item.name.toLowerCase().includes(query) || 
            item.desc.toLowerCase().includes(query)
        );

        if (filtered.length === 0) {
            area.innerHTML = '<div style="text-align:center; color:#8e8e93; margin-top:40px; font-size:14px;">无结果</div>';
            return;
        }

        let html = '<div class="search-result-card">';
        filtered.forEach(item => {
            html += `
                <div class="search-result-item" onclick="executeSearchAction('${item.actionKey}')">
                    <div class="search-result-icon" style="background-color: ${item.iconBg};">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </div>
                    <div class="search-result-text">
                        <div>${item.name}</div>
                        <div style="font-size:12px; color:#8e8e93; margin-top:2px;">${item.desc}</div>
                    </div>
                    <svg class="search-result-arrow" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
            `;
        });
        html += '</div>';
        area.innerHTML = html;
    }

    function executeSearchAction(actionKey) {
        closeSearchDrawer();
        setTimeout(() => {
            if (searchActions[actionKey]) {
                searchActions[actionKey]();
            }
        }, 300); // 等待抽屉收起动画完成后再打开对应页面
    }

            // show three-dots button; click to expand vertical capsule menu
