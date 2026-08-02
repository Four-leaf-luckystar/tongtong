(() => {
  const dbName = 'iOSDesktopDB';
  const storeName = 'layoutStore';
  const apiKey = 'apiData';
  const dataKey = 'icityData';
  let generating = false;
  const root = () => document.getElementById('icityAppUI');
  const text = {
    noCharacter: '请先在联系人中创建角色',
    apiMissing: '请先在 API 连接中配置并连接模型',
    charFailed: '角色日记生成失败',
    worldFailed: '世界日记生成失败'
  };
  function open(mode = 'readonly') {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(storeName, mode);
        resolve({ database, transaction, store: transaction.objectStore(storeName) });
      };
    });
  }
  async function get(key) {
    const connection = await open();
    return new Promise((resolve, reject) => {
      const request = connection.store.get(key);
      request.onsuccess = () => { connection.database.close(); resolve(request.result); };
      request.onerror = () => { connection.database.close(); reject(request.error); };
    });
  }
  async function put(record) {
    const connection = await open('readwrite');
    connection.store.put(record);
    return new Promise((resolve, reject) => {
      connection.transaction.oncomplete = () => { connection.database.close(); resolve(); };
      connection.transaction.onerror = () => { connection.database.close(); reject(connection.transaction.error); };
    });
  }
  function apiUrl(url) {
    const base = String(url || '').trim().replace(/\/+$/, '');
    return /\/chat\/completions$/i.test(base) ? base : base + '/chat/completions';
  }
  function parse(content) {
    return JSON.parse(String(content || '').replace(/^\\s*\\x60\\x60\\x60(?:json)?/i, '').replace(/\\x60\\x60\\x60\\s*$/, '').trim());
  }
  async function callApi(system, prompt) {
    const apiRecord = await get(apiKey);
    const list = Array.isArray(apiRecord?.list) ? apiRecord.list : [];
    const api = list.find(item => item.id === apiRecord?.connectedId) || list[0];
    if (!api?.url || !api?.key || !api?.model) throw new Error(text.apiMissing);
    const response = await fetch(apiUrl(api.url), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + api.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: api.model, temperature: 0.9, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] })
    });
    if (!response.ok) throw new Error('API request failed: HTTP ' + response.status);
    const result = await response.json();
    return parse(result?.choices?.[0]?.message?.content ?? result?.choices?.[0]?.text ?? result?.output_text);
  }
  function setBusy(value) {
    generating = value;
    root()?.querySelectorAll('[data-icity-action=generate-character],[data-icity-action=generate-world]').forEach(button => {
      button.disabled = value;
      button.classList.toggle('is-loading', value);
    });
  }
  async function sourceData() {
    const [icity, contactsRecord] = await Promise.all([get(dataKey), get('contactsAppData')]);
    const contacts = Array.isArray(contactsRecord?.data?.contacts) ? contactsRecord.data.contacts : [];
    const users = Array.isArray(contactsRecord?.data?.users) ? contactsRecord.data.users : [];
    return { record: icity || { id: dataKey, entries: [], messages: [] }, contacts, users };
  }
  function refresh() {
    window.closeICityApp?.();
    setTimeout(() => window.openICityApp?.(), 0);
  }
  async function generateCharacter() {
    if (generating) return;
    const source = await sourceData();
    const characters = source.contacts.filter(item => item?.id && item.name);
    if (!characters.length) { alert(text.noCharacter); return; }
    const character = characters[Math.floor(Math.random() * characters.length)];
    const user = source.users.find(item => item?.name) || null;
    setBusy(true);
    try {
      const generated = await callApi('Return only valid JSON. You write short diary entries for fictional characters.', JSON.stringify({ task: 'Write a Chinese iCity diary entry of 40-130 Chinese characters based only on the supplied fictional character persona. Do not invent external facts. Output title, content, mentionsUser.', character: { name: character.name, persona: character.persona || '' }, user: user ? { name: user.name, persona: user.persona || '' } : null }));
      const entries = Array.isArray(source.record.entries) ? source.record.entries : [];
      entries.unshift({ id: 'character_' + Date.now(), authorId: character.id, authorType: 'character', authorName: character.name, authorAvatar: character.avatar || '', title: String(generated.title || '').slice(0, 60), content: String(generated.content || '').slice(0, 2000), mentionsUser: Boolean(generated.mentionsUser), source: 'character', createdAt: Date.now() });
      source.record.entries = entries;
      await put(source.record);
      refresh();
    } catch (error) { console.error(error); alert(error?.message || text.charFailed); } finally { setBusy(false); }
  }
  async function generateWorld() {
    if (generating) return;
    const source = await sourceData();
    setBusy(true);
    try {
      const generated = await callApi('Return only valid JSON. You generate fictional adult passerby diary entries.', JSON.stringify({ task: 'Create one fictional adult passerby NPC and a 35-110 Chinese character iCity diary entry. It must be a harmless everyday moment and must not include real personal information. Output name, title, content.' }));
      const entries = Array.isArray(source.record.entries) ? source.record.entries : [];
      const id = 'world_' + Date.now();
      entries.unshift({ id, authorId: id, authorType: 'world', authorName: String(generated.name || '\\u8def\\u4eba').slice(0, 24), authorAvatar: '', title: String(generated.title || '').slice(0, 60), content: String(generated.content || '').slice(0, 2000), source: 'world', createdAt: Date.now() });
      source.record.entries = entries;
      await put(source.record);
      refresh();
    } catch (error) { console.error(error); alert(error?.message || text.worldFailed); } finally { setBusy(false); }
  }

  function escapeHtml(value) { return String(value || '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char])); }
  function relativeTime(timestamp) { const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000)); return seconds < 60 ? '刚刚' : seconds < 3600 ? Math.floor(seconds / 60) + ' 分钟前' : seconds < 86400 ? Math.floor(seconds / 3600) + ' 小时前' : new Date(timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }); }
  function renderAvatar(person, className) { const name = String(person?.name || 'i'); return '<div class="' + className + '">' + (person?.avatar ? '<img src="' + escapeHtml(person.avatar) + '" alt="">' : escapeHtml(name.slice(0, 1))) + '</div>'; }
  function renderEntry(entry, people, likes) {
    const person = people.find(item => item.id === entry.authorId && item.type === entry.authorType) || { name: entry.authorName || '路人', avatar: entry.authorAvatar || '', type: entry.authorType || 'world' };
    const liked = likes.some(item => item.entryId === entry.id);
    const label = person.type === 'character' ? '角色' : person.type === 'world' ? '路人' : 'User';
    return '<article class="icity-entry"><header class="icity-entry-head">' + renderAvatar(person, 'icity-avatar') + '<div><strong>' + escapeHtml(person.name) + '</strong><small>@' + escapeHtml(person.name) + ' · ' + label + '</small></div><time>' + relativeTime(entry.createdAt) + '</time></header>' + (entry.title ? '<h2>' + escapeHtml(entry.title) + '</h2>' : '') + '<p>' + escapeHtml(entry.content) + '</p><footer><span>☁ 百色市 23°C</span><button class="icity-inline-icon" type="button" data-enhanced-like="' + escapeHtml(entry.id) + '"><svg viewBox="0 0 24 24" class="' + (liked ? 'is-liked' : '') + '"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg></button><i>▢</i><i>◷ ' + relativeTime(entry.createdAt) + '</i></footer></article>';
  }
  async function renderWorld() {
    const source = await sourceData();
    const people = [...source.users.map(item => ({ ...item, type: 'user' })), ...source.contacts.map(item => ({ ...item, type: 'character' }))];
    const user = source.users.find(item => item?.name);
    let entries = [...(source.record.entries || [])].sort((left, right) => right.createdAt - left.createdAt);
    if (worldTab === 'friends') entries = entries.filter(entry => entry.authorType === 'character');
    if (worldTab === 'notice') entries = entries.filter(entry => entry.authorType === 'character' && user && (entry.mentionsUser || String(entry.content || '').includes('@' + user.name)));
    if (worldTab === 'likes') entries = entries.filter(entry => (source.record.likes || []).some(like => like.entryId === entry.id));
    const note = { world: '点击右上角 API 生成路人日记。', friends: '角色发布的日记会出现在这里。', notice: '没有角色 @ 你的日记。', likes: '还没有喜欢的日记。' }[worldTab];
    $('#icityWorldFeed').innerHTML = entries.map(entry => renderEntry(entry, people, source.record.likes || [])).join('') || '<div class="icity-empty"><b>✎</b><strong>' + (worldTab === 'notice' ? '没有 @ 通知' : '这里还没有日记') + '</strong><span>' + note + '</span></div>';
    $('#icityWorldDescription').textContent = { world: '随机遇见正在记录生活的路人', friends: '只看角色发布的日记', notice: '角色在日记中提及你的记录', likes: '你喜欢过的日记' }[worldTab];
  }
  async function toggleLike(entryId) {
    const source = await sourceData();
    source.record.likes = Array.isArray(source.record.likes) ? source.record.likes : [];
    const index = source.record.likes.findIndex(item => item.entryId === entryId);
    if (index >= 0) source.record.likes.splice(index, 1); else source.record.likes.push({ entryId, createdAt: Date.now() });
    await put(source.record);
    renderWorld();
  }
  async function renderInbox() {
    const source = await sourceData();
    document.querySelectorAll('[data-icity-inbox]').forEach(button => button.classList.toggle('is-active', button.dataset.icityInbox === inboxTab));
    if (inboxTab === 'messages') {
      const npcs = source.contacts.flatMap(contact => (Array.isArray(contact.npcs) ? contact.npcs : []).filter(npc => npc?.id && npc.name).map(npc => ({ ...npc, avatar: npc.avatar || contact.avatar || '', ownerName: contact.name })));
      $('#icityInboxContent').innerHTML = npcs.map(npc => '<button class="icity-chat-row" type="button" data-enhanced-npc="' + escapeHtml(npc.id) + '" data-enhanced-name="' + escapeHtml(npc.name) + '" data-enhanced-avatar="' + escapeHtml(npc.avatar || '') + '">' + renderAvatar(npc, 'icity-chat-row-avatar') + '<span><strong>' + escapeHtml(npc.name) + '</strong><small>' + escapeHtml(npc.role || npc.ownerName || 'NPC') + '</small></span><i>›</i></button>').join('') || '<div class="icity-inbox-empty">联系人角色创建 NPC 后会出现在这里。</div>';
      return;
    }
    const books = (source.record.books || []).map(book => '<button class="icity-book-card" type="button"><b>' + escapeHtml(book.title.slice(0, 1)) + '</b><strong>' + escapeHtml(book.title) + '</strong><small>' + (book.count || 0) + ' 篇</small></button>').join('');
    $('#icityInboxContent').innerHTML = '<div class="icity-books"><button class="icity-new-book" type="button" data-enhanced-action="new-book"><span>+</span>新建<br>日记本</button>' + books + '</div><button class="icity-qa-preview" type="button" data-enhanced-action="open-qa"><strong>我的 Q&A 问答</strong><span>' + Object.keys(source.record.qa || {}).length + '%</span><div>🎬　📚　🎵　🍣　🌍</div><small>找到与你兴趣相投的人</small><b>继续答题 ›</b></button><button class="icity-inbox-row" type="button"><strong>🛰　相同爱好的人</strong><i>›</i></button>';
  }
  async function newBook() {
    const title = window.prompt('日记本名称');
    if (!title || !title.trim()) return;
    const source = await sourceData();
    source.record.books = Array.isArray(source.record.books) ? source.record.books : [];
    source.record.books.push({ id: 'book_' + Date.now(), title: title.trim().slice(0, 24), count: 0 });
    await put(source.record);
    renderInbox();
  }
  async function renderQa() {
    const source = await sourceData();
    const qa = source.record.qa || {};
    $('#icityQaProgress').textContent = Object.keys(qa).length;
    const categories = [['关于我','▣'],['电影','▶'],['阅读','▤'],['音乐','♫'],['美食料理','●'],['旅游','◎'],['二次元','☆'],['艺术历史','◇'],['游戏','⌘'],['体育','□'],['品牌消费','■']];
    $('#icityQaGrid').innerHTML = categories.map((item, index) => '<button class="icity-qa-card" type="button" data-enhanced-qa="' + index + '"><b>' + item[1] + '</b><strong>' + item[0] + '</strong><span>' + (qa[index] ? '7%' : '0%') + '</span><i><em style="width:' + (qa[index] ? '18%' : '0%') + '"></em></i></button>').join('');
  }
  function showEnhancedView(view, title) { document.querySelectorAll('[data-icity-view]').forEach(element => element.classList.toggle('is-active', element.dataset.icityView === view)); $('#icityPageTitle').textContent = title; $('#icityTopbar .icity-back-button').dataset.icityAction = 'go-home'; }
  function setTopApiAction(action, label) {
    const button = $('#icityTopbar .icity-top-actions button:first-child');
    if (!button) return;
    button.dataset.icityAction = action;
    button.setAttribute('aria-label', label);
  }
  async function renderNpcChat() {
    if (!activeNpc) return;
    const source = await sourceData();
    const face = activeNpc.avatar ? '<img src="' + escapeHtml(activeNpc.avatar) + '" alt="">' : escapeHtml(activeNpc.name.slice(0, 1));
    const history = source.record.messages.filter(message => message.npcId === activeNpc.id);
    $('#icityMessages').innerHTML = '<div class="icity-chat-day">今天</div><div class="icity-message"><div class="icity-message-avatar">' + face + '</div><div class="icity-bubble">你好，我是' + escapeHtml(activeNpc.name) + '，想和你聊聊。</div></div>' + history.map(message => '<div class="icity-message ' + (message.from === 'user' ? 'is-user' : '') + '"><div class="icity-message-avatar">' + (message.from === 'user' ? '我' : face) + '</div><div class="icity-bubble">' + escapeHtml(message.content) + '</div></div>').join('');
    const messages = $('#icityMessages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  }
  document.addEventListener('DOMContentLoaded', () => {
    root()?.addEventListener('click', async event => {
      const action = event.target.closest('[data-icity-action]')?.dataset.icityAction;
      if (action === 'generate-character') generateCharacter();
      if (action === 'generate-world') generateWorld();
      const enhancedAction = event.target.closest('[data-enhanced-action]')?.dataset.enhancedAction;
      if (enhancedAction === 'new-book') newBook();
      if (enhancedAction === 'open-qa') { showEnhancedView('qa', 'Q & A'); renderQa(); }
      const likeId = event.target.closest('[data-enhanced-like]')?.dataset.enhancedLike;
      if (likeId) toggleLike(likeId);
      const qaId = event.target.closest('[data-enhanced-qa]')?.dataset.enhancedQa;
      if (qaId !== undefined) { const source = await sourceData(); source.record.qa = source.record.qa || {}; source.record.qa[qaId] = true; await put(source.record); renderQa(); }
      const npcTarget = event.target.closest('[data-enhanced-npc]');
      if (npcTarget) { activeNpc = { id: npcTarget.dataset.enhancedNpc, name: npcTarget.dataset.enhancedName, avatar: npcTarget.dataset.enhancedAvatar || '' }; showEnhancedView('chat', activeNpc.name); renderNpcChat(); }
    });
    document.querySelectorAll('[data-icity-world]').forEach(button => button.addEventListener('click', () => { worldTab = button.dataset.icityWorld; document.querySelectorAll('[data-icity-world]').forEach(item => item.classList.toggle('is-active', item === button)); renderWorld(); }));
    document.querySelectorAll('[data-icity-inbox]').forEach(button => button.addEventListener('click', () => { inboxTab = button.dataset.icityInbox; renderInbox(); }));
    document.querySelector('[data-icity-nav=world]')?.addEventListener('click', () => { setTopApiAction('generate-world', 'API 生成路人日记'); setTimeout(renderWorld, 0); });
    document.querySelector('[data-icity-nav=inbox]')?.addEventListener('click', () => setTimeout(renderInbox, 0));
    document.querySelectorAll('[data-icity-nav]').forEach(button => button.addEventListener('click', () => { if (button.dataset.icityNav !== 'world') setTopApiAction('generate-character', 'API 生成角色日记'); }));
    $('#icityMessageForm')?.addEventListener('submit', async event => {
      if (!activeNpc) return;
      event.preventDefault();
      const input = $('#icityMessageInput');
      const content = input?.value.trim();
      if (!content) return;
      const source = await sourceData();
      source.record.messages.push({ npcId: activeNpc.id, from: 'user', content, createdAt: Date.now() });
      await put(source.record);
      input.value = '';
      renderNpcChat();
    });
  });
})();
