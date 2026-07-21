/* 语音设定 (MiniMax / ElevenLabs / SoVITS) 与 生图 (OpenAI / NovelAI / Midjourney)
   真实可调用的接口，无假数据。依赖 db.js 中的全局变量与保存函数：
   voiceDataList / voiceConnectedId / saveVoiceData
   imageGenDataList / imageGenConnectedId / saveImageGenData
   imageGenSettings / saveImageGenSettings
   并复用 settings-app.js 中的 showCustomAlert / showCustomConfirm / showToast。 */
(function () {
    'use strict';

    // ===== 通用小工具 =====
    function _vigVal(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }
    function _vigTrimSlash(u) { return u ? u.replace(/\/+$/, '') : u; }
    function _vigActiveProvider(segId) {
        const seg = document.getElementById(segId);
        const a = seg && seg.querySelector('.api-segment-item.active');
        return a ? a.dataset.provider : null;
    }
    function _vigSetActiveProvider(segId, provider) {
        const seg = document.getElementById(segId);
        if (!seg) return;
        seg.querySelectorAll('.api-segment-item').forEach(function (it) {
            it.classList.toggle('active', it.dataset.provider === provider);
        });
    }
    function _vigInitSeg(segId) {
        const seg = document.getElementById(segId);
        if (!seg || seg.dataset.vigBound === '1') return;
        seg.dataset.vigBound = '1';
        seg.addEventListener('click', function (e) {
            const it = e.target.closest('.api-segment-item');
            if (!it) return;
            seg.querySelectorAll('.api-segment-item').forEach(function (x) { x.classList.remove('active'); });
            it.classList.add('active');
        });
    }
    function _vigHexToBytes(hex) {
        const clean = (hex || '').replace(/[^0-9a-fA-F]/g, '');
        const out = new Uint8Array(clean.length / 2);
        for (let i = 0; i < out.length; i++) {
            out[i] = parseInt(clean.substr(i * 2, 2), 16);
        }
        return out;
    }
    function _vigPlayBytes(audioId, bytes, mime) {
        const audio = document.getElementById(audioId);
        if (!audio) return;
        const blob = new Blob([bytes], { type: mime || 'audio/mpeg' });
        try { if (audio.vigURL) URL.revokeObjectURL(audio.vigURL); } catch (e) {}
        const url = URL.createObjectURL(blob);
        audio.vigURL = url;
        audio.src = url;
        audio.style.display = 'block';
        audio.play().catch(function () { /* 自动播放被拦截，用户可手动点播放 */ });
    }
    function _vigSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    var voiceEditingId = null, imageGenEditingId = null;

    // ===== 语音设定：打开 / 关闭 =====
    function openVoiceApp() {
        const ui = document.getElementById('voiceAppUI');
        if (!ui) return;
        ui.style.display = 'flex';
        renderVoiceList();
        setTimeout(function () { ui.classList.add('show'); }, 10);
    }
    function closeVoiceApp() {
        const ui = document.getElementById('voiceAppUI');
        if (!ui) return;
        ui.classList.remove('show');
        setTimeout(function () { ui.style.display = 'none'; }, 300);
    }

    function renderVoiceList() {
        const connected = document.getElementById('voice-connected-container');
        const preset = document.getElementById('voice-preset-container');
        if (!connected || !preset) return;
        connected.innerHTML = '';
        preset.innerHTML = '';

        (voiceDataList || []).forEach(function (v) {
            const isConn = v.id === voiceConnectedId;
            const action = isConn ? 'openVoiceDrawer(event,' + v.id + ')' : 'connectVoice(' + v.id + ')';
            const check = isConn ? '<svg viewBox="0 0 24 24" fill="none" stroke="#007aff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : '';
            const sub = isConn ? '<div class="api-row-subtitle-text">已连接</div>' : '';
            const html =
                '<div class="api-row clickable" onclick="' + action + '">' +
                    '<div class="api-row-left">' + check + '</div>' +
                    '<div class="api-row-text"><div class="api-row-title-text">' + (v.name || '') + '</div>' + sub + '</div>' +
                    '<div class="api-row-right">' +
                        '<svg class="api-icon-info" viewBox="0 0 24 24" onclick="openVoiceDrawer(event,' + v.id + ')">' +
                            '<circle cx="12" cy="12" r="10" fill="none" stroke="#007aff" stroke-width="1.5"></circle>' +
                            '<circle cx="12" cy="6.8" r="1.3" fill="#007aff" stroke="none"></circle>' +
                            '<path d="M10.5 11 L12 10 V16.5 M10.5 16.5 H13.5" stroke="#007aff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>' +
                        '</svg>' +
                    '</div>' +
                '</div>';
            if (isConn) connected.innerHTML = html;
            else preset.innerHTML += html;
        });

        preset.innerHTML += '<div class="api-row clickable" onclick="openVoiceAddPage()">' +
            '<div class="api-row-left"></div>' +
            '<div class="api-row-text"><div class="api-row-title-text" style="color:#007aff;">+ 添加语音接口</div></div>' +
        '</div>';
    }

    function connectVoice(id) {
        voiceConnectedId = id;
        saveVoiceData();
        renderVoiceList();
    }

    function openVoiceAddPage() {
        _vigInitSeg('voice-add-provider');
        _vigSetActiveProvider('voice-add-provider', 'minimax');
        ['voice-add-name', 'voice-add-url', 'voice-add-key', 'voice-add-model', 'voice-add-voiceid'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const t = document.getElementById('voice-add-testtext');
        if (t) t.value = '你好，这是一段语音合成的试听示例。';
        const au = document.getElementById('voice-add-audio');
        if (au) { au.style.display = 'none'; au.removeAttribute('src'); }

        document.getElementById('voice-page-main').classList.remove('active');
        document.getElementById('voice-page-main').classList.add('slide-left');
        document.getElementById('voice-page-add').classList.remove('slide-right');
        document.getElementById('voice-page-add').classList.add('active');
    }
    function closeVoiceAddPage() {
        document.getElementById('voice-page-add').classList.remove('active');
        document.getElementById('voice-page-add').classList.add('slide-right');
        document.getElementById('voice-page-main').classList.remove('slide-left');
        document.getElementById('voice-page-main').classList.add('active');
    }

    function saveNewVoice() {
        const name = _vigVal('voice-add-name');
        const url = _vigVal('voice-add-url');
        const key = _vigVal('voice-add-key');
        const model = _vigVal('voice-add-model');
        const voiceId = _vigVal('voice-add-voiceid');
        const provider = _vigActiveProvider('voice-add-provider') || 'minimax';
        if (!name || !url) {
            showCustomAlert('提示', '请填写预设名称和接口地址');
            return;
        }
        const item = { id: Date.now(), name: name, provider: provider, url: url, key: key, model: model, voiceId: voiceId };
        voiceDataList.push(item);
        if (!voiceConnectedId) voiceConnectedId = item.id;
        saveVoiceData();
        renderVoiceList();
        closeVoiceAddPage();
    }

    function openVoiceDrawer(event, id) {
        if (event) event.stopPropagation();
        const v = (voiceDataList || []).find(function (x) { return x.id === id; });
        if (!v) return;
        voiceEditingId = id;
        _vigInitSeg('voice-edit-provider');
        _vigSetActiveProvider('voice-edit-provider', v.provider || 'minimax');
        document.getElementById('voice-edit-name').value = v.name || '';
        document.getElementById('voice-edit-url').value = v.url || '';
        document.getElementById('voice-edit-key').value = v.key || '';
        document.getElementById('voice-edit-model').value = v.model || '';
        document.getElementById('voice-edit-voiceid').value = v.voiceId || '';
        const t = document.getElementById('voice-edit-testtext');
        if (t) t.value = '你好，这是一段语音合成的试听示例。';
        const au = document.getElementById('voice-edit-audio');
        if (au) { au.style.display = 'none'; au.removeAttribute('src'); }
        document.getElementById('voiceDrawerOverlay').classList.add('show');
        document.getElementById('voiceDrawer').classList.add('show');
    }
    function closeVoiceDrawer() {
        document.getElementById('voiceDrawerOverlay').classList.remove('show');
        document.getElementById('voiceDrawer').classList.remove('show');
        voiceEditingId = null;
    }
    function saveVoiceDrawer() {
        if (!voiceEditingId) { closeVoiceDrawer(); return; }
        const v = (voiceDataList || []).find(function (x) { return x.id === voiceEditingId; });
        if (!v) { closeVoiceDrawer(); return; }
        v.name = _vigVal('voice-edit-name') || v.name;
        v.provider = _vigActiveProvider('voice-edit-provider') || v.provider || 'minimax';
        v.url = _vigVal('voice-edit-url');
        v.key = _vigVal('voice-edit-key');
        v.model = _vigVal('voice-edit-model');
        v.voiceId = _vigVal('voice-edit-voiceid');
        saveVoiceData();
        renderVoiceList();
        closeVoiceDrawer();
    }
    function deleteVoiceDrawer() {
        if (!voiceEditingId) return;
        showCustomConfirm('删除语音接口', '确定要删除这个语音预设吗？', '删除', true).then(function (ok) {
            if (!ok) return;
            voiceDataList = voiceDataList.filter(function (x) { return x.id !== voiceEditingId; });
            if (voiceConnectedId === voiceEditingId) {
                voiceConnectedId = voiceDataList.length > 0 ? voiceDataList[0].id : null;
            }
            saveVoiceData();
            renderVoiceList();
            closeVoiceDrawer();
        });
    }

    // ===== 语音试听：真实调用 =====
    async function testVoice(mode) {
        const p = mode === 'add' ? 'add' : 'edit';
        const provider = _vigActiveProvider('voice-' + p + '-provider') || 'minimax';
        const url = _vigVal('voice-' + p + '-url');
        const key = _vigVal('voice-' + p + '-key');
        const model = _vigVal('voice-' + p + '-model');
        const voiceId = _vigVal('voice-' + p + '-voiceid');
        const textEl = document.getElementById('voice-' + p + '-testtext');
        const text = (textEl && textEl.value) || '你好，这是一段语音合成的试听示例。';
        const audioId = 'voice-' + p + '-audio';

        if (!url) { showCustomAlert('提示', '请填写接口地址'); return; }
        const base = _vigTrimSlash(url);

        try {
            showToast('正在合成语音…');
            if (provider === 'minimax') {
                if (!key) { showCustomAlert('提示', 'MiniMax 需要 API Key'); return; }
                const resp = await fetch(base + '/v1/t2a_v2', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: model || 'speech-02-hd',
                        text: text,
                        voice_setting: { voice_id: voiceId || 'male-qn-qingse', speed: 1.0, vol: 1.0, pitch: 0 },
                        audio_setting: { audio_format: 'mp3', sample_rate: 32000 }
                    })
                });
                if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (await resp.text().catch(function () { return ''; })).slice(0, 200));
                const data = await resp.json();
                const audioHex = data && data.data && data.data.audio;
                if (!audioHex) throw new Error('返回数据中没有音频 (data.audio)');
                _vigPlayBytes(audioId, _vigHexToBytes(audioHex), 'audio/mpeg');
                showToast('试听已就绪');
            } else if (provider === 'elevenlabs') {
                if (!key) { showCustomAlert('提示', 'ElevenLabs 需要 xi-api-key'); return; }
                if (!voiceId) { showCustomAlert('提示', '请填写 ElevenLabs 的 Voice ID'); return; }
                const resp = await fetch(base + '/v1/text-to-speech/' + encodeURIComponent(voiceId), {
                    method: 'POST',
                    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
                    body: JSON.stringify({
                        text: text,
                        model_id: model || 'eleven_multilingual_v2',
                        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true }
                    })
                });
                if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (await resp.text().catch(function () { return ''; })).slice(0, 200));
                const buf = await resp.arrayBuffer();
                _vigPlayBytes(audioId, new Uint8Array(buf), 'audio/mpeg');
                showToast('试听已就绪');
            } else if (provider === 'sovits') {
                // GPT-SoVITS api_v2 (POST /tts)，返回音频流
                if (!voiceId) { showCustomAlert('提示', 'SoVITS 需要参考音频路径 (ref_audio_path)'); return; }
                const headers = { 'Content-Type': 'application/json', 'Accept': 'audio/wav' };
                if (key) headers['Authorization'] = 'Bearer ' + key;
                const resp = await fetch(base + '/tts', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        text: text,
                        text_lang: 'zh',
                        ref_audio_path: voiceId,
                        prompt_text: '',
                        prompt_lang: 'zh',
                        text_split_method: 'cut0',
                        media_type: 'wav',
                        streaming_mode: false
                    })
                });
                if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (await resp.text().catch(function () { return ''; })).slice(0, 200));
                const buf = await resp.arrayBuffer();
                if (!buf || buf.byteLength === 0) throw new Error('返回音频为空，请检查参考音频路径是否正确');
                _vigPlayBytes(audioId, new Uint8Array(buf), 'audio/wav');
                showToast('试听已就绪');
            }
        } catch (err) {
            console.error('语音试听失败:', err);
            showCustomAlert('合成失败', '请检查接口地址、Key、模型与音色参数是否正确，或目标服务器是否存在跨域 (CORS) 限制。\n\n错误信息: ' + (err && err.message ? err.message : err));
        }
    }

    // ===== 生图面板：打开 / 关闭 =====
    function openImageGenApp() {
        const ui = document.getElementById('imageGenAppUI');
        if (!ui) return;
        ui.style.display = 'flex';
        renderImageGenList();
        renderImageGenSettings();
        setTimeout(function () { ui.classList.add('show'); }, 10);
    }
    function closeImageGenApp() {
        const ui = document.getElementById('imageGenAppUI');
        if (!ui) return;
        ui.classList.remove('show');
        setTimeout(function () { ui.style.display = 'none'; }, 300);
    }

    function renderImageGenList() {
        const connected = document.getElementById('imggen-connected-container');
        const preset = document.getElementById('imggen-preset-container');
        if (!connected || !preset) return;
        connected.innerHTML = '';
        preset.innerHTML = '';

        (imageGenDataList || []).forEach(function (g) {
            const isConn = g.id === imageGenConnectedId;
            const action = isConn ? 'openImageGenDrawer(event,' + g.id + ')' : 'connectImageGen(' + g.id + ')';
            const check = isConn ? '<svg viewBox="0 0 24 24" fill="none" stroke="#007aff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : '';
            const sub = isConn ? '<div class="api-row-subtitle-text">已连接</div>' : '';
            const html =
                '<div class="api-row clickable" onclick="' + action + '">' +
                    '<div class="api-row-left">' + check + '</div>' +
                    '<div class="api-row-text"><div class="api-row-title-text">' + (g.name || '') + '</div>' + sub + '</div>' +
                    '<div class="api-row-right">' +
                        '<svg class="api-icon-info" viewBox="0 0 24 24" onclick="openImageGenDrawer(event,' + g.id + ')">' +
                            '<circle cx="12" cy="12" r="10" fill="none" stroke="#007aff" stroke-width="1.5"></circle>' +
                            '<circle cx="12" cy="6.8" r="1.3" fill="#007aff" stroke="none"></circle>' +
                            '<path d="M10.5 11 L12 10 V16.5 M10.5 16.5 H13.5" stroke="#007aff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>' +
                        '</svg>' +
                    '</div>' +
                '</div>';
            if (isConn) connected.innerHTML = html;
            else preset.innerHTML += html;
        });

        preset.innerHTML += '<div class="api-row clickable" onclick="openImageGenAddPage()">' +
            '<div class="api-row-left"></div>' +
            '<div class="api-row-text"><div class="api-row-title-text" style="color:#007aff;">+ 添加生图接口</div></div>' +
        '</div>';
    }

    function connectImageGen(id) {
        imageGenConnectedId = id;
        saveImageGenData();
        renderImageGenList();
        renderImageGenSettings();
    }

    function openImageGenAddPage() {
        _vigInitSeg('imggen-add-provider');
        _vigSetActiveProvider('imggen-add-provider', 'openai');
        ['imggen-add-name', 'imggen-add-url', 'imggen-add-key', 'imggen-add-model'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('imggen-page-main').classList.remove('active');
        document.getElementById('imggen-page-main').classList.add('slide-left');
        document.getElementById('imggen-page-add').classList.remove('slide-right');
        document.getElementById('imggen-page-add').classList.add('active');
    }
    function closeImageGenAddPage() {
        document.getElementById('imggen-page-add').classList.remove('active');
        document.getElementById('imggen-page-add').classList.add('slide-right');
        document.getElementById('imggen-page-main').classList.remove('slide-left');
        document.getElementById('imggen-page-main').classList.add('active');
    }

    function saveNewImageGen() {
        const name = _vigVal('imggen-add-name');
        const url = _vigVal('imggen-add-url');
        const key = _vigVal('imggen-add-key');
        const model = _vigVal('imggen-add-model');
        const provider = _vigActiveProvider('imggen-add-provider') || 'openai';
        if (!name || !url) {
            showCustomAlert('提示', '请填写预设名称和接口地址');
            return;
        }
        const item = { id: Date.now(), name: name, provider: provider, url: url, key: key, model: model };
        imageGenDataList.push(item);
        if (!imageGenConnectedId) imageGenConnectedId = item.id;
        saveImageGenData();
        renderImageGenList();
        renderImageGenSettings();
        closeImageGenAddPage();
    }

    function openImageGenDrawer(event, id) {
        if (event) event.stopPropagation();
        const g = (imageGenDataList || []).find(function (x) { return x.id === id; });
        if (!g) return;
        imageGenEditingId = id;
        _vigInitSeg('imggen-edit-provider');
        _vigSetActiveProvider('imggen-edit-provider', g.provider || 'openai');
        document.getElementById('imggen-edit-name').value = g.name || '';
        document.getElementById('imggen-edit-url').value = g.url || '';
        document.getElementById('imggen-edit-key').value = g.key || '';
        document.getElementById('imggen-edit-model').value = g.model || '';
        document.getElementById('imggenDrawerOverlay').classList.add('show');
        document.getElementById('imggenDrawer').classList.add('show');
    }
    function closeImageGenDrawer() {
        document.getElementById('imggenDrawerOverlay').classList.remove('show');
        document.getElementById('imggenDrawer').classList.remove('show');
        imageGenEditingId = null;
    }
    function saveImageGenDrawer() {
        if (!imageGenEditingId) { closeImageGenDrawer(); return; }
        const g = (imageGenDataList || []).find(function (x) { return x.id === imageGenEditingId; });
        if (!g) { closeImageGenDrawer(); return; }
        g.name = _vigVal('imggen-edit-name') || g.name;
        g.provider = _vigActiveProvider('imggen-edit-provider') || g.provider || 'openai';
        g.url = _vigVal('imggen-edit-url');
        g.key = _vigVal('imggen-edit-key');
        g.model = _vigVal('imggen-edit-model');
        saveImageGenData();
        renderImageGenList();
        renderImageGenSettings();
        closeImageGenDrawer();
    }
    function deleteImageGenDrawer() {
        if (!imageGenEditingId) return;
        showCustomConfirm('删除生图接口', '确定要删除这个生图预设吗？', '删除', true).then(function (ok) {
            if (!ok) return;
            imageGenDataList = imageGenDataList.filter(function (x) { return x.id !== imageGenEditingId; });
            if (imageGenConnectedId === imageGenEditingId) {
                imageGenConnectedId = imageGenDataList.length > 0 ? imageGenDataList[0].id : null;
            }
            saveImageGenData();
            renderImageGenList();
            renderImageGenSettings();
            closeImageGenDrawer();
        });
    }

    // ===== 生成设定：根据已连接服务商动态渲染 =====
    function _vigConnectedImggen() {
        return (imageGenDataList || []).find(function (x) { return x.id === imageGenConnectedId; });
    }
    function _vigProviderOfConnected() {
        const p = _vigConnectedImggen();
        return p ? (p.provider || 'openai') : null;
    }
    function _vigModelOfConnected() {
        const p = _vigConnectedImggen();
        return p ? (p.model || '') : '';
    }

    function _vigSel(options, selected) {
        return options.map(function (o) {
            const v = typeof o === 'string' ? o : o.v;
            const t = typeof o === 'string' ? o : (o.t || o.v);
            return '<option value="' + v + '"' + (String(selected) === String(v) ? ' selected' : '') + '>' + t + '</option>';
        }).join('');
    }

    function _vigPersistField(field) {
        const el = document.querySelector('#imggen-settings-container [data-field="' + field + '"]');
        if (!el) return;
        let v = el.value;
        if (el.dataset.type === 'int') v = parseInt(v, 10) || 0;
        else if (el.dataset.type === 'float') v = parseFloat(v) || 0;
        imageGenSettings[field] = v;
        saveImageGenSettings();
    }

    function renderImageGenSettings() {
        const box = document.getElementById('imggen-settings-container');
        if (!box) return;
        const provider = _vigProviderOfConnected();
        if (!provider) {
            box.innerHTML = '<div class="api-settings-card" style="color:#8e8e93;font-size:14px;text-align:center;">请先连接一个生图接口</div>';
            return;
        }
        const s = imageGenSettings || {};
        let html = '';

        // 公共：正面 / 负面提示词
        html += '<div class="api-settings-card">';
        html += '<div class="api-settings-row"><div class="api-settings-label">正面提示词</div>' +
            '<div class="api-textarea-wrapper"><textarea class="api-textarea" data-field="positivePrompt" placeholder="描述你想生成的画面…">' + (s.positivePrompt || '') + '</textarea></div></div>';
        html += '<div class="api-settings-row" style="margin-bottom:0;"><div class="api-settings-label">负面提示词</div>' +
            '<div class="api-textarea-wrapper"><textarea class="api-textarea" data-field="negativePrompt" placeholder="不想出现的内容…">' + (s.negativePrompt || '') + '</textarea></div></div>';
        html += '</div>';

        html += '<div class="api-settings-card">';
        if (provider === 'openai') {
            const model = (_vigModelOfConnected() || 'gpt-image-1').toLowerCase();
            const isDalle = model.indexOf('dall-e') >= 0 || model.indexOf('dalle') >= 0;
            if (isDalle) {
                html += '<div class="api-settings-row"><div class="api-settings-label">尺寸</div>' +
                    '<select class="api-settings-select" data-field="size">' + _vigSel(['1024x1024', '1792x1024', '1024x1792'], s.size || '1024x1024') + '</select></div>';
                html += '<div class="api-settings-row"><div class="api-settings-label">质量</div>' +
                    '<select class="api-settings-select" data-field="quality">' + _vigSel([{ v: 'standard', t: '标准' }, { v: 'hd', t: 'HD' }], s.quality || 'standard') + '</select></div>';
                html += '<div class="api-settings-row" style="margin-bottom:0;"><div class="api-settings-label">风格</div>' +
                    '<select class="api-settings-select" data-field="style">' + _vigSel([{ v: 'vivid', t: '生动' }, { v: 'natural', t: '自然' }], s.style || 'vivid') + '</select></div>';
            } else {
                html += '<div class="api-settings-row"><div class="api-settings-label">尺寸</div>' +
                    '<select class="api-settings-select" data-field="size">' + _vigSel(['auto', '1024x1024', '1536x1024', '1024x1536'], s.size || '1024x1024') + '</select></div>';
                html += '<div class="api-settings-inline"><div class="api-settings-row"><div class="api-settings-label">质量</div>' +
                    '<select class="api-settings-select" data-field="quality">' + _vigSel([{ v: 'low', t: '低' }, { v: 'medium', t: '中' }, { v: 'high', t: '高' }, { v: 'auto', t: '自动' }], s.quality || 'medium') + '</select></div>';
                html += '<div class="api-settings-row"><div class="api-settings-label">数量 N</div>' +
                    '<input class="api-settings-input" type="number" min="1" max="4" data-field="n" data-type="int" value="' + (s.n || 1) + '"></div></div>';
                html += '<div class="api-settings-row"><div class="api-settings-label">背景</div>' +
                    '<select class="api-settings-select" data-field="background">' + _vigSel([{ v: 'auto', t: '自动' }, { v: 'transparent', t: '透明' }, { v: 'opaque', t: '不透明' }], s.background || 'auto') + '</select></div>';
                html += '<div class="api-settings-row" style="margin-bottom:0;"><div class="api-settings-label">输出格式</div>' +
                    '<select class="api-settings-select" data-field="outputFormat">' + _vigSel(['png', 'jpeg', 'webp'], s.outputFormat || 'png') + '</select></div>';
            }
        } else if (provider === 'nai') {
            html += '<div class="api-settings-inline"><div class="api-settings-row"><div class="api-settings-label">宽度</div>' +
                '<input class="api-settings-input" type="number" min="64" max="1024" step="64" data-field="width" data-type="int" value="' + (s.width || 832) + '"></div>' +
                '<div class="api-settings-row"><div class="api-settings-label">高度</div>' +
                '<input class="api-settings-input" type="number" min="64" max="1024" step="64" data-field="height" data-type="int" value="' + (s.height || 1216) + '"></div></div>';
            html += '<div class="api-settings-row"><div class="api-settings-label">采样器</div>' +
                '<select class="api-settings-select" data-field="sampler">' + _vigSel(['k_euler', 'k_euler_ancestral', 'k_dpmpp_2s_ancestral', 'k_dpmpp_2m', 'k_dpmpp_sde', 'ddim'], s.sampler || 'k_euler') + '</select></div>';
            html += '<div class="api-settings-inline"><div class="api-settings-row"><div class="api-settings-label">步数</div>' +
                '<input class="api-settings-input" type="number" min="1" max="50" data-field="steps" data-type="int" value="' + (s.steps || 28) + '"></div>' +
                '<div class="api-settings-row"><div class="api-settings-label">引导系数(CFG)</div>' +
                '<input class="api-settings-input" type="number" min="0" max="10" step="0.1" data-field="scale" data-type="float" value="' + (s.scale || 5) + '"></div></div>';
            html += '<div class="api-settings-row" style="margin-bottom:0;"><div class="api-settings-label">种子(留空随机)</div>' +
                '<input class="api-settings-input" type="text" data-field="seed" placeholder="留空随机" value="' + (s.seed != null ? s.seed : '') + '"></div>';
        } else if (provider === 'mj') {
            html += '<div class="api-settings-row"><div class="api-settings-label">宽高比 --ar</div>' +
                '<select class="api-settings-select" data-field="aspectRatio">' + _vigSel(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'], s.aspectRatio || '1:1') + '</select></div>';
            html += '<div class="api-settings-row"><div class="api-settings-label">质量 --q</div>' +
                '<select class="api-settings-select" data-field="quality">' + _vigSel(['1', '2', '0.5'], s.quality || '1') + '</select></div>';
            html += '<div class="api-settings-inline"><div class="api-settings-row"><div class="api-settings-label">种子 --seed</div>' +
                '<input class="api-settings-input" type="text" data-field="seed" placeholder="留空随机" value="' + (s.seed != null ? s.seed : '') + '"></div>' +
                '<div class="api-settings-row"><div class="api-settings-label">数量 N</div>' +
                '<input class="api-settings-input" type="number" min="1" max="4" data-field="n" data-type="int" value="' + (s.n || 1) + '"></div></div>';
        }
        html += '</div>';

        box.innerHTML = html;
        // 绑定持久化
        box.querySelectorAll('[data-field]').forEach(function (el) {
            const f = el.getAttribute('data-field');
            el.addEventListener('input', function () { _vigPersistField(f); });
            el.addEventListener('change', function () { _vigPersistField(f); });
        });
    }

    function _vigGenLoading(msg) {
        document.getElementById('imggen-result').innerHTML = '<span class="api-gen-loading">' + msg + '</span>';
    }
    function _vigGenError(msg) {
        document.getElementById('imggen-result').innerHTML = '<span class="api-gen-error">' + msg + '</span>';
    }
    function _vigGenShowImg(src) {
        document.getElementById('imggen-result').innerHTML = '<img class="api-image-preview" alt="生成结果" src="' + src + '">';
    }

    // 从 ZIP 中提取第一个图片的原始字节 (NovelAI 返回 zip)
    function _vigExtractPngFromZip(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        const dv = new DataView(arrayBuffer);
        let eocd = -1;
        for (let i = bytes.length - 22; i >= 0; i--) {
            if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('返回数据不是有效的 ZIP');
        const cdCount = dv.getUint16(eocd + 10, true);
        const cdOff = dv.getUint32(eocd + 0x10, true);
        let cd = cdOff;
        for (let c = 0; c < cdCount && cd + 46 <= bytes.length; c++) {
            if (dv.getUint32(cd, true) !== 0x02014b50) break;
            const method = dv.getUint16(cd + 10, true);
            const compSize = dv.getUint32(cd + 20, true);
            const nameLen = dv.getUint16(cd + 28, true);
            const extraLen = dv.getUint16(cd + 30, true);
            const cmtLen = dv.getUint16(cd + 32, true);
            const localOff = dv.getUint32(cd + 42, true);
            const nameStart = cd + 46;
            const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLen));
            if (localOff + 30 > bytes.length) break;
            const lNameLen = dv.getUint16(localOff + 26, true);
            const lExtraLen = dv.getUint16(localOff + 28, true);
            const dataOff = localOff + 30 + lNameLen + lExtraLen;
            const comp = bytes.subarray(dataOff, dataOff + compSize);
            let out = null;
            if (method === 0) out = comp;
            else if (method === 8) out = (window.pako && pako.inflateRaw) ? pako.inflateRaw(comp) : null;
            if (out && (name.toLowerCase().indexOf('.png') >= 0 || name.toLowerCase().indexOf('image') >= 0)) return out;
            if (out) return out; // 直接返回第一个解压成功的文件
            const next = nameStart + nameLen + extraLen + cmtLen;
            if (next <= cd) break; // 防御异常
            cd = next;
        }
        throw new Error('ZIP 中未找到图片');
    }

    // ===== 生成图片：真实调用 =====
    async function generateImage() {
        const preset = _vigConnectedImggen();
        if (!preset) { showCustomAlert('提示', '请先连接一个生图接口'); return; }
        const s = imageGenSettings || {};
        const positive = (s.positivePrompt || '').trim();
        if (!positive) { showCustomAlert('提示', '请填写正面提示词'); return; }
        const negative = s.negativePrompt || '';
        const base = _vigTrimSlash(preset.url);
        const key = preset.key || '';
        const model = preset.model || '';

        try {
            _vigGenLoading('生成中…');
            if (preset.provider === 'openai') {
                const m = (model || 'gpt-image-1').toLowerCase();
                const isDalle = m.indexOf('dall-e') >= 0 || m.indexOf('dalle') >= 0;
                const body = { model: model || 'gpt-image-1', prompt: positive };
                if (isDalle) {
                    body.size = s.size || '1024x1024';
                    body.quality = s.quality || 'standard';
                    body.style = s.style || 'vivid';
                    body.response_format = 'b64_json';
                } else {
                    body.n = parseInt(s.n, 10) || 1;
                    body.size = s.size || '1024x1024';
                    body.quality = s.quality || 'medium';
                    body.background = s.background || 'auto';
                    body.output_format = s.outputFormat || 'png';
                }
                const resp = await fetch(base + '/images/generations', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (await resp.text().catch(function () { return ''; })).slice(0, 200));
                const data = await resp.json();
                const item = data && data.data && data.data[0];
                if (!item) throw new Error('返回数据为空');
                if (item.b64_json) _vigGenShowImg('data:image/' + (s.outputFormat || 'png') + ';base64,' + item.b64_json);
                else if (item.url) _vigGenShowImg(item.url);
                else throw new Error('返回数据中没有图片链接或 base64');
            } else if (preset.provider === 'nai') {
                const seedVal = (s.seed != null && String(s.seed).trim() !== '') ? parseInt(String(s.seed), 10) : Math.floor(Math.random() * 4294967295);
                const body = {
                    input: positive,
                    model: model || 'nai-diffusion-3',
                    action: 'generate',
                    parameters: {
                        params_version: 3,
                        width: parseInt(s.width, 10) || 832,
                        height: parseInt(s.height, 10) || 1216,
                        scale: parseFloat(s.scale) || 5,
                        sampler: s.sampler || 'k_euler',
                        steps: parseInt(s.steps, 10) || 28,
                        seed: seedVal,
                        n_samples: parseInt(s.n, 10) || 1,
                        ucPreset: 0,
                        quality_toggle: s.qualityToggle !== false,
                        negative_prompt: negative,
                        sm: !!s.sm,
                        sm_dyn: !!s.smDyn,
                        noise_schedule: s.noiseSchedule || 'native'
                    }
                };
                const resp = await fetch(base + '/ai/generate-image', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (await resp.text().catch(function () { return ''; })).slice(0, 200));
                const buf = await resp.arrayBuffer();
                const png = _vigExtractPngFromZip(buf);
                const blobUrl = URL.createObjectURL(new Blob([png], { type: 'image/png' }));
                _vigGenShowImg(blobUrl);
            } else if (preset.provider === 'mj') {
                // mj-discord-proxy: POST /mj/submit/imagine + 轮询 /mj/task/{id}/fetch
                const flags = [];
                if (negative && negative.trim()) flags.push('--no ' + negative.trim());
                flags.push('--ar ' + (s.aspectRatio || '1:1'));
                flags.push('--q ' + String(s.quality || '1'));
                if (s.seed != null && String(s.seed).trim() !== '') flags.push('--seed ' + String(s.seed).trim());
                if (s.version) flags.push('--v ' + String(s.version));
                if (s.stylize != null && String(s.stylize).trim() !== '') flags.push('--s ' + String(s.stylize));
                if (s.mode === 'relax') flags.push('--relax');
                else if (s.mode === 'turbo') flags.push('--turbo');
                else flags.push('--fast');
                const fullPrompt = positive + ' ' + flags.join(' ');
                const authHeaders = { 'Content-Type': 'application/json' };
                if (key) { authHeaders['mj-api-key'] = key; authHeaders['Authorization'] = 'Bearer ' + key; }
                let submitResp = await fetch(base + '/mj/submit/imagine', {
                    method: 'POST', headers: authHeaders,
                    body: JSON.stringify({ botType: 'MID_JOURNEY', prompt: fullPrompt })
                });
                let resPath = '/mj';
                if (submitResp.status === 404) {
                    // 兼容不带 /mj 前缀的代理
                    submitResp = await fetch(base + '/submit/imagine', {
                        method: 'POST', headers: authHeaders,
                        body: JSON.stringify({ botType: 'MID_JOURNEY', prompt: fullPrompt })
                    });
                    resPath = '';
                }
                if (!submitResp.ok) throw new Error('提交失败 HTTP ' + submitResp.status + ' ' + (await submitResp.text().catch(function () { return ''; })).slice(0, 200));
                const sd = await submitResp.json();
                const taskId = sd.result || (sd.data && sd.data.id);
                if (!taskId) throw new Error('未获取到任务 ID: ' + (typeof sd === 'object' ? JSON.stringify(sd).slice(0, 200) : sd));
                for (let i = 0; i < 60; i++) {
                    await _vigSleep(3000);
                    const fr = await fetch(base + resPath + '/task/' + taskId + '/fetch', { headers: authHeaders });
                    if (!fr.ok) throw new Error('查询任务失败 HTTP ' + fr.status);
                    const fd = await fr.json();
                    if (fd.status === 'SUCCESS') { _vigGenShowImg(fd.imageUrl); return; }
                    if (fd.status === 'FAILURE') throw new Error(fd.failReason || 'MJ 任务失败');
                    _vigGenLoading('生成中… 进度 ' + (fd.progress || '0%'));
                }
                throw new Error('MJ 任务超时，请稍后重试');
            } else {
                throw new Error('未知的服务商: ' + preset.provider);
            }
        } catch (err) {
            console.error('生图失败:', err);
            _vigGenError('生成失败: ' + (err && err.message ? err.message : err));
            showCustomAlert('生成失败', '请检查接口地址、Key、模型与参数是否正确，或目标服务器是否存在跨域 (CORS) 限制。\n\n错误信息: ' + (err && err.message ? err.message : err));
        }
    }

    // ===== 暴露给全局 (供 onclick 调用) =====
    window.openVoiceApp = openVoiceApp;
    window.closeVoiceApp = closeVoiceApp;
    window.renderVoiceList = renderVoiceList;
    window.connectVoice = connectVoice;
    window.openVoiceAddPage = openVoiceAddPage;
    window.closeVoiceAddPage = closeVoiceAddPage;
    window.saveNewVoice = saveNewVoice;
    window.openVoiceDrawer = openVoiceDrawer;
    window.closeVoiceDrawer = closeVoiceDrawer;
    window.saveVoiceDrawer = saveVoiceDrawer;
    window.deleteVoiceDrawer = deleteVoiceDrawer;
    window.testVoice = testVoice;

    window.openImageGenApp = openImageGenApp;
    window.closeImageGenApp = closeImageGenApp;
    window.renderImageGenList = renderImageGenList;
    window.renderImageGenSettings = renderImageGenSettings;
    window.connectImageGen = connectImageGen;
    window.openImageGenAddPage = openImageGenAddPage;
    window.closeImageGenAddPage = closeImageGenAddPage;
    window.saveNewImageGen = saveNewImageGen;
    window.openImageGenDrawer = openImageGenDrawer;
    window.closeImageGenDrawer = closeImageGenDrawer;
    window.saveImageGenDrawer = saveImageGenDrawer;
    window.deleteImageGenDrawer = deleteImageGenDrawer;
    window.generateImage = generateImage;

    // 页面加载时预绑定服务商选择段
    document.addEventListener('DOMContentLoaded', function () {
        _vigInitSeg('voice-add-provider');
        _vigInitSeg('voice-edit-provider');
        _vigInitSeg('imggen-add-provider');
        _vigInitSeg('imggen-edit-provider');
    });
})();

