(function () {
    'use strict';

    let meetingDocument = '';
    let meetingFramePreloadStarted = false;

    function getElements() {
        return {
            container: document.getElementById('meetingAppUI'),
            frame: document.getElementById('meetingAppFrame')
        };
    }

    function decodeMeetingDocument() {
        if (!meetingDocument) {
            if (typeof window.MEETING_APP_DOCUMENT !== 'string') throw new Error('Meeting document source is unavailable.');
            meetingDocument = window.MEETING_APP_DOCUMENT;
        }
        return meetingDocument;
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

    function decorateMeetingDocument(frame) {
        const documentInFrame = frame.contentDocument;
        if (!documentInFrame || documentInFrame.getElementById('meetingDiaryTheme')) return;

        const theme = documentInFrame.createElement('style');
        theme.id = 'meetingDiaryTheme';
        theme.textContent = `
            html, body { background: #fff !important; color: #222 !important; }
            body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif !important; }
            .header {
                padding: 25px 22px 10px !important;
                align-items: flex-start !important;
                background: #fff !important;
            }
            .header-left-capsule {
                gap: 0 !important;
                padding: 0 !important;
                background: transparent !important;
                border: 0 !important;
                box-shadow: none !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                align-items: flex-start !important;
            }
            .header-back-icon { width: 28px !important; height: 28px !important; color: #999 !important; }
            .header-avatar { display: none !important; }
            .header-text-info { flex: 1 !important; min-width: 0 !important; margin-left: 18px !important; align-items: flex-start !important; }
            .header-title {
                font-size: 15px !important;
                font-weight: 400 !important;
                letter-spacing: 6px !important;
                line-height: 1.2 !important;
                color: #777 !important;
                max-width: 100% !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }
            .header-subtitle {
                margin-top: 8px !important;
                font-size: 12px !important;
                letter-spacing: 1px !important;
                color: #c1c1c1 !important;
                max-width: 100% !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }
            .header-right-circle {
                width: 44px !important;
                height: 32px !important;
                background: transparent !important;
                border: 0 !important;
                box-shadow: none !important;
                color: #999 !important;
                font-size: 0 !important;
            }
            .header-right-circle svg { width: 24px !important; height: 24px !important; display: block !important; margin: 0 auto; }
            .search {
                margin: 18px 25px 25px;
                height: 40px;
                border: 1px solid #eee;
                border-radius: 20px;
                display: flex;
                align-items: center;
                padding: 0 20px;
                color: #aaa;
                font-size: 14px;
                line-height: 1;
                flex-shrink: 0;
            }
            .search span { display: inline-flex; align-items: center; margin-right: 15px; font-size: 22px; line-height: 1; }
            .chat-container {
                padding: 0 25px 112px !important;
                gap: 0 !important;
                background: #fff !important;
            }
            .story-card {
                background: #fafafa !important;
                border-radius: 16px !important;
                padding: 18px 20px !important;
                margin-bottom: 14px !important;
                box-shadow: none !important;
                border: 0 !important;
            }
            .story-card .card-header { margin-bottom: 10px !important; padding-right: 0 !important; }
            .story-card .card-avatar { display: none !important; }
            .story-card .card-name { font-size: 14px !important; font-weight: 400 !important; color: #777 !important; }
            .story-card .card-body { font-size: 16px !important; line-height: 1.9 !important; color: #333 !important; }
            .story-card .card-more-btn { top: 14px !important; right: 14px !important; opacity: .55; }
        `;
        documentInFrame.head.appendChild(theme);

        const header = documentInFrame.querySelector('.header');
        const chatBox = documentInFrame.getElementById('chatBox');
        if (header && chatBox && !documentInFrame.getElementById('meetingSearchBar')) {
            const search = documentInFrame.createElement('div');
            search.id = 'meetingSearchBar';
            search.className = 'search';
            search.innerHTML = '<span>&#8981;</span>&#22312;&#36825;&#37324;&#36755;&#20837;&#20320;&#24819;&#35828;&#30340;&#35805;...';
            header.insertAdjacentElement('afterend', search);
            
            const rightCircle = header.querySelector('.header-right-circle');
            if (rightCircle) {
                rightCircle.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2.5"></circle><circle cx="12" cy="12" r="2.5"></circle><circle cx="19" cy="12" r="2.5"></circle></svg>';
            }
        }
    }

    function bindReturnToDesktop(frame) {
        const documentInFrame = frame.contentDocument;
        decorateMeetingDocument(frame);
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

    function preloadMeetingFrame() {
        if (meetingFramePreloadStarted) return;
        const { frame } = getElements();
        if (!frame || frame.srcdoc) return;
        meetingFramePreloadStarted = true;
        frame.addEventListener('load', () => bindReturnToDesktop(frame), { once: true });
        frame.srcdoc = decodeMeetingDocument();
    }

    window.openMeetingApp = function openMeetingApp() {
        const { container, frame } = getElements();
        if (!container || !frame) return;

        preloadMeetingFrame();
        bindReturnToDesktop(frame);

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

    const scheduleMeetingPreload = window.requestIdleCallback || ((callback) => setTimeout(callback, 250));
    scheduleMeetingPreload(preloadMeetingFrame);
})();
