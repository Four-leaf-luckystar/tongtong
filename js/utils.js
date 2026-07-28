    (function initTongtongDiagnostics() {
        const maxLogs = 50;
        const longTaskThreshold = 200;
        const slowInputThreshold = 120;
        const slowLoadThreshold = 5000;
        const eventLoopThreshold = 1000;
        const memoryLogs = [];
        let lastLongTaskTime = 0;
        let lastSlowInputTime = 0;

        function canUseAppSettings() {
            try {
                return typeof appSettings !== 'undefined' && appSettings;
            } catch (error) {
                return false;
            }
        }

        function readStoredLogs() {
            if (!canUseAppSettings() || !Array.isArray(appSettings.diagnostic_error_logs)) return [];
            return appSettings.diagnostic_error_logs;
        }

        function writeStoredLogs(logs) {
            if (!canUseAppSettings()) return false;
            appSettings.diagnostic_error_logs = logs.slice(0, maxLogs);
            if (typeof saveAppSettings === 'function') saveAppSettings();
            return true;
        }

        function normalizeValue(value) {
            if (value instanceof Error) return value.stack || value.message || String(value);
            if (typeof value === 'string') return value;
            try {
                return JSON.stringify(value);
            } catch (error) {
                return String(value);
            }
        }

        function getEnvironmentSnapshot() {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            const memory = performance.memory;
            return {
                page: location.href,
                visibility: document.visibilityState,
                online: navigator.onLine,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                screen: `${screen.width}x${screen.height}`,
                devicePixelRatio: window.devicePixelRatio || 1,
                connection: connection ? {
                    effectiveType: connection.effectiveType || '',
                    downlink: connection.downlink || null,
                    rtt: connection.rtt || null,
                    saveData: Boolean(connection.saveData)
                } : null,
                memory: memory ? {
                    usedJSHeapSize: memory.usedJSHeapSize,
                    totalJSHeapSize: memory.totalJSHeapSize,
                    jsHeapSizeLimit: memory.jsHeapSizeLimit
                } : null,
                wasDiscarded: Boolean(document.wasDiscarded)
            };
        }

        function uniqLogs(logs) {
            const seen = new Set();
            return logs.filter(log => {
                const key = [log.time, log.type, log.message, log.source, log.line, log.column].join('|');
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            }).slice(0, maxLogs);
        }

        function getLogs() {
            return uniqLogs(memoryLogs.concat(readStoredLogs()));
        }

        function setLogs(logs) {
            const nextLogs = uniqLogs(logs);
            memoryLogs.length = 0;
            memoryLogs.push(...nextLogs);
            writeStoredLogs(nextLogs);
            return nextLogs;
        }

        function record(detail) {
            const entry = {
                time: new Date().toISOString(),
                type: detail.type || 'error',
                message: detail.message || 'Unknown error',
                source: detail.source || location.href,
                line: detail.line || null,
                column: detail.column || null,
                stack: detail.stack || '',
                severity: detail.severity || 'error',
                meta: detail.meta || null,
                userAgent: navigator.userAgent,
                environment: getEnvironmentSnapshot()
            };
            setLogs([entry].concat(getLogs()));
        }

        function toText() {
            return JSON.stringify({
                generatedAt: new Date().toISOString(),
                userAgent: navigator.userAgent,
                environment: getEnvironmentSnapshot(),
                logs: getLogs()
            }, null, 2);
        }

        function flush() {
            return setLogs(getLogs());
        }

        window.tongtongDiagnostics = {
            getLogs,
            toText,
            record,
            flush,
            clear() {
                setLogs([]);
            }
        };

        window.addEventListener('error', event => {
            const target = event.target;
            if (target && target !== window) {
                record({
                    type: 'resource.error',
                    message: `资源加载失败: ${target.tagName || 'unknown'}`,
                    source: target.currentSrc || target.src || target.href || location.href,
                    severity: 'warning'
                });
                return;
            }
            record({
                type: 'window.error',
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                stack: event.error && event.error.stack ? event.error.stack : ''
            });
        }, true);

        window.addEventListener('unhandledrejection', event => {
            const reason = event.reason;
            record({
                type: 'unhandledrejection',
                message: normalizeValue(reason),
                stack: reason && reason.stack ? reason.stack : ''
            });
        });

        window.addEventListener('securitypolicyviolation', event => {
            record({
                type: 'security.csp',
                message: `内容安全策略拦截: ${event.violatedDirective || 'unknown'}`,
                source: event.blockedURI || location.href,
                severity: 'warning',
                meta: {
                    effectiveDirective: event.effectiveDirective || '',
                    originalPolicy: event.originalPolicy || ''
                }
            });
        });

        window.addEventListener('offline', () => {
            record({
                type: 'network.offline',
                message: '网络连接已断开',
                severity: 'warning'
            });
        });

        window.addEventListener('freeze', () => {
            record({
                type: 'lifecycle.freeze',
                message: '页面进入冻结状态',
                severity: 'info'
            });
        });

        if (document.wasDiscarded) {
            record({
                type: 'lifecycle.discarded',
                message: '页面曾被系统回收后重新加载，可能与闪退或内存压力有关',
                severity: 'warning'
            });
        }

        if ('PerformanceObserver' in window) {
            try {
                const longTaskObserver = new PerformanceObserver(list => {
                    list.getEntries().forEach(entry => {
                        const now = Date.now();
                        if (entry.duration < longTaskThreshold || now - lastLongTaskTime < 10000) return;
                        lastLongTaskTime = now;
                        record({
                            type: 'performance.long_task',
                            message: `检测到页面卡顿: 主线程阻塞 ${Math.round(entry.duration)}ms`,
                            severity: 'warning',
                            meta: { durationMs: Math.round(entry.duration) }
                        });
                    });
                });
                longTaskObserver.observe({ type: 'longtask', buffered: true });
            } catch (error) {
            }

            try {
                const inputObserver = new PerformanceObserver(list => {
                    list.getEntries().forEach(entry => {
                        const now = Date.now();
                        if (entry.duration < slowInputThreshold || now - lastSlowInputTime < 5000) return;
                        lastSlowInputTime = now;
                        record({
                            type: 'performance.slow_input',
                            message: `检测到操作响应偏慢: ${entry.name} ${Math.round(entry.duration)}ms`,
                            severity: 'warning',
                            meta: { eventName: entry.name, durationMs: Math.round(entry.duration) }
                        });
                    });
                });
                inputObserver.observe({ type: 'event', buffered: true, durationThreshold: slowInputThreshold });
            } catch (error) {
            }
        }

        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            if (!navigation || navigation.duration < slowLoadThreshold) return;
            record({
                type: 'performance.slow_load',
                message: `页面加载偏慢: ${Math.round(navigation.duration)}ms`,
                severity: 'warning',
                meta: {
                    durationMs: Math.round(navigation.duration),
                    domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
                    responseStartMs: Math.round(navigation.responseStart)
                }
            });
        });

        let expectedEventLoopTime = performance.now() + 5000;
        window.setInterval(() => {
            const now = performance.now();
            const delay = now - expectedEventLoopTime;
            expectedEventLoopTime = now + 5000;
            if (document.visibilityState !== 'visible' || delay < eventLoopThreshold) return;
            record({
                type: 'performance.event_loop_delay',
                message: `检测到页面卡顿: 事件循环延迟 ${Math.round(delay)}ms`,
                severity: 'warning',
                meta: { delayMs: Math.round(delay) }
            });
        }, 5000);

        const originalConsoleError = console.error.bind(console);
        console.error = function captureConsoleError(...args) {
            record({
                type: 'console.error',
                message: args.map(normalizeValue).join(' ')
            });
            return originalConsoleError(...args);
        };
    })();


            // show three-dots button; click to expand vertical capsule menu
    function showCustomAlert(title, message) {
        return new Promise(resolve => {
            const overlay = document.getElementById('customDialogOverlay');
            const dialog = document.getElementById('customDialog');
            
            dialog.innerHTML = `
                <div class="custom-dialog-text">
                    <div class="custom-dialog-title">${title}</div>
                    <div class="custom-dialog-message">${message}</div>
                </div>
                <div class="custom-dialog-btns">
                    <button class="custom-dialog-btn bold" id="customAlertBtn">好</button>
                </div>
            `;
            
            document.getElementById('customAlertBtn').onclick = () => {
                overlay.classList.remove('show');
                setTimeout(() => resolve(), 300);
            };
            
            overlay.classList.add('show');
        });
    }

    function showCustomConfirm(title, message, confirmText = '确定', isDanger = false) {
        return new Promise(resolve => {
            const overlay = document.getElementById('customDialogOverlay');
            const dialog = document.getElementById('customDialog');
            
            const dangerClass = isDanger ? 'danger bold' : 'bold';
            
            dialog.innerHTML = `
                <div class="custom-dialog-text">
                    <div class="custom-dialog-title">${title}</div>
                    <div class="custom-dialog-message">${message}</div>
                </div>
                <div class="custom-dialog-btns">
                    <button class="custom-dialog-btn" id="customConfirmCancel">取消</button>
                    <button class="custom-dialog-btn ${dangerClass}" id="customConfirmOk">${confirmText}</button>
                </div>
            `;
            
            document.getElementById('customConfirmCancel').onclick = () => {
                overlay.classList.remove('show');
                setTimeout(() => resolve(false), 300);
            };
            
            document.getElementById('customConfirmOk').onclick = () => {
                overlay.classList.remove('show');
                setTimeout(() => resolve(true), 300);
            };
            
            overlay.classList.add('show');
        });
    }

            // show three-dots button; click to expand vertical capsule menu
    function showCustomPrompt(title, inputs, confirmText = '确定') {
        return new Promise(resolve => {
            let overlay = document.getElementById('customPromptOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'preset-modal-overlay';
                overlay.id = 'customPromptOverlay';
                document.querySelector('.iphone').appendChild(overlay);
            }
            
            let inputConfigs = [];
            if (typeof inputs === 'string') {
                inputConfigs = [{ placeholder: inputs, value: '' }];
            } else if (Array.isArray(inputs)) {
                inputConfigs = inputs;
            } else if (typeof inputs === 'object') {
                inputConfigs = [inputs];
            }

            let inputsHtml = inputConfigs.map((cfg, idx) => `
                <input type="${cfg.type || 'text'}" class="preset-m1-input" id="customPromptInput_${idx}" placeholder="${cfg.placeholder || ''}" value="${cfg.value || ''}" style="margin-bottom: ${idx < inputConfigs.length - 1 ? '12px' : '0'};">
            `).join('');

            overlay.innerHTML = `
                <div class="preset-modal-style-1">
                    <div class="preset-m-header">
                        <div class="preset-m-header-text">${title}</div>
                        <div class="preset-m-stars">
                            <svg class="preset-star-1" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            <svg class="preset-star-2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            <svg class="preset-star-3" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </div>
                    </div>
                    <div class="preset-m1-body">
                        ${inputsHtml}
                    </div>
                    <div class="preset-m1-footer">
                        <button class="preset-m1-btn preset-m1-btn-cancel" id="customPromptCancel">取消</button>
                        <button class="preset-m1-btn preset-m1-btn-save" id="customPromptOk">${confirmText}</button>
                    </div>
                </div>
            `;

            const btnCancel = overlay.querySelector('#customPromptCancel');
            const btnOk = overlay.querySelector('#customPromptOk');

            btnCancel.onclick = () => {
                overlay.classList.remove('show');
                setTimeout(() => resolve(null), 300);
            };

            btnOk.onclick = () => {
                const results = inputConfigs.map((_, idx) => overlay.querySelector(`#customPromptInput_${idx}`).value);
                overlay.classList.remove('show');
                setTimeout(() => resolve(results.length === 1 ? results[0] : results), 300);
            };

            overlay.classList.add('show');
            setTimeout(() => {
                const firstInput = overlay.querySelector('#customPromptInput_0');
                if (firstInput) {
                    firstInput.focus();
                    if(firstInput.value) {
                        firstInput.selectionStart = firstInput.selectionEnd = firstInput.value.length;
                    }
                }
            }, 100);
        });
    }

            // show three-dots button; click to expand vertical capsule menu
    function showToast(message) {
        let toast = document.getElementById('iosToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'iosToast';
            toast.className = 'ios-toast-capsule';
            document.querySelector('.iphone').appendChild(toast);
        }
        toast.innerText = message;
        toast.classList.add('show');
        
        if (toast.hideTimer) clearTimeout(toast.hideTimer);
        
        toast.hideTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

            // show three-dots button; click to expand vertical capsule menu
    window.alert = function(message) {
        return showCustomAlert('提示', message);
    };

    window.confirm = function(message) {
            // show three-dots button; click to expand vertical capsule menu
        return showCustomConfirm('请确认', message);
    };

            // show three-dots button; click to expand vertical capsule menu
    const clockElement = document.getElementById('clock');
    function updateTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        if (clockElement) clockElement.textContent = `${hours}:${minutes}`;
    }
    setInterval(updateTime, 1000);
    updateTime();

    function updateBattery(level) {
        const percentage = Math.round(level * 100);
        document.getElementById('batteryLevel').style.width = percentage + '%';
        const batteryText = document.getElementById('batteryText');
        if (batteryText) batteryText.textContent = percentage;
    }

    if ('getBattery' in navigator) {
        navigator.getBattery().then(function(battery) {
            updateBattery(battery.level);
            battery.addEventListener('levelchange', function() {
                updateBattery(battery.level);
            });
        });
    } else {
        updateBattery(0.85);
    }

            // show three-dots button; click to expand vertical capsule menu


    // ===== 小组件渲染隔离辅助 (iframe srcdoc) =====
    // 将组件 HTML 内容放入独立 iframe，避免其 <style>/<script> 污染全局 DOM
    function escapeWidgetSrcdoc(content) {
        return String(content == null ? '' : content)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeWidgetCssString(value) {
        return String(value == null ? '' : value)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\r?\n/g, ' ');
    }

    function getSelectedWidgetFontData() {
        const family = typeof currentSelectedFont !== 'undefined' ? currentSelectedFont : 'default';
        const fonts = typeof customFonts !== 'undefined' && Array.isArray(customFonts) ? customFonts : [];
        const selected = family === 'default' ? null : fonts.find(font => font && font.id === family);
        return {
            family,
            type: selected ? selected.type : 'default',
            url: selected && selected.type === 'url' ? selected.url || '' : '',
            data: selected && selected.type === 'local' ? selected.data || null : null
        };
    }

    function buildWidgetGlobalFontTools() {
        const font = getSelectedWidgetFontData();
        const family = font.family === 'default' ? 'Geomini' : font.family;
        const safeFamily = escapeWidgetCssString(family);
        const fallback = `"${safeFamily}", "Geomini", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`;
        let fontFaces = '@font-face{font-family:"Geomini";src:url("https://nos.netease.com/ysf/260de1ccc0fffea1b1af12b7f5b50c3c.ttf") format("truetype");font-weight:normal;font-style:normal;}';
        if (font.type === 'url' && font.url) {
            fontFaces += `@font-face{font-family:"${safeFamily}";src:url("${escapeWidgetCssString(font.url)}");font-weight:normal;font-style:normal;}`;
        }
        const style = `<style id="widget-global-font-style">${fontFaces}html,body,body *,body *::before,body *::after,input,button,textarea,select{font-family:${fallback}!important;}</style>`;
        const script = `<script>(function(){var base='@font-face{font-family:"Geomini";src:url("https://nos.netease.com/ysf/260de1ccc0fffea1b1af12b7f5b50c3c.ttf") format("truetype");font-weight:normal;font-style:normal;}';window.addEventListener('message',async function(event){var data=event.data;if(!data||data.type!=='widget-global-font')return;var family=data.family==='default'?'Geomini':data.family;var style=document.getElementById('widget-global-font-style');if(style){var safe=String(family).replace(/\\\\/g,'\\\\\\\\').replace(/"/g,'\\\\"');style.textContent=base+'html,body,body *,body *::before,body *::after,input,button,textarea,select{font-family:"'+safe+'","Geomini",-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif!important;}';}try{if(data.sourceType==='local'&&data.fontData){var loaded=await new FontFace(family,data.fontData).load();document.fonts.add(loaded);}else if(data.sourceType==='url'&&data.url){var remote=await new FontFace(family,'url("'+String(data.url).replace(/"/g,'\\"')+'")').load();document.fonts.add(remote);}}catch(error){console.error('Widget font sync failed:',error);}});})();<` + `/script>`;
        return style + script;
    }

    function buildWidgetFrameSrcdoc(content) {
        const source = String(content == null ? '' : content);
        const tools = '<style>html,body{margin:0;padding:0;width:100%;height:100%;box-sizing:border-box;}</style>' + buildWidgetGlobalFontTools();
        const closingBody = /<\/body\s*>/i;
        const closingHtml = /<\/html\s*>/i;
        if (closingBody.test(source)) return source.replace(closingBody, tools + '</body>');
        return closingHtml.test(source) ? source.replace(closingHtml, tools + '</html>') : source + tools;
    }

    function syncGlobalFontToWidgetFrame(frame) {
        if (!frame || !frame.contentWindow) return;
        const font = getSelectedWidgetFontData();
        frame.contentWindow.postMessage({
            type: 'widget-global-font',
            family: font.family,
            sourceType: font.type,
            url: font.url,
            fontData: font.data
        }, '*');
    }

    function syncAllWidgetFonts() {
        document.querySelectorAll('.widget-render-frame, .widget-code-preview-frame, .widget-list-preview-frame').forEach(syncGlobalFontToWidgetFrame);
    }

    function makeWidgetFrameHTML(content, interactive) {
        const encoded = escapeWidgetSrcdoc(buildWidgetFrameSrcdoc(content));
        const pe = interactive ? 'auto' : 'none';
        const style = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:transparent;pointer-events:' + pe + ';';
        return '<iframe class="widget-render-frame" srcdoc="' + encoded + '" sandbox="allow-scripts" style="' + style + '" title="组件" onload="syncGlobalFontToWidgetFrame(this)"></iframe>';
    }
    window.escapeWidgetSrcdoc = escapeWidgetSrcdoc;
    window.buildWidgetFrameSrcdoc = buildWidgetFrameSrcdoc;
    window.syncGlobalFontToWidgetFrame = syncGlobalFontToWidgetFrame;
    window.syncAllWidgetFonts = syncAllWidgetFonts;
    window.makeWidgetFrameHTML = makeWidgetFrameHTML;
