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
                <header class="memory-profile-header">
                    <button class="memory-back" type="button" data-memory-action="close" aria-label="返回桌面">‹</button>
                    <span class="memory-local-badge">本地档案</span>
                </header>
                <main class="memory-profile-main">
                    <div class="memory-avatar-shell">
                        <div class="memory-avatar" data-memory-avatar><img data-memory-avatar-image alt=""><span data-memory-monogram>记</span></div>
                    </div>
                    <div class="memory-heading">
                        <div class="memory-name-line"><h1 data-memory-name>记忆</h1><span data-memory-status>读取中</span></div>
                        <p data-memory-subtitle>正在读取本地档案。</p>
                    </div>
                    <div class="memory-contact-selector" data-memory-contact-selector hidden aria-label="选择角色"></div>
                    <section class="memory-stats" aria-label="记忆统计">
                        <article><b data-memory-count>0</b><span>记忆总条数</span></article>
                        <article><b data-memory-chat-count>0</b><span>共同对话</span></article>
                        <article><b data-memory-days>0</b><span>认识天数</span></article>
                    </section>
                    <section class="memory-content-card">
                        <div class="memory-card-kicker">@ memory</div>
                        <div class="memory-empty-state">
                            <span class="memory-empty-mark">✦</span>
                            <h2 data-memory-empty-title>正在读取</h2>
                            <p data-memory-empty-text>正在读取本地档案。</p>
                        </div>
                    </section>
                </main>
                <nav class="memory-tabs" role="tablist" aria-label="记忆视图">
                    <button type="button" data-memory-tab="memory" class="is-active" role="tab" aria-selected="true">记忆</button>
                    <button type="button" data-memory-tab="relationship" role="tab" aria-selected="false">关系</button>
                    <button type="button" data-memory-tab="fragment" role="tab" aria-selected="false">片段</button>
                    <button type="button" data-memory-tab="archive" role="tab" aria-selected="false">档案</button>
                </nav>
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
            .memory-app-container { position: absolute; inset: 0; z-index: 7200; display: none; overflow: hidden; background: #ececec; color: #20201d; font-family: "Noto Serif SC", "STSong", "SimSun", serif; }
            .memory-app-container.is-open { display: block; }
            .memory-app-scroll { box-sizing: border-box; display: flex; flex-direction: column; height: 100%; min-height: 100%; overflow-y: auto; overscroll-behavior: contain; padding: max(13px, env(safe-area-inset-top)) 20px calc(18px + env(safe-area-inset-bottom)); background: #ececec; }
            .memory-profile-header { display: flex; align-items: center; justify-content: space-between; min-height: 46px; }
            .memory-back { width: 42px; height: 42px; border: 0; padding: 0 0 5px; border-radius: 50%; background: rgba(255,255,255,.52); color: #202020; box-shadow: 0 2px 7px rgba(0,0,0,.035); font: 37px/37px Georgia, serif; cursor: pointer; }
            .memory-local-badge { padding: 9px 14px; border-radius: 999px; background: rgba(255,255,255,.5); color: #878787; font-size: 12px; line-height: 1; }
            .memory-profile-main { flex: 1 0 auto; display: flex; flex-direction: column; align-items: center; padding: 24px 0 16px; }
            .memory-avatar-shell { display: grid; width: 150px; height: 150px; padding: 7px; border: 5px solid #c9c9cb; border-radius: 50%; box-sizing: border-box; background: #ececec; box-shadow: 0 3px 10px rgba(0,0,0,.04); }
            .memory-avatar { width: 100%; height: 100%; border: 3px solid #f7f7f7; border-radius: 50%; overflow: hidden; box-sizing: border-box; background: #d9d5cd; display: grid; place-items: center; color: #5a544d; font-size: 43px; font-weight: 700; }
            .memory-avatar img { display: none; width: 100%; height: 100%; object-fit: cover; }
            .memory-avatar.has-image img { display: block; }
            .memory-avatar.has-image span { display: none; }
            .memory-heading { width: 100%; margin-top: 23px; text-align: center; }
            .memory-name-line { display: flex; align-items: center; justify-content: center; gap: 10px; min-width: 0; }
            .memory-name-line h1 { margin: 0; max-width: 68%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 32px; line-height: 1.25; font-weight: 700; letter-spacing: 0; }
            .memory-name-line span { padding: 5px 9px; border-radius: 999px; background: rgba(255,255,255,.56); color: #858585; font-family: "Noto Serif SC", "STSong", "SimSun", serif; font-size: 12px; line-height: 1; white-space: nowrap; }
            .memory-heading p { margin: 8px 0 0; color: #aaa9aa; font-size: 14px; line-height: 1.55; }
            .memory-contact-selector { display: flex; max-width: 100%; gap: 7px; margin: 17px 0 0; overflow-x: auto; scrollbar-width: none; }
            .memory-contact-selector::-webkit-scrollbar { display: none; }
            .memory-contact-chip { flex: 0 0 auto; border: 0; border-radius: 999px; padding: 7px 11px; background: rgba(255,255,255,.6); color: #858585; font: 12px/1.2 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-contact-chip.is-active { background: #242424; color: #fff; }
            .memory-stats { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; gap: 12px; margin-top: 28px; }
            .memory-stats article { display: grid; min-width: 0; min-height: 92px; place-content: center; padding: 10px 6px; border-radius: 24px; background: #fff; box-shadow: 0 6px 18px rgba(0,0,0,.025); text-align: center; }
            .memory-stats b { display: block; font-size: 25px; line-height: 1.05; font-variant-numeric: tabular-nums; }
            .memory-stats span { display: block; margin-top: 9px; color: #898989; font-size: 11px; white-space: nowrap; }
            .memory-content-card { display: flex; flex: 1 0 300px; flex-direction: column; width: 100%; min-height: 300px; margin-top: 23px; padding: 25px 25px 30px; border-radius: 34px; box-sizing: border-box; background: #fff; box-shadow: 0 10px 24px rgba(0,0,0,.025); }
            .memory-card-kicker { color: #b0afb0; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; font-size: 15px; font-weight: 600; letter-spacing: 0; }
            .memory-empty-state { display: grid; flex: 1; align-content: center; justify-items: center; padding: 36px 12px; text-align: center; }
            .memory-empty-mark { color: #a7a6a7; font-size: 22px; line-height: 1; }
            .memory-empty-state h2 { margin: 20px 0 0; font-size: 25px; line-height: 1.45; font-weight: 700; letter-spacing: 0; }
            .memory-empty-state p { max-width: 240px; margin: 9px 0 0; color: #929192; font-size: 14px; line-height: 1.75; }
            .memory-tabs { position: sticky; bottom: 0; display: grid; grid-template-columns: repeat(4, 1fr); width: 100%; margin: 8px 0 0; padding: 6px; border-radius: 28px; box-sizing: border-box; background: rgba(255,255,255,.94); box-shadow: 0 7px 20px rgba(0,0,0,.035); }
            .memory-tabs button { height: 44px; border: 0; border-radius: 22px; padding: 0; background: transparent; color: #8c8b8c; font: 14px/1 "Noto Serif SC", "STSong", "SimSun", serif; cursor: pointer; }
            .memory-tabs button.is-active { background: #f0f0f0; color: #232323; font-weight: 700; }
            @media (max-width: 360px) { .memory-app-scroll { padding-right: 15px; padding-left: 15px; } .memory-avatar-shell { width: 136px; height: 136px; } .memory-name-line h1 { font-size: 28px; } .memory-stats { gap: 9px; } .memory-stats article { min-height: 84px; border-radius: 21px; } .memory-stats b { font-size: 22px; } .memory-content-card { padding-right: 20px; padding-left: 20px; border-radius: 28px; } }
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
