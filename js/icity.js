(() => {
  const DB = 'iOSDesktopDB', STORE = 'layoutStore', KEY = 'icityData', CONTACTS = 'contactsAppData';
  let state = { entries: [], messages: [] }, authors = [], npcs = [], currentView = 'home', currentNpc = null;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

  function dbStore(mode = 'readonly') {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(STORE, mode);
        resolve({ database, transaction, store: transaction.objectStore(STORE) });
      };
    });
  }

  async function read(key) {
    const connection = await dbStore();
    return new Promise((resolve, reject) => {
      const request = connection.store.get(key);
      request.onsuccess = () => { connection.database.close(); resolve(request.result); };
      request.onerror = () => { connection.database.close(); reject(request.error); };
    });
  }

  async function save() {
    const connection = await dbStore('readwrite');
    connection.store.put({ id: KEY, entries: state.entries, messages: state.messages });
    return new Promise((resolve, reject) => {
      connection.transaction.oncomplete = () => { connection.database.close(); resolve(); };
      connection.transaction.onerror = () => { connection.database.close(); reject(connection.transaction.error); };
    });
  }

  async function load() {
    const [record, contactsRecord] = await Promise.all([read(KEY), read(CONTACTS)]);
    state = { entries: Array.isArray(record?.entries) ? record.entries : [], messages: Array.isArray(record?.messages) ? record.messages : [] };
    const data = contactsRecord?.data || {};
    const users = Array.isArray(data.users) ? data.users : [];
    const contacts = Array.isArray(data.contacts) ? data.contacts : [];
    authors = [...users.map(item => ({ ...item, type: 'user' })), ...contacts.map(item => ({ ...item, type: 'character' }))]
      .filter(item => item?.id && item.name)
      .map(item => ({ id: item.id, type: item.type, name: item.name, avatar: item.avatar || '' }));
    npcs = contacts.flatMap(contact => (Array.isArray(contact.npcs) ? contact.npcs : []).filter(npc => npc?.id && npc.name).map(npc => ({ ...npc, ownerName: contact.name, ownerAvatar: contact.avatar || '' })));
  }

  function authorFor(entry) {
    return authors.find(author => author.id === entry.authorId && author.type === entry.authorType) || { name: entry.authorName || '未知身份', avatar: entry.authorAvatar || '', type: entry.authorType || 'user' };
  }

  function elapsed(timestamp) {
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return '刚刚';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' 分钟前';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' 小时前';
    return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  }

  function avatar(person, className = 'icity-avatar') {
    return '<div class="' + className + '">' + (person.avatar ? '<img src="' + esc(person.avatar) + '" alt="">' : esc(person.name.slice(0, 1))) + '</div>';
  }

  function entryCard(entry) {
    const author = authorFor(entry);
    return '<article class="icity-entry"><header class="icity-entry-head">' + avatar(author) + '<div><strong>' + esc(author.name) + '</strong><small>@' + esc(author.name) + '</small></div><time>' + elapsed(entry.createdAt) + '</time></header>' + (entry.title ? '<h2>' + esc(entry.title) + '</h2>' : '') + '<p>' + esc(entry.content) + '</p><footer><span>☁ 百色市 23°C</span><i>♧</i><i>♡</i><i>▢</i><i>◷ ' + elapsed(entry.createdAt) + '</i><button type="button" data-icity-delete="' + esc(entry.id) + '" aria-label="删除日记">⋮</button></footer></article>';
  }

  function empty(title, copy) {
    return '<div class="icity-empty"><b>✎</b><strong>' + title + '</strong><span>' + copy + '</span></div>';
  }

  function renderFeeds() {
    const entries = [...state.entries].sort((left, right) => right.createdAt - left.createdAt);
    $('#icityHomeFeed').innerHTML = entries.map(entryCard).join('') || empty('还没有日记', '写下今天的片刻，让它留在 iCity。');
    $('#icityWorldFeed').innerHTML = entries.map(entryCard).join('') || empty('世界还很安静', '发布第一篇日记吧。');
    const user = authors.find(author => author.type === 'user') || authors[0];
    $('#icityPromptAvatar').textContent = user?.name?.slice(0, 1) || 'i';
    $('#icityProfileHead').innerHTML = user ? avatar(user, 'icity-profile-avatar') + '<div><strong>' + esc(user.name) + ' · 日记</strong><span>@' + esc(user.name) + '</span></div>' : '<strong>我的日记</strong>';
    $('#icityProfileFeed').innerHTML = entries.map(entryCard).join('') || empty('没有公开日记', '卷轴空空如也');
  }

  function chooseNpc() {
    if (!npcs.length) return { id: 'icity-guide', name: 'iCity 市政厅', avatar: '', persona: '温柔的城市管理员' };
    return npcs[Math.floor(Math.random() * npcs.length)];
  }

  function npcOpening(npc) {
    const relation = npc.role ? '，我是' + npc.role : '';
    return '你好，我是' + npc.name + relation + '。刚好路过 iCity，想和你说说话。';
  }

  function npcReply(npc) {
    const samples = ['嗯，我在听。', '这句话我会记住。', '今天也辛苦了。', '听起来很有意思，再说一点吧。'];
    return samples[Math.floor(Math.random() * samples.length)];
  }

  function renderMessages() {
    const history = state.messages.filter(message => message.npcId === currentNpc.id);
    const opening = '<div class="icity-chat-day">今天</div><div class="icity-message"><div class="icity-message-avatar">' + (currentNpc.avatar ? '<img src="' + esc(currentNpc.avatar) + '" alt="">' : esc(currentNpc.name.slice(0, 1))) + '</div><div class="icity-bubble">' + esc(npcOpening(currentNpc)) + '</div></div>';
    $('#icityMessages').innerHTML = opening + history.map(message => '<div class="icity-message ' + (message.from === 'user' ? 'is-user' : '') + '"><div class="icity-message-avatar">' + (message.from === 'user' ? '我' : (currentNpc.avatar ? '<img src="' + esc(currentNpc.avatar) + '" alt="">' : esc(currentNpc.name.slice(0, 1))) ) + '</div><div class="icity-bubble">' + esc(message.content) + '</div></div>').join('');
    const messages = $('#icityMessages'); messages.scrollTop = messages.scrollHeight;
  }

  function show(view) {
    currentView = view;
    document.querySelectorAll('[data-icity-view]').forEach(element => element.classList.toggle('is-active', element.dataset.icityView === view));
    document.querySelectorAll('[data-icity-nav]').forEach(element => element.classList.toggle('is-active', element.dataset.icityNav === view));
    const title = view === 'home' ? 'icity · 我的日记' : view === 'world' ? 'iCity · 世界' : view === 'profile' ? '我的日记' : currentNpc.name;
    $('#icityPageTitle').textContent = title;
    $('#icityTopbar').querySelector('[data-icity-action]').dataset.icityAction = view === 'home' ? 'close' : 'go-home';
    if (view === 'chat') renderMessages();
  }

  function compose(isOpen) {
    const sheet = $('#icityComposeSheet');
    sheet.classList.toggle('is-open', isOpen);
    sheet.setAttribute('aria-hidden', String(!isOpen));
    if (!isOpen) return;
    const select = $('#icityAuthorSelect');
    select.innerHTML = authors.map(author => '<option value="' + esc(author.type + ':' + author.id) + '">' + esc(author.name) + ' (' + (author.type === 'user' ? 'User' : '角色') + ')</option>').join('');
    $('.icity-publish-button').disabled = !authors.length;
    $('#icityDiaryTitle').focus();
  }

  async function publish(event) {
    event.preventDefault();
    const [type, ...ids] = $('#icityAuthorSelect').value.split(':');
    const author = authors.find(item => item.type === type && item.id === ids.join(':'));
    const content = $('#icityDiaryContent').value.trim();
    if (!author || !content) return;
    state.entries.unshift({ id: 'diary_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), authorId: author.id, authorType: author.type, authorName: author.name, authorAvatar: author.avatar, title: $('#icityDiaryTitle').value.trim(), content, createdAt: Date.now() });
    await save(); event.target.reset(); $('#icityCharCount').textContent = '0 / 2000'; compose(false); renderFeeds();
  }

  async function open() {
    try { await load(); renderFeeds(); show('home'); $('#icityAppUI').classList.add('is-open'); $('#icityAppUI').setAttribute('aria-hidden', 'false'); } catch (error) { console.error('Unable to open iCity', error); }
  }

  function close() { compose(false); $('#icityAppUI').classList.remove('is-open'); $('#icityAppUI').setAttribute('aria-hidden', 'true'); }

  document.addEventListener('DOMContentLoaded', () => {
    const root = $('#icityAppUI');
    root?.addEventListener('click', event => {
      const action = event.target.closest('[data-icity-action]')?.dataset.icityAction;
      if (action === 'close') close();
      if (action === 'go-home') show('home');
      if (action === 'open-compose') compose(true);
      if (action === 'close-compose') compose(false);
      if (action === 'open-chat') { currentNpc = chooseNpc(); show('chat'); }
      const id = event.target.closest('[data-icity-delete]')?.dataset.icityDelete;
      if (id) { state.entries = state.entries.filter(entry => entry.id !== id); save().then(renderFeeds); }
    });
    document.querySelectorAll('[data-icity-nav]').forEach(button => button.addEventListener('click', () => show(button.dataset.icityNav)));
    $('#icityComposeForm')?.addEventListener('submit', publish);
    $('#icityDiaryContent')?.addEventListener('input', event => { $('#icityCharCount').textContent = event.target.value.length + ' / 2000'; });
    $('#icityMessageForm')?.addEventListener('submit', async event => {
      event.preventDefault(); const input = $('#icityMessageInput'); const content = input.value.trim(); if (!content || !currentNpc) return;
      state.messages.push({ npcId: currentNpc.id, from: 'user', content, createdAt: Date.now() });
      state.messages.push({ npcId: currentNpc.id, from: 'npc', content: npcReply(currentNpc), createdAt: Date.now() + 1 });
      input.value = ''; await save(); renderMessages();
    });
  });
  window.openICityApp = open; window.closeICityApp = close;
})();
