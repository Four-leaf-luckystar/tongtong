(function () {
    'use strict';

    const STORAGE_KEY = 'tonghuajiContactsAppData';
    const DEFAULT_DATA = {
        version: 1,
        groups: [],
        contacts: [],
        users: [],
        selectedTab: 'char',
        expandedGroupIds: ['all']
    };

    let root = null;
    let data = null;
    let currentPage = 'main';
    let previousPage = null;
    let editingContactId = null;
    let editingUserId = null;
    let editingNpcId = null;
    let contactDraft = null;
    let userDraft = null;
    let npcDraft = null;
    let isEditMode = false;
    let pickerMode = null;
    let pickerSelection = [];
    let dialogConfirm = null;
    let toastTimer = null;

    function makeId(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return prefix + '_' + window.crypto.randomUUID();
        }
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeData(value) {
        const parsed = value && typeof value === 'object' ? value : {};
        return {
            version: 1,
            groups: Array.isArray(parsed.groups) ? parsed.groups.filter(Boolean) : [],
            contacts: Array.isArray(parsed.contacts) ? parsed.contacts.filter(Boolean) : [],
            users: Array.isArray(parsed.users) ? parsed.users.filter(Boolean) : [],
            selectedTab: parsed.selectedTab === 'user' ? 'user' : 'char',
            expandedGroupIds: Array.isArray(parsed.expandedGroupIds) ? parsed.expandedGroupIds : ['all']
        };
    }

    function loadData() {
        try {
            data = normalizeData(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
        } catch (error) {
            console.warn('Contacts data could not be read:', error);
            data = clone(DEFAULT_DATA);
        }
    }

    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            if (typeof window.triggerAutoLocalBackup === 'function') window.triggerAutoLocalBackup();
            return true;
        } catch (error) {
            console.error('Contacts data could not be saved:', error);
            showToast('存储空间不足，请更换较小的图片');
            return false;
        }
    }

    function emptyContact() {
        return {
            id: makeId('contact'),
            groupId: null,
            name: '',
            avatar: '',
            persona: '',
            appearance: '',
            worldbookIds: [],
            security: { account: '', password: '', paymentPassword: '', lockPassword: '', qrCode: '' },
            voice: { provider: 'minimax', minimaxVoiceId: '', elevenlabsVoiceId: '', sovitsPath: '' },
            npcs: []
        };
    }

    function normalizedContact(contact) {
        const base = emptyContact();
        const source = contact || {};
        return {
            ...base,
            ...clone(source),
            security: { ...base.security, ...(source.security || {}) },
            voice: { ...base.voice, ...(source.voice || {}) },
            worldbookIds: Array.isArray(source.worldbookIds) ? source.worldbookIds.slice() : [],
            npcs: Array.isArray(source.npcs) ? clone(source.npcs) : []
        };
    }

    function emptyUser() {
        return { id: makeId('user'), name: '', persona: '', avatar: '' };
    }

    function el(selector) {
        return root ? root.querySelector(selector) : null;
    }

    function all(selector) {
        return root ? Array.from(root.querySelectorAll(selector)) : [];
    }

    function setText(selector, text) {
        const target = el(selector);
        if (target) target.textContent = text;
    }

    function setValue(selector, value) {
        const target = el(selector);
        if (target) target.value = value || '';
    }

    function getValue(selector) {
        const target = el(selector);
        return target ? target.value : '';
    }

    function avatarContent(image, fallback) {
        if (image) {
            const img = document.createElement('img');
            img.src = image;
            img.alt = '';
            return img;
        }
        const placeholder = document.createElement('span');
        placeholder.className = 'ct-avatar-placeholder';
        placeholder.textContent = fallback || '角色';
        return placeholder;
    }

    function fillAvatar(container, image, fallback) {
        if (!container) return;
        container.replaceChildren(avatarContent(image, fallback));
    }

    function createAvatar(image, fallback) {
        const avatar = document.createElement('span');
        avatar.className = 'ct-avatar';
        avatar.appendChild(avatarContent(image, fallback));
        return avatar;
    }

    function showToast(message) {
        const toast = el('#ctToast');
        if (!toast) return;
        clearTimeout(toastTimer);
        toast.textContent = message;
        toast.classList.add('is-active');
        toastTimer = setTimeout(() => toast.classList.remove('is-active'), 1800);
    }

    function showPage(pageName, direction) {
        const next = el('[data-page="' + pageName + '"]');
        const active = el('.ct-page.is-active');
        if (!next || active === next) return;

        all('.ct-page').forEach(page => page.classList.remove('is-active', 'is-behind'));
        if (direction === 'forward' && active) active.classList.add('is-behind');
        next.classList.add('is-active');
        next.querySelector('.ct-scroll')?.scrollTo(0, 0);
        previousPage = currentPage;
        currentPage = pageName;
    }

    function goMain() {
        editingContactId = null;
        editingUserId = null;
        editingNpcId = null;
        contactDraft = null;
        userDraft = null;
        npcDraft = null;
        showPage('main', 'back');
        renderMain();
    }

    function closeApp() {
        if (currentPage !== 'main') {
            goMain();
            return;
        }
        root.classList.remove('show');
        root.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            if (!root.classList.contains('show')) root.style.display = 'none';
        }, 320);
    }

    function groupName(groupId) {
        if (!groupId) return '所有联系人';
        return data.groups.find(group => group.id === groupId)?.name || '所有联系人';
    }

    function contactCount(groupId) {
        if (groupId === 'all') return data.contacts.length;
        return data.contacts.filter(contact => contact.groupId === groupId).length;
    }

    function createGroupCard(group) {
        const groupId = group ? group.id : 'all';
        const card = document.createElement('section');
        card.className = 'ct-card ct-group';
        card.dataset.groupId = groupId;
        if (data.expandedGroupIds.includes(groupId)) card.classList.add('is-expanded');

        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'ct-group-header';
        header.dataset.action = 'toggle-group';
        header.dataset.groupId = groupId;

        const title = document.createElement('span');
        title.className = 'ct-group-title';
        title.innerHTML = '<svg class="ct-group-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-4.67 0-7 2.34-7 3.5V19h14v-2.5C15 15.34 12.67 13 8 13Zm8 0c-.35 0-.7.02-1.06.06 1.23.9 2.06 2.04 2.06 3.44V19h6v-2.5c0-1.16-2.33-3.5-7-3.5Z"/></svg>';
        const name = document.createElement('span');
        name.textContent = group ? group.name : '所有联系人';
        title.appendChild(name);

        const count = document.createElement('span');
        count.className = 'ct-group-count';
        count.textContent = String(contactCount(groupId));
        header.append(title, count);

        if (group) {
            const remove = document.createElement('span');
            remove.className = 'ct-group-delete';
            remove.dataset.action = 'delete-group';
            remove.dataset.groupId = groupId;
            remove.textContent = '−';
            header.appendChild(remove);
        }

        const chevron = document.createElement('span');
        chevron.className = 'ct-chevron';
        chevron.textContent = '›';
        header.appendChild(chevron);

        const body = document.createElement('div');
        body.className = 'ct-group-body';
        const contacts = groupId === 'all' ? data.contacts : data.contacts.filter(contact => contact.groupId === groupId);
        if (!contacts.length) {
            const empty = document.createElement('div');
            empty.className = 'ct-empty';
            empty.textContent = '暂无角色';
            body.appendChild(empty);
        } else {
            contacts.forEach(contact => body.appendChild(createContactRow(contact)));
        }

        card.append(header, body);
        return card;
    }

    function createContactRow(contact) {
        const row = document.createElement('div');
        row.className = 'ct-contact-row';
        row.dataset.action = 'open-contact';
        row.dataset.contactId = contact.id;

        const remove = document.createElement('span');
        remove.className = 'ct-delete-dot';
        remove.textContent = '−';
        row.append(remove, createAvatar(contact.avatar, '角色'));

        const name = document.createElement('span');
        name.className = 'ct-contact-name';
        name.textContent = contact.name || '未命名角色';
        row.appendChild(name);
        return row;
    }

    function renderGroups() {
        const list = el('#ctGroupsList');
        if (!list) return;
        list.replaceChildren(createGroupCard(null), ...data.groups.map(createGroupCard));
        list.classList.toggle('is-editing', isEditMode);
        el('.ct-main-scroll')?.classList.toggle('is-editing', isEditMode);
    }

    function createUserCard(user) {
        const card = document.createElement('div');
        card.className = 'ct-card ct-user-card';
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'ct-user-row';
        row.dataset.action = 'open-user';
        row.dataset.userId = user.id;
        const main = document.createElement('span');
        main.className = 'ct-user-main';
        main.appendChild(createAvatar(user.avatar, 'User'));
        const name = document.createElement('span');
        name.className = 'ct-contact-name';
        name.textContent = user.name || '未命名 User';
        main.appendChild(name);
        const chevron = document.createElement('span');
        chevron.className = 'ct-chevron';
        chevron.textContent = '›';
        row.append(main, chevron);
        card.appendChild(row);
        return card;
    }

    function renderUsers() {
        const list = el('#ctUsersList');
        if (!list) return;
        if (!data.users.length) {
            const empty = document.createElement('div');
            empty.className = 'ct-empty';
            empty.style.padding = '40px 0';
            empty.style.textAlign = 'center';
            empty.textContent = '暂无 User 信息，请点击右上角添加';
            list.replaceChildren(empty);
            return;
        }
        list.replaceChildren(...data.users.map(createUserCard));
    }

    function switchTab(tab) {
        data.selectedTab = tab === 'user' ? 'user' : 'char';
        isEditMode = false;
        persist();
        renderMain();
    }

    function renderMain() {
        all('[data-view]').forEach(view => view.classList.toggle('is-active', view.dataset.view === data.selectedTab));
        all('[data-action="switch-tab"]').forEach(button => button.classList.toggle('is-active', button.dataset.tab === data.selectedTab));
        const editButton = el('[data-action="toggle-edit"]');
        if (editButton) {
            editButton.textContent = isEditMode ? '完成' : '编辑';
            editButton.style.visibility = data.selectedTab === 'char' ? 'visible' : 'hidden';
        }
        renderGroups();
        renderUsers();
    }

    function toggleGroup(groupId) {
        const index = data.expandedGroupIds.indexOf(groupId);
        if (index >= 0) data.expandedGroupIds.splice(index, 1);
        else data.expandedGroupIds.push(groupId);
        persist();
        renderGroups();
    }

    function openContact(contactId) {
        const existing = contactId ? data.contacts.find(contact => contact.id === contactId) : null;
        editingContactId = existing ? existing.id : null;
        contactDraft = normalizedContact(existing || emptyContact());
        setText('#ctContactEditorTitle', existing ? '编辑角色' : '新建角色');
        setValue('#ctContactName', contactDraft.name);
        setValue('#ctContactPersona', contactDraft.persona);
        setValue('#ctContactAppearance', contactDraft.appearance);
        setValue('#ctSecurityAccount', contactDraft.security.account);
        setValue('#ctSecurityPassword', contactDraft.security.password);
        setValue('#ctSecurityPayment', contactDraft.security.paymentPassword);
        setValue('#ctSecurityLock', contactDraft.security.lockPassword);
        setValue('#ctVoiceMinimax', contactDraft.voice.minimaxVoiceId);
        setValue('#ctVoiceElevenlabs', contactDraft.voice.elevenlabsVoiceId);
        setValue('#ctVoiceSovits', contactDraft.voice.sovitsPath);
        setText('#ctSelectedGroup', groupName(contactDraft.groupId));
        updateWorldbookStatus();
        fillAvatar(el('#ctContactAvatarPreview'), contactDraft.avatar, '角色');
        renderQr();
        renderNpcs();
        el('#ctDeleteContactButton')?.classList.toggle('is-visible', Boolean(existing));
        switchEditorSection('persona');
        switchVoiceProvider(contactDraft.voice.provider || 'minimax');
        showPage('contact-editor', 'forward');
    }

    function syncContactDraft() {
        if (!contactDraft) return;
        contactDraft.name = getValue('#ctContactName').trim();
        contactDraft.persona = getValue('#ctContactPersona');
        contactDraft.appearance = getValue('#ctContactAppearance');
        contactDraft.security.account = getValue('#ctSecurityAccount');
        contactDraft.security.password = getValue('#ctSecurityPassword');
        contactDraft.security.paymentPassword = getValue('#ctSecurityPayment');
        contactDraft.security.lockPassword = getValue('#ctSecurityLock');
        contactDraft.voice.minimaxVoiceId = getValue('#ctVoiceMinimax');
        contactDraft.voice.elevenlabsVoiceId = getValue('#ctVoiceElevenlabs');
        contactDraft.voice.sovitsPath = getValue('#ctVoiceSovits');
    }

    function saveContact() {
        syncContactDraft();
        if (!contactDraft?.name) {
            showToast('请输入角色名称');
            el('#ctContactName')?.focus();
            return;
        }
        const index = data.contacts.findIndex(contact => contact.id === editingContactId);
        if (index >= 0) data.contacts[index] = clone(contactDraft);
        else data.contacts.push(clone(contactDraft));
        if (!data.expandedGroupIds.includes(contactDraft.groupId || 'all')) data.expandedGroupIds.push(contactDraft.groupId || 'all');
        persist();
        showToast('已保存联系人');
        goMain();
    }

    function switchEditorSection(section) {
        all('[data-action="switch-section"]').forEach(button => button.classList.toggle('is-active', button.dataset.section === section));
        all('[data-section-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.sectionPanel === section));
    }

    function switchVoiceProvider(provider) {
        if (contactDraft) contactDraft.voice.provider = provider;
        all('[data-action="voice-provider"]').forEach(button => button.classList.toggle('is-active', button.dataset.provider === provider));
        all('[data-provider-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.providerPanel === provider));
    }

    function openUser(userId) {
        const existing = userId ? data.users.find(user => user.id === userId) : null;
        editingUserId = existing ? existing.id : null;
        userDraft = clone(existing || emptyUser());
        setText('#ctUserEditorTitle', existing ? '编辑 User' : '新建 User');
        setValue('#ctUserName', userDraft.name);
        setValue('#ctUserPersona', userDraft.persona);
        fillAvatar(el('#ctUserAvatarPreview'), userDraft.avatar, 'User');
        el('#ctDeleteUserButton')?.classList.toggle('is-visible', Boolean(existing));
        showPage('user-editor', 'forward');
    }

    function saveUser() {
        if (!userDraft) return;
        userDraft.name = getValue('#ctUserName').trim();
        userDraft.persona = getValue('#ctUserPersona');
        if (!userDraft.name) {
            showToast('请输入 User 名称');
            el('#ctUserName')?.focus();
            return;
        }
        const index = data.users.findIndex(user => user.id === editingUserId);
        if (index >= 0) data.users[index] = clone(userDraft);
        else data.users.push(clone(userDraft));
        persist();
        showToast('已保存 User');
        goMain();
    }

    function renderNpcs() {
        const list = el('#ctNpcList');
        if (!list || !contactDraft) return;
        const rows = contactDraft.npcs.map(npc => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'ct-npc-row';
            row.dataset.action = 'edit-npc';
            row.dataset.npcId = npc.id;
            const main = document.createElement('span');
            main.className = 'ct-npc-main';
            main.appendChild(createAvatar('', 'NPC'));
            const text = document.createElement('span');
            const name = document.createElement('span');
            name.className = 'ct-contact-name';
            name.textContent = npc.name || '未命名 NPC';
            const role = document.createElement('span');
            role.className = 'ct-npc-sub';
            role.textContent = npc.role || '未知身份';
            text.append(name, role);
            main.appendChild(text);
            const chevron = document.createElement('span');
            chevron.className = 'ct-chevron';
            chevron.textContent = '›';
            row.append(main, chevron);
            return row;
        });
        list.replaceChildren(...rows);
    }

    function openNpc(npcId) {
        syncContactDraft();
        const existing = npcId ? contactDraft?.npcs.find(npc => npc.id === npcId) : null;
        editingNpcId = existing ? existing.id : null;
        npcDraft = clone(existing || { id: makeId('npc'), name: '', role: '', persona: '' });
        setText('#ctNpcEditorTitle', existing ? '编辑 NPC' : '新建 NPC');
        setValue('#ctNpcName', npcDraft.name);
        setValue('#ctNpcRole', npcDraft.role);
        setValue('#ctNpcPersona', npcDraft.persona);
        el('#ctDeleteNpcButton')?.classList.toggle('is-visible', Boolean(existing));
        showPage('npc-editor', 'forward');
    }

    function saveNpc() {
        if (!contactDraft || !npcDraft) return;
        npcDraft.name = getValue('#ctNpcName').trim();
        npcDraft.role = getValue('#ctNpcRole').trim();
        npcDraft.persona = getValue('#ctNpcPersona');
        if (!npcDraft.name) {
            showToast('请输入 NPC 名称');
            el('#ctNpcName')?.focus();
            return;
        }
        const index = contactDraft.npcs.findIndex(npc => npc.id === editingNpcId);
        if (index >= 0) contactDraft.npcs[index] = clone(npcDraft);
        else contactDraft.npcs.push(clone(npcDraft));
        renderNpcs();
        showPage('contact-editor', 'back');
        switchEditorSection('npc');
        showToast('已保存 NPC');
    }

    function availableWorldbooks() {
        if (typeof window.getWorldbookGroups !== 'function') return [];
        return window.getWorldbookGroups().map(group => ({ id: group.id, name: group.name || '未命名世界书' }));
    }

    function updateWorldbookStatus() {
        const count = contactDraft?.worldbookIds?.length || 0;
        setText('#ctWorldbookStatus', count ? '已选 ' + count + ' 项' : '未选择');
    }

    function openPicker(mode) {
        pickerMode = mode;
        const list = el('#ctPickerList');
        const overlay = el('#ctPickerOverlay');
        if (!list || !overlay || !contactDraft) return;
        list.replaceChildren();

        let choices = [];
        if (mode === 'group') {
            setText('#ctPickerTitle', '选择分组');
            pickerSelection = [contactDraft.groupId || 'all'];
            choices = [{ id: 'all', name: '所有联系人' }, ...data.groups];
        } else {
            setText('#ctPickerTitle', '选择世界书');
            pickerSelection = contactDraft.worldbookIds.slice();
            choices = availableWorldbooks();
        }

        if (!choices.length) {
            const empty = document.createElement('div');
            empty.className = 'ct-picker-empty';
            empty.textContent = '暂无可选择的世界书';
            list.appendChild(empty);
        } else {
            choices.forEach(choice => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'ct-picker-item';
                item.dataset.action = 'picker-item';
                item.dataset.id = choice.id;
                item.classList.toggle('is-selected', pickerSelection.includes(choice.id));
                const name = document.createElement('span');
                name.textContent = choice.name;
                const check = document.createElement('span');
                check.className = 'ct-picker-check';
                check.textContent = '✓';
                item.append(name, check);
                list.appendChild(item);
            });
        }
        overlay.classList.add('is-active');
        overlay.setAttribute('aria-hidden', 'false');
    }

    function togglePickerItem(id, button) {
        if (pickerMode === 'group') {
            pickerSelection = [id];
            all('.ct-picker-item').forEach(item => item.classList.toggle('is-selected', item.dataset.id === id));
            return;
        }
        const index = pickerSelection.indexOf(id);
        if (index >= 0) pickerSelection.splice(index, 1);
        else pickerSelection.push(id);
        button.classList.toggle('is-selected', pickerSelection.includes(id));
    }

    function closePicker() {
        const overlay = el('#ctPickerOverlay');
        overlay?.classList.remove('is-active');
        overlay?.setAttribute('aria-hidden', 'true');
    }

    function confirmPicker() {
        if (!contactDraft) return closePicker();
        if (pickerMode === 'group') {
            contactDraft.groupId = pickerSelection[0] === 'all' ? null : pickerSelection[0];
            setText('#ctSelectedGroup', groupName(contactDraft.groupId));
        } else {
            contactDraft.worldbookIds = pickerSelection.slice();
            updateWorldbookStatus();
        }
        closePicker();
    }

    function showDialog(options) {
        const overlay = el('#ctDialogOverlay');
        const dialog = overlay?.querySelector('.ct-dialog');
        if (!overlay || !dialog) return;
        setText('#ctDialogTitle', options.title || '提示');
        setText('#ctDialogMessage', options.message || '');
        const input = el('#ctDialogInput');
        dialog.classList.toggle('has-input', Boolean(options.input));
        if (input) {
            input.value = options.value || '';
            input.placeholder = options.placeholder || '';
        }
        dialogConfirm = options.onConfirm || null;
        overlay.classList.add('is-active');
        overlay.setAttribute('aria-hidden', 'false');
        if (options.input) setTimeout(() => input?.focus(), 80);
    }

    function closeDialog() {
        const overlay = el('#ctDialogOverlay');
        overlay?.classList.remove('is-active');
        overlay?.setAttribute('aria-hidden', 'true');
        dialogConfirm = null;
    }

    function confirmDialog() {
        const callback = dialogConfirm;
        const value = getValue('#ctDialogInput').trim();
        if (callback && callback(value) === false) return;
        closeDialog();
    }

    function addGroup() {
        showDialog({
            title: '新建联系人分组',
            message: '输入分组名称',
            input: true,
            placeholder: '分组名称',
            onConfirm: name => {
                if (!name) { showToast('分组名称不能为空'); return false; }
                if (data.groups.some(group => group.name === name)) { showToast('分组名称已存在'); return false; }
                const group = { id: makeId('group'), name };
                data.groups.push(group);
                data.expandedGroupIds.push(group.id);
                persist();
                renderGroups();
                showToast('已创建分组');
                return true;
            }
        });
    }

    function deleteGroup(groupId) {
        const group = data.groups.find(item => item.id === groupId);
        if (!group) return;
        showDialog({
            title: '删除分组',
            message: '删除“' + group.name + '”后，组内联系人将移到“所有联系人”。',
            onConfirm: () => {
                data.groups = data.groups.filter(item => item.id !== groupId);
                data.contacts.forEach(contact => { if (contact.groupId === groupId) contact.groupId = null; });
                data.expandedGroupIds = data.expandedGroupIds.filter(id => id !== groupId);
                persist();
                renderGroups();
                showToast('已删除分组');
            }
        });
    }

    function deleteContact() {
        if (!editingContactId) return;
        showDialog({
            title: '删除联系人',
            message: '确定删除“' + (contactDraft?.name || '该联系人') + '”吗？',
            onConfirm: () => {
                data.contacts = data.contacts.filter(contact => contact.id !== editingContactId);
                persist();
                showToast('已删除联系人');
                goMain();
            }
        });
    }

    function deleteUser() {
        if (!editingUserId) return;
        showDialog({
            title: '删除 User',
            message: '确定删除“' + (userDraft?.name || '该 User') + '”吗？',
            onConfirm: () => {
                data.users = data.users.filter(user => user.id !== editingUserId);
                persist();
                showToast('已删除 User');
                goMain();
            }
        });
    }

    function deleteNpc() {
        if (!editingNpcId || !contactDraft) return;
        showDialog({
            title: '删除 NPC',
            message: '确定删除“' + (npcDraft?.name || '该 NPC') + '”吗？',
            onConfirm: () => {
                contactDraft.npcs = contactDraft.npcs.filter(npc => npc.id !== editingNpcId);
                renderNpcs();
                showPage('contact-editor', 'back');
                switchEditorSection('npc');
                showToast('已删除 NPC');
            }
        });
    }

    function renderQr() {
        const preview = el('#ctQrPreview');
        if (!preview || !contactDraft) return;
        preview.replaceChildren();
        if (contactDraft.security.qrCode) {
            const image = document.createElement('img');
            image.src = contactDraft.security.qrCode;
            image.alt = '专属二维码';
            preview.appendChild(image);
        } else {
            const symbol = document.createElement('span');
            symbol.textContent = '▦';
            symbol.style.fontSize = '42px';
            symbol.style.color = '#777b80';
            preview.appendChild(symbol);
        }
    }

    function fileToImage(file, maxSize) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) return reject(new Error('invalid image'));
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error || new Error('read failed'));
            reader.onload = () => {
                const image = new Image();
                image.onerror = () => reject(new Error('decode failed'));
                image.onload = () => {
                    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(image.width * scale));
                    canvas.height = Math.max(1, Math.round(image.height * scale));
                    const context = canvas.getContext('2d');
                    context.drawImage(image, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.82));
                };
                image.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function handleImageInput(input, target) {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        try {
            const image = await fileToImage(file, target === 'qr' ? 720 : 420);
            if (target === 'contact' && contactDraft) {
                contactDraft.avatar = image;
                fillAvatar(el('#ctContactAvatarPreview'), image, '角色');
            } else if (target === 'user' && userDraft) {
                userDraft.avatar = image;
                fillAvatar(el('#ctUserAvatarPreview'), image, 'User');
            } else if (target === 'qr' && contactDraft) {
                contactDraft.security.qrCode = image;
                renderQr();
            }
        } catch (error) {
            console.warn('Contacts image could not be loaded:', error);
            showToast('图片读取失败');
        }
    }

    function handleAction(actionElement, event) {
        const action = actionElement.dataset.action;
        switch (action) {
            case 'close-app': closeApp(); break;
            case 'switch-tab': switchTab(actionElement.dataset.tab); break;
            case 'toggle-edit': isEditMode = !isEditMode; renderMain(); break;
            case 'add-current': data.selectedTab === 'char' ? openContact(null) : openUser(null); break;
            case 'add-group': addGroup(); break;
            case 'toggle-group': toggleGroup(actionElement.dataset.groupId); break;
            case 'delete-group': event.stopPropagation(); deleteGroup(actionElement.dataset.groupId); break;
            case 'open-contact':
                if (isEditMode) {
                    editingContactId = actionElement.dataset.contactId;
                    contactDraft = normalizedContact(data.contacts.find(contact => contact.id === editingContactId));
                    deleteContact();
                } else openContact(actionElement.dataset.contactId);
                break;
            case 'open-user': openUser(actionElement.dataset.userId); break;
            case 'back-main': goMain(); break;
            case 'save-contact': saveContact(); break;
            case 'switch-section': switchEditorSection(actionElement.dataset.section); break;
            case 'choose-group': syncContactDraft(); openPicker('group'); break;
            case 'choose-worldbooks': syncContactDraft(); openPicker('worldbook'); break;
            case 'open-voice': syncContactDraft(); showPage('voice', 'forward'); break;
            case 'open-appearance': syncContactDraft(); showPage('appearance', 'forward'); break;
            case 'back-contact': syncContactDraft(); showPage('contact-editor', 'back'); break;
            case 'voice-provider': switchVoiceProvider(actionElement.dataset.provider); break;
            case 'add-npc': openNpc(null); break;
            case 'edit-npc': openNpc(actionElement.dataset.npcId); break;
            case 'cancel-npc': showPage('contact-editor', 'back'); switchEditorSection('npc'); break;
            case 'save-npc': saveNpc(); break;
            case 'save-user': saveUser(); break;
            case 'delete-contact': deleteContact(); break;
            case 'delete-user': deleteUser(); break;
            case 'delete-npc': deleteNpc(); break;
            case 'pick-contact-avatar': el('#ctContactAvatarInput')?.click(); break;
            case 'pick-user-avatar': el('#ctUserAvatarInput')?.click(); break;
            case 'pick-contact-qr': el('#ctQrInput')?.click(); break;
            case 'picker-item': togglePickerItem(actionElement.dataset.id, actionElement); break;
            case 'close-picker': closePicker(); break;
            case 'confirm-picker': confirmPicker(); break;
            case 'cancel-dialog': closeDialog(); break;
            case 'confirm-dialog': confirmDialog(); break;
        }
    }

    function bindEvents() {
        root.addEventListener('click', event => {
            const actionElement = event.target.closest('[data-action]');
            if (actionElement && root.contains(actionElement)) handleAction(actionElement, event);
        });
        el('#ctContactAvatarInput')?.addEventListener('change', event => handleImageInput(event.target, 'contact'));
        el('#ctUserAvatarInput')?.addEventListener('change', event => handleImageInput(event.target, 'user'));
        el('#ctQrInput')?.addEventListener('change', event => handleImageInput(event.target, 'qr'));
        el('#ctDialogInput')?.addEventListener('keydown', event => {
            if (event.key === 'Enter') confirmDialog();
        });
    }

    function init(container) {
        root = container || document.getElementById('contactsAppUI');
        if (!root || root.dataset.initialized === 'true') return;
        loadData();
        bindEvents();
        renderMain();
        root.dataset.initialized = 'true';
    }

    function open() {
        if (!root) init(document.getElementById('contactsAppUI'));
        if (!root) return;
        if (!data) loadData();
        renderMain();
        root.style.display = 'block';
        root.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => root.classList.add('show'));
    }

    window.ContactsApp = { init, open, close: closeApp };
})();
