(function () {
    'use strict';

    const DB_NAME = 'iOSDesktopDB';
    const STORE_NAME = 'layoutStore';
    const PREFERENCES_KEY = 'memoryAppPreferencesV1';
    const CONTACTS_KEY = 'wechatContactsData';
    const CHATS_KEY = 'wechatChatData';
    let root = null;
    let selectedContactId = '';
    let activeTab = 'memory';
    let cachedContacts = [];
    let cachedConversations = {};

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

    function savePreferences() {
        const request = indexedDB.open(DB_NAME);
        request.onsuccess = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.close();
                return;
            }
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            transaction.objectStore(STORE_NAME).put({ id: PREFERENCES_KEY, selectedContactId });
            transaction.oncomplete = () => database.close();
            transaction.onerror = () => database.close();
        };
    }

    function escapeText(value) {
        return String(value || '').replace(/[&<>'"]/g, (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[character]));
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

    function renderContactSelector() {
        const selector = root.querySelector('[data-memory-contact-selector]');
        selector.replaceChildren();
        if (cachedContacts.length < 2) {
            selector.hidden = true;
            return;
        }

        selector.hidden = false;
        cachedContacts.forEach((contact) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'memory-contact-chip' + (contact.id === selectedContactId ? ' is-active' : '');
            button.textContent = contact.name || '未命名角色';
            button.addEventListener('click', () => {
                selectedContactId = contact.id;
                savePreferences();
                render();
            });
            selector.appendChild(button);
        });
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

    function render() {
        if (!root) return;
        const contact = cachedContacts.find((item) => item.id === selectedContactId) || null;
        const messages = contact ? getContactMessages(contact.id) : [];
        const [emptyTitle, emptyText] = getEmptyCopy();
        const name = contact && contact.name ? contact.name.trim() : '尚未选择角色';

        root.querySelector('[data-memory-name]').textContent = name;
        root.querySelector('[data-memory-status]').textContent = contact ? '档案空白' : '等待建立';
        root.querySelector('[data-memory-subtitle]').textContent = contact
            ? '共同记忆会从这里慢慢留下。'
            : '先在聊天中选择一位角色。';
        root.querySelector('[data-memory-count]').textContent = '0';
        root.querySelector('[data-memory-chat-count]').textContent = String(messages.length);
        root.querySelector('[data-memory-days]').textContent = String(getKnownDays(messages));
        root.querySelector('[data-memory-empty-title]').textContent = emptyTitle;
        root.querySelector('[data-memory-empty-text]').textContent = emptyText;
        root.querySelectorAll('[data-memory-tab]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.memoryTab === activeTab);
            button.setAttribute('aria-selected', String(button.dataset.memoryTab === activeTab));
        });
        setAvatar(contact);
        renderContactSelector();
    }

    async function refresh() {
        const records = await readRecords([PREFERENCES_KEY, CONTACTS_KEY, CHATS_KEY]);
        const contactsData = records[CONTACTS_KEY];
        cachedContacts = Array.isArray(contactsData && contactsData.contacts)
            ? contactsData.contacts.filter((contact) => contact && contact.id)
            : [];
        cachedConversations = records[CHATS_KEY] && records[CHATS_KEY].conversations && typeof records[CHATS_KEY].conversations === 'object'
            ? records[CHATS_KEY].conversations
            : {};

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
                <header class="memory-cover" aria-hidden="true">
                    <span class="memory-cover-shape memory-cover-shape-a"></span>
                    <span class="memory-cover-shape memory-cover-shape-b"></span>
                    <span class="memory-cover-shape memory-cover-shape-c"></span>
                    <span class="memory-cover-line memory-cover-line-a"></span>
                    <span class="memory-cover-line memory-cover-line-b"></span>
                </header>
                <main class="memory-paper">
                    <button class="memory-back" type="button" data-memory-action="close" aria-label="返回桌面">‹</button>
                    <div class="memory-avatar" data-memory-avatar><img data-memory-avatar-image alt=""><span data-memory-monogram>记</span></div>
                    <div class="memory-heading">
                        <div class="memory-name-line"><h1 data-memory-name>记忆</h1><span data-memory-status>读取中</span></div>
                        <p data-memory-subtitle>正在读取本地档案。</p>
                    </div>
                    <div class="memory-contact-selector" data-memory-contact-selector hidden aria-label="选择角色"></div>
                    <section class="memory-stats" aria-label="记忆统计">
                        <div><b data-memory-count>0</b><span>记忆总条数</span></div>
                        <div><b data-memory-chat-count>0</b><span>共同对话</span></div>
                        <div><b data-memory-days>0</b><span>认识天数</span></div>
                    </section>
                    <div class="memory-tabs" role="tablist" aria-label="记忆视图">
                        <button type="button" data-memory-tab="memory" class="is-active" role="tab" aria-selected="true">记忆</button>
                        <button type="button" data-memory-tab="relationship" role="tab" aria-selected="false">关系</button>
                        <button type="button" data-memory-tab="fragment" role="tab" aria-selected="false">片段</button>
                        <button type="button" data-memory-tab="archive" role="tab" aria-selected="false">档案</button>
                    </div>
                    <section class="memory-empty-state">
                        <span class="memory-empty-mark">✦</span>
                        <h2 data-memory-empty-title>正在读取</h2>
                        <p data-memory-empty-text>正在读取本地档案。</p>
                    </section>
                </main>
            </div>`;

        root.querySelector('[data-memory-action="close"]').addEventListener('click', close);
        root.querySelectorAll('[data-memory-tab]').forEach((button) => {
            button.addEventListener('click', () => {
                activeTab = button.dataset.memoryTab || 'memory';
                render();
            });
        });
        root.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') close();
        });
        const host = document.querySelector('.iphone') || document.body;
        host.appendChild(root);
    }

    function ensureStyles() {
        if (document.getElementById('memoryAppStyles')) return;
        const style = document.createElement('style');
        style.id = 'memoryAppStyles';
        style.textContent = `
            .memory-app-container { position: absolute; inset: 0; z-index: 7200; display: none; overflow: hidden; background: #efeee8; color: #20201d; font-family: "Noto Serif SC", "STSong", "SimSun", serif; }
            .memory-app-container.is-open { display: block; }
            .memory-app-scroll { height: 100%; overflow-y: auto; overscroll-behavior: contain; background: #efeee8; }
            .memory-cover { position: relative; height: 190px; overflow: hidden; background: #9b9c90; }
            .memory-cover::before, .memory-cover::after { content: ""; position: absolute; background: #c4c4b7; transform: rotate(-12deg); }
            .memory-cover::before { width: 210px; height: 190px; top: 18px; left: -25px; }
            .memory-cover::after { width: 220px; height: 200px; top: -54px; right: -52px; background: #6e7068; transform: rotate(15deg); }
            .memory-cover-shape { position: absolute; display: block; z-index: 1; }
            .memory-cover-shape-a { width: 76px; height: 76px; border-radius: 50%; top: 42px; left: 43%; background: #d9d9cc; }
            .memory-cover-shape-b { width: 105px; height: 137px; bottom: -58px; right: 28px; border: 13px solid #dad9cf; transform: rotate(-9deg); }
            .memory-cover-shape-c { width: 140px; height: 62px; left: 18px; bottom: -23px; background: #84877d; transform: rotate(17deg); }
            .memory-cover-line { position: absolute; z-index: 2; display: block; width: 1px; height: 250px; background: rgba(36, 38, 34, .68); transform-origin: top; }
            .memory-cover-line-a { top: -44px; left: 50%; transform: rotate(-43deg); }
            .memory-cover-line-b { top: 10px; right: 62px; background: rgba(244, 244, 235, .85); transform: rotate(22deg); }
            .memory-paper { position: relative; z-index: 1; min-height: calc(100% - 190px); padding: 0 24px calc(34px + env(safe-area-inset-bottom)); background: #fdfcf8; }
            .memory-back { position: absolute; top: 18px; right: 18px; width: 34px; height: 34px; border: 0; padding: 0 0 4px; border-radius: 50%; background: rgba(255,255,255,.72); color: #292925; font: 31px/30px Georgia, serif; cursor: pointer; }
            .memory-avatar { position: absolute; z-index: 2; top: -40px; left: 24px; width: 76px; height: 76px; border: 4px solid #fdfcf8; border-radius: 50%; overflow: hidden; box-sizing: border-box; background: #dbd5c9; box-shadow: 0 5px 12px rgba(30, 30, 25, .13); display: grid; place-items: center; color: #5b534a; font-size: 30px; font-weight: 700; }
            .memory-avatar img { display: none; width: 100%; height: 100%; object-fit: cover; }
            .memory-avatar.has-image img { display: block; }
            .memory-avatar.has-image span { display: none; }
            .memory-heading { padding-top: 58px; }
            .memory-name-line { display: flex; align-items: center; gap: 10px; min-width: 0; }
            .memory-name-line h1 { margin: 0; max-width: 75%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 29px; line-height: 1.25; font-weight: 700; letter-spacing: 0; }
            .memory-name-line span { padding: 5px 9px; border-radius: 999px; background: #efefeb; color: #77766e; font-family: "Noto Serif SC", "STSong", "SimSun", serif; font-size: 12px; line-height: 1; white-space: nowrap; }
            .memory-heading p { margin: 7px 0 0; color: #77766f; font-size: 13px; line-height: 1.6; }
            .memory-contact-selector { display: flex; gap: 7px; margin: 17px 0 0; overflow-x: auto; scrollbar-width: none; }
            .memory-contact-selector::-webkit-scrollbar { display: none; }
            .memory-contact-chip { flex: 0 0 auto; border: 0; border-radius: 999px; padding: 6px 10px; background: #efeee9; color: #77766e; font: 12px/1.2 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-contact-chip.is-active { background: #292925; color: #fffefa; }
            .memory-stats { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 24px; padding: 17px 0 16px; border-top: 1px solid #e2e0d8; border-bottom: 1px solid #e2e0d8; }
            .memory-stats div { min-width: 0; padding-left: 10px; border-left: 1px solid #e2e0d8; }
            .memory-stats div:first-child { padding-left: 0; border-left: 0; }
            .memory-stats b { display: block; font-size: 23px; line-height: 1.1; font-variant-numeric: tabular-nums; }
            .memory-stats span { display: block; margin-top: 7px; color: #77766f; font-size: 11px; white-space: nowrap; }
            .memory-tabs { display: flex; gap: 24px; border-bottom: 1px solid #e2e0d8; }
            .memory-tabs button { position: relative; height: 54px; border: 0; padding: 0; background: transparent; color: #8a8982; font: 14px/1 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-tabs button.is-active { color: #252521; font-weight: 700; }
            .memory-tabs button.is-active::after { content: ""; position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; background: #252521; }
            .memory-empty-state { display: grid; justify-items: center; padding: 78px 20px 60px; text-align: center; }
            .memory-empty-mark { color: #aaa99f; font-size: 22px; line-height: 1; }
            .memory-empty-state h2 { margin: 21px 0 0; font-size: 23px; line-height: 1.45; font-weight: 700; letter-spacing: 0; }
            .memory-empty-state p { max-width: 230px; margin: 9px 0 0; color: #85847c; font-size: 14px; line-height: 1.75; }
            @media (max-width: 360px) { .memory-paper { padding-right: 19px; padding-left: 19px; } .memory-avatar { left: 19px; } .memory-tabs { gap: 18px; } .memory-stats b { font-size: 21px; } }
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
        refresh();
    }

    function close() {
        if (!root) return;
        root.classList.remove('is-open');
        root.setAttribute('aria-hidden', 'true');
    }

    window.MemoryApp = { init, open, close, refresh };
})();
