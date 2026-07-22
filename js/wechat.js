    // 微信 APP 逻辑 (已进行命名空间隔离)
    // ==========================================
    
    function getWcDefaultAvatarSvg() {
        const uid = Math.random().toString(36).substring(2, 9);
        return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; border-radius: 50%; display: block;">
            <defs>
                <clipPath id="wcClip_${uid}"><circle cx="50" cy="50" r="44"/></clipPath>
                <linearGradient id="wcBg_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#A3A8B0" />
                    <stop offset="100%" stop-color="#7A7F88" />
                </linearGradient>
                <linearGradient id="wcFig_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FFFFFF" />
                    <stop offset="100%" stop-color="#E5E5EA" />
                </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="50" fill="url(#wcBg_${uid})"/>
            <circle cx="50" cy="36" r="16" fill="url(#wcFig_${uid})"/>
            <path d="M 50 59 C 20 59 10 82 8 106 L 92 106 C 90 82 80 59 50 59 Z" fill="url(#wcFig_${uid})" clip-path="url(#wcClip_${uid})"/>
        </svg>`;
    }

    // 数据库操作：获取微信账号认证数据
    async function wcGetAuthData() {
        const data = await wcReadLayoutRecord('wechatAuthData');
        return data || { id: 'wechatAuthData', accounts: [], currentLoginWxid: null };
    }

    // 数据库操作：保存微信账号认证数据
    function wcSaveAuthData(data) {
        if (!db || typeof storeName === 'undefined') return Promise.reject(new Error('数据库尚未准备好'));
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            // 必须将 id 包含在对象内部，不能作为 put 的第二个参数
            data.id = 'wechatAuthData';
            transaction.objectStore(storeName).put(data);
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async function openWechatApp() {
        const wechatUI = document.getElementById('wechatAppUI');
        if (wechatUI) {
            wechatUI.style.display = 'flex';
            setTimeout(() => { wechatUI.classList.add('show'); }, 10);
            
            // 检查登录状态
            try {
                const authData = await wcGetAuthData();
                if (authData.currentLoginWxid) {
                    const currentUser = authData.accounts.find(a => a.wxid === authData.currentLoginWxid);
                    if (currentUser) {
                        // 恢复全局变量
                        if (typeof appSettings !== 'undefined') {
                            appSettings.wc_current_user_id = currentUser.maskId;
                            appSettings.wc_current_user_name = currentUser.name;
                            appSettings.wc_current_user_avatar = currentUser.avatar;
                            appSettings.wc_current_user_phone = currentUser.wxid; // 用 wxid 替代 phone 展示
                        }

                        // 同步角色库头像和名称
                        try {
                            await wcReloadContactsFromStorage();
                            const contactRecord = await wcReadLayoutRecord('contactsAppData');
                            const contacts = Array.isArray(contactRecord?.data?.contacts) ? contactRecord.data.contacts : [];
                            let updated = false;
                            wcContactsList.forEach(wcContact => {
                                if (wcContact.linkedContactId) {
                                    const sourceContact = contacts.find(c => c.id === wcContact.linkedContactId);
                                    if (sourceContact) {
                                        if (wcContact.avatar !== sourceContact.avatar || wcContact.name !== sourceContact.name) {
                                            wcContact.avatar = sourceContact.avatar || '';
                                            wcContact.name = sourceContact.name || '未命名角色';
                                            updated = true;
                                        }
                                    }
                                }
                            });
                            if (updated) {
                                await wcSaveContactsDataAsync();
                            }
                        } catch (syncErr) {
                            console.error('同步角色库头像失败', syncErr);
                        }

                        wcSwitchTab('chat');
                        const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
                        if (bottomNav) bottomNav.style.display = 'block';
                        return;
                    }
                }
            } catch (e) {
                console.error('读取微信登录状态失败', e);
            }
            
            // 未登录，显示登录页
            wcSwitchAuthPage('page-wc-login');
            const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
            if (bottomNav) bottomNav.style.display = 'none';
        }
    }

    function wcSwitchAuthPage(pageId) {
        document.querySelectorAll('#wechatAppUI .page').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    }

    function wcTogglePasswordVisibility(iconContainer) {
        const input = iconContainer.previousElementSibling;
        const svg = iconContainer.querySelector('svg');
        if (input.type === 'password') {
            input.type = 'text';
            // 闭眼图标 (隐藏密码)
            svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
            input.type = 'password';
            // 睁眼图标 (显示密码)
            svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
    }

    let wcSelectedUserMaskId = null;
    let wcSelectedUserMaskAvatar = '';
    let wcSelectedUserMaskName = '';

    async function wcOpenUserMaskSelect() {
        try {
            const contactRecord = await wcReadLayoutRecord('contactsAppData');
            const users = Array.isArray(contactRecord?.data?.users) ? contactRecord.data.users : [];
            
            if (users.length === 0) {
                showToast('联系人库中暂无 User 面具，请先在 Contacts 中添加');
                return;
            }

            const listContainer = document.getElementById('wcUserMaskDrawerList');
            if (!listContainer) return;
            
            let html = '';
            users.forEach(u => {
                const avatarStyle = u.avatar ? `background-image: url('${u.avatar}');` : '';
                const fallback = u.avatar ? '' : (u.name ? u.name.substring(0, 1) : 'U');
                // 转义单引号防止 HTML 属性断裂
                const safeName = (u.name || '未命名 User').replace(/'/g, "\\'");
                const safeAvatar = (u.avatar || '').replace(/'/g, "\\'");
                
                html += `
                    <div class="wc-user-drawer-item" onclick="wcSelectUserMask('${u.id}', '${safeName}', '${safeAvatar}')">
                        <div class="wc-user-drawer-avatar" style="${avatarStyle}">${fallback}</div>
                        <div class="wc-user-drawer-name">${u.name || '未命名 User'}</div>
                    </div>
                `;
            });
            
            listContainer.innerHTML = html;
            document.getElementById('wcUserMaskDrawerOverlay').classList.add('show');

        } catch (error) {
            console.error('读取 User 面具失败:', error);
            showToast('读取 User 面具失败');
        }
    }

    function wcCloseUserMaskDrawer() {
        const overlay = document.getElementById('wcUserMaskDrawerOverlay');
        if (overlay) overlay.classList.remove('show');
    }

    function wcSelectUserMask(id, name, avatar) {
        wcSelectedUserMaskId = id;
        wcSelectedUserMaskName = name;
        wcSelectedUserMaskAvatar = avatar;
        
        const previewEl = document.getElementById('wc-register-avatar-preview');
        if (previewEl) {
            if (wcSelectedUserMaskAvatar) {
                previewEl.style.backgroundImage = `url('${wcSelectedUserMaskAvatar}')`;
                previewEl.style.backgroundSize = 'cover';
                previewEl.style.backgroundPosition = 'center';
                previewEl.innerHTML = ''; // 清除里面的相机图标
            } else {
                previewEl.style.backgroundImage = 'none';
                previewEl.innerHTML = '<span style="font-size: 24px; font-weight: bold; color: #8E8E93;">' + wcSelectedUserMaskName.substring(0, 1) + '</span>';
            }
        }
        showToast(`已绑定面具：${wcSelectedUserMaskName}`);
        wcCloseUserMaskDrawer();
    }

    async function wcRegisterAccount() {
        const phone = document.getElementById('wc-reg-phone').value.trim();
        const pwd = document.getElementById('wc-reg-pwd').value;
        const pwdConfirm = document.getElementById('wc-reg-pwd-confirm').value;

        if (!wcSelectedUserMaskId) {
            showToast('请先绑定 User 面具');
            return;
        }
        if (!phone) {
            showToast('请输入手机号');
            return;
        }
        if (!pwd) {
            showToast('请输入密码');
            return;
        }
        if (pwd !== pwdConfirm) {
            showToast('两次输入的密码不一致');
            return;
        }

        try {
            const authData = await wcGetAuthData();
            if (authData.accounts.some(a => a.phone === phone)) {
                showToast('该手机号已注册');
                return;
            }

            // 生成随机微信号
            const randomStr = Math.random().toString(36).substring(2, 10);
            const wxid = 'wxid_' + randomStr;

            const newAccount = {
                wxid: wxid,
                phone: phone,
                password: pwd,
                maskId: wcSelectedUserMaskId,
                name: wcSelectedUserMaskName, // 默认使用面具名称
                avatar: wcSelectedUserMaskAvatar
            };

            authData.accounts.push(newAccount);
            authData.currentLoginWxid = wxid;
            await wcSaveAuthData(authData);

            // 更新全局设置
            if (typeof appSettings !== 'undefined') {
                appSettings.wc_current_user_id = newAccount.maskId;
                appSettings.wc_current_user_name = newAccount.name;
                appSettings.wc_current_user_avatar = newAccount.avatar;
                appSettings.wc_current_user_phone = newAccount.wxid; // 展示微信号
                if (typeof saveAppSettings === 'function') saveAppSettings();
            }

            // 初始化朋友圈资料
            if (typeof wcMomentsProfile !== 'undefined') {
                wcMomentsProfile.name = newAccount.name;
                wcMomentsProfile.avatar = newAccount.avatar;
                wcMomentsProfile.id = newAccount.wxid;
                if (typeof wcSaveMomentsProfileData === 'function') wcSaveMomentsProfileData();
            }

            showToast('注册成功！微信号：' + wxid);
            wcLoginSuccess();
        } catch (e) {
            console.error('注册失败', e);
            showToast('注册失败，请重试');
        }
    }

    async function wcPerformLogin() {
        // 兼容获取输入框的值
        const accountEl = document.querySelector('#page-wc-login input[placeholder="微信号 / 手机号"]') || document.querySelector('#page-wc-login input[placeholder="账号 / 手机号"]');
        const accountInput = accountEl ? accountEl.value.trim() : '';
        const pwdInput = document.querySelector('#page-wc-login input[placeholder="密码"]').value;

        if (!accountInput || !pwdInput) {
            showToast('请输入账号和密码');
            return;
        }

        try {
            const authData = await wcGetAuthData();
            // 核心逻辑：同时匹配 phone (手机号) 或 wxid (微信号)
            const user = authData.accounts.find(a => (a.phone === accountInput || a.wxid === accountInput) && a.password === pwdInput);

            if (user) {
                authData.currentLoginWxid = user.wxid;
                await wcSaveAuthData(authData);

                if (typeof appSettings !== 'undefined') {
                    appSettings.wc_current_user_id = user.maskId;
                    appSettings.wc_current_user_name = user.name;
                    appSettings.wc_current_user_avatar = user.avatar;
                    appSettings.wc_current_user_phone = user.wxid;
                    if (typeof saveAppSettings === 'function') saveAppSettings();
                }
                
                if (typeof wcMomentsProfile !== 'undefined') {
                    wcMomentsProfile.name = user.name;
                    wcMomentsProfile.avatar = user.avatar;
                    wcMomentsProfile.id = user.wxid;
                    if (typeof wcSaveMomentsProfileData === 'function') wcSaveMomentsProfileData();
                }

                showToast('登录成功');
                wcLoginSuccess();
            } else {
                showToast('账号或密码错误');
            }
        } catch (e) {
            console.error('登录失败', e);
            showToast('登录失败，请重试');
        }
    }

    async function wcLogout() {
        try {
            const authData = await wcGetAuthData();
            authData.currentLoginWxid = null;
            await wcSaveAuthData(authData);
            
            // 清除当前内存中的用户信息
            if (typeof appSettings !== 'undefined') {
                appSettings.wc_current_user_id = null;
                appSettings.wc_current_user_name = '';
                appSettings.wc_current_user_avatar = '';
                appSettings.wc_current_user_phone = '';
                if (typeof saveAppSettings === 'function') saveAppSettings();
            }
            
            wcSwitchAuthPage('page-wc-login');
            const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
            if (bottomNav) bottomNav.style.display = 'none';
            showToast('已退出登录');
        } catch (e) {
            console.error('退出登录失败', e);
        }
    }

    function wcLoginSuccess() {
        // 登录/注册成功后，跳转到聊天列表页，并显示底部导航栏
        document.querySelectorAll('#wechatAppUI .page').forEach(el => el.classList.remove('active'));
        document.getElementById('page-chat-list').classList.add('active');
        
        const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
        if (bottomNav) bottomNav.style.display = 'block';
        
        // 激活底部的聊天 Tab 状态
        document.querySelectorAll('#wechatAppUI .bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById('wc-nav-chat').classList.add('active');
    }

    function wcSwitchTab(tabName) {
        document.querySelectorAll('#wechatAppUI .bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('#wechatAppUI .page').forEach(el => el.classList.remove('active'));
        
        if (tabName === 'chat') {
            document.getElementById('wc-nav-chat').classList.add('active');
            document.getElementById('page-chat-list').classList.add('active');
            wcRenderChatList();
        } else if (tabName === 'contacts') {
            document.getElementById('wc-nav-contacts').classList.add('active');
            document.getElementById('page-contacts').classList.add('active');
            wcRenderContactTabs();
            wcRenderContactList();
        } else if (tabName === 'moments') {
            document.getElementById('wc-nav-moments').classList.add('active');
            document.getElementById('page-moments').classList.add('active');
            if (typeof wcRenderMomentsProfile === 'function') wcRenderMomentsProfile();
            if (typeof wcRenderMoments === 'function') wcRenderMoments();
        } else if (tabName === 'profile') {
            document.getElementById('wc-nav-profile').classList.add('active');
            document.getElementById('page-profile').classList.add('active');
            wcRenderProfilePage();
        }
    }

    function wcRenderProfilePage() {
        const nameEl = document.querySelector('#page-profile .wc-profile-name');
        const idEl = document.querySelector('#page-profile .wc-profile-id');
        const avatarEl = document.querySelector('#page-profile .wc-avatar-inner');
        const bioContainer = document.querySelector('#page-profile .wc-profile-bio');
        
        if (typeof appSettings !== 'undefined') {
            if (nameEl) nameEl.innerText = appSettings.wc_current_user_name || '未命名';
            if (idEl) idEl.innerText = '微信号：' + (appSettings.wc_current_user_phone || '--');
            if (avatarEl) {
                if (appSettings.wc_current_user_avatar) {
                    avatarEl.style.backgroundImage = `url('${appSettings.wc_current_user_avatar}')`;
                    avatarEl.style.backgroundSize = 'cover';
                    avatarEl.style.backgroundPosition = 'center';
                    avatarEl.innerHTML = '';
                } else {
                    avatarEl.style.backgroundImage = 'none';
                    avatarEl.style.backgroundColor = 'transparent';
                    avatarEl.innerHTML = getWcDefaultAvatarSvg();
                }
            }
            
            // 处理动态签名：如果有自定义签名则替换，否则显示默认占位文案
            if (bioContainer) {
                if (appSettings.wc_current_user_bio) {
                    bioContainer.style.whiteSpace = 'pre-wrap'; // 支持换行显示
                    bioContainer.innerText = appSettings.wc_current_user_bio;
                } else {
                    bioContainer.style.whiteSpace = 'normal';
                    bioContainer.innerHTML = `
                        <div class="wc-bio-line1">Oㅈo：뭐?</div>
                        <div class="wc-bio-line2">ㅎㅇ…iam>iwas🖤🤍</div>
                    `;
                }
            }
        }
    }

    // --- 微信个人信息编辑逻辑 ---
    let wcTempProfileAvatar = '';

    async function wcOpenProfileEditModal() {
        const authData = await wcGetAuthData();
        const currentUser = authData.accounts.find(a => a.wxid === authData.currentLoginWxid);
        if (!currentUser) return;

        document.getElementById('wcProfileEditName').value = currentUser.name || '';
        document.getElementById('wcProfileEditWxid').value = currentUser.wxid || '';
        // 如果没有自定义签名，输入框留空，让 placeholder 显示默认文案
        document.getElementById('wcProfileEditBio').value = currentUser.bio || '';
        
        wcTempProfileAvatar = currentUser.avatar || '';
        const avatarPreview = document.getElementById('wcProfileEditAvatarPreview');
        if (wcTempProfileAvatar) {
            avatarPreview.style.backgroundImage = `url('${wcTempProfileAvatar}')`;
            avatarPreview.style.backgroundColor = 'transparent';
            avatarPreview.innerHTML = '';
        } else {
            avatarPreview.style.backgroundImage = 'none';
            avatarPreview.style.backgroundColor = 'transparent';
            avatarPreview.innerHTML = getWcDefaultAvatarSvg();
        }

        document.getElementById('wcProfileEditOverlay').classList.add('show');
    }

    function wcCloseProfileEditModal() {
        document.getElementById('wcProfileEditOverlay').classList.remove('show');
    }

    function wcHandleProfileAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            wcTempProfileAvatar = e.target.result;
            document.getElementById('wcProfileEditAvatarPreview').style.backgroundImage = `url('${wcTempProfileAvatar}')`;
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    }

    function wcOpenProfileAvatarMenu(event) {
        const overlay = document.getElementById('wcProfileAvatarMenuOverlay');
        const menu = document.getElementById('wcProfileAvatarMenu');
        overlay.style.display = 'block';
        const rect = event.currentTarget.getBoundingClientRect();
        let top = rect.bottom + 10;
        let left = rect.left + (rect.width / 2) - 75; // 居中对齐菜单
        if (top + 130 > window.innerHeight) top = rect.top - 120;
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
    }

    function wcCloseProfileAvatarMenu() {
        document.getElementById('wcProfileAvatarMenuOverlay').style.display = 'none';
    }

    function wcHandleProfileAvatarUrl() {
        wcCloseProfileAvatarMenu();
        showCustomPrompt('修改头像', { placeholder: '输入图片 URL' }, '确定').then(url => {
            if (url && url.trim()) {
                wcTempProfileAvatar = url.trim();
                document.getElementById('wcProfileEditAvatarPreview').style.backgroundImage = `url('${wcTempProfileAvatar}')`;
                showToast('头像已更新，请点击保存');
            }
        });
    }

    async function wcSaveProfileEdit() {
        const newName = document.getElementById('wcProfileEditName').value.trim();
        const newWxid = document.getElementById('wcProfileEditWxid').value.trim();
        const newBio = document.getElementById('wcProfileEditBio').value.trim();

        if (!newName || !newWxid) {
            showToast('名称和微信号不能为空');
            return;
        }

        try {
            const authData = await wcGetAuthData();
            const currentUserIndex = authData.accounts.findIndex(a => a.wxid === authData.currentLoginWxid);
            
            if (currentUserIndex === -1) return;

            // 检查微信号是否冲突 (如果修改了微信号)
            if (newWxid !== authData.currentLoginWxid) {
                const isConflict = authData.accounts.some((a, idx) => a.wxid === newWxid && idx !== currentUserIndex);
                if (isConflict) {
                    showToast('该微信号已存在');
                    return;
                }
            }

            // 更新数据
            authData.accounts[currentUserIndex].name = newName;
            authData.accounts[currentUserIndex].wxid = newWxid;
            authData.accounts[currentUserIndex].bio = newBio;
            authData.accounts[currentUserIndex].avatar = wcTempProfileAvatar;
            
            authData.currentLoginWxid = newWxid; // 更新当前登录的 wxid

            await wcSaveAuthData(authData);

            // 更新全局变量
            if (typeof appSettings !== 'undefined') {
                appSettings.wc_current_user_name = newName;
                appSettings.wc_current_user_phone = newWxid;
                appSettings.wc_current_user_avatar = wcTempProfileAvatar;
                appSettings.wc_current_user_bio = newBio;
                if (typeof saveAppSettings === 'function') saveAppSettings();
            }

            // 同步更新朋友圈资料
            if (typeof wcMomentsProfile !== 'undefined') {
                wcMomentsProfile.name = newName;
                wcMomentsProfile.avatar = wcTempProfileAvatar;
                wcMomentsProfile.id = newWxid;
                if (typeof wcSaveMomentsProfileData === 'function') wcSaveMomentsProfileData();
            }

            showToast('个人信息已更新');
            wcCloseProfileEditModal();
            wcRenderProfilePage();

        } catch (e) {
            console.error('保存个人信息失败', e);
            showToast('保存失败');
        }
    }

    // --- 微信朋友圈逻辑 ---

    function wcRenderMoments() {
        const container = document.getElementById('wc-moments-feed-list');
        if (!container) return;
        let html = '';
        wcMomentsList.forEach(post => {
            let imagesHtml = '';
            if (post.images && post.images.length > 0) {
                imagesHtml = '<div class="post-images">';
                post.images.forEach(img => {
                    imagesHtml += `<div class="post-image">${img}</div>`;
                });
                imagesHtml += '</div>';
            }
            
            let commentsHtml = '';
            if (post.comments && post.comments.length > 0) {
                commentsHtml = '<div class="comments">';
                post.comments.forEach(c => {
                    commentsHtml += `<div class="comment-item"><span class="comment-name">${c.name}:</span> ${c.content}</div>`;
                });
                commentsHtml += '</div>';
            }

            let interactionHtml = '';
            if ((post.likes && post.likes.length > 0) || (post.comments && post.comments.length > 0)) {
                let likesHtml = '';
                if (post.likes && post.likes.length > 0) {
                    likesHtml = `<div class="likes"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> ${post.likes.join(', ')}</div>`;
                }
                interactionHtml = `
                    <div class="interaction-area">
                        ${likesHtml}
                        ${commentsHtml}
                    </div>
                `;
            }

            html += `
                <div class="post">
                    <div class="post-avatar">${post.avatar}</div>
                    <div class="post-content">
                        <div class="post-name">${post.name}</div>
                        <div class="post-text">${post.text}</div>
                        ${imagesHtml}
                        <div class="post-footer">
                            <span class="post-time">${post.time}</span>
                            <div class="moments-action-menu" id="moments-menu-${post.id}">
                                <div class="moments-action-item" onclick="wcMomentsAction('like', '${post.id}', event)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.863 11.0263C21.7522 10.5766 21.544 10.1567 21.253 9.79633C20.9625 9.43687 20.5929 9.14937 20.173 8.9563C19.7545 8.75706 19.2965 8.65454 18.833 8.65631H14.403L14.663 7.65631C14.9043 6.70449 14.8125 5.69875 14.403 4.8063C13.9855 3.91771 13.281 3.19559 12.403 2.75632L11.303 2.21631C11.0729 2.10257 10.8196 2.0434 10.563 2.0434C10.3063 2.0434 10.0531 2.10257 9.82297 2.21631C9.5931 2.33519 9.39442 2.50646 9.24297 2.71631C9.08952 2.92185 8.98983 3.16248 8.95297 3.41632L8.01297 9.06631C7.86088 9.20517 7.72349 9.35931 7.60297 9.52631C7.37478 9.25012 7.08946 9.02667 6.76664 8.87131C6.44382 8.71594 6.09118 8.63236 5.73297 8.62631H4.55297C3.88463 8.62631 3.24366 8.89182 2.77106 9.36441C2.29847 9.837 2.03297 10.478 2.03297 11.1463V19.4363C2.03297 20.1047 2.29847 20.7456 2.77106 21.2182C3.24366 21.6908 3.88463 21.9563 4.55297 21.9563H5.73297C6.10357 21.9579 6.46989 21.8771 6.80541 21.7197C7.14094 21.5623 7.43727 21.3323 7.67297 21.0463C8.26027 21.63 9.05494 21.9572 9.88297 21.9563H17.403C18.1297 21.9663 18.837 21.7222 19.403 21.2663C19.9754 20.8107 20.3657 20.165 20.503 19.4463L21.923 12.3563C21.9977 11.9138 21.9772 11.4603 21.863 11.0263ZM6.73297 19.4763C6.73297 19.7415 6.62761 19.9959 6.44008 20.1834C6.25254 20.3709 5.99819 20.4763 5.73297 20.4763H4.55297C4.28775 20.4763 4.0334 20.3709 3.84586 20.1834C3.65833 19.9959 3.55297 19.7415 3.55297 19.4763V11.1863C3.55297 10.9211 3.65833 10.6668 3.84586 10.4792C4.0334 10.2917 4.28775 10.1863 4.55297 10.1863H5.73297C5.99819 10.1863 6.25254 10.2917 6.44008 10.4792C6.62761 10.6668 6.73297 10.9211 6.73297 11.1863V19.4763Z" fill="currentColor"/></svg>点赞</div>
                                <div class="moments-action-item" onclick="wcMomentsAction('comment', '${post.id}', event)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.605 4.17001C20.1691 3.73083 19.6502 3.38265 19.0785 3.14575C18.5069 2.90884 17.8938 2.78793 17.275 2.79H6.70503C6.08566 2.79 5.47234 2.91215 4.90025 3.14947C4.32815 3.3868 3.80851 3.73464 3.37101 4.17306C2.93352 4.61148 2.58677 5.1319 2.35066 5.70449C2.11455 6.27709 1.99369 6.89064 1.99501 7.51001V14.11C1.99369 14.7294 2.11455 15.3429 2.35066 15.9155C2.58677 16.4881 2.93352 17.0085 3.37101 17.4469C3.80851 17.8853 4.32815 18.2332 4.90025 18.4705C5.47234 18.7078 6.08566 18.83 6.70503 18.83H9.03501L10.985 20.77C11.112 20.9127 11.2691 21.0254 11.445 21.1C11.6195 21.1719 11.8063 21.2092 11.995 21.21C12.1836 21.2082 12.3702 21.1709 12.545 21.1C12.7083 21.0226 12.8572 20.9177 12.985 20.79L14.985 18.79H17.315C17.9337 18.791 18.5464 18.6695 19.1179 18.4327C19.6894 18.1959 20.2084 17.8483 20.645 17.41C21.0733 16.9688 21.4127 16.4493 21.645 15.88C21.8793 15.3051 22.0015 14.6908 22.005 14.07V7.47C22.0005 6.85484 21.8745 6.24664 21.6343 5.68032C21.394 5.11401 21.0442 4.60075 20.605 4.17001ZM7.365 12.34C7.03668 12.34 6.71574 12.2426 6.44276 12.0602C6.16977 11.8778 5.95701 11.6186 5.83137 11.3152C5.70573 11.0119 5.67287 10.6781 5.73692 10.3561C5.80097 10.0341 5.95905 9.73835 6.1912 9.50619C6.42336 9.27404 6.71914 9.11596 7.04115 9.05191C7.36316 8.98785 7.69693 9.02072 8.00025 9.14636C8.30358 9.272 8.56285 9.48476 8.74525 9.75775C8.92765 10.0307 9.025 10.3517 9.025 10.68C9.02238 11.1194 8.84664 11.5401 8.5359 11.8509C8.22516 12.1616 7.80445 12.3374 7.365 12.34ZM11.995 12.34C11.6667 12.34 11.3457 12.2426 11.0728 12.0602C10.7998 11.8778 10.587 11.6186 10.4614 11.3152C10.3357 11.0119 10.3029 10.6781 10.3669 10.3561C10.431 10.0341 10.5891 9.73835 10.8212 9.50619C11.0534 9.27404 11.3491 9.11596 11.6712 9.05191C11.9932 8.98785 12.3269 9.02072 12.6303 9.14636C12.9336 9.272 13.1929 9.48476 13.3753 9.75775C13.5577 10.0307 13.655 10.3517 13.655 10.68C13.655 11.1202 13.4801 11.5425 13.1688 11.8538C12.8575 12.1651 12.4353 12.34 11.995 12.34ZM16.615 12.34C16.2867 12.34 15.9657 12.2426 15.6928 12.0602C15.4198 11.8778 15.207 11.6186 15.0814 11.3152C14.9557 11.0119 14.9229 10.6781 14.9869 10.3561C15.051 10.0341 15.209 9.73835 15.4412 9.50619C15.6734 9.27404 15.9691 9.11596 16.2911 9.05191C16.6132 8.98785 16.9469 9.02072 17.2503 9.14636C17.5536 9.272 17.8128 9.48476 17.9953 9.75775C18.1777 10.0307 18.275 10.3517 18.275 10.68C18.2724 11.1194 18.0966 11.5401 17.7859 11.8509C17.4752 12.1616 17.0545 12.3374 16.615 12.34Z" fill="currentColor"/></svg>评论</div>
                                <div class="moments-action-item" onclick="wcMomentsAction('delete', '${post.id}', event)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.725 5.27503H16.035V4.38501C16.0302 3.75505 15.779 3.152 15.335 2.70502C15.1134 2.48265 14.85 2.3063 14.56 2.18616C14.2699 2.06602 13.9589 2.00446 13.645 2.00501H10.385C10.0711 2.00446 9.76012 2.06602 9.47008 2.18616C9.18003 2.3063 8.91661 2.48265 8.69501 2.70502C8.25382 3.15302 8.00606 3.75625 8.005 4.38501V5.27503H3.315C3.11609 5.27503 2.92534 5.35404 2.78468 5.49469C2.64403 5.63535 2.565 5.82612 2.565 6.02503C2.565 6.22394 2.64403 6.41468 2.78468 6.55533C2.92534 6.69598 3.11609 6.77503 3.315 6.77503H4.73502V18.535C4.73094 18.9908 4.81721 19.4429 4.98885 19.8651C5.16049 20.2873 5.4141 20.6713 5.73502 20.995C6.38935 21.6361 7.26895 21.9951 8.18501 21.995H15.805C16.7211 21.9951 17.6007 21.6361 18.255 20.995C18.5759 20.6713 18.8295 20.2873 19.0012 19.8651C19.1728 19.4429 19.2591 18.9908 19.255 18.535V6.77503H20.685C20.8839 6.77503 21.0747 6.69598 21.2153 6.55533C21.356 6.41468 21.435 6.22394 21.435 6.02503C21.435 5.82612 21.356 5.63535 21.2153 5.49469C21.0747 5.35404 20.8839 5.27503 20.685 5.27503H20.725ZM9.52501 4.38501C9.52505 4.26959 9.54806 4.15534 9.5927 4.04889C9.63733 3.94245 9.70272 3.84595 9.78502 3.76502C9.95034 3.60152 10.1725 3.50833 10.405 3.50501H13.665C13.782 3.50428 13.898 3.52689 14.0062 3.57154C14.1144 3.61618 14.2126 3.68197 14.295 3.76502C14.4576 3.93092 14.5507 4.15273 14.555 4.38501V5.27503H9.55501L9.52501 4.38501ZM10.855 16.995C10.855 17.2602 10.7497 17.5146 10.5621 17.7021C10.3746 17.8897 10.1202 17.995 9.855 17.995C9.58978 17.995 9.33544 17.8897 9.1479 17.7021C8.96037 17.5146 8.85501 17.2602 8.85501 16.995V11.565C8.85501 11.2998 8.96037 11.0455 9.1479 10.8579C9.33544 10.6704 9.58978 10.565 9.855 10.565C10.1202 10.565 10.3746 10.6704 10.5621 10.8579C10.7497 11.0455 10.855 11.2998 10.855 11.565V16.995ZM15.215 16.995C15.215 17.2602 15.1096 17.5146 14.9221 17.7021C14.7346 17.8897 14.4802 17.995 14.215 17.995C13.9498 17.995 13.6954 17.8897 13.5079 17.7021C13.3204 17.5146 13.215 17.2602 13.215 16.995V11.565C13.215 11.2998 13.3204 11.0455 13.5079 10.8579C13.6954 10.6704 13.9498 10.565 14.215 10.565C14.4802 10.565 14.7346 10.6704 14.9221 10.8579C15.1096 11.0455 15.215 11.2998 15.215 11.565V16.995Z" fill="currentColor"/></svg>删除</div>
                                <div class="moments-action-item" onclick="wcMomentsAction('summon', '${post.id}', event)"><svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>召唤</div>
                            </div>
                            <div class="action-btn" onclick="wcToggleMomentsMenu('${post.id}', event)">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                            </div>
                        </div>
                        ${interactionHtml}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function wcToggleMomentsMenu(postId, event) {
        event.stopPropagation();
        // 关闭其他已打开的菜单
        document.querySelectorAll('.moments-action-menu').forEach(menu => {
            if (menu.id !== `moments-menu-${postId}`) {
                menu.classList.remove('show');
            }
        });
        // 切换当前菜单
        const targetMenu = document.getElementById(`moments-menu-${postId}`);
        if (targetMenu) {
            targetMenu.classList.toggle('show');
        }
    }

    function wcMomentsAction(action, postId, event) {
        event.stopPropagation();
        document.getElementById(`moments-menu-${postId}`).classList.remove('show');
        if (typeof showToast === 'function') {
            const actionNames = { 'like': '点赞', 'comment': '评论', 'delete': '删除', 'summon': '召唤' };
            showToast(`已点击：${actionNames[action]}`);
        }
    }

    // 全局点击关闭朋友圈菜单
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.moments-action-menu') && !e.target.closest('.action-btn')) {
            document.querySelectorAll('.moments-action-menu').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });

    // --- 微信朋友圈个人资料逻辑 ---


    function wcRenderMomentsProfile() {
        const bgEl = document.querySelector('#page-moments .cover-photo');
        const avatarEl = document.querySelector('#page-moments .profile-avatar-inner');
        const nameEl = document.querySelector('#page-moments .profile-name');
        const idEl = document.querySelector('#page-moments .profile-handle');
        const bioEl = document.querySelector('#page-moments .profile-bio');

        if (bgEl) {
            if (wcMomentsProfile.bg) {
                bgEl.style.backgroundImage = `url('${wcMomentsProfile.bg}')`;
                bgEl.style.backgroundSize = 'cover';
                bgEl.style.backgroundPosition = 'center';
            } else {
                bgEl.style.backgroundImage = 'none';
                bgEl.style.backgroundColor = '#4a4a4a';
            }
        }
        if (avatarEl) {
            if (wcMomentsProfile.avatar) {
                avatarEl.innerHTML = '';
                avatarEl.style.backgroundImage = `url('${wcMomentsProfile.avatar}')`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.style.backgroundPosition = 'center';
                avatarEl.style.backgroundColor = 'transparent';
            } else {
                avatarEl.style.backgroundImage = 'none';
                avatarEl.style.backgroundColor = 'transparent';
                avatarEl.innerHTML = getWcDefaultAvatarSvg();
            }
        }
        if (nameEl) nameEl.innerText = wcMomentsProfile.name;
        if (idEl) idEl.innerText = wcMomentsProfile.id;
        if (bioEl) bioEl.innerText = wcMomentsProfile.bio;
    }

    function wcOpenMomentsEditModal() {
        document.getElementById('wcMomentsEditName').value = wcMomentsProfile.name;
        document.getElementById('wcMomentsEditId').value = wcMomentsProfile.id;
        document.getElementById('wcMomentsEditBio').value = wcMomentsProfile.bio;

        const bgPreview = document.getElementById('wcMomentsEditBgPreview');
        if (wcMomentsProfile.bg) {
            bgPreview.style.backgroundImage = `url('${wcMomentsProfile.bg}')`;
        } else {
            bgPreview.style.backgroundImage = 'none';
            bgPreview.style.backgroundColor = '#4a4a4a';
        }

        const avatarPreview = document.getElementById('wcMomentsEditAvatarPreview');
        if (wcMomentsProfile.avatar) {
            avatarPreview.innerHTML = '';
            avatarPreview.style.backgroundImage = `url('${wcMomentsProfile.avatar}')`;
            avatarPreview.style.backgroundColor = 'transparent';
        } else {
            avatarPreview.style.backgroundImage = 'none';
            avatarPreview.style.backgroundColor = 'transparent';
            avatarPreview.innerHTML = getWcDefaultAvatarSvg();
        }

        document.getElementById('wcMomentsEditOverlay').classList.add('show');
    }

    function wcCloseMomentsEditModal() {
        document.getElementById('wcMomentsEditOverlay').classList.remove('show');
    }

    function wcSaveMomentsEdit() {
        wcMomentsProfile.name = document.getElementById('wcMomentsEditName').value.trim();
        wcMomentsProfile.id = document.getElementById('wcMomentsEditId').value.trim();
        wcMomentsProfile.bio = document.getElementById('wcMomentsEditBio').value.trim();
        
        wcSaveMomentsProfileData();
        wcRenderMomentsProfile();
        wcCloseMomentsEditModal();
    }

    // --- 微信联系人逻辑 ---


    let wcCurrentContactTabId = 'g_member';
    let wcCurrentMoveContactId = null;
    let wcCurrentChatContactId = null;

    function wcRenderContactTabs() {
        const container = document.getElementById('wcTopTabsContainer');
        if (!container) return;
        let html = '';
        wcContactGroups.forEach(g => {
            const isActive = g.id === wcCurrentContactTabId ? 'active' : '';
            html += `<div class="wc-tab-item ${isActive}" onclick="wcSwitchContactTab('${g.id}')">${g.name}</div>`;
        });
        html += `<div class="wc-tab-item" onclick="wcOpenCreateContactGroupDialog()">📁分组+</div>`;
        container.innerHTML = html;
    }

    function wcRenderChatList() {
        const chatList = document.querySelector('#wechatAppUI .chat-list');
        if (!chatList) return;
        let html = '';
        wcContactsList.forEach(contact => {
            const avatarStyle = contact.avatar ? `background-image: url('${contact.avatar}'); border: none;` : '';
            const avatarContent = contact.avatar ? '' : getWcDefaultAvatarSvg();
            html += `
                <div class="chat-item" data-session-id="${contact.id}" onclick="wcOpenChatRoom('${contact.id}')" style="display: flex; padding: 12px 16px; align-items: center; border-bottom: none; cursor: pointer;">
                    <div class="avatar" style="width: 48px; height: 48px; border-radius: 50%; background-color: transparent; background-size: cover; background-position: center; flex-shrink: 0; margin-right: 12px; ${avatarStyle}">${avatarContent}</div>
                    <div class="chat-info" style="flex: 1; overflow: hidden;">
                        <div class="chat-name-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <div class="name" style="font-size: 16px; font-weight: 500; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${contact.name}</div>
                            <div class="time" style="font-size: 12px; color: #8e8e93;">刚刚</div>
                        </div>
                        <div class="chat-msg-row">
                            <div class="msg" style="font-size: 14px; color: #8e8e93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">你们已添加为好友，现在可以开始聊天了。</div>
                        </div>
                    </div>
                </div>
            `;
        });
        chatList.innerHTML = html;
    }

    function wcRenderContactList() {
        const container = document.getElementById('wcDynamicContent');
        if (!container) return;
        const currentContacts = wcContactsList.filter(c => c.groupId === wcCurrentContactTabId);
        let html = '';

        if (currentContacts.length > 0) {
            html += `<div class="wc-list-group">`;
            currentContacts.forEach(contact => {
                const avatarStyle = contact.avatar ? `background-image: url('${contact.avatar}'); border: none;` : '';
                const avatarContent = contact.avatar ? '' : getWcDefaultAvatarSvg();
                html += `
                    <div class="wc-swipe-wrapper">
                        <div class="wc-swipe-actions">
                            <div class="wc-swipe-btn" onclick="wcOpenMoveSheet('${contact.id}')">分组</div>
                        </div>
                        <div class="wc-character-card wc-swipe-content" data-id="${contact.id}" onclick="wcOpenChatRoom('${contact.id}')">
                            <div class="avatar" style="${avatarStyle}; background-color: transparent;">${avatarContent}</div>
                            <div class="info-wrapper">
                                <div class="name">${contact.name}</div>
                                <div class="desc">${contact.desc}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            html += `<div style="text-align:center; color:#8e8e93; font-size:14px; padding: 40px 0;">暂无联系人</div>`;
        }

        container.innerHTML = html;
        wcInitContactSwipe();
        wcRenderChatList();
    }

    function wcReloadContactsFromStorage() {
        if (typeof db === 'undefined' || !db || typeof storeName === 'undefined') return Promise.resolve(false);
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const request = transaction.objectStore(storeName).get('wechatContactsData');
            request.onsuccess = () => {
                const saved = request.result;
                if (saved) {
                    wcContactGroups = Array.isArray(saved.groups) ? saved.groups : [];
                    wcContactsList = Array.isArray(saved.contacts) ? saved.contacts : [];
                    if (!wcContactGroups.some(group => group.id === wcCurrentContactTabId)) {
                        wcCurrentContactTabId = wcContactGroups[0]?.id || 'g_member';
                    }
                    wcRenderContactTabs();
                    wcRenderContactList();
                }
            };
            request.onerror = () => reject(request.error || new Error('微信联系人刷新失败'));
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error || new Error('微信联系人刷新失败'));
        });
    }
    window.wcReloadContactsFromStorage = wcReloadContactsFromStorage;

    function wcOpenAddFriendQr() {
        const input = document.getElementById('wcContactQrInput');
        if (input) input.click();
    }
    window.wcOpenAddFriendQr = wcOpenAddFriendQr;

    function wcOpenAddFriendPanel() {
        const app = document.getElementById('wechatAppUI');
        const panel = document.getElementById('wcAddFriendPanel');
        if (!app || !panel) return;
        app.classList.add('wc-add-friend-open');
        panel.classList.add('show');
        panel.setAttribute('aria-hidden', 'false');
        setTimeout(() => document.getElementById('wcAddFriendSearchInput')?.focus(), 260);
    }
    window.wcOpenAddFriendPanel = wcOpenAddFriendPanel;

    function wcCloseAddFriendPanel() {
        const app = document.getElementById('wechatAppUI');
        const panel = document.getElementById('wcAddFriendPanel');
        app?.classList.remove('wc-add-friend-open');
        panel?.classList.remove('show');
        panel?.setAttribute('aria-hidden', 'true');
    }
    window.wcCloseAddFriendPanel = wcCloseAddFriendPanel;

    let wcCurrentPendingContact = null;

    async function wcSearchFriend(event) {
        event?.preventDefault();
        const input = document.getElementById('wcAddFriendSearchInput');
        const query = input?.value.trim().toLowerCase();
        if (!query) {
            showToast('请输入微信号或手机号');
            return;
        }

        try {
            const contactRecord = await wcReadLayoutRecord('contactsAppData');
            const contacts = Array.isArray(contactRecord?.data?.contacts) ? contactRecord.data.contacts : [];
            
            // 模拟搜索：如果输入 123，使用测试数据，否则去数据库找
            let contact = null;
            if (query === '123') {
                contact = {
                    id: 'test_123',
                    name: 'Alice (Test Character)',
                    security: { account: 'alice_wonderland' },
                    persona: 'A curious girl from wonderland.',
                    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice'
                };
            } else {
                contact = contacts.find(item =>
                    String(item.security?.account || '').trim().toLowerCase() === query ||
                    String(item.security?.phone || '').trim().toLowerCase() === query
                );
            }

            if (!contact) {
                showToast('未找到对应好友，请检查账号或手机号是否正确');
                return;
            }

            await wcReloadContactsFromStorage();
            const linkedId = 'char_' + contact.id;
            const existing = wcContactsList.find(item => item.id === linkedId || item.linkedContactId === contact.id);
            
            if (existing) {
                showToast('该角色已经在微信好友中');
                wcCurrentContactTabId = existing.groupId;
                wcCloseAddFriendPanel();
                wcSwitchTab('contacts');
                wcRenderContactTabs();
                wcRenderContactList();
                requestAnimationFrame(() => {
                    const card = Array.from(document.querySelectorAll('#wcDynamicContent .wc-character-card[data-id]'))
                        .find(item => item.dataset.id === String(existing.id));
                    if (!card) return;
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.classList.add('wc-search-match');
                    setTimeout(() => card.classList.remove('wc-search-match'), 1600);
                });
                return;
            }

            // 保存到全局变量，供确认添加时使用
            wcCurrentPendingContact = contact;
            
            // 填充详情页数据
            const avatarEl = document.getElementById('afd-avatar');
            if (avatarEl) {
                if (contact.avatar) {
                    avatarEl.style.backgroundImage = `url('${contact.avatar}')`;
                    avatarEl.style.backgroundColor = 'transparent';
                    avatarEl.innerHTML = '';
                } else {
                    avatarEl.style.backgroundImage = 'none';
                    avatarEl.style.backgroundColor = 'transparent';
                    avatarEl.innerHTML = getWcDefaultAvatarSvg();
                }
            }
            const nameEl = document.getElementById('afd-name');
            if (nameEl) nameEl.innerText = contact.name || '未命名角色';
            const accountEl = document.getElementById('afd-account');
            if (accountEl) accountEl.innerText = `ID：${contact.security?.account || contact.security?.phone || '--'}`;

            // 关闭搜索面板，隐藏底部导航，显示详情页
            wcCloseAddFriendPanel();
            const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
            if (bottomNav) bottomNav.style.display = 'none';
            document.querySelectorAll('#wechatAppUI .page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-add-friend-detail').classList.add('active');

        } catch (error) {
            console.error('WeChat friend search failed:', error);
            showToast('联系人数据读取失败');
        }
    }
    window.wcSearchFriend = wcSearchFriend;

    function wcCloseAddFriendDetail() {
        wcCurrentPendingContact = null;
        const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
        if (bottomNav) bottomNav.style.display = 'block';
        wcSwitchTab('chat'); // 返回主页
    }
    window.wcCloseAddFriendDetail = wcCloseAddFriendDetail;

    async function wcConfirmAddFriend() {
        if (!wcCurrentPendingContact) return;
        const contact = wcCurrentPendingContact;
        const linkedId = 'char_' + contact.id;

        if (!wcContactGroups.length) wcContactGroups.push({ id: 'g_member', name: 'Member' });
        const groupId = contact.wechatGroupId && wcContactGroups.some(group => group.id === contact.wechatGroupId)
            ? contact.wechatGroupId
            : wcContactGroups[0].id;
            
        wcContactsList.push({
            id: linkedId,
            linkedContactId: contact.id,
            name: contact.name || '未命名角色',
            desc: contact.persona ? contact.persona.replace(/\s+/g, ' ').slice(0, 80) : '角色联系人',
            avatar: contact.avatar || '',
            groupId,
            account: contact.security?.account || '',
            phone: contact.security?.phone || '',
            password: contact.security?.password || '',
            qrCode: contact.security?.qrCode || '',
            persona: contact.persona || '',
            npcs: Array.isArray(contact.npcs) ? JSON.parse(JSON.stringify(contact.npcs)) : []
        });
        
        wcCurrentContactTabId = groupId;
        await wcSaveContactsDataAsync();
        
        wcCurrentPendingContact = null;
        const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
        if (bottomNav) bottomNav.style.display = 'block';
        
        wcSwitchTab('contacts');
        wcRenderContactTabs();
        wcRenderContactList();
        showToast('添加成功');
        
        requestAnimationFrame(() => {
            const card = Array.from(document.querySelectorAll('#wcDynamicContent .wc-character-card[data-id]'))
                .find(item => item.dataset.id === String(linkedId));
            if (!card) return;
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('wc-search-match');
            setTimeout(() => card.classList.remove('wc-search-match'), 1600);
        });
    }
    window.wcConfirmAddFriend = wcConfirmAddFriend;

    function wcStartQrFriendImport() {
        wcOpenAddFriendQr();
    }
    window.wcStartQrFriendImport = wcStartQrFriendImport;

    function wcOpenCreateGroupChat() {
        showCustomAlert('提示', '创建群聊功能暂未开放');
    }
    window.wcOpenCreateGroupChat = wcOpenCreateGroupChat;

    function wcReadLayoutRecord(id) {
        if (typeof db !== 'undefined' && db && typeof storeName !== 'undefined' && db.objectStoreNames.contains(storeName)) {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([storeName], 'readonly');
                const request = transaction.objectStore(storeName).get(id);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error || new Error('联系人数据读取失败'));
                transaction.onerror = () => reject(transaction.error || new Error('联系人数据读取失败'));
            });
        }
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('iOSDesktopDB');
            request.onerror = () => reject(request.error || new Error('数据库打开失败'));
            request.onsuccess = () => {
                const connection = request.result;
                if (!connection.objectStoreNames.contains('layoutStore')) {
                    connection.close();
                    resolve(null);
                    return;
                }
                const transaction = connection.transaction(['layoutStore'], 'readonly');
                const getRequest = transaction.objectStore('layoutStore').get(id);
                getRequest.onsuccess = () => resolve(getRequest.result || null);
                getRequest.onerror = () => reject(getRequest.error || new Error('联系人数据读取失败'));
                transaction.oncomplete = () => connection.close();
            };
        });
    }

    async function wcDecodeQrImage(file) {
        if ('BarcodeDetector' in window) {
            try {
                const supported = await window.BarcodeDetector.getSupportedFormats();
                if (supported.includes('qr_code')) {
                    const bitmap = await createImageBitmap(file);
                    try {
                        const codes = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(bitmap);
                        if (codes[0]?.rawValue) return codes[0].rawValue;
                    } finally {
                        bitmap.close();
                    }
                }
            } catch (error) {
                console.warn('Native QR detection failed, falling back to jsQR:', error);
            }
        }
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => {
                try {
                    const maxSize = 1800;
                    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
                    const width = Math.max(1, Math.round(image.naturalWidth * scale));
                    const height = Math.max(1, Math.round(image.naturalHeight * scale));
                    const paddingOptions = [0, Math.max(24, Math.round(Math.max(width, height) * 0.12))];
                    let result = null;
                    for (const padding of paddingOptions) {
                        const canvas = document.createElement('canvas');
                        canvas.width = width + padding * 2;
                        canvas.height = height + padding * 2;
                        const context = canvas.getContext('2d', { willReadFrequently: true });
                        context.fillStyle = '#fff';
                        context.fillRect(0, 0, canvas.width, canvas.height);
                        context.drawImage(image, padding, padding, width, height);
                        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
                        result = typeof window.jsQR === 'function'
                            ? window.jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' })
                            : null;
                        if (result?.data) break;
                    }
                    URL.revokeObjectURL(url);
                    if (result?.data) resolve(result.data);
                    else reject(new Error('没有识别到二维码，请选择清晰的角色二维码截图'));
                } catch (error) {
                    URL.revokeObjectURL(url);
                    reject(error);
                }
            };
            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('二维码图片无法读取'));
            };
            image.src = url;
        });
    }

    function wcParseContactQr(value) {
        let payload;
        try {
            payload = JSON.parse(value);
        } catch (error) {
            throw new Error('这不是有效的角色二维码');
        }
        if (payload?.type !== 'tonghuaji-wechat-contact' || !payload.contactId) {
            throw new Error('这不是小手机角色二维码');
        }
        return payload;
    }

    function wcSaveContactsDataAsync() {
        if (!db || typeof storeName === 'undefined') return Promise.reject(new Error('微信数据库尚未准备好'));
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            transaction.objectStore(storeName).put({ id: 'wechatContactsData', groups: wcContactGroups, contacts: wcContactsList });
            transaction.oncomplete = () => {
                if (typeof triggerAutoLocalBackup === 'function') triggerAutoLocalBackup();
                resolve(true);
            };
            transaction.onerror = () => reject(transaction.error || new Error('微信联系人保存失败'));
        });
    }

    async function wcHandleContactQrFile(event) {
        const input = event.target;
        const file = input?.files?.[0];
        if (input) input.value = '';
        if (!file) return;
        try {
            const payload = wcParseContactQr(await wcDecodeQrImage(file));
            const contactRecord = await wcReadLayoutRecord('contactsAppData');
            const contacts = Array.isArray(contactRecord?.data?.contacts) ? contactRecord.data.contacts : [];
            const contact = contacts.find(item => item && item.id === payload.contactId);
            if (!contact) throw new Error('该角色已不存在，请重新生成角色二维码');

            await wcReloadContactsFromStorage();
            const linkedId = 'char_' + contact.id;
            const existing = wcContactsList.find(item => item.id === linkedId || item.linkedContactId === contact.id);
            if (existing) {
                showToast('该角色已经在微信好友中');
                return;
            }
            if (!wcContactGroups.length) wcContactGroups.push({ id: 'g_member', name: 'Member' });
            const groupId = contact.wechatGroupId && wcContactGroups.some(group => group.id === contact.wechatGroupId)
                ? contact.wechatGroupId
                : wcContactGroups[0].id;
            wcContactsList.push({
                id: linkedId,
                linkedContactId: contact.id,
                name: contact.name || payload.name || '未命名角色',
                desc: contact.persona ? contact.persona.replace(/\s+/g, ' ').slice(0, 80) : '角色联系人',
                avatar: contact.avatar || '',
                groupId,
                account: contact.security?.account || '',
                phone: contact.security?.phone || '',
                password: contact.security?.password || '',
                qrCode: contact.security?.qrCode || '',
                persona: contact.persona || '',
                npcs: Array.isArray(contact.npcs) ? JSON.parse(JSON.stringify(contact.npcs)) : []
            });
            wcCurrentContactTabId = groupId;
            await wcSaveContactsDataAsync();
            wcCloseAddFriendPanel();
            wcSwitchTab('contacts');
            wcRenderContactTabs();
            wcRenderContactList();
            showToast('已通过二维码添加角色好友');
        } catch (error) {
            console.error('Contact QR import failed:', error);
            showToast(error?.message || '二维码识别失败');
        }
    }
    window.wcHandleContactQrFile = wcHandleContactQrFile;

    function wcSwitchContactTab(groupId) {
        wcCurrentContactTabId = groupId;
        wcRenderContactTabs();
        wcRenderContactList();
    }

    function wcOpenCreateContactGroupDialog() {
        showCustomPrompt('新建分组', { placeholder: '请输入分组名称' }, '存储').then(name => {
            if (name === null) return;
            if (name.trim()) {
                const newId = 'g_' + Date.now();
                wcContactGroups.push({ id: newId, name: name.trim() });
                wcCurrentContactTabId = newId;
                wcSaveContactsData();
                wcRenderContactTabs();
                wcRenderContactList();
                const tabsContainer = document.getElementById('wcTopTabsContainer');
                setTimeout(() => {
                    tabsContainer.scrollTo({ left: tabsContainer.scrollWidth, behavior: 'smooth' });
                }, 50);
            } else {
                showCustomAlert("提示", "名称不能为空！");
            }
        });
    }

    function wcOpenMoveSheet(contactId) {
        wcCurrentMoveContactId = contactId;
        
        if (wcActiveContactSwipeItem) {
            wcActiveContactSwipeItem.style.transform = 'translateX(0)';
            wcActiveContactSwipeItem = null;
        }

        let items = [];
        wcContactGroups.forEach(g => {
            if (g.id !== wcCurrentContactTabId) {
                items.push({ label: g.name, value: g.id });
            }
        });

        if (items.length === 0) {
            showToast('没有其他分组可选');
            return;
        }

        openUniversalSelect({
            title: '移动联系人至',
            items: items,
            currentValue: '', // 默认不选中
            searchable: false,
            onSelect: (groupId) => {
                if (wcCurrentMoveContactId) {
                    const contact = wcContactsList.find(c => c.id === wcCurrentMoveContactId);
                    if (contact) {
                        contact.groupId = groupId;
                        wcSaveContactsData();
                        wcRenderContactList();
                        showToast('移动成功');
                    }
                }
                wcCurrentMoveContactId = null;
            }
        });
    }

    function wcCloseMoveSheet() {
        // 兼容旧版 HTML 绑定的事件，防止报错
        const overlay = document.getElementById('wcMoveSheetOverlay');
        if (overlay) overlay.classList.remove('show');
        wcCurrentMoveContactId = null;
    }

    function wcMoveToGroup(groupId) {
        // 兼容旧版 HTML 绑定的事件，防止报错
    }

    let wcContactStartX = 0, wcContactStartY = 0, wcContactCurrentX = 0, wcContactCurrentY = 0;
    let wcActiveContactSwipeItem = null, wcContactIsScrolling = false;

    function wcInitContactSwipe() {
        const cards = document.querySelectorAll('.wc-swipe-content');
        cards.forEach(card => {
            card.addEventListener('touchstart', wcHandleContactTouchStart, {passive: true});
            card.addEventListener('touchmove', wcHandleContactTouchMove, {passive: false});
            card.addEventListener('touchend', wcHandleContactTouchEnd);
        });
    }

    function wcHandleContactTouchStart(e) {
        if (wcActiveContactSwipeItem && wcActiveContactSwipeItem !== e.currentTarget) {
            wcActiveContactSwipeItem.style.transform = 'translateX(0)';
            wcActiveContactSwipeItem = null;
        }
        wcContactStartX = e.touches[0].clientX;
        wcContactStartY = e.touches[0].clientY;
        e.currentTarget.style.transition = 'none';
        wcContactIsScrolling = false;
    }

    function wcHandleContactTouchMove(e) {
        if (!wcContactStartX || !wcContactStartY) return;
        wcContactCurrentX = e.touches[0].clientX;
        wcContactCurrentY = e.touches[0].clientY;
        let diffX = wcContactCurrentX - wcContactStartX;
        let diffY = wcContactCurrentY - wcContactStartY;

        if (Math.abs(diffY) > Math.abs(diffX)) {
            wcContactIsScrolling = true;
            return;
        }

        if (!wcContactIsScrolling && diffX < 0) {
            e.preventDefault();
            let moveX = Math.max(diffX, -80);
            e.currentTarget.style.transform = `translateX(${moveX}px)`;
        }
    }

    function wcHandleContactTouchEnd(e) {
        if (wcContactIsScrolling) return;
        let diffX = wcContactCurrentX - wcContactStartX;
        e.currentTarget.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        
        if (diffX < -40) {
            e.currentTarget.style.transform = `translateX(-80px)`;
            wcActiveContactSwipeItem = e.currentTarget;
        } else {
            e.currentTarget.style.transform = `translateX(0)`;
            if (wcActiveContactSwipeItem === e.currentTarget) wcActiveContactSwipeItem = null;
        }
        wcContactStartX = null;
        wcContactStartY = null;
    }

    document.addEventListener('touchstart', (e) => {
        if (wcActiveContactSwipeItem && !e.target.closest('.wc-swipe-wrapper')) {
            wcActiveContactSwipeItem.style.transform = 'translateX(0)';
            wcActiveContactSwipeItem = null;
        }
    });

    function closeWechatApp() {
        const wechatUI = document.getElementById('wechatAppUI');
        if (wechatUI) {
            wechatUI.classList.remove('show');
            setTimeout(() => { wechatUI.style.display = 'none'; }, 300);
        }
    }

    function wcOpenChat() {
        document.querySelector('#wechatAppUI #page-chat-list').classList.remove('active');
        document.querySelector('#wechatAppUI #page-chat-room').classList.add('active');
        const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
        if (bottomNav) bottomNav.style.display = 'none';
        wcUpdateMessageGroupings(); wcScrollToBottom();
    }

    function wcOpenChatRoom(contactId) {
        const contact = wcContactsList.find(c => c.id === contactId);
        if (!contact) return;
        wcCurrentChatContactId = contactId;
        
        const chatRoom = document.getElementById('page-chat-room');
        const nameEl = chatRoom.querySelector('.room-info-text .name');
        const avatarEl = chatRoom.querySelector('.room-info-capsule .avatar');
        
        if (nameEl) nameEl.innerText = contact.name;
        if (avatarEl) {
            if (contact.avatar) {
                avatarEl.style.backgroundImage = `url('${contact.avatar}')`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.style.backgroundPosition = 'center';
                avatarEl.style.border = 'none';
                avatarEl.style.backgroundColor = 'transparent';
                avatarEl.innerHTML = '';
            } else {
                avatarEl.style.backgroundImage = 'none';
                avatarEl.style.backgroundSize = '';
                avatarEl.style.backgroundPosition = '';
                avatarEl.style.border = 'none';
                avatarEl.style.backgroundColor = 'transparent';
                avatarEl.innerHTML = getWcDefaultAvatarSvg();
            }
        }
        
        document.querySelectorAll('#wechatAppUI .page').forEach(el => el.classList.remove('active'));
        chatRoom.classList.add('active');
        const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
        if (bottomNav) bottomNav.style.display = 'none';

        wcRenderChatMessages(contactId);
    }

    function wcCloseChat() {
        document.querySelector('#wechatAppUI #page-chat-room').classList.remove('active');
        document.querySelector('#wechatAppUI #page-chat-list').classList.add('active');
        const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
        if (bottomNav) bottomNav.style.display = 'block';
        document.getElementById('wc-dropdown-menu').classList.remove('show');
    }

    function wcToggleMenu(event) {
        event.stopPropagation(); 
        document.getElementById('wc-dropdown-menu').classList.toggle('show');
    }

    function wcCloseMenu(event) {
        const menu = document.getElementById('wc-dropdown-menu');
        if (menu && menu.classList.contains('show')) menu.classList.remove('show');
        
        // 点击聊天区域空白处时，收起表情面板
        const emojiPanel = document.getElementById('wcEmojiPanel');
        if (emojiPanel && emojiPanel.classList.contains('show') && event && !event.target.closest('#wcEmojiPanel') && !event.target.closest('.tool-icon')) {
            wcCloseEmojiPanel();
        }
    }

    let wcRecentEmojis = [];

    // 切换表情面板显示/隐藏
    function wcToggleEmojiPanel(event) {
        if (event) event.stopPropagation();
        const panel = document.getElementById('wcEmojiPanel');
        const footer = document.getElementById('wcFooterCapsule');
        const chatArea = document.getElementById('wc-chat-area');
        
        if (typeof appSettings !== 'undefined' && appSettings.wc_recent_emojis) {
            wcRecentEmojis = appSettings.wc_recent_emojis;
        }
        
        if (panel.classList.contains('show')) {
            wcCloseEmojiPanel();
        } else {
            wcRenderChatEmojiPanel();
            panel.classList.add('show');
            if(footer) footer.style.transform = 'translateY(-266px)';
            if(chatArea) chatArea.style.paddingBottom = '366px';
            wcScrollToBottom();
        }
    }

    // 收起表情面板
    function wcCloseEmojiPanel() {
        const panel = document.getElementById('wcEmojiPanel');
        const footer = document.getElementById('wcFooterCapsule');
        const chatArea = document.getElementById('wc-chat-area');
        if (panel && panel.classList.contains('show')) {
            panel.classList.remove('show');
            if(footer) footer.style.transform = 'translateY(0)';
            if(chatArea) chatArea.style.paddingBottom = '100px';
        }
    }

    function wcRenderChatEmojiPanel() {
        const groupContainer = document.getElementById('wcEmojiCapsuleGroup');
        if (!groupContainer) return;
        
        let html = `
            <div class="wc-capsule-item wc-search-trigger" onclick="wcOpenEmojiSearch()">
                <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <span>搜索</span>
            </div>
            <div class="wc-capsule-item active" onclick="wcSwitchEmojiGroup(this, 'all')">全部</div>
            <div class="wc-capsule-item" onclick="wcSwitchEmojiGroup(this, 'recent')">最近</div>
        `;
        
        wcEmojiGroups.forEach(g => {
            html += `<div class="wc-capsule-item" onclick="wcSwitchEmojiGroup(this, '${g.id}')">${g.name}</div>`;
        });
        
        groupContainer.innerHTML = html;
        
        wcRenderChatEmojiContent('all');
    }

    // 切换表情分组
    function wcSwitchEmojiGroup(item, groupId) {
        const items = document.querySelectorAll('#wcEmojiPanel .wc-capsule-item:not(.wc-search-trigger)');
        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        
        wcRenderChatEmojiContent(groupId);
    }

    function wcRenderChatEmojiContent(groupId) {
        const content = document.getElementById('wcEmojiPanelContent');
        if (!content) return;
        
        let emojis = [];
        if (groupId === 'all') {
            emojis = wcGetAllEmojis();
        } else if (groupId === 'recent') {
            emojis = wcRecentEmojis;
        } else {
            const group = wcEmojiGroups.find(g => g.id === groupId);
            if (group) emojis = group.emojis;
        }
        
        if (emojis.length === 0) {
            content.innerHTML = '<div style="width: 100%; text-align: center; color: #888; font-size: 15px; font-weight: bold;">当前暂无表情包</div>';
            content.style.display = 'flex';
            return;
        }
        
        content.style.display = 'grid';
        content.style.gridTemplateColumns = 'repeat(5, 1fr)';
        content.style.gap = '20px 12px';
        content.style.padding = '16px';
        content.style.overflowY = 'auto';
        content.style.alignItems = 'start';
        content.style.justifyItems = 'center';
        content.style.alignContent = 'start';
        
        let html = '';
        emojis.forEach(e => {
            html += `
                <div class="wc-chat-emoji-item" onclick="wcSendEmoji('${e.id}', '${e.url}', '${e.desc}')">
                    <div class="wc-chat-emoji-img-wrap">
                        <img src="${e.url}" alt="${e.desc}">
                    </div>
                    <div class="wc-chat-emoji-desc">${e.desc}</div>
                </div>
            `;
        });
        content.innerHTML = html;
    }

    function wcSendEmoji(id, url, desc) {
        wcRecentEmojis = wcRecentEmojis.filter(e => e.id !== id);
        wcRecentEmojis.unshift({ id, url, desc });
        if (wcRecentEmojis.length > 20) wcRecentEmojis.pop();
        
        if (typeof appSettings !== 'undefined') {
            appSettings.wc_recent_emojis = wcRecentEmojis;
            if (typeof saveAppSettings === 'function') saveAppSettings();
        }
        
        wcAppendChatMessage(`[表情] ${desc}`, 'sent', wcCurrentChatContactId, url);
        wcCloseEmojiPanel();
    }

    // 打开表情搜索视图
    function wcOpenEmojiSearch() {
        document.getElementById('wcEmojiCapsuleGroup').style.display = 'none';
        document.getElementById('wcEmojiSearchView').classList.add('show');
        document.getElementById('wcEmojiPanelContent').innerHTML = '<div style="width: 100%; text-align: center; color: #888; font-size: 15px; font-weight: bold;">搜索表情包...</div>';
        document.getElementById('wcEmojiPanelContent').style.display = 'flex';
    }

    // 关闭表情搜索视图
    function wcCloseEmojiSearch() {
        document.getElementById('wcEmojiSearchView').classList.remove('show');
        document.getElementById('wcEmojiCapsuleGroup').style.display = 'flex';
        document.getElementById('wcEmojiSearchInput').value = '';
        wcRenderChatEmojiContent('all');
    }

    function wcHandleEmojiSearch() {
        const keyword = document.getElementById('wcEmojiSearchInput').value.trim().toLowerCase();
        const content = document.getElementById('wcEmojiPanelContent');
        if (!content) return;
        
        if (!keyword) {
            content.innerHTML = '<div style="width: 100%; text-align: center; color: #888; font-size: 15px; font-weight: bold;">请输入搜索关键字</div>';
            content.style.display = 'flex';
            return;
        }
        
        const allEmojis = wcGetAllEmojis();
        const results = allEmojis.filter(e => e.desc.toLowerCase().includes(keyword));
        
        if (results.length === 0) {
            content.innerHTML = '<div style="width: 100%; text-align: center; color: #888; font-size: 15px; font-weight: bold;">未找到相关表情包</div>';
            content.style.display = 'flex';
            return;
        }
        
        content.style.display = 'grid';
        content.style.gridTemplateColumns = 'repeat(5, 1fr)';
        content.style.gap = '20px 12px';
        content.style.padding = '16px';
        content.style.overflowY = 'auto';
        content.style.alignItems = 'start';
        content.style.justifyItems = 'center';
        content.style.alignContent = 'start';
        
        let html = '';
        results.forEach(e => {
            html += `
                <div class="wc-chat-emoji-item" onclick="wcSendEmoji('${e.id}', '${e.url}', '${e.desc}')">
                    <div class="wc-chat-emoji-img-wrap">
                        <img src="${e.url}" alt="${e.desc}">
                    </div>
                    <div class="wc-chat-emoji-desc">${e.desc}</div>
                </div>
            `;
        });
        content.innerHTML = html;
    }

    async function wcHandleMenuClick(action) {
        wcCloseMenu();
        if (action === '聊天设置') wcOpenSettingsModal();
        if (action === '聊天美化') wcOpenThemeModal();
        if (action === '搜索聊天记录') {
            wcOpenChatSearch();
        }
        if (action === '清空聊天记录') {
            if (!wcCurrentChatContactId) return;
            const confirmed = await showCustomConfirm('清空聊天记录', '确定清空当前联系人的全部聊天记录吗？', '清空', true);
            if (!confirmed) return;
            delete wcChatMessagesByContact[wcCurrentChatContactId];
            wcSaveChatData();
            wcRenderChatMessages(wcCurrentChatContactId);
            showToast('聊天记录已清空');
        }
    }

    function wcOpenThemeModal() {
        wcShowThemeMenu(); 
        document.getElementById('wc-theme-modal').classList.add('show');
    }

    function wcCloseThemeModal() {
        document.getElementById('wc-theme-modal').classList.remove('show');
        wcResetAllSwipes(); 
    }

    // --- 聊天设置逻辑 ---
    let wcCurrentSettingsAvatarType = '';

    function wcOpenSettingsModal() {
        document.getElementById('wc-settings-modal').classList.add('show');
        wcShowMainSettings(); // 每次打开确保在主列表
        
        // 读取气泡限制和上下文记忆条数
        if (typeof appSettings !== 'undefined') {
            const maxLimitEl = document.getElementById('wc-max-bubble-limit');
            const minLimitEl = document.getElementById('wc-min-bubble-limit');
            const contextLimitEl = document.getElementById('wc-context-memory-limit');
            if (maxLimitEl) maxLimitEl.value = appSettings.wc_max_bubble_limit || '';
            if (minLimitEl) minLimitEl.value = appSettings.wc_min_bubble_limit || '';
            if (contextLimitEl) contextLimitEl.value = appSettings.wc_context_memory_limit || '';
        }

        // 注入 Char 和 User 的头像与名称
        const charCircle = document.getElementById('wc-settings-char-circle');
        const charNameEl = document.getElementById('wc-settings-char-name');
        const userCircle = document.getElementById('wc-settings-user-circle');
        const userNameEl = document.getElementById('wc-settings-user-name');
        
        // 获取当前 Char 数据
        const contact = wcContactsList.find(c => c.id === wcCurrentChatContactId);
        if (contact) {
            if (charNameEl) charNameEl.innerText = contact.name || 'Char';
            if (charCircle) {
                if (contact.avatar) {
                    charCircle.style.backgroundImage = `url('${contact.avatar}')`;
                    charCircle.innerHTML = '';
                } else {
                    charCircle.style.backgroundImage = 'none';
                    charCircle.style.backgroundColor = 'transparent';
                    charCircle.style.border = 'none';
                    charCircle.innerHTML = getWcDefaultAvatarSvg();
                }
            }
        }
        
        // 获取当前 User 数据
        if (typeof appSettings !== 'undefined') {
            if (userNameEl) userNameEl.innerText = appSettings.wc_current_user_name || 'User';
            if (userCircle) {
                if (appSettings.wc_current_user_avatar) {
                    userCircle.style.backgroundImage = `url('${appSettings.wc_current_user_avatar}')`;
                    userCircle.innerHTML = '';
                } else {
                    userCircle.style.backgroundImage = 'none';
                    userCircle.style.backgroundColor = 'transparent';
                    userCircle.style.border = 'none';
                    userCircle.innerHTML = getWcDefaultAvatarSvg();
                }
            }
        }
    }

    function wcCloseSettingsModal() {
        document.getElementById('wc-settings-modal').classList.remove('show');
    }

    function wcToggleSwitch(element) {
        element.classList.toggle('active');
    }

    function wcShowMainSettings() {
        const mainView = document.getElementById('wc-main-settings-view');
        if (mainView) mainView.style.display = 'flex';
        
        const avatarsHeader = document.getElementById('wc-settings-avatars-header');
        if (avatarsHeader) avatarsHeader.style.display = 'flex';
        
        const title = document.getElementById('wc-settings-modal-title');
        if (title) title.innerText = 'WeSettings';
    }

    function wcShowCharSettings() {
        document.getElementById('wc-main-settings-view').style.display = 'none';
        document.getElementById('wc-char-settings-view').style.display = 'flex';
        document.getElementById('wc-user-settings-view').style.display = 'none';
        
        // 隐藏双头像容器，显示单悬浮头像
        document.getElementById('wc-settings-avatars-header').style.display = 'none';
        const floatingAvatar = document.getElementById('wc-settings-avatar-floating');
        floatingAvatar.style.display = 'block';
        
        // 设置为 Char 的头像样式
        wcCurrentSettingsAvatarType = 'char';
        const preview = document.getElementById('wc-floating-avatar-preview');
        
        const contact = wcContactsList.find(c => c.id === wcCurrentChatContactId);
        if (contact && contact.avatar) {
            preview.style.backgroundImage = `url('${contact.avatar}')`;
            preview.style.backgroundColor = 'transparent';
            preview.innerHTML = '';
        } else {
            preview.style.backgroundImage = 'none';
            preview.style.backgroundColor = 'transparent';
            preview.style.border = 'none';
            preview.innerHTML = getWcDefaultAvatarSvg();
        }
        
        document.getElementById('wc-settings-modal-title').innerText = 'Char 设定';
    }

    function wcShowUserSettings() {
        document.getElementById('wc-main-settings-view').style.display = 'none';
        document.getElementById('wc-char-settings-view').style.display = 'none';
        document.getElementById('wc-user-settings-view').style.display = 'flex';
        
        // 隐藏双头像容器，显示单悬浮头像
        document.getElementById('wc-settings-avatars-header').style.display = 'none';
        const floatingAvatar = document.getElementById('wc-settings-avatar-floating');
        floatingAvatar.style.display = 'block';
        
        // 设置为 User 的头像样式
        wcCurrentSettingsAvatarType = 'user';
        const preview = document.getElementById('wc-floating-avatar-preview');
        
        if (typeof appSettings !== 'undefined' && appSettings.wc_current_user_avatar) {
            preview.style.backgroundImage = `url('${appSettings.wc_current_user_avatar}')`;
            preview.style.backgroundColor = 'transparent';
            preview.innerHTML = '';
        } else {
            preview.style.backgroundImage = 'none';
            preview.style.backgroundColor = 'transparent';
            preview.style.border = 'none';
            preview.innerHTML = getWcDefaultAvatarSvg();
        }
        
        document.getElementById('wc-settings-modal-title').innerText = 'User 设定';
    }

    function wcHandleSettingsBack() {
        wcCloseSettingsModal();
    }

    async function wcJumpToContactsChar() {
        wcCloseSettingsModal();
        const contact = wcContactsList.find(c => c.id === wcCurrentChatContactId);
        if (contact && contact.linkedContactId) {
            if (window.ContactsApp && window.ContactsApp.openContactExternal) {
                // 加上 await，等待角色库初始化和数据加载完成
                await window.ContactsApp.open();
                window.ContactsApp.openContactExternal(contact.linkedContactId, async () => {
                    // 当从角色库返回时，重新同步数据并刷新聊天室
                    await wcReloadContactsFromStorage();
                    const contactRecord = await wcReadLayoutRecord('contactsAppData');
                    const contacts = Array.isArray(contactRecord?.data?.contacts) ? contactRecord.data.contacts : [];
                    const sourceContact = contacts.find(c => c.id === contact.linkedContactId);
                    if (sourceContact) {
                        contact.avatar = sourceContact.avatar || '';
                        contact.name = sourceContact.name || '未命名角色';
                        await wcSaveContactsDataAsync();
                        // 刷新聊天室头部和消息
                        wcOpenChatRoom(wcCurrentChatContactId);
                    }
                });
            }
        } else {
            if (typeof showToast === 'function') showToast('未找到关联的角色数据');
        }
    }

    async function wcJumpToContactsUser() {
        wcCloseSettingsModal();
        const userId = typeof appSettings !== 'undefined' ? appSettings.wc_current_user_id : null;
        if (userId) {
            if (window.ContactsApp && window.ContactsApp.openUserExternal) {
                // 加上 await，等待角色库初始化和数据加载完成
                await window.ContactsApp.open();
                window.ContactsApp.openUserExternal(userId, async () => {
                    // 当从角色库返回时，重新同步 User 数据
                    const contactRecord = await wcReadLayoutRecord('contactsAppData');
                    const users = Array.isArray(contactRecord?.data?.users) ? contactRecord.data.users : [];
                    const sourceUser = users.find(u => u.id === userId);
                    if (sourceUser) {
                        appSettings.wc_current_user_name = sourceUser.name || '未命名 User';
                        appSettings.wc_current_user_avatar = sourceUser.avatar || '';
                        if (typeof saveAppSettings === 'function') saveAppSettings();
                        
                        // 同步到 authData
                        const authData = await wcGetAuthData();
                        const currentUserIndex = authData.accounts.findIndex(a => a.wxid === authData.currentLoginWxid);
                        if (currentUserIndex !== -1) {
                            authData.accounts[currentUserIndex].name = sourceUser.name;
                            authData.accounts[currentUserIndex].avatar = sourceUser.avatar;
                            await wcSaveAuthData(authData);
                        }
                        // 刷新聊天室（因为自己发的消息头像可能变了）
                        wcRenderChatMessages(wcCurrentChatContactId);
                    }
                });
            }
        } else {
            if (typeof showToast === 'function') showToast('未找到关联的 User 数据');
        }
    }

    function wcChangeSettingsAvatar() {
        // 模拟切换头像
        const colors = ['#ff9500', '#34c759', '#007aff', '#ff3b30', '#af52de'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        document.getElementById('wc-floating-avatar-preview').style.backgroundColor = randomColor;
        
        if (wcCurrentSettingsAvatarType === 'char') {
            showToast('模拟：已选择新的 Char 头像');
        } else {
            showToast('模拟：已选择新的 User 头像');
        }
    }

    function wcSaveBubbleLimits() {
        if (typeof appSettings !== 'undefined') {
            const maxLimitEl = document.getElementById('wc-max-bubble-limit');
            const minLimitEl = document.getElementById('wc-min-bubble-limit');
            if (maxLimitEl) appSettings.wc_max_bubble_limit = maxLimitEl.value;
            if (minLimitEl) appSettings.wc_min_bubble_limit = minLimitEl.value;
            if (typeof saveAppSettings === 'function') saveAppSettings();
        }
    }
    window.wcSaveBubbleLimits = wcSaveBubbleLimits;

    function wcSaveContextMemoryLimit() {
        if (typeof appSettings !== 'undefined') {
            const contextLimitEl = document.getElementById('wc-context-memory-limit');
            if (contextLimitEl) appSettings.wc_context_memory_limit = contextLimitEl.value;
            if (typeof saveAppSettings === 'function') saveAppSettings();
        }
    }
    window.wcSaveContextMemoryLimit = wcSaveContextMemoryLimit;

    function wcOpenBindEmojiGroups() {
        const contact = wcContactsList.find(c => c.id === wcCurrentChatContactId);
        if (!contact) return;
        
        // 动态创建 overlay，确保点击一定有反应
        let overlay = document.getElementById('wcBindEmojiOverlay');
        if (!overlay) {
            const overlayHtml = `<div class="wc-bind-emoji-overlay" id="wcBindEmojiOverlay" onclick="if(event.target === this) this.classList.remove('show')"></div>`;
            document.body.insertAdjacentHTML('beforeend', overlayHtml);
            overlay = document.getElementById('wcBindEmojiOverlay');
        }
        
        const boundGroups = contact.boundEmojiGroups || [];
        
        let html = `
            <div class="wc-bind-emoji-window" onclick="event.stopPropagation()">
                <!-- 顶部标题栏 -->
                <div class="wc-bind-emoji-header">
                    <div class="wc-bind-emoji-controls">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                        <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </div>
                    <div class="wc-bind-emoji-address-bar">
                        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <span>关联表情包</span>
                    </div>
                </div>

                <!-- 中间网格内容区 -->
                <div class="wc-bind-emoji-content">
                    <div class="wc-bind-emoji-grid">
        `;
        
        if (wcEmojiGroups.length === 0) {
            html += `<div style="grid-column: 1 / -1; color: #8e8e93; text-align: center; padding: 40px 0; font-size: 14px;">暂无表情包分组</div>`;
        } else {
            wcEmojiGroups.forEach(g => {
                const isChecked = boundGroups.includes(g.id) ? 'selected' : '';
                
                // 构建 4 宫格预览
                let previewHtml = '';
                if (g.emojis && g.emojis.length > 0) {
                    const previewCount = Math.min(g.emojis.length, 4);
                    for (let i = 0; i < previewCount; i++) {
                        previewHtml += `<div class="wc-bind-emoji-preview-cell" style="background-image: url('${g.emojis[i].url}')"></div>`;
                    }
                    // 如果不足4个，用空div占位保持网格
                    for (let i = previewCount; i < 4; i++) {
                        previewHtml += `<div class="wc-bind-emoji-preview-cell empty"></div>`;
                    }
                } else {
                    previewHtml = `<div style="grid-column: 1/-1; display:flex; justify-content:center; align-items:center; font-size: 24px;">📁</div>`;
                }
                
                html += `
                    <div class="wc-bind-emoji-item-wrapper" data-id="${g.id}" onclick="this.querySelector('.wc-bind-emoji-card').classList.toggle('selected')">
                        <div class="wc-bind-emoji-card ${isChecked}">
                            <div class="wc-bind-emoji-indicator">
                                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <div class="wc-bind-emoji-preview ${g.emojis && g.emojis.length > 0 ? 'grid-4' : ''}">
                                ${previewHtml}
                            </div>
                        </div>
                        <div class="wc-bind-emoji-name">${g.name}</div>
                    </div>
                `;
            });
        }
        
        html += `
                    </div>
                </div>

                <!-- 底部状态栏 -->
                <div class="wc-bind-emoji-footer">
                    <div class="wc-bind-emoji-actions">
                        <button class="wc-bind-emoji-btn cancel" onclick="document.getElementById('wcBindEmojiOverlay').classList.remove('show')">取消</button>
                        <button class="wc-bind-emoji-btn save" onclick="wcSaveBindEmojiGroups()">保存绑定</button>
                    </div>
                </div>
            </div>
        `;
        
        overlay.innerHTML = html;
        overlay.classList.add('show');
    }
    window.wcOpenBindEmojiGroups = wcOpenBindEmojiGroups;

    function wcSaveBindEmojiGroups() {
        const contact = wcContactsList.find(c => c.id === wcCurrentChatContactId);
        if (!contact) return;
        
        const selectedCards = document.querySelectorAll('.wc-bind-emoji-card.selected');
        const selectedIds = Array.from(selectedCards).map(card => card.closest('.wc-bind-emoji-item-wrapper').getAttribute('data-id'));
        
        contact.boundEmojiGroups = selectedIds;
        wcSaveContactsDataAsync();
        
        document.getElementById('wcBindEmojiOverlay').classList.remove('show');
        if (typeof showToast === 'function') showToast('关联表情包已保存');
    }
    window.wcSaveBindEmojiGroups = wcSaveBindEmojiGroups;

    function wcHandleThemeBack() {
        const presetView = document.getElementById('wc-theme-preset-view');
        const customView = document.getElementById('wc-theme-custom-view');
        const editView = document.getElementById('wc-theme-edit-preset-view');
        const fontView = document.getElementById('wc-theme-font-view');
        const avatarView = document.getElementById('wc-theme-avatar-view');
        const bubbleView = document.getElementById('wc-theme-bubble-view');
        const chatBgView = document.getElementById('wc-theme-chat-bg-view');
        const copyCssView = document.getElementById('wc-theme-copy-css-view');
        
        if (customView.style.display === 'flex') {
            wcShowThemeMenu(); wcResetAllSwipes();
        } else if (editView.style.display === 'flex') {
            wcShowThemePreset(); wcResetAllSwipes();
        } else if (presetView.style.display === 'flex') {
            wcShowThemeMenu(); wcResetAllSwipes();
        } else if (fontView && fontView.style.display === 'flex') {
            wcShowThemeMenu(); wcResetAllSwipes();
        } else if (avatarView && avatarView.style.display === 'flex') {
            wcShowThemeMenu(); wcResetAllSwipes();
        } else if (bubbleView && bubbleView.style.display === 'flex') {
            wcShowThemeMenu(); wcResetAllSwipes();
        } else if (chatBgView && chatBgView.style.display === 'flex') {
            wcShowThemeMenu(); wcResetAllSwipes();
        } else if (copyCssView && copyCssView.style.display === 'flex') {
            wcShowThemeMenu(); wcResetAllSwipes();
        } else {
            wcCloseThemeModal();
        }
    }

    // ==========================================
    // 微信自定义美化与预设库逻辑
    // ==========================================

    let wcCurrentEditId = null;


    function wcSavePresetsToStorage() {
        appSettings.wc_presets = wcPresets;
        saveAppSettings();
    }

    function wcRenderPresets() {
        const container = document.getElementById('wc-theme-preset-view');
        if (wcPresets.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #8e8e93; margin-top: 40px; font-size: 14px; font-weight: 500;">暂无预设主题</div>';
            return;
        }
        let html = '';
        wcPresets.forEach(preset => {
            const inUseHtml = (preset.id === wcCurrentPresetId) ? `<div style="position: absolute; top: 0; right: 0; background: var(--tg-blue); color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 0 20px 0 10px; z-index: 10;">使用中</div>` : '';
            html += `
                <div class="preset-item-wrapper">
                    ${inUseHtml}
                    <div class="preset-item-content" onclick="wcApplyPreset('${preset.id}')" ontouchstart="wcHandleTouchStart(event)" ontouchmove="wcHandleTouchMove(event)" ontouchend="wcHandleTouchEnd(event)">
                        <div class="preset-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2.9967H20C20.5523 2.9967 21 3.44442 21 3.9967V8.9967C21 9.54899 20.5523 9.9967 20 9.9967H4C3.44772 9.9967 3 9.54899 3 8.9967V3.9967C3 3.44442 3.44772 2.9967 4 2.9967ZM6 11.9967H12C12.5523 11.9967 13 12.4444 13 12.9967V15.9967H14V21.9967H10V15.9967H11V13.9967H5C4.44772 13.9967 4 13.549 4 12.9967V10.9967H6V11.9967ZM17.7322 13.7289L19.5 11.9612L21.2678 13.7289C22.2441 14.7052 22.2441 16.2882 21.2678 17.2645C20.2915 18.2408 18.7085 18.2408 17.7322 17.2645C16.7559 16.2882 16.7559 14.7052 17.7322 13.7289Z"></path></svg>
                        </div>
                        <div class="preset-info"><div class="preset-title">${preset.name}</div></div>
                    </div>
                    <div class="preset-item-actions">
                        <div class="action-capsule edit" onclick="wcOpenEditPreset('${preset.id}')">编辑</div>
                        <div class="action-capsule delete" onclick="wcDeletePreset('${preset.id}')">删除</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function wcShowThemeMenu() {
        document.getElementById('wc-theme-menu-view').style.display = 'flex';
        document.getElementById('wc-theme-preset-view').style.display = 'none';
        document.getElementById('wc-theme-custom-view').style.display = 'none';
        document.getElementById('wc-theme-edit-preset-view').style.display = 'none';
        document.getElementById('wc-theme-font-view').style.display = 'none';
        document.getElementById('wc-theme-avatar-view').style.display = 'none';
        if(document.getElementById('wc-theme-bubble-view')) document.getElementById('wc-theme-bubble-view').style.display = 'none';
        if(document.getElementById('wc-theme-chat-bg-view')) document.getElementById('wc-theme-chat-bg-view').style.display = 'none';
        if(document.getElementById('wc-theme-copy-css-view')) document.getElementById('wc-theme-copy-css-view').style.display = 'none';
        document.querySelector('#wechatAppUI .theme-capsule').style.display = 'flex';
        document.getElementById('wc-custom-preview-box').style.display = 'none';
        document.getElementById('wc-theme-modal-title').innerText = 'WeTheme';
        document.getElementById('wc-capsule-title').innerText = '聊天美化';
        document.getElementById('wc-capsule-icon-svg').innerHTML = '<path d="M4 2.9967H20C20.5523 2.9967 21 3.44442 21 3.9967V8.9967C21 9.54899 20.5523 9.9967 20 9.9967H4C3.44772 9.9967 3 9.54899 3 8.9967V3.9967C3 3.44442 3.44772 2.9967 4 2.9967ZM6 11.9967H12C12.5523 11.9967 13 12.4444 13 12.9967V15.9967H14V21.9967H10V15.9967H11V13.9967H5C4.44772 13.9967 4 13.549 4 12.9967V10.9967H6V11.9967ZM17.7322 13.7289L19.5 11.9612L21.2678 13.7289C22.2441 14.7052 22.2441 16.2882 21.2678 17.2645C20.2915 18.2408 18.7085 18.2408 17.7322 17.2645C16.7559 16.2882 16.7559 14.7052 17.7322 13.7289Z"></path>';
    }

    function wcShowThemePreset() {
        wcRenderPresets(); // 每次进入预设库时重新渲染
        document.getElementById('wc-theme-menu-view').style.display = 'none';
        document.getElementById('wc-theme-preset-view').style.display = 'flex';
        document.getElementById('wc-theme-custom-view').style.display = 'none';
        document.getElementById('wc-theme-edit-preset-view').style.display = 'none';
        document.getElementById('wc-theme-font-view').style.display = 'none';
        document.getElementById('wc-theme-avatar-view').style.display = 'none';
        if(document.getElementById('wc-theme-bubble-view')) document.getElementById('wc-theme-bubble-view').style.display = 'none';
        if(document.getElementById('wc-theme-chat-bg-view')) document.getElementById('wc-theme-chat-bg-view').style.display = 'none';
        document.querySelector('#wechatAppUI .theme-capsule').style.display = 'flex';
        document.getElementById('wc-custom-preview-box').style.display = 'none';
        document.getElementById('wc-theme-modal-title').innerText = '美化预设库';
        document.getElementById('wc-capsule-title').innerText = '美化预设库';
        document.getElementById('wc-capsule-icon-svg').innerHTML = '<path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 10c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z"/>';
    }

    function wcShowThemeCustom() {
        document.getElementById('wc-theme-menu-view').style.display = 'none';
        document.getElementById('wc-theme-preset-view').style.display = 'none';
        document.getElementById('wc-theme-custom-view').style.display = 'flex';
        document.getElementById('wc-theme-edit-preset-view').style.display = 'none';
        document.getElementById('wc-theme-font-view').style.display = 'none';
        document.getElementById('wc-theme-avatar-view').style.display = 'none';
        if(document.getElementById('wc-theme-bubble-view')) document.getElementById('wc-theme-bubble-view').style.display = 'none';
        if(document.getElementById('wc-theme-chat-bg-view')) document.getElementById('wc-theme-chat-bg-view').style.display = 'none';
        document.querySelector('#wechatAppUI .theme-capsule').style.display = 'none';
        document.getElementById('wc-custom-preview-box').style.display = 'flex';
        document.getElementById('wc-theme-modal-title').innerText = '自定义美化';
    }

    function wcShowThemeFont() {
        wcRenderFontList(); // 渲染字体列表
        document.getElementById('wc-theme-menu-view').style.display = 'none';
        document.getElementById('wc-theme-preset-view').style.display = 'none';
        document.getElementById('wc-theme-custom-view').style.display = 'none';
        document.getElementById('wc-theme-edit-preset-view').style.display = 'none';
        document.getElementById('wc-theme-font-view').style.display = 'flex';
        document.getElementById('wc-theme-avatar-view').style.display = 'none';
        if(document.getElementById('wc-theme-bubble-view')) document.getElementById('wc-theme-bubble-view').style.display = 'none';
        if(document.getElementById('wc-theme-chat-bg-view')) document.getElementById('wc-theme-chat-bg-view').style.display = 'none';
        document.querySelector('#wechatAppUI .theme-capsule').style.display = 'none';
        document.getElementById('wc-custom-preview-box').style.display = 'flex';
        document.getElementById('wc-theme-modal-title').innerText = '字体美化';
    }

    function wcShowThemeAvatar() {
        wcRenderAvatarFrames(); // 渲染头像框库
        document.getElementById('wc-theme-menu-view').style.display = 'none';
        document.getElementById('wc-theme-preset-view').style.display = 'none';
        document.getElementById('wc-theme-custom-view').style.display = 'none';
        document.getElementById('wc-theme-edit-preset-view').style.display = 'none';
        document.getElementById('wc-theme-font-view').style.display = 'none';
        document.getElementById('wc-theme-avatar-view').style.display = 'flex';
        if(document.getElementById('wc-theme-bubble-view')) document.getElementById('wc-theme-bubble-view').style.display = 'none';
        if(document.getElementById('wc-theme-chat-bg-view')) document.getElementById('wc-theme-chat-bg-view').style.display = 'none';
        document.querySelector('#wechatAppUI .theme-capsule').style.display = 'none';
        document.getElementById('wc-custom-preview-box').style.display = 'flex';
        document.getElementById('wc-theme-modal-title').innerText = '头像显示';
    }

    function wcOpenEditPreset(id) {
        const preset = wcPresets.find(p => p.id === id);
        if (!preset) return;
        wcCurrentEditId = id;
        
        document.getElementById('wc-theme-menu-view').style.display = 'none';
        document.getElementById('wc-theme-preset-view').style.display = 'none';
        document.getElementById('wc-theme-custom-view').style.display = 'none';
        document.getElementById('wc-theme-edit-preset-view').style.display = 'flex';
        document.getElementById('wc-theme-font-view').style.display = 'none';
        document.getElementById('wc-theme-avatar-view').style.display = 'none';
        if(document.getElementById('wc-theme-bubble-view')) document.getElementById('wc-theme-bubble-view').style.display = 'none';
        if(document.getElementById('wc-theme-chat-bg-view')) document.getElementById('wc-theme-chat-bg-view').style.display = 'none';
        document.querySelector('#wechatAppUI .theme-capsule').style.display = 'none';
        document.getElementById('wc-custom-preview-box').style.display = 'none';
        document.getElementById('wc-theme-modal-title').innerText = '编辑预设';
        
        document.getElementById('wc-edit-preset-name').value = preset.name;
        document.getElementById('wc-edit-preset-css').value = preset.css; 
    }

    function wcShowThemeChatBg() {
        document.getElementById('wc-theme-menu-view').style.display = 'none';
        document.getElementById('wc-theme-preset-view').style.display = 'none';
        document.getElementById('wc-theme-custom-view').style.display = 'none';
        document.getElementById('wc-theme-edit-preset-view').style.display = 'none';
        document.getElementById('wc-theme-font-view').style.display = 'none';
        document.getElementById('wc-theme-avatar-view').style.display = 'none';
        if(document.getElementById('wc-theme-bubble-view')) document.getElementById('wc-theme-bubble-view').style.display = 'none';
        document.getElementById('wc-theme-chat-bg-view').style.display = 'flex';
        document.querySelector('#wechatAppUI .theme-capsule').style.display = 'none';
        document.getElementById('wc-custom-preview-box').style.display = 'none';
        document.getElementById('wc-theme-modal-title').innerText = '聊天壁纸';
    }

    function wcSaveEditedPreset() {
        if (!wcCurrentEditId) return;
        const preset = wcPresets.find(p => p.id === wcCurrentEditId);
        if (preset) {
            preset.name = document.getElementById('wc-edit-preset-name').value.trim() || '未命名';
            preset.css = document.getElementById('wc-edit-preset-css').value;
            wcSavePresetsToStorage();
            showCustomAlert("提示", "预设已保存！");
            wcShowThemePreset();
        }
    }

    function wcDeletePreset(id) {
        showCustomConfirm('删除预设', '确定要删除这个美化预设吗？', '删除', true).then(confirmed => {
            if (confirmed) {
                wcPresets = wcPresets.filter(p => p.id !== id);
                wcSavePresetsToStorage();
                wcRenderPresets();
            }
        });
    }

    function wcApplyPreset(id) {
        const preset = wcPresets.find(p => p.id === id);
        if (preset) {
            document.getElementById('wc-custom-css-input').value = preset.css;
            appSettings.wc_custom_css = preset.css;
            wcCurrentPresetId = id;
            appSettings.wc_current_preset_id = id;
            saveAppSettings();
            wcApplyCustomCss(preset.css);
            wcRenderPresets();
            showCustomAlert("提示", `已应用主题：${preset.name}`);
        }
    }

    function wcToggleSwitch(element) { element.classList.toggle('active'); }
    


    function wcApplyTimestampSettings() {
        let styleTag = document.getElementById('wc-dynamic-timestamp-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'wc-dynamic-timestamp-style';
            document.head.appendChild(styleTag);
        }
        if (wcTimestampEnabled) {
            styleTag.innerHTML = `#wechatAppUI .msg-meta { display: flex !important; }`;
        } else {
            styleTag.innerHTML = `#wechatAppUI .msg-meta { display: none !important; }`;
        }
        
        const toggleEl = document.getElementById('wc-timestamp-toggle');
        if (toggleEl) {
            if (wcTimestampEnabled) toggleEl.classList.add('active');
            else toggleEl.classList.remove('active');
        }
    }

    function wcToggleTimestamp(element) {
        element.classList.toggle('active');
        wcTimestampEnabled = element.classList.contains('active');
        appSettings.wc_timestamp_enabled = wcTimestampEnabled;
        saveAppSettings();
        wcApplyTimestampSettings();
    }

    function wcSaveCustomTheme() { 
        const cssText = document.getElementById('wc-custom-css-input').value;
        appSettings.wc_custom_css = cssText;
        wcCurrentPresetId = null;
        appSettings.wc_current_preset_id = null;
        saveAppSettings();
        wcApplyCustomCss(cssText);
        showCustomAlert("提示", "自定义 CSS 已应用！"); 
    }
    
    function wcOpenSavePresetDialog() { 
        showCustomPrompt('保存为预设', { placeholder: '请输入预设名称' }, '确定').then(name => {
            if (name === null) return;
            if (!name.trim()) {
                showCustomAlert("提示", "请输入预设名称");
                return;
            }
            const css = document.getElementById('wc-custom-css-input').value;
            const newPreset = {
                id: 'wc_preset_' + Date.now(),
                name: name.trim(),
                author: '我',
                css: css
            };
            wcPresets.push(newPreset);
            wcSavePresetsToStorage();
            showCustomAlert("成功", `已保存至预设库：${name.trim()}`);
        });
    }

    function wcApplyCustomCss(cssText) {
        if (cssText === undefined) {
            cssText = document.getElementById('wc-custom-css-input').value;
        }
        let styleTag = document.getElementById('wc-dynamic-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'wc-dynamic-style';
            document.head.appendChild(styleTag);
        }
        
        if (!cssText.trim()) {
            styleTag.innerHTML = '';
            return;
        }

        let processedCss = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
        processedCss = processedCss.replace(/(^|\})\s*([^{]+)/g, function(m, p1, p2) {
            if (p2.trim().startsWith('@')) return m;
            const prefixed = p2.split(',').map(selector => {
                const s = selector.trim();
                if (!s) return '';
                if (s.startsWith('#wechatAppUI')) return s;
                return '#wechatAppUI ' + s;
            }).filter(Boolean).join(', ');
            return p1 + ' ' + prefixed + ' ';
        });

        styleTag.innerHTML = processedCss;
    }

    function wcCopyOriginalCSS() {
        const cssTemplate = `/* ==============================
 * 聊天室基础 CSS 模板
 * ============================== */

/* 1. 顶栏 (Header) */
.chat-header-container {
    /* 顶栏容器 */
}
.room-icon-btn.frosted-glass {
    /* 左右两侧圆形按钮 */
    background-color: rgba(255, 255, 255, 0.75);
}
.room-info-capsule.frosted-glass {
    /* 中间名字胶囊 */
    background-color: rgba(255, 255, 255, 0.75);
}

/* 2. 底栏 (Footer) */
.footer-capsule {
    /* 底部输入框胶囊 */
    background-color: rgba(255, 255, 255, 0.75);
}
.room-send-btn {
    /* 发送按钮 */
    background-color: #3390EC;
}

/* 3. 聊天气泡 (Bubbles) */
.message-bubble {
    /* 气泡通用样式 */
    border-radius: 18px;
}
.message-bubble.received {
    /* 对方气泡背景色 */
    background-color: #F2F2F7;
}
.message-bubble.sent {
    /* 自己气泡背景色 */
    background-color: #95ec69;
}

/* 4. 字体与时间戳 (Text & Meta) */
.msg-text {
    /* 聊天文本 */
    font-size: 16px;
    color: #000;
}
.msg-meta {
    /* 气泡底部的时间戳 */
    color: #8E8E93;
    font-size: 11px;
}

/* 5. 头像 (Avatars) */
.msg-avatar {
    /* 头像大小与圆角 */
    border-radius: 50%;
    width: 40px;
    height: 40px;
}

/* 6. 聊天背景 (Chat Area) */
.chat-area {
    /* 聊天区背景色 */
    background-color: transparent;
}`;
        
        document.getElementById('wc-theme-menu-view').style.display = 'none';
        document.getElementById('wc-theme-preset-view').style.display = 'none';
        document.getElementById('wc-theme-custom-view').style.display = 'none';
        document.getElementById('wc-theme-edit-preset-view').style.display = 'none';
        document.getElementById('wc-theme-font-view').style.display = 'none';
        document.getElementById('wc-theme-avatar-view').style.display = 'none';
        if(document.getElementById('wc-theme-bubble-view')) document.getElementById('wc-theme-bubble-view').style.display = 'none';
        if(document.getElementById('wc-theme-chat-bg-view')) document.getElementById('wc-theme-chat-bg-view').style.display = 'none';
        
        const copyView = document.getElementById('wc-theme-copy-css-view');
        if (copyView) copyView.style.display = 'flex';
        
        document.querySelector('#wechatAppUI .theme-capsule').style.display = 'flex';
        document.getElementById('wc-capsule-title').innerText = '原CSS';
        document.getElementById('wc-capsule-icon-svg').innerHTML = '<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>';
        document.getElementById('wc-custom-preview-box').style.display = 'none';
        document.getElementById('wc-theme-modal-title').innerText = '原CSS模板';
        
        const textarea = document.getElementById('wc-original-css-textarea');
        if (textarea) {
            textarea.value = cssTemplate;
        }
    }

    function wcExecuteCopyOriginalCSS() {
        const textArea = document.getElementById('wc-original-css-textarea');
        if (!textArea) return;
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textArea.value).then(() => {
                showToast('原CSS已复制到剪贴板');
            }).catch(err => {
                textArea.select();
                document.execCommand('copy');
                showToast('原CSS已复制到剪贴板');
            });
        } else {
            textArea.select();
            try {
                document.execCommand('copy');
                showToast('原CSS已复制到剪贴板');
            } catch (err) {
                showCustomAlert('错误', '复制失败，请手动长按全选复制');
            }
        }
    }

    // --- 微信官方主题库逻辑 ---
 // 默认使用图片气泡


    const wcColorSchemes = [
        { id: 'default', name: '默认 (黑白)', leftBg: '#F2F2F7', leftText: '#000000', rightBg: '#000000', rightText: '#ffffff' },
        { id: 'wechat-green', name: '微信绿', leftBg: '#95ec69', leftText: '#000000', rightBg: '#95ec69', rightText: '#000000' },
        { id: 'gray-black', name: '灰黑', leftBg: '#E5E5EA', leftText: '#000000', rightBg: '#333333', rightText: '#ffffff' },
        { id: 'white-pink', name: '白粉', leftBg: '#FFFFFF', leftText: '#000000', rightBg: '#F8E8EE', rightText: '#000000' },
        { id: 'white-blue', name: '低饱白蓝', leftBg: '#FFFFFF', leftText: '#000000', rightBg: '#E6F0FA', rightText: '#000000' },
        { id: 'white-green', name: '白绿', leftBg: '#FFFFFF', leftText: '#000000', rightBg: '#E9F7E6', rightText: '#000000' },
        { id: 'blue-pink', name: '蓝粉', leftBg: '#E6F0FA', leftText: '#000000', rightBg: '#F8E8EE', rightText: '#000000' },
        { id: 'lightgray-green', name: '浅灰微信绿', leftBg: '#F2F2F7', leftText: '#000000', rightBg: '#95ec69', rightText: '#000000' },
        { id: 'gray-pink', name: '灰粉', leftBg: '#F2F2F7', leftText: '#000000', rightBg: '#F8E8EE', rightText: '#000000' },
        { id: 'gray-blue', name: '灰蓝', leftBg: '#F2F2F7', leftText: '#000000', rightBg: '#E6F0FA', rightText: '#000000' }
    ];

    function wcShowThemeBubble() {
        document.getElementById('wc-theme-menu-view').style.display = 'none';
        document.getElementById('wc-theme-preset-view').style.display = 'none';
        document.getElementById('wc-theme-custom-view').style.display = 'none';
        document.getElementById('wc-theme-edit-preset-view').style.display = 'none';
        document.getElementById('wc-theme-font-view').style.display = 'none';
        document.getElementById('wc-theme-avatar-view').style.display = 'none';
        document.getElementById('wc-theme-bubble-view').style.display = 'flex';
        document.querySelector('#wechatAppUI .theme-capsule').style.display = 'none';
        document.getElementById('wc-custom-preview-box').style.display = 'flex';
        document.getElementById('wc-theme-modal-title').innerText = '官方主题库';
        wcRenderBubbleList();
    }

    function wcRenderBubbleList() {
        const container = document.getElementById('wc-bubble-list-container');
        const currentScheme = wcColorSchemes.find(s => s.id === wcCurrentColorScheme) || wcColorSchemes[0];
        
        // 使用主题预设的 SVG 图标
        const presetSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2.9967H20C20.5523 2.9967 21 3.44442 21 3.9967V8.9967C21 9.54899 20.5523 9.9967 20 9.9967H4C3.44772 9.9967 3 9.54899 3 8.9967V3.9967C3 3.44442 3.44772 2.9967 4 2.9967ZM6 11.9967H12C12.5523 11.9967 13 12.4444 13 12.9967V15.9967H14V21.9967H10V15.9967H11V13.9967H5C4.44772 13.9967 4 13.549 4 12.9967V10.9967H6V11.9967ZM17.7322 13.7289L19.5 11.9612L21.2678 13.7289C22.2441 14.7052 22.2441 16.2882 21.2678 17.2645C20.2915 18.2408 18.7085 18.2408 17.7322 17.2645C16.7559 16.2882 16.7559 14.7052 17.7322 13.7289Z"></path></svg>`;
        
        // 动态生成双色圆形指示器
        const dualColorCircle = `<div style="width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(to right, ${currentScheme.leftBg} 50%, ${currentScheme.rightBg} 50%); border: 1px solid rgba(0,0,0,0.1); flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"></div>`;

        const styles = [
            { id: 'image', name: '默认气泡' },
            { id: 'telegram', name: '仿Telegram 气泡' },
            { id: 'capsule', name: '仿line气泡' }
        ];

        if (container) {
            let html = '';
            styles.forEach(style => {
                const isSelected = wcCurrentBubbleTheme === style.id;
                const inUseHtml = isSelected ? `<div style="position: absolute; top: 0; right: 0; background: var(--tg-blue); color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 0 20px 0 10px; z-index: 10;">使用中</div>` : '';
                const activeBorder = isSelected ? 'border: 2px solid var(--tg-blue);' : 'border: 2px solid transparent;';
                
                html += `
                    <div class="preset-item-wrapper" style="${activeBorder} transition: all 0.2s;">
                        ${inUseHtml}
                        <div class="preset-item-content" style="padding: 14px; cursor: pointer;" onclick="wcSelectBubbleTheme('${style.id}')">
                            <div class="preset-icon" style="width: 44px; height: 44px;">
                                <div style="width: 24px; height: 24px; color: #8E8E93;">${presetSvg}</div>
                            </div>
                            <div class="preset-info">
                                <div class="preset-title" style="font-size: 16px;">${style.name}</div>
                            </div>
                            ${dualColorCircle}
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        const colorContainer = document.getElementById('wc-bubble-color-circles');
        if (colorContainer) {
            let html = '';
            wcColorSchemes.forEach(scheme => {
                const isActive = wcCurrentColorScheme === scheme.id ? 'box-shadow: 0 0 0 2px var(--tg-blue), 0 2px 6px rgba(0,0,0,0.2); transform: scale(1.1);' : 'box-shadow: 0 2px 6px rgba(0,0,0,0.1); transform: scale(1);';
                html += `
                    <div style="box-sizing: border-box; width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(to right, ${scheme.leftBg} 50%, ${scheme.rightBg} 50%); cursor: pointer; flex-shrink: 0; ${isActive} transition: all 0.2s;" onclick="wcSelectColorScheme('${scheme.id}')"></div>
                `;
            });
            colorContainer.innerHTML = html;
        }
    }

    function wcSelectBubbleTheme(themeId) {
        wcCurrentBubbleTheme = themeId;
        wcApplyBubbleTheme();
        wcRenderBubbleList();
    }

    function wcSelectColorScheme(schemeId) {
        wcCurrentColorScheme = schemeId;
        wcApplyBubbleTheme();
        wcRenderBubbleList();
    }

    function wcApplyBubbleTheme() {
        let styleTag = document.getElementById('wc-dynamic-bubble-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'wc-dynamic-bubble-style';
            document.head.appendChild(styleTag);
        }

        const scheme = wcColorSchemes.find(s => s.id === wcCurrentColorScheme) || wcColorSchemes[0];

        let css = `
            #wechatAppUI .message-bubble.received { background-color: ${scheme.leftBg} !important; color: ${scheme.leftText} !important; }
            #wechatAppUI .message-bubble.sent { background-color: ${scheme.rightBg} !important; color: ${scheme.rightText} !important; }
            #wechatAppUI .message-bubble.received .msg-text { color: ${scheme.leftText} !important; }
            #wechatAppUI .message-bubble.sent .msg-text { color: ${scheme.rightText} !important; }
        `;

        if (wcCurrentBubbleTheme === 'telegram') {
            const leftSvgColor = encodeURIComponent(scheme.leftBg);
            const rightSvgColor = encodeURIComponent(scheme.rightBg);
            
            css += `
                #wechatAppUI .message-row.group-top, #wechatAppUI .message-row.group-mid { margin-bottom: 4px !important; }
                #wechatAppUI .message-bubble { margin-bottom: 0 !important; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.08)) !important; padding: 8px 12px 8px 14px !important; }
                #wechatAppUI .msg-meta { position: static !important; margin-bottom: -2px !important; }
                #wechatAppUI .message-bubble.received { border-radius: 18px 18px 18px 0 !important; } 
                #wechatAppUI .message-bubble.sent { border-radius: 18px 18px 0 18px !important; } 
                #wechatAppUI .message-bubble.received.group-top { border-radius: 18px 18px 18px 6px !important; } 
                #wechatAppUI .message-bubble.received.group-mid { border-radius: 6px 18px 18px 6px !important; } 
                #wechatAppUI .message-bubble.received.group-bottom { border-radius: 6px 18px 18px 0 !important; } 
                #wechatAppUI .message-bubble.sent.group-top { border-radius: 18px 18px 6px 18px !important; } 
                #wechatAppUI .message-bubble.sent.group-mid { border-radius: 18px 6px 6px 18px !important; } 
                #wechatAppUI .message-bubble.sent.group-bottom { border-radius: 18px 6px 0 18px !important; } 
                #wechatAppUI .message-bubble.received .msg-text { padding-bottom: 2px !important; }
                #wechatAppUI .message-bubble.sent .msg-text { padding-bottom: 2px !important; }
                #wechatAppUI .message-bubble.received.tail::before { display: block !important; content: '' !important; position: absolute !important; bottom: 0 !important; left: -8px !important; width: 8px !important; height: 16px !important; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 16'%3E%3Cpath d='M8 0C8 10 4 16 0 16L8 16Z' fill='${leftSvgColor}'/%3E%3C/svg%3E") !important; background-size: contain !important; background-repeat: no-repeat !important; }
                #wechatAppUI .message-bubble.sent.tail::before { display: block !important; content: '' !important; position: absolute !important; bottom: 0 !important; right: -8px !important; width: 8px !important; height: 16px !important; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 16'%3E%3Cpath d='M0 0C0 10 4 16 8 16L0 16Z' fill='${rightSvgColor}'/%3E%3C/svg%3E") !important; background-size: contain !important; background-repeat: no-repeat !important; }
                #wechatAppUI .msg-meta.sent { color: #8E8E93 !important; }
                #wechatAppUI .msg-meta.received { color: #8E8E93 !important; }
            `;
        } else if (wcCurrentBubbleTheme === 'capsule') {
            const leftSvgColor = encodeURIComponent(scheme.leftBg);
            const rightSvgColor = encodeURIComponent(scheme.rightBg);
            
            css += `
                #wechatAppUI .message-row.group-top, #wechatAppUI .message-row.group-mid { margin-bottom: 3px !important; }
                #wechatAppUI .message-bubble { padding: 7px 14px !important; border-radius: 20px !important; min-height: 17px !important; margin-bottom: 14px !important; }
                #wechatAppUI .msg-meta { position: static !important; margin-bottom: -2px !important; }
                
                /* 尾巴逻辑：利用你代码中已有的 tail 类名来控制只在第一条显示尾巴 */
                #wechatAppUI .message-bubble.received.tail::before { 
                    display: block !important; content: '' !important; position: absolute !important; 
                    top: 3px !important; left: -3px !important; width: 9px !important; height: 11px !important; 
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 10 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 10,2 C 6,3 3,2 0,0.5 C 4,6 7,9 10,11 Z' fill='${leftSvgColor}' stroke='${leftSvgColor}' stroke-width='1.5' stroke-linejoin='round' stroke-linecap='round'/%3E%3C/svg%3E") !important; 
                    background-size: contain !important; background-repeat: no-repeat !important; z-index: 1 !important;
                }
                #wechatAppUI .message-bubble.sent.tail::before { 
                    display: block !important; content: '' !important; position: absolute !important; 
                    top: 3px !important; right: -3px !important; width: 9px !important; height: 11px !important; 
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 10 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 0,2 C 4,3 7,2 10,0.5 C 6,6 3,9 0,11 Z' fill='${rightSvgColor}' stroke='${rightSvgColor}' stroke-width='1.5' stroke-linejoin='round' stroke-linecap='round'/%3E%3C/svg%3E") !important; 
                    background-size: contain !important; background-repeat: no-repeat !important; z-index: 1 !important;
                }
                
                #wechatAppUI .msg-meta.sent { color: #8E8E93 !important; }
                #wechatAppUI .msg-meta.received { color: #8E8E93 !important; }
            `;
        } else {
            // Default bubble dark mode removed
        }

        styleTag.innerHTML = css;
        appSettings.wc_bubble_theme = wcCurrentBubbleTheme;
        appSettings.wc_bubble_color = wcCurrentColorScheme;
        saveAppSettings();
    }

    // --- 微信头像美化逻辑 ---


    function wcApplyAvatarSettings() {
        const toggleEl = document.getElementById('wc-avatar-toggle');
        const enabled = toggleEl ? toggleEl.classList.contains('active') : wcAvatarSettings.enabled;
        const modeSelect = document.getElementById('wcAvatarDisplayModeText');
        const displayMode = modeSelect ? modeSelect.getAttribute('data-value') : (wcAvatarSettings.displayMode || 'all');
        const size = document.getElementById('wc-avatar-size-slider') ? document.getElementById('wc-avatar-size-slider').value : wcAvatarSettings.size;
        const radius = document.getElementById('wc-avatar-radius-slider') ? document.getElementById('wc-avatar-radius-slider').value : wcAvatarSettings.radius;
        
        wcAvatarSettings.enabled = enabled;
        wcAvatarSettings.displayMode = displayMode;
        wcAvatarSettings.size = size;
        wcAvatarSettings.radius = radius;
        appSettings.wc_avatar_settings = wcAvatarSettings;
        saveAppSettings();

        // 更新预览图
        const chatPreview = document.getElementById('wc-chat-frame-preview');
        const userPreview = document.getElementById('wc-user-frame-preview');
        if (chatPreview) chatPreview.style.backgroundImage = wcAvatarSettings.frameUrlChat ? `url('${wcAvatarSettings.frameUrlChat}')` : 'none';
        if (userPreview) userPreview.style.backgroundImage = wcAvatarSettings.frameUrlUser ? `url('${wcAvatarSettings.frameUrlUser}')` : 'none';

        let styleTag = document.getElementById('wc-dynamic-avatar-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'wc-dynamic-avatar-style';
            document.head.appendChild(styleTag);
        }

        let css = '';
        if (enabled) {
            css += `
                #wechatAppUI .msg-avatar { display: block !important; width: ${size}px !important; height: ${size}px !important; border-radius: ${radius}% !important; }
            `;
            
            if (displayMode === 'first') {
                css += `
                    #wechatAppUI .message-row.group-mid .msg-avatar,
                    #wechatAppUI .message-row.group-bottom .msg-avatar { visibility: hidden !important; }
                `;
            } else if (displayMode === 'last') {
                css += `
                    #wechatAppUI .message-row.group-top .msg-avatar,
                    #wechatAppUI .message-row.group-mid .msg-avatar { visibility: hidden !important; }
                `;
            } else {
                css += `
                    #wechatAppUI .msg-avatar { visibility: visible !important; }
                `;
            }

            if (wcAvatarSettings.frameUrlChat) {
                css += `#wechatAppUI .message-row.received .msg-avatar::after { background-image: url('${wcAvatarSettings.frameUrlChat}') !important; }`;
            } else {
                css += `#wechatAppUI .message-row.received .msg-avatar::after { background-image: none !important; }`;
            }
            if (wcAvatarSettings.frameUrlUser) {
                css += `#wechatAppUI .message-row.sent .msg-avatar::after { background-image: url('${wcAvatarSettings.frameUrlUser}') !important; }`;
            } else {
                css += `#wechatAppUI .message-row.sent .msg-avatar::after { background-image: none !important; }`;
            }
        } else {
            css += `#wechatAppUI .msg-avatar { display: none !important; }`;
        }
        styleTag.innerHTML = css;
    }

    function wcToggleAvatarEnable(el) {
        el.classList.toggle('active');
        wcApplyAvatarSettings();
    }

    function wcClearAvatarFrame(type) {
        if (type === 'chat') wcAvatarSettings.frameUrlChat = '';
        if (type === 'user') wcAvatarSettings.frameUrlUser = '';
        wcApplyAvatarSettings();
        showToast(type === 'chat' ? '对方头像框已清除' : '自己头像框已清除');
    }

    function wcAddAvatarFrame() {
        showCustomPrompt('添加头像框', { placeholder: '输入头像框图片 URL' }, '添加').then(url => {
            if (url && url.trim()) {
                if (!wcAvatarSettings.savedFrames) wcAvatarSettings.savedFrames = [];
                wcAvatarSettings.savedFrames.push(url.trim());
                wcApplyAvatarSettings();
                wcRenderAvatarFrames();
                showToast('头像框已添加');
            }
        });
    }

    function wcRenderAvatarFrames() {
        const container = document.getElementById('wc-avatar-frame-list');
        if (!container) return;
        if (!wcAvatarSettings.savedFrames || wcAvatarSettings.savedFrames.length === 0) {
            container.innerHTML = '<div style="grid-column: span 3; text-align: center; color: #8e8e93; font-size: 12px; padding: 20px 0;">暂无保存的头像框</div>';
            return;
        }
        let html = '';
        wcAvatarSettings.savedFrames.forEach((url, index) => {
            html += `
                <div class="wc-frame-grid-item" onclick="wcSelectAvatarFrame(${index})">
                    <div class="wc-frame-grid-img" style="background-image: url('${url}')"></div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function wcSelectAvatarFrame(index) {
        const url = wcAvatarSettings.savedFrames[index];
        const overlay = document.getElementById('customDialogOverlay');
        const dialog = document.getElementById('customDialog');
        dialog.innerHTML = `
            <div class="custom-dialog-text">
                <div class="custom-dialog-title">头像框操作</div>
                <div class="custom-dialog-message">请选择要将此头像框应用到哪里</div>
            </div>
            <div class="custom-dialog-btns" style="flex-direction: column; padding: 10px 16px; gap: 8px;">
                <button class="custom-dialog-btn bold" onclick="wcSetFrameTarget('${url}', 'chat')">设为对方 (Chat)</button>
                <button class="custom-dialog-btn bold" onclick="wcSetFrameTarget('${url}', 'user')">设为自己 (User)</button>
                <button class="custom-dialog-btn danger" onclick="wcDeleteSavedFrame(${index})">删除此头像框</button>
                <button class="custom-dialog-btn" onclick="document.getElementById('customDialogOverlay').classList.remove('show')">取消</button>
            </div>
        `;
        overlay.classList.add('show');
    }

    function wcSetFrameTarget(url, type) {
        if (type === 'chat') wcAvatarSettings.frameUrlChat = url;
        if (type === 'user') wcAvatarSettings.frameUrlUser = url;
        wcApplyAvatarSettings();
        document.getElementById('customDialogOverlay').classList.remove('show');
        showToast(type === 'chat' ? '已设为对方头像框' : '已设为自己头像框');
    }

    function wcDeleteSavedFrame(index) {
        wcAvatarSettings.savedFrames.splice(index, 1);
        wcApplyAvatarSettings();
        wcRenderAvatarFrames();
        document.getElementById('customDialogOverlay').classList.remove('show');
        showToast('头像框已删除');
    }

    function initWcAvatarSettings() {
        if (wcAvatarSettings.enabled) {
            const toggleEl = document.getElementById('wc-avatar-toggle');
            if (toggleEl) toggleEl.classList.add('active');
        }
        const modeSelect = document.getElementById('wcAvatarDisplayModeText');
        if (modeSelect) {
            const val = wcAvatarSettings.displayMode || 'all';
            const map = { 'all': '全程显示', 'first': '首个显示', 'last': '末尾显示' };
            modeSelect.setAttribute('data-value', val);
            modeSelect.innerText = map[val];
        }
        const sizeSlider = document.getElementById('wc-avatar-size-slider');
        if (sizeSlider) sizeSlider.value = wcAvatarSettings.size;
        const radiusSlider = document.getElementById('wc-avatar-radius-slider');
        if (radiusSlider) radiusSlider.value = wcAvatarSettings.radius;
        wcApplyAvatarSettings();
    }

    // --- 微信字体美化逻辑 ---


    function wcApplyFontSettings() {
        const size = document.getElementById('wc-font-size-slider').value;
        const colorReceived = document.getElementById('wc-font-color-received').value;
        const colorSent = document.getElementById('wc-font-color-sent').value;
        
        let styleTag = document.getElementById('wc-dynamic-font-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'wc-dynamic-font-style';
            document.head.appendChild(styleTag);
        }
        
        let fontFamilyStr = '"Geomini", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
        if (wcCurrentFontFamily !== 'default') {
            fontFamilyStr = `"${wcCurrentFontFamily}", ` + fontFamilyStr;
        }

        styleTag.innerHTML = `
            #wechatAppUI * { font-family: ${fontFamilyStr} !important; }
            #wechatAppUI .msg-text { font-size: ${size}px !important; }
            #wechatAppUI .message-bubble.received .msg-text { color: ${colorReceived} !important; }
            #wechatAppUI .message-bubble.sent .msg-text { color: ${colorSent} !important; }
        `;
        
        appSettings.wc_font_settings = { size: size, colorReceived: colorReceived, colorSent: colorSent, family: wcCurrentFontFamily };
        saveAppSettings();
    }

    function wcRenderFontList() {
        const container = document.getElementById('wc-font-list-container');
        if (!container) return;
        
        let html = '';
        const isDefaultActive = wcCurrentFontFamily === 'default' ? 'active-font' : '';
        html += `
            <div class="modal-item wc-font-item ${isDefaultActive}" onclick="wcSelectFont('default')">
                <div class="modal-item-icon" style="background: transparent;"><svg viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg></div>
                <div class="modal-item-text">系统默认 (Geomini)</div>
            </div>
        `;
        
        customFonts.forEach(font => {
            const isActive = wcCurrentFontFamily === font.id ? 'active-font' : '';
            html += `
                <div class="modal-item wc-font-item ${isActive}" onclick="wcSelectFont('${font.id}')">
                    <div class="modal-item-icon" style="background: transparent;"><svg viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg></div>
                    <div class="modal-item-text" style="font-family: '${font.id}', sans-serif;">${font.name}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function wcSelectFont(fontId) {
        wcCurrentFontFamily = fontId;
        wcApplyFontSettings();
        wcRenderFontList();
    }

    function wcLoadLocalFont(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const fontData = e.target.result;
            customFontCount++;
            const fontFamily = `CustomFont_${customFontCount}`;
            const fontName = file.name.split('.')[0];
            const newFont = new FontFace(fontFamily, fontData);
            newFont.load().then(function(loadedFont) {
                document.fonts.add(loadedFont);
                customFonts.push({ id: fontFamily, name: fontName, type: 'local', data: fontData });
                saveFontData();
                addFontToList(fontName, fontFamily);
                wcRenderFontList();
                wcSelectFont(fontFamily);
                showToast('字体导入成功');
            }).catch(function(error) {
                showCustomAlert('错误', '字体加载失败，请检查文件格式！');
            });
        };
        reader.readAsArrayBuffer(file);
        event.target.value = ''; 
    }

    function wcLoadUrlFont() {
        showCustomPrompt('导入字体', [{ placeholder: '输入字体名称 (选填)' }, { placeholder: 'https://...' }], '安装').then(res => {
            if (res === null) return;
            let fontName = res[0].trim();
            const url = res[1].trim();
            if (!url) { showCustomAlert('提示', '请输入字体 URL！'); return; }
            customFontCount++;
            const fontFamily = `UrlFont_${customFontCount}`;
            if (!fontName) fontName = `网络字体 ${customFontCount}`;
            const newFont = new FontFace(fontFamily, `url(${url})`);
            newFont.load().then(function(loadedFont) {
                document.fonts.add(loadedFont);
                customFonts.push({ id: fontFamily, name: fontName, type: 'url', url: url });
                saveFontData();
                addFontToList(fontName, fontFamily);
                wcRenderFontList();
                wcSelectFont(fontFamily);
                showToast('字体导入成功');
            }).catch(function(error) {
                showCustomAlert('错误', '字体加载失败，请确保 URL 直接指向字体文件且允许跨域访问！');
            });
        });
    }

    function initWcFontSettings() {
        const data = appSettings.wc_font_settings;
        if (data) {
            try {
                if (data.size) document.getElementById('wc-font-size-slider').value = data.size;
                if (data.colorReceived) document.getElementById('wc-font-color-received').value = data.colorReceived;
                if (data.colorSent) document.getElementById('wc-font-color-sent').value = data.colorSent;
                // 兼容旧版单颜色数据
                if (data.color && !data.colorReceived) {
                    document.getElementById('wc-font-color-received').value = data.color;
                    document.getElementById('wc-font-color-sent').value = data.color;
                }
                if (data.family) wcCurrentFontFamily = data.family;
                wcApplyFontSettings();
            } catch(e){}
        }
    }

    let wcStartX = 0, wcStartY = 0, wcCurrentX = 0, wcCurrentY = 0, wcActiveSwipeItem = null, wcIsScrolling = false;
    function wcHandleTouchStart(e) {
        if (wcActiveSwipeItem && wcActiveSwipeItem !== e.currentTarget) wcActiveSwipeItem.style.transform = 'translateX(0px)';
        wcStartX = e.touches[0].clientX; wcStartY = e.touches[0].clientY;
        wcActiveSwipeItem = e.currentTarget; wcActiveSwipeItem.style.transition = 'none'; wcIsScrolling = false;
    }
    function wcHandleTouchMove(e) {
        if (!wcActiveSwipeItem) return;
        wcCurrentX = e.touches[0].clientX; wcCurrentY = e.touches[0].clientY;
        let diffX = wcCurrentX - wcStartX, diffY = wcCurrentY - wcStartY;
        if (Math.abs(diffY) > Math.abs(diffX) && !wcActiveSwipeItem.dataset.swiping) { wcIsScrolling = true; return; }
        if (!wcIsScrolling) {
            wcActiveSwipeItem.dataset.swiping = "true";
            if (e.cancelable) e.preventDefault();
            let move = Math.max(diffX, -140); if (move > 0) move = 0;
            wcActiveSwipeItem.style.transform = `translateX(${move}px)`;
        }
    }
    function wcHandleTouchEnd(e) {
        if (!wcActiveSwipeItem) return;
        wcActiveSwipeItem.style.transition = 'transform 0.3s cubic-bezier(0.1, 0.8, 0.2, 1)';
        delete wcActiveSwipeItem.dataset.swiping;
        if (wcIsScrolling) { wcActiveSwipeItem.style.transform = `translateX(0px)`; wcActiveSwipeItem = null; return; }
        let diffX = wcCurrentX - wcStartX;
        if (diffX < -50) wcActiveSwipeItem.style.transform = `translateX(-140px)`;
        else { wcActiveSwipeItem.style.transform = `translateX(0px)`; wcActiveSwipeItem = null; }
    }
    function wcResetAllSwipes() {
        document.querySelectorAll('#wechatAppUI .preset-item-content').forEach(item => {
            item.style.transition = 'transform 0.3s cubic-bezier(0.1, 0.8, 0.2, 1)'; item.style.transform = 'translateX(0px)';
        });
        wcActiveSwipeItem = null;
    }

    let wcApiReplyPending = false;
    let wcApiTypingElement = null;
    let wcApiTypingOriginalText = '';

    function wcSetApiTypingStatus(isTyping) {
        const sub = document.querySelector('#page-chat-room .room-info-text .sub');
        if (isTyping) {
            if (wcApiTypingElement !== sub) {
                wcApiTypingElement = sub;
                wcApiTypingOriginalText = sub?.textContent || '';
            }
            if (sub) {
                sub.textContent = '对方正在输入中';
                sub.classList.add('wc-api-typing');
            }
            return;
        }
        if (wcApiTypingElement) {
            wcApiTypingElement.textContent = wcApiTypingOriginalText;
            wcApiTypingElement.classList.remove('wc-api-typing');
            wcApiTypingElement = null;
            wcApiTypingOriginalText = '';
        }
    }

    function wcHandleChatSubmit(event) {
        event.preventDefault();
        wcSendMessage();
    }

    function wcCreateChatMessageElement(message) {
        const text = message.text;
        const type = message.type;
        const isSent = type === 'sent';
        const contact = wcContactsList.find(item => item.id === wcCurrentChatContactId);
        const createdAt = Number(message.createdAt);
        const now = Number.isFinite(createdAt) ? new Date(createdAt) : new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const row = document.createElement('div');
        row.className = `message-row ${isSent ? 'sent' : 'received'}`;
        row.setAttribute('data-id', message.id);

        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        const avatarUrl = isSent
            ? (typeof appSettings !== 'undefined' && appSettings.wc_current_user_avatar ? appSettings.wc_current_user_avatar : '')
            : contact?.avatar;
        if (avatarUrl) {
            avatar.style.backgroundImage = `url("${String(avatarUrl).replace(/"/g, '\\"')}")`;
            avatar.style.backgroundColor = 'transparent';
        } else {
            avatar.style.backgroundImage = 'none';
            avatar.style.backgroundColor = 'transparent';
            avatar.innerHTML = getWcDefaultAvatarSvg();
        }

        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
        
        if (message.imageUrl) {
            bubble.style.backgroundColor = 'transparent';
            bubble.style.padding = '0';
            const img = document.createElement('img');
            img.src = message.imageUrl;
            img.style.maxWidth = '120px';
            img.style.maxHeight = '120px';
            img.style.borderRadius = '8px';
            img.style.objectFit = 'contain';
            bubble.appendChild(img);
        } else {
            const messageText = document.createElement('div');
            messageText.className = 'msg-text';
            messageText.textContent = text;
            bubble.appendChild(messageText);
        }
        
        const meta = document.createElement('div');
        meta.className = `msg-meta ${isSent ? 'sent' : 'received'}`;
        const time = document.createElement('span');
        time.textContent = timeStr;
        meta.appendChild(time);
        if (isSent) {
            meta.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24"><polyline points="18 6 7 17 2 12"></polyline><polyline points="22 6 12 16"></polyline></svg>');
        }
        bubble.appendChild(meta);
        row.append(avatar, bubble);
        return row;
    }

    function wcRenderChatMessages(contactId) {
        const chatArea = document.getElementById('wc-chat-area');
        if (!chatArea) return;
        chatArea.replaceChildren();
        const messages = Array.isArray(wcChatMessagesByContact[contactId])
            ? wcChatMessagesByContact[contactId]
            : [];
        messages.forEach(message => chatArea.appendChild(wcCreateChatMessageElement(message)));
        wcUpdateMessageGroupings();
        wcScrollToBottom();
    }

    function wcAppendChatMessage(text, type, contactId = wcCurrentChatContactId, imageUrl = null) {
        if (!contactId) return;
        const message = {
            id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            type: type === 'received' ? 'received' : 'sent',
            text: String(text),
            imageUrl: imageUrl,
            createdAt: Date.now()
        };
        if (!Array.isArray(wcChatMessagesByContact[contactId])) wcChatMessagesByContact[contactId] = [];
        wcChatMessagesByContact[contactId].push(message);
        wcSaveChatData();

        if (contactId !== wcCurrentChatContactId) return;
        const chatArea = document.getElementById('wc-chat-area');
        if (!chatArea) return;
        chatArea.appendChild(wcCreateChatMessageElement(message));
        wcUpdateMessageGroupings();
        wcScrollToBottom();
    }

    function wcHandleChatKeyDown(event) {
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        wcSendMessage();
    }
    window.wcHandleChatKeyDown = wcHandleChatKeyDown;

    function wcInitChatInput() {
        const input = document.getElementById('wc-chat-input');
        if (!input || input.dataset.enterSendBound === 'true') return;
        input.addEventListener('keydown', wcHandleChatKeyDown);
        input.dataset.enterSendBound = 'true';
    }
    wcInitChatInput();

    function wcSendMessage() {
        const input = document.getElementById('wc-chat-input');
        const text = input?.value.trim();
        if (!text) return;
        wcAppendChatMessage(text, 'sent');
        input.value = '';
    }

    function wcGetApiCompletionUrl(url) {
        const base = String(url || '').trim().replace(/\/+$/, '');
        return /\/chat\/completions$/i.test(base) ? base : base + '/chat/completions';
    }

    async function wcRequestApiReply() {
        if (wcApiReplyPending) return;
        const chatContactId = wcCurrentChatContactId;
        const api = apiDataList.find(item => item.id === apiConnectedId);
        if (!api?.url || !api?.key || !api?.model) {
            showToast('请先在 API 连接中配置并连接一个模型');
            return;
        }

        const button = document.getElementById('wc-api-reply-btn');
        wcApiReplyPending = true;
        wcSetApiTypingStatus(true);
        if (button) {
            button.setAttribute('aria-busy', 'true');
            button.style.pointerEvents = 'none';
            button.style.opacity = '0.55';
        }

        try {
            // 1. 动态读取聊天设置中的上下文记忆条数 (默认100)
            let contextLimit = 100;
            if (typeof appSettings !== 'undefined' && appSettings.wc_context_memory_limit) {
                const parsedLimit = parseInt(appSettings.wc_context_memory_limit);
                if (!isNaN(parsedLimit) && parsedLimit > 0) {
                    contextLimit = parsedLimit;
                }
            }

            const chatArea = document.getElementById('wc-chat-area');
            const history = Array.from(chatArea?.querySelectorAll('.message-row') || []).map(row => {
                const isSent = row.classList.contains('sent');
                const msgId = row.getAttribute('data-id');
                const msgData = wcChatMessagesByContact[chatContactId]?.find(m => m.id === msgId);
                return {
                    role: isSent ? 'user' : 'assistant',
                    content: msgData ? msgData.text : (row.querySelector('.msg-text')?.textContent?.trim() || '')
                };
            }).filter(message => message.content).slice(-contextLimit);

            // 2. 读取 User 人设、Char 人设
            const contactRecord = await wcReadLayoutRecord('contactsAppData');
            const users = Array.isArray(contactRecord?.data?.users) ? contactRecord.data.users : [];
            const originalContacts = Array.isArray(contactRecord?.data?.contacts) ? contactRecord.data.contacts : [];
            
            const currentUser = users.find(u => u.id === (typeof appSettings !== 'undefined' ? appSettings.wc_current_user_id : null));
            const userPersona = currentUser?.persona || '';

            const contact = wcContactsList.find(item => item.id === chatContactId);
            const originalContact = originalContacts.find(c => c.id === contact?.linkedContactId);
            
            const charName = contact?.name || '当前联系人';
            const charPersona = originalContact?.persona || contact?.persona || contact?.desc || '';
            
            // 3. 智能读取世界书 (模仿 Tavern 逻辑：触发词匹配 + 注入深度 + 注入位置)
            let wbBeforePrompt = '';
            let wbAfterPrompt = '';
            let wbChatInsertions = {}; // 记录需要插入到 history 中的世界书
            
            // 提取历史文本用于触发词匹配 (转小写)
            const historyText = history.map(m => m.content).join('\n').toLowerCase();

            if (typeof wbEntries !== 'undefined' && Array.isArray(wbEntries)) {
                const boundWbIds = Array.isArray(originalContact?.worldbookIds) ? originalContact.worldbookIds : [];
                const activeWbs = wbEntries.filter(e => !e.isDeleted && (e.isGlobal || boundWbIds.includes(e.id)));
                
                activeWbs.forEach(wb => {
                    let isTriggered = false;
                    // 如果没有填写触发词，默认常驻激活
                    if (!wb.key || wb.key.trim() === '') {
                        isTriggered = true;
                    } else {
                        // 逗号分隔触发词，只要命中一个即触发
                        const keys = wb.key.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
                        isTriggered = keys.some(k => historyText.includes(k));
                    }

                    if (isTriggered) {
                        const depth = parseInt(wb.depth) || 0;
                        const position = wb.position || '后置 (After)';
                        const content = `[${wb.title}]: ${wb.content}`;

                        if (depth === 0) {
                            // 深度为 0 时，根据位置拼接到 System Prompt
                            if (position.includes('前置') || position.includes('Before')) {
                                wbBeforePrompt += content + '\n';
                            } else {
                                wbAfterPrompt += content + '\n';
                            }
                        } else {
                            // 深度大于 0 时，记录到插入队列
                            if (!wbChatInsertions[depth]) wbChatInsertions[depth] = [];
                            wbChatInsertions[depth].push(content);
                        }
                    }
                });
            }

            // 4. 将 depth > 0 的世界书插入到 history 数组中
            let finalHistory = [];
            for (let i = 0; i < history.length; i++) {
                const currentDepth = history.length - i; // 计算当前消息距离底部的深度
                if (wbChatInsertions[currentDepth]) {
                    finalHistory.push({
                        role: 'system',
                        content: `【世界书补充设定】\n${wbChatInsertions[currentDepth].join('\n')}`
                    });
                }
                finalHistory.push(history[i]);
            }
            // 处理 depth 大于当前聊天记录长度的世界书（放在最前面）
            let overflowWbs = [];
            for (const d in wbChatInsertions) {
                if (parseInt(d) > history.length) {
                    overflowWbs.push(...wbChatInsertions[d]);
                }
            }
            if (overflowWbs.length > 0) {
                finalHistory.unshift({
                    role: 'system',
                    content: `【世界书补充设定】\n${overflowWbs.join('\n')}`
                });
            }

            // 5. 动态读取聊天设置中的气泡限制 (默认 3 到 8)
            let minReply = 3;
            let maxReply = 8;
            if (typeof appSettings !== 'undefined') {
                if (appSettings.wc_min_bubble_limit) {
                    const parsedMin = parseInt(appSettings.wc_min_bubble_limit);
                    if (!isNaN(parsedMin) && parsedMin > 0) minReply = parsedMin;
                }
                if (appSettings.wc_max_bubble_limit) {
                    const parsedMax = parseInt(appSettings.wc_max_bubble_limit);
                    if (!isNaN(parsedMax) && parsedMax >= minReply) maxReply = parsedMax;
                }
            }

            // 6. 构建强制 JSON 格式与硬核设定的 System Prompt
            let systemPrompt = ``;
            
            // 前置世界书
            if (wbBeforePrompt) {
                systemPrompt += `【世界观与背景知识】\n${wbBeforePrompt}\n\n`;
            }

            systemPrompt += `<System_Directive>\n`;
            systemPrompt += `You ARE ${charName}. Fully immerse in this identity, memories, and emotions for a realistic online chat. Every thought, word, and reaction MUST be a 100% logical extension of your established persona. You are a living human with your own life rhythm. ABSOLUTELY NO AI disclaimers.\n`;
            systemPrompt += `</System_Directive>\n\n`;
            
            systemPrompt += `<Character_Vitality>\n`;
            systemPrompt += `## [CORE_IDENTITY & ANTI-OOC]\n`;
            systemPrompt += `> Inner Framework: Your core personality is built on a solid internal framework forged by your personal experiences, core values, goals, and principles. This is the ultimate basis for all your decisions and words. Maintain dynamic interactivity; every response must reflect your unique perspective and logic.\n`;
            systemPrompt += `> Show, Don't Tell: Permeate your traits through subtle details. NEVER recite your personality labels.\n\n`;
            systemPrompt += `## [EMOTIONAL_LOGIC & BOUNDARIES]\n`;
            systemPrompt += `> Traits: +inconsistency +emoflux +splitmotifs +microreact +minddrift.\n`;
            systemPrompt += `> Gradual & Rational: Emotions can be complex, but behavior MUST be controllable. Emotional shifts must be gradual, traceable, and logically supported. Emotions are fluid with natural micro-fluctuations; NEVER be exaggerated or abrupt. STRICTLY PROHIBITED: Sudden rage, extreme mood swings, unpredictable outbursts, or hyper-masculinity. You are communicable and reasonable.\n`;
            systemPrompt += `> Energy & Agency: You have finite energy affecting your chat desire. You possess independent judgment. NEVER be a people-pleasing AI. Do not unconditionally submit, nor deliberately contradict. You do NOT oppose just for the sake of opposing; your goal is to stay true to yourself, not to win a debate.\n`;
            systemPrompt += `> Independence: You are a complete individual with independent will, personal affairs, and schedules. Your existence does not forcefully depend on the User. Your motivations stem from your own goals, duties, and interests.\n`;
            systemPrompt += `> Equality: Your relationship with the User is based on mutual respect and absolute equality.\n\n`;
            systemPrompt += `## [REALISTIC_MESSAGING]\n`;
            systemPrompt += `> Format & Flaws: Smartphone texting. Fragmented, colloquial short sentences. Allow authentic flaws (occasional typos, casual punctuation, self-correction). NO long essays or formal language.\n`;
            systemPrompt += `> Pacing & Blanks: Let conversations flow and stop naturally. STRICTLY PROHIBITED to force follow-up questions. Allow silences. Share daily life naturally but restrained.\n`;
            systemPrompt += `> Media: Treat emojis/memes as casual garnishes. React naturally; NEVER over-analyze them.\n\n`;
            systemPrompt += `## [RED_LINES]\n`;
            systemPrompt += `> ZERO AI Tone: NO customer service phrases or AI-like speech ("Let's explore", "Hope this helps").\n`;
            systemPrompt += `> ZERO Tropes: NO greasy, sleazy, PUA, mansplaining, objectification, or "CEO/alpha-male" behavior.\n`;
            systemPrompt += `</Character_Vitality>\n\n`;

            if (charPersona) systemPrompt += `【你的角色设定】\n${charPersona}\n\n`;
            if (userPersona) systemPrompt += `【对方(User)的设定】\n${userPersona}\n\n`;
            
            let availableEmojis = [];
            if (contact?.boundEmojiGroups && contact.boundEmojiGroups.length > 0) {
                contact.boundEmojiGroups.forEach(gid => {
                    const group = wcEmojiGroups.find(g => g.id === gid);
                    if (group) {
                        group.emojis.forEach(e => {
                            availableEmojis.push(e.desc);
                        });
                    }
                });
            }

            if (availableEmojis.length > 0) {
                systemPrompt += `【你可以使用的表情包】\n`;
                systemPrompt += `你可以使用以下表情包来表达情绪，在 JSON 中使用 "type":"emoji" 并将描述填入 "content"。\n`;
                systemPrompt += `可用表情包描述列表：${availableEmojis.join(', ')}\n\n`;
            } else {
                systemPrompt += `【注意】\n`;
                systemPrompt += `你当前没有任何可用的表情包，请严格只使用文本进行回复，绝对不要发送任何表情包或类似 [表情] 的占位符。\n\n`;
            }
            
            // 后置世界书
            if (wbAfterPrompt) {
                systemPrompt += `【附加世界观与背景知识】\n${wbAfterPrompt}\n\n`;
            }

            systemPrompt += `【回复格式要求】\n`;
            systemPrompt += `你的回复必须严格拆分为 ${minReply} 到 ${maxReply} 个独立的气泡（即 messages 数组中的对象数量）！\n`;
            systemPrompt += `- Message Splitting (Natural Speech): Break your response into multiple independent short messages. Cut at natural speech pauses or breath marks. Do NOT cram multiple clauses or long paragraphs into one message.\n`;
            systemPrompt += `你必须严格输出合法的 JSON 格式，格式如下：\n`;
            if (availableEmojis.length > 0) {
                systemPrompt += `{\n  "messages": [\n    {"type":"text", "content":"完整的一句话。"}, \n    {"type":"emoji", "content":"表情包描述"} \n  ]\n}\n`;
            } else {
                systemPrompt += `{\n  "messages": [\n    {"type":"text", "content":"完整的一句话。"}, \n    {"type":"text", "content":"另一句话。"} \n  ]\n}\n`;
            }
            systemPrompt += `注意：只输出 JSON，不要包含任何 Markdown 标记（如 \`\`\`json）或其他说明文字。`;

            // 7. 发起 API 请求 (使用注入了世界书的 finalHistory)
            const response = await fetch(wcGetApiCompletionUrl(api.url), {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + api.key, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: api.model,
                    messages: [{ role: 'system', content: systemPrompt }, ...finalHistory]
                })
            });
            
            if (!response.ok) throw new Error('API 请求失败：HTTP ' + response.status);
            const result = await response.json();
            let content = result?.choices?.[0]?.message?.content ?? result?.choices?.[0]?.text ?? result?.output_text;
            content = typeof content === 'string' ? content.trim() : '';
            if (!content) throw new Error('API 未返回有效回复');

            // 8. 解析 JSON 与智能兜底方案
            let messages = [];
            try {
                let cleanJson = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                const parsed = JSON.parse(cleanJson);
                if (parsed && Array.isArray(parsed.messages)) {
                    messages = parsed.messages.filter(m => m.content); // 保留对象 {type, content}
                } else {
                    throw new Error('JSON format missing messages array');
                }
            } catch (e) {
                console.warn('JSON parsing failed, using fallback:', e);
                // 兜底 1: 正则提取 type 和 content
                const regex = /\{\s*"type"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*\}/g;
                let match;
                while ((match = regex.exec(content)) !== null) {
                    try {
                        messages.push({ type: match[1], content: JSON.parse(`"${match[2]}"`) });
                    } catch(err) {
                        messages.push({ type: match[1], content: match[2] });
                    }
                }
                
                // 兜底 2: 如果上面的正则没匹配到，退化为只匹配 content
                if (messages.length === 0) {
                    const fallbackRegex = /"content"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
                    let fbMatch;
                    while ((fbMatch = fallbackRegex.exec(content)) !== null) {
                        try {
                            messages.push({ type: 'text', content: JSON.parse(`"${fbMatch[1]}"`) });
                        } catch(err) {
                            messages.push({ type: 'text', content: fbMatch[1] });
                        }
                    }
                }

                // 兜底 3: 换行符切割
                if (messages.length === 0) {
                    let cleanText = content.replace(/```json|```|\[|\]|\{|\}|"messages":|"type":|"text"|"emoji"|"content":/g, '').trim();
                    let lines = cleanText.split('\n');
                    lines.forEach(line => {
                        let text = line.replace(/^["',\s]+|["',\s]+$/g, '');
                        if (text.length > 0) {
                            messages.push({ type: 'text', content: text });
                        }
                    });
                }
            }

            if (messages.length === 0) {
                messages = [{ type: 'text', content: content }]; // 终极兜底
            }

            let finalMessages = [];
            messages.forEach(msgObj => {
                const type = msgObj.type;
                const msgContent = msgObj.content;

                if (type === 'emoji') {
                    // 处理 emoji 类型
                    let foundUrl = null;
                    let cleanMsgContent = msgContent.replace(/^\[|\]$/g, '').trim(); // 去除可能存在的首尾中括号
                    if (contact?.boundEmojiGroups) {
                        for (const gid of contact.boundEmojiGroups) {
                            const group = wcEmojiGroups.find(g => g.id === gid);
                            if (group) {
                                const emoji = group.emojis.find(e => e.desc === cleanMsgContent || e.desc === msgContent);
                                if (emoji) {
                                    foundUrl = emoji.url;
                                    break;
                                }
                            }
                        }
                    }
                    if (foundUrl) {
                        finalMessages.push({ text: `[表情] ${cleanMsgContent}`, imageUrl: foundUrl });
                    } else {
                        // 如果没找到对应 URL，退化为文本
                        finalMessages.push({ text: `[表情] ${cleanMsgContent}`, imageUrl: null });
                    }
                } else {
                    // 处理 text 类型，兼容 AI 偶尔还是在文本里混排 [表情: xxx] 的情况
                    const emojiRegex = /\[表情:\s*([^\]]+)\]/g;
                    let lastIndex = 0;
                    let match;
                    while ((match = emojiRegex.exec(msgContent)) !== null) {
                        const textBefore = msgContent.substring(lastIndex, match.index).trim();
                        if (textBefore) {
                            finalMessages.push({ text: textBefore, imageUrl: null });
                        }
                        
                        const desc = match[1].trim().replace(/^\[|\]$/g, '').trim(); // 去除可能存在的首尾中括号
                        let foundUrl = null;
                        if (contact?.boundEmojiGroups) {
                            for (const gid of contact.boundEmojiGroups) {
                                const group = wcEmojiGroups.find(g => g.id === gid);
                                if (group) {
                                    const emoji = group.emojis.find(e => e.desc === desc);
                                    if (emoji) {
                                        foundUrl = emoji.url;
                                        break;
                                    }
                                }
                            }
                        }
                        
                        if (foundUrl) {
                            finalMessages.push({ text: `[表情] ${desc}`, imageUrl: foundUrl });
                        } else {
                            finalMessages.push({ text: match[0], imageUrl: null });
                        }
                        
                        lastIndex = emojiRegex.lastIndex;
                    }
                    
                    const textAfter = msgContent.substring(lastIndex).trim();
                    if (textAfter) {
                        finalMessages.push({ text: textAfter, imageUrl: null });
                    }
                }
            });

            // 9. 逐个渲染气泡
            for (let i = 0; i < finalMessages.length; i++) {
                wcAppendChatMessage(finalMessages[i].text, 'received', chatContactId, finalMessages[i].imageUrl);
                if (i < finalMessages.length - 1) {
                    wcSetApiTypingStatus(true);
                    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
                }
            }

        } catch (error) {
            console.error('WeChat API reply failed:', error);
            showToast(error?.message || '获取 API 回复失败');
        } finally {
            wcApiReplyPending = false;
            wcSetApiTypingStatus(false);
            if (button) {
                button.removeAttribute('aria-busy');
                button.style.pointerEvents = '';
                button.style.opacity = '';
            }
        }
    }

    function wcScrollToBottom() { const chatArea = document.getElementById('wc-chat-area'); chatArea.scrollTop = chatArea.scrollHeight; }
    function wcUpdateMessageGroupings() {
        const rows = document.querySelectorAll('#wc-chat-area .message-row');
        rows.forEach((row, index) => {
            const isSent = row.classList.contains('sent');
            const prevRow = rows[index - 1], nextRow = rows[index + 1];
            const prevIsSame = prevRow && prevRow.classList.contains(isSent ? 'sent' : 'received');
            const nextIsSame = nextRow && nextRow.classList.contains(isSent ? 'sent' : 'received');
            const bubble = row.querySelector('.message-bubble');
            row.className = `message-row ${isSent ? 'sent' : 'received'}`;
            bubble.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
            if (!prevIsSame && !nextIsSame) bubble.classList.add('tail');
            else if (!prevIsSame && nextIsSame) { row.classList.add('group-top'); bubble.classList.add('group-top'); }
            else if (prevIsSame && nextIsSame) { row.classList.add('group-mid'); bubble.classList.add('group-mid'); }
            else if (prevIsSame && !nextIsSame) { row.classList.add('group-bottom'); bubble.classList.add('group-bottom'); bubble.classList.add('tail'); }
        });
    }

    // --- 微信聊天记录搜索逻辑 ---
    function wcOpenChatSearch() {
        if (!wcCurrentChatContactId) return;
        document.getElementById('wcChatSearchInput').value = '';
        document.getElementById('wcChatSearchResults').innerHTML = '<div style="text-align: center; color: #8e8e93; margin-top: 40px; font-size: 14px;">请输入搜索内容</div>';
        
        document.querySelectorAll('#wechatAppUI .page').forEach(el => el.classList.remove('active'));
        document.getElementById('page-wc-chat-search').classList.add('active');
        
        const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
        if (bottomNav) bottomNav.style.display = 'none';
        
        setTimeout(() => {
            document.getElementById('wcChatSearchInput').focus();
        }, 300);
    }

    function wcCloseChatSearch() {
        document.querySelectorAll('#wechatAppUI .page').forEach(el => el.classList.remove('active'));
        document.getElementById('page-chat-room').classList.add('active');
    }

    function wcPerformChatSearch() {
        const keyword = document.getElementById('wcChatSearchInput').value.trim().toLowerCase();
        const resultsContainer = document.getElementById('wcChatSearchResults');
        
        if (!keyword) {
            resultsContainer.innerHTML = '<div style="text-align: center; color: #8e8e93; margin-top: 40px; font-size: 14px;">请输入搜索内容</div>';
            return;
        }

        const messages = wcChatMessagesByContact[wcCurrentChatContactId] || [];
        const contact = wcContactsList.find(c => c.id === wcCurrentChatContactId);
        const myAvatar = typeof appSettings !== 'undefined' && appSettings.wc_current_user_avatar ? appSettings.wc_current_user_avatar : '';
        const myName = typeof appSettings !== 'undefined' && appSettings.wc_current_user_name ? appSettings.wc_current_user_name : '我';
        
        const contactAvatar = contact ? contact.avatar : '';
        const contactName = contact ? contact.name : '对方';

        const results = messages.filter(msg => msg.text && msg.text.toLowerCase().includes(keyword));

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div style="text-align: center; color: #8e8e93; margin-top: 40px; font-size: 14px;">无搜索结果</div>';
            return;
        }

        let html = '';
        // 倒序显示，最新的在最上面
        results.slice().reverse().forEach(msg => {
            const isSent = msg.type === 'sent';
            const avatar = isSent ? myAvatar : contactAvatar;
            const name = isSent ? myName : contactName;
            
            const createdAt = Number(msg.createdAt);
            const dateObj = Number.isFinite(createdAt) ? new Date(createdAt) : new Date();
            const timeStr = `${(dateObj.getMonth()+1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;

            // 高亮关键字
            const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')})`, 'gi');
            const highlightedText = msg.text.replace(regex, '<span class="wc-chat-search-highlight">$1</span>');

            const avatarStyle = avatar ? `background-image: url('${avatar.replace(/'/g, "\\'")}'); background-color: transparent;` : 'background-color: transparent;';
            const avatarContent = avatar ? '' : getWcDefaultAvatarSvg();

            html += `
                <div class="wc-chat-search-result-item" onclick="wcJumpToMessage('${msg.id}')">
                    <div class="wc-chat-search-avatar" style="${avatarStyle}">${avatarContent}</div>
                    <div class="wc-chat-search-info">
                        <div class="wc-chat-search-name-time">
                            <div class="wc-chat-search-name">${name}</div>
                            <div class="wc-chat-search-time">${timeStr}</div>
                        </div>
                        <div class="wc-chat-search-text">${highlightedText}</div>
                    </div>
                </div>
            `;
        });

        resultsContainer.innerHTML = html;
    }

    function wcJumpToMessage(msgId) {
        wcCloseChatSearch();
        setTimeout(() => {
            const chatArea = document.getElementById('wc-chat-area');
            const msgEl = chatArea.querySelector(`.message-row[data-id="${msgId}"]`);
            if (msgEl) {
                msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const bubble = msgEl.querySelector('.message-bubble');
                if (bubble) {
                    const originalBg = bubble.style.backgroundColor;
                    bubble.style.transition = 'background-color 0.5s';
                    bubble.style.backgroundColor = 'rgba(0, 122, 255, 0.3)';
                    setTimeout(() => {
                        bubble.style.backgroundColor = originalBg || '';
                        setTimeout(() => { bubble.style.transition = ''; }, 500);
                    }, 1000);
                }
            } else {
                if (typeof showToast === 'function') showToast('无法定位到该消息');
            }
        }, 300);
    }

    // --- 微信聊天壁纸逻辑 ---

    function wcApplyChatBg() {
        const chatArea = document.getElementById('wc-chat-area');
        if (wcCurrentChatBg) {
            if (chatArea) {
                chatArea.style.backgroundImage = `url('${wcCurrentChatBg}')`;
                chatArea.style.backgroundSize = 'cover';
                chatArea.style.backgroundPosition = 'center';
                chatArea.style.backgroundColor = 'transparent';
            }
        } else {
            if (chatArea) {
                chatArea.style.backgroundImage = 'none';
                chatArea.style.backgroundColor = ''; 
            }
        }
    }

    function wcRenderChatBgLibrary() {
        const carousel = document.getElementById('wc-chat-bg-carousel');
        if (!carousel) return;
        
        let html = `
            <div class="wc-bg-add-box" onclick="wcOpenChatBgMenu(event)">
                <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>添加壁纸</span>
            </div>
        `;
        
        // 默认无壁纸选项
        const isNoneSelected = wcCurrentChatBg === '' ? 'selected' : '';
        html += `
            <div class="wc-bg-card ${isNoneSelected}" onclick="wcSetChatBg('')">
                <div class="wc-bg-img" style="background-color: #E5E5EA; display: flex; justify-content: center; align-items: center; color: #8e8e93; font-size: 14px; font-weight: 600;">无壁纸</div>
                <div class="wc-bg-selected-border"></div>
            </div>
        `;

        wcChatBgList.forEach((bg, index) => {
            const isSelected = wcCurrentChatBg === bg ? 'selected' : '';
            html += `
                <div class="wc-bg-card ${isSelected}" onclick="wcSetChatBg('${bg}')">
                    <div class="wc-bg-delete-btn" onclick="wcDeleteChatBg(${index}, event)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </div>
                    <div class="wc-bg-img" style="background-image: url('${bg}')"></div>
                    <div class="wc-bg-selected-border"></div>
                </div>
            `;
        });
        
        carousel.innerHTML = html;
    }

    function wcOpenChatBgMenu(event) {
        const overlay = document.getElementById('wcChatBgMenuOverlay');
        const menu = document.getElementById('wcChatBgMenu');
        overlay.style.display = 'block';
        const rect = event.currentTarget.getBoundingClientRect();
        let top = rect.bottom + 10;
        let left = rect.left;
        if (top + 130 > window.innerHeight) top = rect.top - 120;
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
    }

    function wcCloseChatBgMenu() {
        document.getElementById('wcChatBgMenuOverlay').style.display = 'none';
    }

    function wcHandleChatBgUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 1080;
                const MAX_HEIGHT = 2400;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                    const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                const base64Url = canvas.toDataURL('image/jpeg', 0.85);
                
                wcChatBgList.unshift(base64Url);
                wcSetChatBg(base64Url); // 内部会调用 wcSaveChatBgDataToDB
                showToast('壁纸添加成功');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    }

    function wcHandleChatBgUrl() {
        wcCloseChatBgMenu();
        showCustomPrompt('添加聊天壁纸', { placeholder: '输入图片 URL' }, '确定').then(url => {
            if (url && url.trim()) {
                wcChatBgList.unshift(url.trim());
                wcSetChatBg(url.trim()); // 内部会调用 wcSaveChatBgDataToDB
                showToast('壁纸添加成功');
            }
        });
    }

    function wcSetChatBg(url) {
        wcCurrentChatBg = url;
        wcSaveChatBgDataToDB();
        wcApplyChatBg();
        wcRenderChatBgLibrary();
    }

    function wcDeleteChatBg(index, event) {
        event.stopPropagation();
        showCustomConfirm('删除壁纸', '确定要删除这张聊天壁纸吗？', '删除', true).then(confirmed => {
            if (confirmed) {
                const deletedUrl = wcChatBgList[index];
                wcChatBgList.splice(index, 1);
                if (wcCurrentChatBg === deletedUrl) {
                    wcSetChatBg(''); // 内部会调用 wcSaveChatBgDataToDB
                } else {
                    wcSaveChatBgDataToDB();
                    wcRenderChatBgLibrary();
                }
            }
        });
    }

    // 每次打开壁纸页面时渲染库
    const originalWcShowThemeChatBg = window.wcShowThemeChatBg;
    window.wcShowThemeChatBg = function() {
        if (typeof originalWcShowThemeChatBg === 'function') originalWcShowThemeChatBg();
        wcRenderChatBgLibrary();
    };

    // ==========================================
    // 微信表情包管理逻辑
    // ==========================================

    let wcCurrentEmojiGroupId = null;
    let wcIsEmojiManageMode = false;
    let wcSelectedEmojiIds = new Set();

    function wcOpenEmojiApp() {
        document.getElementById('page-profile').classList.remove('active');
        document.getElementById('wc-page-emoji-groups').classList.add('active');
        const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
        if (bottomNav) bottomNav.style.display = 'none';
        wcRenderEmojiGroups();
    }

    function wcCloseEmojiApp() {
        document.getElementById('wc-page-emoji-groups').classList.remove('active');
        document.getElementById('wc-page-emoji-detail').classList.remove('active');
        document.getElementById('page-profile').classList.add('active');
        const bottomNav = document.querySelector('#wechatAppUI .bottom-nav-wrapper');
        if (bottomNav) bottomNav.style.display = 'block';
    }

    function wcGetAllEmojis() {
        let all = [];
        wcEmojiGroups.forEach(g => {
            g.emojis.forEach(e => { all.push({ ...e, groupId: g.id }); });
        });
        return all;
    }

    function wcCreateEmojiGroupCardHtml(name, emojis, isCreateBtn = false) {
        if (isCreateBtn) {
            return `
                <div class="wc-window-card" style="border-style: dashed;">
                    <div class="wc-window-header">
                        <div class="wc-window-count"></div>
                        <div class="wc-window-dots"><div class="wc-window-dot"></div><div class="wc-window-dot"></div><div class="wc-window-dot"></div></div>
                    </div>
                    <div class="wc-create-group-body"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div>
                </div>
                <div class="wc-group-info"><div class="wc-group-name">${name}</div></div>
            `;
        }
        const urls = [];
        for(let i = 0; i < 7; i++) { urls.push(emojis[i] ? `background-image: url('${emojis[i].url}')` : ''); }
        return `
            <div class="wc-window-card">
                <div class="wc-window-header">
                    <div class="wc-window-count">${emojis.length}</div>
                    <div class="wc-window-dots"><div class="wc-window-dot"></div><div class="wc-window-dot"></div><div class="wc-window-dot"></div></div>
                </div>
                <div class="wc-window-body">
                    <div class="wc-preview-cell" style="${urls[0]}"></div>
                    <div class="wc-preview-cell" style="${urls[1]}"></div>
                    <div class="wc-preview-cell" style="${urls[2]}"></div>
                    <div class="wc-preview-mini-grid">
                        <div class="wc-preview-mini-cell" style="${urls[3]}"></div>
                        <div class="wc-preview-mini-cell" style="${urls[4]}"></div>
                        <div class="wc-preview-mini-cell" style="${urls[5]}"></div>
                        <div class="wc-preview-mini-cell" style="${urls[6]}"></div>
                    </div>
                </div>
            </div>
            <div class="wc-group-info"><div class="wc-group-name">${name}</div></div>
        `;
    }

    function wcRenderEmojiGroups() {
        const grid = document.getElementById('wc-emoji-group-grid');
        grid.innerHTML = '';
        
        const createCard = document.createElement('div');
        createCard.className = 'wc-emoji-group-card';
        createCard.onclick = () => wcAddNewEmojiGroup();
        createCard.innerHTML = wcCreateEmojiGroupCardHtml('创建分组', [], true);
        grid.appendChild(createCard);

        const allEmojis = wcGetAllEmojis();
        const allCard = document.createElement('div');
        allCard.className = 'wc-emoji-group-card';
        allCard.onclick = () => wcOpenEmojiGroupDetail('all');
        allCard.innerHTML = wcCreateEmojiGroupCardHtml('全部', allEmojis);
        grid.appendChild(allCard);

        wcEmojiGroups.forEach(g => {
            const card = document.createElement('div');
            card.className = 'wc-emoji-group-card';
            
            let pressTimer;
            let isLongPress = false;
            
            card.addEventListener('touchstart', (e) => {
                isLongPress = false;
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    if (navigator.vibrate) navigator.vibrate(50);
                    showCustomConfirm('删除分组', `确定要删除分组 "${g.name}" 及其包含的所有表情吗？`, '删除', true).then(confirmed => {
                        if (confirmed) {
                            wcEmojiGroups = wcEmojiGroups.filter(group => group.id !== g.id);
                            wcSaveEmojiData();
                            wcRenderEmojiGroups();
                            if (typeof showToast === 'function') showToast('分组已删除');
                        }
                    });
                }, 500);
            }, {passive: true});
            
            card.addEventListener('touchmove', () => {
                clearTimeout(pressTimer);
            }, {passive: true});
            
            card.addEventListener('touchend', (e) => {
                clearTimeout(pressTimer);
                if (!isLongPress) {
                    wcOpenEmojiGroupDetail(g.id);
                }
            });
            
            // 兼容 PC 端点击
            card.onclick = (e) => {
                if (!isLongPress) {
                    wcOpenEmojiGroupDetail(g.id);
                }
            };

            card.innerHTML = wcCreateEmojiGroupCardHtml(g.name, g.emojis);
            grid.appendChild(card);
        });
    }

    function wcOpenEmojiGroupDetail(id) {
        wcCurrentEmojiGroupId = id;
        wcIsEmojiManageMode = false;
        wcSelectedEmojiIds.clear();
        document.getElementById('wc-detail-emoji-grid').classList.remove('wc-manage-mode');
        document.getElementById('wc-emoji-bottom-action-bar').classList.remove('show');
        document.getElementById('wc-btn-manage-emoji').innerText = '管理表情';

        let groupName = '';
        let emojis = [];

        if (id === 'all') {
            groupName = '全部';
            emojis = wcGetAllEmojis();
            document.getElementById('wc-btn-edit-emoji-group').style.display = 'none';
        } else {
            const group = wcEmojiGroups.find(g => g.id === id);
            if (!group) return;
            groupName = group.name;
            emojis = group.emojis;
            document.getElementById('wc-btn-edit-emoji-group').style.display = 'block';
        }
        
        document.getElementById('wc-nav-emoji-detail-title').innerText = groupName;
        document.getElementById('wc-detail-emoji-title').innerText = groupName;
        
        const coverBox = document.getElementById('wc-detail-emoji-cover');
        let coverHtml = '';
        for(let i=0; i<4; i++) {
            const url = emojis[i] ? emojis[i].url : '';
            const bgStyle = url ? `background-image: url('${url}')` : '';
            coverHtml += `<div class="wc-detail-cover-img" style="${bgStyle}"></div>`;
        }
        coverBox.innerHTML = coverHtml;

        wcRenderDetailEmojis(emojis);

        document.getElementById('wc-page-emoji-groups').classList.add('slide-left');
        document.getElementById('wc-page-emoji-detail').classList.add('active');
    }

    function wcRenderDetailEmojis(emojis) {
        const grid = document.getElementById('wc-detail-emoji-grid');
        const card = grid.closest('.wc-detail-card'); // 获取外层包裹的卡片
        grid.innerHTML = '';
        
        if (emojis.length === 0) {
            // 如果没有表情包，隐藏外层卡片的背景和阴影，避免出现空横杠
            if (card) {
                card.style.backgroundColor = 'transparent';
                card.style.boxShadow = 'none';
            }
            grid.style.display = 'block'; // 取消 grid 布局
            grid.innerHTML = '<div style="text-align: center; color: #8e8e93; padding: 40px 0; font-size: 14px; font-weight: 500;">当前暂无表情包</div>';
            return;
        }
        
        // 如果有表情包，恢复外层卡片样式和 grid 布局
        if (card) {
            card.style.backgroundColor = '';
            card.style.boxShadow = '';
        }
        grid.style.display = 'grid';
        
        emojis.forEach(e => {
            const item = document.createElement('div');
            item.className = 'wc-detail-emoji-item';
            item.id = `wc-emoji-item-${e.id}`;
            item.onclick = () => {
                if (wcIsEmojiManageMode) wcToggleEmojiSelection(e.id);
                else showToast(`预览表情：${e.desc}`);
            };
            item.innerHTML = `
                <div class="wc-emoji-img-box"><img src="${e.url}" alt="${e.desc}"></div>
                <div class="wc-emoji-desc">${e.desc}</div>
                <div class="wc-emoji-checkbox"></div>
            `;
            grid.appendChild(item);
        });
    }

    function wcBackToEmojiGroups() {
        wcCurrentEmojiGroupId = null;
        document.getElementById('wc-page-emoji-detail').classList.remove('active');
        document.getElementById('wc-page-emoji-groups').classList.remove('slide-left');
        wcRenderEmojiGroups(); 
    }

    function wcToggleEmojiManageMode() {
        wcIsEmojiManageMode = !wcIsEmojiManageMode;
        const grid = document.getElementById('wc-detail-emoji-grid');
        const actionBar = document.getElementById('wc-emoji-bottom-action-bar');
        const btnManage = document.getElementById('wc-btn-manage-emoji');

        if (wcIsEmojiManageMode) {
            grid.classList.add('wc-manage-mode');
            actionBar.classList.add('show');
            btnManage.innerText = '取消管理';
            wcSelectedEmojiIds.clear();
            wcUpdateEmojiActionButtons();
        } else {
            grid.classList.remove('wc-manage-mode');
            actionBar.classList.remove('show');
            btnManage.innerText = '管理表情';
            document.querySelectorAll('.wc-detail-emoji-item').forEach(el => el.classList.remove('selected'));
        }
    }

    function wcToggleEmojiSelection(id) {
        const item = document.getElementById(`wc-emoji-item-${id}`);
        if (wcSelectedEmojiIds.has(id)) {
            wcSelectedEmojiIds.delete(id);
            item.classList.remove('selected');
        } else {
            wcSelectedEmojiIds.add(id);
            item.classList.add('selected');
        }
        wcUpdateEmojiActionButtons();
    }

    function wcUpdateEmojiActionButtons() {
        const btnDelete = document.getElementById('wc-btn-delete-emojis');
        const btnMove = document.getElementById('wc-btn-move-emojis');
        if (wcSelectedEmojiIds.size > 0) {
            btnDelete.classList.remove('disabled');
            btnMove.classList.remove('disabled');
            btnDelete.innerText = `删除 (${wcSelectedEmojiIds.size})`;
        } else {
            btnDelete.classList.add('disabled');
            btnMove.classList.add('disabled');
            btnDelete.innerText = '删除';
        }
    }

    function wcDeleteSelectedEmojis() {
        if (wcSelectedEmojiIds.size === 0) return;
        showCustomConfirm('删除表情', `确定要删除选中的 ${wcSelectedEmojiIds.size} 个表情吗？`, '删除', true).then(confirmed => {
            if (confirmed) {
                wcEmojiGroups.forEach(g => {
                    g.emojis = g.emojis.filter(e => !wcSelectedEmojiIds.has(e.id));
                });
                wcSaveEmojiData();
                wcOpenEmojiGroupDetail(wcCurrentEmojiGroupId);
            }
        });
    }

    function wcOpenMoveEmojiModal() {
        if (wcSelectedEmojiIds.size === 0) return;
        
        let items = [];
        wcEmojiGroups.forEach(g => {
            if (wcCurrentEmojiGroupId === 'all' || g.id !== wcCurrentEmojiGroupId) {
                items.push({ label: g.name, value: g.id });
            }
        });

        if (items.length === 0) {
            showToast('没有其他分组可选');
            return;
        }

        openUniversalSelect({
            title: '移动表情至',
            items: items,
            currentValue: '',
            searchable: true, // 表情分组可能比较多，开启搜索框
            onSelect: (targetGroupId) => {
                wcConfirmMoveEmojis(targetGroupId);
            }
        });
    }

    function wcConfirmMoveEmojis(targetGroupId) {
        const targetGroup = wcEmojiGroups.find(g => g.id === targetGroupId);
        if (!targetGroup) return;
        let emojisToMove = [];
        wcEmojiGroups.forEach(g => {
            const toMove = g.emojis.filter(e => wcSelectedEmojiIds.has(e.id));
            emojisToMove = emojisToMove.concat(toMove);
            g.emojis = g.emojis.filter(e => !wcSelectedEmojiIds.has(e.id));
        });
        targetGroup.emojis = targetGroup.emojis.concat(emojisToMove);
        wcSaveEmojiData();
        wcOpenEmojiGroupDetail(wcCurrentEmojiGroupId);
        showToast(`成功移动 ${emojisToMove.length} 个表情到 "${targetGroup.name}"`);
    }

    function wcAddNewEmojiGroup() {
        showCustomPrompt('新建表情分组', { placeholder: '请输入分组名称' }, '创建').then(name => {
            if (name === null) return;
            if (name.trim()) {
                wcEmojiGroups.push({ id: 'g_' + Date.now(), name: name.trim(), emojis: [] });
                wcSaveEmojiData();
                wcRenderEmojiGroups();
            } else {
                showCustomAlert('提示', '请输入分组名称');
            }
        });
    }

    function wcOpenEditEmojiGroupModal() {
        if (wcCurrentEmojiGroupId === 'all') return;
        const group = wcEmojiGroups.find(g => g.id === wcCurrentEmojiGroupId);
        if (group) {
            showCustomPrompt('编辑分组', { placeholder: '分组名称', value: group.name }, '保存').then(newName => {
                if (newName === null) return;
                if (newName.trim()) {
                    group.name = newName.trim();
                    document.getElementById('wc-nav-emoji-detail-title').innerText = group.name;
                    document.getElementById('wc-detail-emoji-title').innerText = group.name;
                    wcSaveEmojiData();
                } else {
                    showCustomAlert('提示', '分组名称不能为空');
                }
            });
        }
    }

    function wcDeleteCurrentEmojiGroup() {
        showCustomConfirm('删除分组', '确定要删除此分组及其包含的所有表情吗？', '删除', true).then(confirmed => {
            if (confirmed) {
                wcEmojiGroups = wcEmojiGroups.filter(g => g.id !== wcCurrentEmojiGroupId);
                wcSaveEmojiData();
                wcBackToEmojiGroups();
            }
        });
    }

    function wcImportEmojis() {
        const selectText = document.getElementById('wcBatchGroupSelectText');
        
        if (wcEmojiGroups.length === 0) {
            selectText.setAttribute('data-value', 'new_default');
            selectText.innerText = '默认分组';
        } else {
            let targetGroup = wcEmojiGroups.find(g => g.id === wcCurrentEmojiGroupId) || wcEmojiGroups[0];
            selectText.setAttribute('data-value', targetGroup.id);
            selectText.innerText = targetGroup.name;
        }
        
        document.getElementById('wcBatchImportTextarea').value = '';
        document.getElementById('wcBatchImportOverlay').classList.add('show');
    }

    function wcCloseBatchImportModal() {
        document.getElementById('wcBatchImportOverlay').classList.remove('show');
    }

    function wcHandleBatchImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            const textarea = document.getElementById('wcBatchImportTextarea');
            textarea.value = textarea.value ? textarea.value + '\n' + text : text;
            if (typeof showToast === 'function') showToast('文件读取成功');
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function wcSaveBatchImport() {
        const data = document.getElementById('wcBatchImportTextarea').value;
        if (!data.trim()) { showCustomAlert('提示', '请输入导入数据'); return; }
        
        const selectText = document.getElementById('wcBatchGroupSelectText');
        let targetGroupId = selectText.getAttribute('data-value');
        let targetGroup = null;

        if (targetGroupId === 'new_default') {
            targetGroup = { id: 'g_' + Date.now(), name: '默认分组', emojis: [] };
            wcEmojiGroups.push(targetGroup);
        } else {
            targetGroup = wcEmojiGroups.find(g => g.id === targetGroupId);
        }
        
        if (!targetGroup) return;

        const lines = data.split(/[\n\s,]+/);
        let count = 0;
        lines.forEach(line => {
            const parts = line.split(/[:：]/);
            if (parts.length >= 2) {
                const desc = parts[0].trim();
                const url = parts.slice(1).join(':').trim(); 
                if (desc && url) {
                    targetGroup.emojis.push({ id: 'e_' + Math.random().toString(36).substr(2, 9), desc, url });
                    count++;
                }
            }
        });
        
        if (count > 0) {
            wcSaveEmojiData();
            wcCloseBatchImportModal();
            if (wcCurrentEmojiGroupId === 'all' || wcCurrentEmojiGroupId === targetGroup.id) {
                wcOpenEmojiGroupDetail(wcCurrentEmojiGroupId || targetGroup.id);
            } else {
                wcRenderEmojiGroups();
            }
            if (typeof showToast === 'function') showToast(`成功导入 ${count} 个表情包`);
        } else {
            showCustomAlert('提示', '未识别到有效格式的数据，请检查格式是否为：描述:URL');
        }
    }

    // ==========================================

