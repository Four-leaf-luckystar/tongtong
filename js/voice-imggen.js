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
                        n_samples: 1,
                        ucPreset: 0,
                        quality_toggle: true,
                        negative_prompt: negative,
                        sm: false,
                        sm_dyn: false,
                        noise_schedule: 'native'
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