/* 服务商专属参数增强层：保留上方已有列表/页面逻辑，只覆盖表单、保存和真实调用。 */
(function () {
    'use strict';

    var voiceEditingId = null;
    var imageEditingId = null;

    function el(id) { return document.getElementById(id); }
    function val(id) { var node = el(id); return node ? String(node.value || '').trim() : ''; }
    function num(id, fallback) { var n = Number(val(id)); return Number.isFinite(n) ? n : fallback; }
    function checked(id) { var node = el(id); return !!(node && node.checked); }
    function trimSlash(url) { return String(url || '').replace(/\/+$/, ''); }
    function active(segId) {
        var node = el(segId);
        var item = node && node.querySelector('.api-segment-item.active');
        return item ? item.dataset.provider : '';
    }
    function setActive(segId, provider) {
        var node = el(segId);
        if (!node) return;
        node.querySelectorAll('.api-segment-item').forEach(function (item) {
            item.classList.toggle('active', item.dataset.provider === provider);
        });
    }
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
    }
    function options(items, selected) {
        return items.map(function (item) {
            var value = typeof item === 'string' ? item : item[0];
            var label = typeof item === 'string' ? item : item[1];
            return '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' + esc(label) + '</option>';
        }).join('');
    }
    function group(label, control, last) {
        return '<div class="api-form-group"' + (last ? ' style="margin-bottom:0;"' : '') + '><div class="api-form-label">' + label + '</div>' + control + '</div>';
    }
    function input(id, value, placeholder, type, attrs) {
        return '<div class="api-form-input-wrapper"><input class="api-form-input" id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value) + '" placeholder="' + esc(placeholder || '') + '" ' + (attrs || '') + '></div>';
    }
    function select(id, items, selected) {
        return '<select class="api-settings-select" id="' + id + '" style="width:100%;">' + options(items, selected) + '</select>';
    }
    function fetchInput(id, value, placeholder, onclick, text) {
        return '<div class="api-field-row"><div class="api-form-input-wrapper"><input class="api-form-input" id="' + id + '" value="' + esc(value) + '" placeholder="' + esc(placeholder) + '"></div><button class="api-mini-fetch" type="button" onclick="' + onclick + '">' + (text || '拉取') + '</button></div>';
    }
    function settingInput(id, value, type, attrs, placeholder) {
        return '<input class="api-settings-input" id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value) + '" ' + (attrs || '') + ' placeholder="' + esc(placeholder || '') + '">';
    }
    function settingRow(label, control) {
        return '<div class="api-settings-row"><div class="api-settings-label">' + label + '</div>' + control + '</div>';
    }
    function toggle(id, label, value) {
        return '<label class="api-check-row"><span class="api-settings-label">' + label + '</span><span><input class="api-check-input" id="' + id + '" type="checkbox"' + (value ? ' checked' : '') + '><span class="api-check-control"></span></span></label>';
    }
    function providerDefaults(kind, provider) {
        var table = kind === 'voice' ? {
            minimax: { url: 'https://api.minimax.io', model: 'speech-02-hd', voiceId: 'male-qn-qingse' },
            elevenlabs: { url: 'https://api.elevenlabs.io', model: 'eleven_multilingual_v2', voiceId: '' },
            sovits: { url: 'http://127.0.0.1:9880', model: '', voiceId: '' }
        } : {
            openai: { url: 'https://api.openai.com/v1', model: 'gpt-image-1' },
            nai: { url: 'https://image.novelai.net', model: 'nai-diffusion-4-curated-preview' },
            mj: { url: '', model: '' }
        };
        return table[provider];
    }
    function fillDefaultUrl(kind, scope, provider) {
        var node = el((kind === 'voice' ? 'voice-' : 'imggen-') + scope + '-url');
        var defaults = providerDefaults(kind, provider);
        if (node) node.placeholder = defaults.url || (provider === 'mj' ? '填写 Midjourney 代理接口地址' : '填写兼容接口地址');
    }

    function renderVoiceFields(scope, provider, data) {
        data = data || {};
        var p = data.params || {};
        var root = el('voice-' + scope + '-fields');
        if (!root) return;
        var prefix = 'voice-' + scope + '-';
        var html = '';
        if (provider === 'minimax') {
            html += group('MODEL（语音模型）', fetchInput(prefix + 'model', data.model || 'speech-02-hd', 'speech-02-hd', "vigFetchModels('voice','" + scope + "','model')"));
            html += group('VOICE ID（音色 ID）', input(prefix + 'voiceid', data.voiceId || 'male-qn-qingse', 'male-qn-qingse'));
            html += group('语速 / 音量', '<div class="api-settings-inline">' + settingInput(prefix + 'speed', p.speed == null ? 1 : p.speed, 'number', 'min="0.5" max="2" step="0.1"') + settingInput(prefix + 'vol', p.vol == null ? 1 : p.vol, 'number', 'min="0" max="10" step="0.1"') + '</div>');
            html += group('音调 / 情绪', '<div class="api-settings-inline">' + settingInput(prefix + 'pitch', p.pitch == null ? 0 : p.pitch, 'number', 'min="-12" max="12" step="1"') + select(prefix + 'emotion', [['', '自动'], ['happy', '开心'], ['sad', '悲伤'], ['angry', '愤怒'], ['fearful', '恐惧'], ['disgusted', '厌恶'], ['surprised', '惊讶'], ['calm', '平静']], p.emotion || '') + '</div>');
            html += group('格式 / 采样率', '<div class="api-settings-inline">' + select(prefix + 'format', ['mp3', 'wav', 'pcm', 'flac'], p.audioFormat || 'mp3') + select(prefix + 'sample', ['16000', '24000', '32000', '44100'], String(p.sampleRate || 32000)) + '</div>', true);
        } else if (provider === 'elevenlabs') {
            html += group('MODEL（语音模型）', fetchInput(prefix + 'model', data.model || 'eleven_multilingual_v2', 'eleven_multilingual_v2', "vigFetchModels('voice','" + scope + "','model')"));
            html += group('VOICE ID（音色）', fetchInput(prefix + 'voiceid', data.voiceId || '', '填写或拉取 Voice ID', "vigFetchModels('voice','" + scope + "','voice')", '拉取'));
            html += group('稳定度 / 相似度', '<div class="api-settings-inline">' + settingInput(prefix + 'stability', p.stability == null ? 0.5 : p.stability, 'number', 'min="0" max="1" step="0.05"') + settingInput(prefix + 'similarity', p.similarityBoost == null ? 0.75 : p.similarityBoost, 'number', 'min="0" max="1" step="0.05"') + '</div>');
            html += group('风格强度', settingInput(prefix + 'style', p.style == null ? 0 : p.style, 'number', 'min="0" max="1" step="0.05"'));
            html += group('说话者增强', toggle(prefix + 'speaker', 'USE SPEAKER BOOST', p.useSpeakerBoost !== false), true);
        } else {
            html += group('参考音频（REF AUDIO PATH）', input(prefix + 'voiceid', data.voiceId || p.refAudioPath || '', '本地路径或服务端可访问 URL'));
            html += group('参考音频文本', input(prefix + 'prompttext', p.promptText || '', '参考音频对应的文字，可留空'));
            html += group('参考语言 / 目标语言', '<div class="api-settings-inline">' + select(prefix + 'promptlang', ['zh', 'en', 'ja', 'ko', 'yue'], p.promptLang || 'zh') + select(prefix + 'textlang', ['zh', 'en', 'ja', 'ko', 'yue'], p.textLang || 'zh') + '</div>');
            html += group('切句方式', select(prefix + 'split', [['cut0', '不切'], ['cut1', '四句一切'], ['cut2', '50 字一切'], ['cut3', '按中文句号切'], ['cut4', '按英文句号切'], ['cut5', '按标点切']], p.textSplitMethod || 'cut5'));
            html += group('TOP P / 温度', '<div class="api-settings-inline">' + settingInput(prefix + 'topp', p.topP == null ? 1 : p.topP, 'number', 'min="0" max="1" step="0.05"') + settingInput(prefix + 'temperature', p.temperature == null ? 1 : p.temperature, 'number', 'min="0" max="2" step="0.05"') + '</div>');
            html += group('语速 / 输出格式', '<div class="api-settings-inline">' + settingInput(prefix + 'speed', p.speed == null ? 1 : p.speed, 'number', 'min="0.5" max="2" step="0.05"') + select(prefix + 'format', ['wav', 'mp3', 'flac', 'ogg', 'aac'], p.mediaFormat || 'wav') + '</div>', true);
        }
        root.innerHTML = html;
        fillDefaultUrl('voice', scope, provider);
    }

    function readVoice(scope, provider) {
        var prefix = 'voice-' + scope + '-';
        var result = { model: val(prefix + 'model'), voiceId: val(prefix + 'voiceid'), params: {} };
        if (provider === 'minimax') {
            result.params = { speed: num(prefix + 'speed', 1), vol: num(prefix + 'vol', 1), pitch: num(prefix + 'pitch', 0), emotion: val(prefix + 'emotion'), audioFormat: val(prefix + 'format') || 'mp3', sampleRate: num(prefix + 'sample', 32000) };
        } else if (provider === 'elevenlabs') {
            result.params = { stability: num(prefix + 'stability', 0.5), similarityBoost: num(prefix + 'similarity', 0.75), style: num(prefix + 'style', 0), useSpeakerBoost: checked(prefix + 'speaker') };
        } else {
            result.params = { refAudioPath: result.voiceId, promptText: val(prefix + 'prompttext'), promptLang: val(prefix + 'promptlang') || 'zh', textLang: val(prefix + 'textlang') || 'zh', textSplitMethod: val(prefix + 'split') || 'cut5', topP: num(prefix + 'topp', 1), temperature: num(prefix + 'temperature', 1), speed: num(prefix + 'speed', 1), mediaFormat: val(prefix + 'format') || 'wav' };
        }
        return result;
    }

    function imageDefaults(provider) {
        if (provider === 'openai') return { positivePrompt: '', negativePrompt: '', size: '1024x1024', quality: 'auto', n: 1, background: 'auto', outputFormat: 'png', style: 'vivid' };
        if (provider === 'nai') return { positivePrompt: '', negativePrompt: '', width: 832, height: 1216, sampler: 'k_euler_ancestral', steps: 28, scale: 5, seed: '', n: 1, qualityToggle: true, sm: false, smDyn: false, noiseSchedule: 'native' };
        return { positivePrompt: '', negativePrompt: '', aspectRatio: '1:1', quality: '1', seed: '', version: '7', stylize: 100, mode: 'fast' };
    }
    function renderImageFields(scope, provider, data) {
        data = data || {};
        var root = el('imggen-' + scope + '-fields');
        if (!root) return;
        var id = 'imggen-' + scope + '-model';
        if (provider === 'openai') {
            root.innerHTML = group('MODEL（图像模型）', fetchInput(id, data.model || 'gpt-image-1', 'gpt-image-1', "vigFetchModels('image','" + scope + "','model')"), true);
        } else if (provider === 'nai') {
            root.innerHTML = group('MODEL（NovelAI 模型）', select(id, ['nai-diffusion-4-curated-preview', 'nai-diffusion-4-full', 'nai-diffusion-3', 'nai-diffusion-furry-3'], data.model || 'nai-diffusion-4-curated-preview'), true);
        } else {
            root.innerHTML = '<div class="api-form-label" style="line-height:1.5;">Midjourney 代理通过版本参数选择模型，不提供通用模型列表。</div>';
        }
        fillDefaultUrl('image', scope, provider);
        renderImageParams('imggen-' + scope + '-gen', provider, data.params || {}, { showPrompts: true });
    }
    function promptPresetOptions(selectedId) {
        var html = '<option value="">选择提示词预设</option>';
        (imagePromptPresets || []).forEach(function (preset) {
            html += '<option value="' + esc(preset.id) + '"' + (String(preset.id) === String(selectedId) ? ' selected' : '') + '>' + esc(preset.name) + '</option>';
        });
        return html;
    }
    function promptPresetControls(containerId) {
        return '<div class="api-prompt-preset-row"><select class="api-settings-select" id="' + containerId + '-promptpreset" onchange="vigApplyPromptPreset(\'' + containerId + '\')">' + promptPresetOptions('') + '</select></div>' +
            '<div class="api-prompt-actions"><button class="api-prompt-action" type="button" onclick="vigSavePromptPreset(\'' + containerId + '\')">保存当前</button><button class="api-prompt-action danger" type="button" onclick="vigDeletePromptPreset(\'' + containerId + '\')">删除预设</button></div>';
    }
    function renderImageParams(containerId, provider, values, config) {
        var root = el(containerId);
        if (!root) return;
        config = config || {};
        var p = Object.assign(imageDefaults(provider), values || {});
        var pre = containerId + '-';
        var html = '';
        if (config.showPrompts !== false) {
            html += '<div class="api-settings-card">';
            html += settingRow('提示词预设', promptPresetControls(containerId));
            html += settingRow('正面提示词', '<div class="api-textarea-wrapper"><textarea class="api-textarea" id="' + pre + 'positive" placeholder="描述要生成的画面">' + esc(p.positivePrompt) + '</textarea></div>');
            var negativeLabel = provider === 'mj' ? '排除内容（--no）' : (provider === 'openai' ? '排除约束（拼入提示词）' : '负面提示词');
            html += settingRow(negativeLabel, '<div class="api-textarea-wrapper"><textarea class="api-textarea" id="' + pre + 'negative" placeholder="不希望出现的内容">' + esc(p.negativePrompt) + '</textarea></div>');
            html += '</div>';
        }
        html += '<div class="api-settings-card">';
        if (provider === 'openai') {
            html += settingRow('图片尺寸', select(pre + 'size', ['auto', '1024x1024', '1536x1024', '1024x1536', '1792x1024', '1024x1792'], p.size));
            html += settingRow('质量', select(pre + 'quality', [['auto', '自动'], ['low', '低'], ['medium', '中'], ['high', '高'], ['standard', '标准'], ['hd', 'HD']], p.quality));
            html += settingRow('数量', settingInput(pre + 'n', p.n, 'number', 'min="1" max="10" step="1"'));
            html += settingRow('背景', select(pre + 'background', [['auto', '自动'], ['transparent', '透明'], ['opaque', '不透明']], p.background));
            html += settingRow('输出格式', select(pre + 'format', ['png', 'jpeg', 'webp'], p.outputFormat));
            html += settingRow('DALL-E 3 风格', select(pre + 'style', [['vivid', '生动'], ['natural', '自然']], p.style));
        } else if (provider === 'nai') {
            html += settingRow('宽度 / 高度', '<div class="api-settings-inline">' + settingInput(pre + 'width', p.width, 'number', 'min="64" max="2048" step="64"') + settingInput(pre + 'height', p.height, 'number', 'min="64" max="2048" step="64"') + '</div>');
            html += settingRow('采样器', select(pre + 'sampler', ['k_euler', 'k_euler_ancestral', 'k_dpmpp_2s_ancestral', 'k_dpmpp_2m', 'k_dpmpp_sde', 'ddim'], p.sampler));
            html += settingRow('步数 / CFG', '<div class="api-settings-inline">' + settingInput(pre + 'steps', p.steps, 'number', 'min="1" max="50" step="1"') + settingInput(pre + 'scale', p.scale, 'number', 'min="0" max="10" step="0.1"') + '</div>');
            html += settingRow('种子 / 数量', '<div class="api-settings-inline">' + settingInput(pre + 'seed', p.seed, 'text', '', '留空随机') + settingInput(pre + 'n', p.n, 'number', 'min="1" max="4" step="1"') + '</div>');
            html += settingRow('噪声计划', select(pre + 'noise', ['native', 'karras', 'exponential', 'polyexponential'], p.noiseSchedule));
            html += toggle(pre + 'qualitytoggle', '质量标签', p.qualityToggle) + toggle(pre + 'sm', 'SMEA', p.sm) + toggle(pre + 'smdyn', 'SMEA DYN', p.smDyn);
        } else {
            html += settingRow('宽高比（--ar）', select(pre + 'ar', ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'], p.aspectRatio));
            html += settingRow('质量（--q）', select(pre + 'quality', ['0.5', '1', '2'], String(p.quality)));
            html += settingRow('版本（--v）', select(pre + 'version', ['5', '5.1', '5.2', '6', '6.1', '7'], String(p.version)));
            html += settingRow('风格化（--s）', settingInput(pre + 'stylize', p.stylize, 'number', 'min="0" max="1000" step="1"'));
            html += settingRow('种子', settingInput(pre + 'seed', p.seed, 'text', '', '留空随机'));
            html += settingRow('模式', select(pre + 'mode', [['fast', 'Fast'], ['relax', 'Relax'], ['turbo', 'Turbo']], p.mode));
        }
        html += '</div>';
        root.innerHTML = html;
    }
    function readImageParams(containerId, provider, previous) {
        var pre = containerId + '-';
        previous = previous || {};
        var positiveNode = el(pre + 'positive');
        var negativeNode = el(pre + 'negative');
        var p = {
            positivePrompt: positiveNode ? val(pre + 'positive') : (previous.positivePrompt || ''),
            negativePrompt: negativeNode ? val(pre + 'negative') : (previous.negativePrompt || '')
        };
        if (provider === 'openai') Object.assign(p, { size: val(pre + 'size'), quality: val(pre + 'quality'), n: num(pre + 'n', 1), background: val(pre + 'background'), outputFormat: val(pre + 'format'), style: val(pre + 'style') });
        else if (provider === 'nai') Object.assign(p, { width: num(pre + 'width', 832), height: num(pre + 'height', 1216), sampler: val(pre + 'sampler'), steps: num(pre + 'steps', 28), scale: num(pre + 'scale', 5), seed: val(pre + 'seed'), n: num(pre + 'n', 1), noiseSchedule: val(pre + 'noise'), qualityToggle: checked(pre + 'qualitytoggle'), sm: checked(pre + 'sm'), smDyn: checked(pre + 'smdyn') });
        else Object.assign(p, { aspectRatio: val(pre + 'ar'), quality: val(pre + 'quality'), version: val(pre + 'version'), stylize: num(pre + 'stylize', 100), seed: val(pre + 'seed'), mode: val(pre + 'mode') });
        return p;
    }
    function refreshPromptPresetSelect(containerId, selectedId) {
        var node = el(containerId + '-promptpreset');
        if (node) node.innerHTML = promptPresetOptions(selectedId);
    }
    window.vigApplyPromptPreset = function (containerId) {
        var presetId = val(containerId + '-promptpreset');
        var preset = (imagePromptPresets || []).find(function (item) { return String(item.id) === String(presetId); });
        if (!preset) return;
        var positive = el(containerId + '-positive');
        var negative = el(containerId + '-negative');
        if (positive) positive.value = preset.positivePrompt || '';
        if (negative) negative.value = preset.negativePrompt || '';
    };
    window.vigSavePromptPreset = async function (containerId) {
        var positivePrompt = val(containerId + '-positive');
        var negativePrompt = val(containerId + '-negative');
        if (!positivePrompt && !negativePrompt) { showCustomAlert('提示', '请先填写正面词或负面词'); return; }
        var selectedId = val(containerId + '-promptpreset');
        var selected = (imagePromptPresets || []).find(function (item) { return String(item.id) === String(selectedId); });
        var name = await showCustomPrompt('保存提示词预设', { placeholder: '输入预设名称', value: selected ? selected.name : '' }, '保存');
        name = String(name == null ? '' : name).trim();
        if (!name) return;
        var preset = selected || (imagePromptPresets || []).find(function (item) { return item.name === name; });
        if (preset) {
            preset.name = name;
            preset.positivePrompt = positivePrompt;
            preset.negativePrompt = negativePrompt;
        } else {
            preset = { id: Date.now(), name: name, positivePrompt: positivePrompt, negativePrompt: negativePrompt };
            imagePromptPresets.push(preset);
        }
        saveImageGenData();
        refreshPromptPresetSelect(containerId, preset.id);
        showToast('提示词预设已保存');
    };
    window.vigDeletePromptPreset = function (containerId) {
        var presetId = val(containerId + '-promptpreset');
        var preset = (imagePromptPresets || []).find(function (item) { return String(item.id) === String(presetId); });
        if (!preset) { showCustomAlert('提示', '请先选择要删除的提示词预设'); return; }
        showCustomConfirm('删除提示词预设', '确定要删除“' + preset.name + '”吗？', '删除', true).then(function (ok) {
            if (!ok) return;
            imagePromptPresets = imagePromptPresets.filter(function (item) { return String(item.id) !== String(presetId); });
            saveImageGenData();
            refreshPromptPresetSelect(containerId, '');
            showToast('提示词预设已删除');
        });
    };
    function selectFetched(title, items, current, callback) {
        if (!items.length) { showToast('没有找到可用项'); return; }
        if (typeof openUniversalSelect === 'function') {
            openUniversalSelect({ title: title, items: items.map(function (x) { return { label: x.label || x.value || x, value: x.value || x }; }), currentValue: current, searchable: true, onSelect: callback });
        } else callback(items[0].value || items[0]);
    }
    async function fetchModels(kind, scope, target) {
        var prefix = kind === 'voice' ? 'voice-' : 'imggen-';
        var provider = active(prefix + scope + '-provider');
        var url = trimSlash(val(prefix + scope + '-url'));
        var key = val(prefix + scope + '-key');
        if (!url || !key) { showCustomAlert('提示', '请先填写 URL 和 Key'); return; }
        try {
            showToast('正在拉取…');
            var endpoint, headers = {}, data, list = [];
            if (kind === 'voice' && provider === 'minimax') {
                endpoint = url + '/v1/list_model?type=audio'; headers.Authorization = 'Bearer ' + key;
            } else if (kind === 'voice' && provider === 'elevenlabs') {
                endpoint = url + (target === 'voice' ? '/v1/voices' : '/v1/models'); headers['xi-api-key'] = key;
            } else if (kind === 'image' && provider === 'openai') {
                endpoint = url + '/models'; headers.Authorization = 'Bearer ' + key;
            } else {
                showCustomAlert('提示', provider === 'nai' ? 'NovelAI 官方接口不提供模型列表端点，请直接选择页面中的官方模型。' : '该服务商没有通用模型列表端点。'); return;
            }
            var response = await fetch(endpoint, { headers: headers });
            if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + (await response.text()).slice(0, 180));
            data = await response.json();
            if (provider === 'elevenlabs' && target === 'voice') list = (data.voices || []).map(function (x) { return { label: x.name + ' · ' + x.voice_id, value: x.voice_id }; });
            else if (provider === 'elevenlabs') list = (Array.isArray(data) ? data : (data.models || [])).map(function (x) { return { label: x.name || x.model_id, value: x.model_id }; });
            else {
                var rows = data.data || data.models || data.model_list || [];
                list = rows.map(function (x) { var id = typeof x === 'string' ? x : (x.id || x.model || x.model_id); return { label: id, value: id }; }).filter(function (x) { return x.value; });
                if (kind === 'image') list = list.filter(function (x) { return /image|dall-e|gpt-image/i.test(x.value); });
            }
            var inputId = prefix + scope + '-' + (target === 'voice' ? 'voiceid' : 'model');
            selectFetched(target === 'voice' ? '选择音色' : '选择模型', list, val(inputId), function (chosen) { if (el(inputId)) el(inputId).value = chosen; });
            showToast('拉取成功');
        } catch (error) {
            showCustomAlert('拉取失败', '请检查 URL、Key、接口兼容性或 CORS 设置。\n\n' + error.message);
        }
    }
    window.vigFetchModels = fetchModels;

    function bindSegments() {
        [['voice', 'add'], ['voice', 'edit'], ['image', 'add'], ['image', 'edit']].forEach(function (pair) {
            var kind = pair[0], scope = pair[1], base = kind === 'voice' ? 'voice-' : 'imggen-';
            var segment = el(base + scope + '-provider');
            if (!segment || segment.dataset.vigEnhanced) return;
            segment.dataset.vigEnhanced = '1';
            segment.addEventListener('click', function (event) {
                var item = event.target.closest('.api-segment-item');
                if (!item) return;
                setTimeout(function () {
                    if (kind === 'voice') renderVoiceFields(scope, item.dataset.provider, {});
                    else renderImageFields(scope, item.dataset.provider, {});
                }, 0);
            });
        });
    }

    var oldOpenVoiceAdd = window.openVoiceAddPage;
    window.openVoiceAddPage = function () {
        oldOpenVoiceAdd();
        setActive('voice-add-provider', 'minimax');
        renderVoiceFields('add', 'minimax', {});
    };
    window.saveNewVoice = function () {
        var provider = active('voice-add-provider') || 'minimax';
        var fields = readVoice('add', provider);
        var name = val('voice-add-name'), url = val('voice-add-url'), key = val('voice-add-key');
        if (!name || !url) { showCustomAlert('提示', '请填写预设名称和接口地址'); return; }
        var item = { id: Date.now(), name: name, provider: provider, url: url, key: key, model: fields.model, voiceId: fields.voiceId, params: fields.params };
        voiceDataList.push(item); if (!voiceConnectedId) voiceConnectedId = item.id;
        saveVoiceData(); renderVoiceList(); closeVoiceAddPage();
    };
    window.openVoiceDrawer = function (event, id) {
        if (event) event.stopPropagation();
        var item = (voiceDataList || []).find(function (x) { return x.id === id; }); if (!item) return;
        voiceEditingId = id; setActive('voice-edit-provider', item.provider || 'minimax');
        el('voice-edit-name').value = item.name || ''; el('voice-edit-url').value = item.url || ''; el('voice-edit-key').value = item.key || '';
        renderVoiceFields('edit', item.provider || 'minimax', item);
        el('voiceDrawerOverlay').classList.add('show'); el('voiceDrawer').classList.add('show');
    };
    window.closeVoiceDrawer = function () { el('voiceDrawerOverlay').classList.remove('show'); el('voiceDrawer').classList.remove('show'); voiceEditingId = null; };
    window.saveVoiceDrawer = function () {
        var item = (voiceDataList || []).find(function (x) { return x.id === voiceEditingId; }); if (!item) return window.closeVoiceDrawer();
        var provider = active('voice-edit-provider') || item.provider; var fields = readVoice('edit', provider);
        Object.assign(item, { name: val('voice-edit-name') || item.name, provider: provider, url: val('voice-edit-url'), key: val('voice-edit-key'), model: fields.model, voiceId: fields.voiceId, params: fields.params });
        saveVoiceData(); renderVoiceList(); window.closeVoiceDrawer();
    };
    window.deleteVoiceDrawer = function () {
        if (!voiceEditingId) return;
        var deletingId = voiceEditingId;
        showCustomConfirm('删除语音接口', '确定要删除这个语音预设吗？', '删除', true).then(function (ok) {
            if (!ok) return;
            voiceDataList = voiceDataList.filter(function (x) { return x.id !== deletingId; });
            if (voiceConnectedId === deletingId) voiceConnectedId = voiceDataList.length ? voiceDataList[0].id : null;
            saveVoiceData(); renderVoiceList(); window.closeVoiceDrawer();
        });
    };

    async function enhancedTestVoice(scope) {
        var provider = active('voice-' + scope + '-provider') || 'minimax'; var fields = readVoice(scope, provider); var p = fields.params;
        var base = trimSlash(val('voice-' + scope + '-url')); var key = val('voice-' + scope + '-key'); var text = val('voice-' + scope + '-testtext') || '你好，这是一段语音合成的试听示例。';
        if (!base) return showCustomAlert('提示', '请填写接口地址');
        try {
            showToast('正在合成语音…'); var response, headers, body;
            if (provider === 'minimax') {
                body = { model: fields.model || 'speech-02-hd', text: text, voice_setting: { voice_id: fields.voiceId || 'male-qn-qingse', speed: p.speed, vol: p.vol, pitch: p.pitch }, audio_setting: { audio_format: p.audioFormat, sample_rate: p.sampleRate } };
                if (p.emotion) body.voice_setting.emotion = p.emotion;
                response = await fetch(base + '/v1/t2a_v2', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + (await response.text()).slice(0, 180));
                var json = await response.json(); var hex = json && json.data && json.data.audio; if (!hex) throw new Error('返回数据缺少 data.audio');
                var bytes = new Uint8Array(hex.length / 2); for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
                playAudio(scope, bytes, p.audioFormat === 'wav' ? 'audio/wav' : 'audio/mpeg');
            } else {
                headers = { 'Content-Type': 'application/json' };
                if (provider === 'elevenlabs') {
                    if (!fields.voiceId) throw new Error('请填写 Voice ID'); headers['xi-api-key'] = key; headers.Accept = 'audio/mpeg';
                    body = { text: text, model_id: fields.model || 'eleven_multilingual_v2', voice_settings: { stability: p.stability, similarity_boost: p.similarityBoost, style: p.style, use_speaker_boost: p.useSpeakerBoost } };
                    response = await fetch(base + '/v1/text-to-speech/' + encodeURIComponent(fields.voiceId), { method: 'POST', headers: headers, body: JSON.stringify(body) });
                } else {
                    if (!fields.voiceId) throw new Error('请填写参考音频路径'); if (key) headers.Authorization = 'Bearer ' + key; headers.Accept = 'audio/' + p.mediaFormat;
                    body = { text: text, text_lang: p.textLang, ref_audio_path: fields.voiceId, prompt_text: p.promptText, prompt_lang: p.promptLang, text_split_method: p.textSplitMethod, top_p: p.topP, temperature: p.temperature, speed_factor: p.speed, media_type: p.mediaFormat, streaming_mode: false };
                    response = await fetch(base + '/tts', { method: 'POST', headers: headers, body: JSON.stringify(body) });
                }
                if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + (await response.text()).slice(0, 180));
                playAudio(scope, new Uint8Array(await response.arrayBuffer()), provider === 'elevenlabs' ? 'audio/mpeg' : 'audio/' + p.mediaFormat);
            }
            showToast('试听已就绪');
        } catch (error) { showCustomAlert('合成失败', '请检查接口参数或 CORS 设置。\n\n' + error.message); }
    }
    function playAudio(scope, bytes, mime) {
        var audio = el('voice-' + scope + '-audio'); var url = URL.createObjectURL(new Blob([bytes], { type: mime })); audio.src = url; audio.style.display = 'block'; audio.play().catch(function () {});
    }
    window.testVoice = enhancedTestVoice;

    var oldOpenImageAdd = window.openImageGenAddPage;
    window.openImageGenAddPage = function () { oldOpenImageAdd(); setActive('imggen-add-provider', 'openai'); renderImageFields('add', 'openai', {}); };
    window.saveNewImageGen = function () {
        var provider = active('imggen-add-provider') || 'openai'; var name = val('imggen-add-name'), url = val('imggen-add-url'), key = val('imggen-add-key');
        if (!name || !url) { showCustomAlert('提示', '请填写预设名称和接口地址'); return; }
        var item = { id: Date.now(), name: name, provider: provider, url: url, key: key, model: val('imggen-add-model'), params: readImageParams('imggen-add-gen', provider) };
        imageGenDataList.push(item); if (!imageGenConnectedId) imageGenConnectedId = item.id;
        saveImageGenData(); renderImageGenList(); renderConnectedSettings(); closeImageGenAddPage();
    };
    window.openImageGenDrawer = function (event, id) {
        if (event) event.stopPropagation(); var item = (imageGenDataList || []).find(function (x) { return x.id === id; }); if (!item) return;
        imageEditingId = id; setActive('imggen-edit-provider', item.provider || 'openai');
        el('imggen-edit-name').value = item.name || ''; el('imggen-edit-url').value = item.url || ''; el('imggen-edit-key').value = item.key || '';
        renderImageFields('edit', item.provider || 'openai', item); el('imggenDrawerOverlay').classList.add('show'); el('imggenDrawer').classList.add('show');
    };
    window.closeImageGenDrawer = function () { el('imggenDrawerOverlay').classList.remove('show'); el('imggenDrawer').classList.remove('show'); imageEditingId = null; };
    window.saveImageGenDrawer = function () {
        var item = (imageGenDataList || []).find(function (x) { return x.id === imageEditingId; }); if (!item) return window.closeImageGenDrawer();
        var provider = active('imggen-edit-provider') || item.provider;
        Object.assign(item, { name: val('imggen-edit-name') || item.name, provider: provider, url: val('imggen-edit-url'), key: val('imggen-edit-key'), model: val('imggen-edit-model'), params: readImageParams('imggen-edit-gen', provider) });
        saveImageGenData(); renderImageGenList(); renderConnectedSettings(); window.closeImageGenDrawer();
    };
    window.deleteImageGenDrawer = function () {
        if (!imageEditingId) return;
        var deletingId = imageEditingId;
        showCustomConfirm('删除生图接口', '确定要删除这个生图预设吗？', '删除', true).then(function (ok) {
            if (!ok) return;
            imageGenDataList = imageGenDataList.filter(function (x) { return x.id !== deletingId; });
            if (imageGenConnectedId === deletingId) imageGenConnectedId = imageGenDataList.length ? imageGenDataList[0].id : null;
            saveImageGenData(); renderImageGenList(); renderConnectedSettings(); window.closeImageGenDrawer();
        });
    };
    var originalConnectImage = window.connectImageGen;
    window.connectImageGen = function (id) { originalConnectImage(id); renderConnectedSettings(); };
    function renderConnectedSettings() {
        var item = (imageGenDataList || []).find(function (x) { return x.id === imageGenConnectedId; }); var root = el('imggen-settings-container');
        if (!root) return; if (!item) { root.innerHTML = '<div class="api-settings-card" style="text-align:center;color:#8e8e93;">请先连接一个生图接口</div>'; return; }
        renderImageParams('imggen-settings-container', item.provider || 'openai', item.params || {}, { showPrompts: false });
        root.querySelectorAll('input,select,textarea').forEach(function (node) { node.addEventListener('change', persist); node.addEventListener('input', persist); });
        function persist() { item.params = readImageParams('imggen-settings-container', item.provider || 'openai', item.params); saveImageGenData(); }
    }
    window.renderImageGenSettings = renderConnectedSettings;
    var originalOpenImageApp = window.openImageGenApp;
    window.openImageGenApp = function () { originalOpenImageApp(); renderConnectedSettings(); };

    var legacyGenerate = window.generateImage;
    window.generateImage = async function () {
        var item = (imageGenDataList || []).find(function (x) { return x.id === imageGenConnectedId; }); if (!item) return showCustomAlert('提示', '请先连接一个生图接口');
        item.params = readImageParams('imggen-settings-container', item.provider || 'openai', item.params); saveImageGenData();
        var p = item.params; if (!p.positivePrompt) return showCustomAlert('提示', '请填写正面提示词');
        if (item.provider === 'openai') return generateOpenAI(item, p);
        imageGenSettings = Object.assign({}, p); return legacyGenerate();
    };
    async function generateOpenAI(item, p) {
        try {
            var model = item.model || 'gpt-image-1'; var dalle = /dall-e/i.test(model); var prompt = p.positivePrompt + (p.negativePrompt ? '\nAvoid the following: ' + p.negativePrompt : '');
            var body = { model: model, prompt: prompt, n: p.n || 1, size: p.size || '1024x1024', quality: p.quality || 'auto' };
            if (dalle) { body.style = p.style || 'vivid'; body.response_format = 'b64_json'; delete body.background; }
            else { body.background = p.background || 'auto'; body.output_format = p.outputFormat || 'png'; }
            el('imggen-result').innerHTML = '<span class="api-gen-loading">生成中…</span>';
            var response = await fetch(trimSlash(item.url) + '/images/generations', { method: 'POST', headers: { Authorization: 'Bearer ' + item.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + (await response.text()).slice(0, 200));
            var data = await response.json(); var result = data.data && data.data[0]; if (!result) throw new Error('接口没有返回图片');
            var src = result.b64_json ? 'data:image/' + (p.outputFormat || 'png') + ';base64,' + result.b64_json : result.url;
            el('imggen-result').innerHTML = '<img class="api-image-preview" alt="生成结果" src="' + esc(src) + '">';
        } catch (error) { el('imggen-result').innerHTML = '<span class="api-gen-error">生成失败：' + esc(error.message) + '</span>'; showCustomAlert('生成失败', error.message); }
    }

    document.addEventListener('DOMContentLoaded', function () { bindSegments(); renderVoiceFields('add', 'minimax', {}); renderImageFields('add', 'openai', {}); });
})();
