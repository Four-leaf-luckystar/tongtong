(function () {
    'use strict';

    const DB_NAME = 'iOSDesktopDB';
    const STORE_NAME = 'layoutStore';
    const PREFERENCES_KEY = 'memoryAppPreferencesV1';
    const MEMORY_ITEMS_KEY = 'memoryItemsV1';
    const CONTACTS_KEY = 'wechatContactsData';
    const CHATS_KEY = 'wechatChatData';
    let root = null;
    let selectedContactId = '';
    let activeTab = 'memory';
    let cachedContacts = [];
    let cachedConversations = {};
    let cachedMemoryItems = [];

    function readRecords(keys) {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => resolve({});
            request.onsuccess = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.close();
                    resolve({});
                    return;
                }

                const result = {};
                const transaction = database.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                keys.forEach((key) => {
                    const getRequest = store.get(key);
                    getRequest.onsuccess = () => { result[key] = getRequest.result || null; };
                });
                transaction.oncomplete = () => {
                    database.close();
                    resolve(result);
                };
                transaction.onerror = () => {
                    database.close();
                    resolve({});
                };
            };
        });
    }

    function writeRecord(record) {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => resolve(false);
            request.onsuccess = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.close();
                    resolve(false);
                    return;
                }
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                transaction.objectStore(STORE_NAME).put(record);
                transaction.oncomplete = () => {
                    database.close();
                    resolve(true);
                };
                transaction.onerror = () => {
                    database.close();
                    resolve(false);
                };
            };
        });
    }

    function savePreferences() {
        return writeRecord({ id: PREFERENCES_KEY, selectedContactId });
    }

    function getContactMessages(contactId) {
        const messages = cachedConversations && cachedConversations[contactId];
        return Array.isArray(messages) ? messages : [];
    }

    function parseMessageTime(message) {
        for (const key of ['timestamp', 'time', 'createdAt', 'date']) {
            const value = message && message[key];
            if (typeof value === 'number' && Number.isFinite(value)) return value < 100000000000 ? value * 1000 : value;
            if (typeof value === 'string') {
                const timestamp = Date.parse(value);
                if (Number.isFinite(timestamp)) return timestamp;
            }
        }
        return 0;
    }

    function getKnownDays(messages) {
        const firstTimestamp = messages.reduce((earliest, message) => {
            const timestamp = parseMessageTime(message);
            return timestamp && (!earliest || timestamp < earliest) ? timestamp : earliest;
        }, 0);
        if (!firstTimestamp) return 0;
        return Math.max(1, Math.floor((Date.now() - firstTimestamp) / 86400000) + 1);
    }

    function setAvatar(contact) {
        const avatar = root.querySelector('[data-memory-avatar]');
        const monogram = root.querySelector('[data-memory-monogram]');
        const image = root.querySelector('[data-memory-avatar-image]');
        const name = contact && contact.name ? contact.name.trim() : '';
        monogram.textContent = name ? name.slice(0, 1) : '记';
        image.removeAttribute('src');
        avatar.classList.remove('has-image');
        if (contact && contact.avatar) {
            image.src = contact.avatar;
            image.onload = () => avatar.classList.add('has-image');
            image.onerror = () => avatar.classList.remove('has-image');
        }
    }

    function getEmptyCopy() {
        const copy = {
            memory: ['暂无记忆', '这里会收纳你们确认过的共同记忆。'],
            relationship: ['关系尚未记录', '确认后的关系变化会在这里留下时间线。'],
            fragment: ['暂无聊天片段', '重要的对话片段会在这里沉淀下来。'],
            archive: ['档案尚未建立', '档案只保存你主动留下的长期信息。']
        };
        return copy[activeTab] || copy.memory;
    }

    function getTabLabel(tab = activeTab) {
        return ({ memory: '记忆', relationship: '关系', fragment: '片段', archive: '档案' })[tab] || '记忆';
    }

    function getActiveItems(contactId, kind) {
        return cachedMemoryItems
            .filter((item) => item && item.bindingId === contactId && item.status === 'active')
            .filter((item) => !kind || item.kind === kind)
            .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
    }

    function formatMemoryDate(value) {
        const timestamp = Date.parse(value || '');
        if (!Number.isFinite(timestamp)) return '';
        return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(timestamp);
    }

    function renderMemoryContent(contact) {
        const content = root.querySelector('[data-memory-content]');
        const title = root.querySelector('[data-memory-card-title]');
        const items = contact ? getActiveItems(contact.id, activeTab) : [];
        const [emptyTitle, emptyText] = getEmptyCopy();
        title.textContent = '@ ' + getTabLabel();
        content.replaceChildren();

        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'memory-empty-state';
            empty.innerHTML = '<span class="memory-empty-mark">✦</span><h2></h2><p></p>';
            empty.querySelector('h2').textContent = emptyTitle;
            empty.querySelector('p').textContent = emptyText;
            content.appendChild(empty);
            return;
        }

        const list = document.createElement('div');
        list.className = 'memory-entry-list';
        items.forEach((item) => {
            const entry = document.createElement('article');
            entry.className = 'memory-entry';
            const meta = document.createElement('span');
            meta.className = 'memory-entry-meta';
            meta.textContent = formatMemoryDate(item.createdAt) || '手动记录';
            const text = document.createElement('p');
            text.textContent = item.content || '';
            entry.append(meta, text);
            list.appendChild(entry);
        });
        content.appendChild(list);
    }

    function renderRolePicker() {
        const list = root.querySelector('[data-memory-role-list]');
        const empty = root.querySelector('[data-memory-role-empty]');
        list.replaceChildren();
        const hasContacts = cachedContacts.length > 0;
        empty.hidden = hasContacts;
        list.hidden = !hasContacts;
        if (!hasContacts) return;

        cachedContacts.forEach((contact) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'memory-role-option' + (contact.id === selectedContactId ? ' is-selected' : '');
            const avatar = document.createElement('span');
            avatar.className = 'memory-role-avatar';
            const monogram = document.createElement('span');
            monogram.textContent = (contact.name || '记').trim().slice(0, 1);
            avatar.appendChild(monogram);
            if (contact.avatar) {
                const image = document.createElement('img');
                image.alt = '';
                image.src = contact.avatar;
                image.onload = () => avatar.classList.add('has-image');
                image.onerror = () => avatar.classList.remove('has-image');
                avatar.appendChild(image);
            }
            const label = document.createElement('span');
            label.className = 'memory-role-name';
            label.textContent = contact.name || '未命名角色';
            const hint = document.createElement('span');
            hint.className = 'memory-role-hint';
            hint.textContent = '进入记忆';
            button.append(avatar, label, hint);
            button.addEventListener('click', () => selectRole(contact.id));
            list.appendChild(button);
        });
    }

    function showRolePicker() {
        if (!root) return;
        renderRolePicker();
        root.classList.add('is-picking-role');
        root.querySelector('[data-memory-role-picker]').setAttribute('aria-hidden', 'false');
    }

    function hideRolePicker() {
        root.classList.remove('is-picking-role');
        root.querySelector('[data-memory-role-picker]').setAttribute('aria-hidden', 'true');
    }

    function selectRole(contactId) {
        selectedContactId = contactId;
        activeTab = 'memory';
        savePreferences();
        hideRolePicker();
        render();
    }

    function openComposer() {
        const contact = cachedContacts.find((item) => item.id === selectedContactId);
        if (!contact) {
            showRolePicker();
            return;
        }
        root.classList.add('is-composing');
        root.querySelector('[data-memory-composer]').setAttribute('aria-hidden', 'false');
        root.querySelector('[data-memory-composer-title]').textContent = '新增' + getTabLabel();
        root.querySelector('[data-memory-composer-role]').textContent = contact.name || '未命名角色';
        const input = root.querySelector('[data-memory-composer-input]');
        const error = root.querySelector('[data-memory-composer-error]');
        input.value = '';
        error.textContent = '';
        requestAnimationFrame(() => input.focus());
    }

    function closeComposer() {
        if (!root) return;
        root.classList.remove('is-composing');
        root.querySelector('[data-memory-composer]').setAttribute('aria-hidden', 'true');
    }

    async function saveManualMemory() {
        const input = root.querySelector('[data-memory-composer-input]');
        const error = root.querySelector('[data-memory-composer-error]');
        const content = input.value.trim();
        if (!content) {
            error.textContent = '先写下一条记忆。';
            input.focus();
            return;
        }
        const now = new Date().toISOString();
        const item = {
            id: 'memory_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            schemaVersion: 1,
            bindingId: selectedContactId,
            kind: activeTab,
            tier: 'L1',
            status: 'active',
            authority: 'user_confirmed',
            visibility: 'current_binding',
            content,
            sourceRefs: [{ type: 'manual', createdAt: now }],
            createdAt: now,
            updatedAt: now
        };
        const nextItems = [...cachedMemoryItems, item];
        const saved = await writeRecord({ id: MEMORY_ITEMS_KEY, schemaVersion: 1, items: nextItems });
        if (!saved) {
            error.textContent = '暂时无法保存，请稍后重试。';
            return;
        }
        cachedMemoryItems = nextItems;
        closeComposer();
        render();
    }

    function render() {
        if (!root) return;
        const contact = cachedContacts.find((item) => item.id === selectedContactId) || null;
        const messages = contact ? getContactMessages(contact.id) : [];
        const name = contact && contact.name ? contact.name.trim() : '尚未选择角色';
        const memoryItems = contact ? getActiveItems(contact.id) : [];

        root.querySelector('[data-memory-name]').textContent = name;
        root.querySelector('[data-memory-status]').textContent = contact ? (memoryItems.length ? '已记录' : '档案空白') : '等待建立';
        root.querySelector('[data-memory-subtitle]').textContent = contact
            ? (memoryItems.length ? '已有 ' + memoryItems.length + ' 条共同记忆。' : '共同记忆会从这里慢慢留下。')
            : '先在聊天中选择一位角色。';
        root.querySelector('[data-memory-count]').textContent = String(memoryItems.length);
        root.querySelector('[data-memory-chat-count]').textContent = String(messages.length);
        root.querySelector('[data-memory-days]').textContent = String(getKnownDays(messages));
        root.querySelectorAll('[data-memory-tab]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.memoryTab === activeTab);
            button.setAttribute('aria-selected', String(button.dataset.memoryTab === activeTab));
        });
        setAvatar(contact);
        renderMemoryContent(contact);
        renderRolePicker();
    }

    async function refresh() {
        const records = await readRecords([PREFERENCES_KEY, MEMORY_ITEMS_KEY, CONTACTS_KEY, CHATS_KEY]);
        const contactsData = records[CONTACTS_KEY];
        cachedContacts = Array.isArray(contactsData && contactsData.contacts)
            ? contactsData.contacts.filter((contact) => contact && contact.id)
            : [];
        cachedConversations = records[CHATS_KEY] && records[CHATS_KEY].conversations && typeof records[CHATS_KEY].conversations === 'object'
            ? records[CHATS_KEY].conversations
            : {};
        cachedMemoryItems = Array.isArray(records[MEMORY_ITEMS_KEY] && records[MEMORY_ITEMS_KEY].items)
            ? records[MEMORY_ITEMS_KEY].items.filter((item) => item && item.id && item.bindingId && item.content)
            : [];

        const preferredId = records[PREFERENCES_KEY] && records[PREFERENCES_KEY].selectedContactId;
        if (cachedContacts.some((contact) => contact.id === selectedContactId)) {
            // Keep the current in-app selection while refreshing.
        } else if (cachedContacts.some((contact) => contact.id === preferredId)) {
            selectedContactId = preferredId;
        } else {
            selectedContactId = cachedContacts[0] ? cachedContacts[0].id : '';
        }
        render();
    }

    function buildRoot() {
        root = document.createElement('section');
        root.id = 'memoryAppUI';
        root.className = 'memory-app-container';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = `
            <div class="memory-app-scroll">
                <header class="memory-profile-header">
                    <button class="memory-back" type="button" data-memory-action="close" aria-label="返回桌面">‹</button>
                    <div class="memory-header-actions">
                        <button class="memory-switch-role" type="button" data-memory-action="switch-role">切换</button>
                        <button class="memory-add" type="button" data-memory-action="add" aria-label="新增记忆" title="新增记忆">+</button>
                    </div>
                </header>
                <main class="memory-profile-main">
                    <div class="memory-avatar-shell">
                        <div class="memory-avatar" data-memory-avatar><img data-memory-avatar-image alt=""><span data-memory-monogram>记</span></div>
                    </div>
                    <div class="memory-heading">
                        <div class="memory-name-line"><h1 data-memory-name>记忆</h1><span data-memory-status>读取中</span></div>
                        <p data-memory-subtitle>正在读取本地档案。</p>
                    </div>
                    <section class="memory-stats" aria-label="记忆统计">
                        <article><b data-memory-count>0</b><span>记忆总条数</span></article>
                        <article><b data-memory-chat-count>0</b><span>共同对话</span></article>
                        <article><b data-memory-days>0</b><span>认识天数</span></article>
                    </section>
                    <section class="memory-content-card">
                        <div class="memory-card-kicker" data-memory-card-title>@ 记忆</div>
                        <div data-memory-content></div>
                    </section>
                </main>
                <nav class="memory-tabs" role="tablist" aria-label="记忆视图">
                    <button type="button" data-memory-tab="memory" class="is-active" role="tab" aria-selected="true">记忆</button>
                    <button type="button" data-memory-tab="relationship" role="tab" aria-selected="false">关系</button>
                    <button type="button" data-memory-tab="fragment" role="tab" aria-selected="false">片段</button>
                    <button type="button" data-memory-tab="archive" role="tab" aria-selected="false">档案</button>
                </nav>
            </div>`;

        const rolePicker = document.createElement('section');
        rolePicker.className = 'memory-role-picker';
        rolePicker.setAttribute('data-memory-role-picker', '');
        rolePicker.setAttribute('aria-hidden', 'true');
        rolePicker.innerHTML = `
            <header class="memory-picker-header">
                <button class="memory-back" type="button" data-memory-action="close" aria-label="返回桌面">‹</button>
                <span>选择角色</span>
            </header>
            <div class="memory-picker-intro"><h1>进入谁的记忆</h1><p>每位角色拥有独立的记忆档案。</p></div>
            <div class="memory-role-list" data-memory-role-list></div>
            <div class="memory-role-empty" data-memory-role-empty hidden><h2>还没有可选角色</h2><p>先在联系人中创建角色，再回来建立记忆。</p><button type="button" data-memory-action="open-contacts">前往联系人</button></div>`;
        root.appendChild(rolePicker);

        const composer = document.createElement('section');
        composer.className = 'memory-composer';
        composer.setAttribute('data-memory-composer', '');
        composer.setAttribute('aria-hidden', 'true');
        composer.innerHTML = `
            <div class="memory-composer-sheet" role="dialog" aria-modal="true" aria-labelledby="memoryComposerTitle">
                <div class="memory-composer-header"><button type="button" data-memory-action="close-composer">取消</button><h2 id="memoryComposerTitle" data-memory-composer-title>新增记忆</h2><button type="button" data-memory-action="save-memory">保存</button></div>
                <p class="memory-composer-role">写入 <span data-memory-composer-role></span> 的独立档案</p>
                <textarea data-memory-composer-input maxlength="500" placeholder="写下想让角色记住的事…"></textarea>
                <p class="memory-composer-error" data-memory-composer-error aria-live="polite"></p>
            </div>`;
        root.appendChild(composer);

        root.querySelectorAll('[data-memory-action="close"]').forEach((button) => button.addEventListener('click', close));
        root.querySelector('[data-memory-action="switch-role"]').addEventListener('click', showRolePicker);
        root.querySelector('[data-memory-action="add"]').addEventListener('click', openComposer);
        root.querySelector('[data-memory-action="close-composer"]').addEventListener('click', closeComposer);
        root.querySelector('[data-memory-action="save-memory"]').addEventListener('click', saveManualMemory);
        root.querySelector('[data-memory-action="open-contacts"]').addEventListener('click', () => {
            close();
            if (typeof window.openContactsApp === 'function') window.openContactsApp();
        });
        root.querySelectorAll('[data-memory-tab]').forEach((button) => {
            button.addEventListener('click', () => {
                activeTab = button.dataset.memoryTab || 'memory';
                render();
            });
        });
        root.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (root.classList.contains('is-composing')) closeComposer();
            else close();
        });
        const host = document.querySelector('.iphone') || document.body;
        host.appendChild(root);
    }

    function ensureStyles() {
        if (document.getElementById('memoryAppStyles')) return;
        const style = document.createElement('style');
        style.id = 'memoryAppStyles';
        style.textContent = `
            .memory-app-container { --memory-blue: #1c1c1e; --memory-background: #f2f2f7; --memory-card: #ffffff; --memory-label: #3c3c43; --memory-secondary: #8e8e93; --memory-separator: #c6c6c8; position: absolute; inset: 0; z-index: 7200; display: none; overflow: hidden; background: var(--memory-background); color: #000; font-family: "Noto Serif SC", "STSong", "SimSun", serif; }
            .memory-app-container.is-open { display: block; }
            .memory-app-scroll { box-sizing: border-box; display: flex; flex-direction: column; height: 100%; min-height: 100%; overflow-y: auto; overscroll-behavior: contain; padding: max(13px, env(safe-area-inset-top)) 20px calc(18px + env(safe-area-inset-bottom)); background: var(--memory-background); }
            .memory-profile-header, .memory-picker-header { display: flex; align-items: center; justify-content: space-between; min-height: 46px; }
            .memory-back { width: 42px; height: 42px; border: 0; padding: 0 0 5px; border-radius: 50%; background: rgba(255,255,255,.72); color: var(--memory-blue); box-shadow: 0 2px 8px rgba(60,60,67,.08); font: 37px/37px Georgia, serif; cursor: pointer; }
            .memory-header-actions { display: flex; align-items: center; gap: 9px; }
            .memory-switch-role { min-width: 46px; height: 34px; border: 0; border-radius: 17px; padding: 0 11px; background: rgba(255,255,255,.72); color: var(--memory-blue); font: 13px/1 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-add { width: 34px; height: 34px; border: 0; border-radius: 50%; padding: 0 0 2px; background: var(--memory-blue); color: #fff; box-shadow: 0 4px 10px rgba(28,28,30,.22); font: 25px/30px Arial, sans-serif; cursor: pointer; }
            .memory-profile-main { flex: 1 0 auto; display: flex; flex-direction: column; align-items: center; padding: 24px 0 16px; }
            .memory-avatar-shell { display: grid; width: 150px; height: 150px; padding: 7px; border: 5px solid #d1d1d6; border-radius: 50%; box-sizing: border-box; background: var(--memory-background); box-shadow: 0 3px 10px rgba(60,60,67,.08); }
            .memory-avatar { width: 100%; height: 100%; border: 3px solid #fff; border-radius: 50%; overflow: hidden; box-sizing: border-box; background: #e5e5ea; display: grid; place-items: center; color: var(--memory-blue); font-size: 43px; font-weight: 700; }
            .memory-avatar img { display: none; width: 100%; height: 100%; object-fit: cover; }
            .memory-avatar.has-image img { display: block; }
            .memory-avatar.has-image span { display: none; }
            .memory-heading { width: 100%; margin-top: 23px; text-align: center; }
            .memory-name-line { display: flex; align-items: center; justify-content: center; gap: 10px; min-width: 0; }
            .memory-name-line h1 { margin: 0; max-width: 68%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 32px; line-height: 1.25; font-weight: 700; letter-spacing: 0; }
            .memory-name-line span { padding: 5px 9px; border-radius: 999px; background: #e5e5ea; color: var(--memory-blue); font-family: "Noto Serif SC", "STSong", "SimSun", serif; font-size: 12px; line-height: 1; white-space: nowrap; }
            .memory-heading p { margin: 8px 0 0; color: var(--memory-secondary); font-size: 14px; line-height: 1.55; }
            .memory-stats { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; gap: 12px; margin-top: 28px; }
            .memory-stats article { display: grid; min-width: 0; min-height: 92px; place-content: center; padding: 10px 6px; border-radius: 20px; background: var(--memory-card); box-shadow: 0 6px 18px rgba(60,60,67,.06); text-align: center; }
            .memory-stats b { display: block; color: var(--memory-blue); font-size: 25px; line-height: 1.05; font-variant-numeric: tabular-nums; }
            .memory-stats span { display: block; margin-top: 9px; color: var(--memory-secondary); font-size: 11px; white-space: nowrap; }
            .memory-content-card { display: flex; flex: 1 0 300px; flex-direction: column; width: 100%; min-height: 300px; margin-top: 23px; padding: 25px 25px 30px; border-radius: 24px; box-sizing: border-box; background: var(--memory-card); box-shadow: 0 10px 24px rgba(60,60,67,.055); }
            .memory-content-card [data-memory-content] { display: flex; flex: 1; min-height: 0; }
            .memory-card-kicker { color: var(--memory-secondary); font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; font-weight: 600; letter-spacing: 0; }
            .memory-empty-state { display: grid; flex: 1; width: 100%; align-content: center; justify-items: center; padding: 36px 12px; box-sizing: border-box; text-align: center; }
            .memory-empty-mark { color: var(--memory-blue); font-size: 22px; line-height: 1; }
            .memory-empty-state h2 { margin: 20px 0 0; font-size: 25px; line-height: 1.45; font-weight: 700; letter-spacing: 0; }
            .memory-empty-state p { max-width: 240px; margin: 9px 0 0; color: var(--memory-secondary); font-size: 14px; line-height: 1.75; }
            .memory-entry-list { display: grid; width: 100%; align-content: start; gap: 10px; padding: 20px 0 0; overflow-y: auto; }
            .memory-entry { padding: 14px 15px; border-radius: 14px; background: #f2f2f7; }
            .memory-entry-meta { display: block; color: var(--memory-blue); font-size: 11px; }
            .memory-entry p { margin: 7px 0 0; color: #1c1c1e; font-size: 15px; line-height: 1.62; white-space: pre-wrap; }
            .memory-tabs { position: sticky; bottom: 0; display: grid; grid-template-columns: repeat(4, 1fr); width: 100%; margin: 8px 0 0; padding: 5px; border-radius: 24px; box-sizing: border-box; background: rgba(255,255,255,.94); box-shadow: 0 7px 20px rgba(60,60,67,.08); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
            .memory-tabs button { height: 44px; border: 0; border-radius: 19px; padding: 0; background: transparent; color: var(--memory-secondary); font: 14px/1 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-tabs button.is-active { background: var(--memory-blue); color: #fff; font-weight: 700; }
            .memory-role-picker { position: absolute; inset: 0; z-index: 3; display: none; flex-direction: column; overflow-y: auto; padding: max(13px, env(safe-area-inset-top)) 20px calc(22px + env(safe-area-inset-bottom)); box-sizing: border-box; background: var(--memory-background); }
            .memory-app-container.is-picking-role .memory-role-picker { display: flex; }
            .memory-picker-header span { color: var(--memory-secondary); font-size: 14px; }
            .memory-picker-intro { margin-top: 35px; }
            .memory-picker-intro h1 { margin: 0; font-size: 30px; line-height: 1.3; }
            .memory-picker-intro p { margin: 9px 0 0; color: var(--memory-secondary); font-size: 14px; line-height: 1.65; }
            .memory-role-list { display: grid; gap: 11px; margin-top: 30px; }
            .memory-role-option { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; align-items: center; gap: 13px; width: 100%; min-height: 78px; border: 0; border-radius: 18px; padding: 12px 15px; box-sizing: border-box; background: var(--memory-card); box-shadow: 0 5px 16px rgba(60,60,67,.05); color: #000; text-align: left; cursor: pointer; }
            .memory-role-option.is-selected { outline: 2px solid var(--memory-blue); outline-offset: -2px; }
            .memory-role-avatar { position: relative; display: grid; width: 52px; height: 52px; overflow: hidden; border-radius: 50%; background: #e5e5ea; place-items: center; color: var(--memory-blue); font-size: 19px; font-weight: 700; }
            .memory-role-avatar img { display: none; width: 100%; height: 100%; object-fit: cover; }
            .memory-role-avatar.has-image img { display: block; }
            .memory-role-avatar.has-image span { display: none; }
            .memory-role-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 18px; font-weight: 700; }
            .memory-role-hint { color: var(--memory-blue); font-size: 13px; white-space: nowrap; }
            .memory-role-empty { display: grid; flex: 1; align-content: center; justify-items: center; padding: 40px 20px; text-align: center; }
            .memory-role-empty h2 { margin: 0; font-size: 22px; }
            .memory-role-empty p { margin: 10px 0 22px; color: var(--memory-secondary); font-size: 14px; line-height: 1.65; }
            .memory-role-empty button { border: 0; border-radius: 18px; padding: 11px 15px; background: var(--memory-blue); color: #fff; font: 14px/1 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-composer { position: absolute; inset: 0; z-index: 4; display: none; align-items: flex-end; background: rgba(0,0,0,.28); }
            .memory-app-container.is-composing .memory-composer { display: flex; }
            .memory-composer-sheet { width: 100%; padding: 14px 20px calc(25px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; box-sizing: border-box; background: var(--memory-card); box-shadow: 0 -12px 28px rgba(0,0,0,.12); }
            .memory-composer-header { display: grid; grid-template-columns: 60px 1fr 60px; align-items: center; }
            .memory-composer-header h2 { margin: 0; text-align: center; font-size: 17px; }
            .memory-composer-header button { border: 0; padding: 9px 0; background: transparent; color: var(--memory-blue); font: 15px/1 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-composer-header button:last-child { font-weight: 700; text-align: right; }
            .memory-composer-role { margin: 18px 0 10px; color: var(--memory-secondary); font-size: 13px; }
            .memory-composer-role span { color: #1c1c1e; }
            .memory-composer textarea { display: block; width: 100%; min-height: 142px; resize: none; border: 0; border-radius: 14px; padding: 14px; box-sizing: border-box; outline: 0; background: #f2f2f7; color: #1c1c1e; font: 16px/1.6 "Noto Serif SC", "STSong", "SimSun", serif; }
            .memory-composer textarea::placeholder { color: #8e8e93; }
            .memory-composer-error { min-height: 18px; margin: 7px 0 0; color: #ff3b30; font-size: 12px; }
            @media (max-width: 360px) { .memory-app-scroll, .memory-role-picker { padding-right: 15px; padding-left: 15px; } .memory-avatar-shell { width: 136px; height: 136px; } .memory-name-line h1 { font-size: 28px; } .memory-stats { gap: 9px; } .memory-stats article { min-height: 84px; border-radius: 17px; } .memory-stats b { font-size: 22px; } .memory-content-card { padding-right: 20px; padding-left: 20px; border-radius: 20px; } }
        `;
        document.head.appendChild(style);
    }

    function init() {
        ensureStyles();
        if (!root) buildRoot();
        return Promise.resolve();
    }

    function open() {
        if (!root) init();
        root.setAttribute('aria-hidden', 'false');
        root.classList.add('is-open');
        refresh().then(showRolePicker);
    }

    function close() {
        if (!root) return;
        closeComposer();
        root.classList.remove('is-picking-role');
        root.querySelector('[data-memory-role-picker]').setAttribute('aria-hidden', 'true');
        root.classList.remove('is-open');
        root.setAttribute('aria-hidden', 'true');
    }

    window.MemoryApp = { init, open, close, refresh };
})();
