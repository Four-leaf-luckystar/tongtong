

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
