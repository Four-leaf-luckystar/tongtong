        function formatWidgetSizeLabel(widget) {
            if (widget.width && widget.height) {
                return widget.width + '×' + widget.height;
            }
            if (widget.presetSize) {
                return widget.presetSize;
            }
            return '1×1';
        }
        window.formatWidgetSizeLabel = formatWidgetSizeLabel;

        function handleWidgetPresetChange(radio) {
            if (radio.checked) {
                document.getElementById('widgetCustomSizeLabel').innerText = '自定义大小';
                document.getElementById('widgetCustomSizeLabel').style.color = '#8e8e93';
                updateWidgetCodePreview();
            }
        }
        window.handleWidgetPresetChange = handleWidgetPresetChange;

        function openCustomSizePicker() {
            document.getElementById('customSizePicker').classList.add('show');
            const overlay = document.getElementById('widgetOverlay');
            overlay.style.display = 'block';
            overlay.style.zIndex = '350';
            const radios = document.querySelectorAll('input[name="widgetPresetSize"]');
            radios.forEach(r => { r.checked = false; });
        }
        window.openCustomSizePicker = openCustomSizePicker;

        function closeCustomSizePicker() {
            document.getElementById('customSizePicker').classList.remove('show');
            const editor = document.getElementById('widgetEditorModal');
            if (editor && editor.classList.contains('show')) {
                document.getElementById('widgetOverlay').style.zIndex = '250';
            } else {
                document.getElementById('widgetOverlay').style.display = 'none';
            }
        }
        window.closeCustomSizePicker = closeCustomSizePicker;

        function stepCustomSize(type, delta) {
            const el = document.getElementById(type === 'w' ? 'customW' : 'customH');
            let val = parseInt(el.innerText, 10) + delta;
            
            // ??????????????????????
            let maxCols = 4;
            let maxRows = 7;
            const grid = document.getElementById('desktopGrid');
            if (grid) {
                // ?? desktopGrid ????????? (????80+15px = 95px)
                const gridH = grid.clientHeight;
                if (gridH > 100) {
                    maxRows = Math.floor(gridH / 95) || 7;
                }
            }
            if (type === 'w' && val > maxCols) val = maxCols;
            if (type === 'w' && val < 1) val = 1;
            if (type === 'h' && val > maxRows) val = maxRows;
            if (type === 'h' && val < 1) val = 1;
            el.innerText = val;
        }
        window.stepCustomSize = stepCustomSize;

        function confirmCustomSize() {
            const w = document.getElementById('customW').innerText;
            const h = document.getElementById('customH').innerText;
            const label = document.getElementById('widgetCustomSizeLabel');
            label.innerText = w + ' × ' + h;
            label.style.color = '#000';
            updateWidgetCodePreview();
            closeCustomSizePicker();
        }
        window.confirmCustomSize = confirmCustomSize;

        function handleWidgetCustomSizeChange() {
            const radios = document.querySelectorAll('input[name="widgetPresetSize"]');
            radios.forEach(r => { r.checked = false; });
        }
        window.handleWidgetCustomSizeChange = handleWidgetCustomSizeChange;

            // show three-dots button; click to expand vertical capsule menu
    (function () {
        const widgetTrack = document.getElementById('widgetTrack');
        const widgetPagination = document.getElementById('widgetPagination');
        const widgetListContainer = document.getElementById('widgetList');
        const widgetEmptyState = document.getElementById('widgetEmptyState');
        const widgetContentArea = document.getElementById('widgetContentArea');
        const widgetSegmentBtns = document.querySelectorAll('#widgetAppGrid .widget-segment-btn');
        const widgetIndicator = document.getElementById('widgetSegmentIndicator');
        const widgetAppGrid = document.getElementById('widgetAppGrid');
        const themeAppUI = document.getElementById('themeAppUI');

        const officialWidgets = window.officialWidgets || [
            {
                name: '个人收藏集',
                presetSize: '4x2',
                preview: '#e5e5e5',
                content: `<style>
    .widget-doris-container { width: 100%; height: 100%; background-color: #ffffff; display: flex; flex-direction: column; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .widget-doris-container .top-section { display: flex; align-items: center; padding: 16px 20px 12px 20px; }
    .widget-doris-container .avatar-wrapper { position: relative; width: 60px; height: 60px; margin-right: 14px; }
    .widget-doris-container .uploadable-item { cursor: pointer; background-size: cover; background-position: center; background-repeat: no-repeat; transition: opacity 0.2s; }
    .widget-doris-container .uploadable-item:hover { opacity: 0.8; }
    .widget-doris-container .main-avatar { width: 100%; height: 100%; border-radius: 16px; background-color: #dbe4f0; }
    .widget-doris-container .camera-badge { position: absolute; bottom: -4px; right: -4px; width: 22px; height: 22px; background-color: #000000; border-radius: 50%; display: flex; justify-content: center; align-items: center; border: 2px solid #ffffff; pointer-events: none; }
    .widget-doris-container .camera-badge svg { width: 13px; height: 13px; }
    .widget-doris-container .info-section { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }
    .widget-doris-container .editable-text { outline: none; cursor: text; border-radius: 4px; transition: background-color 0.2s; }
    .widget-doris-container .editable-text:hover, .widget-doris-container .editable-text:focus { background-color: #f5f5f5; }
    .widget-doris-container .info-name { font-size: 22px; font-weight: 800; color: #222222; margin: 0 0 2px 0; letter-spacing: 0.5px; display: inline-block; align-self: flex-start; }
    .widget-doris-container .info-subtitle { font-size: 14px; color: #8e8e93; margin: 0; font-weight: 500; display: inline-block; align-self: flex-start; }
    .widget-doris-container .follow-btn { background-color: #d1d1d6; color: #ffffff; border: none; border-radius: 20px; padding: 8px 16px; font-size: 14px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px; }
    .widget-doris-container .bottom-section { display: flex; justify-content: space-between; align-items: center; padding: 4px 20px 16px 20px; flex-grow: 1; }
    .widget-doris-container .circle-item { width: 52px; height: 52px; border-radius: 50%; box-sizing: border-box; }
    .widget-doris-container .circle-avatar-1 { background-color: #e8f0fe; }
    .widget-doris-container .circle-avatar-2 { background-color: #fef0e8; }
    .widget-doris-container .pattern-dots { background-image: radial-gradient(#b0b0b0 1.5px, transparent 1.5px); background-size: 10px 10px; background-position: 0 0; background-color: #ffffff; border: 1px solid #e5e5e5; }
    .widget-doris-container .add-btn { border: 1px solid #e5e5e5; background-color: #fafafa; display: flex; justify-content: center; align-items: center; cursor: default; }
    .widget-doris-container .add-btn svg { width: 24px; height: 24px; stroke: #c7c7cc; stroke-width: 1.5; }
</style>
<div class="widget-doris-container">
    <div class="top-section">
        <div class="avatar-wrapper">
            <!-- 加上了 uploadable-img，你的系统会自动接管点击上传 -->
            <div class="uploadable-item main-avatar uploadable-img"></div>
            <div class="camera-badge">
                <svg viewBox="0 0 24 24">
                    <defs>
                        <linearGradient id="metal-shine" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#ffffff" />
                            <stop offset="30%" stop-color="#f0f0f0" />
                            <stop offset="50%" stop-color="#b0b0b0" />
                            <stop offset="70%" stop-color="#f0f0f0" />
                            <stop offset="100%" stop-color="#ffffff" />
                        </linearGradient>
                    </defs>
                    <path fill="url(#metal-shine)" d="M4,4H7L9,2H15L17,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9Z"></path>
                </svg>
            </div>
        </div>
        <div class="info-section">
            <h1 class="info-name editable-text" contenteditable="true" spellcheck="false">Doris</h1>
            <p class="info-subtitle editable-text" contenteditable="true" spellcheck="false">#收藏集</p>
        </div>
        <button class="follow-btn">Follow</button>
    </div>
    <div class="bottom-section">
        <!-- 加上了 uploadable-img，你的系统会自动接管点击上传 -->
        <div class="circle-item uploadable-item circle-avatar-1 uploadable-img"></div>
        <div class="circle-item uploadable-item pattern-dots uploadable-img"></div>
        <div class="circle-item uploadable-item circle-avatar-2 uploadable-img"></div>
        <div class="circle-item uploadable-item pattern-dots uploadable-img"></div>
        
        <!-- 加号按钮没有 uploadable-img，因此不可上传 -->
        <div class="circle-item add-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
        </div>
    </div>
</div>`
            },
            {
                name: '时间胶囊',
                presetSize: '4x2',
                preview: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
                content: `<style>
    .widget-4x2 { width: 100%; height: 100%; background-color: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; color: #8b929a; overflow: hidden; }
    .widget-date { font-size: 15px; font-weight: 600; letter-spacing: 1.5px; margin-bottom: 2px; display: flex; align-items: center; justify-content: center; gap: 3px; }
    .star-icon { width: 13px; height: 13px; fill: #8b929a; }
    .widget-time { font-size: 64px; font-weight: 700; line-height: 1; letter-spacing: 2px; margin-bottom: 8px; }
    .chat-bubble { background-color: rgba(255, 255, 255, 0.95); width: 90%; border-radius: 50px; padding: 10px 15px; display: flex; align-items: center; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03); }
    /* 注意这里：去除了 cursor: pointer，因为你的 bridge 会自动接管 */
    .avatar { width: 48px; height: 48px; border-radius: 50%; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3CclipPath id='finalClip'%3E%3Ccircle cx='50' cy='50' r='44'/%3E%3C/clipPath%3E%3ClinearGradient id='avatarBgGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23A3A8B0' /%3E%3Cstop offset='100%25' stop-color='%237A7F88' /%3E%3C/linearGradient%3E%3ClinearGradient id='avatarFigureGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23FFFFFF' /%3E%3Cstop offset='100%25' stop-color='%23E5E5EA' /%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='50' fill='url(%23avatarBgGrad)'/%3E%3Ccircle cx='50' cy='36' r='16' fill='url(%23avatarFigureGrad)'/%3E%3Cpath d='M 50 59 C 20 59 10 82 8 106 L 92 106 C 90 82 80 59 50 59 Z' fill='url(%23avatarFigureGrad)' clip-path='url(%23finalClip)'/%3E%3C/svg%3E"); background-size: cover; background-position: center; margin-right: 12px; flex-shrink: 0; border: 1px solid #f3f4f6; }
    .chat-content { flex-grow: 1; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
    .input-box { border: 1px solid #e5e7eb; border-radius: 20px; padding: 4px 12px; display: flex; justify-content: space-between; align-items: center; background-color: #fafafa; white-space: nowrap; overflow: hidden; }
    /* 注意这里：去除了 pointer-events: none，允许文字被选中和编辑 */
    .input-text { font-size: 12px; color: #8b929a; overflow: hidden; text-overflow: ellipsis; outline: none; }
    .hearts { font-size: 12px; letter-spacing: 2px; flex-shrink: 0; margin-left: 8px; }
    .action-bar { display: flex; justify-content: space-between; align-items: center; padding: 0 4px; }
    .icons { display: flex; gap: 8px; align-items: center; }
    .icons svg { width: 18px; height: 18px; fill: #8b929a; }
    .buttons { display: flex; gap: 8px; }
    .btn { font-size: 12px; padding: 4px 14px; border-radius: 15px; border: none; font-family: inherit; }
    .btn-send { background-color: #8b929a; color: white; }
    .btn-cancel { background-color: transparent; color: #8b929a; border: 1px solid #d1d5db; padding: 3px 13px; }
</style>
<div class="widget-4x2">
    <div class="widget-date" id="date-display"></div>
    <div class="widget-time" id="time-display">14:44</div>
    <div class="chat-bubble">
        <!-- 核心修改 1：加上 uploadable-img 类名，你的系统会自动让它支持点击上传图片 -->
        <div class="avatar uploadable-img"></div>
        <div class="chat-content">
            <div class="input-box">
                <!-- 核心修改 2：加上 contenteditable="true"，你的系统会自动让它支持直接打字修改 -->
                <span class="input-text" contenteditable="true">🤍ineedu…^</span>
            </div>
            <div class="action-bar">
                <div class="icons">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C13.6418 20 15.1681 19.5054 16.4381 18.6571L17.5476 20.3214C15.9602 21.3818 14.0523 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12V13.5C22 15.433 20.433 17 18.5 17C17.2958 17 16.2336 16.3918 15.6038 15.4659C14.6942 16.4115 13.4158 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C13.1258 7 14.1647 7.37209 15.0005 8H17V13.5C17 14.3284 17.6716 15 18.5 15C19.3284 15 20 14.3284 20 13.5V12ZM12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9Z"></path></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM7 13H9C9 14.6569 10.3431 16 12 16C13.6569 16 15 14.6569 15 13H17C17 15.7614 14.7614 18 12 18C9.23858 18 7 15.7614 7 13ZM8 11C7.17157 11 6.5 10.3284 6.5 9.5C6.5 8.67157 7.17157 8 8 8C8.82843 8 9.5 8.67157 9.5 9.5C9.5 10.3284 8.82843 11 8 11ZM16 11C15.1716 11 14.5 10.3284 14.5 9.5C14.5 8.67157 15.1716 8 16 8C16.8284 8 17.5 8.67157 17.5 9.5C17.5 10.3284 16.8284 11 16 11Z"></path></svg>
                </div>
                <div class="buttons">
                    <button class="btn btn-send">发送</button>
                    <button class="btn btn-cancel">取消</button>
                </div>
            </div>
        </div>
    </div>
</div>
<script>
    const roundedStarSvg = \`<svg class="star-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>\`;
    function updateTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeEl = document.getElementById('time-display');
        if(timeEl) timeEl.textContent = \`\${hours}:\${minutes}\`;
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateEl = document.getElementById('date-display');
        if(dateEl) dateEl.innerHTML = \`<span>\${year}</span>\${roundedStarSvg}<span>\${month}</span>\${roundedStarSvg}<span>\${day}</span>\`;
    }
    updateTime();
    setInterval(updateTime, 1000);
</script>`
            },
            {
                name: '透明极简文字',
                presetSize: '4x2',
                preview: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                content: `<style>
    .widget-container { width: 100%; height: 100%; background-color: transparent; position: relative; display: flex; flex-direction: column; justify-content: space-between; padding: 18px 20px; box-sizing: border-box; overflow: hidden; }
    .top-section { display: flex; justify-content: space-between; align-items: flex-start; }
    .profile-area { display: flex; align-items: center; gap: 12px; }
    .avatar { width: 56px; height: 56px; border-radius: 16px; object-fit: cover; background-color: #ccc; }
    .text-info { display: flex; flex-direction: column; gap: 4px; }
    .title { font-size: 18px; font-weight: 800; color: #111; display: flex; align-items: center; gap: 4px; outline: none; }
    .subtitle { font-size: 12px; color: #888; font-weight: 500; outline: none; }
    .bell-btn { width: 40px; height: 40px; border: 1.5px solid #dcdcdc; border-radius: 14px; display: flex; justify-content: center; align-items: center; background: transparent; }
    .middle-quote { font-size: 16px; font-weight: 800; color: #111; margin-top: 4px; outline: none; }
    .bottom-section { display: flex; align-items: center; gap: 12px; }
    .search-bar { flex-grow: 1; height: 36px; background-color: rgba(255, 255, 255, 0.5); border-radius: 10px; display: flex; align-items: center; padding: 0 12px; gap: 8px; }
    .datetime { font-size: 13px; color: #999; font-weight: 500; letter-spacing: 0.5px; }
    .settings-btn { width: 36px; height: 36px; background-color: rgba(255, 255, 255, 0.5); border-radius: 10px; display: flex; justify-content: center; align-items: center; }
    svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
<div class="widget-container">
    <div class="top-section">
        <div class="profile-area">
            <img class="avatar uploadable-img" src="data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3CclipPath id='finalClip'%3E%3Ccircle cx='50' cy='50' r='44'/%3E%3C/clipPath%3E%3ClinearGradient id='avatarBgGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23A3A8B0' /%3E%3Cstop offset='100%25' stop-color='%237A7F88' /%3E%3C/linearGradient%3E%3ClinearGradient id='avatarFigureGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23FFFFFF' /%3E%3Cstop offset='100%25' stop-color='%23E5E5EA' /%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='50' fill='url(%23avatarBgGrad)'/%3E%3Ccircle cx='50' cy='36' r='16' fill='url(%23avatarFigureGrad)'/%3E%3Cpath d='M 50 59 C 20 59 10 82 8 106 L 92 106 C 90 82 80 59 50 59 Z' fill='url(%23avatarFigureGrad)' clip-path='url(%23finalClip)'/%3E%3C/svg%3E" alt="avatar">
            <div class="text-info">
                <div class="title" contenteditable="true">水色贝</div>
                <div class="subtitle" contenteditable="true">&gt;ㅎㅇ…iam&gt;iwas🖤🤍</div>
            </div>
        </div>
        <div class="bell-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" style="color: #aaa;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        </div>
    </div>
    <div class="middle-quote" contenteditable="true">怎么我一颗心被你俘虏</div>
    <div class="bottom-section">
        <div class="search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" style="color: #aaa;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span class="datetime" id="widget-datetime-display">2026/06/08 14:43</span>
        </div>
        <div class="settings-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" style="color: #aaa;"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
        </div>
    </div>
</div>
<script>
    function updateWidgetDateTime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const dtEl = document.getElementById('widget-datetime-display');
        if(dtEl) dtEl.textContent = \`\${year}/\${month}/\${day} \${hours}:\${minutes}\`;
    }
    updateWidgetDateTime();
    setInterval(updateWidgetDateTime, 1000);
</script>`
            },
            {
                name: '自定义菜单卡片',
                presetSize: '4x4',
                preview: '#ffd1dc',
                content: `<style>
    /* 基础重置 */
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    
    /* 主容器：恢复 100% 占满网格 */
    .widget-4x4-menu { width: 100%; height: 100%; background-color: #fff; border-radius: 24px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); position: relative; overflow: hidden; border: 1px solid #f5f5f5; display: flex; flex-direction: column; }
    
    /* 上半部分：背景区域 (加上 uploadable-img 支持点击上传) */
    .top-half { width: 100%; height: 50%; background-color: #ffd1dc; background-size: cover; background-position: center; position: relative; }
    
    /* 头像分割线 */
    .avatar-container { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; background-color: #fff; padding: 3px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; justify-content: center; align-items: center; }
    .avatar { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; display: block; }
    
    /* 下半部分：内容区域 (使用 flex 布局防止溢出) */
    .bottom-half { width: 100%; height: 50%; background-color: #ffffff; display: flex; flex-direction: column; align-items: center; padding: 30px 12px 12px 12px; position: relative; }
    
    /* 菜单标题 */
    .menu-title { font-size: 14px; font-weight: 800; color: #a9a9a9; letter-spacing: 2px; margin-bottom: 8px; outline: none; flex-shrink: 0; line-height: 1; }
    
    /* 菜单项目容器：占据剩余所有空间 */
    .menu-items { display: flex; width: 100%; flex-grow: 1; justify-content: space-between; gap: 8px; min-height: 0; }
    
    /* 单个项目 */
    .item { display: flex; flex-direction: column; width: 32%; height: 100%; }
    
    /* 项目文字头部 */
    .item-header { display: flex; align-items: baseline; margin-bottom: 2px; width: 100%; flex-shrink: 0; }
    .item-num { font-size: 13px; font-weight: bold; color: #ffe4e1; margin-right: 2px; }
    .item-name { font-size: 10px; color: #a9a9a9; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; outline: none; flex-grow: 1; }
    
    /* 推荐小字 */
    .item-sub { font-size: 8px; color: #333; font-weight: bold; width: 100%; text-align: right; margin-bottom: 4px; outline: none; flex-shrink: 0; line-height: 1; }
    
    /* 食物图片：自动拉伸填满剩余高度，绝对不会溢出 */
    .item-img { width: 100%; flex-grow: 1; border-radius: 10px; object-fit: cover; min-height: 0; }
</style>

<div class="widget-4x4-menu">
    <!-- 上半部分：点击上传背景 -->
    <div class="top-half uploadable-img"></div>
    
    <!-- 中间头像：点击上传头像，默认使用系统内置SVG -->
    <div class="avatar-container">
        <img class="avatar uploadable-img" src="data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3CclipPath id='finalClip'%3E%3Ccircle cx='50' cy='50' r='44'/%3E%3C/clipPath%3E%3ClinearGradient id='avatarBgGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23A3A8B0' /%3E%3Cstop offset='100%25' stop-color='%237A7F88' /%3E%3C/linearGradient%3E%3ClinearGradient id='avatarFigureGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23FFFFFF' /%3E%3Cstop offset='100%25' stop-color='%23E5E5EA' /%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='50' fill='url(%23avatarBgGrad)'/%3E%3Ccircle cx='50' cy='36' r='16' fill='url(%23avatarFigureGrad)'/%3E%3Cpath d='M 50 59 C 20 59 10 82 8 106 L 92 106 C 90 82 80 59 50 59 Z' fill='url(%23avatarFigureGrad)' clip-path='url(%23finalClip)'/%3E%3C/svg%3E" alt="Avatar">
    </div>
    
    <!-- 下半部分：菜单内容 -->
    <div class="bottom-half">
        <div class="menu-title" contenteditable="true">ㅎㅅㅎ</div>
        <div class="menu-items">
            <!-- 卡片 1 -->
            <div class="item">
                <div class="item-header"><span class="item-num">01</span><span class="item-name" contenteditable="true">BerryCake#</span></div>
                <div class="item-sub" contenteditable="true">@Recommend</div>
                <img class="item-img uploadable-img" src="data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23fce4ec'/%3E%3C/svg%3E" alt="img1">
            </div>
            <!-- 卡片 2 -->
            <div class="item">
                <div class="item-header"><span class="item-num">02</span><span class="item-name" contenteditable="true">SpecialDrink#</span></div>
                <div class="item-sub" contenteditable="true">@Original</div>
                <img class="item-img uploadable-img" src="data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23e3f2fd'/%3E%3C/svg%3E" alt="img2">
            </div>
            <!-- 卡片 3 -->
            <div class="item">
                <div class="item-header"><span class="item-num">03</span><span class="item-name" contenteditable="true">Icecream#</span></div>
                <div class="item-sub" contenteditable="true">@Recommend</div>
                <img class="item-img uploadable-img" src="data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23f3e5f5'/%3E%3C/svg%3E" alt="img3">
            </div>
        </div>
    </div>
</div>`
            },
            {
                name: '小猫日记',
                presetSize: '4x4',
                preview: '#f0f2f5',
                content: `<style>
    .widget-cat-space { width: 100%; height: 100%; background-color: #ffffff; border-radius: 28px; overflow: hidden; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .widget-cat-space .banner { height: 135px; width: 100%; background-color: #dcedfa; background-image: radial-gradient(circle at 20% 30%, #ffffff 2px, transparent 3px), radial-gradient(circle at 80% 20%, #ffffff 2px, transparent 3px), radial-gradient(circle at 50% 60%, #ffffff 2px, transparent 3px), radial-gradient(circle at 10% 80%, #ffffff 2px, transparent 3px), radial-gradient(circle at 90% 70%, #ffffff 2px, transparent 3px); background-size: cover; background-position: center; background-repeat: no-repeat; }
    .widget-cat-space .profile-section { display: flex; align-items: flex-start; padding: 0 20px; margin-top: -45px; position: relative; z-index: 2; }
    .widget-cat-space .avatar-outer { width: 90px; height: 90px; border-radius: 50%; position: relative; }
    .widget-cat-space .avatar-inner { width: 100%; height: 100%; background-color: #ffffff; border-radius: 50%; background-size: cover; background-position: center; border: 3px solid #ffffff; box-sizing: border-box; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3CclipPath id='finalClip'%3E%3Ccircle cx='50' cy='50' r='44'/%3E%3C/clipPath%3E%3ClinearGradient id='avatarBgGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23A3A8B0' /%3E%3Cstop offset='100%25' stop-color='%237A7F88' /%3E%3C/linearGradient%3E%3ClinearGradient id='avatarFigureGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23FFFFFF' /%3E%3Cstop offset='100%25' stop-color='%23E5E5EA' /%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='50' fill='url(%23avatarBgGrad)'/%3E%3Ccircle cx='50' cy='36' r='16' fill='url(%23avatarFigureGrad)'/%3E%3Cpath d='M 50 59 C 20 59 10 82 8 106 L 92 106 C 90 82 80 59 50 59 Z' fill='url(%23avatarFigureGrad)' clip-path='url(%23finalClip)'/%3E%3C/svg%3E"); }
    .widget-cat-space .status-dot { position: absolute; bottom: 4px; right: 4px; width: 12px; height: 12px; background-color: #9cd0f0; border-radius: 50%; border: 2px solid #ffffff; }
    .widget-cat-space .user-info { margin-left: 12px; margin-top: 55px; }
    .widget-cat-space .username { font-size: 16px; font-weight: 600; color: #1a1a1a; margin-bottom: 6px; outline: none; }
    .widget-cat-space .bio-1 { font-size: 13px; color: #666666; font-weight: 500; outline: none; }
    .widget-cat-space .bio-2 { padding: 0 20px; margin-top: 14px; font-size: 13px; font-weight: 600; color: #1a1a1a; outline: none; }
    .widget-cat-space .datetime-section { display: flex; align-items: center; padding: 0 20px; margin-top: 14px; font-size: 11px; color: #888888; }
    .widget-cat-space .divider-line { flex-grow: 1; height: 1px; border-bottom: 1px dashed #d0d0d0; margin: 0 12px; }
    .widget-cat-space .date, .widget-cat-space .time { outline: none; }
    .widget-cat-space .media-grid { display: flex; gap: 12px; padding: 12px 20px 20px 20px; flex-grow: 1; align-items: center; }
    .widget-cat-space .media-item { flex: 1; aspect-ratio: 1 / 1; border-radius: 14px; background-size: cover; background-position: center; }
    .widget-cat-space .color-1 { background-color: #e6f0fa; }
    .widget-cat-space .color-2 { background-color: #f0f4f8; }
    .widget-cat-space .color-3 { background-color: #eef2f6; }
</style>
<div class="widget-cat-space">
    <div class="banner uploadable-img"></div>
    <div class="profile-section">
        <div class="avatar-outer">
            <div class="avatar-inner uploadable-img"></div>
            <div class="status-dot"></div>
        </div>
        <div class="user-info">
            <div class="username" contenteditable="true">小猫用户</div>
            <div class="bio-1" contenteditable="true">⁃ ⩊ ⁃ haengbok …</div>
        </div>
    </div>
    <div class="bio-2" contenteditable="true">☆*:.你的出現讓我開始相信天使的存在*:.★^</div>
    <div class="datetime-section">
        <span class="date" contenteditable="true">07-13-2026</span>
        <div class="divider-line"></div>
        <span class="time" contenteditable="true">11:12:41</span>
    </div>
    <div class="media-grid">
        <div class="media-item color-1 uploadable-img"></div>
        <div class="media-item color-2 uploadable-img"></div>
        <div class="media-item color-3 uploadable-img"></div>
    </div>
</div>`
            },
            {
                name: '层叠信息卡片',
                presetSize: '4x2',
                preview: '#e5e5e5',
                content: `<style>
    .widget-1-container { position: relative; width: 100%; height: 100%; background-color: transparent; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .w1-layer { position: absolute; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03); display: flex; align-items: center; color: #a0a0a0; letter-spacing: 0.5px; }
    .w1-layer-1 { top: 0; left: 8%; width: 84%; height: 22%; padding: 0 20px; box-sizing: border-box; gap: 10px; z-index: 1; font-size: 10px; }
    .w1-layer-1 > * { transform: translateY(-4px); }
    .w1-layer-2 { top: 14%; left: 4%; width: 92%; height: 25%; padding: 0 20px; box-sizing: border-box; gap: 10px; z-index: 2; box-shadow: 0 -2px 10px rgba(0,0,0,0.02), 0 4px 15px rgba(0, 0, 0, 0.04); font-size: 10px; }
    .w1-layer-2 > * { transform: translateY(-3px); }
    .w1-layer-3 { top: 30%; left: 0; width: 100%; height: 70%; z-index: 3; border-radius: 20px; flex-direction: column; align-items: flex-start; padding: 15px 20px; box-sizing: border-box; box-shadow: 0 -4px 15px rgba(0,0,0,0.03), 0 8px 20px rgba(0, 0, 0, 0.05); font-size: 12px; }
    .w1-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 11px; width: 100%; flex-shrink: 0; line-height: 1.2; }
    .w1-body { display: flex; width: 100%; gap: 15px; align-items: center; flex-shrink: 0; }
    .w1-avatar { width: 50px; height: 50px; border-radius: 10px; background-color: #dcdcdc; background-size: cover; background-position: center; flex-shrink: 0; }
    .w1-pills { display: flex; gap: 10px; flex: 1; overflow: hidden; }
    .w1-pill { background: #f8f8f8; border-radius: 20px; padding: 6px 12px; font-size: 10px; display: flex; align-items: center; justify-content: center; gap: 4px; color: #b0b0b0; }
    .w1-footer { margin-top: 10px; font-size: 10px; color: #b0b0b0; text-align: center; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; flex-shrink: 0; }
    svg { display: inline-block; vertical-align: middle; flex-shrink: 0; }
    [contenteditable="true"] { outline: none; border-bottom: 1px solid transparent; transition: border-color 0.2s; white-space: nowrap; }
</style>
<div class="widget-1-container">
    <div class="w1-layer w1-layer-1">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M3.75 6.75a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-.037c.856-.174 1.5-.93 1.5-1.838v-2.25c0-.907-.644-1.664-1.5-1.837V9.75a3 3 0 0 0-3-3h-15Zm15 1.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-15a1.5 1.5 0 0 1-1.5-1.5v-6a1.5 1.5 0 0 1 1.5-1.5h15ZM4.5 9.75a.75.75 0 0 0-.75.75V15c0 .414.336.75.75.75H18a.75.75 0 0 0 .75-.75v-4.5a.75.75 0 0 0-.75-.75H4.5Z" clip-rule="evenodd" /></svg>
        <span id="battery-status">获取中...</span>
        <span id="battery-level">--%</span>
    </div>
    <div class="w1-layer w1-layer-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 48" width="13" height="13"><path fill="currentColor" d="m40.7174 1.9205 -0.3699 -0.0113h-0.0588c-1.6661 0 -3.2294 0.6685 -4.5833 1.6967 -1.3539 1.0282 -1.751 1.9218 -1.751 1.9218l9.9539 9.7277s1.2726 -0.6459 1.9919 -1.5666c0.7195 -0.9207 1.6153 -2.0451 1.6198 -4.1977 0.0079 -4.0143 -2.9782 -7.3398 -6.8026 -7.5706Z" stroke-width="1"></path><path fill="currentColor" d="m7.2826 1.9205 0.3698 -0.0113h0.0589c1.6661 0 3.2293 0.6685 4.5833 1.6967 1.354 1.0282 1.751 1.9218 1.751 1.9218l-9.9539 9.7277s-1.2725 -0.6459 -1.9919 -1.5666S0.4845 11.6437 0.48 9.4867C0.4721 5.4768 3.4583 2.1513 7.2826 1.9205Z" stroke-width="1"></path><path fill="currentColor" d="M39.3041 38.1723c-0.0013 -0.0012 -0.0019 -0.0028 -0.0019 -0.0045 0 -0.0017 0.0006 -0.0034 0.0019 -0.0046 3.8119 -4.5833 5.6217 -10.8904 4.0381 -17.5652 -1.5429 -6.5063 -8.22 -13.0862 -14.7432 -14.5532 -12.9695 -2.9161 -24.4992 6.9157 -24.4992 19.391 -0.0045 4.6524 1.6285 9.1581 4.6128 12.7274 0.001 0.0012 0.0017 0.0029 0.0017 0.0046 0 0.0017 -0.0007 0.0033 -0.0017 0.0045l-5.4125 5.3616c-0.0011 0.0012 -0.0017 0.0028 -0.0017 0.0044 0 0.0017 0.0006 0.0033 0.0017 0.0046l2.6016 2.5462c0.0013 0.0011 0.0029 0.0017 0.0045 0.0017 0.0017 0 0.0033 -0.0006 0.0046 -0.0017l5.365 -5.3583c0.0012 -0.0011 0.0028 -0.0017 0.0044 -0.0017 0.0016 0 0.0033 0.0006 0.0046 0.0017 3.5717 2.9803 8.0761 4.6128 12.728 4.6128 4.6519 0 9.1562 -1.6325 12.7281 -4.6128h0.0079l5.3491 5.3583c0.0012 0.0011 0.0029 0.0017 0.0046 0.0017 0.0015 0 0.0032 -0.0006 0.0044 -0.0017l2.7057 -2.5552 -5.5086 -5.3617ZM25.8176 27.2456H13.141v-3.6084l0.0057 -0.0055h9.049V10.9573h3.6196l0.0023 16.2883Z" stroke-width="1"></path></svg>
        <span id="time-display">--:--:--</span>
        <span id="date-display" style="margin-left: 10px;">----年--月--日 周-</span>
    </div>
    <div class="w1-layer w1-layer-3">
        <div class="w1-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.9975 11.9078V18.5078C22.0225 18.9691 21.9533 19.4308 21.794 19.8644C21.6347 20.2981 21.3887 20.6948 21.071 21.0302C20.7533 21.3657 20.3705 21.6328 19.9461 21.8154C19.5217 21.998 19.0645 22.0922 18.6025 22.0922C18.1405 22.0922 17.6833 21.998 17.2589 21.8154C16.8345 21.6328 16.4517 21.3657 16.134 21.0302C15.8163 20.6948 15.5703 20.2981 15.411 19.8644C15.2517 19.4308 15.1825 18.9691 15.2075 18.5078V15.8678C15.2071 15.252 15.3743 14.6477 15.6914 14.1198C16.0085 13.5919 16.4634 13.1604 17.0072 12.8715C17.551 12.5826 18.1633 12.4473 18.7782 12.4802C19.3932 12.513 19.9875 12.7127 20.4975 13.0578V11.9078C20.4975 9.6535 19.602 7.49149 18.0079 5.89743C16.4138 4.30337 14.2518 3.40784 11.9975 3.40784C9.74316 3.40784 7.58115 4.30337 5.98709 5.89743C4.39303 7.49149 3.4975 9.6535 3.4975 11.9078V13.0578C4.05426 12.6776 4.71332 12.4754 5.38751 12.4778C6.2866 12.4778 7.14886 12.835 7.78461 13.4707C8.42036 14.1065 8.7775 14.9687 8.7775 15.8678V18.5078C8.7775 18.953 8.68983 19.3938 8.51947 19.8051C8.34911 20.2164 8.0994 20.5901 7.78461 20.9049C7.46982 21.2197 7.09611 21.4694 6.68481 21.6398C6.27352 21.8101 5.83269 21.8978 5.38751 21.8978C4.94233 21.8978 4.5015 21.8101 4.09021 21.6398C3.67892 21.4694 3.30521 21.2197 2.99042 20.9049C2.67563 20.5901 2.42592 20.2164 2.25555 19.8051C2.08519 19.3938 1.9975 18.953 1.9975 18.5078V11.9078C1.9975 9.25567 3.05109 6.71213 4.92645 4.83676C6.80182 2.9614 9.34533 1.90784 11.9975 1.90784C14.6497 1.90784 17.1932 2.9614 19.0686 4.83676C20.9439 6.71213 21.9975 9.25567 21.9975 11.9078Z" fill="currentColor"/></svg>
            <span contenteditable="true">° ‧┈┈ 9 人形電腦天使心 9 ┈┈‧ °</span>
        </div>
        <div class="w1-body">
            <div class="w1-avatar uploadable-img"></div>
            <div class="w1-pills">
                <div class="w1-pill"><span contenteditable="true">♡ ♡ ≧◡≦ ♡ ♡</span></div>
                <div class="w1-pill" style="background: #ffffff; border: 1px solid #f0f0f0;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </div>
            </div>
        </div>
        <div class="w1-footer">
            <span contenteditable="true">• [she//her] • [white something here &lt;3]</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6"></circle><ellipse cx="12" cy="12" rx="10" ry="3" transform="rotate(-45 12 12)"></ellipse></svg>
        </div>
    </div>
</div>
<script>
    function updateDateTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timeEl = document.getElementById('time-display');
        if(timeEl) timeEl.textContent = \`\${hours}:\${minutes}:\${seconds}\`;
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const day = days[now.getDay()];
        const dateEl = document.getElementById('date-display');
        if(dateEl) dateEl.textContent = \`\${year}年\${month}月\${date}日 \${day}\`;
    }
    setInterval(updateDateTime, 1000);
    updateDateTime();
    function updateBatteryUI(battery) {
        const level = Math.round(battery.level * 100) + '%';
        const status = battery.charging ? '充电中' : '未充电';
        const statusEl = document.getElementById('battery-status');
        const levelEl = document.getElementById('battery-level');
        if(statusEl) statusEl.textContent = status;
        if(levelEl) levelEl.textContent = level;
    }
    if ('getBattery' in navigator) {
        navigator.getBattery().then(function(battery) {
            updateBatteryUI(battery);
            battery.addEventListener('levelchange', () => updateBatteryUI(battery));
            battery.addEventListener('chargingchange', () => updateBatteryUI(battery));
        });
    } else {
        const statusEl = document.getElementById('battery-status');
        const levelEl = document.getElementById('battery-level');
        if(statusEl) statusEl.textContent = '未充电';
        if(levelEl) levelEl.textContent = '100%';
    }
</script>`
            },
            {
                name: 'Oㅈo：뭐?',
                presetSize: '4x2',
                preview: 'linear-gradient(135deg, #a8b0b8, #6a7076)',
                content: `<style>
    .widget-container-ozo { width: 100%; height: 100%; background-color: #ffffff; border-radius: 28px; padding: 20px 24px; box-sizing: border-box; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .widget-header-ozo { display: flex; align-items: center; margin-bottom: 16px; }
    .widget-title-ozo { font-size: 18px; font-weight: 700; color: #333333; letter-spacing: 0.5px; outline: none; }
    .widget-content-ozo { display: flex; gap: 14px; align-items: center; flex: 1; }
    .color-box-ozo { flex: 1; height: 100%; border-radius: 16px; background-size: cover; background-position: center; }
    .box-1-ozo { background-color: #9fb4c7; }
    .box-2-ozo { background-color: #e4e9ed; }
    .box-3-ozo { background-color: #c5d3e0; }
</style>
<div class="widget-container-ozo">
    <div class="widget-header-ozo">
        <div class="widget-title-ozo" contenteditable="true">Oㅈo：뭐?</div>
    </div>
    <div class="widget-content-ozo">
        <div class="color-box-ozo box-1-ozo uploadable-img"></div>
        <div class="color-box-ozo box-2-ozo uploadable-img"></div>
        <div class="color-box-ozo box-3-ozo uploadable-img"></div>
    </div>
</div>`
            },
            {
                name: '纯净拍立得',
                presetSize: '4x2',
                preview: '#e0e0e0',
                content: `<style>
    .widget-polaroid-container { width: 100%; height: 100%; background-color: transparent; position: relative; display: flex; justify-content: space-evenly; align-items: center; overflow: hidden; }
    .polaroid { background-color: #ffffff; padding: 4px 4px 18px 4px; box-shadow: 1px 2px 6px rgba(0, 0, 0, 0.1); position: relative; width: 80px; height: 96px; display: flex; flex-direction: column; border-radius: 2px; }
    .photo { width: 100%; height: 100%; background-color: #e0e0e0; background-size: cover; background-position: center; border-radius: 1px; }
    .polaroid.left { transform: rotate(-3deg) translateY(4px); }
    .polaroid.middle { transform: rotate(4deg) translateY(-6px); z-index: 2; }
    .polaroid.right { transform: rotate(-2deg) translateY(6px); }
</style>
<div class="widget-polaroid-container">
    <div class="polaroid left">
        <div class="photo uploadable-img" style="background-color: #dcdcdc;"></div>
    </div>
    <div class="polaroid middle">
        <div class="photo uploadable-img" style="background-color: #eeeeee;"></div>
    </div>
    <div class="polaroid right">
        <div class="photo uploadable-img" style="background-color: #e8e8e8;"></div>
    </div>
</div>`
            },
            {
                name: '小猫饼图文',
                presetSize: '4x3',
                preview: '#e8eaed',
                content: `<style>
    .widget-4x3-cat { width: 100%; height: 100%; display: flex; flex-direction: column; gap: 8px; box-sizing: border-box; background: transparent; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden; }
    .widget-4x3-cat .card { background-color: #f4f5f7; border-radius: 24px; box-sizing: border-box; }
    .widget-4x3-cat .top-card { display: flex; align-items: center; padding: 16px 24px; }
    .widget-4x3-cat .top-icon-frame { width: 52px; height: 52px; background-color: #b8b8b8; border-radius: 14px; padding: 4px; box-sizing: border-box; flex-shrink: 0; }
    .widget-4x3-cat .top-icon-inner { width: 100%; height: 100%; background-color: #fff; border-radius: 10px; overflow: hidden; display: flex; justify-content: center; align-items: center; background-size: cover; background-position: center; }
    .widget-4x3-cat .top-text-group { margin-left: 16px; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
    .widget-4x3-cat .top-title { font-size: 17px; font-weight: 600; color: #333; outline: none; }
    .widget-4x3-cat .top-subtitle { font-size: 13px; color: #666; outline: none; }
    .widget-4x3-cat .music-icon { width: 24px; height: 24px; color: #555; }
    .widget-4x3-cat .bottom-card { flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 16px 24px; }
    .widget-4x3-cat .image-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-grow: 1; }
    .widget-4x3-cat .image-frame { flex: 1; aspect-ratio: 1 / 1; background-color: #b8b8b8; border-radius: 20px; padding: 6px; box-sizing: border-box; }
    .widget-4x3-cat .image-inner { width: 100%; height: 100%; background-color: #ffffff; border-radius: 14px; overflow: hidden; display: flex; justify-content: center; align-items: center; background-size: cover; background-position: center; }
    .widget-4x3-cat .bottom-text-row { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 16px; padding-left: 4px; padding-right: 4px; }
    .widget-4x3-cat .bottom-text { font-size: 11px; color: #555; letter-spacing: 0.5px; font-weight: 600; outline: none; }
</style>
<div class="widget-4x3-cat">
    <div class="card top-card">
        <div class="top-icon-frame">
            <div class="top-icon-inner uploadable-img"></div>
        </div>
        <div class="top-text-group">
            <div class="top-title" contenteditable="true">小猫饼</div>
            <div class="top-subtitle" contenteditable="true">Trou、verJasm1ne</div>
        </div>
        <svg class="music-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14"><path fill="#555555" fill-rule="evenodd" d="M7.75 0.851a0.75 0.75 0 0 0 -1.5 0V13.15a0.75 0.75 0 0 0 1.5 0V0.851ZM4 2.466a0.75 0.75 0 0 1 0.75 0.75v7.568a0.75 0.75 0 1 1 -1.5 0V3.216a0.75 0.75 0 0 1 0.75 -0.75ZM1 4.831a0.75 0.75 0 0 1 0.75 0.75V8.42a0.75 0.75 0 0 1 -1.5 0V5.581a0.75 0.75 0 0 1 0.75 -0.75Zm9 -2.365a0.75 0.75 0 0 1 0.75 0.75v7.568a0.75 0.75 0 1 1 -1.5 0V3.216a0.75 0.75 0 0 1 0.75 -0.75Zm3.75 3.115a0.75 0.75 0 0 0 -1.5 0V8.42a0.75 0.75 0 0 0 1.5 0V5.581Z" clip-rule="evenodd"></path></svg>
    </div>
    <div class="card bottom-card">
        <div class="image-row">
            <div class="image-frame"><div class="image-inner uploadable-img"></div></div>
            <div class="image-frame"><div class="image-inner uploadable-img"></div></div>
            <div class="image-frame"><div class="image-inner uploadable-img"></div></div>
        </div>
        <div class="bottom-text-row">
            <div class="bottom-text" contenteditable="true">@ We don't talk anymore.</div>
            <div class="bottom-text" contenteditable="true">✩₊행복…은 손에 닿을 듯 가깝다.*✩</div>
        </div>
    </div>
</div>`
            },
            {
                name: '小猫饼对话',
                presetSize: '4x3',
                preview: '#e8eaed',
                content: `<style>
    .widget-4x3-msg { width: 100%; height: 100%; display: flex; flex-direction: column; gap: 8px; box-sizing: border-box; background: transparent; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden; }
    .widget-4x3-msg .top-card { background-color: #f4f5f7; border-radius: 24px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06); border: 1px solid #ebebeb; box-sizing: border-box; display: flex; align-items: center; padding: 12px 20px; }
    .widget-4x3-msg .top-icon-frame { width: 52px; height: 52px; background-color: #b8b8b8; border-radius: 14px; padding: 4px; box-sizing: border-box; flex-shrink: 0; }
    .widget-4x3-msg .top-icon-inner { width: 100%; height: 100%; background-color: #fff; border-radius: 10px; overflow: hidden; display: flex; justify-content: center; align-items: center; background-size: cover; background-position: center; }
    .widget-4x3-msg .top-text-group { margin-left: 16px; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
    .widget-4x3-msg .top-title { font-size: 17px; font-weight: 600; color: #333; outline: none; }
    .widget-4x3-msg .top-subtitle { font-size: 13px; color: #666; outline: none; }
    .widget-4x3-msg .music-icon { width: 24px; height: 24px; color: #555; }
    .widget-4x3-msg .bottom-chat-section { flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: 8px; padding: 0 8px 4px 8px; }
    .widget-4x3-msg .chat-timestamp { text-align: center; font-size: 11px; color: #999; line-height: 1.4; outline: none; width: 100%; margin-bottom: 2px; }
    .widget-4x3-msg .chat-group { display: flex; flex-direction: column; width: 100%; gap: 4px; }
    .widget-4x3-msg .chat-group.left { align-items: flex-start; }
    .widget-4x3-msg .chat-group.right { align-items: flex-end; }
    .widget-4x3-msg .chat-row { display: flex; align-items: flex-end; gap: 8px; max-width: 100%; }
    .widget-4x3-msg .chat-group.right .chat-row { flex-direction: row-reverse; }
    .widget-4x3-msg .chat-avatar { width: 36px; height: 36px; border-radius: 50%; background-color: #d1d1d6; flex-shrink: 0; overflow: hidden; display: flex; justify-content: center; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); background-size: cover; background-position: center; }
    .widget-4x3-msg .chat-bubble { padding: 8px 14px; font-size: 14px; line-height: 1.4; max-width: 65%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 2px 6px rgba(0,0,0,0.08); border-radius: 20px; outline: none; }
    .widget-4x3-msg .chat-group.left .chat-bubble { background-color: #ffffff; color: #000; }
    .widget-4x3-msg .chat-group.right .chat-bubble { background-color: #007aff; color: #fff; }
    .widget-4x3-msg .chat-delivered { font-size: 10px; color: #999; padding-right: 44px; outline: none; line-height: 1; }
    .widget-4x3-msg .imessage-bar { display: flex; align-items: center; border: 1px solid #c8c8cc; border-radius: 20px; padding: 6px 12px; background-color: rgba(255, 255, 255, 0.6); backdrop-filter: blur(10px); gap: 10px; margin-top: 2px; }
    .widget-4x3-msg .imessage-icon { color: #8e8e93; width: 20px; height: 20px; flex-shrink: 0; }
    .widget-4x3-msg .imessage-input { flex-grow: 1; font-size: 14px; color: #3c3c43; outline: none; }
</style>
<div class="widget-4x3-msg">
    <div class="top-card">
        <div class="top-icon-frame">
            <div class="top-icon-inner uploadable-img"></div>
        </div>
        <div class="top-text-group">
            <div class="top-title" contenteditable="true">小猫饼</div>
            <div class="top-subtitle" contenteditable="true">Trou、verJasm1ne</div>
        </div>
        <svg class="music-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14"><path fill="#555555" fill-rule="evenodd" d="M7.75 0.851a0.75 0.75 0 0 0 -1.5 0V13.15a0.75 0.75 0 0 0 1.5 0V0.851ZM4 2.466a0.75 0.75 0 0 1 0.75 0.75v7.568a0.75 0.75 0 1 1 -1.5 0V3.216a0.75 0.75 0 0 1 0.75 -0.75ZM1 4.831a0.75 0.75 0 0 1 0.75 0.75V8.42a0.75 0.75 0 0 1 -1.5 0V5.581a0.75 0.75 0 0 1 0.75 -0.75Zm9 -2.365a0.75 0.75 0 0 1 0.75 0.75v7.568a0.75 0.75 0 1 1 -1.5 0V3.216a0.75 0.75 0 0 1 0.75 -0.75Zm3.75 3.115a0.75 0.75 0 0 0 -1.5 0V8.42a0.75 0.75 0 0 0 1.5 0V5.581Z" clip-rule="evenodd"></path></svg>
    </div>
    <div class="bottom-chat-section">
        <div class="chat-timestamp" contenteditable="true">iMessage메시지 오늘 16:47</div>
        
        <div class="chat-group left">
            <div class="chat-row">
                <div class="chat-avatar uploadable-img"></div>
                <div class="chat-bubble" contenteditable="true">今天天气真不错呀！☀️</div>
            </div>
        </div>
        
        <div class="chat-group right">
            <div class="chat-row">
                <div class="chat-avatar uploadable-img"></div>
                <div class="chat-bubble" contenteditable="true">是啊，刚好适合做小组件~</div>
            </div>
            <div class="chat-delivered" contenteditable="true">已送达</div>
        </div>
        
        <div class="imessage-bar">
            <svg class="imessage-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <div class="imessage-input" contenteditable="true">iMessage</div>
            <svg class="imessage-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" /></svg>
        </div>
    </div>
</div>`
            },
            {
                name: '甜品店挂牌',
                presetSize: '4x2',
                preview: '#f5f5f5',
                content: `<style>
    .widget-container-dessert { width: 100%; height: 100%; background: transparent; position: relative; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    .widget-container-dessert .pole-system { position: absolute; width: 100%; height: 100%; top: 0; left: 0; z-index: 1; pointer-events: none; }
    .widget-container-dessert .pole-vertical { position: absolute; left: 6%; top: 10%; width: 8px; height: calc(38% - 2px); background-color: #d1d1d5; }
    .widget-container-dessert .pole-vertical::before { content: ''; position: absolute; top: -5px; left: -3px; width: 14px; height: 6px; background-color: #d1d1d5; border-radius: 3px; }
    .widget-container-dessert .pole-horizontal { position: absolute; left: 6%; top: 43%; width: 86%; height: 6px; background-color: #d1d1d5; transform: translateY(-50%); }
    .widget-container-dessert .pole-horizontal::after { content: ''; position: absolute; right: -4px; top: 50%; width: 12px; height: 12px; background-color: #d1d1d5; border-radius: 50%; transform: translateY(-50%); }
    .widget-container-dessert .pole-joint { position: absolute; left: calc(6% + 4px); top: 43%; width: 18px; height: 18px; background-color: #d1d1d5; border-radius: 50%; transform: translate(-50%, -50%); z-index: 2; }
    .widget-container-dessert .main-sign { position: absolute; left: calc(6% + 7px); top: 18%; width: 83%; height: 17%; background-color: #ffffff; border: 1.5px solid #d1d1d5; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; z-index: 0; }
    .widget-container-dessert .editable-text { outline: none; cursor: text; transition: background-color 0.2s; }
    .widget-container-dessert .editable-text:hover { background-color: rgba(0,0,0,0.03); border-radius: 4px; }
    .widget-container-dessert .sign-text { font-weight: 900; font-size: clamp(12px, 3vw, 18px); letter-spacing: 1px; padding-left: 4%; color: #000000; white-space: nowrap; }
    .widget-container-dessert .sign-pattern { width: 6%; height: 100%; border-left: 1.5px solid #d1d1d5; background-image: radial-gradient(#f4cdd8 30%, transparent 30%); background-size: 6px 6px; background-position: 0 0; }
    .widget-container-dessert .tags-container { position: absolute; top: 43%; left: 12%; width: 76%; height: 52%; display: flex; justify-content: space-between; z-index: 0; }
    .widget-container-dessert .tag-wrapper { display: flex; flex-direction: column; align-items: center; width: 22%; height: 100%; }
    .widget-container-dessert .connector { width: 6px; height: 12%; background-color: #d1d1d5; position: relative; }
    .widget-container-dessert .connector::before { content: ''; position: absolute; top: -2px; left: -3px; width: 12px; height: 4px; background-color: #d1d1d5; border-radius: 2px; }
    .widget-container-dessert .tag { width: 100%; height: 88%; border-radius: 0 0 20px 20px; display: flex; flex-direction: column; align-items: center; padding-top: 10%; box-sizing: border-box; }
    .widget-container-dessert .tag.pink { background-color: #fdf0f4; }
    .widget-container-dessert .tag.blue { background-color: #f0f5fd; }
    .widget-container-dessert .icon-box { width: 70%; aspect-ratio: 1 / 1; background-color: #ffffff; border-radius: 4px; background-size: cover; background-position: center; background-repeat: no-repeat; overflow: hidden; position: relative; }
    .widget-container-dessert .icon-box.gray-bg { background-color: #d0d0d4; }
    .widget-container-dessert .tag-text { font-size: clamp(10px, 1.5vw, 13px); font-weight: 900; margin-top: 6%; color: #444444; width: 70%; text-align: left; }
</style>
<div class="widget-container-dessert">
    <div class="pole-system">
        <div class="pole-vertical"></div>
        <div class="pole-horizontal"></div>
        <div class="pole-joint"></div>
    </div>
    <div class="main-sign">
        <div class="sign-text editable-text" contenteditable="true" spellcheck="false">[ㅇㅅㅇ] ୨ · DESSERT SHOP · ୧</div>
        <div class="sign-pattern"></div>
    </div>
    <div class="tags-container">
        <div class="tag-wrapper">
            <div class="connector"></div>
            <div class="tag pink">
                <div class="icon-box uploadable-img" style="background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%22-12 -12 124 124%22%3E%3Cpolygon points=%2220,50 30,15 50,35%22 fill=%22%23c8c8c8%22 stroke=%22%23c8c8c8%22 stroke-width=%224%22 stroke-linejoin=%22round%22/%3E%3Cpolygon points=%2280,50 70,15 50,35%22 fill=%22%23c8c8c8%22 stroke=%22%23c8c8c8%22 stroke-width=%224%22 stroke-linejoin=%22round%22/%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2232%22 fill=%22%23c8c8c8%22/%3E%3Cpath d=%22M 20 110 Q 50 70 80 110%22 fill=%22%23c8c8c8%22/%3E%3C/svg%3E');"></div>
                <div class="tag-text editable-text" contenteditable="true" spellcheck="false">No.1</div>
            </div>
        </div>
        <div class="tag-wrapper">
            <div class="connector"></div>
            <div class="tag blue">
                <div class="icon-box gray-bg uploadable-img" style="background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%22-12 -12 124 124%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%2212%22 fill=%22%23ffffff%22/%3E%3Ccircle cx=%2270%22 cy=%2230%22 r=%2212%22 fill=%22%23ffffff%22/%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2230%22 fill=%22%23ffffff%22/%3E%3Cpath d=%22M 20 110 Q 50 75 80 110%22 fill=%22%23ffffff%22/%3E%3C/svg%3E');"></div>
                <div class="tag-text editable-text" contenteditable="true" spellcheck="false">No.2</div>
            </div>
        </div>
        <div class="tag-wrapper">
            <div class="connector"></div>
            <div class="tag pink">
                <div class="icon-box uploadable-img" style="background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%22-12 -12 124 124%22%3E%3Cpath d=%22M 50 85 C 50 85 15 55 15 35 C 15 20 30 10 45 20 C 50 24 50 24 50 24 C 50 24 50 24 55 20 C 70 10 85 20 85 35 C 85 55 50 85 50 85 Z%22 fill=%22%23f4b3c2%22/%3E%3C/svg%3E');"></div>
            </div>
        </div>
        <div class="tag-wrapper">
            <div class="connector"></div>
            <div class="tag blue">
                <div class="icon-box uploadable-img" style="background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%22-12 -12 124 124%22%3E%3Ccircle cx=%2220%22 cy=%2220%22 r=%223%22 fill=%22%23f4e1e6%22/%3E%3Ccircle cx=%2280%22 cy=%2220%22 r=%223%22 fill=%22%23f4e1e6%22/%3E%3Ccircle cx=%2220%22 cy=%2280%22 r=%223%22 fill=%22%23f4e1e6%22/%3E%3Ccircle cx=%2280%22 cy=%2280%22 r=%223%22 fill=%22%23f4e1e6%22/%3E%3Cline x1=%2265%22 y1=%2215%22 x2=%2255%22 y2=%2240%22 stroke=%22%23d1d1d5%22 stroke-width=%224%22 stroke-linecap=%22round%22/%3E%3Cpath d=%22M 35 35 L 65 35 L 60 80 C 60 85 40 85 40 80 Z%22 fill=%22%23fbe4eb%22/%3E%3Cpath d=%22M 38 50 Q 50 60 62 50%22 fill=%22none%22 stroke=%22%23f4cdd8%22 stroke-width=%223%22 stroke-linecap=%22round%22/%3E%3Cpath d=%22M 39 65 Q 50 75 61 65%22 fill=%22none%22 stroke=%22%23f4cdd8%22 stroke-width=%223%22 stroke-linecap=%22round%22/%3E%3C/svg%3E');"></div>
            </div>
        </div>
    </div>
</div>`
            },
            {
                name: '人机验证',
                presetSize: '4x4',
                preview: '#f4f6fc',
                content: `<style>
    /* 新增外层 wrapper，利用 padding: 5% 让内部卡片缩小一圈 */
    .widget-captcha-wrapper { width: 100%; height: 100%; padding: 5%; box-sizing: border-box; display: flex; justify-content: center; align-items: center; background: transparent; }
    .widget-captcha-container { width: 100%; height: 100%; background-color: #ffffff; border: 1px solid #e0e0e0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); padding: 8px; display: flex; flex-direction: column; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .widget-captcha-header { background-color: #7a92d5; color: #ffffff; padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }
    .widget-captcha-header [contenteditable="true"] { outline: none; border-radius: 2px; transition: background-color 0.2s; }
    .widget-captcha-header [contenteditable="true"]:hover { background-color: rgba(255, 255, 255, 0.2); cursor: text; }
    .captcha-text-small { font-size: 12px; opacity: 0.9; }
    .captcha-text-large { font-size: 22px; font-weight: bold; margin: 2px 0; }
    .widget-captcha-image-area { flex-grow: 1; position: relative; margin-top: 8px; overflow: hidden; }
    .captcha-placeholder-box { width: 100%; height: 100%; background-color: #d9e2ec; background-size: cover; background-position: center; background-repeat: no-repeat; }
    .captcha-grid-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); pointer-events: none; }
    .captcha-grid-overlay div { border: 1px solid #ffffff; }
    .captcha-grid-overlay div:nth-child(-n+3) { border-top: none; }
    .captcha-grid-overlay div:nth-child(3n+1) { border-left: none; }
    .captcha-grid-overlay div:nth-child(3n) { border-right: none; }
    .captcha-grid-overlay div:nth-child(n+7) { border-bottom: none; }
    .widget-captcha-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 8px; margin-top: 8px; border-top: 1px solid #f0f0f0; }
    .captcha-footer-icons { display: flex; gap: 12px; padding-left: 8px; align-items: center; }
    .captcha-footer-icons svg { width: 26px; height: 26px; color: #999999; }
    .captcha-skip-btn { background-color: #7a92d5; color: #ffffff; border: none; padding: 8px 24px; font-size: 14px; font-weight: 500; text-transform: uppercase; text-align: center; }
</style>
<!-- 在最外层套上 wrapper -->
<div class="widget-captcha-wrapper">
    <div class="widget-captcha-container">
        <div class="widget-captcha-header">
            <span class="captcha-text-small" contenteditable="true" spellcheck="false">Select all squares that show</span>
            <span class="captcha-text-large" contenteditable="true" spellcheck="false">You</span>
            <span class="captcha-text-small" contenteditable="true" spellcheck="false">If there are none,click skip</span>
        </div>
        <div class="widget-captcha-image-area">
            <!-- 注意这里加上了 uploadable-img 类名，你的系统会自动接管点击上传 -->
            <div class="captcha-placeholder-box uploadable-img"></div>
            <div class="captcha-grid-overlay">
                <div></div><div></div><div></div>
                <div></div><div></div><div></div>
                <div></div><div></div><div></div>
            </div>
        </div>
        <div class="widget-captcha-footer">
            <div class="captcha-footer-icons">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.2577 3.50828c0.2803 0.11609 0.463 0.38957 0.463 0.69291v4.24264c0 0.41422 -0.3358 0.75 -0.75 0.75H13.728c-0.3033 0 -0.5768 -0.18273 -0.6929 -0.46298 -0.116 -0.28026 -0.0519 -0.60285 0.1626 -0.81735l1.603 -1.603c-2.6333 -1.10138 -5.78464 -0.5796 -7.92722 1.56298 -2.83131 2.83132 -2.83131 7.42172 0 10.25302 2.8313 2.8313 7.42172 2.8313 10.25302 0 1.6462 -1.6462 2.3357 -3.8864 2.067 -6.0328 -0.0515 -0.411 0.24 -0.7859 0.651 -0.8374 0.411 -0.0514 0.7859 0.24 0.8374 0.651 0.3238 2.5861 -0.5073 5.2924 -2.4947 7.2799 -3.4171 3.4171 -8.9573 3.4171 -12.37438 0 -3.41709 -3.4171 -3.41709 -8.9573 0 -12.37438C8.55119 4.07444 12.6515 3.5312 15.9309 5.18028l1.5095 -1.50942c0.2145 -0.21449 0.537 -0.27866 0.8173 -0.16258Z" fill="currentColor" stroke="currentColor" stroke-width="0.8"></path></svg>
                <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z"/></svg>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <button class="captcha-skip-btn">SKIP</button>
        </div>
    </div>
</div>`
            },
            {
                name: '双层拍立得',
                presetSize: '2x2',
                preview: '#f8f8f8',
                content: `<style>
    .widget-2x2 { width: 100%; height: 100%; background-color: transparent; position: relative; display: flex; justify-content: center; align-items: center; font-family: "Times New Roman", Times, serif; }
    .polaroid { position: absolute; background: #ffffff; padding: 5px 5px 8px 5px; box-shadow: 0 3px 12px rgba(0,0,0,0.08); width: 120px; height: 160px; box-sizing: border-box; border: 1px solid #f4f4f4; }
    .card-back { transform: rotate(5deg) translate(8px, 3px); z-index: 1; background: #fdfdfd; }
    .card-front { z-index: 2; display: flex; flex-direction: column; }
    .image-placeholder { width: 100%; flex-grow: 1; background-color: #3a3a3a; border-radius: 1px; background-size: cover; background-position: center top; background-repeat: no-repeat; }
    .caption { text-align: center; margin-top: 4px; font-size: 10px; color: #444; letter-spacing: 0.5px; line-height: 1.2; min-height: 12px; outline: none; }
    .cross { position: absolute; top: 10px; left: 35px; z-index: 4; filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.15)); pointer-events: none; }
    .cross-vertical { width: 7px; height: 30px; background: linear-gradient(135deg, #ffffff 0%, #ececec 100%); border-radius: 1px; }
    .cross-horizontal { width: 22px; height: 7px; background: linear-gradient(135deg, #ffffff 0%, #ececec 100%); position: absolute; top: 8px; left: -7.5px; border-radius: 1px; }
    .speech-bubble { position: absolute; top: 25px; right: 5px; background: #fffafb; padding: 6px 10px; border-radius: 16px; font-size: 11px; color: #333; z-index: 4; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #f0f0f0; min-width: 24px; outline: none; }
    .speech-bubble::after { content: ''; position: absolute; bottom: -7px; left: 14px; border-top: 10px solid #fffafb; border-left: 3px solid transparent; border-right: 10px solid transparent; transform: rotate(10deg); z-index: -1; }
</style>
<div class="widget-2x2">
    <div class="polaroid card-back"></div>
    <div class="polaroid card-front">
        <div class="image-placeholder uploadable-img"></div>
        <div class="caption" contenteditable="true" spellcheck="false">[Eio00s]</div>
    </div>
    <div class="cross">
        <div class="cross-vertical"></div>
        <div class="cross-horizontal"></div>
    </div>
    <div class="speech-bubble" contenteditable="true" spellcheck="false">I'm sorry...</div>
</div>`
            },
            {
                name: '甜美头像圈',
                presetSize: '2x2',
                preview: '#f2dce2',
                content: `<style>
    .widget-2x2-cute { width: 100%; height: 100%; background-color: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; position: relative; box-sizing: border-box; }
    .avatar-section { position: relative; margin-bottom: 8px; margin-top: 4px; }
    .avatar-ring { width: 80px; height: 80px; border-radius: 50%; border: 2.5px solid #f2dce2; padding: 2.5px; background-color: #ffffff; box-sizing: border-box; }
    .main-avatar { width: 100%; height: 100%; border-radius: 50%; background-color: #dcdcdc; background-size: cover; background-position: center; }
    .speech-bubble-wrapper { position: absolute; top: -10px; right: -14px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.08)); z-index: 3; }
    .speech-bubble { background: #ffffff; border-radius: 12px; padding: 4px 8px; position: relative; display: flex; justify-content: center; align-items: center; }
    .speech-bubble::after { content: ''; position: absolute; bottom: -3px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 8px; height: 8px; background: #ffffff; border-radius: 2px; }
    .bubble-emoji { font-size: 16px; line-height: 1; outline: none; text-align: center; min-width: 20px; }
    .plus-badge { position: absolute; bottom: -2px; right: -2px; width: 22px; height: 22px; background-color: #f4b3c2; border-radius: 50%; border: 2.5px solid #ffffff; display: flex; justify-content: center; align-items: center; z-index: 3; }
    .plus-badge::before, .plus-badge::after { content: ''; position: absolute; background-color: #ffffff; border-radius: 1px; }
    .plus-badge::before { width: 10px; height: 2px; }
    .plus-badge::after { width: 2px; height: 10px; }
    .text-line-1 { font-size: 11px; color: #444444; font-weight: 600; margin-bottom: 6px; outline: none; text-align: center; letter-spacing: 0.5px; }
    .text-line-1 i { font-family: "Times New Roman", Times, serif; font-style: italic; font-weight: 700; font-size: 13px; }
    .text-line-2 { font-size: 9px; color: #666666; background-color: #e8e8e8; padding: 4px 12px; border-radius: 20px; outline: none; text-align: center; letter-spacing: 0.5px; }
</style>
<div class="widget-2x2-cute">
    <div class="avatar-section">
        <div class="avatar-ring">
            <div class="main-avatar uploadable-img"></div>
        </div>
        <div class="speech-bubble-wrapper">
            <div class="speech-bubble">
                <div class="bubble-emoji" contenteditable="true" spellcheck="false">🎧</div>
            </div>
        </div>
        <div class="plus-badge"></div>
    </div>
    <div class="text-line-1" contenteditable="true" spellcheck="false">* ₊ ˚ ⋆ ♡ <i>weekend</i> 🥛 :)</div>
    <div class="text-line-2" contenteditable="true" spellcheck="false"> ੈ♡ 消えない記憶 ⊹ ｡ ﾟ</div>
</div>`
            }

        ];
        const customWidgets = window.customWidgets || [];

        window.officialWidgets = officialWidgets;
        window.customWidgets = customWidgets;
        let currentWidgets = officialWidgets;

        let widgetViewMode = 'carousel';     // 'carousel' | 'list'
        let isWidgetEditing = false;
        let currentProgress = 0, targetProgress = 0;
        let isDragging = false, startX = 0, startProgress = 0;
        let activeWidgetIndex = -1;

        function findWidgetTagEnd(source, startIndex) {
            let quote = '';
            for (let i = startIndex; i < source.length; i++) {
                const char = source[i];
                if (quote) {
                    if (char === quote) quote = '';
                } else if (char === '"' || char === "'") {
                    quote = char;
                } else if (char === '>') {
                    return i;
                }
            }
            return -1;
        }

        function getWidgetTagAttribute(tagText, attributeName) {
            const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp('\\s' + escapedName + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i');
            const match = pattern.exec(tagText);
            return match ? (match[1] || match[2] || match[3] || '') : '';
        }

        function scanWidgetImageTags(content) {
            const source = String(content == null ? '' : content);
            const lowerSource = source.toLowerCase();
            const counters = { img: 0, image: 0, uploadable: 0, contenteditable: 0 };
            const tags = [];
            let cursor = 0;

            while (cursor < source.length) {
                const tagStart = source.indexOf('<', cursor);
                if (tagStart === -1) break;

                if (lowerSource.slice(tagStart, tagStart + 4) === '<!--') {
                    const commentEnd = lowerSource.indexOf('-->', tagStart + 4);
                    cursor = commentEnd === -1 ? source.length : commentEnd + 3;
                    continue;
                }

                let nameStart = tagStart + 1;
                while (/\s/.test(source[nameStart] || '')) nameStart++;
                if (/[/!?]/.test(source[nameStart] || '')) {
                    const skippedTagEnd = findWidgetTagEnd(source, nameStart + 1);
                    cursor = skippedTagEnd === -1 ? source.length : skippedTagEnd + 1;
                    continue;
                }

                let nameEnd = nameStart;
                while (/[A-Za-z0-9:-]/.test(source[nameEnd] || '')) nameEnd++;
                if (nameEnd === nameStart) {
                    cursor = tagStart + 1;
                    continue;
                }

                const tagName = lowerSource.slice(nameStart, nameEnd);
                const tagEnd = findWidgetTagEnd(source, nameEnd);
                if (tagEnd === -1) break;

                const tagText = source.slice(tagStart, tagEnd + 1);
                if (tagName === 'img' || tagName === 'image') {
                    tags.push({
                        name: tagName,
                        tagName: tagName,
                        kind: tagName,
                        index: counters[tagName]++,
                        start: tagStart,
                        end: tagEnd
                    });
                }

                const classNames = getWidgetTagAttribute(tagText, 'class').split(/\s+/).filter(Boolean);
                if (tagName !== 'img' && tagName !== 'image' && classNames.indexOf('uploadable-img') !== -1) {
                    tags.push({
                        name: 'uploadable',
                        tagName: tagName,
                        kind: 'uploadable',
                        index: counters.uploadable++,
                        start: tagStart,
                        end: tagEnd
                    });
                }

                if (getWidgetTagAttribute(tagText, 'contenteditable').toLowerCase() === 'true') {
                    tags.push({
                        name: 'contenteditable',
                        tagName: tagName,
                        kind: 'contenteditable',
                        index: counters.contenteditable++,
                        start: tagStart,
                        end: tagEnd
                    });
                }

                if (tagName === 'script' || tagName === 'style') {
                    const closeStart = lowerSource.indexOf('</' + tagName, tagEnd + 1);
                    if (closeStart === -1) break;
                    const closeEnd = findWidgetTagEnd(source, closeStart + tagName.length + 2);
                    cursor = closeEnd === -1 ? source.length : closeEnd + 1;
                } else {
                    cursor = tagEnd + 1;
                }
            }

            return tags;
        }

        function widgetImageEditBridge(mode) {
            const isDesktopWidget = mode === 'desktop';
            let pointerStart = null;
            let desktopTouchStart = null;
            let suppressImageClickUntil = 0;

            function findContentEditableTarget(startElement) {
                const editable = startElement && startElement.closest
                    ? startElement.closest('[data-widget-editor-content-index]')
                    : null;
                if (!editable) return null;

                const markedIndex = editable.getAttribute('data-widget-editor-content-index');
                const index = parseInt(markedIndex, 10);
                if (!Number.isFinite(index)) return null;

                return {
                    kind: 'contenteditable',
                    index: index,
                    html: editable.innerHTML
                };
            }

            function postContentEdit(element, phase) {
                const target = findContentEditableTarget(element);
                if (!target) return;

                parent.postMessage({
                    type: isDesktopWidget ? 'widget-desktop-content' : 'widget-image-editor-content',
                    phase: phase,
                    target: { kind: target.kind, index: target.index },
                    html: target.html
                }, '*');
            }

            function postDesktopPointer(phase, event) {
                parent.postMessage({
                    type: 'widget-desktop-pointer',
                    phase: phase,
                    pointerId: event.pointerId,
                    clientX: event.clientX,
                    clientY: event.clientY
                }, '*');
            }

            function postDesktopSwipe(startTouch, endTouch) {
                parent.postMessage({
                    type: 'widget-desktop-swipe',
                    deltaX: endTouch.clientX - startTouch.clientX,
                    deltaY: endTouch.clientY - startTouch.clientY
                }, '*');
            }

            if (isDesktopWidget) {
                document.addEventListener('touchstart', function (event) {
                    if (event.touches.length !== 1) {
                        desktopTouchStart = null;
                        return;
                    }
                    const touch = event.touches[0];
                    desktopTouchStart = {
                        identifier: touch.identifier,
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    };
                }, { capture: true, passive: true });

                document.addEventListener('touchend', function (event) {
                    if (!desktopTouchStart) return;
                    let endTouch = null;
                    for (let index = 0; index < event.changedTouches.length; index++) {
                        if (event.changedTouches[index].identifier === desktopTouchStart.identifier) {
                            endTouch = event.changedTouches[index];
                            break;
                        }
                    }
                    if (endTouch) postDesktopSwipe(desktopTouchStart, endTouch);
                    desktopTouchStart = null;
                }, { capture: true, passive: true });

                document.addEventListener('touchcancel', function () {
                    desktopTouchStart = null;
                }, { capture: true, passive: true });
            }

            document.addEventListener('pointerdown', function (event) {
                if (event.isPrimary === false) return;
                pointerStart = {
                    pointerId: event.pointerId,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    startedAt: Date.now(),
                    moved: false
                };
                if (isDesktopWidget) {
                    try {
                        if (event.target && event.target.setPointerCapture) {
                            event.target.setPointerCapture(event.pointerId);
                        }
                    } catch (error) {
                        // Pointer capture is optional; the parent still receives normal events.
                    }
                    postDesktopPointer('down', event);
                }
            }, true);

            document.addEventListener('pointermove', function (event) {
                if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
                if (Math.abs(event.clientX - pointerStart.clientX) > 10 || Math.abs(event.clientY - pointerStart.clientY) > 10) {
                    pointerStart.moved = true;
                }
                if (isDesktopWidget) {
                    postDesktopPointer('move', event);
                }
            }, true);

            document.addEventListener('pointerup', function (event) {
                if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
                const pressDuration = Date.now() - pointerStart.startedAt;
                const shouldOpenTouchPicker = isDesktopWidget && event.pointerType === 'touch' && !pointerStart.moved && pressDuration < 550;
                if (pointerStart.moved || pressDuration >= 550 || shouldOpenTouchPicker) {
                    suppressImageClickUntil = Date.now() + 500;
                }
                if (isDesktopWidget) {
                    postDesktopPointer('up', event);
                }
                pointerStart = null;

                if (shouldOpenTouchPicker) {
                    const element = event.target && event.target.nodeType === 1 ? event.target : null;
                    const target = element && (findImageTarget(element) || findBackgroundTarget(element));
                    if (target) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        openWidgetImagePicker(target);
                    }
                }
            }, true);

            document.addEventListener('pointercancel', function (event) {
                if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
                suppressImageClickUntil = Date.now() + 500;
                if (isDesktopWidget) {
                    postDesktopPointer('cancel', event);
                }
                pointerStart = null;
            }, true);

            function extractBackgroundUrl(value) {
                const match = String(value || '').match(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/i);
                return match ? (match[1] || match[2] || (match[3] || '').trim()) : '';
            }

            function findRuleBackground(element, rules) {
                let source = '';
                Array.prototype.forEach.call(rules || [], function (rule) {
                    try {
                        if (rule.cssRules) {
                            const nestedSource = findRuleBackground(element, rule.cssRules);
                            if (nestedSource) source = nestedSource;
                        } else if (rule.selectorText && element.matches(rule.selectorText)) {
                            const ruleSource = extractBackgroundUrl(rule.style && rule.style.backgroundImage);
                            if (ruleSource) source = ruleSource;
                        }
                    } catch (error) {
                        // Ignore inaccessible or unsupported CSS rules in the preview.
                    }
                });
                return source;
            }

            function getBackgroundSource(element) {
                const inlineSource = extractBackgroundUrl(element.style && element.style.backgroundImage);
                if (inlineSource) return inlineSource;

                let ruleSource = '';
                Array.prototype.forEach.call(document.styleSheets || [], function (styleSheet) {
                    try {
                        const matchedSource = findRuleBackground(element, styleSheet.cssRules);
                        if (matchedSource) ruleSource = matchedSource;
                    } catch (error) {
                        // Ignore inaccessible stylesheets in the preview.
                    }
                });
                if (ruleSource) return ruleSource;

                return extractBackgroundUrl(getComputedStyle(element).backgroundImage);
            }

            function findBackgroundTarget(startElement) {
                let element = startElement;
                while (element && element.nodeType === 1) {
                    const source = getBackgroundSource(element);
                    if (source) return { kind: 'background', source: source };
                    if (element === document.body || element === document.documentElement) break;
                    element = element.parentElement;
                }
                return null;
            }

            function findImageTarget(startElement) {
                const uploadable = startElement && startElement.closest
                    ? startElement.closest('[data-widget-editor-uploadable-index]')
                    : null;
                if (uploadable) {
                    const markedIndex = uploadable.getAttribute('data-widget-editor-uploadable-index');
                    const index = parseInt(markedIndex, 10);
                    if (Number.isFinite(index)) {
                        return {
                            kind: 'uploadable',
                            index: index,
                            source: getBackgroundSource(uploadable)
                        };
                    }
                }

                const image = startElement && startElement.closest
                    ? startElement.closest('img, image')
                    : null;
                if (!image) return null;

                const tagName = image.tagName.toLowerCase();
                const markedIndex = image.getAttribute('data-widget-editor-image-index');
                const isStaticImage = markedIndex !== null;
                let attribute = tagName === 'image' ? 'href' : 'src';
                let source = image.getAttribute(attribute) || '';

                if (tagName === 'image' && !source) {
                    attribute = 'xlink:href';
                    source = image.getAttribute('xlink:href') || '';
                }

                return {
                    kind: tagName,
                    index: isStaticImage
                        ? parseInt(markedIndex, 10)
                        : Array.prototype.indexOf.call(document.querySelectorAll(tagName), image),
                    attribute: attribute,
                    source: source,
                    dynamic: !isStaticImage
                };
            }

            function openWidgetImagePicker(target) {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.style.display = 'none';
                document.body.appendChild(input);
                input.addEventListener('change', function () {
                    const file = input.files && input.files[0];
                    if (file) {
                        parent.postMessage({
                            type: isDesktopWidget ? 'widget-desktop-image-file' : 'widget-image-editor-file',
                            target: target,
                            file: file
                        }, '*');
                    }
                    input.remove();
                }, { once: true });
                input.addEventListener('cancel', function () { input.remove(); }, { once: true });
                input.click();
            }

            document.addEventListener('pointerover', function (event) {
                const element = event.target && event.target.nodeType === 1 ? event.target : null;
                if (!element) return;
                const uploadable = element.closest && element.closest('[data-widget-editor-uploadable-index]');
                if (uploadable) {
                    uploadable.setAttribute('data-widget-editor-uploadable-hover', '');
                    return;
                }
                if (element.closest && element.closest('img, image, [contenteditable="true"]')) return;
                let current = element;
                while (current && current.nodeType === 1) {
                    if (getBackgroundSource(current)) {
                        current.setAttribute('data-widget-editor-background', '');
                        break;
                    }
                    if (current === document.body || current === document.documentElement) break;
                    current = current.parentElement;
                }
            }, true);

            document.addEventListener('click', function (event) {
                const element = event.target && event.target.nodeType === 1 ? event.target : null;
                if (!element || (element.matches && element.matches('input[type="file"]'))) return;
                if (element.closest && element.closest('[contenteditable="true"]')) return;

                const target = findImageTarget(element) || findBackgroundTarget(element);
                if (!target) return;

                if (isDesktopWidget && Date.now() < suppressImageClickUntil) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return;
                }

                event.preventDefault();
                event.stopImmediatePropagation();
                openWidgetImagePicker(target);
            }, true);

            document.addEventListener('input', function (event) {
                const element = event.target && event.target.nodeType === 1 ? event.target : null;
                if (element) postContentEdit(element, 'input');
            }, true);

            document.addEventListener('blur', function (event) {
                const element = event.target && event.target.nodeType === 1 ? event.target : null;
                if (element) postContentEdit(element, 'blur');
            }, true);
        }

        function buildWidgetImageEditableContent(content, mode) {
            let previewContent = String(content == null ? '' : content);
            const tags = scanWidgetImageTags(previewContent);

            for (let i = tags.length - 1; i >= 0; i--) {
                const tag = tags[i];
                let insertAt = tag.end;
                let beforeEnd = tag.end - 1;
                while (beforeEnd > tag.start && /\s/.test(previewContent[beforeEnd])) beforeEnd--;
                if (previewContent[beforeEnd] === '/') insertAt = beforeEnd;
                const markerName = tag.name === 'uploadable'
                    ? 'data-widget-editor-uploadable-index'
                    : tag.name === 'contenteditable'
                        ? 'data-widget-editor-content-index'
                        : 'data-widget-editor-image-index';
                const marker = ' ' + markerName + '="' + tag.index + '"';
                previewContent = previewContent.slice(0, insertAt) + marker + previewContent.slice(insertAt);
            }

            const editStyle = '<style>img[data-widget-editor-image-index],image[data-widget-editor-image-index],[data-widget-editor-uploadable-index],[data-widget-editor-background]{cursor:pointer!important}[data-widget-editor-content-index]{cursor:text!important}[data-widget-editor-uploadable-index]:hover,img[data-widget-editor-image-index]:hover,image[data-widget-editor-image-index]:hover,[data-widget-editor-background]:hover{outline:2px solid #007aff!important;outline-offset:-2px}[data-widget-editor-content-index]:focus{outline:2px solid rgba(0,122,255,.55)!important;outline-offset:2px}</style>';
            const editScript = '<script>(' + widgetImageEditBridge.toString() + ')(' + JSON.stringify(mode || 'editor') + ');<' + '/script>';
            const editTools = editStyle + editScript;
            const headMatch = /<head\b[^>]*>/i.exec(previewContent);

            if (headMatch) {
                const insertAt = headMatch.index + headMatch[0].length;
                return previewContent.slice(0, insertAt) + editTools + previewContent.slice(insertAt);
            }
            return editTools + previewContent;
        }

        function buildWidgetEditablePreview(content) {
            return buildWidgetImageEditableContent(content, 'editor');
        }

        function buildWidgetDesktopContent(content) {
            return buildWidgetImageEditableContent(content, 'desktop');
        }

        function replaceWidgetTagImage(tagText, target, imageUrl) {
            const attribute = target.attribute || (target.kind === 'image' ? 'href' : 'src');
            const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const attributePattern = new RegExp('(\\s' + escapedAttribute + '\\s*=\\s*)(?:"[^"]*"|\'[^\']*\'|[^\\s>]+)', 'i');
            let updatedTag = tagText;

            if (attributePattern.test(tagText)) {
                updatedTag = tagText.replace(attributePattern, function (match, prefix) {
                    return prefix + '"' + imageUrl + '"';
                });
            } else {
                let insertAt = tagText.lastIndexOf('>');
                let beforeEnd = insertAt - 1;
                while (beforeEnd > 0 && /\s/.test(tagText[beforeEnd])) beforeEnd--;
                if (tagText[beforeEnd] === '/') insertAt = beforeEnd;
                updatedTag = tagText.slice(0, insertAt) + ' ' + attribute + '="' + imageUrl + '"' + tagText.slice(insertAt);
            }

            if (target.kind === 'img' && attribute === 'src') {
                const srcsetPattern = /(\ssrcset\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s>]+)/i;
                updatedTag = updatedTag.replace(srcsetPattern, function (match, prefix) {
                    return prefix + '"' + imageUrl + '"';
                });
            }
            return updatedTag;
        }

        function replaceWidgetImageContent(content, target, imageUrl) {
            const source = String(content == null ? '' : content);
            if (target && target.kind === 'uploadable') {
                const matchingTags = scanWidgetImageTags(source).filter(function (tag) {
                    return tag.name === 'uploadable';
                });
                const tag = matchingTags[target.index];
                if (tag) {
                    const tagText = source.slice(tag.start, tag.end + 1);
                    const replacement = replaceWidgetUploadableTag(tagText, imageUrl);
                    return source.slice(0, tag.start) + replacement + source.slice(tag.end + 1);
                }
            }

            if (target && (target.kind === 'img' || target.kind === 'image') && !target.dynamic) {
                const matchingTags = scanWidgetImageTags(source).filter(function (tag) {
                    return tag.name === target.kind;
                });
                const tag = matchingTags[target.index];
                if (tag) {
                    const tagText = source.slice(tag.start, tag.end + 1);
                    const replacement = replaceWidgetTagImage(tagText, target, imageUrl);
                    return source.slice(0, tag.start) + replacement + source.slice(tag.end + 1);
                }
            }

            if (target && target.source && source.indexOf(target.source) !== -1) {
                return source.replace(target.source, imageUrl);
            }
            return null;
        }

        function replaceWidgetUploadableTag(tagText, imageUrl) {
            const safeUrl = String(imageUrl == null ? '' : imageUrl)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            const backgroundDeclaration = 'background-image: url(' + safeUrl + ')';
            const stylePattern = /(\sstyle\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
            const styleMatch = stylePattern.exec(tagText);

            if (styleMatch) {
                const quote = styleMatch[2] !== undefined ? '"' : styleMatch[3] !== undefined ? "'" : '';
                const currentStyle = styleMatch[2] !== undefined
                    ? styleMatch[2]
                    : styleMatch[3] !== undefined
                        ? styleMatch[3]
                        : styleMatch[4];
                const nextStyle = /background-image\s*:/i.test(currentStyle)
                    ? currentStyle.replace(/background-image\s*:\s*[^;]*(;?)/i, backgroundDeclaration + '$1')
                    : currentStyle.replace(/\s*$/, '') + (currentStyle.trim() ? '; ' : '') + backgroundDeclaration;
                const encodedStyle = quote === '"'
                    ? nextStyle.replace(/"/g, '&quot;')
                    : quote === "'"
                        ? nextStyle.replace(/'/g, '&#39;')
                        : nextStyle;
                return tagText.replace(stylePattern, function (match, prefix) {
                    return prefix + (quote ? quote + encodedStyle + quote : encodedStyle);
                });
            }

            let insertAt = tagText.lastIndexOf('>');
            let beforeEnd = insertAt - 1;
            while (beforeEnd > 0 && /\s/.test(tagText[beforeEnd])) beforeEnd--;
            if (tagText[beforeEnd] === '/') insertAt = beforeEnd;
            return tagText.slice(0, insertAt) + ' style="' + backgroundDeclaration + '"' + tagText.slice(insertAt);
        }

        function findWidgetElementContentRange(source, tag) {
            const tagName = tag && tag.tagName;
            if (!tagName) return null;

            const openingTag = source.slice(tag.start, tag.end + 1);
            if (/\/\s*>$/.test(openingTag)) return null;

            let depth = 1;
            let cursor = tag.end + 1;
            const lowerSource = source.toLowerCase();
            while (cursor < source.length) {
                const nextTagStart = source.indexOf('<', cursor);
                if (nextTagStart === -1) return null;

                if (lowerSource.slice(nextTagStart, nextTagStart + 4) === '<!--') {
                    const commentEnd = lowerSource.indexOf('-->', nextTagStart + 4);
                    cursor = commentEnd === -1 ? source.length : commentEnd + 3;
                    continue;
                }

                const nextTagEnd = findWidgetTagEnd(source, nextTagStart + 1);
                if (nextTagEnd === -1) return null;
                const nextTagText = source.slice(nextTagStart, nextTagEnd + 1);
                const nameMatch = /^<\s*(\/?)\s*([A-Za-z0-9:-]+)/.exec(nextTagText);
                if (nameMatch && nameMatch[2].toLowerCase() === tagName.toLowerCase()) {
                    if (nameMatch[1]) {
                        depth--;
                        if (depth === 0) {
                            return { start: tag.end + 1, end: nextTagStart };
                        }
                    } else if (!/\/\s*>$/.test(nextTagText)) {
                        depth++;
                    }
                }

                cursor = nextTagEnd + 1;
            }
            return null;
        }

        function replaceWidgetEditableContent(content, target, html) {
            const source = String(content == null ? '' : content);
            if (!target || target.kind !== 'contenteditable' || !Number.isInteger(target.index) || target.index < 0) return null;

            const editableTags = scanWidgetImageTags(source).filter(function (tag) {
                return tag.name === 'contenteditable';
            });
            const tag = editableTags[target.index];
            const range = tag && findWidgetElementContentRange(source, tag);
            if (!range) return null;

            return source.slice(0, range.start) + String(html == null ? '' : html) + source.slice(range.end);
        }

        function readWidgetImageFile(file) {
            return new Promise(function (resolve, reject) {
                const reader = new FileReader();
                reader.onload = function () { resolve(reader.result); };
                reader.onerror = function () { reject(reader.error || new Error('Image read failed')); };
                reader.readAsDataURL(file);
            });
        }

        async function prepareWidgetImageData(file) {
            const originalData = await readWidgetImageFile(file);
            if (file.type === 'image/gif' || file.type === 'image/svg+xml') return originalData;
            if (typeof window.compressImageBase64 !== 'function') return originalData;

            return new Promise(function (resolve) {
                window.compressImageBase64(originalData, 1600, 0.88, function (compressedData) {
                    resolve(compressedData && compressedData.length < originalData.length ? compressedData : originalData);
                });
            });
        }

        window.addEventListener('message', async function (event) {
            const frame = document.getElementById('widgetCodePreviewFrame');
            const editorModal = document.getElementById('widgetEditorModal');
            const message = event.data;
            if (!frame || event.source !== frame.contentWindow || !editorModal || !editorModal.classList.contains('show')) return;
            if (!message) return;

            if (message.type === 'widget-image-editor-content') {
                if (typeof message.html !== 'string' || !message.target || typeof window.replaceWidgetEditableContent !== 'function') return;
                const editor = document.getElementById('widgetEditContent');
                const updatedContent = window.replaceWidgetEditableContent(editor.value, message.target, message.html);
                if (updatedContent != null) editor.value = updatedContent;
                return;
            }

            if (message.type !== 'widget-image-editor-file' || !(message.file instanceof Blob)) return;

            try {
                const imageData = await prepareWidgetImageData(message.file);
                const editor = document.getElementById('widgetEditContent');
                const updatedContent = replaceWidgetImageContent(editor.value, message.target, imageData);
                if (updatedContent == null) {
                    if (typeof window.showToast === 'function') window.showToast('\u672a\u80fd\u5b9a\u4f4d\u8fd9\u5f20\u56fe\u7247');
                    return;
                }
                editor.value = updatedContent;
                updateWidgetCodePreview();
                if (typeof window.showToast === 'function') window.showToast('\u56fe\u7247\u5df2\u66ff\u6362');
            } catch (error) {
                if (typeof window.showToast === 'function') window.showToast('\u56fe\u7247\u8bfb\u53d6\u5931\u8d25');
            }
        });

            // show three-dots button; click to expand vertical capsule menu
        window.renderWidgetViews = renderWidgetViews;

        function hideWidgetChrome() {
            const wg = document.getElementById('widgetAppGrid'); if (wg) wg.style.display = 'none';
            const vb = document.getElementById('widgetViewBtn'); if (vb) vb.style.display = 'none';
            const wgc = document.getElementById('widgetToolbarMenu'); if (wgc) wgc.style.display = 'none';
            const dots = document.getElementById('menuIconDots'); if (dots) dots.style.display = 'none';
            const list = document.getElementById('menuIconList'); if (list) list.style.display = 'block';
            exitWidgetEditMode(true);
        }
        window.hideWidgetChrome = hideWidgetChrome;

        function closeWidgetMenus() {
            const dd = document.getElementById('themeDropdownMenu'); if (dd) dd.classList.remove('show');
            const tbm = document.getElementById('widgetToolbarMenu'); if (tbm) tbm.classList.remove('show');
            const cm = document.getElementById('widgetContextMenu'); if (cm) cm.classList.remove('show');
            const dots = document.getElementById('menuIconDots'); if (dots) dots.style.display = 'block';
            const chev = document.getElementById('menuIconChevron'); if (chev) chev.style.display = 'none';
            const overlay = document.getElementById('widgetOverlay');
            const editor = document.getElementById('widgetEditorModal');
            if (editor && editor.classList.contains('show')) {
                if (overlay) overlay.style.zIndex = '250';
            } else if (overlay) {
                overlay.style.display = 'none';
                overlay.style.zIndex = '105';
            }
        }
        window.closeWidgetMenus = closeWidgetMenus;

            // show three-dots button; click to expand vertical capsule menu
        const originalToggleThemeMenu = window.toggleThemeMenu;
        window.toggleThemeMenu = function () {
            if (currentActiveTab === "widget") {
                const m = document.getElementById("widgetToolbarMenu");
                const ov = document.getElementById("widgetOverlay");
                if (!m.classList.contains("show")) {
                    m.classList.add("show");
                    if (ov) { ov.style.display = "block"; ov.style.zIndex = "240"; }
                    const d = document.getElementById("menuIconDots"); if (d) d.style.display = "none";
                    const c = document.getElementById("menuIconChevron"); if (c) c.style.display = "block";
                } else {
                    closeWidgetMenus();
                }
                return;
            } else if (typeof originalToggleThemeMenu === "function") { originalToggleThemeMenu(); }
        };

        function openWidgetContextMenu(index, event) {
            event.stopPropagation(); activeWidgetIndex = index;
            const menu = document.getElementById('widgetContextMenu');
            const overlay = document.getElementById('widgetOverlay');
            const rect = event.currentTarget.getBoundingClientRect();
            const hostRect = (themeAppUI || document.body).getBoundingClientRect();
            let top = rect.bottom - hostRect.top + 10;
            let left = rect.right - hostRect.left - 140;
            if (top + 200 > hostRect.height) top = rect.top - hostRect.top - 190;
            if (left < 16) left = 16;
            menu.style.top = top + 'px'; menu.style.left = left + 'px';
            menu.classList.add('show');
            overlay.style.display = 'block'; overlay.style.zIndex = '350';
        }
        window.openWidgetContextMenu = openWidgetContextMenu;

        function widgetCtxAction(action) {
            closeWidgetMenus();
            if (activeWidgetIndex === -1) return;

            if (action === 'edit') { openWidgetEditor(activeWidgetIndex); }
            else if (action === 'addToDesktop') {
                const widget = currentWidgets[activeWidgetIndex];
                const added = addDesktopWidget(widget);
                if (added && typeof window.showToast === 'function') window.showToast('已添加到桌面');
            }
            else if (action === 'export') {
                const widget = currentWidgets[activeWidgetIndex];
                const fileName = (widget.name || 'widget') + '.json';
                const dataStr = JSON.stringify(widget, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                if (typeof showToast === 'function') showToast("导出成功");
            }
        }
        window.widgetCtxAction = widgetCtxAction;

        function toggleWidgetViewMode(forceMode) {
            widgetViewMode = forceMode ? forceMode : (widgetViewMode === 'carousel' ? 'list' : 'carousel');
            const iL = document.getElementById('widgetIconList');
            const iC = document.getElementById('widgetIconCard');
            if (iL) iL.style.display = widgetViewMode === 'carousel' ? 'block' : 'none';
            if (iC) iC.style.display = widgetViewMode === 'list' ? 'block' : 'none';
            if (widgetViewMode === 'list') widgetContentArea.classList.add('show-list');
            else { widgetContentArea.classList.remove('show-list'); updateWidgetCardsContinuous(); }
        }
        window.toggleWidgetViewMode = toggleWidgetViewMode;

        function enterWidgetEditMode() {
            closeWidgetMenus(); isWidgetEditing = true;
            if (themeAppUI) themeAppUI.classList.add('is-widget-editing');
            toggleWidgetViewMode('list');
            document.getElementById('topBarTitle').innerText = '管理组件';
            const wgc1 = document.getElementById('widgetToolbarMenu'); if (wgc1) { wgc1.style.display = 'none'; wgc1.classList.remove('show'); }
            const doneBtn = document.getElementById('widgetDoneBtn'); if (doneBtn) doneBtn.style.display = 'block';
            const viewBtn = document.getElementById('widgetViewBtn'); if (viewBtn) viewBtn.style.display = 'none';
            const menuBtn = document.getElementById('themeMenuBtn'); if (menuBtn) menuBtn.style.display = 'none';
        }
        window.enterWidgetEditMode = enterWidgetEditMode;

        function exitWidgetEditMode(silent) {
            isWidgetEditing = false;
            if (themeAppUI) themeAppUI.classList.remove('is-widget-editing');
            if (!silent && currentActiveTab === 'widget') {
                document.getElementById('topBarTitle').innerText = 'Widgets';
                const wgc2 = document.getElementById('widgetToolbarMenu'); if (wgc2) { wgc2.style.display = 'flex'; wgc2.classList.remove('show'); }
                const doneBtn = document.getElementById('widgetDoneBtn'); if (doneBtn) doneBtn.style.display = 'none';
                const viewBtn = document.getElementById('widgetViewBtn'); if (viewBtn) viewBtn.style.display = 'flex';
                const menuBtn = document.getElementById('themeMenuBtn'); if (menuBtn) menuBtn.style.display = 'flex';
            }
        }
        window.exitWidgetEditMode = exitWidgetEditMode;

        function deleteWidget(index, event) {
            event.stopPropagation();
            if (confirm('确定要删除 "' + currentWidgets[index].name + '" 吗？')) {
                currentWidgets.splice(index, 1);
                if (activeWidgetIndex >= currentWidgets.length) activeWidgetIndex = currentWidgets.length - 1;
                renderWidgetViews();
                if (typeof window.saveCustomWidgetsData === 'function') window.saveCustomWidgetsData();
            }
        }
        window.deleteWidget = deleteWidget;


        // import widgets from a .json file (single object or array). Fields: name, preview, content.
        function handleWidgetJsonImport(event) {
            closeWidgetMenus();
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    let parsed = JSON.parse(ev.target.result);
                    if (!Array.isArray(parsed)) parsed = [parsed];
                    let added = 0;
                    parsed.forEach(function (w) {
                        if (!w || typeof w !== 'object') return;
                        customWidgets.push({
                            name: w.name || ('widget ' + (customWidgets.length + 1)),
                            preview: w.preview || 'linear-gradient(135deg,#a1c4fd 0%,#c2e9fb 100%)',
                            content: w.content || w.html || '',
                            width: w.width || '',
                            height: w.height || '',
                            presetSize: w.presetSize || ''
                        });
                        added++;
                    });
                    // switch to custom tab so the user sees imports immediately
                    if (typeof switchWidgetTab === 'function') switchWidgetTab(1);
                    else { currentWidgets = customWidgets; renderWidgetViews(); }
                    if (typeof window.saveCustomWidgetsData === 'function') window.saveCustomWidgetsData();
                    alert('imported ' + added + ' widget(s)');
                } catch (err) { alert('JSON parse failed: ' + err.message); }
            };
            reader.readAsText(file);
            event.target.value = '';
        }
        window.handleWidgetJsonImport = handleWidgetJsonImport;

        // export all widgets (official + custom) as a .json download
        function exportWidgetJson() {
            closeWidgetMenus();
            const all = officialWidgets.concat(customWidgets).map(function (w) {
                return { name: w.name || '', preview: w.preview || '', content: w.content || '', width: w.width || '', height: w.height || '', presetSize: w.presetSize || '' };
            });
            const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'widgets.json';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        window.exportWidgetJson = exportWidgetJson;

        function updateWidgetCodePreview() {
            const preview = document.getElementById('widgetCodePreview');
            const stage = document.getElementById('widgetCodePreviewStage');
            const frame = document.getElementById('widgetCodePreviewFrame');
            const sizeLabel = document.getElementById('widgetCodePreviewSize');
            const editor = document.getElementById('widgetEditContent');
            if (!preview || !stage || !frame || !sizeLabel || !editor) return;

            const checkedPreset = document.querySelector('input[name="widgetPresetSize"]:checked');
            let cols = 1;
            let rows = 1;
            if (checkedPreset) {
                const parts = checkedPreset.value.split('x').map(Number);
                cols = parts[0] || 1;
                rows = parts[1] || 1;
            } else if (document.getElementById('widgetCustomSizeLabel').innerText !== '自定义大小') {
                cols = parseInt(document.getElementById('customW').innerText, 10) || 1;
                rows = parseInt(document.getElementById('customH').innerText, 10) || 1;
            }

            const width = cols * 140;
            const height = rows * 140;
            preview.style.display = 'block';
            const availableWidth = stage.clientWidth || 280;
            const scale = Math.min(1, availableWidth / width);
            stage.style.height = Math.round(height * scale) + 'px';
            frame.style.width = width + 'px';
            frame.style.height = height + 'px';
            frame.style.transform = 'scale(' + scale + ')';
            frame.onload = function () {
                if (typeof window.syncGlobalFontToWidgetFrame === 'function') {
                    window.syncGlobalFontToWidgetFrame(frame);
                }
            };
            frame.srcdoc = window.buildWidgetFrameSrcdoc
                ? window.buildWidgetFrameSrcdoc(buildWidgetEditablePreview(editor.value))
                : buildWidgetEditablePreview(editor.value);
            sizeLabel.innerText = cols + ' × ' + rows;
        }
        window.updateWidgetCodePreview = updateWidgetCodePreview;

        function openWidgetEditor(index) {
            activeWidgetIndex = index; const widget = currentWidgets[index];
            document.getElementById('widgetEditName').value = widget.name;
            document.getElementById('widgetEditContent').value = widget.content || '';
            if (widget.width && widget.height) {
                const cw = Math.round(widget.width / 140) || 1;
                const ch = Math.round(widget.height / 140) || 1;
                document.getElementById('customW').innerText = cw;
                document.getElementById('customH').innerText = ch;
                document.getElementById('widgetCustomSizeLabel').innerText = cw + ' × ' + ch;
                document.getElementById('widgetCustomSizeLabel').style.color = '#000';
            } else {
                document.getElementById('customW').innerText = '1';
                document.getElementById('customH').innerText = '1';
                document.getElementById('widgetCustomSizeLabel').innerText = '自定义大小';
                document.getElementById('widgetCustomSizeLabel').style.color = '#8e8e93';
            }
            const radios = document.querySelectorAll('input[name="widgetPresetSize"]');
            radios.forEach(r => { r.checked = (widget.presetSize && r.value === widget.presetSize); });
            document.getElementById('widgetEditorModal').classList.add('show');
            const overlay = document.getElementById('widgetOverlay');
            overlay.style.display = 'block'; overlay.style.zIndex = '250';
            requestAnimationFrame(updateWidgetCodePreview);
        }
        window.openWidgetEditor = openWidgetEditor;

        function closeWidgetEditor() {
            const modal = document.getElementById('widgetEditorModal');
            const focusedElement = document.activeElement;
            if (focusedElement && modal.contains(focusedElement) && typeof focusedElement.blur === 'function') {
                focusedElement.blur();
            }
            modal.classList.remove('show');
            const overlay = document.getElementById('widgetOverlay');
            overlay.style.display = 'none'; overlay.style.zIndex = '105';
            const preview = document.getElementById('widgetCodePreview');
            const frame = document.getElementById('widgetCodePreviewFrame');
            if (preview) preview.style.display = 'none';
            if (frame) frame.srcdoc = '';
            activeWidgetIndex = -1;
            requestAnimationFrame(function () {
                if (typeof window.refreshAppViewport === 'function') {
                    window.refreshAppViewport();
                } else {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                }
            });
        }

        window.buildWidgetDesktopContent = buildWidgetDesktopContent;
        window.replaceWidgetImageContent = replaceWidgetImageContent;
        window.replaceWidgetEditableContent = replaceWidgetEditableContent;
        window.prepareWidgetImageData = prepareWidgetImageData;
        if (typeof window.refreshDesktopWidgetFrames === 'function') {
            window.refreshDesktopWidgetFrames();
        }
        window.closeWidgetEditor = closeWidgetEditor;

        (function() {
            const topBar = document.querySelector('#widgetEditorModal .ios-top-bar');
            const modal = document.getElementById('widgetEditorModal');
            let startY = 0;
            let currentY = 0;
            if (topBar && modal) {
                topBar.addEventListener('touchstart', (e) => {
                    if (e.target.closest('.widget-editor-action')) {
                        startY = 0;
                        currentY = 0;
                        return;
                    }
                    startY = e.touches[0].clientY;
                    currentY = startY;
                    modal.style.transition = 'none';
                }, { passive: true });
                topBar.addEventListener('touchmove', (e) => {
                    if (!startY) return;
                    currentY = e.touches[0].clientY;
                    const delta = currentY - startY;
                    if (delta > 0) {
                        modal.style.transform = `translateY(${delta}px)`;
                    }
                }, { passive: true });
                topBar.addEventListener('touchend', () => {
                    if (!startY) return;
                    const delta = currentY - startY;
                    startY = 0;
                    currentY = 0;
                    modal.style.transition = '';
                    modal.style.transform = '';
                    if (delta > 80) {
                        closeWidgetEditor();
                    }
                });
            }
        })();

        function saveWidgetEditor() {
            if (activeWidgetIndex > -1) {
                const widget = currentWidgets[activeWidgetIndex];
                widget.name = document.getElementById('widgetEditName').value.trim() || '未命名组件';
                widget.content = document.getElementById('widgetEditContent').value;
                const lbl = document.getElementById('widgetCustomSizeLabel').innerText;
                const widthVal = lbl !== '自定义大小' ? parseInt(document.getElementById('customW').innerText, 10) * 140 : null;
                const heightVal = lbl !== '自定义大小' ? parseInt(document.getElementById('customH').innerText, 10) * 140 : null;
                const checkedPreset = document.querySelector('input[name="widgetPresetSize"]:checked');
                if (widthVal && heightVal) {
                    widget.width = widthVal;
                    widget.height = heightVal;
                    widget.presetSize = '';
                } else if (checkedPreset) {
                    widget.width = '';
                    widget.height = '';
                    widget.presetSize = checkedPreset.value;
                } else {
                    widget.width = '';
                    widget.height = '';
                    widget.presetSize = '';
                }
                renderWidgetViews();
                if (typeof window.saveCustomWidgetsData === 'function') window.saveCustomWidgetsData();
            }
            closeWidgetEditor();
        }
        window.saveWidgetEditor = saveWidgetEditor;

        function switchWidgetTab(index, progressIndex) {
            if (isWidgetEditing) return;
            widgetSegmentBtns.forEach((btn, i) => btn.classList.toggle('active', i === index));
            if (widgetIndicator) widgetIndicator.style.transform = 'translateX(' + (index * 100) + '%)';
            currentWidgets = index === 0 ? officialWidgets : customWidgets;
            const nextProgress = Number.isInteger(progressIndex) ? progressIndex : 0;
            currentProgress = nextProgress; targetProgress = nextProgress;
            renderWidgetViews();
        }
        window.switchWidgetTab = switchWidgetTab;

        function handleAddWidget() {
            closeWidgetMenus();
            customWidgets.push({
                name: '自定义组件 ' + (customWidgets.length + 1),
                content: '',
                width: '',
                height: '',
                presetSize: ''
            });
            const newWidgetIndex = customWidgets.length - 1;
            switchWidgetTab(1, newWidgetIndex);
            if (typeof window.saveCustomWidgetsData === 'function') window.saveCustomWidgetsData();
            openWidgetEditor(newWidgetIndex);
        }
        window.handleAddWidget = handleAddWidget;

        function bindWidgetTouchAction(selector, action) {
            const element = document.querySelector(selector);
            if (!element) return;

            let trackingTouch = false;
            let touchMoved = false;
            let startX = 0;
            let startY = 0;
            let lastTouchActivation = 0;

            element.addEventListener('touchstart', function (event) {
                if (event.touches.length !== 1) {
                    trackingTouch = false;
                    return;
                }
                const touch = event.touches[0];
                trackingTouch = true;
                touchMoved = false;
                startX = touch.clientX;
                startY = touch.clientY;
            }, { passive: true });

            element.addEventListener('touchmove', function (event) {
                if (!trackingTouch || event.touches.length !== 1) return;
                const touch = event.touches[0];
                if (Math.abs(touch.clientX - startX) > 12 || Math.abs(touch.clientY - startY) > 12) {
                    touchMoved = true;
                }
            }, { passive: true });

            element.addEventListener('touchcancel', function () {
                trackingTouch = false;
                touchMoved = false;
            }, { passive: true });

            element.addEventListener('touchend', function (event) {
                const shouldActivate = trackingTouch && !touchMoved;
                trackingTouch = false;
                touchMoved = false;
                if (!shouldActivate) return;

                if (event.cancelable) event.preventDefault();
                event.stopPropagation();
                lastTouchActivation = Date.now();
                action();
            }, { passive: false });

            element.addEventListener('click', function (event) {
                if (Date.now() - lastTouchActivation < 700) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }, true);
        }

        bindWidgetTouchAction('.widget-add-action', handleAddWidget);
        bindWidgetTouchAction('.widget-editor-action:not(.widget-editor-save)', closeWidgetEditor);
        bindWidgetTouchAction('.widget-editor-save', saveWidgetEditor);
        function renderWidgetViews() {
            widgetTrack.innerHTML = ''; widgetPagination.innerHTML = ''; widgetListContainer.innerHTML = '';
            if (currentWidgets.length === 0) {
                widgetEmptyState.style.display = 'block';
                widgetContentArea.style.display = 'none';
                return;
            }
            widgetEmptyState.style.display = 'none';
            widgetContentArea.style.display = 'flex';

            currentWidgets.forEach((widget, i) => {
                const card = document.createElement('div'); card.className = 'widget-card';
                card.innerHTML = '<div class="widget-card-more-btn" onclick="openWidgetContextMenu(' + i + ', event)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg></div><div class="widget-card-preview">' + makeWidgetFrameHTML(widget.content) + '</div><div class="widget-card-name">' + widget.name + '</div><div class="widget-card-size">' + formatWidgetSizeLabel(widget) + '</div>';
                widgetTrack.appendChild(card);

                const dot = document.createElement('div'); dot.className = 'widget-dot'; widgetPagination.appendChild(dot);

                const listItem = document.createElement('div'); listItem.className = 'widget-list-item';
                listItem.onclick = function () {
                    if (isWidgetEditing) openWidgetEditor(i);
                    else { targetProgress = i; currentProgress = i; toggleWidgetViewMode('carousel'); }
                };
                listItem.innerHTML = '<div class="widget-delete-btn-left" onclick="deleteWidget(' + i + ', event)"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg></div><div class="widget-list-item-icon"></div><div class="widget-list-item-info"><div class="widget-title-wrapper"><div class="widget-list-item-title">' + widget.name + '</div><svg class="widget-edit-pencil" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></div><div class="widget-list-item-sub">Widget</div></div><div class="widget-list-action-trigger" onclick="openWidgetContextMenu(' + i + ', event)"><svg width="20" height="20" viewBox="0 0 24 24" fill="#c7c7cc" stroke="none"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg></div>';
                const listPreviewHost = listItem.querySelector('.widget-list-item-icon');
                const listPreviewFrame = document.createElement('iframe');
                const listPreviewDims = getWidgetDimensions(widget);
                const listPreviewScale = Math.min(48 / listPreviewDims.width, 48 / listPreviewDims.height);
                listPreviewFrame.className = 'widget-list-preview-frame';
                listPreviewFrame.setAttribute('sandbox', 'allow-scripts');
                listPreviewFrame.setAttribute('title', (widget.name || '组件') + '预览');
                listPreviewFrame.style.width = listPreviewDims.width + 'px';
                listPreviewFrame.style.height = listPreviewDims.height + 'px';
                listPreviewFrame.style.left = (48 - listPreviewDims.width * listPreviewScale) / 2 + 'px';
                listPreviewFrame.style.top = (48 - listPreviewDims.height * listPreviewScale) / 2 + 'px';
                listPreviewFrame.style.transform = 'scale(' + listPreviewScale + ')';
                listPreviewFrame.addEventListener('load', function () {
                    if (typeof window.syncGlobalFontToWidgetFrame === 'function') {
                        window.syncGlobalFontToWidgetFrame(listPreviewFrame);
                    }
                });
                listPreviewFrame.srcdoc = window.buildWidgetFrameSrcdoc
                    ? window.buildWidgetFrameSrcdoc(widget.content || '')
                    : widget.content || '';
                listPreviewHost.appendChild(listPreviewFrame);
                widgetListContainer.appendChild(listItem);
            });
            updateWidgetCardsContinuous();
        }


        function updateWidgetCardsContinuous() {
            if (currentWidgets.length === 0 || widgetViewMode === 'list') return;
            const cards = document.querySelectorAll('#widgetAppGrid .widget-card');
            const dots = document.querySelectorAll('#widgetPagination .widget-dot');
            cards.forEach((card, i) => {
                const rel = i - currentProgress; const absRel = Math.abs(rel);
                const translateX = rel * 110; const rotateY = -rel * 45; const translateZ = -absRel * 100;
                const scale = Math.max(0.8, 1 - absRel * 0.1); const opacity = Math.max(0, 1 - absRel * 0.6);
                card.style.transform = 'translateX(' + translateX + '%) translateZ(' + translateZ + 'px) rotateY(' + rotateY + 'deg) scale(' + scale + ')';
                card.style.opacity = opacity; card.style.zIndex = 100 - Math.round(absRel * 100);
            });
            dots.forEach((dot, i) => {
                dot.style.opacity = Math.max(0.3, 1 - Math.abs(i - currentProgress));
                dot.classList.toggle('active', Math.round(currentProgress) === i);
            });
        }

            // show three-dots button; click to expand vertical capsule menu
        const wCarouselArea = document.getElementById('widgetCarousel');
        if (wCarouselArea) {
            wCarouselArea.addEventListener('touchstart', function (e) {
                if (currentWidgets.length <= 1 || widgetViewMode === 'list') return;
                isDragging = true; startX = e.touches[0].clientX; startProgress = currentProgress;
            }, { passive: true });
            wCarouselArea.addEventListener('touchmove', function (e) {
                if (!isDragging || widgetViewMode === 'list') return;
                e.preventDefault();
                let newProgress = startProgress - ((e.touches[0].clientX - startX) / window.innerWidth) * 1.8;
                if (newProgress < 0) newProgress *= 0.3;
                else if (newProgress > currentWidgets.length - 1) newProgress = (currentWidgets.length - 1) + (newProgress - (currentWidgets.length - 1)) * 0.3;
                currentProgress = newProgress; updateWidgetCardsContinuous();
            }, { passive: false });
            wCarouselArea.addEventListener('touchend', function () {
                if (!isDragging || widgetViewMode === 'list') return;
                isDragging = false; targetProgress = Math.round(currentProgress);
                if (targetProgress < 0) targetProgress = 0;
                if (targetProgress > currentWidgets.length - 1) targetProgress = currentWidgets.length - 1;
            });
        }

            // show three-dots button; click to expand vertical capsule menu
        function animateWidget() {
            if (!isDragging && widgetViewMode === 'carousel') {
                currentProgress += (targetProgress - currentProgress) * 0.15;
                if (Math.abs(targetProgress - currentProgress) < 0.001) currentProgress = targetProgress;
                updateWidgetCardsContinuous();
            }
            requestAnimationFrame(animateWidget);
        }
        animateWidget();
    })();
            // show three-dots button; click to expand vertical capsule menu
