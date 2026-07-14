/**
 * 安卓全屏兜底：点击屏幕进入全屏模式（iOS 不支持此 API，会自动忽略）。
 * 在 PWA standalone/fullscreen 模式下跳过，避免重复请求全屏。
 */
document.addEventListener('DOMContentLoaded', () => {
    // 已经是独立 PWA 窗口（standalone / fullscreen / iOS standalone），无需再请求全屏
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.matchMedia('(display-mode: fullscreen)').matches || 
                         window.navigator.standalone === true;
    if (isStandalone) return;

    const isMobile = window.matchMedia("(max-width: 768px) and (hover: none) and (pointer: coarse)").matches;
    if (!isMobile) return;

    function tryFullscreen() {
        const doc = document.documentElement;
        if (document.fullscreenElement || document.webkitCurrentFullScreenElement) return;

        if (doc.requestFullscreen) {
            doc.requestFullscreen().catch(() => {});
        } else if (doc.webkitRequestFullscreen) { /* Safari */
            doc.webkitRequestFullscreen();
        }
    }

    // 每次点击都尝试进入全屏（退出后可重新进入）
    document.addEventListener("click", tryFullscreen);
});
