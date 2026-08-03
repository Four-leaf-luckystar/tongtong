(function () {
    'use strict';

    const DB_NAME = 'iOSDesktopDB';
    const STORE_NAME = 'layoutStore';
    const DATA_ID = 'meetingAppData';
    const CONTACTS_ID = 'contactsAppData';
    const EMPTY_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" fill="%23d1d1d6"/%3E%3Ccircle cx="32" cy="24" r="12" fill="%238e8e93"/%3E%3Cpath d="M10 58c2-14 11-21 22-21s20 7 22 21" fill="%238e8e93"/%3E%3C/svg%3E';

    let root;
    let recordsEl;
    let inputEl;
    let sendEl;
    let sheetEl;
    let sheetContentEl;
    let state = { version: 1, activeRecordId: null, records: [] };
    let contacts = [];
    let users = [];
    let sending = false;

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function makeId(prefix) {
        return prefix + '_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2));
    }

    function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => reject(request.error || new Error('见面数据无法打开'));
            request.onupgradeneeded = event => {
                const connection = event.target.result;
                if (!connection.objectStoreNames.contains(STORE_NAME)) connection.createObjectStore(STORE_NAME, { keyPath: 'id' });
            };
            request.onsuccess = () => resolve(request.result);
        });
    }

    async function readRecord(id) {
        const connection = await openDb();
        return new Promise((resolve, reject) => {
            const transaction = connection.transaction([STORE_NAME], 'readonly');
            const request = transaction.objectStore(STORE_NAME).get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('见面数据读取失败'));
            transaction.oncomplete = () => connection.close();
        });
    }

    async function writeRecord(id, data) {
        const connection = await openDb();
        return new Promise((resolve, reject) => {
            const transaction = connection.transaction([STORE_NAME], 'readwrite');
            transaction.objectStore(STORE_NAME).put({ id, data });
            transaction.oncomplete = () => {
                connection.close();
                if (typeof window.triggerAutoLocalBackup === 'function') window.triggerAutoLocalBackup();
                resolve();
            };
            transaction.onerror = () => {
                connection.close();
                reject(transaction.error || new Error('见面数据保存失败'));
            };
        });
    }

    function normaliseState(value) {
        const source = value && typeof value === 'object' ? value : {};
        const records = Array.isArray(source.records) ? source.records.filter(record => record && record.id && record.contactId).map(record => ({
            id: String(record.id),
            contactId: String(record.contactId),
            title: String(record.title || ''),
            createdAt: Number(record.createdAt) || Date.now(),
            updatedAt: Number(record.updatedAt) || Date.now(),
            messages: Array.isArray(record.messages) ? record.messages.filter(message => message && message.role && message.text).map(message => ({
                id: String(message.id || makeId('message')),
                role: message.role === 'assistant' ? 'assistant' : 'user',
                text: String(message.text),
                createdAt: Number(message.createdAt) || Date.now()
            })) : []
        })) : [];
        const activeRecordId = records.some(record => record.id === source.activeRecordId) ? source.activeRecordId : (records[0]?.id || null);
        return { version: 1, activeRecordId, records };
    }

    async function loadData() {
        const [meetingRecord, contactsRecord] = await Promise.all([readRecord(DATA_ID), readRecord(CONTACTS_ID)]);
        state = normaliseState(meetingRecord?.data);
        const contactData = contactsRecord?.data || {};
        contacts = Array.isArray(contactData.contacts) ? contactData.contacts.filter(contact => contact?.id && contact?.name) : [];
        users = Array.isArray(contactData.users) ? contactData.users.filter(user => user?.id) : [];
    }

    function persist() {
        return writeRecord(DATA_ID, clone(state)).catch(error => {
            console.error('Meeting data could not be saved:', error);
            notify('见面记录保存失败，请稍后重试');
            throw error;
        });
    }

    function activeRecord() {
        return state.records.find(record => record.id === state.activeRecordId) || null;
    }

    function contactFor(record) {
        return contacts.find(contact => contact.id === record?.contactId) || null;
    }

    function userProfile() {
        const configuredId = typeof appSettings !== 'undefined' ? appSettings.wc_current_user_id : null;
        return users.find(user => user.id === configuredId) || users[0] || { name: '我', persona: '', avatar: '' };
    }

    function avatar(value) {
        return String(value || EMPTY_AVATAR);
    }

    function formattedTime(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function notify(message) {
        if (typeof window.showToast === 'function') window.showToast(message);
        else alert(message);
    }

    function updateHeader() {
        const record = activeRecord();
        const contact = contactFor(record);
        const avatarEl = root.querySelector('#meetingHeaderAvatar');
        const nameEl = root.querySelector('#meetingHeaderName');
        const metaEl = root.querySelector('#meetingHeaderMeta');
        avatarEl.src = avatar(contact?.avatar);
        nameEl.textContent = contact?.name || '见面';
        metaEl.textContent = contact ? (record?.title || '线下见面记录') : '选择联系人开始一段见面';
    }

    function renderMessages() {
        const record = activeRecord();
        recordsEl.replaceChildren();
        updateHeader();
        inputEl.disabled = !record || sending;
        sendEl.disabled = !record || sending;
        inputEl.placeholder = record ? '写下此刻想说的话' : '请先选择联系人';

        if (!record) {
            const empty = document.createElement('section');
            empty.className = 'meeting-empty';
            empty.innerHTML = '<strong>从一场真实的见面开始</strong><span>选择联系人后，见面过程会单独保存。</span><button class="meeting-primary" type="button" data-meeting-action="open-picker">选择联系人</button>';
            recordsEl.appendChild(empty);
            return;
        }

        const contact = contactFor(record);
        const user = userProfile();
        if (!record.messages.length) {
            const empty = document.createElement('section');
            empty.className = 'meeting-empty';
            empty.innerHTML = '<strong>见面已经开始</strong><span>写下第一句话，已连接的模型会以对方的角色设定回应。</span>';
            recordsEl.appendChild(empty);
        }
        record.messages.forEach(message => {
            const isUser = message.role === 'user';
            const card = document.createElement('article');
            card.className = 'meeting-message' + (isUser ? ' is-user' : '');
            const head = document.createElement('div');
            head.className = 'meeting-message-head';
            const image = document.createElement('img');
            image.src = avatar(isUser ? user.avatar : contact?.avatar);
            image.alt = '';
            const name = document.createElement('strong');
            name.textContent = isUser ? (user.name || '我') : (contact?.name || '对方');
            const time = document.createElement('time');
            time.textContent = formattedTime(message.createdAt);
            head.append(image, name, time);
            const text = document.createElement('div');
            text.className = 'meeting-message-text';
            text.textContent = message.text;
            card.append(head, text);
            recordsEl.appendChild(card);
        });
        requestAnimationFrame(() => { recordsEl.scrollTop = recordsEl.scrollHeight; });
    }

    function closeSheet() {
        sheetEl.classList.remove('is-visible');
        sheetEl.setAttribute('aria-hidden', 'true');
    }

    function openSheet(title, content) {
        root.querySelector('#meetingSheetTitle').textContent = title;
        sheetContentEl.replaceChildren(content);
        sheetEl.classList.add('is-visible');
        sheetEl.setAttribute('aria-hidden', 'false');
    }

    function openPicker() {
        const list = document.createElement('div');
        list.className = 'meeting-contact-list';
        if (!contacts.length) {
            list.innerHTML = '<div class="meeting-empty"><strong>还没有联系人</strong><span>请先在 Contacts 中创建角色。</span></div>';
        } else {
            contacts.forEach(contact => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'meeting-contact-choice';
                button.innerHTML = '<img alt=""><span><strong></strong><small></small></span>';
                button.querySelector('img').src = avatar(contact.avatar);
                button.querySelector('strong').textContent = contact.name;
                button.querySelector('small').textContent = String(contact.persona || '未填写角色设定').replace(/\s+/g, ' ').slice(0, 60);
                button.addEventListener('click', () => createRecord(contact));
                list.appendChild(button);
            });
        }
        openSheet('选择联系人', list);
    }

    async function createRecord(contact) {
        const record = { id: makeId('meeting'), contactId: contact.id, title: '新的见面', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
        state.records.unshift(record);
        state.activeRecordId = record.id;
        await persist();
        closeSheet();
        renderMessages();
        inputEl.focus();
    }

    function openHistory() {
        const list = document.createElement('div');
        list.className = 'meeting-history';
        if (!state.records.length) {
            list.innerHTML = '<div class="meeting-empty"><strong>还没有见面记录</strong></div>';
        } else {
            state.records.slice().sort((left, right) => right.updatedAt - left.updatedAt).forEach(record => {
                const contact = contactFor(record);
                const button = document.createElement('button');
                button.type = 'button';
                const title = document.createElement('span');
                title.textContent = contact ? `${contact.name} · ${record.title}` : record.title;
                const time = document.createElement('small');
                time.textContent = formattedTime(record.updatedAt);
                button.append(title, time);
                button.addEventListener('click', async () => {
                    state.activeRecordId = record.id;
                    await persist();
                    closeSheet();
                    renderMessages();
                });
                list.appendChild(button);
            });
        }
        openSheet('见面记录', list);
    }

    function completionUrl(value) {
        const url = String(value || '').trim().replace(/\/+$/, '');
        return /\/chat\/completions$/i.test(url) ? url : url + '/chat/completions';
    }

    async function requestReply(record, contact) {
        const api = typeof apiDataList !== 'undefined' ? apiDataList.find(item => item.id === apiConnectedId) : null;
        if (!api?.url || !api?.key || !api?.model) throw new Error('请先在 API 连接中配置并连接一个模型');
        const user = userProfile();
        const history = record.messages.slice(-40).map(message => ({ role: message.role, content: message.text }));
        const system = [
            `你正在扮演${contact.name}，场景是与${user.name || 'User'}线下面对面见面。`,
            '这是虚构角色扮演。请保持角色一致，用自然的中文回应，不要提及自己是 AI，也不要虚构用户没有给出的事实。',
            '可在回答中自然描述当下的动作、表情或环境，但不要替用户决定行动。',
            contact.persona ? `角色设定：${contact.persona}` : '',
            user.persona ? `对方设定：${user.persona}` : ''
        ].filter(Boolean).join('\n\n');
        const payload = { model: api.model, temperature: api.temperature !== undefined ? api.temperature : 0.8, messages: [{ role: 'system', content: system }, ...history] };
        const response = await fetch(completionUrl(api.url), { method: 'POST', headers: { Authorization: 'Bearer ' + api.key, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error('API 请求失败：HTTP ' + response.status);
        const result = await response.json();
        const content = result?.choices?.[0]?.message?.content ?? result?.choices?.[0]?.text ?? result?.output_text;
        if (!String(content || '').trim()) throw new Error('API 没有返回可显示的内容');
        return String(content).trim();
    }

    async function sendMessage() {
        const record = activeRecord();
        const text = inputEl.value.trim();
        if (!record) return openPicker();
        if (!text || sending) return;
        const contact = contactFor(record);
        if (!contact) return notify('对应联系人已不存在，请新建一场见面');
        sending = true;
        record.messages.push({ id: makeId('message'), role: 'user', text, createdAt: Date.now() });
        record.updatedAt = Date.now();
        inputEl.value = '';
        resizeInput();
        renderMessages();
        try {
            await persist();
            const reply = await requestReply(record, contact);
            record.messages.push({ id: makeId('message'), role: 'assistant', text: reply, createdAt: Date.now() });
            record.updatedAt = Date.now();
            await persist();
        } catch (error) {
            console.error('Meeting API request failed:', error);
            notify(error.message || '回复生成失败，请稍后重试');
        } finally {
            sending = false;
            renderMessages();
        }
    }

    function resizeInput() {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 106) + 'px';
    }

    function close() {
        closeSheet();
        root.classList.remove('is-open');
        root.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            if (!root.classList.contains('is-open')) root.style.display = 'none';
            if (typeof window.syncStatusBarAfterReturnHome === 'function') window.syncStatusBarAfterReturnHome();
        }, 220);
    }

    async function open() {
        if (!root) return;
        await loadData();
        root.style.display = 'flex';
        root.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => root.classList.add('is-open'));
        renderMessages();
    }

    function init() {
        root = document.getElementById('meetingAppUI');
        if (!root) return;
        recordsEl = root.querySelector('#meetingRecords');
        inputEl = root.querySelector('#meetingInput');
        sendEl = root.querySelector('#meetingSend');
        sheetEl = root.querySelector('#meetingSheet');
        sheetContentEl = root.querySelector('#meetingSheetContent');
        root.addEventListener('click', event => {
            if (event.target === sheetEl) closeSheet();
            const action = event.target.closest('[data-meeting-action]')?.dataset.meetingAction;
            if (action === 'close') close();
            if (action === 'open-picker') openPicker();
            if (action === 'open-history') openHistory();
            if (action === 'close-sheet') closeSheet();
        });
        root.querySelector('#meetingCompose').addEventListener('submit', event => { event.preventDefault(); void sendMessage(); });
        inputEl.addEventListener('input', resizeInput);
        inputEl.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
            }
        });
    }

    init();
    window.MeetingApp = { open, close };
    window.openMeetingApp = open;
    window.closeMeetingApp = close;
})();
