(function () {
    'use strict';

    const DATA_KEY = 'readerAppData';
    const DB_NAME = 'iOSDesktopDB';
    const STORE_NAME = 'layoutStore';
    const DEFAULT_PREFERENCES = {
        fontSize: 18,
        lineHeight: 1.82,
        paddingX: 24,
        paragraphSpacing: 1.05,
        fontFamily: 'system',
        backgroundColor: '#ffffff',
        textColor: '#171717',
        nightMode: false,
        sortMode: 'recent',
        ttsEnabled: false,
        ttsRate: 1
    };
    const DEFAULT_DATA = { version: 2, books: [], preferences: DEFAULT_PREFERENCES, readingMsByDay: {} };
    let root;
    let data = null;
    let activeView = 'home';
    let activeBookId = null;
    let sessionStartedAt = 0;
    let persistTimer = null;
    let readerChromeVisible = false;
    let readerToolbarTimer = null;
    let selectionMenuTimer = null;
    let suppressReaderChromeTapUntil = 0;
    let activeSelectionContext = null;
    let searchMatches = [];
    let currentMatch = -1;

    function clone(value) { return JSON.parse(JSON.stringify(value)); }
    function makeId(prefix) {
        return prefix + '_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(16).slice(2));
    }
    function escapeHtml(value) {
        const element = document.createElement('div');
        element.textContent = value == null ? '' : String(value);
        return element.innerHTML;
    }
    function getBook(bookId) { return data.books.find(book => book.id === bookId); }
    function getDayKey(date) { return date.toISOString().slice(0, 10); }
    function getShelfGroup(book) { return String(book.shelfGroup || '默认').trim() || '默认'; }
    function getBookmarks(book) { return Array.isArray(book.bookmarks) ? book.bookmarks : []; }
    function getNotes(book) { return Array.isArray(book.notes) ? book.notes : []; }
    function getAnnotations(book) { return Array.isArray(book.annotations) ? book.annotations : []; }
    function getBookTags(book) {
        const source = book.tags ?? book.tag ?? [];
        const rawTags = Array.isArray(source) ? source : typeof source === 'string' ? source.split(/[，,]/) : [];
        return rawTags.map(tag => String(tag || '').trim().replace(/^#/, '')).filter(Boolean);
    }
    function getBookDescription(book) {
        const description = String(book.description || book.summary || '').replace(/\s+/g, ' ').trim();
        return description || String(book.content || '').replace(/\s+/g, ' ').trim();
    }
    function getBookSearchText(book) {
        return `${book.title || ''} ${book.author || ''} ${getBookTags(book).join(' ')} ${getBookDescription(book)}`.toLowerCase();
    }
    function truncateBookDescription(value) {
        const text = String(value || '').trim();
        return text.length > 30 ? `${text.slice(0, 30)}...` : text;
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => reject(request.error || new Error('阅读数据无法打开'));
            request.onsuccess = () => resolve(request.result);
        });
    }

    async function readData() {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.close();
                reject(new Error('阅读数据存储尚未初始化'));
                return;
            }
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).get(DATA_KEY);
            request.onsuccess = () => resolve(request.result && request.result.data ? request.result.data : null);
            request.onerror = () => reject(request.error || new Error('阅读数据读取失败'));
            tx.oncomplete = () => db.close();
        });
    }

    async function writeData() {
        const snapshot = clone(data);
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({ id: DATA_KEY, data: snapshot });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error || new Error('阅读数据保存失败')); };
        });
    }

    function scheduleSave() {
        clearTimeout(persistTimer);
        persistTimer = setTimeout(() => writeData().catch(error => console.warn('Reader save failed:', error)), 260);
    }

    function scanChapters(content) {
        const chapters = [];
        const pattern = /^(第[零一二三四五六七八九十百千万\d]+[章节回卷集篇]|chapter\s*\d+)/i;
        let paragraphIndex = 0;
        content.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            if (pattern.test(trimmed)) chapters.push({ title: trimmed.slice(0, 72), paragraphIndex });
            paragraphIndex += 1;
        });
        return chapters;
    }

    function ensureRoot() {
        root = document.getElementById('readerAppUI');
        if (root) return;
        root = document.createElement('section');
        root.id = 'readerAppUI';
        root.setAttribute('aria-label', '阅读');
        root.innerHTML = `
            <section class="ra-screen ra-dashboard is-active" data-reader-view="dashboard"><header class="ra-header"><h1 class="ra-header-title">首页</h1></header><main class="ra-scroll" id="raDashboard"></main></section>
            <section class="ra-screen ra-home" data-reader-view="home"><header class="ra-header"><h1 class="ra-header-title">书架⌄</h1><div class="ra-header-tools"><button class="ra-plain-icon" type="button" data-reader-action="library-search" aria-label="搜索已导入书籍"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg></button><button class="ra-plain-icon" type="button" data-reader-action="library-menu" aria-label="更多操作">•••</button></div></header><main class="ra-scroll"><div class="ra-library-search" id="raLibrarySearch"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg><input id="raLibrarySearchInput" type="search" placeholder="搜索书架" autocomplete="off"></div><div class="ra-books" id="raBooks"></div></main></section>
            <section class="ra-screen ra-stats" data-reader-view="stats"><header class="ra-header"><div><h1 class="ra-header-title">统计</h1><p class="ra-header-subtitle">READING STATS</p></div><button class="ra-icon-button" type="button" data-reader-action="close" aria-label="返回桌面">×</button></header><main class="ra-scroll" id="raStats"></main></section>
            <section class="ra-screen ra-profile" data-reader-view="profile"><header class="ra-header"><div><h1 class="ra-header-title">我的</h1><p class="ra-header-subtitle">MY LIBRARY</p></div><button class="ra-icon-button" type="button" data-reader-action="close" aria-label="返回桌面">×</button></header><main class="ra-scroll" id="raProfile"></main></section>
            <section class="ra-screen ra-reader" data-reader-view="reader"><header class="ra-reader-header"><button class="ra-icon-button" type="button" data-reader-action="library" aria-label="返回书架">‹</button><div class="ra-reader-title" id="raReaderTitle"></div><button class="ra-icon-button" type="button" data-reader-action="toc" aria-label="目录">≡</button></header><main class="ra-reader-body" id="raReaderBody"></main><div class="ra-reader-toolbar"><button type="button" data-reader-action="toc"><b>≡</b>目录</button><button type="button" data-reader-action="search"><b>⌕</b>查找</button><button type="button" data-reader-action="settings"><b>Ａ</b>设置</button></div><div class="ra-search" id="raSearch"><input id="raSearchInput" type="search" placeholder="书内查找" autocomplete="off"><mark id="raSearchCount">0</mark><button type="button" data-reader-action="search-prev" aria-label="上一个结果">‹</button><button type="button" data-reader-action="search-next" aria-label="下一个结果">›</button><button type="button" data-reader-action="search-close" aria-label="关闭查找">×</button></div></section>
            <nav class="ra-dock" id="raDock" aria-label="阅读导航"><button class="is-active" type="button" data-reader-view-button="dashboard">首页</button><button type="button" data-reader-view-button="home">书架</button><button type="button" data-reader-view-button="stats">统计</button><button type="button" data-reader-view-button="profile">我的</button></nav>
            <div class="ra-sheet-backdrop" id="raSheetBackdrop" data-reader-action="sheet-close"></div>
            <section class="ra-sheet" id="raSheet" aria-modal="true"><div class="ra-sheet-handle"></div><header class="ra-sheet-title"><span id="raSheetTitle"></span><button type="button" data-reader-action="sheet-close" aria-label="关闭">×</button></header><div class="ra-sheet-list" id="raSheetBody"></div></section>
            <input id="raFileInput" type="file" accept=".txt,text/plain" hidden><input id="raCoverInput" type="file" accept="image/*" hidden>
            <div class="icon-menu-overlay" id="raCoverMenuOverlay">
                <div class="icon-menu" id="raCoverMenu">
                    <button class="icon-menu-item" type="button" data-reader-action="cover-file">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16V6a2 2 0 0 1 2-2h10"></path><rect x="8" y="8" width="14" height="14" rx="2" ry="2"></rect><circle cx="13.5" cy="13.5" r="1.5"></circle><path d="M8 18l4-4 2 2 3-3 5 5"></path></svg>
                        <span>照片图库</span>
                    </button>
                    <button class="icon-menu-item" type="button" data-reader-action="cover-url">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        <span>使用 URL</span>
                    </button>
                </div>
            </div>
        `;
        const libraryMenuButton = root.querySelector('[data-reader-action="library-menu"]');
        libraryMenuButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle></svg>';
        root.querySelector('.ra-home .ra-header-title').textContent = '书架';
        const shelfGroups = document.createElement('div');
        shelfGroups.id = 'raShelfGroups';
        shelfGroups.className = 'ra-shelf-groups';
        root.querySelector('#raLibrarySearch').insertAdjacentElement('afterend', shelfGroups);
        root.querySelector('.ra-reader-header').innerHTML = `
            <button class="ra-reader-nav-button" type="button" data-reader-action="library" aria-label="返回书架"><svg viewBox="0 0 24 24"><path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path></svg></button>
            <button class="ra-reader-nav-button" type="button" data-reader-action="bookmark" aria-label="添加书签"><svg viewBox="0 0 24 24"><path d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-3.5L6 22V3.75Z"></path></svg></button>
            <button class="ra-reader-nav-button" type="button" data-reader-action="search" aria-label="全书搜索"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.5 4.5"></path></svg></button>
            <button class="ra-reader-nav-button" type="button" data-reader-action="reader-menu" aria-label="更多功能"><svg viewBox="0 0 24 24"><path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path></svg></button>
        `;
        root.querySelector('.ra-reader-toolbar').innerHTML = `
            <div class="ra-reader-stats" aria-label="阅读统计"><span><b id="raReaderDuration">0 秒</b><small>阅读时长</small></span><span><b id="raReaderProgress">0.0 %</b><small>阅读进度</small></span><span><b id="raReaderSpeed">0 字/分钟</b><small>阅读速度</small></span><span><b id="raReaderNotes">0 条</b><small>笔记</small></span></div>
            <div class="ra-reader-page-controls">
                <button class="ra-reader-page-button" type="button" data-reader-action="page-prev" aria-label="上一页"><svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"></path></svg></button>
                <input id="raReaderProgressSlider" class="ra-reader-progress-slider" type="range" min="0" max="100" value="0" step="0.1" aria-label="阅读进度">
                <button class="ra-reader-page-button" type="button" data-reader-action="page-next" aria-label="下一页"><svg viewBox="0 0 24 24"><path d="m10 6 6 6-6 6"></path></svg></button>
            </div>
            <div class="ra-reader-tools">
                <button type="button" data-reader-action="toc"><svg viewBox="0 0 24 24"><path d="M8 6h12"></path><path d="M8 12h12"></path><path d="M8 18h12"></path><circle cx="4" cy="6" r="1"></circle><circle cx="4" cy="12" r="1"></circle><circle cx="4" cy="18" r="1"></circle></svg><span>目录</span></button>
                <button type="button" data-reader-action="reader-notes"><svg viewBox="0 0 24 24"><path d="M4 20h16"></path><path d="m14.5 4.5 5 5"></path><path d="m5 19 1.5-5.5L15.75 4.25a1.77 1.77 0 0 1 2.5 2.5L9 16.5 5 19Z"></path></svg><span>笔记</span></button>
                <button type="button" data-reader-action="night"><svg viewBox="0 0 24 24"><path d="M20.5 15.3A8.5 8.5 0 0 1 8.7 3.5a8.5 8.5 0 1 0 11.8 11.8Z"></path></svg><span>夜间</span></button>
                <button type="button" data-reader-action="settings"><svg viewBox="0 0 24 24"><path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z"></path><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.1h-3v-.1a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.56-1.03h-.1v-3h.1A1.7 1.7 0 0 0 7 9.94a1.7 1.7 0 0 0-.34-1.88L6.6 8 8.72 5.88l.06.06A1.7 1.7 0 0 0 10.66 6.28a1.7 1.7 0 0 0 1.03-1.56v-.1h3v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.78 8l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.1v3h-.1A1.7 1.7 0 0 0 19.4 15Z"></path></svg><span>设置</span></button>
            </div>
        `;
        const selectionMenu = document.createElement('div');
        selectionMenu.id = 'raSelectionMenu';
        selectionMenu.className = 'ra-selection-menu';
        selectionMenu.setAttribute('role', 'toolbar');
        selectionMenu.innerHTML = `
            <button type="button" data-reader-action="selection-note">笔记</button>
            <button type="button" data-reader-action="selection-highlight">高亮</button>
            <button type="button" data-reader-action="selection-underline">下划线</button>
            <button type="button" data-reader-action="selection-read">朗读</button>
            <button type="button" data-reader-action="selection-annotate">角色批注</button>
        `;
        root.querySelector('.ra-reader').appendChild(selectionMenu);
        (document.querySelector('.iphone') || document.body).appendChild(root);
        bindEvents();
    }

    function bindEvents() {
        root.addEventListener('click', event => {
            const actionElement = event.target.closest('[data-reader-action]');
            if (actionElement) handleAction(actionElement.dataset.readerAction, actionElement);
            const groupElement = event.target.closest('[data-reader-group]');
            if (groupElement) renderBooks(groupElement.dataset.readerGroup);
            const viewElement = event.target.closest('[data-reader-view-button]');
            if (viewElement) setView(viewElement.dataset.readerViewButton);
            const bookElement = event.target.closest('[data-reader-book]');
            if (bookElement) openBook(bookElement.dataset.readerBook);
            const coverElement = event.target.closest('[data-reader-cover]');
            if (coverElement) { activeBookId = coverElement.dataset.readerCover; openSheet('书籍设置', '<button class="ra-chapter" type="button" data-reader-action="cover">自定义封面</button>'); }
            const chapterElement = event.target.closest('[data-reader-chapter]');
            if (chapterElement) jumpToParagraph(Number(chapterElement.dataset.readerChapter));
            const bookmarkElement = event.target.closest('[data-reader-bookmark]');
            if (bookmarkElement) jumpToBookmark(Number(bookmarkElement.dataset.readerBookmark));
            const noteElement = event.target.closest('[data-reader-note]');
            if (noteElement) jumpToNote(noteElement.dataset.readerNote);
            const groupChoice = event.target.closest('[data-reader-group-choice]');
            if (groupChoice) {
                const book = getBook(groupChoice.dataset.readerBookId);
                if (book) {
                    book.shelfGroup = groupChoice.dataset.readerGroupChoice;
                    scheduleSave();
                    closeSheet();
                    renderBooks(book.shelfGroup);
                }
            }
            const sortChoice = event.target.closest('[data-reader-sort]');
            if (sortChoice) {
                data.preferences.sortMode = sortChoice.dataset.readerSort;
                scheduleSave();
                closeSheet();
                renderBooks();
            }
            const characterChoice = event.target.closest('[data-reader-character]');
            if (characterChoice) chooseReaderCharacter(characterChoice.dataset.readerCharacter);
            const profileAction = event.target.closest('[data-reader-profile-action]');
            if (profileAction && profileAction.dataset.readerProfileAction === 'import') openFilePicker();
        });
        root.querySelector('#raFileInput').addEventListener('change', importFile);
        root.querySelector('#raCoverInput').addEventListener('change', importCover);
        root.querySelector('#raCoverMenuOverlay').addEventListener('click', event => {
            if (event.target === event.currentTarget) closeCoverMenu();
        });
        root.querySelector('#raLibrarySearchInput').addEventListener('input', () => renderBooks());
        root.querySelector('#raReaderBody').addEventListener('scroll', saveReaderProgress, { passive: true });
        root.querySelector('#raReaderBody').addEventListener('click', toggleReaderChromeFromContent);
        root.querySelector('#raReaderBody').addEventListener('mouseup', queueSelectionMenu);
        root.querySelector('#raReaderBody').addEventListener('touchend', queueSelectionMenu, { passive: true });
        root.querySelector('#raReaderBody').addEventListener('pointerdown', hideSelectionMenu, { passive: true });
        root.querySelector('#raReaderProgressSlider').addEventListener('input', seekReaderProgress);
        root.querySelector('#raSearchInput').addEventListener('input', updateSearch);
        document.addEventListener('visibilitychange', () => { if (document.hidden) finishSession(); });
    }

    function handleAction(action, trigger) {
        if (action === 'import') openFilePicker();
        else if (action === 'library-menu') openSheet('书架', '<button class="ra-chapter" type="button" data-reader-action="import">导入书籍</button><button class="ra-chapter" type="button" data-reader-action="new-group">新建分组</button><button class="ra-chapter" type="button" data-reader-action="sort-books">书架排序</button><button class="ra-chapter" type="button" data-reader-action="source-search">搜索书籍</button>');
        else if (action === 'library-search') root.querySelector('#raLibrarySearch').classList.toggle('is-open');
        else if (action === 'source-search') { closeSheet(); alert('书源筛选完成后将在这里搜索书籍。'); }
        else if (action === 'cover') openCoverMenu(trigger);
        else if (action === 'cover-file') { closeCoverMenu(); root.querySelector('#raCoverInput').click(); }
        else if (action === 'cover-url') openCoverUrlPrompt();
        else if (action === 'close') closeReaderApp();
        else if (action === 'library') { finishSession(); setView('home'); }
        else if (action === 'bookmark') addBookmark();
        else if (action === 'reader-notes') openNotes();
        else if (action === 'night') toggleNightMode();
        else if (action === 'toc') openToc();
        else if (action === 'settings') openSettings();
        else if (action === 'reader-menu') openReaderMenu();
        else if (action === 'selection-note') saveSelectionNote('note');
        else if (action === 'selection-highlight') saveSelectionNote('highlight');
        else if (action === 'selection-underline') saveSelectionNote('underline');
        else if (action === 'selection-read') readSelectedText();
        else if (action === 'selection-annotate') openReaderCharacterPicker();
        else if (action === 'notes-export') exportNotes();
        else if (action === 'bookmarks') openBookmarks();
        else if (action === 'page-prev') turnReaderPage(-1);
        else if (action === 'page-next') turnReaderPage(1);
        else if (action === 'book-options') openBookOptions(trigger.dataset.readerBookId);
        else if (action === 'book-move-group') moveBookToGroup(trigger.dataset.readerBookId);
        else if (action === 'sort-books') chooseBookSort();
        else if (action === 'new-group') createShelfGroup();
        else if (action === 'search') { setReaderChromeVisible(true); root.querySelector('#raSearch').classList.add('is-open'); }
        else if (action === 'search-close') { root.querySelector('#raSearch').classList.remove('is-open'); clearSearch(); }
        else if (action === 'search-prev') moveSearch(-1);
        else if (action === 'search-next') moveSearch(1);
        else if (action === 'sheet-close') closeSheet();
    }

    function openReaderMenu() {
        openSheet('更多功能', '<button class="ra-chapter" type="button" data-reader-action="bookmarks">书签</button><button class="ra-chapter" type="button" data-reader-action="reader-notes">笔记</button><button class="ra-chapter" type="button" data-reader-action="notes-export">导出笔记</button>');
    }

    function openBookOptions(bookId) {
        const book = getBook(bookId);
        if (!book) return;
        activeBookId = bookId;
        openSheet('书籍设置', `<button class="ra-chapter" type="button" data-reader-action="cover">自定义封面</button><button class="ra-chapter" type="button" data-reader-action="book-move-group" data-reader-book-id="${escapeHtml(bookId)}">移动分组</button>`);
    }

    function moveBookToGroup(bookId) {
        const book = getBook(bookId);
        if (!book) return;
        const groups = Array.from(new Set(['默认', ...(Array.isArray(data.shelfGroups) ? data.shelfGroups : []), ...data.books.map(getShelfGroup)]));
        openSheet('移动分组', groups.map(group => `<button class="ra-chapter" type="button" data-reader-group-choice="${escapeHtml(group)}" data-reader-book-id="${escapeHtml(book.id)}">${escapeHtml(group)}${group === getShelfGroup(book) ? '　当前' : ''}</button>`).join(''));
    }

    function chooseBookSort() {
        const sortMode = data.preferences.sortMode || 'recent';
        openSheet('书架排序', `<button class="ra-chapter" type="button" data-reader-sort="recent">最近阅读${sortMode === 'recent' ? '　当前' : ''}</button><button class="ra-chapter" type="button" data-reader-sort="title">书名${sortMode === 'title' ? '　当前' : ''}</button><button class="ra-chapter" type="button" data-reader-sort="created">导入时间${sortMode === 'created' ? '　当前' : ''}</button>`);
    }

    async function createShelfGroup() {
        if (typeof window.showCustomPrompt !== 'function') return;
        const value = await window.showCustomPrompt('新建分组', { placeholder: '输入分组名称' }, '创建');
        const group = String(value || '').trim();
        if (!group) return;
        data.shelfGroups = Array.isArray(data.shelfGroups) ? data.shelfGroups : [];
        if (!data.shelfGroups.includes(group)) data.shelfGroups.push(group);
        await writeData();
        closeSheet();
        renderBooks(group);
    }

    function setView(view) {
        if (view !== 'reader') finishSession();
        activeView = view;
        root.querySelectorAll('[data-reader-view]').forEach(element => element.classList.toggle('is-active', element.dataset.readerView === view));
        root.querySelector('#raDock').style.display = view === 'reader' ? 'none' : 'flex';
        root.querySelectorAll('[data-reader-view-button]').forEach(button => button.classList.toggle('is-active', button.dataset.readerViewButton === view));
        if (view === 'dashboard') renderDashboard();
        if (view === 'home') renderBooks();
        if (view === 'stats') renderStats();
        if (view === 'profile') renderProfile();
    }

    function renderBooks(group) {
        const selectedGroup = group || root.querySelector('[data-reader-group].is-active')?.dataset.readerGroup || '默认';
        root.querySelectorAll('[data-reader-group]').forEach(button => button.classList.toggle('is-active', button.dataset.readerGroup === selectedGroup));
        const shelfGroups = Array.from(new Set(['默认', ...(Array.isArray(data.shelfGroups) ? data.shelfGroups : []), ...data.books.map(getShelfGroup)]));
        root.querySelector('#raShelfGroups').innerHTML = shelfGroups.map(groupName => `<button type="button" class="${groupName === selectedGroup ? 'is-active' : ''}" data-reader-group="${escapeHtml(groupName)}">${escapeHtml(groupName)}</button>`).join('');
        const query = root.querySelector('#raLibrarySearchInput')?.value.trim().toLowerCase() || '';
        const books = data.books
            .filter(book => getShelfGroup(book) === selectedGroup)
            .filter(book => !query || getBookSearchText(book).includes(query))
            .sort((left, right) => {
                const sortMode = data.preferences.sortMode || 'recent';
                if (sortMode === 'title') return String(left.title || '').localeCompare(String(right.title || ''), 'zh-CN');
                if (sortMode === 'created') return (right.createdAt || 0) - (left.createdAt || 0);
                return (right.lastReadAt || 0) - (left.lastReadAt || 0);
            });
        const grid = root.querySelector('#raBooks');
        const cards = books.map(book => {
            const cover = book.cover ? `<img src="${escapeHtml(book.cover)}" alt="">` : `<span class="ra-book-cover-text">${escapeHtml(book.title)}</span>`;
            const progress = Math.max(0, Math.min(100, Number(book.progress) || 0));
            const tag = book.group === 'done' ? 'DONE' : book.group === 'reading' ? 'READING' : 'BOOK';
            return `<div class="ra-book-entry"><button class="ra-book-card" type="button" data-reader-book="${escapeHtml(book.id)}"><span class="ra-book-cover">${cover}</span><span class="ra-book-info"><span class="ra-book-title">${escapeHtml(book.title)}</span><span class="ra-book-author">${progress >= 99.5 ? '已读完' : progress ? Math.floor(progress) + '%' : '未读过'}</span></span></button><button class="ra-card-more" type="button" data-reader-cover="${escapeHtml(book.id)}">•••</button></div>`;
        });
        if (!cards.length) cards.push('<div class="ra-empty">书架还没有书籍</div>');
        cards.push('<button class="ra-add-card" type="button" data-reader-action="import"><b>+</b>导入 TXT</button>');
        grid.innerHTML = cards.join('');
        books.forEach(book => {
            const card = Array.from(grid.querySelectorAll('[data-reader-book]')).find(element => element.dataset.readerBook === book.id);
            if (!card) return;
            const tags = getBookTags(book);
            const description = truncateBookDescription(getBookDescription(book));
            const cover = book.cover ? `<img src="${escapeHtml(book.cover)}" alt="">` : `<span class="ra-book-cover-text">${escapeHtml(book.title)}</span>`;
            const author = book.author ? `<span class="ra-book-author">${escapeHtml(book.author)}</span>` : '';
            const tagMarkup = tags.length ? `<span class="ra-book-tags">${tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</span>` : '';
            const descriptionMarkup = description ? `<span class="ra-book-description">${escapeHtml(description)}</span>` : '';
            card.innerHTML = `<span class="ra-book-cover">${cover}</span><span class="ra-book-info"><span class="ra-book-title">${escapeHtml(book.title)}</span>${author}${tagMarkup}${descriptionMarkup}</span>`;
        });
        grid.querySelectorAll('[data-reader-cover]').forEach(button => {
            button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle></svg>';
            button.setAttribute('aria-label', '书籍设置');
            button.dataset.readerBookId = button.dataset.readerCover;
            button.dataset.readerAction = 'book-options';
            delete button.dataset.readerCover;
        });
    }

    function openFilePicker() { root.querySelector('#raFileInput').click(); }

    function openCoverMenu(trigger) {
        closeSheet();
        const overlay = root.querySelector('#raCoverMenuOverlay');
        const menu = root.querySelector('#raCoverMenu');
        const rect = trigger?.getBoundingClientRect();
        overlay.style.display = 'block';
        let top = (rect ? rect.bottom : root.getBoundingClientRect().height / 2) + 10;
        let left = rect ? rect.left + rect.width / 2 - 120 : root.getBoundingClientRect().width / 2 - 120;
        if (top + 130 > window.innerHeight) top = (rect ? rect.top : window.innerHeight / 2) - 120;
        left = Math.max(12, Math.min(left, window.innerWidth - 252));
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
    }

    function closeCoverMenu() { root.querySelector('#raCoverMenuOverlay').style.display = 'none'; }

    function openCoverUrlPrompt() {
        closeCoverMenu();
        if (typeof window.showCustomPrompt !== 'function') return;
        window.showCustomPrompt('使用 URL', { placeholder: '输入图片 URL' }, '确定').then(async url => {
            const book = getBook(activeBookId);
            if (!url || !url.trim() || !book) return;
            book.cover = url.trim();
            await writeData();
            renderBooks();
        });
    }

    async function importFile(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        const content = (await file.text()).replace(/^\uFEFF/, '').trim();
        if (!content) return;
        const title = file.name.replace(/\.txt$/i, '') || '未命名书籍';
        data.books.push({ id: makeId('book'), title, author: '', description: '', tags: [], shelfGroup: '默认', bookmarks: [], notes: [], annotations: [], readingTimeMs: 0, content, chapters: scanChapters(content), group: 'reading', progress: 0, createdAt: Date.now(), lastReadAt: 0, reading: null });
        await writeData();
        setView('home');
    }

    async function importCover(event) {
        const file = event.target.files && event.target.files[0]; event.target.value = '';
        const book = getBook(activeBookId); if (!file || !book) return;
        book.cover = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        await writeData(); renderBooks();
    }

    function openBook(bookId) {
        const book = getBook(bookId);
        if (!book) return;
        activeBookId = bookId;
        activeView = 'reader';
        setReaderChromeVisible(false);
        root.querySelectorAll('[data-reader-view]').forEach(element => element.classList.toggle('is-active', element.dataset.readerView === 'reader'));
        root.querySelector('#raDock').style.display = 'none';
        const readerTitle = root.querySelector('#raReaderTitle');
        if (readerTitle) readerTitle.textContent = book.title;
        const readerBody = root.querySelector('#raReaderBody');
        applyReaderPreferences();
        renderReaderContent(book);
        requestAnimationFrame(() => restoreReaderProgress(book));
        sessionStartedAt = Date.now();
        clearInterval(readerToolbarTimer);
        readerToolbarTimer = setInterval(updateReaderToolbar, 1000);
        updateReaderToolbar();
    }

    function setReaderChromeVisible(visible) {
        readerChromeVisible = Boolean(visible);
        root?.querySelector('.ra-reader')?.classList.toggle('is-chrome-visible', readerChromeVisible);
        if (readerChromeVisible) updateReaderToolbar();
    }

    function toggleReaderChromeFromContent(event) {
        if (Date.now() < suppressReaderChromeTapUntil || window.getSelection()?.toString().trim()) return;
        const readerBody = event.currentTarget;
        const rect = readerBody.getBoundingClientRect();
        const horizontalPosition = (event.clientX - rect.left) / Math.max(1, rect.width);
        if (horizontalPosition <= 0.25) {
            turnReaderPage(-1);
            return;
        }
        if (horizontalPosition >= 0.75) {
            turnReaderPage(1);
            return;
        }
        setReaderChromeVisible(!readerChromeVisible);
    }

    function applyReaderPreferences() {
        const reader = root.querySelector('.ra-reader');
        const readerBody = root.querySelector('#raReaderBody');
        const preferences = data.preferences;
        readerBody.style.setProperty('--ra-font-size', `${preferences.fontSize || 18}px`);
        readerBody.style.setProperty('--ra-line-height', preferences.lineHeight || 1.82);
        readerBody.style.setProperty('--ra-padding-x', `${preferences.paddingX || 24}px`);
        readerBody.style.setProperty('--ra-paragraph-spacing', preferences.paragraphSpacing || 1.05);
        readerBody.style.setProperty('--ra-font-family', preferences.fontFamily === 'serif' ? 'Georgia, "Times New Roman", serif' : preferences.fontFamily === 'rounded' ? 'ui-rounded, "PingFang SC", sans-serif' : 'system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif');
        readerBody.style.setProperty('--ra-custom-background', preferences.backgroundColor || '#ffffff');
        readerBody.style.setProperty('--ra-custom-text', preferences.textColor || '#171717');
        reader.classList.toggle('is-night', Boolean(preferences.nightMode));
    }

    function renderReaderContent(book) {
        const notesByParagraph = new Map();
        getNotes(book).forEach(note => {
            if (!Number.isInteger(Number(note.paragraphIndex))) return;
            const index = Number(note.paragraphIndex);
            const records = notesByParagraph.get(index) || [];
            records.push(note);
            notesByParagraph.set(index, records);
        });
        const annotationsByParagraph = new Map();
        getAnnotations(book).forEach(annotation => {
            const index = Number(annotation.paragraphIndex);
            if (!Number.isInteger(index)) return;
            const records = annotationsByParagraph.get(index) || [];
            records.push(annotation);
            annotationsByParagraph.set(index, records);
        });
        root.querySelector('#raReaderBody').innerHTML = book.content.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((paragraph, index) => {
            const notes = notesByParagraph.get(index) || [];
            const annotations = annotationsByParagraph.get(index) || [];
            const annotationMarkup = annotations.map(annotation => `<aside class="ra-reader-annotation"><b>${annotation.characterAvatar ? `<img src="${escapeHtml(annotation.characterAvatar)}" alt="">` : ''}${escapeHtml(annotation.characterName || '角色批注')}</b><span>${escapeHtml(annotation.content || '')}</span></aside>`).join('');
            return `<p data-reader-paragraph="${index}">${renderMarkedParagraph(paragraph, notes)}</p>${annotationMarkup}`;
        }).join('');
    }

    function renderMarkedParagraph(text, notes) {
        const markNotes = notes.filter(note => note.markType === 'highlight' || note.markType === 'underline')
            .filter(note => Number.isInteger(Number(note.start)) && Number.isInteger(Number(note.end)))
            .sort((left, right) => Number(left.start) - Number(right.start));
        let cursor = 0;
        let output = '';
        markNotes.forEach(note => {
            const start = Math.max(cursor, Math.min(text.length, Number(note.start)));
            const end = Math.max(start, Math.min(text.length, Number(note.end)));
            if (end <= start) return;
            output += escapeHtml(text.slice(cursor, start));
            output += `<span class="ra-note-mark ra-note-mark-${note.markType}" data-reader-note-id="${escapeHtml(note.id)}">${escapeHtml(text.slice(start, end))}</span>`;
            cursor = end;
        });
        return output + escapeHtml(text.slice(cursor));
    }

    function queueSelectionMenu() {
        clearTimeout(selectionMenuTimer);
        selectionMenuTimer = setTimeout(showSelectionMenu, 0);
    }

    function getSelectionContext() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount !== 1 || !selection.toString().trim()) return null;
        const range = selection.getRangeAt(0);
        const readerBody = root.querySelector('#raReaderBody');
        if (!readerBody.contains(range.commonAncestorContainer)) return null;
        const getParagraph = node => (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest('[data-reader-paragraph]');
        const startParagraph = getParagraph(range.startContainer);
        const endParagraph = getParagraph(range.endContainer);
        if (!startParagraph || startParagraph !== endParagraph) return null;
        const text = startParagraph.textContent || '';
        const prefix = range.cloneRange();
        prefix.selectNodeContents(startParagraph);
        prefix.setEnd(range.startContainer, range.startOffset);
        const start = prefix.toString().length;
        const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
        const end = Math.min(text.length, start + selectedText.length);
        if (!selectedText || end <= start) return null;
        return { paragraphIndex: Number(startParagraph.dataset.readerParagraph), start, end, selectedText, rect: range.getBoundingClientRect() };
    }

    function showSelectionMenu() {
        const context = getSelectionContext();
        if (!context) return;
        activeSelectionContext = context;
        suppressReaderChromeTapUntil = Date.now() + 500;
        const menu = root.querySelector('#raSelectionMenu');
        const rootRect = root.getBoundingClientRect();
        const menuWidth = 260;
        const left = Math.max(12, Math.min(context.rect.left - rootRect.left + context.rect.width / 2 - menuWidth / 2, rootRect.width - menuWidth - 12));
        const top = Math.max(12, context.rect.top - rootRect.top - 48);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.classList.add('is-open');
    }

    function hideSelectionMenu() {
        clearTimeout(selectionMenuTimer);
        root?.querySelector('#raSelectionMenu')?.classList.remove('is-open');
    }

    async function saveSelectionNote(markType) {
        const book = getBook(activeBookId);
        const context = activeSelectionContext || getSelectionContext();
        hideSelectionMenu();
        if (!book || !context) return;
        suppressReaderChromeTapUntil = Date.now() + 420;
        let note = '';
        if (markType === 'note') {
            if (typeof window.showCustomPrompt !== 'function') return;
            const result = await window.showCustomPrompt('添加笔记', { placeholder: '写下你的想法（可选）' }, '保存');
            if (result === null || result === undefined) return;
            note = String(result).trim();
        }
        book.notes = getNotes(book);
        book.notes.push({ id: makeId('note'), paragraphIndex: context.paragraphIndex, start: context.start, end: context.end, selectedText: context.selectedText, note, markType, createdAt: Date.now() });
        window.getSelection()?.removeAllRanges();
        renderReaderContent(book);
        await writeData();
        updateReaderToolbar();
        if (typeof window.showToast === 'function') window.showToast(markType === 'note' ? '笔记已保存' : '标记已添加');
    }

    function openNotes() {
        const book = getBook(activeBookId);
        if (!book) return;
        const notes = getNotes(book).slice().sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
        const content = notes.length
            ? notes.map(note => `<button class="ra-chapter" type="button" data-reader-note="${escapeHtml(note.id)}"><b>${escapeHtml(note.selectedText || '笔记')}</b><small>${escapeHtml(note.note || (note.markType === 'highlight' ? '高亮标记' : note.markType === 'underline' ? '下划线标记' : '无备注'))}</small></button>`).join('')
            : '<div class="ra-empty">还没有笔记</div>';
        openSheet('笔记', `${content}<button class="ra-chapter ra-export-notes" type="button" data-reader-action="notes-export">导出笔记</button>`);
    }

    function jumpToNote(noteId) {
        const book = getBook(activeBookId);
        const note = getNotes(book).find(item => item.id === noteId);
        if (!note) return;
        jumpToParagraph(Number(note.paragraphIndex));
    }

    function exportNotes() {
        const book = getBook(activeBookId);
        if (!book) return;
        const records = getNotes(book);
        if (!records.length) {
            if (typeof window.showToast === 'function') window.showToast('还没有可导出的笔记');
            return;
        }
        const lines = [`# ${book.title} - 阅读笔记`, ''];
        records.slice().sort((left, right) => Number(left.paragraphIndex) - Number(right.paragraphIndex)).forEach(note => {
            lines.push(`> ${note.selectedText || ''}`);
            lines.push(note.note || (note.markType === 'highlight' ? '高亮标记' : note.markType === 'underline' ? '下划线标记' : '笔记'));
            lines.push('');
        });
        const annotations = getAnnotations(book).slice().sort((left, right) => Number(left.paragraphIndex) - Number(right.paragraphIndex));
        if (annotations.length) lines.push('## 角色批注', '');
        annotations.forEach(annotation => {
            lines.push(`> ${annotation.selectedText || ''}`);
            lines.push(`${annotation.characterName || '角色'}：${annotation.content || ''}`);
            lines.push('');
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${String(book.title || '阅读笔记').replace(/[\\/:*?"<>|]/g, '_')}-笔记.md`;
        link.click();
        URL.revokeObjectURL(url);
        closeSheet();
    }

    function readSelectedText() {
        const context = activeSelectionContext || getSelectionContext();
        hideSelectionMenu();
        if (!context || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(context.selectedText);
        utterance.lang = 'zh-CN';
        utterance.rate = Number(data.preferences.ttsRate || 1);
        window.speechSynthesis.speak(utterance);
    }

    async function readReaderContacts() {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).get('contactsAppData');
            request.onsuccess = () => resolve(Array.isArray(request.result?.data?.contacts) ? request.result.data.contacts : []);
            request.onerror = () => reject(request.error || new Error('联系人读取失败'));
            tx.oncomplete = () => db.close();
            tx.onerror = () => { db.close(); reject(tx.error || new Error('联系人读取失败')); };
        });
    }

    async function openReaderCharacterPicker() {
        hideSelectionMenu();
        const context = activeSelectionContext || getSelectionContext();
        if (!context) return;
        activeSelectionContext = context;
        let contacts = [];
        try { contacts = await readReaderContacts(); } catch (error) { console.warn('Reader contacts unavailable:', error); }
        const available = contacts.filter(contact => contact && contact.id && String(contact.name || '').trim());
        if (!available.length) {
            if (typeof window.showToast === 'function') window.showToast('请先在联系人中创建角色');
            return;
        }
        openSheet('选择角色批注', available.map(contact => `<button class="ra-chapter" type="button" data-reader-character="${escapeHtml(contact.id)}"><b>${escapeHtml(contact.name)}</b><small>${escapeHtml(contact.persona || '暂无人设')}</small></button>`).join(''));
    }

    async function chooseReaderCharacter(characterId) {
        const contacts = await readReaderContacts().catch(() => []);
        const character = contacts.find(contact => contact.id === characterId);
        if (!character || !activeSelectionContext) return;
        data.preferences.readerCharacterId = character.id;
        scheduleSave();
        closeSheet();
        await requestCharacterAnnotation(character, activeSelectionContext);
    }

    function getCompletionUrl(url) {
        const base = String(url || '').trim().replace(/\/+$/, '');
        return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
    }

    async function requestCharacterAnnotation(character, context) {
        const book = getBook(activeBookId);
        if (!book || !context) return;
        const api = typeof apiDataList !== 'undefined' && Array.isArray(apiDataList) ? apiDataList.find(item => item.id === apiConnectedId) : null;
        if (!api?.url || !api?.key || !api?.model) {
            if (typeof window.showToast === 'function') window.showToast('请先在 API 连接中配置并连接一个模型');
            return;
        }
        if (typeof window.showToast === 'function') window.showToast('正在生成角色批注');
        try {
            const response = await fetch(getCompletionUrl(api.url), {
                method: 'POST',
                headers: { Authorization: `Bearer ${api.key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: api.model,
                    temperature: api.temperature !== undefined ? api.temperature : 0.7,
                    messages: [
                        { role: 'system', content: `你是${character.name}。人设：${character.persona || '未设置'}。请针对读者摘录给出简短、自然的第一人称批注，不超过80字。` },
                        { role: 'user', content: `书名：《${book.title}》\n摘录：${context.selectedText}` }
                    ]
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            const content = String(payload?.choices?.[0]?.message?.content || '').trim();
            if (!content) throw new Error('模型未返回批注');
            book.annotations = getAnnotations(book);
            book.annotations.push({ id: makeId('annotation'), paragraphIndex: context.paragraphIndex, start: context.start, end: context.end, selectedText: context.selectedText, characterId: character.id, characterName: character.name, characterAvatar: character.avatar || '', content, createdAt: Date.now() });
            window.getSelection()?.removeAllRanges();
            renderReaderContent(book);
            await writeData();
            if (typeof window.showToast === 'function') window.showToast('角色批注已添加');
        } catch (error) {
            console.warn('Reader annotation failed:', error);
            if (typeof window.showToast === 'function') window.showToast('角色批注生成失败，请检查 API 连接');
        }
    }

    function updateReaderToolbar() {
        const book = getBook(activeBookId);
        if (!book || !root) return;
        const progress = Math.max(0, Math.min(100, Number(book.progress) || 0));
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000));
        const totalSeconds = Math.max(0, Math.floor((Number(book.readingTimeMs) || 0) / 1000) + elapsedSeconds);
        const readCharacters = (book.content || '').replace(/\s/g, '').length * progress / 100;
        const speed = elapsedSeconds ? Math.floor(readCharacters / (elapsedSeconds / 60)) : 0;
        root.querySelector('#raReaderDuration').textContent = totalSeconds < 60 ? `${totalSeconds} 秒` : `${Math.floor(totalSeconds / 60)} 分`;
        root.querySelector('#raReaderProgress').textContent = `${progress.toFixed(1)} %`;
        root.querySelector('#raReaderSpeed').textContent = `${speed} 字/分钟`;
        root.querySelector('#raReaderNotes').textContent = `${getNotes(book).length} 条`;
        root.querySelector('#raReaderProgressSlider').value = String(progress);
    }

    function seekReaderProgress(event) {
        const book = getBook(activeBookId);
        const readerBody = root.querySelector('#raReaderBody');
        if (!book || !readerBody) return;
        const progress = Number(event.target.value) || 0;
        const scrollRange = Math.max(0, readerBody.scrollHeight - readerBody.clientHeight);
        readerBody.scrollTop = scrollRange * progress / 100;
        saveReaderProgress();
    }

    function turnReaderPage(direction) {
        const readerBody = root.querySelector('#raReaderBody');
        if (!readerBody) return;
        const pageHeight = Math.max(1, Math.floor(readerBody.clientHeight * 0.9));
        const maxScroll = Math.max(0, readerBody.scrollHeight - readerBody.clientHeight);
        const nextTop = Math.max(0, Math.min(maxScroll, readerBody.scrollTop + pageHeight * direction));
        readerBody.scrollTo({ top: nextTop, behavior: 'smooth' });
        window.setTimeout(saveReaderProgress, 260);
    }

    async function addBookmark() {
        const book = getBook(activeBookId);
        if (!book || typeof window.showCustomPrompt !== 'function') return;
        saveReaderProgress();
        const note = await window.showCustomPrompt('添加书签备注', { placeholder: '输入书签备注（可选）' }, '添加');
        if (note === null || note === undefined) return;
        const reading = book.reading || { paragraphIndex: 0, offset: 0 };
        book.bookmarks = getBookmarks(book);
        book.bookmarks.push({ id: makeId('bookmark'), paragraphIndex: reading.paragraphIndex, offset: reading.offset, note: String(note).trim(), createdAt: Date.now() });
        await writeData();
        updateReaderToolbar();
        if (typeof window.showToast === 'function') window.showToast('书签已添加');
    }

    function openBookmarks() {
        const book = getBook(activeBookId);
        const bookmarks = getBookmarks(book);
        const content = bookmarks.length
            ? bookmarks.map((bookmark, index) => `<button class="ra-chapter" type="button" data-reader-bookmark="${index}"><b>${escapeHtml(bookmark.note || '书签')}</b><small>第 ${bookmark.paragraphIndex + 1} 段</small></button>`).join('')
            : '<div class="ra-empty">还没有书签</div>';
        openSheet('书签', content);
    }

    function jumpToBookmark(index) {
        const book = getBook(activeBookId);
        const bookmark = getBookmarks(book)[index];
        if (!bookmark) return;
        const target = root.querySelector(`[data-reader-paragraph="${bookmark.paragraphIndex}"]`);
        if (target) root.querySelector('#raReaderBody').scrollTo({ top: target.offsetTop + (bookmark.offset || 0), behavior: 'smooth' });
        closeSheet();
    }

    function toggleNightMode() {
        data.preferences.nightMode = !data.preferences.nightMode;
        root.querySelector('.ra-reader').classList.toggle('is-night', data.preferences.nightMode);
        scheduleSave();
    }

    function restoreReaderProgress(book) {
        const readerBody = root.querySelector('#raReaderBody');
        const reading = book.reading;
        if (!reading) return;
        const paragraph = readerBody.querySelector(`[data-reader-paragraph="${reading.paragraphIndex}"]`);
        if (paragraph) readerBody.scrollTop = paragraph.offsetTop + (reading.offset || 0);
    }

    function saveReaderProgress() {
        const book = getBook(activeBookId);
        const readerBody = root.querySelector('#raReaderBody');
        if (!book || !readerBody) return;
        const paragraphs = Array.from(readerBody.querySelectorAll('[data-reader-paragraph]'));
        const current = paragraphs.reduce((closest, paragraph) => paragraph.offsetTop <= readerBody.scrollTop + 12 ? paragraph : closest, paragraphs[0]);
        const contentHeight = Math.max(1, readerBody.scrollHeight - readerBody.clientHeight);
        book.reading = { paragraphIndex: Number(current?.dataset.readerParagraph || 0), offset: readerBody.scrollTop - (current?.offsetTop || 0), updatedAt: Date.now() };
        book.progress = Math.min(100, Math.max(0, readerBody.scrollTop / contentHeight * 100));
        book.lastReadAt = Date.now();
        book.group = book.progress >= 99.5 ? 'done' : 'reading';
        scheduleSave();
        updateReaderToolbar();
    }

    function finishSession() {
        clearInterval(readerToolbarTimer);
        readerToolbarTimer = null;
        if (!sessionStartedAt || !activeBookId) return;
        saveReaderProgress();
        const elapsed = Date.now() - sessionStartedAt;
        sessionStartedAt = 0;
        if (elapsed > 0) {
            data.readingMsByDay[getDayKey(new Date())] = (data.readingMsByDay[getDayKey(new Date())] || 0) + elapsed;
            const book = getBook(activeBookId);
            if (book) book.readingTimeMs = (Number(book.readingTimeMs) || 0) + elapsed;
        }
        scheduleSave();
    }

    function openToc() {
        const book = getBook(activeBookId);
        if (!book) return;
        const chapters = Array.isArray(book.chapters) ? book.chapters : [];
        openSheet('目录', chapters.length ? chapters.map(chapter => `<button class="ra-chapter" type="button" data-reader-chapter="${chapter.paragraphIndex}">${escapeHtml(chapter.title)}</button>`).join('') : '<div class="ra-empty">未检测到章节</div>');
    }

    function jumpToParagraph(paragraphIndex) {
        const target = root.querySelector(`[data-reader-paragraph="${paragraphIndex}"]`);
        if (target) root.querySelector('#raReaderBody').scrollTo({ top: target.offsetTop - 15, behavior: 'smooth' });
        closeSheet();
    }

    function openSettings() {
        const size = data.preferences.fontSize || 18;
        const lineHeight = data.preferences.lineHeight || 1.82;
        const padding = data.preferences.paddingX || 24;
        const paragraphSpacing = data.preferences.paragraphSpacing || 1.05;
        const family = data.preferences.fontFamily || 'system';
        const ttsRate = data.preferences.ttsRate || 1;
        openSheet('阅读设置', `<label class="ra-settings-row"><span>字号</span><input id="raFontSize" type="range" min="14" max="26" value="${size}"><output id="raFontSizeOutput">${size}px</output></label><label class="ra-settings-row"><span>行距</span><input id="raLineHeight" type="range" min="1.4" max="2.3" step="0.05" value="${lineHeight}"><output id="raLineHeightOutput">${lineHeight}</output></label><label class="ra-settings-row"><span>边距</span><input id="raPaddingX" type="range" min="16" max="42" value="${padding}"><output id="raPaddingXOutput">${padding}px</output></label><label class="ra-settings-row"><span>段距</span><input id="raParagraphSpacing" type="range" min="0.7" max="1.8" step="0.05" value="${paragraphSpacing}"><output id="raParagraphSpacingOutput">${paragraphSpacing}</output></label><label class="ra-settings-row"><span>字体</span><select id="raFontFamily"><option value="system">系统</option><option value="serif">衬线</option><option value="rounded">圆体</option></select><output></output></label><label class="ra-settings-row"><span>背景</span><input id="raBackgroundColor" type="color" value="${escapeHtml(data.preferences.backgroundColor || '#ffffff')}"><output></output></label><label class="ra-settings-row"><span>文字</span><input id="raTextColor" type="color" value="${escapeHtml(data.preferences.textColor || '#171717')}"><output></output></label><label class="ra-settings-row"><span>朗读速度</span><input id="raTtsRate" type="range" min="0.7" max="1.5" step="0.1" value="${ttsRate}"><output id="raTtsRateOutput">${ttsRate}x</output></label>`);
        root.querySelector('#raFontFamily').value = family;
        root.querySelector('#raFontSize').addEventListener('input', event => {
            data.preferences.fontSize = Number(event.target.value);
            root.querySelector('#raFontSizeOutput').textContent = `${event.target.value}px`;
            root.querySelector('#raReaderBody').style.setProperty('--ra-font-size', `${event.target.value}px`);
            scheduleSave();
        });
        root.querySelector('#raPaddingX').addEventListener('input', event => {
            data.preferences.paddingX = Number(event.target.value);
            root.querySelector('#raPaddingXOutput').textContent = `${event.target.value}px`;
            applyReaderPreferences();
            scheduleSave();
        });
        root.querySelector('#raParagraphSpacing').addEventListener('input', event => {
            data.preferences.paragraphSpacing = Number(event.target.value);
            root.querySelector('#raParagraphSpacingOutput').textContent = event.target.value;
            applyReaderPreferences();
            scheduleSave();
        });
        root.querySelector('#raFontFamily').addEventListener('change', event => {
            data.preferences.fontFamily = event.target.value;
            applyReaderPreferences();
            scheduleSave();
        });
        root.querySelector('#raBackgroundColor').addEventListener('input', event => {
            data.preferences.backgroundColor = event.target.value;
            applyReaderPreferences();
            scheduleSave();
        });
        root.querySelector('#raTextColor').addEventListener('input', event => {
            data.preferences.textColor = event.target.value;
            applyReaderPreferences();
            scheduleSave();
        });
        root.querySelector('#raTtsRate').addEventListener('input', event => {
            data.preferences.ttsRate = Number(event.target.value);
            root.querySelector('#raTtsRateOutput').textContent = `${event.target.value}x`;
            scheduleSave();
        });
        root.querySelector('#raLineHeight').addEventListener('input', event => {
            data.preferences.lineHeight = Number(event.target.value);
            root.querySelector('#raLineHeightOutput').textContent = event.target.value;
            root.querySelector('#raReaderBody').style.setProperty('--ra-line-height', event.target.value);
            scheduleSave();
        });
    }

    function openSheet(title, content) {
        root.querySelector('#raSheetTitle').textContent = title;
        root.querySelector('#raSheetBody').innerHTML = content;
        root.querySelector('#raSheet').classList.add('is-open');
        root.querySelector('#raSheetBackdrop').classList.add('is-open');
    }
    function closeSheet() { root.querySelector('#raSheet').classList.remove('is-open'); root.querySelector('#raSheetBackdrop').classList.remove('is-open'); }

    function clearSearch() {
        searchMatches = [];
        currentMatch = -1;
        root.querySelector('#raSearchCount').textContent = '0';
        root.querySelector('#raSearchInput').value = '';
        const book = getBook(activeBookId);
        if (book) renderReaderContent(book);
    }

    function updateSearch() {
        const input = root.querySelector('#raSearchInput');
        const keyword = input.value.trim();
        const book = getBook(activeBookId);
        if (book) renderReaderContent(book);
        const paragraphs = root.querySelectorAll('#raReaderBody p');
        searchMatches = [];
        currentMatch = -1;
        if (!keyword) { root.querySelector('#raSearchCount').textContent = '0'; return; }
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'gi');
        paragraphs.forEach(paragraph => {
            const text = paragraph.textContent;
            if (!regex.test(text)) { regex.lastIndex = 0; return; }
            regex.lastIndex = 0;
            paragraph.innerHTML = escapeHtml(text).replace(new RegExp(`(${escaped})`, 'gi'), '<span class="ra-match">$1</span>');
            paragraph.querySelectorAll('.ra-match').forEach(match => searchMatches.push(match));
        });
        root.querySelector('#raSearchCount').textContent = String(searchMatches.length);
        if (searchMatches.length) { currentMatch = 0; focusSearchMatch(); }
    }

    function moveSearch(direction) {
        if (!searchMatches.length) return;
        currentMatch = (currentMatch + direction + searchMatches.length) % searchMatches.length;
        focusSearchMatch();
    }
    function focusSearchMatch() {
        searchMatches.forEach((match, index) => match.classList.toggle('is-current', index === currentMatch));
        const target = searchMatches[currentMatch];
        if (target) root.querySelector('#raReaderBody').scrollTo({ top: target.offsetTop - 90, behavior: 'smooth' });
        root.querySelector('#raSearchCount').textContent = `${currentMatch + 1}/${searchMatches.length}`;
    }

    function renderStats() {
        const totalMs = Object.values(data.readingMsByDay).reduce((total, value) => total + Number(value || 0), 0);
        const totalMinutes = Math.floor(totalMs / 60000);
        const todayMinutes = Math.floor((data.readingMsByDay[getDayKey(new Date())] || 0) / 60000);
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
        const days = new Date(year, month + 1, 0).getDate();
        const calendar = ['一', '二', '三', '四', '五', '六', '日'].map(day => `<span class="ra-calendar-weekday">${day}</span>`);
        for (let index = 0; index < firstWeekday; index += 1) calendar.push('<span></span>');
        for (let day = 1; day <= days; day += 1) {
            const date = new Date(year, month, day);
            const minutes = Math.floor((data.readingMsByDay[getDayKey(date)] || 0) / 60000);
            const level = minutes > 90 ? 4 : minutes > 45 ? 3 : minutes > 15 ? 2 : minutes > 0 ? 1 : 0;
            calendar.push(`<span class="ra-calendar-day" data-level="${level}">${day}</span>`);
        }
        const finished = data.books.filter(book => Number(book.progress) >= 99.5).length;
        const started = data.books.filter(book => Number(book.progress) > 0).length;
        const reading = data.books.filter(book => Number(book.progress) > 0 && Number(book.progress) < 99.5).length;
        const daysRead = Object.values(data.readingMsByDay).filter(value => Number(value) > 0).length;
        const words = data.books.reduce((total, book) => total + (book.content || '').replace(/\s/g, '').length * (Number(book.progress) || 0) / 100, 0);
        const notes = data.books.reduce((total, book) => total + getNotes(book).length, 0);
        root.querySelector('#raStats').innerHTML = `<div class="ra-stat-period">日　 周　 月　 年　 总</div><section class="ra-stat-card ra-stat-grid"><b>${totalMinutes} 分钟<small>阅读时间</small></b><b>${daysRead} 天<small>阅读天数</small></b><b>${started} 本<small>累计读过</small></b><b>${finished} 本<small>读完书籍</small></b><b>${reading} 本<small>在读书籍</small></b><b>${notes} 条<small>记录笔记</small></b><b>${Math.floor(words)} 字<small>阅读字数</small></b><b>${totalMinutes ? Math.floor(words / totalMinutes) : 0} 字/分钟<small>阅读速度</small></b></section><section class="ra-stat-card"><div class="ra-stat-top"><strong>阅读时间趋势</strong><span class="ra-stat-note">${year}年${month + 1}月</span></div><div class="ra-calendar">${calendar.join('')}</div></section>`;
    }

    function renderDashboard() {
        const totalMs = Object.values(data.readingMsByDay).reduce((total, value) => total + Number(value || 0), 0);
        const totalMinutes = Math.floor(totalMs / 60000);
        const finished = data.books.filter(book => Number(book.progress) >= 99.5).length;
        const started = data.books.filter(book => Number(book.progress) > 0).length;
        const current = data.books.filter(book => Number(book.progress) > 0 && Number(book.progress) < 99.5).sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0))[0];
        root.querySelector('#raDashboard').innerHTML = `<button class="ra-summary" type="button" data-reader-view-button="stats"><b>累计阅读</b><span>${totalMinutes} 分钟　·　${started} 本　›</span></button><section class="ra-home-section"><h2>继续阅读　›</h2>${current ? `<button class="ra-continue" type="button" data-reader-book="${escapeHtml(current.id)}">${escapeHtml(current.title)}<small>已读 ${Math.floor(current.progress || 0)}%</small></button>` : '<p>还没有阅读记录哦</p>'}</section><section class="ra-home-section"><h2>阅读目标　⌘</h2><p>找到你喜欢的书，开始阅读吧！</p><div class="ra-goal"><b>今日目标</b><strong>${Math.floor((data.readingMsByDay[getDayKey(new Date())] || 0) / 60000)} 分钟</strong><button type="button" data-reader-view-button="home">开始阅读</button></div></section>`;
    }

    function renderProfile() {
        const totalMs = Object.values(data.readingMsByDay).reduce((total, value) => total + Number(value || 0), 0);
        root.querySelector('#raProfile').innerHTML = `<section class="ra-profile-card"><div class="ra-profile-avatar">我</div><div class="ra-profile-name">我的阅读</div><p class="ra-stat-note">累计 ${Math.floor(totalMs / 60000)} 分钟</p></section><section class="ra-profile-card"><button class="ra-list-row" type="button" data-reader-profile-action="import"><span>导入 TXT 书籍</span><span>›</span></button></section>`;
    }

    async function openReaderApp() {
        ensureRoot();
        if (!data) {
            try { data = Object.assign(clone(DEFAULT_DATA), await readData() || {}); }
            catch (error) { console.warn('Reader storage unavailable:', error); data = clone(DEFAULT_DATA); }
            data.books = Array.isArray(data.books) ? data.books : [];
            data.shelfGroups = Array.isArray(data.shelfGroups) ? data.shelfGroups.filter(group => String(group || '').trim()) : [];
            data.preferences = Object.assign({}, DEFAULT_DATA.preferences, data.preferences || {});
            data.readingMsByDay = data.readingMsByDay || {};
        }
        root.style.display = 'block';
        requestAnimationFrame(() => root.classList.add('show'));
        setView('dashboard');
    }

    function closeReaderApp() {
        finishSession();
        root.classList.remove('show');
        setTimeout(() => { if (!root.classList.contains('show')) root.style.display = 'none'; }, 320);
    }

    window.openReaderApp = openReaderApp;
    window.closeReaderApp = closeReaderApp;
}());
