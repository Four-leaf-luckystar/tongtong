(function () {
    'use strict';

    function getElements() {
        return {
            container: document.getElementById('meetingAppUI'),
            frame: document.getElementById('meetingAppFrame')
        };
    }

    function decodeMeetingDocument() {
        const bytes = Uint8Array.from(atob(window.MEETING_APP_DOCUMENT_BASE64), value => value.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    }

    function getApiCompletionUrl(url) {
        const base = String(url || '').trim().replace(/\/+$/, '');
        return /\/chat\/completions$/i.test(base) ? base : base + '/chat/completions';
    }

    const meetingApiRequestLogs = [];

    function getMeetingApiPresets() {
        return apiDataList
            .filter(item => item && item.id)
            .map(item => ({
                id: item.id,
                name: item.name || item.model || '未命名预设',
                model: item.model || '',
                selected: item.id === apiConnectedId,
                ready: Boolean(item.url && item.key && item.model)
            }));
    }

    function addMeetingApiLog(entry) {
        meetingApiRequestLogs.unshift({
            time: new Date().toLocaleString('zh-CN', { hour12: false }),
            ...entry
        });
        if (meetingApiRequestLogs.length > 50) meetingApiRequestLogs.length = 50;
    }

    window.getMeetingApiPresets = getMeetingApiPresets;
    window.getMeetingApiRequestLogs = () => meetingApiRequestLogs.map(entry => ({ ...entry }));

    window.selectMeetingApiPreset = function selectMeetingApiPreset(presetId) {
        const api = apiDataList.find(item => item.id === presetId);
        if (!api) throw new Error('未找到该 API 预设');
        apiConnectedId = api.id;
        if (typeof saveApiData === 'function') saveApiData();
        return getMeetingApiPresets();
    };

    window.requestMeetingApiReply = async function requestMeetingApiReply({ messages, systemPrompt, presetId, signal }) {
        const api = apiDataList.find(item => item.id === (presetId || apiConnectedId));
        if (!api?.url || !api?.key || !api?.model) {
            throw new Error('请先在设置中保存并连接一个可用的 API 预设');
        }

        const response = await fetch(getApiCompletionUrl(api.url), {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + api.key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: api.model,
                temperature: api.temperature !== undefined ? api.temperature : 0.8,
                messages: [
                    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                    ...messages
                ]
            }),
            signal
        });

        if (!response.ok) {
            addMeetingApiLog({ presetName: api.name || api.model, model: api.model, status: '失败', detail: 'HTTP ' + response.status });
            throw new Error('API 请求失败：HTTP ' + response.status);
        }
        const result = await response.json();
        const content = result?.choices?.[0]?.message?.content ?? result?.choices?.[0]?.text ?? result?.output_text;
        if (!String(content || '').trim()) throw new Error('API 没有返回可显示的内容');
        addMeetingApiLog({
            presetName: api.name || api.model,
            model: api.model,
            status: '成功',
            detail: result?.usage ? 'Token: ' + (result.usage.total_tokens ?? '未提供') : '未提供 Token 用量'
        });
        return String(content).trim();
    };

    function bindReturnToDesktop(frame) {
        const documentInFrame = frame.contentDocument;
        const backControl = documentInFrame?.querySelector('.header-left-capsule');
        if (!backControl || backControl.dataset.meetingReturnBound === 'true') return;

        backControl.dataset.meetingReturnBound = 'true';
        backControl.setAttribute('role', 'button');
        backControl.tabIndex = 0;
        backControl.addEventListener('click', window.closeMeetingApp);
        backControl.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                window.closeMeetingApp();
            }
        });
    }

    window.openMeetingApp = function openMeetingApp() {
        const { container, frame } = getElements();
        if (!container || !frame) return;

        if (!frame.srcdoc) {
            frame.addEventListener('load', () => bindReturnToDesktop(frame), { once: true });
            frame.srcdoc = decodeMeetingDocument();
        } else {
            bindReturnToDesktop(frame);
        }

        container.style.display = 'block';
        container.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => container.classList.add('is-open'));
    };

    window.closeMeetingApp = function closeMeetingApp() {
        const { container } = getElements();
        if (!container) return;
        container.classList.remove('is-open');
        container.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            if (!container.classList.contains('is-open')) container.style.display = 'none';
            if (typeof window.syncStatusBarAfterReturnHome === 'function') window.syncStatusBarAfterReturnHome();
        }, 220);
    };
})();
